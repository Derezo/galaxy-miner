/**
 * NPC Faction Weapon Effects
 * Each faction has a distinct weapon visual style
 *
 * cannon: Pirates - fiery projectile with trailing sparks
 * jury_laser: Scavengers - flickering unstable beam
 * acid_bolt: Swarm - organic projectile with splash
 * dark_beam: Void - pulsing dark energy beam
 * mining_laser: Rogue Miners - industrial beam with particles
 */

const NPCWeaponEffects = {
  // Active weapon effects
  projectiles: [],
  beams: [],

  // Pending hit effects (delayed until projectile arrives)
  pendingHits: [],

  // Weapon configurations per faction
  WEAPON_CONFIGS: {
    cannon: {
      type: 'projectile',
      color: { primary: '#ff6600', secondary: '#ffcc00', glow: '#ff660080' },
      size: 8,
      speed: 400,
      duration: 800,
      trail: true,
      trailColor: '#ff6600',
      trailLength: 30
    },
    jury_laser: {
      type: 'beam',
      color: { primary: '#ffff00', secondary: '#ffffaa', glow: '#ffff0060' },
      width: 3,
      range: 200,
      duration: 150,
      flicker: true,
      flickerRate: 20
    },
    acid_bolt: {
      type: 'projectile',
      color: { primary: '#00ff66', secondary: '#66ffaa', glow: '#00ff6680' },
      size: 6,
      speed: 350,
      duration: 700,
      splash: true,
      splashRadius: 30,
      drip: true
    },
    dark_beam: {
      type: 'beam',
      color: { primary: '#9900ff', secondary: '#cc66ff', glow: '#9900ff80' },
      width: 5,
      range: 250,
      duration: 200,
      pulse: true,
      pulseRate: 10,
      coreColor: '#000000'
    },
    mining_laser: {
      type: 'beam',
      color: { primary: '#ff9900', secondary: '#ffcc00', glow: '#ff990060' },
      width: 4,
      range: 180,
      duration: 300,
      particles: true,
      particleRate: 5
    }
  },

  init() {
    console.log('NPCWeaponEffects initialized');
  },

  /**
   * Fire a weapon from an NPC
   * @param {object} source - Source position {x, y}
   * @param {object} target - Target position {x, y}
   * @param {string} weaponType - Weapon type (faction weapon)
   * @param {string} faction - Faction for color theming
   * @param {object} hitInfo - Optional hit information {isShieldHit, damage}
   */
  fire(source, target, weaponType, faction = null, hitInfo = null) {
    const config = this.WEAPON_CONFIGS[weaponType] || this.WEAPON_CONFIGS.cannon;
    const angle = Math.atan2(target.y - source.y, target.x - source.x);

    if (config.type === 'projectile') {
      this.fireProjectile(source, target, angle, config, weaponType, hitInfo);
    } else if (config.type === 'beam') {
      this.fireBeam(source, target, config, weaponType, hitInfo);
    }
  },

  fireProjectile(source, target, angle, config, weaponType, hitInfo = null) {
    // Calculate distance and expected travel time
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const travelTime = (distance / config.speed) * 1000; // in ms

    const projectile = {
      x: source.x,
      y: source.y,
      vx: Math.cos(angle) * config.speed,
      vy: Math.sin(angle) * config.speed,
      rotation: angle,
      weaponType: weaponType,
      config: config,
      startTime: Date.now(),
      life: Math.max(config.duration, travelTime + 100), // Extend life to reach target
      trail: [],
      // Target tracking for hit effect
      target: { x: target.x, y: target.y },
      hitInfo: hitInfo,
      hitTriggered: false,
      expectedArrival: Date.now() + travelTime
    };

    this.projectiles.push(projectile);
  },

  fireBeam(source, target, config, weaponType, hitInfo = null) {
    const beam = {
      startX: source.x,
      startY: source.y,
      endX: target.x,
      endY: target.y,
      weaponType: weaponType,
      config: config,
      startTime: Date.now(),
      duration: config.duration,
      hitInfo: hitInfo,
      hitTriggered: false
    };

    this.beams.push(beam);

    // Beams are instant - trigger hit effect immediately at target
    if (hitInfo && typeof HitEffectRenderer !== 'undefined') {
      HitEffectRenderer.addHit(target.x, target.y, hitInfo.isShieldHit);
    }
  },

  /**
   * Update all active effects
   */
  update(dt) {
    const now = Date.now();

    // Update projectiles
    this.projectiles = this.projectiles.filter(proj => {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt * 1000;

      // Store trail positions
      if (proj.config.trail) {
        proj.trail.push({ x: proj.x, y: proj.y, time: now });
        // Keep only recent trail points
        proj.trail = proj.trail.filter(p => now - p.time < 100);
      }

      // Check if projectile has reached target (for hit effect timing)
      if (proj.target && !proj.hitTriggered) {
        const dx = proj.x - proj.target.x;
        const dy = proj.y - proj.target.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = 30; // Units from target to trigger hit

        if (distToTarget < hitRadius || now >= proj.expectedArrival) {
          proj.hitTriggered = true;

          // Trigger hit effect at target position
          if (proj.hitInfo && typeof HitEffectRenderer !== 'undefined') {
            HitEffectRenderer.addHit(proj.target.x, proj.target.y, proj.hitInfo.isShieldHit);
          }

          // Create splash effect for acid bolts at impact
          if (proj.config.splash && typeof ParticleSystem !== 'undefined') {
            this.createSplashEffect(proj);
          }

          // Remove projectile after impact
          return false;
        }
      }

      if (proj.life <= 0) {
        // Create splash effect for acid bolts (fallback if no target)
        if (proj.config.splash && typeof ParticleSystem !== 'undefined' && !proj.hitTriggered) {
          this.createSplashEffect(proj);
        }
        return false;
      }
      return true;
    });

    // Update beams
    this.beams = this.beams.filter(beam => {
      const elapsed = now - beam.startTime;
      return elapsed < beam.duration;
    });
  },

  createSplashEffect(proj) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 50 + Math.random() * 80;

      ParticleSystem.spawn({
        x: proj.x,
        y: proj.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 300 + Math.random() * 200,
        color: proj.config.color.primary,
        size: 2 + Math.random() * 3,
        type: 'glow',
        drag: 0.92,
        decay: 1
      });
    }
  },

  /**
   * Draw all active effects
   */
  draw(ctx, camera) {
    // Draw beams first (behind projectiles)
    for (const beam of this.beams) {
      this.drawBeam(ctx, beam, camera);
    }

    // Draw projectiles
    for (const proj of this.projectiles) {
      this.drawProjectile(ctx, proj, camera);
    }
  },

  drawProjectile(ctx, proj, camera) {
    const screenX = proj.x - camera.x;
    const screenY = proj.y - camera.y;
    const config = proj.config;
    const progress = 1 - (proj.life / config.duration);

    ctx.save();

    // Draw trail
    if (config.trail && proj.trail.length > 1) {
      ctx.strokeStyle = config.trailColor;
      ctx.lineWidth = config.size * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let i = 0; i < proj.trail.length; i++) {
        const point = proj.trail[i];
        const px = point.x - camera.x;
        const py = point.y - camera.y;
        const alpha = i / proj.trail.length;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.translate(screenX, screenY);
    ctx.rotate(proj.rotation);

    // Draw based on weapon type
    switch (proj.weaponType) {
      case 'cannon':
        this.drawCannonProjectile(ctx, config);
        break;
      case 'acid_bolt':
        this.drawAcidBolt(ctx, config);
        break;
      default:
        this.drawGenericProjectile(ctx, config);
    }

    ctx.restore();
  },

  drawCannonProjectile(ctx, config) {
    // Fiery cannon ball
    const size = config.size;

    // Outer glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
    gradient.addColorStop(0, config.color.secondary);
    gradient.addColorStop(0.4, config.color.primary);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = config.color.secondary;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Sparks trailing behind
    ctx.fillStyle = config.color.secondary;
    for (let i = 0; i < 3; i++) {
      const sparkX = -size * (1 + i * 0.5) + (Math.random() - 0.5) * 4;
      const sparkY = (Math.random() - 0.5) * 6;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawAcidBolt(ctx, config) {
    // Organic acid projectile
    const size = config.size;
    const wobble = Math.sin(Date.now() * 0.02) * 2;

    // Toxic glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
    gradient.addColorStop(0, config.color.secondary);
    gradient.addColorStop(0.3, config.color.primary);
    gradient.addColorStop(0.7, config.color.glow);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Organic blob shape
    ctx.fillStyle = config.color.primary;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const r = size * (0.8 + Math.sin(Date.now() * 0.01 + i) * 0.2);
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Dripping effect
    if (config.drip) {
      ctx.fillStyle = config.color.primary;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, size + wobble, size * 0.3, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  drawGenericProjectile(ctx, config) {
    const size = config.size;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    gradient.addColorStop(0, config.color.secondary);
    gradient.addColorStop(0.5, config.color.primary);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawBeam(ctx, beam, camera) {
    const startX = beam.startX - camera.x;
    const startY = beam.startY - camera.y;
    const endX = beam.endX - camera.x;
    const endY = beam.endY - camera.y;
    const config = beam.config;

    const elapsed = Date.now() - beam.startTime;
    const progress = elapsed / beam.duration;
    const intensity = Math.sin(progress * Math.PI); // Fade in and out

    ctx.save();

    switch (beam.weaponType) {
      case 'jury_laser':
        this.drawJuryLaser(ctx, startX, startY, endX, endY, config, intensity);
        break;
      case 'dark_beam':
        this.drawDarkBeam(ctx, startX, startY, endX, endY, config, intensity);
        break;
      case 'mining_laser':
        this.drawMiningLaser(ctx, startX, startY, endX, endY, config, intensity);
        break;
      default:
        this.drawGenericBeam(ctx, startX, startY, endX, endY, config, intensity);
    }

    ctx.restore();
  },

  drawJuryLaser(ctx, x1, y1, x2, y2, config, intensity) {
    // Flickering unstable beam
    const flicker = config.flicker ? (Math.random() > 0.3 ? 1 : 0.3) : 1;

    // Random offset for instability
    const jitterX = (Math.random() - 0.5) * 4;
    const jitterY = (Math.random() - 0.5) * 4;

    // Outer glow
    ctx.strokeStyle = config.color.glow;
    ctx.lineWidth = config.width * 4 * intensity * flicker;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5 * flicker;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + jitterX, y2 + jitterY);
    ctx.stroke();

    // Main beam
    ctx.strokeStyle = config.color.primary;
    ctx.lineWidth = config.width * intensity * flicker;
    ctx.globalAlpha = intensity * flicker;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + jitterX * 0.5, y2 + jitterY * 0.5);
    ctx.stroke();

    // Core
    ctx.strokeStyle = config.color.secondary;
    ctx.lineWidth = config.width * 0.3 * intensity * flicker;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  drawDarkBeam(ctx, x1, y1, x2, y2, config, intensity) {
    // Pulsing dark energy beam
    const pulsePhase = Date.now() * 0.001 * config.pulseRate;
    const pulse = 0.7 + Math.sin(pulsePhase) * 0.3;

    // Dark core (drawn first)
    ctx.strokeStyle = config.coreColor;
    ctx.lineWidth = config.width * 0.8 * intensity;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Purple energy outer layer
    ctx.strokeStyle = config.color.glow;
    ctx.lineWidth = config.width * 3 * intensity * pulse;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Main beam
    ctx.strokeStyle = config.color.primary;
    ctx.lineWidth = config.width * intensity * pulse;
    ctx.globalAlpha = intensity;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Energy particles along beam
    const beamLength = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.fillStyle = config.color.secondary;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 5; i++) {
      const t = ((Date.now() * 0.003 + i * 0.2) % 1);
      const px = x1 + Math.cos(angle) * beamLength * t;
      const py = y1 + Math.sin(angle) * beamLength * t;
      ctx.beginPath();
      ctx.arc(px, py, 3 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawMiningLaser(ctx, x1, y1, x2, y2, config, intensity) {
    // Industrial mining beam with particles
    const flicker = 0.9 + Math.sin(Date.now() * 0.02) * 0.1;

    // Outer glow
    ctx.strokeStyle = config.color.glow;
    ctx.lineWidth = config.width * 3 * intensity;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Main beam
    ctx.strokeStyle = config.color.primary;
    ctx.lineWidth = config.width * intensity * flicker;
    ctx.globalAlpha = intensity;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Core
    ctx.strokeStyle = config.color.secondary;
    ctx.lineWidth = config.width * 0.4 * intensity;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Spawn particles at impact point
    if (config.particles && typeof ParticleSystem !== 'undefined' && Math.random() < 0.3) {
      ParticleSystem.spawn({
        x: x2 + (Math.random() - 0.5) * 10,
        y: y2 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100 - 50,
        life: 200 + Math.random() * 200,
        color: config.color.secondary,
        size: 2 + Math.random() * 2,
        type: 'spark',
        drag: 0.95,
        decay: 1
      });
    }
  },

  drawGenericBeam(ctx, x1, y1, x2, y2, config, intensity) {
    // Outer glow
    ctx.strokeStyle = config.color.glow;
    ctx.lineWidth = config.width * 3 * intensity;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Main beam
    ctx.strokeStyle = config.color.primary;
    ctx.lineWidth = config.width * intensity;
    ctx.globalAlpha = intensity;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  /**
   * Get weapon type for a faction
   */
  getWeaponForFaction(faction) {
    const factionWeapons = {
      pirate: 'cannon',
      scavenger: 'jury_laser',
      swarm: 'acid_bolt',
      void: 'dark_beam',
      rogue_miner: 'mining_laser'
    };
    return factionWeapons[faction] || 'cannon';
  },

  clear() {
    this.projectiles = [];
    this.beams = [];
    this.pendingHits = [];
  },

  /**
   * Schedule a hit effect for when projectile arrives
   * Used by network handlers to sync with visual projectile travel
   */
  scheduleHitEffect(source, target, weaponType, hitInfo, delay) {
    this.pendingHits.push({
      target: target,
      hitInfo: hitInfo,
      triggerTime: Date.now() + delay
    });
  }
};
