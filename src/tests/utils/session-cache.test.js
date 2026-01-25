import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setCache, getCache, getCacheState, clearCache, CACHE_KEYS, invalidateCache } from '../../utils/session-cache.js';
import { CACHE_POLICIES } from '../../utils/constants.js';

describe('session-cache', () => {
  let originalDateNow;

  beforeEach(() => {
    sessionStorage.clear();
    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
    sessionStorage.clear();
  });

  describe('CACHE_KEYS', () => {
    it('should export all cache key constants', () => {
      expect(CACHE_KEYS).toBeDefined();
      expect(CACHE_KEYS.JULES_ACCOUNT).toBe('jules_account_info');
    });
  });

  describe('setCache', () => {
    it('should store data with timestamp', () => {
      const testData = { name: 'test', value: 123 };
      const mockTime = 1234567890;
      Date.now = () => mockTime;

      setCache('test_key', testData);

      const stored = JSON.parse(sessionStorage.getItem('test_key'));
      expect(stored.data).toEqual(testData);
      expect(stored.timestamp).toBe(mockTime);
    });

    it('should store data with userId suffix', () => {
      const testData = { name: 'test' };
      
      setCache('test_key', testData, 'user123');

      expect(sessionStorage.getItem('test_key_user123')).toBeDefined();
      expect(sessionStorage.getItem('test_key')).toBeNull();
    });
  });

  describe('getCacheState', () => {
    it('should return null for missing key', () => {
      expect(getCacheState('missing')).toBeNull();
    });

    it('should return valid state for fresh cache', () => {
      const testData = { foo: 'bar' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('test_key', testData);

      const state = getCacheState('test_key');
      expect(state).not.toBeNull();
      expect(state.data).toEqual(testData);
      expect(state.timestamp).toBe(mockTime);
      expect(state.age).toBe(0);
      expect(state.isExpired).toBe(false);
      expect(state.isStale).toBe(false);
    });

    it('should return expired state for expired cache', () => {
      const testData = { foo: 'bar' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      // Default TTL is short (5 mins = 300000ms)
      setCache('test_key', testData);

      Date.now = () => mockTime + 300001;

      const state = getCacheState('test_key');
      expect(state).not.toBeNull();
      expect(state.isExpired).toBe(true);
      expect(state.isStale).toBe(true);
      // Data should still be accessible in state even if expired
      expect(state.data).toEqual(testData);
    });

    it('should respect specific policy durations', () => {
      const testData = { session: 'data' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache(CACHE_KEYS.JULES_ACCOUNT, testData);

      // JULES_ACCOUNT is session duration (never expires by time)
      Date.now = () => mockTime + 100000000; // Long time later

      const state = getCacheState(CACHE_KEYS.JULES_ACCOUNT);
      expect(state.isExpired).toBe(false);
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      sessionStorage.setItem('bad_json', '{invalid');

      const state = getCacheState('bad_json');
      expect(state).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getCache', () => {
    it('should retrieve cached data within time limit', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('test_key', testData);
      Date.now = () => mockTime + 60000;

      const retrieved = getCache('test_key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for expired cache and remove it', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('unknown_key', testData);
      Date.now = () => mockTime + 300001; // Past 5 min default

      const retrieved = getCache('unknown_key');
      expect(retrieved).toBeNull();
      expect(sessionStorage.getItem('unknown_key')).toBeNull();
    });

    it('should return session cache regardless of time', () => {
      const testData = { account: 'test' };
      setCache(CACHE_KEYS.JULES_ACCOUNT, testData);
      
      const retrieved = getCache(CACHE_KEYS.JULES_ACCOUNT);
      expect(retrieved).toEqual(testData);
    });
  });

  describe('invalidateCache', () => {
    it('should remove item from storage', () => {
      setCache('key', 'val');
      invalidateCache('key');
      expect(sessionStorage.getItem('key')).toBeNull();
    });

    it('should remove item with user ID', () => {
      setCache('key', 'val', 'user1');
      invalidateCache('key', 'user1');
      expect(sessionStorage.getItem('key_user1')).toBeNull();
    });
  });

  describe('clearCache alias', () => {
    it('should behave same as invalidateCache', () => {
      setCache('key', 'val');
      clearCache('key');
      expect(sessionStorage.getItem('key')).toBeNull();
    });
  });
});
