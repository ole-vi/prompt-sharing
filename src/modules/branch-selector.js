import { USER_BRANCHES, FEATURE_PATTERNS, STORAGE_KEYS } from '../utils/constants.js';
import { getBranches } from './github-api.js';

let branchSelect = null;
let currentBranch = null;
let currentOwner = null;
let currentRepo = null;

export function initBranchSelector(owner, repo, branch) {
  branchSelect = document.getElementById('branchSelect');
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;

  if (branchSelect) {
    branchSelect.addEventListener('change', handleBranchChange);
  }

  const webCapturesBtn = document.getElementById('webCapturesBtn');
  if (webCapturesBtn) {
    webCapturesBtn.addEventListener('click', () => {
      const targetBranch = 'web-captures';
      
      const qs = new URLSearchParams(location.search);
      qs.set('branch', targetBranch);
      const newUrl = `${location.pathname}?${qs.toString()}`;
      
      history.replaceState(null, '', newUrl);
      sessionStorage.clear();
      
      setCurrentBranch(targetBranch);
      window.dispatchEvent(new CustomEvent('branchChanged', { detail: { branch: targetBranch } }));
    });
  }
}

export function setCurrentBranch(branch) {
  currentBranch = branch;
  if (branchSelect) {
    branchSelect.value = branch;
  }
}

export function getCurrentBranch() {
  return currentBranch;
}

export function setCurrentRepo(owner, repo) {
  currentOwner = owner;
  currentRepo = repo;
}

function classifyBranch(branchName) {
  if (branchName === 'main' || branchName === 'master' || branchName === 'web-captures') {
    return 'main';
  }

  if (USER_BRANCHES.includes(branchName)) {
    return 'user';
  }

  if (
    branchName.startsWith('codex/') ||
    /^\d+-/.test(branchName) ||
    FEATURE_PATTERNS.some(p => branchName.includes(p)) ||
    (/^[a-zA-Z][a-zA-Z0-9]*$/.test(branchName) && branchName.length >= 15)
  ) {
    return 'feature';
  }

  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(branchName) && branchName.length < 15) {
    return 'user';
  }

  return 'feature';
}

function toggleFeatureBranches() {
  const showFeatures = localStorage.getItem('showFeatureBranches') === 'true';
  const newShowFeatures = !showFeatures;
  localStorage.setItem('showFeatureBranches', newShowFeatures.toString());
  loadBranches();
}

function toggleUserBranches() {
  const showUsers = localStorage.getItem('showUserBranches') !== 'false';
  const newShowUsers = !showUsers;
  localStorage.setItem('showUserBranches', newShowUsers.toString());
  loadBranches();
}

async function handleBranchChange(e) {
  if (!branchSelect) return;

  if (branchSelect.value === '__toggle_features__') {
    toggleFeatureBranches();
    return;
  }

  if (branchSelect.value === '__toggle_users__') {
    toggleUserBranches();
    return;
  }

  currentBranch = branchSelect.value;

  const qs = new URLSearchParams(location.search);
  qs.set('branch', currentBranch);
  const slugMatch = location.hash.match(/[#&?]p=([^&]+)/) || location.hash.match(/^#([^&]+)$/);
  const slug = slugMatch ? decodeURIComponent(slugMatch[1]) : null;

  const newUrl = `${location.pathname}?${qs.toString()}${slug ? '#p=' + encodeURIComponent(slug) : ''}`;
  history.replaceState(null, '', newUrl);

  sessionStorage.clear();
  window.dispatchEvent(new CustomEvent('branchChanged', { detail: { branch: currentBranch } }));
}

export async function loadBranches() {
  if (!branchSelect) return;

  branchSelect.disabled = true;
  branchSelect.innerHTML = `<option>Loading branches…</option>`;

  try {
    const branches = await getBranches(currentOwner, currentRepo);

    const mainBranches = [];
    const userBranchesArr = [];
    const featureBranches = [];

    for (const b of branches) {
      const category = classifyBranch(b.name);
      switch (category) {
        case 'main':
          mainBranches.push(b);
          break;
        case 'user':
          userBranchesArr.push(b);
          break;
        case 'feature':
          featureBranches.push(b);
          break;
      }
    }

    userBranchesArr.sort((a, b) => a.name.localeCompare(b.name));
    featureBranches.sort((a, b) => a.name.localeCompare(b.name));

    branchSelect.innerHTML = '';

    for (const b of mainBranches) {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      branchSelect.appendChild(opt);
    }

    // User branches
    if (userBranchesArr.length > 0) {
      const showUsers = localStorage.getItem('showUserBranches') !== 'false';
      const userGroup = document.createElement('optgroup');
      userGroup.label = `${showUsers ? '▼' : '▶'} User Branches (${userBranchesArr.length})`;

      if (showUsers) {
        for (const b of userBranchesArr) {
          const opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = `  ${b.name}`;
          userGroup.appendChild(opt);
        }
      }
      branchSelect.appendChild(userGroup);
    }

    if (featureBranches.length > 0) {
      const showFeatures = localStorage.getItem('showFeatureBranches') === 'true';
      const featureGroup = document.createElement('optgroup');
      featureGroup.label = `${showFeatures ? '▼' : '▶'} Feature Branches (${featureBranches.length})`;

      if (showFeatures) {
        for (const b of featureBranches) {
          const opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = `  ${b.name}`;
          featureGroup.appendChild(opt);
        }
      }
      branchSelect.appendChild(featureGroup);
    }

    if (![...branchSelect.options].some(o => o.value === currentBranch)) {
      const opt = document.createElement('option');
      opt.value = currentBranch;
      opt.textContent = `${currentBranch}`;
      branchSelect.appendChild(opt);
    }

    branchSelect.value = currentBranch;
    branchSelect.title = '';
  } catch (e) {
    branchSelect.innerHTML = `<option value="${currentBranch}">${currentBranch}</option>`;
    branchSelect.title = (e && e.message) ? e.message : 'Failed to load branches';
  } finally {
    branchSelect.disabled = false;
  }
}
