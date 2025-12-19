/**
 * Background System - Dreamy dynamic starfield with zone-aware colors
 * Coordinates ZoneSampler, PaletteManager, StarfieldRenderer, and NebulaRenderer
 */

const BackgroundSystem = {
  initialized: false,

  // Sub-modules (will be populated as we create them)
  sampler: null,
  palette: null,
  stars: null,
  nebula: null,

  init() {
    // Initialize sub-modules when they exist
    if (typeof ZoneSampler !== 'undefined') {
      this.sampler = ZoneSampler;
      this.sampler.init();
    }

    if (typeof PaletteManager !== 'undefined') {
      this.palette = PaletteManager;
      this.palette.init();
    }

    if (typeof StarfieldRenderer !== 'undefined') {
      this.stars = StarfieldRenderer;
      this.stars.init();
    }

    if (typeof NebulaRenderer !== 'undefined') {
      this.nebula = NebulaRenderer;
      this.nebula.init();
    }

    this.initialized = true;
    Logger.log('BackgroundSystem initialized');
  },

  /**
   * Update background state
   * @param {number} dt - Delta time in seconds
   * @param {Object} visibleObjects - Objects from World.getVisibleObjects()
   * @param {{x: number, y: number}} playerPosition - Player world position
   */
  update(dt, visibleObjects, playerPosition) {
    if (!this.initialized) return;

    // Sample zone colors and activity from nearby objects
    if (this.sampler) {
      this.sampler.update(visibleObjects, playerPosition);
    }

    // Update palette transitions
    if (this.palette && this.sampler) {
      this.palette.update(dt, this.sampler.getZoneData());
    }

    // Update star animations (twinkle, drift)
    if (this.stars) {
      this.stars.update(dt);
    }

    // Update nebula animations
    if (this.nebula && this.palette) {
      this.nebula.update(dt, this.palette.getActivityLevel());
    }
  },

  /**
   * Draw the background layers
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera - Camera position
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  draw(ctx, camera, viewportWidth, viewportHeight) {
    if (!this.initialized) {
      // Fallback to solid background if not initialized
      ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      return;
    }

    const palette = this.palette ? this.palette.getCurrentPalette() : null;

    // Draw nebula first (furthest back)
    if (this.nebula) {
      this.nebula.draw(ctx, camera, viewportWidth, viewportHeight, palette);
    }

    // Draw stars on top of nebula
    if (this.stars) {
      this.stars.draw(ctx, camera, viewportWidth, viewportHeight, palette);
    }
  }
};
