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
import { createElement, clearElement } from '../utils/dom-helpers.js';

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
      clearElement(julesKeyStatus);
      if (hasKey) {
          julesKeyStatus.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'check_circle'));
          julesKeyStatus.appendChild(document.createTextNode(' Saved'));
      } else {
          julesKeyStatus.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'cancel'));
          julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
      }
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
        clearElement(resetBtn);
        resetBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'hourglass_top'));
        resetBtn.appendChild(document.createTextNode(' Deleting...'));

        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            clearElement(julesKeyStatus);
            julesKeyStatus.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'cancel'));
            julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
            julesKeyStatus.style.color = 'var(--muted)';
          }
          clearElement(resetBtn);
          resetBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'delete'));
          resetBtn.appendChild(document.createTextNode(' Delete Jules API Key'));
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
        clearElement(resetBtn);
        resetBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'refresh'));
        resetBtn.appendChild(document.createTextNode(' Reset Jules API Key'));
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
      clearElement(sourcesListDiv);
      sourcesListDiv.appendChild(createElement('div', { style: { color: 'var(--muted)', fontSize: '13px' } }, 'Loading sources...'));
      clearElement(sessionsListDiv);
      sessionsListDiv.appendChild(createElement('div', { style: { color: 'var(--muted)', fontSize: '13px' } }, 'Loading sessions...'));
      
      profileData = await loadJulesProfileInfo(uid);
      setCache(CACHE_KEYS.JULES_ACCOUNT, profileData, uid);
    }

    clearElement(sourcesListDiv);
    if (profileData.sources && profileData.sources.length > 0) {
      const vList = createElement('div', { className: 'vlist' });
      profileData.sources.forEach((source, index) => {
        const repoName = source.githubRepo?.name || source.name || source.id;
        const githubPath = repoName.includes('github/')
          ? repoName.split('github/')[1]
          : repoName.replace('sources/', '');
        const branches = source.githubRepo?.branches || [];
        const sourceId = `source-${index}`;
        const branchesId = `${sourceId}-branches`;
        const arrowId = `${sourceId}-arrow`;

        const branchSummaryText = branches.length > 0
          ? `(${branches.length} ${branches.length === 1 ? 'branch' : 'branches'})`
          : '(no branches)';

        const card = createElement('div', { className: 'queue-card' });
        const row = createElement('div', { className: 'queue-row' });
        const content = createElement('div', { className: 'queue-content' });

        const titleDiv = createElement('div', {
          className: 'queue-title',
          style: { cursor: 'pointer', userSelect: 'none' },
          onClick: () => {
            const el = document.getElementById(branchesId);
            const arrow = document.getElementById(arrowId);
            if (el && arrow) {
                if (el.style.display === 'none') { el.style.display = 'block'; arrow.textContent = '▼'; }
                else { el.style.display = 'none'; arrow.textContent = '▶'; }
            }
          }
        });

        titleDiv.appendChild(createElement('span', { id: arrowId, style: { display: 'inline-block', width: '12px', fontSize: '10px', marginRight: '6px' } }, '▶'));
        titleDiv.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'folder'));
        titleDiv.appendChild(document.createTextNode(` ${githubPath} `));
        titleDiv.appendChild(createElement('span', { className: 'queue-status' }, branchSummaryText));

        content.appendChild(titleDiv);
        row.appendChild(content);
        card.appendChild(row);

        const branchesDiv = createElement('div', {
            id: branchesId,
            style: { display: 'none', marginTop: '6px', paddingLeft: '10px', fontSize: '11px', color: 'var(--muted)' }
        });

        if (branches.length > 0) {
            const header = createElement('div', { style: { marginBottom: '4px', color: 'var(--text)' } }, [
                createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'account_tree'),
                ` Branches (${branches.length}):`
            ]);
            branchesDiv.appendChild(header);

            branches.forEach(b => {
                const bDiv = createElement('div', {
                    style: { padding: '3px 0 3px 8px', cursor: 'pointer' },
                    onClick: () => window.open(`https://github.com/${githubPath}/tree/${encodeURIComponent(b.displayName || b.name)}`, '_blank')
                }, `• ${b.displayName || b.name}`);
                branchesDiv.appendChild(bDiv);
            });
        } else {
            branchesDiv.style.fontStyle = 'italic';
            branchesDiv.textContent = 'No branches found';
        }
        card.appendChild(branchesDiv);

        vList.appendChild(card);
      });
      sourcesListDiv.appendChild(vList);
    } else {
        const empty = createElement('div', { style: { color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '16px' } });
        empty.appendChild(document.createTextNode('No connected repositories found.'));
        empty.appendChild(createElement('br'));
        empty.appendChild(createElement('small', {}, 'Connect repos in the Jules UI.'));
        sourcesListDiv.appendChild(empty);
    }

    clearElement(sessionsListDiv);
    if (profileData.sessions && profileData.sessions.length > 0) {
      const vList = createElement('div', { className: 'vlist' });
      profileData.sessions.forEach(session => {
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
        const createdAt = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
        const prUrl = session.outputs?.[0]?.pullRequest?.url;
        const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
        const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
        const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');

        const card = createElement('div', {
            className: 'session-card',
            onClick: () => window.open(sessionUrl, '_blank', 'noopener')
        });

        card.appendChild(createElement('div', { className: 'session-meta' }, createdAt));
        card.appendChild(createElement('div', { className: 'session-prompt' }, displayPrompt));

        const row = createElement('div', { className: 'session-row' });

        const pill = createElement('span', { className: 'session-pill' }, [
            createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, stateIcon),
            ` ${stateLabel}`
        ]);
        row.appendChild(pill);

        if (prUrl) {
            const link = createElement('a', {
                href: prUrl,
                target: '_blank',
                rel: 'noopener',
                className: 'small-text',
                onClick: (e) => e.stopPropagation()
            }, [
                createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'link'),
                ' View PR'
            ]);
            row.appendChild(link);
        }

        const hint = createElement('span', { className: 'session-hint' }, [
            createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'info'),
            ' Click to view session'
        ]);
        row.appendChild(hint);

        const viewBtn = createElement('button', {
            className: 'btn-icon session-view-btn',
            title: 'View full prompt',
            onClick: (e) => {
                e.stopPropagation();
                if (window[`viewPrompt_${cleanId}`]) window[`viewPrompt_${cleanId}`]();
            }
        }, [ createElement('span', { className: 'icon', 'aria-hidden': 'true' }, 'visibility') ]);
        row.appendChild(viewBtn);

        card.appendChild(row);
        vList.appendChild(card);
      });
      
      // Attach prompt viewer handlers using shared module
      attachPromptViewerHandlers(profileData.sessions);
      
      sessionsListDiv.appendChild(vList);
    } else {
      sessionsListDiv.appendChild(createElement('div', { style: { color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '16px' } }, 'No recent sessions found.'));
    }

    loadBtn.disabled = false;
    clearElement(loadBtn);
    loadBtn.appendChild(createElement('span', { className: 'icon', 'aria-hidden': 'true' }, 'sync'));
    
    attachViewAllSessionsHandler();

  } catch (error) {
    clearElement(sourcesListDiv);
    sourcesListDiv.appendChild(createElement('div', { style: { color: '#e74c3c', fontSize: '13px', textAlign: 'center', padding: '16px' } }, `Failed to load sources: ${error.message}`));

    clearElement(sessionsListDiv);
    sessionsListDiv.appendChild(createElement('div', { style: { color: '#e74c3c', fontSize: '13px', textAlign: 'center', padding: '16px' } }, `Failed to load sessions: ${error.message}`));

    loadBtn.disabled = false;
    clearElement(loadBtn);
    loadBtn.appendChild(createElement('span', { className: 'icon', 'aria-hidden': 'true' }, 'sync'));
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
      clearElement(allSessionsList);
      allSessionsList.appendChild(createElement('div', { style: { color: 'var(--muted)', textAlign: 'center', padding: '24px' } }, 'No sessions found'));
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      clearElement(allSessionsList);
      allSessionsList.appendChild(createElement('div', { style: { color: '#e74c3c', textAlign: 'center', padding: '24px' } }, `Failed to load sessions: ${error.message}`));
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
  
  clearElement(allSessionsList);
  if (filteredSessions.length === 0) {
    allSessionsList.appendChild(createElement('div', { style: { color: 'var(--muted)', textAlign: 'center', padding: '24px' } }, 'No sessions match your search'));
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
  
  filteredSessions.forEach(session => {
    if (session.parentTask) return;
    
    const sessionId = session.name?.split('/').pop() || '';
    const state = session.state || 'UNKNOWN';
    const icon = stateIcons[state] || 'help';
    const label = stateLabel[state] || state.replace(/_/g, ' ');
    
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    const subtaskCount = session.childTasks?.length || 0;

    const item = createElement('div', {
        style: { padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.2s' },
        onMouseOver: (e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; },
        onMouseOut: (e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; },
        onClick: () => window.open(`https://jules.google.com/session/${sessionId}`, '_blank')
    });

    const header = createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' } }, [
        createElement('div', { style: { fontWeight: '600', fontSize: '13px', flex: '1', marginRight: '8px' } }, displayTitle),
        createElement('div', { style: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', whiteSpace: 'nowrap', marginLeft: '8px', display: 'flex', alignItems: 'center' } }, [
            createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, icon),
            ` ${label}`
        ])
    ]);
    item.appendChild(header);

    item.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' } }, `Created: ${createTime}`));
    item.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--muted)' } }, `Updated: ${updateTime}`));
    
    if (subtaskCount > 0) {
        item.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--muted)', marginTop: '4px' } }, [
            createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'list_alt'),
            ` ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}`
        ]));
    }

    if (prUrl) {
        const prLink = createElement('div', { style: { marginTop: '4px' }, onClick: (e) => e.stopPropagation() }, [
            createElement('a', { href: prUrl, target: '_blank', style: { fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' } }, [
                createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'link'),
                ' View PR'
            ])
        ]);
        item.appendChild(prLink);
    }

    allSessionsList.appendChild(item);
  });
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
    clearElement(julesKeyStatus);
    if (hasKey) {
        julesKeyStatus.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'check_circle'));
        julesKeyStatus.appendChild(document.createTextNode(' Saved'));
    } else {
        julesKeyStatus.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'cancel'));
        julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
    }
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
    // We assume resetBtn has initial content. We can reconstruct it or clone it.
    const originalResetNodes = Array.from(resetBtn.childNodes).map(n => n.cloneNode(true));
    resetBtn.onclick = async () => {
      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        resetBtn.disabled = true;
        clearElement(resetBtn);
        resetBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'hourglass_top'));
        resetBtn.appendChild(document.createTextNode(' Deleting...'));

        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            clearElement(julesKeyStatus);
            julesKeyStatus.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'cancel'));
            julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
            julesKeyStatus.style.color = 'var(--muted)';
          }
          clearElement(resetBtn);
          originalResetNodes.forEach(n => resetBtn.appendChild(n.cloneNode(true)));
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
        clearElement(resetBtn);
        originalResetNodes.forEach(n => resetBtn.appendChild(n.cloneNode(true)));
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
