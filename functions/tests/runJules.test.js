const test = require('firebase-functions-test')();
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { Crypto } = require('@peculiar/webcrypto');

// Polyfill for Web Crypto API
global.crypto = new Crypto();

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn().mockReturnValue({
    doc: jest.fn(),
  }),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

describe('Firebase Functions Tests', () => {
    let myFunctions;

    beforeAll(() => {
      process.env.NODE_ENV = 'test';
      myFunctions = require('../index');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    afterAll(() => {
        delete process.env.NODE_ENV;
    });

  describe('decryptJulesKeyBase64', () => {
    it('should correctly decrypt a known encrypted string', async () => {
      const uid = 'test-uid-123456';
      const plainText = 'a-secret-api-key';

      // Manually create the encrypted value for this test
      const te = new TextEncoder();
      const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
      const keyBytes = te.encode(paddedKeyString);
      const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
      const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);
      const plainBuf = te.encode(plainText);
      const encBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, plainBuf);
      const encryptedBase64 = Buffer.from(encBuf).toString('base64');

      const decryptedText = await myFunctions.internals.decryptJulesKeyBase64(encryptedBase64, uid);
      expect(decryptedText).toBe(plainText);
    });
  });

  describe('runJules', () => {
    let wrapped;

    beforeEach(() => {
        wrapped = test.wrap(myFunctions.runJules);
    });

    it('should throw an error if the user is not authenticated', async () => {
      await expect(wrapped({})).rejects.toThrow(/Must be signed in to use Jules/);
    });

    it('should throw an error for missing promptText', async () => {
      const context = { auth: { uid: 'test-uid' } };
      await expect(wrapped({ sourceId: 'sources/github/a/b' }, context)).rejects.toThrow(/Prompt text is required/);
    });

    it('should throw an error for invalid sourceId', async () => {
      const context = { auth: { uid: 'test-uid' } };
      await expect(wrapped({ promptText: 'test prompt', sourceId: 'invalid-source' }, context)).rejects.toThrow(/Invalid sourceId format/);
    });

    it('should throw an error if no API key is stored', async () => {
      admin.firestore().doc.mockReturnValue({
        get: jest.fn().mockResolvedValue({ exists: false }),
      });
      const context = { auth: { uid: 'test-uid' } };
      await expect(wrapped({ promptText: 'test prompt' }, context)).rejects.toThrow(/No Jules API key stored/);
    });

    it('should throw an error on network failure', async () => {
        admin.firestore().doc.mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ key: 'U2FsdGVkX19somesalt/someciphertext' }), // Dummy key, decryption will be mocked
          }),
        });

        // Mock the decryption to prevent it from failing the test
        jest.spyOn(myFunctions.internals, 'decryptJulesKeyBase64').mockResolvedValue('decrypted-api-key');

        fetch.mockRejectedValue(new Error('Network error'));

        const context = { auth: { uid: 'test-uid' } };
        await expect(wrapped({ promptText: 'test prompt' }, context)).rejects.toThrow(/Failed to reach Jules API/);
      });
  });
});
