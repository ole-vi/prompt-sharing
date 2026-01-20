/**
 * Clipboard utilities
 */

/**
 * Copies text to the clipboard safely and robustly.
 * Handles errors and returns a success boolean.
 *
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} - True if copy was successful, false otherwise.
 */
export async function copyText(text) {
  if (!text) {
    console.warn('Clipboard: No text provided to copy.');
    return false;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback logic could go here if needed, but for now we rely on the Clipboard API
    console.error('Clipboard API not available');
    return false;

  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return false;
  }
}
