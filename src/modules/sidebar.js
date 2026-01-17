/**
 * Sidebar Component
 * Handles the toggling of the sidebar and persists its state.
 */

/**
 * Initializes the sidebar toggle functionality.
 * - Restores the collapsed/expanded state from localStorage.
 * - Attaches a click event listener to the toggle button.
 */
let sidebar = null;
let toggleBtn = null;
const STORAGE_KEY = 'sidebar-collapsed';

function handleSidebarToggle() {
  sidebar.classList.toggle('collapsed');
  const collapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem(STORAGE_KEY, collapsed);
}

export function initSidebar() {
  sidebar = document.getElementById('sidebar');
  toggleBtn = document.getElementById('sidebarToggle');

  if (!sidebar || !toggleBtn) return;

  // Restore previous state
  const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }

  // Handle toggle click
  toggleBtn.addEventListener('click', handleSidebarToggle);
}

export function destroySidebar() {
  if (toggleBtn) {
    toggleBtn.removeEventListener('click', handleSidebarToggle);
  }
  sidebar = null;
  toggleBtn = null;
}
