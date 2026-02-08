/**
 * Background System - Dreamy dynamic starfield with zone-aware colors
 * Coordinates ZoneSampler, PaletteManager, StarfieldRenderer, and NebulaRenderer
 *
 * Each sub-renderer draws directly to the main canvas every frame with its
 * own per-layer parallax, ensuring smooth scrolling at all speeds.
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
   * Draw the background layers directly to the main canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera - Camera position (top-left of viewport in world coords)
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  draw(ctx, camera, viewportWidth, viewportHeight) {
    if (!this.initialized) {
      ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      return;
    }

    const palette = this.palette ? this.palette.getCurrentPalette() : null;

    // 1. Fill background color
    ctx.fillStyle = (palette && palette.primary) || '#000011';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // 2. Draw nebula directly to main canvas (correct per-layer parallax)
    if (this.nebula) {
      this.nebula.draw(ctx, camera, viewportWidth, viewportHeight, palette);
    }

    // 3. Draw stars directly to main canvas (correct per-layer parallax)
    if (this.stars) {
      this.stars.draw(ctx, camera, viewportWidth, viewportHeight, palette);
    }
  },

  /**
   * Cleanup
   */
  destroy() {
    // Sub-modules manage their own cleanup
  }
};
