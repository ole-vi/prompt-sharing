import { showToast } from './toast.js';

// URL Mappings
const TARGET_URLS = {
  claude: 'https://claude.ai/code',
  codex: 'https://chatgpt.com/codex',
  copilot: 'https://github.com/copilot/agents',
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com/',
  blank: 'about:blank'
};

/**
 * Copies the prompt text to clipboard and opens the target URL in a new tab.
 * @param {string} target - The key for the target application (e.g., 'claude', 'chatgpt').
 * @param {string} promptText - The text to copy to clipboard.
 * @returns {Promise<boolean>} - Resolves to true if successful, false otherwise.
 */
export async function copyAndOpen(target, promptText) {
  if (!promptText) {
    showToast('No prompt available.', 'warn');
    return false;
  }

  try {
    await navigator.clipboard.writeText(promptText);

    const url = TARGET_URLS[target] || TARGET_URLS.blank;
    window.open(url, '_blank', 'noopener,noreferrer');

    return true;
  } catch (error) {
    console.error('Copen error:', error);
    showToast('Clipboard blocked. Could not copy prompt.', 'warn');
    return false;
  }
}
