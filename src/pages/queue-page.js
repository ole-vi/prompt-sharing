/**
 * Queue Page Initialization
 * Handles Jules queue page functionality
 */

import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { attachQueueHandlers, listJulesQueue, renderQueueListDirectly } from '../modules/jules-queue.js';
import { loadSubtaskErrorModal } from '../modules/jules-modal.js';
import { initializePage } from '../utils/page-init-helper.js';

// Initialize checkbox mutual exclusivity
initMutualExclusivity();

// Load the subtask error modal partial
loadSubtaskErrorModal();

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

initializePage({
  onReady: () => {
    attachQueueHandlers();
  },
  onAuth: (user) => {
    if (user) {
      document.getElementById('queueControls').classList.remove('hidden');
      document.getElementById('queueNotSignedIn').classList.add('hidden');
      loadQueue();
    } else {
      document.getElementById('queueControls').classList.add('hidden');
      document.getElementById('queueNotSignedIn').classList.remove('hidden');
    }
  }
});
