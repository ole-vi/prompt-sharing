// Firebase initialization wrapper for browser environment
// This file initializes Firebase using the modular SDK

// Create a global namespace for the application
window.promptSync = window.promptSync || {};
window.promptSync.firebase = {
  ready: false,
  error: null,
  auth: null,
  db: null,
  functions: null
};

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBM7OVM3-jwHky-1P_6JL4RAmzhebuDPg",
  authDomain: "prompt-sharing-f8eeb.firebaseapp.com",
  projectId: "prompt-sharing-f8eeb",
  storageBucket: "prompt-sharing-f8eeb.firebasestorage.app",
  messagingSenderId: "840037476057",
  appId: "1:840037476057:web:a8ca03b1defe94071e80c8",
  measurementId: "G-8QR07NVLML"
};

// Initialize Firebase when modular SDK is available
function initFirebaseWhenReady() {
  try {
    // Using the global firebase namespace that should be available after SDK loads
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      // Initialize app
      const app = firebase.initializeApp(firebaseConfig);
      
      // Get services - compat API doesn't require app parameter
      window.promptSync.firebase.auth = firebase.auth();
      window.promptSync.firebase.db = firebase.firestore();
      window.promptSync.firebase.functions = firebase.functions();
      
      // For local development, allow localhost
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (window.promptSync.firebase.auth.settings) {
          window.promptSync.firebase.auth.settings.appVerificationDisabledForTesting = true;
        }
      }
      
      window.promptSync.firebase.ready = true;
      
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    window.promptSync.firebase.error = error;
    return false;
  }
}

// Try to initialize immediately
if (!initFirebaseWhenReady()) {
  // If not ready, retry every 100ms for up to 30 seconds
  let attempts = 0;
  const maxAttempts = 300;
  const retryInterval = setInterval(() => {
    attempts++;
    if (initFirebaseWhenReady() || attempts >= maxAttempts) {
      clearInterval(retryInterval);
      if (attempts >= maxAttempts) {
        console.error('Failed to initialize Firebase after 30 seconds');
        window.promptSync.firebase.error = 'Timeout waiting for Firebase SDK';
      }
    }
  }, 100);
}

// Also expose a manual check function
window.promptSync.firebase.isReady = function() {
  return window.promptSync.firebase.ready;
};
