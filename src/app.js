// ===== Main App Initialization =====

import { OWNER, REPO, BRANCH, STORAGE_KEYS } from './utils/constants.js';
import { parseParams, getHashParam } from './utils/url-params.js';
import { initJulesKeyModalListeners } from './modules/jules-modal.js';
import statusBar from './modules/status-bar.js';
import { initPromptList, loadList, loadExpandedState, renderList, setSelectFileCallback, setRepoContext } from './modules/prompt-list.js';
import { initPromptRenderer, selectBySlug, selectFile, setHandleTryInJulesCallback } from './modules/prompt-renderer.js';
import { setCurrentBranch, setCurrentRepo, loadBranchFromStorage } from './modules/branch-selector.js';
import { initSidebar } from './modules/sidebar.js';

// App state
let currentOwner = OWNER;
let currentRepo = REPO;
let currentBranch = BRANCH;

export function initApp() {
  const params = parseParams();
  if (params.owner) currentOwner = params.owner;
  if (params.repo) currentRepo = params.repo;
  currentBranch = params.branch || loadBranchFromStorage(currentOwner, currentRepo) || currentBranch;

  // Set up callbacks to avoid circular dependencies
  setSelectFileCallback(selectFile);

  setHandleTryInJulesCallback(async (...args) => {
    try {
      const { handleTryInJules } = await import('./modules/jules-api.js');
      return handleTryInJules(...args);
    } catch (error) {
      console.error('Failed to load Jules API module:', error);
      throw error; // Re-throw to let prompt-renderer handle it
    }
  });

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
  initSidebar();
}

async function loadPrompts() {
  const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
  const files = await loadList(currentOwner, currentRepo, currentBranch, cacheKey);

  const hashSlug = getHashParam('p');
  if (hashSlug) {
    await selectBySlug(hashSlug, files, currentOwner, currentRepo, currentBranch);
  } else {
    const { showFreeInputForm } = await import('./modules/jules-free-input.js');
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
    } catch (error) {}
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
    } catch (error) {}
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
    } catch (error) {}
  });
}
