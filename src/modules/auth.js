// ===== Firebase Authentication Module =====

import { showToast } from './toast.js';
import { setCache, getCache } from '../utils/session-cache.js';
import { getAuth } from './firebase-service.js';
import { GITHUB_CONFIG } from '../utils/constants.js';
// Lazy loaded: jules-api.js (for clearJulesKeyCache)

let currentUser = null;

export function generateNonce() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function getCurrentUser() {
  const auth = getAuth();
  if (auth?.currentUser && auth.currentUser !== currentUser) {
    currentUser = auth.currentUser;
  }
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

export async function signInWithGitHub(forceAccountSelection = false) {
  try {
    const auth = getAuth();
    if (!auth) {
      showToast('Authentication not ready. Please refresh the page.', 'error');
      return;
    }

    // Generate and store nonce
    const nonce = generateNonce();
    sessionStorage.setItem('oauth_nonce', nonce);

    // Construct OAuth URL
    const state = `webapp-${nonce}`;
    const params = new URLSearchParams({
      client_id: GITHUB_CONFIG.clientId,
      redirect_uri: GITHUB_CONFIG.redirectUri,
      scope: 'public_repo',
      state: state
    });

    if (forceAccountSelection) {
      params.append('prompt', 'select_account');
    }

    // Redirect to GitHub
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;

  } catch (error) {
    console.error('Sign-in initiation failed:', error);
    showToast('Failed to start sign in. Please try again.', 'error');
  }
}

export async function switchGitHubAccount() {
  try {
    showToast('Switching accounts...', 'info');
    
    // Sign out the current user first
    const auth = getAuth();
    if (auth?.currentUser) {
      await signOutUser();
    }
    
    // Sign in with account selection forced
    await signInWithGitHub(true);
  } catch (error) {
    console.error('Account switching failed:', error);
    showToast('Failed to switch account. Please try again.', 'error');
  }
}

export async function signOutUser() {
  try {
    const auth = getAuth();
    if (auth) {
      // Clear Jules API key cache on logout
      if (auth.currentUser) {
        const { clearJulesKeyCache } = await import('./jules-api.js');
        clearJulesKeyCache(auth.currentUser.uid);
      }
      await auth.signOut();
      localStorage.removeItem('github_access_token');
    }
  } catch (error) {
    console.error('Sign-out failed:', error);
    showToast('Failed to sign out.', 'error');
  }
}

export async function updateAuthUI(user) {
  const authStatus = document.getElementById('authStatus');
  const userDisplay = document.getElementById('userDisplay');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const signInItem = document.getElementById('headerSignIn');
  const switchAccountItem = document.getElementById('headerSwitchAccount');
  const signOutItem = document.getElementById('headerSignOut');

  setCurrentUser(user);
  try {
    if (window.populateFreeInputRepoSelection) await window.populateFreeInputRepoSelection();
    if (window.populateFreeInputBranchSelection) await window.populateFreeInputBranchSelection();
  } catch (error) {
    console.error('Failed to refresh dropdowns:', error);
  }

  if (user) {
    const displayName = user.displayName || user.email || 'User';
    
    if (userAvatar && user.photoURL) {
      const cachedAvatar = getCache('USER_AVATAR', user.uid);
      const avatarUrl = cachedAvatar || user.photoURL;
      if (cachedAvatar) {
        userAvatar.src = avatarUrl;
        userAvatar.alt = displayName;
        userAvatar.classList.remove('hidden');
        userDisplay.classList.add('hidden');
      } else {
        userDisplay.classList.remove('hidden');
        userAvatar.classList.add('hidden');
        userAvatar.onload = () => {
          userAvatar.classList.remove('hidden');
          userDisplay.classList.add('hidden');
          setCache('USER_AVATAR', user.photoURL, user.uid);
        };
        userAvatar.onerror = () => {
          userAvatar.classList.add('hidden');
          userDisplay.classList.remove('hidden');
        };
        userAvatar.src = user.photoURL;
        userAvatar.alt = displayName;
      }
    } else {
      userAvatar.classList.add('hidden');
      userDisplay.classList.remove('hidden');
    }
    
    if (dropdownUserName) {
      dropdownUserName.textContent = displayName;
      if (dropdownUserName.nextElementSibling) {
        dropdownUserName.nextElementSibling.textContent = user.email || 'Signed in';
      }
    }
    if (dropdownAvatar && user.photoURL) {
      // Use cached avatar for dropdown too
      const cachedAvatar = getCache('USER_AVATAR', user.uid);
      dropdownAvatar.src = cachedAvatar || user.photoURL;
      dropdownAvatar.alt = displayName;
      dropdownAvatar.classList.remove('hidden');
    }
    
    if (signInItem) {
      signInItem.classList.add('hidden');
      signInItem.onclick = null;
    }
    if (switchAccountItem) {
      switchAccountItem.classList.remove('hidden');
      switchAccountItem.onclick = switchGitHubAccount;
    }
    if (signOutItem) {
      signOutItem.classList.remove('hidden');
      signOutItem.onclick = signOutUser;
    }
  } else {
    if (userAvatar) userAvatar.classList.add('hidden');
    if (userDisplay) userDisplay.classList.remove('hidden');
    
    if (dropdownUserName) {
      dropdownUserName.textContent = 'Guest';
      if (dropdownUserName.nextElementSibling) {
        dropdownUserName.nextElementSibling.textContent = 'Not signed in';
      }
    }
    if (dropdownAvatar) dropdownAvatar.classList.add('hidden');
    
    if (signInItem) {
      signInItem.classList.remove('hidden');
      signInItem.onclick = signInWithGitHub;
    }
    if (switchAccountItem) {
      switchAccountItem.classList.add('hidden');
      switchAccountItem.onclick = null;
    }
    if (signOutItem) {
      signOutItem.classList.add('hidden');
      signOutItem.onclick = null;
    }
  }
}

export function initAuthStateListener() {
  try {
    const auth = getAuth();
    if (!auth) {
      console.error('Auth not initialized yet');
      return;
    }
    auth.onAuthStateChanged((user) => {
      updateAuthUI(user);
    });
  } catch (error) {
    console.error('Failed to initialize auth listener:', error);
  }
}
