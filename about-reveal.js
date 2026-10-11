(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.querySelector('.landing-about');
  if (!root || reduced.matches) return;
  const entries = [];
  function createRevealObserver() {
    // Use viewport-height pixels: IntersectionObserver percentage margins use width.
    const inset = Math.round(innerHeight * 0.125);
    return new IntersectionObserver(records => {
    for (const record of records) {
      if (!record.isIntersecting) continue;
      for (const entry of entries.filter(item => item.trigger === record.target)) {
        measure(entry);
        if(entry.element.classList.contains('divider-reveal'))setDividerAnchors(entry.element);
        entry.element.classList.add('text-entered');
      }
    }
    }, { rootMargin: `-${inset}px 0px -${inset}px 0px`, threshold: 0 });
  }
  let observer = createRevealObserver();
  // Text that leaves through the top stays visible for the return scroll.
  // Reset only after it leaves through the bottom, ready for another downward entry.
  const exitObserver = new IntersectionObserver(records => {
    for (const record of records) {
      if (!record.isIntersecting) {
        const above = record.boundingClientRect.bottom <= 0;
        const below = record.boundingClientRect.top >= innerHeight;
        entries.filter(item => item.trigger === record.target).forEach(entry => {
          if (above) entry.element.classList.add('text-entered', 'text-instant');
          if (below && !entry.once) entry.element.classList.remove('text-entered', 'text-instant');
        });
      }
    }
  }, { threshold: 0 });

  function measure({element, pieces, typing}) {
    if (typing) return;
    let line = -1, previousTop = -Infinity;
    for (const piece of pieces) {
      const top = piece.getBoundingClientRect().top;
      if (Math.abs(top - previousTop) > 5) { line++; previousTop = top; }
      piece.style.setProperty('--reveal-delay', `${line * 130}ms`);
    }
  }

  function setDividerAnchors(article) {
    const articleBox = article.getBoundingClientRect();
    const textBounds = element => {
      const pieces = element ? element.querySelectorAll('text-piece,text-letter') : [];
      // Measure the laid-out text, not its full-width paragraph container.
      const boxes = Array.from(pieces, piece => {
        const range=document.createRange();
        range.selectNodeContents(piece);
        return Array.from(range.getClientRects());
      }).flat().filter(box => box.width > 0);
      if (!boxes.length) return element ? element.getBoundingClientRect() : null;
      return {
        left: Math.min(...boxes.map(box => box.left)),
        right: Math.max(...boxes.map(box => box.right))
      };
    };
    const heading = textBounds(article.querySelector('h3'));
    const copy = textBounds(article.querySelector('p'));
    // Keep the complete 4px marker within the divider, including near-full
    // wrapped lines on narrow screens. No extra padding beyond the text edge.
    const anchor=x=>`${Math.max(2,Math.min(articleBox.width-2,x-articleBox.left))}px`;
    if (heading) {
      article.style.setProperty('--divider-heading-start', anchor(heading.left));
      article.style.setProperty('--divider-heading-end', anchor(heading.right));
    }
    if (copy) {
      article.style.setProperty('--divider-copy-start', anchor(copy.left));
      article.style.setProperty('--divider-copy-end', anchor(copy.right));
    }
  }

  function prepare(element, typing, trigger = element, once = false) {
    if (typing) element.setAttribute('aria-label', element.textContent);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const pieces = [];
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      const tokens = typing ? Array.from(node.textContent) : node.textContent.split(/(\s+)/);
      for (const token of tokens) {
        if (!token) continue;
        if (/^\s+$/.test(token)) { fragment.append(document.createTextNode(token)); continue; }
        const piece = document.createElement(typing ? 'text-letter' : 'text-piece');
        piece.textContent = token;
        if (typing) {
          piece.setAttribute('aria-hidden', 'true');
          piece.style.setProperty('--reveal-delay', `${pieces.length * 38}ms`);
        }
        pieces.push(piece);
        fragment.append(piece);
      }
      node.replaceWith(fragment);
    }
    const entry = {element, pieces, typing, trigger, once};
    entries.push(entry);
    measure(entry);
    element.classList.add(typing ? 'type-reveal' : 'line-reveal');
    const bounds = trigger.getBoundingClientRect();
    if (!once && scrollY > 0 && bounds.top < innerHeight && bounds.bottom > 0) {
      element.classList.add('text-entered', 'text-instant');
    }
    observer.observe(trigger);
    exitObserver.observe(trigger);
  }

  document.fonts.ready.then(() => {
    if (reduced.matches) return;
    root.querySelectorAll('.about-introduction h2,.landing-about-copy p,.about-services p,.principles h2,.principles blockquote').forEach(el => prepare(el, false));
    root.querySelectorAll('.principle-card').forEach(card => {
      // Reveal the complete card; its heading and copy remain plain text.
      card.classList.add('card-reveal');
      entries.push({element:card,pieces:[],typing:false,trigger:card});
      const bounds=card.getBoundingClientRect();
      if(scrollY>0&&bounds.top<innerHeight&&bounds.bottom>0)card.classList.add('text-entered','text-instant');
      observer.observe(card);
      exitObserver.observe(card);
    });
    root.querySelectorAll('.about-services h3').forEach(el => prepare(el, true));
    root.querySelectorAll('.about-services article').forEach(article => {
      const number = article.querySelector(':scope > span');
      const paragraph = article.querySelector('p');
      if (number && paragraph) prepare(number, false, paragraph);
      if (paragraph) {
        article.classList.add('divider-reveal');
        setDividerAnchors(article);
        if (paragraph.classList.contains('text-instant')) article.classList.add('text-entered', 'text-instant');
        entries.push({element: article, pieces: [], typing: false, trigger: paragraph});
      }
    });
    if(typeof ResizeObserver!=='undefined'){
      const dividerObserver=new ResizeObserver(records=>records.forEach(record=>setDividerAnchors(record.target)));
      root.querySelectorAll('.about-services article').forEach(article=>dividerObserver.observe(article));
    }
    document.fonts.addEventListener('loadingdone',()=>root.querySelectorAll('.about-services article').forEach(setDividerAnchors));
  });
  let resizeFrame;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (reduced.matches) return;
      root.querySelectorAll('.about-services article').forEach(setDividerAnchors);
      entries.filter(e => !e.element.classList.contains('text-entered')).forEach(measure);
      observer.disconnect();
      observer = createRevealObserver();
      entries.forEach(e => observer.observe(e.trigger));
    });
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { observer.disconnect(); exitObserver.disconnect(); entries.forEach(e => e.element.classList.add('text-entered')); }
  });
})();
