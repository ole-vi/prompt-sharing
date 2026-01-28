// Session storage cache utilities
import { CACHE_DURATIONS, CACHE_KEYS, CACHE_POLICIES, CACHE_STRATEGIES } from './constants.js';

export { CACHE_KEYS };

function getSessionId() {
  try {
    const tokenStr = localStorage.getItem('github_access_token');
    if (!tokenStr) return null;
    const data = JSON.parse(tokenStr);
    if (!data || !data.token) return null;

    let hash = 5381;
    for (let i = 0; i < data.token.length; i++) {
      hash = ((hash << 5) + hash) + data.token.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  } catch (error) {
    return null;
  }
}

function getCacheKey(key, userId) {
  const sessionId = getSessionId();
  let cacheKey = key;
  if (userId) {
    cacheKey += `_${userId}`;
  }
  if (sessionId) {
    cacheKey += `_${sessionId}`;
  }
  return cacheKey;
}

export function setCache(key, data, userId = null) {
  try {
    const cacheKey = getCacheKey(key, userId);
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

/**
 * Get detailed state of a cache item
 * @param {string} key - Cache key
 * @param {string} [userId] - Optional user ID
 * @returns {object} Cache state metadata
 */
export function getCacheState(key, userId = null) {
  try {
    const cacheKey = getCacheKey(key, userId);
    const cached = sessionStorage.getItem(cacheKey);
    const policy = CACHE_POLICIES[key] || CACHE_POLICIES.DEFAULT;

    if (!cached) {
      return {
        exists: false,
        data: null,
        timestamp: null,
        age: 0,
        isStale: true,
        policy
      };
    }

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    // Check staleness based on policy TTL
    // Session-duration caches (ttl === 0) never expire within the session
    // Time-based caches are stale when age exceeds their TTL
    // If age is NaN (missing timestamp), treat as stale
    const isSessionCache = policy.ttl === CACHE_DURATIONS.session;
    const isStale = isNaN(age) || (!isSessionCache && age >= policy.ttl);

    return {
      exists: true,
      data,
      timestamp,
      age,
      isStale,
      policy
    };
  } catch (error) {
    console.error('Error getting cache state:', error);
    return {
      exists: false,
      data: null,
      timestamp: null,
      age: 0,
      isStale: true,
      policy: CACHE_POLICIES[key] || CACHE_POLICIES.DEFAULT,
      error
    };
  }
}

export function getCache(key, userId = null) {
  try {
    const state = getCacheState(key, userId);
    
    if (!state.exists) return null;

    // Handle staleness based on strategy
    if (state.isStale) {
      switch (state.policy.strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
          // Expired cache is invalid - clear and return null
          clearCache(key, userId);
          return null;
        
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
          // SWR would return stale data and trigger background refresh
          // Not implemented yet - treat as CACHE_FIRST for now
          clearCache(key, userId);
          return null;
        
        case CACHE_STRATEGIES.NETWORK_ONLY:
          // Network-only doesn't use cache - this shouldn't happen
          // but clear and return null to be safe
          clearCache(key, userId);
          return null;
        
        default:
          // Unknown strategy - fail safe by clearing stale cache
          clearCache(key, userId);
          return null;
      }
    }

    return state.data;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

export function clearCache(key, userId = null) {
  try {
    const cacheKey = getCacheKey(key, userId);
    sessionStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export function clearAllCache() {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}
