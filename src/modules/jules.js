import { getCurrentUser } from './auth.js';
import { 
  analyzePromptStructure, 
  buildSubtaskSequence, 
  generateSplitSummary, 
  validateSubtasks 
} from './subtask-manager.js';
import { loadJulesProfileInfo, listJulesSessions } from './jules-api.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';

let lastSelectedSourceId = 'sources/github/open-learning-exchange/myplanet';
let lastSelectedBranch = 'master';

function openUrlInBackground(url) {
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

export async function addToJulesQueue(uid, queueItem) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = window.db.collection('julesQueues').doc(uid).collection('items');
    const docRef = await collectionRef.add({
      ...queueItem,
      autoOpen: queueItem.autoOpen !== false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });
    // Clear cache so next load fetches fresh data
    const { clearCache, CACHE_KEYS } = await import('../utils/session-cache.js');
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return docRef.id;
  } catch (err) {
    console.error('Failed to add to queue', err);
    throw err;
  }
}

export async function updateJulesQueueItem(uid, docId, updates) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const docRef = window.db.collection('julesQueues').doc(uid).collection('items').doc(docId);
    await docRef.update(updates);
    // Clear cache so next load fetches fresh data
    const { clearCache, CACHE_KEYS } = await import('../utils/session-cache.js');
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return true;
  } catch (err) {
    console.error('Failed to update queue item', err);
    throw err;
  }
}

export async function deleteFromJulesQueue(uid, docId) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    await window.db.collection('julesQueues').doc(uid).collection('items').doc(docId).delete();
    // Clear cache so next load fetches fresh data
    const { clearCache, CACHE_KEYS } = await import('../utils/session-cache.js');
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return true;
  } catch (err) {
    console.error('Failed to delete queue item', err);
    throw err;
  }
}

export async function listJulesQueue(uid) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const snapshot = await window.db.collection('julesQueues').doc(uid).collection('items').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Failed to list queue', err);
    throw err;
  }
}

export function showJulesQueueModal() {
  const modal = document.getElementById('julesQueueModal');
  if (!modal) {
    console.error('julesQueueModal element not found!');
    return;
  }
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1003; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
  
  // Close modal when clicking on backdrop
  modal.onclick = (e) => {
    if (e.target === modal) {
      hideJulesQueueModal();
    }
  };
  
  loadQueuePage();
}

export function hideJulesQueueModal() {
  const modal = document.getElementById('julesQueueModal');
  if (modal) modal.setAttribute('style', 'display:none !important;');
}

let queueCache = [];

export function renderQueueListDirectly(items) {
  queueCache = items;
  renderQueueList(items);
}

export function attachQueueHandlers() {
  attachQueueModalHandlers();
}

async function loadQueuePage() {
  const user = window.auth?.currentUser;
  const listDiv = document.getElementById('allQueueList');
  if (!user) {
    listDiv.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">Please sign in to view your queue.</div>';
    return;
  }

  try {
    // Check cache first
    let items = getCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);
    
    if (!items) {
      listDiv.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">Loading queue...</div>';
      items = await listJulesQueue(user.uid);
      setCache(CACHE_KEYS.QUEUE_ITEMS, items, user.uid);
    }
    
    queueCache = items;
    renderQueueList(items);
    attachQueueModalHandlers();
  } catch (err) {
    listDiv.innerHTML = `<div style="color:#e74c3c; text-align:center; padding:24px;">Failed to load queue: ${err.message}</div>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderQueueList(items) {
  const listDiv = document.getElementById('allQueueList');
  if (!listDiv) return;
  if (!items || items.length === 0) {
    listDiv.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">No queued items.</div>';
    return;
  }

  listDiv.innerHTML = items.map(item => {
    const created = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString() : 'Unknown';
    const status = item.status || 'pending';
    const remainingCount = Array.isArray(item.remaining) ? item.remaining.length : 0;
    
    if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
      const subtasksHtml = item.remaining.map((subtask, index) => {
        const preview = (subtask.fullContent || '').substring(0, 150);
        return `
          <div style="padding:8px; border:1px solid var(--border); border-radius:6px; display:flex; gap:8px; align-items:flex-start; background:rgba(255,255,255,0.01); margin-bottom:6px;">
            <div style="flex:0 0 24px; display:flex; align-items:center;">
              <input class="subtask-checkbox" type="checkbox" data-docid="${item.id}" data-index="${index}" />
            </div>
            <div style="flex:1;">
              <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">Subtask ${index + 1} of ${item.remaining.length}</div>
              <div style="font-size:12px; color:var(--text); white-space:pre-wrap;">${escapeHtml(preview)}${preview.length >= 150 ? '...' : ''}</div>
            </div>
          </div>
        `;
      }).join('');

      const repoDisplay = item.sourceId ? `<div style="font-size:11px; color:var(--accent); margin-top:4px;">📦 ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})</div>` : '';
      
      return `
        <div class="queue-item" data-docid="${item.id}" style="padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.02); margin-bottom:8px;">
          <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
            <div style="flex:0 0 28px; display:flex; align-items:center;">
              <input class="queue-checkbox" type="checkbox" data-docid="${item.id}" />
            </div>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:13px; margin-bottom:6px;">
                Subtasks Batch <span style="color:var(--muted); font-size:12px; margin-left:8px;">${status}</span>
                <span style="color:var(--muted); font-size:12px; margin-left:8px;">(${remainingCount} remaining)</span>
              </div>
              <div style="font-size:11px; color:var(--muted);">Created: ${created} • ID: <span style="font-family:monospace;">${item.id}</span></div>
              ${repoDisplay}
            </div>
          </div>
          <div style="margin-left:40px;">
            ${subtasksHtml}
          </div>
        </div>
      `;
    }

    const promptPreview = (item.prompt || '').substring(0, 200);
    const repoDisplay = item.sourceId ? `<div style="font-size:11px; color:var(--accent); margin-top:4px;">📦 ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})</div>` : '';
    
    return `
      <div class="queue-item" data-docid="${item.id}" style="padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.02); margin-bottom:8px;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="flex:0 0 28px; display:flex; align-items:center;">
            <input class="queue-checkbox" type="checkbox" data-docid="${item.id}" />
          </div>
          <div style="flex:1;">
            <div style="font-weight:600; font-size:13px; margin-bottom:6px;">
              Single Prompt <span style="color:var(--muted); font-size:12px; margin-left:8px;">${status}</span>
            </div>
            <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">Created: ${created} • ID: <span style="font-family:monospace;">${item.id}</span></div>
            ${repoDisplay}
            <div style="font-size:12px; color:var(--text); white-space:pre-wrap; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px; margin-top:8px;">${escapeHtml(promptPreview)}${promptPreview.length >= 200 ? '...' : ''}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteSelectedSubtasks(docId, indices) {
  const user = window.auth?.currentUser;
  if (!user) return;

  const item = queueCache.find(i => i.id === docId);
  if (!item || !Array.isArray(item.remaining)) return;

  const sortedIndices = indices.sort((a, b) => b - a);
  const newRemaining = item.remaining.slice();
  
  for (const index of sortedIndices) {
    if (index >= 0 && index < newRemaining.length) {
      newRemaining.splice(index, 1);
    }
  }

  if (newRemaining.length === 0) {
    await deleteFromJulesQueue(user.uid, docId);
  } else {
    await updateJulesQueueItem(user.uid, docId, {
      remaining: newRemaining,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function runSelectedSubtasks(docId, indices, suppressPopups = false, openInBackground = false) {
  const user = window.auth?.currentUser;
  if (!user) return;

  const item = queueCache.find(i => i.id === docId);
  if (!item || !Array.isArray(item.remaining)) return;

  const sortedIndices = indices.sort((a, b) => a - b);
  const toRun = sortedIndices.map(i => item.remaining[i]).filter(Boolean);

  for (const subtask of toRun) {
    try {
      const title = extractTitleFromPrompt(subtask.fullContent);
      const sessionUrl = await callRunJulesFunction(subtask.fullContent, item.sourceId, item.branch || 'master', title);
      if (sessionUrl && !suppressPopups && item.autoOpen !== false) {
        if (openInBackground) {
          openUrlInBackground(sessionUrl);
        } else {
          window.open(sessionUrl, '_blank', 'noopener,noreferrer');
        }
      }
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      statusBar.showMessage(`Error running subtask: ${err.message}`, { timeout: 6000 });
      throw err;
    }
  }

  await deleteSelectedSubtasks(docId, indices);
}

function attachQueueModalHandlers() {
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

function getSelectedQueueIds() {
  const queueSelections = [];
  const subtaskSelections = {};
  
  document.querySelectorAll('.queue-checkbox:checked').forEach(cb => {
    queueSelections.push(cb.dataset.docid);
  });
  
  document.querySelectorAll('.subtask-checkbox:checked').forEach(cb => {
    const docId = cb.dataset.docid;
    const index = parseInt(cb.dataset.index);
    if (!subtaskSelections[docId]) {
      subtaskSelections[docId] = [];
    }
    subtaskSelections[docId].push(index);
  });
  
  return { queueSelections, subtaskSelections };
}

async function deleteSelectedQueueItems() {
  const user = window.auth?.currentUser;
  if (!user) { alert('Not signed in'); return; }
  
  const { queueSelections, subtaskSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0 && Object.keys(subtaskSelections).length === 0) {
    alert('No items selected');
    return;
  }
  
  const totalCount = queueSelections.length + Object.values(subtaskSelections).reduce((sum, arr) => sum + arr.length, 0);
  if (!confirm(`Delete ${totalCount} selected item(s)?`)) return;
  
  try {
    for (const id of queueSelections) {
      await deleteFromJulesQueue(user.uid, id);
    }
    
    for (const [docId, indices] of Object.entries(subtaskSelections)) {
      if (queueSelections.includes(docId)) continue;
      
      await deleteSelectedSubtasks(docId, indices);
    }
    
    alert('Deleted selected items');
    await loadQueuePage();
  } catch (err) {
    alert('Failed to delete selected items: ' + err.message);
  }
}

function sortByCreatedAt(ids) {
  return ids.slice().sort((a, b) => {
    const itemA = queueCache.find(i => i.id === a);
    const itemB = queueCache.find(i => i.id === b);
    return (itemA?.createdAt?.seconds || 0) - (itemB?.createdAt?.seconds || 0);
  });
}

async function runSelectedQueueItems() {
  const user = window.auth?.currentUser;
  if (!user) { alert('Not signed in'); return; }
  
  const { queueSelections, subtaskSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0 && Object.keys(subtaskSelections).length === 0) {
    alert('No items selected');
    return;
  }

  const suppressPopups = document.getElementById('queueSuppressPopupsCheckbox')?.checked || false;
  const openInBackground = document.getElementById('queueOpenInBackgroundCheckbox')?.checked || false;
  const pauseBtn = document.getElementById('queuePauseBtn');
  let paused = false;
  if (pauseBtn) {
    pauseBtn.disabled = false;
    pauseBtn.onclick = () => {
      paused = true;
      pauseBtn.disabled = true;
      statusBar.showMessage('Pausing queue processing after the current subtask', { timeout: 4000 });
    };
  }

  statusBar.showMessage('Processing queue...', { timeout: 0 });
  statusBar.setAction('Pause', () => {
    paused = true;
    statusBar.showMessage('Pausing after current subtask', { timeout: 3000 });
    statusBar.clearAction();
    if (pauseBtn) pauseBtn.disabled = true;
  });

  const sortedSubtaskEntries = Object.entries(subtaskSelections).sort(([a], [b]) => 
    (queueCache.find(i => i.id === a)?.createdAt?.seconds || 0) - (queueCache.find(i => i.id === b)?.createdAt?.seconds || 0)
  );

  for (const [docId, indices] of sortedSubtaskEntries) {
    if (paused) break;
    if (queueSelections.includes(docId)) continue;
    
    await runSelectedSubtasks(docId, indices.slice().sort((a, b) => a - b), suppressPopups, openInBackground);
  }
  
  for (const id of sortByCreatedAt(queueSelections)) {
    if (paused) break;
    const item = queueCache.find(i => i.id === id);
    if (!item) continue;

    try {
      if (item.type === 'single') {
        const title = extractTitleFromPrompt(item.prompt || '');
        const sessionUrl = await callRunJulesFunction(item.prompt || '', item.sourceId, item.branch || 'master', title);
        if (sessionUrl && !suppressPopups && item.autoOpen !== false) {
          if (openInBackground) {
            openUrlInBackground(sessionUrl);
          } else {
            window.open(sessionUrl, '_blank', 'noopener,noreferrer');
          }
        }
        await deleteFromJulesQueue(user.uid, id);
      } else if (item.type === 'subtasks') {
        let remaining = Array.isArray(item.remaining) ? item.remaining.slice() : [];

        const initialCount = remaining.length;
        while (remaining.length > 0) {
          if (paused) {
            try {
              await updateJulesQueueItem(user.uid, id, {
                remaining,
                status: 'paused',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } catch (e) {
              console.warn('Failed to persist paused state for queue item', id, e.message || e);
            }
            statusBar.showMessage('Paused — progress saved', { timeout: 3000 });
            statusBar.clearProgress();
            statusBar.clearAction();
            await loadQueuePage();
            return;
          }

          const s = remaining[0];
          try {
            const title = extractTitleFromPrompt(s.fullContent);
            const sessionUrl = await callRunJulesFunction(s.fullContent, item.sourceId, item.branch || 'master', title);
            if (sessionUrl && !suppressPopups && item.autoOpen !== false) {
              if (openInBackground) {
                openUrlInBackground(sessionUrl);
              } else {
                window.open(sessionUrl, '_blank', 'noopener,noreferrer');
              }
            }

            // remove the completed subtask from remaining
            remaining.shift();

            // persist progress after each successful subtask
            try {
              await updateJulesQueueItem(user.uid, id, {
                remaining,
                status: remaining.length === 0 ? 'done' : 'in-progress',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } catch (e) {
              console.warn('Failed to persist progress for queue item', id, e.message || e);
            }

            // update status bar progress
            try {
              const done = initialCount - remaining.length;
              const percent = initialCount > 0 ? Math.round((done / initialCount) * 100) : 100;
              statusBar.setProgress(`${done}/${initialCount}`, percent);
              statusBar.showMessage(`Processing subtask ${done}/${initialCount}`, { timeout: 0 });
            } catch (e) {}

            // slight delay between subtasks
            await new Promise(r => setTimeout(r, 800));
          } catch (err) {
            // If a subtask fails, persist remaining and stop processing this queued item
            statusBar.showMessage(`Error running queued subtask: ${err.message}`, { timeout: 6000 });
            try {
              await updateJulesQueueItem(user.uid, id, {
                remaining,
                status: 'error',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } catch (e) {
              console.warn('Failed to persist error state for queue item', id, e.message || e);
            }
            throw err;
          }
        }

        // all subtasks succeeded
        await deleteFromJulesQueue(user.uid, id);
      } else {
        console.warn('Unknown queue item type', item.type);
      }
    } catch (err) {
      // stop processing further items to avoid fast repeated failures
      console.error('Failed running queue item', id, err);
      await loadQueuePage();
      return;
    }
  }

  statusBar.showMessage('Completed running selected items', { timeout: 4000 });
  statusBar.clearProgress();
  statusBar.clearAction();
  await loadQueuePage();
}

export async function callRunJulesFunction(promptText, sourceId, branch = 'master', title = '') {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return null;
  }

  if (!sourceId) {
    throw new Error('No repository selected');
  }

  const julesBtn = document.getElementById('julesBtn');
  const originalText = julesBtn?.textContent;
  if (julesBtn) {
    julesBtn.textContent = 'Running...';
    julesBtn.disabled = true;
  }

  try {
    const sessionUrl = await runJulesAPI(promptText, sourceId, branch, title, user);
    
    if (julesBtn) {
      julesBtn.textContent = originalText;
      julesBtn.disabled = false;
    }

    return sessionUrl;
  } catch (error) {
    if (julesBtn) {
      julesBtn.textContent = '⚡ Try in Jules';
      julesBtn.disabled = false;
    }
    throw error;
  }
}

async function runJulesAPI(promptText, sourceId, branch, title, user) {
  const token = await user.getIdToken(true);
  const functionUrl = 'https://runjuleshttp-n7gaasoeoq-uc.a.run.app';

  const payload = { promptText: promptText || '', sourceId: sourceId, branch: branch, title: title };
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.sessionUrl || null;
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
  
  // Initialize buttons
  submitBtn.disabled = true;
  queueBtn.disabled = true;
  
  let selectedSourceId = null;
  let selectedBranch = null;

  // Initialize RepoSelector
  const repoSelector = new RepoSelector({
    dropdownBtn: document.getElementById('julesRepoDropdownBtn'),
    dropdownText: document.getElementById('julesRepoDropdownText'),
    dropdownMenu: document.getElementById('julesRepoDropdownMenu'),
    onSelect: (sourceId, branch, repoName) => {
      selectedSourceId = sourceId;
      selectedBranch = branch;
      submitBtn.disabled = false;
      queueBtn.disabled = false;
      branchSelector.initialize(sourceId, branch);
    }
  });

  // Initialize BranchSelector
  const branchSelector = new BranchSelector({
    dropdownBtn: document.getElementById('julesBranchDropdownBtn'),
    dropdownText: document.getElementById('julesBranchDropdownText'),
    dropdownMenu: document.getElementById('julesBranchDropdownMenu'),
    onSelect: (branch) => {
      selectedBranch = branch;
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

async function handleRepoSelect(sourceId, branch, promptText, suppressPopups = false, openInBackground = false) {
  hideJulesEnvModal();
  
  lastSelectedSourceId = sourceId;
  lastSelectedBranch = branch || 'master';
  
  let retryCount = 0;
  let maxRetries = 3;
  let submitted = false;

  const title = extractTitleFromPrompt(promptText);
  while (retryCount < maxRetries && !submitted) {
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
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          try {
            const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch, title);
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
      if (freeInputSection && freeInputSection.style.display === 'flex') {
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
    
    // Check cache first
    let profileData = getCache(CACHE_KEYS.JULES_ACCOUNT, uid);
    
    if (!profileData) {
      sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sources...</div>';
      sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sessions...</div>';
      
      profileData = await loadJulesProfileInfo(uid);
      setCache(CACHE_KEYS.JULES_ACCOUNT, profileData, uid);
    }

    if (profileData.sources && profileData.sources.length > 0) {
      sourcesListDiv.innerHTML = profileData.sources.map((source, index) => {
        const repoName = source.githubRepo?.name || source.name || source.id;
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
          <div style="display:flex; justify-content:space-between; align-items:center;" onclick="event.stopPropagation();">
            ${prLink ? `<div>${prLink}</div>` : '<div></div>'}
            <span style="color:var(--muted); font-size:11px;">💡 Click to view session</span>
          </div>
        </div>`;
      }).join('');
    } else {
      sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No recent sessions found.</div>';
    }

    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
    
    attachViewAllSessionsHandler();

  } catch (error) {
    sourcesListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sources: ${error.message}
    </div>`;
    sessionsListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sessions: ${error.message}
    </div>`;

    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
  }
}

export function hideUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
}

let allSessionsCache = [];
let sessionNextPageToken = null;

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
    if (session.parentTask) {
      return '';
    }
    
    const sessionId = session.name?.split('/').pop() || '';
    const state = session.state || 'UNKNOWN';
    const emoji = stateEmoji[state] || '❓';
    const label = stateLabel[state] || state.replace(/_/g, ' ');
    
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    const prLink = prUrl 
      ? `<div style="margin-top:4px;" onclick="event.stopPropagation();"><a href="${prUrl}" target="_blank" style="font-size:11px; color:var(--accent); text-decoration:none;">🔗 View PR</a></div>`
      : '';
    
    const subtaskCount = session.childTasks?.length || 0;
    const subtaskInfo = subtaskCount > 0 
      ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;">📋 ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}</div>`
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
      ${subtaskInfo}
      ${prLink}
    </div>`;
  }).filter(html => html).join('');
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
  
  empty.style.display = 'none';
  title.style.display = 'none';
  meta.style.display = 'none';
  actions.style.display = 'none';
  content.style.display = 'none';
  
  freeInputSection.style.display = 'flex';
  
  const textarea = document.getElementById('freeInputTextarea');
  const submitBtn = document.getElementById('freeInputSubmitBtn');
  const queueBtn = document.getElementById('freeInputQueueBtn');
  const splitBtn = document.getElementById('freeInputSplitBtn');
  const copenBtn = document.getElementById('freeInputCopenBtn');
  const cancelBtn = document.getElementById('freeInputCancelBtn');

  textarea.value = '';
  
  populateFreeInputRepoSelection();
  populateFreeInputBranchSelection();
  
  textarea.focus();

  const handleSubmit = async () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alert('Please enter a prompt.');
      return;
    }

    // Validate that a repo is selected
    if (!lastSelectedSourceId) {
      alert('Please select a repository.');
      return;
    }

    // Validate that a branch is selected
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

    // Validate that a repo is selected
    if (!lastSelectedSourceId) {
      alert('Please select a repository.');
      return;
    }

    // Validate that a branch is selected
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
      // Copy to clipboard
      await navigator.clipboard.writeText(promptText);
      copenBtn.textContent = 'Copied!';
      setTimeout(() => {
        copenBtn.textContent = '📋⤴ ▼';
      }, 1000);

      // Open appropriate tab based on target
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
  
  freeInputSection.style.display = 'none';
  empty.style.display = 'flex';
}

async function populateFreeInputRepoSelection() {
  // Clear selections
  lastSelectedSourceId = null;
  lastSelectedBranch = null;
  
  const user = getCurrentUser();
  if (!user) {
    const dropdownText = document.getElementById('freeInputRepoDropdownText');
    const dropdownBtn = document.getElementById('freeInputRepoDropdownBtn');
    dropdownText.textContent = 'Please sign in first';
    dropdownBtn.disabled = true;
    return;
  }

  // Initialize RepoSelector
  const repoSelector = new RepoSelector({
    favoriteContainer: null, // Free input doesn't have a favorite container
    dropdownBtn: document.getElementById('freeInputRepoDropdownBtn'),
    dropdownText: document.getElementById('freeInputRepoDropdownText'),
    dropdownMenu: document.getElementById('freeInputRepoDropdownMenu'),
    onSelect: (sourceId, branch, repoName) => {
      lastSelectedSourceId = sourceId;
      lastSelectedBranch = branch;
      branchSelector.initialize(sourceId, branch);
    }
  });

  // Initialize BranchSelector
  const branchSelector = new BranchSelector({
    dropdownBtn: document.getElementById('freeInputBranchDropdownBtn'),
    dropdownText: document.getElementById('freeInputBranchDropdownText'),
    dropdownMenu: document.getElementById('freeInputBranchDropdownMenu'),
    onSelect: (branch) => {
      lastSelectedBranch = branch;
    }
  });

  // Load favorites and populate dropdown
  await repoSelector.initialize();
  branchSelector.initialize(null, null);
}
window.populateFreeInputRepoSelection = populateFreeInputRepoSelection;

// Branch selection is now handled by BranchSelector class in populateFreeInputRepoSelection
async function populateFreeInputBranchSelection() {
  // This function is deprecated - BranchSelector is initialized in populateFreeInputRepoSelection
  // Keeping as stub for backward compatibility
}
window.populateFreeInputBranchSelection = populateFreeInputBranchSelection;

let currentFullPrompt = '';
let currentSubtasks = [];

export function showSubtaskSplitModal(promptText) {
  currentFullPrompt = promptText;
  
  const modal = document.getElementById('subtaskSplitModal');
  const confirmBtn = document.getElementById('splitConfirmBtn');
  const queueBtn = document.getElementById('splitQueueBtn');
  const cancelBtn = document.getElementById('splitCancelBtn');

  const analysis = analyzePromptStructure(promptText);
  currentSubtasks = analysis.subtasks;
  
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');

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
  
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center;');
  
  closeBtn.onclick = () => {
    modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center;');
  };
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center;');
    }
  });
}

export function hideSubtaskSplitModal() {
  const modal = document.getElementById('subtaskSplitModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center;');
  currentSubtasks = [];
}

async function submitSubtasks(subtasks) {
  const suppressPopups = document.getElementById('splitSuppressPopupsCheckbox')?.checked || false;
  const openInBackground = document.getElementById('splitOpenInBackgroundCheckbox')?.checked || false;
  
  if (!subtasks || subtasks.length === 0) {
    let retryCount = 0;
    let maxRetries = 3;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const title = extractTitleFromPrompt(currentFullPrompt);
        const sessionUrl = await callRunJulesFunction(currentFullPrompt, lastSelectedSourceId, lastSelectedBranch, title);
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
              const title = extractTitleFromPrompt(currentFullPrompt);
              const sessionUrl = await callRunJulesFunction(currentFullPrompt, lastSelectedSourceId, lastSelectedBranch, title);
              if (sessionUrl) {
                if (openInBackground) {
                  openUrlInBackground(sessionUrl);
                } else {
                  window.open(sessionUrl, '_blank', 'noopener,noreferrer');
                }
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
    return;
  }
  
  const sequenced = buildSubtaskSequence(currentFullPrompt, subtasks);
  
  const totalCount = sequenced.length;
  const proceed = confirm(
    `Ready to send ${totalCount} subtask${totalCount > 1 ? 's' : ''} to Jules.\n\n` +
    `Each subtask will be submitted sequentially. This may take a few minutes.\n\n` +
    `Proceed?`
  );

  if (!proceed) {
    statusBar.clearProgress();
    statusBar.clearAction();
    return;
  }

  let skippedCount = 0;
  let successCount = 0;
  let paused = false;
  const user = window.auth ? window.auth.currentUser : null;

  statusBar.showMessage(`Processing ${totalCount} subtasks...`, { timeout: 0 });
  statusBar.setAction('Pause', () => {
    paused = true;
    statusBar.showMessage('Pausing after current subtask...', { timeout: 3000 });
    statusBar.clearAction();
  });
  
  for (let i = 0; i < sequenced.length; i++) {
    const subtask = sequenced[i];
    const status = `(${subtask.sequenceInfo.current}/${subtask.sequenceInfo.total})`;
    
    
    let retryCount = 0;
    let maxRetries = 3;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const title = extractTitleFromPrompt(subtask.fullContent) || subtask.title || '';
        const sessionUrl = await callRunJulesFunction(subtask.fullContent, lastSelectedSourceId, lastSelectedBranch, title);
        if (sessionUrl && !suppressPopups) {
          if (openInBackground) {
            openUrlInBackground(sessionUrl);
          } else {
            window.open(sessionUrl, '_blank', 'noopener,noreferrer');
          }
        }
        
        successCount++;
        submitted = true;

        // update status bar progress
        const percent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
        statusBar.setProgress(`${successCount}/${totalCount}`, percent);
        statusBar.showMessage(`Processing subtask ${successCount}/${totalCount}`, { timeout: 0 });

        // if user requested pause, queue remaining subtasks and stop
        if (paused) {
          const remaining = sequenced.slice(i + 1).map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));
          if (user && remaining.length > 0) {
            try {
              await addToJulesQueue(user.uid, {
                type: 'subtasks',
                prompt: currentFullPrompt,
                sourceId: lastSelectedSourceId,
                branch: lastSelectedBranch,
                remaining,
                totalCount,
                note: 'Paused by user'
              });
              statusBar.showMessage(`Paused and queued ${remaining.length} remaining subtasks`, { timeout: 4000 });
            } catch (err) {
              console.warn('Failed to queue remaining subtasks on pause', err.message || err);
              statusBar.showMessage('Paused but failed to save remaining subtasks', { timeout: 4000 });
            }
          } else {
            statusBar.showMessage('Paused', { timeout: 3000 });
          }
          statusBar.clearProgress();
          statusBar.clearAction();
          await loadQueuePage();
          return;
        }
      } catch (error) {
        retryCount++;

        if (retryCount < maxRetries) {
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );

          if (result.action === 'cancel') {
            statusBar.clearProgress();
            statusBar.clearAction();
            alert(`✗ Cancelled. Submitted ${successCount} of ${totalCount} subtasks before cancellation.`);
            return;
          } else if (result.action === 'skip') {
            skippedCount++;
            submitted = true;
          } else if (result.action === 'queue') {
            const user = window.auth?.currentUser;
            if (!user) {
              statusBar.clearProgress();
              statusBar.clearAction();
              alert('Please sign in to queue subtasks.');
              return;
            }
            const remaining = sequenced.slice(i).map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));
            try {
              await addToJulesQueue(user.uid, {
                type: 'subtasks',
                prompt: currentFullPrompt,
                sourceId: lastSelectedSourceId,
                branch: lastSelectedBranch,
                remaining,
                totalCount,
                note: 'Queued remaining subtasks'
              });
              statusBar.clearProgress();
              statusBar.clearAction();
              alert(`Queued ${remaining.length} remaining subtasks to your account.`);
            } catch (err) {
              statusBar.clearProgress();
              statusBar.clearAction();
              alert('Failed to queue subtasks: ' + err.message);
            }
            return;
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
            statusBar.clearProgress();
            statusBar.clearAction();
            alert(`✗ Cancelled. Submitted ${successCount} of ${totalCount} subtasks before cancellation.`);
            return;
          } else {
            if (result.action === 'queue') {
              const user = window.auth?.currentUser;
              if (!user) {
                statusBar.clearProgress();
                statusBar.clearAction();
                alert('Please sign in to queue subtasks.');
                return;
              }
              const remaining = sequenced.slice(i).map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));
              try {
                await addToJulesQueue(user.uid, {
                  type: 'subtasks',
                  prompt: currentFullPrompt,
                  sourceId: lastSelectedSourceId,
                  branch: lastSelectedBranch,
                  remaining,
                  totalCount,
                  note: 'Queued remaining subtasks (final failure)'
                });
                statusBar.clearProgress();
                statusBar.clearAction();
                alert(`Queued ${remaining.length} remaining subtasks to your account.`);
              } catch (err) {
                statusBar.clearProgress();
                statusBar.clearAction();
                alert('Failed to queue subtasks: ' + err.message);
              }
              return;
            }
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

  statusBar.clearProgress();
  statusBar.clearAction();
  statusBar.showMessage('All subtasks completed', { timeout: 3000 });
  
  const summary = `✓ Completed!\n\n` +
    `Successful: ${successCount}/${totalCount}\n` +
    `Skipped: ${skippedCount}/${totalCount}`;
  alert(summary);
}

export async function loadProfileDirectly(user) {
  const profileUserName = document.getElementById('profileUserName');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const resetBtn = document.getElementById('resetJulesKeyBtn');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'Unknown User';
  }

  const hasKey = await checkJulesKey(user.uid);
  
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

  // Attach event handlers
  if (addBtn) {
    addBtn.onclick = () => {
      showJulesKeyModal(() => {
        setTimeout(() => loadProfileDirectly(user), 500);
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
        resetBtn.textContent = '🗑️ Delete Jules API Key';
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

  attachViewAllSessionsHandler();
  attachViewQueueHandler();
}

export async function loadJulesAccountInfo(user) {
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');

  // Check if user has Jules API key
  const hasKey = await checkJulesKey(user.uid);
  
  if (!hasKey) {
    if (julesProfileInfoSection) {
      julesProfileInfoSection.style.display = 'none';
    }
    return;
  }

  if (julesProfileInfoSection) {
    julesProfileInfoSection.style.display = 'block';
  }

  await loadAndDisplayJulesProfile(user.uid);

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      await loadAndDisplayJulesProfile(user.uid);
      attachViewAllSessionsHandler();
      attachViewQueueHandler();
    };
  }

  attachViewAllSessionsHandler();
  attachViewQueueHandler();
}
