// ===== Common DOM Helpers =====

export function createElement(tag, classNameOrAttrs = {}, textContentOrChildren = '') {
  const el = document.createElement(tag);

  if (typeof classNameOrAttrs === 'string') {
    // Old signature: (tag, className, textContent)
    if (classNameOrAttrs) el.className = classNameOrAttrs;
    if (textContentOrChildren) el.textContent = textContentOrChildren;
  } else {
    // New signature: (tag, attributes, children)
    const attributes = classNameOrAttrs || {};
    const children = textContentOrChildren;

    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className' || key === 'class') {
        el.className = value;
      } else if (key === 'textContent' || key === 'text') {
        el.textContent = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(el.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.substring(2).toLowerCase();
        el.addEventListener(eventName, value);
      } else if (key === 'html' || key === 'innerHTML') {
        el.innerHTML = value;
      } else if (value === true) {
        el.setAttribute(key, '');
      } else if (value !== false && value != null) {
        el.setAttribute(key, value);
      }
    }

    if (children) {
      const childArray = Array.isArray(children) ? children : [children];
      childArray.forEach(child => {
        if (child instanceof Node) {
          el.appendChild(child);
        } else if (child != null && child !== false) {
          el.appendChild(document.createTextNode(String(child)));
        }
      });
    }
  }
  return el;
}

export function createIconElement(iconName, className = 'icon-inline') {
  return createElement('span', { class: `icon ${className}`, 'aria-hidden': 'true' }, iconName);
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
