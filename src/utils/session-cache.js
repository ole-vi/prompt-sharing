// Session storage cache utilities
import { CACHE_DURATIONS, CACHE_KEYS, CACHE_POLICIES, CACHE_STRATEGIES } from './constants.js';

export { CACHE_KEYS };

function getCacheKey(key, userId) {
  return userId ? `${key}_${userId}` : key;
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
    // If TTL is session (0), it's never stale within the session
    // If age is NaN (missing timestamp), treat as stale
    const isStale = isNaN(age) || (policy.ttl !== CACHE_DURATIONS.session && age >= policy.ttl);

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
    // For now, if CACHE_FIRST and stale, return null (behave like expired)
    // SWR logic would go here if we were implementing fetching
    
    if (state.isStale) {
      if (state.policy.strategy === CACHE_STRATEGIES.CACHE_FIRST) {
        // Clear expired cache
        clearCache(key, userId);
        return null;
      }
      // For STALE_WHILE_REVALIDATE, we might return data?
      // But getCache contract is "return valid data".
      // Let's stick to returning null if stale for now unless specified otherwise.
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
