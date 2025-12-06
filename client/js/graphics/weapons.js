/**
 * Weapon Renderer
 * Renders weapon effects with 5 tier types
 */

const WEAPON_CONFIG = {
  1: { type: 'burst', color: { primary: '#00ffff', secondary: '#ffffff', glow: '#00ffff60' }, length: 50, width: 4, speed: 1500, duration: 120, particleCount: 5 },
  2: { type: 'dual', color: { primary: '#44ffff', secondary: '#ffffff', glow: '#44ffff60' }, length: 55, width: 4, speed: 1600, duration: 130, separation: 8, particleCount: 8 },
  3: { type: 'pulse', color: { primary: '#88ff44', secondary: '#ffffff', glow: '#88ff4480' }, size: 8, speed: 1200, duration: 300, particleCount: 12, hasExplosion: true },
  4: { type: 'beam', color: { primary: '#ff8844', secondary: '#ffdd88', glow: '#ff884480' }, width: 6, maxRange: 400, duration: 200, particleCount: 10 },
  5: { type: 'plasma', color: { primary: '#ff44ff', secondary: '#ffffff', glow: '#ff44ff80' }, size: 12, speed: 1000, duration: 400, particleCount: 20, hasExplosion: true, hasSplash: true, trailWidth: 8 }
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

    this.muzzleFlashes.push({
      x: muzzleX,
      y: muzzleY,
      rotation: rotation,
      startTime: Date.now(),
      duration: 80,
      tier: tier,
      color: config.color.primary
    });

    switch (config.type) {
      case 'burst':
      case 'dual':
        this.fireBurstLaser(muzzleX, muzzleY, rotation, tier, config);
        break;
      case 'pulse':
      case 'plasma':
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

    const size = 15 * (1 + progress * 0.5);

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(flash.rotation);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, flash.color);
    gradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

    if (config.type !== 'pulse' && config.type !== 'plasma') {
      if (Math.random() > 0.3) return;
    }

    ParticleSystem.spawn({
      x: proj.x + (Math.random() - 0.5) * 4,
      y: proj.y + (Math.random() - 0.5) * 4,
      vx: -proj.vx * 0.1 + (Math.random() - 0.5) * 20,
      vy: -proj.vy * 0.1 + (Math.random() - 0.5) * 20,
      life: 100 + Math.random() * 100,
      color: config.color.primary,
      size: 1 + Math.random() * 2,
      type: 'trail',
      drag: 0.98,
      decay: 1
    });
  },

  clear() {
    this.projectiles = [];
    this.activeBeams = [];
    this.muzzleFlashes = [];
    this.pendingHits = [];
  }
};
