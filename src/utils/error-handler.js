import statusBar from '../modules/status-bar.js';
import { showToast } from '../modules/toast.js';
import { TIMEOUTS } from './constants.js';

export const ErrorType = {
  NETWORK: 'network',
  AUTH: 'auth',
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  UNEXPECTED: 'unexpected'
};

export const ErrorCategory = {
  USER_ACTION: 'user_action', // Use Toast
  ASYNC_PROCESS: 'async_process', // Use StatusBar
  SILENT: 'silent' // Just log
};

/**
 * Categorizes an error based on its message or properties.
 * @param {Error|string} error
 * @returns {string} ErrorType
 */
function categorizeError(error) {
  const msg = (typeof error === 'string' ? error : error.message || '').toLowerCase();

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || msg.includes('failed to fetch')) {
    return ErrorType.NETWORK;
  }

  if (msg.includes('auth') || msg.includes('login') || msg.includes('sign in') || msg.includes('permission') || msg.includes('unauthorized')) {
    return ErrorType.AUTH;
  }

  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) {
    return ErrorType.VALIDATION;
  }

  if (msg.includes('not found') || msg.includes('missing')) {
    return ErrorType.NOT_FOUND;
  }

  return ErrorType.UNEXPECTED;
}

/**
 * Get a user-friendly recovery suggestion based on error type.
 * @param {string} type ErrorType
 * @returns {string|null} Suggestion
 */
function getRecoverySuggestion(type) {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Please check your internet connection and try again.';
    case ErrorType.AUTH:
      return 'Please sign in again to continue.';
    case ErrorType.VALIDATION:
      return 'Please check your input and try again.';
    default:
      return null;
  }
}

/**
 * Unified error handler
 * @param {Error|string} error The error object or message
 * @param {Object} context Contextual information (e.g. { component: 'Queue', action: 'load' })
 * @param {Object} options Configuration options
 * @param {string} options.category ErrorCategory (default: USER_ACTION)
 * @param {boolean} options.shouldLog Whether to log to console (default: true)
 * @param {string} options.fallbackMessage Message to show if error has no message
 * @returns {Object} { type, message, suggestion }
 */
export function handleError(error, context = {}, options = {}) {
  const {
    category = ErrorCategory.USER_ACTION,
    shouldLog = true,
    fallbackMessage = 'An unexpected error occurred'
  } = options;

  const errorObj = typeof error === 'string' ? new Error(error) : error;
  const message = errorObj.message || fallbackMessage;
  const type = categorizeError(message);
  const suggestion = getRecoverySuggestion(type);

  // Note: We don't append the suggestion to the displayed message automatically
  // because it might clutter the toast/status bar. The caller can use the suggestion if needed.
  // But for simple "user action" errors, maybe we should?
  // For now, let's keep the message clean as passed.

  if (shouldLog) {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    console.error(`[Error] [${type}] ${contextStr}`, errorObj);
  }

  if (category === ErrorCategory.USER_ACTION) {
    const toastType = type === ErrorType.VALIDATION ? 'warn' : 'error';
    showToast(message, toastType);
  } else if (category === ErrorCategory.ASYNC_PROCESS) {
    statusBar.showMessage(`Error: ${message}`, { timeout: TIMEOUTS.statusBar });
  }

  return { type, message, suggestion };
}
