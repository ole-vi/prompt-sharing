// ===== Main App Initialization =====

import { OWNER, REPO, BRANCH, STORAGE_KEYS } from './utils/constants.js';
import { parseParams, getHashParam } from './utils/url-params.js';
import { initJulesKeyModalListeners, destroyJulesKeyModalListeners } from './modules/jules-modal.js';
import { handleTryInJules } from './modules/jules-api.js';
import statusBar from './modules/status-bar.js';
import { initPromptList, destroyPromptList, loadList, loadExpandedState, renderList, setSelectFileCallback, setRepoContext } from './modules/prompt-list.js';
import { initPromptRenderer, destroyPromptRenderer, selectBySlug, selectFile, setHandleTryInJulesCallback } from './modules/prompt-renderer.js';
import { setCurrentBranch, setCurrentRepo, loadBranchFromStorage, destroyBranchSelector, loadBranches } from './modules/branch-selector.js';
import { initSidebar, destroySidebar } from './modules/sidebar.js';
import { destroyJulesQueue } from './modules/jules-queue.js';

// App state
let currentOwner = OWNER;
let currentRepo = REPO;
let currentBranch = BRANCH;

export function destroyAllModules() {
  try { destroyPromptList(); } catch (e) { console.error(e); }
  try { destroyPromptRenderer(); } catch (e) { console.error(e); }
  try { destroyBranchSelector(); } catch (e) { console.error(e); }
  try { destroySidebar(); } catch (e) { console.error(e); }
  try { destroyJulesKeyModalListeners(); } catch (e) { console.error(e); }
  try { destroyJulesQueue(); } catch (e) { console.error(e); }
  try { statusBar.destroy(); } catch (e) { console.error(e); }
}

export function initModules() {
  setSelectFileCallback(selectFile);
  setHandleTryInJulesCallback(handleTryInJules);

  initPromptList();
  initPromptRenderer();
  initJulesKeyModalListeners();
  statusBar.init();
  initSidebar();

  setRepoContext(currentOwner, currentRepo, currentBranch);
}

export function initApp() {
  const params = parseParams();
  if (params.owner) currentOwner = params.owner;
  if (params.repo) currentRepo = params.repo;
  currentBranch = params.branch || loadBranchFromStorage(currentOwner, currentRepo) || currentBranch;

  initModules();

  // Load prompts
  loadPrompts();

  // Setup event listeners
  setupEventListeners();
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
    destroyAllModules();
    initModules();
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
