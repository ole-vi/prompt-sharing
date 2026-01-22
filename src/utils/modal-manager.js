/**
 * Modal Manager Utility
 * Handles modal lifecycle, display states, and automatic event listener cleanup.
 */

class ModalInstance {
  constructor(element, options = {}) {
    this.element = element;
    this.options = options;
    this.listeners = new Map(); // Map<Element, Set<{type, handler, options}>>
    this.isDestroyed = false;
  }

  /**
   * Add an event listener that will be automatically removed on destroy
   * @param {Element} target - The DOM element to attach listener to
   * @param {string} type - Event type
   * @param {Function} handler - Event handler
   * @param {Object|boolean} options - Event listener options
   */
  addListener(target, type, handler, options = false) {
    if (this.isDestroyed) return;

    target.addEventListener(type, handler, options);

    if (!this.listeners.has(target)) {
      this.listeners.set(target, new Set());
    }

    this.listeners.get(target).add({ type, handler, options });
  }

  /**
   * Remove a specific listener
   */
  removeListener(target, type, handler, options = false) {
    if (this.listeners.has(target)) {
      const listeners = this.listeners.get(target);
      for (const listener of listeners) {
        if (listener.type === type && listener.handler === handler) {
          target.removeEventListener(type, handler, options);
          listeners.delete(listener);
          break;
        }
      }
      if (listeners.size === 0) {
        this.listeners.delete(target);
      }
    } else {
      // Try removing anyway just in case it wasn't tracked
      target.removeEventListener(type, handler, options);
    }
  }

  /**
   * Show the modal
   */
  show() {
    if (this.isDestroyed) return;
    this.element.classList.add('show');

    // Optional: Handle backdrop click if configured
    if (this.options.closeOnBackdropClick) {
      this.addListener(this.element, 'click', (e) => {
        if (e.target === this.element) {
          this.hide();
          if (this.options.onClose) this.options.onClose();
        }
      });
    }
  }

  /**
   * Hide the modal
   */
  hide() {
    if (this.isDestroyed) return;
    this.element.classList.remove('show');
  }

  /**
   * Destroy the modal: hide, remove listeners, remove from DOM
   */
  destroy() {
    if (this.isDestroyed) return;

    this.hide();

    // Remove all tracked listeners
    for (const [target, listeners] of this.listeners) {
      for (const listener of listeners) {
        target.removeEventListener(listener.type, listener.handler, listener.options);
      }
    }
    this.listeners.clear();

    // Remove from DOM if parent exists
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.isDestroyed = true;

    if (this.options.onDestroy) {
      this.options.onDestroy();
    }
  }
}

/**
 * Create a new modal instance
 * @param {Object} options
 * @param {HTMLElement} [options.element] - Existing element to wrap
 * @param {string} [options.id] - ID for new element if creating
 * @param {string} [options.className] - Class for new element
 * @param {string} [options.html] - HTML content for new element
 * @param {boolean} [options.closeOnBackdropClick] - Auto-close on background click
 * @param {Function} [options.onClose] - Callback when closed via background click
 * @param {Function} [options.onDestroy] - Callback when destroyed
 * @returns {ModalInstance}
 */
export function createModal(options = {}) {
  let element = options.element;

  if (!element) {
    element = document.createElement('div');
    if (options.id) element.id = options.id;
    element.className = options.className || 'modal';
    if (options.html) element.innerHTML = options.html;

    // Default attributes for accessibility
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');

    document.body.appendChild(element);
  } else if (!element.parentNode) {
    // If element provided but detached, append to body
    document.body.appendChild(element);
  }

  return new ModalInstance(element, options);
}

export function showModal(modalInstance) {
  if (modalInstance && typeof modalInstance.show === 'function') {
    modalInstance.show();
  }
}

export function hideModal(modalInstance) {
  if (modalInstance && typeof modalInstance.hide === 'function') {
    modalInstance.hide();
  }
}

export function destroyModal(modalInstance) {
  if (modalInstance && typeof modalInstance.destroy === 'function') {
    modalInstance.destroy();
  }
}
