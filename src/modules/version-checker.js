// ===== Version Checker Module =====

import { APP_VERSION, DEPLOYMENT_BASE_URL } from '../utils/constants.js';
import statusBar from './status-bar.js';

const VERSION_CHECK_KEY = 'lastVersionCheckTime';
const CHECK_INTERVAL = 1000 * 60 * 60;
const DISMISSED_VERSION_KEY = 'dismissedVersionUpdate';

let versionCheckTimer = null;

async function fetchDeployedVersion() {
  try {
    const response = await fetch(`${DEPLOYMENT_BASE_URL}/src/utils/constants.js?t=${Date.now()}`);
    
    if (!response.ok) {
      console.warn('Could not fetch deployed version:', response.status);
      return null;
    }
    
    const text = await response.text();
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

function showUpdateAlert(newVersion) {
  const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
  if (dismissed === newVersion) {
    return;
  }
  
  const banner = document.createElement('div');
  banner.id = 'versionUpdateBanner';
  
  banner.innerHTML = `
    <span>
      🎉 <strong>New version available!</strong> 
      You're on v${APP_VERSION}, but v${newVersion} is now deployed. 
      Please refresh to get the latest features and fixes.
    </span>
    <button id="refreshBtn">Refresh Now</button>
    <button id="dismissBtn">Dismiss</button>
  `;
  
  document.body.prepend(banner);
  document.body.style.paddingTop = banner.offsetHeight + 'px';
  
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    window.location.reload();
  });
  
  document.getElementById('dismissBtn')?.addEventListener('click', () => {
    localStorage.setItem(DISMISSED_VERSION_KEY, newVersion);
    banner.remove();
    document.body.style.paddingTop = '0';
  });
}

async function checkVersion() {
  const now = Date.now();
  const lastCheck = localStorage.getItem(VERSION_CHECK_KEY);
  
  if (lastCheck && (now - parseInt(lastCheck)) < CHECK_INTERVAL) {
    return;
  }
  
  localStorage.setItem(VERSION_CHECK_KEY, now.toString());
  
  const deployedVersion = await fetchDeployedVersion();
  
  if (!deployedVersion) {
    return;
  }
  
  const comparison = compareVersions(APP_VERSION, deployedVersion);
  
  if (comparison < 0) {
    console.log(`Version update available: ${APP_VERSION} -> ${deployedVersion}`);
    showUpdateAlert(deployedVersion);
  } else if (comparison > 0) {
    console.log(`Running dev version: ${APP_VERSION} (deployed: ${deployedVersion})`);
  } else {
    console.log(`Running latest version: ${APP_VERSION}`);
  }
}

export function initVersionChecker() {
  const versionElement = document.getElementById('appVersion');
  if (versionElement) {
    versionElement.textContent = `v${APP_VERSION}`;
  }
  
  setTimeout(() => {
    checkVersion();
  }, 3000);
  
  versionCheckTimer = setInterval(() => {
    checkVersion();
  }, CHECK_INTERVAL);
}

export function stopVersionChecker() {
  if (versionCheckTimer) {
    clearInterval(versionCheckTimer);
    versionCheckTimer = null;
  }
}

export function forceVersionCheck() {
  sessionStorage.removeItem(VERSION_CHECK_KEY);
  return checkVersion();
}
