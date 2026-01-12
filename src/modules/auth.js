// ===== Firebase Authentication Module =====

import { clearJulesKeyCache } from './jules-api.js';

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

export async function signInWithGitHub() {
  try {
    if (!window.auth) {
      alert('Authentication not ready. Please refresh the page.');
      return;
    }
    const provider = new firebase.auth.GithubAuthProvider();
    await window.auth.signInWithPopup(provider);
  } catch (error) {
    console.error('Sign-in failed:', error);
    alert('Failed to sign in. Please try again.');
  }
}

export async function signOutUser() {
  try {
    if (window.auth) {
      // Clear Jules API key cache on logout
      if (window.auth.currentUser) {
        clearJulesKeyCache(window.auth.currentUser.uid);
      }
      await window.auth.signOut();
    }
  } catch (error) {
    console.error('Sign-out failed:', error);
    alert('Failed to sign out.');
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
      userDisplay.style.display = 'flex';
      userAvatar.classList.add('hidden');
      userAvatar.onload = () => {
        userAvatar.classList.remove('hidden');
        userDisplay.style.display = 'none';
      };
      userAvatar.onerror = () => {
        userAvatar.classList.add('hidden');
        userDisplay.style.display = 'flex';
      };
      userAvatar.src = user.photoURL;
      userAvatar.alt = displayName;
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
      dropdownAvatar.src = user.photoURL;
      dropdownAvatar.alt = displayName;
      dropdownAvatar.style.display = 'block';
    }
    
    if (signInItem) {
      signInItem.classList.add('hidden');
      signInItem.onclick = null;
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
    if (signOutItem) {
      signOutItem.classList.add('hidden');
      signOutItem.onclick = null;
    }
  }
}

export function initAuthStateListener() {
  try {
    if (!window.auth) {
      console.error('Auth not initialized yet');
      return;
    }
    window.auth.onAuthStateChanged((user) => {
      updateAuthUI(user);
    });
  } catch (error) {
    console.error('Failed to initialize auth listener:', error);
  }
}
