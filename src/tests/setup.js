// Global test setup - runs before all tests

import { vi } from 'vitest';

// Mock Firebase globally (all tests need this)
global.window = global.window || {};
global.window.firebase = {
  auth: {
    GithubAuthProvider: class {
      addScope() {}
    }
  }
};

global.window.auth = {
  currentUser: null,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
};

global.window.db = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    })),
  })),
};

// Mock localStorage more realistically
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global.window, 'localStorage', {
  value: localStorageMock,
});
