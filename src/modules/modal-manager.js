/**
 * Modal Manager
 * A centralized module for handling all modal dialogs in the application.
 * It provides a consistent way to open, close, and manage modal behavior,
 * including keyboard support and focus trapping.
 */

/**
 * Opens a modal dialog.
 * @param {string} modalId - The ID of the modal element to open.
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.warn(`Modal with ID "${modalId}" not found.`);
    return;
  }
  modal.classList.add('show');
  // Future implementation: Add focus trapping.
}

/**
 * Closes a modal dialog.
 * @param {string} modalId - The ID of the modal element to close.
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.warn(`Modal with ID "${modalId}" not found.`);
    return;
  }
  modal.classList.remove('show');
  // Future implementation: Restore focus to the element that opened the modal.
}

/**
 * Initializes event listeners for all modals.
 * - Attaches click listeners to elements with the 'modal-close-btn' class.
 * - Attaches a global keydown listener to close modals on 'Escape'.
 */
export function initModals() {
  // Close modals when a close button is clicked
  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('.modal-close-btn');
    if (closeButton) {
      const modal = closeButton.closest('.modal');
      if (modal) {
        closeModal(modal.id);
      }
    }
  });

  // Close the topmost modal on Escape key press
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal.show');
      if (openModals.length > 0) {
        // Get the last modal in the list, which will be the topmost one
        const topModal = openModals[openModals.length - 1];
        closeModal(topModal.id);
      }
    }
  });
}
