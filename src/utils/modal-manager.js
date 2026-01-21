import { createElement } from './dom-helpers.js';

/**
 * Modal Manager
 * Handles lifecycle of modals including creation, display, hiding, and destruction.
 * Ensures proper cleanup of event listeners and DOM elements.
 */

export class ModalInstance {
  constructor(options = {}) {
    this.options = options;
    this.listeners = new Set();
    this.isDestroyed = false;

    // Create or wrap element
    this.element = this._createDOM();

    // Initialize standard behaviors
    this._initBehaviors();
  }

  _createDOM() {
    const className = this.options.className || 'modal-overlay';
    const tag = this.options.tag || 'div';

    const element = createElement(tag, className);

    if (this.options.id) {
      element.id = this.options.id;
    }

    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');

    if (this.options.ariaLabel) {
      element.setAttribute('aria-label', this.options.ariaLabel);
    }

    if (this.options.ariaLabelledBy) {
      element.setAttribute('aria-labelledby', this.options.ariaLabelledBy);
    }

    if (this.options.content) {
      if (typeof this.options.content === 'string') {
        element.innerHTML = this.options.content;
      } else if (this.options.content instanceof Node) {
        element.appendChild(this.options.content);
      }
    }

    document.body.appendChild(element);
    return element;
  }

  _initBehaviors() {
    // Close on background click
    if (this.options.closeOnBackgroundClick !== false) {
      this.addListener(this.element, 'click', (e) => {
        if (e.target === this.element) {
          this.hide();
        }
      });
    }

    // Close on Escape
    if (this.options.closeOnEscape !== false) {
      this.addListener(document, 'keydown', (e) => {
        if (this.isDestroyed) return;
        // Only close if this is the top-most visible modal
        // (Simple heuristic: if it has 'show' class)
        if (e.key === 'Escape' && this.element.classList.contains('show')) {
          this.hide();
        }
      });
    }
  }

  /**
   * Add an event listener that will be automatically removed on destroy
   * @param {EventTarget} target
   * @param {string} event
   * @param {Function} handler
   * @param {Object|boolean} options
   */
  addListener(target, event, handler, options) {
    if (this.isDestroyed) return;

    target.addEventListener(event, handler, options);
    this.listeners.add({ target, event, handler, options });
  }

  show() {
    if (this.isDestroyed) return;

    // Use requestAnimationFrame to ensure transition if CSS is present
    requestAnimationFrame(() => {
      this.element.classList.add('show');
    });

    if (this.options.onShow) {
      this.options.onShow(this);
    }
  }

  hide() {
    if (this.isDestroyed) return;

    this.element.classList.remove('show');

    if (this.options.onHide) {
      this.options.onHide(this);
    }

    if (this.options.destroyOnHide) {
      // Small delay to allow CSS transitions to finish if needed
      setTimeout(() => this.destroy(), 300);
    }
  }

  destroy() {
    if (this.isDestroyed) return;

    // Remove all tracked listeners
    this.listeners.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options);
    });
    this.listeners.clear();

    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.isDestroyed = true;

    if (this.options.onDestroy) {
      this.options.onDestroy(this);
    }
  }
}

/**
 * Create a new managed modal
 * @param {Object} options
 * @returns {ModalInstance}
 */
export function createModal(options) {
  return new ModalInstance(options);
}

/**
 * Show a modal instance
 * @param {ModalInstance} modal
 */
export function showModal(modal) {
  if (modal && typeof modal.show === 'function') {
    modal.show();
  }
}

/**
 * Hide a modal instance
 * @param {ModalInstance} modal
 */
export function hideModal(modal) {
  if (modal && typeof modal.hide === 'function') {
    modal.hide();
  }
}

/**
 * Destroy a modal instance
 * @param {ModalInstance} modal
 */
export function destroyModal(modal) {
  if (modal && typeof modal.destroy === 'function') {
    modal.destroy();
  }
}
