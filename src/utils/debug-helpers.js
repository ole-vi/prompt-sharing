import { getCacheState, CACHE_KEYS } from './session-cache.js';

export function initDebugHelpers() {
  window.inspectCache = () => {
    const table = [];
    const user = window.auth?.currentUser;
    const userId = user?.uid;

    console.group('Cache Inspection');
    console.log('Current User ID:', userId || 'None');

    // Iterate over known keys
    Object.entries(CACHE_KEYS).forEach(([keyName, keyValue]) => {
      // Check both user-scoped and global for each known key
      const checks = [{ uid: null, label: 'Global' }];
      if (userId) checks.push({ uid: userId, label: 'User' });

      checks.forEach(({ uid, label }) => {
          const state = getCacheState(keyValue, uid);
          if (state.exists) {
              table.push({
                  Key: keyName,
                  Scope: label,
                  'Storage Key': uid ? `${keyValue}_${uid}` : keyValue,
                  Age: `${(state.age / 1000).toFixed(1)}s`,
                  TTL: state.policy.ttl === 0 ? 'Session' : `${(state.policy.ttl / 1000).toFixed(1)}s`,
                  Status: state.isStale ? 'STALE' : 'VALID',
                  Strategy: state.policy.strategy
              });
          }
      });
    });

    if (table.length === 0) {
      console.log('Cache is empty.');
    } else {
      console.table(table);
    }
    console.groupEnd();
  };

  console.log('Debug helpers initialized. Use window.inspectCache() to view cache state.');
}

// Auto-init if running in browser
if (typeof window !== 'undefined') {
    initDebugHelpers();
}
