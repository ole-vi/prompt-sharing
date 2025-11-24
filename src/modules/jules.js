// ===== Jules Integration Module =====

import { getCurrentUser } from './auth.js';
import { 
  analyzePromptStructure, 
  buildSubtaskSequence, 
  generateSplitSummary, 
  validateSubtasks 
} from './subtask-manager.js';
import { loadJulesProfileInfo, listJulesSessions } from './jules-api.js';

// Store the last selected repository for subtasks
let lastSelectedSourceId = 'sources/github/open-learning-exchange/myplanet';
let lastSelectedBranch = 'master';

export async function checkJulesKey(uid) {
  try {
    if (!window.db) {
      return false;
    }
    const doc = await window.db.collection('julesKeys').doc(uid).get();
    return doc.exists;
  } catch (error) {
    return false;
  }
}

export async function deleteStoredJulesKey(uid) {
  try {
    if (!window.db) return false;
    await window.db.collection('julesKeys').doc(uid).delete();
    return true;
  } catch (error) {
    return false;
  }
}

export async function encryptAndStoreKey(plaintext, uid) {
  try {
    const paddedUid = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyData = new TextEncoder().encode(paddedUid);
    const key = await window.crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);

    const ivString = uid.slice(0, 12).padEnd(12, '0');
    const iv = new TextEncoder().encode(ivString).slice(0, 12);
    const plaintextData = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextData);
    const encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

    if (!window.db) throw new Error('Firestore not initialized');
    await window.db.collection('julesKeys').doc(uid).set({
      key: encrypted,
      storedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    throw error;
  }
}

export async function callRunJulesFunction(promptText, sourceId, branch = 'master') {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return null;
  }

  if (!sourceId) {
    throw new Error('No repository selected');
  }

  try {
    const julesBtn = document.getElementById('julesBtn');
    const originalText = julesBtn.textContent;
    julesBtn.textContent = 'Running...';
    julesBtn.disabled = true;

    const token = await user.getIdToken(true);
    const functionUrl = 'https://runjuleshttp-n7gaasoeoq-uc.a.run.app';

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ promptText: promptText || '', sourceId: sourceId, branch: branch })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    julesBtn.textContent = originalText;
    julesBtn.disabled = false;

    return result.sessionUrl || null;
  } catch (error) {
    const julesBtn = document.getElementById('julesBtn');
    if (julesBtn) {
      julesBtn.textContent = '⚡ Try in Jules';
      julesBtn.disabled = false;
    }
    throw error;
  }
}

export async function handleTryInJules(promptText) {
  try {
    const user = window.auth ? window.auth.currentUser : null;
    if (!user) {
      try {
        const { signInWithGitHub } = await import('./auth.js');
        await signInWithGitHub();
        setTimeout(() => handleTryInJulesAfterAuth(promptText), 500);
      } catch (error) {
        alert('Login required to use Jules.');
      }
      return;
    }
    await handleTryInJulesAfterAuth(promptText);
  } catch (error) {
    alert('An error occurred: ' + error.message);
  }
}

export async function handleTryInJulesAfterAuth(promptText) {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return;
  }

  try {
    const hasKey = await checkJulesKey(user.uid);
    
    if (!hasKey) {
      showJulesKeyModal(() => {
        showJulesEnvModal(promptText);
      });
    } else {
      showJulesEnvModal(promptText);
    }
  } catch (error) {
    alert('An error occurred. Please try again.');
  }
}

export function showJulesKeyModal(onSave) {
  const modal = document.getElementById('julesKeyModal');
  const input = document.getElementById('julesKeyInput');
  
  
  // Use setAttribute to set display with !important
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

  const favoriteContainer = document.getElementById('favoriteReposContainer');
  const allReposContainer = document.getElementById('allReposContainer');
  const dropdownBtn = document.getElementById('julesRepoDropdownBtn');
  const dropdownText = document.getElementById('julesRepoDropdownText');
  const dropdownMenu = document.getElementById('julesRepoDropdownMenu');
  const cancelBtn = document.getElementById('julesEnvCancelBtn');
  
  const user = getCurrentUser();
  if (!user) {
    favoriteContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding:12px;">Please sign in first</div>';
    allReposContainer.style.display = 'none';
    return;
  }

  const { DEFAULT_FAVORITE_REPOS, STORAGE_KEY_FAVORITE_REPOS } = await import('../utils/constants.js');
  
  const storedFavorites = localStorage.getItem(STORAGE_KEY_FAVORITE_REPOS);
  const favorites = storedFavorites ? JSON.parse(storedFavorites) : DEFAULT_FAVORITE_REPOS;

  favoriteContainer.innerHTML = '';
  allReposContainer.style.display = 'block';
  
  if (favorites && favorites.length > 0) {
    favorites.forEach(fav => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'padding:12px; text-align:left; border:1px solid var(--border); background:transparent; cursor:pointer; border-radius:8px; font-weight:600; transition:all 0.2s; width:100%;';
      btn.textContent = `${fav.emoji || '📦'} ${fav.name}`;
      btn.onclick = () => handleRepoSelect(fav.id, fav.branch || 'master', promptText);
      favoriteContainer.appendChild(btn);
    });
  } else {
    favoriteContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding:12px;">No favorite repositories</div>';
  }

  let allReposLoaded = false;
  let sourceBranchMap = {};

  const loadAllRepos = async () => {
    if (allReposLoaded) return;
    
    dropdownText.textContent = 'Loading...';
    dropdownBtn.disabled = true;
    dropdownMenu.style.display = 'none';

    try {
      const { listJulesSources } = await import('./jules-api.js');
      const { getDecryptedJulesKey } = await import('./jules-api.js');
      
      const apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        dropdownText.textContent = 'No API key configured';
        dropdownBtn.disabled = false;
        return;
      }

      const sourcesData = await listJulesSources(apiKey);
      const sources = sourcesData.sources || [];

      if (sources.length === 0) {
        dropdownText.textContent = 'No repositories found';
        dropdownBtn.disabled = false;
        return;
      }

      dropdownText.textContent = 'Select a repository...';
      dropdownBtn.disabled = false;
      dropdownMenu.innerHTML = '';
      
      sources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'custom-dropdown-item';
        const pathParts = (source.name || source.id).split('/');
        const repoName = pathParts.slice(-2).join('/');
        item.textContent = repoName;
        item.dataset.value = source.name || source.id;
        
        // Try to get default branch from source, fallback to master
        const defaultBranch = source.githubRepoContext?.defaultBranch || 
                             source.defaultBranch || 
                             'master';
        sourceBranchMap[source.name || source.id] = defaultBranch;
        
        item.onclick = () => {
          dropdownMenu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          dropdownText.textContent = repoName;
          dropdownMenu.style.display = 'none';
          const branch = sourceBranchMap[item.dataset.value] || 'master';
          handleRepoSelect(item.dataset.value, branch, promptText);
        };
        
        dropdownMenu.appendChild(item);
      });

      allReposLoaded = true;
      dropdownMenu.style.display = 'block';
    } catch (error) {
      dropdownText.textContent = 'Failed to load - click to retry';
      dropdownBtn.disabled = false;
      allReposLoaded = false;
    }
  };

  dropdownBtn.onclick = () => {
    if (dropdownMenu.style.display === 'block') {
      dropdownMenu.style.display = 'none';
    } else {
      loadAllRepos();
    }
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!allReposContainer.contains(e.target)) {
      dropdownMenu.style.display = 'none';
    }
  });

  cancelBtn.onclick = () => {
    hideJulesEnvModal();
  };
}

async function handleRepoSelect(sourceId, branch, promptText) {
  hideJulesEnvModal();
  
  // Store the selected repository for future subtask submissions
  lastSelectedSourceId = sourceId;
  lastSelectedBranch = branch || 'master';
  
  let retryCount = 0;
  let maxRetries = 3;
  let submitted = false;

  while (retryCount < maxRetries && !submitted) {
    try {
      const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch);
      if (sessionUrl) {
        window.open(sessionUrl, '_blank', 'noopener,noreferrer');
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
        } else if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      } else {
        const result = await showSubtaskErrorModal(1, 1, error);
        
        if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          try {
            const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch);
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

      hideSubtaskErrorModal();

      const shouldDelay = action === 'retry' ? retryDelayCheckbox.checked : false;
      resolve({ action, shouldDelay });
    };

    retryBtn.onclick = () => handleAction('retry');
    skipBtn.onclick = () => handleAction('skip');
    cancelBtn.onclick = () => handleAction('cancel');
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
  const freeInputModal = document.getElementById('freeInputModal');
  const profileModal = document.getElementById('userProfileModal');
  const sessionsHistoryModal = document.getElementById('julesSessionsHistoryModal');
  const errorModal = document.getElementById('subtaskErrorModal');
  const keyInput = document.getElementById('julesKeyInput');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (keyModal.style.display === 'flex') {
        hideJulesKeyModal();
      }
      if (envModal.style.display === 'flex') {
        hideJulesEnvModal();
      }
      if (freeInputModal && freeInputModal.style.display === 'flex') {
        hideFreeInputForm();
      }
      if (profileModal.style.display === 'flex') {
        hideUserProfileModal();
      }
      if (sessionsHistoryModal && sessionsHistoryModal.style.display === 'flex') {
        hideJulesSessionsHistoryModal();
      }
    }
  });

  keyModal.addEventListener('click', (e) => {
    if (e.target === keyModal) {
      hideJulesKeyModal();
    }
  });

  envModal.addEventListener('click', (e) => {
    if (e.target === envModal) {
      hideJulesEnvModal();
    }
  });

  if (freeInputModal) {
    freeInputModal.addEventListener('click', (e) => {
      if (e.target === freeInputModal) {
        hideFreeInputForm();
      }
    });
  }

  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
      hideUserProfileModal();
    }
  });
  
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

  keyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('julesSaveBtn').click();
    }
  });
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

  profileUserName.textContent = user.displayName || user.email || 'Unknown User';

  checkJulesKey(user.uid).then(async (hasKey) => {
    julesKeyStatus.textContent = hasKey ? '✓ Saved' : '✗ Not saved';
    julesKeyStatus.style.color = hasKey ? 'var(--accent)' : 'var(--muted)';
    
    // Show/hide buttons based on key status
    if (hasKey) {
      addBtn.style.display = 'none';
      dangerZoneSection.style.display = 'block';
      julesProfileInfoSection.style.display = 'block';
      
      // Load Jules profile info automatically when key exists
      await loadAndDisplayJulesProfile(user.uid);
    } else {
      addBtn.style.display = 'block';
      dangerZoneSection.style.display = 'none';
      julesProfileInfoSection.style.display = 'none';
    }
  });

  // Add button handler - shows key modal
  addBtn.onclick = () => {
    hideUserProfileModal();
    showJulesKeyModal(() => {
      // After key is saved, reopen profile modal
      setTimeout(() => showUserProfileModal(), 500);
    });
  };

  resetBtn.onclick = async () => {
    if (!confirm('This will delete your stored Jules API key. You\'ll need to enter a new one next time.')) {
      return;
    }
    try {
      resetBtn.disabled = true;
      resetBtn.textContent = 'Deleting...';
      const deleted = await deleteStoredJulesKey(user.uid);
      if (deleted) {
        julesKeyStatus.textContent = '✗ Not saved';
        julesKeyStatus.style.color = 'var(--muted)';
        resetBtn.textContent = '🗑️ Delete Jules API Key';
        resetBtn.disabled = false;
        
        // Update buttons
        addBtn.style.display = 'block';
        dangerZoneSection.style.display = 'none';
        julesProfileInfoSection.style.display = 'none';
        
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

  // Load Jules Info button handler
  loadJulesInfoBtn.onclick = async () => {
    await loadAndDisplayJulesProfile(user.uid);
    // Re-attach the View All link handler after profile loads
    attachViewAllSessionsHandler();
  };

  closeBtn.onclick = () => {
    hideUserProfileModal();
  };
  
  // Attach View All Sessions handler
  attachViewAllSessionsHandler();
  
  // Sessions History Modal handlers
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

// Helper function to attach View All Sessions link handler
function attachViewAllSessionsHandler() {
  const viewAllSessionsLink = document.getElementById('viewAllSessionsLink');
  if (viewAllSessionsLink) {
    viewAllSessionsLink.onclick = (e) => {
      e.preventDefault();
      showJulesSessionsHistoryModal();
    };
  }
}

/**
 * Loads and displays Jules profile information in the profile modal
 */
async function loadAndDisplayJulesProfile(uid) {
  const loadBtn = document.getElementById('loadJulesInfoBtn');
  const sourcesListDiv = document.getElementById('julesSourcesList');
  const sessionsListDiv = document.getElementById('julesSessionsList');

  try {
    // Show loading state
    loadBtn.disabled = true;
    loadBtn.textContent = '⏳ Loading...';
    sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sources...</div>';
    sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sessions...</div>';

    // Load profile data
    const profileData = await loadJulesProfileInfo(uid);

    // Display sources
    if (profileData.sources && profileData.sources.length > 0) {
      sourcesListDiv.innerHTML = profileData.sources.map((source, index) => {
        const repoName = source.githubRepo?.name || source.name || source.id;
        // Extract owner/repo from the full path (e.g., "sources/github/owner/repo" -> "owner/repo")
        const githubPath = repoName.includes('github/') 
          ? repoName.split('github/')[1] 
          : repoName.replace('sources/', '');
        const branches = source.branches || [];
        const sourceId = `source-${index}`;
        const branchList = branches.length > 0 
          ? `<div id="${sourceId}-branches" style="margin-top:6px; padding-left:12px; font-size:12px; color:var(--muted); display:none;">
               <div style="margin-bottom:4px; color:var(--text);">🌿 Branches (${branches.length}):</div>
               ${branches.map(b => `<div style="padding:4px 0 4px 8px; cursor:pointer; transition:color 0.2s;" 
                  onmouseover="this.style.color='var(--accent)'" 
                  onmouseout="this.style.color='var(--muted)'" 
                  onclick="window.open('https://github.com/${githubPath}/tree/${encodeURIComponent(b.displayName || b.name)}', '_blank')">
                  • ${b.displayName || b.name}
                </div>`).join('')}
             </div>`
          : '<div id="' + sourceId + '-branches" style="display:none; margin-top:6px; padding-left:12px; font-size:12px; color:var(--muted); font-style:italic;">No branches found</div>';
        
        const branchSummary = branches.length > 0 
          ? `<span style="color:var(--muted); font-size:11px; margin-left:8px;">(${branches.length} ${branches.length === 1 ? 'branch' : 'branches'})</span>`
          : '<span style="color:var(--muted); font-size:11px; margin-left:8px;">(no branches)</span>';
        
        return `<div style="padding:8px; margin-bottom:4px; border-bottom:1px solid var(--border); font-size:13px;">
          <div style="font-weight:600; cursor:pointer; user-select:none; display:flex; align-items:center; transition:color 0.2s;" 
               onclick="(function(e) {
                 const branches = document.getElementById('${sourceId}-branches');
                 const arrow = e.currentTarget.querySelector('.expand-arrow');
                 if (branches.style.display === 'none') {
                   branches.style.display = 'block';
                   arrow.textContent = '▼';
                 } else {
                   branches.style.display = 'none';
                   arrow.textContent = '▶';
                 }
               })(event)"
               onmouseover="this.style.color='var(--accent)'"
               onmouseout="this.style.color='var(--text)'">
            <span class="expand-arrow" style="display:inline-block; width:12px; font-size:10px; margin-right:6px;">▶</span>
            <span>📂 ${githubPath}</span>
            ${branchSummary}
          </div>
          ${branchList}
        </div>`;
      }).join('');
    } else {
      sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No connected repositories found.<br><small>Connect repos in the Jules UI.</small></div>';
    }

    // Display sessions
    if (profileData.sessions && profileData.sessions.length > 0) {
      sessionsListDiv.innerHTML = profileData.sessions.map(session => {
        const state = session.state || 'UNKNOWN';
        const stateEmoji = {
          'COMPLETED': '✅',
          'FAILED': '❌',
          'IN_PROGRESS': '⏳',
          'PLANNING': '⏳',
          'QUEUED': '⏸️',
          'AWAITING_USER_FEEDBACK': '💬'
        }[state] || '❓';
        
        // Better state labels
        const stateLabel = {
          'COMPLETED': 'COMPLETED',
          'FAILED': 'FAILED',
          'IN_PROGRESS': 'IN PROGRESS',
          'PLANNING': 'IN PROGRESS',
          'QUEUED': 'QUEUED',
          'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK'
        }[state] || state.replace(/_/g, ' ');
        
        const promptPreview = (session.prompt || 'No prompt text').substring(0, 80);
        const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
        const createdAt = session.createTime ? new Date(session.createTime).toLocaleDateString() : 'Unknown';
        const prUrl = session.outputs?.[0]?.pullRequest?.url;
        
        // Extract session ID from session name (format: "sessions/123abc")
        // The ID after "sessions/" is the actual session identifier
        const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
        const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
        
        const prLink = prUrl 
          ? `<a href="${prUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); text-decoration:none; font-size:11px; margin-right:8px;" 
              onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">🔗 View PR</a>` 
          : '';
        
        return `<div style="padding:10px; margin-bottom:8px; border:1px solid var(--border); border-radius:8px; font-size:12px; cursor:pointer; transition:all 0.2s; background:rgba(255,255,255,0.02);"
                     onmouseover="this.style.background='rgba(77,217,255,0.05)'; this.style.borderColor='var(--accent)'"
                     onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='var(--border)'"
                     onclick="window.open('${sessionUrl}', '_blank', 'noopener,noreferrer')">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;">
            <div style="font-weight:600; flex:1;">${stateEmoji} ${stateLabel}</div>
            <div style="color:var(--muted); font-size:11px;">${createdAt}</div>
          </div>
          <div style="color:var(--text); margin-bottom:6px; line-height:1.4;">${displayPrompt}</div>
          ${prLink ? `<div style="display:flex; gap:8px; align-items:center;" onclick="event.stopPropagation();">
            ${prLink}
            <span style="color:var(--muted); font-size:11px;">Click card to view session →</span>
          </div>` : '<div style="color:var(--muted); font-size:11px;">Click to view session details →</div>'}
        </div>`;
      }).join('');
    } else {
      sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No recent sessions found.</div>';
    }

    // Reset button state
    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
    
    // Attach View All Sessions handler after content loads
    attachViewAllSessionsHandler();

  } catch (error) {
    
    // Display error
    sourcesListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sources: ${error.message}
    </div>`;
    sessionsListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sessions: ${error.message}
    </div>`;

    // Reset button state
    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
  }
}

export function hideUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
}

// Jules Sessions History Modal
let allSessionsCache = [];
let sessionNextPageToken = null;

export function showJulesSessionsHistoryModal() {
  const modal = document.getElementById('julesSessionsHistoryModal');
  const allSessionsList = document.getElementById('allSessionsList');
  const loadMoreSection = document.getElementById('sessionsLoadMore');
  const searchInput = document.getElementById('sessionSearchInput');
  
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
  
  // Reset state
  allSessionsCache = [];
  sessionNextPageToken = null;
  searchInput.value = '';
  
  // Load first page
  loadSessionsPage();
}

export function hideJulesSessionsHistoryModal() {
  const modal = document.getElementById('julesSessionsHistoryModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
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
    
    // Get decrypted API key
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
      
      // Show/hide load more button
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
  
  const stateEmoji = {
    'PLANNING': '📝',
    'IN_PROGRESS': '⚙️',
    'AWAITING_USER_FEEDBACK': '💬',
    'COMPLETED': '✅',
    'FAILED': '❌',
    'CANCELLED': '🚫'
  };
  
  const stateLabel = {
    'PLANNING': 'IN PROGRESS',
    'IN_PROGRESS': 'IN PROGRESS',
    'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK',
    'COMPLETED': 'COMPLETED',
    'FAILED': 'FAILED',
    'CANCELLED': 'CANCELLED'
  };
  
  allSessionsList.innerHTML = filteredSessions.map(session => {
    const sessionId = session.name?.split('/').pop() || '';
    const state = session.state || 'UNKNOWN';
    const emoji = stateEmoji[state] || '❓';
    const label = stateLabel[state] || state.replace(/_/g, ' ');
    
    // Use prompt text as title, fallback to displayName or sessionId
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    const prLink = prUrl 
      ? `<div style="margin-top:4px;"><a href="${prUrl}" target="_blank" style="font-size:11px; color:var(--accent); text-decoration:none;">🔗 View PR</a></div>`
      : '';
    
    return `<div style="padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;"
                 onmouseover="this.style.borderColor='var(--accent)'; this.style.background='rgba(255,255,255,0.06)'"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.background='rgba(255,255,255,0.03)'"
                 onclick="window.open('https://jules.google.com/session/${sessionId}', '_blank')">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;">
        <div style="font-weight:600; font-size:13px; flex:1; margin-right:8px;">${displayTitle}</div>
        <div style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1); white-space:nowrap; margin-left:8px;">
          ${emoji} ${label}
        </div>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-bottom:2px;">Created: ${createTime}</div>
      <div style="font-size:11px; color:var(--muted);">Updated: ${updateTime}</div>
      ${prLink}
    </div>`;
  }).join('');
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
  const modal = document.getElementById('freeInputModal');
  const textarea = document.getElementById('freeInputTextarea');
  const submitBtn = document.getElementById('freeInputSubmitBtn');
  const splitBtn = document.getElementById('freeInputSplitBtn');
  const cancelBtn = document.getElementById('freeInputCancelBtn');

  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
  textarea.value = '';
  textarea.focus();

  const handleSubmit = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alert('Please enter a prompt.');
      return;
    }

    hideFreeInputForm();
    
    try {
      // Submit directly as one (no split modal)
      await handleTryInJulesAfterAuth(promptText);
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

    hideFreeInputForm();
    
    try {
      // Show subtask split modal
      showSubtaskSplitModal(promptText);
    } catch (error) {
      alert('Failed to process prompt: ' + error.message);
    }
  };

  const handleCancel = () => {
    hideFreeInputForm();
  };

  submitBtn.onclick = handleSubmit;
  splitBtn.onclick = handleSplit;
  cancelBtn.onclick = handleCancel;

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  });
}

export function hideFreeInputForm() {
  const modal = document.getElementById('freeInputModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
}

// ===== Subtask Split Flow =====

let currentFullPrompt = '';
let currentSubtasks = [];
let splitMode = 'send-all'; // 'send-all' or 'split-tasks'
let currentAnalysis = null; // Store analysis for mode switching

export function showSubtaskSplitModal(promptText) {
  currentFullPrompt = promptText;
  
  const modal = document.getElementById('subtaskSplitModal');
  const editPanel = document.getElementById('splitEditPanel');
  const confirmBtn = document.getElementById('splitConfirmBtn');
  const cancelBtn = document.getElementById('splitCancelBtn');

  // Analyze the prompt structure
  const analysis = analyzePromptStructure(promptText);
  currentSubtasks = analysis.subtasks;
  
  // Show modal
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');

  // Populate repository selection
  populateSubtaskRepoSelection();

  // Render the checklist
  renderSplitEdit(currentSubtasks);

  // Button handlers
  confirmBtn.onclick = async () => {
    const validation = validateSubtasks(currentSubtasks);
    if (!validation.valid) {
      alert('Error:\n' + validation.errors.join('\n'));
      return;
    }
    
    if (validation.warnings.length > 0) {
      const proceed = confirm('Warnings:\n' + validation.warnings.join('\n') + '\n\nProceed anyway?');
      if (!proceed) return;
    }

    // Save subtasks BEFORE hiding modal (which clears them)
    const subtasksToSubmit = [...currentSubtasks];
    hideSubtaskSplitModal();
    await submitSubtasks(subtasksToSubmit);
  };

  cancelBtn.onclick = () => {
    hideSubtaskSplitModal();
  };
}

async function populateSubtaskRepoSelection() {
  const favoriteContainer = document.getElementById('subtaskFavoriteReposContainer');
  const allReposContainer = document.getElementById('subtaskAllReposContainer');
  const dropdownBtn = document.getElementById('subtaskRepoDropdownBtn');
  const dropdownText = document.getElementById('subtaskRepoDropdownText');
  const dropdownMenu = document.getElementById('subtaskRepoDropdownMenu');
  
  const user = getCurrentUser();
  if (!user) {
    favoriteContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding:8px; font-size:13px;">Please sign in first</div>';
    allReposContainer.style.display = 'none';
    return;
  }

  const { DEFAULT_FAVORITE_REPOS, STORAGE_KEY_FAVORITE_REPOS } = await import('../utils/constants.js');
  
  const storedFavorites = localStorage.getItem(STORAGE_KEY_FAVORITE_REPOS);
  const favorites = storedFavorites ? JSON.parse(storedFavorites) : DEFAULT_FAVORITE_REPOS;

  favoriteContainer.innerHTML = '';
  allReposContainer.style.display = 'block';
  
  // Render favorite buttons
  if (favorites && favorites.length > 0) {
    favorites.forEach(fav => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'padding:8px; text-align:left; border:1px solid var(--border); background:transparent; cursor:pointer; border-radius:6px; font-weight:600; transition:all 0.2s; width:100%; font-size:13px;';
      btn.textContent = `${fav.emoji || '📦'} ${fav.name}`;

      // Check if this is the currently selected repo
      if (fav.id === lastSelectedSourceId) {
        btn.style.cssText += ' background:rgba(99,102,241,0.1); border-color:#6366f1;';
      }
      
      btn.onclick = () => {
        lastSelectedSourceId = fav.id;
        lastSelectedBranch = fav.branch || 'master';
        // Update button styling
        favoriteContainer.querySelectorAll('button').forEach(b => {
          b.style.cssText = 'padding:8px; text-align:left; border:1px solid var(--border); background:transparent; cursor:pointer; border-radius:6px; font-weight:600; transition:all 0.2s; width:100%; font-size:13px;';
        });
        btn.style.cssText += ' background:rgba(99,102,241,0.1); border-color:#6366f1;';
      };
      favoriteContainer.appendChild(btn);
    });
  } else {
    favoriteContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding:8px; font-size:13px;">No favorite repositories</div>';
  }

  let allReposLoaded = false;

  const loadAllRepos = async () => {
    if (allReposLoaded) return;
    
    dropdownText.textContent = 'Loading...';
    dropdownBtn.disabled = true;
    dropdownMenu.innerHTML = '';

    try {
      const { listJulesSources } = await import('./jules-api.js');
      const { getDecryptedJulesKey } = await import('./jules-api.js');
      
      const apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        dropdownText.textContent = 'No API key configured';
        dropdownBtn.disabled = false;
        return;
      }

      const sourcesData = await listJulesSources(apiKey);
      const sources = sourcesData.sources || [];

      if (sources.length === 0) {
        dropdownText.textContent = 'No repositories found';
        dropdownBtn.disabled = false;
        return;
      }

      dropdownText.textContent = 'Select a repository...';
      dropdownBtn.disabled = false;
      
      // Store branch information for each source
      const sourceBranchMap = {};
      
      sources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'custom-dropdown-item';
        const pathParts = (source.name || source.id).split('/');
        const repoName = pathParts.slice(-2).join('/');
        item.textContent = repoName;
        item.dataset.sourceId = source.name || source.id;
        
        // Try to get default branch from source, fallback to master
        const defaultBranch = source.githubRepoContext?.defaultBranch || 
                             source.defaultBranch || 
                             'master';
        sourceBranchMap[source.name || source.id] = defaultBranch;
        item.dataset.branch = defaultBranch;
        
        item.onclick = () => {
          lastSelectedSourceId = item.dataset.sourceId;
          lastSelectedBranch = item.dataset.branch;
          dropdownText.textContent = repoName;
          
          // Update selected styling
          dropdownMenu.querySelectorAll('.custom-dropdown-item').forEach(i => {
            i.classList.remove('selected');
          });
          item.classList.add('selected');
          
          // Close dropdown
          dropdownMenu.style.display = 'none';
        };
        
        dropdownMenu.appendChild(item);
      });

      allReposLoaded = true;
      
      // Auto-display the dropdown after loading
      dropdownMenu.style.display = 'block';
      
    } catch (error) {
      dropdownText.textContent = 'Failed to load - click to retry';
      dropdownBtn.disabled = false;
      allReposLoaded = false;
    }
  };

  dropdownBtn.onclick = loadAllRepos;
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.style.display = 'none';
    }
  });
}

function renderSplitEdit(subtasks) {
  const editList = document.getElementById('splitEditList');
  
  if (!subtasks || subtasks.length === 0) {
    editList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--muted); font-size: 13px;">No subtasks detected. This prompt will be sent as a single task.</div>';
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
      </div>
    `)
    .join('');

  // Add change listeners to checkboxes
  subtasks.forEach((_, idx) => {
    const checkbox = document.getElementById(`subtask-${idx}`);
    checkbox.addEventListener('change', () => {
      // Filter based on checked state
      currentSubtasks = subtasks.filter((_, i) => {
        return document.getElementById(`subtask-${i}`).checked;
      });
    });
  });
}

export function hideSubtaskSplitModal() {
  const modal = document.getElementById('subtaskSplitModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
  currentSubtasks = [];
  splitMode = 'send-all';
}

async function submitSubtasks(subtasks) {
  const sequenced = buildSubtaskSequence(currentFullPrompt, subtasks);
  
  // Show confirmation
  const totalCount = sequenced.length;
  const proceed = confirm(
    `Ready to send ${totalCount} subtask${totalCount > 1 ? 's' : ''} to Jules.\n\n` +
    `Each subtask will be submitted sequentially. This may take a few minutes.\n\n` +
    `Proceed?`
  );

  if (!proceed) return;

  // Submit each subtask with error handling
  let skippedCount = 0;
  let successCount = 0;
  
  for (let i = 0; i < sequenced.length; i++) {
    const subtask = sequenced[i];
    const status = `(${subtask.sequenceInfo.current}/${subtask.sequenceInfo.total})`;
    
    
    let retryCount = 0;
    let maxRetries = 3;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const sessionUrl = await callRunJulesFunction(subtask.fullContent, lastSelectedSourceId, lastSelectedBranch);
        if (sessionUrl) {
          if (successCount < 3) {
            window.open(sessionUrl, '_blank', 'noopener,noreferrer');
          } else if (successCount === 3) {
            alert(`Opening subtask ${subtask.sequenceInfo.current}. Remaining ${totalCount - successCount - 1} subtasks are queued. Check your Jules notifications.`);
            window.open(sessionUrl, '_blank', 'noopener,noreferrer');
          }
        }
        
        successCount++;
        submitted = true;
      } catch (error) {
        retryCount++;

        if (retryCount < maxRetries) {
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );

          if (result.action === 'cancel') {
            alert(`✗ Cancelled. Submitted ${successCount} of ${totalCount} subtasks before cancellation.`);
            return;
          } else if (result.action === 'skip') {
            skippedCount++;
            submitted = true;
          } else if (result.action === 'retry') {
            if (result.shouldDelay) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        } else {
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );

          if (result.action === 'cancel') {
            alert(`✗ Cancelled. Submitted ${successCount} of ${totalCount} subtasks before cancellation.`);
            return;
          } else {
            skippedCount++;
            submitted = true;
          }
        }
      }

      if (!submitted && i < sequenced.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  const summary = `✓ Completed!\n\n` +
    `Successful: ${successCount}/${totalCount}\n` +
    `Skipped: ${skippedCount}/${totalCount}`;
  alert(summary);
}

