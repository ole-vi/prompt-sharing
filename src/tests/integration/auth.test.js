import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentUser, signInWithGitHub, signOutUser, updateAuthUI } from '../../modules/auth.js';
import { showToast } from '../../modules/toast.js';
import { clearJulesKeyCache } from '../../modules/jules-api.js';
import { getAuth } from '../../modules/firebase-service.js';

// Mock dependencies
vi.mock('../../modules/toast.js');
vi.mock('../../modules/jules-api.js');
vi.mock('../../modules/firebase-service.js');

// Mock crypto
if (!global.crypto) {
    Object.defineProperty(global, 'crypto', {
        value: {
            getRandomValues: (arr) => {
                for(let i=0; i<arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
                return arr;
            }
        }
    });
}

// Mock window location
delete window.location;
window.location = { href: '' };

// Mock storage
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

// Setup DOM elements
function setupDOM() {
  document.body.innerHTML = `
    <div id="authStatus"></div>
    <div id="userDisplay"></div>
    <img id="userAvatar" class="hidden" />
    <span id="userName"></span>
    <span id="dropdownUserName"></span>
    <img id="dropdownAvatar" />
    <button id="headerSignIn"></button>
    <button id="headerSignOut" class="hidden"></button>
  `;
}

describe('Auth Module', () => {
  let mockAuth;

  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
    
    // Reset location
    window.location.href = '';

    // Setup mock auth instance
    mockAuth = {
      currentUser: null,
      signInWithPopup: vi.fn(),
      signOut: vi.fn()
    };
    
    vi.mocked(getAuth).mockReturnValue(mockAuth);
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('should update current user from auth instance', () => {
      const user = { uid: '123' };
      mockAuth.currentUser = user;
      expect(getCurrentUser()).toBe(user);
    });
  });

  describe('signInWithGitHub', () => {
    it('should initiate redirect flow', async () => {
      await signInWithGitHub();

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('oauth_nonce', expect.any(String));
      expect(window.location.href).toContain('state=webapp-');
      // Should NOT call popup or store token
      expect(mockAuth.signInWithPopup).not.toHaveBeenCalled();
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should show error toast when auth not ready', async () => {
      vi.mocked(getAuth).mockReturnValue(null);
      
      await signInWithGitHub();
      
      expect(showToast).toHaveBeenCalledWith(
        'Authentication not ready. Please refresh the page.',
        'error'
      );
    });

    it('should show error toast on initiation failure', async () => {
      // Simulate error (e.g. storage full)
      window.sessionStorage.setItem.mockImplementation(() => { throw new Error('Storage Error'); });
      
      await signInWithGitHub();
      
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start sign in'),
        'error'
      );
    });
  });

  describe('signOutUser', () => {
    it('should sign out user and clear token', async () => {
      mockAuth.currentUser = { uid: '123' };
      
      await signOutUser();

      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(vi.mocked(localStorage.removeItem).mock.calls.some(call => call[0] === 'github_access_token')).toBe(true);
      expect(clearJulesKeyCache).toHaveBeenCalled();
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

          expect(avatar.src).toBe(user.photoURL);
          expect(ddName.textContent).toBe('Test User');
          expect(signIn.classList.contains('hidden')).toBe(true);
          expect(signOut.classList.contains('hidden')).toBe(false);
      });

      it('should update UI for guest', () => {
          updateAuthUI(null);

          const userDisplay = document.getElementById('userDisplay');
          const signIn = document.getElementById('headerSignIn');
          const signOut = document.getElementById('headerSignOut');

          expect(userDisplay.classList.contains('hidden')).toBe(false);
          expect(signIn.classList.contains('hidden')).toBe(false);
          expect(signOut.classList.contains('hidden')).toBe(true);
      });
  });
});
