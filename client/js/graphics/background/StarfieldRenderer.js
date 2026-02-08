/**
 * Starfield Renderer - Multi-layer parallax stars with quality scaling
 * Features twinkle effects, gentle drift animation, and LOD-based rendering
 *
 * Quality scaling:
 * - LOD 0 (minimal): 1 layer, 40 stars, no glow, no animations
 * - LOD 1 (low): 2 layers, 100 stars, basic glow, no animations
 * - LOD 2 (medium): 3 layers, 200 stars, full glow, twinkle only
 * - LOD 3 (high): 3 layers, 270 stars, full effects
 * - LOD 4 (ultra): 4 layers, 400 stars, enhanced effects
 */

const StarfieldRenderer = {
  // Base layer configurations (will be adjusted by quality)
  baseLayers: [
    { name: 'deep', baseCount: 150, sizeMin: 1, sizeMax: 2, parallax: 0.02, drift: false, twinkleChance: 0.02 },
    { name: 'mid', baseCount: 80, sizeMin: 2, sizeMax: 4, parallax: 0.05, drift: true, twinkleChance: 0.08 },
    { name: 'near', baseCount: 40, sizeMin: 3, sizeMax: 6, parallax: 0.10, drift: true, twinkleChance: 0.15 },
    { name: 'ultra', baseCount: 40, sizeMin: 4, sizeMax: 8, parallax: 0.15, drift: true, twinkleChance: 0.20 }
  ],

  // Current active layers (set by quality)
  layers: [],

  // Generated star data per layer
  stars: [],

  // Animation state
  time: 0,

  // Seeded random for consistent star positions
  seed: 12345,

  // Tile size for seamless world-space grid
  tileSize: 2000,

  // Current quality configuration
  _qualityConfig: null,
  _unsubscribeSettings: null,

  init() {
    this._updateQualityConfig();
    this.generateStars();
    this.time = 0;

    // Subscribe to quality changes
    if (typeof GraphicsSettings !== 'undefined') {
      this._unsubscribeSettings = GraphicsSettings.addListener(() => {
        this._onQualityChange();
      });
    }

    Logger.log('StarfieldRenderer initialized with ' +
      this.stars.reduce((sum, layer) => sum + layer.length, 0) + ' stars (' +
      this.layers.length + ' layers)');
  },

  /**
   * Update quality configuration from GraphicsSettings
   * @private
   */
  _updateQualityConfig() {
    if (typeof GraphicsSettings !== 'undefined') {
      this._qualityConfig = GraphicsSettings.getStarfieldConfig();
    } else {
      // Default fallback (high quality)
      this._qualityConfig = {
        layers: 3,
        counts: [150, 80, 40],
        glow: true,
        twinkle: true,
        drift: true
      };
    }

    // Build active layers based on config
    this.layers = [];
    for (let i = 0; i < this._qualityConfig.layers; i++) {
      if (i < this.baseLayers.length) {
        this.layers.push({
          ...this.baseLayers[i],
          count: this._qualityConfig.counts[i] || this.baseLayers[i].baseCount,
          twinkleEnabled: this._qualityConfig.twinkle,
          driftEnabled: this._qualityConfig.drift && this.baseLayers[i].drift,
          glowEnabled: this._qualityConfig.glow
        });
      }
    }
  },

  /**
   * Handle quality setting changes
   * @private
   */
  _onQualityChange() {
    const oldLayers = this.layers.length;
    this._updateQualityConfig();

    // Only regenerate if layer count changed
    if (oldLayers !== this.layers.length) {
      this.generateStars();
      Logger.log(`StarfieldRenderer regenerated: ${oldLayers} -> ${this.layers.length} layers`);
    }
  },

  /**
   * Generate star positions using seeded random
   * Stars are placed in a large world-space grid that tiles seamlessly
   */
  generateStars() {
    this.stars = [];

    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      const layer = this.layers[layerIndex];
      const layerStars = [];

      // Reset seed for consistent generation per layer
      let seed = this.seed + layerIndex * 1000;

      for (let i = 0; i < layer.count; i++) {
        // Seeded random function
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand1 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand2 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand3 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand4 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand5 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand6 = seed / 0x7fffffff;

        layerStars.push({
          // Position within tile (will be offset by camera)
          tileX: rand1 * this.tileSize,
          tileY: rand2 * this.tileSize,
          size: layer.sizeMin + rand3 * (layer.sizeMax - layer.sizeMin),
          // Twinkle state
          twinklePhase: rand4 * Math.PI * 2,
          twinklePeriod: 3 + rand5 * 5, // 3-8 seconds
          isTwinkling: rand6 < layer.twinkleChance,
          // Drift state (for mid/near layers)
          driftPhase: rand5 * Math.PI * 2,
          driftPeriod: 20 + rand4 * 20, // 20-40 seconds
          driftAmplitude: layer.driftEnabled ? (1 + rand3 * 2) : 0, // 1-3 pixels
          // Base brightness
          baseBrightness: 0.4 + rand3 * 0.4 // 0.4-0.8
        });
      }

      this.stars.push(layerStars);
    }
  },

  /**
   * Update star animations
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;
  },

  /**
   * Draw all star layers
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @param {Object} palette - From PaletteManager
   */
  draw(ctx, camera, viewportWidth, viewportHeight, palette) {
    // Draw each layer (back to front)
    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      const layer = this.layers[layerIndex];
      const layerStars = this.stars[layerIndex];

      if (!layerStars) continue;

      // Calculate camera offset for this layer's parallax
      const parallaxX = camera.x * layer.parallax;
      const parallaxY = camera.y * layer.parallax;

      // Determine which tiles are visible
      const startTileX = Math.floor((parallaxX - viewportWidth) / this.tileSize);
      const endTileX = Math.ceil((parallaxX + viewportWidth * 2) / this.tileSize);
      const startTileY = Math.floor((parallaxY - viewportHeight) / this.tileSize);
      const endTileY = Math.ceil((parallaxY + viewportHeight * 2) / this.tileSize);

      // Draw stars in visible tiles
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        for (let tileY = startTileY; tileY <= endTileY; tileY++) {
          for (const star of layerStars) {
            // Calculate screen position
            let screenX = star.tileX + tileX * this.tileSize - parallaxX;
            let screenY = star.tileY + tileY * this.tileSize - parallaxY;

            // Apply drift if enabled for this layer
            if (layer.driftEnabled && star.driftAmplitude > 0) {
              const driftT = this.time / star.driftPeriod;
              // Figure-8 motion
              screenX += Math.sin(driftT * Math.PI * 2 + star.driftPhase) * star.driftAmplitude;
              screenY += Math.sin(driftT * Math.PI * 4 + star.driftPhase) * star.driftAmplitude * 0.5;
            }

            // Skip if off screen
            if (screenX < -10 || screenX > viewportWidth + 10 ||
                screenY < -10 || screenY > viewportHeight + 10) {
              continue;
            }

            // Calculate brightness with twinkle
            let brightness = star.baseBrightness;
            if (layer.twinkleEnabled && star.isTwinkling) {
              const twinkleT = this.time / star.twinklePeriod;
              const twinkle = Math.sin(twinkleT * Math.PI * 2 + star.twinklePhase);
              brightness = star.baseBrightness * (0.7 + twinkle * 0.3);
            }

            // Draw the star
            this.drawStar(ctx, screenX, screenY, star.size, brightness, palette, layerIndex, layer.glowEnabled);
          }
        }
      }
    }
  },

  /**
   * Draw a single star with quality-aware rendering
   */
  drawStar(ctx, x, y, size, brightness, palette, layerIndex, glowEnabled) {
    ctx.save();

    // Get accent color from palette, default to white
    let baseColor = '#ffffff';
    if (palette && palette.accentHSL) {
      const hsl = palette.accentHSL;
      const tintStrength = 0.15 + layerIndex * 0.05;
      const h = hsl.h;
      const s = hsl.s * tintStrength;
      const l = 85 + 15 * tintStrength;
      baseColor = `hsl(${h}, ${s}%, ${l}%)`;
    }

    if (glowEnabled) {
      // Outer glow (larger, faded)
      ctx.globalAlpha = brightness * 0.3;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner core (brighter)
      ctx.globalAlpha = brightness;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Minimal: single circle, no glow
      ctx.globalAlpha = brightness;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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
  window.StarfieldRenderer = StarfieldRenderer;
}
