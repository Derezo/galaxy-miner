/**
 * Palette Manager - Handles ultra-slow, imperceptible color transitions
 * Blends zone colors into a cohesive palette over 45-90 seconds
 */

const PaletteManager = {
  // Current rendered palette
  currentPalette: {
    primary: { h: 220, s: 30, l: 8 },    // Deep navy
    secondary: { h: 230, s: 25, l: 12 }, // Dark blue-purple
    accent: { h: 220, s: 10, l: 75 }     // Silver-white
  },

  // Saved palette when transition starts
  startPalette: {
    primary: { h: 220, s: 30, l: 8 },
    secondary: { h: 230, s: 25, l: 12 },
    accent: { h: 220, s: 10, l: 75 }
  },

  // Target palette (what we're transitioning to)
  targetPalette: {
    primary: { h: 220, s: 30, l: 8 },
    secondary: { h: 230, s: 25, l: 12 },
    accent: { h: 220, s: 10, l: 75 }
  },

  // Activity level (0-1)
  currentActivity: 0.15,
  targetActivity: 0.15,

  // Transition state
  transition: {
    active: false,
    delay: 0,           // Countdown before blend starts
    progress: 0,        // 0-1 blend progress
    duration: 60000     // ms for full transition
  },

  // Configuration
  config: {
    delayMin: 5000,          // 5 seconds minimum delay
    delayMax: 10000,         // 10 seconds maximum delay
    durationMin: 45000,      // 45 seconds minimum blend
    durationMax: 90000,      // 90 seconds maximum blend
    changeThreshold: 0.15,   // 15% difference to trigger transition
    activitySmoothingUp: 0.02,    // Activity responds faster to increases
    activitySmoothingDown: 0.008  // Activity lingers after leaving
  },

  init() {
    // Start with default dark palette
    this.currentPalette = {
      primary: { h: 220, s: 30, l: 8 },
      secondary: { h: 230, s: 25, l: 12 },
      accent: { h: 220, s: 10, l: 75 }
    };
    this.startPalette = { ...this.currentPalette };
    this.targetPalette = { ...this.currentPalette };
    this.currentActivity = 0.15;
    this.targetActivity = 0.15;
    this.transition.active = false;
    Logger.log('PaletteManager initialized');
  },

  /**
   * Update palette transitions
   * @param {number} dt - Delta time in seconds
   * @param {Object} zoneData - From ZoneSampler.getZoneData()
   */
  update(dt, zoneData) {
    if (!zoneData) return;

    // Calculate new target palette from zone colors
    const newTarget = this.calculateTargetPalette(zoneData.colors);
    this.targetActivity = zoneData.activityLevel;

    // Check if palette changed significantly
    if (!this.transition.active) {
      const diff = this.getPaletteDifference(this.currentPalette, newTarget);
      if (diff > this.config.changeThreshold) {
        // Save current palette as start point
        this.startPalette = {
          primary: { ...this.currentPalette.primary },
          secondary: { ...this.currentPalette.secondary },
          accent: { ...this.currentPalette.accent }
        };
        // Start transition with delay
        this.targetPalette = newTarget;
        this.transition.active = true;
        this.transition.delay = this.config.delayMin +
          Math.random() * (this.config.delayMax - this.config.delayMin);
        this.transition.progress = 0;
        this.transition.duration = this.config.durationMin +
          Math.random() * (this.config.durationMax - this.config.durationMin);
      }
    }

    // Update transition
    if (this.transition.active) {
      if (this.transition.delay > 0) {
        // Still in delay phase
        this.transition.delay -= dt * 1000;
      } else {
        // Blending phase
        this.transition.progress += (dt * 1000) / this.transition.duration;

        if (this.transition.progress >= 1) {
          // Transition complete
          this.currentPalette = { ...this.targetPalette };
          this.transition.active = false;
          this.transition.progress = 0;
        } else {
          // Interpolate with easing (slow at start and end)
          const eased = this.easeInOutCubic(this.transition.progress);
          this.currentPalette = this.interpolatePalette(
            this.startPalette,
            this.targetPalette,
            eased
          );
        }
      }
    }

    // Smooth activity level (faster up, slower down)
    const activityDiff = this.targetActivity - this.currentActivity;
    const smoothing = activityDiff > 0
      ? this.config.activitySmoothingUp
      : this.config.activitySmoothingDown;
    this.currentActivity += activityDiff * smoothing;
  },

  /**
   * Calculate target palette from weighted zone colors
   */
  calculateTargetPalette(colors) {
    if (!colors || colors.length === 0) {
      // Return default dark palette
      return {
        primary: { h: 220, s: 30, l: 8 },
        secondary: { h: 230, s: 25, l: 12 },
        accent: { h: 220, s: 10, l: 75 }
      };
    }

    // Weighted average of colors
    let totalWeight = 0;
    let hSum = 0, sSum = 0, lSum = 0;

    for (const color of colors) {
      totalWeight += color.weight;
      hSum += color.h * color.weight;
      sSum += color.s * color.weight;
      lSum += color.l * color.weight;
    }

    if (totalWeight === 0) {
      return {
        primary: { ...this.currentPalette.primary },
        secondary: { ...this.currentPalette.secondary },
        accent: { ...this.currentPalette.accent }
      };
    }

    const avgH = hSum / totalWeight;
    const avgS = sSum / totalWeight;
    const avgL = lSum / totalWeight;

    // Create palette based on average, but keep it dark for background
    return {
      primary: {
        h: avgH,
        s: Math.min(avgS * 0.4, 40),  // Desaturate for background
        l: Math.min(avgL * 0.15, 12)  // Keep very dark
      },
      secondary: {
        h: (avgH + 20) % 360,  // Slight hue shift
        s: Math.min(avgS * 0.3, 35),
        l: Math.min(avgL * 0.2, 15)
      },
      accent: {
        h: avgH,
        s: Math.min(avgS * 0.3, 30),  // Muted accent
        l: Math.min(avgL * 0.8 + 30, 80)  // Lighter for stars
      }
    };
  },

  /**
   * Get difference between two palettes (0-1 scale)
   */
  getPaletteDifference(a, b) {
    const hDiff = Math.abs(a.primary.h - b.primary.h) / 180;
    const sDiff = Math.abs(a.primary.s - b.primary.s) / 100;
    const lDiff = Math.abs(a.primary.l - b.primary.l) / 50;
    return (hDiff + sDiff + lDiff) / 3;
  },

  /**
   * Interpolate between two palettes
   */
  interpolatePalette(from, to, t) {
    return {
      primary: this.interpolateHSL(from.primary, to.primary, t),
      secondary: this.interpolateHSL(from.secondary, to.secondary, t),
      accent: this.interpolateHSL(from.accent, to.accent, t)
    };
  },

  /**
   * InterpolateHSL values
   */
  interpolateHSL(from, to, t) {
    // Handle hue wrapping
    let hDiff = to.h - from.h;
    if (hDiff > 180) hDiff -= 360;
    if (hDiff < -180) hDiff += 360;

    return {
      h: (from.h + hDiff * t + 360) % 360,
      s: from.s + (to.s - from.s) * t,
      l: from.l + (to.l - from.l) * t
    };
  },

  /**
   * Easing function - slow at start and end
   */
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },

  /**
   * Get current palette as CSS-ready HSL strings
   */
  getCurrentPalette() {
    return {
      primary: this.hslToString(this.currentPalette.primary),
      secondary: this.hslToString(this.currentPalette.secondary),
      accent: this.hslToString(this.currentPalette.accent),
      // Also provide raw HSL for gradient manipulation
      primaryHSL: { ...this.currentPalette.primary },
      secondaryHSL: { ...this.currentPalette.secondary },
      accentHSL: { ...this.currentPalette.accent }
    };
  },

  /**
   * Get current activity level
   */
  getActivityLevel() {
    return this.currentActivity;
  },

  /**
   * Convert HSL object to CSS string
   */
  hslToString(hsl) {
    return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
  }
};
