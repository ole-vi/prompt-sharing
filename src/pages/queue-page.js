/**
 * Queue Page Initialization
 * Handles Jules queue page functionality
 */

import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { attachQueueHandlers, listJulesQueue, renderQueueListDirectly } from '../modules/jules-queue.js';
import { loadSubtaskErrorModal } from '../modules/jules-modal.js';
import { TIMEOUTS } from '../utils/constants.js';

// Initialize checkbox mutual exclusivity
initMutualExclusivity();

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
    listDiv.innerHTML = '<div class="panel text-center pad-xl muted-text">Please sign in to view your queue.</div>';
    return;
  }

  try {
    listDiv.innerHTML = '<div class="panel text-center pad-xl muted-text">Loading queue...</div>';

    const items = await listJulesQueue(user.uid);
    renderQueueListDirectly(items);
    attachQueueHandlers();
  } catch (err) {
    console.error('Queue loading error:', err);
    listDiv.innerHTML = `<div class="panel text-center pad-xl">Failed to load queue: ${err.message}</div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
