/* Fit visible script outlines, not advance boxes, to the full-bleed footer. */
(() => {
  const heading = document.querySelector('.connect-word');
  const track = heading?.querySelector('.connect-lettering');
  if (!track) return;
  const footer = heading.closest('footer');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const arc = document.createElementNS(ns, 'g');
  svg.append(arc);
  const letters = Array.from(track.textContent, character => {
    const node = document.createElementNS(ns, 'text');
    node.textContent = character === ' ' ? '\u00a0' : character;
    arc.append(node);
    return { node, character, center: 0 };
  });
  track.replaceChildren(svg);
  let frame = 0, previous = 0, bend = 0, ready = false;
  let anchorLeft = 0, anchorRight = 0, arcCenter = 0, arcRadius = 1;
  const clamp = value => Math.max(0, Math.min(1, value));
  function paint() {
    // Rigid glyphs follow a circular baseline, rather than stretching apart.
    // CONN is the stationary hinge; adjacent letters rotate into the same arc.
    letters.forEach(({node, center}) => {
      const distance = center < anchorLeft ? center - anchorLeft : center > anchorRight ? center - anchorRight : 0;
      const curvature = .48 * bend;
      const radius = curvature > .00001 ? arcRadius / curvature : Infinity;
      const angle = distance / arcRadius * curvature;
      const x = Number.isFinite(radius) ? radius * Math.sin(angle) - distance : 0;
      const y = Number.isFinite(radius) ? radius * (1 - Math.cos(angle)) : 0;
      const hingeAngle = (center - arcCenter) / arcRadius * 3 * bend;
      node.setAttribute('transform', `translate(${x} ${y}) rotate(${angle * 180 / Math.PI + hingeAngle} ${center} 0)`);
    });
  }
  function tick(time) {
    frame = 0;
    if (!ready) return;
    const bounds = footer.getBoundingClientRect();
    const target = reduced.matches ? 0 : clamp((bounds.bottom - innerHeight) / Math.max(heading.clientHeight * 1.2, 1));
    const elapsed = previous ? Math.min(time - previous, 64) : 16;
    previous = time;
    bend += (target - bend) * (1 - Math.exp(-elapsed / 130));
    if (Math.abs(target - bend) < .001) bend = target;
    paint();
    if (bend !== target && bounds.top < innerHeight && bounds.bottom > 0) schedule();
    else previous = 0;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function fit() {
    heading.style.width = `${footer.clientWidth}px`;
    if (ready) schedule();
  }
  document.fonts.load("700 100px 'The Nautigal'").then(() => {
    const context = document.createElement('canvas').getContext('2d');
    context.font = "700 100px 'The Nautigal'";
    let x = 0, left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    letters.forEach(letter => {
      const metrics = context.measureText(letter.character);
      const advance = metrics.width;
      if (letter.character !== ' ') {
        letter.inkLeft = x - metrics.actualBoundingBoxLeft;
        letter.inkRight = x + metrics.actualBoundingBoxRight;
        left = Math.min(left, x - metrics.actualBoundingBoxLeft);
        right = Math.max(right, x + metrics.actualBoundingBoxRight);
        top = Math.min(top, -metrics.actualBoundingBoxAscent);
        bottom = Math.max(bottom, metrics.actualBoundingBoxDescent);
      }
      letter.node.setAttribute('x', x);
      letter.node.setAttribute('y', 0);
      letter.center = x + advance / 2;
      x += advance;
    });
    // Include the actual flourishes and descenders in the edge-to-edge fit.
    const ink = {x:left, y:top, width:right-left, height:bottom-top};
    const connectStart = letters.findIndex(letter => letter.character === 'C');
    anchorLeft = letters[connectStart].center;
    anchorRight = letters[connectStart + 3].center;
    arcCenter = (anchorLeft + anchorRight) / 2;
    arcRadius = Math.max(arcCenter - left, right - arcCenter);
    svg.setAttribute('viewBox', `${ink.x} ${ink.y} ${ink.width} ${ink.height}`);
    svg.setAttribute('width', ink.width);
    svg.setAttribute('height', ink.height);
    ready = true;
    fit();
  });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', fit);
  reduced.addEventListener('change', schedule);
})();
