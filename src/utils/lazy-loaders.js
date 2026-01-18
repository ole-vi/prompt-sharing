// ===== Lazy Loading Utilities for External Libraries =====
// Provides functions to dynamically load external CDN libraries only when needed

const loadedLibraries = new Map();
const loadingPromises = new Map();

/**
 * Lazy load marked.js for markdown parsing
 * @returns {Promise<object>} The marked library
 */
export async function loadMarked() {
  if (loadedLibraries.has('marked')) {
    return window.marked;
  }
  
  if (loadingPromises.has('marked')) {
    return loadingPromises.get('marked');
  }
  
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    script.onload = () => {
      loadedLibraries.set('marked', true);
      loadingPromises.delete('marked');
      resolve(window.marked);
    };
    script.onerror = () => {
      loadingPromises.delete('marked');
      reject(new Error('Failed to load marked.js'));
    };
    document.head.appendChild(script);
  });
  
  loadingPromises.set('marked', promise);
  return promise;
}

/**
 * Lazy load Fuse.js for fuzzy search
 * @returns {Promise<object>} The Fuse constructor
 */
export async function loadFuse() {
  if (loadedLibraries.has('fuse')) {
    return window.Fuse;
  }
  
  if (loadingPromises.has('fuse')) {
    return loadingPromises.get('fuse');
  }
  
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.min.js';
    script.onload = () => {
      loadedLibraries.set('fuse', true);
      loadingPromises.delete('fuse');
      resolve(window.Fuse);
    };
    script.onerror = () => {
      loadingPromises.delete('fuse');
      reject(new Error('Failed to load Fuse.js'));
    };
    document.head.appendChild(script);
  });
  
  loadingPromises.set('fuse', promise);
  return promise;
}

/**
 * Lazy load Firebase Functions SDK
 * @returns {Promise<object>} The firebase.functions object
 */
export async function loadFirebaseFunctions() {
  if (loadedLibraries.has('firebase-functions')) {
    return window.firebase.functions;
  }
  
  if (loadingPromises.has('firebase-functions')) {
    return loadingPromises.get('firebase-functions');
  }
  
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions-compat.js';
    script.onload = () => {
      loadedLibraries.set('firebase-functions', true);
      loadingPromises.delete('firebase-functions');
      resolve(window.firebase.functions);
    };
    script.onerror = () => {
      loadingPromises.delete('firebase-functions');
      reject(new Error('Failed to load Firebase Functions SDK'));
    };
    document.head.appendChild(script);
  });
  
  loadingPromises.set('firebase-functions', promise);
  return promise;
}
