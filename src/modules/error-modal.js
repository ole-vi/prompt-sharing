// ===== Error Modal Module =====
// Handles the subtask error modal display and user interaction

export function showSubtaskErrorModal(subtaskNumber, totalSubtasks, error, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('subtaskErrorModal');
    const subtaskNumDiv = document.getElementById('errorSubtaskNumber');
    const messageDiv = document.getElementById('errorMessage');
    const detailsDiv = document.getElementById('errorDetails');
    const retryBtn = document.getElementById('subtaskErrorRetryBtn');
    const skipBtn = document.getElementById('subtaskErrorSkipBtn');
    const queueBtn = document.getElementById('subtaskErrorQueueBtn');
    const cancelBtn = document.getElementById('subtaskErrorCancelBtn');
    const retryDelayCheckbox = document.getElementById('errorRetryDelayCheckbox');

    if (!modal) {
      resolve({ action: 'cancel', shouldDelay: false });
      return;
    }

    subtaskNumDiv.textContent = `Subtask ${subtaskNumber} of ${totalSubtasks}`;
    messageDiv.textContent = error.message || String(error);
    detailsDiv.textContent = error.toString();

    // Hide queue button if requested
    if (queueBtn) {
      queueBtn.style.display = options.hideQueueButton ? 'none' : '';
    }

    modal.style.removeProperty('display');
    modal.style.setProperty('display', 'flex', 'important');

    const handleAction = (action) => {
      retryBtn.onclick = null;
      skipBtn.onclick = null;
      cancelBtn.onclick = null;
      if (queueBtn) queueBtn.onclick = null;

      hideSubtaskErrorModal();

      const shouldDelay = action === 'retry' ? retryDelayCheckbox.checked : false;
      resolve({ action, shouldDelay });
    };

    retryBtn.onclick = () => handleAction('retry');
    skipBtn.onclick = () => handleAction('skip');
    cancelBtn.onclick = () => handleAction('cancel');
    if (queueBtn) queueBtn.onclick = () => handleAction('queue');
  });
}

export function hideSubtaskErrorModal() {
  const modal = document.getElementById('subtaskErrorModal');
  if (modal) {
    modal.style.removeProperty('display');
    modal.style.display = 'none';
  }
}
