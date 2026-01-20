import { getDoc, deleteDoc, setDoc, getServerTimestamp } from '../utils/firestore-helpers.js';

// ===== Jules Key Management Module =====
// Handles encryption, storage, and retrieval of Jules API keys

const CACHE_KEY = 'jules_key_data';

export async function checkJulesKey(uid) {
  try {
    if (!window.db) {
      return false;
    }
    const doc = await getDoc('julesKeys', uid, CACHE_KEY);
    return !!doc;
  } catch (error) {
    return false;
  }
}

export async function deleteStoredJulesKey(uid) {
  try {
    if (!window.db) return false;
    await deleteDoc('julesKeys', uid, CACHE_KEY);
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
    await setDoc('julesKeys', uid, {
      key: encrypted,
      storedAt: getServerTimestamp()
    }, { merge: false }, CACHE_KEY);
    return true;
  } catch (error) {
    throw error;
  }
}
