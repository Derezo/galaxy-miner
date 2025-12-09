/**
 * BasePanel - Base class for all panel components
 *
 * Provides common functionality for panel UI components including:
 * - Lifecycle methods (init, render, destroy)
 * - State subscription management
 * - Event binding helpers
 * - Formatting utilities
 * - Icon injection patterns
 *
 * Usage:
 * ```javascript
 * const MyPanel = Object.create(BasePanel);
 * Object.assign(MyPanel, {
 *   init() {
 *     BasePanel.init.call(this, 'my-panel-container');
 *     // Custom initialization
 *   },
 *   buildHTML() {
 *     return `<div>My Panel Content</div>`;
 *   },
 *   // ... other overrides
 * });
 * ```
 */

const BasePanel = {
  /**
   * Initialize the panel
   * @param {string|HTMLElement} containerOrId - Container element or ID
   * @param {Object} options - Panel options
   */
  init(containerOrId, options = {}) {
    // Get container element
    if (typeof containerOrId === 'string') {
      this.container = document.getElementById(containerOrId);
    } else {
      this.container = containerOrId;
    }

    if (!this.container) {
      console.error(`[BasePanel] Container not found: ${containerOrId}`);
      return;
    }

    // Store options
    this.options = { ...options };

    // Initialize unsubscribers array for cleanup
    this.unsubscribers = [];

    // Initialize component-specific state
    this.initState();

    // Subscribe to state changes
    this.subscribeToState();

    // Initial render
    this.render();
  },

  /**
   * Initialize component-specific state
   * Override in subclass to set up initial state
   */
  initState() {
    // Override in subclass
  },

  /**
   * Subscribe to UIState changes
   * Override in subclass to add custom subscriptions
   */
  subscribeToState() {
    // Override in subclass
    // Example:
    // this.subscribe('inventory', (inventory) => {
    //   this.inventory = inventory;
    //   this.render();
    // });
  },

  /**
   * Helper to subscribe to UIState with automatic cleanup
   * @param {string} key - State key to watch
   * @param {Function} callback - Callback function
   */
  subscribe(key, callback) {
    if (typeof UIState === 'undefined') {
      console.error('[BasePanel] UIState is not available');
      return;
    }

    const unsubscribe = UIState.subscribe(key, callback);
    this.unsubscribers.push(unsubscribe);
  },

  /**
   * Get value from UIState
   * @param {string} key - State key
   * @returns {*} State value
   */
  getState(key) {
    if (typeof UIState === 'undefined') {
      console.error('[BasePanel] UIState is not available');
      return null;
    }
    return UIState.get(key);
  },

  /**
   * Set value in UIState
   * @param {string|Object} keyOrObject - Key or object of key-value pairs
   * @param {*} value - Value if first arg is key
   */
  setState(keyOrObject, value) {
    if (typeof UIState === 'undefined') {
      console.error('[BasePanel] UIState is not available');
      return;
    }
    UIState.set(keyOrObject, value);
  },

  /**
   * Render the panel
   * @param {HTMLElement} container - Optional container override
   */
  render(container = null) {
    const targetContainer = container || this.container;
    if (!targetContainer) return;

    // Save scroll position
    const scrollTop = this.saveScrollPosition(targetContainer);

    // Build and inject HTML
    const html = this.buildHTML();
    targetContainer.innerHTML = html;

    // Inject icons (if applicable)
    this.injectIcons(targetContainer);

    // Bind events
    this.bindEvents(targetContainer);

    // Restore scroll position
    this.restoreScrollPosition(targetContainer, scrollTop);
  },

  /**
   * Build panel HTML
   * Override in subclass to provide custom HTML
   * @returns {string} HTML string
   */
  buildHTML() {
    return '<div>Base Panel - Override buildHTML()</div>';
  },

  /**
   * Bind event handlers
   * Override in subclass to add custom event handlers
   * @param {HTMLElement} container - Container element
   */
  bindEvents(container) {
    // Override in subclass
  },

  /**
   * Inject SVG icons into the rendered HTML
   * Override in subclass to inject custom icons
   * @param {HTMLElement} container - Container element
   */
  injectIcons(container) {
    // Override in subclass
  },

  /**
   * Save scroll position before re-render
   * @param {HTMLElement} container - Container element
   * @returns {Object} Scroll positions { main, detail }
   */
  saveScrollPosition(container) {
    const positions = {};

    const mainPanel = container.querySelector('.panel-main');
    if (mainPanel) {
      positions.main = mainPanel.scrollTop;
    }

    const detailPanel = container.querySelector('.panel-detail');
    if (detailPanel) {
      positions.detail = detailPanel.scrollTop;
    }

    return positions;
  },

  /**
   * Restore scroll position after re-render
   * @param {HTMLElement} container - Container element
   * @param {Object} positions - Saved scroll positions
   */
  restoreScrollPosition(container, positions) {
    if (!positions) return;

    if (positions.main !== undefined) {
      const mainPanel = container.querySelector('.panel-main');
      if (mainPanel && positions.main > 0) {
        mainPanel.scrollTop = positions.main;
      }
    }

    if (positions.detail !== undefined) {
      const detailPanel = container.querySelector('.panel-detail');
      if (detailPanel && positions.detail > 0) {
        detailPanel.scrollTop = positions.detail;
      }
    }
  },

  /**
   * Refresh the panel (re-render with current state)
   */
  refresh() {
    this.render();
  },

  /**
   * Destroy the panel and clean up
   */
  destroy() {
    // Unsubscribe from all state changes
    this.unsubscribers.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (e) {
        console.error('[BasePanel] Error unsubscribing:', e);
      }
    });
    this.unsubscribers = [];

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Clean up component-specific resources
    this.cleanup();
  },

  /**
   * Component-specific cleanup
   * Override in subclass to clean up custom resources
   */
  cleanup() {
    // Override in subclass
  },

  // ========================================
  // FORMATTING UTILITIES
  // ========================================

  /**
   * Format number with thousand separators
   * @param {number} n - Number to format
   * @returns {string} Formatted number
   */
  formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return Math.floor(n).toLocaleString();
  },

  /**
   * Format credits with $ prefix
   * @param {number} n - Credits amount
   * @returns {string} Formatted credits
   */
  formatCredits(n) {
    return `$${this.formatNumber(n)}`;
  },

  /**
   * Format credits with 'cr' suffix
   * @param {number} n - Credits amount
   * @returns {string} Formatted credits
   */
  formatCreditsCr(n) {
    return `${this.formatNumber(n)} cr`;
  },

  /**
   * Format large numbers with K/M/B suffixes
   * @param {number} n - Number to format
   * @returns {string} Formatted number
   */
  formatCompact(n) {
    if (n === null || n === undefined) return '0';
    if (n < 1000) return String(Math.floor(n));
    if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
    if (n < 1000000000) return `${(n / 1000000).toFixed(1)}M`;
    return `${(n / 1000000000).toFixed(1)}B`;
  },

  /**
   * Format percentage
   * @param {number} value - Decimal value (0.0 to 1.0)
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted percentage
   */
  formatPercent(value, decimals = 0) {
    return `${(value * 100).toFixed(decimals)}%`;
  },

  /**
   * Format time duration
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  },

  /**
   * Format timestamp to relative time
   * @param {Date|string|number} timestamp - Timestamp
   * @returns {string} Relative time string
   */
  formatRelativeTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  },

  // ========================================
  // RESOURCE UTILITIES
  // ========================================

  /**
   * Get resource info from CONSTANTS
   * @param {string} resourceType - Resource type key
   * @returns {Object|null} Resource info or null
   */
  getResourceInfo(resourceType) {
    if (typeof CONSTANTS === 'undefined' || !CONSTANTS.RESOURCE_TYPES) {
      console.error('[BasePanel] CONSTANTS.RESOURCE_TYPES is not available');
      return null;
    }
    return CONSTANTS.RESOURCE_TYPES[resourceType] || null;
  },

  /**
   * Get resource name
   * @param {string} resourceType - Resource type key
   * @returns {string} Resource name
   */
  getResourceName(resourceType) {
    const info = this.getResourceInfo(resourceType);
    return info ? info.name : resourceType;
  },

  /**
   * Get resource base value
   * @param {string} resourceType - Resource type key
   * @returns {number} Base value
   */
  getResourceValue(resourceType) {
    const info = this.getResourceInfo(resourceType);
    return info ? info.baseValue : 0;
  },

  /**
   * Get resource rarity
   * @param {string} resourceType - Resource type key
   * @returns {string} Rarity level
   */
  getResourceRarity(resourceType) {
    const info = this.getResourceInfo(resourceType);
    return info ? info.rarity : 'common';
  },

  /**
   * Get resource description
   * @param {string} resourceType - Resource type key
   * @returns {string} Description
   */
  getResourceDescription(resourceType) {
    const info = this.getResourceInfo(resourceType);
    if (info && info.description) {
      return info.description;
    }
    // Fallback to IconFactory if available
    if (typeof IconFactory !== 'undefined' && IconFactory.getDescription) {
      return IconFactory.getDescription(resourceType);
    }
    return 'No description available';
  },

  // ========================================
  // ICON UTILITIES
  // ========================================

  /**
   * Inject resource icon into container
   * @param {HTMLElement} container - Container element
   * @param {string} resourceType - Resource type key
   * @param {number} size - Icon size in pixels
   */
  injectResourceIcon(container, resourceType, size = 24) {
    if (!container || typeof IconFactory === 'undefined') return;

    container.innerHTML = '';
    const icon = IconFactory.createResourceIcon(resourceType, size);
    container.appendChild(icon);
  },

  /**
   * Batch inject multiple resource icons
   * @param {HTMLElement} parentContainer - Parent container
   * @param {Array<{selector: string, resourceType: string, size: number}>} icons - Icon configs
   */
  injectResourceIcons(parentContainer, icons) {
    if (!parentContainer) return;

    icons.forEach(({ selector, resourceType, size = 24 }) => {
      const container = parentContainer.querySelector(selector);
      this.injectResourceIcon(container, resourceType, size);
    });
  },

  // ========================================
  // MODAL UTILITIES
  // ========================================

  /**
   * Open a modal dialog
   * @param {Object} options - Modal options
   * @returns {Object} Modal instance
   */
  openModal(options) {
    if (typeof Modal === 'undefined') {
      console.error('[BasePanel] Modal is not available');
      return null;
    }
    return Modal.open(options);
  },

  /**
   * Open a confirmation modal
   * @param {Object} options - Confirmation options
   * @returns {Promise<boolean>} True if confirmed
   */
  async confirmModal(options) {
    if (typeof Modal === 'undefined') {
      console.error('[BasePanel] Modal is not available');
      return false;
    }
    return await Modal.confirm(options);
  },

  // ========================================
  // AUDIO UTILITIES
  // ========================================

  /**
   * Play a sound effect
   * @param {string} soundId - Sound ID
   */
  playSound(soundId) {
    if (typeof AudioManager !== 'undefined' && AudioManager.play) {
      AudioManager.play(soundId);
    }
  },

  /**
   * Play a sound at a position (spatial audio)
   * @param {string} soundId - Sound ID
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  playSoundAt(soundId, x, y) {
    if (typeof AudioManager !== 'undefined' && AudioManager.playAt) {
      AudioManager.playAt(soundId, x, y);
    }
  },

  // ========================================
  // NETWORK UTILITIES
  // ========================================

  /**
   * Send a network event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  sendNetworkEvent(event, data) {
    if (typeof Network === 'undefined') {
      console.error('[BasePanel] Network is not available');
      return;
    }
    if (Network.socket && Network.socket.emit) {
      Network.socket.emit(event, data);
    }
  },

  // ========================================
  // HTML BUILDING UTILITIES
  // ========================================

  /**
   * Render empty state message
   * @param {string} message - Primary message
   * @param {string} subtitle - Optional subtitle
   * @returns {string} Empty state HTML
   */
  renderEmptyState(message, subtitle = '') {
    return `
      <div class="empty-state">
        <p>${message}</p>
        ${subtitle ? `<p style="font-size: 12px; margin-top: 8px;">${subtitle}</p>` : ''}
      </div>
    `;
  },

  /**
   * Render a badge
   * @param {string} text - Badge text
   * @param {string} variant - Badge variant (primary, success, warning, danger, etc.)
   * @returns {string} Badge HTML
   */
  renderBadge(text, variant = 'primary') {
    return `<span class="badge badge-${variant}">${text}</span>`;
  },

  /**
   * Render a button
   * @param {Object} options - Button options
   * @returns {string} Button HTML
   */
  renderButton(options = {}) {
    const {
      text = 'Button',
      id = '',
      className = 'btn',
      variant = '',
      disabled = false,
      dataAttrs = {}
    } = options;

    const classes = [className, variant ? `btn-${variant}` : ''].filter(Boolean).join(' ');
    const disabledAttr = disabled ? 'disabled' : '';
    const idAttr = id ? `id="${id}"` : '';
    const dataAttrStr = Object.entries(dataAttrs)
      .map(([key, value]) => `data-${key}="${value}"`)
      .join(' ');

    return `<button class="${classes}" ${idAttr} ${disabledAttr} ${dataAttrStr}>${text}</button>`;
  },

  /**
   * Render a stat row
   * @param {string} label - Stat label
   * @param {string} value - Stat value
   * @returns {string} Stat row HTML
   */
  renderStatRow(label, value) {
    return `
      <div class="panel-detail-stat">
        <span class="panel-detail-stat-label">${label}</span>
        <span class="panel-detail-stat-value">${value}</span>
      </div>
    `;
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.BasePanel = BasePanel;
}
