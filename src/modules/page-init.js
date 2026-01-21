// Shared page initialization
import { loadHeader } from './header.js';
import { waitForDOMReady } from '../utils/dom-helpers.js';

export async function initializePage(activePage, callback) {
  waitForDOMReady(async () => {
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
}
