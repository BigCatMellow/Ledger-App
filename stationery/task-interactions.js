(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const UI_KEY='ledger-task-ui-v1';
  let reorderMode=false;
  let enhanceQueued=false;
  let undoBefore='';
  let undoAfter='';
  let undoTimer=0;

  function uid(prefix='s'){
    if(globalThis.crypto?.randomUUID)return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function readState(){
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      state.projects=Array.isArray(state.projects)?state.projects:[];
      state.items=Array.isArray(state.items)?state.items:[];
      return state;
    }catch(e){return {projects:[],items:[]};}
  }

  function readUi(){
    try{
      const ui=JSON.parse(localStorage.getItem(UI_KEY)||'{}');
      ui.collapsed=ui.collapsed&&typeof ui.collapsed==='object'?ui.collapsed:{};
      return ui;
    }catch(e){return {collapsed:{}};}
  }

  function saveUi(ui){
    try{localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch(e){}
  }

  function notifyLedger(value){
    let event;
    try{
      event=new StorageEvent('storage',{key:STORAGE_KEY,newValue:value,storageArea:localStorage,url:location.href});
    }catch(e){
      event=new Event('storage');
      Object.defineProperty(event,'key',{value:STORAGE_KEY});
      Object.defineProperty(event,'newValue',{value});
    }
    window.dispatchEvent(event);
  }

  function writeState(state){
    const value=JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY,value);
    notifyLedger(value);
    return value;
  }

  function hasChecklist(item){
    return Array.isArray(item?.subtasks)&&item.subtasks.some(sub=>String(typeof sub==='string'?sub:sub?.text||'').trim());
  }

  function hasRichDetails(item){
    if(!item||item.kind==='NOTE')return false;
    if(hasChecklist(item))return true;
    return ['notes','outcome','inputs','dependencies','boundary','acceptance','verification','stopCondition']
      .some(key=>String(item[key]||'').trim());
  }

  function ensureUndoBar(){
    let bar=document.getElementById('ledgerUndoBar');
    if(bar)return bar;
    bar=document.createElement('div');
    bar.id='ledgerUndoBar';
    bar.className='ledger-undo-bar';
    bar.hidden=true;
    bar.innerHTML='<span id="ledgerUndoText">Changed</span><button type="button" data-ledger-undo>Undo</button>';
    document.body.appendChild(bar);
    return bar;
  }

  function hideUndo(){
    clearTimeout(undoTimer);
    undoTimer=0;
    const bar=document.getElementById('ledgerUndoBar');
    if(bar)bar.hidden=true;
    undoBefore='';
    undoAfter='';
  }

  function offerUndo(before,message){
    const after=localStorage.getItem(STORAGE_KEY)||'';
    if(!before||before===after)return;
    undoBefore=before;
    undoAfter=after;
    const bar=ensureUndoBar();
    const text=document.getElementById('ledgerUndoText');
    if(text)text.textContent=message;
    bar.hidden=false;
    clearTimeout(undoTimer);
    undoTimer=setTimeout(hideUndo,7000);
  }

  function performUndo(){
    if(!undoBefore)return;
    const current=localStorage.getItem(STORAGE_KEY)||'';
    if(current!==undoAfter){hideUndo();return;}
    const restore=undoBefore;
    hideUndo();
    localStorage.setItem(STORAGE_KEY,restore);
    notifyLedger(restore);
  }

  function queueEnhance(){
    if(enhanceQueued)return;
    enhanceQueued=true;
    setTimeout(()=>{
      enhanceQueued=false;
      enhance();
    },0);
  }

  function ensureReorderHeader(){
    const openItems=document.getElementById('openItems');
    const count=document.getElementById('openCount');
    if(!openItems||!count)return;

    let actions=document.querySelector('.task-open-header-actions');
    if(!actions){
      actions=document.createElement('span');
      actions.className='task-open-header-actions';
      count.parentNode.insertBefore(actions,count);
      actions.appendChild(count);
      const button=document.createElement('button');
      button.type='button';
      button.className='task-reorder-toggle';
      button.dataset.taskReorderToggle='';
      actions.appendChild(button);
    }

    const button=actions.querySelector('[data-task-reorder-toggle]');
    const entries=[...openItems.querySelectorAll(':scope > .entry[data-item]')];
    if(button){
      const label=reorderMode?'Done':'Reorder';
      if(button.textContent!==label)button.textContent=label;
      button.disabled=entries.length<2&&!reorderMode;
      button.setAttribute('aria-pressed',reorderMode?'true':'false');
    }
    openItems.classList.toggle('task-reorder-mode',reorderMode);
  }

  function enhanceReorderRows(){
    const openItems=document.getElementById('openItems');
    if(!openItems)return;
    const entries=[...openItems.querySelectorAll(':scope > .entry[data-item]')];
    entries.forEach((entry,index)=>{
      let controls=entry.querySelector('.task-order-controls');
      if(!reorderMode){
        controls?.remove();
        return;
      }
      if(!controls){
        controls=document.createElement('span');
        controls.className='task-order-controls';
        controls.innerHTML=`<button type="button" data-task-move="-1" data-task-id="${entry.dataset.item}" aria-label="Move task up">↑</button><button type="button" data-task-move="1" data-task-id="${entry.dataset.item}" aria-label="Move task down">↓</button>`;
        const chevron=entry.querySelector('.entry-chevron');
        if(chevron)chevron.before(controls); else entry.appendChild(controls);
      }
      const up=controls.querySelector('[data-task-move="-1"]');
      const down=controls.querySelector('[data-task-move="1"]');
      if(up)up.disabled=index===0;
      if(down)down.disabled=index===entries.length-1;
    });
  }

  function enhanceChecklistActions(items){
    document.querySelectorAll('.entry[data-item]').forEach(entry=>{
      const item=items.get(entry.dataset.item);
      if(!item||item.kind==='NOTE')return;

      const head=entry.querySelector('.task-checklist-head');
      if(head&&!head.querySelector('[data-task-inline-step]')){
        const add=document.createElement('button');
        add.type='button';
        add.className='task-checklist-add';
        add.dataset.taskInlineStep=item.id;
        add.textContent='＋ Step';
        add.setAttribute('aria-label','Add checklist step');
        head.appendChild(add);
      }

      const rail=entry.querySelector(':scope > .task-link-actions');
      if(!rail)return;

      if(!hasChecklist(item)&&!rail.querySelector('[data-task-inline-step]')){
        const add=document.createElement('button');
        add.type='button';
        add.className='task-link-button task-inline-rail-button';
        add.dataset.taskInlineStep=item.id;
        add.textContent='＋ Step';
        add.setAttribute('aria-label','Add checklist step');
        rail.appendChild(add);
      }

      if(hasRichDetails(item)&&!rail.querySelector('[data-task-collapse]')){
        const button=document.createElement('button');
        button.type='button';
        button.className='task-link-button task-collapse-button';
        button.dataset.taskCollapse=item.id;
        rail.appendChild(button);
      }
    });
  }

  function applyCollapse(items){
    const ui=readUi();
    document.querySelectorAll('.entry[data-item]').forEach(entry=>{
      const item=items.get(entry.dataset.item);
      if(!item||item.kind==='NOTE')return;
      const rich=hasRichDetails(item);
      const collapsed=rich&&!!ui.collapsed[item.id];
      entry.classList.toggle('task-collapsed',collapsed);
      const button=entry.querySelector('[data-task-collapse]');
      if(button){
        const symbol=collapsed?'▾':'▴';
        const title=collapsed?'Show task details':'Hide task details';
        if(button.textContent!==symbol)button.textContent=symbol;
        if(button.title!==title)button.title=title;
        button.setAttribute('aria-label',title);
        button.setAttribute('aria-expanded',collapsed?'false':'true');
      }
    });
  }

  function enhance(){
    const state=readState();
    const items=new Map(state.items.map(item=>[item.id,item]));
    ensureReorderHeader();
    enhanceReorderRows();
    enhanceChecklistActions(items);
    applyCollapse(items);
  }

  function openInlineStep(itemId,source){
    const entry=source?.closest('.entry[data-item]')||document.querySelector(`.entry[data-item="${CSS.escape(itemId)}"]`);
    if(!entry)return;
    const content=entry.children[1];
    if(!content)return;

    document.querySelectorAll('.task-inline-step-editor').forEach(node=>node.remove());
    const editor=document.createElement('div');
    editor.className='task-inline-step-editor';
    editor.dataset.taskInlineEditor=itemId;
    editor.innerHTML='<input type="text" placeholder="What needs to happen?" aria-label="New checklist step"><button type="button" data-task-inline-save>Add</button><button type="button" data-task-inline-cancel aria-label="Cancel adding step">×</button>';
    const extra=content.querySelector('.task-extra');
    if(extra)extra.before(editor); else content.appendChild(editor);
    editor.querySelector('input')?.focus({preventScroll:true});
  }

  function saveInlineStep(editor){
    const itemId=editor?.dataset.taskInlineEditor;
    const text=String(editor?.querySelector('input')?.value||'').trim();
    if(!itemId||!text){editor?.remove();return;}

    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    if(!item){editor.remove();return;}

    item.subtasks=Array.isArray(item.subtasks)?item.subtasks:[];
    item.subtasks.push({id:uid('s'),text,done:false});
    const t=new Date().toISOString();
    item.workedAt=t;
    const project=state.projects.find(p=>p.id===item.p);
    if(project)project.workedAt=t;
    writeState(state);
    editor.remove();
    offerUndo(before,'Step added');
  }

  function toggleCollapse(itemId){
    const ui=readUi();
    ui.collapsed[itemId]=!ui.collapsed[itemId];
    if(!ui.collapsed[itemId])delete ui.collapsed[itemId];
    saveUi(ui);
    enhance();
  }

  function moveTask(itemId,direction){
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    if(!item)return;

    const open=state.items.filter(x=>x.p===item.p&&x.kind!=='NOTE'&&x.status!=='DONE'&&x.status!=='ACTIVE');
    const current=open.findIndex(x=>x.id===itemId);
    const target=current+direction;
    if(current<0||target<0||target>=open.length)return;

    const other=open[target];
    const a=state.items.findIndex(x=>x.id===item.id);
    const b=state.items.findIndex(x=>x.id===other.id);
    if(a<0||b<0)return;
    [state.items[a],state.items[b]]=[state.items[b],state.items[a]];
    const project=state.projects.find(p=>p.id===item.p);
    if(project)project.workedAt=new Date().toISOString();
    writeState(state);
    offerUndo(before,'Task moved');
  }

  document.addEventListener('click',event=>{
    const undo=event.target.closest('[data-ledger-undo]');
    if(undo){
      event.preventDefault();
      event.stopPropagation();
      performUndo();
      return;
    }

    const reorder=event.target.closest('[data-task-reorder-toggle]');
    if(reorder){
      event.preventDefault();
      event.stopPropagation();
      reorderMode=!reorderMode;
      enhance();
      return;
    }

    const move=event.target.closest('[data-task-move][data-task-id]');
    if(move){
      event.preventDefault();
      event.stopPropagation();
      moveTask(move.dataset.taskId,Number(move.dataset.taskMove));
      return;
    }

    const collapse=event.target.closest('[data-task-collapse]');
    if(collapse){
      event.preventDefault();
      event.stopPropagation();
      toggleCollapse(collapse.dataset.taskCollapse);
      return;
    }

    const addStep=event.target.closest('[data-task-inline-step]');
    if(addStep){
      event.preventDefault();
      event.stopPropagation();
      openInlineStep(addStep.dataset.taskInlineStep,addStep);
      return;
    }

    const save=event.target.closest('[data-task-inline-save]');
    if(save){
      event.preventDefault();
      event.stopPropagation();
      saveInlineStep(save.closest('.task-inline-step-editor'));
      return;
    }

    const cancel=event.target.closest('[data-task-inline-cancel]');
    if(cancel){
      event.preventDefault();
      event.stopPropagation();
      cancel.closest('.task-inline-step-editor')?.remove();
      return;
    }

    const reversible=event.target.closest('.task-subtask[data-subtask-id],[data-task-link-edit]');
    if(reversible){
      const before=localStorage.getItem(STORAGE_KEY)||'';
      const label=reversible.matches('[data-task-link-edit]')?'Task link changed':'Checklist updated';
      setTimeout(()=>offerUndo(before,label),0);
    }
  },true);

  document.addEventListener('keydown',event=>{
    const input=event.target.closest?.('.task-inline-step-editor input');
    if(!input)return;
    if(event.key==='Enter'){
      event.preventDefault();
      saveInlineStep(input.closest('.task-inline-step-editor'));
    }else if(event.key==='Escape'){
      event.preventDefault();
      input.closest('.task-inline-step-editor')?.remove();
    }
  });

  const lists=['activeItems','openItems','doneItems'].map(id=>document.getElementById(id)).filter(Boolean);
  lists.forEach(list=>new MutationObserver(queueEnhance).observe(list,{childList:true,subtree:true}));
  window.addEventListener('storage',event=>{
    if(event.key===STORAGE_KEY)queueEnhance();
    if(event.key===UI_KEY)queueEnhance();
  });

  ensureUndoBar();
  setTimeout(enhance,0);
})();
