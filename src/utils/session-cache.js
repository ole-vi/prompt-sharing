// Session storage cache utilities
import { CACHE_DURATIONS, CACHE_POLICIES, CACHE_KEYS as CONST_CACHE_KEYS } from './constants.js';

// Re-export keys for backward compatibility
export const CACHE_KEYS = CONST_CACHE_KEYS;

function getCacheKey(key, userId) {
  return userId ? `${key}_${userId}` : key;
}

/**
 * Get the current state of a cache entry
 * @param {string} key - The cache key
 * @param {string} [userId] - Optional user ID
 * @returns {object|null} - State object or null if not found
 */
export function getCacheState(key, userId = null) {
  try {
    const cacheKey = getCacheKey(key, userId);
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) return null;

    let parsed;
    try {
      parsed = JSON.parse(cached);
    } catch (e) {
      console.warn('Invalid JSON in cache for key:', cacheKey);
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    const { data, timestamp } = parsed;

    // Determine policy
    // If key is a string not in CACHE_POLICIES, use default
    const policy = CACHE_POLICIES[key] || {
      ttl: CACHE_DURATIONS.short,
      strategy: 'default'
    };

    const now = Date.now();
    const age = now - (timestamp || 0);

    let isExpired = false;
    // session (0) means never expires by time
    if (policy.ttl !== CACHE_DURATIONS.session) {
      if (age > policy.ttl) {
        isExpired = true;
      }
    }

    // Determine staleness (can be same as expired, or different if we had separate SWR ttl)
    const isStale = isExpired;

    return {
      key: cacheKey,
      data,
      timestamp,
      age,
      policy,
      isExpired,
      isStale
    };
  } catch (error) {
    console.error('Error getting cache state:', error);
    return null;
  }
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

export function getCache(key, userId = null) {
  try {
    const state = getCacheState(key, userId);
    
    if (!state) return null;

    if (state.isExpired) {
      const cacheKey = getCacheKey(key, userId);
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    return state.data;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

export function invalidateCache(key, userId = null) {
  try {
    const cacheKey = getCacheKey(key, userId);
    sessionStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

export function clearCache(key, userId = null) {
  return invalidateCache(key, userId);
}

export function clearAllCache() {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}
