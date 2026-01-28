import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGitHub } from '../modules/auth.js';
import { getGitHubAccessToken } from '../modules/github-api.js';
import { getAuth } from '../modules/firebase-service.js';
import { decryptData, encryptData } from '../utils/encryption.js';

// Mock dependencies
vi.mock('../modules/firebase-service.js', () => ({
  getAuth: vi.fn(),
  getDb: vi.fn() // if needed
}));

vi.mock('../modules/toast.js', () => ({
  showToast: vi.fn()
}));

// Mock jules-api lazy load
vi.mock('../modules/jules-api.js', () => ({
  clearJulesKeyCache: vi.fn()
}));

describe('Auth Token Encryption Integration', () => {
  const mockUser = {
    uid: 'user-123',
    providerData: [{ providerId: 'github.com' }]
  };
  const mockAccessToken = 'gho_secret_access_token';
  const mockSignInWithPopup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    getAuth.mockReturnValue({
      signInWithPopup: mockSignInWithPopup,
      currentUser: mockUser,
      onAuthStateChanged: vi.fn()
    });
  });

  it('should encrypt and store token on sign in', async () => {
    mockSignInWithPopup.mockResolvedValue({
      credential: { accessToken: mockAccessToken },
      user: mockUser
    });

    await signInWithGitHub();

    const stored = localStorage.getItem('github_access_token');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);

    expect(parsed.token).toBeUndefined();
    expect(parsed.encryptedToken).toBeDefined();
    expect(typeof parsed.encryptedToken).toBe('string');
    expect(parsed.encryptedToken).not.toBe(mockAccessToken);

    // Verify we can decrypt it
    const decrypted = await decryptData(parsed.encryptedToken, mockUser.uid);
    expect(decrypted).toBe(mockAccessToken);
  });

  it('should decrypt stored token when retrieving', async () => {
    // Manually store encrypted token
    const encryptedToken = await encryptData(mockAccessToken, mockUser.uid);
    localStorage.setItem('github_access_token', JSON.stringify({
      encryptedToken,
      timestamp: Date.now()
    }));

    const token = await getGitHubAccessToken();
    expect(token).toBe(mockAccessToken);
  });

  it('should migrate legacy plaintext token to encrypted storage', async () => {
    // Store legacy token
    const timestamp = Date.now();
    localStorage.setItem('github_access_token', JSON.stringify({
      token: mockAccessToken,
      timestamp
    }));

    // First call should return plaintext AND migrate
    const token = await getGitHubAccessToken();
    expect(token).toBe(mockAccessToken);

    // Check storage - should be encrypted now
    const stored = localStorage.getItem('github_access_token');
    const parsed = JSON.parse(stored);

    expect(parsed.token).toBeUndefined();
    expect(parsed.encryptedToken).toBeDefined();
    expect(parsed.timestamp).toBe(timestamp); // Should preserve timestamp

    // Verify encryption
    const decrypted = await decryptData(parsed.encryptedToken, mockUser.uid);
    expect(decrypted).toBe(mockAccessToken);
  });

  it('should return null if token is expired', async () => {
    const expiredTimestamp = Date.now() - (61 * 24 * 60 * 60 * 1000); // 61 days ago
    const encryptedToken = await encryptData(mockAccessToken, mockUser.uid);

    localStorage.setItem('github_access_token', JSON.stringify({
      encryptedToken,
      timestamp: expiredTimestamp
    }));

    const token = await getGitHubAccessToken();
    expect(token).toBeNull();
    expect(localStorage.getItem('github_access_token')).toBeNull();
  });
});
