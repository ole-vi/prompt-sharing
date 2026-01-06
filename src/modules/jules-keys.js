// ===== Jules Key Management Module =====
// Handles encryption, storage, and retrieval of the Jules API key

export async function checkJulesKey(uid) {
  try {
    if (!window.db) {
      return false;
    }
    const doc = await window.db.collection('julesKeys').doc(uid).get();
    return doc.exists;
  } catch (error) {
    return false;
  }
}

export async function deleteStoredJulesKey(uid) {
  try {
    if (!window.db) return false;
    await window.db.collection('julesKeys').doc(uid).delete();
    return true;
  } catch (error) {
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
    throw error;
  }
}

export async function getDecryptedJulesKey(uid) {
  try {
    if (!window.db) {
      return null;
    }

    const doc = await window.db.collection('julesKeys').doc(uid).get();
    if (!doc.exists) {
      return null;
    }

    const { key: encrypted } = doc.data();
    if (!encrypted) return null;

    // Decrypt using same method as encryption
    const paddedUid = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyData = new TextEncoder().encode(paddedUid);
    const key = await window.crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

    const ivString = uid.slice(0, 12).padEnd(12, '0');
    const iv = new TextEncoder().encode(ivString).slice(0, 12);

    const ciphertextData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const plaintext = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextData);

    return new TextDecoder().decode(plaintext);
  } catch (error) {
    return null;
  }
}
