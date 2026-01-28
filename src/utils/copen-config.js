/**
 * Copen Options Configuration
 * Dynamically loads copen options from user configuration
 */

import { getUserCopens } from '../modules/copen-manager.js';
import { getAuth } from '../modules/firebase-service.js';

// Static options for initialization
export const COPEN_OPTIONS_STATIC = [
  { value: 'blank', label: 'Blank', icon: 'public' },
  { value: 'claude', label: 'Claude', icon: 'smart_toy' },
  { value: 'codex', label: 'Codex', icon: 'forum' },
  { value: 'copilot', label: 'Copilot', icon: 'code' },
  { value: 'gemini', label: 'Gemini', icon: 'auto_awesome' },
  { value: 'chatgpt', label: 'ChatGPT', icon: 'chat' }
];

// For backward compatibility
export const COPEN_OPTIONS = COPEN_OPTIONS_STATIC;

export const COPEN_STORAGE_KEY = 'copen-last-selection';
export const COPEN_DEFAULT_LABEL = 'Copen';
export const COPEN_DEFAULT_ICON = 'open_in_new';

/**
 * Get copen options for the current user
 * @returns {Promise<Array>} Array of copen options
 */
export async function getCopenOptions() {
  const auth = getAuth();
  const user = auth?.currentUser;
  
  const copens = await getUserCopens(user?.uid);
  
  // Convert to the format expected by split-button
  return copens
    .filter(c => !c.disabled)
    .map(c => ({
      value: c.id,
      label: c.label,
      icon: c.icon
    }));
}
