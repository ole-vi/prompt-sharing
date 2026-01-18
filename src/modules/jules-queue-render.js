export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderQueueList(items) {
  const listDiv = document.getElementById('allQueueList');
  if (!listDiv) return;
  if (!items || items.length === 0) {
    listDiv.innerHTML = '<div class="panel text-center pad-xl muted-text">No queued items.</div>';
    return;
  }

  listDiv.innerHTML = items.map(item => {
    const created = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString() : 'Unknown';
    const status = item.status || 'pending';
    const remainingCount = Array.isArray(item.remaining) ? item.remaining.length : 0;

    let scheduledInfo = '';
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
      scheduledInfo = `<div class="queue-scheduled-info"><span class="icon icon-inline" aria-hidden="true">schedule</span> Scheduled: ${dateStr} (${timeZone})${retryInfo}</div>`;
    }

    let errorInfo = '';
    if (status === 'error' && item.error) {
      errorInfo = `<div class="queue-error-info"><span class="icon icon-inline" aria-hidden="true">error</span> ${escapeHtml(item.error)}</div>`;
    } else if (status === 'scheduled' && item.lastError && item.retryCount > 0) {
      errorInfo = `<div class="queue-error-info"><span class="icon icon-inline" aria-hidden="true">warning</span> Last attempt failed: ${escapeHtml(item.lastError)}</div>`;
    }

    if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
      const subtasksHtml = item.remaining.map((subtask, index) => {
        const preview = (subtask.fullContent || '').substring(0, 150);
        return `
          <div class="queue-subtask">
            <div class="queue-subtask-index">
              <input class="subtask-checkbox" type="checkbox" data-docid="${item.id}" data-index="${index}" />
            </div>
            <div class="queue-subtask-content">
              <div class="queue-subtask-meta">Subtask ${index + 1} of ${item.remaining.length}</div>
              <div class="queue-subtask-text">${escapeHtml(preview)}${preview.length >= 150 ? '...' : ''}</div>
            </div>
          </div>
        `;
      }).join('');

      const repoDisplay = item.sourceId ? `<div class="queue-repo"><span class="icon icon-inline" aria-hidden="true">inventory_2</span> ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})</div>` : '';

      const statusClass = status === 'scheduled' ? 'queue-status-scheduled' : '';

      return `
        <div class="queue-card queue-item ${statusClass}" data-docid="${item.id}">
          <div class="queue-row">
            <div class="queue-checkbox-col">
              <input class="queue-checkbox" type="checkbox" data-docid="${item.id}" />
            </div>
            <div class="queue-content">
              <div class="queue-title">
                Subtasks Batch <span class="queue-status">${status}</span>
                <span class="queue-status">(${remainingCount} remaining)</span>
                <button class="btn-icon edit-queue-item" data-docid="${item.id}" title="Edit queue item"><span class="icon icon-inline" aria-hidden="true">edit</span></button>
              </div>
              <div class="queue-meta">Created: ${created} • ID: <span class="mono">${item.id}</span></div>
              ${repoDisplay}
              ${scheduledInfo}
              ${errorInfo}
            </div>
          </div>
          <div class="queue-subtasks">
            ${subtasksHtml}
          </div>
        </div>
      `;
    }

    const promptPreview = (item.prompt || '').substring(0, 200);
    const repoDisplay = item.sourceId ? `<div class="queue-repo"><span class="icon icon-inline" aria-hidden="true">inventory_2</span> ${item.sourceId.split('/').slice(-2).join('/')} (${item.branch || 'master'})</div>` : '';

    const statusClass = status === 'scheduled' ? 'queue-status-scheduled' : '';

    return `
      <div class="queue-card queue-item ${statusClass}" data-docid="${item.id}">
        <div class="queue-row">
          <div class="queue-checkbox-col">
            <input class="queue-checkbox" type="checkbox" data-docid="${item.id}" />
          </div>
          <div class="queue-content">
            <div class="queue-title">
              Single Prompt <span class="queue-status">${status}</span>
              <button class="btn-icon edit-queue-item" data-docid="${item.id}" title="Edit queue item"><span class="icon icon-inline" aria-hidden="true">edit</span></button>
            </div>
            <div class="queue-meta">Created: ${created} • ID: <span class="mono">${item.id}</span></div>
            ${repoDisplay}
            ${scheduledInfo}
            ${errorInfo}
            <div class="queue-prompt">${escapeHtml(promptPreview)}${promptPreview.length >= 200 ? '...' : ''}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
