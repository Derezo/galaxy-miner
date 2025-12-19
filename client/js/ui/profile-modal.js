/**
 * Profile Modal
 * Allows players to select their profile avatar and manage settings
 * Has two tabs: Avatar and Settings
 */

const ProfileModal = {
  modal: null,
  isOpen: false,
  selectedProfileId: null,
  activeTab: 'avatar',

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
          <h2>Profile</h2>
          <button class="modal-close" aria-label="Close profile modal">&times;</button>
        </div>
        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="avatar">Avatar</button>
          <button class="profile-tab" data-tab="settings">Settings</button>
          <button class="profile-tab" data-tab="developer">Developer</button>
        </div>
        <div class="modal-body">
          <div class="tab-content" data-tab="avatar">
            <div class="profile-options-grid">
              ${this.renderProfileOptions()}
            </div>
          </div>
          <div class="tab-content" data-tab="settings" style="display: none;">
            <div id="profile-settings-content"></div>
          </div>
          <div class="tab-content" data-tab="developer" style="display: none;">
            <div id="developer-settings-content"></div>
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
   * Render settings content
   */
  renderSettings() {
    const container = this.modal.querySelector('#profile-settings-content');
    if (!container) return;

    // Use SettingsPanel to generate the HTML
    if (typeof SettingsPanel !== 'undefined') {
      container.innerHTML = SettingsPanel.renderForModal();
      SettingsPanel.bindModalEvents(container);
    } else {
      container.innerHTML = '<p style="color: var(--color-text-muted);">Settings unavailable</p>';
    }
  },

  /**
   * Render developer tab content with debug settings
   */
  renderDeveloperTab() {
    const container = this.modal.querySelector('#developer-settings-content');
    if (!container) return;

    // Check if DebugSettings is available
    if (typeof DebugSettings === 'undefined') {
      container.innerHTML = '<p style="color: var(--color-text-muted);">Debug settings unavailable</p>';
      return;
    }

    const settings = DebugSettings.getAll();
    const isEnabled = DebugSettings.isEnabled();

    // Rendering options config
    const renderingOptions = [
      { key: 'miningClaimRings', label: 'Mining Claim Rings', desc: 'Show colored rings around mining claim asteroids' },
      { key: 'collisionHitboxes', label: 'Collision Hitboxes', desc: 'Show collision boundaries for ships and objects' },
      { key: 'sectorGrid', label: 'Sector Grid Lines', desc: 'Show 1000x1000 sector boundaries with coordinates' },
      { key: 'npcStateIndicators', label: 'NPC State Indicators', desc: 'Show AI state labels above NPCs' },
      { key: 'asteroidIds', label: 'Show Asteroid IDs', desc: 'Display asteroid ID labels' },
      { key: 'planetIds', label: 'Show Planet IDs', desc: 'Display planet ID labels' }
    ];

    // Logging options config - organized by category
    const coreLoggingOptions = [
      { key: 'rendering', label: 'Rendering' },
      { key: 'worldGeneration', label: 'World Gen' },
      { key: 'audio', label: 'Audio' },
      { key: 'controls', label: 'Controls' },
      { key: 'ui', label: 'UI' },
      { key: 'network', label: 'Network' }
    ];

    const gameLoggingOptions = [
      { key: 'combat', label: 'Combat' },
      { key: 'mining', label: 'Mining' },
      { key: 'loot', label: 'Loot' },
      { key: 'relics', label: 'Relics' },
      { key: 'teams', label: 'Teams' }
    ];

    const factionLoggingOptions = [
      { key: 'pirates', label: 'Pirates' },
      { key: 'scavengers', label: 'Scavengers' },
      { key: 'swarm', label: 'Swarm' },
      { key: 'void', label: 'Void' },
      { key: 'rogue_miners', label: 'Rogue Miners' }
    ];

    container.innerHTML = `
      <div class="debug-master-toggle">
        <label class="debug-toggle-switch">
          <input type="checkbox" id="debug-master-enabled" ${isEnabled ? 'checked' : ''}>
          <span class="debug-toggle-slider"></span>
        </label>
        <div class="debug-toggle-label">
          <span class="debug-toggle-title">Enable Debugging</span>
          <span class="debug-toggle-desc">Master switch for all debug features</span>
        </div>
      </div>

      <div class="debug-settings-body ${isEnabled ? '' : 'debug-disabled'}">
        <div class="debug-section">
          <div class="debug-section-header">
            Visual Overlays
            <span class="debug-section-actions">
              <button class="debug-action-btn" data-action="all" data-section="rendering">All</button>
              <span class="debug-action-sep">|</span>
              <button class="debug-action-btn" data-action="none" data-section="rendering">None</button>
            </span>
          </div>
        ${renderingOptions.map(opt => `
          <div class="debug-option">
            <input type="checkbox"
              id="debug-render-${opt.key}"
              data-section="rendering"
              data-key="${opt.key}"
              ${settings.rendering?.[opt.key] ? 'checked' : ''}>
            <label for="debug-render-${opt.key}">
              ${opt.label}
              ${opt.desc ? `<span class="debug-option-desc">${opt.desc}</span>` : ''}
            </label>
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <div class="debug-section-header">
          Console Logging - Core Systems
          <span class="debug-section-actions">
            <button class="debug-action-btn" data-action="all" data-section="logging">All</button>
            <span class="debug-action-sep">|</span>
            <button class="debug-action-btn" data-action="none" data-section="logging">None</button>
          </span>
        </div>
        <div class="debug-options-grid">
          ${coreLoggingOptions.map(opt => `
            <div class="debug-option debug-option-compact">
              <input type="checkbox"
                id="debug-log-${opt.key}"
                data-section="logging"
                data-key="${opt.key}"
                ${settings.logging?.[opt.key] ? 'checked' : ''}>
              <label for="debug-log-${opt.key}">${opt.label}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="debug-section">
        <div class="debug-section-header">
          Console Logging - Game Systems
        </div>
        <div class="debug-options-grid">
          ${gameLoggingOptions.map(opt => `
            <div class="debug-option debug-option-compact">
              <input type="checkbox"
                id="debug-log-${opt.key}"
                data-section="logging"
                data-key="${opt.key}"
                ${settings.logging?.[opt.key] ? 'checked' : ''}>
              <label for="debug-log-${opt.key}">${opt.label}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="debug-section">
        <div class="debug-section-header">
          Console Logging - Factions
        </div>
        <div class="debug-options-grid">
          ${factionLoggingOptions.map(opt => `
            <div class="debug-option debug-option-compact">
              <input type="checkbox"
                id="debug-log-${opt.key}"
                data-section="logging"
                data-key="${opt.key}"
                ${settings.logging?.[opt.key] ? 'checked' : ''}>
              <label for="debug-log-${opt.key}">${opt.label}</label>
            </div>
          `).join('')}
        </div>
      </div>

        <button class="debug-reset-btn" id="debug-reset-btn">Reset All Debug Settings</button>
      </div>
    `;

    this.bindDeveloperEvents(container);
  },

  /**
   * Bind event handlers for developer tab
   */
  bindDeveloperEvents(container) {
    // Master toggle handler
    const masterToggle = container.querySelector('#debug-master-enabled');
    if (masterToggle) {
      masterToggle.addEventListener('change', (e) => {
        DebugSettings.setEnabled(e.target.checked);
        // Update visual state of settings body
        const settingsBody = container.querySelector('.debug-settings-body');
        if (settingsBody) {
          settingsBody.classList.toggle('debug-disabled', !e.target.checked);
        }
      });
    }

    // Individual checkbox change handlers
    container.querySelectorAll('input[type="checkbox"][data-section]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const section = e.target.dataset.section;
        const key = e.target.dataset.key;
        const value = e.target.checked;
        DebugSettings.set(section, key, value);
      });
    });

    // All/None button handlers for each section
    container.querySelectorAll('.debug-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const section = e.target.dataset.section;
        const value = action === 'all';

        // Update all checkboxes in this section
        container.querySelectorAll(`input[type="checkbox"][data-section="${section}"]`).forEach(checkbox => {
          checkbox.checked = value;
          DebugSettings.set(section, checkbox.dataset.key, value);
        });
      });
    });

    // Reset button handler
    const resetBtn = container.querySelector('#debug-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        DebugSettings.reset();
        this.renderDeveloperTab(); // Re-render with defaults
      });
    }
  },

  /**
   * Switch to a tab
   * @param {string} tabName - 'avatar', 'settings', or 'developer'
   */
  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    this.modal.querySelectorAll('.profile-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content visibility
    this.modal.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
    });

    // Render settings on first switch to settings tab
    if (tabName === 'settings') {
      this.renderSettings();
    }

    // Render developer tab on first switch
    if (tabName === 'developer') {
      this.renderDeveloperTab();
    }

    // Update footer buttons based on tab
    const saveBtn = this.modal.querySelector('#profile-save');
    if (saveBtn) {
      // Hide save button on settings/developer tabs (auto-save)
      saveBtn.style.display = tabName === 'avatar' ? 'block' : 'none';
    }
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
        z-index: var(--z-modal-high, 2000);
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
        width: 420px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        transform: scale(0.9);
        transition: transform 0.2s ease;
      }

      #profile-modal.visible .profile-modal-content {
        transform: scale(1);
      }

      #profile-modal .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-border, #334);
      }

      #profile-modal .modal-header h2 {
        margin: 0;
        font-size: 18px;
        color: var(--color-text, #eee);
      }

      #profile-modal .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--color-text-muted, #888);
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      #profile-modal .modal-close:hover {
        color: var(--color-text, #eee);
      }

      /* Pill-style tabs */
      .profile-tabs {
        display: flex;
        gap: 8px;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid var(--color-border, #334);
      }

      .profile-tab {
        flex: 1;
        padding: 10px 16px;
        background: rgba(100, 100, 100, 0.2);
        border: 1px solid var(--color-border, #334);
        border-radius: 20px;
        color: var(--color-text-muted, #888);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .profile-tab:hover {
        background: rgba(68, 102, 255, 0.2);
        border-color: var(--color-primary, #4466ff);
        color: var(--color-text, #eee);
      }

      .profile-tab.active {
        background: var(--color-primary, #4466ff);
        border-color: var(--color-primary, #4466ff);
        color: white;
        box-shadow: 0 0 12px rgba(68, 102, 255, 0.4);
      }

      #profile-modal .modal-body {
        padding: 20px;
        max-height: 400px;
        overflow-y: auto;
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

      #profile-modal .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--color-border, #334);
      }

      #profile-modal .modal-footer .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #profile-modal .modal-footer .btn-secondary {
        background: rgba(100, 100, 100, 0.3);
        color: var(--color-text-muted, #888);
        border: 1px solid var(--color-border, #334);
      }

      #profile-modal .modal-footer .btn-secondary:hover {
        background: rgba(100, 100, 100, 0.5);
        color: var(--color-text, #eee);
      }

      #profile-modal .modal-footer .btn-primary {
        background: var(--color-primary, #4466ff);
        color: white;
      }

      #profile-modal .modal-footer .btn-primary:hover {
        background: #5577ff;
        box-shadow: 0 0 15px rgba(68, 102, 255, 0.5);
      }

      #profile-modal .modal-footer .btn-primary:disabled {
        background: rgba(68, 102, 255, 0.3);
        cursor: not-allowed;
      }

      /* Settings tab content adjustments */
      #profile-settings-content {
        min-height: 200px;
      }

      #profile-settings-content .settings-panel {
        padding: 0;
      }

      #profile-settings-content .settings-section {
        margin-bottom: 0;
      }

      /* Developer tab styles */
      #developer-settings-content {
        min-height: 200px;
      }

      .debug-section {
        margin-bottom: 20px;
      }

      .debug-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        font-weight: bold;
        color: var(--color-primary-lighter, #88aaff);
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border, #334);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .debug-section-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        text-transform: none;
        letter-spacing: normal;
      }

      .debug-action-btn {
        background: transparent;
        border: none;
        color: var(--color-text-muted, #888);
        font-size: 11px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 3px;
        transition: color 0.15s, background 0.15s;
      }

      .debug-action-btn:hover {
        color: var(--color-primary-lighter, #88aaff);
        background: rgba(68, 102, 255, 0.15);
      }

      .debug-action-sep {
        color: var(--color-border, #334);
        font-size: 11px;
      }

      .debug-option {
        display: flex;
        align-items: flex-start;
        padding: 8px 0;
      }

      .debug-option input[type="checkbox"] {
        margin-right: 10px;
        margin-top: 2px;
        accent-color: var(--color-primary, #4466ff);
        cursor: pointer;
        width: 16px;
        height: 16px;
      }

      .debug-option label {
        color: var(--color-text, #eee);
        cursor: pointer;
        user-select: none;
        font-size: 13px;
        line-height: 1.4;
      }

      .debug-option-desc {
        display: block;
        color: var(--color-text-muted, #888);
        font-size: 11px;
        margin-top: 2px;
      }

      .debug-options-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px 16px;
      }

      .debug-option-compact {
        padding: 6px 0;
      }

      .debug-option-compact label {
        font-size: 12px;
      }

      .debug-reset-btn {
        margin-top: 16px;
        padding: 10px 16px;
        background: rgba(255, 100, 100, 0.2);
        border: 1px solid var(--color-danger, #ff6666);
        border-radius: 6px;
        color: var(--color-danger, #ff6666);
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        width: 100%;
        transition: all 0.2s ease;
      }

      .debug-reset-btn:hover {
        background: rgba(255, 100, 100, 0.3);
        box-shadow: 0 0 10px rgba(255, 100, 100, 0.3);
      }

      /* Master toggle styles */
      .debug-master-toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
        background: rgba(68, 102, 255, 0.1);
        border: 1px solid var(--color-primary, #4466ff);
        border-radius: 8px;
      }

      .debug-toggle-switch {
        position: relative;
        display: inline-block;
        width: 48px;
        height: 26px;
        flex-shrink: 0;
      }

      .debug-toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .debug-toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(100, 100, 100, 0.4);
        transition: 0.3s;
        border-radius: 26px;
      }

      .debug-toggle-slider:before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
      }

      .debug-toggle-switch input:checked + .debug-toggle-slider {
        background-color: var(--color-primary, #4466ff);
        box-shadow: 0 0 12px rgba(68, 102, 255, 0.5);
      }

      .debug-toggle-switch input:checked + .debug-toggle-slider:before {
        transform: translateX(22px);
      }

      .debug-toggle-label {
        display: flex;
        flex-direction: column;
      }

      .debug-toggle-title {
        font-size: 14px;
        font-weight: bold;
        color: var(--color-text, #eee);
      }

      .debug-toggle-desc {
        font-size: 11px;
        color: var(--color-text-muted, #888);
        margin-top: 2px;
      }

      /* Disabled state for settings body */
      .debug-settings-body.debug-disabled {
        opacity: 0.4;
        pointer-events: none;
        user-select: none;
      }

      .debug-settings-body {
        transition: opacity 0.2s ease;
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

    // Tab switching
    this.modal.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

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
   * @param {string} [tab='avatar'] - Tab to open ('avatar' or 'settings')
   */
  show(tab = 'avatar') {
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

    // Switch to requested tab
    this.switchTab(tab);

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
