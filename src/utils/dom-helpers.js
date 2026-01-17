// ===== Common DOM Helpers =====

export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  // Handle backward compatibility: createElement(tag, className, textContent)
  // Check if attrs is string or (null/undefined and children is string/undefined/null/false - wait, no, simple check)
  // Actually, checking typeof attrs === 'string' covers the typical old usage where className is provided.
  // If className was empty string, it enters here too.
  if (typeof attrs === 'string') {
    if (attrs) element.className = attrs;
    if (children) {
        // In old signature, 3rd arg is textContent
        element.textContent = children;
    }
    return element;
  }

  // New usage: createElement(tag, { ...attrs }, [ ...children ])
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className' || key === 'class') {
        element.className = value;
      } else if (key === 'style') {
        if (typeof value === 'object') {
          Object.assign(element.style, value);
        } else {
          element.style.cssText = value;
        }
      } else if (key === 'dataset') {
        Object.assign(element.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event listeners like onClick -> click
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === 'innerHTML') {
         // Allow explicit innerHTML if absolutely necessary (e.g. for marked output)
         element.innerHTML = value;
      } else if (value !== null && value !== undefined && value !== false) {
        element.setAttribute(key, value === true ? '' : value);
      }
    }
  }

  if (children) {
    if (typeof children === 'string' || typeof children === 'number') {
       element.textContent = String(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (child === null || child === undefined || child === false) return;
        if (typeof child === 'string' || typeof child === 'number') {
          element.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      });
    }
  }

  return element;
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
