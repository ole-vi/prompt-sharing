// ===== Common DOM Helpers =====

import { TIMEOUTS, LIMITS } from './constants.js';

export function createElement(tag, className = '', textContent = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

/**
 * Toggles the visibility of an element by adding or removing the '.hidden' class.
 * Note: This relies on a global '.hidden' class with 'display: none !important;'.
 * @param {HTMLElement} el The element to show or hide.
 * @param {boolean} show If true, the element will be shown; otherwise, it will be hidden.
 * @deprecated Consider using `element.classList.toggle('hidden', !show)` directly for clarity.
 */
export function setElementDisplay(el, show = true) {
  el.classList.toggle('hidden', !show);
}

export function toggleClass(el, className, force) {
  if (force === undefined) {
    el.classList.toggle(className);
  } else {
    el.classList.toggle(className, force);
  }
}

export function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function onElement(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}

export function stopPropagation(e) {
  e.stopPropagation();
}

/**
 * Waits for the DOM to be ready before executing the callback.
 * @param {Function} callback The function to execute when the DOM is ready.
 */
export function waitForDOMReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

/**
 * Waits for the header element to be present in the DOM.
 * @param {Function} callback The function to execute when the header is ready.
 * @param {number} attempts Current number of attempts (internal use).
 */
export function waitForHeader(callback, attempts = 0) {
  if (document.querySelector('header')) {
    callback();
  } else if (attempts < LIMITS.componentMaxAttempts) {
    setTimeout(() => waitForHeader(callback, attempts + 1), TIMEOUTS.componentCheck);
  } else {
    console.error('Header failed to load after multiple attempts');
    callback();
  }
}
