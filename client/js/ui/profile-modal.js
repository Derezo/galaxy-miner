/**
 * Profile Modal
 * Allows players to select their profile avatar from preset options
 */

const ProfileModal = {
  modal: null,
  isOpen: false,
  selectedProfileId: null,

  /**
   * Initialize the profile modal
   */
  init() {
    this.createModal();
    Logger.log('ProfileModal initialized');
  },

  /**
   * Create the modal DOM structure
   */
  createModal() {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.id = 'profile-modal';
    this.modal.className = 'modal-overlay hidden';
    this.modal.innerHTML = `
      <div class="modal-content profile-modal-content">
        <div class="modal-header">
          <h2>Choose Your Avatar</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="profile-options-grid">
            ${this.renderProfileOptions()}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="profile-cancel">Cancel</button>
          <button class="btn btn-primary" id="profile-save">Save</button>
        </div>
      </div>
    `;

    // Add to document
    document.body.appendChild(this.modal);

    // Add styles
    this.injectStyles();

    // Set up event handlers
    this.setupEventHandlers();
  },

  /**
   * Render profile option buttons
   */
  renderProfileOptions() {
    const options = CONSTANTS.PROFILE_OPTIONS || [
      { id: 'pilot', emoji: '\u{1F680}', name: 'Pilot' },
      { id: 'pirate', emoji: '\u{2620}', name: 'Pirate' },
      { id: 'trader', emoji: '\u{1F4B0}', name: 'Trader' },
      { id: 'explorer', emoji: '\u{1F52D}', name: 'Explorer' },
      { id: 'miner', emoji: '\u{26CF}', name: 'Miner' },
      { id: 'warrior', emoji: '\u{2694}', name: 'Warrior' },
      { id: 'scientist', emoji: '\u{1F52C}', name: 'Scientist' },
      { id: 'alien', emoji: '\u{1F47D}', name: 'Alien' }
    ];

    return options.map(opt => `
      <div class="profile-option" data-profile-id="${opt.id}">
        <div class="profile-option-emoji">${opt.emoji}</div>
        <div class="profile-option-name">${opt.name}</div>
      </div>
    `).join('');
  },

  /**
   * Inject modal styles
   */
  injectStyles() {
    if (document.getElementById('profile-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'profile-modal-styles';
    style.textContent = `
      #profile-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      #profile-modal.visible {
        opacity: 1;
      }

      .profile-modal-content {
        background: var(--color-bg-dark, #0a0a28);
        border: 2px solid var(--color-border, #334);
        border-radius: 12px;
        width: 400px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        transform: scale(0.9);
        transition: transform 0.2s ease;
      }

      #profile-modal.visible .profile-modal-content {
        transform: scale(1);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-border, #334);
      }

      .modal-header h2 {
        margin: 0;
        font-size: 18px;
        color: var(--color-text, #eee);
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--color-text-muted, #888);
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .modal-close:hover {
        color: var(--color-text, #eee);
      }

      .modal-body {
        padding: 20px;
      }

      .profile-options-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }

      .profile-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 8px;
        border: 2px solid var(--color-border, #334);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: rgba(0, 0, 0, 0.3);
      }

      .profile-option:hover {
        border-color: var(--color-primary, #4466ff);
        background: rgba(68, 102, 255, 0.1);
      }

      .profile-option.selected {
        border-color: var(--color-success, #66ff88);
        background: rgba(102, 255, 136, 0.1);
        box-shadow: 0 0 10px rgba(102, 255, 136, 0.3);
      }

      .profile-option-emoji {
        font-size: 32px;
        line-height: 1;
        margin-bottom: 6px;
      }

      .profile-option-name {
        font-size: 11px;
        color: var(--color-text-muted, #888);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .profile-option.selected .profile-option-name {
        color: var(--color-success, #66ff88);
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--color-border, #334);
      }

      .modal-footer .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .modal-footer .btn-secondary {
        background: rgba(100, 100, 100, 0.3);
        color: var(--color-text-muted, #888);
        border: 1px solid var(--color-border, #334);
      }

      .modal-footer .btn-secondary:hover {
        background: rgba(100, 100, 100, 0.5);
        color: var(--color-text, #eee);
      }

      .modal-footer .btn-primary {
        background: var(--color-primary, #4466ff);
        color: white;
      }

      .modal-footer .btn-primary:hover {
        background: #5577ff;
        box-shadow: 0 0 15px rgba(68, 102, 255, 0.5);
      }

      .modal-footer .btn-primary:disabled {
        background: rgba(68, 102, 255, 0.3);
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(style);
  },

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Close button
    this.modal.querySelector('.modal-close').addEventListener('click', () => this.hide());

    // Cancel button
    this.modal.querySelector('#profile-cancel').addEventListener('click', () => this.hide());

    // Save button
    this.modal.querySelector('#profile-save').addEventListener('click', () => this.save());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Profile option selection
    this.modal.querySelectorAll('.profile-option').forEach(option => {
      option.addEventListener('click', () => {
        // Remove selection from others
        this.modal.querySelectorAll('.profile-option').forEach(o => o.classList.remove('selected'));
        // Add selection to clicked
        option.classList.add('selected');
        this.selectedProfileId = option.dataset.profileId;
      });
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
    });
  },

  /**
   * Show the modal
   */
  show() {
    if (!this.modal) {
      this.init();
    }

    // Get current profile from player
    const currentProfile = Player?.ship?.profileId || 'pilot';
    this.selectedProfileId = currentProfile;

    // Highlight current selection
    this.modal.querySelectorAll('.profile-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.profileId === currentProfile);
    });

    // Show modal
    this.modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.modal.classList.add('visible');
    });

    this.isOpen = true;
  },

  /**
   * Hide the modal
   */
  hide() {
    this.modal.classList.remove('visible');
    setTimeout(() => {
      this.modal.classList.add('hidden');
    }, 200);

    this.isOpen = false;
  },

  /**
   * Save the selected profile
   */
  save() {
    if (!this.selectedProfileId) {
      this.hide();
      return;
    }

    // Find the selected option
    const options = CONSTANTS.PROFILE_OPTIONS || [];
    const selected = options.find(opt => opt.id === this.selectedProfileId);

    if (selected) {
      // Update local display
      HUD.updateProfileImage(selected.emoji);

      // Send to server
      if (typeof Network !== 'undefined') {
        Network.socket?.emit('ship:setProfile', { profileId: this.selectedProfileId });
      }

      // Update player ship data
      if (Player?.ship) {
        Player.ship.profileId = this.selectedProfileId;
      }
    }

    this.hide();
  }
};

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  window.ProfileModal = ProfileModal;

  // Initialize after DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProfileModal.init());
  } else {
    setTimeout(() => ProfileModal.init(), 0);
  }
}
