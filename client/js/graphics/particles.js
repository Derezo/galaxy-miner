/**
 * Particle System with Object Pooling
 * Pre-allocates particles to avoid garbage collection during gameplay
 * Supports multiple particle types for varied visual effects
 */

// Quality settings for particle pool size
const PARTICLE_QUALITY = {
  low: 150,
  medium: 300,
  high: 500
};

// Default to high quality
let PARTICLE_POOL_SIZE = PARTICLE_QUALITY.high;

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
  quality: 'high',

  init(quality = 'high') {
    this.pool = [];
    this.active = [];
    this.quality = quality;

    const poolSize = PARTICLE_QUALITY[quality] || PARTICLE_QUALITY.high;
    PARTICLE_POOL_SIZE = poolSize;

    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new Particle());
    }

    console.log(`ParticleSystem initialized with ${poolSize} particles (${quality} quality)`);
  },

  /**
   * Set particle quality level (reallocates pool)
   * @param {string} quality - 'low', 'medium', or 'high'
   */
  setQuality(quality) {
    if (this.quality === quality) return;

    this.quality = quality;
    const newPoolSize = PARTICLE_QUALITY[quality] || PARTICLE_QUALITY.high;

    // If new pool is larger, add more particles
    if (newPoolSize > PARTICLE_POOL_SIZE) {
      const toAdd = newPoolSize - PARTICLE_POOL_SIZE;
      for (let i = 0; i < toAdd; i++) {
        this.pool.push(new Particle());
      }
    }
    // If smaller, particles will naturally be removed as they expire

    PARTICLE_POOL_SIZE = newPoolSize;
    console.log(`ParticleSystem quality set to ${quality} (${newPoolSize} particles)`);
  },

  spawn(config) {
    let particle = this.pool.pop();

    if (!particle) {
      if (this.active.length > 0) {
        particle = this.active.shift();
      } else {
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

  spawnBurst(config, count, spread = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        ...config,
        x: config.x + (Math.random() - 0.5) * (spread.x || 0),
        y: config.y + (Math.random() - 0.5) * (spread.y || 0),
        vx: (config.vx || 0) + (Math.random() - 0.5) * (spread.vx || 0),
        vy: (config.vy || 0) + (Math.random() - 0.5) * (spread.vy || 0),
        life: (config.life || 500) + (Math.random() - 0.5) * (spread.life || 0),
        size: (config.size || 2) + (Math.random() - 0.5) * (spread.size || 0)
      });
    }
  },

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const particle = this.active[i];

      if (!particle.update(dt)) {
        this.active.splice(i, 1);
        particle.reset();
        this.pool.push(particle);
      }
    }
  },

  draw(ctx, camera, viewportWidth, viewportHeight) {
    const margin = 50;

    for (const particle of this.active) {
      const screenX = particle.x - camera.x;
      const screenY = particle.y - camera.y;

      if (screenX < -margin || screenX > viewportWidth + margin ||
          screenY < -margin || screenY > viewportHeight + margin) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = particle.alpha;

      switch (particle.type) {
        case 'glow':
          this.drawGlowParticle(ctx, screenX, screenY, particle);
          break;
        case 'spark':
          this.drawSparkParticle(ctx, screenX, screenY, particle);
          break;
        case 'trail':
          this.drawTrailParticle(ctx, screenX, screenY, particle);
          break;
        case 'smoke':
          this.drawSmokeParticle(ctx, screenX, screenY, particle);
          break;
        case 'energy':
          this.drawEnergyParticle(ctx, screenX, screenY, particle);
          break;
        case 'debris':
          this.drawDebrisParticle(ctx, screenX, screenY, particle);
          break;
        case 'ring':
          this.drawRingParticle(ctx, screenX, screenY, particle);
          break;
        case 'flame':
          this.drawFlameParticle(ctx, screenX, screenY, particle);
          break;
        default:
          this.drawDefaultParticle(ctx, screenX, screenY, particle);
      }

      ctx.restore();
    }
  },

  drawDefaultParticle(ctx, x, y, particle) {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  },

  drawGlowParticle(ctx, x, y, particle) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size * 2);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.5, particle.color + '80');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, particle.size * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, particle.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawSparkParticle(ctx, x, y, particle) {
    const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    const length = Math.min(particle.size * 3, speed * 0.1);
    const angle = Math.atan2(particle.vy, particle.vx);

    ctx.strokeStyle = particle.color;
    ctx.lineWidth = particle.size * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
    ctx.lineTo(x + Math.cos(angle) * length * 0.3, y + Math.sin(angle) * length * 0.3);
    ctx.stroke();
  },

  drawTrailParticle(ctx, x, y, particle) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  },

  drawSmokeParticle(ctx, x, y, particle) {
    // Expanding, fading smoke puff
    const lifeRatio = particle.life / particle.maxLife;
    const expandedSize = particle.size * (1.5 + (1 - lifeRatio) * 2); // Expands over time

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, expandedSize);
    gradient.addColorStop(0, particle.color + '60');
    gradient.addColorStop(0.5, particle.color + '30');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, expandedSize, 0, Math.PI * 2);
    ctx.fill();
  },

  drawEnergyParticle(ctx, x, y, particle) {
    // Pulsing energy with inner core
    const pulseSize = particle.size * (0.8 + Math.sin(Date.now() * 0.01) * 0.2);

    // Outer glow
    const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, pulseSize * 2);
    outerGradient.addColorStop(0, particle.color);
    outerGradient.addColorStop(0.4, particle.color + '80');
    outerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(x, y, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();

    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, pulseSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
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
    const expandedSize = particle.size * (1 + (1 - lifeRatio) * 3); // Rapid expansion

    ctx.strokeStyle = particle.color;
    ctx.lineWidth = Math.max(0.5, particle.size * 0.3 * lifeRatio); // Thins as it expands
    ctx.beginPath();
    ctx.arc(x, y, expandedSize, 0, Math.PI * 2);
    ctx.stroke();

    // Optional inner ring for dual-ring effect
    if (particle.secondaryColor && lifeRatio > 0.3) {
      ctx.strokeStyle = particle.secondaryColor;
      ctx.lineWidth = Math.max(0.3, particle.size * 0.2 * lifeRatio);
      ctx.beginPath();
      ctx.arc(x, y, expandedSize * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawFlameParticle(ctx, x, y, particle) {
    // Flickering flame with color gradient
    const flicker = 0.8 + Math.random() * 0.4; // Random flicker
    const size = particle.size * flicker;

    // Outer orange/red
    const outerGradient = ctx.createRadialGradient(x, y + size * 0.3, 0, x, y, size * 1.5);
    outerGradient.addColorStop(0, particle.secondaryColor || '#ffff00');
    outerGradient.addColorStop(0.4, particle.color);
    outerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    // Flame shape - taller than wide
    ctx.ellipse(x, y, size * 0.7, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff90';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.2, size * 0.25, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  getStats() {
    return {
      active: this.active.length,
      pooled: this.pool.length,
      total: this.active.length + this.pool.length
    };
  },

  clear() {
    while (this.active.length > 0) {
      const particle = this.active.pop();
      particle.reset();
      this.pool.push(particle);
    }
  }
};
