import { CACHE_POLICIES } from './constants.js';

export function inspectCache() {
  const results = [];
  const now = Date.now();
  const storageKeys = [];

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      storageKeys.push(sessionStorage.key(i));
    }

    storageKeys.forEach(storageKey => {
      // Try to parse
      let data;
      try {
        const raw = sessionStorage.getItem(storageKey);
        data = JSON.parse(raw);
      } catch (e) {
        return; // Not valid JSON
      }

      if (!data || !data.timestamp) return; // Not our cache format

      // Try to match with a known policy key
      let policyKey = 'UNKNOWN';
      let policy = null;

      for (const [pk, val] of Object.entries(CACHE_POLICIES)) {
        // Check if storageKey is pk or starts with pk_
        if (storageKey === pk || storageKey.startsWith(`${pk}_`)) {
          policyKey = pk;
          policy = val;
          break;
        }
      }

      const ageMs = now - data.timestamp;
      const isExpired = policy && policy.ttl !== 0 && ageMs > policy.ttl;

      let itemsCount = '1';
      if (data.data) {
        if (Array.isArray(data.data)) {
          itemsCount = data.data.length;
        } else if (typeof data.data === 'object') {
           if (data.data.files && Array.isArray(data.data.files)) {
             itemsCount = `Files: ${data.data.files.length}`;
           } else {
             itemsCount = 'Object';
           }
        }
      }

      results.push({
        Key: storageKey,
        Type: policyKey,
        Age: formatDuration(ageMs),
        TTL: policy ? (policy.ttl === 0 ? 'Session' : formatDuration(policy.ttl)) : '?',
        Strategy: policy ? policy.strategy : '?',
        Status: isExpired ? 'EXPIRED' : 'FRESH',
        Items: itemsCount
      });
    });

    if (results.length === 0) {
      console.log('No Jules cache items found in sessionStorage.');
    } else {
      console.table(results);
    }
    return results;
  } catch (err) {
    console.error('Error inspecting cache:', err);
    return [];
  }
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms/60000).toFixed(1)}m`;
  return `${(ms/3600000).toFixed(1)}h`;
}
