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
 * @param {string} options.confirmStyle - Confirm button style: 'danger', 'warn', 'primary', 'success' (default: 'danger')
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    };

    const title = options.title || 'Confirm Action';
    const confirmText = options.confirmText || 'Confirm';
    const confirmStyle = options.confirmStyle || 'error';
    const cancelText = options.cancelText || 'Cancel';

    const modal = createModal({
      title: title,
      className: 'modal', // Use legacy class to maintain high z-index and flex behavior if css matches
      dialogClass: 'modal-content',
      closeable: true,
      hasFooter: true,
      onClose: cleanup
    });
    
    // Ensure high z-index as per original implementation
    modal.element.style.zIndex = '10000';

    // Body Message
    const msgP = createElement('p');
    msgP.style.lineHeight = '1.6';
    msgP.style.whiteSpace = 'pre-wrap';
    msgP.textContent = message;
    modal.body.appendChild(msgP);

    // Buttons (appended to footer)
    // We use a container to match 'modal-buttons' spacing if needed,
    // but modal-footer has its own spacing.
    // Original used 'modal-buttons' div.
    // Let's try appending directly to footer first.
    // If styling is off, we can adjust.
    // modal-footer: justify-content: flex-end; gap: 8px;
    
    const cancelBtn = createElement('button', 'btn', cancelText);
    modal.addListener(cancelBtn, 'click', () => {
      resolved = true;
      resolve(false);
      modal.destroy();
    });

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

    modal.addListener(confirmBtn, 'click', () => {
      resolved = true;
      resolve(true);
      modal.destroy();
    });

    modal.footer.appendChild(cancelBtn);
    modal.footer.appendChild(confirmBtn);

    // Escape Key
    modal.addListener(document, 'keydown', (e) => {
      if (e.key === 'Escape') {
        modal.destroy(); // Trigger onClose -> resolve(false)
      }
    });

    // Outside Click
    modal.addListener(modal.element, 'click', (e) => {
      if (e.target === modal.element) {
        modal.destroy(); // Trigger onClose -> resolve(false)
      }
    });

    modal.show();

    // Focus confirm button
    setTimeout(() => {
      if (confirmBtn) confirmBtn.focus();
    }, TIMEOUTS.modalFocus);
  });
}
