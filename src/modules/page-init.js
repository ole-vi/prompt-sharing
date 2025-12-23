// Shared page initialization
import { loadHeader } from './header.js';
import { loadNavbar } from './navbar.js';

export async function initializePage(activePage, callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      // Load header and navbar in parallel
      await Promise.all([loadHeader(), loadNavbar(activePage)]);
      callback();
    });
  } else {
    (async () => {
      // Load header and navbar in parallel
      await Promise.all([loadHeader(), loadNavbar(activePage)]);
      callback();
    })();
  }
}
