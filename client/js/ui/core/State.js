/**
 * Simple Reactive State Store
 * Pub/sub pattern for UI state management with selective subscriptions.
 */

/**
 * Create a new state store
 * @param {Object} initialState - Initial state object
 * @returns {Object} Store instance with get, set, subscribe methods
 */
function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Map(); // key -> Set of callbacks
  const globalListeners = new Set();

  const store = {
    /**
     * Get the entire state or a specific key
     * @param {string} key - Optional key to get specific value
     * @returns {*} State value
     */
    get(key = null) {
      if (key === null) {
        return { ...state };
      }
      return state[key];
    },

    /**
     * Set state values
     * @param {Object|string} keyOrObject - Key to set, or object of key-value pairs
     * @param {*} value - Value if first arg is key
     * @param {boolean} silent - If true, don't notify listeners
     */
    set(keyOrObject, value = undefined, silent = false) {
      const changes = {};

      if (typeof keyOrObject === 'string') {
        const key = keyOrObject;
        if (state[key] !== value) {
          state[key] = value;
          changes[key] = value;
        }
      } else if (typeof keyOrObject === 'object') {
        for (const [key, val] of Object.entries(keyOrObject)) {
          if (state[key] !== val) {
            state[key] = val;
            changes[key] = val;
          }
        }
      }

      // Notify listeners
      if (!silent && Object.keys(changes).length > 0) {
        this._notify(changes);
      }
    },

    /**
     * Update a nested value using a path
     * @param {string} path - Dot-separated path (e.g., 'user.settings.theme')
     * @param {*} value - New value
     */
    setPath(path, value) {
      const keys = path.split('.');
      const topKey = keys[0];

      if (keys.length === 1) {
        this.set(topKey, value);
        return;
      }

      // Clone and update nested
      const newState = { ...state };
      let current = newState;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      state = newState;

      this._notify({ [topKey]: state[topKey] });
    },

    /**
     * Subscribe to state changes
     * @param {string|Function} keyOrCallback - Key to watch, or callback for all changes
     * @param {Function} callback - Callback if first arg is key
     * @returns {Function} Unsubscribe function
     */
    subscribe(keyOrCallback, callback = null) {
      if (typeof keyOrCallback === 'function') {
        // Global subscription
        globalListeners.add(keyOrCallback);
        return () => globalListeners.delete(keyOrCallback);
      }

      // Key-specific subscription
      const key = keyOrCallback;
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key).add(callback);

      return () => {
        const keyListeners = listeners.get(key);
        if (keyListeners) {
          keyListeners.delete(callback);
        }
      };
    },

    /**
     * Batch multiple updates with single notification
     * @param {Function} updater - Function that receives set method
     */
    batch(updater) {
      const changes = {};
      const batchSet = (key, value) => {
        if (state[key] !== value) {
          state[key] = value;
          changes[key] = value;
        }
      };

      updater(batchSet);

      if (Object.keys(changes).length > 0) {
        this._notify(changes);
      }
    },

    /**
     * Reset state to initial values
     * @param {boolean} silent - If true, don't notify listeners
     */
    reset(silent = false) {
      const changes = {};
      for (const key of Object.keys(state)) {
        if (state[key] !== initialState[key]) {
          changes[key] = initialState[key];
        }
      }
      state = { ...initialState };

      if (!silent && Object.keys(changes).length > 0) {
        this._notify(changes);
      }
    },

    /**
     * Internal: Notify listeners of changes
     * @param {Object} changes - Changed key-value pairs
     */
    _notify(changes) {
      // Notify key-specific listeners
      for (const key of Object.keys(changes)) {
        const keyListeners = listeners.get(key);
        if (keyListeners) {
          keyListeners.forEach(cb => {
            try {
              cb(changes[key], key, state);
            } catch (e) {
              console.error(`State listener error for key "${key}":`, e);
            }
          });
        }
      }

      // Notify global listeners
      globalListeners.forEach(cb => {
        try {
          cb(changes, state);
        } catch (e) {
          console.error('Global state listener error:', e);
        }
      });
    },

    /**
     * Create a derived/computed value
     * @param {Array<string>} deps - Keys this value depends on
     * @param {Function} compute - Function to compute derived value
     * @returns {Function} Getter function for derived value
     */
    derive(deps, compute) {
      let cached = null;
      let lastDeps = null;

      return () => {
        const currentDeps = deps.map(k => state[k]);
        const changed = lastDeps === null || deps.some((_, i) => currentDeps[i] !== lastDeps[i]);

        if (changed) {
          cached = compute(...currentDeps);
          lastDeps = currentDeps;
        }

        return cached;
      };
    }
  };

  return store;
}

/**
 * UI State Store - Global state for UI components
 */
const UIState = createStore({
  // Player state
  inventory: [],
  credits: 0,
  ship: null,
  relics: [],

  // Market state
  marketListings: [],
  myListings: [],
  selectedListing: null,

  // Cargo panel state
  selectedItem: null,
  detailPanelOpen: false,

  // Relics panel state
  selectedRelic: null,

  // UI state
  terminalOpen: false,
  currentTab: 'cargo',
  modalStack: [],

  // Toast notifications
  toasts: []
});

// Export for browser
if (typeof window !== 'undefined') {
  window.createStore = createStore;
  window.UIState = UIState;
}
