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
import { TIMEOUTS } from '../utils/constants.js';
import { createElement, createIconElement, clearElement } from '../utils/dom-helpers.js';

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
        julesKeyStatus.appendChild(createIconElement('check_circle'));
        julesKeyStatus.appendChild(document.createTextNode(' Saved'));
        julesKeyStatus.style.color = 'var(--accent)';
      } else {
        julesKeyStatus.appendChild(createIconElement('cancel'));
        julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
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
        setTimeout(() => showUserProfileModal(), TIMEOUTS.uiDelay);
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
        resetBtn.appendChild(createIconElement('hourglass_top'));
        resetBtn.appendChild(document.createTextNode(' Deleting...'));

        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            clearElement(julesKeyStatus);
            julesKeyStatus.appendChild(createIconElement('cancel'));
            julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
            julesKeyStatus.style.color = 'var(--muted)';
          }

          clearElement(resetBtn);
          resetBtn.appendChild(createIconElement('delete'));
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
        resetBtn.appendChild(createIconElement('refresh'));
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

    // Render Sources
    clearElement(sourcesListDiv);
    if (profileData.sources && profileData.sources.length > 0) {
      const vList = createElement('div', { class: 'vlist' });

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

        // Build branch list
        let branchesEl;
        if (branches.length > 0) {
          branchesEl = createElement('div', {
            id: `${sourceId}-branches`,
            style: { display: 'none', marginTop: '6px', paddingLeft: '10px', fontSize: '11px', color: 'var(--muted)' }
          });

          const branchesHeader = createElement('div', { style: { marginBottom: '4px', color: 'var(--text)' } });
          branchesHeader.appendChild(createIconElement('account_tree'));
          branchesHeader.appendChild(document.createTextNode(` Branches (${branches.length}):`));
          branchesEl.appendChild(branchesHeader);

          branches.forEach(b => {
            const branchItem = createElement('div', {
              style: { padding: '3px 0 3px 8px', cursor: 'pointer' },
              onclick: () => window.open(`https://github.com/${githubPath}/tree/${encodeURIComponent(b.displayName || b.name)}`, '_blank')
            }, `• ${b.displayName || b.name}`);
            branchesEl.appendChild(branchItem);
          });
        } else {
          branchesEl = createElement('div', {
            id: `${sourceId}-branches`,
            style: { display: 'none', marginTop: '6px', paddingLeft: '10px', fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }
          }, 'No branches found');
        }

        // Build Card
        const card = createElement('div', { class: 'queue-card' });
        const row = createElement('div', { class: 'queue-row' });
        const content = createElement('div', { class: 'queue-content' });

        const title = createElement('div', {
          class: 'queue-title',
          style: { cursor: 'pointer', userSelect: 'none' },
          onclick: function() {
            const el = document.getElementById(`${sourceId}-branches`);
            const arrow = document.getElementById(`${sourceId}-arrow`);
            if (el.style.display === 'none') {
              el.style.display = 'block';
              arrow.textContent = '▼';
            } else {
              el.style.display = 'none';
              arrow.textContent = '▶';
            }
          }
        });

        const arrow = createElement('span', {
          id: `${sourceId}-arrow`,
          style: { display: 'inline-block', width: '12px', fontSize: '10px', marginRight: '6px' }
        }, '▶');

        title.appendChild(arrow);
        title.appendChild(createIconElement('folder'));
        title.appendChild(document.createTextNode(` ${githubPath} `));
        title.appendChild(createElement('span', { class: 'queue-status' }, branchSummaryText));

        content.appendChild(title);
        row.appendChild(content);
        card.appendChild(row);
        card.appendChild(branchesEl);

        vList.appendChild(card);
      });
      sourcesListDiv.appendChild(vList);
    } else {
      const emptyDiv = createElement('div', { style: { color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '16px' } });
      emptyDiv.appendChild(document.createTextNode('No connected repositories found.'));
      emptyDiv.appendChild(document.createElement('br'));
      emptyDiv.appendChild(createElement('small', {}, 'Connect repos in the Jules UI.'));
      sourcesListDiv.appendChild(emptyDiv);
    }

    // Render Sessions
    clearElement(sessionsListDiv);
    if (profileData.sessions && profileData.sessions.length > 0) {
      const vList = createElement('div', { class: 'vlist' });

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
          class: 'session-card',
          onclick: () => window.open(sessionUrl, '_blank', 'noopener')
        });

        card.appendChild(createElement('div', { class: 'session-meta' }, createdAt));
        card.appendChild(createElement('div', { class: 'session-prompt' }, displayPrompt));

        const row = createElement('div', { class: 'session-row' });

        const pill = createElement('span', { class: 'session-pill' });
        pill.appendChild(createIconElement(stateIcon));
        pill.appendChild(document.createTextNode(` ${stateLabel}`));
        row.appendChild(pill);

        if (prUrl) {
          const prLink = createElement('a', {
            href: prUrl,
            target: '_blank',
            rel: 'noopener',
            class: 'small-text',
            onclick: (e) => e.stopPropagation()
          });
          prLink.appendChild(createIconElement('link'));
          prLink.appendChild(document.createTextNode(' View PR'));
          row.appendChild(document.createTextNode(' '));
          row.appendChild(prLink);
        }

        const hint = createElement('span', { class: 'session-hint' });
        hint.appendChild(createIconElement('info'));
        hint.appendChild(document.createTextNode(' Click to view session'));
        row.appendChild(hint);

        const viewBtn = createElement('button', {
          class: 'btn-icon session-view-btn',
          title: 'View full prompt',
          onclick: (e) => {
            e.stopPropagation();
            if (window[`viewPrompt_${cleanId}`]) {
              window[`viewPrompt_${cleanId}`]();
            }
          }
        });
        viewBtn.appendChild(createIconElement('visibility', 'icon'));
        row.appendChild(viewBtn);

        card.appendChild(row);
        vList.appendChild(card);
      });
      
      // Attach prompt viewer handlers using shared module
      attachPromptViewerHandlers(profileData.sessions);
      
      sessionsListDiv.appendChild(vList);
    } else {
      sessionsListDiv.appendChild(createElement('div', {
        style: { color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }
      }, 'No recent sessions found.'));
    }

    loadBtn.disabled = false;
    clearElement(loadBtn);
    loadBtn.appendChild(createIconElement('sync', 'icon'));
    
    attachViewAllSessionsHandler();

  } catch (error) {
    clearElement(sourcesListDiv);
    sourcesListDiv.appendChild(createElement('div', {
      style: { color: '#e74c3c', fontSize: '13px', textAlign: 'center', padding: '16px' }
    }, `Failed to load sources: ${error.message}`));

    clearElement(sessionsListDiv);
    sessionsListDiv.appendChild(createElement('div', {
      style: { color: '#e74c3c', fontSize: '13px', textAlign: 'center', padding: '16px' }
    }, `Failed to load sessions: ${error.message}`));

    loadBtn.disabled = false;
    clearElement(loadBtn);
    loadBtn.appendChild(createIconElement('sync', 'icon'));
  }
}

function renderAllSessions(sessions) {
  const allSessionsList = document.getElementById('allSessionsList');
  const searchInput = document.getElementById('sessionSearchInput');
  const searchTerm = searchInput.value.toLowerCase();
  
  clearElement(allSessionsList);

  const filteredSessions = searchTerm 
    ? sessions.filter(s => {
        const promptText = s.prompt || s.displayName || '';
        const sessionId = s.name?.split('/').pop() || '';
        return promptText.toLowerCase().includes(searchTerm) || sessionId.toLowerCase().includes(searchTerm);
      })
    : sessions;
  
  if (filteredSessions.length === 0) {
    allSessionsList.appendChild(createElement('div', {
      style: { color: 'var(--muted)', textAlign: 'center', padding: '24px' }
    }, 'No sessions match your search'));
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

    const card = createElement('div', {
      style: {
        padding: '12px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: '8px' // Added some spacing between items
      },
      onmouseover: function() {
        this.style.borderColor = 'var(--accent)';
        this.style.background = 'rgba(255,255,255,0.06)';
      },
      onmouseout: function() {
        this.style.borderColor = 'var(--border)';
        this.style.background = 'rgba(255,255,255,0.03)';
      },
      onclick: () => window.open(`https://jules.google.com/session/${sessionId}`, '_blank')
    });

    // Header
    const header = createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' } });
    header.appendChild(createElement('div', { style: { fontWeight: '600', fontSize: '13px', flex: '1', marginRight: '8px' } }, displayTitle));
    
    const statusPill = createElement('div', {
      style: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', whiteSpace: 'nowrap', marginLeft: '8px', display: 'flex', alignItems: 'center' }
    });
    statusPill.appendChild(createIconElement(icon));
    statusPill.appendChild(document.createTextNode(` ${label}`));
    header.appendChild(statusPill);
    card.appendChild(header);

    // Meta
    card.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' } }, `Created: ${createTime}`));
    card.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--muted)' } }, `Updated: ${updateTime}`));

    // Subtasks
    if (subtaskCount > 0) {
      const subtaskInfo = createElement('div', { style: { fontSize: '11px', color: 'var(--muted)', marginTop: '4px' } });
      subtaskInfo.appendChild(createIconElement('list_alt'));
      subtaskInfo.appendChild(document.createTextNode(` ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}`));
      card.appendChild(subtaskInfo);
    }

    // PR Link
    if (prUrl) {
      const prLinkDiv = createElement('div', { style: { marginTop: '4px' }, onclick: (e) => e.stopPropagation() });
      const link = createElement('a', { href: prUrl, target: '_blank', style: { fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' } });
      link.appendChild(createIconElement('link'));
      link.appendChild(document.createTextNode(' View PR'));
      prLinkDiv.appendChild(link);
      card.appendChild(prLinkDiv);
    }

    allSessionsList.appendChild(card);
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
      julesKeyStatus.appendChild(createIconElement('check_circle'));
      julesKeyStatus.appendChild(document.createTextNode(' Saved'));
      julesKeyStatus.style.color = 'var(--accent)';
    } else {
      julesKeyStatus.appendChild(createIconElement('cancel'));
      julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
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
        setTimeout(() => loadProfileDirectly(user), TIMEOUTS.uiDelay);
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
        clearElement(resetBtn);
        resetBtn.appendChild(createIconElement('hourglass_top'));
        resetBtn.appendChild(document.createTextNode(' Deleting...'));

        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            clearElement(julesKeyStatus);
            julesKeyStatus.appendChild(createIconElement('cancel'));
            julesKeyStatus.appendChild(document.createTextNode(' Not saved'));
            julesKeyStatus.style.color = 'var(--muted)';
          }

          clearElement(resetBtn);
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
