import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchVersion } from '../../modules/version-check.js';
import * as githubApi from '../../modules/github-api.js';
import { CACHE_KEYS, CACHE_DURATIONS } from '../../utils/constants.js';

// Mock dependencies
vi.mock('../../modules/github-api.js', () => ({
  fetchJSON: vi.fn(),
}));

describe('version-check', () => {
  let appVersionMock;
  let updateBannerMock;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock DOM
    appVersionMock = {
      textContent: '',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    document.getElementById = vi.fn((id) => {
      if (id === 'appVersion') return appVersionMock;
      if (id === 'updateBanner') return updateBannerMock; // usually null initially
      return null;
    });

    document.querySelector = vi.fn((selector) => {
      if (selector === 'meta[name="app-version"]') {
        return { content: 'sha|2023-01-01' };
      }
      return null;
    });

    document.createElement = vi.fn(() => ({
      classList: { add: vi.fn() },
      addEventListener: vi.fn(),
      remove: vi.fn(),
      appendChild: vi.fn(),
    }));

    vi.spyOn(document.body, 'insertBefore').mockImplementation(() => {});
    vi.spyOn(document.body.classList, 'add');
    vi.spyOn(document.body.classList, 'remove');

    // Mock Storage
    const storageMock = (() => {
      let store = {};
      return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
        clear: vi.fn(() => { store = {}; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
      };
    })();

    Object.defineProperty(window, 'sessionStorage', { value: storageMock, writable: true });
    Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should use cached data if fresh', async () => {
    // Make current version match fresh data so appVersion text updates to it
    document.querySelector.mockImplementation((s) => {
        if (s === 'meta[name="app-version"]') return { content: 'abcdef|2023-10-27T10:00:00Z' };
        return null;
    });

    const freshData = {
      data: { sha: 'abcdef', commit: { committer: { date: '2023-10-27T10:00:00Z' } } },
      timestamp: Date.now() - 1000 // 1 sec old
    };
    sessionStorage.setItem(CACHE_KEYS.VERSION_INFO, JSON.stringify(freshData));

    await fetchVersion();

    expect(githubApi.fetchJSON).not.toHaveBeenCalled();
    expect(appVersionMock.textContent).toContain('v2023-10-27 (abcdef)');
  });

  it('should fetch from API if cache is missing', async () => {
    document.querySelector.mockImplementation((s) => {
        if (s === 'meta[name="app-version"]') return { content: '1234567|2023-10-28T10:00:00Z' };
        return null;
    });

    sessionStorage.getItem.mockReturnValue(null);
    const apiData = { sha: '1234567', commit: { committer: { date: '2023-10-28T10:00:00Z' } } };
    githubApi.fetchJSON.mockResolvedValue(apiData);

    await fetchVersion();

    expect(githubApi.fetchJSON).toHaveBeenCalled();
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      CACHE_KEYS.VERSION_INFO,
      expect.stringContaining('"sha":"1234567"')
    );
    expect(appVersionMock.textContent).toContain('v2023-10-28 (1234567)');
  });

  it('should fetch from API if cache is stale', async () => {
    document.querySelector.mockImplementation((s) => {
        if (s === 'meta[name="app-version"]') return { content: 'newsha|2023-10-28T10:00:00Z' };
        return null;
    });

    const staleData = {
      data: { sha: 'oldsha', commit: { committer: { date: '2020-01-01' } } },
      timestamp: Date.now() - (CACHE_DURATIONS.versionCheck + 1000)
    };
    sessionStorage.setItem(CACHE_KEYS.VERSION_INFO, JSON.stringify(staleData));

    const apiData = { sha: 'newsha', commit: { committer: { date: '2023-10-28T10:00:00Z' } } };
    githubApi.fetchJSON.mockResolvedValue(apiData);

    await fetchVersion();

    expect(githubApi.fetchJSON).toHaveBeenCalled();
    expect(appVersionMock.textContent).toContain('v2023-10-28 (newsha)');
  });

  it('should handle rate limiting (API returns null)', async () => {
    githubApi.fetchJSON.mockResolvedValue(null);

    await fetchVersion();

    expect(appVersionMock.textContent).toBe('version check rate limited');
    expect(appVersionMock.classList.add).toHaveBeenCalledWith('version-badge');
  });

  it('should handle API errors', async () => {
    githubApi.fetchJSON.mockRejectedValue(new Error('Network error'));

    await fetchVersion();

    expect(appVersionMock.textContent).toBe('version unavailable');
  });

  it('should show update banner if new version available', async () => {
    const apiData = { sha: 'newsha', commit: { committer: { date: '2099-01-01T10:00:00Z' } } }; // Future date
    githubApi.fetchJSON.mockResolvedValue(apiData);

    await fetchVersion();

    expect(document.body.insertBefore).toHaveBeenCalled();
    expect(document.body.classList.add).toHaveBeenCalledWith('has-version-banner');
  });

  it('should NOT show update banner if new version NOT available', async () => {
    const apiData = { sha: 'sha', commit: { committer: { date: '2023-01-01T00:00:00Z' } } }; // Same as current mocked meta
    githubApi.fetchJSON.mockResolvedValue(apiData);

    await fetchVersion();

    expect(document.body.insertBefore).not.toHaveBeenCalled();
  });
});
