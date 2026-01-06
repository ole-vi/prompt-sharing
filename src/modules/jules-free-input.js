// ===== Jules Free Input Module =====
// Drives the "free input" UI on the home page.

import { getCurrentUser } from './auth.js';
import { checkJulesKey } from './jules-keys.js';
import { showJulesKeyModal } from './jules-modal.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';

let lastSelectedSourceId = 'sources/github/open-learning-exchange/myplanet';
let lastSelectedBranch = 'master';

export async function handleFreeInputAfterAuth() {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return;
  }

  try {
    const hasKey = await checkJulesKey(user.uid);

    if (!hasKey) {
      showJulesKeyModal(() => {
        showFreeInputForm();
      });
    } else {
      showFreeInputForm();
    }
  } catch (error) {
    alert('An error occurred. Please try again.');
  }
}

export function showFreeInputForm() {
  const freeInputSection = document.getElementById('freeInputSection');
  const empty = document.getElementById('empty');
  const title = document.getElementById('title');
  const meta = document.getElementById('meta');
  const actions = document.getElementById('actions');
  const content = document.getElementById('content');

  if (!freeInputSection || !empty) return;

  empty.classList.add('hidden');
  if (title) title.style.display = 'none';
  if (meta) meta.style.display = 'none';
  if (actions) actions.style.display = 'none';
  if (content) content.style.display = 'none';

  freeInputSection.classList.remove('hidden');

  const textarea = document.getElementById('freeInputTextarea');
  if (!textarea) return;

  textarea.value = '';

  populateFreeInputRepoSelection();
  textarea.focus();
}

export function hideFreeInputForm() {
  const freeInputSection = document.getElementById('freeInputSection');
  const empty = document.getElementById('empty');

  if (freeInputSection) freeInputSection.classList.add('hidden');
  if (empty) empty.classList.remove('hidden');
}

async function populateFreeInputRepoSelection() {
  lastSelectedSourceId = null;
  lastSelectedBranch = null;

  const repoDropdownText = document.getElementById('freeInputRepoDropdownText');
  const repoDropdownBtn = document.getElementById('freeInputRepoDropdownBtn');
  const repoDropdownMenu = document.getElementById('freeInputRepoDropdownMenu');
  const branchDropdownBtn = document.getElementById('freeInputBranchDropdownBtn');
  const branchDropdownText = document.getElementById('freeInputBranchDropdownText');
  const branchDropdownMenu = document.getElementById('freeInputBranchDropdownMenu');

  if (
    !repoDropdownText ||
    !repoDropdownBtn ||
    !repoDropdownMenu ||
    !branchDropdownBtn ||
    !branchDropdownText ||
    !branchDropdownMenu
  ) {
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    repoDropdownText.textContent = 'Please sign in first';
    repoDropdownBtn.disabled = true;
    return;
  }

  const branchSelector = new BranchSelector({
    dropdownBtn: branchDropdownBtn,
    dropdownText: branchDropdownText,
    dropdownMenu: branchDropdownMenu,
    onSelect: (branch) => {
      lastSelectedBranch = branch;
    }
  });

  const repoSelector = new RepoSelector({
    favoriteContainer: null,
    dropdownBtn: repoDropdownBtn,
    dropdownText: repoDropdownText,
    dropdownMenu: repoDropdownMenu,
    branchSelector: branchSelector,
    onSelect: (sourceId, branch) => {
      lastSelectedSourceId = sourceId;
      lastSelectedBranch = branch;
      branchSelector.initialize(sourceId, branch);
    }
  });

  await repoSelector.initialize();
  branchSelector.initialize(null, null);
}
