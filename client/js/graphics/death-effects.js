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
    }
  },

  // Active queen death effects (separate from regular effects)
  activeQueenDeaths: [],

  init() {
    Logger.log('DeathEffects initialized');
  },

  /**
   * Trigger a death effect at position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} effectType - Type of death effect
   * @param {string} faction - Faction for color theming (optional)
   */
  trigger(x, y, effectType, faction = null) {
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

    // Generate particles
    this.generateParticles(effect);

    // Generate debris if applicable
    if (config.debrisCount) {
      this.generateDebris(effect);
    }

    // Generate sparks if applicable
    if (config.sparks) {
      this.generateSparks(effect);
    }

    this.activeEffects.push(effect);
  },

  generateParticles(effect) {
    const config = effect.config;
    const isInward = config.inward;

    for (let i = 0; i < config.particles; i++) {
      const angle = (Math.PI * 2 * i) / config.particles + Math.random() * 0.5;
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

    for (let i = 0; i < config.debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / config.debrisCount + Math.random() * 0.3;
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

    for (let i = 0; i < (config.sparkCount || 10); i++) {
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

  /**
   * Update all active effects
   */
  update(dt) {
    const now = Date.now();

    // Update queen death effects
    this.updateQueenDeaths(dt);

    this.activeEffects = this.activeEffects.filter(effect => {
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

    for (const effect of this.activeEffects) {
      const screenX = effect.x - camera.x;
      const screenY = effect.y - camera.y;
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
  }
};
