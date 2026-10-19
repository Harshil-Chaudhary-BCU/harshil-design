(() => {
  const bar = document.querySelector('.case-progress span');
  const reveals = document.querySelectorAll('.reveal');
  const railLinks = [...document.querySelectorAll('[data-rail-target]')];
  const railSections = railLinks.map(link => document.getElementById(link.dataset.railTarget)).filter(Boolean);
  const journeyCurve = document.querySelector('.journey-story__curve');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let updateFrame = 0;
  let activeRailTarget = '';
  let railPositions = [];
  const documentTop = element => {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  };
  const measureRailSections = () => {
    railPositions = railSections.map(section => ({ section, top: documentTop(section) }));
  };
  const update = () => {
    updateFrame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? scrollY / max : 0;
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
    const marker = innerHeight * .46;
    let active = railSections[0];
    let nearestTop = -Infinity;
    // Navigation order may differ from page order; select by actual position.
    railPositions.forEach(({ section, top: documentOffset }) => {
      const top = documentOffset - scrollY;
      if (top <= marker && top > nearestTop) { active = section; nearestTop = top; }
    });
    if (active?.id !== activeRailTarget) {
      activeRailTarget = active?.id || '';
      railLinks.forEach(link => link.classList.toggle('is-active', link.dataset.railTarget === activeRailTarget));
    }
  };
  const scheduleUpdate = () => {
    if (!updateFrame) updateFrame = requestAnimationFrame(update);
  };
  const handleResize = () => {
    measureRailSections();
    scheduleUpdate();
  };
  addEventListener('scroll', scheduleUpdate, { passive: true });
  addEventListener('resize', handleResize, { passive: true });
  addEventListener('load', handleResize, { once: true });
  measureRailSections();
  update();

  // Chrome keeps CSS animations ticking on long off-screen sections more
  // aggressively than Safari. Pause decorative loops until they are visible.
  const ambientMotion = [...document.querySelectorAll('.research-avatars, .problem-orbit')];
  if (ambientMotion.length && !reduced) {
    const ambientObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('is-motion-visible', entry.isIntersecting));
    }, { rootMargin: '18% 0px' });
    ambientMotion.forEach(element => ambientObserver.observe(element));
  }
  const processTrack = document.querySelector('.process-track');
  const processSlider = document.querySelector('#process-slider-control');
  const processOutput = document.querySelector('.process-slider output');
  if (processTrack && processSlider && processOutput) {
    const processSteps = [...processTrack.querySelectorAll('article')];
    let sliderIsActive = false;
    const processMaximum = () => Math.max(0, processTrack.scrollWidth - processTrack.clientWidth);
    const updateProcessSlider = () => {
      if (sliderIsActive) return;
      const maximum = processMaximum();
      const progress = maximum ? processTrack.scrollLeft / maximum : 0;
      const percentage = Math.round(progress * 100);
      const step = Math.min(processSteps.length, Math.max(1, Math.round(progress * (processSteps.length - 1)) + 1));
      processSlider.value = String(percentage);
      processSlider.style.setProperty('--process-progress', `${percentage}%`);
      processOutput.value = `${step} / ${processSteps.length}`;
    };
    processSlider.addEventListener('pointerdown', () => { sliderIsActive = true; });
    processSlider.addEventListener('input', () => {
      const percentage = Number(processSlider.value);
      processSlider.style.setProperty('--process-progress', `${percentage}%`);
      processTrack.scrollLeft = processMaximum() * percentage / 100;
      const step = Math.min(processSteps.length, Math.max(1, Math.round(percentage / 100 * (processSteps.length - 1)) + 1));
      processOutput.value = `${step} / ${processSteps.length}`;
    });
    const releaseProcessSlider = () => { sliderIsActive = false; updateProcessSlider(); };
    processSlider.addEventListener('pointerup', releaseProcessSlider);
    processSlider.addEventListener('pointercancel', releaseProcessSlider);
    processSlider.addEventListener('change', releaseProcessSlider);
    processTrack.addEventListener('scroll', updateProcessSlider, { passive: true });
    addEventListener('resize', updateProcessSlider, { passive: true });
    updateProcessSlider();
  }
  if (reduced) reveals.forEach(el => el.classList.add('is-visible'));
  if (!reduced) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    // Tall mobile galleries can never place 8% of their full area inside one
    // phone viewport. Reveal as soon as a small, meaningful edge is visible.
    }, { rootMargin: '0px 0px -10% 0px', threshold: .01 });
    reveals.forEach(el => observer.observe(el));
  }
  if (journeyCurve && !reduced) {
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

  const galleryImages = [...document.querySelectorAll('main img')].filter(image =>
    !image.closest('.competitor-brand') && !image.hasAttribute('data-lightbox-ignore')
  );
  if (galleryImages.length) {
    const viewer = document.createElement('div');
    viewer.className = 'case-lightbox';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-hidden', 'true');
    viewer.innerHTML = `
      <button class="case-lightbox__backdrop" type="button" aria-label="Close image viewer"></button>
      <div class="case-lightbox__panel" role="document">
        <header class="case-lightbox__header">
          <div class="case-lightbox__heading"><p class="case-lightbox__context"></p><p class="case-lightbox__title"></p></div>
          <button class="case-lightbox__close" type="button" aria-label="Close image viewer"><span aria-hidden="true"></span></button>
        </header>
        <div class="case-lightbox__stage"><img alt=""><div class="case-lightbox__lens" aria-hidden="true"></div></div>
        <footer class="case-lightbox__controls">
          <button class="case-lightbox__previous" type="button" aria-label="Previous image"><span aria-hidden="true">←</span></button>
          <p class="case-lightbox__count" aria-live="polite"></p>
          <button class="case-lightbox__next" type="button" aria-label="Next image"><span aria-hidden="true">→</span></button>
          <button class="case-lightbox__magnifier" type="button" aria-label="Turn magnifier on" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.75"></circle><path d="m15 15 5 5M10.5 8v5M8 10.5h5"></path></svg></button>
        </footer>
      </div>`;
    document.body.append(viewer);
    const viewedImage = viewer.querySelector('.case-lightbox__stage img');
    const stage = viewer.querySelector('.case-lightbox__stage');
    const lens = viewer.querySelector('.case-lightbox__lens');
    const context = viewer.querySelector('.case-lightbox__context');
    const title = viewer.querySelector('.case-lightbox__title');
    const count = viewer.querySelector('.case-lightbox__count');
    const closeButton = viewer.querySelector('.case-lightbox__close');
    const previousButton = viewer.querySelector('.case-lightbox__previous');
    const nextButton = viewer.querySelector('.case-lightbox__next');
    const magnifierButton = viewer.querySelector('.case-lightbox__magnifier');
    let activeIndex = 0;
    let lastFocus = null;
    let holdTimer = 0;
    let openedByHold = false;
    let magnifierEnabled = false;
    let clearImageTimer = 0;
    let revealPanelTimer = 0;
    let hideViewerTimer = 0;
    const coarsePointer = matchMedia('(pointer: coarse)');
    const touchPointers = new Map();
    let touchScale = 1;
    let touchPanX = 0;
    let touchPanY = 0;
    let gestureScale = 1;
    let gesturePanX = 0;
    let gesturePanY = 0;
    let gestureDistance = 0;
    let gestureMidpoint = null;
    let singlePoint = null;
    const imageTitle = image => {
      const caption = image.closest('figure')?.querySelector('figcaption');
      return caption?.innerText.trim().replace(/\s+/g, ' ') || image.alt || 'LiftLab project image';
    };
    const imageContext = image => {
      if (image.closest('#competitor-analysis')) return 'Competitor analysis';
      if (image.closest('#feature-mapping')) return 'Feature mapping';
      if (image.closest('#information-architecture')) return 'Information architecture';
      if (image.closest('#core-flows')) return 'User flow';
      if (image.closest('.fidelity-stage--sketches')) return 'Sketch exploration';
      if (image.closest('.fidelity-stage--iterations')) return 'Early design iteration';
      if (image.closest('.fidelity-stage--wireframes')) return 'Low-fidelity wireframe';
      if (image.closest('#final-interface')) return 'Final interface';
      if (image.closest('#feedback-iteration')) return 'Feedback-led iteration';
      if (image.closest('#accessibility')) return 'Accessibility concept';
      if (image.closest('#usability-testing') || image.closest('#sus-results')) return 'Usability evaluation';
      if (image.closest('.hero')) return 'LiftLab product overview';
      return 'LiftLab case study';
    };
    const renderImage = index => {
      activeIndex = (index + galleryImages.length) % galleryImages.length;
      const source = galleryImages[activeIndex];
      viewedImage.src = source.currentSrc || source.src;
      viewedImage.alt = source.alt || imageTitle(source);
      context.textContent = imageContext(source);
      title.textContent = imageTitle(source);
      count.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(galleryImages.length).padStart(2, '0')}`;
      lens.style.backgroundImage = `url("${viewedImage.src.replace(/"/g, '%22')}")`;
      lens.classList.remove('is-visible');
      resetTouchZoom();
    };
    const openViewer = (image, fromHold = false) => {
      const index = galleryImages.indexOf(image);
      if (index < 0) return;
      openedByHold = fromHold;
      lastFocus = document.activeElement;
      clearTimeout(clearImageTimer);
      clearTimeout(revealPanelTimer);
      clearTimeout(hideViewerTimer);
      renderImage(index);
      viewer.classList.remove('is-ready');
      viewer.classList.add('is-open');
      viewer.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('case-lightbox-open');
      revealPanelTimer = window.setTimeout(() => {
        viewer.classList.add('is-ready');
        closeButton.focus({ preventScroll: true });
      }, 90);
    };
    const closeViewer = () => {
      clearTimeout(revealPanelTimer);
      clearTimeout(hideViewerTimer);
      viewer.classList.remove('is-ready');
      viewer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('case-lightbox-open');
      lens.classList.remove('is-visible');
      resetTouchZoom();
      hideViewerTimer = window.setTimeout(() => viewer.classList.remove('is-open'), 180);
      clearImageTimer = window.setTimeout(() => {
        if (!viewer.classList.contains('is-open')) viewedImage.removeAttribute('src');
      }, 360);
      if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true });
    };
    const clampTouchPan = () => {
      const stageRect = stage.getBoundingClientRect();
      const naturalWidth = viewedImage.naturalWidth || stageRect.width || 1;
      const naturalHeight = viewedImage.naturalHeight || stageRect.height || 1;
      const imageScale = Math.min(stageRect.width / naturalWidth, stageRect.height / naturalHeight);
      const renderedWidth = naturalWidth * imageScale * touchScale;
      const renderedHeight = naturalHeight * imageScale * touchScale;
      const maxX = Math.max(0, (renderedWidth - stageRect.width) / 2);
      const maxY = Math.max(0, (renderedHeight - stageRect.height) / 2);
      touchPanX = Math.max(-maxX, Math.min(maxX, touchPanX));
      touchPanY = Math.max(-maxY, Math.min(maxY, touchPanY));
    };
    const paintTouchZoom = (panning = false) => {
      touchScale = Math.max(1, Math.min(4, touchScale));
      clampTouchPan();
      stage.style.setProperty('--touch-scale', touchScale.toFixed(3));
      stage.style.setProperty('--touch-pan-x', `${touchPanX.toFixed(1)}px`);
      stage.style.setProperty('--touch-pan-y', `${touchPanY.toFixed(1)}px`);
      stage.classList.toggle('is-touch-zoomed', touchScale > 1.001);
      stage.classList.toggle('is-touch-panning', panning && touchScale > 1.001);
      viewer.classList.toggle('is-touch-zoom-enabled', touchScale > 1.001);
      if (coarsePointer.matches) {
        const enabled = touchScale > 1.001;
        magnifierButton.setAttribute('aria-pressed', String(enabled));
        magnifierButton.setAttribute('aria-label', enabled ? 'Reset image zoom' : 'Zoom image in');
      }
    };
    function resetTouchZoom() {
      touchPointers.clear();
      touchScale = 1;
      touchPanX = 0;
      touchPanY = 0;
      gestureDistance = 0;
      gestureMidpoint = null;
      singlePoint = null;
      stage.classList.remove('is-touch-zoomed', 'is-touch-panning');
      viewer.classList.remove('is-touch-zoom-enabled');
      stage.style.removeProperty('--touch-scale');
      stage.style.removeProperty('--touch-pan-x');
      stage.style.removeProperty('--touch-pan-y');
      if (coarsePointer.matches) {
        magnifierButton.setAttribute('aria-pressed', 'false');
        magnifierButton.setAttribute('aria-label', 'Zoom image in');
      }
    }
    const setMagnifier = enabled => {
      if (coarsePointer.matches) {
        magnifierEnabled = false;
        viewer.classList.remove('is-magnifier-enabled');
        lens.classList.remove('is-visible');
        if (enabled) {
          touchScale = 2.25;
          touchPanX = 0;
          touchPanY = 0;
          paintTouchZoom();
        } else resetTouchZoom();
        return;
      }
      magnifierEnabled = enabled;
      viewer.classList.toggle('is-magnifier-enabled', enabled);
      magnifierButton.setAttribute('aria-pressed', String(enabled));
      magnifierButton.setAttribute('aria-label', enabled ? 'Turn magnifier off' : 'Turn magnifier on');
      if (!enabled) lens.classList.remove('is-visible');
    };
    const touchDistance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const touchMidpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
    const beginTouchGesture = () => {
      const points = [...touchPointers.values()];
      gestureScale = touchScale;
      gesturePanX = touchPanX;
      gesturePanY = touchPanY;
      if (points.length >= 2) {
        gestureDistance = touchDistance(points);
        gestureMidpoint = touchMidpoint(points);
        singlePoint = null;
      } else {
        gestureDistance = 0;
        gestureMidpoint = null;
        singlePoint = points[0] || null;
      }
    };
    const touchPointerDown = event => {
      if (!coarsePointer.matches || event.pointerType !== 'touch') return;
      event.preventDefault();
      stage.setPointerCapture?.(event.pointerId);
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      beginTouchGesture();
    };
    const touchPointerMove = event => {
      if (!touchPointers.has(event.pointerId)) return;
      event.preventDefault();
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...touchPointers.values()];
      if (points.length >= 2 && gestureDistance > 0 && gestureMidpoint) {
        const midpoint = touchMidpoint(points);
        touchScale = gestureScale * touchDistance(points) / gestureDistance;
        touchPanX = gesturePanX + midpoint.x - gestureMidpoint.x;
        touchPanY = gesturePanY + midpoint.y - gestureMidpoint.y;
        paintTouchZoom(true);
      } else if (points.length === 1 && singlePoint && touchScale > 1.001) {
        touchPanX = gesturePanX + points[0].x - singlePoint.x;
        touchPanY = gesturePanY + points[0].y - singlePoint.y;
        paintTouchZoom(true);
      }
    };
    const touchPointerEnd = event => {
      if (!touchPointers.has(event.pointerId)) return;
      touchPointers.delete(event.pointerId);
      if (touchScale < 1.08) resetTouchZoom();
      else {
        paintTouchZoom();
        beginTouchGesture();
      }
    };
    const moveLens = event => {
      if (!magnifierEnabled || !viewedImage.src) return;
      const stageRect = stage.getBoundingClientRect();
      const naturalWidth = viewedImage.naturalWidth || 1;
      const naturalHeight = viewedImage.naturalHeight || 1;
      const imageScale = Math.min(stageRect.width / naturalWidth, stageRect.height / naturalHeight);
      const renderedWidth = naturalWidth * imageScale;
      const renderedHeight = naturalHeight * imageScale;
      const imageRect = {
        left: stageRect.left + (stageRect.width - renderedWidth) / 2,
        top: stageRect.top + (stageRect.height - renderedHeight) / 2,
        right: stageRect.left + (stageRect.width + renderedWidth) / 2,
        bottom: stageRect.top + (stageRect.height + renderedHeight) / 2,
        width: renderedWidth,
        height: renderedHeight
      };
      if (event.clientX < imageRect.left || event.clientX > imageRect.right || event.clientY < imageRect.top || event.clientY > imageRect.bottom) {
        lens.classList.remove('is-visible');
        return;
      }
      const x = event.clientX - imageRect.left;
      const y = event.clientY - imageRect.top;
      const lensSize = lens.offsetWidth || 180;
      const zoom = 2.25;
      lens.style.left = `${event.clientX - stageRect.left}px`;
      lens.style.top = `${event.clientY - stageRect.top}px`;
      lens.style.backgroundSize = `${imageRect.width * zoom}px ${imageRect.height * zoom}px`;
      lens.style.backgroundPosition = `${lensSize / 2 - x * zoom}px ${lensSize / 2 - y * zoom}px`;
      lens.classList.add('is-visible');
    };
    galleryImages.forEach(image => {
      image.classList.add('case-lightbox-trigger');
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `Open image: ${imageTitle(image)}`);
      image.addEventListener('click', event => {
        event.preventDefault();
        if (openedByHold) { openedByHold = false; return; }
        openViewer(image);
      });
      image.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openViewer(image); }
      });
      image.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        openedByHold = false;
        holdTimer = window.setTimeout(() => openViewer(image, true), 420);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => image.addEventListener(type, () => clearTimeout(holdTimer)));
      image.addEventListener('dragstart', event => event.preventDefault());
    });
    closeButton.addEventListener('click', closeViewer);
    viewer.querySelector('.case-lightbox__backdrop').addEventListener('click', closeViewer);
    previousButton.addEventListener('click', () => renderImage(activeIndex - 1));
    nextButton.addEventListener('click', () => renderImage(activeIndex + 1));
    magnifierButton.addEventListener('click', () => setMagnifier(coarsePointer.matches ? touchScale <= 1.001 : !magnifierEnabled));
    stage.addEventListener('pointermove', moveLens);
    stage.addEventListener('pointerdown', moveLens);
    stage.addEventListener('pointerleave', () => lens.classList.remove('is-visible'));
    stage.addEventListener('pointerdown', touchPointerDown, { passive: false });
    stage.addEventListener('pointermove', touchPointerMove, { passive: false });
    stage.addEventListener('pointerup', touchPointerEnd);
    stage.addEventListener('pointercancel', touchPointerEnd);
    viewer.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeViewer();
      if (event.key === 'ArrowLeft') renderImage(activeIndex - 1);
      if (event.key === 'ArrowRight') renderImage(activeIndex + 1);
      if (event.key === 'Tab') {
        const controls = [closeButton, previousButton, magnifierButton, nextButton];
        const edge = event.shiftKey ? controls[0] : controls.at(-1);
        if (document.activeElement === edge) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0].focus();
        }
      }
    });
  }

  document.querySelectorAll('[data-phone-carousel]').forEach(carousel => {
    const slides = [...carousel.querySelectorAll('[data-phone-slide]')];
    const article = carousel.closest('article');
    const previous = carousel.querySelector('[data-phone-prev]');
    const next = carousel.querySelector('[data-phone-next]');
    const current = carousel.querySelector('[data-phone-current]');
    const total = carousel.querySelector('[data-phone-total]');
    const screenTitle = article?.querySelector('[data-phone-title]');
    const screenDescription = article?.querySelector('[data-phone-description]');
    let active = 0;

    const getScrollTarget = slide => slide?.querySelector('[data-phone-scroll]') || slide;

    const resetSlidePosition = slide => {
      const target = getScrollTarget(slide);
      if (!target) return;
      target.scrollTop = 0;
      target.scrollLeft = 0;
      target.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    };

    const settleSlideAtTop = slide => {
      if (!slide) return;
      const scrollTarget = slide.querySelector('[data-phone-scroll]');
      if (scrollTarget) scrollTarget.classList.add('is-resetting');
      resetSlidePosition(slide);
      requestAnimationFrame(() => {
        resetSlidePosition(slide);
        requestAnimationFrame(() => {
          resetSlidePosition(slide);
          if (scrollTarget) scrollTarget.classList.remove('is-resetting');
          resetSlidePosition(slide);
        });
      });
      window.setTimeout(() => {
        if (scrollTarget) scrollTarget.classList.remove('is-resetting');
        resetSlidePosition(slide);
      }, 120);
      window.setTimeout(() => resetSlidePosition(slide), 320);
    };

    const render = index => {
      if (!slides.length) return;
      active = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        resetSlidePosition(slide);
        const isActive = slideIndex === active;
        const slideTitle = slide.dataset.title || 'Interface screen';
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${slideIndex + 1} of ${slides.length}: ${slideTitle}`);
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
      });
      const activeSlide = slides[active];
      settleSlideAtTop(activeSlide);
      activeSlide.querySelector('img')?.addEventListener('load', () => settleSlideAtTop(activeSlide), { once: true });
      current.textContent = String(active + 1);
      total.textContent = String(slides.length);
      if (screenTitle) screenTitle.textContent = slides[active].dataset.title || '';
      if (screenDescription) screenDescription.textContent = slides[active].dataset.description || '';
      const hasMultipleScreens = slides.length > 1;
      previous.disabled = !hasMultipleScreens;
      next.disabled = !hasMultipleScreens;
    };

    previous.addEventListener('click', () => render(active - 1));
    next.addEventListener('click', () => render(active + 1));
    render(0);
  });
})();
