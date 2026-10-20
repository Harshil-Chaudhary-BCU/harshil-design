(() => {
  const overlay = document.querySelector('.portfolio-preloader');
  if (!overlay) return;
  if (window.portfolioReturn?.restoring) {
    overlay.remove();
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Once content has been available for a while, do not cover it with a late loader.
  const alreadyInteracting = scrollY > 0 || document.activeElement?.matches('a,button,input,select,textarea');
  if (reduced.matches || performance.now() > 1500 || alreadyInteracting) {
    overlay.remove();
    return;
  }

  const ns = 'http://www.w3.org/2000/svg';
  const segments = overlay.querySelector('.preloader-segments');
  const count = 39;
  const slashes = Array.from({ length: count }, (_, index) => {
    const slash = document.createElementNS(ns, 'path');
    slash.setAttribute('d', 'M-2 5L2 -5');
    slash.setAttribute('class', `preloader-segment${index < 8 ? ' is-filled' : ''}`);
    slash.style.setProperty('--segment-start', `${(index - 19) * 13}px`);
    slash.style.setProperty('--segment-end', `${(index - 19) * 8}px`);
    segments.append(slash);
    return slash;
  });
  const root = document.documentElement;
  const duration = 2500;
  overlay.style.setProperty('--preloader-duration', `${duration}ms`);
  const angle = () => {
    const lineLength = Math.min(480, innerWidth * .68) * ((count - 1) * 8 + 8) / 500 + 5;
    const diagonalLength = Math.hypot(innerWidth, innerHeight);
    overlay.style.setProperty('--diagonal-angle', `${-Math.atan2(innerHeight, innerWidth) * 180 / Math.PI}deg`);
    overlay.style.setProperty('--diagonal-inset', `${(1 - lineLength / diagonalLength) * 50}%`);
  };
  angle();

  let finished = false;
  let frame;
  let deadline;
  // Block input without changing the viewport or scrollbar geometry beneath us.
  const blockScroll = event => {
    if (event.type === 'keydown' && ![' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    root.classList.remove('preloader-active');
    overlay.remove();
    removeEventListener('resize', angle);
    removeEventListener('pageshow', restore);
    reduced.removeEventListener('change', finish);
    removeEventListener('wheel', blockScroll, true);
    removeEventListener('touchmove', blockScroll, true);
    removeEventListener('keydown', blockScroll, true);
  };
  const restore = event => { if (event.persisted) finish(); };

  // Start immediately, without waiting for fonts, images, or the 3D model.
  root.classList.add('preloader-active');
  addEventListener('wheel', blockScroll, { capture: true, passive: false });
  addEventListener('touchmove', blockScroll, { capture: true, passive: false });
  addEventListener('keydown', blockScroll, { capture: true });
  overlay.classList.add('is-running');
  const started = performance.now();
  const fill = now => {
    const progress = Math.min(1, (now - started) / (duration * 7 / 22));
    const eased = progress * progress * (3 - 2 * progress);
    const filled = Math.round(8 + eased * (count - 8));
    slashes.forEach((slash, index) => slash.classList.toggle('is-filled', index < filled));
    if (progress < 1 && !finished) frame = requestAnimationFrame(fill);
  };
  frame = requestAnimationFrame(fill);
  deadline = setTimeout(finish, duration);
  overlay.querySelector('.preloader-half--lower').addEventListener('animationend', finish, { once: true });
  addEventListener('resize', angle, { passive: true });
  addEventListener('pageshow', restore);
  reduced.addEventListener('change', finish);
})();
