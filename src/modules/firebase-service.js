/**
 * Firebase Service Module
 * Provides access to Firebase services without relying on global window variables.
 */

let auth = null;
let db = null;
let functions = null;
let isReady = false;
const readyCallbacks = [];

/**
 * Initialize the Firebase services.
 * @param {Object} firebaseAuth - The Firebase Auth instance
 * @param {Object} firebaseDb - The Firebase Firestore instance
 * @param {Object} firebaseFunctions - The Firebase Functions instance
 */
export function initServices(firebaseAuth, firebaseDb, firebaseFunctions) {
  auth = firebaseAuth;
  db = firebaseDb;
  functions = firebaseFunctions;
  isReady = true;

  // Notify all waiting callbacks
  while (readyCallbacks.length > 0) {
    const callback = readyCallbacks.shift();
    try {
      callback();
    } catch (error) {
      console.error('Error in onFirebaseReady callback:', error);
    }
  }
}

/**
 * Get the Firebase Auth instance.
 * @returns {Object|null} The auth instance or null if not initialized
 */
export function getAuth() {
  return auth;
}

/**
 * Get the Firebase Firestore instance.
 * @returns {Object|null} The firestore instance or null if not initialized
 */
export function getDb() {
  return db;
}

/**
 * Get the Firebase Functions instance.
 * @returns {Object|null} The functions instance or null if not initialized
 */
export function getFunctions() {
  return functions;
}

/**
 * Register a callback to be called when Firebase services are ready.
 * If services are already ready, the callback is executed immediately.
 * @param {Function} callback - The function to call when ready
 */
export function onFirebaseReady(callback) {
  if (isReady) {
    try {
      callback();
    } catch (error) {
      console.error('Error in onFirebaseReady callback (immediate):', error);
    }
  } else {
    readyCallbacks.push(callback);
  }
}
