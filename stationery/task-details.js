(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const $=id=>document.getElementById(id);

  function esc(value){
    return String(value??'').replace(/[&<>'"]/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[c]));
  }

  function uid(prefix='s'){
    if(globalThis.crypto?.randomUUID)return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function readState(){
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      state.projects=Array.isArray(state.projects)?state.projects:[];
      state.items=Array.isArray(state.items)?state.items:[];
      state.worklog=Array.isArray(state.worklog)?state.worklog:[];
      return state;
    }catch(e){
      return {projects:[],items:[],worklog:[]};
    }
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
  }

  function normalizeSubtasks(item){
    if(!Array.isArray(item?.subtasks))return [];
    return item.subtasks.map(sub=>typeof sub==='string'?{id:uid(),text:sub,done:false}:sub||{}).map(sub=>({
      id:String(sub.id||uid()),
      text:String(sub.text||'').trim(),
      done:!!sub.done
    })).filter(sub=>sub.text);
  }

  function taskFieldsHtml(item){
    const fields=[
      ['Outcome',item.outcome],
      ['Input / source',item.inputs],
      ['Waiting on',item.dependencies],
      ['Boundary',item.boundary],
      ['Done when',item.acceptance],
      ['Verification',item.verification],
      ['Stop condition',item.stopCondition]
    ].filter(([,value])=>String(value||'').trim());
    if(!fields.length)return '';
    return `<div class="task-fields">${fields.map(([label,value])=>`<div class="task-field"><span class="task-field-label">${esc(label)}</span><span class="task-field-value">${esc(value)}</span></div>`).join('')}</div>`;
  }

  function checklistHtml(item){
    const subtasks=normalizeSubtasks(item);
    if(!subtasks.length)return '';
    const done=subtasks.filter(sub=>sub.done).length;
    return `<div class="task-checklist"><div class="task-checklist-head"><span>Checklist</span><span>${done}/${subtasks.length}</span></div>${subtasks.map(sub=>`<label class="task-subtask ${sub.done?'done':''}" data-subtask-id="${esc(sub.id)}" data-subtask-item="${esc(item.id)}"><input type="checkbox" ${sub.done?'checked':''} aria-label="${sub.done?'Mark incomplete':'Mark complete'}: ${esc(sub.text)}"><span>${esc(sub.text)}</span></label>`).join('')}</div>`;
  }

  function quickActionsHtml(item){
    if(!item||item.kind==='NOTE')return '';
    if(item.status==='ACTIVE'){
      return `<div class="task-quick-actions"><button type="button" class="task-quick-action task-action-done" data-task-item="${esc(item.id)}" data-task-status="DONE">✓ Done</button></div>`;
    }
    if(item.status==='DONE'){
      return `<div class="task-quick-actions"><button type="button" class="task-quick-action" data-task-item="${esc(item.id)}" data-task-status="OPEN">↶ Reopen</button></div>`;
    }
    return `<div class="task-quick-actions"><button type="button" class="task-quick-action task-action-start" data-task-item="${esc(item.id)}" data-task-status="ACTIVE">▶ Start</button><button type="button" class="task-quick-action task-action-done" data-task-item="${esc(item.id)}" data-task-status="DONE">✓ Done</button></div>`;
  }

  function detailsHtml(item){
    if(!item||item.kind==='NOTE')return '';
    const pieces=[];
    if(String(item.notes||'').trim())pieces.push(`<div class="task-note">${esc(item.notes)}</div>`);
    const fields=taskFieldsHtml(item); if(fields)pieces.push(fields);
    const checklist=checklistHtml(item); if(checklist)pieces.push(checklist);
    const actions=quickActionsHtml(item); if(actions)pieces.push(actions);
    return pieces.length?`<div class="task-extra">${pieces.join('')}</div>`:'';
  }

  function enhanceEntries(){
    const state=readState();
    const items=new Map(state.items.map(item=>[item.id,item]));
    document.querySelectorAll('.entry[data-item]').forEach(entry=>{
      const item=items.get(entry.dataset.item);
      const content=entry.children[1];
      if(!item||!content)return;
      content.classList.add('entry-content');
      content.querySelector('.task-extra')?.remove();
      const html=detailsHtml(item);
      if(html)content.insertAdjacentHTML('beforeend',html);
    });
  }

  function ensureNoteAction(){
    const state=readState();
    const notesSection=$('notesSection');
    if(notesSection&&state.projects.length)notesSection.hidden=false;

    const count=$('noteCount');
    if(!count||document.querySelector('[data-project-note-new]'))return;
    const actions=document.createElement('span');
    actions.className='journal-rule-actions project-note-actions';
    count.replaceWith(actions);
    actions.appendChild(count);

    const button=document.createElement('button');
    button.className='journal-add project-note-add';
    button.type='button';
    button.dataset.projectNoteNew='';
    button.textContent='＋ Note';
    button.setAttribute('aria-label','Add note to current project');
    actions.appendChild(button);
  }

  function enhanceAll(){
    ensureNoteAction();
    enhanceEntries();
  }

  function openCaptureKind(kind){
    const capture=document.querySelector('[data-action="capture"]');
    if(!capture)return;
    capture.click();
    setTimeout(()=>{
      document.querySelector(`[data-kind="${kind}"]`)?.click();
      $('captureTitle')?.focus({preventScroll:true});
    },30);
  }

  function logStatusChange(state,item,status,prior){
    const t=new Date().toISOString();
    item.status=status;
    item.workedAt=t;
    item.completedAt=status==='DONE'?t:'';
    const project=state.projects.find(p=>p.id===item.p);
    if(project)project.workedAt=t;
    let summary='';
    if(status==='ACTIVE'&&prior!=='ACTIVE')summary=`Started: ${item.title}`;
    else if(status==='DONE'&&prior!=='DONE')summary=`Completed: ${item.title}`;
    else if(status==='OPEN'&&prior!=='OPEN')summary=`Reopened: ${item.title}`;
    if(summary)state.worklog.unshift({id:uid('w'),p:item.p,itemId:item.id,whenAt:t,summary});
  }

  function setTaskStatus(itemId,status){
    const state=readState();
    const item=state.items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    if(!item||item.status===status)return;
    const prior=item.status;
    logStatusChange(state,item,status,prior);
    writeState(state);
    setTimeout(enhanceAll,0);
  }

  function toggleSubtask(itemId,subtaskId,done){
    const state=readState();
    const item=state.items.find(x=>x.id===itemId);
    if(!item)return;
    item.subtasks=normalizeSubtasks(item);
    const sub=item.subtasks.find(x=>x.id===subtaskId);
    if(!sub)return;
    sub.done=done;
    item.workedAt=new Date().toISOString();
    const project=state.projects.find(p=>p.id===item.p);
    if(project)project.workedAt=item.workedAt;
    writeState(state);
    setTimeout(enhanceAll,0);
  }

  function editorRow(sub){
    const row=document.createElement('div');
    row.className='task-editor-row';
    row.dataset.editorSubtaskId=sub?.id||uid();
    row.innerHTML=`<input class="task-editor-check" type="checkbox" ${sub?.done?'checked':''} aria-label="Step complete"><input class="task-editor-text" type="text" value="${esc(sub?.text||'')}" placeholder="What needs to happen?" aria-label="Checklist step"><div class="task-editor-row-actions"><button type="button" data-editor-move="-1">Up</button><button type="button" data-editor-move="1">Down</button><button type="button" data-editor-promote>Make task</button><button type="button" data-editor-remove>Remove</button></div>`;
    return row;
  }

  function refreshEditorButtons(){
    const rows=[...document.querySelectorAll('#itemSubtasksRows .task-editor-row')];
    rows.forEach((row,index)=>{
      const up=row.querySelector('[data-editor-move="-1"]');
      const down=row.querySelector('[data-editor-move="1"]');
      if(up)up.disabled=index===0;
      if(down)down.disabled=index===rows.length-1;
    });
  }

  function addEditorRow(sub=null,afterRow=null){
    const rows=$('itemSubtasksRows');
    if(!rows)return null;
    const row=editorRow(sub||{id:uid(),text:'',done:false});
    if(afterRow?.parentElement===rows)afterRow.after(row); else rows.appendChild(row);
    refreshEditorButtons();
    row.querySelector('.task-editor-text')?.focus({preventScroll:true});
    return row;
  }

  function renderEditorRows(item){
    const rows=$('itemSubtasksRows');
    if(!rows)return;
    rows.innerHTML='';
    normalizeSubtasks(item).forEach(sub=>rows.appendChild(editorRow(sub)));
    refreshEditorButtons();
  }

  function collectEditorSubtasks(excludeRow=null){
    return [...document.querySelectorAll('#itemSubtasksRows .task-editor-row')].filter(row=>row!==excludeRow).map(row=>({
      id:row.dataset.editorSubtaskId||uid(),
      text:String(row.querySelector('.task-editor-text')?.value||'').trim(),
      done:!!row.querySelector('.task-editor-check')?.checked
    })).filter(sub=>sub.text);
  }

  function ensureEditorField(){
    const form=$('itemForm');
    const status=$('itemStatusActions');
    if(!form||!status||$('itemSubtasksField'))return;
    const field=document.createElement('div');
    field.id='itemSubtasksField';
    field.className='field task-editor-checklist';
    field.innerHTML='<div class="task-editor-checklist-head"><span>Checklist / subtasks</span><button type="button" data-editor-add-step>＋ Add step</button></div><div id="itemSubtasksRows" class="task-editor-rows"></div><small class="task-checklist-field-help">Each step stays under this task and can be checked from the project page. No special typing format required.</small>';
    status.before(field);
  }

  function populateEditor(itemId){
    ensureEditorField();
    const field=$('itemSubtasksField');
    if(!field)return;
    const item=readState().items.find(x=>x.id===itemId);
    field.hidden=!item||item.kind==='NOTE';
    if(item&&item.kind!=='NOTE')renderEditorRows(item); else $('itemSubtasksRows').innerHTML='';
  }

  function saveEditorSubtasks(){
    const id=$('itemId')?.value;
    const field=$('itemSubtasksField');
    if(!id||!field||field.hidden)return;
    const state=readState();
    const item=state.items.find(x=>x.id===id);
    if(!item||item.kind==='NOTE')return;
    item.subtasks=collectEditorSubtasks();
    writeState(state);
    setTimeout(enhanceAll,0);
  }

  function promoteEditorRow(row){
    const parentId=$('itemId')?.value;
    const text=String(row?.querySelector('.task-editor-text')?.value||'').trim();
    if(!parentId||!row||!text)return;
    const state=readState();
    const parent=state.items.find(x=>x.id===parentId&&x.kind!=='NOTE');
    if(!parent)return;
    const t=new Date().toISOString();
    parent.subtasks=collectEditorSubtasks(row);
    const task={
      id:uid('i'),p:parent.p,kind:'CHECKLIST',status:'OPEN',phase:parent.phase||'',title:text,
      workedAt:t,createdAt:t,notes:'',outcome:'',inputs:'',acceptance:'',dependencies:'',boundary:'',verification:'',stopCondition:'',completedAt:'',subtasks:[]
    };
    state.items.push(task);
    const project=state.projects.find(p=>p.id===parent.p);
    if(project)project.workedAt=t;
    state.worklog.unshift({id:uid('w'),p:parent.p,itemId:task.id,whenAt:t,summary:`Created task from checklist: ${text}`});
    writeState(state);
    renderEditorRows(parent);
    setTimeout(enhanceAll,0);
  }

  // Capture-phase handling prevents direct controls from also opening the parent task editor.
  document.addEventListener('click',event=>{
    const noteButton=event.target.closest('[data-project-note-new]');
    if(noteButton){
      event.preventDefault();
      event.stopPropagation();
      openCaptureKind('NOTE');
      return;
    }

    const statusButton=event.target.closest('[data-task-status][data-task-item]');
    if(statusButton){
      event.preventDefault();
      event.stopPropagation();
      setTaskStatus(statusButton.dataset.taskItem,statusButton.dataset.taskStatus);
      return;
    }

    const subtask=event.target.closest('.task-subtask[data-subtask-id]');
    if(subtask){
      const checkbox=subtask.querySelector('input[type="checkbox"]');
      event.preventDefault();
      event.stopPropagation();
      toggleSubtask(subtask.dataset.subtaskItem,subtask.dataset.subtaskId,!checkbox?.checked);
      return;
    }
  },true);

  document.addEventListener('click',event=>{
    const add=event.target.closest('[data-editor-add-step]');
    if(add){event.preventDefault();addEditorRow();return;}

    const remove=event.target.closest('[data-editor-remove]');
    if(remove){event.preventDefault();remove.closest('.task-editor-row')?.remove();refreshEditorButtons();return;}

    const move=event.target.closest('[data-editor-move]');
    if(move){
      event.preventDefault();
      const row=move.closest('.task-editor-row');
      const direction=Number(move.dataset.editorMove);
      if(direction<0&&row?.previousElementSibling)row.previousElementSibling.before(row);
      if(direction>0&&row?.nextElementSibling)row.nextElementSibling.after(row);
      refreshEditorButtons();
      return;
    }

    const promote=event.target.closest('[data-editor-promote]');
    if(promote){event.preventDefault();promoteEditorRow(promote.closest('.task-editor-row'));return;}

    const entry=event.target.closest('.entry[data-item]');
    if(entry)setTimeout(()=>populateEditor(entry.dataset.item),0);
  });

  document.addEventListener('keydown',event=>{
    const input=event.target.closest?.('.task-editor-text');
    if(!input||event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
    event.preventDefault();
    addEditorRow(null,input.closest('.task-editor-row'));
  });

  $('itemForm')?.addEventListener('submit',()=>setTimeout(saveEditorSubtasks,0));

  const lists=['activeItems','openItems','doneItems','noteItems'].map($).filter(Boolean);
  lists.forEach(list=>new MutationObserver(enhanceAll).observe(list,{childList:true}));

  const notesSection=$('notesSection');
  if(notesSection)new MutationObserver(()=>{if(notesSection.hidden)ensureNoteAction();}).observe(notesSection,{attributes:true,attributeFilter:['hidden']});

  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)setTimeout(enhanceAll,0)});

  ensureEditorField();
  if($('itemSubtasksField'))$('itemSubtasksField').hidden=true;
  enhanceAll();
})();
