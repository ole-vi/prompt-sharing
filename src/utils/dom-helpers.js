// ===== Common DOM Helpers =====

export function createElement(tag, className = '', textContent = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

export function createIcon(iconName, classes = [], ariaHidden = true) {
  const span = document.createElement('span');
  span.className = 'icon';
  if (Array.isArray(classes)) {
    classes.forEach(c => span.classList.add(c));
  } else if (typeof classes === 'string' && classes) {
    span.classList.add(classes);
  }
  span.textContent = iconName;
  if (ariaHidden) span.setAttribute('aria-hidden', 'true');
  return span;
}
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
