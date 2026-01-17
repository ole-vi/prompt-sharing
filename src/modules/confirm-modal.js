// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

import { trapFocus, releaseFocus } from '../utils/focus-trap.js';

let confirmModal = null;
let confirmResolve = null;

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

function showConfirmModal() {
  if (!confirmModal) {
    confirmModal = createConfirmModal();
  }
  
  confirmModal.classList.add('show');
  
  // Trap focus within the modal, prioritizing the confirm button
  setTimeout(() => {
    const confirmBtn = document.getElementById('confirmModalConfirm');
    trapFocus(confirmModal, confirmBtn);
  }, 50);
}

function hideConfirmModal() {
  if (confirmModal) {
    confirmModal.classList.remove('show');
    releaseFocus();
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
    
    // Remove old event listeners by cloning
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newCloseBtn = closeBtn.cloneNode(true);
    
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    newConfirmBtn.onclick = () => {
      hideConfirmModal();
      if (confirmResolve) {
        confirmResolve(true);
        confirmResolve = null;
      }
    };
    
    newCancelBtn.onclick = () => {
      hideConfirmModal();
      if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
      }
    };
    
    newCloseBtn.onclick = () => {
      hideConfirmModal();
      if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
      }
    };
    
    // Close on background click
    confirmModal.onclick = (e) => {
      if (e.target === confirmModal) {
        hideConfirmModal();
        if (confirmResolve) {
          confirmResolve(false);
          confirmResolve = null;
        }
      }
    };
    
    // Handle Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        hideConfirmModal();
        if (confirmResolve) {
          confirmResolve(false);
          confirmResolve = null;
        }
        document.removeEventListener('keydown', handleEscape);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    showConfirmModal();
  });
}
