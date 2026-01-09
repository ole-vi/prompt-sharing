// ===== Jules Modal Module =====
// Core modal UI functions (key modal, env modal, error modal)

import { openModal, closeModal } from './modal-manager.js';
import { encryptAndStoreKey } from './jules-keys.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { addToJulesQueue } from './jules-queue.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import { RETRY_CONFIG, TIMEOUTS } from '../utils/constants.js';

let lastSelectedSourceId = 'sources/github/open-learning-exchange/myplanet';
let lastSelectedBranch = 'master';

export function openUrlInBackground(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  
  const evt = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    metaKey: true
  });
  
  a.dispatchEvent(evt);
  
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
}

export function showJulesKeyModal(onSave) {
  const input = document.getElementById('julesKeyInput');
  
  openModal('julesKeyModal');
  input.value = '';
  input.focus();

  const saveBtn = document.getElementById('julesSaveBtn');
  const cancelBtn = document.getElementById('julesCancelBtn');

  const handleSave = async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      alert('Please enter your Jules API key.');
      return;
    }

    try {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const user = window.auth ? window.auth.currentUser : null;
      if (!user) {
        alert('Not logged in.');
        saveBtn.textContent = 'Save & Continue';
        saveBtn.disabled = false;
        return;
      }

      await encryptAndStoreKey(apiKey, user.uid);

      hideJulesKeyModal();
      saveBtn.textContent = 'Save & Continue';
      saveBtn.disabled = false;

      if (onSave) onSave();
    } catch (error) {
      alert('Failed to save API key: ' + error.message);
      saveBtn.textContent = 'Save & Continue';
      saveBtn.disabled = false;
    }
  };

  const handleCancel = () => {
    hideJulesKeyModal();
  };

  saveBtn.onclick = handleSave;
  cancelBtn.onclick = handleCancel;
}

export function hideJulesKeyModal() {
  closeModal('julesKeyModal');
}

export async function showJulesEnvModal(promptText) {
  openModal('julesEnvModal');

  const submitBtn = document.getElementById('julesEnvSubmitBtn');
  const queueBtn = document.getElementById('julesEnvQueueBtn');
  const cancelBtn = document.getElementById('julesEnvCancelBtn');
  
  // Initialize buttons
  submitBtn.disabled = true;
  queueBtn.disabled = true;
  
  let selectedSourceId = null;
  let selectedBranch = null;

  // Initialize BranchSelector first
  const branchSelector = new BranchSelector({
    dropdownBtn: document.getElementById('julesBranchDropdownBtn'),
    dropdownText: document.getElementById('julesBranchDropdownText'),
    dropdownMenu: document.getElementById('julesBranchDropdownMenu'),
    onSelect: (branch) => {
      selectedBranch = branch;
    }
  });

  // Initialize RepoSelector with branchSelector reference
  const repoSelector = new RepoSelector({
    dropdownBtn: document.getElementById('julesRepoDropdownBtn'),
    dropdownText: document.getElementById('julesRepoDropdownText'),
    dropdownMenu: document.getElementById('julesRepoDropdownMenu'),
    branchSelector: branchSelector,
    onSelect: (sourceId, branch, repoName) => {
      selectedSourceId = sourceId;
      selectedBranch = branch;
      submitBtn.disabled = false;
      queueBtn.disabled = false;
      branchSelector.initialize(sourceId, branch);
    }
  });

  // Load favorites and populate dropdown
  await repoSelector.initialize();
  branchSelector.initialize(null, null);

  submitBtn.onclick = () => {
    if (selectedSourceId && selectedBranch) {
      const suppressPopups = document.getElementById('julesEnvSuppressPopupsCheckbox')?.checked || false;
      const openInBackground = document.getElementById('julesEnvOpenInBackgroundCheckbox')?.checked || false;
      handleRepoSelect(selectedSourceId, selectedBranch, promptText, suppressPopups, openInBackground);
    }
  };
  
  queueBtn.onclick = async () => {
    if (!selectedSourceId || !selectedBranch) return;
    
    const user = window.auth?.currentUser;
    if (!user) {
      alert('Please sign in to queue prompts.');
      return;
    }
    
    try {
      await addToJulesQueue(user.uid, {
        type: 'single',
        prompt: promptText,
        sourceId: selectedSourceId,
        branch: selectedBranch,
        note: 'Queued from Try in Jules modal'
      });
      alert('Prompt queued successfully!');
      hideJulesEnvModal();
    } catch (err) {
      alert('Failed to queue prompt: ' + err.message);
    }
  };
  
  cancelBtn.onclick = () => {
    hideJulesEnvModal();
  };
}

async function handleRepoSelect(sourceId, branch, promptText, suppressPopups = false, openInBackground = false) {
  hideJulesEnvModal();
  
  lastSelectedSourceId = sourceId;
  lastSelectedBranch = branch || 'master';
  
  let retryCount = 0;
  let submitted = false;

  const { callRunJulesFunction } = await import('./jules-api.js');
  const title = extractTitleFromPrompt(promptText);
  
  while (retryCount < RETRY_CONFIG.maxRetries && !submitted) {
    try {
      const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch, title);
      if (sessionUrl && !suppressPopups) {
        if (openInBackground) {
          openUrlInBackground(sessionUrl);
        } else {
          window.open(sessionUrl, '_blank', 'noopener,noreferrer');
        }
      }
      submitted = true;
    } catch (error) {
      retryCount++;

      if (retryCount < RETRY_CONFIG.maxRetries) {
        const result = await showSubtaskErrorModal(1, 1, error);

        if (result.action === 'cancel') {
          return;
        } else if (result.action === 'skip') {
          return;
        } else if (result.action === 'queue') {
          const user = window.auth?.currentUser;
          if (!user) {
            alert('Please sign in to queue prompts.');
            return;
          }
          try {
            await addToJulesQueue(user.uid, {
              type: 'single',
              prompt: promptText,
              sourceId: sourceId,
              branch: lastSelectedBranch,
              note: 'Queued from Try in Jules flow (partial retries)'
            });
            alert('Prompt queued. You can restart it later from your Jules queue.');
          } catch (err) {
            alert('Failed to queue prompt: ' + err.message);
          }
          return;
        } else if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, TIMEOUTS.fetch));
          }
        }
      } else {
        const result = await showSubtaskErrorModal(1, 1, error);

        if (result.action === 'queue') {
          const user = window.auth?.currentUser;
          if (!user) {
            alert('Please sign in to queue prompts.');
            return;
          }
          try {
            await addToJulesQueue(user.uid, {
              type: 'single',
              prompt: promptText,
              sourceId: sourceId,
              branch: lastSelectedBranch,
              note: 'Queued from Try in Jules flow (final failure)'
            });
            alert('Prompt queued. You can restart it later from your Jules queue.');
          } catch (err) {
            alert('Failed to queue prompt: ' + err.message);
          }
          return;
        }
        
        if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, TIMEOUTS.fetch));
          }
          try {
            const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch, title);
            if (sessionUrl) {
              window.open(sessionUrl, '_blank', 'noopener,noreferrer');
            }
          } catch (finalError) {
            alert('Failed to submit task after multiple retries. Please try again later.');
          }
        }
        return;
      }
    }

    if (!submitted) {
      await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.baseDelay));
    }
  }
}

export function hideJulesEnvModal() {
  closeModal('julesEnvModal');
}

export function showSubtaskErrorModal(subtaskNumber, totalSubtasks, error) {
  return new Promise((resolve) => {
    const modal = document.getElementById('subtaskErrorModal');
    const subtaskNumDiv = document.getElementById('errorSubtaskNumber');
    const messageDiv = document.getElementById('errorMessage');
    const detailsDiv = document.getElementById('errorDetails');
    const retryBtn = document.getElementById('subtaskErrorRetryBtn');
    const skipBtn = document.getElementById('subtaskErrorSkipBtn');
    const queueBtn = document.getElementById('subtaskErrorQueueBtn');
    const cancelBtn = document.getElementById('subtaskErrorCancelBtn');
    const retryDelayCheckbox = document.getElementById('errorRetryDelayCheckbox');

    if (!modal) {
      resolve({ action: 'cancel', shouldDelay: false });
      return;
    }

    subtaskNumDiv.textContent = `Subtask ${subtaskNumber} of ${totalSubtasks}`;
    messageDiv.textContent = error.message || String(error);
    detailsDiv.textContent = error.toString();

    openModal('subtaskErrorModal');

    const handleAction = (action) => {
      retryBtn.onclick = null;
      skipBtn.onclick = null;
      cancelBtn.onclick = null;
      if (queueBtn) queueBtn.onclick = null;

      hideSubtaskErrorModal();

      const shouldDelay = action === 'retry' ? retryDelayCheckbox.checked : false;
      resolve({ action, shouldDelay });
    };

    retryBtn.onclick = () => handleAction('retry');
    skipBtn.onclick = () => handleAction('skip');
    cancelBtn.onclick = () => handleAction('cancel');
    if (queueBtn) queueBtn.onclick = () => handleAction('queue');
  });
}

export function hideSubtaskErrorModal() {
  closeModal('subtaskErrorModal');
}

export function initJulesKeyModalListeners() {
  const keyInput = document.getElementById('julesKeyInput');
  if (keyInput) {
    keyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('julesSaveBtn').click();
      }
    });
  }
}

export { lastSelectedSourceId, lastSelectedBranch };
