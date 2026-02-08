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
    },
    // Scavenger Hauler/Barnacle King - Deconstruction death effect
    deconstruction: {
      warningDuration: 1500,    // 1.5 sec warning phase
      particles: 40,
      colors: ['#D4A017', '#8B4513', '#71797E', '#B87333'], // Yellow/brown/steel/copper
      duration: 1500,           // Total effect duration after warning
      debrisCount: 12,          // More debris than normal
      debrisRotation: true,
      particleSpeed: 400,
      particleSize: { min: 6, max: 18 },
      screenShake: { intensity: 15, duration: 500 },
      warning: {
        shakeIntensity: 3,
        lightColor: '#ff0000',
        lightPulseSpeed: 200    // ms per pulse
      }
    },
    // Swarm Queen - extended grotesque death sequence
    queen_death: {
      duration: 7500,  // 7.5 seconds
      phases: [
        { name: 'thrash_start', start: 0, end: 0.25 },      // 0-1.875s: Legs thrash, rumble
        { name: 'eyes_burst', start: 0.25, end: 0.55 },     // 1.875-4.125s: Eyes pop with ichor
        { name: 'rupture', start: 0.55, end: 0.75 },        // 4.125-5.625s: Abdomen splits
        { name: 'dissolve', start: 0.75, end: 1.0 }         // 5.625-7.5s: Acid dissolution
      ],
      colors: {
        body: '#1a0505',
        ichor: '#8b0000',
        acid: '#44ff44',
        flash: '#ff0000'
      },
      screenShake: { start: 2, peak: 15, duration: 7000 },
      spiderlingCount: 8,
      eyeBurstInterval: 250,  // ms between each eye bursting
      eyeCount: 12
    },
    // Void Leviathan - cosmic horror dimensional tear death
    void_leviathan_death: {
      duration: 5000,  // 5 seconds
      phases: [
        { name: 'rift_collapse', start: 0, end: 0.3 },        // 0-1.5s: Rifts collapse inward
        { name: 'void_implosion', start: 0.3, end: 0.7 },     // 1.5-3.5s: Dark implosion
        { name: 'dimensional_tear', start: 0.7, end: 1.0 }    // 3.5-5s: Reality tears
      ],
      colors: {
        void: '#000000',
        rift: '#660099',
        energy: '#9900ff',
        lightning: '#cc66ff',
        tear: '#ff00ff'
      },
      screenShake: { start: 5, peak: 20, duration: 4500 },
      riftCount: 8,
      lightningCount: 12,
      implosionRadius: 150
    }
  },

  // Active queen death effects (separate from regular effects)
  activeQueenDeaths: [],

  // Active void leviathan death effects
  activeLeviathanDeaths: [],

  init() {
    Logger.log('DeathEffects initialized');
  },

  /**
   * Trigger a death effect at position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} effectType - Type of death effect
   * @param {string} faction - Faction for color theming (optional)
   * @param {object} extraData - Optional extra data (e.g., npc object for deconstruction)
   */
  trigger(x, y, effectType, faction = null, extraData = {}) {
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

    // For deconstruction effect, start with warning phase
    if (effectType === 'deconstruction') {
      effect.phase = 'warning';
      effect.warningStartTime = Date.now();
      effect.rotation = extraData.rotation || 0;
      effect.npcType = extraData.npcType || 'scavenger_hauler';

      // Trigger warning screen shake
      if (typeof Renderer !== 'undefined' && Renderer.triggerScreenShake) {
        Renderer.triggerScreenShake(config.warning.shakeIntensity, config.warningDuration);
      }

      // Play warning alarm sound
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.playAt('notification_warning', x, y);
      }
    } else {
      // Generate particles immediately for non-warning effects
      this.generateParticles(effect);

      // Generate debris if applicable
      if (config.debrisCount) {
        this.generateDebris(effect);
      }

      // Generate sparks if applicable
      if (config.sparks) {
        this.generateSparks(effect);
      }
    }

    this.activeEffects.push(effect);
  },

  generateParticles(effect) {
    const config = effect.config;
    const isInward = config.inward;

    // Apply quality-based particle multiplier
    const qualityMultiplier = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? ParticleSystem.getParticleMultiplier()
      : 1.0;
    const particleCount = Math.max(5, Math.round(config.particles * qualityMultiplier));

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
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

    // Apply quality-based particle multiplier
    const qualityMultiplier = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? ParticleSystem.getParticleMultiplier()
      : 1.0;
    const debrisCount = Math.max(2, Math.round(config.debrisCount * qualityMultiplier));

    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.random() * 0.3;
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

    // Apply quality-based particle multiplier
    const qualityMultiplier = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? ParticleSystem.getParticleMultiplier()
      : 1.0;
    const sparkCount = Math.max(3, Math.round((config.sparkCount || 10) * qualityMultiplier));

    for (let i = 0; i < sparkCount; i++) {
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

  generateDeconstructionParts(effect) {
    // Generate specific mechanical parts for deconstruction effect
    if (!effect.mechanicalParts) {
      effect.mechanicalParts = [];
    }

    // Determine NPC type for size scaling
    const npcType = effect.npcType || 'scavenger_hauler';
    const isBarnacleKing = npcType === 'scavenger_barnacle_king';

    // More part types for grimy industrial junkyard aesthetic
    const partTypes = [
      'bucket', 'wheel', 'hull_plate', 'engine', 'smoke_stack',
      'drill', 'crane_arm', 'cargo_bay', 'tread', 'pipe',
      'gear', 'armor_plate', 'chain'
    ];

    // Barnacle King has more and larger parts
    const partCount = isBarnacleKing ? 16 : 10;
    const sizeMultiplier = isBarnacleKing ? 2.0 : 1.2;

    for (let i = 0; i < partCount; i++) {
      const angle = (Math.PI * 2 * i) / partCount + (Math.random() - 0.5) * 0.5;
      const speed = (isBarnacleKing ? 350 : 250) + Math.random() * 200; // Faster for larger ships
      const partType = partTypes[i % partTypes.length];

      effect.mechanicalParts.push({
        type: partType,
        x: effect.x + (Math.random() - 0.5) * 30,
        y: effect.y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * (isBarnacleKing ? 6 : 8),
        size: (10 + Math.random() * 10) * sizeMultiplier,
        alpha: 1,
        color: effect.config.colors[Math.floor(Math.random() * effect.config.colors.length)],
        // Add smoke trail data
        smokeTrail: true,
        lastSmokeTime: 0,
        smokeInterval: 50 + Math.random() * 50
      });
    }
  },

  /**
   * Update all active effects
   */
  update(dt) {
    const now = Date.now();

    // Update queen death effects
    this.updateQueenDeaths(dt);

    // Update void leviathan death effects
    this.updateLeviathanDeaths(dt);

    this.activeEffects = this.activeEffects.filter(effect => {
      // Handle deconstruction warning phase
      if (effect.type === 'deconstruction' && effect.phase === 'warning') {
        const warningElapsed = now - effect.warningStartTime;

        if (warningElapsed >= effect.config.warningDuration) {
          // Transition to explosion phase
          effect.phase = 'explosion';
          effect.startTime = now;

          // Generate explosion particles and debris
          this.generateParticles(effect);
          this.generateDebris(effect);
          this.generateDeconstructionParts(effect);

          // Trigger explosion screen shake
          if (typeof Renderer !== 'undefined' && Renderer.triggerScreenShake) {
            Renderer.triggerScreenShake(
              effect.config.screenShake.intensity,
              effect.config.screenShake.duration
            );
          }
        }

        return true; // Keep effect active during warning
      }

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

      // Update mechanical parts (for deconstruction effect)
      if (effect.mechanicalParts) {
        const now = Date.now();
        for (const m of effect.mechanicalParts) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          m.vx *= 0.95;
          m.vy *= 0.95;
          m.rotation += m.rotationSpeed * dt;
          m.alpha = Math.max(0, 1 - progress * 0.7);

          // Spawn smoke trail particles for flying parts
          if (m.smokeTrail && m.alpha > 0.3 && typeof ParticleSystem !== 'undefined') {
            if (now - m.lastSmokeTime > m.smokeInterval) {
              m.lastSmokeTime = now;
              // Smoke particle
              ParticleSystem.spawn({
                x: m.x,
                y: m.y,
                vx: -m.vx * 0.1 + (Math.random() - 0.5) * 20,
                vy: -m.vy * 0.1 + (Math.random() - 0.5) * 20 - 15,
                life: 600 + Math.random() * 400,
                color: '#555555',
                size: 4 + Math.random() * 4,
                decay: 0.85,
                drag: 0.97,
                type: 'smoke',
                gravity: -8
              });
              // Occasional spark - scale spawn chance with quality
              const sparkChance = ParticleSystem.getParticleMultiplier ? 0.3 * ParticleSystem.getParticleMultiplier() : 0.3;
              if (Math.random() < sparkChance) {
                ParticleSystem.spawn({
                  x: m.x,
                  y: m.y,
                  vx: (Math.random() - 0.5) * 60,
                  vy: (Math.random() - 0.5) * 60,
                  life: 200 + Math.random() * 200,
                  color: '#FF6B35',
                  size: 2 + Math.random() * 2,
                  decay: 0.9,
                  drag: 0.99,
                  type: 'spark'
                });
              }
            }
          }
        }
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
    // Draw queen death effects (rendered behind normal effects)
    this.drawQueenDeaths(ctx, camera);

    // Draw void leviathan death effects
    this.drawLeviathanDeaths(ctx, camera);

    for (const effect of this.activeEffects) {
      const screenX = effect.x - camera.x;
      const screenY = effect.y - camera.y;

      // Handle deconstruction warning phase rendering
      if (effect.type === 'deconstruction' && effect.phase === 'warning') {
        this.drawDeconstructionWarning(ctx, effect, screenX, screenY);
        continue;
      }

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

      // Draw mechanical parts (for deconstruction effect)
      if (effect.mechanicalParts) {
        for (const m of effect.mechanicalParts) {
          const mx = m.x - camera.x;
          const my = m.y - camera.y;

          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(m.rotation);
          ctx.globalAlpha = m.alpha;

          this.drawMechanicalPart(ctx, m.type, m.size, m.color);

          ctx.restore();
        }
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
  },

  /**
   * Draw deconstruction warning phase
   */
  drawDeconstructionWarning(ctx, effect, screenX, screenY) {
    const now = Date.now();
    const warningElapsed = now - effect.warningStartTime;
    const warningProgress = warningElapsed / effect.config.warningDuration;

    // Calculate shake offset
    const shakeIntensity = effect.config.warning.shakeIntensity;
    const shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    const shakeY = (Math.random() - 0.5) * shakeIntensity * 2;

    ctx.save();
    ctx.translate(screenX + shakeX, screenY + shakeY);
    ctx.rotate(effect.rotation);

    // Draw the ship (simplified Hauler/Barnacle King shape)
    // Use NPC ship geometry if available
    if (typeof NPCShipGeometry !== 'undefined') {
      const SIZE = NPCShipGeometry.SIZE * 1.8; // Boss size multiplier
      const colors = NPCShipGeometry.FACTION_COLORS.scavenger;

      // Draw simplified ship hull
      ctx.fillStyle = colors.hull;
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 2;

      // Hauler shape (simplified)
      ctx.beginPath();
      ctx.moveTo(SIZE * 1.0, -SIZE * 0.1);
      ctx.lineTo(SIZE * 0.7, -SIZE * 0.5);
      ctx.lineTo(-SIZE * 0.8, -SIZE * 0.5);
      ctx.lineTo(-SIZE * 0.8, SIZE * 0.5);
      ctx.lineTo(SIZE * 0.7, SIZE * 0.5);
      ctx.lineTo(SIZE * 1.0, SIZE * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw rotating red warning beacon on top
    const pulsePhase = (now / effect.config.warning.lightPulseSpeed) % (Math.PI * 2);
    const pulseIntensity = 0.5 + Math.sin(pulsePhase) * 0.5;

    const beaconGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
    beaconGradient.addColorStop(0, effect.config.warning.lightColor);
    beaconGradient.addColorStop(0.3, effect.config.warning.lightColor + 'cc');
    beaconGradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = pulseIntensity;
    ctx.fillStyle = beaconGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();

    // Draw smaller rotating beacon light
    ctx.globalAlpha = 1;
    const beaconRotation = (now * 0.01) % (Math.PI * 2);
    ctx.save();
    ctx.rotate(beaconRotation);
    ctx.fillStyle = effect.config.warning.lightColor;
    ctx.beginPath();
    ctx.arc(0, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Optional steam/smoke particles during warning - scale spawn chance with quality
    const steamChance = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? 0.1 * ParticleSystem.getParticleMultiplier()
      : 0.1;
    if (Math.random() < steamChance && typeof ParticleSystem !== 'undefined') {
      const offsetX = (Math.random() - 0.5) * 30;
      const offsetY = (Math.random() - 0.5) * 30;

      ParticleSystem.spawn({
        x: effect.x + offsetX,
        y: effect.y + offsetY,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 30,
        life: 400 + Math.random() * 200,
        color: '#999999',
        size: 4 + Math.random() * 4,
        type: 'smoke',
        drag: 0.98,
        decay: 1
      });
    }

    ctx.restore();
  },

  /**
   * Draw a mechanical part for deconstruction effect
   */
  drawMechanicalPart(ctx, type, size, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    switch (type) {
      case 'bucket':
        // Excavator bucket shape
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.6);
        ctx.lineTo(size * 0.4, -size * 0.6);
        ctx.lineTo(size * 0.6, size * 0.2);
        ctx.lineTo(size * 0.2, size * 0.6);
        ctx.lineTo(-size * 0.2, size * 0.6);
        ctx.lineTo(-size * 0.6, size * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Teeth
        ctx.fillStyle = '#666666';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * size * 0.25, size * 0.6);
          ctx.lineTo(i * size * 0.25 - size * 0.08, size * 0.8);
          ctx.lineTo(i * size * 0.25 + size * 0.08, size * 0.8);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'wheel':
        // Tread/wheel
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner hub
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Spokes
        ctx.strokeStyle = '#333333';
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
          ctx.stroke();
        }
        break;

      case 'hull_plate':
        // Rectangular hull plate
        ctx.fillRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.6);
        ctx.strokeRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.6);

        // Rivets
        ctx.fillStyle = '#555555';
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            ctx.beginPath();
            ctx.arc(
              -size * 0.4 + i * size * 0.4,
              -size * 0.15 + j * size * 0.3,
              size * 0.05,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
        break;

      case 'engine':
        // Engine block
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.5);
        ctx.lineTo(size * 0.4, -size * 0.5);
        ctx.lineTo(size * 0.3, size * 0.5);
        ctx.lineTo(-size * 0.3, size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Exhaust pipes
        ctx.fillStyle = '#444444';
        ctx.fillRect(-size * 0.2, -size * 0.7, size * 0.15, size * 0.3);
        ctx.fillRect(size * 0.05, -size * 0.7, size * 0.15, size * 0.3);
        break;

      case 'smoke_stack':
        // Industrial smoke stack
        ctx.fillRect(-size * 0.2, -size * 0.8, size * 0.4, size * 1.0);
        ctx.strokeRect(-size * 0.2, -size * 0.8, size * 0.4, size * 1.0);

        // Top rim
        ctx.fillStyle = '#555555';
        ctx.fillRect(-size * 0.25, -size * 0.8, size * 0.5, size * 0.1);

        // Bands
        ctx.fillStyle = '#666666';
        ctx.fillRect(-size * 0.2, -size * 0.4, size * 0.4, size * 0.08);
        ctx.fillRect(-size * 0.2, 0, size * 0.4, size * 0.08);
        break;

      case 'drill':
        // Boring drill piece
        ctx.beginPath();
        ctx.moveTo(size * 0.6, 0);
        ctx.lineTo(size * 0.2, -size * 0.3);
        ctx.lineTo(-size * 0.4, -size * 0.25);
        ctx.lineTo(-size * 0.5, 0);
        ctx.lineTo(-size * 0.4, size * 0.25);
        ctx.lineTo(size * 0.2, size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Drill grooves
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(size * (0.4 - i * 0.25), -size * 0.2);
          ctx.lineTo(size * (0.3 - i * 0.25), size * 0.2);
          ctx.stroke();
        }
        break;

      case 'crane_arm':
        // Crane arm segment
        ctx.fillRect(-size * 0.6, -size * 0.1, size * 1.2, size * 0.2);
        ctx.strokeRect(-size * 0.6, -size * 0.1, size * 1.2, size * 0.2);

        // Joint at end
        ctx.fillStyle = '#444444';
        ctx.beginPath();
        ctx.arc(size * 0.55, 0, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'cargo_bay':
        // Cargo container
        ctx.fillRect(-size * 0.5, -size * 0.35, size * 1.0, size * 0.7);
        ctx.strokeRect(-size * 0.5, -size * 0.35, size * 1.0, size * 0.7);

        // Door lines
        ctx.strokeStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.35);
        ctx.lineTo(0, size * 0.35);
        ctx.stroke();

        // Handle
        ctx.fillStyle = '#666666';
        ctx.fillRect(size * 0.1, -size * 0.05, size * 0.15, size * 0.1);
        break;

      case 'tread':
        // Tank tread segment
        ctx.fillRect(-size * 0.5, -size * 0.15, size * 1.0, size * 0.3);
        ctx.strokeRect(-size * 0.5, -size * 0.15, size * 1.0, size * 0.3);

        // Tread teeth
        ctx.fillStyle = '#333333';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-size * 0.4 + i * size * 0.25, size * 0.15, size * 0.15, size * 0.1);
        }
        break;

      case 'pipe':
        // Rusty pipe section
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.15, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rust patches
        ctx.fillStyle = '#A0522D';
        ctx.beginPath();
        ctx.ellipse(size * 0.05, -size * 0.2, size * 0.08, size * 0.1, 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'gear':
        // Gear with teeth
        const teeth = 8;
        const innerR = size * 0.3;
        const outerR = size * 0.5;
        ctx.beginPath();
        for (let t = 0; t < teeth; t++) {
          const tAngle = (t / teeth) * Math.PI * 2;
          const nextAngle = ((t + 0.5) / teeth) * Math.PI * 2;
          if (t === 0) {
            ctx.moveTo(Math.cos(tAngle) * outerR, Math.sin(tAngle) * outerR);
          } else {
            ctx.lineTo(Math.cos(tAngle) * outerR, Math.sin(tAngle) * outerR);
          }
          ctx.lineTo(Math.cos(nextAngle) * innerR, Math.sin(nextAngle) * innerR);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Center hole
        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'armor_plate':
        // Irregular armor plate with bolt holes
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, -size * 0.3);
        ctx.lineTo(size * 0.4, -size * 0.35);
        ctx.lineTo(size * 0.5, size * 0.2);
        ctx.lineTo(-size * 0.3, size * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bolt holes
        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.arc(-size * 0.25, -size * 0.1, size * 0.06, 0, Math.PI * 2);
        ctx.arc(size * 0.2, size * 0.1, size * 0.06, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'chain':
        // Chain segment (3 links)
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = size * 0.08;
        for (let i = 0; i < 3; i++) {
          const offsetX = (i - 1) * size * 0.3;
          ctx.beginPath();
          ctx.ellipse(offsetX, 0, size * 0.12, size * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      default:
        // Generic debris
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
  },

  // ============================================
  // SWARM QUEEN DEATH SEQUENCE
  // ============================================

  /**
   * Trigger the extended queen death sequence
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} phase - Queen's phase at death (for color theming)
   * @param {number} rotation - Queen's rotation at death
   */
  triggerQueenDeath(x, y, phase = 'HUNT', rotation = 0) {
    const config = this.EFFECT_CONFIGS.queen_death;

    const effect = {
      x,
      y,
      rotation,
      queenPhase: phase,
      config,
      startTime: Date.now(),
      currentPhase: 'thrash_start',

      // Leg state for thrashing animation
      legs: [],
      legBaseAngles: [],

      // Eye state for burst sequence
      eyes: [],
      eyesBurst: 0,
      lastEyeBurst: 0,

      // Spiderling particles
      spiderlings: [],

      // Acid dissolution particles
      acidParticles: [],

      // Body state
      bodyScale: 1,
      bodyAlpha: 1,
      ruptureProgress: 0,

      // Screen shake state
      shakeIntensity: config.screenShake.start
    };

    // Initialize 8 legs with random offsets
    for (let i = 0; i < 8; i++) {
      const baseAngle = (Math.PI * 2 * i) / 8;
      effect.legBaseAngles.push(baseAngle);
      effect.legs.push({
        angle: baseAngle,
        length: 60 + Math.random() * 20,
        thrashOffset: Math.random() * Math.PI * 2,
        curled: false
      });
    }

    // Initialize 12 eyes
    const eyePositions = [
      { x: 0.35, y: -0.08 }, { x: 0.35, y: 0.08 },     // Primary pair
      { x: 0.42, y: -0.04 }, { x: 0.42, y: 0.04 },     // Secondary pair
      { x: 0.38, y: -0.12 }, { x: 0.38, y: 0.12 },     // Tertiary pairs
      { x: 0.32, y: -0.15 }, { x: 0.32, y: 0.15 },
      { x: 0.28, y: -0.11 }, { x: 0.28, y: 0.11 },
      { x: 0.25, y: -0.06 }, { x: 0.25, y: 0.06 }
    ];
    for (const pos of eyePositions) {
      effect.eyes.push({
        x: pos.x * 80,  // Scale to body size
        y: pos.y * 80,
        burst: false,
        ichorParticles: []
      });
    }

    this.activeQueenDeaths.push(effect);

    // Trigger initial screen shake
    if (typeof Renderer !== 'undefined' && Renderer.triggerScreenShake) {
      Renderer.triggerScreenShake(config.screenShake.start, config.duration);
    }

    Logger.log('Queen death sequence triggered at', x, y);
  },

  /**
   * Update all active queen death effects
   */
  updateQueenDeaths(dt) {
    const now = Date.now();

    this.activeQueenDeaths = this.activeQueenDeaths.filter(effect => {
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.config.duration;

      if (progress >= 1) {
        return false; // Remove completed effect
      }

      // Determine current phase
      for (const phase of effect.config.phases) {
        if (progress >= phase.start && progress < phase.end) {
          effect.currentPhase = phase.name;
          break;
        }
      }

      // Update based on current phase
      switch (effect.currentPhase) {
        case 'thrash_start':
          this.updateQueenThrash(effect, progress, dt);
          break;
        case 'eyes_burst':
          this.updateQueenEyesBurst(effect, progress, dt, now);
          break;
        case 'rupture':
          this.updateQueenRupture(effect, progress, dt);
          break;
        case 'dissolve':
          this.updateQueenDissolve(effect, progress, dt);
          break;
      }

      // Update screen shake intensity
      const shakeConfig = effect.config.screenShake;
      if (progress < 0.55) {
        // Ramp up shake
        effect.shakeIntensity = shakeConfig.start +
          (shakeConfig.peak - shakeConfig.start) * (progress / 0.55);
      } else if (progress < 0.75) {
        // Peak shake during rupture
        effect.shakeIntensity = shakeConfig.peak;
      } else {
        // Fade out shake
        const fadeProgress = (progress - 0.75) / 0.25;
        effect.shakeIntensity = shakeConfig.peak * (1 - fadeProgress);
      }

      // Update screen shake
      if (typeof Renderer !== 'undefined' && Renderer.setScreenShake) {
        Renderer.setScreenShake(effect.shakeIntensity);
      }

      // Update ichor particles
      for (const eye of effect.eyes) {
        for (const p of eye.ichorParticles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 50 * dt; // Gravity
          p.alpha -= dt * 0.8;
        }
        eye.ichorParticles = eye.ichorParticles.filter(p => p.alpha > 0);
      }

      // Update spiderlings
      for (const s of effect.spiderlings) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rotation += s.rotationSpeed * dt;
        s.alpha -= dt * 0.3;
      }
      effect.spiderlings = effect.spiderlings.filter(s => s.alpha > 0);

      // Update acid particles
      for (const a of effect.acidParticles) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.vy -= 20 * dt; // Bubbles rise
        a.alpha -= dt * 0.5;
        a.size += dt * 2; // Expand as they rise
      }
      effect.acidParticles = effect.acidParticles.filter(a => a.alpha > 0);

      return true;
    });
  },

  updateQueenThrash(effect, progress, dt) {
    // Violent leg thrashing
    const thrashIntensity = 1 + progress * 2; // Increases over time

    for (let i = 0; i < effect.legs.length; i++) {
      const leg = effect.legs[i];
      const time = Date.now() * 0.015;

      // Erratic movement combining multiple frequencies
      leg.angle = leg.thrashOffset +
        Math.sin(time + i) * 0.4 * thrashIntensity +
        Math.sin(time * 2.3 + i * 1.5) * 0.3 * thrashIntensity +
        Math.sin(time * 3.7 + i * 0.8) * 0.2 * thrashIntensity;

      // Legs extend and contract
      leg.length = 60 + Math.sin(time * 1.5 + i) * 15 * thrashIntensity;
    }

    // Body convulses
    effect.bodyScale = 1 + Math.sin(Date.now() * 0.02) * 0.05 * thrashIntensity;
  },

  updateQueenEyesBurst(effect, progress, dt, now) {
    // Continue leg thrashing but slower
    for (let i = 0; i < effect.legs.length; i++) {
      const leg = effect.legs[i];
      const time = Date.now() * 0.008;
      leg.angle = leg.thrashOffset + Math.sin(time + i) * 0.2;
    }

    // Burst eyes one by one
    const phaseProgress = (progress - 0.25) / 0.3; // 0 to 1 within this phase
    const targetBurstCount = Math.floor(phaseProgress * effect.config.eyeCount);

    if (effect.eyesBurst < targetBurstCount &&
        now - effect.lastEyeBurst > effect.config.eyeBurstInterval) {
      // Burst next eye
      const eyeIndex = effect.eyesBurst;
      if (eyeIndex < effect.eyes.length) {
        const eye = effect.eyes[eyeIndex];
        eye.burst = true;
        effect.lastEyeBurst = now;
        effect.eyesBurst++;

        // Spawn ichor particles
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 80 + Math.random() * 120;
          eye.ichorParticles.push({
            x: eye.x,
            y: eye.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 50, // Upward bias
            size: 3 + Math.random() * 4,
            alpha: 1
          });
        }
      }
    }
  },

  updateQueenRupture(effect, progress, dt) {
    // Legs begin to stiffen
    for (let i = 0; i < effect.legs.length; i++) {
      const leg = effect.legs[i];
      const time = Date.now() * 0.005;
      leg.angle = leg.thrashOffset + Math.sin(time + i) * 0.1;
    }

    // Rupture progress within this phase
    const phaseProgress = (progress - 0.55) / 0.2;
    effect.ruptureProgress = phaseProgress;

    // Spawn spiderlings during rupture
    if (effect.spiderlings.length < effect.config.spiderlingCount &&
        Math.random() < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      effect.spiderlings.push({
        x: effect.x,
        y: effect.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 8 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        alpha: 1
      });
    }

    // Body begins to shrink/collapse
    effect.bodyScale = 1 - phaseProgress * 0.2;
  },

  updateQueenDissolve(effect, progress, dt) {
    // Legs curl inward (death curl)
    const phaseProgress = (progress - 0.75) / 0.25;

    for (let i = 0; i < effect.legs.length; i++) {
      const leg = effect.legs[i];
      if (!leg.curled) {
        leg.curled = true;
        leg.curlStart = effect.legBaseAngles[i];
      }
      // Curl toward body center
      const targetAngle = Math.atan2(0, 0); // Toward center
      leg.angle = leg.curlStart + (targetAngle - leg.curlStart) * phaseProgress * 0.5;
      leg.length = 60 * (1 - phaseProgress * 0.6);
    }

    // Body melts
    effect.bodyScale = 0.8 - phaseProgress * 0.6;
    effect.bodyAlpha = 1 - phaseProgress;

    // Spawn acid dissolution particles
    if (Math.random() < 0.3) {
      const offsetX = (Math.random() - 0.5) * 60 * effect.bodyScale;
      const offsetY = (Math.random() - 0.5) * 60 * effect.bodyScale;
      effect.acidParticles.push({
        x: effect.x + offsetX,
        y: effect.y + offsetY,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30, // Rise up
        size: 4 + Math.random() * 6,
        alpha: 0.8
      });
    }
  },

  /**
   * Draw all active queen death effects
   */
  drawQueenDeaths(ctx, camera) {
    for (const effect of this.activeQueenDeaths) {
      const screenX = effect.x - camera.x;
      const screenY = effect.y - camera.y;
      const progress = (Date.now() - effect.startTime) / effect.config.duration;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(effect.rotation);

      // Draw based on current phase
      switch (effect.currentPhase) {
        case 'thrash_start':
        case 'eyes_burst':
          this.drawQueenThrashing(ctx, effect, progress);
          break;
        case 'rupture':
          this.drawQueenRupturing(ctx, effect, progress);
          break;
        case 'dissolve':
          this.drawQueenDissolving(ctx, effect, progress);
          break;
      }

      ctx.restore();

      // Draw spiderlings (in world space)
      this.drawSpiderlings(ctx, effect, camera);

      // Draw acid particles (in world space)
      this.drawAcidParticles(ctx, effect, camera);
    }
  },

  drawQueenThrashing(ctx, effect, progress) {
    const colors = effect.config.colors;
    const scale = effect.bodyScale;

    // Draw legs
    for (const leg of effect.legs) {
      ctx.save();
      ctx.rotate(leg.angle);

      // Leg segments with organic bend
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(30 * scale, 0);
      ctx.quadraticCurveTo(
        50 * scale, leg.length * 0.3 * scale,
        leg.length * scale, leg.length * 0.8 * scale
      );
      ctx.stroke();

      // Claw at end
      ctx.fillStyle = '#330000';
      ctx.beginPath();
      ctx.arc(leg.length * scale, leg.length * 0.8 * scale, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw body (dark thorax + abdomen)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50 * scale);
    gradient.addColorStop(0, '#2a0a0a');
    gradient.addColorStop(0.7, colors.body);
    gradient.addColorStop(1, '#0a0202');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50 * scale, 35 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Abdomen
    ctx.fillStyle = '#150505';
    ctx.beginPath();
    ctx.ellipse(-30 * scale, 0, 35 * scale, 30 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw eyes
    this.drawQueenEyes(ctx, effect, scale);
  },

  drawQueenEyes(ctx, effect, scale) {
    const colors = effect.config.colors;

    for (let i = 0; i < effect.eyes.length; i++) {
      const eye = effect.eyes[i];

      if (eye.burst) {
        // Draw burst socket (dark hollow)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(eye.x * scale, eye.y * scale, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw ichor particles
        ctx.fillStyle = colors.ichor;
        for (const p of eye.ichorParticles) {
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(
            (eye.x + p.x) * scale,
            (eye.y + p.y) * scale,
            p.size, 0, Math.PI * 2
          );
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // Draw intact eye
        const eyeRadius = i < 2 ? 7 : i < 4 ? 5 : 3;

        // Outer glow
        ctx.fillStyle = '#660000';
        ctx.beginPath();
        ctx.arc(eye.x * scale, eye.y * scale, eyeRadius + 2, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(eye.x * scale, eye.y * scale, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pupil (dilated in death)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(eye.x * scale, eye.y * scale, eyeRadius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  drawQueenRupturing(ctx, effect, progress) {
    const colors = effect.config.colors;
    const scale = effect.bodyScale;
    const rupture = effect.ruptureProgress;

    // Draw legs (stiffer)
    for (const leg of effect.legs) {
      ctx.save();
      ctx.rotate(leg.angle);

      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(30 * scale, 0);
      ctx.lineTo(leg.length * scale, leg.length * 0.6 * scale);
      ctx.stroke();

      ctx.restore();
    }

    // Draw body with rupture
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50 * scale);
    gradient.addColorStop(0, '#2a0a0a');
    gradient.addColorStop(0.7, colors.body);
    gradient.addColorStop(1, '#0a0202');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50 * scale, 35 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw rupture wound
    if (rupture > 0) {
      const woundWidth = rupture * 30;
      const woundHeight = rupture * 20;

      // Dark wound opening
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(-10, 0, woundWidth, woundHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing ichor inside wound
      const ichorGradient = ctx.createRadialGradient(-10, 0, 0, -10, 0, woundWidth);
      ichorGradient.addColorStop(0, colors.ichor);
      ichorGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = ichorGradient;
      ctx.beginPath();
      ctx.ellipse(-10, 0, woundWidth * 0.7, woundHeight * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw burst eyes
    this.drawQueenEyes(ctx, effect, scale);
  },

  drawQueenDissolving(ctx, effect, progress) {
    const colors = effect.config.colors;
    const scale = effect.bodyScale;
    const alpha = effect.bodyAlpha;

    ctx.globalAlpha = alpha;

    // Draw curled legs
    for (const leg of effect.legs) {
      ctx.save();
      ctx.rotate(leg.angle);

      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 4 * alpha;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(20 * scale, 0);
      ctx.quadraticCurveTo(
        30 * scale, 10 * scale,
        leg.length * scale * 0.5, 20 * scale
      );
      ctx.stroke();

      ctx.restore();
    }

    // Draw melting body
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 40 * scale);
    gradient.addColorStop(0, colors.ichor);
    gradient.addColorStop(0.5, colors.body);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 40 * scale, 30 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    // Acid hissing effect around body
    const hissRadius = 60 * (1 + (1 - alpha) * 0.5);
    const hissGradient = ctx.createRadialGradient(0, 0, hissRadius * 0.5, 0, 0, hissRadius);
    hissGradient.addColorStop(0, 'transparent');
    hissGradient.addColorStop(0.7, colors.acid + '40');
    hissGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = hissGradient;
    ctx.beginPath();
    ctx.arc(0, 0, hissRadius, 0, Math.PI * 2);
    ctx.fill();
  },

  drawSpiderlings(ctx, effect, camera) {
    const colors = effect.config.colors;

    for (const s of effect.spiderlings) {
      const sx = s.x - camera.x;
      const sy = s.y - camera.y;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.alpha;

      // Small spider shape
      ctx.fillStyle = colors.body;

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, s.size * 0.6, s.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 8 tiny legs
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * s.size, Math.sin(angle) * s.size * 0.8);
        ctx.stroke();
      }

      ctx.restore();
    }
  },

  drawAcidParticles(ctx, effect, camera) {
    const colors = effect.config.colors;

    ctx.fillStyle = colors.acid;
    for (const a of effect.acidParticles) {
      const ax = a.x - camera.x;
      const ay = a.y - camera.y;

      ctx.globalAlpha = a.alpha * 0.7;
      ctx.beginPath();
      ctx.arc(ax, ay, a.size, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.globalAlpha = a.alpha * 0.4;
      ctx.beginPath();
      ctx.arc(ax, ay, a.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  /**
   * Check if any queen death is active (for blocking respawn, etc.)
   */
  isQueenDeathActive() {
    return this.activeQueenDeaths.length > 0;
  },

  // ============================================
  // VOID LEVIATHAN DEATH SEQUENCE
  // ============================================

  /**
   * Trigger the void leviathan death sequence
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} rotation - Leviathan's rotation at death
   */
  triggerLeviathanDeath(x, y, rotation = 0) {
    const config = this.EFFECT_CONFIGS.void_leviathan_death;

    const effect = {
      x,
      y,
      rotation,
      config,
      startTime: Date.now(),
      currentPhase: 'rift_collapse',

      // Rift particles for collapse phase
      rifts: [],

      // Lightning arcs
      lightningArcs: [],

      // Implosion particles
      implosionParticles: [],

      // Dimensional tear cracks
      tearCracks: [],

      // Effect state
      implosionRadius: 0,
      coreSize: 80,
      shakeIntensity: config.screenShake.start
    };

    // Initialize collapsing rifts around the Leviathan
    for (let i = 0; i < config.riftCount; i++) {
      const angle = (i / config.riftCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      effect.rifts.push({
        angle,
        distance: 100 + Math.random() * 50,
        size: 30 + Math.random() * 20,
        rotation: Math.random() * Math.PI * 2,
        collapsed: false
      });
    }

    // Initialize lightning arcs
    for (let i = 0; i < config.lightningCount; i++) {
      effect.lightningArcs.push({
        startAngle: Math.random() * Math.PI * 2,
        endAngle: Math.random() * Math.PI * 2,
        segments: this.generateLightningSegments(5),
        intensity: 0.5 + Math.random() * 0.5,
        active: false
      });
    }

    this.activeLeviathanDeaths.push(effect);

    // Trigger screen shake
    if (typeof Renderer !== 'undefined' && Renderer.triggerScreenShake) {
      Renderer.triggerScreenShake(config.screenShake.start, config.duration);
    }

    // Play void death sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('void_leviathan_death', x, y);
    }

    Logger.log('Void Leviathan death sequence triggered at', x, y);
  },

  /**
   * Generate jagged lightning segment offsets
   */
  generateLightningSegments(count) {
    const segments = [];
    for (let i = 0; i < count; i++) {
      segments.push({
        offset: (Math.random() - 0.5) * 40,
        phase: Math.random() * Math.PI * 2
      });
    }
    return segments;
  },

  /**
   * Update all active leviathan death effects
   */
  updateLeviathanDeaths(dt) {
    const now = Date.now();

    this.activeLeviathanDeaths = this.activeLeviathanDeaths.filter(effect => {
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.config.duration;

      if (progress >= 1) {
        return false; // Remove completed effect
      }

      // Determine current phase
      for (const phase of effect.config.phases) {
        if (progress >= phase.start && progress < phase.end) {
          effect.currentPhase = phase.name;
          break;
        }
      }

      // Update based on current phase
      switch (effect.currentPhase) {
        case 'rift_collapse':
          this.updateLeviathanRiftCollapse(effect, progress, dt);
          break;
        case 'void_implosion':
          this.updateLeviathanImplosion(effect, progress, dt);
          break;
        case 'dimensional_tear':
          this.updateLeviathanTear(effect, progress, dt);
          break;
      }

      // Update screen shake
      const shakeConfig = effect.config.screenShake;
      if (progress < 0.3) {
        effect.shakeIntensity = shakeConfig.start + (shakeConfig.peak - shakeConfig.start) * (progress / 0.3);
      } else if (progress < 0.7) {
        effect.shakeIntensity = shakeConfig.peak;
      } else {
        const fadeProgress = (progress - 0.7) / 0.3;
        effect.shakeIntensity = shakeConfig.peak * (1 - fadeProgress);
      }

      if (typeof Renderer !== 'undefined' && Renderer.setScreenShake) {
        Renderer.setScreenShake(effect.shakeIntensity);
      }

      // Update implosion particles
      for (const p of effect.implosionParticles) {
        // Pull toward center
        const dx = effect.x - p.x;
        const dy = effect.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          p.vx += (dx / dist) * 200 * dt;
          p.vy += (dy / dist) * 200 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= dt * 0.5;
      }
      effect.implosionParticles = effect.implosionParticles.filter(p => p.alpha > 0);

      return true;
    });
  },

  /**
   * Phase 1: Rifts collapse inward (0-30%)
   */
  updateLeviathanRiftCollapse(effect, progress, dt) {
    const phaseProgress = progress / 0.3;

    // Collapse rifts toward center
    for (const rift of effect.rifts) {
      if (!rift.collapsed) {
        rift.distance = (100 + Math.random() * 50) * (1 - phaseProgress);
        rift.size = (30 + Math.random() * 20) * (1 - phaseProgress * 0.5);
        rift.rotation += dt * 2;

        if (phaseProgress > 0.8) {
          rift.collapsed = true;
        }
      }
    }

    // Core pulses larger
    effect.coreSize = 80 + Math.sin(Date.now() * 0.01) * 20 * (1 + phaseProgress);

    // Spawn particles being pulled in
    if (Math.random() < 0.4) {
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = 150 + Math.random() * 100;
      effect.implosionParticles.push({
        x: effect.x + Math.cos(spawnAngle) * spawnDist,
        y: effect.y + Math.sin(spawnAngle) * spawnDist,
        vx: 0,
        vy: 0,
        size: 3 + Math.random() * 4,
        color: effect.config.colors.energy,
        alpha: 1
      });
    }
  },

  /**
   * Phase 2: Void implosion (30-70%)
   */
  updateLeviathanImplosion(effect, progress, dt) {
    const phaseProgress = (progress - 0.3) / 0.4;

    // Core shrinks dramatically
    effect.coreSize = 80 * (1 - phaseProgress * 0.9);

    // Implosion radius expands then contracts
    if (phaseProgress < 0.5) {
      effect.implosionRadius = effect.config.implosionRadius * (phaseProgress * 2);
    } else {
      effect.implosionRadius = effect.config.implosionRadius * (1 - (phaseProgress - 0.5) * 2);
    }

    // Activate lightning arcs
    for (const arc of effect.lightningArcs) {
      arc.active = Math.random() < 0.5;
      if (arc.active) {
        arc.startAngle = Math.random() * Math.PI * 2;
        arc.endAngle = arc.startAngle + (Math.random() - 0.5) * Math.PI;
        arc.segments = this.generateLightningSegments(5);
      }
    }

    // More intense particle pull
    if (Math.random() < 0.6) {
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = effect.implosionRadius + 50;
      effect.implosionParticles.push({
        x: effect.x + Math.cos(spawnAngle) * spawnDist,
        y: effect.y + Math.sin(spawnAngle) * spawnDist,
        vx: 0,
        vy: 0,
        size: 4 + Math.random() * 5,
        color: Math.random() > 0.5 ? effect.config.colors.energy : effect.config.colors.lightning,
        alpha: 1
      });
    }
  },

  /**
   * Phase 3: Dimensional tear (70-100%)
   */
  updateLeviathanTear(effect, progress, dt) {
    const phaseProgress = (progress - 0.7) / 0.3;

    // Generate tear cracks that expand outward
    if (effect.tearCracks.length < 12 && Math.random() < 0.2) {
      const angle = Math.random() * Math.PI * 2;
      effect.tearCracks.push({
        angle,
        length: 0,
        maxLength: 80 + Math.random() * 120,
        width: 2 + Math.random() * 3,
        segments: this.generateLightningSegments(4)
      });
    }

    // Extend tear cracks
    for (const crack of effect.tearCracks) {
      if (crack.length < crack.maxLength) {
        crack.length += dt * 200;
      }
    }

    // Core explodes outward at end
    effect.coreSize = 10 + phaseProgress * 100;

    // Final burst of particles - scale spawn chance with quality
    const burstChance = typeof ParticleSystem !== 'undefined' && ParticleSystem.getParticleMultiplier
      ? Math.min(1, 0.8 * ParticleSystem.getParticleMultiplier())
      : 0.8;
    if (phaseProgress > 0.5 && Math.random() < burstChance) {
      const burstAngle = Math.random() * Math.PI * 2;
      const burstSpeed = 200 + Math.random() * 300;

      if (typeof ParticleSystem !== 'undefined') {
        ParticleSystem.spawn({
          x: effect.x,
          y: effect.y,
          vx: Math.cos(burstAngle) * burstSpeed,
          vy: Math.sin(burstAngle) * burstSpeed,
          color: effect.config.colors.tear,
          size: 4 + Math.random() * 4,
          life: 500,
          type: 'glow',
          decay: 1.2,
          drag: 0.96
        });
      }
    }
  },

  /**
   * Draw all active leviathan death effects
   */
  drawLeviathanDeaths(ctx, camera) {
    for (const effect of this.activeLeviathanDeaths) {
      const screenX = effect.x - camera.x;
      const screenY = effect.y - camera.y;
      const progress = (Date.now() - effect.startTime) / effect.config.duration;

      ctx.save();
      ctx.translate(screenX, screenY);

      switch (effect.currentPhase) {
        case 'rift_collapse':
          this.drawLeviathanRiftCollapse(ctx, effect, progress);
          break;
        case 'void_implosion':
          this.drawLeviathanImplosion(ctx, effect, progress);
          break;
        case 'dimensional_tear':
          this.drawLeviathanTear(ctx, effect, progress);
          break;
      }

      ctx.restore();

      // Draw implosion particles (world space)
      this.drawLeviathanParticles(ctx, effect, camera);
    }
  },

  /**
   * Draw rift collapse phase
   */
  drawLeviathanRiftCollapse(ctx, effect, progress) {
    const colors = effect.config.colors;

    // Draw collapsing rifts
    for (const rift of effect.rifts) {
      if (rift.collapsed) continue;

      ctx.save();
      ctx.rotate(rift.angle);
      ctx.translate(rift.distance, 0);
      ctx.rotate(rift.rotation);

      // Rift portal
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rift.size);
      gradient.addColorStop(0, colors.void);
      gradient.addColorStop(0.6, colors.rift + '80');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, rift.size, rift.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Edge glow
      ctx.strokeStyle = colors.energy;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rift.size, rift.size * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Central void core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effect.coreSize);
    coreGradient.addColorStop(0, colors.void);
    coreGradient.addColorStop(0.5, colors.rift);
    coreGradient.addColorStop(0.8, colors.energy + '60');
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, effect.coreSize, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing edge
    const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    ctx.strokeStyle = colors.energy;
    ctx.lineWidth = 3 * pulse;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, 0, effect.coreSize * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /**
   * Draw void implosion phase
   */
  drawLeviathanImplosion(ctx, effect, progress) {
    const colors = effect.config.colors;
    const phaseProgress = (progress - 0.3) / 0.4;

    // Implosion ring
    if (effect.implosionRadius > 0) {
      const ringAlpha = 0.8 - phaseProgress * 0.6;

      ctx.strokeStyle = colors.energy;
      ctx.lineWidth = 4;
      ctx.globalAlpha = ringAlpha;
      ctx.beginPath();
      ctx.arc(0, 0, effect.implosionRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner ring
      ctx.strokeStyle = colors.rift;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, effect.implosionRadius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Lightning arcs
    ctx.strokeStyle = colors.lightning;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.lightning;
    ctx.shadowBlur = 10;

    for (const arc of effect.lightningArcs) {
      if (!arc.active) continue;

      ctx.globalAlpha = arc.intensity;
      this.drawVoidLightningArc(ctx, arc, effect.implosionRadius * 0.8);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Shrinking core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effect.coreSize);
    coreGradient.addColorStop(0, colors.void);
    coreGradient.addColorStop(0.4, colors.rift);
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, effect.coreSize, 0, Math.PI * 2);
    ctx.fill();

    // Intense bright ring at core edge
    ctx.strokeStyle = colors.lightning;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, effect.coreSize, 0, Math.PI * 2);
    ctx.stroke();
  },

  /**
   * Draw dimensional tear phase
   */
  drawLeviathanTear(ctx, effect, progress) {
    const colors = effect.config.colors;
    const phaseProgress = (progress - 0.7) / 0.3;

    // Draw tear cracks radiating outward
    ctx.strokeStyle = colors.tear;
    ctx.lineWidth = 3;
    ctx.shadowColor = colors.tear;
    ctx.shadowBlur = 15;

    for (const crack of effect.tearCracks) {
      ctx.beginPath();
      ctx.moveTo(0, 0);

      let px = 0, py = 0;
      const segments = 5;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const segDist = crack.length * t;
        const seg = crack.segments[Math.min(i - 1, crack.segments.length - 1)];
        const jitter = seg ? seg.offset * 0.5 : 0;
        const perpAngle = crack.angle + Math.PI / 2;

        px = Math.cos(crack.angle) * segDist + Math.cos(perpAngle) * jitter;
        py = Math.sin(crack.angle) * segDist + Math.sin(perpAngle) * jitter;
        ctx.lineTo(px, py);
      }

      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Expanding explosion core
    const fadeAlpha = 1 - phaseProgress;
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effect.coreSize);
    coreGradient.addColorStop(0, colors.tear);
    coreGradient.addColorStop(0.3, colors.lightning + '80');
    coreGradient.addColorStop(0.6, colors.energy + '40');
    coreGradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = fadeAlpha;
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, effect.coreSize, 0, Math.PI * 2);
    ctx.fill();

    // Final flash at very end
    if (phaseProgress > 0.8) {
      const flashIntensity = (phaseProgress - 0.8) / 0.2;
      ctx.globalAlpha = (1 - flashIntensity) * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, effect.coreSize * 1.5 * flashIntensity, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Draw a void lightning arc
   */
  drawVoidLightningArc(ctx, arc, radius) {
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(arc.startAngle) * 10,
      Math.sin(arc.startAngle) * 10
    );

    const segments = arc.segments.length;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const r = radius * t;
      const angle = arc.startAngle + (arc.endAngle - arc.startAngle) * t;
      const seg = arc.segments[i - 1];
      const jitter = seg ? seg.offset : 0;
      const perpAngle = angle + Math.PI / 2;

      const x = Math.cos(angle) * r + Math.cos(perpAngle) * jitter;
      const y = Math.sin(angle) * r + Math.sin(perpAngle) * jitter;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  },

  /**
   * Draw implosion particles
   */
  drawLeviathanParticles(ctx, effect, camera) {
    for (const p of effect.implosionParticles) {
      const px = p.x - camera.x;
      const py = p.y - camera.y;

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.5, p.color + '80');
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Check if any leviathan death is active
   */
  isLeviathanDeathActive() {
    return this.activeLeviathanDeaths.length > 0;
  }
};
