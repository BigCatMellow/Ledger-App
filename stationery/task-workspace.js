(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const expandedNotes=new Set();
  let enhanceQueued=false;

  function uid(prefix='n'){
    if(globalThis.crypto?.randomUUID)return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function esc(value){
    return String(value??'').replace(/[&<>'"]/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[c]));
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

  function normalizeNotations(item){
    const notes=[];
    if(Array.isArray(item?.notations)){
      item.notations.forEach(note=>{
        if(!note)return;
        const text=String(typeof note==='string'?note:note.text||'').trim();
        if(!text)return;
        notes.push({
          id:String(typeof note==='string'?uid('n'):note.id||uid('n')),
          text,
          createdAt:typeof note==='string'?(item.createdAt||''):String(note.createdAt||item.createdAt||''),
          updatedAt:typeof note==='string'?'':String(note.updatedAt||''),
          legacy:false
        });
      });
    }

    const legacy=String(item?.notes||'').trim();
    if(legacy){
      notes.push({
        id:'legacy',
        text:legacy,
        createdAt:String(item.createdAt||item.workedAt||''),
        updatedAt:'',
        legacy:true
      });
    }

    return notes.sort((a,b)=>{
      const at=new Date(a.updatedAt||a.createdAt||0).getTime()||0;
      const bt=new Date(b.updatedAt||b.createdAt||0).getTime()||0;
      return bt-at;
    });
  }

  function sameLocalDay(a,b){
    return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  }

  function notationTime(value){
    const d=new Date(value||'');
    if(Number.isNaN(d.getTime()))return '';
    const now=new Date();
    const yesterday=new Date(now);
    yesterday.setDate(now.getDate()-1);
    const time=d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    if(sameLocalDay(d,now))return `Today · ${time}`;
    if(sameLocalDay(d,yesterday))return `Yesterday · ${time}`;
    const date=d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:d.getFullYear()===now.getFullYear()?undefined:'numeric'});
    return `${date} · ${time}`;
  }

  function hasChecklist(item){
    return Array.isArray(item?.subtasks)&&item.subtasks.some(sub=>String(typeof sub==='string'?sub:sub?.text||'').trim());
  }

  function actionsHtml(item){
    return `<div class="task-work-actions" aria-label="Task quick actions">
      <button type="button" data-task-notation-add="${esc(item.id)}">＋ Note</button>
      ${hasChecklist(item)?'':`<button type="button" data-task-inline-step="${esc(item.id)}">＋ Step</button>`}
      <button type="button" data-task-details-open="${esc(item.id)}">Details</button>
    </div>`;
  }

  function notationsHtml(item){
    const notes=normalizeNotations(item);
    if(!notes.length)return '';
    const expanded=expandedNotes.has(item.id);
    const shown=expanded?notes:notes.slice(0,2);
    const rows=shown.map(note=>{
      const stamp=notationTime(note.updatedAt||note.createdAt);
      return `<button type="button" class="task-notation" data-task-notation-edit="${esc(item.id)}" data-notation-id="${esc(note.id)}">
        ${stamp?`<span class="task-notation-time">${esc(stamp)}${note.updatedAt?' · edited':''}</span>`:''}
        <span class="task-notation-text">${esc(note.text)}</span>
      </button>`;
    }).join('');
    const toggle=notes.length>2?`<button type="button" class="task-notations-toggle" data-task-notations-toggle="${esc(item.id)}">${expanded?'Show less':`Show all ${notes.length}`}</button>`:'';
    return `<div class="task-notations"><div class="task-notations-label">Notes</div>${rows}${toggle}</div>`;
  }

  function enhanceEntry(entry,item){
    if(!item||item.kind==='NOTE')return;
    const content=entry.querySelector('.entry-main')||entry.children[1];
    if(!content)return;
    entry.classList.add('task-workspace-enhanced');
    content.querySelector('.task-work-actions')?.remove();
    content.querySelector('.task-notations')?.remove();

    const anchor=content.querySelector('.entry-meta')||content.querySelector('.entry-title');
    if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',actionsHtml(item));
    const actions=content.querySelector('.task-work-actions');
    const notes=notationsHtml(item);
    if(notes)actions.insertAdjacentHTML('afterend',notes);
  }

  function enhance(){
    const state=readState();
    const items=new Map(state.items.map(item=>[item.id,item]));
    document.querySelectorAll('.entry[data-item]').forEach(entry=>enhanceEntry(entry,items.get(entry.dataset.item)));
  }

  function queueEnhance(){
    if(enhanceQueued)return;
    enhanceQueued=true;
    setTimeout(()=>{
      enhanceQueued=false;
      enhance();
    },0);
  }

  function openFastTaskComposer(){
    const state=readState();
    if(!activeProject(state))return;
    document.querySelector('.fast-task-composer')?.remove();
    const list=document.getElementById('openItems');
    if(!list)return;
    const composer=document.createElement('form');
    composer.className='fast-task-composer';
    composer.innerHTML='<input type="text" aria-label="New task" placeholder="What needs to be done?" autocomplete="off"><button type="submit">Add</button><button type="button" data-fast-task-cancel aria-label="Cancel">×</button>';
    list.before(composer);
    composer.querySelector('input')?.focus({preventScroll:true});
  }

  function saveFastTask(composer){
    const title=String(composer?.querySelector('input')?.value||'').trim();
    if(!title){composer?.querySelector('input')?.focus();return;}
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const project=activeProject(state);
    if(!project)return;
    const t=new Date().toISOString();
    const item={
      id:uid('i'),p:project.id,kind:'CHECKLIST',status:'OPEN',phase:'',title,
      workedAt:t,createdAt:t,notes:'',notations:[],outcome:'',inputs:'',acceptance:'',dependencies:'',boundary:'',verification:'',stopCondition:'',completedAt:'',subtasks:[],link:''
    };
    state.items.unshift(item);
    project.workedAt=t;
    state.worklog.unshift({id:uid('w'),p:project.id,itemId:item.id,whenAt:t,summary:`Captured: ${title}`});
    writeState(state);
    composer.remove();
    offerUndo(before,'Task added');
  }

  function findNotation(item,noteId){
    if(noteId==='legacy')return String(item.notes||'').trim()?{id:'legacy',text:String(item.notes||'').trim(),legacy:true}:null;
    if(!Array.isArray(item.notations))return null;
    const note=item.notations.find(entry=>String(entry?.id||'')===noteId);
    return note?{...note,legacy:false}:null;
  }

  function openNotationEditor(itemId,noteId=''){
    const state=readState();
    const item=state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE');
    const entry=document.querySelector(`.entry[data-item="${CSS.escape(itemId)}"]`);
    const content=entry?.querySelector('.entry-main')||entry?.children?.[1];
    if(!item||!content)return;

    document.querySelectorAll('.task-notation-editor').forEach(editor=>editor.remove());
    const note=noteId?findNotation(item,noteId):null;
    const editor=document.createElement('form');
    editor.className='task-notation-editor';
    editor.dataset.taskNotationEditor=itemId;
    editor.dataset.notationId=noteId||'';
    editor.innerHTML=`<textarea rows="2" aria-label="Task note" placeholder="Add a quick note, update, reminder, or context…">${esc(note?.text||'')}</textarea><div class="task-notation-editor-actions">${note?'<button type="button" class="task-notation-delete" data-notation-delete>Delete</button>':''}<span></span><button type="button" data-notation-cancel>Cancel</button><button type="submit" class="task-notation-save">Save</button></div>`;
    const actions=content.querySelector('.task-work-actions');
    if(actions)actions.after(editor); else content.appendChild(editor);
    editor.querySelector('textarea')?.focus({preventScroll:true});
  }

  function touchItem(state,item,t){
    item.workedAt=t;
    const project=state.projects.find(project=>project.id===item.p);
    if(project)project.workedAt=t;
  }

  function saveNotation(editor){
    const itemId=editor?.dataset.taskNotationEditor;
    const noteId=editor?.dataset.notationId||'';
    const text=String(editor?.querySelector('textarea')?.value||'').trim();
    if(!itemId)return;
    if(!text){editor?.querySelector('textarea')?.focus();return;}

    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE');
    if(!item)return;
    const t=new Date().toISOString();

    if(noteId==='legacy'){
      item.notes=text;
    }else if(noteId){
      item.notations=Array.isArray(item.notations)?item.notations:[];
      const note=item.notations.find(entry=>String(entry?.id||'')===noteId);
      if(!note)return;
      note.text=text;
      note.updatedAt=t;
    }else{
      item.notations=Array.isArray(item.notations)?item.notations:[];
      item.notations.push({id:uid('n'),text,createdAt:t,updatedAt:''});
    }

    touchItem(state,item,t);
    writeState(state);
    editor.remove();
    offerUndo(before,noteId?'Note updated':'Note added');
  }

  function deleteNotation(editor){
    const itemId=editor?.dataset.taskNotationEditor;
    const noteId=editor?.dataset.notationId||'';
    if(!itemId||!noteId)return;
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(entry=>entry.id===itemId&&entry.kind!=='NOTE');
    if(!item)return;

    if(noteId==='legacy')item.notes='';
    else item.notations=Array.isArray(item.notations)?item.notations.filter(note=>String(note?.id||'')!==noteId):[];
    touchItem(state,item,new Date().toISOString());
    writeState(state);
    editor.remove();
    offerUndo(before,'Note deleted');
  }

  function openTaskDetails(itemId){
    const entry=document.querySelector(`.entry[data-item="${CSS.escape(itemId)}"]`);
    if(!entry)return;
    setTimeout(()=>entry.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})),0);
  }

  document.addEventListener('click',event=>{
    const taskButton=event.target.closest('[data-project-task-new]');
    if(taskButton){
      event.preventDefault();
      event.stopPropagation();
      openFastTaskComposer();
      return;
    }

    const addNote=event.target.closest('[data-task-notation-add]');
    if(addNote){
      event.preventDefault();
      event.stopPropagation();
      openNotationEditor(addNote.dataset.taskNotationAdd);
      return;
    }

    const editNote=event.target.closest('[data-task-notation-edit]');
    if(editNote){
      event.preventDefault();
      event.stopPropagation();
      openNotationEditor(editNote.dataset.taskNotationEdit,editNote.dataset.notationId);
      return;
    }

    const toggle=event.target.closest('[data-task-notations-toggle]');
    if(toggle){
      event.preventDefault();
      event.stopPropagation();
      const itemId=toggle.dataset.taskNotationsToggle;
      if(expandedNotes.has(itemId))expandedNotes.delete(itemId); else expandedNotes.add(itemId);
      enhance();
      return;
    }

    const details=event.target.closest('[data-task-details-open]');
    if(details){
      event.preventDefault();
      event.stopPropagation();
      openTaskDetails(details.dataset.taskDetailsOpen);
      return;
    }

    const cancel=event.target.closest('[data-notation-cancel]');
    if(cancel){
      event.preventDefault();
      event.stopPropagation();
      cancel.closest('.task-notation-editor')?.remove();
      return;
    }

    const del=event.target.closest('[data-notation-delete]');
    if(del){
      event.preventDefault();
      event.stopPropagation();
      deleteNotation(del.closest('.task-notation-editor'));
      return;
    }

    if(event.target.closest('[data-fast-task-cancel]')){
      event.preventDefault();
      event.stopPropagation();
      event.target.closest('.fast-task-composer')?.remove();
    }
  },true);

  document.addEventListener('submit',event=>{
    const fast=event.target.closest('.fast-task-composer');
    if(fast){
      event.preventDefault();
      event.stopPropagation();
      saveFastTask(fast);
      return;
    }
    const editor=event.target.closest('.task-notation-editor');
    if(editor){
      event.preventDefault();
      event.stopPropagation();
      saveNotation(editor);
    }
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(event.target.closest?.('.fast-task-composer')){
        event.preventDefault();
        event.target.closest('.fast-task-composer')?.remove();
      }else if(event.target.closest?.('.task-notation-editor')){
        event.preventDefault();
        event.target.closest('.task-notation-editor')?.remove();
      }
      return;
    }

    const note=event.target.closest?.('.task-notation-editor textarea');
    if(note&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
      event.preventDefault();
      saveNotation(note.closest('.task-notation-editor'));
    }
  });

  const lists=['activeItems','openItems','doneItems'].map(id=>document.getElementById(id)).filter(Boolean);
  lists.forEach(list=>new MutationObserver(queueEnhance).observe(list,{childList:true}));
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)queueEnhance();});

  setTimeout(enhance,0);
})();
