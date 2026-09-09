(() => {
  'use strict';

  const STORAGE_KEY='ledger-notes-roadmaps-v2';
  const SYNC_STATUS_KEY='ledger-github-sync-status-v1';
  const REMEMBERED_CONNECTION_KEY='ledger-github-sync-remember-v1';
  const AUTO_CONTENT_KEY='ledger-auto-sync-content-v1';
  const DATA_PATH='data/ledger.json';
  const enc=new TextEncoder();
  let inFlight=null;
  let retryAfter=0;

  function readJson(key){
    try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}
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

  async function github(connection,path,options={}){
    const headers=Object.assign({
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'Authorization':'Bearer '+connection.token
    },options.headers||{});
    const request=Object.assign({cache:'no-store'},options,{headers});
    const response=await fetch('https://api.github.com/repos/'+connection.repo+'/'+path,request);
    if(!response.ok){
      let detail='';
      try{detail=(await response.json()).message||''}catch(e){}
      const error=new Error('GitHub '+response.status+(detail?': '+detail:''));
      error.status=response.status;
      throw error;
    }
    return response.status===204?null:response.json();
  }

  async function currentRemoteSha(connection){
    try{
      const branch=connection.branch||'ledger-data';
      const old=await github(connection,'contents/'+DATA_PATH+'?ref='+encodeURIComponent(branch)+'&_ledger='+Date.now());
      return old.sha||null;
    }catch(error){
      if(error.status===404)return null;
      throw error;
    }
  }

  async function putSnapshot(connection,snapshot,sha){
    const body={
      message:'Auto-sync Ledger project data',
      content:btoa(unescape(encodeURIComponent(snapshot))),
      branch:connection.branch||'ledger-data'
    };
    if(sha)body.sha=sha;
    return github(connection,'contents/'+DATA_PATH,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  }

  async function perform(){
    if(Date.now()<retryAfter)return;
    const connection=readJson(REMEMBERED_CONNECTION_KEY);
    if(!connection?.repo||!connection?.token)return;

    const plain=localStorage.getItem(STORAGE_KEY);
    if(!plain)return;

    let state;
    let meaningfulHash;
    try{
      state=JSON.parse(plain);
      meaningfulHash=await contentHash(plain);
    }catch(e){
      return;
    }

    const lastContent=localStorage.getItem(AUTO_CONTENT_KEY);
    const status=readJson(SYNC_STATUS_KEY);
    const rawHash=await sha256Text(plain);

    if(status?.hash===rawHash){
      localStorage.setItem(AUTO_CONTENT_KEY,meaningfulHash);
      return;
    }
    if(lastContent===meaningfulHash)return;

    const snapshot=JSON.stringify(Object.assign({},state,{syncedAt:new Date().toISOString()}),null,2)+'\n';
    try{
      let sha=await currentRemoteSha(connection);
      try{
        await putSnapshot(connection,snapshot,sha);
      }catch(error){
        if(error.status!==409)throw error;
        sha=await currentRemoteSha(connection);
        await putSnapshot(connection,snapshot,sha);
      }

      const syncedAt=new Date().toISOString();
      localStorage.setItem(AUTO_CONTENT_KEY,meaningfulHash);
      localStorage.setItem(SYNC_STATUS_KEY,JSON.stringify({
        hash:rawHash,
        contentHash:meaningfulHash,
        syncedAt,
        repo:connection.repo,
        branch:connection.branch||'ledger-data',
        automatic:true
      }));
      retryAfter=0;
    }catch(error){
      // Do not hammer GitHub when a token expires or a repository is temporarily unavailable.
      retryAfter=Date.now()+(error.status===401||error.status===403?10:3)*60*1000;
    }
  }

  function syncIfNeeded(){
    if(inFlight)return inFlight;
    inFlight=perform().finally(()=>{inFlight=null});
    return inFlight;
  }

  // A remembered connection is an explicit opt-in to unattended syncing.
  setTimeout(syncIfNeeded,5000);
  setInterval(syncIfNeeded,30000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'||document.visibilityState==='visible')syncIfNeeded();
  });
})();
