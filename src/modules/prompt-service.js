import { listPromptsViaContents, listPromptsViaTrees } from './github-api.js';

export function getPromptFolder(branch) {
  return branch === 'web-captures' ? 'webcaptures' : 'prompts';
}

/**
 * Loads prompts using stale-while-revalidate strategy.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} cacheKey - Key for sessionStorage
 * @param {function} onUpdate - Callback function called when fresh data is available (useful for background updates)
 * @returns {Promise<Array>} - Resolves with the list of files (from cache or network)
 */
export async function loadPrompts(owner, repo, branch, cacheKey, onUpdate) {
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();
  let files = [];

  // Try to get from cache
  const cached = sessionStorage.getItem(cacheKey);
  let cacheData = null;

  if (cached) {
    try {
      cacheData = JSON.parse(cached);
      // Validate cache structure
      if (!cacheData || typeof cacheData !== 'object' || Array.isArray(cacheData) || !Array.isArray(cacheData.files)) {
        console.warn('Old cache format detected, clearing cache');
        sessionStorage.removeItem(cacheKey);
        cacheData = null;
      }
    } catch (e) {
      console.warn('Corrupted cache data detected, clearing cache', e);
      sessionStorage.removeItem(cacheKey);
      cacheData = null;
    }
  }

  // Define refresh logic
  const refresh = async () => {
    try {
      const folder = getPromptFolder(branch);
      let result;
      // Get most recent ETag from cache data if available (even if stale)
      // Note: cacheData variable is from outer scope, but we want the fresh one if we re-read?
      // Actually cacheData is local. If we are refreshing, we use the etag from the cache we just read.
      const cachedETag = cacheData ? cacheData.etag : null;

      try {
        result = await listPromptsViaTrees(owner, repo, branch, folder, cachedETag);

        if (result.notModified && cacheData) {
           // Update timestamp to extend cache validity
           cacheData.timestamp = Date.now();
           sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
           // If not modified, we don't strictly need to call onUpdate if the data hasn't changed.
           // But if this was a background refresh, the UI might want to know that "loading" is done?
           // The original code didn't do anything if not modified (except update timestamp).
           // "if (result.notModified && parsedCache) { ... return; }"
           // So we return the existing files.
           return cacheData.files;
        }

        // New data received
        files = (result.files || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');

      } catch (e) {
        console.warn('Trees API failed, using Contents fallback');
        try {
          const data = await listPromptsViaContents(owner, repo, branch, folder);
          files = (data || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');
          result = { files, etag: null }; // Contents API doesn't provide ETag
        } catch (contentsError) {
          console.error('Both API strategies failed:', contentsError);
          throw contentsError;
        }
      }

      // Save to cache
      const newCacheData = {
        files,
        etag: result ? result.etag : null,
        timestamp: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(newCacheData));

      if (onUpdate) {
        onUpdate(files);
      }
      return files;

    } catch (error) {
       throw error;
    }
  };

  if (cacheData) {
    files = cacheData.files || [];
    const cacheAge = now - (cacheData.timestamp || 0);

    // Trigger background refresh if stale
    if (cacheAge > CACHE_DURATION) {
      refresh().catch(error => {
        console.error('Background list refresh failed:', {
            error,
            context: 'loadPrompts.backgroundRefresh',
            owner, repo, branch
        });
      });
    }

    // Return cached data immediately
    return files;
  }

  // No cache, await refresh
  return await refresh();
}
