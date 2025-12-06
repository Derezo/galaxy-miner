/**
 * Particle System with Object Pooling
 * Pre-allocates particles to avoid garbage collection during gameplay
 */

const PARTICLE_POOL_SIZE = 200;

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
    this.size = 2;
    this.alpha = 1;
    this.decay = 1;
    this.drag = 1;
    this.type = 'default';
  }

  update(dt) {
    if (!this.active) return false;

    this.life -= dt * 1000;
    if (this.life <= 0) {
      this.active = false;
      return false;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.alpha = Math.max(0, (this.life / this.maxLife) * this.decay);

    return true;
  }
}

const ParticleSystem = {
  pool: [],
  active: [],

  init() {
    this.pool = [];
    this.active = [];

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.pool.push(new Particle());
    }

    console.log(`ParticleSystem initialized with ${PARTICLE_POOL_SIZE} particles`);
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
    particle.size = config.size || 2;
    particle.decay = config.decay ?? 1;
    particle.drag = config.drag ?? 1;
    particle.type = config.type || 'default';
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
