/**
 * Clipboard utilities
 */

/**
 * Copies text to the clipboard safely.
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function copyText(text) {
  if (!navigator.clipboard) {
    console.warn('Clipboard API not available');
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
}
