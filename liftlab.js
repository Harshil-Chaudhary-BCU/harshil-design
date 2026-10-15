(() => {
  const bar = document.querySelector('.case-progress span');
  const reveals = document.querySelectorAll('.reveal');
  const railLinks = [...document.querySelectorAll('[data-rail-target]')];
  const railSections = railLinks.map(link => document.getElementById(link.dataset.railTarget)).filter(Boolean);
  const journeyCurve = document.querySelector('.journey-story__curve');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? scrollY / max : 0;
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
    const marker = innerHeight * .46;
    let active = railSections[0];
    let nearestTop = -Infinity;
    // Navigation order may differ from page order; select by actual position.
    railSections.forEach(section => {
      const top = section.getBoundingClientRect().top;
      if (top <= marker && top > nearestTop) { active = section; nearestTop = top; }
    });
    railLinks.forEach(link => link.classList.toggle('is-active', link.dataset.railTarget === active?.id));
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
  if (reduced) { reveals.forEach(el => el.classList.add('is-visible')); return; }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: .08 });
  reveals.forEach(el => observer.observe(el));
  if (journeyCurve) {
    const journeyDuration = 3.2;
    const setJourneyPathLength = () => {
      const path = journeyCurve.querySelector('path');
      const pathLength = path?.getTotalLength();
      if (!pathLength) return;
      const horizontalScale = journeyCurve.getBoundingClientRect().width / journeyCurve.viewBox.baseVal.width;
      journeyCurve.style.setProperty('--journey-path-length', `${Math.ceil(pathLength * horizontalScale) + 8}`);
      journeyCurve.style.setProperty('--journey-draw-duration', `${journeyDuration}s`);
      journeyCurve.querySelectorAll('circle').forEach(circle => {
        const target = { x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')) };
        let closestLength = 0;
        let closestDistance = Infinity;
        const samples = 800;
        for (let step = 0; step <= samples; step += 1) {
          const length = pathLength * step / samples;
          const point = path.getPointAtLength(length);
          const distance = Math.hypot(point.x - target.x, point.y - target.y);
          if (distance < closestDistance) { closestDistance = distance; closestLength = length; }
        }
        circle.style.setProperty('--journey-dot-delay', `${(closestLength / pathLength * journeyDuration).toFixed(3)}s`);
      });
    };
    setJourneyPathLength();
    addEventListener('resize', setJourneyPathLength, { passive: true });
    journeyCurve.classList.add('is-ready');
    const journeyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-drawing');
        journeyObserver.unobserve(entry.target);
      });
    }, { threshold: .12 });
    journeyObserver.observe(journeyCurve);
  }
})();
