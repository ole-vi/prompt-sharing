// Lazy loading utilities for external libraries

let markedPromise = null;
let fusePromise = null;
let firebaseFunctionsPromise = null;

/**
 * Lazy load marked.js for markdown parsing
 */
export async function loadMarked() {
  if (window.marked) return window.marked;
  
  if (!markedPromise) {
    markedPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      script.onload = () => resolve(window.marked);
      script.onerror = () => reject(new Error('Failed to load marked.js'));
      document.head.appendChild(script);
    });
  }
  
  return markedPromise;
}

/**
 * Lazy load Fuse.js for fuzzy search
 */
export async function loadFuse() {
  if (window.Fuse) return window.Fuse;
  
  if (!fusePromise) {
    fusePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.min.js';
      script.onload = () => resolve(window.Fuse);
      script.onerror = () => reject(new Error('Failed to load Fuse.js'));
      document.head.appendChild(script);
    });
  }
  
  return fusePromise;
}

/**
 * Lazy load Firebase Functions
 */
export async function loadFirebaseFunctions() {
  if (window.firebase?.functions) return window.firebase.functions;
  
  if (!firebaseFunctionsPromise) {
    firebaseFunctionsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions-compat.js';
      script.onload = () => resolve(window.firebase.functions);
      script.onerror = () => reject(new Error('Failed to load Firebase Functions'));
      document.head.appendChild(script);
    });
  }
  
  return firebaseFunctionsPromise;
}
