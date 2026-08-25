(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const SYNC_STATUS_KEY='ledger-github-sync-status-v1';
  const enc=new TextEncoder();
  let refreshToken=0;

  function readSyncStatus(){
    try{return JSON.parse(localStorage.getItem(SYNC_STATUS_KEY)||'null')}
    catch(e){return null}
  }

  function b64(bytes){
    let s='';
    const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));
    return btoa(s);
  }

  async function sha256Text(text){
    const d=await crypto.subtle.digest('SHA-256',enc.encode(text));
    return b64(d);
  }

  async function matchesSavedSnapshot(plain,savedHash){
    const currentHash=await sha256Text(plain);
    if(currentHash===savedHash)return {matches:true,currentHash};

    // activeProject is UI navigation state, not project content. Switching tabs
    // should not make an otherwise identical GitHub snapshot look out of date.
    let state;
    try{state=JSON.parse(plain)}catch(e){return {matches:false,currentHash}}
    if(!state||typeof state!=='object'||Array.isArray(state))return {matches:false,currentHash};

    const original=state.activeProject;
    const ids=Array.isArray(state.projects)?state.projects.map(p=>p?.id).filter(Boolean):[];
    const candidates=[...new Set(['',original,...ids])];
    for(const id of candidates){
      if(id===original)continue;
      state.activeProject=id;
      if(await sha256Text(JSON.stringify(state))===savedHash){
        return {matches:true,currentHash,uiOnly:true};
      }
    }
    return {matches:false,currentHash};
  }

  function show(message){
    const box=document.getElementById('syncNudge');
    const text=document.getElementById('syncNudgeText');
    if(!box||!text)return;
    text.innerHTML=message;
    box.hidden=false;
  }

  function hide(){
    const box=document.getElementById('syncNudge');
    if(box)box.hidden=true;
  }

  async function refresh(){
    const token=++refreshToken;
    const plain=localStorage.getItem(STORAGE_KEY);
    if(!plain){hide();return;}

    const status=readSyncStatus();
    if(!status?.hash){
      show('<strong>Not synced yet.</strong> Back up Ledger to your private Notes repository.');
      return;
    }

    try{
      const result=await matchesSavedSnapshot(plain,status.hash);
      if(token!==refreshToken)return;
      if(result.matches){
        // Rebase the local marker when the only difference was active-project
        // selection. Keep the original successful-sync timestamp unchanged.
        if(result.uiOnly&&result.currentHash){
          localStorage.setItem(SYNC_STATUS_KEY,JSON.stringify({...status,hash:result.currentHash}));
        }
        hide();
      }else{
        show('<strong>Changes not synced.</strong> Your browser has newer Ledger data than the last GitHub snapshot.');
      }
    }catch(e){
      // If hashing is unavailable, avoid showing a potentially incorrect warning.
      hide();
    }
  }

  window.addEventListener('storage',event=>{
    if(event.key===STORAGE_KEY||event.key===SYNC_STATUS_KEY)refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  setInterval(refresh,3000);
  refresh();
})();
