// ===== Main App Initialization =====

import { OWNER, REPO, BRANCH, STORAGE_KEYS } from './utils/constants.js';
import { parseParams, getHashParam } from './utils/url-params.js';
import { initJulesKeyModalListeners } from './modules/jules-modal.js';
import { handleTryInJules } from './modules/jules-api.js';
import statusBar from './modules/status-bar.js';
import { initPromptList, loadList, loadExpandedState, renderList, setSelectFileCallback, setRepoContext } from './modules/prompt-list.js';
import { initPromptRenderer, selectBySlug, selectFile, setHandleTryInJulesCallback } from './modules/prompt-renderer.js';
import { setCurrentBranch, setCurrentRepo } from './modules/branch-selector.js';

// App state
let currentOwner = OWNER;
let currentRepo = REPO;
let currentBranch = BRANCH;

export function initApp() {
  // Parse URL params
  const params = parseParams();
  if (params.owner) currentOwner = params.owner;
  if (params.repo) currentRepo = params.repo;
  if (params.branch) currentBranch = params.branch;

  // Set up callbacks to avoid circular dependencies
  setSelectFileCallback(selectFile);
  setHandleTryInJulesCallback(handleTryInJules);

  // Initialize modules
  initPromptList();
  initPromptRenderer();
  initJulesKeyModalListeners();
  
  // Init status bar
  statusBar.init();

  // Set repo context for prompt list
  setRepoContext(currentOwner, currentRepo, currentBranch);

  // Load prompts
  loadPrompts();

  // Setup event listeners
  setupEventListeners();
  
  // Initialize sidebar toggle
  initSidebarToggle();
}

async function loadPrompts() {
  const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
  const files = await loadList(currentOwner, currentRepo, currentBranch, cacheKey);

  const hashSlug = getHashParam('p');
  if (hashSlug) {
    await selectBySlug(hashSlug, files, currentOwner, currentRepo, currentBranch);
  } else {
    const { showFreeInputForm } = await import('./modules/jules.js');
    showFreeInputForm();
  }
}

function setupEventListeners() {
  window.addEventListener('hashchange', async () => {
    try {
      const p = parseParams();
      const prevOwner = currentOwner;
      const prevRepo = currentRepo;
      const prevBranch = currentBranch;

      if (p.owner) currentOwner = p.owner;
      if (p.repo) currentRepo = p.repo;
      if (p.branch) currentBranch = p.branch;

      const repoChanged = currentOwner !== prevOwner || currentRepo !== prevRepo;
      const branchChanged = currentBranch !== prevBranch;

      if (repoChanged || branchChanged) {
        setCurrentRepo(currentOwner, currentRepo);
        setCurrentBranch(currentBranch);
        const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
        sessionStorage.removeItem(cacheKey);
        await loadPrompts();
        await loadBranches();
      } else {
        // Just switching prompt
        const hashSlug = getHashParam('p');
        if (hashSlug) {
          const { getFiles } = await import('./modules/prompt-list.js');
          await selectBySlug(hashSlug, getFiles(), currentOwner, currentRepo, currentBranch);
        }
      }
    } catch (error) {
      console.error('Error handling hash change:', error);
    }
  });

  // Handle back/forward buttons
  window.addEventListener('popstate', async () => {
    try {
      const p = parseParams();
      const changed =
        (p.owner && p.owner !== currentOwner) ||
        (p.repo && p.repo !== currentRepo) ||
        (p.branch && p.branch !== currentBranch);

      if (changed) {
        currentOwner = p.owner || currentOwner;
        currentRepo = p.repo || currentRepo;
        currentBranch = p.branch || currentBranch;
        setCurrentRepo(currentOwner, currentRepo);
        setCurrentBranch(currentBranch);
        const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
        sessionStorage.removeItem(cacheKey);
        await loadPrompts();
        await loadBranches();
      }
    } catch (error) {
      console.error('Error handling popstate:', error);
    }
  });

  window.addEventListener('branchChanged', async (e) => {
    try {
      currentBranch = e.detail.branch;
      setRepoContext(currentOwner, currentRepo, currentBranch);
      await loadPrompts();
      
      const repoPill = document.getElementById('repoPill');
      if (repoPill) {
        repoPill.textContent = `${currentOwner}/${currentRepo}`;
      }
    } catch (error) {
      console.error('Error handling branch change:', error);
    }
  });
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const STORAGE_KEY = 'sidebar-collapsed';
  
  if (!sidebar || !toggleBtn) return;
  
  // Restore previous state
  const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }
  
  // Handle toggle click
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem(STORAGE_KEY, collapsed);
  });
}
