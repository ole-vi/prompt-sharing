import { getCurrentUser } from './auth.js';

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
      targetMenu.style.display = 'none';
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
    this.dropdownBtn.onclick = async (e) => {
      e.stopPropagation();
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
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.cssText = 'padding:12px; text-align:center; color:var(--muted); font-size:13px;';
    loadingIndicator.textContent = 'Loading...';
    this.dropdownMenu.appendChild(loadingIndicator);
    this.dropdownMenu.style.display = 'block';
    
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
    
    this.dropdownMenu.style.display = 'block';
  }

  async renderFavorites() {
    for (const fav of this.favorites) {
      const item = this.createRepoItem(fav.name, fav.id, true, async () => {
        this.selectedSourceId = fav.id;
        this.dropdownText.textContent = fav.name;
        this.dropdownMenu.style.display = 'none';
        
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
    if (!this.favorites || this.favorites.length === 0) {
      const helperDiv = document.createElement('div');
      helperDiv.style.cssText = 'padding:12px; color:var(--muted); text-align:center; font-size:12px; border-bottom:1px solid var(--border);';
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
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.flex = '1';
    
    item.onclick = (e) => {
      if (e.target === star) return;
      onClickHandler();
    };
    
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
      if (window.db) {
        await window.db.collection('users').doc(user.uid).set({
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
      if (window.db) {
        await window.db.collection('users').doc(user.uid).set({
          favoriteRepos: window.firebase.firestore.FieldValue.arrayUnion(newFavorite)
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
      if (window.db) {
        await window.db.collection('users').doc(user.uid).set({
          favoriteRepos: window.firebase.firestore.FieldValue.arrayRemove(favoriteToRemove)
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

  initialize(sourceId, defaultBranch) {
    this.sourceId = sourceId;
    this.selectedBranch = defaultBranch;
    this.allBranchesLoaded = false;
    
    if (!sourceId) {
      this.dropdownText.textContent = 'Select repository first';
      this.dropdownBtn.disabled = true;
      this.dropdownBtn.style.opacity = '0.5';
      this.dropdownBtn.style.cursor = 'not-allowed';
      return;
    }
    
    this.dropdownText.textContent = defaultBranch || 'Select a branch...';
    this.dropdownBtn.disabled = false;
    this.dropdownBtn.style.opacity = '1';
    this.dropdownBtn.style.cursor = 'pointer';
    
    this.setupDropdownToggle();
  }

  setupDropdownToggle() {
    this.dropdownBtn.onclick = (e) => {
      e.stopPropagation();
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
    
    const currentItem = document.createElement('div');
    currentItem.className = 'custom-dropdown-item selected';
    currentItem.textContent = this.selectedBranch;
    currentItem.onclick = () => {
      this.dropdownMenu.style.display = 'none';
    };
    this.dropdownMenu.appendChild(currentItem);
    
    const showMoreBtn = document.createElement('div');
    showMoreBtn.style.cssText = 'padding:8px; margin:4px 8px; text-align:center; border-top:1px solid var(--border); color:var(--accent); font-size:12px; cursor:pointer; font-weight:600;';
    showMoreBtn.textContent = '▼ Show more branches...';
    
    showMoreBtn.onclick = async () => {
      if (this.allBranchesLoaded) return;
      
      showMoreBtn.textContent = 'Loading...';
      showMoreBtn.style.pointerEvents = 'none';
      
      try {
        const pathParts = this.sourceId.split('/');
        const owner = pathParts[pathParts.length - 2];
        const repo = pathParts[pathParts.length - 1];
        
        const { getBranches } = await import('./github-api.js');
        const allBranches = await getBranches(owner, repo);

        if (!allBranches || allBranches.length === 0) {
          showMoreBtn.textContent = allBranches === null ? 'GitHub API rate limited - try later' : 'No branches found';
          showMoreBtn.style.color = 'var(--muted)';
          showMoreBtn.style.pointerEvents = 'auto';
          return;
        }

        this.allBranchesLoaded = true;
        showMoreBtn.style.display = 'none';
        
        allBranches.forEach(branch => {
          if (branch.name === this.selectedBranch) return;
          
          const item = document.createElement('div');
          item.className = 'custom-dropdown-item';
          item.textContent = branch.name;
          
          item.onclick = () => {
            this.setSelectedBranch(branch.name);
            this.dropdownMenu.style.display = 'none';
          };
          
          this.dropdownMenu.appendChild(item);
        });
      } catch (error) {
        console.error('Failed to load branches:', error);
        showMoreBtn.textContent = 'Failed to load - click to retry';
        showMoreBtn.style.color = 'var(--muted)';
        showMoreBtn.style.pointerEvents = 'auto';
      }
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
