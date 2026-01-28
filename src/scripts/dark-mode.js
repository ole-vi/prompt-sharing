(function() {
  'use strict';

  // Constants
  const STORAGE_KEY = 'theme';
  const DARK_CLASS = 'dark';

  // Get stored theme
  const storedTheme = localStorage.getItem(STORAGE_KEY);

  // Check system preference
  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)');

  // Determine if dark mode should be active
  function shouldBeDark() {
    if (storedTheme === 'dark') return true;
    if (storedTheme === 'light') return false;
    return systemPreference.matches;
  }

  // Apply theme
  function applyTheme() {
    if (shouldBeDark()) {
      document.documentElement.classList.add(DARK_CLASS);
    } else {
      document.documentElement.classList.remove(DARK_CLASS);
    }
  }

  // Initial application
  applyTheme();

  // Listen for system changes
  systemPreference.addEventListener('change', applyTheme);

  // Listen for storage changes (cross-tab sync)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      applyTheme();
    }
  });

  // Expose toggle function globally (safe, not inline)
  window.toggleTheme = function() {
    const isDark = document.documentElement.classList.contains(DARK_CLASS);
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme();
  };
})();
