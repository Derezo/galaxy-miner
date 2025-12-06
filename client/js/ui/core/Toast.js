/**
 * Toast Notification System
 * UIState-driven toast notifications with auto-dismiss.
 */

const Toast = {
  container: null,
  nextId: 1,
  maxVisible: 3,
  defaultDuration: 4000,

  /**
   * Initialize the toast system
   * Creates container and subscribes to UIState
   */
  init() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);

    // Subscribe to UIState changes
    UIState.subscribe('toasts', (toasts) => {
      this._render(toasts);
    });
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'error', 'warning', 'success', 'info'
   * @param {number} duration - Auto-dismiss time in ms (0 = no auto-dismiss)
   */
  show(message, type = 'info', duration = this.defaultDuration) {
    const id = this.nextId++;
    const toast = {
      id,
      type,
      message,
      timestamp: Date.now()
    };

    // Get current toasts and add new one
    let toasts = [...(UIState.get('toasts') || []), toast];

    // Enforce max visible limit (remove oldest)
    if (toasts.length > this.maxVisible) {
      toasts = toasts.slice(-this.maxVisible);
    }

    UIState.set('toasts', toasts);

    // Schedule auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  },

  /**
   * Dismiss a toast by ID
   * @param {number} id - Toast ID
   */
  dismiss(id) {
    const toasts = UIState.get('toasts') || [];
    UIState.set('toasts', toasts.filter(t => t.id !== id));
  },

  /**
   * Convenience method for error toasts
   * @param {string} message
   * @param {number} duration
   */
  error(message, duration) {
    return this.show(message, 'error', duration);
  },

  /**
   * Convenience method for warning toasts
   * @param {string} message
   * @param {number} duration
   */
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },

  /**
   * Convenience method for success toasts
   * @param {string} message
   * @param {number} duration
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  },

  /**
   * Convenience method for info toasts
   * @param {string} message
   * @param {number} duration
   */
  info(message, duration) {
    return this.show(message, 'info', duration);
  },

  /**
   * Clear all toasts
   */
  clear() {
    UIState.set('toasts', []);
  },

  /**
   * Render toasts from UIState
   * @param {Array} toasts
   */
  _render(toasts) {
    if (!this.container) return;

    // Clear existing
    this.container.innerHTML = '';

    // Render each toast
    toasts.forEach(toast => {
      const el = this._createToastElement(toast);
      this.container.appendChild(el);

      // Trigger animation after append
      requestAnimationFrame(() => {
        el.classList.add('toast-visible');
      });
    });
  },

  /**
   * Create DOM element for a toast
   * @param {Object} toast
   * @returns {HTMLElement}
   */
  _createToastElement(toast) {
    const el = document.createElement('div');
    el.className = `toast toast-${toast.type}`;
    el.dataset.id = toast.id;

    // Icon based on type
    const icon = this._getIcon(toast.type);

    el.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${this._escapeHtml(toast.message)}</span>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    // Click to dismiss
    el.querySelector('.toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      el.classList.add('toast-hiding');
      setTimeout(() => this.dismiss(toast.id), 200);
    });

    return el;
  },

  /**
   * Get icon for toast type
   * @param {string} type
   * @returns {string}
   */
  _getIcon(type) {
    const icons = {
      error: '&#x2716;',    // ✖
      warning: '&#x26A0;',  // ⚠
      success: '&#x2714;',  // ✔
      info: '&#x2139;'      // ℹ
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
  window.Toast = Toast;
}
