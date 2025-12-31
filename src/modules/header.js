export async function loadHeader() {
  if (document.querySelector('header')) return;
  
  try {
    const response = await fetch('./header.html');
    const headerHtml = await response.text();
    
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
    
    // Setup mobile sidebar
    const setupMobileSidebar = () => {
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      const mobileSidebar = document.getElementById('mobileSidebar');
      const mobileSidebarClose = document.getElementById('mobileSidebarClose');
      const mobileOverlay = document.getElementById('mobileOverlay');
      
      if (!mobileMenuBtn || !mobileSidebar || !mobileSidebarClose || !mobileOverlay) return;
      
      const openSidebar = () => {
        mobileSidebar.classList.add('open');
        mobileOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        mobileSidebarClose.focus();
      };
      
      const closeSidebar = () => {
        mobileSidebar.classList.remove('open');
        mobileOverlay.classList.remove('show');
        document.body.style.overflow = '';
        mobileMenuBtn.focus();
      };
      
      const trapFocus = (e) => {
        if (!mobileSidebar.classList.contains('open')) return;
        
        const focusableElements = mobileSidebar.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };
      
      document.addEventListener('keydown', trapFocus);
      
      mobileMenuBtn.addEventListener('click', openSidebar);
      mobileSidebarClose.addEventListener('click', closeSidebar);
      mobileOverlay.addEventListener('click', closeSidebar);
      
      window.addEventListener('beforeunload', closeSidebar);
      
      // Set active page in mobile nav
      const currentPage = document.body.getAttribute('data-page');
      if (currentPage) {
        const mobileNavItem = document.querySelector(`.mobile-nav-item[data-page="${currentPage}"]`);
        if (mobileNavItem) {
          mobileNavItem.classList.add('active');
        }
      }
    };

    // Defer to next microtask to ensure DOM is attached
    queueMicrotask(() => {
      setupUserMenu();
      setupMobileSidebar();
    });
  } catch (error) {
    console.error('Failed to load header:', error);
  }
}
