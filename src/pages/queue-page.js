/**
 * Queue Page Initialization
 * Handles Jules queue page functionality
 */

import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { attachQueueHandlers, listJulesQueue, renderQueueListDirectly } from '../modules/jules-queue.js';
import { loadSubtaskErrorModal } from '../modules/jules-modal.js';
import { TIMEOUTS } from '../utils/constants.js';
import { clearElement } from '../utils/dom-helpers.js';
import { createEmptyState, createErrorState } from '../utils/dom-builders.js';

// Initialize checkbox mutual exclusivity
initMutualExclusivity();

// Load the subtask error modal partial
loadSubtaskErrorModal();

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

function initApp() {
  // Initialize queue functionality
  attachQueueHandlers();
  
  const user = window.auth?.currentUser;
  if (user) {
    document.getElementById('queueControls').classList.remove('hidden');
    document.getElementById('queueNotSignedIn').classList.add('hidden');
    loadQueue();
  } else {
    document.getElementById('queueControls').classList.add('hidden');
    document.getElementById('queueNotSignedIn').classList.remove('hidden');
  }
  
  // Listen for auth state changes
  window.auth.onAuthStateChanged((user) => {
    if (user) {
      document.getElementById('queueControls').classList.remove('hidden');
      document.getElementById('queueNotSignedIn').classList.add('hidden');
      loadQueue();
    } else {
      document.getElementById('queueControls').classList.add('hidden');
      document.getElementById('queueNotSignedIn').classList.remove('hidden');
    }
  });
}

async function loadQueue() {
  const user = window.auth?.currentUser;
  const listDiv = document.getElementById('allQueueList');
  
  if (!listDiv) {
    console.error('Queue list element not found');
    return;
  }
  
  if (!user) {
    clearElement(listDiv);
    listDiv.appendChild(createEmptyState('Please sign in to view your queue.'));
    return;
  }

  try {
    clearElement(listDiv);
    listDiv.appendChild(createEmptyState('Loading queue...'));

    const items = await listJulesQueue(user.uid);
    renderQueueListDirectly(items);
    attachQueueHandlers();
  } catch (err) {
    console.error('Queue loading error:', err);
    clearElement(listDiv);
    listDiv.appendChild(createErrorState(`Failed to load queue: ${err.message}`));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
