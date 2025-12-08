/**
 * NPC Faction Weapon Effects
 * Each faction has a distinct weapon visual style
 *
 * cannon: Pirates - fiery projectile with trailing sparks
 * jury_laser: Scavengers - flickering unstable beam
 * dark_energy: Swarm - black core with crimson tendrils and void tears
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
    dark_energy: {
      type: 'projectile',
      color: { primary: '#8b0000', secondary: '#ff0000', glow: '#ff000040', core: '#000000' },
      size: 7,
      speed: 400,
      duration: 600,
      trail: true,
      trailColor: '#8b0000',
      trailLength: 40,
      voidTear: true,
      tendrils: true
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
    Logger.log('NPCWeaponEffects initialized');
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

          // Create void tear effect for dark energy at impact
          if (proj.config.voidTear && typeof ParticleSystem !== 'undefined') {
            this.createVoidTearEffect(proj);
          }

          // Remove projectile after impact
          return false;
        }
      }

      if (proj.life <= 0) {
        // Create void tear effect (fallback if no target)
        if (proj.config.voidTear && typeof ParticleSystem !== 'undefined' && !proj.hitTriggered) {
          this.createVoidTearEffect(proj);
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

  createVoidTearEffect(proj) {
    // Crimson tendrils radiating outward
    const tendrilCount = 8;
    for (let i = 0; i < tendrilCount; i++) {
      const angle = (Math.PI * 2 * i) / tendrilCount + Math.random() * 0.4;
      const speed = 80 + Math.random() * 120;

      ParticleSystem.spawn({
        x: proj.x,
        y: proj.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 400 + Math.random() * 200,
        color: proj.config.color.primary, // Dark crimson
        size: 3 + Math.random() * 2,
        type: 'glow',
        drag: 0.88,
        decay: 1
      });
    }

    // Dark core particles (sucked inward initially, then explode)
    const coreCount = 6;
    for (let i = 0; i < coreCount; i++) {
      const angle = (Math.PI * 2 * i) / coreCount + Math.random() * 0.5;
      const speed = 40 + Math.random() * 60;

      ParticleSystem.spawn({
        x: proj.x + (Math.random() - 0.5) * 10,
        y: proj.y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 250 + Math.random() * 150,
        color: '#000000', // Black core
        size: 4 + Math.random() * 3,
        type: 'glow',
        drag: 0.9,
        decay: 1
      });
    }

    // Red sparks
    const sparkCount = 10;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;

      ParticleSystem.spawn({
        x: proj.x,
        y: proj.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 200 + Math.random() * 100,
        color: proj.config.color.secondary, // Bright red
        size: 1.5 + Math.random() * 1.5,
        type: 'spark',
        drag: 0.95,
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
      case 'dark_energy':
        this.drawDarkEnergyBolt(ctx, config, proj);
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

  drawDarkEnergyBolt(ctx, config, proj) {
    // Dark energy projectile - black core with crimson tendrils and void tear effect
    const size = config.size;
    const time = Date.now();
    const pulsePhase = (Math.sin(time * 0.008) + 1) / 2;

    // Void tear effect - distortion around the projectile
    if (config.voidTear) {
      ctx.strokeStyle = config.color.glow;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3 + pulsePhase * 0.2;
      for (let i = 0; i < 3; i++) {
        const tearSize = size * (1.5 + i * 0.5);
        const offset = Math.sin(time * 0.005 + i) * 3;
        ctx.beginPath();
        ctx.ellipse(offset, 0, tearSize, tearSize * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Outer crimson glow
    const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
    outerGlow.addColorStop(0, config.color.primary);
    outerGlow.addColorStop(0.4, config.color.glow);
    outerGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Crimson tendrils extending from core
    if (config.tendrils) {
      ctx.strokeStyle = config.color.primary;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';

      for (let i = 0; i < 6; i++) {
        const baseAngle = (Math.PI * 2 * i) / 6 + time * 0.002;
        const tendrilLength = size * (1.2 + Math.sin(time * 0.006 + i) * 0.4);
        const wobble = Math.sin(time * 0.01 + i * 2) * 0.3;

        ctx.globalAlpha = 0.6 + Math.sin(time * 0.005 + i) * 0.3;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(baseAngle) * size * 0.5,
          Math.sin(baseAngle) * size * 0.5
        );

        // Curvy tendril using quadratic bezier
        const midX = Math.cos(baseAngle + wobble) * tendrilLength * 0.6;
        const midY = Math.sin(baseAngle + wobble) * tendrilLength * 0.6;
        const endX = Math.cos(baseAngle) * tendrilLength;
        const endY = Math.sin(baseAngle) * tendrilLength;

        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Dark crimson ring
    ctx.strokeStyle = config.color.primary;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Black void core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    coreGradient.addColorStop(0, config.color.core || '#000000');
    coreGradient.addColorStop(0.6, '#1a0000');
    coreGradient.addColorStop(1, config.color.primary);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Inner red eye highlight
    const eyeSize = size * 0.25 * (0.8 + pulsePhase * 0.4);
    ctx.fillStyle = config.color.secondary;
    ctx.beginPath();
    ctx.arc(0, 0, eyeSize, 0, Math.PI * 2);
    ctx.fill();
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
      swarm: 'dark_energy',
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
