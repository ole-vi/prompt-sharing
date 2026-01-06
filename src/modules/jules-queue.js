// ===== Jules Queue Management Module =====
// Handles queue operations, rendering, and processing

import { CACHE_KEYS, getCache, setCache, clearCache } from '../utils/session-cache.js';
import statusBar from './status-bar.js';
import { callRunJulesFunction, openUrlInBackground } from './jules-api.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import { showSubtaskErrorModal } from './error-modal.js';

class CancellationError extends Error {
  constructor(message = 'User cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}

let queueCache = [];

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

export function renderQueueListDirectly(items) {
  queueCache = items;
  renderQueueList(items);
}

export function attachQueueHandlers() {
  attachQueueModalHandlers();
}

export async function loadQueuePage() {
  const user = window.auth?.currentUser;
  const listDiv = document.getElementById('allQueueList');
  if (!user) {
    listDiv.innerHTML = '<div class="panel text-center pad-xl muted-text">Please sign in to view your queue.</div>';
    return;
  }

  try {
    // Check cache first
    let items = getCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);

    if (!items) {
      listDiv.innerHTML = '<div class="panel text-center pad-xl muted-text">Loading queue...</div>';
      items = await listJulesQueue(user.uid);
      setCache(CACHE_KEYS.QUEUE_ITEMS, items, user.uid);
    }

    queueCache = items;
    renderQueueList(items);
    attachQueueModalHandlers();
  } catch (err) {
    listDiv.innerHTML = `<div class="panel text-center pad-xl">Failed to load queue: ${err.message}</div>`;
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
    listDiv.innerHTML = '<div class="panel text-center pad-xl muted-text">No queued items.</div>';
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
          <div class="queue-subtask">
            <div class="queue-subtask-index">
              <input class="subtask-checkbox" type="checkbox" data-docid="${item.id}" data-index="${index}" />
            </div>
            <div class="queue-subtask-content">
              <div class="queue-subtask-meta">Subtask ${index + 1} of ${item.remaining.length}</div>
              <div class="queue-subtask-text">${escapeHtml(preview)}${preview.length >= 150 ? '...' : ''}</div>
            </div>
          </div>
        `;
      }).join('');

      const repoDisplay = item.sourceId ? `<div class="queue-repo">📦 ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})</div>` : '';

      return `
        <div class="queue-card queue-item" data-docid="${item.id}">
          <div class="queue-row">
            <div class="queue-checkbox-col">
              <input class="queue-checkbox" type="checkbox" data-docid="${item.id}" />
            </div>
            <div class="queue-content">
              <div class="queue-title">
                Subtasks Batch <span class="queue-status">${status}</span>
                <span class="queue-status">(${remainingCount} remaining)</span>
              </div>
              <div class="queue-meta">Created: ${created} • ID: <span class="mono">${item.id}</span></div>
              ${repoDisplay}
            </div>
          </div>
          <div class="queue-subtasks">
            ${subtasksHtml}
          </div>
        </div>
      `;
    }

    const promptPreview = (item.prompt || '').substring(0, 200);
    const repoDisplay = item.sourceId ? `<div class="queue-repo">📦 ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})</div>` : '';

    return `
      <div class="queue-card queue-item" data-docid="${item.id}">
        <div class="queue-row">
          <div class="queue-checkbox-col">
            <input class="queue-checkbox" type="checkbox" data-docid="${item.id}" />
          </div>
          <div class="queue-content">
            <div class="queue-title">
              Single Prompt <span class="queue-status">${status}</span>
            </div>
            <div class="queue-meta">Created: ${created} • ID: <span class="mono">${item.id}</span></div>
            ${repoDisplay}
            <div class="queue-prompt">${escapeHtml(promptPreview)}${promptPreview.length >= 200 ? '...' : ''}</div>
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

  for (let idx = 0; idx < toRun.length; idx++) {
    const subtask = toRun[idx];
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (!success && retryCount < maxRetries) {
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
        success = true;
        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        retryCount++;
        
        if (retryCount < maxRetries) {
          const result = await showSubtaskErrorModal(idx + 1, toRun.length, err, { hideQueueButton: true });
          
          if (result.action === 'cancel') {
            statusBar.clearProgress();
            statusBar.clearAction();
            statusBar.showMessage('Cancelled', { timeout: 3000 });
            throw new CancellationError();
          } else if (result.action === 'skip') {
            success = true; // Mark as success to skip and continue
          } else if (result.action === 'retry') {
            if (result.shouldDelay) {
              statusBar.showMessage('Waiting 5 seconds before retry...', { timeout: 5000 });
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            // Status bar keeps showing processing state
            // Loop will retry
          }
        } else {
          // Max retries reached, show final error
          const result = await showSubtaskErrorModal(idx + 1, toRun.length, err, { hideQueueButton: true });
          
          if (result.action === 'skip') {
            success = true; // Skip and continue
          } else {
            statusBar.clearProgress();
            statusBar.clearAction();
            statusBar.showMessage('Cancelled', { timeout: 3000 });
            throw new CancellationError(); // Cancel or any other action
          }
        }
      }
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

    try {
      await runSelectedSubtasks(docId, indices.slice().sort((a, b) => a - b), suppressPopups, openInBackground);
    } catch (err) {
      if (err instanceof CancellationError) {
        // User already cancelled, don't show modal again
        return;
      }
      console.error('Failed running subtasks for', docId, err);
      const result = await showSubtaskErrorModal(1, 1, err, { hideQueueButton: true });
      statusBar.clearProgress();
      statusBar.clearAction();
      await loadQueuePage();
      return;
    }
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
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          while (!success && retryCount < maxRetries) {
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
              success = true;

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
              retryCount++;

              if (retryCount < maxRetries) {
                const done = initialCount - remaining.length;
                const result = await showSubtaskErrorModal(done + 1, initialCount, err, { hideQueueButton: true });
                
                if (result.action === 'cancel') {
                  try {
                    await updateJulesQueueItem(user.uid, id, {
                      remaining,
                      status: 'error',
                      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                  } catch (e) {
                    console.warn('Failed to persist error state for queue item', id, e.message || e);
                  }
                  
                  statusBar.clearProgress();
                  statusBar.clearAction();
                  statusBar.showMessage('Cancelled', { timeout: 3000 });
                  await loadQueuePage();
                  throw new CancellationError();
                } else if (result.action === 'skip') {
                  // Skip this subtask and continue
                  remaining.shift();
                  success = true;
                } else if (result.action === 'retry') {
                  if (result.shouldDelay) {
                    statusBar.showMessage('Waiting 5 seconds before retry...', { timeout: 5000 });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                  }
                  // Status bar keeps showing processing state
                  // Loop will retry
                }
              } else {
                // Max retries reached
                const done = initialCount - remaining.length;
                const result = await showSubtaskErrorModal(done + 1, initialCount, err, { hideQueueButton: true });
                
                if (result.action === 'skip') {
                  remaining.shift();
                  success = true;
                } else {
                  try {
                    await updateJulesQueueItem(user.uid, id, {
                      remaining,
                      status: 'error',
                      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                  } catch (e) {
                    console.warn('Failed to persist error state for queue item', id, e.message || e);
                  }
                  
                  statusBar.clearProgress();
                  statusBar.clearAction();
                  statusBar.showMessage('Cancelled', { timeout: 3000 });
                  await loadQueuePage();
                  throw new CancellationError();
                }
              }
            }
          }
        }

        // all subtasks succeeded
        await deleteFromJulesQueue(user.uid, id);
      } else {
        console.warn('Unknown queue item type', item.type);
      }
    } catch (err) {
      // stop processing further items to avoid fast repeated failures
      if (err instanceof CancellationError) {
        // User already cancelled, don't show modal again
        return;
      }
      console.error('Failed running queue item', id, err);
      const result = await showSubtaskErrorModal(1, 1, err, { hideQueueButton: true });
      await loadQueuePage();
      return;
    }
  }

  statusBar.showMessage('Completed running selected items', { timeout: 4000 });
  statusBar.clearProgress();
  statusBar.clearAction();
  await loadQueuePage();
}
