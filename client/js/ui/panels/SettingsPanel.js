/**
 * SettingsPanel Component
 * Audio volume controls with master, SFX, ambient, and UI sliders.
 */

const SettingsPanel = {
  initialized: false,

  /**
   * Initialize the settings panel
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;
  },

  /**
   * Render the settings panel content
   * @param {HTMLElement} container - Container element to render into
   */
  render(container = null) {
    const targetContainer = container || document.getElementById('settings-content');
    if (!targetContainer) return;

    // Get current volume values from AudioManager
    const masterVol = this._getVolume('master');
    const sfxVol = this._getVolume('sfx');
    const ambientVol = this._getVolume('ambient');
    const uiVol = this._getVolume('ui');
    const isMuted = this._getMuted();

    const html = `
      <div class="settings-panel">
        <div class="settings-section">
          <h3 class="settings-section-title">Audio</h3>

          <div class="settings-row">
            <button class="btn ${isMuted ? 'btn-danger' : 'btn-primary'}" id="mute-btn" style="width: 100%; margin-bottom: 16px;">
              ${isMuted ? 'Unmute All Audio' : 'Mute All Audio'}
            </button>
          </div>

          <div class="settings-row">
            <label class="settings-label">
              <span class="settings-label-text">Master Volume</span>
              <span class="settings-value" id="master-value">${Math.round(masterVol * 100)}%</span>
            </label>
            <input type="range" class="settings-slider" id="master-slider"
              min="0" max="100" value="${Math.round(masterVol * 100)}" ${isMuted ? 'disabled' : ''}>
          </div>

          <div class="settings-row">
            <label class="settings-label">
              <span class="settings-label-text">SFX Volume</span>
              <span class="settings-value" id="sfx-value">${Math.round(sfxVol * 100)}%</span>
            </label>
            <input type="range" class="settings-slider" id="sfx-slider"
              min="0" max="100" value="${Math.round(sfxVol * 100)}" ${isMuted ? 'disabled' : ''}>
          </div>

          <div class="settings-row">
            <label class="settings-label">
              <span class="settings-label-text">Ambient Volume</span>
              <span class="settings-value" id="ambient-value">${Math.round(ambientVol * 100)}%</span>
            </label>
            <input type="range" class="settings-slider" id="ambient-slider"
              min="0" max="100" value="${Math.round(ambientVol * 100)}" ${isMuted ? 'disabled' : ''}>
          </div>

          <div class="settings-row">
            <label class="settings-label">
              <span class="settings-label-text">UI Volume</span>
              <span class="settings-value" id="ui-value">${Math.round(uiVol * 100)}%</span>
            </label>
            <input type="range" class="settings-slider" id="ui-slider"
              min="0" max="100" value="${Math.round(uiVol * 100)}" ${isMuted ? 'disabled' : ''}>
          </div>

          <div class="settings-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border);">
            <button class="btn btn-sm" id="reset-audio-btn">Reset to Defaults</button>
          </div>
        </div>
      </div>
    `;

    targetContainer.innerHTML = html;
    this._bindEvents(targetContainer);
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
   * Get muted state
   * @returns {boolean}
   */
  _getMuted() {
    if (typeof AudioManager !== 'undefined' && AudioManager.getMuted) {
      return AudioManager.getMuted();
    }
    return false;
  },

  /**
   * Bind event handlers
   * @param {HTMLElement} container - Container element
   */
  _bindEvents(container) {
    // Mute button
    const muteBtn = container.querySelector('#mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (typeof AudioManager !== 'undefined' && AudioManager.toggleMute) {
          AudioManager.toggleMute();
          // Play click sound if not muted
          if (!AudioManager.getMuted()) {
            AudioManager.play('ui_click');
          }
          this.render(container);
        }
      });
    }

    // Volume sliders
    const sliders = [
      { id: 'master-slider', category: 'master', valueId: 'master-value' },
      { id: 'sfx-slider', category: 'sfx', valueId: 'sfx-value' },
      { id: 'ambient-slider', category: 'ambient', valueId: 'ambient-value' },
      { id: 'ui-slider', category: 'ui', valueId: 'ui-value' }
    ];

    sliders.forEach(({ id, category, valueId }) => {
      const slider = container.querySelector(`#${id}`);
      const valueDisplay = container.querySelector(`#${valueId}`);

      if (slider) {
        slider.addEventListener('input', () => {
          const value = parseInt(slider.value) / 100;
          if (valueDisplay) {
            valueDisplay.textContent = `${slider.value}%`;
          }
          if (typeof AudioManager !== 'undefined' && AudioManager.setVolume) {
            AudioManager.setVolume(category, value);
          }
        });

        // Play test sound on release for SFX/UI sliders
        slider.addEventListener('change', () => {
          if (typeof AudioManager !== 'undefined') {
            if (category === 'sfx') {
              AudioManager.play('weapon_fire_1');
            } else if (category === 'ui') {
              AudioManager.play('ui_click');
            }
          }
        });
      }
    });

    // Reset button
    const resetBtn = container.querySelector('#reset-audio-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (typeof AudioManager !== 'undefined') {
          // Reset all volumes to defaults
          if (AudioManager.setVolume) {
            AudioManager.setVolume('master', 1);
            AudioManager.setVolume('sfx', 0.7);
            AudioManager.setVolume('ambient', 0.5);
            AudioManager.setVolume('ui', 0.6);
          }
          // Unmute if muted
          if (AudioManager.getMuted && AudioManager.getMuted()) {
            AudioManager.toggleMute();
          }
          // Play confirmation sound
          AudioManager.play('notification_success');
        }
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
