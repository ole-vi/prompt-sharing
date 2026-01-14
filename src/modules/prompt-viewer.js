/**
 * Prompt Viewer Modal Module
 * Shared modal for viewing and copying Jules session prompts
 */

let currentEscapeHandler = null;
let promptViewerHandlers = new Map();

function createPromptViewerModal() {
  const modal = document.createElement('div');
  modal.id = 'promptViewerModal';
  modal.className = 'modal';
  modal.style.zIndex = '10000';
  modal.innerHTML = `
    <div class="modal-content modal-xl">
      <div class="modal-header">
        <h3 id="promptViewerTitle">Session Prompt</h3>
        <button class="btn-icon close-modal" id="promptViewerClose" title="Close">✕</button>
      </div>
      <div class="modal-body prompt-viewer-body">
        <pre id="promptViewerText" class="prompt-viewer-text"></pre>
      </div>
      <div class="modal-buttons">
        <button id="promptViewerCopy" class="btn primary"><span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy Prompt</button>
        <button id="promptViewerCloseBtn" class="btn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

export function showPromptViewer(prompt, sessionId) {
  let modal = document.getElementById('promptViewerModal');
  if (!modal) {
    modal = createPromptViewerModal();
  }
  
  const promptText = document.getElementById('promptViewerText');
  const copyBtn = document.getElementById('promptViewerCopy');
  const closeBtn = document.getElementById('promptViewerCloseBtn');
  const closeX = document.getElementById('promptViewerClose');
  
  promptText.textContent = prompt || 'No prompt text available';
  
  // Copy functionality
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check</span> Copied!';
      copyBtn.disabled = true;
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Failed to copy prompt to clipboard');
    }
  };
  
  // Close functionality
  const closeModal = () => {
    modal.classList.remove('show');
  };
  
  // Remove old listeners and add new ones
  const newCopyBtn = copyBtn.cloneNode(true);
  const newCloseBtn = closeBtn.cloneNode(true);
  const newCloseX = closeX.cloneNode(true);
  
  copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  closeX.parentNode.replaceChild(newCloseX, closeX);
  
  newCopyBtn.addEventListener('click', handleCopy);
  newCloseBtn.addEventListener('click', closeModal);
  newCloseX.addEventListener('click', closeModal);
  
  // Close on background click - clear previous handler first
  modal.onclick = null;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  // Close on Escape key - remove any existing handler first
  if (currentEscapeHandler) {
    document.removeEventListener('keydown', currentEscapeHandler);
  }
  currentEscapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', currentEscapeHandler);
      currentEscapeHandler = null;
    }
  };
  document.addEventListener('keydown', currentEscapeHandler);
  
  modal.classList.add('show');
  
  // Focus the copy button
  setTimeout(() => newCopyBtn.focus(), 100);
}

/**
 * Clean up old prompt viewer handlers and attach new ones
 * @param {Array} sessions - Array of session objects with prompt data
 */
export function attachPromptViewerHandlers(sessions) {
  // Clean up old handlers to prevent memory leaks
  promptViewerHandlers.forEach((handler, key) => {
    delete window[key];
  });
  promptViewerHandlers.clear();
  
  // Attach new handlers
  sessions.forEach(session => {
    const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
    const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');
    const handlerKey = `viewPrompt_${cleanId}`;
    const handler = () => showPromptViewer(session.prompt || 'No prompt text available', sessionId);
    window[handlerKey] = handler;
    promptViewerHandlers.set(handlerKey, handler);
  });
}
