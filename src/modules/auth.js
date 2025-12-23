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
  const navAuthBtn = document.getElementById('navAuthBtn');
  const navAuthLabel = document.getElementById('navAuthLabel');
  const userDisplay = document.getElementById('userDisplay');
  const userName = document.getElementById('userName');

  setCurrentUser(user);

  if (user) {
    // User is signed in
    if (navAuthBtn) {
      navAuthBtn.style.display = 'flex';
      if (navAuthLabel) navAuthLabel.textContent = 'Sign Out';
      navAuthBtn.onclick = signOutUser;
    }
    if (userDisplay) userDisplay.style.display = 'inline-flex';
    if (userName) {
      userName.textContent = user.displayName || user.email || 'User';
      userName.onclick = () => {
        window.location.href = 'profile.html';
      };
    }
  } else {
    // User is signed out
    if (navAuthBtn) {
      navAuthBtn.style.display = 'flex';
      if (navAuthLabel) navAuthLabel.textContent = 'Sign In';
      navAuthBtn.onclick = signInWithGitHub;
    }
    if (userDisplay) userDisplay.style.display = 'none';
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
