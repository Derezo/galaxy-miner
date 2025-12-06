/**
 * Ship Geometry Definitions
 * SVG path data for 5 tier ship designs with progressive complexity
 * All paths are designed with the ship pointing RIGHT (0 radians)
 */

const ShipGeometry = {
  // Base size from constants (20 units)
  SIZE: 20, // Will be synced with CONSTANTS.SHIP_SIZE

  /**
   * SVG Path definitions for each tier
   */
  PATHS: {
    // Tier 1: Simple arrow (4 points)
    1: null, // Will be computed in init()
    2: null,
    3: null,
    4: null,
    5: null
  },

  /**
   * Cockpit accent paths (tier 2+)
   */
  COCKPIT_PATHS: {
    2: null,
    3: null,
    4: null,
    5: null
  },

  /**
   * Cached Path2D objects
   */
  cachedPaths: {},
  cachedCockpits: {},

  /**
   * Color schemes by ship type and tier
   */
  COLORS: {
    player: {
      1: { hull: '#00ff00', accent: '#00cc00', glow: '#00ff0040' },
      2: { hull: '#00ff44', accent: '#00dd22', glow: '#00ff4450' },
      3: { hull: '#00ff88', accent: '#00ee55', glow: '#00ff8860' },
      4: { hull: '#00ffbb', accent: '#00ee88', glow: '#00ffbb70' },
      5: { hull: '#00ffee', accent: '#00eebb', glow: '#00ffee80' }
    },
    other: {
      1: { hull: '#0088ff', accent: '#0066cc', glow: '#0088ff40' },
      2: { hull: '#0099ff', accent: '#0077dd', glow: '#0099ff50' },
      3: { hull: '#00aaff', accent: '#0088ee', glow: '#00aaff60' },
      4: { hull: '#00bbff', accent: '#0099ee', glow: '#00bbff70' },
      5: { hull: '#00ccff', accent: '#00aaee', glow: '#00ccff80' }
    },
    npc: {
      1: { hull: '#ff3300', accent: '#cc2200', glow: '#ff330040' },
      2: { hull: '#ff4411', accent: '#dd3300', glow: '#ff441150' },
      3: { hull: '#ff5522', accent: '#ee4400', glow: '#ff552260' },
      4: { hull: '#ff6633', accent: '#ee5500', glow: '#ff663370' },
      5: { hull: '#ff7744', accent: '#ee6600', glow: '#ff774480' }
    }
  },

  /**
   * Size multiplier by tier
   */
  SIZE_SCALE: {
    1: 1.0,
    2: 1.03,
    3: 1.06,
    4: 1.10,
    5: 1.15
  },

  /**
   * Glow intensity by tier
   */
  GLOW_INTENSITY: {
    1: 0,
    2: 0,
    3: 0.3,
    4: 0.5,
    5: 0.8
  },

  init() {
    // Sync with CONSTANTS if available
    if (typeof CONSTANTS !== 'undefined' && CONSTANTS.SHIP_SIZE) {
      this.SIZE = CONSTANTS.SHIP_SIZE;
    }

    const SIZE = this.SIZE;

    // Generate path strings
    this.PATHS[1] = `M ${SIZE} 0 L ${-SIZE * 0.7} ${-SIZE * 0.6} L ${-SIZE * 0.4} 0 L ${-SIZE * 0.7} ${SIZE * 0.6} Z`;

    this.PATHS[2] = `M ${SIZE} 0 L ${-SIZE * 0.5} ${-SIZE * 0.7} L ${-SIZE * 0.3} ${-SIZE * 0.3} L ${-SIZE * 0.5} 0 L ${-SIZE * 0.3} ${SIZE * 0.3} L ${-SIZE * 0.5} ${SIZE * 0.7} Z`;

    this.PATHS[3] = `M ${SIZE} 0 L ${SIZE * 0.3} ${-SIZE * 0.2} L ${-SIZE * 0.4} ${-SIZE * 0.8} L ${-SIZE * 0.6} ${-SIZE * 0.5} L ${-SIZE * 0.5} 0 L ${-SIZE * 0.6} ${SIZE * 0.5} L ${-SIZE * 0.4} ${SIZE * 0.8} L ${SIZE * 0.3} ${SIZE * 0.2} Z`;

    this.PATHS[4] = `M ${SIZE} 0 L ${SIZE * 0.4} ${-SIZE * 0.15} L ${SIZE * 0.1} ${-SIZE * 0.3} L ${-SIZE * 0.3} ${-SIZE * 0.85} L ${-SIZE * 0.55} ${-SIZE * 0.5} L ${-SIZE * 0.65} 0 L ${-SIZE * 0.55} ${SIZE * 0.5} L ${-SIZE * 0.3} ${SIZE * 0.85} L ${SIZE * 0.1} ${SIZE * 0.3} L ${SIZE * 0.4} ${SIZE * 0.15} Z`;

    this.PATHS[5] = `M ${SIZE * 1.1} 0 L ${SIZE * 0.5} ${-SIZE * 0.12} L ${SIZE * 0.3} ${-SIZE * 0.25} L ${SIZE * 0.1} ${-SIZE * 0.35} L ${-SIZE * 0.2} ${-SIZE * 0.9} L ${-SIZE * 0.5} ${-SIZE * 0.55} L ${-SIZE * 0.7} 0 L ${-SIZE * 0.5} ${SIZE * 0.55} L ${-SIZE * 0.2} ${SIZE * 0.9} L ${SIZE * 0.1} ${SIZE * 0.35} L ${SIZE * 0.3} ${SIZE * 0.25} L ${SIZE * 0.5} ${SIZE * 0.12} Z`;

    // Cockpit paths
    this.COCKPIT_PATHS[2] = `M ${SIZE * 0.5} 0 L ${SIZE * 0.1} ${-SIZE * 0.15} L ${SIZE * 0.1} ${SIZE * 0.15} Z`;

    this.COCKPIT_PATHS[3] = `M ${SIZE * 0.6} 0 L ${SIZE * 0.2} ${-SIZE * 0.12} L ${SIZE * 0.05} 0 L ${SIZE * 0.2} ${SIZE * 0.12} Z`;

    this.COCKPIT_PATHS[4] = `M ${SIZE * 0.65} 0 L ${SIZE * 0.25} ${-SIZE * 0.1} L ${SIZE * 0.1} ${-SIZE * 0.15} L ${SIZE * 0.1} ${SIZE * 0.15} L ${SIZE * 0.25} ${SIZE * 0.1} Z`;

    this.COCKPIT_PATHS[5] = `M ${SIZE * 0.7} 0 L ${SIZE * 0.35} ${-SIZE * 0.08} L ${SIZE * 0.15} ${-SIZE * 0.12} L ${SIZE * 0.05} 0 L ${SIZE * 0.15} ${SIZE * 0.12} L ${SIZE * 0.35} ${SIZE * 0.08} Z`;

    // Create Path2D objects
    for (const tier of [1, 2, 3, 4, 5]) {
      if (this.PATHS[tier]) {
        this.cachedPaths[tier] = new Path2D(this.PATHS[tier]);
      }
    }

    for (const tier of [2, 3, 4, 5]) {
      if (this.COCKPIT_PATHS[tier]) {
        this.cachedCockpits[tier] = new Path2D(this.COCKPIT_PATHS[tier]);
      }
    }

    console.log('ShipGeometry initialized with Path2D caching');
  },

  /**
   * Get visual tier from ship upgrade tiers (average)
   */
  getVisualTier(ship) {
    if (!ship) return 1;

    const tiers = [
      ship.engineTier || 1,
      ship.weaponTier || 1,
      ship.shieldTier || 1,
      ship.miningTier || 1,
      ship.cargoTier || 1,
      ship.radarTier || 1
    ];

    const average = tiers.reduce((sum, t) => sum + t, 0) / tiers.length;
    return Math.max(1, Math.min(5, Math.round(average)));
  },

  /**
   * Get exhaust position for thrust effects
   */
  getExhaustPosition(tier) {
    const scale = this.SIZE_SCALE[tier] || 1;
    return {
      x: -this.SIZE * 0.5 * scale,
      y: 0
    };
  },

  /**
   * Get nose position for weapon effects
   */
  getNosePosition(tier) {
    const scale = this.SIZE_SCALE[tier] || 1;
    const noseExtend = tier === 5 ? 1.1 : 1;
    return {
      x: this.SIZE * noseExtend * scale,
      y: 0
    };
  }
};
