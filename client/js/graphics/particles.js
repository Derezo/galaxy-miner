/**
 * Particle System with Object Pooling
 * Pre-allocates particles to avoid garbage collection during gameplay
 * Supports multiple particle types for varied visual effects
 *
 * Integrates with GraphicsSettings for quality-based scaling:
 * - Pool size scales from 75 (quality 0) to 1000 (quality 100)
 * - Particle counts scale with exponential multiplier
 * - Glow effects use LOD-based gradient stops
 */

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 0;
    this.color = '#ffffff';
    this.secondaryColor = null; // For multi-color particles
    this.size = 2;
    this.alpha = 1;
    this.decay = 1;
    this.drag = 1;
    this.type = 'default';
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.gravity = 0; // For falling particles
    this.pulse = false; // For pulsing effects
    this.pulseSpeed = 0;
  }

  update(dt) {
    if (!this.active) return false;

    this.life -= dt * 1000;
    if (this.life <= 0) {
      this.active = false;
      return false;
    }

    // Apply gravity
    this.vy += this.gravity * dt;

    // Apply movement
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;

    // Update rotation
    this.rotation += this.rotationSpeed * dt;

    // Calculate alpha with optional pulsing
    let baseAlpha = Math.max(0, (this.life / this.maxLife) * this.decay);
    if (this.pulse && this.pulseSpeed > 0) {
      const pulsePhase = Math.sin(Date.now() * this.pulseSpeed * 0.001);
      baseAlpha *= 0.7 + pulsePhase * 0.3;
    }
    this.alpha = baseAlpha;

    return true;
  }
}

const ParticleSystem = {
  pool: [],
  active: [],
  poolSize: 500,
  _unsubscribeSettings: null,

  /**
   * Initialize particle system with quality-based pool size
   */
  init() {
    this.pool = [];
    this.active = [];

    // Get pool size from GraphicsSettings
    this.poolSize = this._getPoolSize();

    // Pre-allocate particles
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push(new Particle());
    }

    // Subscribe to quality changes for dynamic pool resizing
    if (typeof GraphicsSettings !== 'undefined') {
      this._unsubscribeSettings = GraphicsSettings.addListener(() => {
        this._onQualityChange();
      });
    }

    Logger.log(`ParticleSystem initialized with ${this.poolSize} particles`);
  },

  /**
   * Get pool size from settings or default
   * @private
   */
  _getPoolSize() {
    if (typeof GraphicsSettings !== 'undefined') {
      return GraphicsSettings.getPoolSize();
    }
    return 500; // Default fallback
  },

  /**
   * Handle quality setting changes
   * @private
   */
  _onQualityChange() {
    const newPoolSize = this._getPoolSize();

    if (newPoolSize === this.poolSize) return;

    const oldPoolSize = this.poolSize;
    this.poolSize = newPoolSize;

    if (newPoolSize > oldPoolSize) {
      // Grow pool
      const toAdd = newPoolSize - oldPoolSize;
      for (let i = 0; i < toAdd; i++) {
        this.pool.push(new Particle());
      }
      Logger.log(`ParticleSystem pool grew: ${oldPoolSize} -> ${newPoolSize}`);
    } else {
      // Shrink pool - just update target, particles will naturally return
      Logger.log(`ParticleSystem pool target reduced: ${oldPoolSize} -> ${newPoolSize}`);
    }
  },

  /**
   * Get particle count multiplier based on current graphics settings
   * Use this when spawning particles to reduce counts on lower settings
   * @returns {number} Multiplier (0.0 to 2.0)
   */
  getParticleMultiplier() {
    if (typeof GraphicsSettings !== 'undefined') {
      return GraphicsSettings.getParticleMultiplier();
    }
    return 1.0;
  },

  /**
   * Get current LOD level for rendering optimization
   * @returns {number} LOD level 0-4
   */
  getLOD() {
    if (typeof GraphicsSettings !== 'undefined') {
      return GraphicsSettings.getLOD();
    }
    return 3; // Default to high
  },

  /**
   * Check if glow effects should be rendered
   * @returns {boolean}
   */
  shouldRenderGlow() {
    return this.getLOD() >= 1;
  },

  /**
   * Scale a particle count by quality multiplier
   * @param {number} baseCount - Base particle count
   * @param {number} [floor=1] - Minimum count
   * @returns {number} Scaled count
   */
  scaleCount(baseCount, floor = 1) {
    const multiplier = this.getParticleMultiplier();
    if (multiplier <= 0) return 0;
    return Math.max(floor, Math.round(baseCount * multiplier));
  },

  /**
   * Spawn a single particle
   */
  spawn(config) {
    // At quality 0, skip all particle spawning except essential
    if (this.getParticleMultiplier() <= 0 && !config.essential) {
      return null;
    }

    let particle = this.pool.pop();

    if (!particle) {
      // Pool exhausted - recycle oldest active particle
      if (this.active.length > 0) {
        particle = this.active.shift();
      } else {
        // Emergency allocation
        particle = new Particle();
      }
    }

    particle.reset();
    particle.active = true;
    particle.x = config.x;
    particle.y = config.y;
    particle.vx = config.vx || 0;
    particle.vy = config.vy || 0;
    particle.life = config.life || 500;
    particle.maxLife = particle.life;
    particle.color = config.color || '#ffffff';
    particle.secondaryColor = config.secondaryColor || null;
    particle.size = config.size || 2;
    particle.decay = config.decay ?? 1;
    particle.drag = config.drag ?? 1;
    particle.type = config.type || 'default';
    particle.rotation = config.rotation || 0;
    particle.rotationSpeed = config.rotationSpeed || 0;
    particle.gravity = config.gravity || 0;
    particle.pulse = config.pulse || false;
    particle.pulseSpeed = config.pulseSpeed || 0;
    particle.alpha = 1;

    this.active.push(particle);
    return particle;
  },

  /**
   * Spawn a burst of particles with quality scaling
   * @param {Object} config - Base particle config
   * @param {number} count - Base particle count (will be scaled by quality)
   * @param {Object} spread - Spread values for randomization
   */
  // Reusable config object for spawnBurst to avoid per-particle allocation
  _burstConfig: {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0,
    color: '#ffffff', secondaryColor: null, decay: 1, drag: 1,
    type: 'default', rotation: 0, rotationSpeed: 0,
    gravity: 0, pulse: false, pulseSpeed: 0, essential: false
  },

  spawnBurst(config, count, spread = {}) {
    // Apply particle multiplier to reduce particle counts on lower settings
    const adjustedCount = this.scaleCount(count);

    if (adjustedCount === 0) return;

    // Copy base config properties into reusable object once
    const bc = this._burstConfig;
    bc.color = config.color || '#ffffff';
    bc.secondaryColor = config.secondaryColor || null;
    bc.decay = config.decay ?? 1;
    bc.drag = config.drag ?? 1;
    bc.type = config.type || 'default';
    bc.rotation = config.rotation || 0;
    bc.rotationSpeed = config.rotationSpeed || 0;
    bc.gravity = config.gravity || 0;
    bc.pulse = config.pulse || false;
    bc.pulseSpeed = config.pulseSpeed || 0;
    bc.essential = config.essential || false;

    // Pre-compute base values and spread multipliers
    const baseVx = config.vx || 0;
    const baseVy = config.vy || 0;
    const baseLife = config.life || 500;
    const baseSize = config.size || 2;
    const spreadX = spread.x || 0;
    const spreadY = spread.y || 0;
    const spreadVx = spread.vx || 0;
    const spreadVy = spread.vy || 0;
    const spreadLife = spread.life || 0;
    const spreadSize = spread.size || 0;

    for (let i = 0; i < adjustedCount; i++) {
      bc.x = config.x + (Math.random() - 0.5) * spreadX;
      bc.y = config.y + (Math.random() - 0.5) * spreadY;
      bc.vx = baseVx + (Math.random() - 0.5) * spreadVx;
      bc.vy = baseVy + (Math.random() - 0.5) * spreadVy;
      bc.life = baseLife + (Math.random() - 0.5) * spreadLife;
      bc.size = baseSize + (Math.random() - 0.5) * spreadSize;
      this.spawn(bc);
    }
  },

  /**
   * Spawn plunder effect - gold coin burst for Skull and Bones relic
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  spawnPlunderEffect(x, y) {
    // Gold coin burst - apply particle multiplier
    const particleCount = this.scaleCount(20, 5);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600 + Math.random() * 400,
        color: '#ffd700',
        secondaryColor: '#ff9900',
        size: 4 + Math.random() * 4,
        type: 'glow',
        drag: 0.96,
        gravity: 20
      });
    }

    // Central flash - large white glow (always spawn, marked essential)
    this.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 400,
      color: '#ffffff',
      size: 25,
      type: 'glow',
      decay: 0.7,
      essential: true
    });

    // Expanding ring shockwave (always spawn if LOD > 0)
    if (this.getLOD() >= 1) {
      this.spawn({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 500,
        color: '#ffd700',
        secondaryColor: '#ff9900',
        size: 15,
        type: 'ring'
      });
    }
  },

  /**
   * Update all active particles
   */
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const particle = this.active[i];

      if (!particle.update(dt)) {
        this.active.splice(i, 1);
        particle.reset();

        // Only return to pool if under target size
        if (this.pool.length < this.poolSize) {
          this.pool.push(particle);
        }
        // Otherwise particle is garbage collected (pool shrinking)
      }
    }
  },

  /**
   * Draw all active particles
   * Batched by type to reduce canvas state changes. The outer save/restore
   * per particle is eliminated - globalAlpha is set directly per particle
   * and inner draw methods handle their own save/restore for transforms.
   */
  // Pre-allocated type buckets to avoid per-frame allocation
  _typeBuckets: {
    glow: [], spark: [], trail: [], smoke: [],
    energy: [], debris: [], ring: [], flame: [], default: []
  },
  // Screen coordinate pairs stored alongside bucket entries
  _typeScreenX: {
    glow: [], spark: [], trail: [], smoke: [],
    energy: [], debris: [], ring: [], flame: [], default: []
  },
  _typeScreenY: {
    glow: [], spark: [], trail: [], smoke: [],
    energy: [], debris: [], ring: [], flame: [], default: []
  },

  draw(ctx, camera, viewportWidth, viewportHeight) {
    const margin = 50;
    const lod = this.getLOD();
    const buckets = this._typeBuckets;
    const bucketsX = this._typeScreenX;
    const bucketsY = this._typeScreenY;

    // Clear all buckets (reset length to avoid allocation)
    for (const key in buckets) {
      buckets[key].length = 0;
      bucketsX[key].length = 0;
      bucketsY[key].length = 0;
    }

    // Single pass: cull and sort particles into type buckets
    for (let i = 0; i < this.active.length; i++) {
      const particle = this.active[i];
      const screenX = particle.x - camera.x;
      const screenY = particle.y - camera.y;

      if (screenX < -margin || screenX > viewportWidth + margin ||
          screenY < -margin || screenY > viewportHeight + margin) {
        continue;
      }

      const bucket = buckets[particle.type] || buckets.default;
      const bucketX = bucketsX[particle.type] || bucketsX.default;
      const bucketY = bucketsY[particle.type] || bucketsY.default;
      bucket.push(particle);
      bucketX.push(screenX);
      bucketY.push(screenY);
    }

    // Save globalAlpha once before all particle drawing
    const savedAlpha = ctx.globalAlpha;

    // Draw each type group - common state is set once per group
    // Default particles: simple filled circles, sub-grouped by color
    this._drawDefaultBatch(ctx, buckets.default, bucketsX.default, bucketsY.default);

    // Glow particles
    this._drawTypeBatch(ctx, buckets.glow, bucketsX.glow, bucketsY.glow, 'glow', lod);

    // Spark particles: set shared lineCap once for the batch
    if (buckets.spark.length > 0) {
      ctx.lineCap = 'round';
      this._drawTypeBatch(ctx, buckets.spark, bucketsX.spark, bucketsY.spark, 'spark', lod);
    }

    // Trail particles
    this._drawTypeBatch(ctx, buckets.trail, bucketsX.trail, bucketsY.trail, 'trail', lod);

    // Smoke particles
    this._drawTypeBatch(ctx, buckets.smoke, bucketsX.smoke, bucketsY.smoke, 'smoke', lod);

    // Energy particles
    this._drawTypeBatch(ctx, buckets.energy, bucketsX.energy, bucketsY.energy, 'energy', lod);

    // Debris particles
    this._drawTypeBatch(ctx, buckets.debris, bucketsX.debris, bucketsY.debris, 'debris', lod);

    // Ring particles
    this._drawTypeBatch(ctx, buckets.ring, bucketsX.ring, bucketsY.ring, 'ring', lod);

    // Flame particles
    this._drawTypeBatch(ctx, buckets.flame, bucketsX.flame, bucketsY.flame, 'flame', lod);

    // Restore globalAlpha once after all particle drawing
    ctx.globalAlpha = savedAlpha;
  },

  /**
   * Draw a batch of default particles, sub-grouped by color
   * to minimize fillStyle changes
   * @private
   */
  _drawDefaultBatch(ctx, particles, screenXs, screenYs) {
    if (particles.length === 0) return;

    // Sort by color to minimize fillStyle switches
    // Build index array to sort without reordering the parallel arrays
    const len = particles.length;
    if (len === 1) {
      ctx.globalAlpha = particles[0].alpha;
      this.drawDefaultParticle(ctx, screenXs[0], screenYs[0], particles[0]);
      return;
    }

    let currentColor = null;
    // Sort particles by color using a simple approach for small batches
    // Build indices sorted by color
    const indices = this._getSortIndices(len);
    for (let i = 0; i < len; i++) indices[i] = i;
    indices.sort((a, b) => {
      if (particles[a].color < particles[b].color) return -1;
      if (particles[a].color > particles[b].color) return 1;
      return 0;
    });

    for (let i = 0; i < len; i++) {
      const idx = indices[i];
      const particle = particles[idx];
      ctx.globalAlpha = particle.alpha;
      if (particle.color !== currentColor) {
        currentColor = particle.color;
        ctx.fillStyle = currentColor;
      }
      ctx.beginPath();
      ctx.arc(screenXs[idx], screenYs[idx], particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Reusable index array for default batch sorting
   * @private
   */
  _sortIndices: [],
  _getSortIndices(len) {
    while (this._sortIndices.length < len) {
      this._sortIndices.push(0);
    }
    return this._sortIndices;
  },

  /**
   * Draw a batch of particles of a single type
   * @private
   */
  _drawTypeBatch(ctx, particles, screenXs, screenYs, type, lod) {
    if (particles.length === 0) return;

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      ctx.globalAlpha = particle.alpha;

      switch (type) {
        case 'glow':
          this.drawGlowParticle(ctx, screenXs[i], screenYs[i], particle, lod);
          break;
        case 'spark':
          this.drawSparkParticle(ctx, screenXs[i], screenYs[i], particle);
          break;
        case 'trail':
          this.drawTrailParticle(ctx, screenXs[i], screenYs[i], particle, lod);
          break;
        case 'smoke':
          this.drawSmokeParticle(ctx, screenXs[i], screenYs[i], particle, lod);
          break;
        case 'energy':
          this.drawEnergyParticle(ctx, screenXs[i], screenYs[i], particle, lod);
          break;
        case 'debris':
          this.drawDebrisParticle(ctx, screenXs[i], screenYs[i], particle);
          break;
        case 'ring':
          this.drawRingParticle(ctx, screenXs[i], screenYs[i], particle);
          break;
        case 'flame':
          this.drawFlameParticle(ctx, screenXs[i], screenYs[i], particle, lod);
          break;
      }
    }
  },

  drawDefaultParticle(ctx, x, y, particle) {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  },

  drawGlowParticle(ctx, x, y, particle, lod) {
    if (lod === 0) {
      // Minimal: solid circle only
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Bucket size to nearest 2px for cache key
    const sizeKey = Math.round(particle.size / 2) * 2 || 2;
    const outerR = sizeKey * 2;
    let gradient;

    if (typeof GradientCache !== 'undefined' && GradientCache._ctx) {
      const key = `p_glow_${sizeKey}_${particle.color}_${lod >= 3 ? 'h' : 'l'}`;
      const stops = lod >= 3
        ? [[0, particle.color], [0.5, particle.color + '80'], [1, 'transparent']]
        : [[0, particle.color], [1, 'transparent']];
      gradient = GradientCache.getRadial(key, 0, outerR, stops);
    } else {
      gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR);
      if (lod >= 3) {
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.5, particle.color + '80');
        gradient.addColorStop(1, 'transparent');
      } else {
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(1, 'transparent');
      }
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // White core only at LOD 2+
    if (lod >= 2) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, particle.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawSparkParticle(ctx, x, y, particle) {
    const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    const length = Math.min(particle.size * 3, speed * 0.1);
    const angle = Math.atan2(particle.vy, particle.vx);

    ctx.strokeStyle = particle.color;
    ctx.lineWidth = particle.size * 0.5;
    // lineCap is set once at batch level for spark particles
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
    ctx.lineTo(x + Math.cos(angle) * length * 0.3, y + Math.sin(angle) * length * 0.3);
    ctx.stroke();
  },

  drawTrailParticle(ctx, x, y, particle, lod) {
    if (lod === 0) {
      // Minimal: solid circle
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const sizeKey = Math.round(particle.size / 2) * 2 || 2;
    let gradient;

    if (typeof GradientCache !== 'undefined' && GradientCache._ctx) {
      const key = `p_trail_${sizeKey}_${particle.color}`;
      gradient = GradientCache.getRadial(key, 0, sizeKey, [
        [0, particle.color],
        [1, 'transparent']
      ]);
    } else {
      gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
      gradient.addColorStop(0, particle.color);
      gradient.addColorStop(1, 'transparent');
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawSmokeParticle(ctx, x, y, particle, lod) {
    // Expanding, fading smoke puff
    const lifeRatio = particle.life / particle.maxLife;
    const expandedSize = particle.size * (1.5 + (1 - lifeRatio) * 2);

    if (lod === 0) {
      // Minimal: simple circle with alpha
      ctx.fillStyle = particle.color + '40';
      ctx.beginPath();
      ctx.arc(x, y, expandedSize, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Bucket expanded size to nearest 2px for cache key
    const sizeKey = Math.round(expandedSize / 2) * 2 || 2;
    let gradient;

    if (typeof GradientCache !== 'undefined' && GradientCache._ctx) {
      const key = `p_smoke_${sizeKey}_${particle.color}`;
      gradient = GradientCache.getRadial(key, 0, sizeKey, [
        [0, particle.color + '60'],
        [0.5, particle.color + '30'],
        [1, 'transparent']
      ]);
    } else {
      gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, expandedSize);
      gradient.addColorStop(0, particle.color + '60');
      gradient.addColorStop(0.5, particle.color + '30');
      gradient.addColorStop(1, 'transparent');
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, expandedSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawEnergyParticle(ctx, x, y, particle, lod) {
    // Pulsing energy with inner core
    const pulseSize = particle.size * (0.8 + Math.sin(Date.now() * 0.01) * 0.2);

    if (lod === 0) {
      // Minimal: solid pulsing circle
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Bucket pulsing size to nearest 2px for cache key
    const sizeKey = Math.round(pulseSize / 2) * 2 || 2;
    const outerR = sizeKey * 2;
    let outerGradient;

    if (typeof GradientCache !== 'undefined' && GradientCache._ctx) {
      const key = `p_energy_${sizeKey}_${particle.color}_${lod >= 3 ? 'h' : 'l'}`;
      const stops = lod >= 3
        ? [[0, particle.color], [0.4, particle.color + '80'], [1, 'transparent']]
        : [[0, particle.color], [1, 'transparent']];
      outerGradient = GradientCache.getRadial(key, 0, outerR, stops);
    } else {
      outerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR);
      outerGradient.addColorStop(0, particle.color);
      if (lod >= 3) {
        outerGradient.addColorStop(0.4, particle.color + '80');
      }
      outerGradient.addColorStop(1, 'transparent');
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bright core
    if (lod >= 2) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, pulseSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawDebrisParticle(ctx, x, y, particle) {
    // Rotating angular debris chunk
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(particle.rotation);

    // Random angular shape based on size
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    const s = particle.size;
    ctx.moveTo(-s * 0.8, -s * 0.5);
    ctx.lineTo(s * 0.6, -s * 0.3);
    ctx.lineTo(s * 0.4, s * 0.6);
    ctx.lineTo(-s * 0.5, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Highlight edge
    if (particle.secondaryColor) {
      ctx.strokeStyle = particle.secondaryColor;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.restore();
  },

  drawRingParticle(ctx, x, y, particle) {
    // Expanding ring effect (shockwave)
    const lifeRatio = particle.life / particle.maxLife;
    const expandedSize = particle.size * (1 + (1 - lifeRatio) * 3);

    ctx.strokeStyle = particle.color;
    ctx.lineWidth = Math.max(0.5, particle.size * 0.3 * lifeRatio);
    ctx.beginPath();
    ctx.arc(x, y, expandedSize, 0, Math.PI * 2);
    ctx.stroke();

    // Optional inner ring for dual-ring effect (only at LOD 2+)
    if (particle.secondaryColor && lifeRatio > 0.3 && this.getLOD() >= 2) {
      ctx.strokeStyle = particle.secondaryColor;
      ctx.lineWidth = Math.max(0.3, particle.size * 0.2 * lifeRatio);
      ctx.beginPath();
      ctx.arc(x, y, expandedSize * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawFlameParticle(ctx, x, y, particle, lod) {
    // Flickering flame with color gradient
    const flicker = 0.8 + Math.random() * 0.4;
    const size = particle.size * flicker;

    if (lod === 0) {
      // Minimal: simple ellipse
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.7, size * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Bucket size to nearest 2px for cache key
    const sizeKey = Math.round(size / 2) * 2 || 2;
    const secondaryColor = particle.secondaryColor || '#ffff00';
    let outerGradient;

    if (typeof GradientCache !== 'undefined' && GradientCache._ctx) {
      // Flame gradient: offset center (0, size*0.3) to outer (0, 0) at size*1.5
      const key = `p_flame_${sizeKey}_${particle.color}_${secondaryColor}`;
      outerGradient = GradientCache.getRadial(key, 0, sizeKey * 1.5, [
        [0, secondaryColor],
        [0.4, particle.color],
        [1, 'transparent']
      ]);
    } else {
      outerGradient = ctx.createRadialGradient(0, size * 0.3, 0, 0, 0, size * 1.5);
      outerGradient.addColorStop(0, secondaryColor);
      outerGradient.addColorStop(0.4, particle.color);
      outerGradient.addColorStop(1, 'transparent');
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.7, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner bright core (only at LOD 2+)
    if (lod >= 2) {
      ctx.fillStyle = '#ffffff90';
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.2, size * 0.25, size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Get particle system statistics
   */
  getStats() {
    return {
      active: this.active.length,
      pooled: this.pool.length,
      total: this.active.length + this.pool.length,
      targetPoolSize: this.poolSize,
      multiplier: this.getParticleMultiplier().toFixed(2),
      lod: this.getLOD()
    };
  },

  /**
   * Clear all active particles
   */
  clear() {
    while (this.active.length > 0) {
      const particle = this.active.pop();
      particle.reset();
      if (this.pool.length < this.poolSize) {
        this.pool.push(particle);
      }
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
    this.clear();
    this.pool = [];
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.ParticleSystem = ParticleSystem;
}
