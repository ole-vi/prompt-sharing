/**
 * Unified Error Handling System
 * Centralizes error categorization, logging, and display strategies.
 */

import { showToast } from '../modules/toast.js';
import statusBar from '../modules/status-bar.js';
import { TIMEOUTS } from './constants.js';

export const ErrorCategory = {
  NETWORK: 'network',
  AUTH: 'auth',
  VALIDATION: 'validation',
  UNEXPECTED: 'unexpected',
  ASYNC_PROCESS: 'async_process', // For background tasks (uses StatusBar)
  USER_ACTION: 'user_action'      // For direct user interaction (uses Toast)
};

export const ErrorType = {
  NETWORK: 'network_error',
  AUTH: 'auth_error',
  NOT_FOUND: 'not_found',
  PERMISSION: 'permission_denied',
  VALIDATION: 'validation_error',
  UNKNOWN: 'unknown_error'
};

const SUGGESTIONS = {
  [ErrorType.NETWORK]: 'Please check your internet connection and try again.',
  [ErrorType.AUTH]: 'Please sign in again to continue.',
  [ErrorType.NOT_FOUND]: 'The requested resource could not be found.',
  [ErrorType.PERMISSION]: 'You do not have permission to perform this action.',
  [ErrorType.VALIDATION]: 'Please check your input and try again.',
  [ErrorType.UNKNOWN]: 'Please try refreshing the page if the issue persists.'
};

/**
 * Categorizes an error based on its message or properties.
 * @param {Error} error
 * @returns {{category: string, type: string}}
 */
function categorizeError(error) {
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to connect') || msg.includes('offline')) {
    return { category: ErrorCategory.NETWORK, type: ErrorType.NETWORK };
  }
  if (msg.includes('auth') || msg.includes('login') || msg.includes('sign in') || msg.includes('token') || msg.includes('permission')) {
    // Permission usually implies auth/access issues
    if (msg.includes('permission') || msg.includes('access denied')) {
      return { category: ErrorCategory.AUTH, type: ErrorType.PERMISSION };
    }
    return { category: ErrorCategory.AUTH, type: ErrorType.AUTH };
  }
  if (msg.includes('not found') || msg.includes('404')) {
    return { category: ErrorCategory.UNEXPECTED, type: ErrorType.NOT_FOUND };
  }
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required') || msg.includes('must be')) {
    return { category: ErrorCategory.VALIDATION, type: ErrorType.VALIDATION };
  }

  return { category: ErrorCategory.UNEXPECTED, type: ErrorType.UNKNOWN };
}

/**
 * Handles an error by logging it, displaying it to the user, and returning normalized info.
 *
 * @param {Error|string} error - The error object or message.
 * @param {string} context - The context where the error occurred (e.g., 'JulesQueue').
 * @param {object} options - Configuration options.
 * @param {string} [options.category] - Override the error category.
 * @param {boolean} [options.showToast] - Whether to show a toast notification (defaults to true for user actions/unexpected).
 * @param {boolean} [options.updateStatus] - Whether to update the status bar (defaults to true for async processes).
 * @param {number} [options.statusTimeout] - Timeout for status bar message.
 * @returns {{message: string, type: string, category: string, suggestion: string}} Normalized error info.
 */
export function handleError(error, context = 'App', options = {}) {
  // Normalize error input
  const errObj = error instanceof Error ? error : new Error(String(error));
  const message = errObj.message || 'An unknown error occurred';

  // Determine category and type
  const { category: detectedCategory, type } = categorizeError(errObj);
  const category = options.category || detectedCategory;

  const suggestion = SUGGESTIONS[type] || SUGGESTIONS[ErrorType.UNKNOWN];

  // 1. Log with context
  console.error(`[${context}] Error (${category}/${type}):`, errObj);

  // 2. Determine Display Strategy
  const isAsync = category === ErrorCategory.ASYNC_PROCESS;
  const isUserAction = category === ErrorCategory.USER_ACTION;

  // Default behaviors if not explicitly set
  const showToastNotification = options.showToast !== undefined
    ? options.showToast
    : (isUserAction || (!isAsync && category !== ErrorCategory.NETWORK)); // Avoid toast spam for network/async unless user action

  const updateStatusBar = options.updateStatus !== undefined
    ? options.updateStatus
    : isAsync;

  // Execute Display
  if (updateStatusBar) {
    const timeout = options.statusTimeout !== undefined ? options.statusTimeout : TIMEOUTS.statusBar;
    // For status bar, we might want a shorter message or just the error
    statusBar.showMessage(`Error: ${message}`, { timeout });
  }

  if (showToastNotification && !updateStatusBar) {
    // Map category to toast type
    let toastType = 'error';
    if (category === ErrorCategory.VALIDATION) toastType = 'warn';
    if (category === ErrorCategory.AUTH) toastType = 'warn'; // Or 'info'

    showToast(message, toastType);
  }

  // Return normalized info for further handling (e.g. rendering in specific UI elements)
  return {
    message,
    type,
    category,
    suggestion
  };
}
