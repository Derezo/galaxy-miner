// Galaxy Miner - Debug Settings Module
// Central configuration store for debug flags with localStorage persistence

const DebugSettings = {
  _defaults: {
    enabled: false,  // Master toggle - when false, all debug features are disabled
    rendering: {
      miningClaimRings: false,
      collisionHitboxes: false,
      sectorGrid: false,
      npcStateIndicators: false,
      asteroidIds: false,
      planetIds: false
    },
    logging: {
      // Core systems
      rendering: false,
      worldGeneration: false,
      audio: false,
      controls: false,
      ui: false,
      network: false,
      // Game systems
      combat: false,
      mining: false,
      loot: false,
      relics: false,
      teams: false,
      graveyard: false,  // Graveyard zone base filtering
      // Faction-specific (AI, mining beam, etc.)
      pirates: false,
      scavengers: false,
      swarm: false,
      void: false,
      rogue_miners: false
    }
  },

  settings: null,
  _storageKey: 'galaxy-miner-debug-settings',

  init() {
    this.load();
    console.log('[DebugSettings] Initialized, enabled:', this.isEnabled());
  },

  /**
   * Check if debug mode is globally enabled
   */
  isEnabled() {
    if (!this.settings) this.load();
    return this.settings?.enabled ?? false;
  },

  /**
   * Set the master debug toggle
   */
  setEnabled(value) {
    if (!this.settings) this.settings = this._deepClone(this._defaults);
    this.settings.enabled = !!value;
    this.save();
  },

  get(section, key) {
    if (!this.settings) this.load();
    // If master toggle is off, always return false for debug features
    if (!this.settings?.enabled) return false;
    return this.settings?.[section]?.[key] ?? this._defaults[section]?.[key] ?? false;
  },

  set(section, key, value) {
    if (!this.settings) this.settings = this._deepClone(this._defaults);
    if (!this.settings[section]) this.settings[section] = {};
    this.settings[section][key] = value;
    this.save();
  },

  getAll() {
    if (!this.settings) this.load();
    return this.settings;
  },

  save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this.settings));
    } catch (e) {
      console.error('[DebugSettings] Failed to save:', e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(this._storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved settings with defaults (in case new settings were added)
        this.settings = this._deepMerge(this._deepClone(this._defaults), parsed);
      } else {
        this.settings = this._deepClone(this._defaults);
      }
    } catch (e) {
      console.error('[DebugSettings] Failed to load:', e);
      this.settings = this._deepClone(this._defaults);
    }
  },

  reset() {
    this.settings = this._deepClone(this._defaults);
    this.save();
    console.log('[DebugSettings] Reset to defaults');
  },

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  _deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
};

// Auto-initialize and expose globally
if (typeof window !== 'undefined') {
  window.DebugSettings = DebugSettings;
  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DebugSettings.init());
  } else {
    DebugSettings.init();
  }
}
