export async function loadHeader() {
  try {
    const response = await fetch('./header.html');
    const headerHtml = await response.text();
    
    // Insert header at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', headerHtml);

    // Wire up user menu interactions (toggle + outside click close)
    const setupUserMenu = () => {
      const btn = document.getElementById('userMenuButton');
      const menu = document.getElementById('userMenuDropdown');
      if (!btn || !menu) return;

      const closeMenu = () => {
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      };

      const toggleMenu = () => {
        const isOpen = menu.style.display === 'block';
        if (isOpen) {
          closeMenu();
        } else {
          menu.style.display = 'block';
          btn.setAttribute('aria-expanded', 'true');
        }
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
      });

      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== btn) {
          closeMenu();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
      });
    };

    // Defer to next microtask to ensure DOM is attached
    queueMicrotask(setupUserMenu);
  } catch (error) {
    console.error('Failed to load header:', error);
  }
}
