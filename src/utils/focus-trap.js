/**
 * Focus Trap Utility
 * Manages focus trapping for modal components to improve accessibility.
 */

const focusableSelectors = [
  'a[href]',
  'area[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])'
];

// Stack to handle nested/stacked modals
const trapStack = [];

function handleKeyDown(e) {
  if (trapStack.length === 0) return;

  const currentTrap = trapStack[trapStack.length - 1];
  const { modalElement } = currentTrap;

  // Only handle Tab key for focus trapping
  if (e.key === 'Tab') {
    const focusableElements = Array.from(modalElement.querySelectorAll(focusableSelectors.join(',')))
      .filter(el => {
        // Filter out hidden elements or disabled ones
        return !el.hasAttribute('disabled') &&
               !el.getAttribute('aria-hidden') &&
               el.offsetParent !== null &&
               getComputedStyle(el).display !== 'none' &&
               getComputedStyle(el).visibility !== 'hidden';
      });

    if (focusableElements.length === 0) {
        e.preventDefault();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
}

// Add global listener once
document.addEventListener('keydown', handleKeyDown);

/**
 * Traps focus within the specified modal element.
 * Stores the currently focused element to restore later.
 * @param {HTMLElement} modalElement - The modal container to trap focus in.
 * @param {HTMLElement} [initialFocusElement] - Optional element to focus initially. If not provided, the first focusable element is used.
 */
export function trapFocus(modalElement, initialFocusElement = null) {
  const previousFocus = document.activeElement;
  trapStack.push({ modalElement, previousFocus });

  // Wait for the modal to be visible/rendered if needed, though usually it should be visible when called.
  // We use a small timeout to ensure the DOM is updated if display styles were just changed.
  requestAnimationFrame(() => {
    if (initialFocusElement && modalElement.contains(initialFocusElement)) {
        initialFocusElement.focus();
    } else {
        const focusableElements = Array.from(modalElement.querySelectorAll(focusableSelectors.join(',')))
            .filter(el => {
                return !el.hasAttribute('disabled') &&
                       !el.getAttribute('aria-hidden') &&
                       el.offsetParent !== null &&
                       getComputedStyle(el).display !== 'none' &&
                       getComputedStyle(el).visibility !== 'hidden';
            });

        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        } else {
            // Fallback: focus the modal itself if it has tabindex, or just don't focus anything specific
            // but we should ensure focus is inside.
            modalElement.setAttribute('tabindex', '-1');
            modalElement.focus();
        }
    }
  });
}

/**
 * Releases the focus trap and restores focus to the element that was focused before the trap was activated.
 */
export function releaseFocus() {
  const trap = trapStack.pop();
  if (trap && trap.previousFocus) {
    // Check if the element still exists in the DOM and is focusable
    if (document.body.contains(trap.previousFocus)) {
        try {
            trap.previousFocus.focus();
        } catch (e) {
            console.warn('Could not restore focus:', e);
        }
    }
  }
}
