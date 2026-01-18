/**
 * Standardized page initialization helper.
 * Handles common startup tasks: DOM ready, waiting for shared components, and auth setup.
 */

import { waitForFirebase } from '../shared-init.js';
import { TIMEOUTS } from './constants.js';

/**
 * Initializes a page with standardized flow.
 * @param {Object} config - Initialization configuration
 * @param {Function} [config.onReady] - Called when DOM and shared components (Header) are ready.
 * @param {Function} [config.onAuth] - Called when authentication state changes. Receives (user) or (null).
 */
export function initializePage(config) {
  const { onReady, onAuth } = config;

  const runInit = () => {
    // Phase 1: DOM and Components Ready
    if (onReady) {
      try {
        onReady();
      } catch (error) {
        console.error('Error in page onReady:', error);
      }
    }

    // Phase 2: Authentication
    if (onAuth) {
      waitForFirebase(() => {
        if (!window.auth) {
          console.error('Auth object not found after waitForFirebase');
          return;
        }

        // Initial check and listener
        window.auth.onAuthStateChanged((user) => {
          try {
            onAuth(user);
          } catch (error) {
            console.error('Error in page onAuth:', error);
          }
        });
      });
    }
  };

  const waitForComponents = () => {
    if (document.querySelector('header')) {
      runInit();
    } else {
      setTimeout(waitForComponents, TIMEOUTS.componentCheck || 50);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForComponents);
  } else {
    waitForComponents();
  }
}
