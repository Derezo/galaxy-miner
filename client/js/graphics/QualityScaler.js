/**
 * Quality Scaler - Centralized utility for graphics quality scaling
 * Provides exponential scaling functions and feature thresholds
 * Used by all rendering systems to scale visual effects based on quality level (0-100)
 */

const QualityScaler = {
  // Default exponential power for scaling curves
  DEFAULT_POWER: 1.5,

  // Feature enable thresholds (quality level required to enable)
  THRESHOLDS: {
    thrustParticles: 10,
    starGlow: 10,
    weaponTrails: 15,
    asteroidRotation: 15,
    coronaFlares: 20,
    screenShake: 20,
    voidEffects: 20,
    graveyardAtmosphere: 25,
    planetAtmosphere: 25,
    heatOverlay: 30,
    nebulaClouds: 30,
    floatingText: 30,
    shieldRipples: 35
  },

  // LOD level boundaries
  LOD_BOUNDARIES: {
    minimal: 10,  // 0-9: LOD 0
    low: 30,      // 10-29: LOD 1
    medium: 60,   // 30-59: LOD 2
    high: 90,     // 60-89: LOD 3
    ultra: 100    // 90-100: LOD 4
  },

  /**
   * Exponential scaling function
   * Maps quality (0-100) to output range with smooth curve
   * Lower quality values change less aggressively due to exponential curve
   *
   * @param {number} quality - Quality level 0-100
   * @param {number} min - Minimum output value (at quality 0)
   * @param {number} max - Maximum output value (at quality 100)
   * @param {number} [power=1.5] - Exponential power (higher = more aggressive curve)
   * @returns {number} Scaled value between min and max
   */
  scale(quality, min, max, power = this.DEFAULT_POWER) {
    // Clamp quality to 0-100
    const q = Math.max(0, Math.min(100, quality));
    const normalized = q / 100;
    const curved = Math.pow(normalized, power);
    return min + curved * (max - min);
  },

  /**
   * Inverse scaling - values DECREASE with quality
   * Useful for things like update intervals that should be longer at low quality
   *
   * @param {number} quality - Quality level 0-100
   * @param {number} min - Minimum output value (at quality 100)
   * @param {number} max - Maximum output value (at quality 0)
   * @param {number} [power=1.5] - Exponential power
   * @returns {number} Scaled value between min and max
   */
  scaleInverse(quality, min, max, power = this.DEFAULT_POWER) {
    return max - this.scale(quality, 0, max - min, power);
  },

  /**
   * Get LOD level (0-4) based on quality
   * Used for discrete detail levels in rendering
   *
   * @param {number} quality - Quality level 0-100
   * @returns {number} LOD level 0-4
   */
  scaleLOD(quality) {
    if (quality < this.LOD_BOUNDARIES.minimal) return 0;  // minimal
    if (quality < this.LOD_BOUNDARIES.low) return 1;      // low
    if (quality < this.LOD_BOUNDARIES.medium) return 2;   // medium
    if (quality < this.LOD_BOUNDARIES.high) return 3;     // high
    return 4;                                              // ultra
  },

  /**
   * Get LOD level name
   * @param {number} quality - Quality level 0-100
   * @returns {string} LOD level name
   */
  getLODName(quality) {
    const lod = this.scaleLOD(quality);
    return ['minimal', 'low', 'medium', 'high', 'ultra'][lod];
  },

  /**
   * Scale particle count with minimum floor
   * Ensures at least 1 particle for visibility at low quality
   * At quality 0, returns ~10% of base
   * At quality 100, returns 200% of base (ultra mode)
   *
   * @param {number} quality - Quality level 0-100
   * @param {number} baseCount - Base particle count (at quality 80)
   * @param {number} [floor=1] - Minimum particle count
   * @returns {number} Scaled particle count (integer)
   */
  scaleParticles(quality, baseCount, floor = 1) {
    // At quality 80, should return baseCount
    // At quality 0, should return ~10% of baseCount
    // At quality 100, should return ~200% of baseCount
    const minCount = baseCount * 0.1;
    const maxCount = baseCount * 2.0;
    const scaled = Math.round(this.scale(quality, minCount, maxCount));
    return Math.max(floor, scaled);
  },

  /**
   * Get particle multiplier (0.0 - 2.0)
   * Maps quality to a multiplier for particle counts
   *
   * @param {number} quality - Quality level 0-100
   * @returns {number} Multiplier 0.0-2.0
   */
  getParticleMultiplier(quality) {
    // quality 0 -> 0.0, quality 80 -> 1.0, quality 100 -> 2.0
    if (quality <= 0) return 0;
    if (quality >= 100) return 2.0;

    // Use piecewise linear for predictable behavior
    if (quality <= 80) {
      // 0-80 maps to 0-1.0 with exponential curve
      return this.scale(quality, 0, 1.0) * (80 / quality) * (quality / 80);
    } else {
      // 80-100 maps to 1.0-2.0 linearly
      return 1.0 + ((quality - 80) / 20) * 1.0;
    }
  },

  /**
   * Scale pool size for particle system
   *
   * @param {number} quality - Quality level 0-100
   * @returns {number} Pool size (integer)
   */
  scalePoolSize(quality) {
    // quality 0 -> 75, quality 80 -> 500, quality 100 -> 1000
    return Math.round(this.scale(quality, 75, 1000));
  },

  /**
   * Check if a feature should be enabled at given quality
   *
   * @param {number} quality - Quality level 0-100
   * @param {string|number} featureOrThreshold - Feature name or threshold value
   * @returns {boolean} Whether feature is enabled
   */
  isEnabled(quality, featureOrThreshold) {
    const threshold = typeof featureOrThreshold === 'string'
      ? this.THRESHOLDS[featureOrThreshold] || 0
      : featureOrThreshold;
    return quality >= threshold;
  },

  /**
   * Get screen shake multiplier
   *
   * @param {number} quality - Quality level 0-100
   * @returns {number} Multiplier 0-1
   */
  getScreenShakeMultiplier(quality) {
    if (!this.isEnabled(quality, 'screenShake')) return 0;
    return this.scale(quality, 0.3, 1.0);
  },

  /**
   * Scale star count for starfield layers
   *
   * @param {number} quality - Quality level 0-100
   * @returns {Object} Star counts per layer
   */
  getStarfieldConfig(quality) {
    const lod = this.scaleLOD(quality);

    const configs = {
      0: { // minimal
        layers: 1,
        counts: [40],
        glow: false,
        twinkle: false,
        drift: false
      },
      1: { // low
        layers: 2,
        counts: [60, 40],
        glow: true,
        twinkle: false,
        drift: false
      },
      2: { // medium
        layers: 3,
        counts: [100, 60, 40],
        glow: true,
        twinkle: true,
        drift: false
      },
      3: { // high (current default)
        layers: 3,
        counts: [150, 80, 40],
        glow: true,
        twinkle: true,
        drift: true
      },
      4: { // ultra
        layers: 4,
        counts: [200, 100, 60, 40],
        glow: true,
        twinkle: true,
        drift: true,
        extraEffects: true
      }
    };

    return configs[lod];
  },

  /**
   * Get nebula configuration
   *
   * @param {number} quality - Quality level 0-100
   * @returns {Object} Nebula configuration
   */
  getNebulaConfig(quality) {
    if (!this.isEnabled(quality, 'nebulaClouds')) {
      return { enabled: false, cloudCount: 0, opacityMultiplier: 0 };
    }

    const lod = this.scaleLOD(quality);

    const configs = {
      2: { enabled: true, cloudCount: 6, opacityMultiplier: 0.6 },
      3: { enabled: true, cloudCount: 12, opacityMultiplier: 1.0 },
      4: { enabled: true, cloudCount: 18, opacityMultiplier: 1.2 }
    };

    return configs[lod] || configs[2];
  },

  /**
   * Get gradient stop count for glow effects
   * Lower quality = fewer gradient stops = better performance
   *
   * @param {number} quality - Quality level 0-100
   * @returns {number} Number of gradient stops (2-5)
   */
  getGradientStops(quality) {
    const lod = this.scaleLOD(quality);
    return [2, 2, 3, 4, 5][lod];
  },

  /**
   * Scale animation speed/frequency
   * Lower quality = slower animations = less CPU
   *
   * @param {number} quality - Quality level 0-100
   * @param {number} baseSpeed - Base animation speed
   * @returns {number} Scaled animation speed
   */
  scaleAnimationSpeed(quality, baseSpeed) {
    return this.scale(quality, baseSpeed * 0.25, baseSpeed);
  },

  /**
   * Get thrust trail configuration
   *
   * @param {number} quality - Quality level 0-100
   * @returns {Object} Thrust trail config
   */
  getThrustConfig(quality) {
    if (!this.isEnabled(quality, 'thrustParticles')) {
      return { enabled: false, multiplier: 0, trailLength: 0 };
    }

    return {
      enabled: true,
      multiplier: this.getParticleMultiplier(quality),
      trailLength: this.scale(quality, 0.2, 1.5)
    };
  },

  /**
   * Get death effect configuration
   *
   * @param {number} quality - Quality level 0-100
   * @returns {Object} Death effect config
   */
  getDeathEffectConfig(quality) {
    const lod = this.scaleLOD(quality);

    return {
      particleMultiplier: this.getParticleMultiplier(quality),
      debrisMultiplier: this.scale(quality, 0.2, 2.0),
      shockwave: lod >= 2,
      secondaryExplosions: lod >= 4,
      screenShake: this.isEnabled(quality, 'screenShake')
    };
  },

  /**
   * Debug: Log scaling values at all preset levels
   */
  debugPresets() {
    const presets = [0, 10, 40, 80, 100];
    console.group('[QualityScaler] Preset Values');
    for (const q of presets) {
      console.log(`Quality ${q}:`, {
        lod: this.scaleLOD(q),
        lodName: this.getLODName(q),
        particleMultiplier: this.getParticleMultiplier(q).toFixed(2),
        poolSize: this.scalePoolSize(q),
        starfield: this.getStarfieldConfig(q),
        nebula: this.getNebulaConfig(q)
      });
    }
    console.groupEnd();
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.QualityScaler = QualityScaler;
}
