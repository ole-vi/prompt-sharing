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
  USER_PROFILE: 'user_profile'
};

// Map keys to specific cache durations
const KEY_DURATIONS = {
  JULES_ACCOUNT: CACHE_DURATIONS.session,
  QUEUE_ITEMS: CACHE_DURATIONS.session,
  BRANCHES: CACHE_DURATIONS.session,
  DEFAULT: CACHE_DURATIONS.short
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
    
    const duration = KEY_DURATIONS[key] || KEY_DURATIONS.DEFAULT;
    
    // A duration of 0 means session-only cache
    if (duration === CACHE_DURATIONS.session) {
      return data;
    }
    
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
