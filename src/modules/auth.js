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
  const authBtn = document.getElementById('authBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userDisplay = document.getElementById('userDisplay');
  const userName = document.getElementById('userName');

  setCurrentUser(user);

  if (user) {
    // User is signed in
    authBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    userDisplay.style.display = 'inline-flex';
    userName.textContent = user.displayName || user.email || 'User';
    
    userName.onclick = async () => {
      const { showUserProfileModal } = await import('./jules.js');
      showUserProfileModal();
    };
    
    signOutBtn.onclick = signOutUser;
  } else {
    // User is signed out
    authBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
    userDisplay.style.display = 'none';
    authBtn.onclick = signInWithGitHub;
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
