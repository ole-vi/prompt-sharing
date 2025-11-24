// ===== Jules Integration Module =====

import { getCurrentUser } from './auth.js';
import { 
  analyzePromptStructure, 
  buildSubtaskSequence, 
  generateSplitSummary, 
  validateSubtasks 
} from './subtask-manager.js';
import { loadJulesProfileInfo } from './jules-api.js';

export async function checkJulesKey(uid) {
  try {
    if (!window.db) {
      console.error('Firestore not initialized');
      return false;
    }
    console.log('[DEBUG] Checking Jules key for uid:', uid);
    const doc = await window.db.collection('julesKeys').doc(uid).get();
    console.log('[DEBUG] Jules key exists:', doc.exists);
    return doc.exists;
  } catch (error) {
    console.error('Error checking Jules key:', error);
    return false;
  }
}

export async function deleteStoredJulesKey(uid) {
  try {
    if (!window.db) return false;
    await window.db.collection('julesKeys').doc(uid).delete();
    return true;
  } catch (error) {
    console.error('Error deleting Jules key:', error);
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
    console.error('Failed to encrypt/store key:', error);
    throw error;
  }
}

export async function callRunJulesFunction(promptText, environment = "myplanet") {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return null;
  }

  try {
    const julesBtn = document.getElementById('julesBtn');
    const originalText = julesBtn.textContent;
    julesBtn.textContent = 'Running...';
    julesBtn.disabled = true;

    const token = await user.getIdToken(true);
    const functionUrl = 'https://us-central1-prompt-sharing-f8eeb.cloudfunctions.net/runJulesHttp';

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ promptText: promptText || '', environment: environment })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    julesBtn.textContent = originalText;
    julesBtn.disabled = false;

    return result.sessionUrl || null;
  } catch (error) {
    console.error('Cloud function call failed:', error);
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
    console.error('Error in Try in Jules:', error);
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
    console.log('[DEBUG] handleTryInJulesAfterAuth - checking for Jules key');
    const hasKey = await checkJulesKey(user.uid);
    console.log('[DEBUG] hasKey:', hasKey);
    
    if (!hasKey) {
      console.log('[DEBUG] No key found, showing key modal');
      showJulesKeyModal(() => {
        console.log('[DEBUG] Key saved, showing env modal');
        showJulesEnvModal(promptText);
      });
    } else {
      console.log('[DEBUG] Key found, showing env modal');
      showJulesEnvModal(promptText);
    }
  } catch (error) {
    console.error('Error in Jules flow:', error);
    alert('An error occurred. Please try again.');
  }
}

export function showJulesKeyModal(onSave) {
  const modal = document.getElementById('julesKeyModal');
  const input = document.getElementById('julesKeyInput');
  
  console.log('[DEBUG] showJulesKeyModal called');
  console.log('[DEBUG] Modal element:', modal);
  console.log('[DEBUG] Input element:', input);
  
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
      console.error('Failed to save Jules key:', error);
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

export function showJulesEnvModal(promptText) {
  const modal = document.getElementById('julesEnvModal');
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');

  const planetBtn = document.getElementById('envPlanetBtn');
  const myplanetBtn = document.getElementById('envMyplanetBtn');
  const cancelBtn = document.getElementById('julesEnvCancelBtn');

  const handleSelect = async (environment) => {
    hideJulesEnvModal();
    
    let retryCount = 0;
    let maxRetries = 3;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const sessionUrl = await callRunJulesFunction(promptText, environment);
        if (sessionUrl) {
          window.open(sessionUrl, '_blank', 'noopener,noreferrer');
        }
        submitted = true;
      } catch (error) {
        console.error('Error submitting task to Jules:', error);
        retryCount++;
        console.log(`[Jules] Error on attempt ${retryCount}/${maxRetries}`);

        if (retryCount < maxRetries) {
          console.log('[Jules] Showing error modal');
          const result = await showSubtaskErrorModal(1, 1, error);
          console.log(`[Jules] User chose: ${result.action}`);

          if (result.action === 'cancel') {
            console.log('[Jules] Cancelled');
            return;
          } else if (result.action === 'skip') {
            console.log('[Jules] Skipped');
            return;
          } else if (result.action === 'retry') {
            if (result.shouldDelay) {
              console.log('[Jules] Waiting 5 seconds before retry...');
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            console.log(`[Jules] Retrying (attempt ${retryCount + 1}/${maxRetries})`);
          }
        } else {
          const result = await showSubtaskErrorModal(1, 1, error);
          
          if (result.action === 'retry') {
            console.log('[Jules] Max retries reached but user wants to retry, trying one more time...');
            if (result.shouldDelay) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            // One final attempt
            try {
              const sessionUrl = await callRunJulesFunction(promptText, environment);
              if (sessionUrl) {
                window.open(sessionUrl, '_blank', 'noopener,noreferrer');
              }
              submitted = true;
            } catch (finalError) {
              alert('Failed to submit task after multiple retries. Please try again later.');
              console.error('[Jules] Final retry failed:', finalError);
            }
          } else {
            console.log('[Jules] Task not submitted after max retries');
          }
          return;
        }
      }

      if (!submitted) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  planetBtn.onclick = () => handleSelect('planet');
  myplanetBtn.onclick = () => handleSelect('myplanet');
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
    console.log('[ErrorModal] Showing error modal for subtask', subtaskNumber);
    const modal = document.getElementById('subtaskErrorModal');
    const subtaskNumDiv = document.getElementById('errorSubtaskNumber');
    const messageDiv = document.getElementById('errorMessage');
    const detailsDiv = document.getElementById('errorDetails');
    const retryBtn = document.getElementById('subtaskErrorRetryBtn');
    const skipBtn = document.getElementById('subtaskErrorSkipBtn');
    const cancelBtn = document.getElementById('subtaskErrorCancelBtn');
    const retryDelayCheckbox = document.getElementById('errorRetryDelayCheckbox');

    if (!modal) {
      console.error('[ErrorModal] Modal element not found!');
      resolve({ action: 'cancel', shouldDelay: false });
      return;
    }

    subtaskNumDiv.textContent = `Subtask ${subtaskNumber} of ${totalSubtasks}`;
    messageDiv.textContent = error.message || String(error);
    detailsDiv.textContent = error.toString();

    modal.style.removeProperty('display');
    modal.style.setProperty('display', 'flex', 'important');
    console.log('[ErrorModal] Modal displayed, waiting for user action...', modal.style.display);

    const handleAction = (action) => {
      console.log('[ErrorModal] User selected:', action);
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

// Expose for console testing
window.deleteJulesKey = async function() {
  const user = window.auth?.currentUser;
  if (!user) {
    console.log('Not logged in');
    return;
  }
  const deleted = await deleteStoredJulesKey(user.uid);
  if (deleted) {
    console.log('✓ Jules key deleted. You can now enter a new one.');
  } else {
    console.log('✗ Failed to delete Jules key');
  }
};

window.checkJulesKeyStatus = async function() {
  const user = window.auth?.currentUser;
  if (!user) {
    console.log('Not logged in');
    return;
  }
  const hasKey = await checkJulesKey(user.uid);
  console.log('Jules key stored:', hasKey ? '✓ Yes' : '✗ No');
};

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
      resetBtn.style.display = 'block';
      julesProfileInfoSection.style.display = 'block';
      
      // Load Jules profile info automatically when key exists
      await loadAndDisplayJulesProfile(user.uid);
    } else {
      addBtn.style.display = 'block';
      resetBtn.style.display = 'none';
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
        resetBtn.textContent = '🔄 Reset Jules API Key';
        resetBtn.disabled = false;
        
        // Update buttons
        addBtn.style.display = 'block';
        resetBtn.style.display = 'none';
        julesProfileInfoSection.style.display = 'none';
        
        alert('Jules API key has been deleted. You can enter a new one next time.');
      } else {
        throw new Error('Failed to delete key');
      }
    } catch (error) {
      console.error('Error resetting Jules key:', error);
      alert('Failed to reset API key: ' + error.message);
      resetBtn.textContent = '🔄 Reset Jules API Key';
      resetBtn.disabled = false;
    }
  };

  // Load Jules Info button handler
  loadJulesInfoBtn.onclick = async () => {
    await loadAndDisplayJulesProfile(user.uid);
  };

  closeBtn.onclick = () => {
    hideUserProfileModal();
  };
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
          'QUEUED': '⏸️'
        }[state] || '❓';
        
        // Better state labels
        const stateLabel = {
          'COMPLETED': 'COMPLETED',
          'FAILED': 'FAILED',
          'IN_PROGRESS': 'IN PROGRESS',
          'PLANNING': 'IN PROGRESS',
          'QUEUED': 'QUEUED'
        }[state] || state;
        
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

  } catch (error) {
    console.error('Error loading Jules profile:', error);
    
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
    console.error('Error in free input flow:', error);
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
      console.error('Error submitting free input:', error);
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
      console.error('Error with split:', error);
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
  console.log('[DEBUG] showSubtaskSplitModal called with prompt length:', promptText.length);
  currentFullPrompt = promptText;
  
  const modal = document.getElementById('subtaskSplitModal');
  const editPanel = document.getElementById('splitEditPanel');
  const confirmBtn = document.getElementById('splitConfirmBtn');
  const cancelBtn = document.getElementById('splitCancelBtn');

  // Analyze the prompt structure
  const analysis = analyzePromptStructure(promptText);
  currentSubtasks = analysis.subtasks;
  
  console.log('[DEBUG] Analysis complete, subtasks:', currentSubtasks.length);

  // Show modal
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');

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

function renderSplitEdit(subtasks) {
  const editList = document.getElementById('splitEditList');
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
      console.log('[DEBUG] Checkbox changed, currentSubtasks now:', currentSubtasks.length);
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
  console.log('[DEBUG] submitSubtasks called with:', subtasks.length, 'subtasks');
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
    
    console.log(`[Subtask] Sending part ${subtask.sequenceInfo.current}/${subtask.sequenceInfo.total}`);
    
    let retryCount = 0;
    let maxRetries = 3;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const sessionUrl = await callRunJulesFunction(subtask.fullContent, 'myplanet');
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
        console.error(`Error submitting subtask ${subtask.sequenceInfo.current}:`, error);
        retryCount++;
        console.log(`[Subtask] Error on attempt ${retryCount}/${maxRetries}`);

        if (retryCount < maxRetries) {
          console.log(`[Subtask] Showing error modal for subtask ${subtask.sequenceInfo.current}`);
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );
          console.log(`[Subtask] User chose: ${result.action}`);

          if (result.action === 'cancel') {
            console.log('[Subtask] Cancelling all remaining tasks');
            alert(`✗ Cancelled. Submitted ${successCount} of ${totalCount} subtasks before cancellation.`);
            return;
          } else if (result.action === 'skip') {
            console.log(`[Subtask] Skipping subtask ${subtask.sequenceInfo.current}`);
            skippedCount++;
            submitted = true;
          } else if (result.action === 'retry') {
            if (result.shouldDelay) {
              console.log('[Subtask] Waiting 5 seconds before retry...');
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            console.log(`[Subtask] Retrying subtask ${subtask.sequenceInfo.current} (attempt ${retryCount + 1}/${maxRetries})`);
          }
        } else {
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );

          if (result.action === 'cancel') {
            console.log('[Subtask] Cancelling all remaining tasks');
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
  console.log('[Subtask] Summary:', summary);
}

