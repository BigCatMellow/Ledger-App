(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const mobile=window.matchMedia('(max-width:600px)');
  let enhanceQueued=false;

  function uid(prefix='m'){
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
      return {activeProject:'',projects:[],items:[],worklog:[]};
    }
  }

  function activeProject(state){
    return state.projects.find(project=>project.id===state.activeProject)||state.projects[0]||null;
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

  function offerUndo(before,message){
    window.dispatchEvent(new CustomEvent('ledger:offer-undo',{detail:{before,message}}));
  }

  function touchItem(state,item,t){
    item.workedAt=t;
    const project=state.projects.find(project=>project.id===item.p);
    if(project)project.workedAt=t;
  }

  function findNotation(item,noteId){
    if(noteId==='legacy'){
      const text=String(item?.notes||'').trim();
      return text?{id:'legacy',text,legacy:true}:null;
    }
    const note=Array.isArray(item?.notations)?item.notations.find(entry=>String(entry?.id||'')===String(noteId||'')):null;
    return note?{...note,legacy:false}:null;
  }

  function ensureSheet(){
    let sheet=document.getElementById('mobileTaskSheet');
    if(sheet)return sheet;

    const backdrop=document.createElement('div');
    backdrop.id='mobileTaskBackdrop';
    backdrop.className='mobile-task-sheet-backdrop';
    backdrop.hidden=true;

    sheet=document.createElement('section');
    sheet.id='mobileTaskSheet';
    sheet.className='mobile-task-sheet';
    sheet.hidden=true;
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-labelledby','mobileTaskSheetTitle');
    sheet.innerHTML=`
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <div><div id="mobileTaskSheetLabel" class="sheet-label">TASK</div><h2 id="mobileTaskSheetTitle">Quick add</h2></div>
        <button class="sheet-close" data-mobile-task-close type="button" aria-label="Close">×</button>
      </div>
      <form id="mobileTaskQuickForm">
        <input id="mobileTaskMode" type="hidden">
        <input id="mobileTaskItemId" type="hidden">
        <input id="mobileTaskNotationId" type="hidden">
        <p id="mobileTaskContext" class="mobile-task-context" hidden></p>
        <label id="mobileTaskInputField" class="field"><span id="mobileTaskInputLabel">What needs to be done?</span><input id="mobileTaskInput" type="text" autocomplete="off" placeholder="What needs to be done?"></label>
        <label id="mobileTaskTextareaField" class="field" hidden><span id="mobileTaskTextareaLabel">Note</span><textarea id="mobileTaskTextarea" rows="5" placeholder="Add a quick note, update, reminder, or context…"></textarea></label>
        <div class="mobile-task-sheet-actions">
          <button id="mobileTaskDelete" class="paper-button mobile-task-delete" type="button" hidden>Delete note</button>
          <span class="mobile-task-action-spacer"></span>
          <button class="paper-button" data-mobile-task-close type="button">Cancel</button>
          <button id="mobileTaskSave" class="paper-button primary" type="submit">Add</button>
        </div>
      </form>`;

    document.body.append(backdrop,sheet);
    backdrop.addEventListener('click',closeSheet);
    sheet.querySelectorAll('[data-mobile-task-close]').forEach(button=>button.addEventListener('click',closeSheet));
    sheet.querySelector('#mobileTaskQuickForm')?.addEventListener('submit',saveSheet);
    sheet.querySelector('#mobileTaskDelete')?.addEventListener('click',deleteNote);
    return sheet;
  }

  function setContext(item){
    const context=document.getElementById('mobileTaskContext');
    if(!context)return;
    context.textContent=item?.title||'';
    context.hidden=!context.textContent;
  }

  function openSheet(mode,{itemId='',noteId=''}={}){
    if(!mobile.matches)return;
    const sheet=ensureSheet();
    const state=readState();
    const item=itemId?state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE'):null;
    if(itemId&&!item)return;

    const label=document.getElementById('mobileTaskSheetLabel');
    const title=document.getElementById('mobileTaskSheetTitle');
    const inputField=document.getElementById('mobileTaskInputField');
    const textField=document.getElementById('mobileTaskTextareaField');
    const input=document.getElementById('mobileTaskInput');
    const textarea=document.getElementById('mobileTaskTextarea');
    const save=document.getElementById('mobileTaskSave');
    const remove=document.getElementById('mobileTaskDelete');

    document.getElementById('mobileTaskMode').value=mode;
    document.getElementById('mobileTaskItemId').value=itemId;
    document.getElementById('mobileTaskNotationId').value=noteId;
    input.value='';
    textarea.value='';
    remove.hidden=true;
    setContext(item);

    if(mode==='task'){
      label.textContent='NEW TASK';
      title.textContent='Add task';
      document.getElementById('mobileTaskInputLabel').textContent='What needs to be done?';
      input.placeholder='What needs to be done?';
      inputField.hidden=false;
      textField.hidden=true;
      save.textContent='Add task';
      setContext(null);
    }else if(mode==='step'){
      label.textContent='CHECKLIST';
      title.textContent='Add step';
      document.getElementById('mobileTaskInputLabel').textContent='What needs to happen?';
      input.placeholder='What needs to happen?';
      inputField.hidden=false;
      textField.hidden=true;
      save.textContent='Add step';
    }else{
      const note=noteId?findNotation(item,noteId):null;
      label.textContent='TASK NOTE';
      title.textContent=note?'Edit note':'Add note';
      document.getElementById('mobileTaskTextareaLabel').textContent='Note';
      textarea.value=note?.text||'';
      inputField.hidden=true;
      textField.hidden=false;
      save.textContent=note?'Save note':'Add note';
      remove.hidden=!note;
    }

    document.getElementById('mobileTaskBackdrop').hidden=false;
    sheet.hidden=false;
    document.body.style.overflow='hidden';
    setTimeout(()=>{
      const field=mode==='note'?textarea:input;
      field?.focus({preventScroll:true});
      if(mode==='note'&&noteId)field?.setSelectionRange?.(field.value.length,field.value.length);
    },30);
  }

  function closeSheet(){
    const sheet=document.getElementById('mobileTaskSheet');
    const backdrop=document.getElementById('mobileTaskBackdrop');
    if(sheet)sheet.hidden=true;
    if(backdrop)backdrop.hidden=true;
    document.body.style.overflow='';
  }

  function saveTask(title){
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const project=activeProject(state);
    if(!project)return false;
    const t=new Date().toISOString();
    const item={
      id:uid('i'),p:project.id,kind:'CHECKLIST',status:'OPEN',phase:'',title,
      workedAt:t,createdAt:t,notes:'',notations:[],outcome:'',inputs:'',acceptance:'',dependencies:'',boundary:'',verification:'',stopCondition:'',completedAt:'',subtasks:[],link:''
    };
    state.items.unshift(item);
    project.workedAt=t;
    state.worklog.unshift({id:uid('w'),p:project.id,itemId:item.id,whenAt:t,summary:`Captured: ${title}`});
    writeState(state);
    offerUndo(before,'Task added');
    return true;
  }

  function saveStep(itemId,text){
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE');
    if(!item)return false;
    item.subtasks=Array.isArray(item.subtasks)?item.subtasks:[];
    item.subtasks.push({id:uid('s'),text,done:false});
    touchItem(state,item,new Date().toISOString());
    writeState(state);
    offerUndo(before,'Step added');
    return true;
  }

  function saveNote(itemId,noteId,text){
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE');
    if(!item)return false;
    const t=new Date().toISOString();

    if(noteId==='legacy'){
      item.notes=text;
    }else if(noteId){
      item.notations=Array.isArray(item.notations)?item.notations:[];
      const note=item.notations.find(entry=>String(entry?.id||'')===noteId);
      if(!note)return false;
      note.text=text;
      note.updatedAt=t;
    }else{
      item.notations=Array.isArray(item.notations)?item.notations:[];
      item.notations.push({id:uid('n'),text,createdAt:t,updatedAt:''});
    }

    touchItem(state,item,t);
    writeState(state);
    offerUndo(before,noteId?'Note updated':'Note added');
    return true;
  }

  function saveSheet(event){
    event.preventDefault();
    const mode=document.getElementById('mobileTaskMode')?.value||'';
    const itemId=document.getElementById('mobileTaskItemId')?.value||'';
    const noteId=document.getElementById('mobileTaskNotationId')?.value||'';
    let saved=false;

    if(mode==='task'){
      const title=String(document.getElementById('mobileTaskInput')?.value||'').trim();
      if(!title){document.getElementById('mobileTaskInput')?.focus();return;}
      saved=saveTask(title);
    }else if(mode==='step'){
      const text=String(document.getElementById('mobileTaskInput')?.value||'').trim();
      if(!text){document.getElementById('mobileTaskInput')?.focus();return;}
      saved=saveStep(itemId,text);
    }else if(mode==='note'){
      const text=String(document.getElementById('mobileTaskTextarea')?.value||'').trim();
      if(!text){document.getElementById('mobileTaskTextarea')?.focus();return;}
      saved=saveNote(itemId,noteId,text);
    }

    if(saved)closeSheet();
  }

  function deleteNote(){
    const itemId=document.getElementById('mobileTaskItemId')?.value||'';
    const noteId=document.getElementById('mobileTaskNotationId')?.value||'';
    if(!itemId||!noteId)return;
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE');
    if(!item)return;

    if(noteId==='legacy')item.notes='';
    else item.notations=Array.isArray(item.notations)?item.notations.filter(note=>String(note?.id||'')!==noteId):[];
    touchItem(state,item,new Date().toISOString());
    writeState(state);
    closeSheet();
    offerUndo(before,'Note deleted');
  }

  function enhanceMobileActions(){
    if(!mobile.matches)return;
    document.querySelectorAll('.entry[data-item] .task-work-actions').forEach(actions=>{
      if(actions.querySelector('[data-task-link-manage]'))return;
      const entry=actions.closest('.entry[data-item]');
      const details=actions.querySelector('[data-task-details-open]');
      if(!entry||!details)return;
      const button=document.createElement('button');
      button.type='button';
      button.dataset.taskLinkManage=entry.dataset.item;
      button.textContent='Link';
      button.setAttribute('aria-label','Add or edit task link');
      details.before(button);
    });
  }

  function queueEnhance(){
    if(enhanceQueued)return;
    enhanceQueued=true;
    setTimeout(()=>{
      enhanceQueued=false;
      enhanceMobileActions();
    },0);
  }

  // Window capture runs before the existing document-level inline editors.
  // On phones, typing belongs in a bottom sheet; reading remains inline.
  window.addEventListener('click',event=>{
    if(!mobile.matches)return;

    const newTask=event.target.closest?.('[data-project-task-new]');
    if(newTask){
      event.preventDefault();
      event.stopPropagation();
      openSheet('task');
      return;
    }

    const addNote=event.target.closest?.('[data-task-notation-add]');
    if(addNote){
      event.preventDefault();
      event.stopPropagation();
      openSheet('note',{itemId:addNote.dataset.taskNotationAdd});
      return;
    }

    const editNote=event.target.closest?.('[data-task-notation-edit]');
    if(editNote){
      event.preventDefault();
      event.stopPropagation();
      openSheet('note',{itemId:editNote.dataset.taskNotationEdit,noteId:editNote.dataset.notationId||''});
      return;
    }

    const addStep=event.target.closest?.('[data-task-inline-step]');
    if(addStep){
      event.preventDefault();
      event.stopPropagation();
      openSheet('step',{itemId:addStep.dataset.taskInlineStep});
    }
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!document.getElementById('mobileTaskSheet')?.hidden){
      event.preventDefault();
      closeSheet();
    }
  });

  const lists=['activeItems','openItems','doneItems'].map(id=>document.getElementById(id)).filter(Boolean);
  lists.forEach(list=>new MutationObserver(queueEnhance).observe(list,{childList:true,subtree:true}));
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)queueEnhance();});
  mobile.addEventListener?.('change',queueEnhance);

  ensureSheet();
  setTimeout(enhanceMobileActions,0);
})();
