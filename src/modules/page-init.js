// Shared page initialization
import { loadHeader } from './header.js';

export async function initializePage(activePage, callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadHeader();
      // Set active nav item
      if (activePage) {
        const navItem = document.querySelector(`.nav-item[data-page="${activePage}"]`);
        if (navItem) {
          navItem.classList.add('active');
        }
      }
      callback();
    });
  } else {
    (async () => {
      await loadHeader();
      // Set active nav item
      if (activePage) {
        const navItem = document.querySelector(`.nav-item[data-page="${activePage}"]`);
        if (navItem) {
          navItem.classList.add('active');
        }
      }
      callback();
    })();
  }
}
