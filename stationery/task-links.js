(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const $=id=>document.getElementById(id);

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
    return value;
  }

  function offerUndo(before,message){
    if(!before)return;
    window.dispatchEvent(new CustomEvent('ledger:offer-undo',{detail:{before,message}}));
  }

  function safeUrl(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    const candidate=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
    try{
      const url=new URL(candidate);
      return (url.protocol==='http:'||url.protocol==='https:')?url.href:'';
    }catch(e){
      return '';
    }
  }

  function linkLabel(url){
    try{
      return new URL(url).hostname.replace(/^www\./,'')||'task link';
    }catch(e){
      return 'task link';
    }
  }

  function actionsHtml(item){
    const url=safeUrl(item?.link);
    if(!url){
      return `<div class="task-link-actions"><button type="button" class="task-link-button task-link-add" data-task-link-manage="${esc(item.id)}" aria-label="Add task link">＋ Link</button></div>`;
    }
    const label=linkLabel(url);
    return `<div class="task-link-actions"><button type="button" class="task-link-button task-link-open" data-task-link-open="${esc(item.id)}" aria-label="Open ${esc(label)}" title="Open ${esc(label)}">↗</button></div>`;
  }

  function ensureEditorField(){
    const form=$('itemForm');
    const status=$('itemStatusActions');
    if(!form||!status||$('itemLinkField'))return;
    const field=document.createElement('label');
    field.id='itemLinkField';
    field.className='field task-link-editor-field';
    field.innerHTML='<span>Task link</span><input id="itemLinkInput" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="example.com"><small class="task-link-field-help">Quick-open link shown on the task row.</small><small id="itemLinkError" class="task-link-error" hidden></small>';
    status.before(field);
  }

  function populateEditorLink(itemId){
    ensureEditorField();
    const field=$('itemLinkField');
    const item=readState().items.find(x=>x.id===itemId);
    if(!field)return;
    field.hidden=!item||item.kind==='NOTE';
    if($('itemLinkInput'))$('itemLinkInput').value=item&&item.kind!=='NOTE'?(item.link||''):'';
    if($('itemLinkError'))$('itemLinkError').hidden=true;
  }

  function enhance(){
    const state=readState();
    const items=new Map(state.items.map(item=>[item.id,item]));
    document.querySelectorAll('.entry[data-item]').forEach(entry=>{
      const item=items.get(entry.dataset.item);
      const content=entry.children[1];
      if(!item||item.kind==='NOTE'||!content)return;

      entry.querySelectorAll(':scope > .task-link-actions').forEach(node=>node.remove());
      const chevron=entry.querySelector('.entry-chevron');
      if(chevron)chevron.insertAdjacentHTML('beforebegin',actionsHtml(item));
      else entry.insertAdjacentHTML('beforeend',actionsHtml(item));
    });
  }

  function setLink(itemId,nextUrl,{logChange=true,undoMessage='Task link changed'}={}){
    const before=localStorage.getItem(STORAGE_KEY)||'';
    const state=readState();
    const item=state.items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    if(!item)return false;

    const prior=safeUrl(item.link);
    const next=safeUrl(nextUrl);
    if(prior===next)return false;

    item.link=next;
    const t=new Date().toISOString();
    item.workedAt=t;
    const project=state.projects.find(p=>p.id===item.p);
    if(project)project.workedAt=t;
    if(logChange){
      state.worklog.unshift({
        id:`w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        p:item.p,
        itemId:item.id,
        whenAt:t,
        summary:next?`${prior?'Updated':'Added'} link: ${item.title}`:`Removed link: ${item.title}`
      });
    }
    writeState(state);
    if(logChange)offerUndo(before,undoMessage);
    return true;
  }

  function openLink(itemId){
    const item=readState().items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    const url=safeUrl(item?.link);
    if(!url)return;
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(opened)opened.opener=null;
  }

  function showLinkError(message){
    const error=$('taskLinkError');
    if(!error)return;
    error.textContent=message;
    error.hidden=!message;
  }

  function openLinkSheet(itemId){
    const item=readState().items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    if(!item||!$('taskLinkSheet'))return;
    $('taskLinkItemId').value=item.id;
    $('taskLinkUrl').value=item.link||'';
    $('taskLinkRemove').hidden=!safeUrl(item.link);
    showLinkError('');
    $('taskLinkBackdrop').hidden=false;
    $('taskLinkSheet').hidden=false;
    document.body.style.overflow='hidden';
    setTimeout(()=>$('taskLinkUrl')?.focus({preventScroll:true}),30);
  }

  function closeLinkSheet(){
    if($('taskLinkBackdrop'))$('taskLinkBackdrop').hidden=true;
    if($('taskLinkSheet'))$('taskLinkSheet').hidden=true;
    document.body.style.overflow='';
    showLinkError('');
  }

  function saveLinkSheet(event){
    event.preventDefault();
    const itemId=$('taskLinkItemId')?.value;
    const raw=String($('taskLinkUrl')?.value||'').trim();
    if(!itemId)return;
    if(!raw){
      showLinkError('Paste a web address, or choose Remove link.');
      return;
    }
    const url=safeUrl(raw);
    if(!url){
      showLinkError('Enter a web address such as example.com or https://example.com.');
      $('taskLinkUrl')?.focus();
      return;
    }
    setLink(itemId,url,{undoMessage:'Task link added'});
    closeLinkSheet();
  }

  function removeLinkSheet(){
    const itemId=$('taskLinkItemId')?.value;
    if(!itemId)return;
    setLink(itemId,'',{undoMessage:'Task link removed'});
    closeLinkSheet();
  }

  function prepareEditorSave(event){
    const field=$('itemLinkField');
    if(!field||field.hidden)return;
    const raw=String($('itemLinkInput')?.value||'').trim();
    const next=raw?safeUrl(raw):'';
    if(raw&&!next){
      event.preventDefault();
      event.stopImmediatePropagation();
      const error=$('itemLinkError');
      if(error){error.textContent='Enter a web address such as example.com.';error.hidden=false;}
      $('itemLinkInput')?.focus();
      return;
    }
    const itemId=$('itemId')?.value;
    if(!itemId)return;
    setTimeout(()=>setLink(itemId,next,{logChange:false}),0);
  }

  document.addEventListener('click',event=>{
    const open=event.target.closest('[data-task-link-open]');
    if(open){
      event.preventDefault();
      event.stopPropagation();
      openLink(open.dataset.taskLinkOpen);
      return;
    }

    const manage=event.target.closest('[data-task-link-manage]');
    if(manage){
      event.preventDefault();
      event.stopPropagation();
      openLinkSheet(manage.dataset.taskLinkManage);
      return;
    }

    if(event.target.closest('[data-task-link-close]')||event.target===$('taskLinkBackdrop')){
      event.preventDefault();
      event.stopPropagation();
      closeLinkSheet();
      return;
    }

    if(event.target.closest('[data-task-link-remove]')){
      event.preventDefault();
      event.stopPropagation();
      removeLinkSheet();
      return;
    }

    const entry=event.target.closest('.entry[data-item]');
    if(entry)setTimeout(()=>populateEditorLink(entry.dataset.item),0);
  },true);

  $('taskLinkForm')?.addEventListener('submit',saveLinkSheet);
  $('itemForm')?.addEventListener('submit',prepareEditorSave,true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&$('taskLinkSheet')&&!$('taskLinkSheet').hidden){
      event.preventDefault();
      closeLinkSheet();
    }
  });

  const lists=['activeItems','openItems','doneItems'].map(id=>document.getElementById(id)).filter(Boolean);
  lists.forEach(list=>new MutationObserver(enhance).observe(list,{childList:true}));
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)setTimeout(enhance,0)});

  ensureEditorField();
  if($('itemLinkField'))$('itemLinkField').hidden=true;
  enhance();
})();