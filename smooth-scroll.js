/* Native scroll positions with optional eased wheel input and anchor journeys. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => reduced.matches;
  let anchorFrame = 0;
  let anchorRunning = false;
  let contentFrame = 0;
  let contentTarget = scrollY;
  let previousTime = 0;
  const smoothContent = document.body.hasAttribute('data-smooth-scroll-content');

  document.documentElement.style.scrollBehavior = 'auto';

  const stopAnchor = () => {
    if (anchorFrame) cancelAnimationFrame(anchorFrame);
    anchorFrame = 0;
    if (anchorRunning) {
      anchorRunning = false;
      dispatchEvent(new Event('portfolio-anchor-end'));
    }
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
    if (!smoothContent || reduceMotion() || event.defaultPrevented || event.ctrlKey ||
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
    const aboutHeading = targetId === 'about' ? destination.querySelector('.about-introduction h2') : null;
    // Frame the opening About heading and introduction beneath the navigation.
    const targetTop = aboutHeading
      ? documentTop(aboutHeading) - Math.max(100, innerHeight * (innerWidth > 1100 ? .28 : .18))
      : documentTop(anchor) - inset;
    const finish = Math.max(0, Math.min(targetTop, document.documentElement.scrollHeight - innerHeight));
    const distance = finish - start;

    if (href?.startsWith('#')) history.pushState(null, '', href);
    if (reduceMotion() || Math.abs(distance) < 1) {
      scrollTo({ top: finish, behavior: 'instant' });
      return;
    }

    anchorRunning = true;
    dispatchEvent(new Event('portfolio-anchor-start'));
    const smooth = value => value * value * value * (10 + value * (-15 + 6 * value));
    const stages = [];
    const addStage = (from, to, duration) => {
      if (Math.abs(to - from) > 1) stages.push({ from, to, duration });
    };
    const sequence = document.querySelector('.landing-sequence');
    let remainderStart = start;
    if (sequence) {
      const portalStart = documentTop(sequence);
      const portalTravel = Math.max(1, sequence.offsetHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-viewport-height')) || innerHeight));
      const portalEnd = portalStart + portalTravel;
      const loweredTag = portalStart + portalTravel * .35;
      // Give the tag descent and portal reveal their own time instead of
      // rushing through them at the midpoint of a long document scroll.
      if (start < portalEnd && finish >= portalEnd) {
        if (start < loweredTag) addStage(start, loweredTag, 1000);
        addStage(Math.max(start, loweredTag), portalEnd, 1750);
        remainderStart = portalEnd;
      } else if (start >= portalEnd && finish < portalEnd) {
        addStage(start, portalEnd, Math.min(3200, 1200 + Math.sqrt(start - portalEnd) * 24));
        addStage(portalEnd, Math.max(finish, loweredTag), 1750);
        if (finish < loweredTag) addStage(loweredTag, finish, 1000);
        remainderStart = finish;
      }
    }
    addStage(remainderStart, finish, Math.min(4200, Math.max(1400, 1200 + Math.sqrt(Math.abs(finish - remainderStart)) * 30)));
    const duration = stages.reduce((total, stage) => total + stage.duration, 0);
    const began = performance.now();
    const travel = now => {
      let elapsed = now - began;
      let position = finish;
      for (const stage of stages) {
        if (elapsed < stage.duration) {
          position = stage.from + (stage.to - stage.from) * smooth(Math.max(0, elapsed / stage.duration));
          break;
        }
        elapsed -= stage.duration;
      }
      scrollTo({ top: position, behavior: 'instant' });
      if (now - began < duration) anchorFrame = requestAnimationFrame(travel);
      else stopAnchor();
    };
    anchorFrame = requestAnimationFrame(travel);
  });

  addEventListener('blur', stop);
  addEventListener('pagehide', stop);
  addEventListener('pageshow', stop);
  addEventListener('resize', stop, { passive: true });
  reduced.addEventListener('change', stop);
})();
