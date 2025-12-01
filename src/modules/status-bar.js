// ===== Status Bar Module =====
// Provides methods to show messages, progress, and actions in the bottom status bar

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

  /**
   * Show a message in the status bar
   * @param {string} message - The message to display
   * @param {object} options - Options object
   * @param {number} options.timeout - Time in ms before hiding (0 = stay visible)
   */
  showMessage(message, options = {}) {
    if (!this.element || !this.msgElement) {
      console.warn('Status bar not initialized');
      return;
    }

    const { timeout = 3000 } = options;

    this.msgElement.textContent = message;
    this.element.classList.add('status-visible');
    this.element.style.display = 'flex';

    // Clear any existing timeout
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    // Auto-hide after timeout if specified
    if (timeout > 0) {
      this.currentTimeout = setTimeout(() => {
        this.hide();
      }, timeout);
    }
  }

  /**
   * Update the progress display
   * @param {string} text - Progress text (e.g., "3/10")
   * @param {number} percent - Progress percentage (0-100)
   */
  setProgress(text, percent) {
    if (!this.progressElement) return;

    this.progressElement.textContent = text;
    this.progressElement.style.display = 'block';
    
    // Optional: Add a visual progress bar if needed
    // You could extend this to show a visual progress indicator
  }

  /**
   * Clear the progress display
   */
  clearProgress() {
    if (!this.progressElement) return;
    this.progressElement.textContent = '';
    this.progressElement.style.display = 'none';
  }

  /**
   * Set an action button in the status bar
   * @param {string} label - Button label
   * @param {function} callback - Click handler
   */
  setAction(label, callback) {
    if (!this.actionElement) return;

    this.actionElement.textContent = label;
    this.actionElement.style.display = 'block';
    this.actionElement.onclick = callback;
  }

  /**
   * Clear the action button
   */
  clearAction() {
    if (!this.actionElement) return;
    this.actionElement.textContent = '';
    this.actionElement.style.display = 'none';
    this.actionElement.onclick = null;
  }

  /**
   * Hide the entire status bar
   */
  hide() {
    if (!this.element) return;
    
    this.element.classList.remove('status-visible');
    this.element.style.display = 'none';
    
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  /**
   * Clear all content and hide
   */
  clear() {
    this.clearProgress();
    this.clearAction();
    this.hide();
  }
}

// Export a singleton instance
const statusBar = new StatusBar();
export default statusBar;
