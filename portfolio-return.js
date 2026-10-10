/* Preserve the portfolio position across case-study visits in this tab. */
(() => {
  const key = 'hc-case-study-return-v1';
  const home = new URL('./index.html', document.currentScript.src);
  const isHome = url => url.origin === home.origin &&
    (url.pathname === home.pathname || url.pathname === home.pathname.replace(/index\.html$/, ''));
  const read = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      if (!saved || !Number.isFinite(saved.top) || saved.top < 0 ||
          Date.now() - saved.savedAt > 6 * 60 * 60 * 1000 ||
          !isHome(new URL(saved.url)) || new URL(saved.destination).origin !== home.origin) return null;
      return saved;
    } catch { return null; }
  };
  const save = value => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const onHome = isHome(new URL(location.href));
  const saved = read();
  let fromCase = false;
  try { fromCase = saved && new URL(document.referrer).href.split('#')[0] === saved.destination; } catch {}
  const backNavigation = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  const restoring = Boolean(onHome && saved && (saved.returning || fromCase || backNavigation));
  window.portfolioReturn = { restoring };

  if (restoring) {
    history.scrollRestoration = 'manual';
    document.documentElement.classList.add('portfolio-restoring');
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      scrollTo({ top: Math.min(saved.top, maximum), behavior: 'instant' });
      // Refresh the sticky Work scene, portal and navigation even if the browser
      // had already restored this exact native scroll position.
      dispatchEvent(new Event('scroll'));
      document.documentElement.classList.remove('portfolio-restoring');
      history.scrollRestoration = 'auto';
      try { sessionStorage.removeItem(key); } catch {}
    };
    addEventListener('load', () => {
      document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(restore)));
      setTimeout(restore, 1500);
    }, { once: true });
  }

  addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const target = new URL(link.href, location.href);
    if (onHome) {
      if (link.matches('.project-link') && target.origin === home.origin &&
          target.pathname !== location.pathname && /\.html$/.test(target.pathname)) {
        target.hash = '';
        save({ url: location.href, top: scrollY, destination: target.href, savedAt: Date.now(), returning: false });
      }
    } else {
      const position = read();
      // Explicit Previous/Next project anchors still go to their own destination.
      if (position && isHome(target) && !target.hash) {
        save({ ...position, returning: true });
        link.href = position.url;
      }
    }
  }, { capture: true });
})();
