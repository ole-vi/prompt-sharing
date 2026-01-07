// ===== Jules Queue Module =====
// Manages Jules queue operations and UI rendering

import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';

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

export function renderQueueListDirectly(items) {
  queueCache = items;
  renderQueueList(items);
}

export function attachQueueHandlers() {
  attachQueueModalHandlers();
}

let editModalState = {
  originalData: null,
  hasUnsavedChanges: false,
  currentDocId: null
};

async function fetchAndPopulateBranches(sourceId, currentBranch, branchDropdownBtn, branchDropdownText, branchDropdownMenu) {
  console.log('fetchAndPopulateBranches called with:', { sourceId, currentBranch });
  
  // Setup dropdown toggle (do this first so it always works)
  branchDropdownBtn.onclick = (e) => {
    e.stopPropagation();
    const isOpen = branchDropdownMenu.style.display === 'block';
    branchDropdownMenu.style.display = isOpen ? 'none' : 'block';
  };
  
  // Close on click outside
  const closeHandler = (e) => {
    if (!branchDropdownBtn.contains(e.target) && !branchDropdownMenu.contains(e.target)) {
      branchDropdownMenu.style.display = 'none';
    }
  };
  document.addEventListener('click', closeHandler);
  
  if (!sourceId) {
    console.log('No sourceId, using default branch');
    branchDropdownText.textContent = currentBranch || 'master';
    branchDropdownBtn.disabled = false;
    
    // Add single item to menu
    branchDropdownMenu.innerHTML = '';
    const currentItem = document.createElement('div');
    currentItem.className = 'custom-dropdown-item selected';
    currentItem.textContent = currentBranch || 'master';
    currentItem.onclick = () => {
      branchDropdownMenu.style.display = 'none';
    };
    branchDropdownMenu.appendChild(currentItem);
    return;
  }

  // Parse owner and repo from sourceId (format: sources/github.com/owner/repo)
  const pathParts = sourceId.split('/');
  console.log('Parsed pathParts:', pathParts);
  
  if (pathParts.length < 4 || (pathParts[1] !== 'github.com' && pathParts[1] !== 'github')) {
    console.log('Not a GitHub repo, pathParts:', pathParts);
    // Not a GitHub repo, just use the current branch
    branchDropdownText.textContent = currentBranch || 'master';
    branchDropdownBtn.disabled = false;
    
    // Add single item to menu
    branchDropdownMenu.innerHTML = '';
    const currentItem = document.createElement('div');
    currentItem.className = 'custom-dropdown-item selected';
    currentItem.textContent = currentBranch || 'master';
    currentItem.onclick = () => {
      branchDropdownMenu.style.display = 'none';
    };
    branchDropdownMenu.appendChild(currentItem);
    return;
  }

  const owner = pathParts[pathParts.length - 2];
  const repo = pathParts[pathParts.length - 1];

  // Show loading state
  branchDropdownText.textContent = 'Loading branches...';
  branchDropdownBtn.disabled = true;

  try {
    const { getBranches } = await import('./github-api.js');
    const branches = await getBranches(owner, repo);

    console.log('Fetched branches for', owner, repo, ':', branches);

    if (!branches || branches.length === 0) {
      branchDropdownText.textContent = currentBranch || 'master';
      branchDropdownBtn.disabled = false;
      
      // Add single item to menu
      branchDropdownMenu.innerHTML = '';
      const currentItem = document.createElement('div');
      currentItem.className = 'custom-dropdown-item selected';
      currentItem.textContent = currentBranch || 'master';
      currentItem.onclick = () => {
        branchDropdownMenu.style.display = 'none';
      };
      branchDropdownMenu.appendChild(currentItem);
      return;
    }

    // Set current branch
    branchDropdownText.textContent = currentBranch || 'master';
    branchDropdownBtn.disabled = false;
    
    // Populate dropdown menu
    branchDropdownMenu.innerHTML = '';
    
    console.log('Populating dropdown with', branches.length, 'branches');
    
    // Add current branch first (selected)
    const currentItem = document.createElement('div');
    currentItem.className = 'custom-dropdown-item selected';
    currentItem.textContent = currentBranch || 'master';
    currentItem.onclick = () => {
      branchDropdownMenu.style.display = 'none';
    };
    branchDropdownMenu.appendChild(currentItem);
    
    // Add other branches
    branches.forEach(branch => {
      console.log('Adding branch:', branch.name);
      if (branch.name === currentBranch) return;
      
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.textContent = branch.name;
      item.onclick = () => {
        branchDropdownText.textContent = branch.name;
        branchDropdownMenu.style.display = 'none';
        editModalState.hasUnsavedChanges = true;
        
        // Update selected state
        branchDropdownMenu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      };
      branchDropdownMenu.appendChild(item);
    });

  } catch (error) {
    console.error('Failed to fetch branches:', error);
    branchDropdownText.textContent = currentBranch || 'master';
    branchDropdownBtn.disabled = false;
    
    // Add single item to menu
    branchDropdownMenu.innerHTML = '';
    const currentItem = document.createElement('div');
    currentItem.className = 'custom-dropdown-item selected';
    currentItem.textContent = currentBranch || 'master';
    currentItem.onclick = () => {
      branchDropdownMenu.style.display = 'none';
    };
    branchDropdownMenu.appendChild(currentItem);
    
    statusBar.showMessage('Failed to fetch branches. Using current branch.', { timeout: 3000 });
  }
}

async function openEditQueueModal(docId) {
  const item = queueCache.find(i => i.id === docId);
  if (!item) {
    alert('Queue item not found');
    return;
  }

  editModalState.currentDocId = docId;
  editModalState.hasUnsavedChanges = false;

  // Create modal if it doesn't exist
  let modal = document.getElementById('editQueueItemModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editQueueItemModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 700px;">
        <div class="modal-header">
          <h2 class="modal-title">Edit Queue Item</h2>
          <button class="btn-icon close-modal" id="closeEditQueueModal" title="Close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Type:</label>
            <div id="editQueueType" class="form-text"></div>
          </div>
          <div class="form-group" id="editPromptGroup">
            <label class="form-label">Prompt:</label>
            <textarea id="editQueuePrompt" class="form-control" rows="10" style="font-family: monospace; font-size: 13px;"></textarea>
          </div>
          <div class="form-group" id="editSubtasksGroup" style="display: none;">
            <label class="form-label">Subtasks:</label>
            <div id="editQueueSubtasksList"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Repository:</label>
            <input type="text" id="editQueueRepo" class="form-control" readonly />
          </div>
          <div class="form-group">
            <label class="form-label">Branch:</label>
            <div id="editQueueBranchDropdown" class="custom-dropdown">
              <button id="editQueueBranchDropdownBtn" class="custom-dropdown-btn w-full" type="button">
                <span id="editQueueBranchDropdownText">Loading branches...</span>
                <span class="custom-dropdown-caret" aria-hidden="true">▼</span>
              </button>
              <div id="editQueueBranchDropdownMenu" class="custom-dropdown-menu" role="menu"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancelEditQueue" class="btn">Cancel</button>
          <button id="saveEditQueue" class="btn primary">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Populate the form
  const typeDiv = document.getElementById('editQueueType');
  const promptGroup = document.getElementById('editPromptGroup');
  const subtasksGroup = document.getElementById('editSubtasksGroup');
  const promptTextarea = document.getElementById('editQueuePrompt');
  const subtasksList = document.getElementById('editQueueSubtasksList');
  const repoInput = document.getElementById('editQueueRepo');
  const branchDropdownBtn = document.getElementById('editQueueBranchDropdownBtn');
  const branchDropdownText = document.getElementById('editQueueBranchDropdownText');
  const branchDropdownMenu = document.getElementById('editQueueBranchDropdownMenu');

  if (item.type === 'single') {
    typeDiv.textContent = 'Single Prompt';
    promptGroup.style.display = 'block';
    subtasksGroup.style.display = 'none';
    promptTextarea.value = item.prompt || '';
    editModalState.originalData = { prompt: item.prompt || '' };
  } else if (item.type === 'subtasks') {
    typeDiv.textContent = 'Subtasks Batch';
    promptGroup.style.display = 'none';
    subtasksGroup.style.display = 'block';
    
    const subtasks = item.remaining || [];
    subtasksList.innerHTML = subtasks.map((subtask, index) => `
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">Subtask ${index + 1}:</label>
        <textarea class="form-control edit-subtask-content" data-index="${index}" rows="5" style="font-family: monospace; font-size: 12px;">${escapeHtml(subtask.fullContent || '')}</textarea>
      </div>
    `).join('');
    
    editModalState.originalData = { 
      subtasks: subtasks.map(s => s.fullContent || '') 
    };
  }

  repoInput.value = item.sourceId || '';
  editModalState.originalData.sourceId = item.sourceId || '';
  editModalState.originalData.branch = item.branch || 'master';

  // Fetch and populate branches
  await fetchAndPopulateBranches(item.sourceId, item.branch || 'master', branchDropdownBtn, branchDropdownText, branchDropdownMenu);

  // Show modal
  modal.style.display = 'flex';

  // Track changes
  const trackChanges = () => {
    editModalState.hasUnsavedChanges = true;
  };

  if (promptTextarea) {
    promptTextarea.oninput = trackChanges;
  }
  
  document.querySelectorAll('.edit-subtask-content').forEach(textarea => {
    textarea.oninput = trackChanges;
  });

  // Close modal handlers
  const closeModal = (force = false) => {
    if (!force && editModalState.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    modal.style.display = 'none';
    editModalState.hasUnsavedChanges = false;
    editModalState.originalData = null;
    editModalState.currentDocId = null;
  };

  document.getElementById('closeEditQueueModal').onclick = () => closeModal();
  document.getElementById('cancelEditQueue').onclick = () => closeModal();

  // Click outside to close
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };

  // Save handler
  document.getElementById('saveEditQueue').onclick = async () => {
    await saveQueueItemEdit(item, closeModal);
  };
}

async function saveQueueItemEdit(item, closeModalCallback) {
  const user = window.auth?.currentUser;
  if (!user) {
    alert('Not signed in');
    return;
  }

  try {
    const branchDropdownText = document.getElementById('editQueueBranchDropdownText');
    const updates = {
      branch: branchDropdownText.textContent.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (item.type === 'single') {
      const promptTextarea = document.getElementById('editQueuePrompt');
      updates.prompt = promptTextarea.value;
    } else if (item.type === 'subtasks') {
      const subtaskTextareas = document.querySelectorAll('.edit-subtask-content');
      const updatedSubtasks = Array.from(subtaskTextareas).map(textarea => ({
        fullContent: textarea.value
      }));
      updates.remaining = updatedSubtasks;
    }

    await updateJulesQueueItem(user.uid, item.id, updates);
    
    statusBar.showMessage('Queue item updated successfully', { timeout: 3000 });
    editModalState.hasUnsavedChanges = false;
    closeModalCallback(true);
    
    // Reload the queue
    await loadQueuePage();
  } catch (err) {
    alert('Failed to update queue item: ' + err.message);
  }
}

async function loadQueuePage() {
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
                <button class="btn-icon edit-queue-item" data-docid="${item.id}" title="Edit queue item">✏️</button>
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
              <button class="btn-icon edit-queue-item" data-docid="${item.id}" title="Edit queue item">✏️</button>
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

  // Import from jules-api module
  const { callRunJulesFunction } = await import('./jules-api.js');
  const { openUrlInBackground } = await import('./jules-modal.js');

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

  // Attach edit handlers
  document.querySelectorAll('.edit-queue-item').forEach(editBtn => {
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const docId = editBtn.dataset.docid;
      openEditQueueModal(docId);
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

  // Import from jules-api module
  const { callRunJulesFunction } = await import('./jules-api.js');
  const { openUrlInBackground } = await import('./jules-modal.js');

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
