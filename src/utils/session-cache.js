// Session storage cache utilities
const CACHE_KEYS = {
  JULES_ACCOUNT: 'jules_account_info',
  JULES_SESSIONS: 'jules_sessions',
  JULES_REPOS: 'jules_repos',
  QUEUE_ITEMS: 'queue_items',
  BRANCHES: 'branches',
  CURRENT_BRANCH: 'current_branch',
  CURRENT_REPO: 'current_repo',
  USER_PROFILE: 'user_profile'
};

// Optional cache durations (set to null for session-only caching)
const CACHE_DURATION = {
  JULES_ACCOUNT: null, // Cache for entire session
  QUEUE_ITEMS: null,   // Cache until modified (we invalidate on changes)
  BRANCHES: null,      // Cache until branch change
  DEFAULT: 5 * 60 * 1000 // 5 minutes fallback
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
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    
    // Check if this key has a duration limit
    const duration = CACHE_DURATION[key] || CACHE_DURATION.DEFAULT;
    
    // If duration is null, cache for entire session (no expiration)
    if (duration === null) {
      return data;
    }
    
    // Otherwise check expiration
    const age = Date.now() - timestamp;
    if (age < duration) {
      return data;
    }

    // Clear expired cache
    sessionStorage.removeItem(cacheKey);
    return null;
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

export { CACHE_KEYS };
