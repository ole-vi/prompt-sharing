// ===== Firebase Authentication Module =====

import { showToast } from './toast.js';
import { setCache, getCache } from '../utils/session-cache.js';
// Lazy loaded: jules-api.js (for clearJulesKeyCache)

let currentUser = null;

export function getCurrentUser() {
  if (window.auth?.currentUser && window.auth.currentUser !== currentUser) {
    currentUser = window.auth.currentUser;
  }
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

export async function signInWithGitHub(forceAccountSelection = false) {
  try {
    if (!window.auth) {
      showToast('Authentication not ready. Please refresh the page.', 'error');
      return;
    }
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope('public_repo');  // Allow write access to public repos
    
    // Force account selection when switching accounts or if explicitly requested
    if (forceAccountSelection) {
      provider.setCustomParameters({
        prompt: 'select_account'
      });
    }
    
    const result = await window.auth.signInWithPopup(provider);
    
    if (result.credential && result.credential.accessToken) {
      const tokenData = {
        token: result.credential.accessToken,
        timestamp: Date.now()
      };
      localStorage.setItem('github_access_token', JSON.stringify(tokenData));
    } else {
      console.warn('GitHub sign-in succeeded but no access token was returned. Falling back to unauthenticated GitHub requests.', {
        hasCredential: !!result.credential
      });
    }
  } catch (error) {
    console.error('Sign-in failed:', error);
    showToast('Failed to sign in. Please try again.', 'error');
  }
}

export async function switchGitHubAccount() {
  try {
    showToast('Switching accounts...', 'info');
    
    // Sign out the current user first
    if (window.auth?.currentUser) {
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
    if (window.auth) {
      // Clear Jules API key cache on logout
      if (window.auth.currentUser) {
        const { clearJulesKeyCache } = await import('./jules-api.js');
        clearJulesKeyCache(window.auth.currentUser.uid);
      }
      await window.auth.signOut();
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
        userDisplay.style.display = 'none';
      } else {
        userDisplay.style.display = 'flex';
        userAvatar.classList.add('hidden');
        userAvatar.onload = () => {
          userAvatar.classList.remove('hidden');
          userDisplay.style.display = 'none';
          setCache('USER_AVATAR', user.photoURL, user.uid);
        };
        userAvatar.onerror = () => {
          userAvatar.classList.add('hidden');
          userDisplay.style.display = 'flex';
        };
        userAvatar.src = user.photoURL;
        userAvatar.alt = displayName;
      }
    } else {
      userAvatar.classList.add('hidden');
      userDisplay.style.display = 'flex';
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
      dropdownAvatar.style.display = 'block';
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
    if (userDisplay) userDisplay.style.display = 'flex';
    
    if (dropdownUserName) {
      dropdownUserName.textContent = 'Guest';
      if (dropdownUserName.nextElementSibling) {
        dropdownUserName.nextElementSibling.textContent = 'Not signed in';
      }
    }
    if (dropdownAvatar) dropdownAvatar.style.display = 'none';
    
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
  return new Promise((resolve) => {
    try {
      if (!window.auth) {
        console.error('Auth not initialized yet');
        resolve(null);
        return;
      }
      
      // Firebase's onAuthStateChanged fires immediately with current state
      // then fires again on any changes. We resolve on the first call.
      const unsubscribe = window.auth.onAuthStateChanged((user) => {
        updateAuthUI(user);
        unsubscribe(); // Stop listening after first call
        resolve(user);
      });
      
      // Continue listening for future changes
      window.auth.onAuthStateChanged(updateAuthUI);
    } catch (error) {
      console.error('Failed to initialize auth listener:', error);
      resolve(null);
    }
  });
}
