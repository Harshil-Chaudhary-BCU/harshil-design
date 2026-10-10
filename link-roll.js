(() => {
  const targets = document.querySelectorAll('.index-nav a, .connect-email, .connect-socials li');
  targets.forEach(target => {
    target.classList.add('roll-target');
    const label = target.matches('.connect-socials li') ? target.lastElementChild : target;
    const nodes = [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    nodes.forEach(node => {
      const text = node.textContent;
      const wrapper = document.createElement('roll-text');
      wrapper.setAttribute('aria-label', text.trim());
      [...text].forEach((character, index) => {
        const slot = document.createElement('roll-char');
        slot.setAttribute('aria-hidden', 'true');
        slot.style.setProperty('--roll-delay', `${Math.min(index * 18, 270)}ms`);
        const face = document.createElement('roll-face');
        face.textContent = character === ' ' ? '\u00a0' : character;
        face.dataset.copy = face.textContent;
        slot.append(face);
        wrapper.append(slot);
      });
      node.replaceWith(wrapper);
    });
  });
})();
