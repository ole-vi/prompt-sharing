import { waitForFirebase } from '../shared-init.js';
import { listJulesSessions, getDecryptedJulesKey } from '../modules/jules-api.js';
import { showPromptViewer } from '../modules/prompt-viewer.js';
import { debounce } from '../utils/debounce.js';
import { TIMEOUTS } from '../utils/constants.js';
import { loadFuse } from '../utils/lazy-loaders.js';
import { createElement, createIcon, clearElement } from '../utils/dom-helpers.js';

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
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
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
      
      await renderAllSessions(allSessionsCache);
      
      if (sessionNextPageToken) {
        loadMoreSection.classList.remove('hidden');
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      } else {
        loadMoreSection.classList.add('hidden');
      }
    } else if (allSessionsCache.length === 0) {
      clearElement(allSessionsList);
      const emptyDiv = createElement('div', 'muted text-center pad-lg', 'No sessions found');
      allSessionsList.appendChild(emptyDiv);
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      clearElement(allSessionsList);
      const errorDiv = createElement('div', 'text-center pad-lg error-text', `Failed to load sessions: ${error.message}`);
      allSessionsList.appendChild(errorDiv);
    }
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More';
  }
}

async function renderAllSessions(sessions) {
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
      cachedFuseInstance = null; // Clear old instance
    }
    if (!cachedFuseInstance) {
      const Fuse = await loadFuse(); // Lazy load only when searching
      cachedFuseInstance = new Fuse(cachedSearchData, {
        keys: ['promptText', 'sessionId'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    filteredSessions = cachedFuseInstance.search(searchTerm).map(result => result.item);
  }
  
  clearElement(allSessionsList);

  if (filteredSessions.length === 0 && searchTerm) {
    const noMatchDiv = createElement('div', 'muted text-center pad-lg', 'No sessions match your search');
    allSessionsList.appendChild(noMatchDiv);
    return;
  }
  
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
    const stateIcon = stateIcons[state] || 'help';
    
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
    card.addEventListener('click', () => {
      window.open(sessionUrl, '_blank', 'noopener');
    });

    const meta = createElement('div', 'session-meta', createdAt);
    const promptDiv = createElement('div', 'session-prompt', displayPrompt);

    const row = createElement('div', 'session-row');

    // Pill
    const pill = createElement('span', 'session-pill');
    const pillIcon = createIcon(stateIcon, 'icon-inline');
    pill.appendChild(pillIcon);
    pill.appendChild(document.createTextNode(' ' + stateLabel));
    row.appendChild(pill);

    // PR Link
    if (prUrl) {
      const prLink = createElement('a', 'small-text', ' View PR');
      prLink.href = prUrl;
      prLink.target = '_blank';
      prLink.rel = 'noopener';
      prLink.addEventListener('click', (e) => e.stopPropagation());
      const linkIcon = createIcon('link', 'icon-inline');
      prLink.prepend(linkIcon);
      row.appendChild(prLink);
    }

    // Hint
    const hint = createElement('span', 'session-hint');
    const hintIcon = createIcon('info', 'icon-inline');
    hint.appendChild(hintIcon);
    hint.appendChild(document.createTextNode(' Click to view session'));
    row.appendChild(hint);

    // View Button
    const viewBtn = createElement('button', 'btn-icon session-view-btn');
    viewBtn.title = 'View full prompt';
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showPromptViewer(session.prompt || 'No prompt text available', sessionId);
    });
    const viewIcon = createIcon('visibility');
    viewBtn.appendChild(viewIcon);
    row.appendChild(viewBtn);

    card.appendChild(meta);
    card.appendChild(promptDiv);
    card.appendChild(row);

    allSessionsList.appendChild(card);
  });
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
  try {
    await waitForFirebase();

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
      
      const debouncedRender = debounce(async () => {
        await renderAllSessions(allSessionsCache);
      }, 300);
      
      searchInput.addEventListener('input', () => { 
        // Immediate UI updates
        toggleClear(); 
        // Debounced search
        debouncedRender();
      });
      if (searchClear && !searchClear.dataset.bound) {
        searchClear.dataset.bound = 'true';
        searchClear.addEventListener('click', async () => {
          searchInput.value = '';
          toggleClear();
          await renderAllSessions(allSessionsCache);
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
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
