import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processOAuthCallback } from '../pages/oauth-callback-page.js';
import { signInWithGitHub, generateNonce } from '../modules/auth.js';
import { GITHUB_CONFIG } from '../utils/constants.js';

// Mocks
const { mockSignInWithCredential } = vi.hoisted(() => {
  return {
    mockSignInWithCredential: vi.fn().mockResolvedValue({ user: { uid: '123' } })
  }
});

vi.mock('../firebase-init.js', () => ({
  getFirebaseReady: vi.fn().mockResolvedValue(true)
}));

vi.mock('../modules/firebase-service.js', () => ({
  getAuth: vi.fn(() => ({
      signInWithCredential: mockSignInWithCredential,
      signInWithPopup: vi.fn(),
      currentUser: null
  }))
}));

vi.mock('../modules/toast.js', () => ({
  showToast: vi.fn()
}));

// Mock Firebase Global
global.firebase = {
  auth: {
    GithubAuthProvider: {
      credential: vi.fn().mockReturnValue('mock-credential')
    }
  }
};

describe('OAuth Flow Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock sessionStorage/localStorage
    const storageMock = () => {
      let store = {};
      return {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
        removeItem: vi.fn(key => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
      };
    };

    Object.defineProperty(window, 'sessionStorage', { value: storageMock(), writable: true });
    Object.defineProperty(window, 'localStorage', { value: storageMock(), writable: true });

    // Mock window.location
    delete window.location;
    window.location = {
      href: '',
      search: '',
      pathname: '/oauth-callback.html'
    };

    // Mock fetch
    global.fetch = vi.fn();

    // Mock DOM elements
    document.body.innerHTML = `
      <div id="status"></div>
      <div class="message"></div>
      <div class="spinner"></div>
    `;

    // Mock Chrome Runtime
    global.chrome = {
        runtime: {
            sendMessage: vi.fn(),
            lastError: null
        }
    };

    // Mock crypto if needed
    if (!global.crypto) {
        global.crypto = {
            getRandomValues: (arr) => {
                for(let i=0; i<arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
                return arr;
            }
        };
    }
  });

  describe('signInWithGitHub (Initiation)', () => {
    it('should generate nonce, store it, and redirect with correct state', async () => {
      await signInWithGitHub();

      // Check nonce storage
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('oauth_nonce', expect.any(String));
      const nonce = window.sessionStorage.setItem.mock.calls[0][1];

      // Check redirect
      const url = new URL(window.location.href);
      expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe(GITHUB_CONFIG.clientId);
      expect(url.searchParams.get('redirect_uri')).toBe(GITHUB_CONFIG.redirectUri);
      expect(url.searchParams.get('state')).toBe(`webapp-${nonce}`);
    });
  });

  describe('processOAuthCallback (Validation)', () => {
    it('should validate legitimate webapp flow', async () => {
      const nonce = 'valid-nonce-123';
      const code = 'auth-code-123';
      const state = `webapp-${nonce}`;

      // Setup storage
      window.sessionStorage.getItem.mockReturnValue(nonce);
      window.location.search = `?code=${code}&state=${state}`;

      // Mock successful token exchange
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'gh_token_123' })
      });

      await processOAuthCallback();

      // Verify nonce checked
      expect(window.sessionStorage.getItem).toHaveBeenCalledWith('oauth_nonce');
      // Verify nonce cleared
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('oauth_nonce');
      // Verify token exchange
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('githubOAuthExchange'),
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ code, state })
        })
      );
      // Verify sign in
      expect(mockSignInWithCredential).toHaveBeenCalledWith('mock-credential');
      // Verify local storage
      expect(window.localStorage.setItem).toHaveBeenCalledWith('github_access_token', expect.stringContaining('gh_token_123'));
      // Verify success message
      expect(document.querySelector('.success').textContent).toContain('Successfully signed in');
    });

    it('should reject flow with invalid nonce', async () => {
      const nonce = 'valid-nonce-123';
      const code = 'auth-code-123';
      const state = `webapp-ATTACKER-NONCE`;

      // Setup storage
      window.sessionStorage.getItem.mockReturnValue(nonce);
      window.location.search = `?code=${code}&state=${state}`;

      await processOAuthCallback();

      // Verify error
      expect(document.querySelector('.error').textContent).toContain('Invalid or expired login session');
      // Verify fetch NOT called
      expect(global.fetch).not.toHaveBeenCalled();
      // Verify sign in NOT called
      expect(mockSignInWithCredential).not.toHaveBeenCalled();
    });

    it('should reject flow with missing nonce in storage', async () => {
      const code = 'auth-code-123';
      const state = `webapp-some-nonce`;

      // Setup storage (returns null)
      window.sessionStorage.getItem.mockReturnValue(null);
      window.location.search = `?code=${code}&state=${state}`;

      await processOAuthCallback();

      expect(document.querySelector('.error').textContent).toContain('Invalid or expired login session');
    });

    it('should delegate extension flow to chrome.runtime', async () => {
      const code = 'ext-code';
      const state = 'extension-abc-123'; // 123 is ext id

      window.location.search = `?code=${code}&state=${state}`;

      await processOAuthCallback();

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
          '123',
          { action: 'oauthCallback', code, state },
          expect.any(Function)
      );
      expect(mockSignInWithCredential).not.toHaveBeenCalled();
    });
  });
});
