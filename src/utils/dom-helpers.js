// ===== Common DOM Helpers =====

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
 * @param {boolean} shouldShow If true, the element will be shown; otherwise, it will be hidden.
 */
export function toggleVisibility(el, shouldShow = true) {
  if (!el) return;
  el.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    el.style.display = '';
  }
}

/**
 * Toggles the visibility of an element by adding or removing the '.hidden' class.
 * Note: This relies on a global '.hidden' class with 'display: none !important;'.
 * @param {HTMLElement} el The element to show or hide.
 * @param {boolean} show If true, the element will be shown; otherwise, it will be hidden.
 * @deprecated Use toggleVisibility instead.
 */
export function setElementDisplay(el, show = true) {
  toggleVisibility(el, show);
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
