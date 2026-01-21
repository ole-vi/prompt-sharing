// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

import { TIMEOUTS } from '../utils/constants.js';
import { createElement } from '../utils/dom-helpers.js';
import { createModal } from '../utils/modal-manager.js';

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
    const titleText = options.title || 'Confirm Action';
    const confirmText = options.confirmText || 'Confirm';
    const confirmStyle = options.confirmStyle || 'error';
    const cancelText = options.cancelText || 'Cancel';

    // Build Content
    const modalContent = createElement('div', 'modal-content');

    const modalHeader = createElement('div', 'modal-header');
    const title = createElement('h3', '', titleText);
    title.id = 'confirmModalTitle';

    const closeBtn = createElement('button', 'btn-icon close-modal', '✕');
    closeBtn.title = 'Close';

    modalHeader.appendChild(title);
    modalHeader.appendChild(closeBtn);

    const modalBody = createElement('div', 'modal-body');
    const messageEl = createElement('p');
    messageEl.textContent = message;

    modalBody.appendChild(messageEl);

    const modalButtons = createElement('div', 'modal-buttons');
    const cancelBtn = createElement('button', 'btn', cancelText);

    const confirmBtn = createElement('button', 'btn', confirmText);
    if (confirmStyle === 'error' || confirmStyle === 'danger') {
      confirmBtn.classList.add('danger');
    } else if (confirmStyle === 'warn') {
      confirmBtn.classList.add('warn');
    } else if (confirmStyle === 'primary') {
      confirmBtn.classList.add('primary');
    } else if (confirmStyle === 'success') {
      confirmBtn.classList.add('success');
    }

    modalButtons.appendChild(cancelBtn);
    modalButtons.appendChild(confirmBtn);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalButtons);

    // Track state to prevent double resolution
    let resolved = false;
    const previouslyFocusedElement = document.activeElement;

    const safeResolve = (value) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    // Create Modal
    const modal = createModal({
      className: 'modal', // Match existing style
      id: 'confirmModal',
      content: modalContent,
      ariaLabelledBy: 'confirmModalTitle',
      destroyOnHide: true,
      onHide: () => {
        // If hidden externally (e.g. Escape or Background click handled by manager), resolve false
        safeResolve(false);
      },
      onDestroy: () => {
        // Restore focus
        if (previouslyFocusedElement &&
            typeof previouslyFocusedElement.focus === 'function' &&
            document.body.contains(previouslyFocusedElement)) {
          setTimeout(() => {
            try {
              previouslyFocusedElement.focus();
            } catch (err) {
              console.warn('Failed to restore focus:', err);
            }
          }, TIMEOUTS.modalFocus);
        }
      }
    });

    // Handlers
    const handleConfirm = () => {
      safeResolve(true);
      modal.hide();
    };

    const handleCancel = () => {
      safeResolve(false);
      modal.hide();
    };

    modal.addListener(confirmBtn, 'click', handleConfirm);
    modal.addListener(cancelBtn, 'click', handleCancel);
    modal.addListener(closeBtn, 'click', handleCancel);

    // Focus Trap
    modal.addListener(document, 'keydown', (e) => {
      if (!modal.element.classList.contains('show')) return;
      
      if (e.key === 'Tab') {
        const focusableElements = modal.element.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modal.element.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modal.element.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });

    modal.show();

    // Initial Focus
    setTimeout(() => {
      if (confirmBtn && document.body.contains(confirmBtn)) {
        confirmBtn.focus();
      }
    }, TIMEOUTS.modalFocus);
  });
}
