(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => document.documentElement.classList.toggle('reduce-motion', preference.matches);
  apply();
  preference.addEventListener('change', apply);
})();
