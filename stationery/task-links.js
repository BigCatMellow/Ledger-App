(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';

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
      const parsed=new URL(url);
      return parsed.hostname.replace(/^www\./,'')||'task link';
    }catch(e){
      return 'task link';
    }
  }

  function actionsHtml(item){
    const url=safeUrl(item?.link);
    if(!url){
      return `<div class="task-link-actions"><button type="button" class="task-link-button task-link-add" data-task-link-edit="${esc(item.id)}">＋ Link</button></div>`;
    }
    const label=linkLabel(url);
    return `<div class="task-link-actions"><button type="button" class="task-link-button task-link-open" data-task-link-open="${esc(item.id)}" aria-label="Open task link: ${esc(label)}" title="Open ${esc(label)}">↗ Open</button><button type="button" class="task-link-button task-link-edit" data-task-link-edit="${esc(item.id)}" aria-label="Edit task link" title="Edit task link">Edit</button></div>`;
  }

  function enhance(){
    const state=readState();
    const items=new Map(state.items.map(item=>[item.id,item]));
    document.querySelectorAll('.entry[data-item]').forEach(entry=>{
      const item=items.get(entry.dataset.item);
      const content=entry.children[1];
      if(!item||item.kind==='NOTE'||!content)return;

      entry.querySelectorAll('.task-link-actions').forEach(node=>node.remove());
      const chevron=entry.querySelector('.entry-chevron');
      if(chevron)chevron.insertAdjacentHTML('beforebegin',actionsHtml(item));
      else entry.insertAdjacentHTML('beforeend',actionsHtml(item));
    });
  }

  function editLink(itemId){
    const state=readState();
    const item=state.items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    if(!item)return;

    const prior=safeUrl(item.link);
    const entered=prompt(prior?'Paste a replacement link, or leave blank to remove it:':'Paste a link for this task:',prior||'');
    if(entered===null)return;

    const trimmed=entered.trim();
    if(!trimmed){
      if(!prior)return;
      item.link='';
    }else{
      const next=safeUrl(trimmed);
      if(!next){
        alert('That does not look like a web link. Try something like example.com or https://example.com');
        return;
      }
      item.link=next;
    }

    const t=new Date().toISOString();
    item.workedAt=t;
    const project=state.projects.find(p=>p.id===item.p);
    if(project)project.workedAt=t;
    state.worklog.unshift({
      id:`w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      p:item.p,
      itemId:item.id,
      whenAt:t,
      summary:item.link?`${prior?'Updated':'Added'} link: ${item.title}`:`Removed link: ${item.title}`
    });
    writeState(state);
    setTimeout(enhance,0);
  }

  function openLink(itemId){
    const item=readState().items.find(x=>x.id===itemId&&x.kind!=='NOTE');
    const url=safeUrl(item?.link);
    if(!url)return;
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(opened)opened.opener=null;
  }

  document.addEventListener('click',event=>{
    const open=event.target.closest('[data-task-link-open]');
    if(open){
      event.preventDefault();
      event.stopPropagation();
      openLink(open.dataset.taskLinkOpen);
      return;
    }

    const edit=event.target.closest('[data-task-link-edit]');
    if(edit){
      event.preventDefault();
      event.stopPropagation();
      editLink(edit.dataset.taskLinkEdit);
    }
  },true);

  const lists=['activeItems','openItems','doneItems'].map(id=>document.getElementById(id)).filter(Boolean);
  lists.forEach(list=>new MutationObserver(enhance).observe(list,{childList:true}));
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)setTimeout(enhance,0)});

  enhance();
})();
