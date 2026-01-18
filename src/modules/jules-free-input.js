import { getCurrentUser } from './auth.js';
import { checkJulesKey } from './jules-keys.js';
import { showJulesKeyModal, showSubtaskErrorModal } from './jules-modal.js';
import { addToJulesQueue, handleQueueAction } from './jules-queue.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { JULES_MESSAGES, TIMEOUTS, RETRY_CONFIG } from '../utils/constants.js';
import { toggleVisibility } from '../utils/dom-helpers.js';

let _lastSelectedSourceId = null;
let _lastSelectedBranch = null;

export function getLastSelectedSource() {
  return { sourceId: _lastSelectedSourceId, branch: _lastSelectedBranch };
}

export function showFreeInputModal() {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    (async () => {
      try {
        const { signInWithGitHub } = await import('./auth.js');
        await signInWithGitHub();
        setTimeout(() => showFreeInputModal(), TIMEOUTS.uiDelay);
      } catch (error) {
        showToast('Login required to use Jules.', 'warn');
      }
    })();
    return;
  }

  handleFreeInputAfterAuth();
}

export async function handleFreeInputAfterAuth() {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    showToast('Not logged in.', 'error');
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
    showToast('An error occurred. Please try again.', 'error');
  }
}

export function showFreeInputForm() {
  const freeInputSection = document.getElementById('freeInputSection');
  const empty = document.getElementById('empty');
  const title = document.getElementById('title');
  const meta = document.getElementById('meta');
  const actions = document.getElementById('actions');
  const content = document.getElementById('content');
  
  toggleVisibility(empty, false);
  toggleVisibility(title, false);
  toggleVisibility(meta, false);
  toggleVisibility(actions, false);
  toggleVisibility(content, false);
  
  toggleVisibility(freeInputSection, true);
  
  const textarea = document.getElementById('freeInputTextarea');
  const submitBtn = document.getElementById('freeInputSubmitBtn');
  const queueBtn = document.getElementById('freeInputQueueBtn');
  const splitBtn = document.getElementById('freeInputSplitBtn');
  const copenBtn = document.getElementById('freeInputCopenBtn');
  const cancelBtn = document.getElementById('freeInputCancelBtn');
  const originalCopenLabel = '<span class="icon icon-inline" aria-hidden="true">open_in_new</span> Open ▼';

  textarea.value = '';
  
  populateFreeInputRepoSelection();
  
  textarea.focus();

  const handleSubmit = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      showToast('Please enter a prompt.', 'warn');
      return;
    }

    if (!_lastSelectedSourceId) {
      showToast('Please select a repository.', 'warn');
      return;
    }

    if (!_lastSelectedBranch) {
      showToast('Please select a branch.', 'warn');
      return;
    }
    
    const suppressPopups = document.getElementById('freeInputSuppressPopupsCheckbox')?.checked || false;
    const openInBackground = document.getElementById('freeInputOpenInBackgroundCheckbox')?.checked || false;

    let title = '';
    const lines = promptText.split(/\r?\n/);
    if (lines.length > 0 && /^#\s+/.test(lines[0])) {
      title = lines[0].replace(/^#\s+/, '').trim();
    } else if (lines.length > 0) {
      title = lines[0].substring(0, 50).trim();
    }

    textarea.value = '';
    textarea.focus();

    const { callRunJulesFunction } = await import('./jules-api.js');
    const { openUrlInBackground } = await import('./jules-modal.js');

    try {
      let retryCount = 0;
      let maxRetries = RETRY_CONFIG.maxRetries;
      let submitted = false;

      while (retryCount < maxRetries && !submitted) {
        try {
          const sessionUrl = await callRunJulesFunction(promptText, _lastSelectedSourceId, _lastSelectedBranch, title);
          if (sessionUrl && !suppressPopups) {
            if (openInBackground) {
              openUrlInBackground(sessionUrl);
            } else {
              window.open(sessionUrl, '_blank', 'noopener,noreferrer');
            }
          }
          showToast('Prompt sent to Jules successfully!', 'success');
          submitted = true;
        } catch (error) {
          retryCount++;

          if (retryCount < maxRetries) {
            const result = await showSubtaskErrorModal(1, 1, error);

            if (result.action === 'cancel') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'skip') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'queue') {
              await handleQueueAction({
                type: 'single',
                prompt: promptText,
                sourceId: _lastSelectedSourceId,
                branch: _lastSelectedBranch,
                note: 'Queued from Free Input flow'
              });
              showFreeInputForm();
              return;
            } else if (result.action === 'retry') {
              if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
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
              await handleQueueAction({
                type: 'single',
                prompt: promptText,
                sourceId: _lastSelectedSourceId,
                branch: _lastSelectedBranch,
                note: 'Queued from Free Input flow (final failure)'
              });
              showFreeInputForm();
              return;
            }

            if (result.action === 'retry') {
              if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
              }
              try {
                const sessionUrl = await callRunJulesFunction(promptText, _lastSelectedSourceId, _lastSelectedBranch, title);
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
    } catch (error) {
      showToast('Failed to submit prompt: ' + error.message, 'error');
    }
  };

  const handleSplit = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      showToast('Please enter a prompt.', 'warn');
      return;
    }

    if (!_lastSelectedSourceId) {
      showToast('Please select a repository.', 'warn');
      return;
    }

    if (!_lastSelectedBranch) {
      showToast('Please select a branch.', 'warn');
      return;
    }
    
    try {
      const { showSubtaskSplitModal } = await import('./jules-subtask-modal.js');
      showSubtaskSplitModal(promptText);
    } catch (error) {
      console.error('Error showing modal:', error);
      showToast('Failed to process prompt: ' + error.message, 'error');
    }
  };

  const handleCopen = async (target) => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      showToast('Please enter a prompt.', 'warn');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      copenBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Copied!';
      setTimeout(() => {
        copenBtn.innerHTML = originalCopenLabel;
      }, TIMEOUTS.copyFeedback);

      let url;
      switch(target) {
        case 'claude':
          url = 'https://claude.ai/code';
          break;
        case 'codex':
          url = 'https://chatgpt.com/codex';
          break;
        case 'copilot':
          url = 'https://github.com/copilot/agents';
          break;
        case 'gemini':
          url = 'https://gemini.google.com/app';
          break;
        case 'chatgpt':
          url = 'https://chatgpt.com/';
          break;
        case 'blank':
        default:
          url = 'about:blank';
          break;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast('Failed to copy prompt: ' + error.message, 'error');
    }
  };

  const handleCancel = () => {
    hideFreeInputForm();
  };

  const handleQueue = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      showToast('Please enter a prompt.', 'warn');
      return;
    }

    if (!_lastSelectedSourceId) {
      showToast('Please select a repository.', 'warn');
      return;
    }

    if (!_lastSelectedBranch) {
      showToast('Please select a branch.', 'warn');
      return;
    }

    const user = window.auth?.currentUser;
    if (!user) {
      showToast('Please sign in to queue prompts.', 'warn');
      return;
    }

    try {
      await addToJulesQueue(user.uid, {
        type: 'single',
        prompt: promptText,
        sourceId: _lastSelectedSourceId,
        branch: _lastSelectedBranch,
        note: 'Queued from Free Input'
      });
      showToast('Prompt queued successfully!', 'success');
      showFreeInputForm();
    } catch (err) {
      showToast('Failed to queue prompt: ' + err.message, 'error');
    }
  };

  const copenMenu = document.getElementById('freeInputCopenMenu');
  
  copenBtn.onclick = (e) => {
    e.stopPropagation();
    const isHidden = copenMenu.classList.contains('hidden') || copenMenu.style.display === 'none';
    toggleVisibility(copenMenu, isHidden);
  };
  
  if (copenMenu) {
    copenMenu.querySelectorAll('.custom-dropdown-item').forEach(item => {
      item.onclick = async (e) => {
        e.stopPropagation();
        const target = item.dataset.target;
        await handleCopen(target);
        toggleVisibility(copenMenu, false);
      };
    });
  }
  
  const closeCopenMenu = (e) => {
    if (!copenBtn.contains(e.target) && !copenMenu.contains(e.target)) {
      toggleVisibility(copenMenu, false);
    }
  };
  document.addEventListener('click', closeCopenMenu);

  submitBtn.onclick = handleSubmit;
  queueBtn.onclick = handleQueue;
  splitBtn.onclick = handleSplit;
  cancelBtn.onclick = handleCancel;

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  });
}

export function hideFreeInputForm() {
  const freeInputSection = document.getElementById('freeInputSection');
  const empty = document.getElementById('empty');
  const title = document.getElementById('title');
  const meta = document.getElementById('meta');
  const actions = document.getElementById('actions');
  const content = document.getElementById('content');
  
  toggleVisibility(freeInputSection, false);
  
  // Restore the main content area elements
  toggleVisibility(empty, true);
  toggleVisibility(title, true);
  toggleVisibility(meta, true);
  toggleVisibility(actions, true);
  toggleVisibility(content, true);
}

async function populateFreeInputRepoSelection() {
  _lastSelectedSourceId = null;
  _lastSelectedBranch = null;
  
  const repoDropdownText = document.getElementById('freeInputRepoDropdownText');
  const repoDropdownBtn = document.getElementById('freeInputRepoDropdownBtn');
  const repoDropdownMenu = document.getElementById('freeInputRepoDropdownMenu');
  const branchDropdownBtn = document.getElementById('freeInputBranchDropdownBtn');
  const branchDropdownText = document.getElementById('freeInputBranchDropdownText');
  const branchDropdownMenu = document.getElementById('freeInputBranchDropdownMenu');

  if (!repoDropdownText || !repoDropdownBtn || !repoDropdownMenu ||
      !branchDropdownBtn || !branchDropdownText || !branchDropdownMenu) {
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
      _lastSelectedBranch = branch;
    }
  });

  const repoSelector = new RepoSelector({
    favoriteContainer: null,
    dropdownBtn: repoDropdownBtn,
    dropdownText: repoDropdownText,
    dropdownMenu: repoDropdownMenu,
    branchSelector: branchSelector,
    onSelect: (sourceId, branch, repoName) => {
      _lastSelectedSourceId = sourceId;
      _lastSelectedBranch = branch;
      branchSelector.initialize(sourceId, branch);
    }
  });

  await repoSelector.initialize();
  branchSelector.initialize(null, null);
}

window.populateFreeInputRepoSelection = populateFreeInputRepoSelection;
