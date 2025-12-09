// Galaxy Miner - DOM Cache Module
// Lazy-loading cache for DOM elements to reduce repeated getElementById calls

const DOMCache = {
  _cache: {},
  _initialized: false,

  /**
   * Get a DOM element by ID with lazy loading and caching.
   * Returns null if element doesn't exist.
   * @param {string} id - The element ID
   * @returns {HTMLElement|null}
   */
  get(id) {
    if (!this._cache[id]) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  },

  /**
   * Invalidate a cached element by ID.
   * Use this when elements are dynamically replaced.
   * @param {string} id - The element ID to invalidate
   */
  invalidate(id) {
    delete this._cache[id];
  },

  /**
   * Invalidate multiple cached elements at once.
   * @param {string[]} ids - Array of element IDs to invalidate
   */
  invalidateMany(ids) {
    ids.forEach(id => delete this._cache[id]);
  },

  /**
   * Clear all cached elements.
   * Use this when doing major DOM restructuring.
   */
  invalidateAll() {
    this._cache = {};
  },

  /**
   * Get multiple elements at once.
   * Returns an object mapping IDs to elements.
   * @param {string[]} ids - Array of element IDs
   * @returns {Object.<string, HTMLElement|null>}
   */
  getMany(ids) {
    const result = {};
    ids.forEach(id => {
      result[id] = this.get(id);
    });
    return result;
  },

  /**
   * Check if an element exists without caching it.
   * @param {string} id - The element ID
   * @returns {boolean}
   */
  exists(id) {
    return document.getElementById(id) !== null;
  },

  /**
   * Force refresh a cached element (re-fetch from DOM).
   * @param {string} id - The element ID
   * @returns {HTMLElement|null}
   */
  refresh(id) {
    this.invalidate(id);
    return this.get(id);
  },

  // ==============================================
  // NAMED GETTERS FOR COMMON ELEMENTS
  // ==============================================

  // Auth Screen Elements
  get authScreen() { return this.get('auth-screen'); },
  get loginForm() { return this.get('login-form'); },
  get registerForm() { return this.get('register-form'); },
  get loginUsername() { return this.get('login-username'); },
  get loginPassword() { return this.get('login-password'); },
  get loginBtn() { return this.get('login-btn'); },
  get registerUsername() { return this.get('register-username'); },
  get registerPassword() { return this.get('register-password'); },
  get registerConfirm() { return this.get('register-confirm'); },
  get registerBtn() { return this.get('register-btn'); },
  get authError() { return this.get('auth-error'); },
  get showRegister() { return this.get('show-register'); },
  get showLogin() { return this.get('show-login'); },

  // HUD Elements
  get hud() { return this.get('hud'); },
  get radarCanvas() { return this.get('radar-canvas'); },
  get terminalIcon() { return this.get('terminal-icon'); },
  get terminalRadialMenu() { return this.get('terminal-radial-menu'); },
  get profileImageContainer() { return this.get('profile-image-container'); },
  get profileImage() { return this.get('profile-image'); },
  get profileUsername() { return this.get('profile-username'); },
  get profileDisplay() { return this.get('profile-display'); },
  get creditValue() { return this.get('credit-value'); },
  get creditIconContainer() { return this.get('credit-icon-container'); },
  get creditsDisplay() { return this.get('credits-display'); },
  get sectorCoords() { return this.get('sector-coords'); },

  // Terminal Panel Elements
  get terminalPanel() { return this.get('terminal-panel'); },
  get cargoContent() { return this.get('cargo-content'); },
  get upgradesContent() { return this.get('upgrades-content'); },
  get marketContent() { return this.get('market-content'); },
  get customizeContent() { return this.get('customize-content'); },
  get relicsContent() { return this.get('relics-content'); },
  get settingsContent() { return this.get('settings-content'); },

  // Inventory Elements
  get cargoUsed() { return this.get('cargo-used'); },
  get cargoMax() { return this.get('cargo-max'); },
  get inventoryList() { return this.get('inventory-list'); },

  // Upgrades Elements
  get upgradesList() { return this.get('upgrades-list'); },

  // Market Elements
  get marketListings() { return this.get('market-listings'); },
  get sellResource() { return this.get('sell-resource'); },
  get sellQuantity() { return this.get('sell-quantity'); },
  get sellPrice() { return this.get('sell-price'); },
  get sellSubmit() { return this.get('sell-submit'); },

  // Chat Elements
  get chatOverlay() { return this.get('chat-overlay'); },
  get chatIcon() { return this.get('chat-icon'); },
  get chatMessages() { return this.get('chat-messages'); },
  get chatInput() { return this.get('chat-input'); },
  get chatSend() { return this.get('chat-send'); },
  get chatUnreadBadge() { return this.get('chat-unread-badge'); },

  // Hints & Overlays
  get miningHint() { return this.get('mining-hint'); },
  get lootHint() { return this.get('loot-hint'); },
  get wormholeHint() { return this.get('wormhole-hint'); },
  get uiContainer() { return this.get('ui-container'); },

  // Canvas Elements
  get gameCanvas() { return this.get('gameCanvas'); },
  get shipPreviewCanvas() { return this.get('ship-preview-canvas'); },
  get wormholeTransitCanvas() { return this.get('wormhole-transit-canvas'); },

  // Tooltip Elements
  get radarTooltip() { return this.get('radar-tooltip'); },

  /**
   * Initialize the DOM cache with commonly used elements.
   * This is optional but can improve first-access performance.
   * Call this after DOM is ready.
   */
  preload() {
    if (this._initialized) return;

    // Preload critical elements
    const criticalIds = [
      'auth-screen',
      'hud',
      'terminal-panel',
      'gameCanvas',
      'radar-canvas',
      'chat-overlay',
      'terminal-icon'
    ];

    criticalIds.forEach(id => this.get(id));
    this._initialized = true;
  },

  /**
   * Get cache statistics for debugging.
   * @returns {Object}
   */
  getStats() {
    const cached = Object.keys(this._cache).length;
    const valid = Object.values(this._cache).filter(el => el !== null).length;
    return {
      totalCached: cached,
      validElements: valid,
      nullElements: cached - valid,
      initialized: this._initialized
    };
  },

  /**
   * Debug utility: Log all cached elements.
   */
  debug() {
    console.group('DOMCache Debug Info');
    console.table(this.getStats());
    console.log('Cached elements:', Object.keys(this._cache));
    console.log('Cache contents:', this._cache);
    console.groupEnd();
  }
};

// Make available globally for browser
if (typeof window !== 'undefined') {
  window.DOMCache = DOMCache;
}

// Optional: Auto-preload when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DOMCache.preload());
  } else {
    // DOM already loaded
    DOMCache.preload();
  }
}
