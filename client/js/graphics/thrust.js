/**
 * Thrust Renderer
 * Renders propulsion effects with intensity ramp-up and tier-based visuals
 */

const THRUST_CONFIG = {
  1: {
    plumeLength: 1.0,
    color: { inner: '#ffaa00', outer: '#ff6600', core: '#ffffff' },
    particleCount: 10,
    particleColor: '#ff6600',
    flickerIntensity: 0
  },
  2: {
    plumeLength: 1.2,
    color: { inner: '#ffcc00', outer: '#ff8800', core: '#ffffff' },
    particleCount: 15,
    particleColor: '#ff8800',
    flickerIntensity: 0.1
  },
  3: {
    plumeLength: 1.4,
    color: { inner: '#ffdd00', outer: '#ffaa00', core: '#ffffff' },
    particleCount: 20,
    particleColor: '#ffaa00',
    flickerIntensity: 0.15
  },
  4: {
    plumeLength: 1.6,
    color: { inner: '#ffee44', outer: '#ffcc00', core: '#ffffcc' },
    particleCount: 25,
    particleColor: '#ffcc44',
    flickerIntensity: 0.2,
    hasAfterburner: true
  },
  5: {
    plumeLength: 2.0,
    color: { inner: '#aaffff', outer: '#44ddff', core: '#ffffff' },
    particleCount: 30,
    particleColor: '#66eeff',
    flickerIntensity: 0.25,
    hasAfterburner: true,
    hasPlasmaTrail: true
  }
};

// Boost-specific visual configuration
const BOOST_CONFIG = {
  color: { inner: '#ffffff', outer: '#44ccff', core: '#ffffff' },
  plumeMultiplier: 2.5,
  particleMultiplier: 3,
  particleColor: '#88ddff',
  trailLength: 8,
  glowIntensity: 2.0
};

// Void-enhanced boost configuration (Subspace Warp Drive relic)
const VOID_BOOST_CONFIG = {
  color: { inner: '#9933ff', outer: '#660099', core: '#cc66ff' },
  plumeMultiplier: 3.0,
  particleMultiplier: 4,
  particleColor: '#9933ff',
  trailLength: 12,
  glowIntensity: 2.5,
  tunnelColor: { outer: '#330066', inner: '#000000', accent: '#9900ff' }
};

const ThrustRenderer = {
  particleAccumulator: 0,
  boostTrail: [], // Store recent positions for motion blur

  draw(ctx, position, rotation, velocity, camera, tier, intensity, dt, isBoosting = false) {
    if (intensity <= 0) return;

    // Quality-based LOD system for thrust rendering
    const quality = typeof GraphicsSettings !== 'undefined' ? GraphicsSettings.getQuality() : 80;

    // Skip all thrust visuals at very low quality
    if (quality < 5) return;

    // LOD levels: 0 = core only, 1 = +plume, 2 = +outer glow, 3 = +afterburner rings
    const lod = quality < 20 ? 0 : (quality < 50 ? 1 : (quality < 80 ? 2 : 3));

    const config = THRUST_CONFIG[tier] || THRUST_CONFIG[1];
    const size = CONSTANTS.SHIP_SIZE;

    // Use boost visuals when boosting (gated at quality 30+)
    if (isBoosting && quality >= 30) {
      this.drawBoostEffect(ctx, position, rotation, velocity, camera, tier, intensity, dt);
      return;
    } else if (isBoosting && quality < 30) {
      // At low quality, draw simpler thrust even when boosting
      // Fall through to normal thrust rendering
    }

    // Get exhaust position in world space
    const exhaustLocal = ShipGeometry.getExhaustPosition(tier);
    const exhaustWorld = {
      x: position.x + exhaustLocal.x * Math.cos(rotation) - exhaustLocal.y * Math.sin(rotation),
      y: position.y + exhaustLocal.x * Math.sin(rotation) + exhaustLocal.y * Math.cos(rotation)
    };

    // Screen position
    const screenX = exhaustWorld.x - camera.x;
    const screenY = exhaustWorld.y - camera.y;

    // Direction of thrust (opposite of ship facing)
    const thrustAngle = rotation + Math.PI;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(thrustAngle);

    // Calculate effective intensity with flicker
    const flicker = 1 - Math.random() * config.flickerIntensity;
    const effectiveIntensity = intensity * flicker;

    // LOD 0+: Core flame (always drawn at quality 5+)
    this.drawCore(ctx, size, config, effectiveIntensity);

    // LOD 1+: Main plume (quality 20+)
    if (lod >= 1) {
      this.drawPlume(ctx, size, config, effectiveIntensity);
    }

    // LOD 2+: Outer glow (quality 50+)
    if (lod >= 2) {
      this.drawOuterGlow(ctx, size, config, effectiveIntensity);
    }

    // LOD 3+: Afterburner rings (quality 80+, tier 4+)
    if (lod >= 3 && config.hasAfterburner && intensity > 0.6) {
      this.drawAfterburnerRings(ctx, size, config, effectiveIntensity);
    }

    ctx.restore();

    // Spawn thrust particles
    this.spawnParticles(exhaustWorld, velocity, thrustAngle, config, intensity, dt);
  },

  drawOuterGlow(ctx, size, config, intensity) {
    const glowRadius = size * config.plumeLength * 1.5;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    gradient.addColorStop(0, config.color.outer + '60');
    gradient.addColorStop(0.5, config.color.outer + '30');
    gradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = intensity * 0.6;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawPlume(ctx, size, config, intensity) {
    const length = size * config.plumeLength * intensity;
    const width = size * 0.4;

    const time = Date.now() * 0.01;
    const wave1 = Math.sin(time) * 0.1;
    const wave2 = Math.sin(time * 1.3) * 0.08;

    ctx.beginPath();
    ctx.moveTo(0, -width * 0.4);
    ctx.quadraticCurveTo(length * 0.5, -width * (0.3 + wave1), length, 0);
    ctx.quadraticCurveTo(length * 0.5, width * (0.3 + wave2), 0, width * 0.4);
    ctx.closePath();

    const plumeGradient = ctx.createLinearGradient(0, 0, length, 0);
    plumeGradient.addColorStop(0, config.color.inner);
    plumeGradient.addColorStop(0.3, config.color.outer);
    plumeGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = plumeGradient;
    ctx.fill();
  },

  drawCore(ctx, size, config, intensity) {
    const coreLength = size * config.plumeLength * 0.4 * intensity;
    const coreWidth = size * 0.2;

    ctx.beginPath();
    ctx.moveTo(0, -coreWidth * 0.3);
    ctx.quadraticCurveTo(coreLength * 0.5, -coreWidth * 0.15, coreLength, 0);
    ctx.quadraticCurveTo(coreLength * 0.5, coreWidth * 0.15, 0, coreWidth * 0.3);
    ctx.closePath();

    const coreGradient = ctx.createLinearGradient(0, 0, coreLength, 0);
    coreGradient.addColorStop(0, config.color.core);
    coreGradient.addColorStop(0.5, config.color.inner);
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.fill();
  },

  drawAfterburnerRings(ctx, size, config, intensity) {
    const ringCount = 3;
    const spacing = size * 0.3 * config.plumeLength;
    const time = Date.now() * 0.003;

    for (let i = 0; i < ringCount; i++) {
      const phase = (time + i * 0.4) % 1;
      const x = size * 0.3 + phase * spacing * 2;
      const radius = size * 0.15 * (1 - phase * 0.5);
      const alpha = (1 - phase) * intensity * 0.5;

      ctx.strokeStyle = config.color.inner;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(x, 0, radius, radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  spawnParticles(position, velocity, angle, config, intensity, dt) {
    // Check if thrust particles are enabled (quality 10+)
    if (typeof GraphicsSettings !== 'undefined' &&
        !GraphicsSettings.isFeatureEnabled('thrustParticles')) {
      return;
    }

    // Apply thrust trail length multiplier from graphics settings
    const trailMultiplier = typeof GraphicsSettings !== 'undefined'
      ? (GraphicsSettings.getThrustConfig().trailLength || 1.0)
      : 1.0;

    // Scale particle count with quality
    const particleMultiplier = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? ParticleSystem.getParticleMultiplier()
      : 1;
    const spawnRate = config.particleCount * intensity * trailMultiplier * particleMultiplier;
    this.particleAccumulator += spawnRate * dt;

    while (this.particleAccumulator >= 1) {
      this.particleAccumulator -= 1;

      const spreadAngle = angle + (Math.random() - 0.5) * 0.5;
      const speed = 50 + Math.random() * 100;
      const inheritVelocity = 0.3;

      ParticleSystem.spawn({
        x: position.x + (Math.random() - 0.5) * 5,
        y: position.y + (Math.random() - 0.5) * 5,
        vx: Math.cos(spreadAngle) * speed + velocity.x * inheritVelocity,
        vy: Math.sin(spreadAngle) * speed + velocity.y * inheritVelocity,
        life: 200 + Math.random() * 200,
        color: config.particleColor,
        size: 2 + Math.random() * 2,
        type: config.hasPlasmaTrail ? 'glow' : 'trail',
        drag: 0.98,
        decay: 1
      });
    }
  },

  drawBoostEffect(ctx, position, rotation, velocity, camera, tier, intensity, dt) {
    const baseConfig = THRUST_CONFIG[tier] || THRUST_CONFIG[1];
    const size = CONSTANTS.SHIP_SIZE;

    // Check for Subspace Warp Drive relic for void-enhanced visuals
    const hasVoidRelic = typeof Player !== 'undefined' && Player.hasRelic && Player.hasRelic('SUBSPACE_WARP_DRIVE');
    const boostConfig = hasVoidRelic ? VOID_BOOST_CONFIG : BOOST_CONFIG;

    // Get exhaust position in world space
    const exhaustLocal = ShipGeometry.getExhaustPosition(tier);
    const exhaustWorld = {
      x: position.x + exhaustLocal.x * Math.cos(rotation) - exhaustLocal.y * Math.sin(rotation),
      y: position.y + exhaustLocal.x * Math.sin(rotation) + exhaustLocal.y * Math.cos(rotation)
    };

    // Screen position
    const screenX = exhaustWorld.x - camera.x;
    const screenY = exhaustWorld.y - camera.y;

    // Direction of thrust (opposite of ship facing)
    const thrustAngle = rotation + Math.PI;

    // Store position for motion blur trail
    this.boostTrail.unshift({ x: screenX, y: screenY, angle: thrustAngle });
    if (this.boostTrail.length > boostConfig.trailLength) {
      this.boostTrail.pop();
    }

    // Draw void tunnel effect behind ship (if void relic)
    if (hasVoidRelic) {
      this.drawVoidTunnel(ctx, position, rotation, camera, size, intensity);
    }

    // Draw motion blur trail
    this.drawMotionBlurTrail(ctx, size, hasVoidRelic);

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(thrustAngle);

    // Draw intense boost glow
    this.drawBoostGlow(ctx, size, intensity, hasVoidRelic);

    // Draw extended boost plume
    this.drawBoostPlume(ctx, size, intensity, hasVoidRelic);

    // Draw boost core
    this.drawBoostCore(ctx, size, intensity, hasVoidRelic);

    // Draw energy rings
    this.drawBoostRings(ctx, size, intensity, hasVoidRelic);

    ctx.restore();

    // Spawn extra boost particles
    this.spawnBoostParticles(exhaustWorld, velocity, thrustAngle, intensity, dt, hasVoidRelic);
  },

  /**
   * Draw void tunnel effect around ship (subspace warp visual)
   */
  drawVoidTunnel(ctx, position, rotation, camera, size, intensity) {
    const screenX = position.x - camera.x;
    const screenY = position.y - camera.y;
    const tunnelLength = size * 4;
    const tunnelWidth = size * 1.5;
    const time = Date.now() * 0.003;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(rotation);

    // Outer dark tunnel edges
    ctx.globalAlpha = 0.3 * intensity;
    const outerGradient = ctx.createLinearGradient(-tunnelLength, 0, tunnelLength * 0.5, 0);
    outerGradient.addColorStop(0, 'transparent');
    outerGradient.addColorStop(0.3, VOID_BOOST_CONFIG.tunnelColor.outer);
    outerGradient.addColorStop(0.7, VOID_BOOST_CONFIG.tunnelColor.inner);
    outerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.ellipse(-tunnelLength * 0.3, 0, tunnelLength, tunnelWidth, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated void streaks
    ctx.globalAlpha = 0.5 * intensity;
    ctx.strokeStyle = VOID_BOOST_CONFIG.tunnelColor.accent;
    ctx.lineWidth = 2;

    for (let i = 0; i < 6; i++) {
      const streakPhase = (time + i * 0.3) % 1;
      const streakX = -tunnelLength * (1 - streakPhase);
      const streakY = (Math.sin(i * 1.5) * tunnelWidth * 0.6);
      const streakLength = tunnelLength * 0.3 * (1 - streakPhase * 0.5);

      ctx.globalAlpha = (1 - streakPhase) * 0.4 * intensity;
      ctx.beginPath();
      ctx.moveTo(streakX, streakY);
      ctx.lineTo(streakX + streakLength, streakY * 0.8);
      ctx.stroke();
    }

    // Central void energy
    ctx.globalAlpha = 0.2 * intensity;
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
    coreGradient.addColorStop(0, VOID_BOOST_CONFIG.tunnelColor.accent);
    coreGradient.addColorStop(0.5, VOID_BOOST_CONFIG.tunnelColor.outer + '80');
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  },

  drawMotionBlurTrail(ctx, size, isVoid = false) {
    if (this.boostTrail.length < 2) return;

    const config = isVoid ? VOID_BOOST_CONFIG : BOOST_CONFIG;
    const innerColor = isVoid ? '#9933ff' : '#88ddff';
    const outerColor = isVoid ? '#660099' : '#44aaff';

    for (let i = 1; i < this.boostTrail.length; i++) {
      const point = this.boostTrail[i];
      const alpha = (1 - i / this.boostTrail.length) * (isVoid ? 0.4 : 0.3);
      const trailSize = size * (1 - i / this.boostTrail.length) * 0.5;

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(point.angle);

      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, trailSize);
      gradient.addColorStop(0, innerColor);
      gradient.addColorStop(0.5, outerColor);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(trailSize * 0.5, 0, trailSize, trailSize * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  drawBoostGlow(ctx, size, intensity, isVoid = false) {
    const config = isVoid ? VOID_BOOST_CONFIG : BOOST_CONFIG;
    const glowRadius = size * config.plumeMultiplier * config.glowIntensity;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    if (isVoid) {
      gradient.addColorStop(0, 'rgba(153, 51, 255, 0.8)');
      gradient.addColorStop(0.3, 'rgba(102, 0, 153, 0.5)');
      gradient.addColorStop(0.6, 'rgba(51, 0, 102, 0.2)');
      gradient.addColorStop(1, 'transparent');
    } else {
      gradient.addColorStop(0, 'rgba(136, 221, 255, 0.8)');
      gradient.addColorStop(0.3, 'rgba(68, 170, 255, 0.5)');
      gradient.addColorStop(0.6, 'rgba(34, 136, 255, 0.2)');
      gradient.addColorStop(1, 'transparent');
    }

    ctx.globalAlpha = intensity;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawBoostPlume(ctx, size, intensity, isVoid = false) {
    const config = isVoid ? VOID_BOOST_CONFIG : BOOST_CONFIG;
    const length = size * config.plumeMultiplier * intensity;
    const width = size * 0.5;

    const time = Date.now() * 0.02;
    const wave1 = Math.sin(time) * 0.15;
    const wave2 = Math.sin(time * 1.5) * 0.1;

    ctx.beginPath();
    ctx.moveTo(0, -width * 0.5);
    ctx.quadraticCurveTo(length * 0.4, -width * (0.4 + wave1), length, 0);
    ctx.quadraticCurveTo(length * 0.4, width * (0.4 + wave2), 0, width * 0.5);
    ctx.closePath();

    const plumeGradient = ctx.createLinearGradient(0, 0, length, 0);
    if (isVoid) {
      plumeGradient.addColorStop(0, config.color.core);
      plumeGradient.addColorStop(0.2, config.color.inner);
      plumeGradient.addColorStop(0.5, config.color.outer);
      plumeGradient.addColorStop(1, 'transparent');
    } else {
      plumeGradient.addColorStop(0, config.color.inner);
      plumeGradient.addColorStop(0.2, config.color.outer);
      plumeGradient.addColorStop(0.5, '#2288ff');
      plumeGradient.addColorStop(1, 'transparent');
    }

    ctx.fillStyle = plumeGradient;
    ctx.fill();
  },

  drawBoostCore(ctx, size, intensity, isVoid = false) {
    const config = isVoid ? VOID_BOOST_CONFIG : BOOST_CONFIG;
    const coreLength = size * config.plumeMultiplier * 0.6 * intensity;
    const coreWidth = size * 0.25;

    ctx.beginPath();
    ctx.moveTo(0, -coreWidth * 0.4);
    ctx.quadraticCurveTo(coreLength * 0.5, -coreWidth * 0.2, coreLength, 0);
    ctx.quadraticCurveTo(coreLength * 0.5, coreWidth * 0.2, 0, coreWidth * 0.4);
    ctx.closePath();

    const coreGradient = ctx.createLinearGradient(0, 0, coreLength, 0);
    if (isVoid) {
      coreGradient.addColorStop(0, '#ffffff');
      coreGradient.addColorStop(0.3, config.color.core);
      coreGradient.addColorStop(0.6, config.color.inner);
      coreGradient.addColorStop(1, 'transparent');
    } else {
      coreGradient.addColorStop(0, '#ffffff');
      coreGradient.addColorStop(0.3, '#aaeeff');
      coreGradient.addColorStop(0.6, config.color.outer);
      coreGradient.addColorStop(1, 'transparent');
    }

    ctx.fillStyle = coreGradient;
    ctx.fill();
  },

  drawBoostRings(ctx, size, intensity, isVoid = false) {
    const config = isVoid ? VOID_BOOST_CONFIG : BOOST_CONFIG;
    const ringCount = 5;
    const spacing = size * config.plumeMultiplier * 0.3;
    const time = Date.now() * 0.005;
    const ringColor = isVoid ? '#9933ff' : '#88eeff';

    for (let i = 0; i < ringCount; i++) {
      const phase = (time + i * 0.2) % 1;
      const x = size * 0.2 + phase * spacing * 3;
      const radius = size * 0.2 * (1 - phase * 0.3);
      const alpha = (1 - phase) * intensity * 0.7;

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2 + (1 - phase) * 2;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(x, 0, radius, radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  spawnBoostParticles(position, velocity, angle, intensity, dt, isVoid = false) {
    // Check if thrust particles are enabled at current quality level
    if (typeof GraphicsSettings !== 'undefined' &&
        !GraphicsSettings.isFeatureEnabled('thrustParticles')) {
      return;
    }

    const config = isVoid ? VOID_BOOST_CONFIG : BOOST_CONFIG;

    // Apply thrust trail length multiplier from graphics settings
    const trailMultiplier = typeof GraphicsSettings !== 'undefined'
      ? (GraphicsSettings.getThrustConfig().trailLength || 1.0)
      : 1.0;

    // Apply particle multiplier from quality settings
    const particleMultiplier = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? ParticleSystem.getParticleMultiplier()
      : 1;

    const spawnRate = 60 * config.particleMultiplier * intensity * trailMultiplier * particleMultiplier;
    this.particleAccumulator += spawnRate * dt;

    while (this.particleAccumulator >= 1) {
      this.particleAccumulator -= 1;

      const spreadAngle = angle + (Math.random() - 0.5) * 0.8;
      const speed = 100 + Math.random() * 150;
      const inheritVelocity = 0.4;

      ParticleSystem.spawn({
        x: position.x + (Math.random() - 0.5) * 8,
        y: position.y + (Math.random() - 0.5) * 8,
        vx: Math.cos(spreadAngle) * speed + velocity.x * inheritVelocity,
        vy: Math.sin(spreadAngle) * speed + velocity.y * inheritVelocity,
        life: 300 + Math.random() * 300,
        color: config.particleColor,
        size: 3 + Math.random() * 3,
        type: 'glow',
        drag: 0.97,
        decay: 1
      });

      // Also spawn some bright core particles
      if (Math.random() < 0.3) {
        const coreColor = isVoid ? '#cc66ff' : '#ffffff';
        ParticleSystem.spawn({
          x: position.x + (Math.random() - 0.5) * 4,
          y: position.y + (Math.random() - 0.5) * 4,
          vx: Math.cos(angle) * (speed * 0.8) + velocity.x * inheritVelocity,
          vy: Math.sin(angle) * (speed * 0.8) + velocity.y * inheritVelocity,
          life: 200 + Math.random() * 200,
          color: coreColor,
          size: 2 + Math.random() * 2,
          type: 'glow',
          drag: 0.96,
          decay: 1.2
        });
      }
    }
  },

  // Clear boost trail when boost ends
  clearBoostTrail() {
    this.boostTrail = [];
  }
};
