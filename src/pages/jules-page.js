/**
 * Jules Page Initialization
 * Handles Jules account page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { checkJulesKey } from '../modules/jules-keys.js';
import { showToast } from '../modules/toast.js';
import { showConfirm } from '../modules/confirm-modal.js';
import { TIMEOUTS } from '../utils/constants.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadJulesInfo() {
  const user = window.auth?.currentUser;
  
  const loadingDiv = document.getElementById('julesLoading');
  const notSignedInDiv = document.getElementById('julesNotSignedIn');
  const profileSection = document.getElementById('julesProfileInfoSection');
  const noJulesKeySection = document.getElementById('noJulesKeySection');
  const julesContentSection = document.getElementById('julesContentSection');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  
  if (!user) {
    loadingDiv.classList.add('hidden');
    profileSection.classList.add('hidden');
    notSignedInDiv.classList.remove('hidden');
    return;
  }

  try {
    loadingDiv.classList.remove('hidden');
    notSignedInDiv.classList.add('hidden');
    profileSection.classList.add('hidden');
    
    // Check if user has Jules key
    const hasKey = await checkJulesKey(user.uid);
    
    if (julesKeyStatus) {
      julesKeyStatus.innerHTML = hasKey 
        ? '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Saved'
        : '<span class="icon icon-inline" aria-hidden="true">cancel</span> Not saved';
      julesKeyStatus.style.color = hasKey ? 'var(--accent)' : 'var(--muted)';
    }
    
    loadingDiv.classList.add('hidden');
    profileSection.classList.remove('hidden');
    
    const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
    
    if (hasKey) {
      if (noJulesKeySection) noJulesKeySection.classList.add('hidden');
      if (julesContentSection) julesContentSection.classList.remove('hidden');
      if (dangerZoneSection) dangerZoneSection.classList.remove('hidden');
      if (loadJulesInfoBtn) loadJulesInfoBtn.style.display = 'block';
      
      // Load Jules account information
      const { loadJulesAccountInfo } = await import('../modules/jules-account.js');
      await loadJulesAccountInfo(user);
    } else {
      if (noJulesKeySection) noJulesKeySection.classList.remove('hidden');
      if (julesContentSection) julesContentSection.classList.add('hidden');
      if (dangerZoneSection) dangerZoneSection.classList.add('hidden');
      if (loadJulesInfoBtn) loadJulesInfoBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Jules info loading error:', err);
    loadingDiv.classList.add('hidden');
  }
}

function initApp() {
  // Set up Jules key event handlers
  const addJulesKeyBtnProminent = document.getElementById('addJulesKeyBtnProminent');
  const resetJulesKeyBtn = document.getElementById('resetJulesKeyBtn');
  
  const addKeyHandler = async (event) => {
    const btn = event?.currentTarget;
    const originalText = btn?.textContent;
    const originalDisabled = btn?.disabled;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Loading...';
    }

    try {
      const { showJulesKeyModal } = await import('../modules/jules-modal.js');
      showJulesKeyModal(() => {
        // Reload Jules info after saving key
        const user = window.auth?.currentUser;
        if (user) {
          loadJulesInfo();
        }
      });
    } catch (error) {
      console.error('Failed to load Jules modal:', error);
      showToast('Failed to open key modal', 'error');
    } finally {
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = originalDisabled;
      }
    }
  };
  
  if (addJulesKeyBtnProminent) {
    addJulesKeyBtnProminent.onclick = addKeyHandler;
  }
  
  if (resetJulesKeyBtn) {
    resetJulesKeyBtn.onclick = async () => {
      const originalText = resetJulesKeyBtn.textContent;
      resetJulesKeyBtn.disabled = true;
      resetJulesKeyBtn.textContent = 'Loading...';

      let showConfirm;
      try {
        const module = await import('../modules/confirm-modal.js');
        showConfirm = module.showConfirm;
      } catch (error) {
        console.error('Failed to load confirm modal:', error);
        showToast('Failed to open confirmation dialog', 'error');
        resetJulesKeyBtn.textContent = originalText;
        resetJulesKeyBtn.disabled = false;
        return;
      }

      resetJulesKeyBtn.textContent = originalText;
      resetJulesKeyBtn.disabled = false;

      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        const user = window.auth?.currentUser;
        if (!user) return;
        
        resetJulesKeyBtn.disabled = true;
        resetJulesKeyBtn.textContent = 'Deleting...';
        
        let deleteStoredJulesKey;
        try {
          const module = await import('../modules/jules-keys.js');
          deleteStoredJulesKey = module.deleteStoredJulesKey;
        } catch (error) {
          console.error('Failed to load Jules keys module:', error);
          showToast('Failed to load key management', 'error');
          resetJulesKeyBtn.textContent = 'Delete Jules API Key';
          resetJulesKeyBtn.disabled = false;
          return;
        }

        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          const julesKeyStatus = document.getElementById('julesKeyStatus');
          if (julesKeyStatus) {
            julesKeyStatus.innerHTML = '<span class="icon icon-inline" aria-hidden="true">cancel</span> Not saved';
            julesKeyStatus.style.color = 'var(--muted)';
          }
          
          resetJulesKeyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">delete</span> Delete Jules API Key';
          resetJulesKeyBtn.disabled = false;
          
          const noJulesKeySection = document.getElementById('noJulesKeySection');
          const julesContentSection = document.getElementById('julesContentSection');
          if (noJulesKeySection) noJulesKeySection.classList.remove('hidden');
          if (julesContentSection) julesContentSection.classList.add('hidden');
          document.getElementById('dangerZoneSection').classList.add('hidden');
          document.getElementById('julesProfileInfoSection').classList.remove('hidden');
          
          showToast('Jules API key has been deleted. You can enter a new one next time.', 'success');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        showToast('Failed to delete API key: ' + error.message, 'error');
        resetJulesKeyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">delete</span> Delete Jules API Key';
        resetJulesKeyBtn.disabled = false;
      }
    };
  }
  
  // Set up load Jules info button
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = () => {
      const user = window.auth?.currentUser;
      if (user) {
        loadJulesInfo();
      }
    };
  }

  waitForFirebase(() => {
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        loadJulesInfo();
      } else {
        document.getElementById('julesProfileInfoSection').classList.add('hidden');
        document.getElementById('julesNotSignedIn').classList.remove('hidden');
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
