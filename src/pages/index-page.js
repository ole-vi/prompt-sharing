/**
 * Index Page Initialization
 * Handles main page initialization and checkbox setup
 */

import { initApp } from '../app.js';
import { setupMutualExclusivity } from '../utils/checkbox-helpers.js';

// Initialize checkbox mutual exclusivity for Jules Environment Modal
setupMutualExclusivity('julesEnvSuppressPopupsCheckbox', 'julesEnvOpenInBackgroundCheckbox');

// Initialize checkbox mutual exclusivity for Free Input
setupMutualExclusivity('freeInputSuppressPopupsCheckbox', 'freeInputOpenInBackgroundCheckbox');

// Initialize checkbox mutual exclusivity for Subtask Split Modal
setupMutualExclusivity('splitSuppressPopupsCheckbox', 'splitOpenInBackgroundCheckbox');

// Wait for shared components to load, then initialize app
function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, 50);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
