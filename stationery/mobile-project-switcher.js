(() => {
  'use strict';

  const mobile = window.matchMedia('(max-width: 719px)');

  document.addEventListener('click', event => {
    if (!mobile.matches) return;

    const activeTab = event.target.closest('.project-tab.active[data-project]');
    if (!activeTab) return;

    event.preventDefault();
    event.stopPropagation();

    const projectsButton = document.querySelector('.bottom-ruler [data-action="projects"]');
    projectsButton?.click();
  }, true);
})();
