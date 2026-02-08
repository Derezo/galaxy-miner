/**
 * Base Destruction Sequences
 * Multi-phase, faction-specific destruction effects for faction outposts
 *
 * Each destruction sequence runs 5-8 seconds with 4 phases:
 * - Phase 1 (0-1.5s): Initial Damage - shields failing, sparks, warnings
 * - Phase 2 (1.5-4s): Critical Damage - fires, hull breaches, systems failing
 * - Phase 3 (4-6s): Destruction Climax - main explosion/collapse/implosion
 * - Phase 4 (6-8s): Aftermath - debris field, fading effects
 */

const BaseDestructionSequence = {
  // Active destruction sequences
  activeSequences: [],

  // Screen shake state
  screenShake: { x: 0, y: 0, intensity: 0, decay: 0.9 },

  // Phase timing (in milliseconds)
  PHASE_TIMING: {
    phase1End: 1500,
    phase2End: 4000,
    phase3End: 6000,
    phase4End: 8000
  },

  // Screen shake intensities by faction
  SHAKE_INTENSITY: {
    pirate: 6,        // Medium
    scavenger: 3,     // Mild
    swarm: 12,        // Extreme
    void: 15,         // Extreme
    rogue_miner: 7    // Medium
  },

  // Faction-specific effect configurations
  FACTION_CONFIGS: {
    pirate_outpost: {
      faction: 'pirate',
      colors: {
        primary: '#ff3300',
        secondary: '#ff6600',
        accent: '#ffcc00',
        flash: '#ffffff'
      },
      particles: { min: 150, max: 200 },
      debris: { count: 15, burning: true },
      shockwave: true,
      chainExplosions: true
    },

    scavenger_yard: {
      faction: 'scavenger',
      colors: {
        primary: '#666666',
        secondary: '#999999',
        accent: '#cccc00',
        flash: '#ffff00'
      },
      particles: { min: 80, max: 100 },
      debris: { count: 25, metallic: true },
      shockwave: false,
      structuralCollapse: true
    },

    swarm_hive: {
      faction: 'swarm',
      colors: {
        primary: '#1a1a1a',
        secondary: '#0d0d0d',
        accent: '#8b0000',
        flash: '#660000'
      },
      particles: { min: 200, max: 250 },
      debris: { count: 0 },
      shockwave: false,
      organicDissolution: true,
      spores: true
    },

    void_rift: {
      faction: 'void',
      colors: {
        primary: '#9900ff',
        secondary: '#660099',
        accent: '#cc66ff',
        flash: '#000000'
      },
      particles: { min: 120, max: 150 },
      debris: { count: 0 },
      shockwave: false,
      implosion: true,
      realityTear: true
    },

    mining_claim: {
      faction: 'rogue_miner',
      colors: {
        primary: '#ff9900',
        secondary: '#ffcc00',
        accent: '#996600',
        flash: '#ff3300'
      },
      particles: { min: 100, max: 150 },
      debris: { count: 20, metallic: true },
      shockwave: true,
      electricalArcs: true
    }
  },

  init() {
    Logger.log('BaseDestructionSequence initialized');
  },

  /**
   * Trigger a base destruction sequence
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} baseType - Type of base (pirate_outpost, swarm_hive, etc.)
   * @param {number} size - Base size for scaling effects
   */
  trigger(x, y, baseType, size = 80) {
    const config = this.FACTION_CONFIGS[baseType] || this.FACTION_CONFIGS.pirate_outpost;

    const sequence = {
      x,
      y,
      baseType,
      config,
      size,
      startTime: Date.now(),
      phase: 1,
      particles: [],
      debris: [],
      sparks: [],
      chainExplosions: [],

      // Phase-specific state
      shieldFlicker: 1,
      warningLightPhase: 0,
      fireSpots: [],
      shockwaveRadius: 0,
      singularityRadius: 0,
      implosionProgress: 0,

      // Generate initial effects
      completed: false
    };

    // Generate fire spots for phases 2-3
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
      const dist = size * (0.3 + Math.random() * 0.5);
      sequence.fireSpots.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        intensity: 0,
        size: 10 + Math.random() * 15
      });
    }

    this.activeSequences.push(sequence);

    // Initial screen shake
    this.applyScreenShake(config.faction, 0.3);
  },

  /**
   * Apply screen shake based on faction and intensity
   */
  applyScreenShake(faction, intensityMultiplier = 1) {
    const baseIntensity = this.SHAKE_INTENSITY[faction] || 5;
    this.screenShake.intensity = Math.max(
      this.screenShake.intensity,
      baseIntensity * intensityMultiplier
    );
  },

  /**
   * Get current screen shake offset for camera
   */
  getScreenShakeOffset() {
    return { x: this.screenShake.x, y: this.screenShake.y };
  },

  /**
   * Update all active sequences
   */
  update(dt) {
    const now = Date.now();

    // Update screen shake
    if (this.screenShake.intensity > 0.1) {
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * 2;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 2;
      this.screenShake.intensity *= this.screenShake.decay;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
      this.screenShake.intensity = 0;
    }

    // Update each sequence
    this.activeSequences = this.activeSequences.filter(seq => {
      const elapsed = now - seq.startTime;

      // Determine current phase
      const prevPhase = seq.phase;
      if (elapsed < this.PHASE_TIMING.phase1End) {
        seq.phase = 1;
      } else if (elapsed < this.PHASE_TIMING.phase2End) {
        seq.phase = 2;
      } else if (elapsed < this.PHASE_TIMING.phase3End) {
        seq.phase = 3;
      } else if (elapsed < this.PHASE_TIMING.phase4End) {
        seq.phase = 4;
      } else {
        return false; // Sequence complete
      }

      // Phase transition effects
      if (seq.phase !== prevPhase) {
        this.onPhaseTransition(seq, prevPhase, seq.phase);
      }

      // Update based on base type
      switch (seq.baseType) {
        case 'pirate_outpost':
          this.updatePirateOutpost(seq, elapsed, dt);
          break;
        case 'scavenger_yard':
          this.updateScavengerYard(seq, elapsed, dt);
          break;
        case 'swarm_hive':
          this.updateSwarmHive(seq, elapsed, dt);
          break;
        case 'void_rift':
          this.updateVoidRift(seq, elapsed, dt);
          break;
        case 'mining_claim':
          this.updateMiningClaim(seq, elapsed, dt);
          break;
        default:
          this.updatePirateOutpost(seq, elapsed, dt);
      }

      // Update particles
      this.updateParticles(seq, dt);

      // Update debris
      this.updateDebris(seq, dt);

      return true;
    });
  },

  /**
   * Handle phase transitions
   */
  onPhaseTransition(seq, fromPhase, toPhase) {
    const faction = seq.config.faction;

    if (toPhase === 2) {
      // Phase 2: Critical damage begins - medium shake
      this.applyScreenShake(faction, 0.5);
    } else if (toPhase === 3) {
      // Phase 3: Main destruction - maximum shake
      this.applyScreenShake(faction, 1.0);
      this.generateDestructionParticles(seq);
      this.generateDebris(seq);
    } else if (toPhase === 4) {
      // Phase 4: Aftermath - lighter shake
      this.applyScreenShake(faction, 0.3);
    }
  },

  /**
   * Scale a count with the particle multiplier
   */
  scaleCount(baseCount, floor = 1) {
    if (typeof ParticleSystem !== 'undefined' && ParticleSystem.scaleCount) {
      return ParticleSystem.scaleCount(baseCount, floor);
    }
    return Math.max(floor, baseCount);
  },

  /**
   * Generate main destruction particles (phase 3)
   */
  generateDestructionParticles(seq) {
    const config = seq.config;
    const baseCount = config.particles.min +
      Math.random() * (config.particles.max - config.particles.min);
    const count = this.scaleCount(baseCount, 10);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 150 + Math.random() * 200;
      const size = 2 + Math.random() * 6;

      // For implosion effects, particles move inward initially
      const direction = config.implosion ? -1 : 1;

      seq.particles.push({
        x: seq.x + (Math.random() - 0.5) * seq.size,
        y: seq.y + (Math.random() - 0.5) * seq.size,
        vx: Math.cos(angle) * speed * direction,
        vy: Math.sin(angle) * speed * direction,
        size,
        color: this.randomColor(config.colors),
        alpha: 1,
        life: 2000 + Math.random() * 2000,
        born: Date.now()
      });
    }
  },

  /**
   * Generate debris chunks (phase 3)
   */
  generateDebris(seq) {
    const config = seq.config;
    if (!config.debris.count) return;

    const debrisCount = this.scaleCount(config.debris.count, 2);
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.random() * 0.5;
      const speed = 80 + Math.random() * 120;
      const size = 8 + Math.random() * 15;

      seq.debris.push({
        x: seq.x + (Math.random() - 0.5) * seq.size * 0.5,
        y: seq.y + (Math.random() - 0.5) * seq.size * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 3,
        color: config.debris.burning ? config.colors.primary : config.colors.secondary,
        burning: config.debris.burning,
        alpha: 1,
        life: 3000 + Math.random() * 2000,
        born: Date.now()
      });
    }
  },

  /**
   * Update particles physics
   */
  updateParticles(seq, dt) {
    const now = Date.now();

    seq.particles = seq.particles.filter(p => {
      const age = now - p.born;
      if (age > p.life) return false;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.alpha = Math.max(0, 1 - (age / p.life));

      return true;
    });
  },

  /**
   * Update debris physics
   */
  updateDebris(seq, dt) {
    const now = Date.now();

    seq.debris = seq.debris.filter(d => {
      const age = now - d.born;
      if (age > d.life) return false;

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.96;
      d.vy *= 0.96;
      d.rotation += d.rotationSpeed * dt;
      d.alpha = Math.max(0, 1 - (age / d.life) * 0.8);

      return true;
    });
  },

  /**
   * Pick random color from config
   */
  randomColor(colors) {
    const keys = ['primary', 'secondary', 'accent'];
    return colors[keys[Math.floor(Math.random() * keys.length)]];
  },

  // ========================================
  // PIRATE OUTPOST - Fiery Chain Explosions
  // ========================================

  updatePirateOutpost(seq, elapsed, dt) {
    const phase = seq.phase;
    const config = seq.config;

    if (phase === 1) {
      // Shield flickering, red warning lights
      seq.shieldFlicker = 0.3 + Math.random() * 0.7;
      seq.warningLightPhase += dt * 10;

      // Occasional sparks
      if (Math.random() < 0.1) {
        this.spawnSpark(seq, config.colors.accent);
      }
    } else if (phase === 2) {
      // Chain explosions along docking arms
      if (Math.random() < 0.15) {
        this.spawnChainExplosion(seq);
      }

      // Growing fires
      for (const fire of seq.fireSpots) {
        fire.intensity = Math.min(1, fire.intensity + dt * 0.5);
      }

      // More particles
      if (Math.random() < 0.2) {
        this.spawnFireParticle(seq, config.colors);
      }
    } else if (phase === 3) {
      // Massive central explosion
      seq.shockwaveRadius = (elapsed - this.PHASE_TIMING.phase2End) * 0.15;

      // Continuous explosion particles
      if (Math.random() < 0.4) {
        this.spawnExplosionParticle(seq, config.colors);
      }
    } else if (phase === 4) {
      // Cooling embers, smoke
      for (const fire of seq.fireSpots) {
        fire.intensity = Math.max(0, fire.intensity - dt * 0.3);
      }
    }
  },

  spawnSpark(seq, color) {
    const angle = Math.random() * Math.PI * 2;
    const dist = seq.size * (0.3 + Math.random() * 0.7);

    seq.sparks.push({
      x: seq.x + Math.cos(angle) * dist,
      y: seq.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100 - 50,
      color,
      alpha: 1,
      life: 300 + Math.random() * 200,
      born: Date.now()
    });
  },

  spawnChainExplosion(seq) {
    // Explosion along one of three docking arms
    const armAngle = (Math.floor(Math.random() * 3) / 3) * Math.PI * 2;
    const dist = seq.size * (0.5 + Math.random() * 0.5);

    seq.chainExplosions.push({
      x: seq.x + Math.cos(armAngle) * dist,
      y: seq.y + Math.sin(armAngle) * dist,
      radius: 0,
      maxRadius: 30 + Math.random() * 20,
      born: Date.now(),
      life: 500
    });

    // Shake on chain explosion
    this.applyScreenShake('pirate', 0.4);

    // Spawn particles for mini explosion
    for (let i = 0; i < 15; i++) {
      const angle = (Math.PI * 2 * i) / 15;
      const speed = 80 + Math.random() * 60;

      seq.particles.push({
        x: seq.x + Math.cos(armAngle) * dist,
        y: seq.y + Math.sin(armAngle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: seq.config.colors.accent,
        alpha: 1,
        life: 600 + Math.random() * 400,
        born: Date.now()
      });
    }
  },

  spawnFireParticle(seq, colors) {
    const fire = seq.fireSpots[Math.floor(Math.random() * seq.fireSpots.length)];
    if (!fire || fire.intensity < 0.3) return;

    seq.particles.push({
      x: fire.x + (Math.random() - 0.5) * fire.size,
      y: fire.y + (Math.random() - 0.5) * fire.size,
      vx: (Math.random() - 0.5) * 30,
      vy: -30 - Math.random() * 50,
      size: 3 + Math.random() * 5,
      color: Math.random() > 0.5 ? colors.primary : colors.secondary,
      alpha: fire.intensity,
      life: 400 + Math.random() * 400,
      born: Date.now()
    });
  },

  spawnExplosionParticle(seq, colors) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 150;

    seq.particles.push({
      x: seq.x + (Math.random() - 0.5) * 30,
      y: seq.y + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 8,
      color: this.randomColor(colors),
      alpha: 1,
      life: 800 + Math.random() * 800,
      born: Date.now()
    });
  },

  // ========================================
  // SCAVENGER YARD - Structural Collapse
  // ========================================

  updateScavengerYard(seq, elapsed, dt) {
    const phase = seq.phase;

    if (phase === 1) {
      // Structural groaning - debris vibrating
      seq.vibrationOffset = Math.sin(elapsed * 0.02) * 3;

      if (Math.random() < 0.05) {
        this.spawnSpark(seq, seq.config.colors.accent);
      }
    } else if (phase === 2) {
      // Support beams snapping
      if (Math.random() < 0.1) {
        this.spawnMetallicDebris(seq, 1);
        this.applyScreenShake('scavenger', 0.3);
      }
    } else if (phase === 3) {
      // Cascading structural failure
      if (Math.random() < 0.3) {
        this.spawnMetallicDebris(seq, 3);
      }
    }
  },

  spawnMetallicDebris(seq, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = seq.size * Math.random();
      const speed = 40 + Math.random() * 80;

      seq.debris.push({
        x: seq.x + Math.cos(angle) * dist,
        y: seq.y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 12,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 4,
        color: seq.config.colors.secondary,
        metallic: true,
        alpha: 1,
        life: 4000 + Math.random() * 2000,
        born: Date.now()
      });
    }
  },

  // ========================================
  // SWARM HIVE - Organic Dissolution
  // ========================================

  updateSwarmHive(seq, elapsed, dt) {
    const phase = seq.phase;

    if (phase === 1) {
      // Bioluminescent veins dimming
      seq.bioGlow = 0.5 + Math.sin(elapsed * 0.01) * 0.3;
      seq.membranePulse = 1 + Math.sin(elapsed * 0.005) * 0.1;
    } else if (phase === 2) {
      // Pustules bursting
      if (Math.random() < 0.15) {
        this.spawnBioMatter(seq);
      }
      seq.bioGlow = Math.max(0.1, seq.bioGlow - dt * 0.1);
    } else if (phase === 3) {
      // Core rupture - massive bio-explosion
      if (Math.random() < 0.4) {
        this.spawnBioMatter(seq);
        this.spawnSporeCloud(seq);
      }
      seq.dissolveProgress = (elapsed - this.PHASE_TIMING.phase2End) /
        (this.PHASE_TIMING.phase3End - this.PHASE_TIMING.phase2End);
    } else if (phase === 4) {
      // Green mist, spore clouds
      if (Math.random() < 0.1) {
        this.spawnSporeCloud(seq);
      }
    }
  },

  spawnBioMatter(seq) {
    const angle = Math.random() * Math.PI * 2;
    const dist = seq.size * (0.3 + Math.random() * 0.7);
    const speed = 60 + Math.random() * 80;

    // Green organic globs
    for (let i = 0; i < 5; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 0.5;
      seq.particles.push({
        x: seq.x + Math.cos(angle) * dist,
        y: seq.y + Math.sin(angle) * dist,
        vx: Math.cos(spreadAngle) * speed * (0.5 + Math.random()),
        vy: Math.sin(spreadAngle) * speed * (0.5 + Math.random()),
        size: 4 + Math.random() * 8,
        color: seq.config.colors.primary,
        alpha: 0.8,
        life: 1000 + Math.random() * 1000,
        born: Date.now(),
        organic: true
      });
    }
  },

  spawnSporeCloud(seq) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * seq.size;

    seq.particles.push({
      x: seq.x + Math.cos(angle) * dist,
      y: seq.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 20,
      vy: -10 - Math.random() * 30,
      size: 15 + Math.random() * 20,
      color: seq.config.colors.accent + '40',
      alpha: 0.4,
      life: 2000 + Math.random() * 2000,
      born: Date.now(),
      spore: true
    });
  },

  // ========================================
  // VOID RIFT - Reality Tear / Implosion
  // ========================================

  updateVoidRift(seq, elapsed, dt) {
    const phase = seq.phase;

    if (phase === 1) {
      // Portal destabilizing
      seq.destabilization = Math.sin(elapsed * 0.01) * 0.3;
      seq.lightningTimer = (seq.lightningTimer || 0) + dt;

      if (seq.lightningTimer > 0.2) {
        seq.lightningTimer = 0;
        this.spawnLightningArc(seq);
      }
    } else if (phase === 2) {
      // Reality fragments, space distorts
      seq.distortion = (elapsed - this.PHASE_TIMING.phase1End) /
        (this.PHASE_TIMING.phase2End - this.PHASE_TIMING.phase1End);

      if (Math.random() < 0.2) {
        this.spawnLightningArc(seq);
      }
    } else if (phase === 3) {
      // Implosion - everything pulls toward center
      seq.implosionProgress = (elapsed - this.PHASE_TIMING.phase2End) /
        (this.PHASE_TIMING.phase3End - this.PHASE_TIMING.phase2End);
      seq.singularityRadius = seq.size * 0.8 * (1 - seq.implosionProgress);

      // Pull existing particles inward
      for (const p of seq.particles) {
        const dx = seq.x - p.x;
        const dy = seq.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          const pullForce = 200 * seq.implosionProgress / dist;
          p.vx += (dx / dist) * pullForce * dt;
          p.vy += (dy / dist) * pullForce * dt;
        }
      }
    } else if (phase === 4) {
      // Reality heals with flash
      seq.healingProgress = (elapsed - this.PHASE_TIMING.phase3End) /
        (this.PHASE_TIMING.phase4End - this.PHASE_TIMING.phase3End);
    }
  },

  spawnLightningArc(seq) {
    const startAngle = Math.random() * Math.PI * 2;
    const endAngle = startAngle + Math.PI * (0.3 + Math.random() * 0.5);

    seq.sparks.push({
      type: 'lightning',
      x1: seq.x + Math.cos(startAngle) * seq.size * 0.3,
      y1: seq.y + Math.sin(startAngle) * seq.size * 0.3,
      x2: seq.x + Math.cos(endAngle) * seq.size * 0.8,
      y2: seq.y + Math.sin(endAngle) * seq.size * 0.8,
      color: seq.config.colors.accent,
      alpha: 1,
      life: 150,
      born: Date.now()
    });
  },

  // ========================================
  // MINING CLAIM - Industrial Cascade
  // ========================================

  updateMiningClaim(seq, elapsed, dt) {
    const phase = seq.phase;

    if (phase === 1) {
      // Equipment malfunctions, sparks
      if (Math.random() < 0.15) {
        this.spawnElectricalArc(seq);
      }
    } else if (phase === 2) {
      // Fuel tanks rupturing
      if (Math.random() < 0.1) {
        this.spawnFuelExplosion(seq);
      }

      // Growing fires
      for (const fire of seq.fireSpots) {
        fire.intensity = Math.min(1, fire.intensity + dt * 0.4);
      }
    } else if (phase === 3) {
      // Main reactor cascade
      seq.shockwaveRadius = (elapsed - this.PHASE_TIMING.phase2End) * 0.12;

      if (Math.random() < 0.3) {
        this.spawnExplosionParticle(seq, seq.config.colors);
      }
    } else if (phase === 4) {
      // Lingering fires, smoke
      for (const fire of seq.fireSpots) {
        fire.intensity = Math.max(0, fire.intensity - dt * 0.2);
      }
    }
  },

  spawnElectricalArc(seq) {
    const angle = Math.random() * Math.PI * 2;
    const dist = seq.size * (0.2 + Math.random() * 0.3);

    seq.sparks.push({
      type: 'electrical',
      x: seq.x + Math.cos(angle) * dist,
      y: seq.y + Math.sin(angle) * dist,
      segments: this.generateLightningSegments(8),
      color: '#00ffff',
      alpha: 1,
      life: 100,
      born: Date.now()
    });
  },

  generateLightningSegments(count) {
    const segments = [];
    let x = 0, y = 0;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const length = 5 + Math.random() * 10;
      const endX = x + Math.cos(angle) * length;
      const endY = y + Math.sin(angle) * length;
      segments.push({ x1: x, y1: y, x2: endX, y2: endY });
      x = endX;
      y = endY;
    }

    return segments;
  },

  spawnFuelExplosion(seq) {
    const angle = Math.random() * Math.PI * 2;
    const dist = seq.size * (0.4 + Math.random() * 0.4);
    const x = seq.x + Math.cos(angle) * dist;
    const y = seq.y + Math.sin(angle) * dist;

    // Small orange explosion
    for (let i = 0; i < 20; i++) {
      const particleAngle = (Math.PI * 2 * i) / 20;
      const speed = 60 + Math.random() * 40;

      seq.particles.push({
        x,
        y,
        vx: Math.cos(particleAngle) * speed,
        vy: Math.sin(particleAngle) * speed,
        size: 3 + Math.random() * 5,
        color: seq.config.colors.primary,
        alpha: 1,
        life: 500 + Math.random() * 300,
        born: Date.now()
      });
    }

    this.applyScreenShake('rogue_miner', 0.3);
  },

  // ========================================
  // DRAWING
  // ========================================

  /**
   * Draw all active sequences
   */
  draw(ctx, camera) {
    for (const seq of this.activeSequences) {
      const screenX = seq.x - camera.x;
      const screenY = seq.y - camera.y;
      const elapsed = Date.now() - seq.startTime;

      ctx.save();

      // Apply screen shake offset
      ctx.translate(this.screenShake.x, this.screenShake.y);

      // Draw based on base type
      switch (seq.baseType) {
        case 'pirate_outpost':
          this.drawPirateOutpost(ctx, seq, screenX, screenY, elapsed, camera);
          break;
        case 'scavenger_yard':
          this.drawScavengerYard(ctx, seq, screenX, screenY, elapsed, camera);
          break;
        case 'swarm_hive':
          this.drawSwarmHive(ctx, seq, screenX, screenY, elapsed, camera);
          break;
        case 'void_rift':
          this.drawVoidRift(ctx, seq, screenX, screenY, elapsed, camera);
          break;
        case 'mining_claim':
          this.drawMiningClaim(ctx, seq, screenX, screenY, elapsed, camera);
          break;
        default:
          this.drawPirateOutpost(ctx, seq, screenX, screenY, elapsed, camera);
      }

      // Draw common elements
      this.drawParticles(ctx, seq, camera);
      this.drawDebris(ctx, seq, camera);
      this.drawSparks(ctx, seq, camera);

      ctx.restore();
    }
  },

  drawPirateOutpost(ctx, seq, screenX, screenY, elapsed, camera) {
    const phase = seq.phase;
    const colors = seq.config.colors;

    // Phase 1: Flickering shield bubble
    if (phase === 1) {
      ctx.globalAlpha = seq.shieldFlicker * 0.3;
      ctx.strokeStyle = colors.secondary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, seq.size * 1.2, 0, Math.PI * 2);
      ctx.stroke();

      // Warning lights
      const lightOn = Math.sin(seq.warningLightPhase) > 0;
      ctx.fillStyle = lightOn ? '#ff0000' : '#440000';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(screenX + seq.size * 0.6, screenY, 6, 0, Math.PI * 2);
      ctx.arc(screenX - seq.size * 0.6, screenY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phase 2-3: Fire spots
    if (phase >= 2) {
      for (const fire of seq.fireSpots) {
        if (fire.intensity <= 0) continue;

        const fx = fire.x - camera.x;
        const fy = fire.y - camera.y;

        const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, fire.size * fire.intensity);
        gradient.addColorStop(0, colors.accent);
        gradient.addColorStop(0.5, colors.primary + '80');
        gradient.addColorStop(1, 'transparent');

        ctx.globalAlpha = fire.intensity;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fx, fy, fire.size * fire.intensity, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Phase 3: Central shockwave
    if (phase === 3 && seq.shockwaveRadius > 0) {
      const progress = (elapsed - this.PHASE_TIMING.phase2End) /
        (this.PHASE_TIMING.phase3End - this.PHASE_TIMING.phase2End);

      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = colors.flash;
      ctx.lineWidth = 8 * (1 - progress);
      ctx.beginPath();
      ctx.arc(screenX, screenY, seq.shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      const gradient = ctx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, seq.shockwaveRadius * 0.5
      );
      gradient.addColorStop(0, colors.flash);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.globalAlpha = (1 - progress) * 0.5;
      ctx.beginPath();
      ctx.arc(screenX, screenY, seq.shockwaveRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw chain explosions
    const now = Date.now();
    seq.chainExplosions = seq.chainExplosions.filter(exp => {
      const age = now - exp.born;
      if (age > exp.life) return false;

      const progress = age / exp.life;
      exp.radius = exp.maxRadius * Math.sin(progress * Math.PI);

      const ex = exp.x - camera.x;
      const ey = exp.y - camera.y;

      const gradient = ctx.createRadialGradient(ex, ey, 0, ex, ey, exp.radius);
      gradient.addColorStop(0, colors.flash);
      gradient.addColorStop(0.5, colors.accent);
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ex, ey, exp.radius, 0, Math.PI * 2);
      ctx.fill();

      return true;
    });

    ctx.globalAlpha = 1;
  },

  drawScavengerYard(ctx, seq, screenX, screenY, elapsed, camera) {
    const phase = seq.phase;

    // Phase 1: Vibrating structure
    if (phase === 1) {
      const offset = seq.vibrationOffset || 0;
      ctx.translate(offset, offset * 0.5);
    }

    // Phase 3: Dust cloud
    if (phase >= 3) {
      const progress = Math.min(1, (elapsed - this.PHASE_TIMING.phase2End) / 1000);
      const dustRadius = seq.size * (1 + progress);

      const gradient = ctx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, dustRadius
      );
      gradient.addColorStop(0, '#88888840');
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.5 * (1 - progress * 0.5);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, dustRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  drawSwarmHive(ctx, seq, screenX, screenY, elapsed, camera) {
    const phase = seq.phase;
    const colors = seq.config.colors;

    // Bioluminescent glow
    if (seq.bioGlow > 0) {
      const glowRadius = seq.size * (seq.membranePulse || 1);
      const gradient = ctx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, glowRadius
      );
      gradient.addColorStop(0, colors.primary + '80');
      gradient.addColorStop(0.7, colors.secondary + '40');
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = seq.bioGlow;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phase 3: Dissolving membrane
    if (phase === 3 && seq.dissolveProgress) {
      // Draw dissolving edges
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - seq.dissolveProgress;

      const segments = 12;
      for (let i = 0; i < segments; i++) {
        if (Math.random() > seq.dissolveProgress) {
          const angle = (Math.PI * 2 * i) / segments;
          const nextAngle = (Math.PI * 2 * (i + 1)) / segments;
          const r = seq.size * (0.8 + Math.random() * 0.2);

          ctx.beginPath();
          ctx.arc(screenX, screenY, r, angle, nextAngle);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
  },

  drawVoidRift(ctx, seq, screenX, screenY, elapsed, camera) {
    const phase = seq.phase;
    const colors = seq.config.colors;

    // Portal ring
    if (phase <= 2) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.8;

      // Destabilized ring
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const angle = (Math.PI * 2 * i) / 36;
        const wobble = Math.sin(elapsed * 0.01 + i) * seq.size * 0.1 * (seq.destabilization || 0);
        const r = seq.size + wobble;
        const x = screenX + Math.cos(angle) * r;
        const y = screenY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Phase 3: Singularity
    if (phase === 3) {
      const progress = seq.implosionProgress || 0;

      // Growing black center
      const blackRadius = seq.size * 0.2 + seq.size * 0.6 * progress;
      const gradient = ctx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, blackRadius
      );
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.7, colors.secondary);
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, blackRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phase 4: Reality healing flash
    if (phase === 4) {
      const progress = seq.healingProgress || 0;

      if (progress < 0.3) {
        // Bright flash
        const flashIntensity = 1 - (progress / 0.3);
        ctx.globalAlpha = flashIntensity * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX, screenY, seq.size * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  },

  drawMiningClaim(ctx, seq, screenX, screenY, elapsed, camera) {
    const phase = seq.phase;
    const colors = seq.config.colors;

    // Similar to pirate but with industrial colors
    // Fire spots
    if (phase >= 2) {
      for (const fire of seq.fireSpots) {
        if (fire.intensity <= 0) continue;

        const fx = fire.x - camera.x;
        const fy = fire.y - camera.y;

        const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, fire.size * fire.intensity);
        gradient.addColorStop(0, colors.secondary);
        gradient.addColorStop(0.5, colors.primary + '80');
        gradient.addColorStop(1, 'transparent');

        ctx.globalAlpha = fire.intensity;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fx, fy, fire.size * fire.intensity, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Phase 3: Shockwave
    if (phase === 3 && seq.shockwaveRadius > 0) {
      const progress = (elapsed - this.PHASE_TIMING.phase2End) /
        (this.PHASE_TIMING.phase3End - this.PHASE_TIMING.phase2End);

      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = colors.secondary;
      ctx.lineWidth = 6 * (1 - progress);
      ctx.beginPath();
      ctx.arc(screenX, screenY, seq.shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },

  drawParticles(ctx, seq, camera) {
    for (const p of seq.particles) {
      const px = p.x - camera.x;
      const py = p.y - camera.y;

      ctx.globalAlpha = p.alpha;

      if (p.spore) {
        // Large fuzzy spore cloud
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
      } else if (p.organic) {
        // Organic glob with slight glow
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
      } else {
        ctx.fillStyle = p.color;
      }

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  },

  drawDebris(ctx, seq, camera) {
    for (const d of seq.debris) {
      const dx = d.x - camera.x;
      const dy = d.y - camera.y;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(d.rotation);
      ctx.globalAlpha = d.alpha;

      // Draw irregular polygon
      ctx.fillStyle = d.color;
      ctx.beginPath();
      const points = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < points; i++) {
        const angle = (Math.PI * 2 * i) / points;
        const r = d.size * (0.6 + Math.random() * 0.4);
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();

      // Burning effect
      if (d.burning) {
        ctx.fillStyle = '#ffcc00';
        ctx.globalAlpha = d.alpha * 0.5 * (0.5 + Math.random() * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, d.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Metallic highlight
      if (d.metallic) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = d.alpha * 0.3;
        ctx.stroke();
      }

      ctx.restore();
    }
  },

  drawSparks(ctx, seq, camera) {
    const now = Date.now();

    seq.sparks = seq.sparks.filter(s => {
      const age = now - s.born;
      if (age > s.life) return false;

      const progress = age / s.life;
      s.alpha = 1 - progress;

      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;

      if (s.type === 'lightning') {
        // Lightning arc between two points
        const x1 = s.x1 - camera.x;
        const y1 = s.y1 - camera.y;
        const x2 = s.x2 - camera.x;
        const y2 = s.y2 - camera.y;

        ctx.beginPath();
        ctx.moveTo(x1, y1);

        // Jagged lightning
        const segments = 5;
        for (let i = 1; i <= segments; i++) {
          const t = i / segments;
          const mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20;
          const my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20;
          ctx.lineTo(mx, my);
        }
        ctx.stroke();
      } else if (s.type === 'electrical') {
        // Electrical arc with segments
        const sx = s.x - camera.x;
        const sy = s.y - camera.y;

        ctx.beginPath();
        for (const seg of s.segments) {
          ctx.moveTo(sx + seg.x1, sy + seg.y1);
          ctx.lineTo(sx + seg.x2, sy + seg.y2);
        }
        ctx.stroke();
      } else {
        // Regular spark
        if (s.vx !== undefined) {
          s.x += s.vx * 0.016;
          s.y += s.vy * 0.016;
          s.vy += 50 * 0.016; // Gravity
        }

        const sx = s.x - camera.x;
        const sy = s.y - camera.y;

        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      return true;
    });

    ctx.globalAlpha = 1;
  },

  /**
   * Check if any sequences are active
   */
  hasActiveSequences() {
    return this.activeSequences.length > 0;
  }
};
