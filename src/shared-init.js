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

function showUpdateBanner(latestDate, latestSha) {
  // Check if banner already exists
  if (document.getElementById('updateBanner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: linear-gradient(90deg, #a259f7 0%, #7c3aed 100%);
    color: var(--text);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-size: 14px;
    border-bottom: 1px solid var(--border);
  `;
  
  const message = document.createElement('span');
  message.textContent = `Update available: v${latestDate} (${latestSha})`;
  message.style.flex = '1';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.style.cssText = `
    background-color: white;
    color: #0969DA;
    border: none;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  `;
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });
  
  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.style.cssText = `
    background: transparent;
    color: white;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 0 8px;
    margin-left: 8px;
  `;
  dismissButton.addEventListener('click', () => {
    localStorage.setItem(`dismissed-version-${latestSha}`, 'true');
    banner.remove();
  });
  
  buttonContainer.appendChild(refreshButton);
  buttonContainer.appendChild(dismissButton);
  
  banner.appendChild(message);
  banner.appendChild(buttonContainer);
  
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Add padding to body to account for fixed banner
  document.body.style.paddingTop = '48px';
}

async function fetchVersion() {
  const appVersion = document.getElementById('appVersion');
  if (!appVersion) {
    console.warn('appVersion element not found');
    return;
  }
  
  try {
    console.log('Fetching version from GitHub API...');
    // Fetch the latest commit on the branch
    const latestResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`);
    if (!latestResponse.ok) {
      throw new Error(`GitHub API returned ${latestResponse.status}`);
    }
    const latestData = await latestResponse.json();
    const latestSha = latestData.sha.substring(0, 7);
    const latestDate = new Date(latestData.commit.committer.date);
    const latestDateStr = latestDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    console.log('Latest version:', latestDateStr, latestSha);
    
    // Display the latest version in the footer (default style)
    appVersion.textContent = `v${latestDateStr} (${latestSha})`;
    appVersion.style.background = '';
    appVersion.style.color = '';
    appVersion.style.borderRadius = '';
    appVersion.style.padding = '';
    
    // Get the current deployed version from meta tag or use latest as fallback
    const currentVersionMeta = document.querySelector('meta[name="app-version"]');
    let currentSha = latestSha;
    let currentDate = latestDate;
    
    if (currentVersionMeta) {
      const versionContent = currentVersionMeta.content; // Format: "sha|date"
      const [metaSha, metaDate] = versionContent.split('|');
      if (metaSha && metaDate) {
        currentSha = metaSha;
        currentDate = new Date(metaDate);
        console.log('Current deployed version:', metaDate, metaSha);
      }
    } else {
      console.log('No meta tag found, assuming latest version is deployed');
    }
    
    // Check if this version was already dismissed
    const dismissed = localStorage.getItem(`dismissed-version-${latestSha}`);
    if (dismissed) {
      console.log('Update banner dismissed for this version');
      return;
    }
    
    // Compare dates: if current is older than latest, show update banner and highlight version
    if (currentDate < latestDate) {
      console.log('Current version is stale, showing update banner');
      showUpdateBanner(latestDateStr, latestSha);
      // Highlight the version text in yellow for out-of-date (text only)
      appVersion.style.background = '';
      appVersion.style.borderRadius = '';
      appVersion.style.padding = '';
      appVersion.style.fontWeight = 'bold';
      appVersion.style.color = '#ffe066'; // yellow text
    } else {
      console.log('Current version is up to date');
    }
    
  } catch (error) {
    console.error('Failed to fetch version:', error);
    if (appVersion) {
      appVersion.textContent = 'version unavailable';
    }
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