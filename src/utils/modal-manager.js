import { createElement } from './dom-helpers.js';

class ModalInstance {
  /**
   * @param {Object} options
   * @param {string} [options.id] - Modal ID
   * @param {string} [options.title] - Modal title
   * @param {string} [options.className='modal-overlay'] - Overlay class
   * @param {string} [options.dialogClass='modal-dialog'] - Dialog class
   * @param {boolean} [options.closeable=true] - Whether to show close button in header
   * @param {string|Node} [options.content] - Initial body content
   * @param {boolean} [options.hasFooter=false] - Whether to create a footer container
   * @param {Function} [options.onClose] - Callback when destroyed
   */
  constructor(options = {}) {
    this.options = options;
    this.listeners = [];
    this.isDestroyed = false;
    this.body = null;
    this.footer = null;
    this.element = this._createDOM();
  }

  _createDOM() {
    const {
      id,
      title = '',
      className = 'modal-overlay',
      dialogClass = 'modal-dialog',
      closeable = true,
      content = null,
      hasFooter = false
    } = this.options;

    const overlay = createElement('div', className);
    if (id) overlay.id = id;

    const dialog = createElement('div', dialogClass);

    // Header
    const header = createElement('div', 'modal-header');

    // Title
    const titleEl = createElement('h2', 'modal-title', title);
    // Allow title to be updated later by exposing it?
    // For now, just append.
    header.appendChild(titleEl);
    this.titleElement = titleEl;

    if (closeable) {
      const closeBtn = createElement('button', 'btn-icon close-modal');
      closeBtn.title = 'Close';
      const icon = createElement('span', 'icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'close';
      closeBtn.appendChild(icon);

      // We manually add this listener using our method so it gets tracked
      // Note: We don't bind 'this' immediately in addListener, so we use arrow function
      this.addListener(closeBtn, 'click', () => this.destroy());
      header.appendChild(closeBtn);
    }
    dialog.appendChild(header);

    // Body
    const body = createElement('div', 'modal-body');
    if (content) {
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof Node) {
        body.appendChild(content);
      }
    }
    this.body = body;
    dialog.appendChild(body);

    // Footer
    if (hasFooter) {
        const footer = createElement('div', 'modal-footer');
        this.footer = footer;
        dialog.appendChild(footer);
    }

    overlay.appendChild(dialog);
    return overlay;
  }

  /**
   * Add an event listener that will be automatically removed on destroy
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function} listener
   * @param {Object} [options]
   */
  addListener(target, type, listener, options) {
    if (this.isDestroyed) return;
    target.addEventListener(type, listener, options);
    this.listeners.push({ target, type, listener, options });
  }

  show() {
    if (this.isDestroyed) return;

    if (!this.element.parentNode) {
      document.body.appendChild(this.element);
    }

    // Use setTimeout to ensure transition works if CSS has transitions
    requestAnimationFrame(() => {
        this.element.classList.add('show');
    });
  }

  hide() {
    if (this.isDestroyed) return;
    this.element.classList.remove('show');
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.hide();

    // Remove all listeners
    this.listeners.forEach(({ target, type, listener, options }) => {
      target.removeEventListener(type, listener, options);
    });
    this.listeners = [];

    // Remove from DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    if (this.options.onClose) {
        this.options.onClose();
    }
  }
}

export function createModal(options) {
  return new ModalInstance(options);
}
