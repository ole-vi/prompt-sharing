import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentUser, signInWithGitHub, signOutUser, updateAuthUI } from '../../modules/auth.js';

// Mock dependencies
vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../modules/jules-api.js', () => ({
  clearJulesKeyCache: vi.fn(),
}));

// Setup DOM elements
function setupDOM() {
  document.body.innerHTML = `
    <div id="authStatus"></div>
    <div id="userDisplay" style="display: flex;"></div>
    <img id="userAvatar" class="hidden" />
    <span id="userName"></span>
    <span id="dropdownUserName"></span>
    <img id="dropdownAvatar" />
    <button id="headerSignIn"></button>
    <button id="headerSignOut" class="hidden"></button>
  `;
}

describe('Auth Module', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
    window.auth = {
      currentUser: null,
      signInWithPopup: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChanged: vi.fn(),
    };
    // Mock firebase namespace
    window.firebase = {
      auth: {
        GithubAuthProvider: class {
            addScope() {}
        }
      }
    };
    // Mock localStorage
    const store = {};
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => store[k] = v);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k) => delete store[k]);
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('should update current user from window.auth', () => {
      const user = { uid: '123' };
      window.auth.currentUser = user;
      expect(getCurrentUser()).toBe(user);
    });
  });

  describe('signInWithGitHub', () => {
    it('should call signInWithPopup', async () => {
      window.auth.signInWithPopup.mockResolvedValue({
        credential: { accessToken: 'token123' }
      });

      await signInWithGitHub();

      expect(window.auth.signInWithPopup).toHaveBeenCalled();
      expect(localStorage.setItem).toHaveBeenCalledWith('github_access_token', expect.any(String));
    });
  });

  describe('signOutUser', () => {
    it('should call signOut', async () => {
      window.auth.currentUser = { uid: '123' };
      await signOutUser();

      expect(window.auth.signOut).toHaveBeenCalled();
      expect(localStorage.removeItem).toHaveBeenCalledWith('github_access_token');
    });
  });

  describe('updateAuthUI', () => {
      it('should update UI for logged in user', () => {
          const user = {
              uid: '123',
              displayName: 'Test User',
              photoURL: 'http://example.com/photo.jpg',
              email: 'test@example.com'
          };

          updateAuthUI(user);

          const avatar = document.getElementById('userAvatar');
          const signIn = document.getElementById('headerSignIn');
          const signOut = document.getElementById('headerSignOut');
          const ddName = document.getElementById('dropdownUserName');

          // Image loading is async in the code (onload), so we check the src was set
          expect(avatar.src).toBe(user.photoURL);
          // UI Logic: cached avatar might show it immediately, but here we don't have cache.
          // The code sets src and waits for onload.
          // We can check other elements
          expect(ddName.textContent).toBe('Test User');
          expect(signIn.classList.contains('hidden')).toBe(true);
          expect(signOut.classList.contains('hidden')).toBe(false);
      });

      it('should update UI for guest', () => {
          updateAuthUI(null);

          const userDisplay = document.getElementById('userDisplay');
          const signIn = document.getElementById('headerSignIn');
          const signOut = document.getElementById('headerSignOut');

          expect(userDisplay.style.display).toBe('flex');
          expect(signIn.classList.contains('hidden')).toBe(false);
          expect(signOut.classList.contains('hidden')).toBe(true);
      });
  });
});
