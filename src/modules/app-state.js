// src/modules/app-state.js

/**
 * @typedef {Object} StateSchema
 * @property {Object} auth
 * @property {Object|null} auth.user - Firebase user object (transient)
 * @property {Object|null} auth.githubToken - GitHub access token data (persistent: local)
 * @property {Object} repo
 * @property {string} repo.owner - Repository owner
 * @property {string} repo.name - Repository name
 * @property {string} repo.branch - Selected branch name
 * @property {Object} preferences
 * @property {boolean} preferences.sidebarCollapsed
 * @property {boolean} preferences.showFeatureBranches
 * @property {boolean} preferences.showUserBranches
 * @property {string} preferences.theme
 * @property {Object} ui
 * @property {Array<string>} ui.expandedPaths - List of expanded tree paths (persistent: session)
 */

const STORAGE_KEYS = {
  'auth.githubToken': { key: 'github_access_token', type: 'local' },
  'repo.owner': { key: 'selectedRepoOwner', type: 'local' },
  'repo.name': { key: 'selectedRepoName', type: 'local' },
  'repo.current': { key: 'selectedBranch', type: 'local' },
  'jules.selectedRepoId': { key: 'selectedRepoId', type: 'local' },
  'jules.selectedBranchRepo': { key: 'selectedBranchRepo', type: 'local' },
  'preferences.sidebarCollapsed': { key: 'sidebar-collapsed', type: 'local' },
  'preferences.showFeatureBranches': { key: 'showFeatureBranches', type: 'local' },
  'preferences.showUserBranches': { key: 'showUserBranches', type: 'local' },
  'preferences.theme': { key: 'theme', type: 'local' },
  'ui.expandedPaths': { key: 'tree_expanded_paths', type: 'session' }
};

class AppState {
  constructor() {
    this.state = {
      auth: {
        user: null,
        githubToken: null
      },
      repo: {
        owner: 'promptroot',
        name: 'promptroot',
        branch: 'main',
        current: null // {branch, owner, repo, timestamp}
      },
      jules: {
        selectedRepoId: null,
        selectedBranchRepo: null
      },
      preferences: {
        sidebarCollapsed: false,
        showFeatureBranches: false,
        showUserBranches: true,
        theme: 'light'
      },
      ui: {
        expandedPaths: []
      }
    };

    this.subscribers = new Map(); // path -> Set<callback>
    this.init();
  }

  init() {
    this._loadFromStorage();
    this._setupStorageListener();
  }

  /**
   * Loads persisted state from localStorage and sessionStorage
   */
  _loadFromStorage() {
    for (const [path, config] of Object.entries(STORAGE_KEYS)) {
      const storage = config.type === 'local' ? localStorage : sessionStorage;
      const rawValue = storage.getItem(config.key);

      if (rawValue !== null) {
        try {
          // Attempt to parse JSON, fallback to raw string if not JSON
          // (though most values should be JSON stringified for consistency)
          let value;
          try {
            value = JSON.parse(rawValue);
          } catch {
            value = rawValue;
          }

          // Special handling for legacy boolean strings if necessary,
          // but JSON.parse handles "true"/"false" correctly.

          this._setDeep(path, value, false); // Don't persist back on load
        } catch (e) {
          console.warn(`Failed to load state for ${path}`, e);
        }
      }
    }
  }

  /**
   * Listen for changes in other tabs
   */
  _setupStorageListener() {
    window.addEventListener('storage', (event) => {
      // Find which state path maps to this storage key
      const entry = Object.entries(STORAGE_KEYS).find(
        ([_, config]) => config.key === event.key && config.type === 'local' // sessionStorage doesn't sync across tabs usually
      );

      if (entry) {
        const [path] = entry;
        try {
          const value = event.newValue ? JSON.parse(event.newValue) : null;
          // specific handling for null/removal?

          // Update state but don't persist (it's already in storage)
          // and don't trigger another storage event loop
          this._setDeep(path, value, false);
          this._notify(path, value);
        } catch (e) {
          console.warn(`Failed to sync state for ${path}`, e);
        }
      }
    });
  }

  /**
   * Set a value in the state tree
   * @param {string} path - Dot notation path (e.g. 'auth.user')
   * @param {*} value - New value
   * @param {boolean} [persist=true] - Whether to save to storage
   */
  setState(path, value, persist = true) {
    const oldValue = this.getState(path);
    if (JSON.stringify(oldValue) === JSON.stringify(value)) return;

    this._setDeep(path, value, persist);
    this._notify(path, value, oldValue);
  }

  /**
   * Get a value from the state tree
   * @param {string} path - Dot notation path
   * @returns {*}
   */
  getState(path) {
    return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, this.state);
  }

  /**
   * Subscribe to changes on a specific path
   * @param {string} path
   * @param {Function} callback - (newValue, oldValue) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);

    // Return unsubscribe
    return () => {
      const callbacks = this.subscribers.get(path);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(path);
        }
      }
    };
  }

  _setDeep(path, value, persist) {
    const keys = path.split('.');
    let current = this.state;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    if (persist && STORAGE_KEYS[path]) {
      const config = STORAGE_KEYS[path];
      const storage = config.type === 'local' ? localStorage : sessionStorage;
      if (value === null || value === undefined) {
        storage.removeItem(config.key);
      } else {
        storage.setItem(config.key, JSON.stringify(value));
      }
    }
  }

  _notify(path, newValue, oldValue) {
    // Notify exact listeners
    if (this.subscribers.has(path)) {
      this.subscribers.get(path).forEach(cb => {
        try {
          cb(newValue, oldValue);
        } catch (e) {
          console.error(`Error in subscriber for ${path}:`, e);
        }
      });
    }

    // Notify parent listeners? (Optional, skipping for now for simplicity)
    // For example if 'auth.user' changes, listeners on 'auth' might want to know.
    // Implementing simple parent notification:
    const parts = path.split('.');
    while(parts.length > 0) {
      parts.pop();
      if(parts.length === 0) break;
      const parentPath = parts.join('.');
      if (this.subscribers.has(parentPath)) {
        const parentValue = this.getState(parentPath);
        this.subscribers.get(parentPath).forEach(cb => {
             try {
               // For parent listeners, we just pass the new parent object
               // We don't easily have "old parent object" without deep cloning everything always
               cb(parentValue);
             } catch (e) { console.error(e); }
        });
      }
    }
  }
}

// Singleton instance
export const appState = new AppState();
