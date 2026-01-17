/**
 * Accessibility Announcer Module
 * Provides a way to make announcements to screen readers using aria-live regions.
 */

let politeAnnouncer = null;
let assertiveAnnouncer = null;

/**
 * Creates an announcer element for the specified type.
 * @param {string} type - The aria-live type ('polite' or 'assertive')
 * @returns {HTMLElement} The announcer element
 */
function createAnnouncer(type) {
  const el = document.createElement('div');
  el.className = 'visually-hidden';
  el.setAttribute('aria-live', type);
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('id', `a11y-announcer-${type}`);
  document.body.appendChild(el);
  return el;
}

/**
 * Ensures that the announcer elements exist in the DOM.
 */
function ensureAnnouncers() {
  if (!politeAnnouncer) {
    // Check if it already exists in DOM (e.g. from previous init)
    politeAnnouncer = document.getElementById('a11y-announcer-polite');
    if (!politeAnnouncer) {
      politeAnnouncer = createAnnouncer('polite');
    }
  }

  if (!assertiveAnnouncer) {
    assertiveAnnouncer = document.getElementById('a11y-announcer-assertive');
    if (!assertiveAnnouncer) {
      assertiveAnnouncer = createAnnouncer('assertive');
    }
  }
}

/**
 * Announces a message to screen readers.
 * @param {string} message - The message to announce
 * @param {string} type - The priority of the announcement ('polite' or 'assertive'). Default is 'polite'.
 */
export function announce(message, type = 'polite') {
  ensureAnnouncers();

  const el = type === 'assertive' ? assertiveAnnouncer : politeAnnouncer;

  // Clear content briefly to force announcement of repeated messages
  // This is a common technique to ensure screen readers pick up the change
  el.textContent = '';

  // Use a small timeout to allow the mutation observer to pick up the clearance
  setTimeout(() => {
    el.textContent = message;
  }, 50);
}
