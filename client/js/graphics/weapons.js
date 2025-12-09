/**
 * Weapon Renderer
 * Renders weapon effects with 5 tier types
 */

const WEAPON_CONFIG = {
  1: {
    type: 'burst',
    color: { primary: '#00ffff', secondary: '#ffffff', glow: '#00ffff60' },
    length: 50, width: 4, speed: 1500, duration: 120, particleCount: 5,
    muzzle: { size: 12, duration: 60, type: 'flash' },
    trail: { length: 30, frequency: 0.4, size: 1.5 }
  },
  2: {
    type: 'dual',
    color: { primary: '#44ffff', secondary: '#ffffff', glow: '#44ffff60' },
    length: 55, width: 4, speed: 1600, duration: 130, separation: 8, particleCount: 8,
    muzzle: { size: 15, duration: 70, type: 'dual' },
    trail: { length: 40, frequency: 0.5, size: 1.8 }
  },
  3: {
    type: 'pulse',
    color: { primary: '#88ff44', secondary: '#ffffff', glow: '#88ff4480' },
    size: 8, speed: 1200, duration: 300, particleCount: 12, hasExplosion: true,
    muzzle: { size: 20, duration: 90, type: 'ring' },
    trail: { length: 50, frequency: 0.6, size: 2.2, type: 'energy' }
  },
  4: {
    type: 'beam',
    color: { primary: '#ff8844', secondary: '#ffdd88', glow: '#ff884480' },
    width: 6, maxRange: 400, duration: 200, particleCount: 10,
    muzzle: { size: 25, duration: 100, type: 'heat' },
    trail: { length: 60, frequency: 0.7, size: 2.5, type: 'smoke', smokeColor: '#ff660030' }
  },
  5: {
    type: 'tesla',
    color: { primary: '#00ccff', secondary: '#44ffaa', glow: '#00ccff60', core: '#ffffff' },
    size: 14, speed: 900, duration: 450, particleCount: 25, hasExplosion: true, trailWidth: 6,
    muzzle: { size: 40, duration: 150, type: 'teslaArc' },
    trail: { length: 70, frequency: 0.85, size: 3.5, type: 'electrical', sparkCount: 4 }
  }
};

class WeaponProjectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx;
    this.vy = config.vy;
    this.rotation = config.rotation;
    this.tier = config.tier;
    this.life = config.life;
    this.maxLife = config.life;
    this.active = true;
    this.config = WEAPON_CONFIG[config.tier] || WEAPON_CONFIG[1];
    // Target tracking for hit effects
    this.target = config.target || null;
    this.hitInfo = config.hitInfo || null;
    this.hitTriggered = false;
  }

  update(dt) {
    if (!this.active) return false;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt * 1000;

    // Check if we've reached a target
    if (this.target && !this.hitTriggered) {
      const dx = this.x - this.target.x;
      const dy = this.y - this.target.y;
      const distToTarget = Math.sqrt(dx * dx + dy * dy);

      if (distToTarget < 25) { // Hit radius
        this.hitTriggered = true;
        // Trigger hit effect at target
        if (this.hitInfo && typeof HitEffectRenderer !== 'undefined') {
          HitEffectRenderer.addHit(this.target.x, this.target.y, this.hitInfo.isShieldHit);
        }
        this.active = false;
        return false;
      }
    }

    if (this.life <= 0) {
      this.active = false;
      return false;
    }

    return true;
  }
}

const WeaponRenderer = {
  projectiles: [],
  muzzleFlashes: [],
  activeBeams: [],
  pendingHits: [], // Queue of confirmed hits waiting to be matched with projectiles

  fire(position, rotation, tier, visualTier) {
    visualTier = visualTier || 1;
    const config = WEAPON_CONFIG[tier] || WEAPON_CONFIG[1];

    const noseOffset = ShipGeometry.getNosePosition(visualTier);
    const muzzleX = position.x + noseOffset.x * Math.cos(rotation) - noseOffset.y * Math.sin(rotation);
    const muzzleY = position.y + noseOffset.x * Math.sin(rotation) + noseOffset.y * Math.cos(rotation);

    const muzzleConfig = config.muzzle || { size: 15, duration: 80, type: 'flash' };
    this.muzzleFlashes.push({
      x: muzzleX,
      y: muzzleY,
      rotation: rotation,
      startTime: Date.now(),
      duration: muzzleConfig.duration,
      tier: tier,
      color: config.color.primary,
      secondaryColor: config.color.secondary,
      glowColor: config.color.glow,
      size: muzzleConfig.size,
      type: muzzleConfig.type
    });

    switch (config.type) {
      case 'burst':
      case 'dual':
        this.fireBurstLaser(muzzleX, muzzleY, rotation, tier, config);
        break;
      case 'pulse':
      case 'plasma':
      case 'tesla':
        this.fireProjectile(muzzleX, muzzleY, rotation, tier, config);
        break;
      case 'beam':
        this.fireBeam(muzzleX, muzzleY, rotation, tier, config);
        break;
    }
  },

  fireBurstLaser(x, y, rotation, tier, config) {
    const speed = config.speed;
    const vx = Math.cos(rotation) * speed;
    const vy = Math.sin(rotation) * speed;

    if (config.type === 'dual') {
      const perpX = Math.cos(rotation + Math.PI / 2);
      const perpY = Math.sin(rotation + Math.PI / 2);
      const sep = config.separation / 2;

      this.projectiles.push(new WeaponProjectile({ x: x + perpX * sep, y: y + perpY * sep, vx, vy, rotation, tier, life: config.duration }));
      this.projectiles.push(new WeaponProjectile({ x: x - perpX * sep, y: y - perpY * sep, vx, vy, rotation, tier, life: config.duration }));
    } else {
      this.projectiles.push(new WeaponProjectile({ x, y, vx, vy, rotation, tier, life: config.duration }));
    }
  },

  fireProjectile(x, y, rotation, tier, config) {
    const speed = config.speed;
    const vx = Math.cos(rotation) * speed;
    const vy = Math.sin(rotation) * speed;

    this.projectiles.push(new WeaponProjectile({ x, y, vx, vy, rotation, tier, life: config.duration }));
  },

  fireBeam(x, y, rotation, tier, config) {
    this.activeBeams.push({
      x, y, rotation,
      startTime: Date.now(),
      duration: config.duration,
      tier: tier,
      config: config
    });
  },

  update(dt) {
    const now = Date.now();

    // Try to assign pending hits to active projectiles
    this.processPendingHits();

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];

      if (!proj.update(dt)) {
        if (proj.config.hasExplosion && !proj.hitTriggered) {
          this.createExplosion(proj.x, proj.y, proj.tier, proj.config);
        }
        this.projectiles.splice(i, 1);
      } else {
        this.spawnTrailParticle(proj, dt);
      }
    }

    this.activeBeams = this.activeBeams.filter(beam => now - beam.startTime < beam.duration);
    this.muzzleFlashes = this.muzzleFlashes.filter(flash => now - flash.startTime < flash.duration);

    // Clean up old pending hits (timeout after 500ms)
    this.pendingHits = this.pendingHits.filter(hit => now - hit.timestamp < 500);
  },

  /**
   * Register a confirmed hit to be matched with a projectile
   * Called when server confirms a hit on NPC or player
   */
  registerHit(targetX, targetY, hitInfo) {
    this.pendingHits.push({
      x: targetX,
      y: targetY,
      hitInfo: hitInfo,
      timestamp: Date.now(),
      assigned: false
    });
  },

  /**
   * Assign pending hits to nearby projectiles heading toward them
   */
  processPendingHits() {
    for (const hit of this.pendingHits) {
      if (hit.assigned) continue;

      // Find the closest projectile heading toward this target
      let bestProj = null;
      let bestScore = Infinity;

      for (const proj of this.projectiles) {
        if (proj.target) continue; // Already has a target

        // Calculate distance to target
        const dx = hit.x - proj.x;
        const dy = hit.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if projectile is heading roughly toward the target
        const projDir = Math.atan2(proj.vy, proj.vx);
        const targetDir = Math.atan2(dy, dx);
        let angleDiff = Math.abs(projDir - targetDir);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        // Score based on distance and angle alignment
        if (angleDiff < Math.PI / 4 && dist < 500) { // Within 45 degrees and 500 units
          const score = dist + angleDiff * 100;
          if (score < bestScore) {
            bestScore = score;
            bestProj = proj;
          }
        }
      }

      if (bestProj) {
        bestProj.target = { x: hit.x, y: hit.y };
        bestProj.hitInfo = hit.hitInfo;
        hit.assigned = true;
      }
    }
  },

  draw(ctx, camera) {
    for (const beam of this.activeBeams) {
      this.drawBeam(ctx, beam, camera);
    }

    for (const proj of this.projectiles) {
      this.drawProjectile(ctx, proj, camera);
    }

    for (const flash of this.muzzleFlashes) {
      this.drawMuzzleFlash(ctx, flash, camera);
    }
  },

  drawProjectile(ctx, proj, camera) {
    const screenX = proj.x - camera.x;
    const screenY = proj.y - camera.y;
    const config = proj.config;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(proj.rotation);

    switch (config.type) {
      case 'burst':
      case 'dual':
        this.drawLaserBeam(ctx, config);
        break;
      case 'pulse':
        this.drawPulseOrb(ctx, config);
        break;
      case 'plasma':
        this.drawPlasmaBolt(ctx, config);
        break;
      case 'tesla':
        this.drawTeslaBolt(ctx, config);
        break;
    }

    ctx.restore();
  },

  drawLaserBeam(ctx, config) {
    const length = config.length;
    const width = config.width;

    const glowGradient = ctx.createLinearGradient(-length, 0, 0, 0);
    glowGradient.addColorStop(0, 'transparent');
    glowGradient.addColorStop(0.3, config.color.glow);
    glowGradient.addColorStop(1, config.color.glow);

    ctx.strokeStyle = glowGradient;
    ctx.lineWidth = width * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-length, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    const beamGradient = ctx.createLinearGradient(-length, 0, 0, 0);
    beamGradient.addColorStop(0, 'transparent');
    beamGradient.addColorStop(0.2, config.color.primary);
    beamGradient.addColorStop(1, config.color.secondary);

    ctx.strokeStyle = beamGradient;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(-length, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
  },

  drawPulseOrb(ctx, config) {
    const size = config.size;
    const pulse = 1 + Math.sin(Date.now() * 0.02) * 0.2;

    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2 * pulse);
    glowGradient.addColorStop(0, config.color.primary);
    glowGradient.addColorStop(0.5, config.color.glow);
    glowGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = config.color.secondary;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPlasmaBolt(ctx, config) {
    const size = config.size;
    const pulse = 1 + Math.sin(Date.now() * 0.03) * 0.15;

    const plasmaGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5 * pulse);
    plasmaGradient.addColorStop(0, config.color.secondary);
    plasmaGradient.addColorStop(0.3, config.color.primary);
    plasmaGradient.addColorStop(0.6, config.color.glow);
    plasmaGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = plasmaGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    const trailGradient = ctx.createLinearGradient(-size * 4, 0, 0, 0);
    trailGradient.addColorStop(0, 'transparent');
    trailGradient.addColorStop(0.5, config.color.glow);
    trailGradient.addColorStop(1, config.color.primary);

    ctx.strokeStyle = trailGradient;
    ctx.lineWidth = config.trailWidth || 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 4, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.fillStyle = config.color.secondary;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  },

  drawTeslaBolt(ctx, config) {
    const size = config.size;
    const time = Date.now();
    const pulse = 1 + Math.sin(time * 0.04) * 0.2;

    // Outer glow layer
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5 * pulse);
    glowGradient.addColorStop(0, config.color.core || '#ffffff');
    glowGradient.addColorStop(0.2, config.color.secondary);
    glowGradient.addColorStop(0.5, config.color.primary);
    glowGradient.addColorStop(0.8, config.color.glow);
    glowGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Crackling surface lightning
    const arcCount = 6;
    ctx.strokeStyle = config.color.core || '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    for (let i = 0; i < arcCount; i++) {
      const baseAngle = (i / arcCount) * Math.PI * 2 + time * 0.008;
      const arcLength = size * (0.8 + Math.random() * 0.4);

      ctx.beginPath();
      ctx.moveTo(
        Math.cos(baseAngle) * size * 0.3,
        Math.sin(baseAngle) * size * 0.3
      );

      // Jagged lightning path
      const segments = 3;
      for (let j = 1; j <= segments; j++) {
        const progress = j / segments;
        const jitter = (Math.random() - 0.5) * size * 0.4;
        const angle = baseAngle + jitter * 0.1;
        ctx.lineTo(
          Math.cos(angle) * arcLength * progress + jitter * 0.3,
          Math.sin(angle) * arcLength * progress + jitter * 0.3
        );
      }
      ctx.stroke();
    }

    // Orbiting spark particles
    const sparkCount = 4;
    for (let i = 0; i < sparkCount; i++) {
      const orbitAngle = time * 0.015 + (i / sparkCount) * Math.PI * 2;
      const orbitRadius = size * (1.2 + Math.sin(time * 0.02 + i) * 0.3);
      const sparkX = Math.cos(orbitAngle) * orbitRadius;
      const sparkY = Math.sin(orbitAngle) * orbitRadius;
      const sparkSize = 2 + Math.random() * 2;

      const sparkGradient = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, sparkSize * 2);
      sparkGradient.addColorStop(0, config.color.core || '#ffffff');
      sparkGradient.addColorStop(0.5, config.color.primary);
      sparkGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = sparkGradient;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, sparkSize * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    coreGradient.addColorStop(0, config.color.core || '#ffffff');
    coreGradient.addColorStop(0.6, config.color.secondary);
    coreGradient.addColorStop(1, config.color.primary + '80');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Energy trail
    const trailGradient = ctx.createLinearGradient(-size * 4, 0, 0, 0);
    trailGradient.addColorStop(0, 'transparent');
    trailGradient.addColorStop(0.4, config.color.glow);
    trailGradient.addColorStop(0.8, config.color.primary);
    trailGradient.addColorStop(1, config.color.secondary);

    ctx.strokeStyle = trailGradient;
    ctx.lineWidth = config.trailWidth || 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 4, 0);
    ctx.lineTo(-size * 0.5, 0);
    ctx.stroke();
  },

  drawBeam(ctx, beam, camera) {
    const screenX = beam.x - camera.x;
    const screenY = beam.y - camera.y;
    const config = beam.config;

    const elapsed = Date.now() - beam.startTime;
    const progress = elapsed / beam.duration;
    const intensity = Math.sin(progress * Math.PI);

    const range = config.maxRange;
    const endX = screenX + Math.cos(beam.rotation) * range;
    const endY = screenY + Math.sin(beam.rotation) * range;

    const flicker = 1 + Math.sin(Date.now() * 0.05) * 0.1;

    ctx.strokeStyle = config.color.glow;
    ctx.lineWidth = config.width * 4 * intensity * flicker;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const beamGradient = ctx.createLinearGradient(screenX, screenY, endX, endY);
    beamGradient.addColorStop(0, config.color.secondary);
    beamGradient.addColorStop(0.5, config.color.primary);
    beamGradient.addColorStop(1, config.color.primary + '88');

    ctx.strokeStyle = beamGradient;
    ctx.lineWidth = config.width * 2 * intensity * flicker;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.strokeStyle = config.color.secondary;
    ctx.lineWidth = config.width * 0.5 * intensity;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  },

  drawMuzzleFlash(ctx, flash, camera) {
    const screenX = flash.x - camera.x;
    const screenY = flash.y - camera.y;
    const elapsed = Date.now() - flash.startTime;
    const progress = elapsed / flash.duration;
    const alpha = 1 - progress;

    const baseSize = flash.size || 15;
    const size = baseSize * (1 + progress * 0.5);

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(flash.rotation);
    ctx.globalAlpha = alpha;

    switch (flash.type) {
      case 'dual':
        // Dual flash - two offset flashes
        this.drawDualMuzzleFlash(ctx, size, flash, progress);
        break;
      case 'ring':
        // Energy ring expanding outward
        this.drawRingMuzzleFlash(ctx, size, flash, progress);
        break;
      case 'heat':
        // Heat distortion wave
        this.drawHeatMuzzleFlash(ctx, size, flash, progress);
        break;
      case 'vortex':
        // Swirling plasma vortex
        this.drawVortexMuzzleFlash(ctx, size, flash, progress);
        break;
      case 'teslaArc':
        // Tesla lightning branches
        this.drawTeslaArcMuzzleFlash(ctx, size, flash, progress);
        break;
      default:
        // Simple flash (tier 1)
        this.drawSimpleMuzzleFlash(ctx, size, flash);
    }

    ctx.restore();
  },

  drawSimpleMuzzleFlash(ctx, size, flash) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, flash.color);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  },

  drawDualMuzzleFlash(ctx, size, flash, progress) {
    const offset = 6;
    const flashSize = size * 0.8;

    // Two parallel flashes
    for (const dy of [-offset, offset]) {
      const gradient = ctx.createRadialGradient(0, dy, 0, 0, dy, flashSize);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, flash.color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, dy, flashSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connecting beam flash
    const beamAlpha = 0.6 * (1 - progress);
    ctx.globalAlpha = beamAlpha;
    ctx.fillStyle = flash.color;
    ctx.beginPath();
    ctx.ellipse(size * 0.3, 0, size * 0.6, offset * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  drawRingMuzzleFlash(ctx, size, flash, progress) {
    // Central flash
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.6);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.5, flash.color);
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Expanding ring
    const ringRadius = size * (0.5 + progress * 1.5);
    const ringWidth = Math.max(1, size * 0.15 * (1 - progress));

    ctx.strokeStyle = flash.color;
    ctx.lineWidth = ringWidth;
    ctx.globalAlpha = ctx.globalAlpha * (1 - progress * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  },

  drawHeatMuzzleFlash(ctx, size, flash, progress) {
    // Heat distortion effect - overlapping circles
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const layerProgress = (progress + i * 0.1) % 1;
      const layerSize = size * (0.5 + layerProgress * 1.2);
      const layerAlpha = (1 - layerProgress) * 0.4;

      const gradient = ctx.createRadialGradient(0, 0, layerSize * 0.6, 0, 0, layerSize);
      gradient.addColorStop(0, flash.color + '00');
      gradient.addColorStop(0.7, flash.color + '60');
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = layerAlpha;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, layerSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Core heat
    ctx.globalAlpha = 1 - progress;
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    coreGradient.addColorStop(0, flash.secondaryColor || '#ffffff');
    coreGradient.addColorStop(0.5, flash.color);
    coreGradient.addColorStop(1, flash.color + '00');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawVortexMuzzleFlash(ctx, size, flash, progress) {
    // Swirling vortex effect
    const rotationSpeed = 8;
    const baseAngle = Date.now() * 0.01 * rotationSpeed;

    // Outer vortex arms
    const arms = 4;
    ctx.strokeStyle = flash.color;
    for (let i = 0; i < arms; i++) {
      const armAngle = baseAngle + (i / arms) * Math.PI * 2;
      const armLength = size * (1.2 - progress * 0.5);
      const armWidth = size * 0.15 * (1 - progress * 0.5);

      ctx.lineWidth = armWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);

      // Curved arm
      const endX = Math.cos(armAngle) * armLength;
      const endY = Math.sin(armAngle) * armLength;
      const cpX = Math.cos(armAngle + 0.5) * armLength * 0.6;
      const cpY = Math.sin(armAngle + 0.5) * armLength * 0.6;

      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.stroke();
    }

    // Inner glow
    const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
    innerGradient.addColorStop(0, flash.secondaryColor || '#ffffff');
    innerGradient.addColorStop(0.3, flash.color);
    innerGradient.addColorStop(0.7, flash.glowColor || flash.color + '60');
    innerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  },

  drawTeslaArcMuzzleFlash(ctx, size, flash, progress) {
    const time = Date.now();
    const branchCount = 5;
    const maxLength = size * 1.8;

    // Core glow
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.6);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.4, flash.secondaryColor || '#44ffaa');
    coreGradient.addColorStop(0.7, flash.color);
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Lightning branches from barrel
    for (let i = 0; i < branchCount; i++) {
      const baseAngle = (i / branchCount) * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      const branchLength = maxLength * (0.6 + Math.random() * 0.4) * (1 - progress * 0.5);

      // Glow layer
      ctx.strokeStyle = flash.glowColor || flash.color + '60';
      ctx.lineWidth = 8 * (1 - progress);
      ctx.lineCap = 'round';
      this.drawLightningBranch(ctx, 0, 0, baseAngle, branchLength, 3);

      // Primary layer
      ctx.strokeStyle = flash.color;
      ctx.lineWidth = 3 * (1 - progress);
      this.drawLightningBranch(ctx, 0, 0, baseAngle, branchLength, 3);

      // Core layer
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * (1 - progress);
      this.drawLightningBranch(ctx, 0, 0, baseAngle, branchLength, 3);
    }

    // Spark particles
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = size * (0.3 + Math.random() * 0.8);
      const sparkX = Math.cos(angle) * dist;
      const sparkY = Math.sin(angle) * dist;
      const sparkSize = 2 + Math.random() * 2;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, Math.max(0.1, sparkSize * (1 - progress)), 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawLightningBranch(ctx, startX, startY, angle, length, segments) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    let x = startX;
    let y = startY;

    for (let i = 0; i < segments; i++) {
      const segLength = length / segments;
      const jitter = (Math.random() - 0.5) * segLength * 0.8;
      const newAngle = angle + jitter * 0.15;

      x += Math.cos(newAngle) * segLength;
      y += Math.sin(newAngle) * segLength;

      // Add perpendicular jitter
      x += Math.cos(newAngle + Math.PI / 2) * jitter;
      y += Math.sin(newAngle + Math.PI / 2) * jitter;

      ctx.lineTo(x, y);
    }
    ctx.stroke();
  },

  createExplosion(x, y, tier, config) {
    const count = config.hasSplash ? 30 : 15;
    const size = config.size || 8;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 100 + Math.random() * 150;

      ParticleSystem.spawn({
        x: x + (Math.random() - 0.5) * size,
        y: y + (Math.random() - 0.5) * size,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 200 + Math.random() * 200,
        color: config.color.primary,
        size: 2 + Math.random() * 3,
        type: 'glow',
        drag: 0.95,
        decay: 1
      });
    }
  },

  spawnTrailParticle(proj, dt) {
    const config = proj.config;
    const trailConfig = config.trail || { frequency: 0.3, size: 1.5, length: 30 };

    // Tier-based spawn frequency
    if (Math.random() > trailConfig.frequency) return;

    const trailType = trailConfig.type || 'trail';

    switch (trailType) {
      case 'energy':
        // Pulsing energy particles
        ParticleSystem.spawn({
          x: proj.x + (Math.random() - 0.5) * 6,
          y: proj.y + (Math.random() - 0.5) * 6,
          vx: -proj.vx * 0.15 + (Math.random() - 0.5) * 30,
          vy: -proj.vy * 0.15 + (Math.random() - 0.5) * 30,
          life: 150 + Math.random() * 100,
          color: config.color.primary,
          size: trailConfig.size + Math.random() * 1.5,
          type: 'energy',
          drag: 0.96,
          decay: 1,
          pulse: true,
          pulseSpeed: 8
        });
        break;

      case 'smoke':
        // Smoke trail with secondary particles
        ParticleSystem.spawn({
          x: proj.x + (Math.random() - 0.5) * 8,
          y: proj.y + (Math.random() - 0.5) * 8,
          vx: -proj.vx * 0.08 + (Math.random() - 0.5) * 15,
          vy: -proj.vy * 0.08 + (Math.random() - 0.5) * 15,
          life: 250 + Math.random() * 150,
          color: trailConfig.smokeColor || '#88888840',
          size: trailConfig.size * 1.5 + Math.random() * 2,
          type: 'smoke',
          drag: 0.99,
          decay: 0.8,
          gravity: -10 // Smoke rises
        });
        // Also spawn small sparks
        if (Math.random() > 0.5) {
          ParticleSystem.spawn({
            x: proj.x,
            y: proj.y,
            vx: -proj.vx * 0.3 + (Math.random() - 0.5) * 60,
            vy: -proj.vy * 0.3 + (Math.random() - 0.5) * 60,
            life: 80 + Math.random() * 60,
            color: config.color.primary,
            size: 1 + Math.random(),
            type: 'spark',
            drag: 0.94,
            decay: 1
          });
        }
        break;

      case 'wisps':
        // Multiple energy wisps orbiting the projectile
        const wispCount = trailConfig.wispCount || 2;
        for (let i = 0; i < wispCount; i++) {
          const angle = Date.now() * 0.01 + (i / wispCount) * Math.PI * 2;
          const orbitRadius = 8 + Math.random() * 4;
          ParticleSystem.spawn({
            x: proj.x + Math.cos(angle) * orbitRadius,
            y: proj.y + Math.sin(angle) * orbitRadius,
            vx: -proj.vx * 0.2 + Math.cos(angle + Math.PI/2) * 30,
            vy: -proj.vy * 0.2 + Math.sin(angle + Math.PI/2) * 30,
            life: 120 + Math.random() * 80,
            color: config.color.primary,
            secondaryColor: config.color.secondary,
            size: trailConfig.size + Math.random(),
            type: 'glow',
            drag: 0.95,
            decay: 1.2
          });
        }
        break;

      case 'electrical':
        // Electrical spark particles for Tesla cannon
        const sparkCount = trailConfig.sparkCount || 4;
        for (let i = 0; i < sparkCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 60;
          ParticleSystem.spawn({
            x: proj.x + (Math.random() - 0.5) * 10,
            y: proj.y + (Math.random() - 0.5) * 10,
            vx: -proj.vx * 0.15 + Math.cos(angle) * speed,
            vy: -proj.vy * 0.15 + Math.sin(angle) * speed,
            life: 80 + Math.random() * 60,
            color: config.color.core || '#ffffff',
            secondaryColor: config.color.primary,
            size: trailConfig.size * 0.8 + Math.random(),
            type: 'spark',
            drag: 0.92,
            decay: 1.5
          });
        }
        // Also spawn a glow particle
        if (Math.random() > 0.5) {
          ParticleSystem.spawn({
            x: proj.x + (Math.random() - 0.5) * 6,
            y: proj.y + (Math.random() - 0.5) * 6,
            vx: -proj.vx * 0.2,
            vy: -proj.vy * 0.2,
            life: 100 + Math.random() * 50,
            color: config.color.primary,
            size: trailConfig.size * 1.5,
            type: 'glow',
            drag: 0.96,
            decay: 1.2
          });
        }
        break;

      default:
        // Standard trail
        ParticleSystem.spawn({
          x: proj.x + (Math.random() - 0.5) * 4,
          y: proj.y + (Math.random() - 0.5) * 4,
          vx: -proj.vx * 0.1 + (Math.random() - 0.5) * 20,
          vy: -proj.vy * 0.1 + (Math.random() - 0.5) * 20,
          life: 100 + Math.random() * 100,
          color: config.color.primary,
          size: trailConfig.size + Math.random(),
          type: 'trail',
          drag: 0.98,
          decay: 1
        });
    }
  },

  clear() {
    this.projectiles = [];
    this.activeBeams = [];
    this.muzzleFlashes = [];
    this.pendingHits = [];
  }
};
