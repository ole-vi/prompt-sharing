// src/modules/firebase-service.js

let authInstance = null;
let dbInstance = null;
let functionsInstance = null;
const readyCallbacks = [];

/**
 * Initialize the Firebase services.
 * @param {Object} auth - The Firebase Auth instance.
 * @param {Object} db - The Firebase Firestore instance.
 * @param {Object} functions - The Firebase Functions instance (optional).
 */
export function initServices(auth, db, functions = null) {
  authInstance = auth;
  dbInstance = db;
  functionsInstance = functions;

  // Execute all registered callbacks
  while (readyCallbacks.length > 0) {
    const callback = readyCallbacks.shift();
    try {
      callback();
    } catch (error) {
      console.error('Error in firebase ready callback:', error);
    }
  }
}

export function getAuth() {
  return authInstance;
}

export function getDb() {
  return dbInstance;
}

export function getFunctions() {
  return functionsInstance;
}

/**
 * Registers a callback to be executed when Firebase services are ready.
 * If services are already initialized, the callback is executed immediately.
 * @param {Function} callback
 */
export function onFirebaseReady(callback) {
  if (authInstance && dbInstance) {
    callback();
  } else {
    readyCallbacks.push(callback);
  }
}
