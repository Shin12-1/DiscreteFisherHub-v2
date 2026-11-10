(() => {
  let theme = 'light';
  try {
    const savedState = JSON.parse(localStorage.getItem('dfh:learner-state') || 'null');
    if (savedState?.theme === 'dark') theme = 'dark';
  } catch (error) {
    console.warn('Could not read the saved theme before rendering.', error);
  }
  document.documentElement.dataset.theme = theme;
})();
