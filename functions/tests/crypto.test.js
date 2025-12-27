// functions/tests/crypto.test.js
const { test, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { subtle } = require('crypto').webcrypto;
const { decryptJulesKeyBase64 } = require('../utils/crypto');

// Mock helpers for encryption to verify decryption
async function encryptHelper(text, uid) {
  const te = new TextEncoder();
  const encodedText = te.encode(text);

  const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
  const keyBytes = te.encode(paddedKeyString);
  const key = await subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);

  const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, encodedText);

  return Buffer.from(encrypted).toString('base64');
}

describe('Crypto Utils', () => {
  const uid = "testuser123";
  const secretKey = "superSecretKey";

  it('should decrypt a correctly encrypted string', async () => {
    const encryptedBase64 = await encryptHelper(secretKey, uid);
    const decrypted = await decryptJulesKeyBase64(encryptedBase64, uid);
    assert.equal(decrypted, secretKey);
  });

  it('should throw an error for invalid input', async () => {
    await assert.rejects(
      async () => await decryptJulesKeyBase64("invalidBase64", uid),
      /Failed to decrypt/
    );
  });
});
