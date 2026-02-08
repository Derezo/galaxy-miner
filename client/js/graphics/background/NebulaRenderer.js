/**
 * Nebula Renderer - Noise-textured cloud formations with parallax layers
 *
 * Renders directly to the main canvas each frame (no caching) so that each
 * parallax layer scrolls at its own rate without jumping artefacts.
 *
 * Quality scaling (via GraphicsSettings.getNebulaConfig()):
 *   LOD 0-1 : disabled
 *   LOD 2   : 1 layer, 128px textures, 3 octave noise, source-over blend
 *   LOD 3   : 2 layers, 256px textures, 5 octave noise, screen blend
 *   LOD 4   : 3 layers, 512px textures, 6 octave noise, screen blend, animated flow
 */

const NebulaRenderer = {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  _textures: [],           // Array of offscreen canvases (generated cloud sprites)
  _clouds: [],             // Array of arrays — one sub-array per parallax layer
  _nebulaConfig: null,     // Latest config from GraphicsSettings.getNebulaConfig()
  _noiseInstance: null,     // SimplexNoise instance
  _time: 0,                // Accumulated time in seconds
  _currentActivity: 0.15,  // Smoothed activity level
  _lastPaletteHue: -1,     // Hue of the palette the textures were generated with
  _needsRegeneration: false,
  _pendingTextures: [],    // Queue of {index, size, octaves, palette}
  _texturesReady: false,   // True when at least one texture is generated
  _texturesPalette: null,  // Palette snapshot used for current textures
  _unsubscribeSettings: null,
  _flowCanvas: null,      // 128x128 offscreen canvas for flow overlay
  _flowCtx: null,
  _flowImageData: null,   // Reusable ImageData for flow overlay (avoids GC pressure)
  _flowSize: 128,
  _flowFrameCounter: 0,
  _flowRegenInterval: 5,  // Regenerate every 5 frames
  _flowSpeed: 0.02,       // Time multiplier for z-axis
  _flowOpacity: 0.15,     // Subtle overlay opacity

  // ---------------------------------------------------------------------------
  // Config constants
  // ---------------------------------------------------------------------------
  _textureCountByLOD: { 2: 3, 3: 5, 4: 6 },   // Unique textures per LOD level
  _seed: 54321,
  _tileSize: 3000,
  _driftSpeed: 0.0001,
  _baseSizeMin: 200,
  _baseSizeMax: 500,

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  init() {
    // Create noise source
    if (typeof SimplexNoise !== 'undefined') {
      this._noiseInstance = SimplexNoise.create('nebula_clouds');
    }

    this._time = 0;
    this._currentActivity = 0.15;
    this._textures = [];
    this._texturesReady = false;
    this._clouds = [];
    this._pendingTextures = [];
    this._needsRegeneration = false;
    this._lastPaletteHue = -1;
    this._texturesPalette = null;
    this._flowCanvas = null;
    this._flowCtx = null;
    this._flowImageData = null;
    this._flowFrameCounter = 0;

    this._updateQualityConfig();

    // Generate cloud positions
    this._generateClouds();

    // Generate textures using the current palette (may spread across frames)
    const palette = this._getCurrentPalette();
    if (palette && this._nebulaConfig.enabled) {
      this._generateTextures(palette);
    }

    // Subscribe to quality changes
    if (typeof GraphicsSettings !== 'undefined') {
      this._unsubscribeSettings = GraphicsSettings.addListener(() => {
        this._onQualityChange();
      });
    }

    const cloudTotal = this._clouds.reduce((sum, layer) => sum + layer.length, 0);
    Logger.log(
      'NebulaRenderer initialized with ' + cloudTotal + ' clouds across ' +
      this._clouds.length + ' layers' +
      (this._nebulaConfig.enabled ? '' : ' (disabled at current quality)')
    );
  },

  // ---------------------------------------------------------------------------
  // Quality / config
  // ---------------------------------------------------------------------------

  /**
   * Read the latest nebula config from GraphicsSettings.
   * @private
   */
  _updateQualityConfig() {
    if (typeof GraphicsSettings !== 'undefined') {
      this._nebulaConfig = GraphicsSettings.getNebulaConfig();
    } else {
      // Sensible default when GraphicsSettings is absent (e.g. tests)
      this._nebulaConfig = {
        enabled: true,
        layers: 2,
        parallaxes: [0.005, 0.015],
        cloudsPerLayer: [5, 4],
        textureSize: 256,
        noiseOctaves: 5,
        opacityMultiplier: 1.0,
        blendMode: 'screen',
        animatedFlow: false
      };
    }
  },

  /**
   * Called when GraphicsSettings fires a quality change.
   * @private
   */
  _onQualityChange() {
    const oldEnabled = this._nebulaConfig.enabled;
    const oldLayers = this._nebulaConfig.layers;
    const oldSize = this._nebulaConfig.textureSize;

    this._updateQualityConfig();

    const changed = (
      oldEnabled !== this._nebulaConfig.enabled ||
      oldLayers !== this._nebulaConfig.layers ||
      oldSize !== this._nebulaConfig.textureSize
    );

    if (changed) {
      this._textures = [];
      this._texturesReady = false;
      this._pendingTextures = [];
      this._flowCanvas = null;
      this._flowCtx = null;
      this._flowImageData = null;
      this._flowFrameCounter = 0;
      this._generateClouds();

      const palette = this._getCurrentPalette();
      if (palette && this._nebulaConfig.enabled) {
        this._generateTextures(palette);
      }

      Logger.log(
        'NebulaRenderer quality changed: enabled=' + this._nebulaConfig.enabled +
        ', layers=' + (this._nebulaConfig.layers || 0)
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Palette helpers
  // ---------------------------------------------------------------------------

  /**
   * Grab the live palette from PaletteManager.
   * @returns {Object|null}
   * @private
   */
  _getCurrentPalette() {
    if (typeof PaletteManager !== 'undefined') {
      return PaletteManager.getCurrentPalette();
    }
    return null;
  },

  // ---------------------------------------------------------------------------
  // Texture generation
  // ---------------------------------------------------------------------------

  /**
   * Determine how many unique textures to create and queue them for generation.
   * Counts: LOD 2 -> 3, LOD 3 -> 5, LOD 4 -> 6.
   * @param {Object} palette
   * @private
   */
  _generateTextures(palette) {
    if (!this._nebulaConfig.enabled) return;

    const cfg = this._nebulaConfig;
    const lod = (typeof GraphicsSettings !== 'undefined') ? GraphicsSettings.getLOD() : 3;
    const textureCount = this._textureCountByLOD[lod] || this._textureCountByLOD[2];

    // Estimate cost: >100 ms if textureSize >= 512 and many textures
    const estimatedMs = (cfg.textureSize * cfg.textureSize * textureCount) / 2500;
    const spread = estimatedMs > 100;

    this._texturesPalette = palette;
    this._lastPaletteHue = palette.primaryHSL ? palette.primaryHSL.h : -1;

    if (spread) {
      // Queue for incremental generation (1-2 per frame)
      this._textures = new Array(textureCount).fill(null);
      this._pendingTextures = [];
      for (let i = 0; i < textureCount; i++) {
        this._pendingTextures.push({
          index: i,
          size: cfg.textureSize,
          octaves: cfg.noiseOctaves,
          palette: palette
        });
      }
    } else {
      // Generate all immediately
      this._textures = [];
      this._pendingTextures = [];
      for (let i = 0; i < textureCount; i++) {
        this._textures.push(
          this._generateSingleTexture(i, cfg.textureSize, cfg.noiseOctaves, palette)
        );
      }
      this._texturesReady = true;
    }
  },

  /**
   * Generate one offscreen cloud texture canvas.
   *
   * @param {number} index      Texture index (used to vary the noise seed offset)
   * @param {number} size       Base texture dimension (128 / 256 / 512)
   * @param {number} octaves    FBM octave count
   * @param {Object} palette    Current palette
   * @returns {HTMLCanvasElement}
   * @private
   */
  _generateSingleTexture(index, size, octaves, palette) {
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const offCtx = offscreen.getContext('2d');

    const imageData = offCtx.createImageData(size, size);
    const data = imageData.data;

    // Pick a palette colour — alternate between primary and secondary HSL
    const hslSource = (index % 2 === 0) ? palette.primaryHSL : palette.secondaryHSL;
    const hsl = hslSource || { h: 220, s: 30, l: 15 };

    // Convert HSL to RGB once for the whole texture
    const rgb = this._hslToRgb(
      ((hsl.h + index * 17) % 360) / 360,
      Math.min(100, hsl.s + 10) / 100,
      Math.min(100, hsl.l + 5) / 100
    );

    const noise = this._noiseInstance;
    const freq = 4.0 / size;
    // Each texture gets a unique noise offset so they look different
    const offsetX = index * 137.5;
    const offsetY = index * 253.3;

    const halfSize = size / 2;
    const invHalf = 1.0 / halfSize;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        // Noise sample
        const nx = (px + offsetX) * freq;
        const ny = (py + offsetY) * freq;
        let noiseVal;
        if (noise) {
          noiseVal = SimplexNoise.fbm(noise.noise2D, nx, ny, octaves, 2.0, 0.5);
        } else {
          // Fallback when SimplexNoise unavailable
          noiseVal = Math.sin(nx * 3.0) * Math.cos(ny * 3.0);
        }

        // Radial falloff — 1 at center, fading to 0 at 85% radius
        // Ensures cloud edges are fully transparent before hitting the rectangular texture boundary
        const dx = (px - halfSize) * invHalf;
        const dy = (py - halfSize) * invHalf;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Invert: 1.0 at center, 0.0 at dist >= 0.85 (ensures transparent well before edge)
        const rawFalloff = 1.0 - this._smoothstep(0.85, 0.0, dist);
        const falloff = rawFalloff * rawFalloff; // Square for faster dropoff near edges

        // Combine noise and falloff into alpha; pow(1.5) concentrates opacity toward center
        const alpha = Math.max(0, Math.pow((noiseVal * 0.5 + 0.5) * falloff, 1.5));

        const idx = (py * size + px) * 4;
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = (alpha * 255 + 0.5) | 0;
      }
    }

    offCtx.putImageData(imageData, 0, 0);
    return offscreen;
  },

  /**
   * Hermite smoothstep — returns 0 when x >= edge0, 1 when x <= edge1.
   * @private
   */
  _smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge1) / (edge0 - edge1)));
    return t * t * (3 - 2 * t);
  },

  /**
   * HSL (0-1 ranges) to RGB (0-255 array).
   * @private
   */
  _hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [(r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0];
  },

  // ---------------------------------------------------------------------------
  // Flow overlay
  // ---------------------------------------------------------------------------

  /**
   * Regenerate the flow overlay canvas using noise3D for organic morphing.
   * @private
   */
  _regenerateFlowOverlay() {
    if (!this._flowCanvas) {
      this._flowCanvas = document.createElement('canvas');
      this._flowCanvas.width = this._flowSize;
      this._flowCanvas.height = this._flowSize;
      this._flowCtx = this._flowCanvas.getContext('2d');
      this._flowImageData = this._flowCtx.createImageData(this._flowSize, this._flowSize);
    }

    const size = this._flowSize;
    const data = this._flowImageData.data;
    const noise = this._noiseInstance;
    if (!noise) return;

    const freq = 3.0 / size;
    const z = this._time * this._flowSpeed;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const val = noise.noise3D(px * freq, py * freq, z);
        const alpha = ((val * 0.5 + 0.5) * 255 + 0.5) | 0;
        const idx = (py * size + px) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = alpha;
      }
    }

    this._flowCtx.putImageData(this._flowImageData, 0, 0);
  },

  // ---------------------------------------------------------------------------
  // Cloud placement
  // ---------------------------------------------------------------------------

  /**
   * Populate `_clouds` — an array of arrays, one per parallax layer.
   * Uses a simple seeded LCG so positions are deterministic.
   * @private
   */
  _generateClouds() {
    this._clouds = [];

    if (!this._nebulaConfig.enabled) return;

    const cfg = this._nebulaConfig;
    let seed = this._seed;

    const seededRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const lod = (typeof GraphicsSettings !== 'undefined') ? GraphicsSettings.getLOD() : 3;
    const totalTextures = this._textures.length || (this._textureCountByLOD[lod] || this._textureCountByLOD[2]);

    for (let layerIdx = 0; layerIdx < cfg.layers; layerIdx++) {
      const count = cfg.cloudsPerLayer[layerIdx] || 4;
      const layerClouds = [];

      for (let i = 0; i < count; i++) {
        layerClouds.push({
          tileX: seededRandom() * this._tileSize,
          tileY: seededRandom() * this._tileSize,
          textureIndex: Math.floor(seededRandom() * totalTextures),
          rotation: seededRandom() * Math.PI * 2,
          scaleX: 0.6 + seededRandom() * 0.8,   // 0.6 - 1.4
          scaleY: 0.6 + seededRandom() * 0.8,
          flipX: seededRandom() > 0.5,
          flipY: seededRandom() > 0.5,
          baseSize: this._baseSizeMin + seededRandom() * (this._baseSizeMax - this._baseSizeMin),
          driftPhase: seededRandom() * Math.PI * 2,
          pulsePhase: seededRandom() * Math.PI * 2,
          pulsePeriod: 60 + seededRandom() * 60,   // 60–120 s
          colorOffset: seededRandom() * 30 - 15     // -15 to +15 hue shift (reserved)
        });
      }

      this._clouds.push(layerClouds);
    }
  },

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Advance time, smooth the activity level, and process pending texture work.
   * @param {number} dt            Delta time in seconds
   * @param {number} activityLevel Current activity from PaletteManager (0-1)
   */
  update(dt, activityLevel) {
    this._time += dt;

    // Smooth activity towards target
    const diff = activityLevel - this._currentActivity;
    this._currentActivity += diff * 0.01;

    // Check for palette change
    if (this._nebulaConfig.enabled) {
      const palette = this._getCurrentPalette();
      if (palette && palette.primaryHSL) {
        const currentHue = palette.primaryHSL.h;
        if (this._lastPaletteHue >= 0 && Math.abs(currentHue - this._lastPaletteHue) > 0.5) {
          this._needsRegeneration = true;
          this._texturesPalette = palette;
          this._lastPaletteHue = currentHue;

          // Build regeneration queue
          if (this._pendingTextures.length === 0) {
            const cfg = this._nebulaConfig;
            for (let i = 0; i < this._textures.length; i++) {
              this._pendingTextures.push({
                index: i,
                size: cfg.textureSize,
                octaves: cfg.noiseOctaves,
                palette: palette
              });
            }
          }
        }
      }
    }

    // Process pending texture generation (1–2 per frame)
    if (this._pendingTextures.length > 0) {
      const batchSize = Math.min(2, this._pendingTextures.length);
      for (let i = 0; i < batchSize; i++) {
        const job = this._pendingTextures.shift();
        const tex = this._generateSingleTexture(
          job.index, job.size, job.octaves, job.palette
        );
        this._textures[job.index] = tex;
        this._texturesReady = true;
      }

      if (this._pendingTextures.length === 0) {
        this._needsRegeneration = false;
      }
    }

    // Regenerate flow overlay periodically (LOD 4 animated flow)
    if (this._nebulaConfig.animatedFlow && this._noiseInstance) {
      this._flowFrameCounter++;
      if (this._flowFrameCounter % this._flowRegenInterval === 0) {
        this._regenerateFlowOverlay();
      }
    }
  },

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /**
   * Render nebula layers to the provided canvas context.
   *
   * Called directly from BackgroundSystem.draw() every frame.
   * Does NOT fill the background (that responsibility belongs to BackgroundSystem).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @param {Object} palette  Current palette from PaletteManager
   */
  draw(ctx, camera, viewportWidth, viewportHeight, palette) {
    if (!this._nebulaConfig.enabled || this._clouds.length === 0) return;
    if (!this._texturesReady) return;

    // Opacity from activity and quality
    const baseOpacity = this.getOpacityForActivity(this._currentActivity);
    const qualityMul = this._nebulaConfig.opacityMultiplier;

    const pulseAmount = this._currentActivity * 0.05;
    const pulse = 1 + Math.sin(this._time * 0.5) * pulseAmount;
    const opacity = baseOpacity * pulse * qualityMul;

    if (opacity < 0.01) return;

    const cfg = this._nebulaConfig;
    const tileSize = this._tileSize;
    const animatedFlow = cfg.animatedFlow;
    const blendMode = cfg.blendMode || 'source-over';
    const driftT = this._time * this._driftSpeed;
    const rotAngle = this._time * 0.001;

    ctx.save();

    for (let layerIdx = 0; layerIdx < this._clouds.length; layerIdx++) {
      const layerClouds = this._clouds[layerIdx];
      const parallax = cfg.parallaxes[layerIdx] || 0.01;

      const parallaxX = camera.x * parallax;
      const parallaxY = camera.y * parallax;

      // Tight tile range: cover only the visible viewport plus cloud margin
      const margin = this._baseSizeMax * 2;
      const startTileX = Math.floor((parallaxX - margin) / tileSize);
      const endTileX = Math.ceil((parallaxX + viewportWidth + margin) / tileSize);
      const startTileY = Math.floor((parallaxY - margin) / tileSize);
      const endTileY = Math.ceil((parallaxY + viewportHeight + margin) / tileSize);

      // Per-layer opacity: back layers slightly fainter
      const layerOpacity = opacity * (1.0 - layerIdx * 0.15);
      ctx.globalAlpha = layerOpacity;
      ctx.globalCompositeOperation = blendMode;

      // Pre-compute per-cloud values that don't depend on tile position
      for (let ci = 0; ci < layerClouds.length; ci++) {
        const cloud = layerClouds[ci];

        // Pick texture (gracefully handle missing slots during regen)
        const texIdx = cloud.textureIndex % this._textures.length;
        const texture = this._textures[texIdx];
        if (!texture) continue;

        // Drift animation (only depends on time + cloud, not tile)
        const driftX = Math.sin(driftT + cloud.driftPhase) * 50;
        const driftY = Math.cos(driftT * 0.7 + cloud.driftPhase) * 30;

        // Size pulse (only depends on time + cloud, not tile)
        const pulseT = this._time / cloud.pulsePeriod;
        const sizePulse = 1 + Math.sin(pulseT * Math.PI * 2 + cloud.pulsePhase) * 0.1;
        const drawSize = cloud.baseSize * sizePulse;
        const halfDraw = drawSize / 2;
        const cloudMargin = drawSize;

        // Pre-compute transform values
        const rot = cloud.rotation + rotAngle;
        const flipScaleX = (cloud.flipX ? -1 : 1) * cloud.scaleX;
        const flipScaleY = (cloud.flipY ? -1 : 1) * cloud.scaleY;

        // Source rect — always use full texture
        const texW = texture.width;
        const texH = texture.height;

        // Draw across visible tiles
        for (let tx = startTileX; tx <= endTileX; tx++) {
          for (let ty = startTileY; ty <= endTileY; ty++) {
            const screenX = cloud.tileX + tx * tileSize - parallaxX + driftX;
            const screenY = cloud.tileY + ty * tileSize - parallaxY + driftY;

            // Cull off-screen
            if (screenX < -cloudMargin || screenX > viewportWidth + cloudMargin ||
                screenY < -cloudMargin || screenY > viewportHeight + cloudMargin) {
              continue;
            }

            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(rot);
            ctx.scale(flipScaleX, flipScaleY);

            ctx.drawImage(
              texture,
              0, 0, texW, texH,
              -halfDraw, -halfDraw, drawSize, drawSize
            );

            // Flow overlay for animated morphing (LOD 4)
            // Blend mode/alpha restored by enclosing ctx.restore()
            if (animatedFlow && this._flowCanvas) {
              ctx.globalCompositeOperation = 'multiply';
              ctx.globalAlpha = this._flowOpacity;
              ctx.drawImage(
                this._flowCanvas,
                0, 0, this._flowSize, this._flowSize,
                -halfDraw, -halfDraw, drawSize, drawSize
              );
            }

            ctx.restore();
          }
        }
      }
    }

    ctx.restore();
  },

  // ---------------------------------------------------------------------------
  // Activity-based opacity
  // ---------------------------------------------------------------------------

  /**
   * Map activity level (0-1) to a base nebula opacity.
   * @param {number} activity
   * @returns {number}
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

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Tear down: unsubscribe listener, release textures.
   */
  destroy() {
    if (this._unsubscribeSettings) {
      this._unsubscribeSettings();
      this._unsubscribeSettings = null;
    }

    this._textures = [];
    this._texturesReady = false;
    this._clouds = [];
    this._pendingTextures = [];
    this._needsRegeneration = false;
    this._texturesPalette = null;
    this._lastPaletteHue = -1;
    this._noiseInstance = null;
    this._flowCanvas = null;
    this._flowCtx = null;
    this._flowImageData = null;
    this._flowFrameCounter = 0;
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.NebulaRenderer = NebulaRenderer;
}
