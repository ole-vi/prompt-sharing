// ===== Jules Queue Module =====
// Manages Jules queue operations and UI rendering

import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';

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
  currentDocId: null,
  currentType: null,
  repoSelector: null,
  branchSelector: null
};

// Initialize repo and branch selectors
async function initializeEditRepoAndBranch(sourceId, branch, repoDropdownBtn, repoDropdownText, repoDropdownMenu, branchDropdownBtn, branchDropdownText, branchDropdownMenu) {
  // Create BranchSelector instance
  const branchSelector = new BranchSelector({
    dropdownBtn: branchDropdownBtn,
    dropdownText: branchDropdownText,
    dropdownMenu: branchDropdownMenu,
    onSelect: (selectedBranch) => {
      editModalState.hasUnsavedChanges = true;
    }
  });

  // Create RepoSelector instance
  const repoSelector = new RepoSelector({
    dropdownBtn: repoDropdownBtn,
    dropdownText: repoDropdownText,
    dropdownMenu: repoDropdownMenu,
    branchSelector: branchSelector,
    onSelect: (selectedSourceId) => {
      editModalState.hasUnsavedChanges = true;
    }
  });

  // Store selectors in state for later access
  editModalState.repoSelector = repoSelector;
  editModalState.branchSelector = branchSelector;

  await repoSelector.initialize(sourceId, branch);
}

function setupSubtasksEventDelegation() {
  const subtasksList = document.getElementById('editQueueSubtasksList');
  if (!subtasksList) return;
  
  if (subtasksList.dataset.listenerAttached) return;
  subtasksList.dataset.listenerAttached = 'true';
  
  subtasksList.addEventListener('click', (event) => {
    const target = event.target;
    
    if (target.classList.contains('add-subtask-btn')) {
      addNewSubtask();
      return;
    }
    
    const removeBtn = target.closest('.remove-subtask-btn');
    if (removeBtn) {
      const index = parseInt(removeBtn.dataset.index);
      removeSubtask(index);
      return;
    }
  });
  
  subtasksList.addEventListener('input', (event) => {
    if (event.target.classList.contains('edit-subtask-content')) {
      editModalState.hasUnsavedChanges = true;
    }
  });
}

async function openEditQueueModal(docId) {
  const item = queueCache.find(i => i.id === docId);
  if (!item) {
    showToast('Queue item not found', 'error');
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
            <label class="form-section-label">Type:</label>
            <div id="editQueueType" class="form-text"></div>
          </div>
          <div class="form-group" id="editPromptGroup">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-section-label" style="margin-bottom: 0;">Prompt:</label>
              <button type="button" id="convertToSubtasksBtn" class="btn btn-secondary" style="font-size: 12px; padding: 4px 12px;">Split into Subtasks</button>
            </div>
            <textarea id="editQueuePrompt" class="form-control" rows="10" style="font-family: monospace; font-size: 13px;"></textarea>
          </div>
          <div class="form-group" id="editSubtasksGroup" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-section-label" style="margin-bottom: 0;">Subtasks:</label>
              <button type="button" id="convertToSingleBtn" class="btn btn-secondary" style="font-size: 12px; padding: 4px 12px; display: none;">Convert to Single Prompt</button>
            </div>
            <div id="editQueueSubtasksList"></div>
          </div>
          <div class="form-group">
            <label class="form-section-label">Repository:</label>
            <div id="editQueueRepoDropdown" class="custom-dropdown">
              <button id="editQueueRepoDropdownBtn" class="custom-dropdown-btn w-full" type="button">
                <span id="editQueueRepoDropdownText">Loading...</span>
                <span class="custom-dropdown-caret" aria-hidden="true">▼</span>
              </button>
              <div id="editQueueRepoDropdownMenu" class="custom-dropdown-menu" role="menu"></div>
            </div>
          </div>
          <div class="form-group space-below">
            <label class="form-section-label">Branch:</label>
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
    
    document.getElementById('closeEditQueueModal').onclick = () => closeEditModal();
    document.getElementById('cancelEditQueue').onclick = () => closeEditModal();
    
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeEditModal();
      }
    };
    
    document.getElementById('saveEditQueue').onclick = async () => {
      await saveQueueItemEdit(editModalState.currentDocId, closeEditModal);
    };    
    setupSubtasksEventDelegation();    
    setupSubtasksEventDelegation();
  }

  // Populate the form
  const typeDiv = document.getElementById('editQueueType');
  const promptGroup = document.getElementById('editPromptGroup');
  const subtasksGroup = document.getElementById('editSubtasksGroup');
  const promptTextarea = document.getElementById('editQueuePrompt');
  const subtasksList = document.getElementById('editQueueSubtasksList');
  const repoDropdownBtn = document.getElementById('editQueueRepoDropdownBtn');
  const repoDropdownText = document.getElementById('editQueueRepoDropdownText');
  const repoDropdownMenu = document.getElementById('editQueueRepoDropdownMenu');
  const branchDropdownBtn = document.getElementById('editQueueBranchDropdownBtn');
  const branchDropdownText = document.getElementById('editQueueBranchDropdownText');
  const branchDropdownMenu = document.getElementById('editQueueBranchDropdownMenu');

  if (item.type === 'single') {
    typeDiv.textContent = 'Single Prompt';
    promptGroup.style.display = 'block';
    subtasksGroup.style.display = 'none';
    promptTextarea.value = item.prompt || '';
    editModalState.originalData = { prompt: item.prompt || '' };
    editModalState.currentType = 'single';
    
    // Set up convert to subtasks button
    document.getElementById('convertToSubtasksBtn').onclick = convertToSubtasks;
  } else if (item.type === 'subtasks') {
    typeDiv.textContent = 'Subtasks Batch';
    promptGroup.style.display = 'none';
    subtasksGroup.style.display = 'block';
    
    const subtasks = item.remaining || [];
    renderSubtasksList(subtasks);
    
    editModalState.originalData = { 
      subtasks: subtasks.map(s => s.fullContent || '') 
    };
    editModalState.currentType = 'subtasks';
    
    // Set up convert to single button
    document.getElementById('convertToSingleBtn').onclick = convertToSingle;
    updateConvertToSingleButtonVisibility();
  }

  editModalState.originalData.sourceId = item.sourceId || '';
  editModalState.originalData.branch = item.branch || 'master';

  // Initialize repo and branch selectors
  await initializeEditRepoAndBranch(item.sourceId, item.branch || 'master', repoDropdownBtn, repoDropdownText, repoDropdownMenu, branchDropdownBtn, branchDropdownText, branchDropdownMenu);

  // Show modal
  modal.style.display = 'flex';

  // Track changes
  const trackChanges = () => {
    editModalState.hasUnsavedChanges = true;
  };

  if (promptTextarea) {
    promptTextarea.oninput = trackChanges;
  }
}

/**
 * Convert single prompt to subtasks
 */
function convertToSubtasks() {
  const promptTextarea = document.getElementById('editQueuePrompt');
  const promptContent = promptTextarea.value.trim();
  
  const promptGroup = document.getElementById('editPromptGroup');
  const subtasksGroup = document.getElementById('editSubtasksGroup');
  const typeDiv = document.getElementById('editQueueType');
  
  // Switch view
  promptGroup.style.display = 'none';
  subtasksGroup.style.display = 'block';
  typeDiv.textContent = 'Subtasks Batch';
  
  // Create initial subtask from prompt
  const subtasks = promptContent ? [{ fullContent: promptContent }] : [{ fullContent: '' }];
  renderSubtasksList(subtasks);
  
  // Update state
  editModalState.currentType = 'subtasks';
  editModalState.hasUnsavedChanges = true;
  
  // Set up convert to single button
  document.getElementById('convertToSingleBtn').onclick = convertToSingle;
  updateConvertToSingleButtonVisibility();
}

/**
 * Convert subtasks to single prompt
 */
async function convertToSingle() {
  const currentSubtasks = Array.from(document.querySelectorAll('.edit-subtask-content')).map(textarea => textarea.value);
  
  if (currentSubtasks.length > 1) {
    const confirmed = await showConfirm('This will combine all subtasks into a single prompt. Continue?', {
      title: 'Convert to Single Prompt',
      confirmText: 'Convert',
      confirmStyle: 'warn'
    });
    if (!confirmed) return;
  }
  
  const promptGroup = document.getElementById('editPromptGroup');
  const subtasksGroup = document.getElementById('editSubtasksGroup');
  const typeDiv = document.getElementById('editQueueType');
  const promptTextarea = document.getElementById('editQueuePrompt');
  
  // Combine subtasks into single prompt
  const combinedPrompt = currentSubtasks.join('\n\n---\n\n');
  
  // Switch view
  subtasksGroup.style.display = 'none';
  promptGroup.style.display = 'block';
  typeDiv.textContent = 'Single Prompt';
  promptTextarea.value = combinedPrompt;
  
  // Update state
  editModalState.currentType = 'single';
  editModalState.hasUnsavedChanges = true;
  
  // Set up convert to subtasks button
  document.getElementById('convertToSubtasksBtn').onclick = convertToSubtasks;
}

/**
 * Update visibility of convert to single button based on subtask count
 */
function updateConvertToSingleButtonVisibility() {
  const convertBtn = document.getElementById('convertToSingleBtn');
  const subtaskCount = document.querySelectorAll('.edit-subtask-content').length;
  
  if (convertBtn) {
    convertBtn.style.display = subtaskCount === 1 ? 'block' : 'none';
  }
}

/**
 * Render subtasks list with add/remove buttons
 */
function renderSubtasksList(subtasks) {
  const subtasksList = document.getElementById('editQueueSubtasksList');
  if (!subtasksList) {
    console.error('editQueueSubtasksList element not found');
    return;
  }
  
  subtasksList.innerHTML = subtasks.map((subtask, index) => `
    <div class="form-group subtask-item" data-index="${index}">
      <div class="subtask-item-header">
        <label class="form-label">Subtask ${index + 1}:</label>
        <button type="button" class="remove-subtask-btn" data-index="${index}" title="Remove this subtask">✕</button>
      </div>
      <textarea class="form-control edit-subtask-content" rows="5">${escapeHtml(subtask.fullContent || '')}</textarea>
    </div>
  `).join('');
  
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'btn btn-secondary add-subtask-btn';
  addButton.textContent = '+ Add Subtask';
  subtasksList.appendChild(addButton);
  
  updateConvertToSingleButtonVisibility();
}

/**
 * Add a new empty subtask
 */
function addNewSubtask() {
  const currentSubtasks = Array.from(document.querySelectorAll('.edit-subtask-content')).map(textarea => ({
    fullContent: textarea.value
  }));
  
  // Add new empty subtask
  currentSubtasks.push({ fullContent: '' });
  
  // Re-render
  renderSubtasksList(currentSubtasks);
  
  // Mark as changed
  editModalState.hasUnsavedChanges = true;
  
  // Focus the new textarea
  const textareas = document.querySelectorAll('.edit-subtask-content');
  if (textareas.length > 0) {
    textareas[textareas.length - 1].focus();
  }
}

/**
 * Remove a subtask by index
 */
async function removeSubtask(index) {
  const currentSubtasks = Array.from(document.querySelectorAll('.edit-subtask-content')).map(textarea => ({
    fullContent: textarea.value
  }));
  
  if (currentSubtasks.length <= 1) {
    const confirmed = await showConfirm('This is the last subtask. Removing it will leave no subtasks. Continue?', {
      title: 'Remove Last Subtask',
      confirmText: 'Remove',
      confirmStyle: 'warn'
    });
    if (!confirmed) return;
  }
  
  // Remove the subtask at the specified index
  currentSubtasks.splice(index, 1);
  
  // Re-render
  renderSubtasksList(currentSubtasks);
  
  // Mark as changed
  editModalState.hasUnsavedChanges = true;
}

// Close modal handler function (defined outside so it can be referenced in event handlers)
async function closeEditModal(force = false) {
  const modal = document.getElementById('editQueueItemModal');
  if (!modal) return;
  
  if (!force && editModalState.hasUnsavedChanges) {
    const confirmed = await showConfirm('You have unsaved changes. Are you sure you want to close?', {
      title: 'Unsaved Changes',
      confirmText: 'Close Anyway',
      confirmStyle: 'warn'
    });
    if (!confirmed) return;
  }
  modal.style.display = 'none';
  editModalState.hasUnsavedChanges = false;
  editModalState.originalData = null;
  editModalState.currentDocId = null;
  editModalState.currentType = null;
  editModalState.repoSelector = null;
  editModalState.branchSelector = null;
}

async function saveQueueItemEdit(docId, closeModalCallback) {
  const item = queueCache.find(i => i.id === docId);
  if (!item) {
    showToast('Queue item not found', 'error');
    return;
  }
  
  const user = window.auth?.currentUser;
  if (!user) {
    showToast('Not signed in', 'error');
    return;
  }

  try {
    // Get values from selectors
    const sourceId = editModalState.repoSelector?.getSelectedSourceId();
    const branch = editModalState.branchSelector?.getSelectedBranch();
    
    const updates = {
      sourceId: sourceId || item.sourceId,
      branch: branch || item.branch || 'master',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Determine current type based on what's visible
    const currentType = editModalState.currentType || item.type;
    
    if (currentType === 'single') {
      const promptTextarea = document.getElementById('editQueuePrompt');
      updates.type = 'single';
      updates.prompt = promptTextarea.value;
      // Remove subtasks fields if converting from subtasks to single
      if (item.type === 'subtasks') {
        updates.remaining = firebase.firestore.FieldValue.delete();
        updates.totalCount = firebase.firestore.FieldValue.delete();
      }
    } else if (currentType === 'subtasks') {
      const subtaskTextareas = document.querySelectorAll('.edit-subtask-content');
      const updatedSubtasks = Array.from(subtaskTextareas).map(textarea => ({
        fullContent: textarea.value
      }));
      updates.type = 'subtasks';
      updates.remaining = updatedSubtasks;
      updates.totalCount = updatedSubtasks.length;
      // Remove prompt field if converting from single to subtasks
      if (item.type === 'single') {
        updates.prompt = firebase.firestore.FieldValue.delete();
      }
    }

    await updateJulesQueueItem(user.uid, item.id, updates);
    
    showToast('Queue item updated successfully', 'success');
    editModalState.hasUnsavedChanges = false;
    closeModalCallback(true);
    
    // Reload the queue
    await loadQueuePage();
  } catch (err) {
    showToast('Failed to update queue item: ' + err.message, 'error');
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
  if (!user) { showToast('Not signed in', 'error'); return; }
  
  const { queueSelections, subtaskSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0 && Object.keys(subtaskSelections).length === 0) {
    showToast('No items selected', 'warn');
    return;
  }
  
  const totalCount = queueSelections.length + Object.values(subtaskSelections).reduce((sum, arr) => sum + arr.length, 0);
  const confirmed = await showConfirm(`Delete ${totalCount} selected item(s)?`, {
    title: 'Delete Items',
    confirmText: 'Delete',
    confirmStyle: 'error'
  });
  if (!confirmed) return;
  
  try {
    for (const id of queueSelections) {
      await deleteFromJulesQueue(user.uid, id);
    }
    
    for (const [docId, indices] of Object.entries(subtaskSelections)) {
      if (queueSelections.includes(docId)) continue;
      
      await deleteSelectedSubtasks(docId, indices);
    }
    
    showToast(`Deleted ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`, 'success');
    await loadQueuePage();
  } catch (err) {
    showToast('Failed to delete selected items: ' + err.message, 'error');
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
  if (!user) { showToast('Not signed in', 'error'); return; }
  
  const { queueSelections, subtaskSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0 && Object.keys(subtaskSelections).length === 0) {
    showToast('No items selected', 'warn');
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
