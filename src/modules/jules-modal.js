import { checkJulesKey, encryptAndStoreKey, deleteStoredJulesKey } from './jules-keys.js';
import { addToJulesQueue, listJulesQueue, runSelectedQueueItems, deleteSelectedQueueItems, loadQueuePage } from './jules-queue.js';
import { loadJulesProfileInfo, listJulesSessions, callRunJulesFunction } from './jules-api.js';
import { getCurrentUser, signInWithGitHub } from './auth.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { analyzePromptStructure, validateSubtasks, buildSubtaskSequence } from './subtask-manager.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import statusBar from './status-bar.js';

let lastSelectedSourceId = 'sources/github/open-learning-exchange/myplanet';
let lastSelectedBranch = 'master';
let currentFullPrompt = '';
let currentSubtasks = [];
let allSessionsCache = [];
let sessionNextPageToken = null;

export function showJulesQueueModal() {
  const modal = document.getElementById('julesQueueModal');
  if (!modal) {
    console.error('julesQueueModal element not found!');
    return;
  }
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1003; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');

  modal.onclick = (e) => {
    if (e.target === modal) {
      hideJulesQueueModal();
    }
  };

  loadQueuePage();
  attachQueueModalHandlers();
}

export function hideJulesQueueModal() {
  const modal = document.getElementById('julesQueueModal');
  if (modal) modal.setAttribute('style', 'display:none !important;');
}

export function attachQueueModalHandlers() {
    const selectAll = document.getElementById('queueSelectAll');
    const runBtn = document.getElementById('queueRunBtn');
    const deleteBtn = document.getElementById('queueDeleteBtn');
    const closeBtn = document.getElementById('closeQueueBtn');

    if (selectAll) {
      selectAll.onclick = () => {
        const checked = selectAll.checked;
        document.querySelectorAll('.queue-checkbox').forEach(cb => cb.checked = checked);
        document.querySelectorAll('.subtask-checkbox').forEach(cb => cb.checked = checked);
      };
    }

    document.querySelectorAll('.queue-checkbox').forEach(queueCb => {
      queueCb.onclick = (e) => {
        e.stopPropagation();
        const docId = queueCb.dataset.docid;
        const checked = queueCb.checked;
        document.querySelectorAll(`.subtask-checkbox[data-docid="${docId}"]`).forEach(subtaskCb => {
          subtaskCb.checked = checked;
        });
      };
    });

    const runHandler = async () => { await runSelectedQueueItems(); };
    const deleteHandler = async () => { await deleteSelectedQueueItems(); };

    if (runBtn) runBtn.onclick = runHandler;
    if (deleteBtn) deleteBtn.onclick = deleteHandler;
    if (closeBtn) closeBtn.onclick = hideJulesQueueModal;
  }

export function showJulesKeyModal(onSave) {
  const modal = document.getElementById('julesKeyModal');
  const input = document.getElementById('julesKeyInput');

  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
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
  const modal = document.getElementById('julesKeyModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
}

export async function showJulesEnvModal(promptText) {
    const modal = document.getElementById('julesEnvModal');
    modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');

    const submitBtn = document.getElementById('julesEnvSubmitBtn');
    const queueBtn = document.getElementById('julesEnvQueueBtn');
    const cancelBtn = document.getElementById('julesEnvCancelBtn');

    submitBtn.disabled = true;
    queueBtn.disabled = true;

    let selectedSourceId = null;
    let selectedBranch = null;

    const branchSelector = new BranchSelector({
      dropdownBtn: document.getElementById('julesBranchDropdownBtn'),
      dropdownText: document.getElementById('julesBranchDropdownText'),
      dropdownMenu: document.getElementById('julesBranchDropdownMenu'),
      onSelect: (branch) => {
        selectedBranch = branch;
      }
    });

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
        const title = extractTitleFromPrompt(promptText);
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

  export function hideJulesEnvModal() {
    const modal = document.getElementById('julesEnvModal');
    modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
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

      modal.style.removeProperty('display');
      modal.style.setProperty('display', 'flex', 'important');

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
    const modal = document.getElementById('subtaskErrorModal');
    if (modal) {
      modal.style.removeProperty('display');
    }
  }

  export function initJulesKeyModalListeners() {
    const keyModal = document.getElementById('julesKeyModal');
    const envModal = document.getElementById('julesEnvModal');
    const profileModal = document.getElementById('userProfileModal');
    const sessionsHistoryModal = document.getElementById('julesSessionsHistoryModal');
    const errorModal = document.getElementById('subtaskErrorModal');
    const keyInput = document.getElementById('julesKeyInput');

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (keyModal && keyModal.style.display === 'flex') {
          hideJulesKeyModal();
        }
        if (envModal && envModal.style.display === 'flex') {
          hideJulesEnvModal();
        }
        const freeInputSection = document.getElementById('freeInputSection');
        if (freeInputSection && !freeInputSection.classList.contains('hidden')) {
          hideFreeInputForm();
        }
        if (profileModal && profileModal.style.display === 'flex') {
          hideUserProfileModal();
        }
        if (sessionsHistoryModal && sessionsHistoryModal.style.display === 'flex') {
          hideJulesSessionsHistoryModal();
        }
      }
    });

    if (keyModal) {
      keyModal.addEventListener('click', (e) => {
        if (e.target === keyModal) {
          hideJulesKeyModal();
        }
      });
    }

    if (envModal) {
      envModal.addEventListener('click', (e) => {
        if (e.target === envModal) {
          hideJulesEnvModal();
        }
      });
    }

    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
          hideUserProfileModal();
        }
      });
    }

    if (sessionsHistoryModal) {
      sessionsHistoryModal.addEventListener('click', (e) => {
        if (e.target === sessionsHistoryModal) {
          hideJulesSessionsHistoryModal();
        }
      });
    }

    if (errorModal) {
      errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
          e.preventDefault();
        }
      });
    }

    if (keyInput) {
      keyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('julesSaveBtn').click();
        }
      });
    }
  }

  export function showUserProfileModal() {
    const modal = document.getElementById('userProfileModal');
    const user = window.auth?.currentUser;

    if (!user) {
      alert('Not logged in.');
      return;
    }

    modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');

    const profileUserName = document.getElementById('profileUserName');
    const julesKeyStatus = document.getElementById('julesKeyStatus');
    const addBtn = document.getElementById('addJulesKeyBtn');
    const resetBtn = document.getElementById('resetJulesKeyBtn');
    const dangerZoneSection = document.getElementById('dangerZoneSection');
    const closeBtn = document.getElementById('closeProfileBtn');
    const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
    const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

    if (profileUserName) {
      profileUserName.textContent = user.displayName || user.email || 'Unknown User';
    }

    checkJulesKey(user.uid).then(async (hasKey) => {
      if (julesKeyStatus) {
        julesKeyStatus.textContent = hasKey ? '✓ Saved' : '✗ Not saved';
        julesKeyStatus.style.color = hasKey ? 'var(--accent)' : 'var(--muted)';
      }

      if (hasKey) {
        if (addBtn) addBtn.style.display = 'none';
        if (dangerZoneSection) dangerZoneSection.style.display = 'block';
        if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'block';

        await loadAndDisplayJulesProfile(user.uid);
      } else {
        if (addBtn) addBtn.style.display = 'block';
        if (dangerZoneSection) dangerZoneSection.style.display = 'none';
        if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';
      }
    });

    if (addBtn) {
      addBtn.onclick = () => {
        hideUserProfileModal();
        showJulesKeyModal(() => {
          setTimeout(() => showUserProfileModal(), 500);
        });
      };
    }

    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (!confirm('This will delete your stored Jules API key. You\'ll need to enter a new one next time.')) {
          return;
        }
        try {
          resetBtn.disabled = true;
          resetBtn.textContent = 'Deleting...';
          const deleted = await deleteStoredJulesKey(user.uid);
          if (deleted) {
            if (julesKeyStatus) {
              julesKeyStatus.textContent = '✗ Not saved';
              julesKeyStatus.style.color = 'var(--muted)';
            }
            resetBtn.textContent = '🗑️ Delete Jules API Key';
            resetBtn.disabled = false;

            if (addBtn) addBtn.style.display = 'block';
            if (dangerZoneSection) dangerZoneSection.style.display = 'none';
            if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';

            alert('Jules API key has been deleted. You can enter a new one next time.');
          } else {
            throw new Error('Failed to delete key');
          }
        } catch (error) {
          alert('Failed to reset API key: ' + error.message);
          resetBtn.textContent = '🔄 Reset Jules API Key';
          resetBtn.disabled = false;
        }
      };
    }

    if (loadJulesInfoBtn) {
      loadJulesInfoBtn.onclick = async () => {
        await loadAndDisplayJulesProfile(user.uid);
        attachViewAllSessionsHandler();
        attachViewQueueHandler();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        hideUserProfileModal();
      };
    }

    attachViewAllSessionsHandler();
    attachViewQueueHandler();

    const closeSessionsHistoryBtn = document.getElementById('closeSessionsHistoryBtn');
    const loadMoreSessionsBtn = document.getElementById('loadMoreSessionsBtn');
    const sessionSearchInput = document.getElementById('sessionSearchInput');

    if (closeSessionsHistoryBtn) {
      closeSessionsHistoryBtn.onclick = () => {
        hideJulesSessionsHistoryModal();
      };
    }

    if (loadMoreSessionsBtn) {
      loadMoreSessionsBtn.onclick = () => {
        loadSessionsPage();
      };
    }

    if (sessionSearchInput) {
      sessionSearchInput.addEventListener('input', () => {
        const user = window.auth?.currentUser;
        if (!user) return;
        renderAllSessions(allSessionsCache);
      });
    }
  }

  export function hideUserProfileModal() {
    const modal = document.getElementById('userProfileModal');
    modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
  }

  export function showJulesSessionsHistoryModal() {
    const modal = document.getElementById('julesSessionsHistoryModal');
    const allSessionsList = document.getElementById('allSessionsList');
    const loadMoreSection = document.getElementById('sessionsLoadMore');
    const searchInput = document.getElementById('sessionSearchInput');

    modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');

    allSessionsCache = [];
    sessionNextPageToken = null;
    searchInput.value = '';

    loadSessionsPage();
  }

  export function hideJulesSessionsHistoryModal() {
    const modal = document.getElementById('julesSessionsHistoryModal');
    modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
  }

  export function showFreeInputModal() {
    const user = window.auth ? window.auth.currentUser : null;
    if (!user) {
      (async () => {
        try {
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
    title.style.display = 'none';
    meta.style.display = 'none';
    actions.style.display = 'none';
    content.style.display = 'none';

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

      if (!lastSelectedSourceId) {
        alert('Please select a repository.');
        return;
      }

      if (!lastSelectedBranch) {
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

      try {
        let retryCount = 0;
        let maxRetries = 3;
        let submitted = false;

        while (retryCount < maxRetries && !submitted) {
          try {
            const sessionUrl = await callRunJulesFunction(promptText, lastSelectedSourceId, lastSelectedBranch, title);
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
                    sourceId: lastSelectedSourceId,
                    branch: lastSelectedBranch,
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
                    sourceId: lastSelectedSourceId,
                    branch: lastSelectedBranch,
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
                  const sessionUrl = await callRunJulesFunction(promptText, lastSelectedSourceId, lastSelectedBranch, title);
                  if (sessionUrl) {
                    window.open(sessionUrl, '_blank', 'noopener,noreferrer');
                  }
                  submitted = true;
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

      if (!lastSelectedSourceId) {
        alert('Please select a repository.');
        return;
      }

      if (!lastSelectedBranch) {
        alert('Please select a branch.');
        return;
      }

      hideFreeInputForm();

      try {
        showSubtaskSplitModal(promptText);
      } catch (error) {
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

      if (!lastSelectedSourceId) {
        alert('Please select a repository.');
        return;
      }

      if (!lastSelectedBranch) {
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
          sourceId: lastSelectedSourceId,
          branch: lastSelectedBranch,
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

  export function showSubtaskSplitModal(promptText) {
    currentFullPrompt = promptText;

    const modal = document.getElementById('subtaskSplitModal');
    const confirmBtn = document.getElementById('splitConfirmBtn');
    const queueBtn = document.getElementById('splitQueueBtn');
    const cancelBtn = document.getElementById('splitCancelBtn');

    const analysis = analyzePromptStructure(promptText);
    currentSubtasks = analysis.subtasks;

    modal.classList.remove('hidden');

    renderSplitEdit(currentSubtasks, promptText);

    confirmBtn.onclick = async () => {
      if (!currentSubtasks || currentSubtasks.length === 0) {
        hideSubtaskSplitModal();
        await submitSubtasks([]);
        return;
      }

      const validation = validateSubtasks(currentSubtasks);
      if (!validation.valid) {
        alert('Error:\n' + validation.errors.join('\n'));
        return;
      }

      if (validation.warnings.length > 0) {
        const proceed = confirm('Warnings:\n' + validation.warnings.join('\n') + '\n\nProceed anyway?');
        if (!proceed) return;
      }

      const subtasksToSubmit = [...currentSubtasks];
      hideSubtaskSplitModal();
      showFreeInputForm();
      await submitSubtasks(subtasksToSubmit);
    };

    cancelBtn.onclick = () => {
      hideSubtaskSplitModal();
      showFreeInputForm();
    };

    queueBtn.onclick = async () => {
      const user = window.auth?.currentUser;
      if (!user) {
        alert('Please sign in to queue subtasks.');
        return;
      }

      if (!lastSelectedSourceId) {
        alert('Please select a repository first.');
        return;
      }

      if (!lastSelectedBranch) {
        alert('Please select a branch first.');
        return;
      }

      if (!currentSubtasks || currentSubtasks.length === 0) {
        try {
          await addToJulesQueue(user.uid, {
            type: 'single',
            prompt: currentFullPrompt,
            sourceId: lastSelectedSourceId,
            branch: lastSelectedBranch,
            note: 'Queued from Split Dialog (no subtasks)'
          });
          alert('Prompt queued successfully!');
          hideSubtaskSplitModal();
        } catch (err) {
          alert('Failed to queue prompt: ' + err.message);
        }
        return;
      }

      const validation = validateSubtasks(currentSubtasks);
      if (!validation.valid) {
        alert('Error:\n' + validation.errors.join('\n'));
        return;
      }

      if (validation.warnings.length > 0) {
        const proceed = confirm('Warnings:\n' + validation.warnings.join('\n') + '\n\nQueue anyway?');
        if (!proceed) return;
      }

      try {
        const sequenced = buildSubtaskSequence(currentFullPrompt, currentSubtasks);
        const remaining = sequenced.map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));

        await addToJulesQueue(user.uid, {
          type: 'subtasks',
          prompt: currentFullPrompt,
          sourceId: lastSelectedSourceId,
          branch: lastSelectedBranch,
          remaining,
          totalCount: remaining.length,
          note: 'Queued from Split Dialog'
        });

        hideSubtaskSplitModal();
        showFreeInputForm();
        alert(`${remaining.length} subtask(s) queued successfully!`);
      } catch (err) {
        alert('Failed to queue subtasks: ' + err.message);
      }
    };
  }

  export function hideSubtaskSplitModal() {
    const modal = document.getElementById('subtaskSplitModal');
    modal.classList.add('hidden');
    currentSubtasks = [];
  }

  function renderSplitEdit(subtasks, promptText) {
    const editList = document.getElementById('splitEditList');

    const promptPreview = promptText.length > 200 ? promptText.substring(0, 200) + '...' : promptText;
    const promptDisplay = `<div style="padding: 12px; margin-bottom: 8px; background: rgba(77,217,255,0.05); border: 1px solid rgba(77,217,255,0.2); border-radius: 6px;">
      <div style="font-size: 12px; color: var(--text); line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;">${promptPreview}</div>
    </div>`;

    if (!subtasks || subtasks.length === 0) {
      editList.innerHTML = promptDisplay + '<div style="padding: 16px; text-align: center; color: var(--muted); font-size: 13px;">No subtasks detected. This prompt will be sent as a single task.</div>';
      return;
    }

    editList.innerHTML = subtasks
      .map((st, idx) => `
        <div style="padding: 8px; border-bottom: 1px solid var(--border); display: flex; gap: 8px; align-items: center;">
          <input type="checkbox" id="subtask-${idx}" checked style="cursor: pointer;" />
          <label for="subtask-${idx}" style="flex: 1; cursor: pointer; font-size: 13px;">
            <strong>Part ${idx + 1}:</strong> ${st.title || `Part ${idx + 1}`}
          </label>
          <span style="font-size: 11px; color: var(--muted);">${st.content.length}c</span>
          <button class="subtask-preview-btn" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: var(--accent); font-size: 16px; padding: 4px 8px; transition: transform 0.2s; line-height: 1;" title="Preview subtask" onclick="event.stopPropagation();">👁️</button>
        </div>
      `)
      .join('');

    subtasks.forEach((st, idx) => {
      const checkbox = document.getElementById(`subtask-${idx}`);
      checkbox.addEventListener('change', () => {
        currentSubtasks = subtasks.filter((_, i) => {
          return document.getElementById(`subtask-${i}`).checked;
        });
      });
    });

    document.querySelectorAll('.subtask-preview-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        showSubtaskPreview(subtasks[idx], idx + 1);
      });

      btn.addEventListener('mouseenter', (e) => {
        e.target.style.transform = 'scale(1.2)';
      });

      btn.addEventListener('mouseleave', (e) => {
        e.target.style.transform = 'scale(1)';
      });
    });
  }

  function showSubtaskPreview(subtask, partNumber) {
    const modal = document.getElementById('subtaskPreviewModal');
    const title = document.getElementById('subtaskPreviewTitle');
    const content = document.getElementById('subtaskPreviewContent');
    const closeBtn = document.getElementById('subtaskPreviewCloseBtn');

    title.textContent = `Part ${partNumber}: ${subtask.title || `Part ${partNumber}`}`;
    content.textContent = subtask.fullContent || subtask.content || '';

    modal.classList.remove('hidden');

    closeBtn.onclick = () => {
      modal.classList.add('hidden');
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
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
        lastSelectedBranch = branch;
      }
    });

    const repoSelector = new RepoSelector({
      favoriteContainer: null,
      dropdownBtn: repoDropdownBtn,
      dropdownText: repoDropdownText,
      dropdownMenu: repoDropdownMenu,
      branchSelector: branchSelector,
      onSelect: (sourceId, branch, repoName) => {
        lastSelectedSourceId = sourceId;
        lastSelectedBranch = branch;
        branchSelector.initialize(sourceId, branch);
      }
    });

    await repoSelector.initialize();
    branchSelector.initialize(null, null);
  }

  function attachViewAllSessionsHandler() {
    const viewAllSessionsLink = document.getElementById('viewAllSessionsLink');
    if (viewAllSessionsLink) {
      viewAllSessionsLink.onclick = (e) => {
        e.preventDefault();
        showJulesSessionsHistoryModal();
      };
    }
  }

  function attachViewQueueHandler() {
    const viewQueueLink = document.getElementById('viewQueueLink');
    if (viewQueueLink) {
      viewQueueLink.onclick = (e) => {
        e.preventDefault();
        showJulesQueueModal();
      };
    }
  }

  async function loadAndDisplayJulesProfile(uid) {
    const loadBtn = document.getElementById('loadJulesInfoBtn');
    const sourcesListDiv = document.getElementById('julesSourcesList');
    const sessionsListDiv = document.getElementById('julesSessionsList');

    try {
      loadBtn.disabled = true;
      loadBtn.textContent = '⏳ Loading...';

      let profileData = getCache(CACHE_KEYS.JULES_ACCOUNT, uid);

      if (!profileData) {
        sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sources...</div>';
        sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sessions...</div>';

        profileData = await loadJulesProfileInfo(uid);
        setCache(CACHE_KEYS.JULES_ACCOUNT, profileData, uid);
      }

      if (profileData.sources && profileData.sources.length > 0) {
        sourcesListDiv.innerHTML = `<div class="vlist">${profileData.sources.map((source, index) => {
            const repoName = source.githubRepo?.name || source.name || source.id;
            const githubPath = repoName.includes('github/') ? repoName.split('github/')[1] : repoName.replace('sources/', '');
            const branches = source.branches || [];
            const sourceId = `source-${index}`;
            const branchSummaryText = branches.length > 0 ? `(${branches.length} ${branches.length === 1 ? 'branch' : 'branches'})` : '(no branches)';
            const branchesHtml = branches.length > 0 ? `<div id="${sourceId}-branches" style="display:none; margin-top:6px; padding-left:10px; font-size:11px; color:var(--muted);"><div style="margin-bottom:4px; color:var(--text);">🌿 Branches (${branches.length}):</div>${branches.map(b => `<div style="padding:3px 0 3px 8px; cursor:pointer;" onclick="window.open('https://github.com/${githubPath}/tree/${encodeURIComponent(b.displayName || b.name)}', '_blank')"> • ${b.displayName || b.name}</div>`).join('')}</div>` : `<div id="${sourceId}-branches" style="display:none; margin-top:6px; padding-left:10px; font-size:11px; color:var(--muted); font-style:italic;">No branches found</div>`;
            return `<div class="queue-card"><div class="queue-row"><div class="queue-content"><div class="queue-title" style="cursor:pointer; user-select:none;" onclick="(function(){ const el = document.getElementById('${sourceId}-branches'); const arrow = document.getElementById('${sourceId}-arrow'); if (el.style.display === 'none') { el.style.display = 'block'; arrow.textContent = '▼'; } else { el.style.display = 'none'; arrow.textContent = '▶'; } })()"><span id="${sourceId}-arrow" style="display:inline-block; width:12px; font-size:10px; margin-right:6px;">▶</span> 📂 ${githubPath} <span class="queue-status">${branchSummaryText}</span></div></div></div>${branchesHtml}</div>`;
        }).join('')}</div>`;
    } else {
        sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No connected repositories found.<br><small>Connect repos in the Jules UI.</small></div>';
    }

    if (profileData.sessions && profileData.sessions.length > 0) {
        sessionsListDiv.innerHTML = `<div class="vlist">${profileData.sessions.map(session => {
            const state = session.state || 'UNKNOWN';
            const stateEmoji = { 'COMPLETED': '✅', 'FAILED': '❌', 'IN_PROGRESS': '⏳', 'PLANNING': '⏳', 'QUEUED': '⏸️', 'AWAITING_USER_FEEDBACK': '💬' }[state] || '❓';
            const stateLabel = { 'COMPLETED': 'COMPLETED', 'FAILED': 'FAILED', 'IN_PROGRESS': 'IN PROGRESS', 'PLANNING': 'IN PROGRESS', 'QUEUED': 'QUEUED', 'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK' }[state] || state.replace(/_/g, ' ');
            const promptPreview = (session.prompt || 'No prompt text').substring(0, 80);
            const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
            const createdAt = session.createTime ? new Date(session.createTime).toLocaleDateString() : 'Unknown';
            const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
            const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
            return `<div class="session-card" onclick="window.open('${sessionUrl}', '_blank', 'noopener')"><div class="session-row"><div class="session-pill">${stateEmoji} ${stateLabel}</div><div class="session-hint">Created: ${createdAt}</div></div><div class="session-prompt">${displayPrompt}</div></div>`;
        }).join('')}</div>`;
    } else {
        sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No recent sessions found.</div>';
    }

    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
    attachViewAllSessionsHandler();
  } catch (error) {
    sourcesListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">Failed to load sources: ${error.message}</div>`;
    sessionsListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">Failed to load sessions: ${error.message}</div>`;
    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
  }
}

async function loadSessionsPage() {
    const user = window.auth?.currentUser;
    if (!user) return;

    const allSessionsList = document.getElementById('allSessionsList');
    const loadMoreSection = document.getElementById('sessionsLoadMore');
    const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');

    try {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading...';

      const { getDecryptedJulesKey } = await import('./jules-api.js');
      const apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        throw new Error('Jules API key not found');
      }

      const result = await listJulesSessions(apiKey, 50, sessionNextPageToken);

      if (result.sessions && result.sessions.length > 0) {
        allSessionsCache = [...allSessionsCache, ...result.sessions];
        sessionNextPageToken = result.nextPageToken || null;

        renderAllSessions(allSessionsCache);

        if (sessionNextPageToken) {
          loadMoreSection.style.display = 'block';
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = 'Load More';
        } else {
          loadMoreSection.style.display = 'none';
        }
      } else if (allSessionsCache.length === 0) {
        allSessionsList.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">No sessions found</div>';
      }
    } catch (error) {
      if (allSessionsCache.length === 0) {
        allSessionsList.innerHTML = `<div style="color:#e74c3c; text-align:center; padding:24px;">Failed to load sessions: ${error.message}</div>`;
      }
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load More';
    }
  }

  function renderAllSessions(sessions) {
    const allSessionsList = document.getElementById('allSessionsList');
    const searchInput = document.getElementById('sessionSearchInput');
    const searchTerm = searchInput.value.toLowerCase();

    const filteredSessions = searchTerm
      ? sessions.filter(s => {
          const promptText = s.prompt || s.displayName || '';
          const sessionId = s.name?.split('/').pop() || '';
          return promptText.toLowerCase().includes(searchTerm) || sessionId.toLowerCase().includes(searchTerm);
        })
      : sessions;

    if (filteredSessions.length === 0) {
      allSessionsList.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">No sessions match your search</div>';
      return;
    }

    const stateEmoji = { 'PLANNING': '📝', 'IN_PROGRESS': '⚙️', 'AWAITING_USER_FEEDBACK': '💬', 'COMPLETED': '✅', 'FAILED': '❌', 'CANCELLED': '🚫' };
    const stateLabel = { 'PLANNING': 'IN PROGRESS', 'IN_PROGRESS': 'IN PROGRESS', 'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK', 'COMPLETED': 'COMPLETED', 'FAILED': 'FAILED', 'CANCELLED': 'CANCELLED' };

    allSessionsList.innerHTML = filteredSessions.map(session => {
      if (session.parentTask) return '';

      const sessionId = session.name?.split('/').pop() || '';
      const state = session.state || 'UNKNOWN';
      const emoji = stateEmoji[state] || '❓';
      const label = stateLabel[state] || state.replace(/_/g, ' ');
      const promptText = session.prompt || session.displayName || sessionId;
      const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
      const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
      const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
      const prUrl = session.githubPrUrl || null;
      const prLink = prUrl ? `<div style="margin-top:4px;" onclick="event.stopPropagation();"><a href="${prUrl}" target="_blank" style="font-size:11px; color:var(--accent); text-decoration:none;">🔗 View PR</a></div>` : '';
      const subtaskCount = session.childTasks?.length || 0;
      const subtaskInfo = subtaskCount > 0 ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;">📋 ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}</div>` : '';

      return `<div style="padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'; this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.borderColor='var(--border)'; this.style.background='rgba(255,255,255,0.03)'" onclick="window.open('https://jules.google.com/session/${sessionId}', '_blank')"><div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;"><div style="font-weight:600; font-size:13px; flex:1; margin-right:8px;">${displayTitle}</div><div style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1); white-space:nowrap; margin-left:8px;"> ${emoji} ${label}</div></div><div style="font-size:11px; color:var(--muted); margin-bottom:2px;">Created: ${createTime}</div><div style="font-size:11px; color:var(--muted);">Updated: ${updateTime}</div>${subtaskInfo}${prLink}</div>`;
    }).filter(html => html).join('');
  }
