// ===== Dropdown Menu Manager =====

const openDropdowns = new Set();

/**
 * Closes all currently open dropdown menus.
 */
function closeAllDropdowns() {
  for (const dropdown of openDropdowns) {
    dropdown.menu.style.display = 'none';
    dropdown.btn.setAttribute('aria-expanded', 'false');
  }
  openDropdowns.clear();
}

/**
 * Toggles a dropdown menu's visibility.
 * @param {object} dropdown - The dropdown object.
 */
function toggleDropdown(dropdown) {
  const isOpen = dropdown.menu.style.display === 'block';
  if (isOpen) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

/**
 * Opens a specific dropdown menu.
 * @param {object} dropdown - The dropdown object.
 */
function openDropdown(dropdown) {
  closeAllDropdowns();
  dropdown.menu.style.display = 'block';
  dropdown.btn.setAttribute('aria-expanded', 'true');
  openDropdowns.add(dropdown);
}

/**
 * Closes a specific dropdown menu.
 * @param {object} dropdown - The dropdown object.
 */
function closeDropdown(dropdown) {
  dropdown.menu.style.display = 'none';
  dropdown.btn.setAttribute('aria-expanded', 'false');
  openDropdowns.delete(dropdown);
}

/**
 * Initializes a dropdown menu.
 * @param {HTMLElement} btn - The dropdown button.
 * @param {HTMLElement} menu - The dropdown menu.
 * @param {HTMLElement} [container=null] - The dropdown container. If not provided, the menu's parentNode is used.
 */
export function initDropdown(btn, menu, container = null) {
  if (!btn || !menu) return;

  const dropdownContainer = container || menu.parentNode;
  const dropdown = { btn, menu };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(dropdown);
  });

  document.addEventListener('click', (e) => {
    if (!dropdownContainer.contains(e.target) && e.target !== btn) {
      closeDropdown(dropdown);
    }
  });
}

// Global listener to close all dropdowns on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
});
