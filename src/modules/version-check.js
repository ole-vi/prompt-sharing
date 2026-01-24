import { fetchJSON } from './github-api.js';
import { OWNER, REPO, BRANCH, CACHE_KEYS, CACHE_DURATIONS } from '../utils/constants.js';

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
    document.body.classList.remove('has-version-banner');
  });

  buttonContainer.appendChild(refreshButton);
  buttonContainer.appendChild(dismissButton);

  banner.appendChild(message);
  banner.appendChild(buttonContainer);

  document.body.insertBefore(banner, document.body.firstChild);

  document.body.classList.add('has-version-banner');
}

function processVersionData(latestData, appVersion) {
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
  }

  if (currentDate < latestDate) {
    appVersion.textContent = `v${currentDateStr} (${currentSha})`;
    appVersion.classList.add('version-badge', 'status-outdated');
  } else {
    appVersion.textContent = `v${latestDateStr} (${latestSha})`;
    appVersion.classList.add('version-badge');
    appVersion.classList.remove('status-outdated');
  }

  const dismissed = localStorage.getItem(`dismissed-version-${latestSha}`);
  if (dismissed) {
    return;
  }
  if (currentDate < latestDate) {
    showUpdateBanner(latestDateStr, latestSha);
  }
}

export async function fetchVersion() {
  const appVersion = document.getElementById('appVersion');
  if (!appVersion) {
    return;
  }

  // Check cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEYS.VERSION_INFO);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Check if cache is fresh (less than 15 minutes old)
      if (Date.now() - timestamp < CACHE_DURATIONS.versionCheck) {
        processVersionData(data, appVersion);
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to parse version cache', e);
  }

  try {
    const latestData = await fetchJSON(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`);
    if (!latestData) {
      console.warn('Version check: GitHub API request failed (possibly rate limited)');
      if (appVersion) {
        appVersion.textContent = 'version check rate limited';
        appVersion.classList.add('version-badge');
      }
      return;
    }

    // Cache result
    try {
      sessionStorage.setItem(CACHE_KEYS.VERSION_INFO, JSON.stringify({
        data: latestData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Failed to cache version info', e);
    }

    processVersionData(latestData, appVersion);

  } catch (error) {
    if (appVersion) {
      appVersion.textContent = 'version unavailable';
    }
  }
}
