const openDropdowns = new Set();

function closeAllDropdowns() {
  for (const dropdown of openDropdowns) {
    dropdown.menu.style.display = 'none';
    dropdown.btn.setAttribute('aria-expanded', 'false');
  }
  openDropdowns.clear();
}

function toggleDropdown(dropdown) {
  const isOpen = dropdown.menu.style.display === 'block';
  if (isOpen) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

function openDropdown(dropdown) {
  closeAllDropdowns();
  dropdown.menu.style.display = 'block';
  dropdown.btn.setAttribute('aria-expanded', 'true');
  openDropdowns.add(dropdown);
}

function closeDropdown(dropdown) {
  dropdown.menu.style.display = 'none';
  dropdown.btn.setAttribute('aria-expanded', 'false');
  openDropdowns.delete(dropdown);
}

// Helper to find focusable items
function getFocusableItems(menu) {
  return Array.from(menu.querySelectorAll(
    '.custom-dropdown-item, .dropdown-item, [role="menuitem"], a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => {
    return el.offsetParent !== null; // check visibility
  });
}

export function setupDropdownNavigation(btn, menu) {
  const dropdown = { btn, menu };

  // Ensure button handles arrow keys
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (menu.style.display !== 'block') {
        // Open if closed
        btn.click();
        // Attempt to focus first item after a short delay (for async or rendering)
        requestAnimationFrame(() => {
          const items = getFocusableItems(menu);
          if (items.length > 0) items[0].focus();
        });
      } else {
        // Just focus first item
        const items = getFocusableItems(menu);
        if (items.length > 0) items[0].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); // Prevent page scroll
      // Optional: Cycle to last item? Or just do nothing.
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown(dropdown);
    }
  });

  // Menu navigation
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown(dropdown);
      btn.focus();
      return;
    }

    if (e.key === 'Tab') {
      closeDropdown(dropdown);
      return;
    }

    const items = getFocusableItems(menu);
    const index = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < items.length) {
        items[nextIndex].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        items[prevIndex].focus();
      } else {
        // Focus back to button if going up from top
        btn.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (items.length > 0) items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      if (items.length > 0) items[items.length - 1].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      // If the focused element is a div/span (not a button/link), trigger click
      // Standard buttons/links handle Enter/Space natively (Enter for links, both for buttons)
      // But we preventDefault for ' ' to avoid scrolling, so we must manually click.

      const isNative = document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A';

      if (e.key === ' ' || (e.key === 'Enter' && !isNative)) {
        e.preventDefault();
        document.activeElement.click();
      }
    }
  });
}

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

  setupDropdownNavigation(btn, menu);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
});
