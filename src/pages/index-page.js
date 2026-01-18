/**
 * Index Page Initialization
 * Handles main page initialization and checkbox setup
 */

import { initApp } from '../app.js';
import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { TIMEOUTS } from '../utils/constants.js';

// Initialize all mutually exclusive checkboxes defined by data-exclusive-group attributes
initMutualExclusivity();

// Note: Subtask error modal is now loaded on-demand when needed
// Don't load it eagerly to avoid pulling in Jules modules on initial page load

// Wait for shared components to load, then initialize app
function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
