import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { createModal } from '../utils/modal-manager.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { handleError, ErrorCategory } from '../utils/error-handler.js';
import { showConfirm } from './confirm-modal.js';
import { JULES_MESSAGES, JULES_UI_TEXT, TIMEOUTS } from '../utils/constants.js';
import { callRunJulesFunction } from './jules-api.js';
import { openUrlInBackground, showSubtaskErrorModal } from './jules-modal.js';
import { addDoc, updateDoc, deleteDoc, queryCollection, setDoc, getDoc, getServerTimestamp, getFieldDelete } from '../utils/firestore-helpers.js';
import { getAuth, getDb } from './firebase-service.js';
import { showPromptViewer } from './prompt-viewer.js';

let queueCache = [];
let queuePromptViewerHandlers = new Map();

export async function handleQueueAction(queueItemData) {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) {
    handleError(JULES_MESSAGES.SIGN_IN_REQUIRED, { source: 'handleQueueAction' }, { category: ErrorCategory.AUTH, toastType: 'warn' });
    return false;
  }
  try {
    await addToJulesQueue(user.uid, queueItemData);
    showToast(JULES_MESSAGES.QUEUED, 'success');
    return true;
  } catch (err) {
    handleError(err, { source: 'handleQueueAction' });
    return false;
  }
}

export async function addToJulesQueue(uid, queueItem) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    // Pass object with userId to cacheKey
    const docId = await addDoc(collectionRef, {
      ...queueItem,
      autoOpen: queueItem.autoOpen !== false,
      createdAt: getServerTimestamp(),
      status: 'pending'
    }, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });

    return docId;
  } catch (err) {
    console.error('Failed to add to queue', err);
    throw err;
  }
}

export async function updateJulesQueueItem(uid, docId, updates) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    await updateDoc(collectionRef, docId, updates, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return true;
  } catch (err) {
    console.error('Failed to update queue item', err);
    throw err;
  }
}

export async function deleteFromJulesQueue(uid, docId) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    await deleteDoc(collectionRef, docId, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return true;
  } catch (err) {
    console.error('Failed to delete queue item', err);
    throw err;
  }
}

export async function listJulesQueue(uid) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    const results = await queryCollection(collectionRef, {
      orderBy: { field: 'createdAt', direction: 'desc' }
    }, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return results;
  } catch (err) {
    console.error('Failed to list queue', err);
    throw err;
  }
}

let queueModalEscapeHandler = null;

export function showJulesQueueModal() {
  const modal = document.getElementById('julesQueueModal');
  if (!modal) {
    console.error('julesQueueModal element not found!');
    return;
  }

  modal.classList.add('modal-overlay');
  modal.classList.add('show');
  modal.removeAttribute('style');
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      hideJulesQueueModal();
    }
  };

  if (queueModalEscapeHandler) document.removeEventListener('keydown', queueModalEscapeHandler);
  queueModalEscapeHandler = (e) => {
    if (e.key === 'Escape') {
      hideJulesQueueModal();
    }
  };
  document.addEventListener('keydown', queueModalEscapeHandler);
  
  loadQueuePage();
}

export function hideJulesQueueModal() {
  const modal = document.getElementById('julesQueueModal');
  if (modal) {
    modal.classList.remove('show');
    modal.removeAttribute('style');
  }

  if (queueModalEscapeHandler) {
    document.removeEventListener('keydown', queueModalEscapeHandler);
    queueModalEscapeHandler = null;
  }
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
  isUnscheduled: false,
  isInitializing: false
};

let activeEditModal = null;

async function initializeEditRepoAndBranch(sourceId, branch, repoDropdownBtn, repoDropdownText, repoDropdownMenu, branchDropdownBtn, branchDropdownText, branchDropdownMenu) {
  const branchSelector = new BranchSelector({
    dropdownBtn: branchDropdownBtn,
    dropdownText: branchDropdownText,
    dropdownMenu: branchDropdownMenu,
    onSelect: (selectedBranch) => {
      if (!editModalState.isInitializing) {
        editModalState.hasUnsavedChanges = true;
      }
    }
  });

  const repoSelector = new RepoSelector({
    dropdownBtn: repoDropdownBtn,
    dropdownText: repoDropdownText,
    dropdownMenu: repoDropdownMenu,
    branchSelector: branchSelector,
    onSelect: (selectedSourceId) => {
      if (!editModalState.isInitializing) {
        editModalState.hasUnsavedChanges = true;
      }
    }
  });

  editModalState.repoSelector = repoSelector;
  editModalState.branchSelector = branchSelector;

  await repoSelector.initialize(sourceId, branch);
}

function setupSubtasksEventDelegation() {
  const subtasksList = document.getElementById('editQueueSubtasksList');
  if (!subtasksList || !activeEditModal) return;
  
  if (subtasksList.dataset.listenerAttached) return;
  subtasksList.dataset.listenerAttached = 'true';
  
  activeEditModal.addListener(subtasksList, 'click', (event) => {
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
  
  activeEditModal.addListener(subtasksList, 'input', (event) => {
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
    handleError(JULES_MESSAGES.QUEUE_NOT_FOUND, { source: 'openEditQueueModal' }, { category: ErrorCategory.VALIDATION });
    return;
  }

  // Cleanup existing modal
  if (activeEditModal) {
    activeEditModal.destroy();
    activeEditModal = null;
  }

  editModalState.currentDocId = docId;
  editModalState.hasUnsavedChanges = false;
  editModalState.isInitializing = true;

  const modal = document.createElement('div');
  modal.id = 'editQueueItemModal';
  modal.className = 'modal-overlay';

  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'editQueueModalTitle');

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog modal-dialog-lg';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.id = 'editQueueModalTitle';
  title.textContent = 'Edit Queue Item';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-icon close-modal';
  closeBtn.id = 'closeEditQueueModal';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.title = 'Close';
  const closeIcon = document.createElement('span');
  closeIcon.className = 'icon';
  closeIcon.setAttribute('aria-hidden', 'true');
  closeIcon.textContent = 'close';
  closeBtn.appendChild(closeIcon);
  header.append(title, closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  // Type field
  const typeGroup = document.createElement('div');
  typeGroup.className = 'form-group';
  const typeLabel = document.createElement('label');
  typeLabel.className = 'form-section-label';
  typeLabel.textContent = 'Type:';
  const typeText = document.createElement('div');
  typeText.id = 'editQueueType';
  typeText.className = 'form-text';
  typeGroup.append(typeLabel, typeText);

  // Schedule info
  const scheduleGroup = document.createElement('div');
  scheduleGroup.className = 'form-group hidden';
  scheduleGroup.id = 'editQueueStatusGroup';
  const scheduleLabel = document.createElement('label');
  scheduleLabel.className = 'form-section-label';
  scheduleLabel.textContent = 'Schedule:';
  const scheduleInfo = document.createElement('div');
  scheduleInfo.id = 'editQueueScheduleInfo';
  scheduleInfo.className = 'form-text schedule-info-row';
  const scheduleText = document.createElement('div');
  scheduleText.id = 'editQueueScheduleText';
  const unscheduleBtn = document.createElement('button');
  unscheduleBtn.type = 'button';
  unscheduleBtn.id = 'unscheduleBtn';
  unscheduleBtn.className = 'btn btn-secondary btn-xs';
  unscheduleBtn.textContent = 'Unschedule';
  scheduleInfo.append(scheduleText, unscheduleBtn);
  scheduleGroup.append(scheduleLabel, scheduleInfo);

  // Prompt field
  const promptGroup = document.createElement('div');
  promptGroup.className = 'form-group';
  promptGroup.id = 'editPromptGroup';
  const promptHeader = document.createElement('div');
  promptHeader.className = 'form-group-header';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'form-section-label';
  promptLabel.textContent = 'Prompt:';
  const convertToSubtasksBtn = document.createElement('button');
  convertToSubtasksBtn.type = 'button';
  convertToSubtasksBtn.id = 'convertToSubtasksBtn';
  convertToSubtasksBtn.className = 'btn btn-secondary btn-xs';
  convertToSubtasksBtn.textContent = 'Split into Subtasks';
  promptHeader.append(promptLabel, convertToSubtasksBtn);
  const promptTextarea = document.createElement('textarea');
  promptTextarea.id = 'editQueuePrompt';
  promptTextarea.className = 'form-control form-control-mono';
  promptTextarea.rows = 10;
  promptGroup.append(promptHeader, promptTextarea);

  // Subtasks field
  const subtasksGroup = document.createElement('div');
  subtasksGroup.className = 'form-group hidden';
  subtasksGroup.id = 'editSubtasksGroup';
  const subtasksHeader = document.createElement('div');
  subtasksHeader.className = 'form-group-header';
  const subtasksLabel = document.createElement('label');
  subtasksLabel.className = 'form-section-label';
  subtasksLabel.textContent = 'Subtasks:';
  const convertToSingleBtn = document.createElement('button');
  convertToSingleBtn.type = 'button';
  convertToSingleBtn.id = 'convertToSingleBtn';
  convertToSingleBtn.className = 'btn btn-secondary btn-xs hidden';
  convertToSingleBtn.textContent = 'Convert to Single Prompt';
  subtasksHeader.append(subtasksLabel, convertToSingleBtn);
  const subtasksList = document.createElement('div');
  subtasksList.id = 'editQueueSubtasksList';
  subtasksGroup.append(subtasksHeader, subtasksList);

  // Repository field
  const repoGroup = document.createElement('div');
  repoGroup.className = 'form-group';
  const repoLabel = document.createElement('label');
  repoLabel.className = 'form-section-label';
  repoLabel.textContent = 'Repository:';
  const repoDropdown = document.createElement('div');
  repoDropdown.id = 'editQueueRepoDropdown';
  repoDropdown.className = 'custom-dropdown';
  const repoBtn = document.createElement('button');
  repoBtn.id = 'editQueueRepoDropdownBtn';
  repoBtn.className = 'custom-dropdown-btn w-full';
  repoBtn.type = 'button';
  const repoText = document.createElement('span');
  repoText.id = 'editQueueRepoDropdownText';
  repoText.textContent = 'Loading...';
  const repoCaret = document.createElement('span');
  repoCaret.className = 'custom-dropdown-caret';
  repoCaret.setAttribute('aria-hidden', 'true');
  repoCaret.textContent = '▼';
  repoBtn.append(repoText, repoCaret);
  const repoMenu = document.createElement('div');
  repoMenu.id = 'editQueueRepoDropdownMenu';
  repoMenu.className = 'custom-dropdown-menu';
  repoMenu.setAttribute('role', 'menu');
  repoDropdown.append(repoBtn, repoMenu);
  repoGroup.append(repoLabel, repoDropdown);

  // Branch field
  const branchGroup = document.createElement('div');
  branchGroup.className = 'form-group space-below';
  const branchLabel = document.createElement('label');
  branchLabel.className = 'form-section-label';
  branchLabel.textContent = 'Branch:';
  const branchDropdown = document.createElement('div');
  branchDropdown.id = 'editQueueBranchDropdown';
  branchDropdown.className = 'custom-dropdown';
  const branchBtn = document.createElement('button');
  branchBtn.id = 'editQueueBranchDropdownBtn';
  branchBtn.className = 'custom-dropdown-btn w-full';
  branchBtn.type = 'button';
  const branchText = document.createElement('span');
  branchText.id = 'editQueueBranchDropdownText';
  branchText.textContent = 'Loading branches...';
  const branchCaret = document.createElement('span');
  branchCaret.className = 'custom-dropdown-caret';
  branchCaret.setAttribute('aria-hidden', 'true');
  branchCaret.textContent = '▼';
  branchBtn.append(branchText, branchCaret);
  const branchMenu = document.createElement('div');
  branchMenu.id = 'editQueueBranchDropdownMenu';
  branchMenu.className = 'custom-dropdown-menu';
  branchMenu.setAttribute('role', 'menu');
  branchDropdown.append(branchBtn, branchMenu);
  branchGroup.append(branchLabel, branchDropdown);

  body.append(typeGroup, scheduleGroup, promptGroup, subtasksGroup, repoGroup, branchGroup);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'cancelEditQueue';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  const saveBtn = document.createElement('button');
  saveBtn.id = 'saveEditQueue';
  saveBtn.className = 'btn primary';
  saveBtn.textContent = 'Save';
  footer.append(cancelBtn, saveBtn);

  dialog.append(header, body, footer);
  modal.appendChild(dialog);
  document.body.appendChild(modal);

  activeEditModal = createModal({
    element: modal,
    closeOnBackdropClick: false,
    onDestroy: () => {
      activeEditModal = null;
      editModalState.hasUnsavedChanges = false;
      editModalState.originalData = null;
      editModalState.currentDocId = null;
      editModalState.isInitializing = false;
      editModalState.currentType = null;
      editModalState.repoSelector = null;
      editModalState.branchSelector = null;
      editModalState.isUnscheduled = false;
    }
  });

  // Track listeners
  activeEditModal.addListener(closeBtn, 'click', () => closeEditModal());
  activeEditModal.addListener(cancelBtn, 'click', () => closeEditModal());
  activeEditModal.addListener(modal, 'click', (e) => {
    if (e.target === modal) closeEditModal();
  });
  activeEditModal.addListener(saveBtn, 'click', async () => {
    await saveQueueItemEdit(editModalState.currentDocId, closeEditModal);
  });

  // Add listeners for dynamic toggle buttons
  activeEditModal.addListener(convertToSubtasksBtn, 'click', convertToSubtasks);
  activeEditModal.addListener(convertToSingleBtn, 'click', convertToSingle);

  if (unscheduleBtn) {
    activeEditModal.addListener(unscheduleBtn, 'click', unscheduleQueueItem);
  }

  setupSubtasksEventDelegation();

  const typeDiv = document.getElementById('editQueueType');
  const promptGroup2 = document.getElementById('editPromptGroup');
  const subtasksGroup2 = document.getElementById('editSubtasksGroup');
  const promptTextarea2 = document.getElementById('editQueuePrompt');
  const repoDropdownBtn = document.getElementById('editQueueRepoDropdownBtn');
  const repoDropdownText = document.getElementById('editQueueRepoDropdownText');
  const repoDropdownMenu = document.getElementById('editQueueRepoDropdownMenu');
  const branchDropdownBtn = document.getElementById('editQueueBranchDropdownBtn');
  const branchDropdownText = document.getElementById('editQueueBranchDropdownText');
  const branchDropdownMenu = document.getElementById('editQueueBranchDropdownMenu');

  if (item.type === 'single') {
    typeDiv.textContent = 'Single Prompt';
    promptGroup2.classList.remove('hidden');
    subtasksGroup2.classList.add('hidden');
    promptTextarea2.value = item.prompt || '';
    editModalState.originalData = { prompt: item.prompt || '' };
    editModalState.currentType = 'single';
  } else if (item.type === 'subtasks') {
    typeDiv.textContent = 'Subtasks Batch';
    promptGroup2.classList.add('hidden');
    subtasksGroup2.classList.remove('hidden');
    
    const subtasks = item.remaining || [];
    renderSubtasksList(subtasks);
    
    editModalState.originalData = { 
      subtasks: subtasks.map(s => s.fullContent || '') 
    };
    editModalState.currentType = 'subtasks';
    updateConvertToSingleButtonVisibility();
  }

  editModalState.originalData.sourceId = item.sourceId || '';
  editModalState.originalData.branch = item.branch || 'master';

  displayScheduleStatus(item);

  await initializeEditRepoAndBranch(item.sourceId, item.branch || 'master', repoDropdownBtn, repoDropdownText, repoDropdownMenu, branchDropdownBtn, branchDropdownText, branchDropdownMenu);

  editModalState.isInitializing = false;

  activeEditModal.show();

  const trackChanges = () => {
    editModalState.hasUnsavedChanges = true;
  };

  if (promptTextarea2) {
    activeEditModal.addListener(promptTextarea2, 'input', trackChanges);
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
  
  subtasksList.replaceChildren();
  
  subtasks.forEach((subtask, index) => {
    const container = document.createElement('div');
    container.className = 'form-group subtask-item';
    container.dataset.index = index;
    
    const header = document.createElement('div');
    header.className = 'subtask-item-header';
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = `Subtask ${index + 1}:`;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-subtask-btn';
    removeBtn.dataset.index = index;
    removeBtn.title = 'Remove this subtask';
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'close';
    removeBtn.appendChild(icon);
    
    header.append(label, removeBtn);
    
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control edit-subtask-content';
    textarea.rows = 5;
    textarea.value = subtask.fullContent || '';
    
    container.append(header, textarea);
    subtasksList.appendChild(container);
  });
  
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'btn btn-secondary add-subtask-btn';
  addButton.textContent = '+ Add Subtask';
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
  if (!activeEditModal) return;
  
  if (!force && editModalState.hasUnsavedChanges) {
    const confirmed = await showConfirm('You have unsaved changes. Are you sure you want to close?', {
      title: 'Unsaved Changes',
      confirmText: 'Close Anyway',
      confirmStyle: 'warn'
    });
    if (!confirmed) return;
  }

  activeEditModal.destroy();
}

async function saveQueueItemEdit(docId, closeModalCallback) {
  const item = queueCache.find(i => i.id === docId);
  if (!item) {
    showToast(JULES_MESSAGES.QUEUE_NOT_FOUND, 'error');
    return;
  }
  
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) {
    handleError(JULES_MESSAGES.NOT_SIGNED_IN, { source: 'saveQueueItemEdit' }, { category: ErrorCategory.AUTH });
    return;
  }

  try {
    const sourceId = editModalState.repoSelector?.getSelectedSourceId();
    const branch = editModalState.branchSelector?.getSelectedBranch();
    
    const updates = {
      sourceId: sourceId || item.sourceId,
      branch: branch || item.branch || 'master',
      updatedAt: getServerTimestamp()
    };
    
    if (editModalState.isUnscheduled) {
      updates.status = 'pending';
      updates.scheduledAt = getFieldDelete();
      updates.scheduledTimeZone = getFieldDelete();
      updates.activatedAt = getFieldDelete();
    }

    const currentType = editModalState.currentType || item.type;
    
    if (currentType === 'single') {
      const promptTextarea = document.getElementById('editQueuePrompt');
      updates.type = 'single';
      updates.prompt = promptTextarea.value;
      if (item.type === 'subtasks') {
        updates.remaining = getFieldDelete();
        updates.totalCount = getFieldDelete();
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
        updates.prompt = getFieldDelete();
      }
    }

    await updateJulesQueueItem(user.uid, item.id, updates);
    
    showToast(JULES_MESSAGES.QUEUE_UPDATED, 'success');
    editModalState.hasUnsavedChanges = false;
    closeModalCallback(true);
    
    await loadQueuePage();
  } catch (err) {
    handleError(err, { source: 'saveQueueItemEdit' });
  }
}

async function loadQueuePage() {
  const auth = getAuth();
  const user = auth?.currentUser;
  const listDiv = document.getElementById('allQueueList');
  if (!user) {
    const msg = document.createElement('div');
    msg.className = 'panel text-center pad-xl muted-text';
    msg.textContent = 'Please sign in to view your queue.';
    listDiv.replaceChildren();
    listDiv.appendChild(msg);
    return;
  }

  try {
    let items = getCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);
    
    if (!items) {
      const loading = document.createElement('div');
      loading.className = 'panel text-center pad-xl muted-text';
      loading.textContent = 'Loading queue...';
      listDiv.replaceChildren();
      listDiv.appendChild(loading);
      items = await listJulesQueue(user.uid);
      setCache(CACHE_KEYS.QUEUE_ITEMS, items, user.uid);
    }
    
    queueCache = items;
    renderQueueList(items);
    attachQueueModalHandlers();
  } catch (err) {
    const errorInfo = handleError(err, { source: 'loadQueuePage' }, { showDisplay: false });
    const msg = errorInfo.suggestion ? `${errorInfo.message} ${errorInfo.suggestion}` : errorInfo.message;

    const error = document.createElement('div');
    error.className = 'panel text-center pad-xl';
    error.textContent = `Failed to load queue: ${msg}`;
    listDiv.replaceChildren();
    listDiv.appendChild(error);
  }
}

async function getUserTimeZone() {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) return 'America/New_York';
  
  try {
    // Pass object with userId to cacheKey
    const profileData = await getDoc('userProfiles', user.uid, { key: CACHE_KEYS.USER_PROFILE, userId: user.uid });
    if (profileData && profileData.preferredTimeZone) {
      return profileData.preferredTimeZone;
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

function attachQueuePromptViewerHandlers(queueItems) {
  queuePromptViewerHandlers.forEach((handler, key) => {
    delete window[key];
  });
  queuePromptViewerHandlers.clear();
  
  queueItems.forEach(item => {
    if (item.prompt || (item.type === 'subtasks' && item.remaining && item.remaining.length > 0)) {
      const cleanId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
      const handlerKey = `viewQueuePrompt_${cleanId}`;
      
      let promptContent = '';
      
      if (item.type === 'subtasks' && item.remaining && item.remaining.length > 0) {
        promptContent = item.remaining.map((subtask, index) => {
          return `=== Subtask ${index + 1} of ${item.remaining.length} ===\n${subtask.fullContent || subtask.prompt || 'No prompt text'}`;
        }).join('\n\n');
      } else {
        promptContent = item.prompt || 'No prompt text available';
      }
      
      const handler = () => showPromptViewer(promptContent, item.id);
      window[handlerKey] = handler;
      queuePromptViewerHandlers.set(handlerKey, handler);
    }
  });
}

async function saveUserTimeZone(timeZone) {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) return;
  
  try {
    // Pass object with userId to cacheKey
    await setDoc('userProfiles', user.uid, {
      preferredTimeZone: timeZone,
      updatedAt: getServerTimestamp()
    }, { merge: true }, { key: CACHE_KEYS.USER_PROFILE, userId: user.uid });
    
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

let activeScheduleModal = null;

async function showScheduleModal() {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) {
    handleError(JULES_MESSAGES.SIGN_IN_REQUIRED, { source: 'showScheduleModal' }, { category: ErrorCategory.AUTH, toastType: 'warn' });
    return;
  }
  
  const { queueSelections, subtaskSelections } = getSelectedQueueIds();
  
  if (queueSelections.length === 0 && Object.keys(subtaskSelections).length > 0) {
    handleError('Individual subtasks cannot be scheduled separately. Please select the parent batch to schedule all subtasks together.', { source: 'showScheduleModal' }, { category: ErrorCategory.VALIDATION, toastType: 'warn' });
    return;
  }
  
  if (queueSelections.length === 0) {
    handleError('No items selected to schedule', { source: 'showScheduleModal' }, { category: ErrorCategory.VALIDATION, toastType: 'warn' });
    return;
  }
  
  const userTimeZone = await getUserTimeZone();
  
  if (activeScheduleModal) {
    activeScheduleModal.destroy();
    activeScheduleModal = null;
  }

  // Reload content (container is cleared by destroy if we had parent issues, but here parent persists)
  // Actually, loadScheduleModal sets innerHTML of container.
  await loadScheduleModal();

  const modalElement = document.getElementById('scheduleQueueModal');
  if (!modalElement) {
    console.error('Failed to load schedule modal');
    return;
  }
  
  activeScheduleModal = createModal({
    element: modalElement,
    closeOnBackdropClick: false,
    onDestroy: () => { activeScheduleModal = null; }
  });

  populateTimeZoneDropdown(userTimeZone);
  initializeScheduleModalInputs();
  attachScheduleModalHandlers();
  
  activeScheduleModal.show();
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
  tzSelect.replaceChildren();
  
  timeZones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz.value;
    option.textContent = tz.label;
    if (tz.value === selectedTimeZone) {
      option.selected = true;
    }
    tzSelect.appendChild(option);
  });
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
  
  if (tzSelect && activeScheduleModal) {
    const handleTzChange = () => {
      updateMinDate();
      updateDefaultTime();
    };
    activeScheduleModal.addListener(tzSelect, 'change', handleTzChange);
  }
}

function attachScheduleModalHandlers() {
  if (!activeScheduleModal) return;
  
  const modal = activeScheduleModal.element;
  const closeBtn = document.getElementById('closeScheduleModal');
  const cancelBtn = document.getElementById('cancelSchedule');
  const confirmBtn = document.getElementById('confirmSchedule');
  
  if (closeBtn) activeScheduleModal.addListener(closeBtn, 'click', hideScheduleModal);
  if (cancelBtn) activeScheduleModal.addListener(cancelBtn, 'click', hideScheduleModal);
  if (confirmBtn) activeScheduleModal.addListener(confirmBtn, 'click', confirmScheduleItems);
  
  activeScheduleModal.addListener(modal, 'click', (e) => {
    if (e.target === modal) hideScheduleModal();
  });
}

function hideScheduleModal() {
  if (activeScheduleModal) {
    activeScheduleModal.destroy();
  }
}

async function confirmScheduleItems() {
  const auth = getAuth();
  const user = auth?.currentUser;
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
        updatedAt: getServerTimestamp()
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
    const errorInfo = handleError(err, { source: 'confirmScheduleItems' }, { showDisplay: false });
    errorDiv.textContent = `Failed to schedule items: ${errorInfo.message}`;
    errorDiv.classList.remove('hidden');
  }
}

function renderQueueList(items) {
  const listDiv = document.getElementById('allQueueList');
  if (!listDiv) return;
  if (!items || items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'panel text-center pad-xl muted-text';
    empty.textContent = 'No queued items.';
    listDiv.replaceChildren();
    listDiv.appendChild(empty);
    return;
  }

  listDiv.replaceChildren();
  
  items.forEach(item => {
    const card = createQueueCard(item);
    listDiv.appendChild(card);
  });
  
  attachQueuePromptViewerHandlers(items);
}

function createCardHeader(item, status) {
  const remainingCount = Array.isArray(item.remaining) ? item.remaining.length : 0;
  
  const titleDiv = document.createElement('div');
  titleDiv.className = 'queue-title';
  const titleText = document.createTextNode(item.type === 'subtasks' ? JULES_UI_TEXT.SUBTASKS_BATCH : JULES_UI_TEXT.SINGLE_PROMPT);
  titleDiv.appendChild(titleText);
  
  const statusSpan = document.createElement('span');
  statusSpan.className = 'queue-status';
  statusSpan.textContent = status;
  titleDiv.appendChild(statusSpan);
  
  if (item.type === 'subtasks') {
    const remainingSpan = document.createElement('span');
    remainingSpan.className = 'queue-status';
    remainingSpan.textContent = JULES_UI_TEXT.REMAINING_COUNT(remainingCount);
    titleDiv.appendChild(document.createTextNode(' '));
    titleDiv.appendChild(remainingSpan);
  }
  
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon edit-queue-item';
  editBtn.dataset.docid = item.id;
  editBtn.setAttribute('aria-label', 'Edit queue item');
  editBtn.title = 'Edit queue item';
  const editIcon = document.createElement('span');
  editIcon.className = 'icon icon-inline';
  editIcon.setAttribute('aria-hidden', 'true');
  editIcon.textContent = 'edit';
  editBtn.appendChild(editIcon);
  titleDiv.appendChild(document.createTextNode(' '));
  titleDiv.appendChild(editBtn);

  return titleDiv;
}

function createCardMeta(item, created) {
  const metaDiv = document.createElement('div');
  metaDiv.className = 'queue-meta';
  metaDiv.textContent = `Created: ${created} • ID: `;
  const idSpan = document.createElement('span');
  idSpan.className = 'mono';
  idSpan.textContent = item.id;
  metaDiv.appendChild(idSpan);
  return metaDiv;
}

function createSubtasksList(item) {
  if (item.type !== 'subtasks' || !Array.isArray(item.remaining) || item.remaining.length === 0) {
    return null;
  }

  const subtasksContainer = document.createElement('div');
  subtasksContainer.className = 'queue-subtasks';

  item.remaining.forEach((subtask, index) => {
    const preview = (subtask.fullContent || '').substring(0, 150);

    const subtaskDiv = document.createElement('div');
    subtaskDiv.className = 'queue-subtask';

    const indexDiv = document.createElement('div');
    indexDiv.className = 'queue-subtask-index';
    const checkbox = document.createElement('input');
    checkbox.className = 'subtask-checkbox';
    checkbox.type = 'checkbox';
    checkbox.dataset.docid = item.id;
    checkbox.dataset.index = index;
    indexDiv.appendChild(checkbox);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'queue-subtask-content';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'queue-subtask-meta';
    metaDiv.textContent = `Subtask ${index + 1} of ${item.remaining.length}`;

    const textDiv = document.createElement('div');
    textDiv.className = 'queue-subtask-text';
    textDiv.textContent = preview + (preview.length >= 150 ? '...' : '');

    contentDiv.append(metaDiv, textDiv);
    subtaskDiv.append(indexDiv, contentDiv);
    subtasksContainer.appendChild(subtaskDiv);
  });

  return subtasksContainer;
}

function createQueueCard(item) {
  const created = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString() : 'Unknown';
  const status = item.status || 'pending';

  const card = document.createElement('div');
  card.className = `queue-card queue-item${status === 'scheduled' ? ' queue-status-scheduled' : ''}`;
  card.dataset.docid = item.id;

  const row = document.createElement('div');
  row.className = 'queue-row';

  const checkboxCol = document.createElement('div');
  checkboxCol.className = 'queue-checkbox-col';
  const queueCheckbox = document.createElement('input');
  queueCheckbox.className = 'queue-checkbox';
  queueCheckbox.type = 'checkbox';
  queueCheckbox.dataset.docid = item.id;
  checkboxCol.appendChild(queueCheckbox);

  const content = document.createElement('div');
  content.className = 'queue-content';

  content.appendChild(createCardHeader(item, status));
  content.appendChild(createCardMeta(item, created));
  
  // Repo info
  if (item.sourceId) {
    const repoDiv = document.createElement('div');
    repoDiv.className = 'queue-repo';
    const repoIcon = document.createElement('span');
    repoIcon.className = 'icon icon-inline';
    repoIcon.setAttribute('aria-hidden', 'true');
    repoIcon.textContent = 'inventory_2';
    repoDiv.appendChild(repoIcon);
    repoDiv.appendChild(document.createTextNode(` ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})`));
    content.appendChild(repoDiv);
  }
  
  // Scheduled info
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
    
    const scheduledDiv = document.createElement('div');
    scheduledDiv.className = 'queue-scheduled-info';
    const schedIcon = document.createElement('span');
    schedIcon.className = 'icon icon-inline';
    schedIcon.setAttribute('aria-hidden', 'true');
    schedIcon.textContent = 'schedule';
    scheduledDiv.appendChild(schedIcon);
    scheduledDiv.appendChild(document.createTextNode(` Scheduled: ${dateStr} (${timeZone})${retryInfo}`));
    content.appendChild(scheduledDiv);
  }
  
  // Error info
  if (status === 'error' && item.error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'queue-error-info';
    const errorIcon = document.createElement('span');
    errorIcon.className = 'icon icon-inline';
    errorIcon.setAttribute('aria-hidden', 'true');
    errorIcon.textContent = 'error';
    errorDiv.appendChild(errorIcon);
    errorDiv.appendChild(document.createTextNode(` ${item.error}`));
    content.appendChild(errorDiv);
  } else if (status === 'scheduled' && item.lastError && item.retryCount > 0) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'queue-error-info';
    const warnIcon = document.createElement('span');
    warnIcon.className = 'icon icon-inline';
    warnIcon.setAttribute('aria-hidden', 'true');
    warnIcon.textContent = 'warning';
    errorDiv.appendChild(warnIcon);
    errorDiv.appendChild(document.createTextNode(` Last attempt failed: ${item.lastError}`));
    content.appendChild(errorDiv);
  }
  
  row.append(checkboxCol, content);
  card.appendChild(row);
  
  const subtasksList = createSubtasksList(item);
  if (subtasksList) {
    card.appendChild(subtasksList);
  } else if (item.type !== 'subtasks') {
    const promptPreview = (item.prompt || '').substring(0, 200);
    const promptDiv = document.createElement('div');
    promptDiv.className = 'queue-prompt';
    
    const textNode = document.createTextNode(promptPreview + (promptPreview.length >= 200 ? '...' : ''));
    promptDiv.appendChild(textNode);
    
    if (item.prompt) {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-icon queue-view-btn';
      viewBtn.dataset.docid = item.id;
      viewBtn.setAttribute('aria-label', 'View full prompt');
      viewBtn.title = 'View full prompt';
      const viewIcon = document.createElement('span');
      viewIcon.className = 'icon';
      viewIcon.setAttribute('aria-hidden', 'true');
      viewIcon.textContent = 'visibility';
      viewBtn.appendChild(viewIcon);
      promptDiv.appendChild(viewBtn);
    }
    
    content.appendChild(promptDiv);
  }
  
  return card;
}

async function deleteSelectedSubtasks(docId, indices) {
  const auth = getAuth();
  const user = auth?.currentUser;
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
      updatedAt: getServerTimestamp()
    });
  }
}

async function runSelectedSubtasks(docId, indices, suppressPopups = false, openInBackground = false) {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) return;

  const item = queueCache.find(i => i.id === docId);
  if (!item || !Array.isArray(item.remaining)) return;

  const sortedIndices = indices.sort((a, b) => a - b);
  const toRun = sortedIndices.map(i => item.remaining[i]).filter(Boolean);

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

  document.querySelectorAll('.queue-view-btn').forEach(viewBtn => {
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      const docId = viewBtn.dataset.docid;
      const cleanId = docId.replace(/[^a-zA-Z0-9]/g, '_');
      const handlerKey = `viewQueuePrompt_${cleanId}`;
      if (window[handlerKey]) {
        window[handlerKey]();
      }
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
    scheduleBtn.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'icon icon-inline';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'schedule';
    scheduleBtn.appendChild(icon);
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
    scheduleBtn.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'icon icon-inline';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'schedule';
    scheduleBtn.appendChild(icon);
    scheduleBtn.appendChild(document.createTextNode(' Unschedule'));
    scheduleBtn.setAttribute('aria-label', 'Unschedule selected items');
    scheduleBtn.dataset.mode = 'unschedule';
  } else {
    scheduleBtn.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'icon icon-inline';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'schedule';
    scheduleBtn.appendChild(icon);
    scheduleBtn.appendChild(document.createTextNode(' Schedule'));
    scheduleBtn.setAttribute('aria-label', 'Schedule selected items');
    scheduleBtn.dataset.mode = 'schedule';
  }
}

async function unscheduleSelectedQueueItems() {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) {
    handleError(JULES_MESSAGES.NOT_SIGNED_IN, { source: 'unscheduleSelectedQueueItems' }, { category: ErrorCategory.AUTH });
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
    const db = getDb();
    const batch = db.batch();
    
    for (const docId of queueSelections) {
      const docRef = db.collection('julesQueues').doc(user.uid).collection('items').doc(docId);
      batch.update(docRef, {
        status: 'pending',
        scheduledAt: getFieldDelete(),
        scheduledTimeZone: getFieldDelete(),
        activatedAt: getFieldDelete(),
        updatedAt: getServerTimestamp()
      });
    }
    
    await batch.commit();
    
    const { clearCache, CACHE_KEYS } = await import('../utils/session-cache.js');
    clearCache(CACHE_KEYS.QUEUE_ITEMS, user.uid);
    
    showToast(`${queueSelections.length} ${itemText} unscheduled`, 'success');
    await loadQueuePage();
  } catch (err) {
    handleError(err, { source: 'unscheduleSelectedQueueItems' });
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
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) { handleError(JULES_MESSAGES.NOT_SIGNED_IN, { source: 'deleteSelectedQueueItems' }, { category: ErrorCategory.AUTH }); return; }
  
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
    handleError(err, { source: 'deleteSelectedQueueItems' });
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
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) { handleError(JULES_MESSAGES.NOT_SIGNED_IN, { source: 'runSelectedQueueItems' }, { category: ErrorCategory.AUTH }); return; }
  
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
                updatedAt: getServerTimestamp()
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
                  updatedAt: getServerTimestamp()
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
                    updatedAt: getServerTimestamp()
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
                    updatedAt: getServerTimestamp()
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
                    updatedAt: getServerTimestamp()
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
              updatedAt: getServerTimestamp()
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
      handleError(err, { source: 'runSelectedQueueItems' }, { category: ErrorCategory.UNEXPECTED });
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
