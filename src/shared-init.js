// ===== Shared Header and Navbar Initialization =====
// This script automatically loads header and navbar on all pages

import { loadHeader } from './modules/header.js';
import { loadNavbar } from './modules/navbar.js';
import { initAuthStateListener } from './modules/auth.js';
import { initBranchSelector, loadBranches } from './modules/branch-selector.js';
import { OWNER, REPO, BRANCH } from './utils/constants.js';
import statusBar from './modules/status-bar.js';

let isInitialized = false;

function waitForFirebase(callback, attempts = 0, maxAttempts = 100) {
  if (window.firebaseReady) {
    callback();
  } else if (attempts < maxAttempts) {
    setTimeout(() => waitForFirebase(callback, attempts + 1, maxAttempts), 100);
  } else {
    console.error('Firebase failed to initialize after', maxAttempts, 'attempts');
    callback(); // Continue anyway
  }
}

async function fetchVersion() {
  const appVersion = document.getElementById('appVersion');
  if (!appVersion) return;
  
  try {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`);
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    const data = await response.json();
    const sha = data.sha.substring(0, 7);
    const date = new Date(data.commit.committer.date).toLocaleDateString('en-CA'); // YYYY-MM-DD
    appVersion.textContent = `v${date} (${sha})`;
  } catch (error) {
    console.error('Failed to fetch version:', error);
    appVersion.textContent = 'version unavailable';
  }
}

async function initializeSharedComponents(activePage) {
  if (isInitialized) {
    return;
  }
  
  isInitialized = true;

  try {
    // Load header first, then navbar (sequential to avoid race condition)
    await loadHeader();
    await loadNavbar(activePage);

    waitForFirebase(() => {
      // Initialize auth state listener
      initAuthStateListener();

      // Initialize branch selector
      initBranchSelector(OWNER, REPO, BRANCH);

      // Load branches
      loadBranches().catch(error => {
        console.error('Failed to load branches:', error);
      });

      // Update repo pill
      const repoPill = document.getElementById('repoPill');
      if (repoPill) {
        repoPill.innerHTML = `<strong>${OWNER}/${REPO}</strong>`;
      }

      // Fetch version
      fetchVersion();

      // Initialize status bar if it exists
      const statusBarElement = document.getElementById('statusBar');
      if (statusBarElement) {
        statusBar.init();
      }
    });

  } catch (error) {
    console.error('Failed to initialize shared components:', error);
    isInitialized = false; // Reset so it can be tried again
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const activePage = document.body.getAttribute('data-page') || 'home';
    initializeSharedComponents(activePage);
  });
} else {
  const activePage = document.body.getAttribute('data-page') || 'home';
  initializeSharedComponents(activePage);
}

// Export for manual initialization if needed
export { initializeSharedComponents, waitForFirebase };