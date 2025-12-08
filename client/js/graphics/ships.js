/**
 * Ship Geometry Definitions
 * SVG path data for 5 tier ship designs with progressive complexity
 * All paths are designed with the ship pointing RIGHT (0 radians)
 * Supports player-chosen colors with gradient rendering
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
   * Cached gradient objects for player colors
   * Key format: `${colorId}_${tier}`
   */
  cachedGradients: {},

  /**
   * Default color schemes by ship type and tier (fallback if no custom color)
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

    Logger.log('ShipGeometry initialized with Path2D caching');
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
  },

  /**
   * Get player color palette from color ID
   * Uses PLAYER_COLOR_OPTIONS from constants if available
   * @param {string} colorId - Color ID (e.g., 'green', 'cyan', 'red')
   * @returns {object} Color palette with primary, accent, glow
   */
  getPlayerColorPalette(colorId) {
    // Try to get from CONSTANTS.PLAYER_COLOR_OPTIONS
    if (typeof CONSTANTS !== 'undefined' && CONSTANTS.PLAYER_COLOR_OPTIONS) {
      const colorOption = CONSTANTS.PLAYER_COLOR_OPTIONS.find(c => c.id === colorId);
      if (colorOption) {
        return {
          primary: colorOption.primary,
          accent: colorOption.accent,
          glow: colorOption.glow,
          secondary: this.darkenColor(colorOption.primary, 0.7),
          highlight: this.lightenColor(colorOption.primary, 1.3)
        };
      }
    }

    // Fallback to default green
    return {
      primary: '#00ff00',
      accent: '#00cc00',
      glow: '#00ff0040',
      secondary: '#00aa00',
      highlight: '#44ff44'
    };
  },

  /**
   * Get ship colors for rendering - supports custom player colors
   * @param {string} type - 'player', 'other', or 'npc'
   * @param {number} tier - Ship visual tier (1-5)
   * @param {string} colorId - Optional custom color ID for players
   * @returns {object} Color scheme with hull, accent, glow, gradient colors
   */
  getShipColors(type, tier, colorId = null) {
    // For players with custom color
    if ((type === 'player' || type === 'other') && colorId) {
      const palette = this.getPlayerColorPalette(colorId);
      const tierBrightness = 1 + (tier - 1) * 0.08; // Slight brightness increase per tier

      return {
        hull: palette.primary,
        accent: palette.accent,
        glow: palette.glow,
        secondary: palette.secondary,
        highlight: palette.highlight,
        // Gradient colors for multicolor effect
        gradientStart: this.adjustBrightness(palette.secondary, tierBrightness * 0.9),
        gradientMid: this.adjustBrightness(palette.primary, tierBrightness),
        gradientEnd: this.adjustBrightness(palette.highlight, tierBrightness * 1.1)
      };
    }

    // Fallback to tier-based default colors
    const tierColors = this.COLORS[type]?.[tier] || this.COLORS.player[1];
    return {
      hull: tierColors.hull,
      accent: tierColors.accent,
      glow: tierColors.glow,
      secondary: tierColors.accent,
      highlight: this.lightenColor(tierColors.hull, 1.2),
      gradientStart: tierColors.accent,
      gradientMid: tierColors.hull,
      gradientEnd: this.lightenColor(tierColors.hull, 1.15)
    };
  },

  /**
   * Create a linear gradient for ship hull fill
   * Gradient runs from rear (secondary) to nose (highlight)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} tier - Ship tier for sizing
   * @param {object} colors - Color scheme from getShipColors
   * @returns {CanvasGradient} Linear gradient for filling
   */
  createHullGradient(ctx, tier, colors) {
    const scale = this.SIZE_SCALE[tier] || 1;
    const size = this.SIZE * scale;

    // Gradient from rear to nose
    const gradient = ctx.createLinearGradient(-size * 0.7, 0, size, 0);
    gradient.addColorStop(0, colors.gradientStart);
    gradient.addColorStop(0.4, colors.gradientMid);
    gradient.addColorStop(1, colors.gradientEnd);

    return gradient;
  },

  /**
   * Create a radial glow gradient for tier 3+ ships
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} tier - Ship tier
   * @param {object} colors - Color scheme
   * @returns {CanvasGradient} Radial gradient for glow effect
   */
  createGlowGradient(ctx, tier, colors) {
    const scale = this.SIZE_SCALE[tier] || 1;
    const glowIntensity = this.GLOW_INTENSITY[tier] || 0;
    const size = this.SIZE * scale;
    const glowRadius = size * (1.5 + glowIntensity);

    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, glowRadius);
    gradient.addColorStop(0, colors.glow);
    gradient.addColorStop(1, 'transparent');

    return gradient;
  },

  /**
   * Darken a hex color by a factor
   * @param {string} hex - Hex color string
   * @param {number} factor - Factor to darken (0.5 = 50% darker)
   */
  darkenColor(hex, factor) {
    return this.adjustBrightness(hex, factor);
  },

  /**
   * Lighten a hex color by a factor
   * @param {string} hex - Hex color string
   * @param {number} factor - Factor to lighten (1.5 = 50% brighter)
   */
  lightenColor(hex, factor) {
    return this.adjustBrightness(hex, factor);
  },

  /**
   * Adjust brightness of a hex color
   * @param {string} hex - Hex color string (with #)
   * @param {number} factor - Brightness factor (<1 = darker, >1 = brighter)
   * @returns {string} Adjusted hex color
   */
  adjustBrightness(hex, factor) {
    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Parse RGB
    let r = parseInt(cleanHex.substring(0, 2), 16);
    let g = parseInt(cleanHex.substring(2, 4), 16);
    let b = parseInt(cleanHex.substring(4, 6), 16);

    // Adjust brightness
    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));

    // Convert back to hex
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Draw a ship with gradient fill
   * @param {CanvasRenderingContext2D} ctx - Canvas context (already translated/rotated)
   * @param {number} tier - Ship visual tier
   * @param {object} colors - Colors from getShipColors
   * @param {boolean} isPlayer - Whether this is the local player
   */
  drawWithGradient(ctx, tier, colors, isPlayer = false) {
    const path = this.cachedPaths[tier];
    if (!path) return;

    const scale = this.SIZE_SCALE[tier] || 1;
    const glowIntensity = this.GLOW_INTENSITY[tier] || 0;

    ctx.save();
    ctx.scale(scale, scale);

    // Draw outer glow for tier 3+
    if (glowIntensity > 0) {
      const glowGradient = this.createGlowGradient(ctx, tier, colors);
      ctx.fillStyle = glowGradient;
      ctx.globalAlpha = glowIntensity;
      ctx.beginPath();
      ctx.arc(0, 0, this.SIZE * (1.5 + glowIntensity), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw hull with gradient
    const hullGradient = this.createHullGradient(ctx, tier, colors);
    ctx.fillStyle = hullGradient;
    ctx.fill(path);

    // Draw hull outline
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = isPlayer ? 1.5 : 1;
    ctx.stroke(path);

    // Draw cockpit accent for tier 2+
    const cockpit = this.cachedCockpits[tier];
    if (cockpit) {
      ctx.fillStyle = colors.highlight;
      ctx.fill(cockpit);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 0.5;
      ctx.stroke(cockpit);
    }

    // Player marker - subtle inner glow for local player
    if (isPlayer) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
};
