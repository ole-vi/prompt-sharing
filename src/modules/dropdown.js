const openDropdowns = new Set();
const registry = new Map();

/**
 * Closes all open dropdowns.
 */
function closeAllDropdowns() {
  for (const dropdown of openDropdowns) {
    closeDropdown(dropdown);
  }
}

/**
 * Toggles a dropdown's state.
 * @param {Object} dropdown
 */
function toggleDropdown(dropdown) {
  const isOpen = dropdown.menu.classList.contains('open');
  if (isOpen) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

/**
 * Opens a dropdown.
 * @param {Object} dropdown
 */
function openDropdown(dropdown) {
  // Close others if we want single-open behavior (usually yes for menus)
  closeAllDropdowns();

  dropdown.menu.classList.add('open');
  dropdown.menu.classList.add('dropdown-open'); // For compatibility with user request
  dropdown.menu.style.display = ''; // Ensure no inline display: none conflicts

  if (dropdown.btn) {
    dropdown.btn.setAttribute('aria-expanded', 'true');
  }

  openDropdowns.add(dropdown);

  if (dropdown.onOpen) dropdown.onOpen();

  // Focus first item if requested (optional, maybe not default for mouse clicks)
  // But for keyboard access, we handle focus management in keydown listener
}

/**
 * Closes a specific dropdown.
 * @param {Object} dropdown
 */
function closeDropdown(dropdown) {
  dropdown.menu.classList.remove('open');
  dropdown.menu.classList.remove('dropdown-open');

  if (dropdown.btn) {
    dropdown.btn.setAttribute('aria-expanded', 'false');
  }

  openDropdowns.delete(dropdown);

  if (dropdown.onClose) dropdown.onClose();
}

/**
 * Handles keyboard navigation for dropdowns.
 * @param {KeyboardEvent} e
 * @param {Object} dropdown
 */
function handleDropdownKeydown(e, dropdown) {
  const menu = dropdown.menu;
  if (!menu.classList.contains('open')) return;

  const items = Array.from(menu.querySelectorAll('a, button, .custom-dropdown-item, [role="menuitem"], [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.disabled && el.offsetParent !== null); // Visible and enabled

  if (items.length === 0) return;

  const activeElement = document.activeElement;
  const currentIndex = items.indexOf(activeElement);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIndex = (currentIndex + 1) % items.length;
    items[nextIndex].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIndex = (currentIndex - 1 + items.length) % items.length;
    items[prevIndex].focus();
  } else if (e.key === 'Home') {
    e.preventDefault();
    items[0].focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    items[items.length - 1].focus();
  } else if (e.key === 'Enter' || e.key === ' ') {
    // Let default action happen for links/buttons, but if it's a div with role menuitem, we might need to trigger click
    if (activeElement !== dropdown.btn && items.includes(activeElement)) {
        // If it's not a native interactive element, trigger click
        if (activeElement.tagName !== 'A' && activeElement.tagName !== 'BUTTON' && activeElement.tagName !== 'INPUT') {
             e.preventDefault();
             activeElement.click();
        }
    }
  }
}

// Global click listener for outside clicks
document.addEventListener('click', (e) => {
  const toClose = [];
  for (const dropdown of openDropdowns) {
    const clickedInsideContainer = dropdown.container && dropdown.container.contains(e.target);
    const clickedMenu = dropdown.menu.contains(e.target);
    const clickedButton = dropdown.btn && (dropdown.btn === e.target || dropdown.btn.contains(e.target));

    if (!clickedMenu && !clickedButton && (!dropdown.container || !clickedInsideContainer)) {
      toClose.push(dropdown);
    }
  }
  toClose.forEach(d => closeDropdown(d));
});

// Global keydown listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
    return;
  }

  // Handle navigation for the active dropdown
  // We assume only one dropdown is open at a time usually
  if (openDropdowns.size > 0) {
    const lastOpened = Array.from(openDropdowns).pop(); // Get one

    // Only handle nav if focus is within the menu or on the button
    // Or if the menu is open.
    // Actually, usually we want to trap focus or handle arrows if menu is open.
    handleDropdownKeydown(e, lastOpened);
  }
});

/**
 * Registers a new dropdown.
 * @param {string} id - Unique identifier for the dropdown.
 * @param {Object} options - Configuration options.
 * @param {HTMLElement} options.trigger - The button/element that toggles the dropdown.
 * @param {HTMLElement} options.menu - The dropdown menu element.
 * @param {HTMLElement} [options.container] - Optional container wrapping both.
 * @param {Function} [options.onOpen] - Callback when opened.
 * @param {Function} [options.onClose] - Callback when closed.
 */
export function registerDropdown(id, options) {
  const { trigger, menu, container, onOpen, onClose } = options;

  if (!trigger || !menu) {
    console.error(`Dropdown ${id} missing trigger or menu`);
    return null;
  }

  // If already registered, update or return existing?
  // For now, we'll overwrite the registry entry but we need to be careful about event listeners.
  // Since we use global listeners and the object instance, we don't attach listeners to document per dropdown.
  // We DO attach listener to the trigger.

  const dropdown = {
    id,
    btn: trigger,
    menu,
    container: container || menu.parentNode,
    onOpen,
    onClose
  };

  // Remove old listener if re-registering?
  // It's hard to remove anonymous function.
  // We'll rely on the user to not register multiple times or we just add another listener which is bad.
  // Ideally we should store the listener to remove it.

  if (trigger._dropdownClickHandler) {
      trigger.removeEventListener('click', trigger._dropdownClickHandler);
  }

  const clickHandler = (e) => {
    e.stopPropagation();
    toggleDropdown(dropdown);
  };

  trigger._dropdownClickHandler = clickHandler;
  trigger.addEventListener('click', clickHandler);

  // Ensure menu has basic a11y attributes
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  // trigger.setAttribute('aria-controls', menu.id); // Assuming menu has ID, if not we could generate one but maybe skip for now

  registry.set(id, dropdown);

  return {
    open: () => openDropdown(dropdown),
    close: () => closeDropdown(dropdown),
    toggle: () => toggleDropdown(dropdown)
  };
}

/**
 * Legacy initializer for backward compatibility.
 * Wraps registerDropdown.
 */
export function initDropdown(btn, menu, container = null) {
  const id = btn.id ? `dropdown-${btn.id}` : `dropdown-${Math.random().toString(36).substr(2, 9)}`;
  return registerDropdown(id, { trigger: btn, menu, container });
}
