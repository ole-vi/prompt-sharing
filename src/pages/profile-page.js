/**
 * Profile Page Initialization
 * Handles user profile page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { loadProfileDirectly } from '../modules/jules-account.js';
import { initPage } from '../modules/page-init.js';

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

function initApp() {
  waitForFirebase(() => {
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
  });
}

initPage(initApp);
