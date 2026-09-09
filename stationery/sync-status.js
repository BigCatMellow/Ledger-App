(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const SYNC_STATUS_KEY='ledger-github-sync-status-v1';
  const REMEMBERED_CONNECTION_KEY='ledger-github-sync-remember-v1';
  const enc=new TextEncoder();
  let refreshToken=0;
  let mismatchSince=0;

  function readJson(key){
    try{return JSON.parse(localStorage.getItem(key)||'null')}
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

  function stableValue(value,key=''){
    if(key==='activeProject'||key==='syncedAt')return undefined;
    if(Array.isArray(value))return value.map(item=>stableValue(item)).filter(item=>item!==undefined);
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(k=>{
        const next=stableValue(value[k],k);
        if(next!==undefined)out[k]=next;
      });
      return out;
    }
    return value;
  }

  async function contentHash(plain){
    const state=JSON.parse(plain);
    return sha256Text(JSON.stringify(stableValue(state)));
  }

  async function matchesLegacySnapshot(plain,savedHash){
    if(!savedHash)return false;
    const currentHash=await sha256Text(plain);
    if(currentHash===savedHash)return true;

    let state;
    try{state=JSON.parse(plain)}catch(e){return false}
    if(!state||typeof state!=='object'||Array.isArray(state))return false;
    const original=state.activeProject;
    const ids=Array.isArray(state.projects)?state.projects.map(p=>p?.id).filter(Boolean):[];
    for(const id of [...new Set(['',original,...ids])]){
      if(id===original)continue;
      state.activeProject=id;
      if(await sha256Text(JSON.stringify(state))===savedHash)return true;
    }
    return false;
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
    if(!plain){mismatchSince=0;hide();return;}

    const status=readJson(SYNC_STATUS_KEY);
    if(!status?.hash&&!status?.contentHash){
      mismatchSince=0;
      show('<strong>Not synced yet.</strong> Back up Ledger to your private Notes repository.');
      return;
    }

    try{
      const meaningfulHash=await contentHash(plain);
      if(token!==refreshToken)return;

      let matches=status?.contentHash===meaningfulHash;
      if(!matches&&!status?.contentHash)matches=await matchesLegacySnapshot(plain,status?.hash);
      if(token!==refreshToken)return;

      if(matches){
        mismatchSince=0;
        hide();
        return;
      }

      const remembered=readJson(REMEMBERED_CONNECTION_KEY);
      if(remembered?.repo&&remembered?.token){
        if(!mismatchSince)mismatchSince=Date.now();
        // Automatic sync normally resolves this within 30 seconds. Keep normal
        // background work quiet and only surface it when it stays stale.
        if(Date.now()-mismatchSince<120000){hide();return;}
        show('<strong>Sync needs attention.</strong> Automatic sync has not completed yet.');
        return;
      }

      mismatchSince=0;
      show('<strong>Changes not synced.</strong> Your browser has newer Ledger data than the last GitHub snapshot.');
    }catch(e){
      mismatchSince=0;
      hide();
    }
  }

  window.addEventListener('storage',event=>{
    if(event.key===STORAGE_KEY||event.key===SYNC_STATUS_KEY||event.key===REMEMBERED_CONNECTION_KEY)refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  setInterval(refresh,5000);
  refresh();
})();
