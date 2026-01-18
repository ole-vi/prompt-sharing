// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

let confirmModal = null;
let confirmResolve = null;
let confirmController = null;

function createConfirmModal() {
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'modal';
  modal.style.zIndex = '10000';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 480px;">
      <div class="modal-header">
        <h3 id="confirmModalTitle">Confirm Action</h3>
        <button class="btn-icon close-modal" id="confirmModalClose" title="Close">✕</button>
      </div>
      <div class="modal-body">
        <p id="confirmModalMessage" style="line-height: 1.6; white-space: pre-wrap;"></p>
      </div>
      <div class="modal-buttons">
        <button id="confirmModalCancel" class="btn">Cancel</button>
        <button id="confirmModalConfirm" class="btn danger">Confirm</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

import { TIMEOUTS } from '../utils/constants.js';

function showConfirmModal() {
  if (!confirmModal) {
    confirmModal = createConfirmModal();
  }
  
  confirmModal.classList.add('show');
  
  // Focus the confirm button
  setTimeout(() => {
    const confirmBtn = document.getElementById('confirmModalConfirm');
    if (confirmBtn) confirmBtn.focus();
  }, TIMEOUTS.modalFocus);
}

function hideConfirmModal() {
  if (confirmModal) {
    confirmModal.classList.remove('show');
  }
}

/**
 * Show a styled confirmation dialog
 * @param {string} message - The confirmation message to display
 * @param {Object} options - Optional configuration
 * @param {string} options.title - Modal title (default: "Confirm Action")
 * @param {string} options.confirmText - Confirm button text (default: "Confirm")
 * @param {string} options.confirmStyle - Confirm button style: 'danger', 'warn', 'primary', 'success' (default: 'danger')
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    if (!confirmModal) {
      confirmModal = createConfirmModal();
    }
    
    const title = options.title || 'Confirm Action';
    const confirmText = options.confirmText || 'Confirm';
    const confirmStyle = options.confirmStyle || 'error';
    const cancelText = options.cancelText || 'Cancel';
    
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const closeBtn = document.getElementById('confirmModalClose');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    
    // Set button style
    confirmBtn.className = 'btn';
    if (confirmStyle === 'error' || confirmStyle === 'danger') {
      confirmBtn.classList.add('danger');
    } else if (confirmStyle === 'warn') {
      confirmBtn.classList.add('warn');
    } else if (confirmStyle === 'primary') {
      confirmBtn.classList.add('primary');
    } else if (confirmStyle === 'success') {
      confirmBtn.classList.add('success');
    }
    
    confirmResolve = resolve;

    // Use AbortController for cleanup
    if (confirmController) {
      confirmController.abort();
    }
    confirmController = new AbortController();
    const { signal } = confirmController;

    const cleanup = () => {
      hideConfirmModal();
      if (confirmController) {
        confirmController.abort();
        confirmController = null;
      }
      confirmResolve = null;
    };

    const handleConfirm = () => {
      if (confirmResolve) {
        confirmResolve(true);
      }
      cleanup();
    };

    const handleCancel = () => {
      if (confirmResolve) {
        confirmResolve(false);
      }
      cleanup();
    };
    
    confirmBtn.addEventListener('click', handleConfirm, { signal });
    cancelBtn.addEventListener('click', handleCancel, { signal });
    closeBtn.addEventListener('click', handleCancel, { signal });

    // Close on background click
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        handleCancel();
      }
    }, { signal });
    
    // Handle Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    }, { signal });
    
    showConfirmModal();
  });
}
