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
      console.warn('Status bar element not found');
      return;
    }
    
    this.msgElement = this.element.querySelector('.status-msg');
    this.progressElement = this.element.querySelector('.status-progress');
    this.actionElement = this.element.querySelector('.status-action');
  }

  showMessage(message, options = {}) {
    if (!this.element || !this.msgElement) {
      console.warn('Status bar not initialized');
      return;
    }

    const { timeout = 3000 } = options;

    this.msgElement.textContent = message;
    this.element.classList.add('status-visible');
    this.element.style.display = 'flex';

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
    this.progressElement.style.display = 'block';
  }

  clearProgress() {
    if (!this.progressElement) return;
    this.progressElement.textContent = '';
    this.progressElement.style.display = 'none';
  }

  setAction(label, callback) {
    if (!this.actionElement) return;

    this.actionElement.textContent = label;
    this.actionElement.style.display = 'block';
    this.actionElement.onclick = callback;
  }

  clearAction() {
    if (!this.actionElement) return;
    this.actionElement.textContent = '';
    this.actionElement.style.display = 'none';
    this.actionElement.onclick = null;
  }

  hide() {
    if (!this.element) return;
    
    this.element.classList.remove('status-visible');
    this.element.style.display = 'none';
    
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
