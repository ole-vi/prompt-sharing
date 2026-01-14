// ===== Jules Profile Modal Module =====
// Profile modal and sessions history functionality

import { checkJulesKey, deleteStoredJulesKey } from './jules-keys.js';
import { showJulesKeyModal } from './jules-modal.js';
import { showJulesQueueModal } from './jules-queue.js';
import { loadJulesProfileInfo, listJulesSessions, getDecryptedJulesKey } from './jules-api.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';

let allSessionsCache = [];
let sessionNextPageToken = null;

export function showUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  const user = window.auth?.currentUser;

  if (!user) {
    alert('Not logged in.');
    return;
  }

  modal.setAttribute('style', 'display: flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');

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
      julesKeyStatus.textContent = hasKey ? '✓ Saved' : '✗ Not saved';
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
      if (!confirm('This will delete your stored Jules API key. You\'ll need to enter a new one next time.')) {
        return;
      }
      try {
        resetBtn.disabled = true;
        resetBtn.textContent = 'Deleting...';
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            julesKeyStatus.textContent = '✗ Not saved';
            julesKeyStatus.style.color = 'var(--muted)';
          }
          resetBtn.textContent = '🗑️ Delete Jules API Key';
          resetBtn.disabled = false;
          
          if (addBtn) addBtn.style.display = 'block';
          if (dangerZoneSection) dangerZoneSection.style.display = 'none';
          if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';
          
          alert('Jules API key has been deleted. You can enter a new one next time.');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        alert('Failed to reset API key: ' + error.message);
        resetBtn.textContent = '🔄 Reset Jules API Key';
        resetBtn.disabled = false;
      }
    };
  }

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
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

async function loadAndDisplayJulesProfile(uid) {
  const loadBtn = document.getElementById('loadJulesInfoBtn');
  const sourcesListDiv = document.getElementById('julesSourcesList');
  const sessionsListDiv = document.getElementById('julesSessionsList');

  try {
    loadBtn.disabled = true;
    loadBtn.textContent = '⏳ Loading...';
    
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
        const branches = source.branches || [];
        const sourceId = `source-${index}`;

        const branchSummaryText = branches.length > 0
          ? `(${branches.length} ${branches.length === 1 ? 'branch' : 'branches'})`
          : '(no branches)';

        const branchesHtml = branches.length > 0
          ? `<div id="${sourceId}-branches" style="display:none; margin-top:6px; padding-left:10px; font-size:11px; color:var(--muted);">
               <div style="margin-bottom:4px; color:var(--text);">🌿 Branches (${branches.length}):</div>
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
                  📂 ${githubPath}
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
        const stateEmoji = {
          'COMPLETED': '✅',
          'FAILED': '❌',
          'IN_PROGRESS': '⏳',
          'PLANNING': '⏳',
          'QUEUED': '⏸️',
          'AWAITING_USER_FEEDBACK': '💬'
        }[state] || '❓';

        const stateLabel = {
          'COMPLETED': 'COMPLETED',
          'FAILED': 'FAILED',
          'IN_PROGRESS': 'IN PROGRESS',
          'PLANNING': 'IN PROGRESS',
          'QUEUED': 'QUEUED',
          'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK'
        }[state] || state.replace(/_/g, ' ');

        const promptPreview = (session.prompt || 'No prompt text').substring(0, 80);
        const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
        const createdAt = session.createTime ? new Date(session.createTime).toLocaleDateString() : 'Unknown';
        const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
        const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';

        const cardHtml = `
          <div class="session-card" onclick="window.open('${sessionUrl}', '_blank', 'noopener')">
            <div class="session-row">
              <div class="session-pill">${stateEmoji} ${stateLabel}</div>
              <div class="session-hint">Created: ${createdAt}</div>
            </div>
            <div class="session-prompt">${displayPrompt}</div>
          </div>
        `;
        return cardHtml;
      }).join('');
      sessionsListDiv.innerHTML = `<div class="vlist">${sessionsHtml}</div>`;
    } else {
      sessionsListDiv.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">No recent sessions found.</div>';
    }

    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
    
    attachViewAllSessionsHandler();

  } catch (error) {
    sourcesListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sources: ${error.message}
    </div>`;
    sessionsListDiv.innerHTML = `<div style="color:#e74c3c; font-size:13px; text-align:center; padding:16px;">
      Failed to load sessions: ${error.message}
    </div>`;

    loadBtn.disabled = false;
    loadBtn.textContent = '🔄 Refresh Jules Info';
  }
}

export function hideUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  modal.setAttribute('style', 'display: none !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:1001; flex-direction:column; align-items:center; justify-content:center; overflow-y:auto; padding:20px;');
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
  
  const stateEmoji = {
    'PLANNING': '📝',
    'IN_PROGRESS': '⚙️',
    'AWAITING_USER_FEEDBACK': '💬',
    'COMPLETED': '✅',
    'FAILED': '❌',
    'CANCELLED': '🚫'
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
    const emoji = stateEmoji[state] || '❓';
    const label = stateLabel[state] || state.replace(/_/g, ' ');
    
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    const prLink = prUrl 
      ? `<div style="margin-top:4px;" onclick="event.stopPropagation();"><a href="${prUrl}" target="_blank" style="font-size:11px; color:var(--accent); text-decoration:none;">🔗 View PR</a></div>`
      : '';
    
    const subtaskCount = session.childTasks?.length || 0;
    const subtaskInfo = subtaskCount > 0 
      ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;">📋 ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}</div>`
      : '';
    
    return `<div style="padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;"
                 onmouseover="this.style.borderColor='var(--accent)'; this.style.background='rgba(255,255,255,0.06)'"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.background='rgba(255,255,255,0.03)'"
                 onclick="window.open('https://jules.google.com/session/${sessionId}', '_blank')">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;">
        <div style="font-weight:600; font-size:13px; flex:1; margin-right:8px;">${displayTitle}</div>
        <div style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1); white-space:nowrap; margin-left:8px;">
          ${emoji} ${label}
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
    julesKeyStatus.textContent = hasKey ? '✓ Saved' : '✗ Not saved';
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
    resetBtn.onclick = async () => {
      if (!confirm('This will delete your stored Jules API key. You\'ll need to enter a new one next time.')) {
        return;
      }
      try {
        resetBtn.disabled = true;
        resetBtn.textContent = 'Deleting...';
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            julesKeyStatus.textContent = '✗ Not saved';
            julesKeyStatus.style.color = 'var(--muted)';
          }
          resetBtn.textContent = '🗑️ Delete Jules API Key';
          resetBtn.disabled = false;
          
          if (addBtn) addBtn.style.display = 'block';
          if (dangerZoneSection) dangerZoneSection.style.display = 'none';
          if (julesProfileInfoSection) julesProfileInfoSection.style.display = 'none';
          
          alert('Jules API key has been deleted. You can enter a new one next time.');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        alert('Failed to reset API key: ' + error.message);
        resetBtn.textContent = '🗑️ Delete Jules API Key';
        resetBtn.disabled = false;
      }
    };
  }

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
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
      await loadAndDisplayJulesProfile(user.uid);
      attachViewAllSessionsHandler();
      attachViewQueueHandler();
    };
  }

  attachViewAllSessionsHandler();
  attachViewQueueHandler();
}
