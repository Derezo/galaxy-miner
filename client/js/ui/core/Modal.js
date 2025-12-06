/**
 * Centralized Modal Controller
 * Manages all modals with stack-based support for nested modals.
 */

const Modal = {
  // Stack of open modals
  _stack: [],

  // Container element
  _container: null,

  // Backdrop element
  _backdrop: null,

  // Is initialized
  _initialized: false,

  /**
   * Initialize the modal system
   */
  init() {
    if (this._initialized) return;

    // Create modal container
    this._container = document.createElement('div');
    this._container.id = 'modal-container';
    this._container.className = 'modal-container hidden';

    // Create backdrop
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'modal-backdrop';
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) {
        const topModal = this._stack[this._stack.length - 1];
        if (topModal && topModal.closeOnBackdrop !== false) {
          this.close();
        }
      }
    });

    this._container.appendChild(this._backdrop);
    document.body.appendChild(this._container);

    // ESC key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._stack.length > 0) {
        const topModal = this._stack[this._stack.length - 1];
        if (topModal && topModal.closeOnEsc !== false) {
          this.close();
        }
      }
    });

    this._initialized = true;
  },

  /**
   * Open a modal
   * @param {Object} options - Modal options
   * @param {HTMLElement|string} options.content - Modal content (element or HTML string)
   * @param {string} options.title - Modal title (optional)
   * @param {string} options.className - Additional CSS class
   * @param {boolean} options.closeOnBackdrop - Close when clicking backdrop (default: true)
   * @param {boolean} options.closeOnEsc - Close on ESC key (default: true)
   * @param {Function} options.onClose - Callback when modal closes
   * @returns {Object} Modal instance with close method
   */
  open(options = {}) {
    this.init();

    const {
      content,
      title = null,
      className = '',
      closeOnBackdrop = true,
      closeOnEsc = true,
      onClose = null
    } = options;

    // Create modal wrapper
    const modalEl = document.createElement('div');
    modalEl.className = `modal ${className}`.trim();
    modalEl.style.zIndex = 1000 + this._stack.length;

    // Add title if provided
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'modal-header';
      titleEl.innerHTML = `
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      `;
      modalEl.appendChild(titleEl);

      titleEl.querySelector('.modal-close').addEventListener('click', () => {
        this.close();
      });
    }

    // Add content
    const contentEl = document.createElement('div');
    contentEl.className = 'modal-content';
    if (typeof content === 'string') {
      contentEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentEl.appendChild(content);
    }
    modalEl.appendChild(contentEl);

    // Create modal instance
    const modalInstance = {
      el: modalEl,
      closeOnBackdrop,
      closeOnEsc,
      onClose
    };

    // Add to stack
    this._stack.push(modalInstance);
    this._backdrop.appendChild(modalEl);

    // Show container
    this._container.classList.remove('hidden');

    // Trigger animation
    requestAnimationFrame(() => {
      modalEl.classList.add('modal-visible');
    });

    // Return instance with close method
    return {
      close: () => this.close(modalInstance),
      el: modalEl,
      contentEl
    };
  },

  /**
   * Close the topmost modal or a specific modal
   * @param {Object} modalInstance - Specific modal to close (optional)
   */
  close(modalInstance = null) {
    if (this._stack.length === 0) return;

    let modal;
    if (modalInstance) {
      const index = this._stack.indexOf(modalInstance);
      if (index === -1) return;
      modal = this._stack.splice(index, 1)[0];
    } else {
      modal = this._stack.pop();
    }

    // Animate out
    modal.el.classList.remove('modal-visible');
    modal.el.classList.add('modal-closing');

    // Remove after animation
    setTimeout(() => {
      if (modal.el.parentNode) {
        modal.el.parentNode.removeChild(modal.el);
      }

      // Call onClose callback
      if (modal.onClose) {
        modal.onClose();
      }

      // Hide container if no more modals
      if (this._stack.length === 0) {
        this._container.classList.add('hidden');
      }
    }, 200);
  },

  /**
   * Close all open modals
   */
  closeAll() {
    while (this._stack.length > 0) {
      this.close();
    }
  },

  /**
   * Show a confirmation dialog
   * @param {Object} options - Confirmation options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Confirmation message
   * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
   * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
   * @param {string} options.confirmClass - Confirm button CSS class
   * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
   */
  confirm(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Confirm',
        message = 'Are you sure?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        confirmClass = 'btn-primary'
      } = options;

      const content = document.createElement('div');
      content.className = 'modal-confirm';
      content.innerHTML = `
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button class="hud-btn btn-cancel">${cancelText}</button>
          <button class="hud-btn ${confirmClass}">${confirmText}</button>
        </div>
      `;

      const modal = this.open({
        content,
        title,
        className: 'modal-dialog',
        onClose: () => resolve(false)
      });

      content.querySelector('.btn-cancel').addEventListener('click', () => {
        modal.close();
        resolve(false);
      });

      content.querySelector(`.${confirmClass}`).addEventListener('click', () => {
        modal.close();
        resolve(true);
      });
    });
  },

  /**
   * Show a prompt dialog with input
   * @param {Object} options - Prompt options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Prompt message
   * @param {string} options.placeholder - Input placeholder
   * @param {string} options.defaultValue - Default input value
   * @param {string} options.inputType - Input type (default: 'text')
   * @returns {Promise<string|null>} Resolves with input value or null if cancelled
   */
  prompt(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Input',
        message = '',
        placeholder = '',
        defaultValue = '',
        inputType = 'text'
      } = options;

      const content = document.createElement('div');
      content.className = 'modal-prompt';
      content.innerHTML = `
        ${message ? `<p class="modal-message">${message}</p>` : ''}
        <input type="${inputType}" class="modal-input" placeholder="${placeholder}" value="${defaultValue}">
        <div class="modal-actions">
          <button class="hud-btn btn-cancel">Cancel</button>
          <button class="hud-btn btn-primary">OK</button>
        </div>
      `;

      const modal = this.open({
        content,
        title,
        className: 'modal-dialog',
        onClose: () => resolve(null)
      });

      const input = content.querySelector('.modal-input');
      input.focus();
      input.select();

      content.querySelector('.btn-cancel').addEventListener('click', () => {
        modal.close();
        resolve(null);
      });

      content.querySelector('.btn-primary').addEventListener('click', () => {
        const value = input.value;
        modal.close();
        resolve(value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value;
          modal.close();
          resolve(value);
        }
      });
    });
  },

  /**
   * Check if any modals are open
   * @returns {boolean}
   */
  isOpen() {
    return this._stack.length > 0;
  },

  /**
   * Get the number of open modals
   * @returns {number}
   */
  count() {
    return this._stack.length;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.Modal = Modal;
}
