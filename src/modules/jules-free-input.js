import { getCurrentUser } from './auth.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { copyAndOpen } from './copen.js';
import { JULES_MESSAGES, TIMEOUTS, RETRY_CONFIG } from '../utils/constants.js';
// Lazy loaded: jules-keys, jules-modal, jules-queue

let _lastSelectedSourceId = null;
let _lastSelectedBranch = null;
let _branchChangeListenerAdded = false;

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
    const { checkJulesKey } = await import('./jules-keys.js');
    const hasKey = await checkJulesKey(user.uid);
    
    if (!hasKey) {
      const { showJulesKeyModal } = await import('./jules-modal.js');
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
  
  empty.classList.add('hidden');
  if (title) title.classList.add('hidden');
  if (meta) meta.classList.add('hidden');
  if (actions) actions.classList.add('hidden');
  if (content) {
    content.classList.add('hidden');
  }
  
  freeInputSection.classList.remove('hidden');
  
  const textarea = document.getElementById('freeInputTextarea');
  const submitBtn = document.getElementById('freeInputSubmitBtn');
  const queueBtn = document.getElementById('freeInputQueueBtn');
  const splitBtn = document.getElementById('freeInputSplitBtn');
  const saveBtn = document.getElementById('freeInputSaveBtn');
  const copenBtn = document.getElementById('freeInputCopenBtn');
  const cancelBtn = document.getElementById('freeInputCancelBtn');
  
  const originalCopenContent = Array.from(copenBtn.childNodes).map(node => node.cloneNode(true));

  textarea.value = '';
  
  populateFreeInputRepoSelection();
  
  if (!_branchChangeListenerAdded) {
    window.addEventListener('branchChanged', (event) => {
      if (event.detail && event.detail.branch) {
        _lastSelectedBranch = event.detail.branch;
      }
    });
    _branchChangeListenerAdded = true;
  }
  
  textarea.focus();

  const validatePromptText = (customMessage = 'Please enter a prompt.') => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      showToast(customMessage, 'warn');
      return null;
    }
    return promptText;
  };

  const handleSubmit = async () => {
    const promptText = validatePromptText();
    if (!promptText) return;

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
            const { showSubtaskErrorModal } = await import('./jules-modal.js');
            const result = await showSubtaskErrorModal(1, 1, error);

            if (result.action === 'cancel') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'skip') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'queue') {
              const { handleQueueAction } = await import('./jules-queue.js');
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
            const { showSubtaskErrorModal } = await import('./jules-modal.js');
            const result = await showSubtaskErrorModal(1, 1, error);

            if (result.action === 'cancel') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'skip') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'queue') {
              const { handleQueueAction } = await import('./jules-queue.js');
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
    const promptText = validatePromptText();
    if (!promptText) return;

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
    const promptText = validatePromptText();
    if (!promptText) return;

    const success = await copyAndOpen(target, promptText);

    if (success) {
      copenBtn.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'icon icon-inline';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'check_circle';
      copenBtn.appendChild(icon);
      copenBtn.appendChild(document.createTextNode(' Copied!'));
      setTimeout(() => {
        copenBtn.replaceChildren(...originalCopenContent.map(node => node.cloneNode(true)));
      }, TIMEOUTS.copyFeedback);
    }
  };

  const handleCancel = () => {
    hideFreeInputForm();
  };

  const handleSave = async () => {
    const promptText = validatePromptText('Please enter content to save.');
    if (!promptText) return;

    let sourceId = _lastSelectedSourceId;
    if (!sourceId) {
      try {
        const { getCurrentRepo } = await import('./branch-selector.js');
        const currentRepoContext = getCurrentRepo();
        if (currentRepoContext.owner && currentRepoContext.repo) {
          sourceId = `sources/github/${currentRepoContext.owner}/${currentRepoContext.repo}`;
        }
      } catch (error) {
        console.warn('Could not get current repo context:', error);
      }
      if (!sourceId) {
        sourceId = 'sources/github/promptroot/promptroot';
      }
    }
    
    let branch = null;
    try {
      const { getCurrentBranch } = await import('./branch-selector.js');
      branch = getCurrentBranch();
    } catch (error) {
      console.warn('Could not get current branch from header selector:', error);
    }
    
    if (!branch) {
      branch = _lastSelectedBranch || 'main';
    }
    
    const parts = sourceId.split('/');
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];
    
    const encoded = encodeURIComponent(promptText);
    const newFilePath = 'prompts/new-prompt.md';
    const ghUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(newFilePath)}&value=${encoded}&ref=${encodeURIComponent(branch)}`;
    
    window.open(ghUrl, '_blank', 'noopener,noreferrer');
    showToast('Opening GitHub to save your prompt...', 'success');
  };

  const handleQueue = async () => {
    const promptText = validatePromptText();
    if (!promptText) return;

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
      const { addToJulesQueue } = await import('./jules-queue.js');
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
    copenMenu.classList.toggle('show');
  };
  
  if (copenMenu) {
    copenMenu.querySelectorAll('.custom-dropdown-item').forEach(item => {
      item.onclick = async (e) => {
        e.stopPropagation();
        const target = item.dataset.target;
        await handleCopen(target);
        copenMenu.classList.remove('show');
      };
    });
  }
  
  const closeCopenMenu = (e) => {
    if (!copenBtn.contains(e.target) && !copenMenu.contains(e.target)) {
      copenMenu.classList.remove('show');
    }
  };
  document.addEventListener('click', closeCopenMenu);

  submitBtn.onclick = handleSubmit;
  queueBtn.onclick = handleQueue;
  splitBtn.onclick = handleSplit;
  saveBtn.onclick = handleSave;
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
  
  freeInputSection.classList.add('hidden');
  
  // Restore the main content area elements
  empty.classList.remove('hidden');
  if (title) title.classList.remove('hidden');
  if (meta) meta.classList.remove('hidden');
  if (actions) actions.classList.remove('hidden');
  if (content) content.classList.remove('hidden');
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
