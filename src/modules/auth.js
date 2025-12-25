// ===== Firebase Authentication Module =====

let currentUser = null;

export function getCurrentUser() {
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
      await window.auth.signOut();
    }
  } catch (error) {
    console.error('Sign-out failed:', error);
    alert('Failed to sign out.');
  }
}

export function updateAuthUI(user) {
  const authStatus = document.getElementById('authStatus');
  const userDisplay = document.getElementById('userDisplay');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const signInItem = document.getElementById('headerSignIn');
  const signOutItem = document.getElementById('headerSignOut');

  setCurrentUser(user);

  if (user) {
    // User is signed in
    if (userDisplay) userDisplay.style.display = 'inline-flex';
    if (userName) {
      userName.textContent = user.displayName || user.email || 'User';
    }
    if (userAvatar) {
      if (user.photoURL) {
        userAvatar.src = user.photoURL;
        userAvatar.alt = user.displayName || 'User avatar';
        userAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
      }
    }
    if (signInItem) {
      signInItem.style.display = 'none';
      signInItem.onclick = null;
    }
    if (signOutItem) {
      signOutItem.style.display = '';
      signOutItem.onclick = signOutUser;
    }
  } else {
    // User is signed out
    if (userDisplay) {
      userDisplay.style.display = 'inline-flex';
      if (userName) userName.textContent = 'Guest';
    }
    if (userAvatar) userAvatar.style.display = 'none';
    if (signInItem) {
      signInItem.style.display = '';
      signInItem.onclick = signInWithGitHub;
    }
    if (signOutItem) {
      signOutItem.style.display = 'none';
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
