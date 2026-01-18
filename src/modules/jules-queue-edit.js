import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { JULES_MESSAGES } from '../utils/constants.js';
import { updateJulesQueueItem } from './jules-queue-api.js';
import { escapeHtml } from './jules-queue-render.js';

let editModalState = {
  originalData: null,
  hasUnsavedChanges: false,
  currentDocId: null,
  currentType: null,
  repoSelector: null,
  branchSelector: null,
  isUnscheduled: false,
  onSave: null
};

export async function openEditQueueModal(item, onSaveCallback) {
  if (!item) {
    showToast(JULES_MESSAGES.QUEUE_NOT_FOUND, 'error');
    return;
  }

  editModalState.currentDocId = item.id;
  editModalState.hasUnsavedChanges = false;
  editModalState.onSave = onSaveCallback;

  let modal = document.getElementById('editQueueItemModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editQueueItemModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-lg">
        <div class="modal-header">
          <h2 class="modal-title">Edit Queue Item</h2>
          <button class="btn-icon close-modal" id="closeEditQueueModal" title="Close"><span class="icon" aria-hidden="true">close</span></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-section-label">Type:</label>
            <div id="editQueueType" class="form-text"></div>
          </div>
          <div class="form-group" id="editQueueStatusGroup" class="hidden">
            <label class="form-section-label">Schedule:</label>
            <div id="editQueueScheduleInfo" class="form-text schedule-info-row">
              <div id="editQueueScheduleText"></div>
              <button type="button" id="unscheduleBtn" class="btn btn-secondary btn-xs">Unschedule</button>
            </div>
          </div>
          <div class="form-group" id="editPromptGroup">
            <div class="form-group-header">
              <label class="form-section-label">Prompt:</label>
              <button type="button" id="convertToSubtasksBtn" class="btn btn-secondary btn-xs">Split into Subtasks</button>
            </div>
            <textarea id="editQueuePrompt" class="form-control form-control-mono" rows="10"></textarea>
          </div>
          <div class="form-group" id="editSubtasksGroup" class="hidden">
            <div class="form-group-header">
              <label class="form-section-label">Subtasks:</label>
              <button type="button" id="convertToSingleBtn" class="btn btn-secondary btn-xs hidden">Convert to Single Prompt</button>
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
      await saveQueueItemEdit();
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

export async function closeEditModal(force = false) {
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
  editModalState.onSave = null;
}

async function saveQueueItemEdit() {
  const docId = editModalState.currentDocId;
  const user = window.auth?.currentUser;

  if (!docId || !user) {
    showToast(JULES_MESSAGES.NOT_SIGNED_IN, 'error');
    return;
  }

  try {
    const sourceId = editModalState.repoSelector?.getSelectedSourceId();
    const branch = editModalState.branchSelector?.getSelectedBranch();

    const updates = {
      sourceId: sourceId || editModalState.originalData.sourceId,
      branch: branch || editModalState.originalData.branch || 'master',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editModalState.isUnscheduled) {
      updates.status = 'pending';
      updates.scheduledAt = firebase.firestore.FieldValue.delete();
      updates.scheduledTimeZone = firebase.firestore.FieldValue.delete();
      updates.activatedAt = firebase.firestore.FieldValue.delete();
    }

    const currentType = editModalState.currentType;

    if (currentType === 'single') {
      const promptTextarea = document.getElementById('editQueuePrompt');
      updates.type = 'single';
      updates.prompt = promptTextarea.value;
      // We don't have access to original item here to check if it was 'subtasks' before.
      // But we can delete the subtasks fields anyway if we are switching to single.
      // Firestore merge will handle it, but field deletion needs explicit instruction.
      // We'll just set them to delete if we switched types or just always cleanup.
      // The original code checked 'if (item.type === subtasks)'.
      // We can rely on editModalState.originalData logic or just always clean up opposite fields?
      // Or we can fetch the item again? No.
      // Let's assume we want to clean up.
      updates.remaining = firebase.firestore.FieldValue.delete();
      updates.totalCount = firebase.firestore.FieldValue.delete();
    } else if (currentType === 'subtasks') {
      const subtaskTextareas = document.querySelectorAll('.edit-subtask-content');
      const updatedSubtasks = Array.from(subtaskTextareas).map(textarea => ({
        fullContent: textarea.value
      }));
      updates.type = 'subtasks';
      updates.remaining = updatedSubtasks;
      updates.totalCount = updatedSubtasks.length;
      updates.prompt = firebase.firestore.FieldValue.delete();
    }

    await updateJulesQueueItem(user.uid, docId, updates);

    showToast(JULES_MESSAGES.QUEUE_UPDATED, 'success');
    editModalState.hasUnsavedChanges = false;

    if (editModalState.onSave) {
      editModalState.onSave(true);
    }

    closeEditModal(true); // force close
  } catch (err) {
    showToast(JULES_MESSAGES.QUEUE_UPDATE_FAILED(err.message), 'error');
  }
}

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

  subtasksList.innerHTML = subtasks.map((subtask, index) => `
    <div class="form-group subtask-item" data-index="${index}">
      <div class="subtask-item-header">
        <label class="form-label">Subtask ${index + 1}:</label>
        <button type="button" class="remove-subtask-btn" data-index="${index}" title="Remove this subtask"><span class="icon" aria-hidden="true">close</span></button>
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
