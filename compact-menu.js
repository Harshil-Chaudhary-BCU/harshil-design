(() => {
  const menu = document.querySelector('.compact-menu');
  if (!menu) return;
  const toggle = menu.querySelector('.compact-menu-toggle');
  const home = menu.querySelector('.compact-menu-home');
  const panel = menu.querySelector('.compact-menu-panel');
  const links = [...panel.querySelectorAll('a')];
  const content = [...document.querySelectorAll('#hc-portfolio-concept > main, #hc-portfolio-concept > footer')];
  const compact = matchMedia('(max-width:1100px)');
  let opened = false;
  let priorOverflow = '';
  let priorInert = [];
  const setOpen = value => {
    if (value === opened) return;
    opened = value;
    menu.classList.toggle('is-open', opened);
    toggle.setAttribute('aria-expanded', String(opened));
    toggle.setAttribute('aria-label', opened ? 'Close navigation menu' : 'Open navigation menu');
    panel.setAttribute('aria-hidden', String(!opened));
    panel.inert = !opened;
    if (opened) {
      priorOverflow = document.documentElement.style.overflow;
      priorInert = content.map(element => element.inert);
      document.documentElement.style.overflow = 'hidden';
      content.forEach(element => { element.inert = true; });
    } else {
      document.documentElement.style.overflow = priorOverflow;
      content.forEach((element, index) => { element.inert = priorInert[index]; });
      toggle.focus({preventScroll:true});
    }
  };
  toggle.addEventListener('click', () => setOpen(!opened));
  home.addEventListener('click', () => setOpen(false));
  links.forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (!opened) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    if (event.key === 'Tab') {
      const targets = [home, toggle, ...links];
      const index = targets.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); targets.at(-1).focus(); }
      else if (!event.shiftKey && (index === targets.length - 1 || index < 0)) { event.preventDefault(); home.focus(); }
    }
  });
  window.addEventListener('wheel', event => {
    if (!opened) return;
    event.stopImmediatePropagation();
    if (!panel.contains(event.target)) event.preventDefault();
  }, {capture:true,passive:false});
  // Menu swipes must not drive the hero's touch-controlled transition.
  ['touchstart', 'touchmove', 'touchend'].forEach(type => {
    window.addEventListener(type, event => {
      if (opened) event.stopImmediatePropagation();
    }, {capture:true,passive:true});
  });
  compact.addEventListener('change', () => { if (!compact.matches) setOpen(false); });
})();
