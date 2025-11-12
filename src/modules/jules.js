// ===== Jules Integration Module =====

import { getCurrentUser } from './auth.js';

export async function checkJulesKey(uid) {
  try {
    if (!window.db) {
      console.error('Firestore not initialized');
      return false;
    }
    const doc = await window.db.collection('julesKeys').doc(uid).get();
    return doc.exists;
  } catch (error) {
    console.error('Error checking Jules key:', error);
    return false;
  }
}

export async function deleteStoredJulesKey(uid) {
  try {
    if (!window.db) return false;
    await window.db.collection('julesKeys').doc(uid).delete();
    return true;
  } catch (error) {
    console.error('Error deleting Jules key:', error);
    return false;
  }
}

export async function encryptAndStoreKey(plaintext, uid) {
  try {
    const paddedUid = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyData = new TextEncoder().encode(paddedUid);
    const key = await window.crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);

    const ivString = uid.slice(0, 12).padEnd(12, '0');
    const iv = new TextEncoder().encode(ivString).slice(0, 12);
    const plaintextData = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextData);
    const encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

    if (!window.db) throw new Error('Firestore not initialized');
    await window.db.collection('julesKeys').doc(uid).set({
      key: encrypted,
      storedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Failed to encrypt/store key:', error);
    throw error;
  }
}

export async function callRunJulesFunction(promptText, environment = "myplanet") {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return null;
  }

  try {
    const julesBtn = document.getElementById('julesBtn');
    const originalText = julesBtn.textContent;
    julesBtn.textContent = 'Running...';
    julesBtn.disabled = true;

    const token = await user.getIdToken(true);
    const functionUrl = 'https://us-central1-prompt-sharing-f8eeb.cloudfunctions.net/runJulesHttp';

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ promptText: promptText || '', environment: environment })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    julesBtn.textContent = originalText;
    julesBtn.disabled = false;

    return result.sessionUrl || null;
  } catch (error) {
    console.error('Cloud function call failed:', error);
    alert('Failed to invoke Jules function: ' + error.message);
    const julesBtn = document.getElementById('julesBtn');
    julesBtn.textContent = '⚡ Try in Jules';
    julesBtn.disabled = false;
    return null;
  }
}

export async function handleTryInJules(promptText) {
  try {
    const user = window.auth ? window.auth.currentUser : null;
    if (!user) {
      try {
        const { signInWithGitHub } = await import('./auth.js');
        await signInWithGitHub();
        setTimeout(() => handleTryInJulesAfterAuth(promptText), 500);
      } catch (error) {
        alert('Login required to use Jules.');
      }
      return;
    }
    await handleTryInJulesAfterAuth(promptText);
  } catch (error) {
    console.error('Error in Try in Jules:', error);
    alert('An error occurred: ' + error.message);
  }
}

export async function handleTryInJulesAfterAuth(promptText) {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return;
  }

  try {
    const hasKey = await checkJulesKey(user.uid);
    if (!hasKey) {
      showJulesKeyModal(() => {
        showJulesEnvModal(promptText);
      });
    } else {
      showJulesEnvModal(promptText);
    }
  } catch (error) {
    console.error('Error in Jules flow:', error);
    alert('An error occurred. Please try again.');
  }
}

export function showJulesKeyModal(onSave) {
  const modal = document.getElementById('julesKeyModal');
  const input = document.getElementById('julesKeyInput');
  modal.style.display = 'flex';
  input.value = '';
  input.focus();

  const saveBtn = document.getElementById('julesSaveBtn');
  const cancelBtn = document.getElementById('julesCancelBtn');

  const handleSave = async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      alert('Please enter your Jules API key.');
      return;
    }

    try {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const user = window.auth ? window.auth.currentUser : null;
      if (!user) {
        alert('Not logged in.');
        saveBtn.textContent = 'Save & Continue';
        saveBtn.disabled = false;
        return;
      }

      await encryptAndStoreKey(apiKey, user.uid);

      hideJulesKeyModal();
      saveBtn.textContent = 'Save & Continue';
      saveBtn.disabled = false;

      if (onSave) onSave();
    } catch (error) {
      console.error('Failed to save Jules key:', error);
      alert('Failed to save API key: ' + error.message);
      saveBtn.textContent = 'Save & Continue';
      saveBtn.disabled = false;
    }
  };

  const handleCancel = () => {
    hideJulesKeyModal();
  };

  saveBtn.onclick = handleSave;
  cancelBtn.onclick = handleCancel;
}

export function hideJulesKeyModal() {
  const modal = document.getElementById('julesKeyModal');
  modal.style.display = 'none';
}

export function showJulesEnvModal(promptText) {
  const modal = document.getElementById('julesEnvModal');
  modal.style.display = 'flex';

  const planetBtn = document.getElementById('envPlanetBtn');
  const myplanetBtn = document.getElementById('envMyplanetBtn');
  const cancelBtn = document.getElementById('julesEnvCancelBtn');

  const handleSelect = async (environment) => {
    modal.style.display = 'none';
    const sessionUrl = await callRunJulesFunction(promptText, environment);
    if (sessionUrl) {
      window.open(sessionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  planetBtn.onclick = () => handleSelect('planet');
  myplanetBtn.onclick = () => handleSelect('myplanet');
  cancelBtn.onclick = () => {
    modal.style.display = 'none';
  };
}

export function hideJulesEnvModal() {
  const modal = document.getElementById('julesEnvModal');
  modal.style.display = 'none';
}

export function initJulesKeyModalListeners() {
  const keyModal = document.getElementById('julesKeyModal');
  const envModal = document.getElementById('julesEnvModal');
  const keyInput = document.getElementById('julesKeyInput');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (keyModal.style.display === 'flex') {
        hideJulesKeyModal();
      }
      if (envModal.style.display === 'flex') {
        hideJulesEnvModal();
      }
    }
  });

  keyModal.addEventListener('click', (e) => {
    if (e.target === keyModal) {
      hideJulesKeyModal();
    }
  });

  envModal.addEventListener('click', (e) => {
    if (e.target === envModal) {
      hideJulesEnvModal();
    }
  });

  keyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('julesSaveBtn').click();
    }
  });
}

// Expose for console testing
window.deleteJulesKey = async function() {
  const user = window.auth?.currentUser;
  if (!user) {
    console.log('Not logged in');
    return;
  }
  const deleted = await deleteStoredJulesKey(user.uid);
  if (deleted) {
    console.log('✓ Jules key deleted. You can now enter a new one.');
  } else {
    console.log('✗ Failed to delete Jules key');
  }
};

window.checkJulesKeyStatus = async function() {
  const user = window.auth?.currentUser;
  if (!user) {
    console.log('Not logged in');
    return;
  }
  const hasKey = await checkJulesKey(user.uid);
  console.log('Jules key stored:', hasKey ? '✓ Yes' : '✗ No');
};
