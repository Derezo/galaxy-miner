/**
 * Hit Effect Renderer
 * Visual feedback for combat damage using ParticleSystem
 * Supports tier-specific impact effects
 */

const HitEffectRenderer = {
  // Colors for different hit types
  COLORS: {
    shield: {
      primary: '#00aaff',
      secondary: '#0066cc'
    },
    hull: {
      primary: '#ff6600',
      secondary: '#ff3300'
    }
  },

  // Tier-specific impact configurations
  TIER_CONFIG: {
    1: { // Simple spark burst
      particleMultiplier: 1,
      sizeMultiplier: 1,
      speedMultiplier: 1,
      hasRing: false,
      hasDebris: false,
      hasFlame: false
    },
    2: { // Dual ripple
      particleMultiplier: 1.3,
      sizeMultiplier: 1.1,
      speedMultiplier: 1.1,
      hasRing: true,
      ringCount: 1,
      hasDebris: false,
      hasFlame: false
    },
    3: { // Particle ring
      particleMultiplier: 1.6,
      sizeMultiplier: 1.2,
      speedMultiplier: 1.2,
      hasRing: true,
      ringCount: 2,
      hasDebris: true,
      debrisCount: 3,
      hasFlame: false
    },
    4: { // Surface fire trail
      particleMultiplier: 2,
      sizeMultiplier: 1.4,
      speedMultiplier: 1.3,
      hasRing: true,
      ringCount: 2,
      hasDebris: true,
      debrisCount: 5,
      hasFlame: true,
      flameCount: 4
    },
    5: { // Massive explosion
      particleMultiplier: 2.5,
      sizeMultiplier: 1.6,
      speedMultiplier: 1.5,
      hasRing: true,
      ringCount: 3,
      hasDebris: true,
      debrisCount: 8,
      hasFlame: true,
      flameCount: 8,
      hasShockwave: true
    }
  },

  /**
   * Create hit effect at position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {boolean} isShieldHit - True for shield hit, false for hull hit
   * @param {number} tier - Weapon tier (1-5), defaults to 1
   */
  addHit(x, y, isShieldHit, tier = 1) {
    const colors = isShieldHit ? this.COLORS.shield : this.COLORS.hull;
    const config = this.TIER_CONFIG[tier] || this.TIER_CONFIG[1];

    const baseParticleCount = isShieldHit ? 12 : 8;
    const particleCount = Math.floor(baseParticleCount * config.particleMultiplier);

    // Main burst of particles
    ParticleSystem.spawnBurst({
      x,
      y,
      color: colors.primary,
      size: (isShieldHit ? 4 : 3) * config.sizeMultiplier,
      life: (isShieldHit ? 400 : 500) * (1 + (tier - 1) * 0.1),
      decay: 1,
      drag: 0.95,
      type: isShieldHit ? 'glow' : 'spark'
    }, particleCount, {
      vx: 300 * config.speedMultiplier,
      vy: 300 * config.speedMultiplier,
      life: 200,
      size: 2 * config.sizeMultiplier
    });

    // Secondary particles
    ParticleSystem.spawnBurst({
      x,
      y,
      color: colors.secondary,
      size: 2 * config.sizeMultiplier,
      life: 300,
      decay: 1,
      drag: 0.92,
      type: 'default'
    }, Math.floor(particleCount / 2), {
      vx: 200 * config.speedMultiplier,
      vy: 200 * config.speedMultiplier,
      life: 100
    });

    // Tier 2+: Add expanding rings
    if (config.hasRing) {
      this.addImpactRings(x, y, colors.primary, config.ringCount, config.sizeMultiplier);
    }

    // Tier 3+: Add debris (hull hits only)
    if (config.hasDebris && !isShieldHit) {
      this.addDebrisParticles(x, y, config.debrisCount);
    }

    // Tier 4+: Add flames (hull hits only)
    if (config.hasFlame && !isShieldHit) {
      this.addFlameParticles(x, y, config.flameCount);
    }

    // Tier 5: Add shockwave
    if (config.hasShockwave) {
      this.addShockwave(x, y, colors.primary);
    }
  },

  /**
   * Add expanding ring particles
   */
  addImpactRings(x, y, color, count, sizeMultiplier) {
    for (let ring = 0; ring < count; ring++) {
      const delay = ring * 50; // Stagger rings
      const ringParticles = 12;
      const startSize = 8 + ring * 4;

      setTimeout(() => {
        ParticleSystem.spawn({
          x,
          y,
          vx: 0,
          vy: 0,
          color: color,
          secondaryColor: color + '60',
          size: startSize * sizeMultiplier,
          life: 250 + ring * 50,
          decay: 1,
          drag: 1,
          type: 'ring'
        });
      }, delay);
    }
  },

  /**
   * Add debris chunks for hull impacts
   */
  addDebrisParticles(x, y, count) {
    const debrisColors = ['#666666', '#888888', '#555555', '#777777'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;

      ParticleSystem.spawn({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
        secondaryColor: '#444444',
        size: 2 + Math.random() * 3,
        life: 500 + Math.random() * 400,
        decay: 0.9,
        drag: 0.98,
        type: 'debris',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 30 // Debris falls
      });
    }
  },

  /**
   * Add flame particles for heavy impacts
   */
  addFlameParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;

      ParticleSystem.spawn({
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20, // Flames rise
        color: '#ff6600',
        secondaryColor: '#ffff00',
        size: 4 + Math.random() * 4,
        life: 400 + Math.random() * 300,
        decay: 0.85,
        drag: 0.99,
        type: 'flame',
        gravity: -40 // Strong upward force
      });
    }
  },

  /**
   * Add shockwave effect for tier 5 impacts
   */
  addShockwave(x, y, color) {
    // Large expanding ring
    ParticleSystem.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      color: color,
      secondaryColor: '#ffffff',
      size: 30,
      life: 400,
      decay: 1,
      drag: 1,
      type: 'ring'
    });

    // Energy pulse particles moving outward
    const pulseCount = 16;
    for (let i = 0; i < pulseCount; i++) {
      const angle = (i / pulseCount) * Math.PI * 2;
      const speed = 200;

      ParticleSystem.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#ffffff',
        size: 3,
        life: 300,
        decay: 1.2,
        drag: 0.96,
        type: 'energy',
        pulse: true,
        pulseSpeed: 10
      });
    }
  },

  /**
   * Create shield ripple effect (larger visual for shield impacts)
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  addShieldRipple(x, y) {
    // Ring of particles moving outward
    const particleCount = 16;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 150;
      ParticleSystem.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: this.COLORS.shield.primary,
        size: 3,
        life: 300,
        decay: 1,
        drag: 0.98,
        type: 'glow'
      });
    }
  },

  /**
   * Create explosion effect for hull breaches
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  addHullBreach(x, y) {
    // Intense burst for critical hits
    ParticleSystem.spawnBurst({
      x,
      y,
      color: '#ff4400',
      size: 5,
      life: 600,
      decay: 1,
      drag: 0.93,
      type: 'glow'
    }, 15, {
      vx: 400,
      vy: 400,
      life: 300,
      size: 3
    });

    // Sparks
    ParticleSystem.spawnBurst({
      x,
      y,
      color: '#ffcc00',
      size: 2,
      life: 400,
      decay: 1,
      drag: 0.90,
      type: 'spark'
    }, 10, {
      vx: 500,
      vy: 500,
      life: 200
    });
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.HitEffectRenderer = HitEffectRenderer;
}
