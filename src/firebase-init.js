// Firebase initialization wrapper for browser environment
// This file initializes Firebase using the modular SDK

// Check if we're in a browser and Firebase can be loaded
window.firebaseReady = false;
window.firebaseError = null;

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_NzQlgmcUfgrqpgTl3Q3pCkfBrO8PcoA",
  authDomain: "promptroot-b02a2.firebaseapp.com",
  projectId: "promptroot-b02a2",
  storageBucket: "promptroot-b02a2.firebasestorage.app",
  messagingSenderId: "494845853842",
  appId: "1:494845853842:web:6c97aec4822be003fc264b"
};

function initFirebase() {
  try {
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
  } catch (error) {
    console.error('Firebase initialization error:', error);
    window.firebaseError = error;
    throw error;
  }
}

// Export a promise that resolves when Firebase is initialized
export const firebaseReadyPromise = new Promise((resolve, reject) => {
  // Check if all required Firebase components are loaded
  const isReady = () => {
    return typeof firebase !== 'undefined' &&
           firebase.initializeApp &&
           typeof firebase.auth === 'function' &&
           typeof firebase.firestore === 'function' &&
           typeof firebase.functions === 'function';
  };

  if (isReady()) {
    try {
      initFirebase();
      resolve();
    } catch (error) {
      reject(error);
    }
    return;
  }

  // If not ready, listen for script load events
  const scripts = document.querySelectorAll('script[src*="firebase-"]');
  if (scripts.length === 0) {
    reject(new Error('No Firebase scripts found in document'));
    return;
  }

  let resolved = false;
  const checkAndInit = () => {
    if (resolved) return;

    if (isReady()) {
      try {
        initFirebase();
        resolved = true;
        resolve();
      } catch (error) {
        resolved = true;
        reject(error);
      }
    }
  };

  scripts.forEach(script => {
    script.addEventListener('load', checkAndInit);
    script.addEventListener('error', (e) => {
      if (!resolved) {
        console.error('Error loading Firebase script:', script.src);
      }
    });
  });

  // Safety timeout
  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      if (isReady()) {
        // It might have become ready without triggering our specific listeners?
        try {
          initFirebase();
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        const error = new Error('Timeout waiting for Firebase SDK');
        window.firebaseError = error.message;
        reject(error);
      }
    }
  }, 30000);
});

// Also expose a manual check function for backward compatibility
window.checkFirebaseReady = function() {
  return window.firebaseReady;
};
