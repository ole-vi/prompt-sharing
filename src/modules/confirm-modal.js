// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

import { modalManager } from '../utils/modal-manager.js';
import { TIMEOUTS } from '../utils/constants.js';

let confirmResolve = null;
const MODAL_ID = 'confirmModal';

function getModalContent() {
  return `
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
    // Create or get modal
    const modal = modalManager.createModal(MODAL_ID, {
      content: getModalContent(),
      classes: ['modal'],
      styles: { zIndex: '10000' }
    });
    
    const title = options.title || 'Confirm Action';
    const confirmText = options.confirmText || 'Confirm';
    const confirmStyle = options.confirmStyle || 'error';
    const cancelText = options.cancelText || 'Cancel';
    
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const closeBtn = document.getElementById('confirmModalClose');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) confirmBtn.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;
    
    // Set button style
    if (confirmBtn) {
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
    }
    
    confirmResolve = resolve;
    
    // Clean up any existing listeners just in case (though we destroy on close)
    modalManager.cleanupListeners(MODAL_ID);
    
    const cleanupAndResolve = (result) => {
      modalManager.destroyModal(MODAL_ID);
      if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
      }
    };
    
    if (confirmBtn) {
      modalManager.addListener(MODAL_ID, confirmBtn, 'click', () => cleanupAndResolve(true));
    }
    
    if (cancelBtn) {
      modalManager.addListener(MODAL_ID, cancelBtn, 'click', () => cleanupAndResolve(false));
    }

    if (closeBtn) {
      modalManager.addListener(MODAL_ID, closeBtn, 'click', () => cleanupAndResolve(false));
    }
    
    // Close on background click
    modalManager.addListener(MODAL_ID, modal, 'click', (e) => {
      if (e.target === modal) {
        cleanupAndResolve(false);
      }
    });
    
    // Handle Escape key
    modalManager.addListener(MODAL_ID, document, 'keydown', (e) => {
      if (e.key === 'Escape') {
        cleanupAndResolve(false);
      }
    });
    
    modalManager.showModal(MODAL_ID);
    
    // Focus the confirm button
    setTimeout(() => {
      const btn = document.getElementById('confirmModalConfirm');
      if (btn) btn.focus();
    }, TIMEOUTS.modalFocus);
  });
}
