// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

import { createElement } from '../utils/dom-helpers.js';

let confirmModal = null;
let confirmResolve = null;
let previousActiveElement = null;

function createConfirmModal() {
  const modal = createElement('div', 'modal');
  modal.id = 'confirmModal';

  // ARIA attributes for accessibility
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'confirmModalTitle');
  modal.setAttribute('aria-describedby', 'confirmModalMessage');

  const content = createElement('div', 'modal-content');

  const header = createElement('div', 'modal-header');
  const title = createElement('h3', '', 'Confirm Action');
  title.id = 'confirmModalTitle';

  const closeBtn = createElement('button', 'btn-icon close-modal', '✕');
  closeBtn.id = 'confirmModalClose';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close');

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = createElement('div', 'modal-body');
  const message = createElement('p');
  message.id = 'confirmModalMessage';

  body.appendChild(message);

  const footer = createElement('div', 'modal-buttons');
  const cancelBtn = createElement('button', 'btn', 'Cancel');
  cancelBtn.id = 'confirmModalCancel';

  const confirmBtn = createElement('button', 'btn danger', 'Confirm');
  confirmBtn.id = 'confirmModalConfirm';

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  modal.appendChild(content);
  
  document.body.appendChild(modal);
  return modal;
}

function handleFocusTrap(e) {
  if (e.key !== 'Tab' || !confirmModal) return;

  const focusableElements = confirmModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      lastElement.focus();
      e.preventDefault();
    }
  } else {
    if (document.activeElement === lastElement) {
      firstElement.focus();
      e.preventDefault();
    }
  }
}

function showConfirmModal() {
  if (!confirmModal) {
    confirmModal = createConfirmModal();
  }
  
  previousActiveElement = document.activeElement;
  confirmModal.classList.add('show');
  confirmModal.addEventListener('keydown', handleFocusTrap);
  
  // Focus the confirm button
  setTimeout(() => {
    const confirmBtn = document.getElementById('confirmModalConfirm');
    if (confirmBtn) confirmBtn.focus();
  }, 100);
}

function hideConfirmModal() {
  if (confirmModal) {
    confirmModal.classList.remove('show');
    confirmModal.removeEventListener('keydown', handleFocusTrap);

    // Restore focus to the element that triggered the modal
    if (previousActiveElement && document.body.contains(previousActiveElement)) {
      previousActiveElement.focus();
    }
    previousActiveElement = null;
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
