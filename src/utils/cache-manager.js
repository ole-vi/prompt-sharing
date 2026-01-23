// Cache size management with LRU eviction
const MAX_CACHE_ENTRIES = 20;
const CACHE_ACCESS_KEY = 'cache_access_log';

/**
 * Get all cached prompt entries from sessionStorage
 * @returns {Array<{key: string, timestamp: number}>}
 */
function getCachedEntries() {
  const entries = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('prompts:')) {
      try {
        const data = JSON.parse(sessionStorage.getItem(key));
        if (data && data.timestamp) {
          entries.push({ key, timestamp: data.timestamp });
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
  }
  return entries;
}

/**
 * Get access log for tracking LRU
 * @returns {Map<string, number>}
 */
function getAccessLog() {
  try {
    const raw = sessionStorage.getItem(CACHE_ACCESS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch (e) {
    return new Map();
  }
}

/**
 * Save access log
 * @param {Map<string, number>} accessLog
 */
function saveAccessLog(accessLog) {
  try {
    const obj = Object.fromEntries(accessLog);
    sessionStorage.setItem(CACHE_ACCESS_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error('Error saving access log:', e);
  }
}

/**
 * Record access to a cache entry (updates LRU timestamp)
 * @param {string} cacheKey
 */
export function recordCacheAccess(cacheKey) {
  const accessLog = getAccessLog();
  accessLog.set(cacheKey, Date.now());
  saveAccessLog(accessLog);
}

/**
 * Enforce cache size limit using LRU eviction
 * Removes least recently used entries when cache exceeds MAX_CACHE_ENTRIES
 */
export function enforceCacheLimit() {
  try {
    const entries = getCachedEntries();
    
    // No need to evict if under limit
    if (entries.length <= MAX_CACHE_ENTRIES) {
      return;
    }
    
    const accessLog = getAccessLog();
    
    // Add last access time to entries (use creation timestamp as fallback)
    const entriesWithAccess = entries.map(entry => ({
      ...entry,
      lastAccess: accessLog.get(entry.key) || entry.timestamp
    }));
    
    // Sort by last access time (oldest first)
    entriesWithAccess.sort((a, b) => a.lastAccess - b.lastAccess);
    
    // Calculate how many to remove
    const numToRemove = entries.length - MAX_CACHE_ENTRIES;
    
    // Remove oldest entries
    for (let i = 0; i < numToRemove; i++) {
      const entry = entriesWithAccess[i];
      sessionStorage.removeItem(entry.key);
      accessLog.delete(entry.key);
      
      // Also remove associated expanded state
      const expandedKey = entry.key.replace('prompts:', 'sidebar:expanded:');
      sessionStorage.removeItem(expandedKey);
    }
    
    // Save updated access log
    saveAccessLog(accessLog);
    
    console.log(`Cache cleanup: removed ${numToRemove} LRU entries`);
  } catch (e) {
    console.error('Error enforcing cache limit:', e);
  }
}

/**
 * Get current cache statistics
 * @returns {{total: number, limit: number, utilizationPercent: number}}
 */
export function getCacheStats() {
  const entries = getCachedEntries();
  return {
    total: entries.length,
    limit: MAX_CACHE_ENTRIES,
    utilizationPercent: Math.round((entries.length / MAX_CACHE_ENTRIES) * 100)
  };
}
