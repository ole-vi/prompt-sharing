/**
 * Sessions Page Initialization
 * Handles Jules sessions listing and search functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { listJulesSessions, getDecryptedJulesKey } from '../modules/jules-api.js';

let allSessionsCache = [];
let sessionNextPageToken = null;
let isSessionsLoading = false;

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, 50);
  }
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
        loadMoreSection.classList.remove('hidden');
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      } else {
        loadMoreSection.classList.add('hidden');
      }
    } else if (allSessionsCache.length === 0) {
      allSessionsList.innerHTML = '<div class="muted text-center pad-lg">No sessions found</div>';
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      allSessionsList.innerHTML = `<div class="text-center pad-lg" style="color:#e74c3c;">Failed to load sessions: ${error.message}</div>`;
    }
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More';
  }
}

function renderAllSessions(sessions) {
  const allSessionsList = document.getElementById('allSessionsList');
  const searchInput = document.getElementById('sessionSearchInput');
  const searchTerm = searchInput.value.trim();
  
  let filteredSessions = [];
  if (!searchTerm) {
    filteredSessions = sessions;
  } else {
    const sessionsWithSearchableFields = sessions.map(s => ({
      ...s,
      promptText: s.prompt || s.displayName || '',
      sessionId: s.name?.split('/').pop() || ''
    }));
    
    const fuse = new Fuse(sessionsWithSearchableFields, {
      keys: ['promptText', 'sessionId'],
      includeScore: true,
      threshold: 0.4,
    });
    filteredSessions = fuse.search(searchTerm).map(result => result.item);
  }
  
  if (filteredSessions.length === 0 && searchTerm) {
    allSessionsList.innerHTML = '<div style="color:var(--muted); text-align:center; padding:24px;">No sessions match your search</div>';
    return;
  }
  
  allSessionsList.innerHTML = filteredSessions.map(session => {
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
    
    const promptPreview = (session.prompt || 'No prompt text').substring(0, 150);
    const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
    const createdAt = session.createTime ? new Date(session.createTime).toLocaleDateString() : 'Unknown';
    const prUrl = session.outputs?.[0]?.pullRequest?.url;
    
    const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
    const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
    
    return `
      <div class="session-card" onclick="window.open('${sessionUrl}', '_blank', 'noopener')">
        <div class="session-meta">${createdAt}</div>
        <div class="session-prompt">${displayPrompt}</div>
        <div class="session-row" onclick="event.stopPropagation();">
          <span class="session-pill">${stateEmoji} ${stateLabel}</span>
          ${prUrl ? `<a href="${prUrl}" target="_blank" rel="noopener" class="small-text" style="color:var(--accent); text-decoration:none;">🔗 View PR</a>` : ''}
          <span class="session-hint">💡 Click to view session</span>
        </div>
      </div>
    `;
  }).join('');
}

async function loadSessions() {
  if (isSessionsLoading) return;
  const user = window.auth?.currentUser;
  
  const loadingDiv = document.getElementById('sessionsLoading');
  const notSignedInDiv = document.getElementById('sessionsNotSignedIn');
  const sessionsList = document.getElementById('allSessionsList');
  
  if (!user) {
    loadingDiv.classList.add('hidden');
    sessionsList.classList.add('hidden');
    notSignedInDiv.classList.remove('hidden');
    return;
  }

  try {
    isSessionsLoading = true;
    loadingDiv.classList.remove('hidden');
    notSignedInDiv.classList.add('hidden');
    sessionsList.classList.add('hidden');
    
    await loadSessionsPage();
    
    loadingDiv.classList.add('hidden');
    sessionsList.classList.remove('hidden');
  } catch (err) {
    console.error('Sessions loading error:', err);
    loadingDiv.classList.add('hidden');
  } finally {
    isSessionsLoading = false;
  }
}

async function initApp() {
  waitForFirebase(() => {
    loadSessions();
    
    // Set up search functionality with clear button
    const searchInput = document.getElementById('sessionSearchInput');
    const searchClear = document.getElementById('sessionSearchClear');
    if (searchInput) {
      const toggleClear = () => {
        if (searchClear) {
          if (searchInput.value) {
            searchClear.classList.remove('hidden');
          } else {
            searchClear.classList.add('hidden');
          }
        }
      };
      searchInput.addEventListener('input', () => { toggleClear(); renderAllSessions(allSessionsCache); });
      if (searchClear && !searchClear.dataset.bound) {
        searchClear.dataset.bound = 'true';
        searchClear.addEventListener('click', () => {
          searchInput.value = '';
          toggleClear();
          renderAllSessions(allSessionsCache);
          searchInput.focus();
        });
      }
      toggleClear();
    }
    
    // Set up load more button
    const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadSessionsPage);
    }

    // Refresh sessions when auth state changes (e.g., after sign-in)
    if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
      window.auth.onAuthStateChanged(() => {
        loadSessions();
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
