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

  /**
   * Log network events (always logs, even in production)
   * Use for connection/disconnection, auth events, rate limits
   * @param {...any} args - Arguments to log
   */
  network: function (...args) {
    console.log('[NETWORK]', ...args);
  },

  /**
   * Log messages for a specific category (controlled by DebugSettings)
   * Server: Only logs if DEBUG is enabled
   * Client: Only logs if the category is enabled in Developer Settings
   * @param {string} category - Category name (e.g., 'pirates', 'relics', 'worldGeneration')
   * @param {...any} args - Arguments to log
   */
  category: function (category, ...args) {
    // Server-side: respect DEBUG flag
    if (typeof window === 'undefined') {
      if (!DEBUG) {
        return;
      }
      console.log(`[${category.toUpperCase()}]`, ...args);
      return;
    }

    // Client-side: check DebugSettings
    if (typeof window.DebugSettings !== 'undefined') {
      if (!window.DebugSettings.get('logging', category)) {
        return;
      }
    }
    console.log(`[${category.toUpperCase()}]`, ...args);
  },
};

// Universal export pattern
if (typeof module !== "undefined" && module.exports) {
  module.exports = logger;
} else if (typeof window !== "undefined") {
  window.Logger = logger;
}
