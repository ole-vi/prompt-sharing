/**
 * Queue Page Initialization
 * Handles Jules queue page functionality
 */

import { setupMutualExclusivity } from '../utils/checkbox-helpers.js';
import { attachQueueHandlers } from '../modules/jules.js';

// Initialize checkbox mutual exclusivity
setupMutualExclusivity('queueSuppressPopupsCheckbox', 'queueOpenInBackgroundCheckbox');

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, 50);
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
    
    // Import the jules module to access queue functions
    const julesModule = await import('../modules/jules.js');
    
    // Get the queue items
    const items = await julesModule.listJulesQueue(user.uid);
    
    // Render the queue directly on the page
    julesModule.renderQueueListDirectly(items);
    julesModule.attachQueueHandlers();
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
