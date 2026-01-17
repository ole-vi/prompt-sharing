/**
 * Environment-aware logger utility.
 *
 * Rules:
 * - 5000: dev
 * - 3000: prod
 * - Debug/Info/Warn: Only in development mode.
 * - Error: Always.
 */

const port = window.location.port;
const isDev = port === '5000';

const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },
  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    console.error(...args);
  }
};

// Make it available globally for non-module scripts if needed
window.logger = logger;

export { logger };
