/**
 * MessageStack - Top-Left FIFO Message Queue
 * Displays info/error messages with slide-up animation.
 * Part of the notification system overhaul.
 */

const MessageStack = {
  container: null,
  nextId: 1,
  maxVisible: 5,
  defaultDuration: 4000,

  /**
   * Initialize the message stack system
   * Creates container and subscribes to UIState
   */
  init() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'message-stack';
    document.body.appendChild(this.container);

    // Subscribe to UIState changes
    UIState.subscribe('messages', (messages) => {
      this._render(messages);
    });
  },

  /**
   * Show a message notification
   * @param {string} message - Message to display
   * @param {string} type - 'error', 'warning', 'success', 'info'
   * @param {number} duration - Auto-dismiss time in ms (0 = no auto-dismiss)
   * @returns {number} Message ID
   */
  show(message, type = 'info', duration = this.defaultDuration) {
    const id = this.nextId++;
    const msg = {
      id,
      type,
      message,
      timestamp: Date.now()
    };

    // Get current messages and add new one
    let messages = [...(UIState.get('messages') || []), msg];

    // Enforce max visible limit (remove oldest)
    if (messages.length > this.maxVisible) {
      messages = messages.slice(-this.maxVisible);
    }

    UIState.set('messages', messages);

    // Schedule auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  },

  /**
   * Dismiss a message by ID
   * @param {number} id - Message ID
   */
  dismiss(id) {
    // Find the element to animate out
    const el = this.container.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('message-dismissing');
      setTimeout(() => {
        // Read fresh state inside timeout to avoid race condition
        const messages = UIState.get('messages') || [];
        UIState.set('messages', messages.filter(m => m.id !== id));
      }, 200);
    } else {
      const messages = UIState.get('messages') || [];
      UIState.set('messages', messages.filter(m => m.id !== id));
    }
  },

  /**
   * Convenience method for error messages
   * @param {string} message
   * @param {number} duration
   * @returns {number} Message ID
   */
  error(message, duration) {
    return this.show(message, 'error', duration);
  },

  /**
   * Convenience method for warning messages
   * @param {string} message
   * @param {number} duration
   * @returns {number} Message ID
   */
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },

  /**
   * Convenience method for success messages
   * @param {string} message
   * @param {number} duration
   * @returns {number} Message ID
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  },

  /**
   * Convenience method for info messages
   * @param {string} message
   * @param {number} duration
   * @returns {number} Message ID
   */
  info(message, duration) {
    return this.show(message, 'info', duration);
  },

  /**
   * Clear all messages
   */
  clear() {
    UIState.set('messages', []);
  },

  /**
   * Render messages from UIState
   * @param {Array} messages
   */
  _render(messages) {
    if (!this.container) return;

    // Get existing message IDs
    const existingIds = new Set();
    this.container.querySelectorAll('.message-item').forEach(el => {
      existingIds.add(parseInt(el.dataset.id));
    });

    // Add new messages
    messages.forEach(msg => {
      if (!existingIds.has(msg.id)) {
        const el = this._createMessageElement(msg);
        this.container.appendChild(el);

        // Trigger animation after append
        requestAnimationFrame(() => {
          el.classList.add('message-visible');
        });
      }
    });

    // Remove messages no longer in state
    const currentIds = new Set(messages.map(m => m.id));
    this.container.querySelectorAll('.message-item').forEach(el => {
      const id = parseInt(el.dataset.id);
      if (!currentIds.has(id)) {
        el.remove();
      }
    });
  },

  /**
   * Create DOM element for a message
   * @param {Object} msg
   * @returns {HTMLElement}
   */
  _createMessageElement(msg) {
    const el = document.createElement('div');
    el.className = `message-item message-${msg.type}`;
    el.dataset.id = msg.id;

    // Icon based on type
    const icon = this._getIcon(msg.type);

    el.innerHTML = `
      <span class="message-icon">${icon}</span>
      <span class="message-text">${this._escapeHtml(msg.message)}</span>
      <button class="message-close" aria-label="Dismiss">&times;</button>
    `;

    // Click to dismiss
    el.querySelector('.message-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss(msg.id);
    });

    return el;
  },

  /**
   * Get icon for message type
   * @param {string} type
   * @returns {string}
   */
  _getIcon(type) {
    const icons = {
      error: '&#x2716;',    // X
      warning: '&#x26A0;',  // Warning triangle
      success: '&#x2714;',  // Checkmark
      info: '&#x2139;'      // Info circle
    };
    return icons[type] || icons.info;
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MessageStack = MessageStack;
}
