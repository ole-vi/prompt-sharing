// ===== Error Modal Module =====
// Handles the subtask error modal display and user interaction

export function showSubtaskErrorModal(subtaskNumber, totalSubtasks, error, options = {}) {
  return new Promise((resolve) => {
    const allowQueue =
      typeof options.allowQueue === 'boolean' ? options.allowQueue : options.hideQueueButton ? false : true;

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

    if (subtaskNumDiv) subtaskNumDiv.textContent = `Subtask ${subtaskNumber} of ${totalSubtasks}`;
    if (messageDiv) messageDiv.textContent = error?.message || String(error);
    if (detailsDiv) detailsDiv.textContent = error?.toString?.() || String(error);

    if (queueBtn) {
      if (!allowQueue) {
        queueBtn.style.display = 'none';
      } else {
        queueBtn.style.removeProperty('display');
      }
    }

    modal.style.removeProperty('display');
    modal.style.setProperty('display', 'flex', 'important');

    const handleAction = (action) => {
      if (retryBtn) retryBtn.onclick = null;
      if (skipBtn) skipBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (queueBtn) queueBtn.onclick = null;

      hideSubtaskErrorModal();

      const shouldDelay = action === 'retry' ? !!retryDelayCheckbox?.checked : false;
      resolve({ action, shouldDelay });
    };

    if (retryBtn) retryBtn.onclick = () => handleAction('retry');
    if (skipBtn) skipBtn.onclick = () => handleAction('skip');
    if (cancelBtn) cancelBtn.onclick = () => handleAction('cancel');
    if (queueBtn && allowQueue) queueBtn.onclick = () => handleAction('queue');
  });
}

export function hideSubtaskErrorModal() {
  const modal = document.getElementById('subtaskErrorModal');
  if (modal) {
    modal.style.removeProperty('display');
    modal.style.display = 'none';
  }
}
