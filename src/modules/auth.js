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
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const signInItem = document.getElementById('headerSignIn');
  const signOutItem = document.getElementById('headerSignOut');

  setCurrentUser(user);

  if (user) {
    // User is signed in
    const displayName = user.displayName || user.email || 'User';
    
    // Update button avatar
    if (userAvatar && user.photoURL) {
      userAvatar.onload = () => {
        userAvatar.style.display = 'block';
        userDisplay.style.display = 'none';
      };
      userAvatar.src = user.photoURL;
      userAvatar.alt = displayName;
    } else {
      userAvatar.style.display = 'none';
      userDisplay.style.display = 'flex'; // Show emoji if no photo
    }
    
    // Update dropdown header
    if (dropdownUserName) {
      dropdownUserName.textContent = displayName;
      dropdownUserName.nextElementSibling.textContent = user.email || 'Signed in';
    }
    if (dropdownAvatar && user.photoURL) {
      dropdownAvatar.src = user.photoURL;
      dropdownAvatar.alt = displayName;
      dropdownAvatar.style.display = 'block';
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
    if (userAvatar) userAvatar.style.display = 'none';
    if (userDisplay) userDisplay.style.display = 'flex'; // Show emoji
    
    // Update dropdown header
    if (dropdownUserName) {
      dropdownUserName.textContent = 'Guest';
      dropdownUserName.nextElementSibling.textContent = 'Not signed in';
    }
    if (dropdownAvatar) dropdownAvatar.style.display = 'none';
    
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
