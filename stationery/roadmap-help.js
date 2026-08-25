(() => {
  'use strict';

  const help = {
    current: {
      title: 'Current Reality',
      definition: 'A factual snapshot of where the project stands right now. Describe what already exists, what is working or not working, and any important constraints.',
      question: 'What is true about this project today, before I make any more changes?',
      example: 'Ledger works on desktop and mobile, but project navigation is cramped on smaller screens and journal entries are not included in Markdown export.'
    },
    done: {
      title: 'Definition of Done',
      definition: 'The clear end state that tells you the project is actually finished. It should describe an observable result, not just an intention such as “make it better.”',
      question: 'What must be true before I can reasonably say this project is finished?',
      example: 'A user can create, edit, organize, and review project tasks, notes, and journal entries on both phone and desktop without layout problems.'
    },
    proof: {
      title: 'Final Proof',
      definition: 'The evidence you will use to confirm that the Definition of Done was really achieved. This keeps “done” from becoming a judgment call later.',
      question: 'What test, artifact, or visible result would prove that the finished state is real?',
      example: 'Run the project checklist on desktop and Android, confirm there is no horizontal overflow, create and edit each entry type, and verify the exported data contains the expected content.'
    },
    scope: {
      title: 'In Scope',
      definition: 'The parts of the project you are deliberately working on in this version. This defines the project boundary.',
      question: 'What am I specifically agreeing to work on?',
      example: 'Project navigation, journal workflow, mobile spacing, roadmap guidance, and Markdown export behavior.'
    },
    notDoing: {
      title: 'Not Doing',
      definition: 'Things that may be useful or tempting, but are intentionally excluded from this version. Writing them down protects the project from expanding indefinitely.',
      question: 'What could easily become part of this project, but should wait for another version?',
      example: 'No user accounts, shared collaboration, cloud database, or complete visual redesign in this version.'
    },
    effort: {
      title: 'Effort Limit',
      definition: 'A limit on time, complexity, or resources. It tells you when a solution is becoming too expensive for the value of the project.',
      question: 'How much time or complexity am I willing to spend before I should simplify the plan?',
      example: 'Keep the existing local-storage architecture, add no new framework, and limit the work to two focused evenings.'
    },
    risk: {
      title: 'Highest-Risk Unknown',
      definition: 'The unanswered question most likely to force a major change in the plan. This is usually the thing worth testing or learning first.',
      question: 'What do I still not know that could make the current plan fail or require substantial rework?',
      example: 'Whether the current fixed-sheet layout behaves reliably on mobile Safari when the keyboard is open.'
    }
  };

  const $ = id => document.getElementById(id);

  function openHelp(key){
    const item = help[key];
    if(!item) return;
    $('roadmapHelpTitle').textContent = item.title;
    $('roadmapHelpDefinition').textContent = item.definition;
    $('roadmapHelpQuestion').textContent = item.question;
    $('roadmapHelpExample').textContent = item.example;
    $('roadmapHelpBackdrop').hidden = false;
    $('roadmapHelpModal').hidden = false;
    setTimeout(() => $('roadmapHelpClose')?.focus({preventScroll:true}), 20);
  }

  function closeHelp(){
    if(!$('roadmapHelpModal')) return;
    $('roadmapHelpModal').hidden = true;
    $('roadmapHelpBackdrop').hidden = true;
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-roadmap-help]');
    if(trigger){
      event.preventDefault();
      openHelp(trigger.dataset.roadmapHelp);
      return;
    }
    if(event.target.closest('[data-roadmap-help-close]') || event.target === $('roadmapHelpBackdrop')){
      closeHelp();
    }
  });

  // Capture Escape before Ledger's sheet handler so closing help does not also close the project editor beneath it.
  document.addEventListener('keydown', event => {
    if(event.key !== 'Escape' || $('roadmapHelpModal')?.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeHelp();
  }, true);

  // Mobile uses the active project tab as a selector. Reuse Ledger's existing Projects sheet.
  const mobileProjectSelector = window.matchMedia('(max-width: 719px)');
  document.addEventListener('click', event => {
    if(!mobileProjectSelector.matches) return;
    const activeTab = event.target.closest('.project-tab.active[data-project]');
    if(!activeTab) return;
    event.preventDefault();
    event.stopPropagation();
    document.querySelector('.bottom-ruler [data-action="projects"]')?.click();
  }, true);
})();
