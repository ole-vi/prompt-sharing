/**
 * Profile Page Initialization
 * Handles user profile page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { loadProfileDirectly } from '../modules/jules-account.js';
import { TIMEOUTS } from '../utils/constants.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadProfile() {
  const user = window.auth?.currentUser;
  
  if (!user) {
    const profileUserName = document.getElementById('profileUserName');
    if (profileUserName) {
      profileUserName.textContent = 'Not signed in';
    }
    return;
  }

  try {
    await loadProfileDirectly(user);
  } catch (err) {
    console.error('Profile loading error:', err);
  }
}

async function initApp() {
  try {
    await waitForFirebase();
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        loadProfile();
      } else {
        // Hide all profile sections when not signed in
        const profileUserName = document.getElementById('profileUserName');
        const julesKeyStatusDiv = document.getElementById('julesKeyStatusDiv');
        const addJulesKeyBtn = document.getElementById('addJulesKeyBtn');
        const dangerZoneSection = document.getElementById('dangerZoneSection');
        
        if (profileUserName) {
          profileUserName.innerHTML = '<div class="muted-text text-center pad-xl">Please sign in to view your profile.</div>';
        }
        if (julesKeyStatusDiv) julesKeyStatusDiv.classList.add('hidden');
        if (addJulesKeyBtn) addJulesKeyBtn.classList.add('hidden');
        if (dangerZoneSection) dangerZoneSection.classList.add('hidden');
      }
    });
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
