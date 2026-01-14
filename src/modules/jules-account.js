// ===== Jules Profile Modal Module =====
// Profile modal and sessions history functionality

import { checkJulesKey, deleteStoredJulesKey } from './jules-keys.js';
import { showJulesKeyModal } from './jules-modal.js';
import { showJulesQueueModal } from './jules-queue.js';
import { loadJulesProfileInfo, listJulesSessions, getDecryptedJulesKey } from './jules-api.js';
import { getCache, setCache, clearCache, CACHE_KEYS } from '../utils/session-cache.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';

let allSessionsCache = [];
let sessionNextPageToken = null;

export function showUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  const user = window.auth?.currentUser;

  if (!user) {
    showToast('Not logged in.', 'error');
    return;
  }

  modal.classList.add('show');

  const profileUserName = document.getElementById('profileUserName');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const resetBtn = document.getElementById('resetJulesKeyBtn');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  const closeBtn = document.getElementById('closeProfileBtn');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'Unknown User';
  }

  checkJulesKey(user.uid).then(async (hasKey) => {
    if (julesKeyStatus) {
      julesKeyStatus.innerHTML = hasKey 
        ? '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Saved'
        : '<span class="icon icon-inline" aria-hidden="true">cancel</span> Not saved';
      julesKeyStatus.style.color = hasKey ? 'var(--accent)' : 'var(--muted)';
    }
    
    if (hasKey) {
      if (addBtn) addBtn.classList.add('d-none');
      if (dangerZoneSection) dangerZoneSection.classList.remove('d-none');
      if (julesProfileInfoSection) julesProfileInfoSection.classList.remove('d-none');
      
      await loadAndDisplayJulesProfile(user.uid);
    } else {
      if (addBtn) addBtn.classList.remove('d-none');
      if (dangerZoneSection) dangerZoneSection.classList.add('d-none');
      if (julesProfileInfoSection) julesProfileInfoSection.classList.add('d-none');
    }
  });

  if (addBtn) {
    addBtn.onclick = () => {
      hideUserProfileModal();
      showJulesKeyModal(() => {
        setTimeout(() => showUserProfileModal(), 500);
      });
    };
  }

  if (resetBtn) {
    resetBtn.onclick = async () => {
      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">hourglass_top</span> Deleting...';
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            julesKeyStatus.innerHTML = '<span class="icon icon-inline" aria-hidden="true">cancel</span> Not saved';
            julesKeyStatus.style.color = 'var(--muted)';
          }
          resetBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">delete</span> Delete Jules API Key';
          resetBtn.disabled = false;
          
          if (addBtn) addBtn.style.display = 'block';
          if (dangerZoneSection) dangerZoneSection.style.display = 'none';
          if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';
          
          showToast('Jules API key has been deleted. You can enter a new one next time.', 'success');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        showToast('Failed to reset API key: ' + error.message, 'error');
        resetBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">refresh</span> Reset Jules API Key';
        resetBtn.disabled = false;
      }
    };
  }

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);
      
      await loadAndDisplayJulesProfile(user.uid);
      attachViewAllSessionsHandler();
      attachViewQueueHandler();
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      hideUserProfileModal();
    };
  }
  
  attachViewAllSessionsHandler();
  attachViewQueueHandler();
  
  const closeSessionsHistoryBtn = document.getElementById('closeSessionsHistoryBtn');
  const loadMoreSessionsBtn = document.getElementById('loadMoreSessionsBtn');
  const sessionSearchInput = document.getElementById('sessionSearchInput');
  
  if (closeSessionsHistoryBtn) {
    closeSessionsHistoryBtn.onclick = () => {
      hideJulesSessionsHistoryModal();
    };
  }
  
  if (loadMoreSessionsBtn) {
    loadMoreSessionsBtn.onclick = () => {
      loadSessionsPage();
    };
  }
  
  if (sessionSearchInput) {
    sessionSearchInput.addEventListener('input', () => {
      const user = window.auth?.currentUser;
      if (!user) return;
      renderAllSessions(allSessionsCache);
    });
  }
}

function attachViewAllSessionsHandler() {
  const viewAllSessionsLink = document.getElementById('viewAllSessionsLink');
  if (viewAllSessionsLink) {
    viewAllSessionsLink.onclick = (e) => {
      e.preventDefault();
      showJulesSessionsHistoryModal();
    };
  }
}

function attachViewQueueHandler() {
  const viewQueueLink = document.getElementById('viewQueueLink');
  if (viewQueueLink) {
    viewQueueLink.onclick = (e) => {
      e.preventDefault();
      showJulesQueueModal();
    };
  }
}

// Create prompt viewer modal (reused from sessions page)
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

function showPromptViewer(prompt, sessionId) {
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
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  modal.classList.add('show');
  
  // Focus the copy button
  setTimeout(() => newCopyBtn.focus(), 100);
}

async function loadAndDisplayJulesProfile(uid) {
  const loadBtn = document.getElementById('loadJulesInfoBtn');
  const sourcesListDiv = document.getElementById('julesSourcesList');
  const sessionsListDiv = document.getElementById('julesSessionsList');

  try {
    loadBtn.disabled = true;
    
    // Check cache first
    let profileData = getCache(CACHE_KEYS.JULES_ACCOUNT, uid);
    
    if (!profileData) {
      sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sources...</div>';
      sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px;">Loading sessions...</div>';
      
      profileData = await loadJulesProfileInfo(uid);
      setCache(CACHE_KEYS.JULES_ACCOUNT, profileData, uid);
    }

    if (profileData.sources && profileData.sources.length > 0) {
      const sourcesHtml = profileData.sources.map((source, index) => {
        const repoName = source.githubRepo?.name || source.name || source.id;
        const githubPath = repoName.includes('github/')
          ? repoName.split('github/')[1]
          : repoName.replace('sources/', '');
        const branches = source.githubRepo?.branches || [];
        const sourceId = `source-${index}`;

        const branchSummaryText = branches.length > 0
          ? `(${branches.length} ${branches.length === 1 ? 'branch' : 'branches'})`
          : '(no branches)';

        const branchesHtml = branches.length > 0
          ? `<div id="${sourceId}-branches" style="display:none; margin-top:6px; padding-left:10px; font-size:11px; color:var(--muted);">
               <div style="margin-bottom:4px; color:var(--text);"><span class="icon icon-inline" aria-hidden="true">account_tree</span> Branches (${branches.length}):</div>
               ${branches.map(b => `<div style="padding:3px 0 3px 8px; cursor:pointer;"
                  onclick="window.open('https://github.com/${githubPath}/tree/${encodeURIComponent(b.displayName || b.name)}', '_blank')">
                  • ${b.displayName || b.name}
                </div>`).join('')}
             </div>`
          : `<div id="${sourceId}-branches" style="display:none; margin-top:6px; padding-left:10px; font-size:11px; color:var(--muted); font-style:italic;">No branches found</div>`;

        const cardHtml = `
          <div class="queue-card">
            <div class="queue-row">
              <div class="queue-content">
                <div class="queue-title" style="cursor:pointer; user-select:none;"
                    onclick="(function(){
                      const el = document.getElementById('${sourceId}-branches');
                      const arrow = document.getElementById('${sourceId}-arrow');
                      if (el.style.display === 'none') { el.style.display = 'block'; arrow.textContent = '▼'; }
                      else { el.style.display = 'none'; arrow.textContent = '▶'; }
                    })()">
                  <span id="${sourceId}-arrow" style="display:inline-block; width:12px; font-size:10px; margin-right:6px;">▶</span>
                  <span class="icon icon-inline" aria-hidden="true">folder</span> ${githubPath}
                  <span class="queue-status">${branchSummaryText}</span>
                </div>
              </div>
            </div>
            ${branchesHtml}
          </div>
        `;
        return cardHtml;
      }).join('');
      sourcesListDiv.innerHTML = `<div class="vlist">${sourcesHtml}</div>`;
    } else {
      sourcesListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No connected repositories found.<br><small>Connect repos in the Jules UI.</small></div>';
    }

    if (profileData.sessions && profileData.sessions.length > 0) {
      const sessionsHtml = profileData.sessions.map(session => {
        const state = session.state || 'UNKNOWN';
        const stateIcon = {
          'COMPLETED': 'check_circle',
          'FAILED': 'cancel',
          'IN_PROGRESS': 'schedule',
          'PLANNING': 'schedule',
          'QUEUED': 'pause_circle',
          'AWAITING_USER_FEEDBACK': 'chat_bubble'
        }[state] || 'help';

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
        const createdAt = session.createTime ? new Date(session.createTime).toLocaleDateString() : 'Unknown';
        const prUrl = session.outputs?.[0]?.pullRequest?.url;
        const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
        const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
        const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');

        // Attach prompt viewer function to window
        window[`viewPrompt_${cleanId}`] = () => showPromptViewer(session.prompt || 'No prompt text available', sessionId);

        const cardHtml = `
          <div class="session-card" onclick="window.open('${sessionUrl}', '_blank', 'noopener')">
            <div class="session-meta">${createdAt}</div>
            <div class="session-prompt">${displayPrompt}</div>
            <div class="session-row">
              <span class="session-pill"><span class="icon icon-inline" aria-hidden="true">${stateIcon}</span> ${stateLabel}</span>
              ${prUrl ? `<a href="${prUrl}" target="_blank" rel="noopener" class="small-text" onclick="event.stopPropagation()"><span class="icon icon-inline" aria-hidden="true">link</span> View PR</a>` : ''}
              <span class="session-hint"><span class="icon icon-inline" aria-hidden="true">info</span> Click to view session</span>
              <button class="btn-icon session-view-btn" onclick="event.stopPropagation(); window.viewPrompt_${cleanId}()" title="View full prompt"><span class="icon" aria-hidden="true">visibility</span></button>
            </div>
          </div>
        `;
        return cardHtml;
      }).join('');
      sessionsListDiv.innerHTML = `<div class="vlist">${sessionsHtml}</div>`;
    } else {
      sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No recent sessions found.</div>';
    }

    loadBtn.disabled = false;
    loadBtn.innerHTML = '<span class="icon" aria-hidden="true">sync</span>';
    
    attachViewAllSessionsHandler();

  } catch (error) {
    sourcesListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sources: ${error.message}
    </div>`;
    sessionsListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sessions: ${error.message}
    </div>`;

    loadBtn.disabled = false;
    loadBtn.innerHTML = '<span class="icon" aria-hidden="true">sync</span>';
  }
}

export function hideUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  modal.classList.remove('show');
}

export function showJulesSessionsHistoryModal() {
  const modal = document.getElementById('julesSessionsHistoryModal');
  const searchInput = document.getElementById('sessionSearchInput');
  
  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
  
  allSessionsCache = [];
  sessionNextPageToken = null;
  searchInput.value = '';
  
  loadSessionsPage();
}

export function hideJulesSessionsHistoryModal() {
  const modal = document.getElementById('julesSessionsHistoryModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1002; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
}

async function loadSessionsPage() {
  const user = window.auth?.currentUser;
  if (!user) return;
  
  const allSessionsList = document.getElementById('allSessionsList');
  const loadMoreSection = document.getElementById('sessionsLoadMore');
  const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');
  
  try {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';
    
    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      throw new Error('Jules API key not found');
    }
    
    const result = await listJulesSessions(apiKey, 50, sessionNextPageToken);
    
    if (result.sessions && result.sessions.length > 0) {
      allSessionsCache = [...allSessionsCache, ...result.sessions];
      sessionNextPageToken = result.nextPageToken || null;
      
      renderAllSessions(allSessionsCache);
      
      if (sessionNextPageToken) {
        loadMoreSection.style.display = 'block';
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      } else {
        loadMoreSection.style.display = 'none';
      }
    } else if (allSessionsCache.length === 0) {
      allSessionsList.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">No sessions found</div>';
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      allSessionsList.innerHTML = `<div style="color:#e74c3c; text-align:center; padding:24px;">Failed to load sessions: ${error.message}</div>`;
    }
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More';
  }
}

function renderAllSessions(sessions) {
  const allSessionsList = document.getElementById('allSessionsList');
  const searchInput = document.getElementById('sessionSearchInput');
  const searchTerm = searchInput.value.toLowerCase();
  
  const filteredSessions = searchTerm 
    ? sessions.filter(s => {
        const promptText = s.prompt || s.displayName || '';
        const sessionId = s.name?.split('/').pop() || '';
        return promptText.toLowerCase().includes(searchTerm) || sessionId.toLowerCase().includes(searchTerm);
      })
    : sessions;
  
  if (filteredSessions.length === 0) {
    allSessionsList.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">No sessions match your search</div>';
    return;
  }
  
  const stateIcons = {
    'PLANNING': 'edit_note',
    'IN_PROGRESS': 'settings',
    'AWAITING_USER_FEEDBACK': 'chat_bubble',
    'COMPLETED': 'check_circle',
    'FAILED': 'cancel',
    'CANCELLED': 'block'
  };
  
  const stateLabel = {
    'PLANNING': 'IN PROGRESS',
    'IN_PROGRESS': 'IN PROGRESS',
    'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK',
    'COMPLETED': 'COMPLETED',
    'FAILED': 'FAILED',
    'CANCELLED': 'CANCELLED'
  };
  
  allSessionsList.innerHTML = filteredSessions.map(session => {
    if (session.parentTask) {
      return '';
    }
    
    const sessionId = session.name?.split('/').pop() || '';
    const state = session.state || 'UNKNOWN';
    const icon = stateIcons[state] || 'help';
    const label = stateLabel[state] || state.replace(/_/g, ' ');
    
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    const prLink = prUrl 
      ? `<div style="margin-top:4px;" onclick="event.stopPropagation();"><a href="${prUrl}" target="_blank" style="font-size:11px; color:var(--accent); text-decoration:none;"><span class="icon icon-inline" aria-hidden="true">link</span> View PR</a></div>`
      : '';
    
    const subtaskCount = session.childTasks?.length || 0;
    const subtaskInfo = subtaskCount > 0 
      ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;"><span class="icon icon-inline" aria-hidden="true">list_alt</span> ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}</div>`
      : '';
    
    return `<div style="padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;"
                 onmouseover="this.style.borderColor='var(--accent)'; this.style.background='rgba(255,255,255,0.06)'"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.background='rgba(255,255,255,0.03)'"
                 onclick="window.open('https://jules.google.com/session/${sessionId}', '_blank')">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;">
        <div style="font-weight:600; font-size:13px; flex:1; margin-right:8px;">${displayTitle}</div>
        <div style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1); white-space:nowrap; margin-left:8px; display:flex; align-items:center;">
          <span class="icon icon-inline" aria-hidden="true">${icon}</span> ${label}
        </div>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-bottom:2px;">Created: ${createTime}</div>
      <div style="font-size:11px; color:var(--muted);">Updated: ${updateTime}</div>
      ${subtaskInfo}
      ${prLink}
    </div>`;
  }).filter(html => html).join('');
}

export async function loadProfileDirectly(user) {
  const profileUserName = document.getElementById('profileUserName');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const resetBtn = document.getElementById('resetJulesKeyBtn');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'Unknown User';
  }

  const hasKey = await checkJulesKey(user.uid);
  
  if (julesKeyStatus) {
    julesKeyStatus.innerHTML = hasKey
      ? '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Saved'
      : '<span class="icon icon-inline" aria-hidden="true">cancel</span> Not saved';
    julesKeyStatus.style.color = hasKey ? 'var(--accent)' : 'var(--muted)';
  }
  
  if (hasKey) {
    if (addBtn) addBtn.style.display = 'none';
    if (dangerZoneSection) dangerZoneSection.style.display = 'block';
    if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'block';
    
    await loadAndDisplayJulesProfile(user.uid);
  } else {
    if (addBtn) addBtn.style.display = 'block';
    if (dangerZoneSection) dangerZoneSection.style.display = 'none';
    if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';
  }

  // Attach event handlers
  if (addBtn) {
    addBtn.onclick = () => {
      showJulesKeyModal(() => {
        setTimeout(() => loadProfileDirectly(user), 500);
      });
    };
  }

  if (resetBtn) {
    const originalResetLabel = resetBtn.innerHTML;
    resetBtn.onclick = async () => {
      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">hourglass_top</span> Deleting...';
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            julesKeyStatus.innerHTML = '<span class="icon icon-inline" aria-hidden="true">cancel</span> Not saved';
            julesKeyStatus.style.color = 'var(--muted)';
          }
          resetBtn.innerHTML = originalResetLabel;
          resetBtn.disabled = false;
          
          if (addBtn) addBtn.style.display = 'block';
          if (dangerZoneSection) dangerZoneSection.style.display = 'none';
          if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';
          
          showToast('Jules API key has been deleted. You can enter a new one next time.', 'success');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        showToast('Failed to reset API key: ' + error.message, 'error');
        resetBtn.innerHTML = originalResetLabel;
        resetBtn.disabled = false;
      }
    };
  }

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      // Clear cache to force fresh data load
      clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);
      
      await loadAndDisplayJulesProfile(user.uid);
      attachViewAllSessionsHandler();
      attachViewQueueHandler();
    };
  }

  attachViewAllSessionsHandler();
  attachViewQueueHandler();
}

export async function loadJulesAccountInfo(user) {
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');

  // Check if user has Jules API key
  const hasKey = await checkJulesKey(user.uid);
  
  if (!hasKey) {
    if (julesProfileInfoSection) {
      julesProfileInfoSection.style.display = 'none';
    }
    return;
  }

  if (julesProfileInfoSection) {
    julesProfileInfoSection.style.display = 'block';
  }

  await loadAndDisplayJulesProfile(user.uid);

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      // Clear cache to force fresh data load
      clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);
      
      await loadAndDisplayJulesProfile(user.uid);
      attachViewAllSessionsHandler();
      attachViewQueueHandler();
    };
  }

  attachViewAllSessionsHandler();
  attachViewQueueHandler();
}
