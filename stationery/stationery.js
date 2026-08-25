(() => {
  'use strict';

  const STORAGE_KEY = 'ledger-notes-roadmaps-v2';
  const $ = (id) => document.getElementById(id);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];
  let state = loadState();
  let captureKind = 'NOTE';
  let projectMode = 'LIST';

  function uid(prefix){
    if (crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  function now(){ return new Date().toISOString(); }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {activeProject:'',projects:[],items:[],worklog:[]};
      const parsed = JSON.parse(raw);
      parsed.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
      parsed.worklog = Array.isArray(parsed.worklog) ? parsed.worklog : [];
      return parsed;
    }catch(e){
      console.error('Ledger Stationery could not read browser data', e);
      return {activeProject:'',projects:[],items:[],worklog:[]};
    }
  }
  function persist(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  }
  function activeProject(){
    let p = state.projects.find(x => x.id === state.activeProject);
    if (!p && state.projects.length){ p = state.projects[0]; state.activeProject = p.id; }
    return p || null;
  }
  function log(summary, itemId='', projectId=null){
    const p = projectId || activeProject()?.id || '';
    state.worklog.unshift({id:uid('w'),p,itemId,whenAt:now(),summary});
  }
  function esc(s){ return String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function safeHttpUrl(value){
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
  function normalizeProjectLinks(links){
    if(!Array.isArray(links))return [];
    const seen=new Set();
    return links.map(link=>typeof link==='string'?{label:'',url:link}:link||{}).map(link=>({
      label:String(link.label||'').trim(),
      url:safeHttpUrl(link.url||'')
    })).filter(link=>{
      if(!link.url||seen.has(link.url))return false;
      seen.add(link.url);
      return true;
    });
  }
  function parseProjectLinks(value){
    const seen=new Set();
    return String(value||'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
      const divider=line.indexOf('|');
      const label=divider>=0?line.slice(0,divider).trim():'';
      const rawUrl=divider>=0?line.slice(divider+1).trim():line;
      return {label,url:safeHttpUrl(rawUrl)};
    }).filter(link=>{
      if(!link.url||seen.has(link.url))return false;
      seen.add(link.url);
      return true;
    });
  }
  function projectLinksText(links){
    return normalizeProjectLinks(links).map(link=>link.label?`${link.label} | ${link.url}`:link.url).join('\n');
  }
  function projectLinkLabel(link){
    if(link.label)return link.label;
    try{
      const url=new URL(link.url);
      const host=url.hostname.replace(/^www\./,'');
      const parts=url.pathname.split('/').filter(Boolean);
      if(host==='github.com'&&parts.length>=2)return `GitHub · ${parts[0]}/${parts[1]}`;
      return host||link.url;
    }catch(e){
      return link.url;
    }
  }
  function renderProjectLinks(p){
    const box=$('projectLinks');
    if(!box)return;
    const links=normalizeProjectLinks(p?.links);
    if(!links.length){box.hidden=true;box.innerHTML='';return;}
    box.innerHTML=links.map(link=>`<a class="project-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(projectLinkLabel(link))}</span><span class="project-link-arrow" aria-hidden="true">↗</span></a>`).join('');
    box.hidden=false;
  }
  function dateParts(value){
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return {day:'--',mon:'---',long:'Unknown date'};
    return {day:String(d.getDate()).padStart(2,'0'),mon:d.toLocaleString(undefined,{month:'short'}).toUpperCase(),long:d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric'})};
  }
  function ago(value){
    const d = new Date(value || ''); if (Number.isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now()-d.getTime())/86400000);
    if (days <= 0) return 'today'; if (days === 1) return '1 day ago'; return `${days} days ago`;
  }
  function itemStamp(item){
    const phase=(item.phase||'').toLowerCase();
    if(item.status==='DONE') return ['DONE','done'];
    if(item.status==='BLOCKED'||phase.includes('wait')||phase.includes('hold')||(item.dependencies||'').trim()) return ['WAIT','blocked'];
    if(item.status==='ACTIVE') return ['ACTIVE','active'];
    return ['OPEN','open'];
  }
  function meaningfulMeta(item){
    const parts=[];
    if(item.phase) parts.push(item.phase);
    if(item.workedAt) parts.push(`worked ${ago(item.workedAt)}`);
    return parts.join(' · ') || (item.kind==='NOTE'?'memo':'no work note');
  }

  function render(){
    state = loadState();
    const p = activeProject();
    renderTabs(p);
    $('emptyState').hidden = !!p;
    $('projectView').hidden = !p;
    if(!p) return;

    $('projectTitle').textContent = p.title || 'Untitled project';
    $('projectMode').textContent = p.mode === 'ROADMAP' ? 'ROADMAP' : 'LIST';
    $('projectDescription').textContent = p.description || '';
    $('projectDescription').hidden = !p.description;
    renderProjectLinks(p);

    const mine = state.items.filter(i=>i.p===p.id);
    const tasks = mine.filter(i=>i.kind!=='NOTE');
    const active = tasks.filter(i=>i.status==='ACTIVE');
    const open = tasks.filter(i=>i.status!=='DONE' && i.status!=='ACTIVE');
    const notes = mine.filter(i=>i.kind==='NOTE' && i.status!=='DONE');
    const done = mine.filter(i=>i.status==='DONE');
    const doneTasks = tasks.filter(i=>i.status==='DONE').length;

    $('projectProgress').textContent = tasks.length ? `${doneTasks}/${tasks.length} done` : 'no tasks';
    $('openCount').textContent = `${open.length}`;
    $('noteCount').textContent = `${notes.length}`;
    $('doneCount').textContent = `${done.length}`;
    $('activeItems').innerHTML = renderEntries(active, 'Nothing active.');
    $('openItems').innerHTML = renderEntries(open, 'No open tasks.');
    $('noteItems').innerHTML = renderNotes(notes);
    $('notesSection').hidden = !notes.length;
    $('doneItems').innerHTML = renderEntries(done, 'Nothing archived.');
    $('doneSection').hidden = !done.length;
    renderRoadmap(p);
    renderProjectList();
    renderHistory();
  }

  function renderTabs(p){
    $('projectTabs').innerHTML = state.projects.map(x=>`<button class="project-tab ${p&&x.id===p.id?'active':''}" data-project="${esc(x.id)}" type="button">${esc(x.title||'Untitled')}</button>`).join('');
  }
  function renderEntries(items, empty){
    if(!items.length) return `<div class="empty-line">${esc(empty)}</div>`;
    return items.map(item=>{
      const [label,cls]=itemStamp(item);
      return `<article class="entry" data-item="${esc(item.id)}" tabindex="0">
        <span class="stamp ${cls}">${label}</span>
        <span><div class="entry-title">${esc(item.title||'Untitled')}</div><div class="entry-meta">${esc(meaningfulMeta(item))}</div></span>
        <span class="entry-chevron">›</span>
      </article>`;
    }).join('');
  }
  function renderNotes(items){
    return items.map(i=>`<article class="memo-card" data-item="${esc(i.id)}" tabindex="0">${esc(i.title||'Untitled note')}</article>`).join('');
  }
  function renderRoadmap(p){
    const box=$('roadmapSummary');
    if(p.mode!=='ROADMAP'){box.hidden=true;box.innerHTML='';return;}
    const f=p.framing||{};
    const rows=[['Current',f.currentReality],['Done means',f.done],['Proof',f.proof],['Risk',f.risk]].filter(x=>String(x[1]||'').trim());
    if(!rows.length){box.hidden=true;box.innerHTML='';return;}
    box.innerHTML=rows.map(([k,v])=>`<div class="roadmap-row"><strong>${esc(k)}</strong><span>${esc(v)}</span></div>`).join('');
    box.hidden=false;
  }
  function renderProjectList(){
    const p=activeProject();
    $('projectList').innerHTML=state.projects.map(x=>{
      const count=state.items.filter(i=>i.p===x.id&&i.status!=='DONE').length;
      return `<button type="button" data-project="${esc(x.id)}" class="${p&&p.id===x.id?'active':''}"><span>${esc(x.title||'Untitled')}<small>${x.mode==='ROADMAP'?'Roadmap':'List'} · ${count} open</small></span><span>${p&&p.id===x.id?'●':'○'}</span></button>`;
    }).join('') || '<div class="empty-line">No projects yet.</div>';
  }
  function renderHistory(){
    const logs=[...state.worklog].sort((a,b)=>String(b.whenAt||'').localeCompare(String(a.whenAt||''))).slice(0,80);
    $('historyList').innerHTML=logs.length?logs.map(w=>{
      const d=dateParts(w.whenAt); const p=state.projects.find(x=>x.id===w.p);
      return `<div class="history-row"><div class="history-date"><strong>${d.day}</strong><span>${d.mon}</span></div><div><p>${esc(w.summary||'Work recorded')}</p><small>${esc(p?.title||'Ledger')}</small></div></div>`;
    }).join(''):'<div class="empty-line">No work history yet.</div>';
  }

  const sheets=['projectsSheet','captureSheet','historySheet','toolsSheet','projectSheet','itemSheet'];
  function openSheet(id){
    sheets.forEach(x=>$(x).hidden=x!==id);
    $('sheetBackdrop').hidden=false;
    document.body.style.overflow='hidden';
    setTimeout(()=>$(id).querySelector('input,textarea,button')?.focus({preventScroll:true}),30);
  }
  function closeSheets(){
    sheets.forEach(x=>$(x).hidden=true); $('sheetBackdrop').hidden=true; document.body.style.overflow='';
  }

  function resetCapture(){
    captureKind='NOTE'; $('captureForm').reset();
    qsa('[data-kind]').forEach(b=>b.classList.toggle('selected',b.dataset.kind==='NOTE'));
    $('captureTaskFields').hidden=true; $('captureExecutionFields').hidden=true;
  }
  function chooseKind(kind){
    captureKind=kind;
    qsa('[data-kind]').forEach(b=>b.classList.toggle('selected',b.dataset.kind===kind));
    $('captureTaskFields').hidden=kind==='NOTE';
    $('captureExecutionFields').hidden=kind!=='EXECUTION';
  }
  function openCapture(){
    if(!activeProject()){ openProjectEditor(null); return; }
    resetCapture(); openSheet('captureSheet');
  }
  function createItem(e){
    e.preventDefault(); const p=activeProject(); if(!p)return;
    const title=$('captureTitle').value.trim(); if(!title)return;
    const t=now();
    const item={
      id:uid('i'),p:p.id,kind:captureKind,status:'OPEN',phase:$('capturePhase').value.trim(),title,
      workedAt:t,createdAt:t,notes:'',outcome:$('captureOutcome').value.trim(),inputs:$('captureInputs').value.trim(),
      acceptance:$('captureAcceptance').value.trim(),dependencies:$('captureDependencies').value.trim(),boundary:'',verification:'',stopCondition:'',completedAt:''
    };
    state.items.push(item); p.workedAt=t; log(`Captured: ${title}`,item.id,p.id); persist(); closeSheets();
  }

  function openProjectEditor(id){
    const p=id?state.projects.find(x=>x.id===id):null;
    $('projectSheetTitle').textContent=p?'Edit project':'New project';
    $('projectId').value=p?.id||''; $('projectTitleInput').value=p?.title||''; $('projectDescriptionInput').value=p?.description||''; $('projectLinksInput').value=projectLinksText(p?.links);
    projectMode=p?.mode||'LIST'; setMode(projectMode);
    const f=p?.framing||{};
    $('framingCurrent').value=f.currentReality||''; $('framingDone').value=f.done||''; $('framingProof').value=f.proof||''; $('framingScope').value=f.inScope||'';
    $('framingNotDoing').value=f.notDoing||''; $('framingEffort').value=f.effortLimit||''; $('framingRisk').value=f.risk||'';
    openSheet('projectSheet');
  }
  function setMode(mode){
    projectMode=mode;
    qsa('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
    $('roadmapFields').hidden=mode!=='ROADMAP';
  }
  function saveProject(e){
    e.preventDefault(); const id=$('projectId').value; let p=id?state.projects.find(x=>x.id===id):null; const t=now();
    if(!p){p={id:uid('p'),createdAt:t,workedAt:t,framing:{},links:[]};state.projects.push(p);state.activeProject=p.id;}
    p.title=$('projectTitleInput').value.trim()||'Untitled project'; p.description=$('projectDescriptionInput').value.trim(); p.links=parseProjectLinks($('projectLinksInput').value); p.mode=projectMode; p.workedAt=t;
    p.framing={currentReality:$('framingCurrent').value.trim(),done:$('framingDone').value.trim(),proof:$('framingProof').value.trim(),inScope:$('framingScope').value.trim(),notDoing:$('framingNotDoing').value.trim(),effortLimit:$('framingEffort').value.trim(),risk:$('framingRisk').value.trim()};
    log(id?`Project updated: ${p.title}`:`Project created: ${p.title}`,'',p.id); persist(); closeSheets();
  }

  function openProjectMenu(){
    const p=activeProject(); if(!p)return;
    $('projectList').innerHTML=`
      <button type="button" data-action="edit-current-project"><span>Edit project<small>Title, description, links, roadmap framing</small></span><span>→</span></button>
      <button type="button" data-action="log-work"><span>Log work session<small>Record activity without changing a task</small></span><span>＋</span></button>
      <button type="button" data-action="toggle-roadmap"><span>${p.mode==='ROADMAP'?'Use list format':'Turn into roadmap'}<small>Keep the same project and entries</small></span><span>↔</span></button>`;
    $('projectsSheetTitle').textContent='Project';
    openSheet('projectsSheet');
  }

  function openItem(id){
    const item=state.items.find(x=>x.id===id); if(!item)return;
    $('itemId').value=item.id; $('itemSheetTitle').textContent=item.title||'Entry'; $('itemKindLabel').textContent=item.kind==='NOTE'?'MEMO':item.kind==='EXECUTION'?'STRUCTURED TASK':'TASK';
    $('itemTitleInput').value=item.title||''; $('itemPhaseInput').value=item.phase||''; $('itemNotesInput').value=item.notes||''; $('itemOutcomeInput').value=item.outcome||'';
    $('itemInputsInput').value=item.inputs||''; $('itemDependenciesInput').value=item.dependencies||''; $('itemBoundaryInput').value=item.boundary||''; $('itemAcceptanceInput').value=item.acceptance||'';
    $('itemVerificationInput').value=item.verification||''; $('itemStopInput').value=item.stopCondition||'';
    $('itemExecutionFields').hidden=item.kind==='NOTE';
    $('itemStatusActions').innerHTML=['OPEN','ACTIVE','DONE'].map(s=>`<button type="button" data-status="${s}" class="${item.status===s?'selected':''}">${s==='OPEN'?'Open':s==='ACTIVE'?'Active':'Done'}</button>`).join('');
    openSheet('itemSheet');
  }
  function setItemStatus(status){
    const item=state.items.find(x=>x.id===$('itemId').value); if(!item)return; const prior=item.status; const t=now(); item.status=status; item.workedAt=t; item.completedAt=status==='DONE'?t:'';
    if(status==='ACTIVE'&&prior!=='ACTIVE') log(`Started: ${item.title}`,item.id,item.p);
    else if(status==='DONE'&&prior!=='DONE') log(`Completed: ${item.title}`,item.id,item.p);
    else if(status==='OPEN'&&prior!=='OPEN') log(`Reopened: ${item.title}`,item.id,item.p);
    persist(); openItem(item.id);
  }
  function saveItem(e){
    e.preventDefault(); const item=state.items.find(x=>x.id===$('itemId').value); if(!item)return; const t=now();
    item.title=$('itemTitleInput').value.trim()||'Untitled'; item.phase=$('itemPhaseInput').value.trim(); item.notes=$('itemNotesInput').value.trim(); item.outcome=$('itemOutcomeInput').value.trim(); item.inputs=$('itemInputsInput').value.trim();
    item.dependencies=$('itemDependenciesInput').value.trim(); item.boundary=$('itemBoundaryInput').value.trim(); item.acceptance=$('itemAcceptanceInput').value.trim(); item.verification=$('itemVerificationInput').value.trim(); item.stopCondition=$('itemStopInput').value.trim(); item.workedAt=t;
    log(`Updated: ${item.title}`,item.id,item.p); persist(); closeSheets();
  }

  function logWork(){
    const p=activeProject(); if(!p)return; const summary=prompt('What did you work on?'); if(!summary?.trim())return;
    p.workedAt=now(); log(summary.trim(),'',p.id); persist(); closeSheets();
  }
  function toggleRoadmap(){
    const p=activeProject(); if(!p)return; p.mode=p.mode==='ROADMAP'?'LIST':'ROADMAP'; p.framing=p.framing||{currentReality:'',done:'',proof:'',inScope:'',notDoing:'',effortLimit:'',risk:''}; p.workedAt=now(); log(`Project format changed to ${p.mode==='ROADMAP'?'roadmap':'list'}: ${p.title}`,'',p.id); persist(); closeSheets();
  }

  function exportMarkdown(){
    const p=activeProject(); if(!p)return;
    const mine=state.items.filter(i=>i.p===p.id); const f=p.framing||{}; const out=[`# ${p.title}`];
    if(p.description) out.push('',p.description);
    const links=normalizeProjectLinks(p.links);
    if(links.length){
      out.push('','## Links');
      links.forEach(link=>out.push(link.label?`- [${link.label}](${link.url})`:`- <${link.url}>`));
    }
    if(p.mode==='ROADMAP'){
      const fields=[['Current Reality',f.currentReality],['Definition of Done',f.done],['Final Proof',f.proof],['In Scope',f.inScope],['Not Doing',f.notDoing],['Effort Limit',f.effortLimit],['Highest-Risk Unknown',f.risk]];
      fields.forEach(([h,v])=>{if(v)out.push('',`## ${h}`,v);});
    }
    const phases=[...new Set(mine.map(i=>i.phase||'').filter(Boolean))];
    const unphased=mine.filter(i=>!i.phase);
    function emit(items){items.forEach(i=>{if(i.kind==='NOTE')out.push('',i.title);else out.push(`${i.status==='DONE'?'- [x]':'- [ ]'} ${i.title}`);});}
    if(unphased.length){out.push('');emit(unphased);} phases.forEach(ph=>{out.push('',`## ${ph}`);emit(mine.filter(i=>i.phase===ph));});
    const blob=new Blob([out.join('\n').replace(/\n{3,}/g,'\n\n')+'\n'],{type:'text/markdown'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(p.title||'ledger-project').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'')+'.md'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function importMarkdown(text,name){
    const lines=text.replace(/\r/g,'').split('\n'); const titleLine=lines.find(l=>/^#\s+/.test(l)); const title=(titleLine?titleLine.replace(/^#\s+/,'').trim():name.replace(/\.md$/i,''))||'Imported project'; const t=now();
    const p={id:uid('p'),title,description:'',links:[],mode:'LIST',workedAt:t,createdAt:t,framing:{currentReality:'',done:'',proof:'',inScope:'',notDoing:'',effortLimit:'',risk:''}}; state.projects.push(p); state.activeProject=p.id;
    let phase=''; let paragraph=[]; const flush=()=>{const body=paragraph.join(' ').trim(); if(body){const id=uid('i');state.items.push({id,p:p.id,kind:'NOTE',status:'OPEN',phase,title:body,workedAt:t,createdAt:t,notes:'',outcome:'',inputs:'',acceptance:'',dependencies:'',boundary:'',verification:'',stopCondition:''});log(`Captured: ${body}`,id,p.id);} paragraph=[];};
    for(const line of lines){
      if(/^#\s+/.test(line))continue;
      const h=line.match(/^##+\s+(.+)/); if(h){flush();phase=h[1].trim();continue;}
      const task=line.match(/^\s*-\s*\[([ xX])\]\s+(.+)/); if(task){flush();const id=uid('i');state.items.push({id,p:p.id,kind:'CHECKLIST',status:task[1].trim()?'DONE':'OPEN',phase,title:task[2].trim(),workedAt:t,createdAt:t,notes:'',outcome:'',inputs:'',acceptance:'',dependencies:'',boundary:'',verification:'',stopCondition:'',completedAt:task[1].trim()?t:''});log(`Captured: ${task[2].trim()}`,id,p.id);continue;}
      if(!line.trim()){flush();continue;} paragraph.push(line.trim());
    }
    flush(); log(`Imported Markdown project: ${p.title}`,'',p.id); persist(); closeSheets();
  }

  document.addEventListener('click',e=>{
    const project=e.target.closest('[data-project]'); if(project){state.activeProject=project.dataset.project;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));closeSheets();render();return;}
    const item=e.target.closest('[data-item]'); if(item){openItem(item.dataset.item);return;}
    const kind=e.target.closest('[data-kind]'); if(kind){chooseKind(kind.dataset.kind);return;}
    const mode=e.target.closest('[data-mode]'); if(mode){setMode(mode.dataset.mode);return;}
    const status=e.target.closest('[data-status]'); if(status){setItemStatus(status.dataset.status);return;}
    if(e.target.closest('[data-close-sheet]')||e.target===$('sheetBackdrop')){closeSheets();return;}
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(!action)return;
    if(action==='projects'){ $('projectsSheetTitle').textContent='Projects'; renderProjectList(); openSheet('projectsSheet'); }
    if(action==='capture')openCapture();
    if(action==='history'){renderHistory();openSheet('historySheet');}
    if(action==='tools')openSheet('toolsSheet');
    if(action==='new-project')openProjectEditor(null);
    if(action==='project-menu')openProjectMenu();
    if(action==='edit-current-project')openProjectEditor(activeProject()?.id);
    if(action==='log-work')logWork();
    if(action==='toggle-roadmap')toggleRoadmap();
    if(action==='export-md')exportMarkdown();
    if(action==='import-md')$('importFile').click();
  });

  $('captureForm').addEventListener('submit',createItem);
  $('projectForm').addEventListener('submit',saveProject);
  $('itemForm').addEventListener('submit',saveItem);
  $('newProjectTop').addEventListener('click',()=>openProjectEditor(null));
  $('importFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;importMarkdown(await f.text(),f.name);e.target.value='';});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)render();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets();});

  const d=dateParts(); $('todayDay').textContent=d.day; $('todayMonth').textContent=d.mon;
  render();
})();
