(() => {
  'use strict';

  const STORAGE_KEY = 'ledger-notes-roadmaps-v2';
  const $ = id => document.getElementById(id);

  function uid(){
    if(globalThis.crypto?.randomUUID) return `j-${globalThis.crypto.randomUUID()}`;
    return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function readLedger(){
    try{
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.projects = Array.isArray(state.projects) ? state.projects : [];
      state.journal = Array.isArray(state.journal) ? state.journal : [];
      return state;
    }catch(e){
      console.error('Ledger journal could not read browser data', e);
      return {activeProject:'',projects:[],journal:[]};
    }
  }

  function notifyLedger(value){
    let event;
    try{
      event = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: value,
        storageArea: localStorage,
        url: location.href
      });
    }catch(e){
      event = new Event('storage');
      Object.defineProperty(event, 'key', {value: STORAGE_KEY});
      Object.defineProperty(event, 'newValue', {value});
    }
    window.dispatchEvent(event);
  }

  function writeLedger(state){
    const value = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, value);
    // Native storage events do not fire in the tab that made the change.
    // Dispatch one locally so stationery.js reloads its in-memory state too.
    notifyLedger(value);
  }

  function activeProject(state){
    return state.projects.find(p => p.id === state.activeProject) || state.projects[0] || null;
  }

  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[c]));
  }

  function stamp(value){
    const d = new Date(value || '');
    if(Number.isNaN(d.getTime())) return 'Unknown date';
    const date = d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
    const time = d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
    return `${date} · ${time}`;
  }

  function ensureTaskAction(){
    const count = $('openCount');
    if(!count) return;
    const rule = count.closest('.section-rule');
    if(!rule || rule.querySelector('[data-project-task-new]')) return;

    const actions = document.createElement('span');
    actions.className = 'journal-rule-actions project-task-actions';
    count.replaceWith(actions);
    actions.appendChild(count);

    const button = document.createElement('button');
    button.className = 'journal-add project-task-add';
    button.type = 'button';
    button.dataset.projectTaskNew = '';
    button.textContent = '＋ Task';
    button.setAttribute('aria-label', 'Add task to current project');
    actions.appendChild(button);
  }

  function openTaskCapture(){
    const capture = document.querySelector('[data-action="capture"]');
    if(!capture) return;
    capture.click();
    setTimeout(() => {
      document.querySelector('[data-kind="CHECKLIST"]')?.click();
      $('captureTitle')?.focus({preventScroll:true});
    }, 30);
  }

  function renderJournal(){
    ensureTaskAction();
    const list = $('journalItems');
    const count = $('journalCount');
    if(!list || !count) return;

    const state = readLedger();
    const project = activeProject(state);
    if(!project){
      list.innerHTML = '';
      count.textContent = '';
      return;
    }

    const entries = state.journal
      .filter(entry => entry.p === project.id)
      .sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    count.textContent = String(entries.length);
    if(!entries.length){
      list.innerHTML = '<div class="journal-empty">No journal entries yet. Add an idea, question, observation, or thought.</div>';
      return;
    }

    list.innerHTML = entries.map(entry => {
      const edited = entry.updatedAt && entry.createdAt && entry.updatedAt !== entry.createdAt
        ? ' · edited'
        : '';
      return `<button class="journal-card" type="button" data-journal-id="${esc(entry.id)}">
        <span class="journal-time">${esc(stamp(entry.createdAt))}${edited}</span>
        <span class="journal-body">${esc(entry.body || '')}</span>
      </button>`;
    }).join('');
  }

  function openJournal(id=''){
    const state = readLedger();
    const project = activeProject(state);
    if(!project) return;

    const entry = id ? state.journal.find(j => j.id === id && j.p === project.id) : null;
    $('journalId').value = entry?.id || '';
    $('journalBody').value = entry?.body || '';
    $('journalSheetTitle').textContent = entry ? 'Edit Thought' : 'New Thought';
    $('journalDelete').hidden = !entry;

    document.querySelectorAll('.sheet').forEach(sheet => {
      if(sheet.id !== 'journalSheet') sheet.hidden = true;
    });
    $('journalSheet').hidden = false;
    $('sheetBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('journalBody').focus({preventScroll:true}), 30);
  }

  function closeJournal(){
    if(!$('journalSheet')) return;
    $('journalSheet').hidden = true;
    $('sheetBackdrop').hidden = true;
    document.body.style.overflow = '';
  }

  function saveJournal(event){
    event.preventDefault();
    const body = $('journalBody').value.trim();
    if(!body) return;

    const state = readLedger();
    const project = activeProject(state);
    if(!project) return;

    const id = $('journalId').value;
    const t = new Date().toISOString();
    let entry = id ? state.journal.find(j => j.id === id && j.p === project.id) : null;

    if(entry){
      entry.body = body;
      entry.updatedAt = t;
    }else{
      entry = {id:uid(), p:project.id, body, createdAt:t, updatedAt:t};
      state.journal.push(entry);
    }

    project.workedAt = t;
    writeLedger(state);
    renderJournal();
    closeJournal();
  }

  function deleteJournal(){
    const id = $('journalId').value;
    if(!id || !confirm('Delete this journal entry?')) return;

    const state = readLedger();
    const project = activeProject(state);
    if(!project) return;

    state.journal = state.journal.filter(j => !(j.id === id && j.p === project.id));
    project.workedAt = new Date().toISOString();
    writeLedger(state);
    renderJournal();
    closeJournal();
  }

  document.addEventListener('click', event => {
    if(event.target.closest('[data-project-task-new]')){
      openTaskCapture();
      return;
    }
    if(event.target.closest('[data-journal-new]')){
      openJournal();
      return;
    }
    const card = event.target.closest('[data-journal-id]');
    if(card){
      openJournal(card.dataset.journalId);
      return;
    }
    if(event.target.closest('[data-close-journal]') || event.target === $('sheetBackdrop')){
      closeJournal();
      return;
    }
    if(event.target.closest('[data-project]')){
      setTimeout(renderJournal, 0);
    }
  });

  $('journalForm')?.addEventListener('submit', saveJournal);
  $('journalDelete')?.addEventListener('click', deleteJournal);
  window.addEventListener('storage', event => {
    if(event.key === STORAGE_KEY) renderJournal();
  });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && !$('journalSheet')?.hidden) closeJournal();
  });

  const title = $('projectTitle');
  if(title){
    new MutationObserver(renderJournal).observe(title, {childList:true, characterData:true,subtree:true});
  }

  renderJournal();
})();
