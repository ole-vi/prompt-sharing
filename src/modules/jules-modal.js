// ===== Jules Modal Module =====
// Core modal UI functions (key modal, env modal, error modal)

import { encryptAndStoreKey } from './jules-keys.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { addToJulesQueue } from './jules-queue.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import { RETRY_CONFIG, TIMEOUTS, JULES_MESSAGES } from '../utils/constants.js';
import { showToast } from './toast.js';
import { modalManager } from '../utils/modal-manager.js';

let lastSelectedSourceId = 'sources/github/promptroot/promptroot';
let lastSelectedBranch = 'main';

const KEY_MODAL_ID = 'julesKeyModal';
const ENV_MODAL_ID = 'julesEnvModal';
const ERROR_MODAL_ID = 'subtaskErrorModal';

const KEY_MODAL_CONTENT = `
    <div class="modal-content">
      <h2>Save Jules API Key</h2>
      <p>Enter your Jules API key. This will be encrypted and stored securely.</p>
      <input id="julesKeyInput" type="password" class="modal-input" placeholder="Paste your Jules API key..." />
      <div class="modal-buttons">
        <button id="julesCancelBtn" class="btn">Cancel</button>
        <button id="julesSaveBtn" class="btn primary">Save & Continue</button>
      </div>
    </div>
`;

const ENV_MODAL_CONTENT = `
    <div class="modal-content">
      <h2>Choose Repository</h2>
      <p>Select a connected repository to open in Jules.</p>

      <div id="favoriteReposContainer" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;"></div>

      <div id="allReposContainer" class="mb-md">
        <div class="form-row">
          <!-- Repository Selection -->
          <div class="form-col">
            <label class="form-label">Repository:</label>
            <div id="julesRepoDropdown" class="custom-dropdown">
              <button id="julesRepoDropdownBtn" class="custom-dropdown-btn w-full" type="button">
                <span id="julesRepoDropdownText">Select a repository...</span>
                <span class="custom-dropdown-caret" aria-hidden="true">▼</span>
              </button>
              <div id="julesRepoDropdownMenu" class="custom-dropdown-menu" role="menu"></div>
            </div>
          </div>

          <!-- Branch Selection -->
          <div class="form-col">
            <label class="form-label">Branch:</label>
            <div id="julesBranchDropdown" class="custom-dropdown">
              <button id="julesBranchDropdownBtn" class="custom-dropdown-btn w-full" type="button" disabled>
                <span id="julesBranchDropdownText">Select branch...</span>
                <span class="custom-dropdown-caret" aria-hidden="true">▼</span>
              </button>
              <div id="julesBranchDropdownMenu" class="custom-dropdown-menu" role="menu"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="options-box">
        <label class="form-label small-text"><input type="checkbox" id="julesEnvSuppressPopupsCheckbox" data-exclusive-group="jules-env" /> Suppress Popups</label>
        <label class="form-label small-text"><input type="checkbox" id="julesEnvOpenInBackgroundCheckbox" data-exclusive-group="jules-env" /> Open in Background</label>
      </div>

      <div class="modal-buttons">
        <button id="julesEnvCancelBtn" class="btn">Cancel</button>
        <button id="julesEnvQueueBtn" class="btn" disabled>Queue</button>
        <button id="julesEnvSubmitBtn" class="btn primary" disabled>Submit</button>
      </div>
    </div>
`;

let errorModalHtml = null;
let envModalState = {
  repoSelector: null,
  branchSelector: null
};

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
  modalManager.destroyModal(KEY_MODAL_ID);
  const modal = modalManager.createModal(KEY_MODAL_ID, {
    content: KEY_MODAL_CONTENT,
    classes: ['modal'],
    styles: { zIndex: '1001' }
  });

  const input = document.getElementById('julesKeyInput');
  input.value = '';

  const saveBtn = document.getElementById('julesSaveBtn');
  const cancelBtn = document.getElementById('julesCancelBtn');

  const handleSave = async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      showToast('Please enter your Jules API key.', 'warn');
      return;
    }

    try {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const user = window.auth ? window.auth.currentUser : null;
      if (!user) {
        showToast('Not logged in.', 'error');
        saveBtn.textContent = 'Save & Continue';
        saveBtn.disabled = false;
        return;
      }

      await encryptAndStoreKey(apiKey, user.uid);

      showToast('Jules API key saved successfully', 'success');
      hideJulesKeyModal();
      saveBtn.textContent = 'Save & Continue';
      saveBtn.disabled = false;

      if (onSave) onSave();
    } catch (error) {
      showToast('Failed to save API key: ' + error.message, 'error');
      saveBtn.textContent = 'Save & Continue';
      saveBtn.disabled = false;
    }
  };

  const handleCancel = () => {
    hideJulesKeyModal();
  };

  modalManager.addListener(KEY_MODAL_ID, saveBtn, 'click', handleSave);
  modalManager.addListener(KEY_MODAL_ID, cancelBtn, 'click', handleCancel);

  modalManager.addListener(KEY_MODAL_ID, input, 'keypress', (e) => {
    if (e.key === 'Enter') handleSave();
  });

  // Close on background click
  modalManager.addListener(KEY_MODAL_ID, modal, 'click', (e) => {
    if (e.target === modal) hideJulesKeyModal();
  });

  // Escape key
  modalManager.addListener(KEY_MODAL_ID, document, 'keydown', (e) => {
    if (e.key === 'Escape') hideJulesKeyModal();
  });

  modalManager.showModal(KEY_MODAL_ID, { displayStyle: 'flex' });
  input.focus();
}

export function hideJulesKeyModal() {
  modalManager.destroyModal(KEY_MODAL_ID);
}

export async function showJulesEnvModal(promptText) {
  modalManager.destroyModal(ENV_MODAL_ID);
  const modal = modalManager.createModal(ENV_MODAL_ID, {
    content: ENV_MODAL_CONTENT,
    classes: ['modal'],
    styles: { zIndex: '1001' }
  });

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

  envModalState.repoSelector = repoSelector;
  envModalState.branchSelector = branchSelector;

  // Load favorites and populate dropdown
  await repoSelector.initialize();
  branchSelector.initialize(null, null);

  modalManager.addListener(ENV_MODAL_ID, submitBtn, 'click', () => {
    if (selectedSourceId && selectedBranch) {
      const suppressPopups = document.getElementById('julesEnvSuppressPopupsCheckbox')?.checked || false;
      const openInBackground = document.getElementById('julesEnvOpenInBackgroundCheckbox')?.checked || false;
      handleRepoSelect(selectedSourceId, selectedBranch, promptText, suppressPopups, openInBackground);
    }
  });
  
  modalManager.addListener(ENV_MODAL_ID, queueBtn, 'click', async () => {
    if (!selectedSourceId || !selectedBranch) return;
    
    const user = window.auth?.currentUser;
    if (!user) {
      showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
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
      showToast(JULES_MESSAGES.QUEUED, 'success');
      hideJulesEnvModal();
    } catch (err) {
      showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
    }
  });
  
  modalManager.addListener(ENV_MODAL_ID, cancelBtn, 'click', hideJulesEnvModal);

  // Background click
  modalManager.addListener(ENV_MODAL_ID, modal, 'click', (e) => {
    if (e.target === modal) hideJulesEnvModal();
  });

  // Escape key
  modalManager.addListener(ENV_MODAL_ID, document, 'keydown', (e) => {
    if (e.key === 'Escape') hideJulesEnvModal();
  });

  modalManager.showModal(ENV_MODAL_ID, { displayStyle: 'flex' });
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
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'skip') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'queue') {
          const user = window.auth?.currentUser;
          if (!user) {
            showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
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
            showToast(JULES_MESSAGES.QUEUED, 'success');
          } catch (err) {
            showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
          }
          return;
        } else if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, TIMEOUTS.fetch));
          }
        }
      } else {
        const result = await showSubtaskErrorModal(1, 1, error);

        if (result.action === 'cancel') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'skip') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'queue') {
          const user = window.auth?.currentUser;
          if (!user) {
            showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
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
            showToast(JULES_MESSAGES.QUEUED, 'success');
          } catch (err) {
            showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
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
            showToast(JULES_MESSAGES.FINAL_RETRY_FAILED, 'error');
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
  // Cleanup listeners for selectors
  if (envModalState.repoSelector?.dropdownBtn?._closeDropdownHandler) {
    document.removeEventListener('click', envModalState.repoSelector.dropdownBtn._closeDropdownHandler);
  }
  if (envModalState.branchSelector?.dropdownBtn?._closeDropdownHandler) {
    document.removeEventListener('click', envModalState.branchSelector.dropdownBtn._closeDropdownHandler);
  }

  modalManager.destroyModal(ENV_MODAL_ID);
}

export async function showSubtaskErrorModal(subtaskNumber, totalSubtasks, error, hideQueueButton = false) {
  modalManager.destroyModal(ERROR_MODAL_ID);
  
  if (!errorModalHtml) {
    try {
      const response = await fetch('/partials/subtask-error-modal.html');
      if (response.ok) {
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const modalEl = doc.getElementById('subtaskErrorModal');
        errorModalHtml = modalEl ? modalEl.innerHTML : html;
      }
    } catch (err) {
      console.error('Error loading subtask error modal:', err);
    }
  }

  if (!errorModalHtml) return { action: 'cancel', shouldDelay: false };

  const modal = modalManager.createModal(ERROR_MODAL_ID, {
    content: errorModalHtml,
    classes: ['modal'],
    styles: { zIndex: '10000' }
  });

  const subtaskNumDiv = document.getElementById('errorSubtaskNumber');
  const messageDiv = document.getElementById('errorMessage');
  const detailsDiv = document.getElementById('errorDetails');
  const retryBtn = document.getElementById('subtaskErrorRetryBtn');
  const skipBtn = document.getElementById('subtaskErrorSkipBtn');
  const queueBtn = document.getElementById('subtaskErrorQueueBtn');
  const cancelBtn = document.getElementById('subtaskErrorCancelBtn');
  const closeBtn = document.getElementById('errorModalClose');
  const retryDelayCheckbox = document.getElementById('errorRetryDelayCheckbox');

  if (hideQueueButton && queueBtn) {
    queueBtn.style.display = 'none';
  } else if (queueBtn) {
    queueBtn.style.display = '';
  }

  return new Promise((resolve) => {
    if (subtaskNumDiv) subtaskNumDiv.textContent = `Task ${subtaskNumber} of ${totalSubtasks}`;
    if (messageDiv) messageDiv.textContent = error.message || String(error);
    if (detailsDiv) detailsDiv.textContent = error.toString();

    const handleAction = (action) => {
      hideSubtaskErrorModal();
      const shouldDelay = action === 'retry' ? retryDelayCheckbox.checked : false;
      resolve({ action, shouldDelay });
    };

    if (retryBtn) modalManager.addListener(ERROR_MODAL_ID, retryBtn, 'click', () => handleAction('retry'));
    if (skipBtn) modalManager.addListener(ERROR_MODAL_ID, skipBtn, 'click', () => handleAction('skip'));
    if (cancelBtn) modalManager.addListener(ERROR_MODAL_ID, cancelBtn, 'click', () => handleAction('cancel'));
    if (closeBtn) modalManager.addListener(ERROR_MODAL_ID, closeBtn, 'click', () => handleAction('cancel'));
    if (queueBtn) modalManager.addListener(ERROR_MODAL_ID, queueBtn, 'click', () => handleAction('queue'));
    
    // Handle Escape key
    modalManager.addListener(ERROR_MODAL_ID, document, 'keydown', (e) => {
      if (e.key === 'Escape') handleAction('cancel');
    });
    
    // Handle background click
    modalManager.addListener(ERROR_MODAL_ID, modal, 'click', (e) => {
      if (e.target === modal) handleAction('cancel');
    });

    modalManager.showModal(ERROR_MODAL_ID);
  });
}

export function hideSubtaskErrorModal() {
  modalManager.destroyModal(ERROR_MODAL_ID);
}

export function initJulesKeyModalListeners() {
  // Deprecated: Modals are now dynamic and handle their own listeners.
  // Kept empty to avoid breaking calls from other modules.
  // We can add global listeners here if strictly necessary for other modals like userProfileModal,
  // but preferably those should be refactored too.

  // Handling remaining static modals (userProfileModal, julesSessionsHistoryModal, freeInputSection)
  const profileModal = document.getElementById('userProfileModal');
  const sessionsHistoryModal = document.getElementById('julesSessionsHistoryModal');

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      const freeInputSection = document.getElementById('freeInputSection');
      if (freeInputSection && !freeInputSection.classList.contains('hidden')) {
        const { hideFreeInputForm } = await import('./jules-free-input.js?v=' + Date.now());
        hideFreeInputForm();
      }
      if (profileModal && profileModal.style.display === 'flex') {
        const { hideUserProfileModal } = await import('./jules-account.js');
        hideUserProfileModal();
      }
      if (sessionsHistoryModal && sessionsHistoryModal.style.display === 'flex') {
        const { hideJulesSessionsHistoryModal } = await import('./jules-account.js');
        hideJulesSessionsHistoryModal();
      }
    }
  });

  if (profileModal) {
    profileModal.addEventListener('click', async (e) => {
      if (e.target === profileModal) {
        const { hideUserProfileModal } = await import('./jules-account.js');
        hideUserProfileModal();
      }
    });
  }
  
  if (sessionsHistoryModal) {
    sessionsHistoryModal.addEventListener('click', async (e) => {
      if (e.target === sessionsHistoryModal) {
        const { hideJulesSessionsHistoryModal } = await import('./jules-account.js');
        hideJulesSessionsHistoryModal();
      }
    });
  }
}

export { lastSelectedSourceId, lastSelectedBranch };
