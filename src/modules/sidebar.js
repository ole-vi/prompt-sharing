/**
 * Sidebar Component
 * Handles the toggling of the sidebar and persists its state.
 */

/**
 * Initializes the sidebar toggle functionality.
 * - Restores the collapsed/expanded state from localStorage.
 * - Attaches a click event listener to the toggle button.
 */
export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const STORAGE_KEY = 'sidebar-collapsed';

  if (!sidebar || !toggleBtn) return;

  // Restore previous state
  const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }

  // Handle toggle click
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem(STORAGE_KEY, collapsed);
  });
}
