// ===== Status Bar Module =====

class StatusBar {
  constructor() {
    this.element = null;
    this.msgElement = null;
    this.progressElement = null;
    this.actionElement = null;
    this.currentTimeout = null;
  }

  init() {
    this.element = document.getElementById('statusBar');
    if (!this.element) {
      return;
    }

    this.element.setAttribute('role', 'status');
    
    this.msgElement = this.element.querySelector('.status-msg');
    this.progressElement = this.element.querySelector('.status-progress');
    this.actionElement = this.element.querySelector('.status-action');
    this.closeElement = this.element.querySelector('.status-close');
    
    // Ensure status bar is hidden initially
    this.element.classList.remove('status-visible');
    
    // Add close button handler
    if (this.closeElement) {
      this.closeElement.addEventListener('click', () => {
        this.clear();
      });
    }
  }

  showMessage(message, options = {}) {
    if (!this.element || !this.msgElement) return;

    const { timeout = 3000 } = options;

    this.msgElement.textContent = message;
    this.element.classList.add('status-visible');
    this.element.classList.remove('hidden');

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    if (timeout > 0) {
      this.currentTimeout = setTimeout(() => {
        this.hide();
      }, timeout);
    }
  }

  setProgress(text, percent) {
    if (!this.progressElement) return;

    this.progressElement.textContent = text;
    this.progressElement.classList.remove('hidden');
  }

  clearProgress() {
    if (!this.progressElement) return;
    this.progressElement.textContent = '';
    this.progressElement.classList.add('hidden');
  }

  setAction(label, callback) {
    if (!this.actionElement) return;

    this.actionElement.textContent = label;
    this.actionElement.classList.remove('hidden');
    this.actionElement.onclick = callback;
  }

  clearAction() {
    if (!this.actionElement) return;
    this.actionElement.textContent = '';
    this.actionElement.classList.add('hidden');
    this.actionElement.onclick = null;
  }

  hide() {
    if (!this.element) return;
    
    this.element.classList.remove('status-visible');
    this.element.classList.add('hidden');
    
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  clear() {
    this.clearProgress();
    this.clearAction();
    this.hide();
  }
}

const statusBar = new StatusBar();
export default statusBar;
