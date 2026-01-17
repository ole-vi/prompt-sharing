import { waitForFirebase } from '../shared-init.js';
import { listJulesSessions, getDecryptedJulesKey } from '../modules/jules-api.js';
import { attachPromptViewerHandlers } from '../modules/prompt-viewer.js';
import { createElement, createIcon } from '../utils/dom-helpers.js';

let allSessionsCache = [];
let sessionNextPageToken = null;
let isSessionsLoading = false;
let cachedSessions = null;
let cachedSearchData = null;
let cachedFuseInstance = null;

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
      allSessionsList.replaceChildren(createElement('div', 'muted text-center pad-lg', 'No sessions found'));
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      allSessionsList.replaceChildren(createElement('div', 'text-center pad-lg', `Failed to load sessions: ${error.message}`));
      allSessionsList.firstChild.style.color = '#e74c3c';
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
    if (cachedSessions !== sessions) {
      cachedSessions = sessions;
      cachedSearchData = sessions.map(s => ({
        ...s,
        promptText: s.prompt || s.displayName || '',
        sessionId: s.name?.split('/').pop() || ''
      }));
      cachedFuseInstance = new Fuse(cachedSearchData, {
        keys: ['promptText', 'sessionId'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    filteredSessions = cachedFuseInstance.search(searchTerm).map(result => result.item);
  }
  
  if (filteredSessions.length === 0 && searchTerm) {
      allSessionsList.replaceChildren(createElement('div', '', 'No sessions match your search'));
      allSessionsList.firstChild.style.cssText = 'color:var(--muted); text-align:center; padding:24px;';
    return;
  }
  
  const fragment = document.createDocumentFragment();

  filteredSessions.forEach(session => {
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
    const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');

    const card = createElement('div', 'session-card');
    card.onclick = () => window.open(sessionUrl, '_blank', 'noopener');

    const metaDiv = createElement('div', 'session-meta', createdAt);
    const promptDiv = createElement('div', 'session-prompt', displayPrompt);
    const rowDiv = createElement('div', 'session-row');

    const pill = createElement('span', 'session-pill');
    pill.appendChild(createIcon(stateIconName, 'icon icon-inline'));
    pill.appendChild(document.createTextNode(` ${stateLabel}`));
    rowDiv.appendChild(pill);

    if (prUrl) {
        const prLink = createElement('a', 'small-text', ' View PR');
        prLink.href = prUrl;
        prLink.target = '_blank';
        prLink.rel = 'noopener';
        prLink.onclick = (e) => e.stopPropagation();
        prLink.prepend(createIcon('link', 'icon icon-inline'));

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

    fragment.appendChild(card);
  });
  
  allSessionsList.replaceChildren(fragment);
  attachPromptViewerHandlers(filteredSessions);
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
    
    const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadSessionsPage);
    }

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
