/**
 * Profile Page Initialization
 * Handles user profile page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { TIMEOUTS } from '../utils/constants.js';
import { getUserCopens, addCustomCopen, updateCustomCopen, deleteCustomCopen, toggleDefaultCopen, getCustomCopenIcon } from '../modules/copen-manager.js';
import { showToast } from '../modules/toast.js';
import { showConfirm } from '../modules/confirm-modal.js';
import { clearCopenCache } from '../modules/copen.js';

let currentUser = null;
let editingCopenId = null;

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadProfile(user) {
  const profileUserName = document.getElementById('profileUserName');
  
  if (!user) {
    if (profileUserName) {
      profileUserName.textContent = 'Not signed in';
    }
    return;
  }

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'User';
  }

  await loadCopens(user);
}

async function loadCopens(user) {
  const copenList = document.getElementById('copenList');
  if (!copenList) return;

  copenList.innerHTML = '<div class="muted-text text-center pad-md">Loading...</div>';

  try {
    const copens = await getUserCopens(user.uid);
    renderCopenList(copens);
  } catch (error) {
    console.error('Error loading copens:', error);
    copenList.innerHTML = '<div class="muted-text text-center pad-md">Error loading copens</div>';
  }
}

function renderCopenList(copens) {
  const copenList = document.getElementById('copenList');
  if (!copenList) return;

  if (copens.length === 0) {
    copenList.innerHTML = '<div class="muted-text text-center pad-md">No copens available</div>';
    return;
  }

  copenList.innerHTML = copens.map(copen => createCopenItem(copen)).join('');

  // Attach event listeners
  copenList.querySelectorAll('[data-action="edit-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditCopen(btn.dataset.copenId));
  });

  copenList.querySelectorAll('[data-action="delete-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteCopen(btn.dataset.copenId));
  });

  copenList.querySelectorAll('[data-action="toggle-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleCopen(btn.dataset.copenId, btn.dataset.enabled === 'true'));
  });
}

function createCopenItem(copen) {
  const isDisabled = copen.disabled || false;
  const defaultBadge = copen.isDefault ? '<span class="copen-item-default-badge">Default</span>' : '';
  
  const actions = copen.isDefault 
    ? `<button class="btn-icon" data-action="toggle-copen" data-copen-id="${copen.id}" data-enabled="${!isDisabled}" title="${isDisabled ? 'Enable' : 'Disable'}">
         <span class="icon" aria-hidden="true">${isDisabled ? 'check_box_outline_blank' : 'check_box'}</span>
       </button>`
    : `<button class="btn-icon" data-action="edit-copen" data-copen-id="${copen.id}" title="Edit">
         <span class="icon" aria-hidden="true">edit</span>
       </button>
       <button class="btn-icon" data-action="delete-copen" data-copen-id="${copen.id}" title="Delete">
         <span class="icon" aria-hidden="true">delete</span>
       </button>`;

  return `
    <div class="copen-item ${isDisabled ? 'disabled' : ''}" data-copen-id="${copen.id}">
      <div class="copen-item-left">
        <div class="copen-item-icon">
          <span class="icon" aria-hidden="true">${copen.icon}</span>
        </div>
        <div class="copen-item-info">
          <div class="copen-item-label">
            ${copen.label}
            ${defaultBadge}
          </div>
          <div class="copen-item-url">${copen.url}</div>
        </div>
      </div>
      <div class="copen-item-actions">
        ${actions}
      </div>
    </div>
  `;
}

function showCopenEditor(copenId = null, existingData = null) {
  const modal = document.getElementById('copenEditorModal');
  const title = document.getElementById('copenEditorTitle');
  const labelInput = document.getElementById('copenLabel');
  const urlInput = document.getElementById('copenUrl');
  const iconInput = document.getElementById('copenIcon');

  if (!modal) return;

  editingCopenId = copenId;

  if (existingData) {
    title.textContent = 'Edit Custom Copen';
    labelInput.value = existingData.label;
    urlInput.value = existingData.url;
    iconInput.value = existingData.icon || getCustomCopenIcon();
  } else {
    title.textContent = 'Add Custom Copen';
    labelInput.value = '';
    urlInput.value = '';
    iconInput.value = getCustomCopenIcon();
  }

  modal.classList.add('show');
  labelInput.focus();
}

function hideCopenEditor() {
  const modal = document.getElementById('copenEditorModal');
  if (modal) {
    modal.classList.remove('show');
  }
  editingCopenId = null;
}

async function handleSaveCopen() {
  const labelInput = document.getElementById('copenLabel');
  const urlInput = document.getElementById('copenUrl');
  const iconInput = document.getElementById('copenIcon');

  const label = labelInput.value.trim();
  const url = urlInput.value.trim();
  const icon = iconInput.value.trim() || getCustomCopenIcon();

  if (!label || !url) {
    showToast('Label and URL are required', 'warn');
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    showToast('Invalid URL format', 'warn');
    return;
  }

  if (!currentUser) {
    showToast('Not signed in', 'warn');
    return;
  }

  try {
    if (editingCopenId) {
      await updateCustomCopen(currentUser.uid, editingCopenId, { label, url, icon });
      showToast('Copen updated', 'success');
    } else {
      await addCustomCopen(currentUser.uid, { label, url, icon });
      showToast('Copen added', 'success');
    }

    clearCopenCache();
    hideCopenEditor();
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error saving copen:', error);
    showToast('Failed to save copen', 'error');
  }
}

async function handleEditCopen(copenId) {
  if (!currentUser) return;

  try {
    const copens = await getUserCopens(currentUser.uid);
    const copen = copens.find(c => c.id === copenId);
    if (copen && !copen.isDefault) {
      showCopenEditor(copenId, copen);
    }
  } catch (error) {
    console.error('Error loading copen for edit:', error);
    showToast('Failed to load copen', 'error');
  }
}

async function handleDeleteCopen(copenId) {
  if (!currentUser) return;

  const confirmed = await showConfirm('Are you sure you want to delete this custom copen?', {
    title: 'Delete Custom Copen',
    confirmText: 'Delete',
    confirmClass: 'danger'
  });

  if (!confirmed) return;

  try {
    clearCopenCache();
    await deleteCustomCopen(currentUser.uid, copenId);
    showToast('Copen deleted', 'success');
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error deleting copen:', error);
    showToast('Failed to delete copen', 'error');
  }
}

async function handleToggleCopen(copenId, currentlyEnabled) {
  if (!currentUser) return;

  try {
    await toggleDefaultCopen(currentUser.uid, copenId, !currentlyEnabled);
    clearCopenCache();
    showToast(currentlyEnabled ? 'Copen disabled' : 'Copen enabled', 'success');
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error toggling copen:', error);
    showToast('Failed to toggle copen', 'error');
  }
}

async function initApp() {
  try {
    await waitForFirebase();
    const auth = getAuth();
    
    // Set up event listeners
    const addCopenBtn = document.getElementById('addCopenBtn');
    const copenEditorSave = document.getElementById('copenEditorSave');
    const copenEditorCancel = document.getElementById('copenEditorCancel');
    const copenEditorClose = document.getElementById('copenEditorClose');

    if (addCopenBtn) {
      addCopenBtn.addEventListener('click', () => showCopenEditor());
    }

    if (copenEditorSave) {
      copenEditorSave.addEventListener('click', handleSaveCopen);
    }

    if (copenEditorCancel) {
      copenEditorCancel.addEventListener('click', hideCopenEditor);
    }

    if (copenEditorClose) {
      copenEditorClose.addEventListener('click', hideCopenEditor);
    }

    // Close modal on outside click
    const modal = document.getElementById('copenEditorModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          hideCopenEditor();
        }
      });
    }

    auth.onAuthStateChanged((user) => {
      currentUser = user;
      if (user) {
        loadProfile(user);
      } else {
        const profileUserName = document.getElementById('profileUserName');
        if (profileUserName) {
          profileUserName.innerHTML = '<div class="muted-text text-center pad-xl">Please sign in to view your profile.</div>';
        }
        const copenManagementSection = document.getElementById('copenManagementSection');
        if (copenManagementSection) {
          copenManagementSection.style.display = 'none';
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
