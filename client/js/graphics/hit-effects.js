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
    },
    tesla: {
      primary: '#00ccff',
      secondary: '#44ffaa',
      core: '#ffffff',
      glow: '#00ccff60'
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
    5: { // Tesla electrical discharge
      particleMultiplier: 2.5,
      sizeMultiplier: 1.6,
      speedMultiplier: 1.5,
      hasRing: true,
      ringCount: 3,
      hasDebris: true,
      debrisCount: 6,
      hasFlame: false,
      hasElectrical: true,
      electricalArcs: 6,
      hasShockwave: true
    }
  },

  /**
   * Scale a particle count with quality settings
   * @param {number} count - Base particle count
   * @param {number} floor - Minimum count
   * @returns {number} Scaled particle count
   */
  scaleCount(count, floor = 1) {
    if (typeof ParticleSystem !== 'undefined' && ParticleSystem.scaleCount) {
      return ParticleSystem.scaleCount(count, floor);
    }
    return count;
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
    const tierScaled = Math.floor(baseParticleCount * config.particleMultiplier);
    const particleCount = this.scaleCount(tierScaled, 2);

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

    // Tier 5 Tesla: Add electrical discharge
    if (config.hasElectrical) {
      this.addElectricalDischarge(x, y, config.electricalArcs);
    }

    // Tier 5: Add shockwave (use tesla colors for electrical)
    if (config.hasShockwave) {
      const shockwaveColor = config.hasElectrical ? this.COLORS.tesla.primary : colors.primary;
      this.addShockwave(x, y, shockwaveColor, config.hasElectrical);
    }
  },

  /**
   * Add expanding ring particles
   */
  addImpactRings(x, y, color, count, sizeMultiplier) {
    const scaledCount = this.scaleCount(count, 1);
    for (let ring = 0; ring < scaledCount; ring++) {
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
    const scaledCount = this.scaleCount(count, 1);

    for (let i = 0; i < scaledCount; i++) {
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
    const scaledCount = this.scaleCount(count, 1);
    for (let i = 0; i < scaledCount; i++) {
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
   * Add electrical discharge for Tesla weapon impacts
   */
  addElectricalDischarge(x, y, arcCount) {
    const teslaColors = this.COLORS.tesla;
    const scaledArcCount = this.scaleCount(arcCount, 2);

    // Central bright flash
    ParticleSystem.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      color: teslaColors.core,
      secondaryColor: teslaColors.primary,
      size: 20,
      life: 200,
      decay: 1.5,
      drag: 1,
      type: 'glow'
    });

    // Electrical arc particles shooting outward
    for (let i = 0; i < scaledArcCount; i++) {
      const angle = (i / scaledArcCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 150 + Math.random() * 100;

      // Main arc spark
      ParticleSystem.spawn({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: teslaColors.core,
        secondaryColor: teslaColors.primary,
        size: 3 + Math.random() * 2,
        life: 300 + Math.random() * 150,
        decay: 1.1,
        drag: 0.94,
        type: 'spark',
        pulse: true,
        pulseSpeed: 20
      });

      // Secondary glow trail
      ParticleSystem.spawn({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed * 0.8,
        vy: Math.sin(angle) * speed * 0.8,
        color: teslaColors.primary,
        secondaryColor: teslaColors.secondary,
        size: 5 + Math.random() * 3,
        life: 250,
        decay: 1.2,
        drag: 0.96,
        type: 'glow'
      });
    }

    // Expanding electrical ring
    ParticleSystem.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      color: teslaColors.primary,
      secondaryColor: teslaColors.glow,
      size: 15,
      life: 300,
      decay: 1,
      drag: 1,
      type: 'ring'
    });

    // Small crackling sparks around impact point
    const sparkCount = this.scaleCount(scaledArcCount * 2, 2);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 15;
      const speed = 50 + Math.random() * 80;

      ParticleSystem.spawn({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        color: teslaColors.secondary,
        size: 1.5 + Math.random() * 1.5,
        life: 150 + Math.random() * 100,
        decay: 1.3,
        drag: 0.92,
        type: 'spark'
      });
    }
  },

  /**
   * Add shockwave effect for tier 5 impacts
   */
  addShockwave(x, y, color, isElectrical = false) {
    // Large expanding ring
    ParticleSystem.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      color: color,
      secondaryColor: isElectrical ? this.COLORS.tesla.secondary : '#ffffff',
      size: 30,
      life: 400,
      decay: 1,
      drag: 1,
      type: 'ring'
    });

    // Energy pulse particles moving outward
    const basePulseCount = isElectrical ? 20 : 16;
    const pulseCount = this.scaleCount(basePulseCount, 4);
    for (let i = 0; i < pulseCount; i++) {
      const angle = (i / pulseCount) * Math.PI * 2;
      const speed = isElectrical ? 250 : 200;

      ParticleSystem.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: isElectrical ? this.COLORS.tesla.core : '#ffffff',
        secondaryColor: isElectrical ? this.COLORS.tesla.primary : null,
        size: isElectrical ? 4 : 3,
        life: isElectrical ? 350 : 300,
        decay: 1.2,
        drag: 0.96,
        type: isElectrical ? 'spark' : 'energy',
        pulse: true,
        pulseSpeed: isElectrical ? 15 : 10
      });
    }
  },

  /**
   * Create shield ripple effect (larger visual for shield impacts)
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  addShieldRipple(x, y) {
    // Check if shield ripples are enabled in graphics settings
    if (typeof GraphicsSettings !== 'undefined' &&
        !GraphicsSettings.isFeatureEnabled('shieldRipples')) {
      return;
    }

    // Ring of particles moving outward
    const particleCount = this.scaleCount(16, 4);
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
    }, this.scaleCount(15, 4), {
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
    }, this.scaleCount(10, 3), {
      vx: 500,
      vy: 500,
      life: 200
    });
  },

  /**
   * Create shield pierce effect - red crack/spark particles when damage bypasses shields
   * Used by pirate weapons that have 10% shield piercing
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} pierceDamage - Amount of damage that pierced (for scaling effect intensity)
   */
  addShieldPierceEffect(x, y, pierceDamage = 10) {
    // Validate coordinates to prevent NaN errors
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    // Calculate effect intensity based on pierce damage
    const intensity = Math.min(1, pierceDamage / 20);
    const baseCount = Math.floor(6 + intensity * 8);
    const particleCount = this.scaleCount(baseCount, 2);

    // Red/orange "crack" particles shooting through shield
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150 * (1 + intensity);

      // Main pierce sparks - red/orange to indicate hull damage through shields
      ParticleSystem.spawn({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#ff3300',
        secondaryColor: '#ff6600',
        size: 2 + Math.random() * 2,
        life: 300 + Math.random() * 200,
        decay: 1.1,
        drag: 0.95,
        type: 'spark'
      });
    }

    // Shield "crack" visual - jagged line particles
    const crackCount = this.scaleCount(3 + Math.floor(intensity * 4), 1);
    for (let i = 0; i < crackCount; i++) {
      const crackAngle = (i / crackCount) * Math.PI * 2 + Math.random() * 0.5;
      const crackLen = 15 + Math.random() * 25;

      // Crack origin point
      const crackX = x + Math.cos(crackAngle) * 5;
      const crackY = y + Math.sin(crackAngle) * 5;

      // Multiple segments along crack
      for (let seg = 0; seg < 3; seg++) {
        const segDist = crackLen * (seg / 3);
        const jitter = (Math.random() - 0.5) * 8;

        ParticleSystem.spawn({
          x: crackX + Math.cos(crackAngle) * segDist + Math.cos(crackAngle + Math.PI/2) * jitter,
          y: crackY + Math.sin(crackAngle) * segDist + Math.sin(crackAngle + Math.PI/2) * jitter,
          vx: Math.cos(crackAngle) * 30,
          vy: Math.sin(crackAngle) * 30,
          color: '#ff4400',
          secondaryColor: '#ffcc00',
          size: 3 - seg * 0.5,
          life: 200 + Math.random() * 100,
          decay: 1.2,
          drag: 0.98,
          type: 'glow'
        });
      }
    }

    // Central "breach point" glow
    ParticleSystem.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      color: '#ff2200',
      secondaryColor: '#ff6600',
      size: 10 + intensity * 8,
      life: 250,
      decay: 1.3,
      drag: 1,
      type: 'glow'
    });

    // Small orange sparks indicating hull taking damage
    const smallSparkCount = this.scaleCount(5, 1);
    for (let i = 0; i < smallSparkCount; i++) {
      const sparkAngle = Math.random() * Math.PI * 2;
      const sparkSpeed = 60 + Math.random() * 60;

      ParticleSystem.spawn({
        x,
        y,
        vx: Math.cos(sparkAngle) * sparkSpeed,
        vy: Math.sin(sparkAngle) * sparkSpeed,
        color: '#ffaa00',
        size: 1.5 + Math.random(),
        life: 200 + Math.random() * 150,
        decay: 1.1,
        drag: 0.93,
        type: 'spark'
      });
    }
  },

  /**
   * Create boost dive afterburner effect
   * Large fiery trail behind a boosting ship
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} rotation - Ship rotation in radians
   * @param {number} size - Ship size for scaling
   */
  addBoostAfterburner(x, y, rotation, size = 20) {
    // Validate coordinates to prevent NaN errors
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rotation)) return;

    // Calculate position behind ship
    const behindX = x - Math.cos(rotation) * size * 0.8;
    const behindY = y - Math.sin(rotation) * size * 0.8;

    // Main flame burst particles
    const flameCount = this.scaleCount(8, 2);
    for (let i = 0; i < flameCount; i++) {
      const spreadAngle = rotation + Math.PI + (Math.random() - 0.5) * 0.6;
      const speed = 150 + Math.random() * 100;

      ParticleSystem.spawn({
        x: behindX + (Math.random() - 0.5) * size * 0.3,
        y: behindY + (Math.random() - 0.5) * size * 0.3,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        color: '#ff6600',
        secondaryColor: '#ffff00',
        size: 5 + Math.random() * 4,
        life: 400 + Math.random() * 200,
        decay: 0.9,
        drag: 0.97,
        type: 'flame',
        gravity: 0
      });
    }

    // Bright white-hot core
    const coreCount = this.scaleCount(4, 1);
    for (let i = 0; i < coreCount; i++) {
      const coreAngle = rotation + Math.PI + (Math.random() - 0.5) * 0.3;
      const coreSpeed = 100 + Math.random() * 50;

      ParticleSystem.spawn({
        x: behindX,
        y: behindY,
        vx: Math.cos(coreAngle) * coreSpeed,
        vy: Math.sin(coreAngle) * coreSpeed,
        color: '#ffffff',
        secondaryColor: '#ffff88',
        size: 4 + Math.random() * 2,
        life: 200 + Math.random() * 100,
        decay: 1.1,
        drag: 0.98,
        type: 'glow'
      });
    }

    // Smoke trail
    const smokeCount = this.scaleCount(3, 1);
    for (let i = 0; i < smokeCount; i++) {
      const smokeAngle = rotation + Math.PI + (Math.random() - 0.5) * 0.8;
      const smokeSpeed = 80 + Math.random() * 40;

      ParticleSystem.spawn({
        x: behindX + (Math.random() - 0.5) * size * 0.5,
        y: behindY + (Math.random() - 0.5) * size * 0.5,
        vx: Math.cos(smokeAngle) * smokeSpeed,
        vy: Math.sin(smokeAngle) * smokeSpeed,
        color: '#666666',
        size: 6 + Math.random() * 4,
        life: 600 + Math.random() * 300,
        decay: 0.7,
        drag: 0.99,
        type: 'smoke'
      });
    }
  }
};

/**
 * Floating Text System
 * Displays floating text effects like "Invulnerable", damage numbers, etc.
 */
const FloatingTextSystem = {
  texts: [],

  /**
   * Add floating text at position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} text - Text to display
   * @param {object} options - { color, size, duration, rise, font }
   */
  add(x, y, text, options = {}) {
    // Check if floating text is enabled in graphics settings
    if (typeof GraphicsSettings !== 'undefined' &&
        GraphicsSettings.isFeatureEnabled('floatingText') === false) {
      return; // Skip floating text on low graphics
    }

    // Validate coordinates
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    this.texts.push({
      x,
      y,
      startY: y,
      text,
      color: options.color || '#ffffff',
      size: options.size || 16,
      font: options.font || 'bold',
      duration: options.duration || 1500,
      rise: options.rise !== undefined ? options.rise : 40,
      startTime: Date.now(),
      outline: options.outline !== undefined ? options.outline : true,
      outlineColor: options.outlineColor || '#000000',
      shake: options.shake || false,
      pulse: options.pulse || false
    });
  },

  /**
   * Add "Invulnerable" floating text for dreadnought
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  addInvulnerable(x, y) {
    this.add(x, y - 30, 'INVULNERABLE', {
      color: '#aaaaaa',
      size: 14,
      duration: 1200,
      rise: 30,
      outline: true,
      outlineColor: '#333333',
      pulse: true
    });
  },

  /**
   * Add damage number floating text
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} damage - Damage amount
   * @param {boolean} isCritical - Whether it's a critical hit
   */
  addDamageNumber(x, y, damage, isCritical = false) {
    this.add(x + (Math.random() - 0.5) * 20, y - 20, Math.floor(damage).toString(), {
      color: isCritical ? '#ff4400' : '#ffcc00',
      size: isCritical ? 20 : 14,
      duration: 1000,
      rise: 35,
      shake: isCritical
    });
  },

  /**
   * Add "Shield Pierced!" text
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  addShieldPierced(x, y) {
    this.add(x, y - 25, 'PIERCED!', {
      color: '#ff3300',
      size: 12,
      duration: 800,
      rise: 25,
      outline: true,
      outlineColor: '#440000'
    });
  },

  /**
   * Update all floating texts
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const now = Date.now();
    this.texts = this.texts.filter(text => {
      const elapsed = now - text.startTime;
      return elapsed < text.duration;
    });
  },

  /**
   * Draw all floating texts
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera - Camera position { x, y }
   */
  draw(ctx, camera) {
    const now = Date.now();

    for (const text of this.texts) {
      const elapsed = now - text.startTime;
      const progress = elapsed / text.duration;

      // Validate text position
      if (!Number.isFinite(text.x) || !Number.isFinite(text.startY)) continue;

      // Calculate position with rise animation
      let screenX = text.x - camera.x;
      let screenY = text.startY - camera.y - (text.rise * progress);

      // Add shake effect if enabled
      if (text.shake && progress < 0.3) {
        screenX += (Math.random() - 0.5) * 4;
        screenY += (Math.random() - 0.5) * 4;
      }

      // Calculate alpha (fade out in last 30%)
      let alpha = 1;
      if (progress > 0.7) {
        alpha = 1 - ((progress - 0.7) / 0.3);
      }

      // Calculate size with pulse if enabled
      let size = text.size;
      if (text.pulse) {
        size = text.size * (1 + Math.sin(elapsed * 0.01) * 0.1);
      }

      // Scale up slightly at start
      if (progress < 0.1) {
        size = text.size * (0.5 + progress * 5);
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${text.font} ${Math.floor(size)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw outline if enabled
      if (text.outline) {
        ctx.strokeStyle = text.outlineColor;
        ctx.lineWidth = 3;
        ctx.strokeText(text.text, screenX, screenY);
      }

      // Draw main text
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, screenX, screenY);

      ctx.restore();
    }
  },

  /**
   * Clear all floating texts
   */
  clear() {
    this.texts = [];
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.HitEffectRenderer = HitEffectRenderer;
  window.FloatingTextSystem = FloatingTextSystem;
}
