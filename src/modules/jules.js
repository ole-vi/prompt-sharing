// ===== Jules Integration Module =====

import { getCurrentUser } from './auth.js';
import { 
  analyzePromptStructure, 
  buildSubtaskSequence, 
  generateSplitSummary, 
  validateSubtasks 
} from './subtask-manager.js';

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
    alert('Failed to invoke Jules function: ' + error.message);
    const julesBtn = document.getElementById('julesBtn');
    julesBtn.textContent = '⚡ Try in Jules';
    julesBtn.disabled = false;
    return null;
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
    const sessionUrl = await callRunJulesFunction(promptText, environment);
    if (sessionUrl) {
      window.open(sessionUrl, '_blank', 'noopener,noreferrer');
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

export function initJulesKeyModalListeners() {
  const keyModal = document.getElementById('julesKeyModal');
  const envModal = document.getElementById('julesEnvModal');
  const freeInputModal = document.getElementById('freeInputModal');
  const profileModal = document.getElementById('userProfileModal');
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

  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');

  const profileUserName = document.getElementById('profileUserName');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const resetBtn = document.getElementById('resetJulesKeyBtn');
  const closeBtn = document.getElementById('closeProfileBtn');

  profileUserName.textContent = user.displayName || user.email || 'Unknown User';

  checkJulesKey(user.uid).then((hasKey) => {
    julesKeyStatus.textContent = hasKey ? '✓ Saved' : '✗ Not saved';
    julesKeyStatus.style.color = hasKey ? 'var(--accent)' : 'var(--muted)';
    
    // Show/hide buttons based on key status
    if (hasKey) {
      addBtn.style.display = 'none';
      resetBtn.style.display = 'block';
    } else {
      addBtn.style.display = 'block';
      resetBtn.style.display = 'none';
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

  closeBtn.onclick = () => {
    hideUserProfileModal();
  };
}

export function hideUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
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
      // Show subtask split modal instead of going directly to Jules
      showSubtaskSplitModal(promptText);
    } catch (error) {
      console.error('Error submitting free input:', error);
      alert('Failed to submit prompt: ' + error.message);
    }
  };

  const handleCancel = () => {
    hideFreeInputForm();
  };

  submitBtn.onclick = handleSubmit;
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
  splitMode = 'send-all';
  
  const modal = document.getElementById('subtaskSplitModal');
  console.log('[DEBUG] modal element:', modal);
  
  const recommendation = document.getElementById('splitRecommendation');
  const modeAll = document.getElementById('splitModeSendAll');
  const modeSplit = document.getElementById('splitModeSplitTasks');
  const previewPanel = document.getElementById('splitPreviewPanel');
  const summaryPanel = document.getElementById('splitSummary');
  const editPanel = document.getElementById('splitEditPanel');
  const confirmBtn = document.getElementById('splitConfirmBtn');
  const sendAllBtn = document.getElementById('splitSendAllBtn');
  const cancelBtn = document.getElementById('splitCancelBtn');

  console.log('[DEBUG] All elements found:', { recommendation: !!recommendation, modeAll: !!modeAll, modeSplit: !!modeSplit });

  // Analyze the prompt structure
  const analysis = analyzePromptStructure(promptText);
  currentAnalysis = analysis; // Store for mode switching
  currentSubtasks = analysis.subtasks;
  
  console.log('[DEBUG] Analysis complete, subtasks:', currentSubtasks.length);
  recommendation.textContent = analysis.recommendation;

  // Show modal
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
  console.log('[DEBUG] Modal shown');

  // Mode handlers
  const selectMode = (mode) => {
    console.log('[DEBUG] selectMode called:', mode);
    splitMode = mode;
    
    // Update button styles
    if (mode === 'send-all') {
      modeAll.style.borderColor = 'var(--accent)';
      modeAll.style.color = 'var(--accent)';
      modeSplit.style.borderColor = 'var(--border)';
      modeSplit.style.color = 'inherit';
      
      previewPanel.style.display = 'none';
      summaryPanel.style.display = 'none';
      editPanel.style.display = 'none';
      confirmBtn.style.display = 'none';
      sendAllBtn.style.display = 'block';
    } else {
      modeSplit.style.borderColor = 'var(--accent)';
      modeSplit.style.color = 'var(--accent)';
      modeAll.style.borderColor = 'var(--border)';
      modeAll.style.color = 'inherit';
      
      // Make sure currentSubtasks is initialized to all subtasks
      currentSubtasks = currentAnalysis.subtasks;
      console.log('[DEBUG] Switched to split mode, initialized currentSubtasks to:', currentSubtasks.length);
      
      // Show preview and summary
      renderSplitPreview(currentSubtasks);
      previewPanel.style.display = 'block';
      
      // Show summary
      const summary = generateSplitSummary(currentSubtasks);
      document.getElementById('splitCount').textContent = summary.totalSubtasks;
      document.getElementById('splitTime').textContent = summary.estimatedMinutes + 'm';
      summaryPanel.style.display = 'block';
      
      editPanel.style.display = 'block';
      renderSplitEdit(currentSubtasks);
      
      confirmBtn.style.display = 'block';
      sendAllBtn.style.display = 'none';
    }
  };

  modeAll.onclick = () => selectMode('send-all');
  modeSplit.onclick = () => selectMode('split-tasks');

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

  sendAllBtn.onclick = async () => {
    hideSubtaskSplitModal();
    await handleTryInJulesAfterAuth(promptText);
  };

  cancelBtn.onclick = () => {
    hideSubtaskSplitModal();
  };

  // Select 'send-all' mode by default
  selectMode('send-all');
}

function renderSplitPreview(subtasks) {
  const preview = document.getElementById('splitPreviewList');
  preview.innerHTML = subtasks
    .map((st, idx) => `
      <div style="padding: 8px 0; border-bottom: 1px solid var(--border);">
        <div style="font-weight: 600; font-size: 12px; color: var(--accent);">Part ${idx + 1}</div>
        <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">
          ${st.title || `Part ${idx + 1}`}
        </div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          ${st.content.length} chars · ${st.content.split('\n').length} lines
        </div>
      </div>
    `)
    .join('');
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
      // Update summary
      const summary = generateSplitSummary(currentSubtasks);
      document.getElementById('splitCount').textContent = summary.totalSubtasks;
      document.getElementById('splitTime').textContent = summary.estimatedMinutes + 'm';
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

  // Submit each subtask
  for (let i = 0; i < sequenced.length; i++) {
    const subtask = sequenced[i];
    const status = `(${subtask.sequenceInfo.current}/${subtask.sequenceInfo.total})`;
    
    console.log(`[Subtask] Sending part ${subtask.sequenceInfo.current}/${subtask.sequenceInfo.total}`);
    
    try {
      const sessionUrl = await callRunJulesFunction(subtask.fullContent, 'myplanet');
      if (sessionUrl) {
        // Open first few in tabs, then show remaining
        if (i < 3) {
          window.open(sessionUrl, '_blank', 'noopener,noreferrer');
        } else if (i === 3) {
          alert(`Opening subtask ${subtask.sequenceInfo.current}. Remaining ${totalCount - 3} subtasks are queued. Check your Jules notifications.`);
          window.open(sessionUrl, '_blank', 'noopener,noreferrer');
        }
      }
      
      // Small delay between submissions to avoid rate limiting
      if (i < sequenced.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error submitting subtask ${i + 1}:`, error);
      const continueSubmitting = confirm(
        `Error sending part ${subtask.sequenceInfo.current}: ${error.message}\n\n` +
        `Continue with remaining subtasks?`
      );
      if (!continueSubmitting) break;
    }
  }

  alert(`✓ Submitted ${sequenced.length} subtask${sequenced.length > 1 ? 's' : ''} to Jules!`);
}

