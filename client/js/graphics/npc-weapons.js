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
    },
    web_snare: {
      type: 'projectile',
      color: { primary: '#4a0000', secondary: '#8b0000', glow: '#ff000030', web: '#660033' },
      size: 12,
      speed: 300,
      duration: 1500,
      trail: true,
      trailColor: '#4a0000',
      trailLength: 50,
      webStrands: 6,
      areaRadius: 150
    },
    acid_burst: {
      type: 'projectile',
      color: { primary: '#33cc00', secondary: '#66ff33', glow: '#00ff0040', toxic: '#009900' },
      size: 10,
      speed: 250,
      duration: 1600,
      trail: true,
      trailColor: '#33cc00',
      trailLength: 35,
      bubbling: true,
      areaRadius: 100
    },
    // Scavenger faction weapons
    dual_laser: {
      type: 'projectile',
      color: { primary: '#D4A017', secondary: '#FFD700', glow: '#D4A01760' },
      size: 4,
      speed: 500,
      duration: 600,
      trail: false,
      dual: true,          // Fire two parallel projectiles
      separation: 10       // Distance between dual shots
    },
    boring_drill: {
      type: 'melee',
      color: { primary: '#999966', secondary: '#666644', glow: '#99996640' },
      chargeTime: 1500,
      range: 50,
      instantKill: true
    },
    loader_slam: {
      type: 'melee',
      color: { primary: '#666644', secondary: '#D4A017', glow: '#D4A01740' },
      range: 35,
      knockback: true,
      impactSize: 40
    }
  },

  // Active area effects (web snare zones, acid puddles)
  areaEffects: [],

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
      if (config.dual) {
        // Fire two parallel projectiles
        this.fireDualProjectile(source, target, angle, config, weaponType, hitInfo);
      } else {
        this.fireProjectile(source, target, angle, config, weaponType, hitInfo);
      }
    } else if (config.type === 'beam') {
      this.fireBeam(source, target, config, weaponType, hitInfo);
    } else if (config.type === 'melee') {
      this.fireMeleeAttack(source, target, config, weaponType, hitInfo);
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

  fireDualProjectile(source, target, angle, config, weaponType, hitInfo = null) {
    // Fire two projectiles with offset perpendicular to direction
    const separation = config.separation || 10;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);
    const halfSep = separation / 2;

    // Offset positions
    const pos1 = { x: source.x + perpX * halfSep, y: source.y + perpY * halfSep };
    const pos2 = { x: source.x - perpX * halfSep, y: source.y - perpY * halfSep };

    // Fire both projectiles
    this.fireProjectile(pos1, target, angle, config, weaponType, hitInfo);
    this.fireProjectile(pos2, target, angle, config, weaponType, null); // Only one triggers hit
  },

  fireMeleeAttack(source, target, config, weaponType, hitInfo = null) {
    // Melee attacks are instant - create impact effect at target
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only show effect if within melee range
    if (dist <= (config.range || 50)) {
      // Add melee impact to area effects for rendering
      this.areaEffects.push({
        type: 'melee_impact',
        x: target.x,
        y: target.y,
        weaponType: weaponType,
        config: config,
        startTime: Date.now(),
        duration: 400, // Quick impact flash
        size: config.impactSize || 30
      });

      // Trigger hit effect immediately
      if (hitInfo && typeof HitEffectRenderer !== 'undefined') {
        HitEffectRenderer.addHit(target.x, target.y, hitInfo.isShieldHit);
      }

      // Screen shake for powerful melee (Barnacle King drill)
      if (config.instantKill && typeof Renderer !== 'undefined' && Renderer.shake) {
        Renderer.shake(20, 300);
      } else if (config.knockback && typeof Renderer !== 'undefined' && Renderer.shake) {
        Renderer.shake(8, 150);
      }
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

    // Update area effects
    this.updateAreaEffects(dt);
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
    // Draw area effects first (ground level)
    this.drawAreaEffects(ctx, camera);

    // Draw beams (behind projectiles)
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
      case 'web_snare':
        this.drawWebSnareProjectile(ctx, config, proj);
        break;
      case 'acid_burst':
        this.drawAcidBurstProjectile(ctx, config, proj);
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

  drawWebSnareProjectile(ctx, config, proj) {
    // Web snare - dark spinning core with trailing web strands
    const size = config.size;
    const time = Date.now();
    const spinAngle = time * 0.005; // Spinning rotation

    // Outer crimson halo glow
    const haloGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
    haloGradient.addColorStop(0, config.color.glow);
    haloGradient.addColorStop(0.5, 'rgba(139, 0, 0, 0.2)');
    haloGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Trailing web strands (6 strands spiraling outward)
    ctx.strokeStyle = config.color.web;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = 0; i < config.webStrands; i++) {
      const baseAngle = (Math.PI * 2 * i) / config.webStrands + spinAngle;
      const strandLength = size * (1.5 + Math.sin(time * 0.003 + i) * 0.3);

      ctx.globalAlpha = 0.6 + Math.sin(time * 0.004 + i) * 0.3;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(baseAngle) * size * 0.4,
        Math.sin(baseAngle) * size * 0.4
      );

      // Curved web strand with wobble
      const wobble = Math.sin(time * 0.006 + i * 2) * 0.4;
      const midX = Math.cos(baseAngle + wobble) * strandLength * 0.6;
      const midY = Math.sin(baseAngle + wobble) * strandLength * 0.6;
      const endX = Math.cos(baseAngle - wobble * 0.5) * strandLength;
      const endY = Math.sin(baseAngle - wobble * 0.5) * strandLength;

      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      // Thin connecting threads between strands
      if (i < config.webStrands - 1) {
        const nextAngle = (Math.PI * 2 * (i + 1)) / config.webStrands + spinAngle;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(endX * 0.7, endY * 0.7);
        ctx.lineTo(
          Math.cos(nextAngle) * strandLength * 0.7,
          Math.sin(nextAngle) * strandLength * 0.7
        );
        ctx.stroke();
        ctx.lineWidth = 2;
      }
    }
    ctx.globalAlpha = 1;

    // Dark spinning core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    coreGradient.addColorStop(0, '#1a0000');
    coreGradient.addColorStop(0.5, config.color.primary);
    coreGradient.addColorStop(1, config.color.secondary);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Core ring
    ctx.strokeStyle = config.color.secondary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Inner pulsing eye
    const pulsePhase = (Math.sin(time * 0.008) + 1) / 2;
    const eyeSize = size * 0.2 * (0.8 + pulsePhase * 0.4);
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(0, 0, eyeSize, 0, Math.PI * 2);
    ctx.fill();
  },

  drawAcidBurstProjectile(ctx, config, proj) {
    // Acid burst - irregular green blob with bubbling surface
    const size = config.size;
    const time = Date.now();

    // Toxic glow aura
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
    glowGradient.addColorStop(0, config.color.glow);
    glowGradient.addColorStop(0.6, 'rgba(0, 255, 0, 0.15)');
    glowGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Dripping particles during flight
    if (config.bubbling && typeof ParticleSystem !== 'undefined' && Math.random() < 0.15) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      ParticleSystem.spawn({
        x: proj.x + (Math.random() - 0.5) * size,
        y: proj.y + (Math.random() - 0.5) * size,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 30, // Drip downward
        life: 300 + Math.random() * 200,
        color: config.color.primary,
        size: 2 + Math.random() * 2,
        type: 'glow',
        drag: 0.95,
        decay: 1
      });
    }

    // Irregular blob shape with bubbling surface
    ctx.save();
    ctx.beginPath();

    const blobPoints = 12;
    for (let i = 0; i <= blobPoints; i++) {
      const angle = (Math.PI * 2 * i) / blobPoints;
      // Irregular radius with bubbling effect
      const bubbleOffset = Math.sin(time * 0.008 + i * 1.5) * size * 0.2;
      const baseOffset = Math.sin(i * 2.5) * size * 0.15;
      const radius = size + bubbleOffset + baseOffset;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Fill with toxic gradient
    const blobGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
    blobGradient.addColorStop(0, config.color.secondary);
    blobGradient.addColorStop(0.6, config.color.primary);
    blobGradient.addColorStop(1, config.color.toxic);

    ctx.fillStyle = blobGradient;
    ctx.fill();

    // Highlight edge
    ctx.strokeStyle = config.color.secondary;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    // Surface bubbles
    const bubbleCount = 4;
    for (let i = 0; i < bubbleCount; i++) {
      const bubbleAngle = (Math.PI * 2 * i) / bubbleCount + time * 0.002;
      const bubblePhase = Math.sin(time * 0.01 + i * 2);
      const bubbleDist = size * (0.3 + bubblePhase * 0.2);
      const bubbleSize = size * 0.15 * (0.8 + bubblePhase * 0.4);

      const bx = Math.cos(bubbleAngle) * bubbleDist;
      const by = Math.sin(bubbleAngle) * bubbleDist;

      // Bubble highlight
      const bubbleGradient = ctx.createRadialGradient(
        bx - bubbleSize * 0.3, by - bubbleSize * 0.3, 0,
        bx, by, bubbleSize
      );
      bubbleGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      bubbleGradient.addColorStop(0.5, config.color.secondary);
      bubbleGradient.addColorStop(1, 'rgba(0, 150, 0, 0.3)');

      ctx.fillStyle = bubbleGradient;
      ctx.beginPath();
      ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center toxic core
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.4);
    coreGlow.addColorStop(0, '#99ff99');
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
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
    this.areaEffects = [];
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
  },

  /**
   * Create web snare area effect at impact location
   */
  createWebSnareEffect(x, y, radius = 150, duration = 4000) {
    this.areaEffects.push({
      type: 'web_snare',
      x: x,
      y: y,
      radius: radius,
      startTime: Date.now(),
      duration: duration,
      webPoints: this.generateWebPattern(radius)
    });

    // Spawn particles for impact
    if (typeof ParticleSystem !== 'undefined') {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        ParticleSystem.spawn({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random() * 300,
          color: '#8b0000',
          size: 2 + Math.random() * 3,
          type: 'glow',
          drag: 0.92,
          decay: 1
        });
      }
    }
  },

  /**
   * Generate web pattern points for snare effect
   */
  generateWebPattern(radius) {
    const points = [];
    const rings = 4;
    const spokes = 8;

    // Generate spoke endpoints
    for (let s = 0; s < spokes; s++) {
      const angle = (Math.PI * 2 * s) / spokes;
      points.push({
        type: 'spoke',
        angle: angle,
        endX: Math.cos(angle) * radius,
        endY: Math.sin(angle) * radius
      });
    }

    // Generate ring connection points
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (radius / rings) * r;
      for (let s = 0; s < spokes; s++) {
        const angle = (Math.PI * 2 * s) / spokes;
        points.push({
          type: 'ring',
          ring: r,
          spoke: s,
          x: Math.cos(angle) * ringRadius,
          y: Math.sin(angle) * ringRadius
        });
      }
    }

    return points;
  },

  /**
   * Create acid puddle area effect at impact location
   */
  createAcidPuddleEffect(x, y, radius = 100, duration = 5000) {
    this.areaEffects.push({
      type: 'acid_puddle',
      x: x,
      y: y,
      radius: radius,
      startTime: Date.now(),
      duration: duration,
      bubbles: []
    });

    // Spawn impact particles
    if (typeof ParticleSystem !== 'undefined') {
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 120;
        ParticleSystem.spawn({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 500 + Math.random() * 400,
          color: '#33cc00',
          size: 3 + Math.random() * 4,
          type: 'glow',
          drag: 0.9,
          decay: 1
        });
      }
    }
  },

  /**
   * Update area effects
   */
  updateAreaEffects(dt) {
    const now = Date.now();

    this.areaEffects = this.areaEffects.filter(effect => {
      const elapsed = now - effect.startTime;

      // Spawn periodic particles for acid puddle
      if (effect.type === 'acid_puddle' && typeof ParticleSystem !== 'undefined') {
        if (Math.random() < 0.1) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * effect.radius * 0.8;
          ParticleSystem.spawn({
            x: effect.x + Math.cos(angle) * dist,
            y: effect.y + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 20,
            vy: -30 - Math.random() * 40, // Rise upward
            life: 600 + Math.random() * 400,
            color: '#66ff33',
            size: 2 + Math.random() * 2,
            type: 'glow',
            drag: 0.98,
            decay: 1
          });
        }
      }

      return elapsed < effect.duration;
    });
  },

  /**
   * Draw all area effects
   */
  drawAreaEffects(ctx, camera) {
    for (const effect of this.areaEffects) {
      const screenX = effect.x - camera.x;
      const screenY = effect.y - camera.y;
      const elapsed = Date.now() - effect.startTime;
      const progress = elapsed / effect.duration;

      if (effect.type === 'web_snare') {
        this.drawWebSnareArea(ctx, screenX, screenY, effect, progress);
      } else if (effect.type === 'acid_puddle') {
        this.drawAcidPuddleArea(ctx, screenX, screenY, effect, progress);
      } else if (effect.type === 'melee_impact') {
        this.drawMeleeImpact(ctx, screenX, screenY, effect, progress);
      }
    }
  },

  /**
   * Draw melee impact effect (loader slam, boring drill)
   */
  drawMeleeImpact(ctx, screenX, screenY, effect, progress) {
    const config = effect.config;
    const size = effect.size;
    const fadeOut = 1 - progress;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = fadeOut;

    // Different visuals for different weapon types
    if (effect.weaponType === 'boring_drill') {
      // Drill impact - spinning drill marks and sparks
      const spinAngle = progress * Math.PI * 4; // 2 full rotations

      // Drill hole effect
      const holeGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      holeGradient.addColorStop(0, '#333333');
      holeGradient.addColorStop(0.3, '#999966');
      holeGradient.addColorStop(0.7, '#666644');
      holeGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = holeGradient;
      ctx.beginPath();
      ctx.arc(0, 0, size * (1 - progress * 0.3), 0, Math.PI * 2);
      ctx.fill();

      // Spiral scratch marks
      ctx.strokeStyle = '#D4A017';
      ctx.lineWidth = 3 * fadeOut;
      const spiralCount = 6;
      for (let i = 0; i < spiralCount; i++) {
        const angle = (i / spiralCount) * Math.PI * 2 + spinAngle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5);
        ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
        ctx.stroke();
      }

      // Sparks burst
      if (progress < 0.3 && typeof ParticleSystem !== 'undefined') {
        for (let i = 0; i < 3; i++) {
          const sparkAngle = Math.random() * Math.PI * 2;
          const sparkSpeed = 100 + Math.random() * 200;
          ParticleSystem.spawn(
            effect.x + Math.cos(sparkAngle) * 10,
            effect.y + Math.sin(sparkAngle) * 10,
            {
              type: 'spark',
              color: '#FFD700',
              vx: Math.cos(sparkAngle) * sparkSpeed,
              vy: Math.sin(sparkAngle) * sparkSpeed,
              life: 300
            }
          );
        }
      }
    } else if (effect.weaponType === 'loader_slam') {
      // Loader slam - ground pound shockwave
      const shockSize = size * (0.5 + progress * 0.5);

      // Impact crater
      const craterGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, shockSize);
      craterGradient.addColorStop(0, '#666644');
      craterGradient.addColorStop(0.5, '#D4A01780');
      craterGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = craterGradient;
      ctx.beginPath();
      ctx.arc(0, 0, shockSize, 0, Math.PI * 2);
      ctx.fill();

      // Shockwave ring
      ctx.strokeStyle = `rgba(212, 160, 23, ${fadeOut})`;
      ctx.lineWidth = 4 * fadeOut;
      ctx.beginPath();
      ctx.arc(0, 0, shockSize * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Debris particles
      if (progress < 0.2 && typeof ParticleSystem !== 'undefined') {
        for (let i = 0; i < 5; i++) {
          const debrisAngle = Math.random() * Math.PI * 2;
          ParticleSystem.spawn(
            effect.x,
            effect.y,
            {
              type: 'debris',
              color: '#8B4513',
              vx: Math.cos(debrisAngle) * (50 + Math.random() * 100),
              vy: Math.sin(debrisAngle) * (50 + Math.random() * 100) - 50,
              gravity: 200,
              life: 500,
              size: 3 + Math.random() * 4
            }
          );
        }
      }
    }

    ctx.restore();
  },

  /**
   * Draw web snare area effect
   */
  drawWebSnareArea(ctx, screenX, screenY, effect, progress) {
    const time = Date.now();
    const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    const radius = effect.radius;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = fadeOut * 0.7;

    // Outer boundary ring
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Pulsing glow
    const pulseAlpha = 0.2 + Math.sin(time * 0.003) * 0.1;
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    glowGradient.addColorStop(0, `rgba(139, 0, 0, ${pulseAlpha})`);
    glowGradient.addColorStop(0.7, `rgba(139, 0, 0, ${pulseAlpha * 0.5})`);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw web spokes
    ctx.strokeStyle = '#660033';
    ctx.lineWidth = 2;

    const spokes = 8;
    for (let s = 0; s < spokes; s++) {
      const angle = (Math.PI * 2 * s) / spokes;
      const wobble = Math.sin(time * 0.002 + s) * 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(
        Math.cos(angle) * (radius + wobble),
        Math.sin(angle) * (radius + wobble)
      );
      ctx.stroke();
    }

    // Draw web rings
    ctx.lineWidth = 1.5;
    const rings = 4;
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (radius / rings) * r;
      const ringWobble = Math.sin(time * 0.003 + r) * 3;

      ctx.beginPath();
      for (let s = 0; s <= spokes; s++) {
        const angle = (Math.PI * 2 * s) / spokes;
        const px = Math.cos(angle) * (ringRadius + ringWobble);
        const py = Math.sin(angle) * (ringRadius + ringWobble);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Central web mass
    ctx.fillStyle = 'rgba(74, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Draw acid puddle area effect
   */
  drawAcidPuddleArea(ctx, screenX, screenY, effect, progress) {
    const time = Date.now();
    const fadeOut = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
    const radius = effect.radius * (progress < 0.1 ? progress / 0.1 : 1); // Expand at start

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = fadeOut * 0.8;

    // Bubbling irregular puddle shape
    ctx.beginPath();
    const points = 16;
    for (let i = 0; i <= points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const bubbleOffset = Math.sin(time * 0.005 + i * 2) * radius * 0.1;
      const r = radius + bubbleOffset;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Toxic gradient fill
    const puddleGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    puddleGradient.addColorStop(0, 'rgba(102, 255, 51, 0.6)');
    puddleGradient.addColorStop(0.5, 'rgba(51, 204, 0, 0.5)');
    puddleGradient.addColorStop(0.8, 'rgba(0, 153, 0, 0.4)');
    puddleGradient.addColorStop(1, 'rgba(0, 100, 0, 0.2)');
    ctx.fillStyle = puddleGradient;
    ctx.fill();

    // Edge highlight
    ctx.strokeStyle = 'rgba(102, 255, 51, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rising bubbles
    const bubbleCount = 6;
    for (let i = 0; i < bubbleCount; i++) {
      const bubblePhase = (time * 0.002 + i * 0.5) % 1;
      const bubbleAngle = (Math.PI * 2 * i) / bubbleCount + time * 0.001;
      const bubbleDist = radius * 0.5 * (1 - bubblePhase);
      const bubbleSize = 3 + Math.sin(time * 0.01 + i) * 2;

      const bx = Math.cos(bubbleAngle) * bubbleDist;
      const by = Math.sin(bubbleAngle) * bubbleDist - bubblePhase * 20; // Rise up

      ctx.globalAlpha = fadeOut * (1 - bubblePhase) * 0.6;
      ctx.fillStyle = 'rgba(153, 255, 153, 0.8)';
      ctx.beginPath();
      ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};
