import { listPromptsViaContents, listPromptsViaTrees, getRateLimitInfo } from './github-api.js';
import statusBar from './status-bar.js';
import { recordCacheAccess, enforceCacheLimit } from '../utils/cache-manager.js';

export function getPromptFolder(branch) {
  return branch === 'web-captures' ? 'webcaptures' : 'prompts';
}

function checkRateLimit() {
  const rateLimitInfo = getRateLimitInfo();
  if (rateLimitInfo.remaining !== null && rateLimitInfo.reset !== null) {
    if (rateLimitInfo.remaining <= 10) {
      statusBar.showRateLimitWarning(rateLimitInfo.remaining, rateLimitInfo.reset);
    }
  }
}

export async function loadPrompts(owner, repo, branch, cacheKey, onBackgroundUpdate) {
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();
  let files = [];

  try {
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      let cacheData;
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

      if (cacheData) {
        // Record cache access for LRU tracking
        recordCacheAccess(cacheKey);
        
        const cacheAge = now - (cacheData.timestamp || 0);
        files = cacheData.files || [];

        // If stale, refresh in background
        if (cacheAge > CACHE_DURATION) {
          fetchPrompts(owner, repo, branch, cacheKey).then((updatedFiles) => {
             // Only notify if we have files and a callback
             if (updatedFiles && onBackgroundUpdate) {
               onBackgroundUpdate(updatedFiles);
             }
          }).catch(error => {
            console.error('Background list refresh failed:', {
              error,
              context: 'prompt-service.loadPrompts.backgroundRefresh',
              owner, repo, branch
            });
          });
        }

        return files;
      }
    }

    // No cache or invalid, fetch and wait
    files = await fetchPrompts(owner, repo, branch, cacheKey);
    return files;
  } catch (e) {
    throw e;
  }
}

async function fetchPrompts(owner, repo, branch, cacheKey) {
  let result;
  const folder = getPromptFolder(branch);

  // Get cached ETag if available
  const cached = sessionStorage.getItem(cacheKey);
  let cachedETag = null;
  let parsedCache = null;

  if (cached) {
    try {
      parsedCache = JSON.parse(cached);
      if (parsedCache && typeof parsedCache === 'object' && !Array.isArray(parsedCache)) {
        cachedETag = parsedCache.etag || null;
      }
    } catch (e) {
      // Ignore parsing error here
    }
  }

  try {
    result = await listPromptsViaTrees(owner, repo, branch, folder, cachedETag);

    // If not modified, keep using cached data
    if (result.notModified && parsedCache) {
      // Update timestamp to extend cache validity
      parsedCache.timestamp = Date.now();
      sessionStorage.setItem(cacheKey, JSON.stringify(parsedCache));
      return parsedCache.files;
    }

    // New data received
    const files = (result.files || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');

    const cacheData = {
      files,
      etag: result.etag,
      timestamp: Date.now()
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    
    // Enforce cache size limits with LRU eviction
    enforceCacheLimit();
    
    // Check rate limits after successful API call
    checkRateLimit();
    
    return files;

  } catch (e) {
    // Handle rate limit errors specifically
    if (e.isRateLimit) {
      const resetTime = e.resetTime || Date.now() + 3600000;
      const minutesUntilReset = Math.ceil((resetTime - Date.now()) / 60000);
      statusBar.showMessage(
        `GitHub API rate limit exceeded. Try again in ${minutesUntilReset} minutes.`,
        { timeout: 15000 }
      );
      throw e;
    }
    
    console.warn('Trees API failed, using Contents fallback');
    
    // Show progress message for slow fallback
    statusBar.showMessage('Loading prompts (this may take a moment)...', { timeout: 0 });
    
    try {
      const data = await listPromptsViaContents(owner, repo, branch, folder);
      const files = (data || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');

      const cacheData = {
        files,
        etag: null,
        timestamp: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Enforce cache size limits with LRU eviction
      enforceCacheLimit();
      
      // Check rate limits after successful API call
      checkRateLimit();
      
      // Clear progress message
      statusBar.clear();
      
      return files;
    } catch (contentsError) {
      // Clear progress message on error
      statusBar.clear();
      
      // Handle rate limit errors from Contents API
      if (contentsError.isRateLimit) {
        const resetTime = contentsError.resetTime || Date.now() + 3600000;
        const minutesUntilReset = Math.ceil((resetTime - Date.now()) / 60000);
        statusBar.showMessage(
          `GitHub API rate limit exceeded. Try again in ${minutesUntilReset} minutes.`,
          { timeout: 15000 }
        );
      }
      
      console.error('Both API strategies failed:', contentsError);
      throw contentsError;
    }
  }
}
