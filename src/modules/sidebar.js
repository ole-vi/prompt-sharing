/**
 * Sidebar Component
 * Handles the toggling of the sidebar and persists its state.
 */

import { appState } from './app-state.js';

/**
 * Initializes the sidebar toggle functionality.
 * - Restores the collapsed/expanded state from appState.
 * - Attaches a click event listener to the toggle button.
 * - Subscribes to state changes.
 */
export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');

  if (!sidebar || !toggleBtn) return;

  // Restore previous state
  const updateSidebar = (collapsed) => {
    if (collapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  };

  const isCollapsed = appState.getState('preferences.sidebarCollapsed') === true;
  updateSidebar(isCollapsed);

  // Subscribe to changes
  appState.subscribe('preferences.sidebarCollapsed', (collapsed) => {
    updateSidebar(collapsed);
  });

  // Handle toggle click
  toggleBtn.addEventListener('click', () => {
    // We toggle the class immediately for responsiveness, but the source of truth is appState
    const current = appState.getState('preferences.sidebarCollapsed') === true;
    appState.setState('preferences.sidebarCollapsed', !current);
  });
}
