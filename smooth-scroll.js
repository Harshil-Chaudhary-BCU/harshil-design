/* Native scroll positions with optional eased wheel input and anchor journeys. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let anchorFrame = 0;
  let contentFrame = 0;
  let contentTarget = scrollY;
  let previousTime = 0;
  const smoothContent = document.body.hasAttribute('data-smooth-scroll-content');

  document.documentElement.style.scrollBehavior = 'auto';

  const stopAnchor = () => {
    if (anchorFrame) cancelAnimationFrame(anchorFrame);
    anchorFrame = 0;
  };
  const stop = () => {
    stopAnchor();
    if (contentFrame) cancelAnimationFrame(contentFrame);
    contentFrame = 0;
    contentTarget = scrollY;
  };

  const maximum = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const animateContent = now => {
    const dt = Math.min(64, Math.max(1, now - previousTime));
    previousTime = now;
    contentTarget = Math.max(0, Math.min(maximum(), contentTarget));
    const distance = contentTarget - scrollY;
    // Match About's 210ms time constant and Safari-safe final-pixel settling.
    const step = Math.min(Math.abs(distance), Math.max(1, Math.abs(distance) * (1 - Math.exp(-dt / 210))));
    const next = Math.abs(distance) < .6 ? contentTarget : scrollY + Math.sign(distance) * step;
    scrollTo({ top: next, behavior: 'instant' });
    if (Math.abs(contentTarget - next) > .5) contentFrame = requestAnimationFrame(animateContent);
    else {
      scrollTo({ top: contentTarget, behavior: 'instant' });
      contentFrame = 0;
    }
  };
  const wheel = event => {
    stopAnchor();
    if (!smoothContent || reduced.matches || event.defaultPrevented || event.ctrlKey ||
        !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const nested = event.composedPath().some(node => {
      if (!(node instanceof HTMLElement) || node === document.body || node === document.documentElement) return false;
      if (node.matches('input,textarea,select,[contenteditable="true"]')) return true;
      return /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1 &&
        (event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1);
    });
    if (nested) return;
    event.preventDefault();
    if (!contentFrame) { contentTarget = scrollY; previousTime = performance.now(); }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    contentTarget = Math.max(0, Math.min(maximum(), contentTarget + event.deltaY * unit));
    if (!contentFrame) contentFrame = requestAnimationFrame(animateContent);
  };

  const documentTop = element => {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  };

  addEventListener('wheel', wheel, { passive: !smoothContent });
  addEventListener('touchstart', stop, { passive: true });
  addEventListener('pointerdown', stop, { passive: true });
  addEventListener('keydown', stop);

  addEventListener('click', event => {
    const control = event.target instanceof Element
      ? event.target.closest('a[href^="#"],button[data-scroll-target]')
      : null;
    if (!control || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const href = control.getAttribute('href');
    const targetId = href?.startsWith('#') ? href.slice(1) : control.dataset.scrollTarget;
    if (!targetId) return;

    const destination = document.getElementById(targetId);
    if (!destination) return;

    event.preventDefault();
    stop();

    const start = scrollY;
    const isChapterLink = control.closest('.case-rail') || control.closest('.process-track h3');
    const anchor = isChapterLink ? destination.closest('.chapter') || destination : destination;
    const inset = parseFloat(getComputedStyle(anchor).scrollMarginTop) || 0;
    const finish = Math.max(0, Math.min(documentTop(anchor) - inset, document.documentElement.scrollHeight - innerHeight));
    const distance = finish - start;

    if (href?.startsWith('#')) history.pushState(null, '', href);
    if (reduced.matches || Math.abs(distance) < 1) {
      scrollTo({ top: finish, behavior: 'instant' });
      return;
    }

    const duration = Math.min(4200, Math.max(1400, 1200 + Math.sqrt(Math.abs(distance)) * 30));
    const began = performance.now();
    const travel = now => {
      const t = Math.min(1, (now - began) / duration);
      const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      scrollTo({ top: start + distance * eased, behavior: 'instant' });
      if (t < 1) anchorFrame = requestAnimationFrame(travel);
      else anchorFrame = 0;
    };
    anchorFrame = requestAnimationFrame(travel);
  });

  addEventListener('blur', stop);
  addEventListener('pagehide', stop);
  addEventListener('pageshow', stop);
  addEventListener('resize', stop, { passive: true });
  reduced.addEventListener('change', stop);
})();
