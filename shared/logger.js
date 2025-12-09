/**
 * Simple debug logger for Galaxy Miner
 * Wraps console methods with DEBUG flag check
 *
 * Server: Uses NODE_ENV environment variable
 * Client: Uses window.DEBUG or localStorage.getItem('DEBUG')
 */

// Determine if debug mode is enabled
// Server: Uses DEBUG env var or defaults based on NODE_ENV
// Client: Uses window.DEBUG or localStorage
const DEBUG = typeof process !== 'undefined' && process.env
  ? (process.env.DEBUG !== undefined
      ? process.env.DEBUG === 'true'
      : process.env.NODE_ENV !== 'production')
  : typeof window !== 'undefined'
    ? (window.DEBUG === true || localStorage.getItem('DEBUG') === 'true')
    : true;

/**
 * Logger object with methods that respect DEBUG flag
 */
const logger = {
  /**
   * Log debug messages (only in development)
   */
  log: function (...args) {
    if (DEBUG) {
      console.log("[DEBUG]", ...args);
    }
  },

  /**
   * Log info messages (only in development)
   */
  info: function (...args) {
    if (DEBUG) {
      console.info("[INFO]", ...args);
    }
  },

  /**
   * Log warning messages (only in development)
   */
  warn: function (...args) {
    if (DEBUG) {
      console.warn("[WARN]", ...args);
    }
  },

  /**
   * Log error messages (always, even in production)
   */
  error: function (...args) {
    console.error("[ERROR]", ...args);
  },

  /**
   * Log messages with a custom prefix (only in development)
   * @param {string} prefix - Custom prefix for the log
   */
  prefixed: function (prefix) {
    return {
      log: (...args) => DEBUG && console.log(`[${prefix}]`, ...args),
      info: (...args) => DEBUG && console.info(`[${prefix}]`, ...args),
      warn: (...args) => DEBUG && console.warn(`[${prefix}]`, ...args),
      error: (...args) => console.error(`[${prefix}]`, ...args),
    };
  },

  /**
   * Check if debug mode is enabled
   * @returns {boolean}
   */
  isDebug: function () {
    return DEBUG;
  },
};

// Universal export pattern
if (typeof module !== "undefined" && module.exports) {
  module.exports = logger;
} else if (typeof window !== "undefined") {
  window.Logger = logger;
}
