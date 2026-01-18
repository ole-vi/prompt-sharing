import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { JULES_MESSAGES, TIMEOUTS } from '../utils/constants.js';
import { createElement, createIconElement, clearElement } from '../utils/dom-helpers.js';

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
  branchSelector: null,
  isUnscheduled: false
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

function displayScheduleStatus(item) {
  const statusGroup = document.getElementById('editQueueStatusGroup');
  const scheduleText = document.getElementById('editQueueScheduleText');
  const unscheduleBtn = document.getElementById('unscheduleBtn');
  
  if (!statusGroup || !scheduleText) return;
  
  if (item.status === 'scheduled' && item.scheduledAt) {
    const scheduledDate = new Date(item.scheduledAt.seconds * 1000);
    const timeZone = item.scheduledTimeZone || 'America/New_York';
    const dateStr = scheduledDate.toLocaleString('en-US', {
      timeZone: timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    scheduleText.textContent = `Scheduled for ${dateStr} (${timeZone})`;
    statusGroup.classList.remove('hidden');
    
    if (unscheduleBtn) {
      unscheduleBtn.onclick = () => {
        unscheduleQueueItem();
      };
    }
  } else {
    statusGroup.classList.add('hidden');
  }
}

function unscheduleQueueItem() {
  const statusGroup = document.getElementById('editQueueStatusGroup');
  if (statusGroup) {
    statusGroup.classList.add('hidden');
  }
  
  editModalState.isUnscheduled = true;
  editModalState.hasUnsavedChanges = true;
  
  showToast('Item marked for unscheduling. Click Save to confirm.', 'info');
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
    // Modal Structure
    modal = createElement('div', { id: 'editQueueItemModal', class: 'modal-overlay' });

    const dialog = createElement('div', { class: 'modal-dialog modal-dialog-lg' });

    // Header
    const header = createElement('div', { class: 'modal-header' });
    header.appendChild(createElement('h2', { class: 'modal-title' }, 'Edit Queue Item'));

    const closeBtn = createElement('button', { class: 'btn-icon close-modal', id: 'closeEditQueueModal', title: 'Close' });
    closeBtn.appendChild(createIconElement('close'));
    header.appendChild(closeBtn);

    dialog.appendChild(header);

    // Body
    const body = createElement('div', { class: 'modal-body' });

    // Type Section
    const typeGroup = createElement('div', { class: 'form-group' });
    typeGroup.appendChild(createElement('label', { class: 'form-section-label' }, 'Type:'));
    typeGroup.appendChild(createElement('div', { id: 'editQueueType', class: 'form-text' }));
    body.appendChild(typeGroup);

    // Schedule Section
    const scheduleGroup = createElement('div', { class: 'form-group hidden', id: 'editQueueStatusGroup' });
    scheduleGroup.appendChild(createElement('label', { class: 'form-section-label' }, 'Schedule:'));

    const scheduleInfo = createElement('div', { id: 'editQueueScheduleInfo', class: 'form-text schedule-info-row' });
    scheduleInfo.appendChild(createElement('div', { id: 'editQueueScheduleText' }));
    scheduleInfo.appendChild(createElement('button', { type: 'button', id: 'unscheduleBtn', class: 'btn btn-secondary btn-xs' }, 'Unschedule'));
    scheduleGroup.appendChild(scheduleInfo);
    body.appendChild(scheduleGroup);

    // Prompt Section
    const promptGroup = createElement('div', { class: 'form-group', id: 'editPromptGroup' });
    const promptHeader = createElement('div', { class: 'form-group-header' });
    promptHeader.appendChild(createElement('label', { class: 'form-section-label' }, 'Prompt:'));
    promptHeader.appendChild(createElement('button', { type: 'button', id: 'convertToSubtasksBtn', class: 'btn btn-secondary btn-xs' }, 'Split into Subtasks'));
    promptGroup.appendChild(promptHeader);
    promptGroup.appendChild(createElement('textarea', { id: 'editQueuePrompt', class: 'form-control form-control-mono', rows: '10' }));
    body.appendChild(promptGroup);

    // Subtasks Section
    const subtasksGroup = createElement('div', { class: 'form-group hidden', id: 'editSubtasksGroup' });
    const subtasksHeader = createElement('div', { class: 'form-group-header' });
    subtasksHeader.appendChild(createElement('label', { class: 'form-section-label' }, 'Subtasks:'));
    subtasksHeader.appendChild(createElement('button', { type: 'button', id: 'convertToSingleBtn', class: 'btn btn-secondary btn-xs hidden' }, 'Convert to Single Prompt'));
    subtasksGroup.appendChild(subtasksHeader);
    subtasksGroup.appendChild(createElement('div', { id: 'editQueueSubtasksList' }));
    body.appendChild(subtasksGroup);

    // Repository Section
    const repoGroup = createElement('div', { class: 'form-group' });
    repoGroup.appendChild(createElement('label', { class: 'form-section-label' }, 'Repository:'));
    const repoDropdown = createElement('div', { id: 'editQueueRepoDropdown', class: 'custom-dropdown' });
    const repoBtn = createElement('button', { id: 'editQueueRepoDropdownBtn', class: 'custom-dropdown-btn w-full', type: 'button' });
    repoBtn.appendChild(createElement('span', { id: 'editQueueRepoDropdownText' }, 'Loading...'));
    repoBtn.appendChild(createElement('span', { class: 'custom-dropdown-caret', 'aria-hidden': 'true' }, '▼'));
    repoDropdown.appendChild(repoBtn);
    repoDropdown.appendChild(createElement('div', { id: 'editQueueRepoDropdownMenu', class: 'custom-dropdown-menu', role: 'menu' }));
    repoGroup.appendChild(repoDropdown);
    body.appendChild(repoGroup);

    // Branch Section
    const branchGroup = createElement('div', { class: 'form-group space-below' });
    branchGroup.appendChild(createElement('label', { class: 'form-section-label' }, 'Branch:'));
    const branchDropdown = createElement('div', { id: 'editQueueBranchDropdown', class: 'custom-dropdown' });
    const branchBtn = createElement('button', { id: 'editQueueBranchDropdownBtn', class: 'custom-dropdown-btn w-full', type: 'button' });
    branchBtn.appendChild(createElement('span', { id: 'editQueueBranchDropdownText' }, 'Loading branches...'));
    branchBtn.appendChild(createElement('span', { class: 'custom-dropdown-caret', 'aria-hidden': 'true' }, '▼'));
    branchDropdown.appendChild(branchBtn);
    branchDropdown.appendChild(createElement('div', { id: 'editQueueBranchDropdownMenu', class: 'custom-dropdown-menu', role: 'menu' }));
    branchGroup.appendChild(branchDropdown);
    body.appendChild(branchGroup);

    dialog.appendChild(body);

    // Footer
    const footer = createElement('div', { class: 'modal-footer' });
    footer.appendChild(createElement('button', { id: 'cancelEditQueue', class: 'btn' }, 'Cancel'));
    footer.appendChild(createElement('button', { id: 'saveEditQueue', class: 'btn primary' }, 'Save'));
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
  const repoDropdownBtn = document.getElementById('editQueueRepoDropdownBtn');
  const repoDropdownText = document.getElementById('editQueueRepoDropdownText');
  const repoDropdownMenu = document.getElementById('editQueueRepoDropdownMenu');
  const branchDropdownBtn = document.getElementById('editQueueBranchDropdownBtn');
  const branchDropdownText = document.getElementById('editQueueBranchDropdownText');
  const branchDropdownMenu = document.getElementById('editQueueBranchDropdownMenu');

  if (item.type === 'single') {
    typeDiv.textContent = 'Single Prompt';
    promptGroup.classList.remove('hidden');
    subtasksGroup.classList.add('hidden');
    promptTextarea.value = item.prompt || '';
    editModalState.originalData = { prompt: item.prompt || '' };
    editModalState.currentType = 'single';
    
    document.getElementById('convertToSubtasksBtn').onclick = convertToSubtasks;
  } else if (item.type === 'subtasks') {
    typeDiv.textContent = 'Subtasks Batch';
    promptGroup.classList.add('hidden');
    subtasksGroup.classList.remove('hidden');
    
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

  displayScheduleStatus(item);

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
  
  promptGroup.classList.add('hidden');
  subtasksGroup.classList.remove('hidden');
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
  
  subtasksGroup.classList.add('hidden');
  promptGroup.classList.remove('hidden');
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
    if (subtaskCount === 1) {
      convertBtn.classList.remove('hidden');
    } else {
      convertBtn.classList.add('hidden');
    }
  }
}

function renderSubtasksList(subtasks) {
  const subtasksList = document.getElementById('editQueueSubtasksList');
  if (!subtasksList) {
    console.error('editQueueSubtasksList element not found');
    return;
  }
  
  clearElement(subtasksList);

  subtasks.forEach((subtask, index) => {
    const itemDiv = createElement('div', { class: 'form-group subtask-item', 'data-index': index });

    const header = createElement('div', { class: 'subtask-item-header' });
    header.appendChild(createElement('label', { class: 'form-label' }, `Subtask ${index + 1}:`));

    const removeBtn = createElement('button', {
      type: 'button',
      class: 'remove-subtask-btn',
      'data-index': index,
      title: 'Remove this subtask'
    });
    removeBtn.appendChild(createIconElement('close'));
    header.appendChild(removeBtn);

    itemDiv.appendChild(header);

    const textarea = createElement('textarea', { class: 'form-control edit-subtask-content', rows: '5' });
    textarea.value = subtask.fullContent || '';
    itemDiv.appendChild(textarea);

    subtasksList.appendChild(itemDiv);
  });
  
  const addButton = createElement('button', {
    type: 'button',
    class: 'btn btn-secondary add-subtask-btn'
  }, '+ Add Subtask');
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
  editModalState.isUnscheduled = false;
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
    
    if (editModalState.isUnscheduled) {
      updates.status = 'pending';
      updates.scheduledAt = firebase.firestore.FieldValue.delete();
      updates.scheduledTimeZone = firebase.firestore.FieldValue.delete();
      updates.activatedAt = firebase.firestore.FieldValue.delete();
    }

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
    clearElement(listDiv);
    listDiv.appendChild(createElement('div', { class: 'panel text-center pad-xl muted-text' }, 'Please sign in to view your queue.'));
    return;
  }

  try {
    let items = getCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);
    
    if (!items) {
      clearElement(listDiv);
      listDiv.appendChild(createElement('div', { class: 'panel text-center pad-xl muted-text' }, 'Loading queue...'));
      items = await listJulesQueue(user.uid);
      setCache(CACHE_KEYS.QUEUE_ITEMS, items, user.uid);
    }
    
    queueCache = items;
    renderQueueList(items);
    attachQueueModalHandlers();
  } catch (err) {
    clearElement(listDiv);
    listDiv.appendChild(createElement('div', { class: 'panel text-center pad-xl' }, `Failed to load queue: ${err.message}`));
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function getUserTimeZone() {
  const user = window.auth?.currentUser;
  if (!user) return 'America/New_York';
  
  try {
    const profileDoc = await window.db.collection('userProfiles').doc(user.uid).get();
    if (profileDoc.exists && profileDoc.data().preferredTimeZone) {
      return profileDoc.data().preferredTimeZone;
    }
  } catch (err) {
    console.warn('Failed to fetch user timezone preference', err);
  }
  
  const cached = getCache(CACHE_KEYS.USER_PROFILE, user.uid);
  if (cached?.preferredTimeZone) {
    return cached.preferredTimeZone;
  }
  
  return 'America/New_York';
}

async function saveUserTimeZone(timeZone) {
  const user = window.auth?.currentUser;
  if (!user) return;
  
  try {
    await window.db.collection('userProfiles').doc(user.uid).set({
      preferredTimeZone: timeZone,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    const cached = getCache(CACHE_KEYS.USER_PROFILE, user.uid) || {};
    setCache(CACHE_KEYS.USER_PROFILE, { ...cached, preferredTimeZone: timeZone }, user.uid);
  } catch (err) {
    console.warn('Failed to save timezone preference', err);
  }
}

function parseDateInTimeZone(dateTimeStr, timeZone) {
  const parts = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!parts) {
    throw new Error('Invalid date format');
  }
  
  const [, year, month, day, hour, minute, second] = parts;
  const dateInTz = new Date(new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toLocaleString('en-US', { timeZone }));
  const dateInLocal = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  const offset = dateInLocal - dateInTz;
  
  return new Date(dateInLocal.getTime() - offset);
}

function getCommonTimeZones() {
  return [
    { value: 'America/New_York', label: 'New York (ET)' },
    { value: 'America/Chicago', label: 'Chicago (CT)' },
    { value: 'America/Denver', label: 'Denver (MT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
    { value: 'America/Anchorage', label: 'Anchorage (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
    { value: 'UTC', label: 'UTC' }
  ];
}

async function showScheduleModal() {
  const user = window.auth?.currentUser;
  if (!user) {
    showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
    return;
  }
  
  const { queueSelections, subtaskSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0 && Object.keys(subtaskSelections).length > 0) {
    showToast('Individual subtasks cannot be scheduled separately. Please select the parent batch to schedule all subtasks together.', 'warn');
    return;
  }
  
  if (queueSelections.length === 0) {
    showToast('No items selected to schedule', 'warn');
    return;
  }
  
  const userTimeZone = await getUserTimeZone();
  
  let modal = document.getElementById('scheduleQueueModal');
  if (!modal) {
    await loadScheduleModal();
    modal = document.getElementById('scheduleQueueModal');
    if (!modal) {
      console.error('Failed to load schedule modal');
      return;
    }
  }
  
  populateTimeZoneDropdown(userTimeZone);
  initializeScheduleModalInputs();
  attachScheduleModalHandlers();
  
  modal.style.display = 'flex';
}

async function loadScheduleModal() {
  const container = document.getElementById('scheduleQueueModalContainer');
  if (!container) {
    console.error('Schedule modal container not found');
    return;
  }
  
  try {
    const response = await fetch('/partials/schedule-queue-modal.html');
    if (!response.ok) throw new Error('Failed to load modal');
    const html = await response.text();
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading schedule modal:', err);
  }
}

function populateTimeZoneDropdown(selectedTimeZone) {
  const tzSelect = document.getElementById('scheduleTimeZone');
  if (!tzSelect) return;
  
  const timeZones = getCommonTimeZones();
  tzSelect.innerHTML = timeZones.map(tz => 
    `<option value="${tz.value}" ${tz.value === selectedTimeZone ? 'selected' : ''}>${tz.label}</option>`
  ).join('');
}

function initializeScheduleModalInputs() {
  const dateInput = document.getElementById('scheduleDate');
  const timeInput = document.getElementById('scheduleTime');
  const tzSelect = document.getElementById('scheduleTimeZone');
  
  const updateMinDate = () => {
    if (!dateInput || !tzSelect) return;
    
    const selectedTz = tzSelect.value;
    const nowInTz = new Date().toLocaleString('en-US', { timeZone: selectedTz });
    const minDate = new Date(nowInTz).toISOString().split('T')[0];
    dateInput.min = minDate;
    dateInput.value = minDate;
  };
  
  const updateDefaultTime = () => {
    if (!timeInput || !tzSelect) return;
    
    try {
      const selectedTz = tzSelect.value;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: selectedTz
      });
      const parts = formatter.formatToParts(now);
      let hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
      hour = (hour + 1) % 24;
      timeInput.value = `${hour.toString().padStart(2, '0')}:00`;
    } catch (e) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      timeInput.value = now.toTimeString().slice(0, 5);
    }
  };
  
  if (dateInput) {
    updateMinDate();
  }
  
  if (timeInput) {
    updateDefaultTime();
  }
  
  if (tzSelect) {
    const handleTzChange = () => {
      updateMinDate();
      updateDefaultTime();
    };
    tzSelect.removeEventListener('change', handleTzChange);
    tzSelect.addEventListener('change', handleTzChange);
  }
}

function attachScheduleModalHandlers() {
  const modal = document.getElementById('scheduleQueueModal');
  if (!modal) return;
  
  const closeBtn = document.getElementById('closeScheduleModal');
  const cancelBtn = document.getElementById('cancelSchedule');
  const confirmBtn = document.getElementById('confirmSchedule');
  
  if (closeBtn) closeBtn.onclick = hideScheduleModal;
  if (cancelBtn) cancelBtn.onclick = hideScheduleModal;
  if (confirmBtn) confirmBtn.onclick = confirmScheduleItems;
  
  modal.onclick = (e) => {
    if (e.target === modal) hideScheduleModal();
  };
}

function hideScheduleModal() {
  const modal = document.getElementById('scheduleQueueModal');
  if (modal) {
    modal.style.display = 'none';
    const errorDiv = document.getElementById('scheduleError');
    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }
  }
}

async function confirmScheduleItems() {
  const user = window.auth?.currentUser;
  if (!user) return;
  
  const dateInput = document.getElementById('scheduleDate');
  const timeInput = document.getElementById('scheduleTime');
  const timeZoneSelect = document.getElementById('scheduleTimeZone');
  const retryCheckbox = document.getElementById('scheduleRetryOnFailure');
  const errorDiv = document.getElementById('scheduleError');
  
  errorDiv.classList.add('hidden');
  errorDiv.textContent = '';
  
  if (!dateInput.value || !timeInput.value) {
    errorDiv.textContent = 'Date and time are required';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  const selectedDate = dateInput.value;
  const selectedTime = timeInput.value;
  const selectedTimeZone = timeZoneSelect.value;
  
  const dateTimeStr = `${selectedDate}T${selectedTime}:00`;
  const scheduledDate = parseDateInTimeZone(dateTimeStr, selectedTimeZone);
  
  const now = new Date();
  if (scheduledDate < now) {
    errorDiv.textContent = 'Scheduled time must be in the future';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  await saveUserTimeZone(selectedTimeZone);
  
  const { queueSelections } = getSelectedQueueIds();
  
  try {
    const scheduledAt = firebase.firestore.Timestamp.fromDate(scheduledDate);
    const retryOnFailure = retryCheckbox ? retryCheckbox.checked : false;
    
    for (const docId of queueSelections) {
      await updateJulesQueueItem(user.uid, docId, {
        status: 'scheduled',
        scheduledAt: scheduledAt,
        scheduledTimeZone: selectedTimeZone,
        retryOnFailure: retryOnFailure,
        retryCount: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    const totalScheduled = queueSelections.length;
    
    const formattedScheduledAt = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: selectedTimeZone,
      timeZoneName: 'short'
    }).format(scheduledDate);
    
    const itemText = totalScheduled === 1 ? 'item' : 'items';
    showToast(`Scheduled ${totalScheduled} ${itemText} for ${formattedScheduledAt}`, 'success');
    hideScheduleModal();
    await loadQueuePage();
  } catch (err) {
    errorDiv.textContent = `Failed to schedule items: ${err.message}`;
    errorDiv.classList.remove('hidden');
  }
}

function renderQueueList(items) {
  const listDiv = document.getElementById('allQueueList');
  if (!listDiv) return;

  clearElement(listDiv);

  if (!items || items.length === 0) {
    listDiv.appendChild(createElement('div', { class: 'panel text-center pad-xl muted-text' }, 'No queued items.'));
    return;
  }

  items.forEach(item => {
    const created = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString() : 'Unknown';
    const status = item.status || 'pending';
    const remainingCount = Array.isArray(item.remaining) ? item.remaining.length : 0;
    const statusClass = status === 'scheduled' ? 'queue-status-scheduled' : '';
    
    const card = createElement('div', {
      class: `queue-card queue-item ${statusClass}`,
      'data-docid': item.id
    });

    const row = createElement('div', { class: 'queue-row' });

    // Checkbox column
    const checkboxCol = createElement('div', { class: 'queue-checkbox-col' });
    checkboxCol.appendChild(createElement('input', {
      class: 'queue-checkbox',
      type: 'checkbox',
      'data-docid': item.id
    }));
    row.appendChild(checkboxCol);

    // Content
    const content = createElement('div', { class: 'queue-content' });

    // Title
    const titleDiv = createElement('div', { class: 'queue-title' });
    if (item.type === 'subtasks') {
      titleDiv.appendChild(document.createTextNode('Subtasks Batch '));
      titleDiv.appendChild(createElement('span', { class: 'queue-status' }, status));
      titleDiv.appendChild(document.createTextNode(' '));
      titleDiv.appendChild(createElement('span', { class: 'queue-status' }, `(${remainingCount} remaining)`));
    } else {
      titleDiv.appendChild(document.createTextNode('Single Prompt '));
      titleDiv.appendChild(createElement('span', { class: 'queue-status' }, status));
    }

    const editBtn = createElement('button', {
      class: 'btn-icon edit-queue-item',
      'data-docid': item.id,
      title: 'Edit queue item'
    });
    editBtn.appendChild(createIconElement('edit'));
    titleDiv.appendChild(editBtn);
    content.appendChild(titleDiv);

    // Meta
    const metaDiv = createElement('div', { class: 'queue-meta' });
    metaDiv.appendChild(document.createTextNode(`Created: ${created} • ID: `));
    metaDiv.appendChild(createElement('span', { class: 'mono' }, item.id));
    content.appendChild(metaDiv);

    // Repo Info
    if (item.sourceId) {
      const repoDiv = createElement('div', { class: 'queue-repo' });
      repoDiv.appendChild(createIconElement('inventory_2'));
      repoDiv.appendChild(document.createTextNode(` ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})`));
      content.appendChild(repoDiv);
    }

    // Scheduled Info
    if (status === 'scheduled' && item.scheduledAt) {
      const scheduledDate = new Date(item.scheduledAt.seconds * 1000);
      const timeZone = item.scheduledTimeZone || 'America/New_York';
      const dateStr = scheduledDate.toLocaleString('en-US', { 
        timeZone: timeZone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const retryCount = item.retryCount || 0;
      const retryInfo = retryCount > 0 ? ` (Retry ${retryCount}/3)` : '';

      const schedDiv = createElement('div', { class: 'queue-scheduled-info' });
      schedDiv.appendChild(createIconElement('schedule'));
      schedDiv.appendChild(document.createTextNode(` Scheduled: ${dateStr} (${timeZone})${retryInfo}`));
      content.appendChild(schedDiv);
    }
    
    // Error Info
    if (status === 'error' && item.error) {
      const errorDiv = createElement('div', { class: 'queue-error-info' });
      errorDiv.appendChild(createIconElement('error'));
      errorDiv.appendChild(document.createTextNode(` ${item.error}`));
      content.appendChild(errorDiv);
    } else if (status === 'scheduled' && item.lastError && item.retryCount > 0) {
      const errorDiv = createElement('div', { class: 'queue-error-info' });
      errorDiv.appendChild(createIconElement('warning'));
      errorDiv.appendChild(document.createTextNode(` Last attempt failed: ${item.lastError}`));
      content.appendChild(errorDiv);
    }

    // Prompt / Subtasks
    if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
      row.appendChild(content);
      card.appendChild(row);
      
      const subtasksDiv = createElement('div', { class: 'queue-subtasks' });
      item.remaining.forEach((subtask, index) => {
        const preview = (subtask.fullContent || '').substring(0, 150);
        const subtaskDiv = createElement('div', { class: 'queue-subtask' });

        const subtaskIndexDiv = createElement('div', { class: 'queue-subtask-index' });
        subtaskIndexDiv.appendChild(createElement('input', {
          class: 'subtask-checkbox',
          type: 'checkbox',
          'data-docid': item.id,
          'data-index': index
        }));
        subtaskDiv.appendChild(subtaskIndexDiv);

        const subtaskContentDiv = createElement('div', { class: 'queue-subtask-content' });
        subtaskContentDiv.appendChild(createElement('div', { class: 'queue-subtask-meta' }, `Subtask ${index + 1} of ${item.remaining.length}`));
        subtaskContentDiv.appendChild(createElement('div', { class: 'queue-subtask-text' }, `${preview}${preview.length >= 150 ? '...' : ''}`));
        subtaskDiv.appendChild(subtaskContentDiv);

        subtasksDiv.appendChild(subtaskDiv);
      });
      card.appendChild(subtasksDiv);
    } else {
      const promptPreview = (item.prompt || '').substring(0, 200);
      content.appendChild(createElement('div', { class: 'queue-prompt' }, `${promptPreview}${promptPreview.length >= 200 ? '...' : ''}`));
      
      row.appendChild(content);
      card.appendChild(row);
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
        await new Promise(r => setTimeout(r, TIMEOUTS.queueDelay));
        retry = false;
      } catch (err) {
        const result = await showSubtaskErrorModal(i + 1, toRun.length, err, true);
        
        if (result.action === 'retry') {
          if (result.shouldDelay) await new Promise(r => setTimeout(r, TIMEOUTS.longDelay));
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
  const scheduleBtn = document.getElementById('queueScheduleBtn');
  const closeBtn = document.getElementById('closeQueueBtn');

  if (selectAll) {
    selectAll.onclick = () => {
      const checked = selectAll.checked;
      document.querySelectorAll('.queue-checkbox').forEach(cb => cb.checked = checked);
      document.querySelectorAll('.subtask-checkbox').forEach(cb => cb.checked = checked);
      updateScheduleButton();
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
      updateScheduleButton();
    };
  });
  
  document.querySelectorAll('.subtask-checkbox').forEach(subtaskCb => {
    subtaskCb.onclick = () => {
      updateScheduleButton();
    };
  });

  document.querySelectorAll('.edit-queue-item').forEach(editBtn => {
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const docId = editBtn.dataset.docid;
      openEditQueueModal(docId);
    };
  });

  const runHandler = async () => { await runSelectedQueueItems(); };
  const deleteHandler = async () => { await deleteSelectedQueueItems(); };
  const scheduleHandler = async () => {
    if (scheduleBtn.dataset.mode === 'unschedule') {
      await unscheduleSelectedQueueItems();
    } else {
      await showScheduleModal();
    }
  };

  if (runBtn) runBtn.onclick = runHandler;
  if (deleteBtn) deleteBtn.onclick = deleteHandler;
  if (scheduleBtn) scheduleBtn.onclick = scheduleHandler;
  if (closeBtn) closeBtn.onclick = hideJulesQueueModal;
  
  updateScheduleButton();
}

function updateScheduleButton() {
  const scheduleBtn = document.getElementById('queueScheduleBtn');
  if (!scheduleBtn) return;
  
  const { queueSelections } = getSelectedQueueIds();
  const hasSelections = queueSelections.length > 0;
  
  if (!hasSelections) {
    clearElement(scheduleBtn);
    scheduleBtn.appendChild(createIconElement('schedule'));
    scheduleBtn.appendChild(document.createTextNode(' Schedule'));
    scheduleBtn.setAttribute('aria-label', 'Schedule selected items');
    scheduleBtn.dataset.mode = 'schedule';
    return;
  }
  
  const allScheduled = queueSelections.every(docId => {
    const item = queueCache.find(i => i.id === docId);
    return item && item.status === 'scheduled';
  });
  
  if (allScheduled && queueSelections.length > 0) {
    clearElement(scheduleBtn);
    scheduleBtn.appendChild(createIconElement('schedule'));
    scheduleBtn.appendChild(document.createTextNode(' Unschedule'));
    scheduleBtn.setAttribute('aria-label', 'Unschedule selected items');
    scheduleBtn.dataset.mode = 'unschedule';
  } else {
    clearElement(scheduleBtn);
    scheduleBtn.appendChild(createIconElement('schedule'));
    scheduleBtn.appendChild(document.createTextNode(' Schedule'));
    scheduleBtn.setAttribute('aria-label', 'Schedule selected items');
    scheduleBtn.dataset.mode = 'schedule';
  }
}

async function unscheduleSelectedQueueItems() {
  const user = window.auth?.currentUser;
  if (!user) {
    showToast(JULES_MESSAGES.NOT_SIGNED_IN, 'error');
    return;
  }
  
  const { queueSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0) {
    showToast('No items selected', 'warn');
    return;
  }
  
  const itemText = queueSelections.length === 1 ? 'item' : 'items';
  const confirmed = await showConfirm(`Unschedule ${queueSelections.length} selected ${itemText}?`, {
    title: 'Unschedule Items',
    confirmText: 'Unschedule',
    confirmStyle: 'warn'
  });
  
  if (!confirmed) return;
  
  try {
    const batch = firebase.firestore().batch();
    
    for (const docId of queueSelections) {
      const docRef = firebase.firestore().collection('julesQueues').doc(user.uid).collection('items').doc(docId);
      batch.update(docRef, {
        status: 'pending',
        scheduledAt: firebase.firestore.FieldValue.delete(),
        scheduledTimeZone: firebase.firestore.FieldValue.delete(),
        activatedAt: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
    
    const { clearCache, CACHE_KEYS } = await import('../utils/session-cache.js');
    clearCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);
    
    showToast(`${queueSelections.length} ${itemText} unscheduled`, 'success');
    await loadQueuePage();
  } catch (err) {
    showToast(`Failed to unschedule: ${err.message}`, 'error');
  }
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
      statusBar.showMessage('Pausing queue processing after the current subtask', { timeout: TIMEOUTS.longDelay });
    };
  }

  statusBar.showMessage('Processing queue...', { timeout: 0 });
  statusBar.setAction('Pause', () => {
    paused = true;
    statusBar.showMessage('Pausing after current subtask', { timeout: TIMEOUTS.statusBar });
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
    
    const item = queueCache.find(i => i.id === docId);
    
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
              if (result.shouldDelay) await new Promise(r => setTimeout(r, TIMEOUTS.longDelay));
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
            statusBar.showMessage('Paused — progress saved', { timeout: TIMEOUTS.statusBar });
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
              } catch (e) {
                console.error('Failed to update UI progress for queue item', id, e);
              }

              await new Promise(r => setTimeout(r, TIMEOUTS.queueDelay));
              subtaskRetry = false;
            } catch (err) {
              const result = await showSubtaskErrorModal(subtaskNumber, initialCount, err, true);
              
              if (result.action === 'retry') {
                if (result.shouldDelay) await new Promise(r => setTimeout(r, TIMEOUTS.longDelay));
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
                statusBar.showMessage(JULES_MESSAGES.SKIPPED_SUBTASK, { timeout: TIMEOUTS.actionFeedback });
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
                statusBar.showMessage('Remainder queued for later', { timeout: TIMEOUTS.statusBar });
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
