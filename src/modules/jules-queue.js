import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { JULES_MESSAGES } from '../utils/constants.js';
import { createElement, createIcon } from '../utils/dom-helpers.js';

let queueCache = [];

export async function handleQueueAction(queueItemData) {
  const user = window.auth?.currentUser;
  if (!user) {
    showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
    return false;
  }
  try {
    await addToJulesQueue(user.uid, queueItemData);
    showToast(JULES_MESSAGES.QUEUED, 'success');
    return true;
  } catch (err) {
    showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
    return false;
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

async function initializeEditRepoAndBranch(sourceId, branch, repoDropdownBtn, repoDropdownText, repoDropdownMenu, branchDropdownBtn, branchDropdownText, branchDropdownMenu) {
  const branchSelector = new BranchSelector({
    dropdownBtn: branchDropdownBtn,
    dropdownText: branchDropdownText,
    dropdownMenu: branchDropdownMenu,
    onSelect: (selectedBranch) => {
      editModalState.hasUnsavedChanges = true;
    }
  });

  const repoSelector = new RepoSelector({
    dropdownBtn: repoDropdownBtn,
    dropdownText: repoDropdownText,
    dropdownMenu: repoDropdownMenu,
    branchSelector: branchSelector,
    onSelect: (selectedSourceId) => {
      editModalState.hasUnsavedChanges = true;
    }
  });

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
    showToast(JULES_MESSAGES.QUEUE_NOT_FOUND, 'error');
    return;
  }

  editModalState.currentDocId = docId;
  editModalState.hasUnsavedChanges = false;

  let modal = document.getElementById('editQueueItemModal');
  if (!modal) {

    modal = createElement('div', 'modal-overlay');
    modal.id = 'editQueueItemModal';

    const dialog = createElement('div', 'modal-dialog');
    dialog.style.maxWidth = '700px';

    // Header
    const header = createElement('div', 'modal-header');
    header.appendChild(createElement('h2', 'modal-title', 'Edit Queue Item'));

    const closeBtn = createElement('button', 'btn-icon close-modal');
    closeBtn.id = 'closeEditQueueModal';
    closeBtn.title = 'Close';
    closeBtn.appendChild(createIcon('close'));
    header.appendChild(closeBtn);

    // Body
    const body = createElement('div', 'modal-body');

    // Type Section
    const typeGroup = createElement('div', 'form-group');
    typeGroup.appendChild(createElement('label', 'form-section-label', 'Type:'));
    const typeText = createElement('div', 'form-text');
    typeText.id = 'editQueueType';
    typeGroup.appendChild(typeText);
    body.appendChild(typeGroup);

    // Prompt Group
    const promptGroup = createElement('div', 'form-group');
    promptGroup.id = 'editPromptGroup';
    const promptHeader = createElement('div');
    promptHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
    const promptLabel = createElement('label', 'form-section-label', 'Prompt:');
    promptLabel.style.marginBottom = '0';
    promptHeader.appendChild(promptLabel);

    const splitBtn = createElement('button', 'btn btn-secondary', 'Split into Subtasks');
    splitBtn.type = 'button';
    splitBtn.id = 'convertToSubtasksBtn';
    splitBtn.style.cssText = 'font-size: 12px; padding: 4px 12px;';
    promptHeader.appendChild(splitBtn);
    promptGroup.appendChild(promptHeader);

    const promptTextarea = createElement('textarea', 'form-control');
    promptTextarea.id = 'editQueuePrompt';
    promptTextarea.rows = 10;
    promptTextarea.style.cssText = 'font-family: monospace; font-size: 13px;';
    promptGroup.appendChild(promptTextarea);
    body.appendChild(promptGroup);

    // Subtasks Group
    const subtasksGroup = createElement('div', 'form-group');
    subtasksGroup.id = 'editSubtasksGroup';
    subtasksGroup.style.display = 'none';

    const subtasksHeader = createElement('div');
    subtasksHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
    const subtasksLabel = createElement('label', 'form-section-label', 'Subtasks:');
    subtasksLabel.style.marginBottom = '0';
    subtasksHeader.appendChild(subtasksLabel);

    const convertBtn = createElement('button', 'btn btn-secondary', 'Convert to Single Prompt');
    convertBtn.type = 'button';
    convertBtn.id = 'convertToSingleBtn';
    convertBtn.style.cssText = 'font-size: 12px; padding: 4px 12px; display: none;';
    subtasksHeader.appendChild(convertBtn);
    subtasksGroup.appendChild(subtasksHeader);

    const subtasksList = createElement('div');
    subtasksList.id = 'editQueueSubtasksList';
    subtasksGroup.appendChild(subtasksList);
    body.appendChild(subtasksGroup);

    // Repository Dropdown
    const repoGroup = createElement('div', 'form-group');
    repoGroup.appendChild(createElement('label', 'form-section-label', 'Repository:'));

    const repoDropdown = createElement('div', 'custom-dropdown');
    repoDropdown.id = 'editQueueRepoDropdown';

    const repoBtn = createElement('button', 'custom-dropdown-btn w-full');
    repoBtn.id = 'editQueueRepoDropdownBtn';
    repoBtn.type = 'button';
    const repoText = createElement('span', '', 'Loading...');
    repoText.id = 'editQueueRepoDropdownText';
    repoBtn.appendChild(repoText);
    const repoCaret = createElement('span', 'custom-dropdown-caret', '▼');
    repoCaret.setAttribute('aria-hidden', 'true');
    repoBtn.appendChild(repoCaret);
    repoDropdown.appendChild(repoBtn);

    const repoMenu = createElement('div', 'custom-dropdown-menu');
    repoMenu.id = 'editQueueRepoDropdownMenu';
    repoMenu.setAttribute('role', 'menu');
    repoDropdown.appendChild(repoMenu);

    repoGroup.appendChild(repoDropdown);
    body.appendChild(repoGroup);

    // Branch Dropdown
    const branchGroup = createElement('div', 'form-group space-below');
    branchGroup.appendChild(createElement('label', 'form-section-label', 'Branch:'));

    const branchDropdown = createElement('div', 'custom-dropdown');
    branchDropdown.id = 'editQueueBranchDropdown';

    const branchBtn = createElement('button', 'custom-dropdown-btn w-full');
    branchBtn.id = 'editQueueBranchDropdownBtn';
    branchBtn.type = 'button';
    const branchText = createElement('span', '', 'Loading branches...');
    branchText.id = 'editQueueBranchDropdownText';
    branchBtn.appendChild(branchText);
    const branchCaret = createElement('span', 'custom-dropdown-caret', '▼');
    branchCaret.setAttribute('aria-hidden', 'true');
    branchBtn.appendChild(branchCaret);
    branchDropdown.appendChild(branchBtn);

    const branchMenu = createElement('div', 'custom-dropdown-menu');
    branchMenu.id = 'editQueueBranchDropdownMenu';
    branchMenu.setAttribute('role', 'menu');
    branchDropdown.appendChild(branchMenu);

    branchGroup.appendChild(branchDropdown);
    body.appendChild(branchGroup);

    // Footer
    const footer = createElement('div', 'modal-footer');
    const cancelBtn = createElement('button', 'btn', 'Cancel');
    cancelBtn.id = 'cancelEditQueue';
    const saveBtn = createElement('button', 'btn primary', 'Save');
    saveBtn.id = 'saveEditQueue';

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    modal.appendChild(dialog);

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
  }

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
    
    document.getElementById('convertToSingleBtn').onclick = convertToSingle;
    updateConvertToSingleButtonVisibility();
  }

  editModalState.originalData.sourceId = item.sourceId || '';
  editModalState.originalData.branch = item.branch || 'master';

  await initializeEditRepoAndBranch(item.sourceId, item.branch || 'master', repoDropdownBtn, repoDropdownText, repoDropdownMenu, branchDropdownBtn, branchDropdownText, branchDropdownMenu);

  modal.style.display = 'flex';

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
  
  promptGroup.style.display = 'none';
  subtasksGroup.style.display = 'block';
  typeDiv.textContent = 'Subtasks Batch';
  
  const subtasks = promptContent ? [{ fullContent: promptContent }] : [{ fullContent: '' }];
  renderSubtasksList(subtasks);
  
  editModalState.currentType = 'subtasks';
  editModalState.hasUnsavedChanges = true;
  
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
  
  const combinedPrompt = currentSubtasks.join('\n\n---\n\n');
  
  subtasksGroup.style.display = 'none';
  promptGroup.style.display = 'block';
  typeDiv.textContent = 'Single Prompt';
  promptTextarea.value = combinedPrompt;
  
  editModalState.currentType = 'single';
  editModalState.hasUnsavedChanges = true;
  
  document.getElementById('convertToSubtasksBtn').onclick = convertToSubtasks;
}

function updateConvertToSingleButtonVisibility() {
  const convertBtn = document.getElementById('convertToSingleBtn');
  const subtaskCount = document.querySelectorAll('.edit-subtask-content').length;
  
  if (convertBtn) {
    convertBtn.style.display = subtaskCount === 1 ? 'block' : 'none';
  }
}

function renderSubtasksList(subtasks) {
  const subtasksList = document.getElementById('editQueueSubtasksList');
  if (!subtasksList) {
    console.error('editQueueSubtasksList element not found');
    return;
  }
  
  subtasksList.replaceChildren();

  subtasks.forEach((subtask, index) => {
      const itemDiv = createElement('div', 'form-group subtask-item');
      itemDiv.dataset.index = index;

      const header = createElement('div', 'subtask-item-header');
      header.appendChild(createElement('label', 'form-label', `Subtask ${index + 1}:`));

      const removeBtn = createElement('button', 'remove-subtask-btn');
      removeBtn.type = 'button';
      removeBtn.dataset.index = index;
      removeBtn.title = 'Remove this subtask';
      removeBtn.appendChild(createIcon('close'));
      header.appendChild(removeBtn);

      const textarea = createElement('textarea', 'form-control edit-subtask-content');
      textarea.rows = 5;
      textarea.value = subtask.fullContent || '';

      itemDiv.appendChild(header);
      itemDiv.appendChild(textarea);
      subtasksList.appendChild(itemDiv);
  });
  
  const addButton = createElement('button', 'btn btn-secondary add-subtask-btn', '+ Add Subtask');
  addButton.type = 'button';
  subtasksList.appendChild(addButton);
  
  updateConvertToSingleButtonVisibility();
}

function addNewSubtask() {
  const currentSubtasks = Array.from(document.querySelectorAll('.edit-subtask-content')).map(textarea => ({
    fullContent: textarea.value
  }));
  
  currentSubtasks.push({ fullContent: '' });
  
  renderSubtasksList(currentSubtasks);
  
  editModalState.hasUnsavedChanges = true;
  
  const textareas = document.querySelectorAll('.edit-subtask-content');
  if (textareas.length > 0) {
    textareas[textareas.length - 1].focus();
  }
}

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
  
  currentSubtasks.splice(index, 1);
  
  renderSubtasksList(currentSubtasks);
  
  editModalState.hasUnsavedChanges = true;
}

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
    showToast(JULES_MESSAGES.QUEUE_NOT_FOUND, 'error');
    return;
  }
  
  const user = window.auth?.currentUser;
  if (!user) {
    showToast(JULES_MESSAGES.NOT_SIGNED_IN, 'error');
    return;
  }

  try {
    const sourceId = editModalState.repoSelector?.getSelectedSourceId();
    const branch = editModalState.branchSelector?.getSelectedBranch();
    
    const updates = {
      sourceId: sourceId || item.sourceId,
      branch: branch || item.branch || 'master',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const currentType = editModalState.currentType || item.type;
    
    if (currentType === 'single') {
      const promptTextarea = document.getElementById('editQueuePrompt');
      updates.type = 'single';
      updates.prompt = promptTextarea.value;
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
      if (item.type === 'single') {
        updates.prompt = firebase.firestore.FieldValue.delete();
      }
    }

    await updateJulesQueueItem(user.uid, item.id, updates);
    
    showToast(JULES_MESSAGES.QUEUE_UPDATED, 'success');
    editModalState.hasUnsavedChanges = false;
    closeModalCallback(true);
    
    await loadQueuePage();
  } catch (err) {
    showToast(JULES_MESSAGES.QUEUE_UPDATE_FAILED(err.message), 'error');
  }
}

async function loadQueuePage() {
  const user = window.auth?.currentUser;
  const listDiv = document.getElementById('allQueueList');
  if (!user) {
    listDiv.replaceChildren(createElement('div', 'panel text-center pad-xl muted-text', 'Please sign in to view your queue.'));
    return;
  }

  try {
    let items = getCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);
    
    if (!items) {
      listDiv.replaceChildren(createElement('div', 'panel text-center pad-xl muted-text', 'Loading queue...'));
      items = await listJulesQueue(user.uid);
      setCache(CACHE_KEYS.QUEUE_ITEMS, items, user.uid);
    }
    
    queueCache = items;
    renderQueueList(items);
    attachQueueModalHandlers();
  } catch (err) {
    listDiv.replaceChildren(createElement('div', 'panel text-center pad-xl', `Failed to load queue: ${err.message}`));
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
    listDiv.replaceChildren(createElement('div', 'panel text-center pad-xl muted-text', 'No queued items.'));
    return;
  }

  listDiv.replaceChildren();

  items.forEach(item => {
    const created = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString() : 'Unknown';
    const status = item.status || 'pending';

    const card = createElement('div', 'queue-card queue-item');
    card.dataset.docid = item.id;

    const row = createElement('div', 'queue-row');

    const checkboxCol = createElement('div', 'queue-checkbox-col');
    const checkbox = createElement('input', 'queue-checkbox');
    checkbox.type = 'checkbox';
    checkbox.dataset.docid = item.id;
    checkboxCol.appendChild(checkbox);

    const content = createElement('div', 'queue-content');

    const titleDiv = createElement('div', 'queue-title');
    
    if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
        const remainingCount = item.remaining.length;
        titleDiv.appendChild(document.createTextNode(`Subtasks Batch `));

        const statusSpan = createElement('span', 'queue-status', status);
        titleDiv.appendChild(statusSpan);
        titleDiv.appendChild(document.createTextNode(' '));
        const countSpan = createElement('span', 'queue-status', `(${remainingCount} remaining)`);
        titleDiv.appendChild(countSpan);
    } else {
        titleDiv.appendChild(document.createTextNode(`Single Prompt `));
        const statusSpan = createElement('span', 'queue-status', status);
        titleDiv.appendChild(statusSpan);
    }

    const editBtn = createElement('button', 'btn-icon edit-queue-item');
    editBtn.dataset.docid = item.id;
    editBtn.title = 'Edit queue item';
    editBtn.appendChild(createIcon('edit', 'icon icon-inline'));
    titleDiv.appendChild(editBtn);

    content.appendChild(titleDiv);

    const metaDiv = createElement('div', 'queue-meta');
    metaDiv.appendChild(document.createTextNode(`Created: ${created} • ID: `));
    const monoSpan = createElement('span', 'mono', item.id);
    metaDiv.appendChild(monoSpan);
    content.appendChild(metaDiv);

    if (item.sourceId) {
        const repoDisplay = createElement('div', 'queue-repo');
        repoDisplay.appendChild(createIcon('inventory_2', 'icon icon-inline'));
        repoDisplay.appendChild(document.createTextNode(` ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})`));
        content.appendChild(repoDisplay);
    }

    if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
         // Subtasks are rendered in a separate container below the row.
    } else {
        const promptPreview = (item.prompt || '').substring(0, 200);
        const promptDiv = createElement('div', 'queue-prompt', promptPreview + (promptPreview.length >= 200 ? '...' : ''));
        content.appendChild(promptDiv);
    }

    row.appendChild(checkboxCol);
    row.appendChild(content);
    card.appendChild(row);
    
    if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
        const subtasksContainer = createElement('div', 'queue-subtasks');
        item.remaining.forEach((subtask, index) => {
             const preview = (subtask.fullContent || '').substring(0, 150);
             const subDiv = createElement('div', 'queue-subtask');

             const indexDiv = createElement('div', 'queue-subtask-index');
             const subCb = createElement('input', 'subtask-checkbox');
             subCb.type = 'checkbox';
             subCb.dataset.docid = item.id;
             subCb.dataset.index = index;
             indexDiv.appendChild(subCb);

             const subContent = createElement('div', 'queue-subtask-content');
             const subMeta = createElement('div', 'queue-subtask-meta', `Subtask ${index + 1} of ${item.remaining.length}`);
             const subText = createElement('div', 'queue-subtask-text', preview + (preview.length >= 150 ? '...' : ''));

             subContent.appendChild(subMeta);
             subContent.appendChild(subText);

             subDiv.appendChild(indexDiv);
             subDiv.appendChild(subContent);
             subtasksContainer.appendChild(subDiv);
        });
        card.appendChild(subtasksContainer);
    }

    listDiv.appendChild(card);
  });
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

  const { callRunJulesFunction } = await import('./jules-api.js');
  const { openUrlInBackground, showSubtaskErrorModal } = await import('./jules-modal.js');

  const successfulIndices = [];
  const skippedIndices = [];

  for (let i = 0; i < toRun.length; i++) {
    const subtask = toRun[i];
    const originalIndex = sortedIndices[i];
    let retry = true;
    
    while (retry) {
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
        successfulIndices.push(originalIndex);
        await new Promise(r => setTimeout(r, 800));
        retry = false;
      } catch (err) {
        const result = await showSubtaskErrorModal(i + 1, toRun.length, err, true);
        
        if (result.action === 'retry') {
          if (result.shouldDelay) await new Promise(r => setTimeout(r, 5000));
          continue;
        } else if (result.action === 'skip') {
          skippedIndices.push(originalIndex);
          retry = false;
        } else if (result.action === 'queue') {
          if (successfulIndices.length > 0) {
            await deleteSelectedSubtasks(docId, successfulIndices);
          }
          return { successful: successfulIndices.length, skipped: skippedIndices.length };
        } else {
          if (successfulIndices.length > 0) {
            await deleteSelectedSubtasks(docId, successfulIndices);
          }
          const err = new Error('User cancelled');
          err.successfulCount = successfulIndices.length;
          throw err;
        }
      }
    }
  }

  if (successfulIndices.length > 0) {
    await deleteSelectedSubtasks(docId, successfulIndices);
  }
  
  return { successful: successfulIndices.length, skipped: skippedIndices.length };
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
  if (!user) { showToast(JULES_MESSAGES.NOT_SIGNED_IN, 'error'); return; }
  
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
    
    showToast(JULES_MESSAGES.deleted(totalCount), 'success');
    await loadQueuePage();
  } catch (err) {
    showToast(JULES_MESSAGES.DELETE_FAILED(err.message), 'error');
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
  if (!user) { showToast(JULES_MESSAGES.NOT_SIGNED_IN, 'error'); return; }
  
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

  const { callRunJulesFunction } = await import('./jules-api.js');
  const { openUrlInBackground, showSubtaskErrorModal } = await import('./jules-modal.js');

  const sortedSubtaskEntries = Object.entries(subtaskSelections).sort(([a], [b]) => 
    (queueCache.find(i => i.id === a)?.createdAt?.seconds || 0) - (queueCache.find(i => i.id === b)?.createdAt?.seconds || 0)
  );
  const totalSubtasks = Object.entries(subtaskSelections)
    .filter(([docId]) => !queueSelections.includes(docId))
    .reduce((sum, [, indices]) => sum + indices.length, 0);
  const totalSingles = queueSelections.filter(id => {
    const item = queueCache.find(i => i.id === id);
    return item?.type === 'single';
  }).length;
  const totalFullSubtaskQueues = queueSelections.filter(id => {
    const item = queueCache.find(i => i.id === id);
    return item?.type === 'subtasks';
  }).reduce((sum, id) => {
    const item = queueCache.find(i => i.id === id);
    return sum + (item?.remaining?.length || 0);
  }, 0);
  const totalItems = totalSubtasks + totalSingles + totalFullSubtaskQueues;
  let currentItemNumber = 0;
  let totalSkipped = 0;
  let totalSuccessful = 0;

  for (const [docId, indices] of sortedSubtaskEntries) {
    if (paused) break;
    if (queueSelections.includes(docId)) continue;
    
    try {
      const result = await runSelectedSubtasks(docId, indices.slice().sort((a, b) => a - b), suppressPopups, openInBackground);
      currentItemNumber += indices.length;
      if (result && result.skipped > 0) {
        totalSkipped += result.skipped;
      }
      if (result && result.successful > 0) {
        totalSuccessful += result.successful;
      }
    } catch (err) {
      if (err.message === 'User cancelled') {
        if (err.successfulCount) {
          totalSuccessful += err.successfulCount;
        }
        showToast(JULES_MESSAGES.cancelled(totalSuccessful, totalItems), 'warn');
        statusBar.clear();
        await loadQueuePage();
        return;
      }
      throw err;
    }
  }
  
  for (const id of sortByCreatedAt(queueSelections)) {
    if (paused) break;
    const item = queueCache.find(i => i.id === id);
    if (!item) continue;

    try {
      if (item.type === 'single') {
        currentItemNumber++;
        let retry = true;
        while (retry) {
          try {
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
            totalSuccessful++;
            retry = false;
          } catch (singleErr) {
            const result = await showSubtaskErrorModal(currentItemNumber, totalItems, singleErr, true);
            if (result.action === 'retry') {
              if (result.shouldDelay) await new Promise(r => setTimeout(r, 5000));
              continue;
            } else if (result.action === 'skip') {
              totalSkipped++;
              retry = false;
            } else if (result.action === 'queue') {
              retry = false;
            } else {
              showToast(JULES_MESSAGES.cancelled(totalSuccessful, totalItems), 'warn');
              statusBar.clear();
              await loadQueuePage();
              return;
            }
          }
        }
      } else if (item.type === 'subtasks') {
        let remaining = Array.isArray(item.remaining) ? item.remaining.slice() : [];
        const skippedSubtasks = [];

        const initialCount = remaining.length;
        let subtaskNumber = 0;
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

          currentItemNumber++;
          subtaskNumber++;
          const s = remaining[0];
          let subtaskRetry = true;
          while (subtaskRetry) {
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

              remaining.shift();
              totalSuccessful++;

              try {
                await updateJulesQueueItem(user.uid, id, {
                  remaining,
                  status: remaining.length === 0 ? 'done' : 'in-progress',
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              } catch (e) {
                console.warn('Failed to persist progress for queue item', id, e.message || e);
              }

              try {
                const done = initialCount - remaining.length;
                const percent = initialCount > 0 ? Math.round((done / initialCount) * 100) : 100;
                statusBar.setProgress(`${done}/${initialCount}`, percent);
                statusBar.showMessage(`Processing subtask ${done}/${initialCount}`, { timeout: 0 });
              } catch (e) {}

              await new Promise(r => setTimeout(r, 800));
              subtaskRetry = false;
            } catch (err) {
              const result = await showSubtaskErrorModal(subtaskNumber, initialCount, err, true);
              
              if (result.action === 'retry') {
                if (result.shouldDelay) await new Promise(r => setTimeout(r, 5000));
                continue;
              } else if (result.action === 'skip') {
                totalSkipped++;
                skippedSubtasks.push(remaining.shift());
                try {
                  await updateJulesQueueItem(user.uid, id, {
                    remaining: [...skippedSubtasks, ...remaining],
                    status: 'pending',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                } catch (e) {
                  console.warn('Failed to persist remaining after skip', e);
                }
                statusBar.showMessage(JULES_MESSAGES.SKIPPED_SUBTASK, { timeout: 2000 });
                subtaskRetry = false;
              } else if (result.action === 'queue') {
                try {
                  await updateJulesQueueItem(user.uid, id, {
                    remaining,
                    status: 'pending',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                } catch (e) {
                  console.warn('Failed to persist queue state', e);
                }
                statusBar.showMessage('Remainder queued for later', { timeout: 3000 });
                statusBar.clearProgress();
                statusBar.clearAction();
                await loadQueuePage();
                return;
              } else {
                try {
                  await updateJulesQueueItem(user.uid, id, {
                    remaining,
                    status: 'error',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                } catch (e) {
                  console.warn('Failed to persist error state', e);
                }
                showToast(JULES_MESSAGES.cancelled(totalSuccessful, totalItems), 'warn');
                statusBar.clear();
                await loadQueuePage();
                return;
              }
            }
          }
        }

        if (skippedSubtasks.length > 0 && remaining.length === 0) {
          try {
            await updateJulesQueueItem(user.uid, id, {
              remaining: skippedSubtasks,
              status: 'pending',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (e) {
            console.warn('Failed to save skipped subtasks', e);
          }
        } else if (skippedSubtasks.length === 0 && remaining.length === 0) {
          await deleteFromJulesQueue(user.uid, id);
        }
      } else {
        console.warn('Unknown queue item type', item.type);
      }
    } catch (err) {
      if (err.message === 'User cancelled') {
        showToast(JULES_MESSAGES.cancelled(totalSuccessful, totalItems), 'warn');
        statusBar.clear();
        await loadQueuePage();
        return;
      }
      console.error('Unexpected error running queue item', id, err);
      showToast(JULES_MESSAGES.UNEXPECTED_ERROR(err.message), 'error');
      statusBar.clearProgress();
      statusBar.clearAction();
      await loadQueuePage();
      return;
    }
  }

  if (totalSkipped > 0 && totalSuccessful === 0) {
    showToast(JULES_MESSAGES.cancelled(0, totalItems), 'warn');
  } else if (totalSkipped > 0) {
    showToast(JULES_MESSAGES.completedWithSkipped(totalSuccessful, totalSkipped), 'success');
  } else {
    showToast(JULES_MESSAGES.COMPLETED_RUNNING, 'success');
  }
  statusBar.clear();
  statusBar.clearAction();
  await loadQueuePage();
}
