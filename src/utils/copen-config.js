/**
 * Copen Options Configuration
 * Shared configuration for all copen split-buttons across the app
 */

export const COPEN_OPTIONS = [
  { value: 'blank', label: 'Blank', icon: 'public' },
  { value: 'claude', label: 'Claude', icon: 'smart_toy' },
  { value: 'codex', label: 'Codex', icon: 'forum' },
  { value: 'copilot', label: 'Copilot', icon: 'code' },
  { value: 'gemini', label: 'Gemini', icon: 'auto_awesome' },
  { value: 'chatgpt', label: 'ChatGPT', icon: 'chat' }
];

export const COPEN_STORAGE_KEY = 'copen-last-selection';
export const COPEN_DEFAULT_LABEL = 'Copen';
export const COPEN_DEFAULT_ICON = 'open_in_new';
