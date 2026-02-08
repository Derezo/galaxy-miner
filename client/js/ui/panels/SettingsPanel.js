/**
 * SettingsPanel Component
 * Audio volume controls with individual mute checkboxes and improved slider styling.
 */

const SettingsPanel = {
  initialized: false,

  // Track individual mute states (separate from AudioManager's global mute)
  categoryMuted: {
    master: false,
    music: false,
    sfx: false,
    ambient: false,
    ui: false
  },

  /**
   * Initialize the settings panel
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;
  },

  /**
   * Generate the settings HTML content
   * @returns {string} HTML string
   */
  _generateHTML() {
    const masterVol = this._getVolume('master');
    const musicVol = this._getVolume('music');
    const sfxVol = this._getVolume('sfx');
    const ambientVol = this._getVolume('ambient');
    const uiVol = this._getVolume('ui');

    // Check if all categories are muted
    const allMuted = this.categoryMuted.master &&
                     this.categoryMuted.music &&
                     this.categoryMuted.sfx &&
                     this.categoryMuted.ambient &&
                     this.categoryMuted.ui;

    return `
      <div class="settings-panel">
        <div class="settings-section">
          <h3 class="settings-section-title">Audio</h3>

          <div class="volume-mute-all-row">
            <label class="volume-mute-checkbox">
              <input type="checkbox" id="mute-all-checkbox" ${allMuted ? 'checked' : ''}>
              <span class="volume-mute-label">Mute All</span>
            </label>
          </div>

          ${this._renderVolumeRow('master', 'Master', masterVol)}
          ${this._renderVolumeRow('music', 'Music', musicVol)}
          ${this._renderVolumeRow('sfx', 'SFX', sfxVol)}
          ${this._renderVolumeRow('ambient', 'Ambient', ambientVol)}
          ${this._renderVolumeRow('ui', 'UI', uiVol)}

          <div class="settings-row settings-reset-row">
            <button class="btn btn-sm" id="reset-audio-btn">Reset to Defaults</button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render a single volume row with inline mute checkbox
   */
  _renderVolumeRow(category, label, volume) {
    const isMuted = this.categoryMuted[category];
    const percentage = Math.round(volume * 100);

    return `
      <div class="volume-row" data-category="${category}">
        <label class="volume-mute-checkbox">
          <input type="checkbox" class="category-mute" data-category="${category}" ${isMuted ? 'checked' : ''}>
        </label>
        <span class="volume-label">${label}</span>
        <div class="volume-slider-container">
          <input type="range" class="volume-slider" data-category="${category}"
            min="0" max="100" value="${percentage}" ${isMuted ? 'disabled' : ''}>
          <div class="volume-slider-track"></div>
        </div>
        <span class="volume-value" data-category="${category}">${percentage}%</span>
      </div>
    `;
  },

  /**
   * Render the settings panel content
   * @param {HTMLElement} container - Container element to render into
   */
  render(container = null) {
    const targetContainer = container || document.getElementById('settings-content');
    if (!targetContainer) return;

    targetContainer.innerHTML = this._generateHTML();
    this._bindEvents(targetContainer);
  },

  /**
   * Render for embedding in Profile Modal (returns HTML string)
   * @returns {string} HTML content
   */
  renderForModal() {
    return this._generateHTML();
  },

  /**
   * Bind events to a container (used after renderForModal injection)
   * @param {HTMLElement} container - Container element
   */
  bindModalEvents(container) {
    this._bindEvents(container);
  },

  /**
   * Get volume for a category
   * @param {string} category - Volume category
   * @returns {number} Volume 0-1
   */
  _getVolume(category) {
    if (typeof AudioManager !== 'undefined' && AudioManager.getVolume) {
      return AudioManager.getVolume(category);
    }
    return 1;
  },

  /**
   * Update mute all checkbox based on individual states
   * @param {HTMLElement} container - Container element
   */
  _updateMuteAllState(container) {
    const muteAllCheckbox = container.querySelector('#mute-all-checkbox');
    if (!muteAllCheckbox) return;

    const allMuted = this.categoryMuted.master &&
                     this.categoryMuted.music &&
                     this.categoryMuted.sfx &&
                     this.categoryMuted.ambient &&
                     this.categoryMuted.ui;

    muteAllCheckbox.checked = allMuted;
  },

  /**
   * Apply mute state to AudioManager
   * @param {string} category - Category to mute/unmute
   * @param {boolean} muted - Mute state
   */
  _applyMuteState(category, muted) {
    if (typeof AudioManager === 'undefined') return;

    if (muted) {
      // Store current volume and set to 0
      AudioManager.setVolume(category, 0);
    } else {
      // Restore to default or last known value
      const defaults = { master: 1, music: 0.5, sfx: 0.7, ambient: 0.5, ui: 0.6 };
      AudioManager.setVolume(category, defaults[category]);
    }
  },

  /**
   * Bind event handlers
   * @param {HTMLElement} container - Container element
   */
  _bindEvents(container) {
    // Mute All checkbox
    const muteAllCheckbox = container.querySelector('#mute-all-checkbox');
    if (muteAllCheckbox) {
      muteAllCheckbox.addEventListener('change', () => {
        const shouldMute = muteAllCheckbox.checked;

        // Update all category mute states
        ['master', 'music', 'sfx', 'ambient', 'ui'].forEach(category => {
          this.categoryMuted[category] = shouldMute;
          this._applyMuteState(category, shouldMute);

          // Update individual checkboxes
          const checkbox = container.querySelector(`.category-mute[data-category="${category}"]`);
          if (checkbox) checkbox.checked = shouldMute;

          // Update slider disabled state
          const slider = container.querySelector(`.volume-slider[data-category="${category}"]`);
          if (slider) slider.disabled = shouldMute;

          // Update value display
          const valueDisplay = container.querySelector(`.volume-value[data-category="${category}"]`);
          if (valueDisplay && shouldMute) {
            valueDisplay.textContent = '0%';
          } else if (valueDisplay && !shouldMute) {
            const defaults = { master: 100, music: 50, sfx: 70, ambient: 50, ui: 60 };
            valueDisplay.textContent = `${defaults[category]}%`;
            if (slider) slider.value = defaults[category];
          }
        });

        // Play sound if unmuting
        if (!shouldMute && typeof AudioManager !== 'undefined') {
          AudioManager.play('ui_click');
        }
      });
    }

    // Individual mute checkboxes
    container.querySelectorAll('.category-mute').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const category = checkbox.dataset.category;
        const isMuted = checkbox.checked;

        this.categoryMuted[category] = isMuted;
        this._applyMuteState(category, isMuted);

        // Update slider disabled state
        const slider = container.querySelector(`.volume-slider[data-category="${category}"]`);
        if (slider) slider.disabled = isMuted;

        // Update value display
        const valueDisplay = container.querySelector(`.volume-value[data-category="${category}"]`);
        if (valueDisplay && isMuted) {
          valueDisplay.textContent = '0%';
        }

        // Update mute all checkbox
        this._updateMuteAllState(container);

        // Play sound if unmuting a category (and master isn't muted)
        if (!isMuted && !this.categoryMuted.master && typeof AudioManager !== 'undefined') {
          if (category === 'sfx') AudioManager.play('weapon_fire_1');
          else if (category === 'ui') AudioManager.play('ui_click');
        }
      });
    });

    // Volume sliders
    container.querySelectorAll('.volume-slider').forEach(slider => {
      const category = slider.dataset.category;
      const valueDisplay = container.querySelector(`.volume-value[data-category="${category}"]`);

      slider.addEventListener('input', () => {
        const value = parseInt(slider.value) / 100;
        if (valueDisplay) {
          valueDisplay.textContent = `${slider.value}%`;
        }
        if (typeof AudioManager !== 'undefined' && AudioManager.setVolume) {
          AudioManager.setVolume(category, value);
        }
      });

      // Play test sound on release
      slider.addEventListener('change', () => {
        if (typeof AudioManager !== 'undefined') {
          if (category === 'sfx') {
            AudioManager.play('weapon_fire_1');
          } else if (category === 'ui') {
            AudioManager.play('ui_click');
          }
        }
      });
    });

    // Reset button
    const resetBtn = container.querySelector('#reset-audio-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // Reset mute states
        this.categoryMuted = { master: false, music: false, sfx: false, ambient: false, ui: false };

        if (typeof AudioManager !== 'undefined') {
          // Reset all volumes to defaults
          if (AudioManager.setVolume) {
            AudioManager.setVolume('master', 1);
            AudioManager.setVolume('music', 0.5);
            AudioManager.setVolume('sfx', 0.7);
            AudioManager.setVolume('ambient', 0.5);
            AudioManager.setVolume('ui', 0.6);
          }
          // Play confirmation sound
          AudioManager.play('ui_click');
        }

        // Re-render to update UI
        this.render(container);
      });
    }
  },

  /**
   * Refresh the panel
   */
  refresh() {
    this.render();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.SettingsPanel = SettingsPanel;
}
