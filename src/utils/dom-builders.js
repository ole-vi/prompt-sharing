import { createElement } from './dom-helpers.js';

/**
 * Creates a session card element.
 * @param {Object} session The session data.
 * @returns {HTMLElement} The session card element.
 */
export function createSessionCard(session) {
  const state = session.state || 'UNKNOWN';
  const stateIcons = {
    'COMPLETED': 'check_circle',
    'FAILED': 'cancel',
    'IN_PROGRESS': 'schedule',
    'PLANNING': 'schedule',
    'QUEUED': 'pause_circle',
    'AWAITING_USER_FEEDBACK': 'chat_bubble'
  };
  const stateIconName = stateIcons[state] || 'help';

  const stateLabel = {
    'COMPLETED': 'COMPLETED',
    'FAILED': 'FAILED',
    'IN_PROGRESS': 'IN PROGRESS',
    'PLANNING': 'IN PROGRESS',
    'QUEUED': 'QUEUED',
    'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK'
  }[state] || state.replace(/_/g, ' ');

  const promptPreview = (session.prompt || 'No prompt text').substring(0, 150);
  const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
  const createdAt = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
  const prUrl = session.outputs?.[0]?.pullRequest?.url;

  const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
  const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';

  const card = createElement('div', 'session-card');
  card.dataset.sessionUrl = sessionUrl;
  // We use a specific class for identification in delegated events if needed,
  // but the card itself is the target for opening the session.

  const metaDiv = createElement('div', 'session-meta', createdAt);
  const promptDiv = createElement('div', 'session-prompt', displayPrompt);

  const rowDiv = createElement('div', 'session-row');

  // State Pill
  const pillSpan = createElement('span', 'session-pill');
  const iconSpan = createElement('span', 'icon icon-inline', stateIconName);
  iconSpan.setAttribute('aria-hidden', 'true');
  pillSpan.appendChild(iconSpan);
  pillSpan.appendChild(document.createTextNode(` ${stateLabel}`));
  rowDiv.appendChild(pillSpan);

  // PR Link
  if (prUrl) {
    const prLink = createElement('a', 'small-text');
    prLink.href = prUrl;
    prLink.target = '_blank';
    prLink.rel = 'noopener';

    // Stop propagation handled by event delegation or explicit listener if added here.
    // Ideally, we add a class to identify it as a link that shouldn't trigger the card click.
    prLink.classList.add('prevent-card-click');

    const prIcon = createElement('span', 'icon icon-inline', 'link');
    prIcon.setAttribute('aria-hidden', 'true');
    prLink.appendChild(prIcon);
    prLink.appendChild(document.createTextNode(' View PR'));
    rowDiv.appendChild(prLink);
  }

  // Hint
  const hintSpan = createElement('span', 'session-hint');
  const hintIcon = createElement('span', 'icon icon-inline', 'info');
  hintIcon.setAttribute('aria-hidden', 'true');
  hintSpan.appendChild(hintIcon);
  hintSpan.appendChild(document.createTextNode(' Click to view session'));
  rowDiv.appendChild(hintSpan);

  // View Button
  const viewBtn = createElement('button', 'btn-icon session-view-btn');
  viewBtn.title = 'View full prompt';
  viewBtn.dataset.sessionId = sessionId; // For delegated event handler

  const viewIcon = createElement('span', 'icon', 'visibility');
  viewIcon.setAttribute('aria-hidden', 'true');
  viewBtn.appendChild(viewIcon);
  rowDiv.appendChild(viewBtn);

  card.appendChild(metaDiv);
  card.appendChild(promptDiv);
  card.appendChild(rowDiv);

  return card;
}

/**
 * Creates a queue item element.
 * @param {Object} item The queue item data.
 * @returns {HTMLElement} The queue item element.
 */
export function createQueueItem(item) {
  const created = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString() : 'Unknown';
  const status = item.status || 'pending';
  const remainingCount = Array.isArray(item.remaining) ? item.remaining.length : 0;

  const card = createElement('div', 'queue-card queue-item');
  if (status === 'scheduled') {
    card.classList.add('queue-status-scheduled');
  }
  card.dataset.docid = item.id;

  const row = createElement('div', 'queue-row');

  // Checkbox Column
  const checkboxCol = createElement('div', 'queue-checkbox-col');
  const checkbox = createElement('input', 'queue-checkbox');
  checkbox.type = 'checkbox';
  checkbox.dataset.docid = item.id;
  checkboxCol.appendChild(checkbox);
  row.appendChild(checkboxCol);

  // Content Column
  const content = createElement('div', 'queue-content');

  // Title Row
  const titleDiv = createElement('div', 'queue-title');
  const titleText = item.type === 'subtasks' ? 'Subtasks Batch ' : 'Single Prompt ';
  titleDiv.appendChild(document.createTextNode(titleText));

  const statusSpan = createElement('span', 'queue-status', status);
  titleDiv.appendChild(statusSpan);

  if (item.type === 'subtasks') {
    const remainingSpan = createElement('span', 'queue-status', `(${remainingCount} remaining)`);
    titleDiv.appendChild(remainingSpan);
  }

  const editBtn = createElement('button', 'btn-icon edit-queue-item');
  editBtn.dataset.docid = item.id;
  editBtn.title = 'Edit queue item';
  const editIcon = createElement('span', 'icon icon-inline', 'edit');
  editIcon.setAttribute('aria-hidden', 'true');
  editBtn.appendChild(editIcon);
  titleDiv.appendChild(editBtn);

  content.appendChild(titleDiv);

  // Meta
  const metaDiv = createElement('div', 'queue-meta');
  metaDiv.appendChild(document.createTextNode(`Created: ${created} • ID: `));
  const idSpan = createElement('span', 'mono', item.id);
  metaDiv.appendChild(idSpan);
  content.appendChild(metaDiv);

  // Repo Display
  if (item.sourceId) {
    const repoDiv = createElement('div', 'queue-repo');
    const repoIcon = createElement('span', 'icon icon-inline', 'inventory_2');
    repoIcon.setAttribute('aria-hidden', 'true');
    repoDiv.appendChild(repoIcon);
    repoDiv.appendChild(document.createTextNode(` ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})`));
    content.appendChild(repoDiv);
  }

  // Scheduled Info
  if (status === 'scheduled' && item.scheduledAt) {
    const scheduledDate = new Date(item.scheduledAt.seconds * 1000);
    const timeZone = item.scheduledTimeZone || 'America/New_York';
    const dateStr = scheduledDate.toLocaleString('en-US', {
      timeZone: timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const retryCount = item.retryCount || 0;
    const retryInfo = retryCount > 0 ? ` (Retry ${retryCount}/3)` : '';

    const schedDiv = createElement('div', 'queue-scheduled-info');
    const schedIcon = createElement('span', 'icon icon-inline', 'schedule');
    schedIcon.setAttribute('aria-hidden', 'true');
    schedDiv.appendChild(schedIcon);
    schedDiv.appendChild(document.createTextNode(` Scheduled: ${dateStr} (${timeZone})${retryInfo}`));
    content.appendChild(schedDiv);
  }

  // Error Info
  if (status === 'error' && item.error) {
    const errorDiv = createElement('div', 'queue-error-info');
    const errorIcon = createElement('span', 'icon icon-inline', 'error');
    errorIcon.setAttribute('aria-hidden', 'true');
    errorDiv.appendChild(errorIcon);
    errorDiv.appendChild(document.createTextNode(` ${item.error}`));
    content.appendChild(errorDiv);
  } else if (status === 'scheduled' && item.lastError && item.retryCount > 0) {
    const errorDiv = createElement('div', 'queue-error-info');
    const errorIcon = createElement('span', 'icon icon-inline', 'warning');
    errorIcon.setAttribute('aria-hidden', 'true');
    errorDiv.appendChild(errorIcon);
    errorDiv.appendChild(document.createTextNode(` Last attempt failed: ${item.lastError}`));
    content.appendChild(errorDiv);
  }

  // Prompt or Subtasks
  if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
    // We append subtasks list to the card later, or we can build it here but it's separate in the original HTML structure (card > row, card > subtasks)
    // Actually in original it is:
    /*
      <div class="queue-card ...">
        <div class="queue-row">...</div>
        <div class="queue-subtasks">...</div>
      </div>
    */
    // So we handled queue-row above. Now we need to append queue-subtasks to card if present.
  } else {
    const promptPreview = (item.prompt || '').substring(0, 200);
    const displayPrompt = promptPreview.length >= 200 ? promptPreview + '...' : promptPreview;
    const promptDiv = createElement('div', 'queue-prompt', displayPrompt);
    content.appendChild(promptDiv);
  }

  row.appendChild(content);
  card.appendChild(row);

  if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
    const subtasksContainer = createElement('div', 'queue-subtasks');
    item.remaining.forEach((subtask, index) => {
      subtasksContainer.appendChild(createQueueSubtask(subtask, index, item));
    });
    card.appendChild(subtasksContainer);
  }

  return card;
}

/**
 * Creates a queue subtask element.
 * @param {Object} subtask The subtask data.
 * @param {number} index The index of the subtask.
 * @param {Object} item The parent queue item.
 * @returns {HTMLElement} The subtask element.
 */
export function createQueueSubtask(subtask, index, item) {
  const preview = (subtask.fullContent || '').substring(0, 150);
  const displayPreview = preview.length >= 150 ? preview + '...' : preview;

  const div = createElement('div', 'queue-subtask');

  const indexDiv = createElement('div', 'queue-subtask-index');
  const checkbox = createElement('input', 'subtask-checkbox');
  checkbox.type = 'checkbox';
  checkbox.dataset.docid = item.id;
  checkbox.dataset.index = index;
  indexDiv.appendChild(checkbox);
  div.appendChild(indexDiv);

  const contentDiv = createElement('div', 'queue-subtask-content');
  const metaDiv = createElement('div', 'queue-subtask-meta', `Subtask ${index + 1} of ${item.remaining.length}`);
  const textDiv = createElement('div', 'queue-subtask-text', displayPreview);

  contentDiv.appendChild(metaDiv);
  contentDiv.appendChild(textDiv);
  div.appendChild(contentDiv);

  return div;
}

/**
 * Creates an empty state element.
 * @param {string} message The message to display.
 * @returns {HTMLElement} The empty state element.
 */
export function createEmptyState(message) {
  const div = createElement('div', 'panel text-center pad-xl muted-text', message);
  return div;
}

/**
 * Creates an error state element.
 * @param {string} message The error message.
 * @returns {HTMLElement} The error state element.
 */
export function createErrorState(message) {
  const div = createElement('div', 'panel text-center pad-xl');
  // Or match the style in sessions-page.js: <div class="text-center pad-lg" style="color:#e74c3c;">
  // But standardizing to panel/pad-xl is probably better or safer to stick to one style.
  // Sessions page used: <div class="text-center pad-lg" style="color:#e74c3c;">
  // Queue page used: <div class="panel text-center pad-xl">Failed to load queue: ...</div>

  // Let's make it generic but allow custom class if needed? No, let's just use what queue uses as it looks more standard.
  div.textContent = message;
  // If we want red text:
  // div.style.color = 'var(--error, #e74c3c)'; // Assuming var exists or fallback
  return div;
}
