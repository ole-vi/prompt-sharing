/**
 * Queue Page Initialization
 * Handles Jules queue page functionality
 */

import { initMutualExclusivity } from '../utils/checkbox-helpers.js';
import { attachQueueHandlers, listJulesQueue, renderQueueListDirectly } from '../modules/jules-queue.js';
import { createElement, clearElement, waitForDOMReady, waitForHeader } from '../utils/dom-helpers.js';
import { handleError } from '../utils/error-handler.js';
import { getAuth } from '../modules/firebase-service.js';

// Initialize checkbox mutual exclusivity
initMutualExclusivity();

// Note: Subtask error modal loads on-demand when errors occur

function createEmptyStatePanel(message, isError = false) {
  const className = isError
    ? 'panel text-center pad-xl'
    : 'panel text-center pad-xl muted-text';
  return createElement('div', className, message);
}

function initApp() {
  // Initialize queue functionality
  attachQueueHandlers();
  
  const auth = getAuth();
  const user = auth?.currentUser;
  if (user) {
    document.getElementById('queueLoading').classList.remove('hidden');
    document.getElementById('queueControls').classList.add('hidden');
    document.getElementById('queueNotSignedIn').classList.add('hidden');
    loadQueue();
  } else {
    document.getElementById('queueLoading').classList.add('hidden');
    document.getElementById('queueControls').classList.add('hidden');
    document.getElementById('queueNotSignedIn').classList.remove('hidden');
  }
  
  // Listen for auth state changes
  auth.onAuthStateChanged((user) => {
    if (user) {
      document.getElementById('queueLoading').classList.remove('hidden');
      document.getElementById('queueControls').classList.add('hidden');
      document.getElementById('queueNotSignedIn').classList.add('hidden');
      loadQueue();
    } else {
      document.getElementById('queueLoading').classList.add('hidden');
      document.getElementById('queueControls').classList.add('hidden');
      document.getElementById('queueNotSignedIn').classList.remove('hidden');
    }
  });
}

async function loadQueue() {
  const auth = getAuth();
  const user = auth?.currentUser;
  const listDiv = document.getElementById('allQueueList');
  const loadingDiv = document.getElementById('queueLoading');
  const controlsDiv = document.getElementById('queueControls');
  
  if (!listDiv) {
    console.error('Queue list element not found');
    return;
  }
  
  if (!user) {
    loadingDiv.classList.add('hidden');
    controlsDiv.classList.add('hidden');
    return;
  }

  try {
    loadingDiv.classList.remove('hidden');
    controlsDiv.classList.add('hidden');
    clearElement(listDiv);

    const items = await listJulesQueue(user.uid);
    renderQueueListDirectly(items);
    attachQueueHandlers();
    
    loadingDiv.classList.add('hidden');
    controlsDiv.classList.remove('hidden');
  } catch (err) {
    const errorInfo = handleError(err, { source: 'loadQueue' }, { showDisplay: false });
    const msg = errorInfo.suggestion ? `${errorInfo.message} ${errorInfo.suggestion}` : errorInfo.message;

    loadingDiv.classList.add('hidden');
    clearElement(listDiv);
    listDiv.appendChild(createEmptyStatePanel(`Failed to load queue: ${msg}`, true));
    controlsDiv.classList.remove('hidden');
  }
}

waitForDOMReady(() => {
  waitForHeader(initApp);
});
