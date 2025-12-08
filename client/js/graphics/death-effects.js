/**
 * Death Effect Variations for NPC Factions
 * Each faction has a distinct death animation
 *
 * explosion: Pirates - fiery explosion with debris
 * break_apart: Scavengers - ship breaks into chunks
 * dissolve: Swarm - organic dissolution
 * implode: Void - dark implosion with singularity
 * industrial_explosion: Rogue Miners - sparks and industrial debris
 */

const DeathEffects = {
  // Active death effects
  activeEffects: [],

  // Effect configurations per type
  EFFECT_CONFIGS: {
    explosion: {
      particles: 30,
      colors: ['#ff3300', '#ff6600', '#ffcc00', '#ff8800'],
      duration: 800,
      shockwave: true,
      shockwaveColor: '#ff660040',
      debrisCount: 5,
      particleSpeed: 200,
      particleSize: { min: 3, max: 8 }
    },
    break_apart: {
      particles: 20,
      colors: ['#666666', '#999999', '#888888', '#777777'],
      duration: 1200,
      debrisCount: 8,
      debrisRotation: true,
      particleSpeed: 100,
      particleSize: { min: 4, max: 12 }
    },
    dissolve: {
      particles: 50,
      colors: ['#1a1a1a', '#8b0000', '#990000', '#660000'],
      duration: 1000,
      fadeOut: true,
      particleSpeed: 80,
      particleSize: { min: 2, max: 5 },
      glow: true,
      glowColor: '#8b000080'
    },
    implode: {
      particles: 40,
      colors: ['#9900ff', '#660099', '#000000', '#cc66ff'],
      duration: 600,
      inward: true,
      singularity: true,
      singularityDuration: 400,
      particleSpeed: 150,
      particleSize: { min: 2, max: 6 }
    },
    industrial_explosion: {
      particles: 35,
      colors: ['#ff9900', '#ffcc00', '#996600', '#ffaa33'],
      duration: 900,
      sparks: true,
      sparkCount: 15,
      debrisCount: 4,
      particleSpeed: 180,
      particleSize: { min: 3, max: 7 }
    }
  },

  init() {
    Logger.log('DeathEffects initialized');
  },

  /**
   * Trigger a death effect at position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} effectType - Type of death effect
   * @param {string} faction - Faction for color theming (optional)
   */
  trigger(x, y, effectType, faction = null) {
    const config = this.EFFECT_CONFIGS[effectType] || this.EFFECT_CONFIGS.explosion;

    const effect = {
      x,
      y,
      type: effectType,
      config,
      startTime: Date.now(),
      particles: [],
      debris: [],
      sparks: [],
      phase: 'active',
      shockwaveRadius: 0
    };

    // Generate particles
    this.generateParticles(effect);

    // Generate debris if applicable
    if (config.debrisCount) {
      this.generateDebris(effect);
    }

    // Generate sparks if applicable
    if (config.sparks) {
      this.generateSparks(effect);
    }

    this.activeEffects.push(effect);
  },

  generateParticles(effect) {
    const config = effect.config;
    const isInward = config.inward;

    for (let i = 0; i < config.particles; i++) {
      const angle = (Math.PI * 2 * i) / config.particles + Math.random() * 0.5;
      const speed = config.particleSpeed * (0.5 + Math.random() * 0.5);
      const size = config.particleSize.min +
        Math.random() * (config.particleSize.max - config.particleSize.min);

      // For implode, particles start outside and move inward
      const startDist = isInward ? 50 + Math.random() * 30 : 0;

      effect.particles.push({
        x: effect.x + (isInward ? Math.cos(angle) * startDist : 0),
        y: effect.y + (isInward ? Math.sin(angle) * startDist : 0),
        vx: Math.cos(angle) * speed * (isInward ? -1 : 1),
        vy: Math.sin(angle) * speed * (isInward ? -1 : 1),
        size,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2
      });
    }
  },

  generateDebris(effect) {
    const config = effect.config;

    for (let i = 0; i < config.debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / config.debrisCount + Math.random() * 0.3;
      const speed = config.particleSpeed * 0.4;
      const size = 8 + Math.random() * 12;

      effect.debris.push({
        x: effect.x,
        y: effect.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color: config.colors[0],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 5,
        alpha: 1
      });
    }
  },

  generateSparks(effect) {
    const config = effect.config;

    for (let i = 0; i < (config.sparkCount || 10); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 100;

      effect.sparks.push({
        x: effect.x,
        y: effect.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 5 + Math.random() * 10,
        alpha: 1,
        color: '#ffff00'
      });
    }
  },

  /**
   * Update all active effects
   */
  update(dt) {
    const now = Date.now();

    this.activeEffects = this.activeEffects.filter(effect => {
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.config.duration;

      if (progress >= 1) {
        return false; // Remove completed effect
      }

      // Update particles
      for (const p of effect.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Apply drag
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Fade out
        if (effect.config.fadeOut) {
          p.alpha = 1 - progress;
        } else {
          p.alpha = Math.max(0, 1 - progress * 1.5);
        }
      }

      // Update debris
      for (const d of effect.debris) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.96;
        d.vy *= 0.96;
        d.rotation += d.rotationSpeed * dt;
        d.alpha = Math.max(0, 1 - progress * 0.8);
      }

      // Update sparks
      for (const s of effect.sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.alpha = Math.max(0, 1 - progress * 2);
      }

      // Update shockwave
      if (effect.config.shockwave) {
        effect.shockwaveRadius = progress * 100;
      }

      return true;
    });
  },

  /**
   * Draw all active effects
   */
  draw(ctx, camera) {
    for (const effect of this.activeEffects) {
      const screenX = effect.x - camera.x;
      const screenY = effect.y - camera.y;
      const elapsed = Date.now() - effect.startTime;
      const progress = elapsed / effect.config.duration;

      ctx.save();

      // Draw shockwave
      if (effect.config.shockwave && effect.shockwaveRadius > 0) {
        ctx.strokeStyle = effect.config.shockwaveColor || '#ffffff40';
        ctx.lineWidth = 3 * (1 - progress);
        ctx.globalAlpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(screenX, screenY, effect.shockwaveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw singularity for implode
      if (effect.config.singularity && progress < 0.7) {
        const singularityProgress = progress / 0.7;
        const singularityRadius = 20 * (1 - singularityProgress);

        const gradient = ctx.createRadialGradient(
          screenX, screenY, 0,
          screenX, screenY, singularityRadius
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#330066');
        gradient.addColorStop(1, 'transparent');

        ctx.globalAlpha = 1 - singularityProgress;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, singularityRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw glow
      if (effect.config.glow) {
        const glowRadius = 40 * (1 - progress * 0.5);
        const gradient = ctx.createRadialGradient(
          screenX, screenY, 0,
          screenX, screenY, glowRadius
        );
        gradient.addColorStop(0, effect.config.glowColor || '#ffffff80');
        gradient.addColorStop(1, 'transparent');

        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw debris
      for (const d of effect.debris) {
        const dx = d.x - camera.x;
        const dy = d.y - camera.y;

        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(d.rotation);
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = d.color;

        // Draw irregular polygon for debris
        ctx.beginPath();
        const points = 5;
        for (let i = 0; i < points; i++) {
          const angle = (Math.PI * 2 * i) / points;
          const r = d.size * (0.5 + Math.random() * 0.5);
          if (i === 0) {
            ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          } else {
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw particles
      for (const p of effect.particles) {
        const px = p.x - camera.x;
        const py = p.y - camera.y;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw sparks
      for (const s of effect.sparks) {
        const sx = s.x - camera.x;
        const sy = s.y - camera.y;
        const angle = Math.atan2(s.vy, s.vx);

        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx - Math.cos(angle) * s.length,
          sy - Math.sin(angle) * s.length
        );
        ctx.stroke();
      }

      ctx.restore();
    }
  },

  /**
   * Get effect type for a faction
   */
  getEffectForFaction(faction) {
    const factionEffects = {
      pirate: 'explosion',
      scavenger: 'break_apart',
      swarm: 'dissolve',
      void: 'implode',
      rogue_miner: 'industrial_explosion'
    };
    return factionEffects[faction] || 'explosion';
  }
};
