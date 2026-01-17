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

export function initDropdown(btn, menu, container = null) {
  if (!btn || !menu) return;

  // Set ARIA attributes
  if (!btn.hasAttribute('aria-haspopup')) {
    btn.setAttribute('aria-haspopup', 'true');
  }
  if (!btn.hasAttribute('aria-expanded')) {
    btn.setAttribute('aria-expanded', 'false');
  }
  if (!menu.hasAttribute('role')) {
    menu.setAttribute('role', 'menu');
  }

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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
});
