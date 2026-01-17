import { logger } from '../utils/logger.js';

export async function loadNavbar(activePage) {
  try {
    const response = await fetch('./navbar.html');
    const navbarHtml = await response.text();
    
    // Find the header element and insert navbar after it
    const header = document.querySelector('header');
    if (header) {
      header.insertAdjacentHTML('afterend', navbarHtml);
      
      // Set active page
      if (activePage) {
        const navItem = document.querySelector(`.nav-item[data-page="${activePage}"]`);
        if (navItem) {
          navItem.classList.add('active');
        }
      }
    }
  } catch (error) {
    logger.error('Failed to load navbar:', error);
  }
}
