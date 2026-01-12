// ===== Jules Free Input Module =====
// Free input form functionality

import { getCurrentUser } from './auth.js';
import { checkJulesKey } from './jules-keys.js';
import { showJulesKeyModal, showSubtaskErrorModal } from './jules-modal.js';
import { addToJulesQueue } from './jules-queue.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';

// Module state
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
        setTimeout(() => showFreeInputModal(), 500);
      } catch (error) {
        alert('Login required to use Jules.');
      }
    })();
    return;
  }

  handleFreeInputAfterAuth();
}

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
  
  empty.classList.add('hidden');
  if (title) title.style.display = 'none';
  if (meta) meta.style.display = 'none';
  if (actions) actions.style.display = 'none';
  if (content) {
    content.style.display = 'none';
    content.classList.add('hidden');
  }
  
  freeInputSection.classList.remove('hidden');
  
  const textarea = document.getElementById('freeInputTextarea');
  const submitBtn = document.getElementById('freeInputSubmitBtn');
  const queueBtn = document.getElementById('freeInputQueueBtn');
  const splitBtn = document.getElementById('freeInputSplitBtn');
  const copenBtn = document.getElementById('freeInputCopenBtn');
  const cancelBtn = document.getElementById('freeInputCancelBtn');

  textarea.value = '';
  
  populateFreeInputRepoSelection();
  
  textarea.focus();

  const handleSubmit = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alert('Please enter a prompt.');
      return;
    }

    if (!_lastSelectedSourceId) {
      alert('Please select a repository.');
      return;
    }

    if (!_lastSelectedBranch) {
      alert('Please select a branch.');
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
      let maxRetries = 3;
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
          submitted = true;
        } catch (error) {
          retryCount++;

          if (retryCount < maxRetries) {
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
                  sourceId: _lastSelectedSourceId,
                  branch: _lastSelectedBranch,
                  note: 'Queued from Free Input flow'
                });
                alert('Prompt queued. You can restart it later from your Jules queue.');
              } catch (err) {
                alert('Failed to queue prompt: ' + err.message);
              }
              return;
            } else if (result.action === 'retry') {
              if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, 5000));
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
                  sourceId: _lastSelectedSourceId,
                  branch: _lastSelectedBranch,
                  note: 'Queued from Free Input flow (final failure)'
                });
                alert('Prompt queued. You can restart it later from your Jules queue.');
              } catch (err) {
                alert('Failed to queue prompt: ' + err.message);
              }
              return;
            }

            if (result.action === 'retry') {
              if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
              try {
                const sessionUrl = await callRunJulesFunction(promptText, _lastSelectedSourceId, _lastSelectedBranch, title);
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
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      alert('Failed to submit prompt: ' + error.message);
    }
  };

  const handleSplit = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alert('Please enter a prompt.');
      return;
    }

    if (!_lastSelectedSourceId) {
      alert('Please select a repository.');
      return;
    }

    if (!_lastSelectedBranch) {
      alert('Please select a branch.');
      return;
    }
    
    try {
      const { showSubtaskSplitModal } = await import('./jules-subtask-modal.js');
      showSubtaskSplitModal(promptText);
    } catch (error) {
      console.error('Error showing modal:', error);
      alert('Failed to process prompt: ' + error.message);
    }
  };

  const handleCopen = async (target) => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alert('Please enter a prompt.');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      copenBtn.textContent = 'Copied!';
      setTimeout(() => {
        copenBtn.textContent = '📋⤴ ▼';
      }, 1000);

      let url;
      switch(target) {
        case 'claude':
          url = 'https://claude.ai/code';
          break;
        case 'codex':
          url = 'https://chatgpt.com/codex';
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
      alert('Failed to copy prompt: ' + error.message);
    }
  };

  const handleCancel = () => {
    hideFreeInputForm();
  };

  const handleQueue = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alert('Please enter a prompt.');
      return;
    }

    if (!_lastSelectedSourceId) {
      alert('Please select a repository.');
      return;
    }

    if (!_lastSelectedBranch) {
      alert('Please select a branch.');
      return;
    }

    const user = window.auth?.currentUser;
    if (!user) {
      alert('Please sign in to queue prompts.');
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
      alert('Prompt queued successfully!');
      hideFreeInputForm();
    } catch (err) {
      alert('Failed to queue prompt: ' + err.message);
    }
  };

  const copenMenu = document.getElementById('freeInputCopenMenu');
  
  copenBtn.onclick = (e) => {
    e.stopPropagation();
    copenMenu.style.display = copenMenu.style.display === 'none' ? 'block' : 'none';
  };
  
  if (copenMenu) {
    copenMenu.querySelectorAll('.custom-dropdown-item').forEach(item => {
      item.onclick = async (e) => {
        e.stopPropagation();
        const target = item.dataset.target;
        await handleCopen(target);
        copenMenu.style.display = 'none';
      };
    });
  }
  
  const closeCopenMenu = (e) => {
    if (!copenBtn.contains(e.target) && !copenMenu.contains(e.target)) {
      copenMenu.style.display = 'none';
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
  
  freeInputSection.classList.add('hidden');
  empty.classList.remove('hidden');
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
