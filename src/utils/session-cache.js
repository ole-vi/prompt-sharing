// Session storage cache utilities
import { CACHE_DURATIONS } from './constants.js';

const CACHE_KEYS = {
  JULES_ACCOUNT: 'jules_account_info',
  JULES_SESSIONS: 'jules_sessions',
  JULES_REPOS: 'jules_repos',
  QUEUE_ITEMS: 'queue_items',
  BRANCHES: 'branches_v2',
  CURRENT_BRANCH: 'current_branch',
  CURRENT_REPO: 'current_repo',
  USER_PROFILE: 'user_profile',
  USER_AVATAR: 'user_avatar'
};

// Map keys to specific cache durations
const KEY_DURATIONS = {
  JULES_ACCOUNT: CACHE_DURATIONS.session,
  QUEUE_ITEMS: CACHE_DURATIONS.session,
  BRANCHES: CACHE_DURATIONS.session,
  USER_AVATAR: CACHE_DURATIONS.session,
  DEFAULT: CACHE_DURATIONS.short
};

// Metrics for cache performance
const cacheStats = {
  hits: 0,
  misses: 0,
  revalidations: 0
};

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

export function getCache(key, userId = null) {
  try {
    const cacheKey = getCacheKey(key, userId);
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) {
      cacheStats.misses++;
      return null;
    }

    const { data, timestamp } = JSON.parse(cached);
    
    const duration = KEY_DURATIONS[key] || KEY_DURATIONS.DEFAULT;
    
    // A duration of 0 means session-only cache
    if (duration === CACHE_DURATIONS.session) {
      cacheStats.hits++;
      if (cacheStats.hits % 5 === 0) logCacheStats();
      return data;
    }
    
    const age = Date.now() - timestamp;
    if (age < duration) {
      cacheStats.hits++;
      if (cacheStats.hits % 5 === 0) logCacheStats();
      return data;
    }

    // Clear expired cache
    sessionStorage.removeItem(cacheKey);
    cacheStats.misses++;
    return null;
  } catch (error) {
    console.error('Error getting cache:', error);
    cacheStats.misses++;
    return null;
  }
}

export function setCacheWithETag(key, data, etag) {
  try {
    const cacheData = {
      data,
      etag,
      timestamp: Date.now()
    };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cache with ETag:', error);
  }
}

export function getCacheWithETag(key) {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) {
      cacheStats.misses++;
      return null;
    }

    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== 'object') {
       sessionStorage.removeItem(key);
       cacheStats.misses++;
       return null;
    }

    // Migration for legacy cache which used 'files' instead of 'data'
    if (parsed.files && !parsed.data) {
        parsed.data = parsed.files;
    }

    return parsed;
  } catch (error) {
    console.error('Error getting cache with ETag:', error);
    cacheStats.misses++;
    return null;
  }
}

export function updateCacheTimestamp(key) {
    try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
            const parsed = JSON.parse(cached);
            parsed.timestamp = Date.now();
            sessionStorage.setItem(key, JSON.stringify(parsed));
            cacheStats.revalidations++;
            if (cacheStats.revalidations % 5 === 0) logCacheStats();
        }
    } catch (error) {
        console.error('Error updating cache timestamp:', error);
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

export function logCacheStats() {
    const total = cacheStats.hits + cacheStats.misses + cacheStats.revalidations;
    const hitRate = total > 0 ? (((cacheStats.hits + cacheStats.revalidations) / total) * 100).toFixed(1) : 0;
    console.log(`Cache Stats: Hits=${cacheStats.hits}, Revalidations=${cacheStats.revalidations}, Misses=${cacheStats.misses}, Effective Hit Rate=${hitRate}%`);
}

export { CACHE_KEYS };
