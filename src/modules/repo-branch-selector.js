// Shared repo and branch selection logic for Jules modals

import { getCurrentUser } from './auth.js';

// Helper to extract default branch from source object
function extractDefaultBranch(source) {
  const defaultBranchObj = source?.githubRepo?.defaultBranch ||
                           source?.githubRepoContext?.defaultBranch || 
                           source?.defaultBranch;
  
  return typeof defaultBranchObj === 'string' 
    ? defaultBranchObj 
    : (defaultBranchObj?.displayName || 'master');
}

// Helper to setup click-outside-to-close behavior
function setupClickOutsideClose(targetBtn, targetMenu) {
  const closeDropdown = (e) => {
    if (!targetBtn.contains(e.target) && !targetMenu.contains(e.target)) {
      targetMenu.style.display = 'none';
    }
  };
  document.removeEventListener('click', closeDropdown);
  document.addEventListener('click', closeDropdown);
}

export class RepoSelector {
  constructor(options) {
    this.dropdownBtn = options.dropdownBtn;
    this.dropdownText = options.dropdownText;
    this.dropdownMenu = options.dropdownMenu;
    this.favoriteContainer = options.favoriteContainer;
    this.onSelect = options.onSelect; // Callback when repo is selected
    this.showFavorites = options.showFavorites !== false; // Default true
    
    this.favorites = [];
    this.allSources = [];
    this.allReposLoaded = false;
    this.sourcesCache = null;
    this.selectedSourceId = null;
  }

  async initialize() {
    const user = getCurrentUser();
    if (!user) {
      this.dropdownText.textContent = 'Please sign in first';
      this.dropdownBtn.disabled = true;
      return;
    }

    this.dropdownBtn.disabled = false;
    this.dropdownText.textContent = 'Select a repository...';

    const { DEFAULT_FAVORITE_REPOS } = await import('../utils/constants.js');
    
    // Load favorites from Firestore
    this.favorites = DEFAULT_FAVORITE_REPOS;
    try {
      if (window.db) {
        const doc = await window.db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().favoriteRepos) {
          this.favorites = doc.data().favoriteRepos;
        }
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }

    this.setupDropdownToggle();
  }

  setupDropdownToggle() {
    this.dropdownBtn.onclick = async () => {
      if (this.dropdownMenu.style.display === 'block') {
        this.dropdownMenu.style.display = 'none';
        return;
      }
      await this.populateDropdown();
    };

    setupClickOutsideClose(this.dropdownBtn, this.dropdownMenu);
  }

  async populateDropdown() {
    this.dropdownMenu.innerHTML = '';
    
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.cssText = 'padding:12px; text-align:center; color:var(--muted); font-size:13px;';
    loadingIndicator.textContent = 'Loading...';
    this.dropdownMenu.appendChild(loadingIndicator);
    this.dropdownMenu.style.display = 'block';
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    this.dropdownMenu.innerHTML = '';
    
    if (this.showFavorites && this.favorites && this.favorites.length > 0) {
      await this.renderFavorites();
      this.addShowMoreButton();
    } else {
      await this.loadAllRepos();
      this.renderAllRepos();
    }
    
    this.dropdownMenu.style.display = 'block';
  }

  async renderFavorites() {
    for (const fav of this.favorites) {
      const item = this.createRepoItem(fav.name, fav.id, true, async () => {
        const branch = await this.getDefaultBranch(fav);
        this.selectedSourceId = fav.id;
        this.dropdownText.textContent = fav.name;
        this.dropdownMenu.style.display = 'none';
        
        if (this.onSelect) {
          this.onSelect(fav.id, branch, fav.name);
        }
      });
      
      this.dropdownMenu.appendChild(item);
    }
  }

  addShowMoreButton() {
    const showMoreBtn = document.createElement('div');
    showMoreBtn.style.cssText = 'padding:8px; margin:4px 8px; text-align:center; border-top:1px solid var(--border); color:var(--accent); font-size:12px; cursor:pointer; font-weight:600;';
    showMoreBtn.textContent = '▼ Show more...';
    
    showMoreBtn.onclick = async () => {
      if (!this.allReposLoaded) {
        showMoreBtn.textContent = 'Loading...';
        showMoreBtn.style.pointerEvents = 'none';
        
        try {
          await this.loadAllRepos();
          this.allReposLoaded = true;
        } catch (error) {
          showMoreBtn.textContent = 'Failed to load - click to retry';
          showMoreBtn.style.pointerEvents = 'auto';
          return;
        }
      }
      
      showMoreBtn.style.display = 'none';
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
    this.allSources.forEach(source => {
      if (this.favorites.some(f => f.id === (source.name || source.id))) return;
      
      const fullPath = source.name || source.id;
      const pathParts = fullPath.split('/');
      const repoName = pathParts.length >= 4 ? pathParts.slice(-2).join('/') : fullPath;
      const defaultBranch = extractDefaultBranch(source);
      
      const item = this.createRepoItem(repoName, source.name || source.id, false, () => {
        this.selectedSourceId = source.name || source.id;
        this.dropdownText.textContent = repoName;
        this.dropdownMenu.style.display = 'none';
        
        if (this.onSelect) {
          this.onSelect(source.name || source.id, defaultBranch, repoName);
        }
      });
      
      this.dropdownMenu.appendChild(item);
    });
  }

  createRepoItem(name, id, isFavorite, onClickHandler) {
    const item = document.createElement('div');
    item.className = 'custom-dropdown-item';
    item.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 12px; cursor:pointer;';
    
    if (id === this.selectedSourceId) {
      item.classList.add('selected');
    }
    
    // Star icon
    const star = document.createElement('span');
    star.textContent = isFavorite ? '★' : '☆';
    star.style.cssText = `font-size:18px; cursor:pointer; color:${isFavorite ? 'var(--accent)' : 'var(--muted)'}; flex-shrink:0;`;
    star.onclick = async (e) => {
      e.stopPropagation();
      if (isFavorite) {
        await this.removeFavorite(id);
        this.dropdownMenu.style.display = 'none';
        setTimeout(() => this.populateDropdown(), 0);
      } else {
        const defaultBranch = extractDefaultBranch(this.allSources.find(s => (s.name || s.id) === id));
        await this.addFavorite(id, name, defaultBranch);
        item.remove();
      }
    };
    
    // Repo name
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.flex = '1';
    nameSpan.onclick = onClickHandler;
    
    item.appendChild(star);
    item.appendChild(nameSpan);
    
    return item;
  }

  async getDefaultBranch(favorite) {
    // If we don't have a branch stored OR if it's 'master' (might be wrong), verify it once
    if (!favorite.branch || favorite.branch === 'master') {
      try {
        const user = getCurrentUser();
        const { listJulesSources } = await import('./jules-api.js');
        const { getDecryptedJulesKey } = await import('./jules-api.js');
        const apiKey = await getDecryptedJulesKey(user.uid);
        
        if (apiKey) {
          // Use cached sources if available
          if (!this.sourcesCache) {
            this.sourcesCache = await listJulesSources(apiKey);
          }
          const matchingSource = this.sourcesCache.sources?.find(s => (s.name || s.id) === favorite.id);
          
          const defaultBranch = extractDefaultBranch(matchingSource);
          
          // Update favorite if branch changed
          if (favorite.branch !== defaultBranch) {
            const updatedFavorites = this.favorites.map(f => 
              f.id === favorite.id ? { ...f, branch: defaultBranch } : f
            );
            await this.saveFavorites(updatedFavorites);
            this.favorites = updatedFavorites;
          }
          
          return defaultBranch;
        }
      } catch (error) {
        console.error('Failed to fetch default branch:', error);
      }
    }
    
    return favorite.branch || 'master';
  }

  async saveFavorites(newFavorites) {
    const user = getCurrentUser();
    try {
      if (window.db) {
        await window.db.collection('users').doc(user.uid).set({
          favoriteRepos: newFavorites
        }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }

  async addFavorite(sourceId, name, branch) {
    const newFavorites = [...this.favorites, { id: sourceId, name, branch }];
    await this.saveFavorites(newFavorites);
    this.favorites = newFavorites;
  }

  async removeFavorite(sourceId) {
    const newFavorites = this.favorites.filter(f => f.id !== sourceId);
    await this.saveFavorites(newFavorites);
    this.favorites = newFavorites;
  }
}

export class BranchSelector {
  constructor(options) {
    this.dropdownBtn = options.dropdownBtn;
    this.dropdownText = options.dropdownText;
    this.dropdownMenu = options.dropdownMenu;
    this.onSelect = options.onSelect; // Callback when branch is selected
    
    this.selectedBranch = null;
    this.sourceId = null;
  }

  initialize(sourceId, defaultBranch) {
    this.sourceId = sourceId;
    this.selectedBranch = defaultBranch;
    
    if (!sourceId) {
      this.dropdownText.textContent = 'Select repository first';
      this.dropdownBtn.disabled = true;
      return;
    }
    
    this.dropdownText.textContent = defaultBranch || 'Select a branch...';
    this.dropdownBtn.disabled = false;
    
    this.setupDropdownToggle();
  }

  setupDropdownToggle() {
    this.dropdownBtn.onclick = () => {
      if (this.dropdownMenu.style.display === 'block') {
        this.dropdownMenu.style.display = 'none';
        return;
      }
      this.populateDropdown();
    };

    setupClickOutsideClose(this.dropdownBtn, this.dropdownMenu);
  }

  populateDropdown() {
    if (!this.sourceId) {
      alert('Please select a repository first');
      return;
    }
    
    this.dropdownMenu.innerHTML = '';
    
    // Show current branch
    const currentItem = document.createElement('div');
    currentItem.className = 'custom-dropdown-item selected';
    currentItem.textContent = this.selectedBranch;
    currentItem.onclick = () => {
      this.dropdownMenu.style.display = 'none';
    };
    this.dropdownMenu.appendChild(currentItem);
    
    // Show more button (for future GitHub API integration if needed)
    const showMoreBtn = document.createElement('div');
    showMoreBtn.style.cssText = 'padding:8px; margin:4px 8px; text-align:center; border-top:1px solid var(--border); color:var(--accent); font-size:12px; cursor:pointer; font-weight:600;';
    showMoreBtn.textContent = '▼ Show more...';
    showMoreBtn.onclick = () => {
      showMoreBtn.textContent = 'GitHub API rate limited';
      showMoreBtn.style.color = 'var(--muted)';
      showMoreBtn.style.pointerEvents = 'none';
    };
    this.dropdownMenu.appendChild(showMoreBtn);
    
    this.dropdownMenu.style.display = 'block';
  }

  setSelectedBranch(branch) {
    this.selectedBranch = branch;
    this.dropdownText.textContent = branch;
    if (this.onSelect) {
      this.onSelect(branch);
    }
  }
}
