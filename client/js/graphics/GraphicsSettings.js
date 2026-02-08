/**
 * Galaxy Miner - Graphics Settings Module
 * Central configuration store for graphics quality with localStorage persistence
 *
 * Supports:
 * - Continuous 0-100 quality slider with exponential scaling
 * - 5 preset levels: Ultra Low (0), Low (10), Medium (40), High (80), Ultra (100)
 * - Advanced mode toggle for slider vs preset dropdown
 * - Listener pattern for live quality updates
 * - Backwards compatibility with legacy get(key) API
 */

const GraphicsSettings = {
  _storageKey: 'galaxy-miner-graphics-settings',

  // Core state
  _quality: 80,           // 0-100 continuous quality value
  _advancedMode: false,   // Whether user is using slider vs presets
  _renderScale: 1.0,      // Canvas resolution scale (0.5-1.0), lower = better perf

  // Preset definitions
  _presets: {
    ultraLow: { value: 0, label: 'Ultra Low', description: 'Minimal rendering - basic shapes only, no effects' },
    low: { value: 10, label: 'Low', description: 'Reduced particles, no nebula, basic stars' },
    medium: { value: 40, label: 'Medium', description: 'Balanced visuals with moderate effects' },
    high: { value: 80, label: 'High', description: 'Full visual effects (recommended)' },
    ultra: { value: 100, label: 'Ultra', description: 'Maximum quality with enhanced effects' }
  },

  // Listeners for quality changes
  _listeners: [],

  // Legacy preset mapping for backwards compatibility
  _legacyPresetMapping: {
    low: 10,
    medium: 40,
    high: 80
  },

  /**
   * Initialize graphics settings
   */
  init() {
    this.load();
    console.log('[GraphicsSettings] Initialized - quality:', this._quality,
      'preset:', this.getPreset(), 'advancedMode:', this._advancedMode);
  },

  // ============================================
  // Core Quality API
  // ============================================

  /**
   * Get current quality level (0-100)
   * @returns {number} Quality level 0-100
   */
  getQuality() {
    return this._quality;
  },

  /**
   * Set quality level (0-100)
   * @param {number} value - Quality level 0-100
   * @param {boolean} [notify=true] - Whether to notify listeners
   */
  setQuality(value, notify = true) {
    const oldQuality = this._quality;
    this._quality = Math.max(0, Math.min(100, Math.round(value)));

    if (oldQuality !== this._quality) {
      this.save();
      console.log('[GraphicsSettings] Quality set to:', this._quality);

      if (notify) {
        this._notifyListeners();
      }
    }
  },

  /**
   * Get current preset name based on quality value
   * @returns {string} Preset name or 'custom' if between presets
   */
  getPreset() {
    for (const [name, preset] of Object.entries(this._presets)) {
      if (this._quality === preset.value) {
        return name;
      }
    }
    return 'custom';
  },

  /**
   * Get preset label for display
   * @returns {string} Human-readable preset name
   */
  getPresetLabel() {
    const preset = this.getPreset();
    if (preset === 'custom') {
      return `Custom (${this._quality})`;
    }
    return this._presets[preset].label;
  },

  /**
   * Set quality to a preset value
   * @param {string} presetName - Preset name (ultraLow, low, medium, high, ultra)
   */
  setPreset(presetName) {
    const preset = this._presets[presetName];
    if (preset) {
      this.setQuality(preset.value);
    } else {
      console.warn('[GraphicsSettings] Unknown preset:', presetName);
    }
  },

  /**
   * Get all preset definitions
   * @returns {Object} Preset definitions
   */
  getPresets() {
    return { ...this._presets };
  },

  // ============================================
  // Advanced Mode
  // ============================================

  /**
   * Check if advanced mode (slider) is enabled
   * @returns {boolean}
   */
  isAdvancedMode() {
    return this._advancedMode;
  },

  /**
   * Toggle advanced mode
   * @param {boolean} enabled
   */
  setAdvancedMode(enabled) {
    this._advancedMode = enabled;
    this.save();
  },

  // ============================================
  // Listener Pattern
  // ============================================

  /**
   * Add listener for quality changes
   * @param {function} callback - Called with (quality, oldQuality)
   * @returns {function} Unsubscribe function
   */
  addListener(callback) {
    this._listeners.push(callback);
    return () => this.removeListener(callback);
  },

  /**
   * Remove listener
   * @param {function} callback
   */
  removeListener(callback) {
    const index = this._listeners.indexOf(callback);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  },

  /**
   * Notify all listeners of quality change
   * @private
   */
  _notifyListeners() {
    for (const callback of this._listeners) {
      try {
        callback(this._quality);
      } catch (e) {
        console.error('[GraphicsSettings] Listener error:', e);
      }
    }
  },

  // ============================================
  // Scaled Value Access (uses QualityScaler)
  // ============================================

  /**
   * Get particle multiplier for current quality
   * @returns {number} Multiplier 0-2
   */
  getParticleMultiplier() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.getParticleMultiplier(this._quality);
    }
    // Fallback if QualityScaler not loaded
    return this._quality / 80;
  },

  /**
   * Get pool size for current quality
   * @returns {number} Pool size
   */
  getPoolSize() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.scalePoolSize(this._quality);
    }
    // Fallback
    return Math.round(75 + (this._quality / 100) * 925);
  },

  /**
   * Check if a feature is enabled at current quality
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  isFeatureEnabled(feature) {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.isEnabled(this._quality, feature);
    }
    // Fallback - enable all at quality > 20
    return this._quality > 20;
  },

  /**
   * Get LOD level for current quality
   * @returns {number} LOD level 0-4
   */
  getLOD() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.scaleLOD(this._quality);
    }
    // Fallback
    if (this._quality < 10) return 0;
    if (this._quality < 30) return 1;
    if (this._quality < 60) return 2;
    if (this._quality < 90) return 3;
    return 4;
  },

  /**
   * Get screen shake multiplier
   * @returns {number} Multiplier 0-1
   */
  getScreenShakeMultiplier() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.getScreenShakeMultiplier(this._quality);
    }
    return this._quality >= 20 ? this._quality / 100 : 0;
  },

  /**
   * Get starfield configuration
   * @returns {Object} Starfield config
   */
  getStarfieldConfig() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.getStarfieldConfig(this._quality);
    }
    // Fallback to current defaults
    return {
      layers: 3,
      counts: [150, 80, 40],
      glow: true,
      twinkle: true,
      drift: true
    };
  },

  /**
   * Get nebula configuration
   * @returns {Object} Nebula config
   */
  getNebulaConfig() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.getNebulaConfig(this._quality);
    }
    // Fallback
    return { enabled: true, cloudCount: 12, opacityMultiplier: 1.0 };
  },

  /**
   * Get thrust trail configuration
   * @returns {Object} Thrust config
   */
  getThrustConfig() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.getThrustConfig(this._quality);
    }
    return { enabled: true, multiplier: 1.0, trailLength: 1.0 };
  },

  /**
   * Get death effect configuration
   * @returns {Object} Death effect config
   */
  getDeathEffectConfig() {
    if (typeof QualityScaler !== 'undefined') {
      return QualityScaler.getDeathEffectConfig(this._quality);
    }
    return {
      particleMultiplier: 1.0,
      debrisMultiplier: 1.0,
      shockwave: true,
      secondaryExplosions: false,
      screenShake: true
    };
  },

  // ============================================
  // Resolution Scaling
  // ============================================

  /**
   * Get current render scale (0.5-1.0)
   * Used for canvas resolution scaling - lower values reduce GPU load
   * @returns {number} Render scale factor
   */
  getRenderScale() {
    return this._renderScale;
  },

  /**
   * Set render scale (clamped to 0.5-1.0)
   * @param {number} scale - Render scale factor
   */
  setRenderScale(scale) {
    const oldScale = this._renderScale;
    this._renderScale = Math.max(0.5, Math.min(1.0, scale));

    if (oldScale !== this._renderScale) {
      this.save();
      console.log('[GraphicsSettings] Render scale set to:', this._renderScale);
      this._notifyListeners();
    }
  },

  // ============================================
  // Backwards Compatibility API
  // ============================================

  /**
   * Get legacy level name (low/medium/high)
   * @deprecated Zero callers - safe to remove in future cleanup. Use getPreset() instead.
   * @returns {'low' | 'medium' | 'high'}
   */
  getLevel() {
    if (this._quality <= 25) return 'low';
    if (this._quality <= 60) return 'medium';
    return 'high';
  },

  /**
   * Set legacy level
   * @deprecated Zero callers - safe to remove in future cleanup. Use setPreset() or setQuality() instead.
   * @param {'low' | 'medium' | 'high'} level
   */
  setLevel(level) {
    const quality = this._legacyPresetMapping[level];
    if (quality !== undefined) {
      this.setQuality(quality);
    } else {
      console.warn('[GraphicsSettings] Invalid legacy level:', level);
    }
  },

  /**
   * Get specific config value (legacy API)
   * Maps old key names to new scaled values
   * @deprecated Zero callers - safe to remove in future cleanup. Use specific getter methods instead.
   * @param {string} key - Config key
   * @returns {*} Config value
   */
  get(key) {
    // Map legacy keys to new methods
    switch (key) {
      case 'particlePoolSize':
        return this.getPoolSize();

      case 'particleMultiplier':
        return this.getParticleMultiplier();

      case 'coronaFlares':
        return this.isFeatureEnabled('coronaFlares');

      case 'screenShakeMultiplier':
        return this.getScreenShakeMultiplier();

      case 'floatingText':
        return this.isFeatureEnabled('floatingText');

      case 'shieldRipples':
        return this.isFeatureEnabled('shieldRipples');

      case 'thrustTrailLength':
        return this.getThrustConfig().trailLength;

      case 'deathEffectMultiplier':
        return this.getDeathEffectConfig().particleMultiplier;

      default:
        console.warn('[GraphicsSettings] Unknown key:', key);
        return undefined;
    }
  },

  /**
   * Get full config object (legacy API)
   * @deprecated Zero callers - safe to remove in future cleanup. Use specific getter methods instead.
   * @returns {Object} Config object with legacy keys
   */
  getConfig() {
    return {
      particlePoolSize: this.getPoolSize(),
      particleMultiplier: this.getParticleMultiplier(),
      coronaFlares: this.isFeatureEnabled('coronaFlares'),
      screenShakeMultiplier: this.getScreenShakeMultiplier(),
      floatingText: this.isFeatureEnabled('floatingText'),
      shieldRipples: this.isFeatureEnabled('shieldRipples'),
      thrustTrailLength: this.getThrustConfig().trailLength,
      deathEffectMultiplier: this.getDeathEffectConfig().particleMultiplier
    };
  },

  // ============================================
  // Persistence
  // ============================================

  /**
   * Save settings to localStorage
   */
  save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify({
        quality: this._quality,
        advancedMode: this._advancedMode,
        renderScale: this._renderScale,
        version: 2  // Version for migration detection
      }));
    } catch (e) {
      console.error('[GraphicsSettings] Failed to save:', e);
    }
  },

  /**
   * Load settings from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem(this._storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);

        // Mobile detection for default render scale
        // Note: DeviceDetect.init() hasn't been called yet at this point, so we
        // check the user agent directly (same regex DeviceDetect uses)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const defaultRenderScale = isMobile ? 0.75 : 1.0;

        // Handle migration from v1 (level-based) to v2 (quality-based)
        if (parsed.level && !parsed.quality) {
          // Legacy format - convert level to quality
          const quality = this._legacyPresetMapping[parsed.level];
          this._quality = quality !== undefined ? quality : 80;
          this._advancedMode = false;
          this._renderScale = defaultRenderScale;
          console.log('[GraphicsSettings] Migrated from legacy format, level:', parsed.level, '-> quality:', this._quality);
          this.save(); // Save in new format
        } else {
          // v2 format
          this._quality = typeof parsed.quality === 'number'
            ? Math.max(0, Math.min(100, parsed.quality))
            : 80;
          this._advancedMode = parsed.advancedMode || false;
          this._renderScale = typeof parsed.renderScale === 'number'
            ? Math.max(0.5, Math.min(1.0, parsed.renderScale))
            : defaultRenderScale;
        }
      } else {
        // First launch (no saved settings) - default to Medium on mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          this._quality = 40;
          this._renderScale = 0.75;
          console.log('[GraphicsSettings] Mobile device detected on first launch, defaulting to Medium (quality: 40), renderScale: 0.75');
        }
      }
    } catch (e) {
      console.error('[GraphicsSettings] Failed to load:', e);
      this._quality = 80;
      this._advancedMode = false;
      this._renderScale = 1.0;
    }
  },

  /**
   * Reset to default settings
   */
  reset() {
    this._quality = 80;
    this._advancedMode = false;
    this._renderScale = 1.0;
    this.save();
    this._notifyListeners();
    console.log('[GraphicsSettings] Reset to defaults (quality: 80, renderScale: 1.0)');
  },

  /**
   * Debug: Log current state
   */
  debug() {
    console.group('[GraphicsSettings] Current State');
    console.log('Quality:', this._quality);
    console.log('Preset:', this.getPresetLabel());
    console.log('Advanced Mode:', this._advancedMode);
    console.log('Render Scale:', this._renderScale);
    console.log('LOD:', this.getLOD());
    console.log('Particle Multiplier:', this.getParticleMultiplier().toFixed(2));
    console.log('Pool Size:', this.getPoolSize());
    console.log('Starfield:', this.getStarfieldConfig());
    console.log('Nebula:', this.getNebulaConfig());
    console.log('Listeners:', this._listeners.length);
    console.groupEnd();
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
