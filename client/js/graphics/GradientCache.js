/**
 * GradientCache - Caches CanvasGradient objects to avoid per-frame allocation
 *
 * Canvas 2D's createRadialGradient() / createLinearGradient() allocate a new
 * object every call, creating GC pressure when called per-entity per-frame.
 * This cache stores origin-centered gradients keyed by type/color/size/LOD.
 * Callers use ctx.translate() to position the cached gradient at draw time.
 *
 * Cache is cleared on quality change (LOD affects gradient stop count) and
 * canvas resize (context may be invalidated).
 */

const GradientCache = {
  _cache: new Map(),
  _ctx: null,
  _maxSize: 500,

  /**
   * Initialize with a canvas rendering context
   * @param {CanvasRenderingContext2D} ctx
   */
  init(ctx) {
    this._ctx = ctx;
  },

  /**
   * Get or create a radial gradient centered at origin (0,0).
   * Caller should ctx.save(); ctx.translate(x, y); before drawing,
   * then ctx.restore() after.
   *
   * @param {string} key - Unique cache key (e.g. "star_corona_400_#ffff00")
   * @param {number} innerR - Inner radius
   * @param {number} outerR - Outer radius
   * @param {Array<[number, string]>} stops - Array of [offset, color] pairs
   * @returns {CanvasGradient}
   */
  getRadial(key, innerR, outerR, stops) {
    const cached = this._cache.get(key);
    if (cached) return cached;

    const gradient = this._ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
    for (let i = 0; i < stops.length; i++) {
      gradient.addColorStop(stops[i][0], stops[i][1]);
    }

    this._cache.set(key, gradient);

    // Evict oldest entry if over capacity
    if (this._cache.size > this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }

    return gradient;
  },

  /**
   * Get or create a linear gradient centered at origin.
   *
   * @param {string} key - Unique cache key
   * @param {number} x0 - Start X (relative to origin)
   * @param {number} y0 - Start Y (relative to origin)
   * @param {number} x1 - End X (relative to origin)
   * @param {number} y1 - End Y (relative to origin)
   * @param {Array<[number, string]>} stops - Array of [offset, color] pairs
   * @returns {CanvasGradient}
   */
  getLinear(key, x0, y0, x1, y1, stops) {
    const cached = this._cache.get(key);
    if (cached) return cached;

    const gradient = this._ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) {
      gradient.addColorStop(stops[i][0], stops[i][1]);
    }

    this._cache.set(key, gradient);

    if (this._cache.size > this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }

    return gradient;
  },

  /**
   * Clear all cached gradients.
   * Call on quality/LOD change or canvas resize.
   */
  clear() {
    this._cache.clear();
  },

  /**
   * Get current cache size for debugging
   * @returns {{ size: number, maxSize: number }}
   */
  getStats() {
    return {
      size: this._cache.size,
      maxSize: this._maxSize
    };
  },

  /**
   * Log cache statistics
   */
  debug() {
    const stats = this.getStats();
    console.log(`[GradientCache] Cached: ${stats.size} / ${stats.maxSize}`);
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.GradientCache = GradientCache;
}
