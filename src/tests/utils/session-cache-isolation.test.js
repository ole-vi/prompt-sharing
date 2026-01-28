import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setCache, getCache, getCacheState, clearAllCache, CACHE_KEYS } from '../../utils/session-cache.js';

describe('session-cache isolation', () => {
  let originalDateNow;

  // Mock localStorage
  const mockLocalStorage = (() => {
    let store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value.toString(); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; }
    };
  })();

  const originalLocalStorage = global.localStorage;

  const calculateHash = (str) => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  };

  beforeEach(() => {
    sessionStorage.clear();
    // Replace global localStorage with mock
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    mockLocalStorage.clear();

    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
    sessionStorage.clear();
    mockLocalStorage.clear();
    // Restore original localStorage
    if (originalLocalStorage) {
       Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
    }
  });

  it('should generate base keys when no token is present', () => {
    setCache('test_key', { data: 'guest' });

    // Check sessionStorage directly to verify key format
    // Without token, it should be just 'test_key' or 'test_key_userId'
    expect(sessionStorage.getItem('test_key')).not.toBeNull();
    const stored = JSON.parse(sessionStorage.getItem('test_key'));
    expect(stored.data).toEqual({ data: 'guest' });
  });

  it('should generate token-specific keys when token is present', () => {
    // Set token
    const tokenData = { token: 'tokenA', timestamp: Date.now() };
    localStorage.setItem('github_access_token', JSON.stringify(tokenData));

    setCache('test_key', { data: 'userA' });

    // Calculate expected hash for 'tokenA'
    const expectedHash = calculateHash('tokenA');

    // Expect key to be test_key_hash
    expect(sessionStorage.getItem(`test_key_${expectedHash}`)).not.toBeNull();
    expect(sessionStorage.getItem('test_key')).toBeNull();

    const stored = JSON.parse(sessionStorage.getItem(`test_key_${expectedHash}`));
    expect(stored.data).toEqual({ data: 'userA' });
  });

  it('should fallback to base key if token is invalid JSON', () => {
    localStorage.setItem('github_access_token', 'invalid-json');

    setCache('test_key', { data: 'fallback' });

    expect(sessionStorage.getItem('test_key')).not.toBeNull();
  });

  it('should isolate data between different tokens', () => {
    // User A
    const tokenA = { token: 'tokenA', timestamp: Date.now() }; // hash 610 -> 'gw'
    localStorage.setItem('github_access_token', JSON.stringify(tokenA));
    setCache('profile', { name: 'Alice' });

    // Verify User A can read it
    expect(getCache('profile')).toEqual({ name: 'Alice' });

    // User B
    const tokenB = { token: 'tokenB', timestamp: Date.now() };
    // 't'(116)+...+'B'(66) = 611
    localStorage.setItem('github_access_token', JSON.stringify(tokenB));

    // Verify User B cannot read User A's data
    expect(getCache('profile')).toBeNull();

    // User B sets their own data
    setCache('profile', { name: 'Bob' });
    expect(getCache('profile')).toEqual({ name: 'Bob' });

    // Switch back to User A
    localStorage.setItem('github_access_token', JSON.stringify(tokenA));
    expect(getCache('profile')).toEqual({ name: 'Alice' });
  });

  it('should include userId in key along with token hash', () => {
    const tokenData = { token: 'tokenA', timestamp: Date.now() };
    localStorage.setItem('github_access_token', JSON.stringify(tokenData));
    const expectedHash = calculateHash('tokenA');

    setCache('repos', ['repo1'], 'user123');

    // Expected key: repos_user123_hash
    const expectedKey = `repos_user123_${expectedHash}`;
    expect(sessionStorage.getItem(expectedKey)).not.toBeNull();

    expect(getCache('repos', 'user123')).toEqual(['repo1']);
  });

  it('should handle clearing cache with token isolation', () => {
    const tokenData = { token: 'tokenA', timestamp: Date.now() };
    localStorage.setItem('github_access_token', JSON.stringify(tokenData));

    setCache('key1', 'value1');
    setCache('key2', 'value2');

    clearAllCache();

    expect(getCache('key1')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
