/* Starts the principle icon animations only while each icon is on screen.
   The cards' cursor motion lives in card-magnet.js. */
(() => {
  const iconObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-icon-visible', entry.isIntersecting));
  });
  document.querySelectorAll('.principle-icon--network,.principle-icon--checkpoints').forEach(icon => iconObserver.observe(icon));
})();
