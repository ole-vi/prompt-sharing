import { waitForFirebase } from '../shared-init.js';
import { listJulesSessions, getDecryptedJulesKey } from '../modules/jules-api.js';
import { showPromptViewer } from '../modules/prompt-viewer.js';
import { debounce } from '../utils/debounce.js';
import { TIMEOUTS } from '../utils/constants.js';
import { createSessionCard, createEmptyState, createErrorState } from '../utils/dom-builders.js';
import { clearElement } from '../utils/dom-helpers.js';

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
      
      renderAllSessions(allSessionsCache);
      
      if (sessionNextPageToken) {
        loadMoreSection.classList.remove('hidden');
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      } else {
        loadMoreSection.classList.add('hidden');
      }
    } else if (allSessionsCache.length === 0) {
      clearElement(allSessionsList);
      allSessionsList.appendChild(createEmptyState('No sessions found'));
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      clearElement(allSessionsList);
      // Using inline style to match previous behavior but could move to css if needed
      const errorDiv = createErrorState(`Failed to load sessions: ${error.message}`);
      errorDiv.style.color = '#e74c3c';
      errorDiv.classList.remove('panel', 'pad-xl'); // adjust classes to match previous styling
      errorDiv.classList.add('pad-lg');
      allSessionsList.appendChild(errorDiv);
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
  
  clearElement(allSessionsList);

  if (filteredSessions.length === 0 && searchTerm) {
    // Styling from previous code: style="color:var(--muted); text-align:center; padding:24px;"
    const noMatchDiv = document.createElement('div');
    noMatchDiv.style.color = 'var(--muted)';
    noMatchDiv.style.textAlign = 'center';
    noMatchDiv.style.padding = '24px';
    noMatchDiv.textContent = 'No sessions match your search';
    allSessionsList.appendChild(noMatchDiv);
    return;
  }
  
  filteredSessions.forEach(session => {
    allSessionsList.appendChild(createSessionCard(session));
  });

  // Ensure delegated listener is attached once
  if (allSessionsList && !allSessionsList.dataset.hasHandlers) {
    allSessionsList.dataset.hasHandlers = 'true';
    allSessionsList.addEventListener('click', handleSessionListClick);
  }
}

function handleSessionListClick(e) {
  const target = e.target;
  
  // Handle View Button Click
  const viewBtn = target.closest('.session-view-btn');
  if (viewBtn) {
    e.stopPropagation();
    const sessionId = viewBtn.dataset.sessionId;
    const session = allSessionsCache.find(s =>
      (s.name?.split('sessions/')[1] || s.id?.split('sessions/')[1] || s.id) === sessionId
    );
    if (session) {
      showPromptViewer(session.prompt || 'No prompt text available', sessionId);
    }
    return;
  }

  // Handle Link Click (should be handled by browser but we stop propagation of card click)
  if (target.closest('a')) {
    e.stopPropagation();
    return;
  }

  // Handle Card Click
  const card = target.closest('.session-card');
  if (card) {
    const url = card.dataset.sessionUrl;
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }
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
      
      const debouncedRender = debounce(() => {
        renderAllSessions(allSessionsCache);
      }, 300);
      
      searchInput.addEventListener('input', () => { 
        // Immediate UI updates
        toggleClear(); 
        // Debounced search
        debouncedRender();
      });
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
