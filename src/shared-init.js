// ===== Shared Header Initialization =====
// This script automatically loads header on all pages

import { loadHeader } from './modules/header.js';
import { initAuthStateListener } from './modules/auth.js';
import { initBranchSelector, loadBranches, loadBranchFromStorage } from './modules/branch-selector.js';
import { OWNER, REPO, BRANCH, ERRORS } from './utils/constants.js';
import { parseParams } from './utils/url-params.js';
import statusBar from './modules/status-bar.js';
import { getFirebaseReady } from './firebase-init.js';
import { waitForDOMReady } from './utils/dom-helpers.js';
import { fetchVersion } from './modules/version-check.js';

let isInitialized = false;

async function waitForFirebase() {
  try {
    await getFirebaseReady();
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    statusBar.showMessage(ERRORS.FIREBASE_NOT_READY, 'error');
    throw error;
  }
}

async function initializeSharedComponents(activePage) {
  if (isInitialized) {
    return;
  }
  
  isInitialized = true;

  try {
    await loadHeader();
    
    // Set active nav item
    if (activePage) {
      const navItem = document.querySelector(`.nav-item[data-page="${activePage}"]`);
      if (navItem) {
        navItem.classList.add('active');
      }
    }

    try {
      await waitForFirebase();
    } catch (e) {
      // Error already handled in waitForFirebase with status bar message
      console.error('Firebase initialization failed, skipping auth-dependent initialization');
      return;
    }

    await initAuthStateListener();

    const params = parseParams();
    const currentOwner = params.owner || OWNER;
    const currentRepo = params.repo || REPO;
    const currentBranch = params.branch || loadBranchFromStorage(currentOwner, currentRepo) || BRANCH;

    initBranchSelector(currentOwner, currentRepo, currentBranch);

    loadBranches().catch(error => {
      console.error('Failed to load branches:', error);
    });

    const repoPill = document.getElementById('repoPill');
    if (repoPill) {
      repoPill.innerHTML = `<strong>${currentOwner}/${currentRepo}</strong>`;
    }

    fetchVersion();

    const statusBarElement = document.getElementById('statusBar');
    if (statusBarElement) {
      statusBar.init();
    }

  } catch (error) {
    isInitialized = false; // Reset so it can be tried again
  }
}

waitForDOMReady(() => {
  const activePage = document.body.getAttribute('data-page') || 'home';
  initializeSharedComponents(activePage);
});

export { initializeSharedComponents, waitForFirebase };