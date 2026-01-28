import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from '../utils/encryption.js';

describe('Encryption Utility', () => {
  const testUid = 'test-user-123';
  const testData = 'gho_secret_token_12345';

  it('should encrypt and decrypt data correctly', async () => {
    const encrypted = await encryptData(testData, testUid);
    expect(encrypted).not.toBe(testData);
    expect(typeof encrypted).toBe('string');

    const decrypted = await decryptData(encrypted, testUid);
    expect(decrypted).toBe(testData);
  });

  it('should fail to decrypt with wrong UID', async () => {
    const encrypted = await encryptData(testData, testUid);
    const wrongUid = 'wrong-user-456';

    const decrypted = await decryptData(encrypted, wrongUid);
    expect(decrypted).toBeNull();
  });

  it('should generate different ciphertext for same data (random IV)', async () => {
    const encrypted1 = await encryptData(testData, testUid);
    const encrypted2 = await encryptData(testData, testUid);
    expect(encrypted1).not.toBe(encrypted2);

    const decrypted1 = await decryptData(encrypted1, testUid);
    const decrypted2 = await decryptData(encrypted2, testUid);
    expect(decrypted1).toBe(testData);
    expect(decrypted2).toBe(testData);
  });
});
