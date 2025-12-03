// ===== Version Checker Module =====
// Checks for version updates and alerts users when they need to refresh

import { APP_VERSION } from '../utils/constants.js';
import statusBar from './status-bar.js';

const VERSION_CHECK_KEY = 'lastVersionCheckTime';
const CHECK_INTERVAL = 1000 * 60 * 15; // Check every 15 minutes
const DISMISSED_VERSION_KEY = 'dismissedVersionUpdate';

let versionCheckTimer = null;

/**
 * Fetches the deployed version from GitHub Pages
 * @returns {Promise<string|null>} The version string or null if fetch fails
 */
async function fetchDeployedVersion() {
  try {
    // Fetch the constants.js file from the deployed GitHub Pages site
    // Add cache-busting parameter to avoid cached responses
    const response = await fetch(`https://ole-vi.github.io/prompt-sharing/src/utils/constants.js?t=${Date.now()}`);
    
    if (!response.ok) {
      console.warn('Could not fetch deployed version:', response.status);
      return null;
    }
    
    const text = await response.text();
    
    // Extract version using regex
    const versionMatch = text.match(/export const APP_VERSION = ["']([^"']+)["']/);
    
    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }
    
    console.warn('Could not parse version from deployed file');
    return null;
  } catch (error) {
    console.warn('Error fetching deployed version:', error);
    return null;
  }
}

/**
 * Compares two version strings (semantic versioning)
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
}

/**
 * Shows an alert banner to the user about a version update
 * @param {string} newVersion - The new version available
 */
function showUpdateAlert(newVersion) {
  // Check if user dismissed this version already
  const dismissed = sessionStorage.getItem(DISMISSED_VERSION_KEY);
  if (dismissed === newVersion) {
    return;
  }
  
  const banner = document.createElement('div');
  banner.id = 'versionUpdateBanner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-size: 14px;
  `;
  
  banner.innerHTML = `
    <span style="flex: 1; text-align: center;">
      🎉 <strong>New version available!</strong> 
      You're on v${APP_VERSION}, but v${newVersion} is now deployed. 
      Please refresh to get the latest features and fixes.
    </span>
    <button id="refreshBtn" style="
      background: white;
      color: #667eea;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    ">Refresh Now</button>
    <button id="dismissBtn" style="
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.5);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    ">Dismiss</button>
  `;
  
  document.body.prepend(banner);
  
  // Adjust body padding to account for banner
  document.body.style.paddingTop = banner.offsetHeight + 'px';
  
  // Add event listeners
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    // Hard refresh to clear cache
    window.location.reload(true);
  });
  
  document.getElementById('dismissBtn')?.addEventListener('click', () => {
    // Store dismissed version in session storage
    sessionStorage.setItem(DISMISSED_VERSION_KEY, newVersion);
    banner.remove();
    document.body.style.paddingTop = '0';
  });
}

/**
 * Performs the version check
 */
async function checkVersion() {
  const now = Date.now();
  const lastCheck = sessionStorage.getItem(VERSION_CHECK_KEY);
  
  // Skip check if we checked recently
  if (lastCheck && (now - parseInt(lastCheck)) < CHECK_INTERVAL) {
    return;
  }
  
  // Update last check time
  sessionStorage.setItem(VERSION_CHECK_KEY, now.toString());
  
  const deployedVersion = await fetchDeployedVersion();
  
  if (!deployedVersion) {
    return; // Couldn't fetch version, silently skip
  }
  
  // Compare versions
  const comparison = compareVersions(APP_VERSION, deployedVersion);
  
  if (comparison < 0) {
    // Local version is older than deployed version
    console.log(`Version update available: ${APP_VERSION} -> ${deployedVersion}`);
    showUpdateAlert(deployedVersion);
    statusBar.show(`New version ${deployedVersion} available! Click to refresh.`, 'warning', () => {
      window.location.reload(true);
    });
  } else if (comparison > 0) {
    // Local version is newer (likely on a dev branch)
    console.log(`Running dev version: ${APP_VERSION} (deployed: ${deployedVersion})`);
  } else {
    console.log(`Running latest version: ${APP_VERSION}`);
  }
}

/**
 * Initializes the version checker
 */
export function initVersionChecker() {
  // Update the version display in the UI
  const versionElement = document.getElementById('appVersion');
  if (versionElement) {
    versionElement.textContent = `v${APP_VERSION}`;
  }
  
  // Do initial check after a short delay to not block app startup
  setTimeout(() => {
    checkVersion();
  }, 3000);
  
  // Set up periodic checks
  versionCheckTimer = setInterval(() => {
    checkVersion();
  }, CHECK_INTERVAL);
}

/**
 * Stops the version checker
 */
export function stopVersionChecker() {
  if (versionCheckTimer) {
    clearInterval(versionCheckTimer);
    versionCheckTimer = null;
  }
}

/**
 * Manually trigger a version check
 */
export function forceVersionCheck() {
  sessionStorage.removeItem(VERSION_CHECK_KEY);
  return checkVersion();
}
