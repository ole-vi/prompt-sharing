// ===== Status Bar Module =====

let element = null;
let msgElement = null;
let progressElement = null;
let actionElement = null;
let closeElement = null;
let currentTimeout = null;

export function init() {
  element = document.getElementById('statusBar');
  if (!element) {
    return;
  }

  msgElement = element.querySelector('.status-msg');
  progressElement = element.querySelector('.status-progress');
  actionElement = element.querySelector('.status-action');
  closeElement = element.querySelector('.status-close');

  // Ensure status bar is hidden initially
  element.classList.remove('status-visible');

  // Add close button handler
  if (closeElement) {
    closeElement.addEventListener('click', () => {
      clear();
    });
  }
}

export function showMessage(message, options = {}) {
  if (!element || !msgElement) return;

  const { timeout = 3000 } = options;

  msgElement.textContent = message;
  element.classList.add('status-visible');
  element.classList.remove('hidden');

  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }

  if (timeout > 0) {
    currentTimeout = setTimeout(() => {
      hide();
    }, timeout);
  }
}

export function setProgress(text, percent) {
  if (!progressElement) return;

  progressElement.textContent = text;
  progressElement.classList.remove('hidden');
}

export function clearProgress() {
  if (!progressElement) return;
  progressElement.textContent = '';
  progressElement.classList.add('hidden');
}

export function setAction(label, callback) {
  if (!actionElement) return;

  actionElement.textContent = label;
  actionElement.classList.remove('hidden');
  actionElement.onclick = callback;
}

export function clearAction() {
  if (!actionElement) return;
  actionElement.textContent = '';
  actionElement.classList.add('hidden');
  actionElement.onclick = null;
}

export function hide() {
  if (!element) return;

  element.classList.remove('status-visible');
  element.classList.add('hidden');

  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
}

export function clear() {
  clearProgress();
  clearAction();
  hide();
}
