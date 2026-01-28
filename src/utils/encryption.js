
export async function getEncryptionKey(uid) {
  const paddedUid = (uid + '\0'.repeat(32)).slice(0, 32);
  const keyData = new TextEncoder().encode(paddedUid);
  return await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(plaintext, uid) {
  try {
    const key = await getEncryptionKey(uid);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintextData = new TextEncoder().encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintextData
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

export async function decryptData(encryptedBase64, uid) {
  try {
    const key = await getEncryptionKey(uid);
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintextData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintextData);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}
