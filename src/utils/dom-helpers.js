// ===== Common DOM Helpers =====

/**
 * WARNING: Avoid using innerHTML whenever possible.
 * Prefer safe DOM construction using createElement, createIcon, and replaceChildren.
 * innerHTML can lead to XSS vulnerabilities and performance issues.
 */

export function createElement(tag, className = '', textContent = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

/**
 * Creates a Material Icon span element.
 * @param {string} iconName The name of the Material Icon (ligature).
 * @param {string} className Additional classes (default: 'icon').
 * @returns {HTMLElement} The icon element.
 */
export function createIcon(iconName, className = 'icon') {
  const el = createElement('span', className, iconName);
  el.setAttribute('aria-hidden', 'true');
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
