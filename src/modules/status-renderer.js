/**
 * Shared Jules Status Renderer
 * Standardizes status element creation and updates.
 */

import { createIcon, clearElement } from '../utils/dom-helpers.js';

export const STATUS_TYPES = {
  SAVED: 'saved',
  NOT_SAVED: 'not-saved',
  LOADING: 'loading',
  ERROR: 'error',
  SUCCESS: 'success',
  DELETING: 'deleting',
  RESET: 'reset'
};

const STATUS_CONFIG = {
  [STATUS_TYPES.SAVED]: { icon: 'check_circle', colorClass: 'status-saved' },
  [STATUS_TYPES.NOT_SAVED]: { icon: 'cancel', colorClass: 'status-not-saved' },
  [STATUS_TYPES.LOADING]: { icon: 'hourglass_top', colorClass: '' },
  [STATUS_TYPES.ERROR]: { icon: 'error', colorClass: 'status-error' },
  [STATUS_TYPES.SUCCESS]: { icon: 'check_circle', colorClass: 'status-success' },
  [STATUS_TYPES.DELETING]: { icon: 'hourglass_top', colorClass: '' },
  [STATUS_TYPES.RESET]: { icon: 'refresh', colorClass: '' }
};

/**
 * Renders a status icon and label into a container.
 * @param {HTMLElement} container The container element.
 * @param {string} type The status type (from STATUS_TYPES).
 * @param {string} [labelOverride] Optional label text to override default or display custom text.
 */
export function renderStatus(container, type, labelOverride = null) {
  if (!container) return;

  clearElement(container);

  const config = STATUS_CONFIG[type] || { icon: 'info', colorClass: '' };

  // Remove existing color classes (both legacy and new semantic classes)
  container.classList.remove(
    'color-accent', 'color-muted', 'color-error', 'color-success',
    'status-saved', 'status-not-saved', 'status-outdated',
    'status-error', 'status-success', 'status-info', 'status-loading'
  );

  // Apply new color class if specified
  if (config.colorClass) {
    container.classList.add(config.colorClass);
  }

  // Create icon
  const icon = createIcon(config.icon, ['icon-inline']);
  container.appendChild(icon);

  // Add text
  if (labelOverride) {
    container.appendChild(document.createTextNode(' ' + labelOverride));
  }
}
