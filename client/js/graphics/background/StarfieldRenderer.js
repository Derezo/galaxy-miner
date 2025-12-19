/**
 * Starfield Renderer - Three-layer parallax stars with soft rendering
 * Features twinkle effects and gentle drift animation
 */

const StarfieldRenderer = {
  // Star layers configuration
  layers: [
    { name: 'deep', count: 150, sizeMin: 1, sizeMax: 2, parallax: 0.02, drift: false, twinkleChance: 0.02 },
    { name: 'mid', count: 80, sizeMin: 2, sizeMax: 4, parallax: 0.05, drift: true, twinkleChance: 0.08 },
    { name: 'near', count: 40, sizeMin: 3, sizeMax: 6, parallax: 0.10, drift: true, twinkleChance: 0.15 }
  ],

  // Generated star data per layer
  stars: [],

  // Animation state
  time: 0,

  // Seeded random for consistent star positions
  seed: 12345,

  // Tile size for seamless world-space grid
  tileSize: 2000,

  init() {
    this.generateStars();
    this.time = 0;
    Logger.log('StarfieldRenderer initialized with ' +
      this.stars.reduce((sum, layer) => sum + layer.length, 0) + ' stars');
  },

  /**
   * Generate star positions using seeded random
   * Stars are placed in a large world-space grid that tiles seamlessly
   */
  generateStars() {
    this.stars = [];

    for (const layer of this.layers) {
      const layerStars = [];

      // Reset seed for consistent generation per layer
      let seed = this.seed + this.layers.indexOf(layer) * 1000;

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
          driftAmplitude: layer.drift ? (1 + rand3 * 2) : 0, // 1-3 pixels
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

            // Apply drift if enabled
            if (star.driftAmplitude > 0) {
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
            if (star.isTwinkling) {
              const twinkleT = this.time / star.twinklePeriod;
              const twinkle = Math.sin(twinkleT * Math.PI * 2 + star.twinklePhase);
              brightness = star.baseBrightness * (0.7 + twinkle * 0.3);
            }

            // Draw the star
            this.drawStar(ctx, screenX, screenY, star.size, brightness, palette, layerIndex);
          }
        }
      }
    }
  },

  /**
   * Draw a single star with optimized rendering (no gradients)
   */
  drawStar(ctx, x, y, size, brightness, palette, layerIndex) {
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

    ctx.restore();
  }
};
