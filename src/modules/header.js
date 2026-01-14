import { initDropdown } from './dropdown.js';

export async function loadHeader() {
  if (document.querySelector('header')) return;
  
  try {    
    const firstSegment = location.pathname.replace(/^\//, '').split('/')[0] || '';
    const BASE = firstSegment === 'promptroot' ? '/promptroot' : '';
    let headerHtml = '';
    let res = await fetch(`${BASE}/partials/header.html`);
    if (!res.ok) {
      res = await fetch('/partials/header.html');
    }
    headerHtml = await res.text();
    const fixedHtml = BASE
      ? headerHtml.replaceAll('href="/','href="'+BASE+'/').replaceAll('src="/','src="'+BASE+'/')
      : headerHtml;
    
    document.body.insertAdjacentHTML('afterbegin', fixedHtml);
    const setupUserMenu = () => {
      const btn = document.getElementById('userMenuButton');
      const menu = document.getElementById('userMenuDropdown');
      initDropdown(btn, menu);
    };
    
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
      
      const currentPage = document.body.getAttribute('data-page');
      if (currentPage) {
        const mobileNavItem = document.querySelector(`.mobile-nav-item[data-page="${currentPage}"]`);
        if (mobileNavItem) {
          mobileNavItem.classList.add('active');
        }
      }
    };
    const setupFeedbackButtons = () => {
      const feedbackBtn = document.getElementById('feedbackBtn');
      const mobileFeedbackBtn = document.getElementById('mobileFeedbackBtn');
      
      const openFeedback = () => {
        const owner = 'promptroot';
        const repo = 'promptroot';
        const timestamp = Date.now();
        const title = encodeURIComponent(`[Feedback #${timestamp}] `);
        const body = encodeURIComponent(
          '## Issue\n\n' +
          'Describe the issue or feature request here.\n\n' +
          '## Screenshot\n\n' +
          'Paste screenshot here (Ctrl+V / Cmd+V)\n\n' +
          '## Steps to Recreate\n\n' +
          '1. \n2. \n3. \n'
        );
        const labels = encodeURIComponent('feedback');
        
        const url = `https://github.com/${owner}/${repo}/issues/new?title=${title}&body=${body}&labels=${labels}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      };
      
      if (feedbackBtn) {
        feedbackBtn.addEventListener('click', openFeedback);
      }
      if (mobileFeedbackBtn) {
        mobileFeedbackBtn.addEventListener('click', openFeedback);
      }
    };
    
    queueMicrotask(() => {
      setupUserMenu();
      setupMobileSidebar();
      setupFeedbackButtons();
    });
  } catch (error) {
    console.error('Failed to load header:', error);
  }
}
