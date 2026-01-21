const openDropdowns = new Set();

function closeAllDropdowns() {
  for (const dropdown of openDropdowns) {
    dropdown.menu.classList.remove('open');
    dropdown.btn.setAttribute('aria-expanded', 'false');
  }
  openDropdowns.clear();
}

function toggleDropdown(dropdown) {
  const isOpen = dropdown.menu.classList.contains('open');
  if (isOpen) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

function openDropdown(dropdown) {
  closeAllDropdowns();
  dropdown.menu.classList.add('open');
  dropdown.btn.setAttribute('aria-expanded', 'true');
  openDropdowns.add(dropdown);
}

function closeDropdown(dropdown) {
  dropdown.menu.classList.remove('open');
  dropdown.btn.setAttribute('aria-expanded', 'false');
  openDropdowns.delete(dropdown);
}

// Centralized document click listener
document.addEventListener('click', (e) => {
  const toClose = [];
  for (const dropdown of openDropdowns) {
    // Check if click is outside the dropdown container
    // And also check if it's not the button itself (though button click usually stops propagation)
    // We also check if target is contained in button (e.g. icon inside button)
    const clickedInsideContainer = dropdown.container.contains(e.target);
    const clickedButton = dropdown.btn === e.target || dropdown.btn.contains(e.target);

    if (!clickedInsideContainer && !clickedButton) {
      toClose.push(dropdown);
    }
  }

  toClose.forEach(d => closeDropdown(d));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
});

export function initDropdown(btn, menu, container = null) {
  if (!btn || !menu) return null;

  const dropdownContainer = container || menu.parentNode;
  const dropdown = { btn, menu, container: dropdownContainer };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(dropdown);
  });

  return {
    open: () => openDropdown(dropdown),
    close: () => closeDropdown(dropdown),
    toggle: () => toggleDropdown(dropdown)
  };
}
