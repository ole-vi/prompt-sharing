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
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'confirmModalTitle');

  const modalContent = createElement('div', 'modal-content');

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
 * @param {string} options.confirmStyle - Confirm button style: 'danger', 'warn', 'primary', 'success' (default: 'error')
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    if (!confirmModal) {
      confirmModal = createConfirmModal();
    }
    
    // Store active element for focus restoration
    const previouslyFocusedElement = document.activeElement;
    
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
      
      // Restore focus to previously focused element
      if (previouslyFocusedElement && 
          typeof previouslyFocusedElement.focus === 'function' &&
          document.body.contains(previouslyFocusedElement)) {
        setTimeout(() => {
          try {
            previouslyFocusedElement.focus();
          } catch (err) {
            // Fallback if focus fails (element might be removed from DOM)
            console.warn('Failed to restore focus:', err);
          }
        }, TIMEOUTS.modalFocus);
      }
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
    
    // Handle keyboard events (Escape and focus trap)
    document.addEventListener('keydown', (e) => {
      // Safety check - only handle events if modal is visible
      if (!confirmModal || !confirmModal.classList.contains('show')) {
        return;
      }
      
      if (e.key === 'Escape') {
        handleCancel();
        return;
      }
      
      // Focus trap implementation
      if (e.key === 'Tab') {
        const focusableElements = confirmModal.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        
        if (focusableElements.length === 0) return; // Safety check
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
          // Shift + Tab - move backward
          if (document.activeElement === firstElement || !confirmModal.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab - move forward
          if (document.activeElement === lastElement || !confirmModal.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }, { signal });
    
    showConfirmModal();
  });
}
