// Firebase initialization wrapper for browser environment
// This file initializes Firebase using the modular SDK

// Check if we're in a browser and Firebase can be loaded
window.firebaseReady = false;
window.firebaseError = null;

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
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      window.functions = firebase.functions();
      
      // Port 5000 = dev server with emulators, port 3000 = production
      const isDevServer = window.location.port === '5000';
      
      if (isDevServer && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
          // Use the same hostname as the page to avoid CORS issues
          const emulatorHost = window.location.hostname;
          window.db.useEmulator(emulatorHost, 8080);
          window.functions.useEmulator(emulatorHost, 5001);
          console.log('🔧 Connected to Firebase Emulators (Firestore, Functions)');
          console.log('⚠️ Dev server - using test data only');
        } catch (emulatorError) {
          console.error('Failed to connect to Firebase emulators:', emulatorError);
          console.error('Make sure emulators are running: firebase emulators:start or docker-compose up');
          console.log('🌐 Falling back to production Firebase backend');
        }
      } else {
        console.log('🌐 Using production Firebase backend');
      }
      
      window.firebaseReady = true;
      
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    window.firebaseError = error;
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
        window.firebaseError = 'Timeout waiting for Firebase SDK';
      }
    }
  }, 100);
}

// Also expose a manual check function
window.checkFirebaseReady = function() {
  return window.firebaseReady;
};
