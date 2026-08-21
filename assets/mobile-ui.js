(function(){
  'use strict';
  const MOBILE_QUERY='(max-width: 780px)';
  const mq=window.matchMedia(MOBILE_QUERY);
  let activeSheet=null;
  let enhanceTimer=0;

  function norm(value){
    return String(value||'').replace(/\s+/g,' ').trim();
  }

  function isOurs(el){
    return !!(el && el.closest && (el.closest('#ledger-mobile-actions') || el.closest('.ledger-mobile-overlay')));
  }

  function interactive(){
    return Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(function(el){ return !isOurs(el); });
  }

  function findActionSource(label){
    const wanted=norm(label).toLowerCase();
    const nodes=interactive();
    let exact=nodes.find(function(el){ return norm(el.textContent).toLowerCase()===wanted; });
    if(exact) return exact;
    return nodes.find(function(el){
      const text=norm(el.textContent).toLowerCase();
      return text===('+ '+wanted) || text.endsWith(' '+wanted) || text.indexOf(wanted)!==-1;
    }) || null;
  }

  function commonAncestor(elements){
    const els=elements.filter(Boolean);
    if(!els.length) return null;
    let node=els[0];
    while(node && node!==document.body && node!==document.documentElement){
      if(els.every(function(el){ return node.contains(el); })) return node;
      node=node.parentElement;
    }
    return null;
  }

  function hideActionGroup(labels){
    const els=labels.map(findActionSource).filter(Boolean);
    if(!els.length) return null;
    const group=commonAncestor(els);
    if(group){
      const controls=Array.from(group.querySelectorAll('button,a,[role="button"]')).filter(function(el){ return !isOurs(el); });
      if(controls.length<=Math.max(labels.length+2,5)){
        group.classList.add('ledger-mobile-hidden-group');
        group.setAttribute('data-ledger-mobile-group',labels.join('|'));
        return group;
      }
    }
    els.forEach(function(el){ el.classList.add('ledger-mobile-hidden-source'); });
    return els[0];
  }

  function findCaptureCard(){
    let field=document.querySelector('input[placeholder*="Capture anything"],textarea[placeholder*="Capture anything"]');
    if(!field){
      field=Array.from(document.querySelectorAll('[contenteditable="true"]')).find(function(el){
        return norm(el.getAttribute('aria-label')).toLowerCase().indexOf('capture')!==-1 ||
               norm(el.getAttribute('data-placeholder')).toLowerCase().indexOf('capture')!==-1;
      }) || null;
    }
    if(!field) return null;
    let node=field;
    for(let i=0;i<9 && node && node!==document.body;i++,node=node.parentElement){
      const text=norm(node.textContent).toLowerCase();
      if(text.indexOf('keep')!==-1 && text.indexOf('checklist')!==-1 && text.indexOf('structured task')!==-1){
        return node;
      }
    }
    return field.parentElement;
  }

  function sourceForMenu(label){
    return findActionSource(label);
  }

  function closeSheet(){
    if(activeSheet && activeSheet.close) activeSheet.close();
  }

  function openSheet(title, buildBody, onClose){
    closeSheet();
    const overlay=document.createElement('div');
    overlay.className='ledger-mobile-overlay';
    overlay.setAttribute('role','presentation');

    const sheet=document.createElement('section');
    sheet.className='ledger-mobile-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label',title);

    const handle=document.createElement('div');
    handle.className='ledger-mobile-handle';
    handle.setAttribute('aria-hidden','true');

    const header=document.createElement('div');
    header.className='ledger-mobile-sheet-header';
    const heading=document.createElement('h2');
    heading.textContent=title;
    const close=document.createElement('button');
    close.type='button';
    close.className='ledger-mobile-close';
    close.setAttribute('aria-label','Close');
    close.textContent='×';
    header.appendChild(heading);
    header.appendChild(close);

    const body=document.createElement('div');
    body.className='ledger-mobile-sheet-body';

    sheet.appendChild(handle);
    sheet.appendChild(header);
    sheet.appendChild(body);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    let closed=false;

    function finish(){
      if(closed) return;
      closed=true;
      document.removeEventListener('keydown',onKey);
      document.body.style.overflow=previousOverflow;
      if(onClose){ try{ onClose(); }catch(error){ console.error('Ledger mobile sheet cleanup failed',error); } }
      overlay.remove();
      activeSheet=null;
      scheduleEnhance();
    }

    function doClose(){
      if(closed) return;
      overlay.classList.remove('is-open');
      window.setTimeout(finish,160);
    }

    function onKey(event){
      if(event.key==='Escape') doClose();
    }

    overlay.addEventListener('click',function(event){ if(event.target===overlay) doClose(); });
    close.addEventListener('click',doClose);
    document.addEventListener('keydown',onKey);
    activeSheet={close:doClose, element:overlay};

    buildBody(body,doClose);
    requestAnimationFrame(function(){ overlay.classList.add('is-open'); });
    return activeSheet;
  }

  function openCapture(){
    const card=findCaptureCard();
    if(!card) return;
    const parent=card.parentNode;
    if(!parent) return;
    const marker=document.createComment('ledger-mobile-capture-home');
    parent.insertBefore(marker,card);

    card.classList.remove('ledger-mobile-hidden-source');
    card.classList.add('ledger-mobile-in-sheet');

    openSheet('Capture',function(body,close){
      body.classList.add('ledger-mobile-capture-body');
      body.appendChild(card);
      body.addEventListener('click',function(event){
        const button=event.target.closest && event.target.closest('button,[role="button"]');
        if(button && norm(button.textContent).toLowerCase()==='keep'){
          window.setTimeout(close,120);
        }
      });
      window.setTimeout(function(){
        const field=card.querySelector('input,textarea,[contenteditable="true"]');
        if(field && field.focus) field.focus({preventScroll:true});
      },180);
    },function(){
      if(marker.parentNode){ marker.parentNode.insertBefore(card,marker); marker.remove(); }
      card.classList.remove('ledger-mobile-in-sheet');
      card.classList.add('ledger-mobile-hidden-source');
    });
  }

  function makeMenuButton(label,sourceLabel,kind){
    const source=sourceForMenu(sourceLabel||label);
    if(!source) return null;
    const button=document.createElement('button');
    button.type='button';
    button.className='ledger-mobile-menu-button'+(kind ? ' '+kind : '');
    const span=document.createElement('span');
    span.textContent=label;
    const arrow=document.createElement('span');
    arrow.className='ledger-mobile-menu-arrow';
    arrow.textContent='›';
    button.appendChild(span);
    button.appendChild(arrow);
    button.addEventListener('click',function(){
      const latest=sourceForMenu(sourceLabel||label) || source;
      closeSheet();
      window.setTimeout(function(){ latest.click(); },190);
    });
    return button;
  }

  function openMore(){
    openSheet('Project & tools',function(body){
      const menu=document.createElement('div');
      menu.className='ledger-mobile-menu';
      [
        ['New project','New project','primary'],
        ['Edit project','Edit project',''],
        ['Log work session','Log work session',''],
        ['Turn into a roadmap','Turn into a roadmap',''],
        ['Sync','Sync',''],
        ['Import .md','Import .md',''],
        ['Export .md','Export .md','']
      ].forEach(function(item){
        const button=makeMenuButton(item[0],item[1],item[2]);
        if(button) menu.appendChild(button);
      });
      if(!menu.children.length){
        const empty=document.createElement('p');
        empty.className='ledger-mobile-empty';
        empty.textContent='No project actions are available here yet.';
        menu.appendChild(empty);
      }
      body.appendChild(menu);
    });
  }

  function findProjectActionRow(){
    const els=['Edit project','Turn into a roadmap','Log work session'].map(findActionSource).filter(Boolean);
    if(!els.length) return null;
    return commonAncestor(els) || els[0];
  }

  function ensureActionBar(anchor){
    if(document.getElementById('ledger-mobile-actions')) return;
    const bar=document.createElement('div');
    bar.id='ledger-mobile-actions';

    const capture=document.createElement('button');
    capture.type='button';
    capture.className='ledger-mobile-primary';
    capture.textContent='+ Capture';
    capture.addEventListener('click',openCapture);

    const more=document.createElement('button');
    more.type='button';
    more.className='ledger-mobile-secondary';
    more.textContent='More';
    more.addEventListener('click',openMore);

    bar.appendChild(capture);
    bar.appendChild(more);

    if(anchor && anchor.parentNode){
      anchor.parentNode.insertBefore(bar,anchor);
    }else{
      const heading=Array.from(document.querySelectorAll('h1,h2')).find(function(el){
        const text=norm(el.textContent).toLowerCase();
        return text && text!=='ledger' && text.indexOf('notes & roadmaps')===-1;
      });
      if(heading && heading.parentNode) heading.parentNode.insertBefore(bar,heading.nextSibling);
    }
  }

  function enhanceBottomNav(){
    const controls=interactive();
    const projects=controls.find(function(el){ return norm(el.textContent).toLowerCase()==='projects'; });
    const capture=controls.find(function(el){ return norm(el.textContent).toLowerCase()==='capture'; });
    const history=controls.find(function(el){ return norm(el.textContent).toLowerCase()==='history'; });
    const nav=commonAncestor([projects,capture,history].filter(Boolean));
    if(nav && projects && capture && history){
      nav.classList.add('ledger-mobile-nav');
      if(!capture.dataset.ledgerMobileCapture){
        capture.dataset.ledgerMobileCapture='1';
        capture.addEventListener('click',function(event){
          if(!mq.matches) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          openCapture();
        },true);
      }
    }
  }

  function enhance(){
    if(!mq.matches) return;

    const projectRow=hideActionGroup(['Edit project','Turn into a roadmap','Log work session']) || findProjectActionRow();
    hideActionGroup(['Export .md','Import .md','Sync']);

    const newProject=findActionSource('New project');
    if(newProject) newProject.classList.add('ledger-mobile-hidden-source');

    const captureCard=findCaptureCard();
    if(captureCard && !captureCard.closest('.ledger-mobile-sheet')){
      captureCard.classList.add('ledger-mobile-hidden-source');
    }

    ensureActionBar(projectRow || captureCard);
    enhanceBottomNav();
  }

  function scheduleEnhance(){
    window.clearTimeout(enhanceTimer);
    enhanceTimer=window.setTimeout(enhance,60);
  }

  const observer=new MutationObserver(scheduleEnhance);
  function start(){
    if(document.body) observer.observe(document.body,{childList:true,subtree:true});
    enhance();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  if(mq.addEventListener){
    mq.addEventListener('change',function(event){
      if(!event.matches) closeSheet();
      scheduleEnhance();
    });
  }

  window.LedgerMobileUI={openCapture:openCapture,openMore:openMore,refresh:enhance};
})();
