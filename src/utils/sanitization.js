/**
 * Sanitization utilities for XSS protection
 */

/**
 * Sanitize HTML content using DOMPurify
 * @param {string} html - The HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html) {
  if (typeof window.DOMPurify !== 'undefined') {
    // console.log('Sanitizing with DOMPurify');
    return window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'], // Allow target=_blank and rel=noopener
    });
  }

  console.warn('DOMPurify not loaded, falling back to basic escaping');
  return escapeHTML(html);
}

/**
 * Escape text for safe insertion into HTML
 * @param {string} text - The text to escape
 * @returns {string} Escaped text
 */
export function escapeHTML(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
