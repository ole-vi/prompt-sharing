/**
 * Modal Manager
 * Handles modal lifecycle and event listener cleanup to prevent memory leaks.
 */

class ModalManager {
  constructor() {
    this.modals = new Map(); // id -> { element, listeners: [] }
  }

  /**
   * Create or retrieve a modal element.
   * If a modal with the same ID exists and is tracked, it returns it.
   * If it exists in DOM but not tracked, it tracks it.
   * If not in DOM, creates it.
   *
   * @param {string} id - The DOM ID for the modal
   * @param {Object} options
   * @param {string} options.content - HTML content
   * @param {string[]} options.classes - CSS classes
   * @param {Object} options.styles - Inline styles
   * @param {HTMLElement} options.parent - Parent element (default document.body)
   * @returns {HTMLElement} The modal element
   */
  createModal(id, { content = '', classes = [], styles = {}, parent = document.body } = {}) {
    // Check if tracked
    if (this.modals.has(id)) {
      const existing = this.modals.get(id);
      // Check if still in DOM
      if (document.getElementById(id)) {
          return existing.element;
      }
      // If tracked but not in DOM (unexpected), clean up
      this.destroyModal(id);
    }

    let modal = document.getElementById(id);
    if (modal) {
        // Exists in DOM but not tracked? Track it.
        this.modals.set(id, { element: modal, listeners: [] });
    } else {
        modal = document.createElement('div');
        modal.id = id;
        if (classes.length) modal.className = classes.join(' ');
        Object.assign(modal.style, styles);
        if (content) modal.innerHTML = content;
        parent.appendChild(modal);
        this.modals.set(id, { element: modal, listeners: [] });
    }

    return modal;
  }

  /**
   * Register an existing modal element that might have been created elsewhere or statically.
   * @param {string} id
   * @param {HTMLElement} element
   */
  registerModal(id, element) {
      if (!element) return;
      if (this.modals.has(id)) return;
      this.modals.set(id, { element, listeners: [] });
  }

  /**
   * Show a modal.
   * @param {string} id
   * @param {Object} options
   * @param {string} options.showClass - Class to add (default 'show')
   * @param {string} options.displayStyle - Display style to set (e.g. 'flex')
   */
  showModal(id, { showClass = 'show', displayStyle = '' } = {}) {
    const data = this.modals.get(id);
    if (!data) return;

    if (showClass) data.element.classList.add(showClass);
    if (displayStyle) {
        data.element.style.display = displayStyle;
        if (displayStyle.includes('!important')) {
            // Handle !important which style.display doesn't support directly usually
            data.element.setAttribute('style', `display: ${displayStyle};` + (data.element.getAttribute('style') || '').replace(/display:[^;]+;/, ''));
        }
    }
  }

  /**
   * Hide a modal.
   * @param {string} id
   * @param {Object} options
   * @param {string} options.showClass - Class to remove (default 'show')
   */
  hideModal(id, { showClass = 'show' } = {}) {
    const data = this.modals.get(id);
    if (!data) return;

    if (showClass) data.element.classList.remove(showClass);
    data.element.style.display = 'none';
  }

  /**
   * Adds an event listener that will be automatically removed when the modal is destroyed or cleaned up.
   * @param {string} id - Modal ID
   * @param {HTMLElement|EventTarget} target - Element to attach listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object|boolean} options - Event listener options
   */
  addListener(id, target, event, handler, options) {
    const data = this.modals.get(id);
    if (!data) {
        // Try to auto-register if element exists
        const el = document.getElementById(id);
        if (el) {
            this.registerModal(id, el);
            this.addListener(id, target, event, handler, options);
            return;
        }
        console.warn(`ModalManager: Attempted to add listener to unknown modal ${id}`);
        return;
    }

    if (!target) {
        console.warn(`ModalManager: Target is null for listener on ${id} (${event})`);
        return;
    }

    target.addEventListener(event, handler, options);
    data.listeners.push({ target, event, handler, options });
  }

  /**
   * Removes all tracked listeners for the modal.
   * Use this when closing a modal if you want to ensure no stale listeners remain,
   * but you want to keep the DOM element.
   * @param {string} id
   */
  cleanupListeners(id) {
    const data = this.modals.get(id);
    if (!data) return;

    data.listeners.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options);
    });
    data.listeners = [];
  }

  /**
   * Removes all listeners and removes the modal from DOM.
   * @param {string} id
   */
  destroyModal(id) {
    const data = this.modals.get(id);
    if (!data) return;

    // Remove listeners
    this.cleanupListeners(id);

    // Remove from DOM if parent exists
    if (data.element && data.element.parentNode) {
      data.element.parentNode.removeChild(data.element);
    }

    this.modals.delete(id);
  }
}

export const modalManager = new ModalManager();
