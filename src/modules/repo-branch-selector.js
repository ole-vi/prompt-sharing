import { getCurrentUser } from './auth.js';
import { getDb } from './firebase-service.js';
import { showToast } from './toast.js';
import { toggleVisibility } from '../utils/dom-helpers.js';

function extractDefaultBranch(source) {
  const defaultBranchObj = source?.githubRepo?.defaultBranch ||
                           source?.githubRepoContext?.defaultBranch || 
                           source?.defaultBranch;
  
  return typeof defaultBranchObj === 'string' 
    ? defaultBranchObj 
    : (defaultBranchObj?.displayName || 'main');
}

function setupClickOutsideClose(targetBtn, targetMenu) {
  // Remove any previously registered handler for this button, if present
  if (targetBtn._closeDropdownHandler) {
    document.removeEventListener('click', targetBtn._closeDropdownHandler);
  }
  
  const closeDropdown = (e) => {
    if (!targetBtn.contains(e.target) && !targetMenu.contains(e.target)) {
      targetMenu.classList.remove('open');
      targetBtn.setAttribute('aria-expanded', 'false');
    }
  };
  
  // Store handler on the button so we can remove it on re-initialization
  targetBtn._closeDropdownHandler = closeDropdown;
  document.addEventListener('click', closeDropdown);
}

export class RepoSelector {
  constructor(options) {
    this.dropdownBtn = options.dropdownBtn;
    this.dropdownText = options.dropdownText;
    this.dropdownMenu = options.dropdownMenu;
    this.onSelect = options.onSelect;
    this.branchSelector = options.branchSelector;
    this.showFavorites = options.showFavorites !== false;
    
    this.favorites = [];
    this.allSources = [];
    this.allReposLoaded = false;
    this.sourcesCache = null;
    this.selectedSourceId = null;
  }

  saveToStorage() {
    if (this.selectedSourceId) {
      localStorage.setItem('selectedRepoId', this.selectedSourceId);
    }
  }

  loadFromStorage() {
    try {
      return localStorage.getItem('selectedRepoId');
    } catch (error) {
      console.error('Failed to load repo from storage:', error);
    }
    return null;
  }

  getSelectedSourceId() {
    return this.selectedSourceId;
  }

  async initialize() {
    const user = getCurrentUser();
    if (!user) {
      this.dropdownText.textContent = 'Please sign in first';
      this.dropdownBtn.disabled = true;
      return;
    }

    this.dropdownBtn.disabled = false;

    const { DEFAULT_FAVORITE_REPOS } = await import('../utils/constants.js');
    
    this.favorites = DEFAULT_FAVORITE_REPOS;
    try {
      const db = getDb();
      if (db) {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().favoriteRepos) {
          this.favorites = doc.data().favoriteRepos;
        }
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }

    // Set ARIA attributes
    this.dropdownBtn.setAttribute('aria-haspopup', 'true');
    this.dropdownBtn.setAttribute('aria-expanded', 'false');
    this.dropdownMenu.setAttribute('role', 'menu');

    // Try to restore previous selection
    const savedRepoId = this.loadFromStorage();
    if (savedRepoId) {
      // Try to find the repo in favorites to get its display name
      const favorite = this.favorites.find(f => f.id === savedRepoId);
      if (favorite) {
        this.selectedSourceId = savedRepoId;
        this.dropdownText.textContent = favorite.name;
        
        // Restore branch selector if available
        let restoredBranch = favorite.branch;
        if (this.branchSelector) {
          const savedBranch = this.branchSelector.loadFromStorage();
          if (savedBranch && savedBranch.sourceId === savedRepoId) {
            restoredBranch = savedBranch.branch;
            this.branchSelector.initialize(savedRepoId, savedBranch.branch);
          } else if (favorite.branch) {
            this.branchSelector.initialize(savedRepoId, favorite.branch);
          }
        }
        // Notify parent component of restored selection
        if (this.onSelect) {
          this.onSelect(savedRepoId, restoredBranch, favorite.name);
        }
      } else {
        // Not in favorites, show generic text
        this.selectedSourceId = savedRepoId;
        const pathParts = savedRepoId.split('/');
        const repoName = pathParts.length >= 4 ? pathParts.slice(-2).join('/') : savedRepoId;
        this.dropdownText.textContent = repoName;
        
        // Restore branch selector if available
        let restoredBranch = null;
        if (this.branchSelector) {
          const savedBranch = this.branchSelector.loadFromStorage();
          if (savedBranch && savedBranch.sourceId === savedRepoId) {
            restoredBranch = savedBranch.branch;
            this.branchSelector.initialize(savedRepoId, savedBranch.branch);
          }
        }
        // Notify parent component of restored selection
        if (this.onSelect && restoredBranch) {
          this.onSelect(savedRepoId, restoredBranch, repoName);
        }
      }
    } else {
      this.dropdownText.textContent = 'Select a repository...';
    }

    this.setupDropdownToggle();
  }

  setupDropdownToggle() {
    this.dropdownBtn.onclick = async (e) => {
      e.stopPropagation();
      if (this.dropdownMenu.classList.contains('open')) {
        this.dropdownMenu.classList.remove('open');
        this.dropdownMenu.style.display = '';
        this.dropdownBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      
      this.dropdownBtn.setAttribute('aria-expanded', 'true');

      // Position dropdown menu if it's fixed (e.g., in modals)
      const computedStyle = window.getComputedStyle(this.dropdownMenu);
      if (computedStyle.position === 'fixed') {
        const rect = this.dropdownBtn.getBoundingClientRect();
        this.dropdownMenu.style.top = `${rect.bottom + 4}px`;
        this.dropdownMenu.style.left = `${rect.left}px`;
        this.dropdownMenu.style.width = `${rect.width}px`;
      }
      
      await this.populateDropdown();
    };

    setupClickOutsideClose(this.dropdownBtn, this.dropdownMenu);
  }

  async populateDropdown() {
    this.dropdownMenu.innerHTML = '';
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'dropdown-loading';
    loadingIndicator.textContent = 'Loading...';
    this.dropdownMenu.appendChild(loadingIndicator);
    this.dropdownMenu.classList.add('open');
    this.dropdownMenu.style.display = '';
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    if (this.showFavorites && this.favorites && this.favorites.length > 0) {
      this.dropdownMenu.innerHTML = '';
      await this.renderFavorites();
      this.addShowMoreButton();
    } else {
      await this.loadAllRepos();
      this.dropdownMenu.innerHTML = '';
      this.renderAllRepos();
    }
    
    this.dropdownMenu.classList.add('open');
    this.dropdownMenu.style.display = '';
  }

  async renderFavorites() {
    for (const fav of this.favorites) {
      const item = this.createRepoItem(fav.name, fav.id, true, async () => {
        this.selectedSourceId = fav.id;
        this.dropdownText.textContent = fav.name;
        this.dropdownMenu.classList.remove('open');
        this.dropdownMenu.style.display = '';
        
        // Save repo selection
        this.saveToStorage();
        this.dropdownBtn.setAttribute('aria-expanded', 'false');
        
        let currentBranch = fav.branch;
        
        if (!currentBranch) {
          if (this.branchSelector) {
            this.branchSelector.dropdownText.textContent = 'Detecting branch...';
            this.branchSelector.dropdownBtn.disabled = true;
          }
          currentBranch = await this.verifyDefaultBranch(fav);
          if (this.branchSelector) {
            this.branchSelector.initialize(fav.id, currentBranch);
          }
        } else {
          if (this.branchSelector) {
            this.branchSelector.initialize(fav.id, currentBranch);
          }
          this.verifyDefaultBranch(fav, true).catch((error) => {
            console.error('Failed to verify default branch in background:', error);
          });
        }
        
        if (this.onSelect) {
          this.onSelect(fav.id, currentBranch, fav.name);
        }
      });
      
      this.dropdownMenu.appendChild(item);
    }
  }

  addShowMoreButton() {
    const showMoreBtn = document.createElement('div');
    showMoreBtn.className = 'dropdown-show-more';
    showMoreBtn.textContent = '▼ Show more...';
    
    showMoreBtn.onclick = async () => {
      if (!this.allReposLoaded) {
        showMoreBtn.textContent = 'Loading...';
        showMoreBtn.classList.add('loading');
        
        try {
          await this.loadAllRepos();
          this.allReposLoaded = true;
        } catch (error) {
          showMoreBtn.textContent = 'Failed to load - click to retry';
          showMoreBtn.classList.remove('loading');
          return;
        }
      }
      
      showMoreBtn.classList.add('hidden');
      this.renderAllRepos();
    };
    
    this.dropdownMenu.appendChild(showMoreBtn);
  }

  async loadAllRepos() {
    const user = getCurrentUser();
    const { listJulesSources } = await import('./jules-api.js');
    const { getDecryptedJulesKey } = await import('./jules-api.js');
    
    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      throw new Error('No API key configured');
    }

    const sourcesData = await listJulesSources(apiKey);
    this.allSources = sourcesData.sources || [];
    let nextPageToken = sourcesData.nextPageToken;
    
    while (nextPageToken) {
      const nextPage = await listJulesSources(apiKey, nextPageToken);
      this.allSources = this.allSources.concat(nextPage.sources || []);
      nextPageToken = nextPage.nextPageToken;
    }

    if (this.allSources.length === 0) {
      throw new Error('No repositories found');
    }
  }

  renderAllRepos() {
    if (!this.favorites || this.favorites.length === 0) {
      const helperDiv = document.createElement('div');
      helperDiv.className = 'dropdown-helper-text';
      helperDiv.textContent = 'Click ★ next to any repository to add it to favorites';
      this.dropdownMenu.appendChild(helperDiv);
    }
    
    this.allSources.forEach(source => {
      if (this.favorites.some(f => f.id === (source.name || source.id))) return;
      
      const fullPath = source.name || source.id;
      const pathParts = fullPath.split('/');
      const repoName = pathParts.length >= 4 ? pathParts.slice(-2).join('/') : fullPath;
      const defaultBranch = extractDefaultBranch(source);
      
      const item = this.createRepoItem(repoName, source.name || source.id, false, () => {
        this.selectedSourceId = source.name || source.id;
        this.dropdownText.textContent = repoName;
        this.dropdownMenu.classList.remove('open');
        this.dropdownMenu.style.display = '';
        
        // Save repo selection
        this.saveToStorage();
        this.dropdownBtn.setAttribute('aria-expanded', 'false');
        
        if (this.onSelect) {
          this.onSelect(source.name || source.id, defaultBranch, repoName);
        }
      });
      
      this.dropdownMenu.appendChild(item);
    });
  }

  createRepoItem(name, id, isFavorite, onClickHandler) {
    const item = document.createElement('div');
    item.className = 'dropdown-item-with-star';
    if (id === this.selectedSourceId) item.classList.add('selected');
    
    const star = document.createElement('span');
    star.className = 'icon icon-inline star-icon';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = 'star';
    star.dataset.favorited = isFavorite.toString();
    
    star.onclick = async (e) => {
      e.stopPropagation();
      if (isFavorite) {
        await this.removeFavorite(id);
        this.dropdownMenu.classList.remove('open');
        this.dropdownMenu.style.display = '';
        this.dropdownBtn.setAttribute('aria-expanded', 'false');
        setTimeout(() => this.populateDropdown(), 0);
      } else {
        const defaultBranch = extractDefaultBranch(this.allSources.find(s => (s.name || s.id) === id));
        await this.addFavorite(id, name, defaultBranch);
        item.remove();
      }
    };
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = name;
    
    item.onclick = () => onClickHandler();
    
    item.appendChild(star);
    item.appendChild(nameSpan);
    
    return item;
  }

  async verifyDefaultBranch(favorite, updateUI = false) {
    try {
      const user = getCurrentUser();
      const { listJulesSources, getDecryptedJulesKey } = await import('./jules-api.js');
      const apiKey = await getDecryptedJulesKey(user.uid);
      
      if (!apiKey) return favorite.branch || 'master';
      
      if (!this.sourcesCache) {
        let allSources = [];
        let pageToken = null;
        do {
          const response = await listJulesSources(apiKey, pageToken);
          if (response.sources) allSources.push(...response.sources);
          pageToken = response.nextPageToken;
        } while (pageToken);
        this.sourcesCache = { sources: allSources };
      }
      
      const favoriteIdToMatch = favorite.id.replace(/^sources\//, '');
      const matchingSource = this.sourcesCache.sources?.find(s => 
        (s.name || s.id) === favoriteIdToMatch
      );
      if (!matchingSource) return favorite.branch || 'master';
      
      const defaultBranch = extractDefaultBranch(matchingSource);
      
      if (favorite.branch !== defaultBranch) {
        const updatedFavorites = this.favorites.map(f => 
          f.id === favorite.id ? { ...f, branch: defaultBranch } : f
        );
        await this.saveFavorites(updatedFavorites);
        this.favorites = updatedFavorites;
        
        if (updateUI && this.selectedSourceId === favorite.id) {
          if (this.branchSelector && !this.branchSelector.dropdownBtn.disabled) {
            this.branchSelector.initialize(favorite.id, defaultBranch);
          }
          if (this.onSelect) {
            this.onSelect(favorite.id, defaultBranch, favorite.name);
          }
        }
      }
      
      return defaultBranch;
    } catch (error) {
      console.error('[RepoSelector] Failed to verify default branch:', error);
      return favorite.branch || 'master';
    }
  }

  async saveFavorites(newFavorites) {
    const user = getCurrentUser();
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(user.uid).set({
          favoriteRepos: newFavorites
        }, { merge: true });
        this.favorites = newFavorites;
      }
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }

  async addFavorite(sourceId, name, branch) {
    const user = getCurrentUser();
    const newFavorite = { id: sourceId, name, branch };
    
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(user.uid).set({
          favoriteRepos: firebase.firestore.FieldValue.arrayUnion(newFavorite)
        }, { merge: true });
        this.favorites = [...this.favorites, newFavorite];
      }
    } catch (error) {
      console.error('Failed to add favorite:', error);
    }
  }

  async removeFavorite(sourceId) {
    const user = getCurrentUser();
    const favoriteToRemove = this.favorites.find(f => f.id === sourceId);
    
    if (!favoriteToRemove) return;
    
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(user.uid).set({
          favoriteRepos: firebase.firestore.FieldValue.arrayRemove(favoriteToRemove)
        }, { merge: true });
        this.favorites = this.favorites.filter(f => f.id !== sourceId);
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }
}

export class BranchSelector {
  constructor(options) {
    this.dropdownBtn = options.dropdownBtn;
    this.dropdownText = options.dropdownText;
    this.dropdownMenu = options.dropdownMenu;
    this.onSelect = options.onSelect;
    
    this.selectedBranch = null;
    this.sourceId = null;
    this.allBranchesLoaded = false;
  }

  saveToStorage() {
    if (this.sourceId && this.selectedBranch) {
      localStorage.setItem('selectedBranchRepo', JSON.stringify({
        sourceId: this.sourceId,
        branch: this.selectedBranch
      }));
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('selectedBranchRepo');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load branch from storage:', error);
    }
    return null;
  }

  getSelectedBranch() {
    return this.selectedBranch;
  }

  initialize(sourceId, defaultBranch) {
    // Try to restore from storage if no sourceId provided
    if (!sourceId) {
      const stored = this.loadFromStorage();
      if (stored) {
        sourceId = stored.sourceId;
        defaultBranch = stored.branch;
      }
    }
    
    this.sourceId = sourceId;
    this.selectedBranch = defaultBranch;
    this.allBranchesLoaded = false;

    // Set ARIA attributes
    this.dropdownBtn.setAttribute('aria-haspopup', 'true');
    this.dropdownBtn.setAttribute('aria-expanded', 'false');
    this.dropdownMenu.setAttribute('role', 'menu');
    
    if (!sourceId) {
      this.dropdownText.textContent = 'Select repository first';
      this.dropdownBtn.disabled = true;
      this.dropdownBtn.classList.add('disabled');
      return;
    }
    
    this.dropdownText.textContent = defaultBranch || 'Select a branch...';
    this.dropdownBtn.disabled = false;
    this.dropdownBtn.classList.remove('disabled');
    
    // Save to storage
    this.saveToStorage();
    
    this.setupDropdownToggle();
  }

  setupDropdownToggle() {
    this.dropdownBtn.onclick = (e) => {
      e.stopPropagation();
      if (this.dropdownMenu.classList.contains('open')) {
        this.dropdownMenu.classList.remove('open');
        this.dropdownMenu.style.display = '';
        this.dropdownBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      
      this.dropdownBtn.setAttribute('aria-expanded', 'true');

      // Position dropdown menu if it's fixed (e.g., in modals)
      const computedStyle = window.getComputedStyle(this.dropdownMenu);
      if (computedStyle.position === 'fixed') {
        const rect = this.dropdownBtn.getBoundingClientRect();
        this.dropdownMenu.style.top = `${rect.bottom + 4}px`;
        this.dropdownMenu.style.left = `${rect.left}px`;
        this.dropdownMenu.style.width = `${rect.width}px`;
      }
      
      this.populateDropdown();
    };

    setupClickOutsideClose(this.dropdownBtn, this.dropdownMenu);
  }

  populateDropdown() {
    if (!this.sourceId) {
      showToast('Please select a repository first', 'warn');
      return;
    }
    
    this.dropdownMenu.innerHTML = '';
    
    const currentItem = document.createElement('div');
    currentItem.className = 'dropdown-item-with-star selected';
    currentItem.onclick = () => {
      this.dropdownMenu.classList.remove('open');
      this.dropdownMenu.style.display = '';
      this.dropdownBtn.setAttribute('aria-expanded', 'false');
    };
    
    // Hide star for current item
    const star = document.createElement('span');
    star.className = 'star-icon';
    star.style.visibility = 'hidden';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = this.selectedBranch;
    
    currentItem.appendChild(star);
    currentItem.appendChild(nameSpan);
    this.dropdownMenu.appendChild(currentItem);
    
    const showMoreBtn = document.createElement('div');
    showMoreBtn.className = 'dropdown-show-more';
    showMoreBtn.textContent = '▼ Show more branches...';
    
    showMoreBtn.onclick = async () => {
      if (this.allBranchesLoaded) return;
      
      showMoreBtn.textContent = 'Loading...';
      showMoreBtn.style.pointerEvents = 'none';
      showMoreBtn.classList.remove('status-info');
      
      try {
        const pathParts = this.sourceId.split('/');
        const owner = pathParts[pathParts.length - 2];
        const repo = pathParts[pathParts.length - 1];
        
        const { getBranches } = await import('./github-api.js');
        const allBranches = await getBranches(owner, repo);

        if (!allBranches || allBranches.length === 0) {
          showMoreBtn.textContent = allBranches === null ? 'GitHub API rate limited - try later' : 'No branches found';
          showMoreBtn.classList.add('status-info');
          showMoreBtn.style.pointerEvents = 'auto';
          return;
        }

        this.allBranchesLoaded = true;
        toggleVisibility(showMoreBtn, false);
        
        allBranches.forEach(branch => {
          if (branch.name === this.selectedBranch) return;
          
          const item = document.createElement('div');
          item.className = 'dropdown-item-with-star';
          
          // Hide star for branches (not using favorites here)
          const star = document.createElement('span');
          star.className = 'star-icon';
          star.style.visibility = 'hidden';
          
          const nameSpan = document.createElement('span');
          nameSpan.className = 'item-name';
          nameSpan.textContent = branch.name;
          
          item.onclick = () => {
            this.setSelectedBranch(branch.name);
            this.dropdownMenu.classList.remove('open');
            this.dropdownMenu.style.display = '';
            this.dropdownBtn.setAttribute('aria-expanded', 'false');
          };
          
          item.appendChild(star);
          item.appendChild(nameSpan);
          this.dropdownMenu.appendChild(item);
        });
      } catch (error) {
        console.error('Failed to load branches:', error);
        showMoreBtn.textContent = 'Failed to load - click to retry';
        showMoreBtn.classList.add('status-info');
        showMoreBtn.style.pointerEvents = 'auto';
      }
    };
    
    this.dropdownMenu.appendChild(showMoreBtn);
    
    this.dropdownMenu.classList.add('open');
    if (this.dropdownMenu.style.display === 'none') {
      this.dropdownMenu.style.display = '';
    }
  }

  setSelectedBranch(branch) {
    this.selectedBranch = branch;
    this.dropdownText.textContent = branch;
    
    // Save to storage
    this.saveToStorage();
    
    if (this.onSelect) {
      this.onSelect(branch);
    }
  }
}
