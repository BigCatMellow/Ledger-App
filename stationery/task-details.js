(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const $=id=>document.getElementById(id);

  function esc(value){
    return String(value??'').replace(/[&<>'"]/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[c]));
  }

  function uid(){
    if(globalThis.crypto?.randomUUID)return `s-${globalThis.crypto.randomUUID()}`;
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function readState(){
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      state.items=Array.isArray(state.items)?state.items:[];
      return state;
    }catch(e){
      return {items:[]};
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

  function subtasksText(item){
    return normalizeSubtasks(item).map(sub=>`- [${sub.done?'x':' '}] ${sub.text}`).join('\n');
  }

  function parseSubtasks(value,existing=[]){
    const old=normalizeSubtasks({subtasks:existing});
    const byText=new Map(old.map(sub=>[sub.text.toLowerCase(),sub]));
    return String(value||'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
      const match=line.match(/^[-*]?\s*\[([ xX])\]\s*(.+)$/);
      const text=(match?match[2]:line.replace(/^[-*]\s*/,'')).trim();
      if(!text)return null;
      const prior=byText.get(text.toLowerCase());
      return {
        id:prior?.id||uid(),
        text,
        done:match?match[1].toLowerCase()==='x':!!prior?.done
      };
    }).filter(Boolean);
  }

  function detailsHtml(item){
    if(!item||item.kind==='NOTE')return '';
    const pieces=[];
    if(String(item.notes||'').trim())pieces.push(`<div class="task-note">${esc(item.notes)}</div>`);

    const fields=[
      ['Outcome',item.outcome],
      ['Input / source',item.inputs],
      ['Waiting on',item.dependencies],
      ['Boundary',item.boundary],
      ['Done when',item.acceptance],
      ['Verification',item.verification],
      ['Stop condition',item.stopCondition]
    ].filter(([,value])=>String(value||'').trim());
    if(fields.length){
      pieces.push(`<div class="task-fields">${fields.map(([label,value])=>`<div class="task-field"><span class="task-field-label">${esc(label)}</span><span class="task-field-value">${esc(value)}</span></div>`).join('')}</div>`);
    }

    const subtasks=normalizeSubtasks(item);
    if(subtasks.length){
      const done=subtasks.filter(sub=>sub.done).length;
      pieces.push(`<div class="task-checklist"><div class="task-checklist-head"><span>Checklist</span><span>${done}/${subtasks.length}</span></div>${subtasks.map(sub=>`<label class="task-subtask ${sub.done?'done':''}" data-subtask-id="${esc(sub.id)}" data-subtask-item="${esc(item.id)}"><input type="checkbox" ${sub.done?'checked':''}><span>${esc(sub.text)}</span></label>`).join('')}</div>`);
    }
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

  function ensureEditorField(){
    const form=$('itemForm');
    const status=$('itemStatusActions');
    if(!form||!status||$('itemSubtasksInput'))return;
    const field=document.createElement('label');
    field.className='field';
    field.innerHTML='<span>Checklist / subtasks</span><textarea id="itemSubtasksInput" rows="5" placeholder="One item per line\n- [ ] First step\n- [x] Finished step"></textarea><small class="task-checklist-field-help">One item per line. Use [x] for completed items. These stay nested under the task and can be checked directly from the project page.</small>';
    status.before(field);
  }

  function populateEditor(itemId){
    ensureEditorField();
    const input=$('itemSubtasksInput');
    if(!input)return;
    const item=readState().items.find(x=>x.id===itemId);
    input.value=item?subtasksText(item):'';
  }

  function saveEditorSubtasks(){
    const id=$('itemId')?.value;
    const input=$('itemSubtasksInput');
    if(!id||!input)return;
    const state=readState();
    const item=state.items.find(x=>x.id===id);
    if(!item)return;
    item.subtasks=parseSubtasks(input.value,item.subtasks);
    writeState(state);
    enhanceEntries();
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
    writeState(state);
    enhanceEntries();
  }

  // Capture-phase handling keeps a checklist tap from opening the parent task editor.
  document.addEventListener('click',event=>{
    const row=event.target.closest('.task-subtask[data-subtask-id]');
    if(!row)return;
    const checkbox=row.querySelector('input[type="checkbox"]');
    event.preventDefault();
    event.stopPropagation();
    toggleSubtask(row.dataset.subtaskItem,row.dataset.subtaskId,!checkbox?.checked);
  },true);

  document.addEventListener('click',event=>{
    const entry=event.target.closest('.entry[data-item]');
    if(entry)setTimeout(()=>populateEditor(entry.dataset.item),0);
  });

  $('itemForm')?.addEventListener('submit',()=>setTimeout(saveEditorSubtasks,0));

  const lists=['activeItems','openItems','doneItems'].map($).filter(Boolean);
  lists.forEach(list=>new MutationObserver(enhanceEntries).observe(list,{childList:true,subtree:true}));
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)setTimeout(enhanceEntries,0)});

  ensureEditorField();
  enhanceEntries();
})();
