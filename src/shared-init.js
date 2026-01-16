// ===== Shared Header and Navbar Initialization =====
// This script automatically loads header and navbar on all pages

import { loadHeader } from './modules/header.js';
import { initAuthStateListener } from './modules/auth.js';
import { initBranchSelector, loadBranches, loadBranchFromStorage } from './modules/branch-selector.js';
import { OWNER, REPO, BRANCH } from './utils/constants.js';
import { parseParams } from './utils/url-params.js';
import statusBar from './modules/status-bar.js';

let isInitialized = false;

function waitForFirebase(callback, attempts = 0, maxAttempts = 100) {
  if (window.firebaseReady) {
    callback();
  } else if (attempts < maxAttempts) {
    setTimeout(() => waitForFirebase(callback, attempts + 1, maxAttempts), 100);
  } else {
    console.error('Firebase failed to initialize after', maxAttempts, 'attempts');
    callback();
  }
}

function showUpdateBanner(latestDate, latestSha) {
  if (document.getElementById('updateBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.classList.add('update-banner');

  const message = document.createElement('span');
  message.textContent = `Update available: v${latestDate} (${latestSha})`;
  message.classList.add('update-banner__message');

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('update-banner__actions');

  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.classList.add('update-banner__button');
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });

  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.classList.add('update-banner__dismiss');
  dismissButton.addEventListener('click', () => {
    localStorage.setItem(`dismissed-version-${latestSha}`, 'true');
    banner.remove();
  });

  buttonContainer.appendChild(refreshButton);
  buttonContainer.appendChild(dismissButton);

  banner.appendChild(message);
  banner.appendChild(buttonContainer);

  document.body.insertBefore(banner, document.body.firstChild);

  document.body.style.paddingTop = '48px';
}

async function fetchVersion() {
  const appVersion = document.getElementById('appVersion');
  if (!appVersion) {
    return;
  }
  
  try {
    // Fetch the latest commit on the branch
    const latestResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`);
    if (!latestResponse.ok) {
      throw new Error(`GitHub API returned ${latestResponse.status}`);
    }
    const latestData = await latestResponse.json();
    const latestSha = latestData.sha.substring(0, 7);
    const latestDate = new Date(latestData.commit.committer.date);
    const latestDateStr = latestDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    const currentVersionMeta = document.querySelector('meta[name="app-version"]');
    let currentDate = latestDate;
    let currentSha = latestSha;
    let currentDateStr = latestDateStr;
    if (currentVersionMeta) {
      const versionContent = currentVersionMeta.content; // Format: "sha|date"
      const [metaSha, metaDate] = versionContent.split('|');
      if (metaSha && metaDate) {
        currentSha = metaSha;
        currentDate = new Date(metaDate);
        currentDateStr = new Date(metaDate).toLocaleDateString('en-CA');
      }
    } else {
    }

    if (currentDate < latestDate) {
      appVersion.textContent = `v${currentDateStr} (${currentSha})`;
      appVersion.style.background = '';
      appVersion.style.borderRadius = '';
      appVersion.style.padding = '';
      appVersion.style.fontWeight = 'bold';
      appVersion.style.color = '#ffe066'; // yellow text
    } else {
      appVersion.textContent = `v${latestDateStr} (${latestSha})`;
      appVersion.style.background = '';
      appVersion.style.color = '';
      appVersion.style.borderRadius = '';
      appVersion.style.padding = '';
    }
    
    const dismissed = localStorage.getItem(`dismissed-version-${latestSha}`);
    if (dismissed) {
      return;
    }
    if (currentDate < latestDate) {
      showUpdateBanner(latestDateStr, latestSha);
    } else {
    }
    
  } catch (error) {
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
    await loadHeader();
    
    // Set active nav item
    if (activePage) {
      const navItem = document.querySelector(`.nav-item[data-page="${activePage}"]`);
      if (navItem) {
        navItem.classList.add('active');
      }
    }

    waitForFirebase(() => {
      initAuthStateListener();

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
    });

  } catch (error) {
    isInitialized = false; // Reset so it can be tried again
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const activePage = document.body.getAttribute('data-page') || 'home';
    initializeSharedComponents(activePage);
  });
} else {
  const activePage = document.body.getAttribute('data-page') || 'home';
  initializeSharedComponents(activePage);
}

export { initializeSharedComponents, waitForFirebase };