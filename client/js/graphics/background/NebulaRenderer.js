/**
 * Nebula Renderer - Soft cloud formations that respond to activity level
 * Creates dreamy atmospheric wisps with zone-aware colors
 *
 * Quality scaling:
 * - Below quality 30: Nebula disabled entirely
 * - LOD 2 (medium): 6 clouds, 60% opacity
 * - LOD 3 (high): 12 clouds, 100% opacity
 * - LOD 4 (ultra): 18 clouds, 120% opacity with enhanced effects
 */

const NebulaRenderer = {
  // Nebula cloud data
  clouds: [],

  // Base configuration
  baseConfig: {
    baseCloudCount: 12,     // Will be scaled by quality
    tileSize: 3000,         // World units per tile
    parallax: 0.01,         // Very slow parallax (almost stationary)
    baseSizeMin: 200,
    baseSizeMax: 500,
    driftSpeed: 0.0001      // Extremely slow drift
  },

  // Current quality config
  _nebulaConfig: null,
  _unsubscribeSettings: null,

  // Animation state
  time: 0,
  currentActivity: 0.15,

  // Seeded random
  seed: 54321,

  init() {
    this._updateQualityConfig();
    this.generateClouds();
    this.time = 0;
    this.currentActivity = 0.15;

    // Subscribe to quality changes
    if (typeof GraphicsSettings !== 'undefined') {
      this._unsubscribeSettings = GraphicsSettings.addListener(() => {
        this._onQualityChange();
      });
    }

    Logger.log('NebulaRenderer initialized with ' + this.clouds.length + ' clouds' +
      (this._nebulaConfig.enabled ? '' : ' (disabled at current quality)'));
  },

  /**
   * Update quality configuration from GraphicsSettings
   * @private
   */
  _updateQualityConfig() {
    if (typeof GraphicsSettings !== 'undefined') {
      this._nebulaConfig = GraphicsSettings.getNebulaConfig();
    } else {
      // Default fallback (high quality)
      this._nebulaConfig = {
        enabled: true,
        cloudCount: 12,
        opacityMultiplier: 1.0
      };
    }
  },

  /**
   * Handle quality setting changes
   * @private
   */
  _onQualityChange() {
    const wasEnabled = this._nebulaConfig.enabled;
    const oldCount = this._nebulaConfig.cloudCount;

    this._updateQualityConfig();

    // Regenerate if enabled state or cloud count changed
    if (wasEnabled !== this._nebulaConfig.enabled ||
        oldCount !== this._nebulaConfig.cloudCount) {
      this.generateClouds();
      Logger.log(`NebulaRenderer updated: enabled=${this._nebulaConfig.enabled}, clouds=${this._nebulaConfig.cloudCount}`);
    }
  },

  /**
   * Generate cloud positions and properties using seeded random
   */
  generateClouds() {
    this.clouds = [];

    // Don't generate clouds if disabled
    if (!this._nebulaConfig.enabled) {
      return;
    }

    let seed = this.seed;

    const seededRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const cloudCount = this._nebulaConfig.cloudCount;

    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        // Position within tile
        tileX: seededRandom() * this.baseConfig.tileSize,
        tileY: seededRandom() * this.baseConfig.tileSize,
        // Size and shape
        baseSize: this.baseConfig.baseSizeMin +
          seededRandom() * (this.baseConfig.baseSizeMax - this.baseConfig.baseSizeMin),
        stretchX: 0.6 + seededRandom() * 0.8,  // 0.6-1.4 horizontal stretch
        stretchY: 0.6 + seededRandom() * 0.8,  // 0.6-1.4 vertical stretch
        rotation: seededRandom() * Math.PI * 2,
        // Color variation
        colorOffset: seededRandom() * 30 - 15,  // -15 to +15 hue shift
        usePrimary: seededRandom() > 0.5,       // Primary or secondary color
        // Animation
        driftPhase: seededRandom() * Math.PI * 2,
        pulsePhase: seededRandom() * Math.PI * 2,
        pulsePeriod: 60 + seededRandom() * 60   // 60-120 seconds
      });
    }
  },

  /**
   * Update nebula animation state
   * @param {number} dt - Delta time in seconds
   * @param {number} activityLevel - From PaletteManager
   */
  update(dt, activityLevel) {
    this.time += dt;

    // Smoothly transition activity level
    const diff = activityLevel - this.currentActivity;
    this.currentActivity += diff * 0.01;
  },

  /**
   * Draw nebula clouds
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @param {Object} palette - From PaletteManager
   */
  draw(ctx, camera, viewportWidth, viewportHeight, palette) {
    // Fill background first
    ctx.fillStyle = palette ? palette.primary : '#000011';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Skip cloud rendering if disabled
    if (!this._nebulaConfig.enabled || this.clouds.length === 0) {
      return;
    }

    // Calculate opacity based on activity level and quality multiplier
    const baseOpacity = this.getOpacityForActivity(this.currentActivity);
    const qualityMultiplier = this._nebulaConfig.opacityMultiplier;

    // Add subtle pulse based on activity
    const pulseAmount = this.currentActivity * 0.05;
    const pulse = 1 + Math.sin(this.time * 0.5) * pulseAmount;
    const opacity = baseOpacity * pulse * qualityMultiplier;

    if (opacity < 0.01) return; // Skip if invisible

    const tileSize = this.baseConfig.tileSize;
    const parallaxX = camera.x * this.baseConfig.parallax;
    const parallaxY = camera.y * this.baseConfig.parallax;

    // Determine visible tiles
    const startTileX = Math.floor((parallaxX - viewportWidth) / tileSize) - 1;
    const endTileX = Math.ceil((parallaxX + viewportWidth * 2) / tileSize) + 1;
    const startTileY = Math.floor((parallaxY - viewportHeight) / tileSize) - 1;
    const endTileY = Math.ceil((parallaxY + viewportHeight * 2) / tileSize) + 1;

    // Draw clouds
    ctx.save();
    ctx.globalAlpha = opacity;

    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        for (const cloud of this.clouds) {
          // Calculate screen position with drift
          const driftT = this.time * this.baseConfig.driftSpeed;
          const driftX = Math.sin(driftT + cloud.driftPhase) * 50;
          const driftY = Math.cos(driftT * 0.7 + cloud.driftPhase) * 30;

          const screenX = cloud.tileX + tileX * tileSize - parallaxX + driftX;
          const screenY = cloud.tileY + tileY * tileSize - parallaxY + driftY;

          // Skip if too far off screen
          const margin = cloud.baseSize * 2;
          if (screenX < -margin || screenX > viewportWidth + margin ||
              screenY < -margin || screenY > viewportHeight + margin) {
            continue;
          }

          this.drawCloud(ctx, screenX, screenY, cloud, palette);
        }
      }
    }

    ctx.restore();
  },

  /**
   * Draw a single nebula cloud
   */
  drawCloud(ctx, x, y, cloud, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cloud.rotation + this.time * 0.001); // Very slow rotation
    ctx.scale(cloud.stretchX, cloud.stretchY);

    // Get color from palette with cloud's offset
    let hsl;
    const baseHSL = palette && (cloud.usePrimary ? palette.primaryHSL : palette.secondaryHSL);
    if (baseHSL) {
      hsl = {
        h: (baseHSL.h + cloud.colorOffset + 360) % 360,
        s: baseHSL.s + 10,  // Slightly more saturated for nebula
        l: baseHSL.l + 5    // Slightly lighter
      };
    } else {
      hsl = { h: 220, s: 30, l: 15 };
    }

    // Pulse size based on cloud's phase
    const pulseT = this.time / cloud.pulsePeriod;
    const sizePulse = 1 + Math.sin(pulseT * Math.PI * 2 + cloud.pulsePhase) * 0.1;
    const size = cloud.baseSize * sizePulse;

    // Get LOD for rendering optimization
    const lod = typeof GraphicsSettings !== 'undefined' ? GraphicsSettings.getLOD() : 3;

    if (lod >= 3) {
      // High/Ultra: Full 3-layer cloud
      // Outer layer
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      // Middle layer
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l + 5}%)`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s * 0.8}%, ${hsl.l + 10}%)`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Medium: Simplified 2-layer cloud
      // Outer layer
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s * 0.8}%, ${hsl.l + 8}%)`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  /**
   * Calculate opacity based on activity level
   */
  getOpacityForActivity(activity) {
    if (activity < 0.2) {
      // 0.0-0.2 -> 2-5%
      return 0.02 + (activity / 0.2) * 0.03;
    } else if (activity < 0.5) {
      // 0.2-0.5 -> 5-12%
      return 0.05 + ((activity - 0.2) / 0.3) * 0.07;
    } else if (activity < 0.8) {
      // 0.5-0.8 -> 12-20%
      return 0.12 + ((activity - 0.5) / 0.3) * 0.08;
    } else {
      // 0.8-1.0 -> 20-30%
      return 0.20 + ((activity - 0.8) / 0.2) * 0.10;
    }
  },

  /**
   * Cleanup - remove settings listener
   */
  destroy() {
    if (this._unsubscribeSettings) {
      this._unsubscribeSettings();
      this._unsubscribeSettings = null;
    }
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.NebulaRenderer = NebulaRenderer;
}
