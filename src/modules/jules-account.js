// ===== Jules Profile Modal Module =====
// Profile modal and sessions history functionality

import { checkJulesKey, deleteStoredJulesKey } from './jules-keys.js';
import { showJulesKeyModal } from './jules-modal.js';
import { showJulesQueueModal } from './jules-queue.js';
import { loadJulesProfileInfo, listJulesSessions, getDecryptedJulesKey } from './jules-api.js';
import { getCache, setCache, clearCache, CACHE_KEYS } from '../utils/session-cache.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { attachPromptViewerHandlers } from './prompt-viewer.js';
import { createElement, createIcon } from '../utils/dom-helpers.js';

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
      if (hasKey) {
          julesKeyStatus.replaceChildren(
            createIcon('check_circle', 'icon icon-inline'),
            document.createTextNode(' Saved')
          );
          julesKeyStatus.style.color = 'var(--accent)';
      } else {
          julesKeyStatus.replaceChildren(
            createIcon('cancel', 'icon icon-inline'),
            document.createTextNode(' Not saved')
          );
          julesKeyStatus.style.color = 'var(--muted)';
      }
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
        resetBtn.replaceChildren(
            createIcon('hourglass_top', 'icon icon-inline'),
            document.createTextNode(' Deleting...')
        );
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            julesKeyStatus.replaceChildren(
                createIcon('cancel', 'icon icon-inline'),
                document.createTextNode(' Not saved')
            );
            julesKeyStatus.style.color = 'var(--muted)';
          }
          resetBtn.replaceChildren(
              createIcon('delete', 'icon icon-inline'),
              document.createTextNode(' Delete Jules API Key')
          );
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
        resetBtn.replaceChildren(
            createIcon('refresh', 'icon icon-inline'),
            document.createTextNode(' Reset Jules API Key')
        );
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

async function loadAndDisplayJulesProfile(uid) {
  const loadBtn = document.getElementById('loadJulesInfoBtn');
  const sourcesListDiv = document.getElementById('julesSourcesList');
  const sessionsListDiv = document.getElementById('julesSessionsList');

  try {
    loadBtn.disabled = true;
    
    // Check cache first
    let profileData = getCache(CACHE_KEYS.JULES_ACCOUNT, uid);
    
    if (!profileData) {
      sourcesListDiv.replaceChildren(createElement('div', '', 'Loading sources...'));
      sourcesListDiv.firstChild.style.cssText = 'color:var(--muted); font-size:13px;';

      sessionsListDiv.replaceChildren(createElement('div', '', 'Loading sessions...'));
      sessionsListDiv.firstChild.style.cssText = 'color:var(--muted); font-size:13px;';
      
      profileData = await loadJulesProfileInfo(uid);
      setCache(CACHE_KEYS.JULES_ACCOUNT, profileData, uid);
    }

    if (profileData.sources && profileData.sources.length > 0) {
      // Build VList manually using DOM elements
      const vList = createElement('div', 'vlist');

      profileData.sources.forEach((source, index) => {
        const repoName = source.githubRepo?.name || source.name || source.id;
        const githubPath = repoName.includes('github/')
          ? repoName.split('github/')[1]
          : repoName.replace('sources/', '');
        const branches = source.githubRepo?.branches || [];
        const sourceId = `source-${index}`;

        const branchSummaryText = branches.length > 0
          ? `(${branches.length} ${branches.length === 1 ? 'branch' : 'branches'})`
          : '(no branches)';

        // Card Container
        const card = createElement('div', 'queue-card');

        // Row
        const row = createElement('div', 'queue-row');
        const content = createElement('div', 'queue-content');
        const title = createElement('div', 'queue-title');
        title.style.cssText = 'cursor:pointer; user-select:none;';

        // Arrow
        const arrow = createElement('span', '', '▶');
        arrow.id = `${sourceId}-arrow`;
        arrow.style.cssText = 'display:inline-block; width:12px; font-size:10px; margin-right:6px;';

        // Folder Icon
        const folderIcon = createIcon('folder', 'icon icon-inline');

        // Status Text
        const statusSpan = createElement('span', 'queue-status', branchSummaryText);

        title.appendChild(arrow);
        title.appendChild(folderIcon);
        title.appendChild(document.createTextNode(` ${githubPath} `));
        title.appendChild(statusSpan);

        content.appendChild(title);
        row.appendChild(content);
        card.appendChild(row);

        // Branches Section
        const branchesDiv = createElement('div');
        branchesDiv.id = `${sourceId}-branches`;
        branchesDiv.style.cssText = 'display:none; margin-top:6px; padding-left:10px; font-size:11px; color:var(--muted);';

        if (branches.length > 0) {
          const branchesTitle = createElement('div');
          branchesTitle.style.cssText = 'margin-bottom:4px; color:var(--text);';
          branchesTitle.appendChild(createIcon('account_tree', 'icon icon-inline'));
          branchesTitle.appendChild(document.createTextNode(` Branches (${branches.length}):`));
          branchesDiv.appendChild(branchesTitle);

          branches.forEach(b => {
             const branchItem = createElement('div', '', `• ${b.displayName || b.name}`);
             branchItem.style.cssText = 'padding:3px 0 3px 8px; cursor:pointer;';
             branchItem.onclick = () => window.open(`https://github.com/${githubPath}/tree/${encodeURIComponent(b.displayName || b.name)}`, '_blank');
             branchesDiv.appendChild(branchItem);
          });
        } else {
            branchesDiv.style.fontStyle = 'italic';
            branchesDiv.textContent = 'No branches found';
        }

        card.appendChild(branchesDiv);

        // Toggle Handler
        title.onclick = () => {
            if (branchesDiv.style.display === 'none') {
                branchesDiv.style.display = 'block';
                arrow.textContent = '▼';
            } else {
                branchesDiv.style.display = 'none';
                arrow.textContent = '▶';
            }
        };

        vList.appendChild(card);
      });

      sourcesListDiv.replaceChildren(vList);
    } else {
      sourcesListDiv.replaceChildren(createElement('div', '', 'No connected repositories found.'));
      const small = createElement('small', '', 'Connect repos in the Jules UI.');
      sourcesListDiv.firstChild.appendChild(document.createElement('br'));
      sourcesListDiv.firstChild.appendChild(small);
      sourcesListDiv.firstChild.style.cssText = 'color:var(--muted); font-size:13px; text-align:center; padding:16px;';
    }

    if (profileData.sessions && profileData.sessions.length > 0) {
      const vList = createElement('div', 'vlist');

      profileData.sessions.forEach(session => {
        const state = session.state || 'UNKNOWN';
        const stateIconName = {
          'COMPLETED': 'check_circle',
          'FAILED': 'cancel',
          'IN_PROGRESS': 'schedule',
          'PLANNING': 'schedule',
          'QUEUED': 'pause_circle',
          'AWAITING_USER_FEEDBACK': 'chat_bubble'
        }[state] || 'help';

        const stateLabelText = {
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
        const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');

        const card = createElement('div', 'session-card');
        card.onclick = () => window.open(sessionUrl, '_blank', 'noopener');

        const metaDiv = createElement('div', 'session-meta', createdAt);
        const promptDiv = createElement('div', 'session-prompt', displayPrompt);
        const rowDiv = createElement('div', 'session-row');

        // State Pill
        const pill = createElement('span', 'session-pill');
        pill.appendChild(createIcon(stateIconName, 'icon icon-inline'));
        pill.appendChild(document.createTextNode(` ${stateLabelText}`));
        rowDiv.appendChild(pill);

        if (prUrl) {
            const prLink = createElement('a', 'small-text', ' View PR');
            prLink.href = prUrl;
            prLink.target = '_blank';
            prLink.rel = 'noopener';
            prLink.prepend(createIcon('link', 'icon icon-inline'));
            prLink.onclick = (e) => e.stopPropagation();
            rowDiv.appendChild(document.createTextNode(' '));
            rowDiv.appendChild(prLink);
        }

        const hint = createElement('span', 'session-hint', ' Click to view session');
        hint.prepend(createIcon('info', 'icon icon-inline'));
        rowDiv.appendChild(hint);

        const viewBtn = createElement('button', 'btn-icon session-view-btn');
        viewBtn.title = 'View full prompt';
        viewBtn.onclick = (e) => {
             e.stopPropagation();
             window[`viewPrompt_${cleanId}`]();
        };
        viewBtn.appendChild(createIcon('visibility'));
        rowDiv.appendChild(viewBtn);

        card.appendChild(metaDiv);
        card.appendChild(promptDiv);
        card.appendChild(rowDiv);
        vList.appendChild(card);
      });
      
      // Attach prompt viewer handlers using shared module
      attachPromptViewerHandlers(profileData.sessions);
      
      sessionsListDiv.replaceChildren(vList);
    } else {
        sessionsListDiv.replaceChildren(createElement('div', '', 'No recent sessions found.'));
        sessionsListDiv.firstChild.style.cssText = 'color:var(--muted); font-size:13px; text-align:center; padding:16px;';
    }

    loadBtn.disabled = false;
    loadBtn.replaceChildren(createIcon('sync'));
    
    attachViewAllSessionsHandler();

  } catch (error) {
    sourcesListDiv.replaceChildren(createElement('div', '', `Failed to load sources: ${error.message}`));
    sourcesListDiv.firstChild.style.cssText = 'color:#e74c3c; font-size:13px; text-align:center; padding:16px;';

    sessionsListDiv.replaceChildren(createElement('div', '', `Failed to load sessions: ${error.message}`));
    sessionsListDiv.firstChild.style.cssText = 'color:#e74c3c; font-size:13px; text-align:center; padding:16px;';

    loadBtn.disabled = false;
    loadBtn.replaceChildren(createIcon('sync'));
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
        allSessionsList.replaceChildren(createElement('div', '', 'No sessions found'));
        allSessionsList.firstChild.style.cssText = 'color:var(--muted); text-align:center; padding:24px;';
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
        allSessionsList.replaceChildren(createElement('div', '', `Failed to load sessions: ${error.message}`));
        allSessionsList.firstChild.style.cssText = 'color:#e74c3c; text-align:center; padding:24px;';
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
    allSessionsList.replaceChildren(createElement('div', '', 'No sessions match your search'));
    allSessionsList.firstChild.style.cssText = 'color:var(--muted); text-align:center; padding:24px;';
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
  
  const stateLabels = {
    'PLANNING': 'IN PROGRESS',
    'IN_PROGRESS': 'IN PROGRESS',
    'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK',
    'COMPLETED': 'COMPLETED',
    'FAILED': 'FAILED',
    'CANCELLED': 'CANCELLED'
  };

  const fragment = document.createDocumentFragment();
  
  filteredSessions.forEach(session => {
    if (session.parentTask) {
      return;
    }
    
    const sessionId = session.name?.split('/').pop() || '';
    const state = session.state || 'UNKNOWN';
    const iconName = stateIcons[state] || 'help';
    const labelText = stateLabels[state] || state.replace(/_/g, ' ');
    
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    
    const subtaskCount = session.childTasks?.length || 0;

    const card = createElement('div');
    card.style.cssText = 'padding:12px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;';
    card.onmouseover = () => { card.style.borderColor = 'var(--accent)'; card.style.background = 'rgba(255,255,255,0.06)'; };
    card.onmouseout = () => { card.style.borderColor = 'var(--border)'; card.style.background = 'rgba(255,255,255,0.03)'; };
    card.onclick = () => window.open(`https://jules.google.com/session/${sessionId}`, '_blank');

    const topRow = createElement('div');
    topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;';

    const titleDiv = createElement('div', '', displayTitle);
    titleDiv.style.cssText = 'font-weight:600; font-size:13px; flex:1; margin-right:8px;';

    const badgeDiv = createElement('div');
    badgeDiv.style.cssText = 'font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1); white-space:nowrap; margin-left:8px; display:flex; align-items:center;';
    badgeDiv.appendChild(createIcon(iconName, 'icon icon-inline'));
    badgeDiv.appendChild(document.createTextNode(' ' + labelText));

    topRow.appendChild(titleDiv);
    topRow.appendChild(badgeDiv);

    const createdDiv = createElement('div', '', `Created: ${createTime}`);
    createdDiv.style.cssText = 'font-size:11px; color:var(--muted); margin-bottom:2px;';

    const updatedDiv = createElement('div', '', `Updated: ${updateTime}`);
    updatedDiv.style.cssText = 'font-size:11px; color:var(--muted);';

    card.appendChild(topRow);
    card.appendChild(createdDiv);
    card.appendChild(updatedDiv);

    if (subtaskCount > 0) {
        const subtaskDiv = createElement('div');
        subtaskDiv.style.cssText = 'font-size:11px; color:var(--muted); margin-top:4px;';
        subtaskDiv.appendChild(createIcon('list_alt', 'icon icon-inline'));
        subtaskDiv.appendChild(document.createTextNode(` ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}`));
        card.appendChild(subtaskDiv);
    }

    if (prUrl) {
        const prDiv = createElement('div');
        prDiv.style.marginTop = '4px';
        prDiv.onclick = (e) => e.stopPropagation();

        const link = createElement('a', '', ' View PR');
        link.href = prUrl;
        link.target = '_blank';
        link.style.cssText = 'font-size:11px; color:var(--accent); text-decoration:none;';
        link.prepend(createIcon('link', 'icon icon-inline'));

        prDiv.appendChild(link);
        card.appendChild(prDiv);
    }
    
    fragment.appendChild(card);
  });

  allSessionsList.replaceChildren(fragment);
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
    if (hasKey) {
        julesKeyStatus.replaceChildren(
            createIcon('check_circle', 'icon icon-inline'),
            document.createTextNode(' Saved')
        );
        julesKeyStatus.style.color = 'var(--accent)';
    } else {
        julesKeyStatus.replaceChildren(
            createIcon('cancel', 'icon icon-inline'),
            document.createTextNode(' Not saved')
        );
        julesKeyStatus.style.color = 'var(--muted)';
    }
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
    const originalChildren = Array.from(resetBtn.childNodes).map(n => n.cloneNode(true));

    resetBtn.onclick = async () => {
      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        resetBtn.disabled = true;
        resetBtn.replaceChildren(
            createIcon('hourglass_top', 'icon icon-inline'),
            document.createTextNode(' Deleting...')
        );

        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            julesKeyStatus.replaceChildren(
                createIcon('cancel', 'icon icon-inline'),
                document.createTextNode(' Not saved')
            );
            julesKeyStatus.style.color = 'var(--muted)';
          }

          resetBtn.replaceChildren(...originalChildren);
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
        resetBtn.replaceChildren(...originalChildren);
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
