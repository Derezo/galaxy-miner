/**
 * Mobile Settings Panel
 * Allows mobile players to customize touch controls
 */

const MobileSettingsPanel = {
  settings: {
    joystickSize: 120,
    joystickDeadzone: 0.15,
    autoFireEnabled: true,
    autoFireTolerance: 30,
    hapticFeedback: true
  },

  _initialized: false,

  init() {
    if (this._initialized) return;
    this.loadSettings();
    this._initialized = true;
    Logger.log('MobileSettingsPanel initialized');
  },

  /**
   * Show the mobile settings panel
   */
  show() {
    this.init();

    const content = this.render();
    const modal = Modal.open({
      title: 'Mobile Settings',
      content: content,
      className: 'mobile-settings-modal'
    });

    this.bindPanelEvents(modal.contentEl);
  },

  /**
   * Render the settings panel content
   */
  render() {
    const container = document.createElement('div');
    container.className = 'mobile-settings';
    container.innerHTML = `
      <div class="settings-section">
        <h3 class="settings-section-title">Controls</h3>

        <div class="settings-row">
          <div class="settings-label">
            <span class="label-text">Joystick Size</span>
            <span class="label-value" data-value="joystickSize">${this.settings.joystickSize}px</span>
          </div>
          <input type="range" class="settings-slider"
                 min="80" max="160" step="10"
                 value="${this.settings.joystickSize}"
                 data-setting="joystickSize">
        </div>

        <div class="settings-row">
          <div class="settings-label">
            <span class="label-text">Joystick Deadzone</span>
            <span class="label-value" data-value="joystickDeadzone">${Math.round(this.settings.joystickDeadzone * 100)}%</span>
          </div>
          <input type="range" class="settings-slider"
                 min="5" max="30" step="5"
                 value="${Math.round(this.settings.joystickDeadzone * 100)}"
                 data-setting="joystickDeadzone">
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Auto-Fire</h3>

        <div class="settings-row settings-row-toggle">
          <span class="label-text">Enable Auto-Fire</span>
          <label class="settings-toggle">
            <input type="checkbox"
                   ${this.settings.autoFireEnabled ? 'checked' : ''}
                   data-setting="autoFireEnabled">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-row" data-requires="autoFireEnabled">
          <div class="settings-label">
            <span class="label-text">Aim Tolerance</span>
            <span class="label-value" data-value="autoFireTolerance">${this.settings.autoFireTolerance}°</span>
          </div>
          <input type="range" class="settings-slider"
                 min="15" max="60" step="5"
                 value="${this.settings.autoFireTolerance}"
                 data-setting="autoFireTolerance"
                 ${!this.settings.autoFireEnabled ? 'disabled' : ''}>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Feedback</h3>

        <div class="settings-row settings-row-toggle">
          <span class="label-text">Haptic Feedback</span>
          <label class="settings-toggle">
            <input type="checkbox"
                   ${this.settings.hapticFeedback ? 'checked' : ''}
                   data-setting="hapticFeedback"
                   ${!('vibrate' in navigator) ? 'disabled' : ''}>
            <span class="toggle-slider"></span>
          </label>
          ${!('vibrate' in navigator) ? '<span class="settings-note">Not supported on this device</span>' : ''}
        </div>
      </div>

      <div class="settings-actions">
        <button class="hud-btn btn-secondary" data-action="reset">Reset to Defaults</button>
      </div>
    `;

    return container;
  },

  /**
   * Bind event handlers for the settings panel
   */
  bindPanelEvents(container) {
    // Slider changes
    container.querySelectorAll('.settings-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const setting = e.target.dataset.setting;
        let value = parseInt(e.target.value, 10);

        // Convert percentage to decimal for deadzone
        if (setting === 'joystickDeadzone') {
          this.settings[setting] = value / 100;
        } else {
          this.settings[setting] = value;
        }

        // Update display value
        this.updateValueDisplay(container, setting);
        this.applySettings();
        this.saveSettings();
      });
    });

    // Checkbox changes
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const setting = e.target.dataset.setting;
        this.settings[setting] = e.target.checked;

        // Enable/disable dependent fields
        if (setting === 'autoFireEnabled') {
          const toleranceSlider = container.querySelector('[data-setting="autoFireTolerance"]');
          if (toleranceSlider) {
            toleranceSlider.disabled = !e.target.checked;
          }
        }

        this.applySettings();
        this.saveSettings();
      });
    });

    // Reset button
    const resetBtn = container.querySelector('[data-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetToDefaults();
        // Re-render the panel
        Modal.closeAll();
        this.show();
      });
    }
  },

  /**
   * Update the display value for a setting
   */
  updateValueDisplay(container, setting) {
    const valueEl = container.querySelector(`[data-value="${setting}"]`);
    if (!valueEl) return;

    switch (setting) {
      case 'joystickSize':
        valueEl.textContent = `${this.settings.joystickSize}px`;
        break;
      case 'joystickDeadzone':
        valueEl.textContent = `${Math.round(this.settings.joystickDeadzone * 100)}%`;
        break;
      case 'autoFireTolerance':
        valueEl.textContent = `${this.settings.autoFireTolerance}°`;
        break;
    }
  },

  /**
   * Apply current settings to game modules
   */
  applySettings() {
    // Apply to VirtualJoystick
    if (typeof VirtualJoystick !== 'undefined') {
      VirtualJoystick.config.size = this.settings.joystickSize;
      VirtualJoystick.config.deadzone = this.settings.joystickDeadzone;
    }

    // Apply to AutoFire
    if (typeof AutoFire !== 'undefined') {
      AutoFire.enabled = this.settings.autoFireEnabled;
      AutoFire.aimTolerance = this.settings.autoFireTolerance * Math.PI / 180;
    }

    Logger.log('Mobile settings applied:', this.settings);
  },

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem('galaxyMiner_mobileSettings', JSON.stringify(this.settings));
    } catch (e) {
      Logger.error('Failed to save mobile settings:', e);
    }
  },

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem('galaxyMiner_mobileSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch (e) {
      Logger.error('Failed to load mobile settings:', e);
    }

    // Apply loaded settings
    this.applySettings();
  },

  /**
   * Reset settings to defaults
   */
  resetToDefaults() {
    this.settings = {
      joystickSize: 120,
      joystickDeadzone: 0.15,
      autoFireEnabled: true,
      autoFireTolerance: 30,
      hapticFeedback: true
    };
    this.applySettings();
    this.saveSettings();
    Logger.log('Mobile settings reset to defaults');
  },

  /**
   * Trigger haptic feedback if enabled
   */
  vibrate(pattern = 50) {
    if (this.settings.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MobileSettingsPanel = MobileSettingsPanel;
}
