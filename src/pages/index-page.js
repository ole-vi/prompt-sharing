/**
 * Index Page Initialization
 * Handles main page initialization and checkbox setup
 */

import { initApp } from '../app.js';
import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { loadSubtaskErrorModal } from '../modules/jules-modal.js';
import { waitForComponents } from '../shared-init.js';

// Initialize all mutually exclusive checkboxes defined by data-exclusive-group attributes
initMutualExclusivity();

// Load the subtask error modal partial
loadSubtaskErrorModal();

// Wait for shared components to load, then initialize app
async function startApp() {
  await waitForComponents();
  initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
