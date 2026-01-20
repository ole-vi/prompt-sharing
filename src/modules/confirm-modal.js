// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

import { TIMEOUTS } from '../utils/constants.js';
import { createElement } from '../utils/dom-helpers.js';

let confirmModal = null;
let confirmResolve = null;
let confirmController = null;

function createConfirmModal() {
  const modal = createElement('div', 'modal');
  modal.id = 'confirmModal';
  modal.style.zIndex = '10000';

  // Accessibility attributes
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'confirmModalTitle');
  modal.setAttribute('aria-describedby', 'confirmModalMessage');

  const modalContent = createElement('div', 'modal-content');
  modalContent.style.maxWidth = '480px';

  const modalHeader = createElement('div', 'modal-header');
  const title = createElement('h3', '', 'Confirm Action');
  title.id = 'confirmModalTitle';

  const closeBtn = createElement('button', 'btn-icon close-modal', '✕');
  closeBtn.id = 'confirmModalClose';
  closeBtn.title = 'Close';

  modalHeader.appendChild(title);
  modalHeader.appendChild(closeBtn);

  const modalBody = createElement('div', 'modal-body');
  const message = createElement('p');
  message.id = 'confirmModalMessage';
  message.style.lineHeight = '1.6';
  message.style.whiteSpace = 'pre-wrap';

  modalBody.appendChild(message);

  const modalButtons = createElement('div', 'modal-buttons');
  const cancelBtn = createElement('button', 'btn', 'Cancel');
  cancelBtn.id = 'confirmModalCancel';

  const confirmBtn = createElement('button', 'btn danger', 'Confirm');
  confirmBtn.id = 'confirmModalConfirm';

  modalButtons.appendChild(cancelBtn);
  modalButtons.appendChild(confirmBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalButtons);

  modal.appendChild(modalContent);
  
  document.body.appendChild(modal);
  return modal;
}

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
