/**
 * Page Initialization Helper
 * Centralizes logic for waiting for shared components
 */

import { TIMEOUTS, LIMITS } from '../utils/constants.js';

/**
 * Waits for shared components to be loaded (specifically the header)
 * and then executes the callback.
 *
 * @param {Function} callback - Function to execute once components are ready
 * @param {number} attempts - Current attempt count (internal use)
 */
export function waitForComponents(callback, attempts = 0) {
  if (document.querySelector('header')) {
    callback();
  } else if (attempts < LIMITS.componentMaxAttempts) {
    setTimeout(() => waitForComponents(callback, attempts + 1), TIMEOUTS.componentCheck);
  } else {
    console.error('Shared components failed to load after', attempts, 'attempts');
    // Proceed anyway to allow page to attempt rendering or show error states
    callback();
  }
}

/**
 * Standard page initialization entry point
 * @param {Function} initAppFn - The application initialization function for the page
 */
export function initPage(initAppFn) {
  const start = () => waitForComponents(initAppFn);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
