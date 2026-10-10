(() => {
  const tag = document.querySelector('#studio-tag');
  if (!tag) return;
  const face = tag.querySelector('.studio-tag-face');
  const cords = tag.querySelector('.studio-tag-cords');
  const lines = [...cords.querySelectorAll('line')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const position = [0, 0, 0, 0];
  const velocity = [0, 0, 0, 0];
  const target = [0, 0, 0, 0];
  const following = [0, 0, 0, 0];
  const stiffness = [38, 42, 30, 24];
  const damping = [4.7, 4.8, 3.6, 3.9];
  let hovered = false;
  let frame = 0;
  let previous = 0;
  let width = 0;
  let height = 0;
  let drop = 0;
  let spread = .37;

  const paint = () => {
    const [x, y, angle, flex] = position;
    const stretch = 1 + y * .004;
    face.style.setProperty('--tag-x', `${x}px`);
    face.style.setProperty('--tag-y', `${y}px`);
    face.style.setProperty('--tag-angle', `${angle}deg`);
    face.style.setProperty('--tag-flex', `${flex}deg`);
    face.style.setProperty('--tag-stretch', String(stretch));
    const radians = angle * Math.PI / 180;
    lines.forEach((line, index) => {
      const offset = (index ? 1 : -1) * width * spread;
      const localX = offset - height / 2 * stretch * Math.tan(flex * Math.PI / 180);
      const localY = -height / 2 * stretch;
      line.setAttribute('x1', String(width / 2 + offset));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', String(width / 2 + x + localX * Math.cos(radians) - localY * Math.sin(radians)));
      line.setAttribute('y2', String(drop + height / 2 + y + localX * Math.sin(radians) + localY * Math.cos(radians)));
    });
  };
  const resize = () => {
    width = tag.clientWidth;
    height = face.offsetHeight;
    drop = tag.offsetTop;
    spread = innerWidth <= 700 ? .12 : .37;
    cords.setAttribute('viewBox', `0 0 ${width} ${drop + height + 24}`);
    cords.style.height = `${drop + height + 24}px`;
    paint();
  };
  const tick = now => {
    const dt = Math.min(.032, Math.max(.001, (now - previous) / 1000));
    previous = now;
    let motion = 0;
    // The attachment relaxes gradually on release, retaining the tag's momentum.
    // Independent soft springs give the fabric a slight flex and settling ripple.
    const follow = 1 - Math.exp(-dt / (hovered ? .09 : .24));
    for (let i = 0; i < position.length; i++) {
      following[i] += (target[i] - following[i]) * follow;
      velocity[i] += ((following[i] - position[i]) * stiffness[i] - velocity[i] * damping[i]) * dt;
      position[i] += velocity[i] * dt;
      motion += Math.abs(target[i] - position[i]) + Math.abs(target[i] - following[i]) + Math.abs(velocity[i]);
    }
    if (motion < .025) {
      position.splice(0, position.length, ...target);
      following.splice(0, following.length, ...target);
      velocity.fill(0);
      frame = 0;
    } else frame = requestAnimationFrame(tick);
    paint();
  };
  const wake = () => {
    if (frame) return;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const hover = event => {
    if (tag.dataset.transitioning === 'true' || reduced.matches || !fine.matches || event.pointerType !== 'mouse') return;
    hovered = true;
    const bounds = tag.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    target[0] = x * 5;
    target[1] = 1.5 + y * 1.5;
    target[2] = x * 3;
    target[3] = x * .8;
    if (event.type === 'pointerenter') {
      velocity[2] += (x || .4) * 5;
      velocity[1] += 2.6;
    }
    wake();
  };
  const release = () => { hovered = false; target.fill(0); wake(); };
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    position.fill(0);
    velocity.fill(0);
    target.fill(0);
    following.fill(0);
    hovered = false;
    paint();
  };
  tag.addEventListener('pointerenter', hover);
  tag.addEventListener('pointermove', hover);
  tag.addEventListener('pointerleave', release);
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  reduced.addEventListener('change', reset);
  fine.addEventListener('change', reset);
  tag.addEventListener('tag-transition-reset', reset);
  new ResizeObserver(resize).observe(tag);
  resize();
})();
