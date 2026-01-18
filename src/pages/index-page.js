/**
 * Index Page Initialization
 * Handles main page initialization and checkbox setup
 */

import { initApp } from '../app.js';
import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { loadSubtaskErrorModal } from '../modules/jules-modal.js';
import { initializePage } from '../utils/page-init-helper.js';

// Initialize all mutually exclusive checkboxes defined by data-exclusive-group attributes
initMutualExclusivity();

// Load the subtask error modal partial
loadSubtaskErrorModal();

initializePage({
  onReady: initApp
});
