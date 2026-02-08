/**
 * Background System - Dreamy dynamic starfield with zone-aware colors
 * Coordinates ZoneSampler, PaletteManager, StarfieldRenderer, and NebulaRenderer
 *
 * Uses an offscreen cache canvas (1.5x viewport) to avoid re-rendering
 * nebula + starfield every frame. The cache is invalidated when the camera
 * moves beyond 25% of the viewport, or on quality/resize changes.
 */

const BackgroundSystem = {
  initialized: false,

  // Sub-modules (will be populated as we create them)
  sampler: null,
  palette: null,
  stars: null,
  nebula: null,

  // --- Cache state ---
  _cacheCanvas: null,
  _cacheCtx: null,
  _cacheDirty: true,
  // World-camera position that was used when the cache was last rendered.
  // This is the REAL camera (top-left of the player viewport), not the
  // expanded cache-camera.
  _cacheOriginX: 0,
  _cacheOriginY: 0,
  // Viewport dimensions at last cache creation (to detect resize)
  _cacheViewportW: 0,
  _cacheViewportH: 0,
  // Representative parallax used to approximate scroll offset when blitting.
  // Weighted toward the visually dominant mid-layer stars (0.05).
  _blitParallax: 0.05,
  // Quality-change listener unsubscribe handle
  _unsubscribeSettings: null,

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

    // Subscribe to quality changes so the cache is invalidated
    if (typeof GraphicsSettings !== 'undefined') {
      this._unsubscribeSettings = GraphicsSettings.addListener(() => {
        this._cacheDirty = true;
      });
    }

    this._cacheDirty = true;
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
   * Draw the background layers, using an offscreen cache when possible.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera - Camera position (top-left of viewport in world coords)
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

    // Ensure cache canvas exists and matches current viewport
    this._ensureCacheCanvas(viewportWidth, viewportHeight);

    // Determine if the cache needs a fresh render
    if (this._needsCacheRefresh(camera, viewportWidth, viewportHeight)) {
      this._renderToCache(camera, viewportWidth, viewportHeight);
    }

    // Blit the relevant viewport-sized region from the cache to the screen
    this._blitCache(ctx, camera, viewportWidth, viewportHeight);
  },

  // -----------------------------------------------------------------------
  // Cache management internals
  // -----------------------------------------------------------------------

  /**
   * Create or resize the offscreen cache canvas to 1.5x the viewport.
   * @private
   */
  _ensureCacheCanvas(viewportWidth, viewportHeight) {
    const cacheW = Math.ceil(viewportWidth * 1.5);
    const cacheH = Math.ceil(viewportHeight * 1.5);

    if (!this._cacheCanvas ||
        this._cacheViewportW !== viewportWidth ||
        this._cacheViewportH !== viewportHeight) {
      // Viewport changed -- (re)create the cache canvas
      if (!this._cacheCanvas) {
        this._cacheCanvas = document.createElement('canvas');
      }
      this._cacheCanvas.width = cacheW;
      this._cacheCanvas.height = cacheH;
      this._cacheCtx = this._cacheCanvas.getContext('2d');
      this._cacheViewportW = viewportWidth;
      this._cacheViewportH = viewportHeight;
      this._cacheDirty = true;
    }
  },

  /**
   * Determine whether the cache must be re-rendered.
   * Triggers: dirty flag, or camera moved > 25% of viewport from cache origin.
   * @private
   */
  _needsCacheRefresh(camera, viewportWidth, viewportHeight) {
    if (this._cacheDirty) return true;

    // How far the camera has moved in world-space since the cache was rendered.
    const dx = Math.abs(camera.x - this._cacheOriginX);
    const dy = Math.abs(camera.y - this._cacheOriginY);

    return dx > viewportWidth * 0.25 || dy > viewportHeight * 0.25;
  },

  /**
   * Render the full background (nebula + stars) into the cache canvas.
   * The cache covers a 1.5x-viewport area centered on the current viewport.
   *
   * The virtual camera is shifted back by 0.25 * viewport so the real
   * viewport sits in the center of the cache, providing a 25% scroll margin
   * on each side.
   * @private
   */
  _renderToCache(camera, viewportWidth, viewportHeight) {
    const cacheW = Math.ceil(viewportWidth * 1.5);
    const cacheH = Math.ceil(viewportHeight * 1.5);

    // Virtual camera: shift back by 0.25 * viewport so the real viewport
    // sits in the center of the cache canvas.
    const cacheCamera = {
      x: camera.x - viewportWidth * 0.25,
      y: camera.y - viewportHeight * 0.25
    };

    const cCtx = this._cacheCtx;
    const palette = this.palette ? this.palette.getCurrentPalette() : null;

    // Draw nebula first (furthest back)
    if (this.nebula) {
      this.nebula.draw(cCtx, cacheCamera, cacheW, cacheH, palette);
    } else {
      // Clear with default background if no nebula
      cCtx.fillStyle = (palette && palette.primary) || '#000011';
      cCtx.fillRect(0, 0, cacheW, cacheH);
    }

    // Draw stars on top of nebula
    if (this.stars) {
      this.stars.draw(cCtx, cacheCamera, cacheW, cacheH, palette);
    }

    // Record the real camera position at render time (for threshold + blit offset)
    this._cacheOriginX = camera.x;
    this._cacheOriginY = camera.y;
    this._cacheDirty = false;
  },

  /**
   * Blit the viewport-sized region from the cache canvas onto the main canvas.
   *
   * The source rect starts at the center of the cache (where the real viewport
   * was when the cache was rendered) and scrolls by a parallax-weighted
   * fraction of the camera delta. This approximates how the multi-layer
   * background visually shifts, using a single representative parallax value.
   *
   * Because parallax values range from 0.01 (nebula) to 0.15 (near stars),
   * the blit offset is very small -- the cache margin (25% viewport per side)
   * is never exhausted before the 25% world-camera threshold triggers a
   * full re-render.
   * @private
   */
  _blitCache(ctx, camera, viewportWidth, viewportHeight) {
    // Camera delta since the cache was rendered
    const dx = camera.x - this._cacheOriginX;
    const dy = camera.y - this._cacheOriginY;

    // The cache was rendered with the real viewport centered at
    // (0.25 * vpW, 0.25 * vpH) in cache-canvas coordinates.
    // Apply the camera delta scaled by the representative parallax so the
    // background scrolls at roughly the right visual rate.
    const sx = viewportWidth * 0.25 + dx * this._blitParallax;
    const sy = viewportHeight * 0.25 + dy * this._blitParallax;

    ctx.drawImage(
      this._cacheCanvas,
      sx, sy, viewportWidth, viewportHeight,
      0, 0, viewportWidth, viewportHeight
    );
  },

  /**
   * Cleanup - remove settings listener and release cache canvas
   */
  destroy() {
    if (this._unsubscribeSettings) {
      this._unsubscribeSettings();
      this._unsubscribeSettings = null;
    }
    this._cacheCanvas = null;
    this._cacheCtx = null;
    this._cacheDirty = true;
  }
};
