/**
 * Index Page Initialization
 * Handles main page initialization and checkbox setup
 */

import { initApp } from '../app.js';
import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { loadSubtaskErrorModal } from '../modules/jules-modal.js';
import { initPage } from '../modules/page-init.js';

// Initialize all mutually exclusive checkboxes defined by data-exclusive-group attributes
initMutualExclusivity();

// Load the subtask error modal partial
loadSubtaskErrorModal();

initPage(initApp);
