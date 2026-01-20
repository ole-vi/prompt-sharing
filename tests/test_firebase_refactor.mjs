
import assert from 'assert';

// Mock browser environment
global.window = {
  location: { port: '3000', hostname: 'localhost' },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};

global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;

global.document = {
    createElement: () => ({
        classList: { add:()=>{}, remove:()=>{} },
        appendChild: ()=>{},
        style: {},
        dataset: {}
    }),
    getElementById: () => ({
        classList: { add:()=>{}, remove:()=>{} },
        style: {},
        addEventListener: () => {}
    }),
    body: { appendChild: () => {}, contains: () => false, removeChild: () => {} },
    querySelector: () => null,
    querySelectorAll: () => []
};

// Mock Firebase Global
const mockAuth = {
  currentUser: { uid: '123', email: 'test@example.com' },
  signInWithPopup: () => Promise.resolve({ credential: { accessToken: 'token' } }),
  signOut: () => Promise.resolve(),
  onAuthStateChanged: (cb) => {
      // Execute callback immediately
      cb({ uid: '123', email: 'test@example.com' });
      return () => {}; // unsubscribe function
  }
};

const mockDb = {
  collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false }) }) }),
  useEmulator: () => {}
};

global.firebase = {
  initializeApp: () => ({}),
  auth: () => mockAuth,
  firestore: () => mockDb,
  auth: Object.assign(() => mockAuth, { GithubAuthProvider: class {} })
};

// Mock console.warn to verify deprecation
const originalWarn = console.warn;
let warningLog = [];
console.warn = (...args) => {
  warningLog.push(args.join(' '));
  // originalWarn(...args); // Keep silent for clean output
};

console.log('Starting verification...');

// Import modules to test
// Note: We need to import firebase-init first
import { getFirebaseReady } from '../src/firebase-init.js';

// Since initialization is async inside promise, wait for it
await getFirebaseReady();

console.log('Firebase initialized.');

// Check deprecation warnings
console.log('Testing deprecation warnings...');
const authAccess = window.auth;
assert.strictEqual(authAccess, mockAuth, 'window.auth should return mockAuth');
assert.ok(warningLog.some(msg => msg.includes('window.auth is deprecated')), 'Should warn about window.auth deprecation');

const dbAccess = window.db;
assert.strictEqual(dbAccess, mockDb, 'window.db should return mockDb');
assert.ok(warningLog.some(msg => msg.includes('window.db is deprecated')), 'Should warn about window.db deprecation');

// Clear warnings to check single warning behavior
warningLog = [];
const authAccess2 = window.auth;
assert.strictEqual(warningLog.length, 0, 'Should not warn a second time for window.auth');

// Test auth module migration
console.log('Testing auth module migration...');
import { getCurrentUser, initAuthStateListener } from '../src/modules/auth.js';

// initAuthStateListener uses getAuth() internally
initAuthStateListener();

// Test getCurrentUser which uses getAuth()
// Initially currentUser is null until we trigger something or set it.
// initAuthStateListener calls updateAuthUI which calls setCurrentUser.
// Since we mocked onAuthStateChanged to callback immediately, currentUser should be set.

const user = getCurrentUser();
// Note: getCurrentUser implementation:
//   const auth = getAuth();
//   if (auth?.currentUser && auth.currentUser !== currentUser) {
//     currentUser = auth.currentUser;
//   }
//   return currentUser;

assert.strictEqual(user, mockAuth.currentUser, 'getCurrentUser should return mockAuth.currentUser');

console.log('All tests passed!');
