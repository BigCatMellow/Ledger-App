(() => {
  'use strict';

  const STORAGE_KEY = 'ledger-notes-roadmaps-v2';

  function hasAndroidBridge() {
    return !!(window.LedgerAndroid && typeof window.LedgerAndroid.saveTextFile === 'function');
  }

  function buildProjectMarkdown() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    let state;
    try { state = JSON.parse(raw); } catch (_) { return null; }
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const items = Array.isArray(state.items) ? state.items : [];
    const project = projects.find(p => p.id === state.activeProject) || projects[0];
    if (!project) return null;

    const mine = items.filter(i => i.p === project.id);
    const framing = project.framing || {};
    const out = [`# ${project.title || 'Ledger project'}`];

    if (project.description) out.push('', project.description);
    if (project.mode === 'ROADMAP') {
      [
        ['Current reality', framing.currentReality],
        ['Definition of DONE', framing.done],
        ['Final proof', framing.proof],
        ['In scope', framing.inScope],
        ['Not doing', framing.notDoing],
        ['Effort limit', framing.effortLimit],
        ['Highest-risk unknown', framing.risk],
      ].forEach(([heading, value]) => {
        if (value) out.push('', `## ${heading}`, value);
      });
    }

    const phases = [...new Set(mine.map(i => i.phase || '').filter(Boolean))];
    const emit = rows => rows.forEach(item => {
      if (item.kind === 'NOTE') out.push('', item.title || '');
      else out.push(`${item.status === 'DONE' ? '- [x]' : '- [ ]'} ${item.title || 'Untitled'}`);
    });

    const unphased = mine.filter(i => !i.phase);
    if (unphased.length) { out.push(''); emit(unphased); }
    phases.forEach(phase => {
      out.push('', `## ${phase}`);
      emit(mine.filter(i => i.phase === phase));
    });

    const filename = (project.title || 'ledger-project')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-|-$/g, '') + '.md';
    const text = out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
    return { filename, text };
  }

  if (window.LedgerAndroid) {
    document.documentElement.classList.add('ledger-android');
  }

  document.addEventListener('click', event => {
    const exportButton = event.target.closest('[data-action="export-md"]');
    if (!exportButton || !hasAndroidBridge()) return;

    const result = buildProjectMarkdown();
    if (!result) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.LedgerAndroid.saveTextFile(result.filename, result.text, 'text/markdown');
  }, true);
})();
