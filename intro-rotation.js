(() => {
  const hero = document.querySelector('.landing-stage .hero');
  const groups = [...document.querySelectorAll('.intro-rotator')].map(rotator=>[...rotator.querySelectorAll('.intro-word')]).filter(words=>words.length>1);
  if (!hero || !groups.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let visible = false;
  let ready = false;
  let timer = 0;
  let cleanup = 0;

  const pause = () => {
    clearTimeout(timer);
    clearTimeout(cleanup);
    timer = cleanup = 0;
    groups.flat().forEach(word => word.classList.remove('is-leaving'));
  };
  const rotate = () => {
    const outgoing=groups.map(words=>words[index%words.length]);
    outgoing.forEach(word=>word.classList.replace('is-current','is-leaving'));
    index++;
    groups.forEach(words=>words[index%words.length].classList.add('is-current'));
    cleanup = setTimeout(() => outgoing.forEach(word=>word.classList.remove('is-leaving')), 660);
    timer = setTimeout(rotate, 1500);
  };
  const sync = () => {
    pause();
    if (ready && visible && !document.hidden && !reduced.matches) {
      timer = setTimeout(rotate, 1500);
    }
  };

  // Leave the first word still during the loader and allow time to read each one.
  const preloadObserver = new MutationObserver(() => {
    if (document.documentElement.classList.contains('preloader-active')) return;
    ready = true;
    preloadObserver.disconnect();
    sync();
  });
  preloadObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const afterStartup = () => {
    ready = !document.documentElement.classList.contains('preloader-active');
    if (ready) preloadObserver.disconnect();
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afterStartup, { once: true });
  else afterStartup();
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .25;
    sync();
  }, { threshold: [0, .25] }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
})();
