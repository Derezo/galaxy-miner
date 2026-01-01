// Galaxy Miner - Graphics Settings Module
// Central configuration store for graphics quality with localStorage persistence

const GraphicsSettings = {
  _storageKey: 'galaxy-miner-graphics-settings',
  _level: 'high', // 'low' | 'medium' | 'high'

  // Preset configurations for each quality level
  _presets: {
    low: {
      particlePoolSize: 150,
      particleMultiplier: 0.4,
      coronaFlares: false,
      screenShakeMultiplier: 0.5,
      floatingText: false,
      shieldRipples: false,
      thrustTrailLength: 0.4,  // Multiplier for trail particles
      deathEffectMultiplier: 0.4
    },
    medium: {
      particlePoolSize: 300,
      particleMultiplier: 0.7,
      coronaFlares: true,
      screenShakeMultiplier: 1.0,
      floatingText: true,
      shieldRipples: true,
      thrustTrailLength: 0.7,
      deathEffectMultiplier: 0.7
    },
    high: {
      particlePoolSize: 500,
      particleMultiplier: 1.0,
      coronaFlares: true,
      screenShakeMultiplier: 1.0,
      floatingText: true,
      shieldRipples: true,
      thrustTrailLength: 1.0,
      deathEffectMultiplier: 1.0
    }
  },

  init() {
    this.load();
    console.log('[GraphicsSettings] Initialized, level:', this._level);
  },

  /**
   * Get current graphics quality level
   * @returns {'low' | 'medium' | 'high'}
   */
  getLevel() {
    return this._level;
  },

  /**
   * Set graphics quality level
   * @param {'low' | 'medium' | 'high'} level
   */
  setLevel(level) {
    if (!['low', 'medium', 'high'].includes(level)) {
      console.warn('[GraphicsSettings] Invalid level:', level);
      return;
    }
    this._level = level;
    this.save();
    console.log('[GraphicsSettings] Level set to:', level);
  },

  /**
   * Get the configuration object for the current quality level
   * @returns {Object} Configuration values for current level
   */
  getConfig() {
    return this._presets[this._level] || this._presets.high;
  },

  /**
   * Get a specific config value
   * @param {string} key - Config key to retrieve
   * @returns {*} The config value
   */
  get(key) {
    const config = this.getConfig();
    return config[key];
  },

  save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify({ level: this._level }));
    } catch (e) {
      console.error('[GraphicsSettings] Failed to save:', e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(this._storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.level && ['low', 'medium', 'high'].includes(parsed.level)) {
          this._level = parsed.level;
        }
      }
    } catch (e) {
      console.error('[GraphicsSettings] Failed to load:', e);
      this._level = 'high';
    }
  },

  reset() {
    this._level = 'high';
    this.save();
    console.log('[GraphicsSettings] Reset to default (high)');
  }
};

// Auto-initialize and expose globally
if (typeof window !== 'undefined') {
  window.GraphicsSettings = GraphicsSettings;
  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GraphicsSettings.init());
  } else {
    GraphicsSettings.init();
  }
}
