/**
 * Hit Effect Renderer
 * Visual feedback for combat damage using ParticleSystem
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

  /**
   * Create hit effect at position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {boolean} isShieldHit - True for shield hit, false for hull hit
   */
  addHit(x, y, isShieldHit) {
    const colors = isShieldHit ? this.COLORS.shield : this.COLORS.hull;
    const particleCount = isShieldHit ? 12 : 8;

    // Spawn burst of particles
    ParticleSystem.spawnBurst({
      x,
      y,
      color: colors.primary,
      size: isShieldHit ? 4 : 3,
      life: isShieldHit ? 400 : 500,
      decay: 1,
      drag: 0.95,
      type: isShieldHit ? 'glow' : 'spark'
    }, particleCount, {
      vx: 300,
      vy: 300,
      life: 200,
      size: 2
    });

    // Add secondary particles for extra effect
    ParticleSystem.spawnBurst({
      x,
      y,
      color: colors.secondary,
      size: isShieldHit ? 2 : 2,
      life: 300,
      decay: 1,
      drag: 0.92,
      type: 'default'
    }, Math.floor(particleCount / 2), {
      vx: 200,
      vy: 200,
      life: 100
    });
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
