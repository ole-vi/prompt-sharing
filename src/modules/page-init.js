// Shared page initialization
import { loadHeader } from './header.js';
import { loadNavbar } from './navbar.js';

export async function initializePage(activePage, callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      // Load header first, then navbar (sequential to avoid race condition)
      await loadHeader();
      await loadNavbar(activePage);
      callback();
    });
  } else {
    (async () => {
      // Load header first, then navbar (sequential to avoid race condition)
      await loadHeader();
      await loadNavbar(activePage);
      callback();
    })();
  }
}
