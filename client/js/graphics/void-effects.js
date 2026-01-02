/**
 * Void Effects System
 * Visual effects for Void Rift faction: particles, rifts, gravity well, tendrils
 * Uses VOID_PARTICLE_CONFIG and VOID_RIFT_VISUALS from shared constants
 */

// Import constants in browser environment
const VoidConfig = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : {};

/**
 * VoidParticles - Dark swirling particles orbiting void NPCs
 * Tier-based intensity with dynamic state multipliers
 */
const VoidParticles = {
  // Active particle sets per NPC
  npcParticles: new Map(),

  // Color palette from constants (fallback if not loaded)
  colors: {
    primary: '#660099',
    secondary: '#330066',
    accent: '#aa00ff',
    core: '#000000',
    edge: '#4400661a'
  },

  /**
   * Initialize or update particles for an NPC
   * @param {string} npcId - NPC identifier
   * @param {string} npcType - void_whisper, void_shadow, void_phantom, void_leviathan
   * @param {string} state - patrol, combat, or low_health
   */
  initNPC(npcId, npcType, state = 'patrol') {
    const config = VoidConfig.VOID_PARTICLE_CONFIG || {};
    const tierConfig = config.tiers?.[npcType] || { base: 5, combat: 1.5, lowHealth: 2.0 };
    const colorConfig = config.colors || this.colors;

    // Calculate particle count based on state
    let count = tierConfig.base;
    if (state === 'combat') count *= tierConfig.combat;
    if (state === 'low_health') count *= tierConfig.lowHealth;
    count = Math.floor(count);

    // Apply graphics settings multiplier
    if (typeof ParticleSystem !== 'undefined') {
      count = Math.max(2, Math.floor(count * ParticleSystem.getParticleMultiplier()));
    }

    // Create particle data
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        angle: (i / count) * Math.PI * 2,
        radius: this.randomRange(15, 35),
        speed: this.randomRange(0.8, 1.5),
        size: this.randomRange(2, 5),
        offset: Math.random() * Math.PI * 2,
        color: this.pickColor(colorConfig)
      });
    }

    this.npcParticles.set(npcId, {
      particles,
      npcType,
      state,
      lastUpdate: Date.now()
    });
  },

  /**
   * Update NPC state (changes particle behavior)
   */
  updateState(npcId, newState) {
    const data = this.npcParticles.get(npcId);
    if (data && data.state !== newState) {
      // Reinitialize with new state for different intensity
      this.initNPC(npcId, data.npcType, newState);
    }
  },

  /**
   * Remove NPC particles (on death/despawn)
   */
  removeNPC(npcId) {
    this.npcParticles.delete(npcId);
  },

  /**
   * Draw particles for an NPC
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Screen X position
   * @param {number} y - Screen Y position
   * @param {string} npcId - NPC identifier
   * @param {number} shipRotation - NPC rotation in radians
   */
  draw(ctx, x, y, npcId, shipRotation = 0) {
    const data = this.npcParticles.get(npcId);
    if (!data) return;

    const now = Date.now();
    const config = VoidConfig.VOID_PARTICLE_CONFIG || {};
    const speedConfig = config.orbitSpeed || { patrol: 1.0, combat: 2.5, lowHealth: 4.0 };
    const speed = speedConfig[data.state] || 1.0;

    ctx.save();

    for (const p of data.particles) {
      // Update orbit angle
      p.angle += speed * 0.003;

      // Calculate position with slight wobble
      const wobble = Math.sin(now * 0.002 + p.offset) * 3;
      const currentRadius = p.radius + wobble;
      const px = x + Math.cos(p.angle) * currentRadius;
      const py = y + Math.sin(p.angle) * currentRadius;

      // Draw dark particle with subtle glow
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.5, p.color + '80');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core void black center
      ctx.fillStyle = this.colors.core;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  /**
   * Utility: pick a random color from palette
   */
  pickColor(colorConfig) {
    const colors = [colorConfig.primary, colorConfig.secondary];
    // Occasionally use accent
    if (Math.random() < 0.15) colors.push(colorConfig.accent);
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * Utility: random range
   */
  randomRange(min, max) {
    return min + Math.random() * (max - min);
  },

  /**
   * Cleanup particles for NPCs that no longer exist
   * Call periodically to prevent memory leaks
   */
  cleanup() {
    if (typeof Entities === 'undefined' || !Entities.npcs) return;

    const existingNpcIds = new Set(Object.keys(Entities.npcs));
    for (const npcId of this.npcParticles.keys()) {
      if (!existingNpcIds.has(npcId)) {
        this.npcParticles.delete(npcId);
      }
    }
  }
};


/**
 * RiftPortal - Tier-specific rift portal visuals
 * Whisper: elliptical, Shadow: organic, Phantom: jagged, Leviathan: chaotic
 */
const RiftPortal = {
  // Active rifts
  activeRifts: new Map(),

  /**
   * Create a rift portal
   * @param {string} riftId - Unique rift identifier
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} npcType - void_whisper, void_shadow, void_phantom, void_leviathan
   * @param {string} state - spawn, idle, combat, retreat, close
   */
  create(riftId, x, y, npcType, state = 'spawn') {
    const config = VoidConfig.VOID_RIFT_VISUALS?.[npcType] || {
      type: 'elliptical',
      segments: 32,
      size: 40,
      colors: { edge: '#660099', interior: '#00000080' }
    };

    this.activeRifts.set(riftId, {
      x,
      y,
      npcType,
      state,
      config,
      spawnTime: Date.now(),
      stateTime: Date.now(),
      scale: state === 'spawn' ? 0 : 1,
      rotation: Math.random() * Math.PI * 2,
      // For jagged/chaotic types
      crackAngles: this.generateCrackAngles(config)
    });
  },

  /**
   * Update rift state
   */
  setState(riftId, newState) {
    const rift = this.activeRifts.get(riftId);
    if (rift) {
      rift.state = newState;
      rift.stateTime = Date.now();
    }
  },

  /**
   * Remove a rift (closing animation should be triggered first)
   */
  remove(riftId) {
    this.activeRifts.delete(riftId);
  },

  /**
   * Generate crack angles for jagged/chaotic rifts
   */
  generateCrackAngles(config) {
    const count = config.crackCount || config.shatterCount || 5;
    const angles = [];
    for (let i = 0; i < count; i++) {
      angles.push({
        angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
        length: 0.5 + Math.random() * 0.5,
        jitter: Math.random() * Math.PI
      });
    }
    return angles;
  },

  /**
   * Update all rifts (animations)
   */
  update(deltaTime) {
    const now = Date.now();

    for (const [riftId, rift] of this.activeRifts) {
      const elapsed = now - rift.stateTime;

      // Handle state transitions
      switch (rift.state) {
        case 'spawn':
          // Expand over 500ms
          rift.scale = Math.min(1, elapsed / 500);
          if (rift.scale >= 1) rift.state = 'idle';
          break;

        case 'close':
          // Contract over 400ms then remove
          rift.scale = Math.max(0, 1 - elapsed / 400);
          if (rift.scale <= 0) {
            this.activeRifts.delete(riftId);
          }
          break;

        case 'combat':
          // Pulsing expansion
          rift.scale = 1 + Math.sin(now * 0.003) * 0.15;
          break;

        case 'retreat':
          // Faster pulsing
          rift.scale = 1 + Math.sin(now * 0.006) * 0.2;
          break;

        default: // idle
          rift.scale = 1 + Math.sin(now * 0.001) * 0.05;
      }

      // Slow rotation
      rift.rotation += 0.001 * deltaTime;
    }
  },

  /**
   * Draw all active rifts
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera - { x, y }
   */
  draw(ctx, camera) {
    for (const [riftId, rift] of this.activeRifts) {
      const screenX = rift.x - camera.x;
      const screenY = rift.y - camera.y;

      // Skip if off-screen
      if (screenX < -200 || screenX > ctx.canvas.width + 200 ||
          screenY < -200 || screenY > ctx.canvas.height + 200) {
        continue;
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(rift.rotation);
      ctx.scale(rift.scale, rift.scale);

      switch (rift.config.type) {
        case 'elliptical':
          this.drawElliptical(ctx, rift);
          break;
        case 'organic':
          this.drawOrganic(ctx, rift);
          break;
        case 'jagged':
          this.drawJagged(ctx, rift);
          break;
        case 'chaotic':
          this.drawChaotic(ctx, rift);
          break;
      }

      ctx.restore();
    }
  },

  /**
   * Elliptical rift (void_whisper) - clean portal
   */
  drawElliptical(ctx, rift) {
    const { size, colors } = rift.config;

    // Interior void
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.7, colors.interior);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Edge glow
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.edge;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  },

  /**
   * Organic rift (void_shadow) - pulsing fissure
   */
  drawOrganic(ctx, rift) {
    const { size, colors, pulseSpeed, breatheAmount } = rift.config;
    const now = Date.now();
    const pulse = 1 + Math.sin(now * pulseSpeed * 0.001) * breatheAmount;

    // Irregular organic shape
    ctx.beginPath();
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble = Math.sin(angle * 3 + now * 0.002) * 0.2;
      const r = size * pulse * (0.8 + wobble);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r * 0.6;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Fill with void
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * pulse);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.6, colors.interior);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Glowing edge
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 3;
    ctx.shadowColor = colors.edge;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
  },

  /**
   * Jagged rift (void_phantom) - shattered glass cracks
   */
  drawJagged(ctx, rift) {
    const { size, colors, crackDepth } = rift.config;

    // Draw cracks radiating outward
    ctx.strokeStyle = colors.cracks || colors.edge;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.edge;
    ctx.shadowBlur = 8;

    for (const crack of rift.crackAngles) {
      const now = Date.now();
      const flicker = Math.sin(now * 0.005 + crack.jitter) * 0.1;
      const len = size * crack.length * (1 + flicker);

      ctx.beginPath();
      ctx.moveTo(0, 0);

      // Jagged path
      const segments = 4;
      for (let i = 1; i <= segments; i++) {
        const segLen = (len / segments) * i;
        const jitter = (i < segments) ? (Math.sin(i * 2.5 + now * 0.003) * size * crackDepth) : 0;
        const perpAngle = crack.angle + Math.PI / 2;
        const x = Math.cos(crack.angle) * segLen + Math.cos(perpAngle) * jitter;
        const y = Math.sin(crack.angle) * segLen + Math.sin(perpAngle) * jitter;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Central void
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.8, colors.interior);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  },

  /**
   * Chaotic rift (void_leviathan) - converging nightmare
   */
  drawChaotic(ctx, rift) {
    const { size, colors, convergenceSpeed } = rift.config;
    const now = Date.now();

    // Multiple converging cracks
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (const crack of rift.crackAngles) {
      const pulse = Math.sin(now * convergenceSpeed * 0.001 + crack.jitter);

      // Outer crack with energy glow
      ctx.strokeStyle = colors.energy;
      ctx.shadowColor = colors.energy;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      const outerLen = size * crack.length * (1.2 + pulse * 0.3);

      // Chaotic path with multiple jitters
      let px = 0, py = 0;
      ctx.moveTo(0, 0);
      for (let i = 1; i <= 5; i++) {
        const segLen = (outerLen / 5) * i;
        const jitter1 = Math.sin(i * 3 + now * 0.004 + crack.jitter) * size * 0.15;
        const jitter2 = Math.cos(i * 2 + now * 0.003) * size * 0.1;
        const perpAngle = crack.angle + Math.PI / 2;

        px = Math.cos(crack.angle) * segLen + Math.cos(perpAngle) * (jitter1 + jitter2);
        py = Math.sin(crack.angle) * segLen + Math.sin(perpAngle) * (jitter1 + jitter2);
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Inner crack line
      ctx.strokeStyle = colors.cracks;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Central chaotic void - larger and more intense
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.7);
    gradient.addColorStop(0, colors.interior);
    gradient.addColorStop(0.5, colors.interior + 'cc');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Swirling void energy
    ctx.strokeStyle = colors.edge + '60';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const swirl = now * 0.002 + i * Math.PI * 0.66;
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.3 + i * 0.1), swirl, swirl + Math.PI * 0.8);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }
};


/**
 * GravityWellEffect - Warning and active phases for Leviathan ability
 */
const GravityWellEffect = {
  activeWells: new Map(),

  /**
   * Create gravity well effect
   * @param {string} wellId - Unique identifier
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} phase - warning, active, or end
   * @param {number} radius - Effect radius
   */
  create(wellId, x, y, phase, radius) {
    const config = VoidConfig.VOID_LEVIATHAN_ABILITIES?.GRAVITY_WELL || {
      warningDuration: 1500,
      activeDuration: 4000,
      radius: 300,
      colors: {
        warning: '#660099',
        vortex: '#9900ff',
        lightning: '#cc66ff',
        core: '#000000'
      }
    };

    this.activeWells.set(wellId, {
      x,
      y,
      phase,
      radius: radius || config.radius,
      config,
      startTime: Date.now(),
      rotation: 0,
      lightningArcs: this.generateLightningArcs(5)
    });
  },

  /**
   * Update well phase
   */
  setPhase(wellId, newPhase) {
    const well = this.activeWells.get(wellId);
    if (well) {
      well.phase = newPhase;
      well.startTime = Date.now();
      if (newPhase === 'active') {
        well.lightningArcs = this.generateLightningArcs(8);
      }
    }
  },

  /**
   * Remove gravity well
   */
  remove(wellId) {
    this.activeWells.delete(wellId);
  },

  /**
   * Generate lightning arc paths
   */
  generateLightningArcs(count) {
    const arcs = [];
    for (let i = 0; i < count; i++) {
      const segments = [];
      const segmentCount = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < segmentCount; j++) {
        segments.push({
          angle: (j / segmentCount) * Math.PI * 0.5 + (Math.random() - 0.5) * 0.3,
          length: 0.15 + Math.random() * 0.2
        });
      }
      arcs.push({
        baseAngle: (i / count) * Math.PI * 2,
        segments,
        intensity: 0.5 + Math.random() * 0.5
      });
    }
    return arcs;
  },

  /**
   * Update all gravity wells
   */
  update(deltaTime) {
    for (const [wellId, well] of this.activeWells) {
      well.rotation += 0.003 * deltaTime;

      // Update lightning arcs periodically
      if (well.phase === 'active' && Math.random() < 0.05) {
        const arcIndex = Math.floor(Math.random() * well.lightningArcs.length);
        well.lightningArcs[arcIndex] = this.generateLightningArcs(1)[0];
        well.lightningArcs[arcIndex].baseAngle = (arcIndex / well.lightningArcs.length) * Math.PI * 2;
      }
    }
  },

  /**
   * Draw all gravity wells
   */
  draw(ctx, camera) {
    for (const [wellId, well] of this.activeWells) {
      const screenX = well.x - camera.x;
      const screenY = well.y - camera.y;

      // Skip if off-screen
      const margin = well.radius + 100;
      if (screenX < -margin || screenX > ctx.canvas.width + margin ||
          screenY < -margin || screenY > ctx.canvas.height + margin) {
        continue;
      }

      ctx.save();
      ctx.translate(screenX, screenY);

      if (well.phase === 'warning') {
        this.drawWarning(ctx, well);
      } else if (well.phase === 'active') {
        this.drawActive(ctx, well);
      } else if (well.phase === 'end') {
        this.drawEnd(ctx, well);
      }

      ctx.restore();
    }
  },

  /**
   * Warning phase - rift forming, energy crackling
   */
  drawWarning(ctx, well) {
    const { radius, config, startTime } = well;
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / config.warningDuration);

    // Expanding warning circle
    ctx.strokeStyle = config.colors.warning;
    ctx.lineWidth = 2 + progress * 2;
    ctx.setLineDash([10, 10]);
    ctx.globalAlpha = 0.5 + progress * 0.3;

    ctx.beginPath();
    ctx.arc(0, 0, radius * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing center
    const pulse = Math.sin(elapsed * 0.01) * 0.2 + 0.8;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50 * progress);
    gradient.addColorStop(0, config.colors.core);
    gradient.addColorStop(0.7, config.colors.warning + '80');
    gradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = progress * pulse;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 50 * progress, 0, Math.PI * 2);
    ctx.fill();

    // Small crackling energy
    if (progress > 0.3) {
      ctx.strokeStyle = config.colors.lightning;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;

      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + elapsed * 0.002;
        this.drawLightningArc(ctx, 0, 0, angle, radius * 0.3 * progress);
      }
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Active phase - swirling vortex, purple lightning
   */
  drawActive(ctx, well) {
    const { radius, config, rotation, lightningArcs } = well;
    const now = Date.now();

    // Swirling vortex rings
    ctx.save();
    ctx.rotate(rotation);

    for (let i = 0; i < 5; i++) {
      const ringRadius = radius * (0.3 + i * 0.15);
      const alpha = 0.6 - i * 0.1;
      const arcStart = (now * 0.002 + i * 0.5) % (Math.PI * 2);

      ctx.strokeStyle = config.colors.vortex;
      ctx.lineWidth = 3 - i * 0.4;
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, arcStart, arcStart + Math.PI * 1.5);
      ctx.stroke();
    }

    ctx.restore();

    // Damage zone indicator - bright center, fading edge
    const damageGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    damageGradient.addColorStop(0, config.colors.core);
    damageGradient.addColorStop(0.25, config.colors.warning + '60');
    damageGradient.addColorStop(0.5, config.colors.vortex + '30');
    damageGradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = damageGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Lightning arcs
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = config.colors.lightning;
    ctx.lineWidth = 2;
    ctx.shadowColor = config.colors.lightning;
    ctx.shadowBlur = 10;

    for (const arc of lightningArcs) {
      const arcAngle = arc.baseAngle + rotation;
      this.drawLightningArc(ctx, 0, 0, arcAngle, radius * 0.9 * arc.intensity);
    }

    // Lethal center indicator
    const centerPulse = Math.sin(now * 0.008) * 0.3 + 0.7;
    const centerRadius = 80; // damageRadius from config

    ctx.globalAlpha = centerPulse * 0.5;
    ctx.fillStyle = config.colors.core;
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.globalAlpha = centerPulse * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },

  /**
   * End phase - collapse effect
   */
  drawEnd(ctx, well) {
    const { radius, config, startTime } = well;
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / 500);

    // Collapsing rings
    const collapse = 1 - progress;

    ctx.strokeStyle = config.colors.vortex;
    ctx.lineWidth = 4 * collapse;
    ctx.globalAlpha = collapse;

    ctx.beginPath();
    ctx.arc(0, 0, radius * collapse, 0, Math.PI * 2);
    ctx.stroke();

    // Flash at center
    if (progress < 0.3) {
      const flashIntensity = 1 - progress / 0.3;
      ctx.globalAlpha = flashIntensity;
      ctx.fillStyle = config.colors.lightning;
      ctx.beginPath();
      ctx.arc(0, 0, 30 * flashIntensity, 0, Math.PI * 2);
      ctx.fill();
    }

    // Remove when complete
    if (progress >= 1) {
      this.activeWells.delete(well);
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Draw a jagged lightning arc
   */
  drawLightningArc(ctx, x, y, angle, length) {
    ctx.beginPath();
    ctx.moveTo(x, y);

    const segments = 5;
    let px = x, py = y;

    for (let i = 1; i <= segments; i++) {
      const segLen = (length / segments) * i;
      const jitter = (i < segments) ? (Math.random() - 0.5) * 20 : 0;
      const perpAngle = angle + Math.PI / 2;

      px = x + Math.cos(angle) * segLen + Math.cos(perpAngle) * jitter;
      py = y + Math.sin(angle) * segLen + Math.sin(perpAngle) * jitter;
      ctx.lineTo(px, py);
    }

    ctx.stroke();
  }
};


/**
 * ConsumeTendrilEffect - Void tendrils for Leviathan consume ability
 */
const ConsumeTendrilEffect = {
  activeConsumes: new Map(),

  /**
   * Start consume effect
   * @param {string} consumeId - Unique identifier
   * @param {object} leviathan - { x, y } position
   * @param {object} target - { x, y } position of consumed NPC
   */
  create(consumeId, leviathan, target) {
    const config = VoidConfig.VOID_LEVIATHAN_ABILITIES?.CONSUME || {
      tendrilCount: 4,
      tendrilSpeed: 300,
      dragDuration: 1500,
      colors: {
        tendril: '#330066',
        energy: '#9900ff',
        dissolve: '#cc66ff'
      }
    };

    // Generate tendril paths
    const tendrils = [];
    for (let i = 0; i < config.tendrilCount; i++) {
      tendrils.push({
        angleOffset: (i / config.tendrilCount) * Math.PI * 2,
        amplitude: 20 + Math.random() * 30,
        frequency: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      });
    }

    this.activeConsumes.set(consumeId, {
      leviathan: { ...leviathan },
      target: { ...target },
      originalTarget: { ...target },
      phase: 'extend', // extend, wrap, drag, dissolve
      config,
      tendrils,
      startTime: Date.now(),
      phaseTime: Date.now(),
      progress: 0
    });
  },

  /**
   * Update consume phase
   */
  setPhase(consumeId, newPhase) {
    const consume = this.activeConsumes.get(consumeId);
    if (consume) {
      consume.phase = newPhase;
      consume.phaseTime = Date.now();
    }
  },

  /**
   * Update target position (for dragging)
   */
  updateTarget(consumeId, x, y) {
    const consume = this.activeConsumes.get(consumeId);
    if (consume) {
      consume.target.x = x;
      consume.target.y = y;
    }
  },

  /**
   * Remove consume effect
   */
  remove(consumeId) {
    this.activeConsumes.delete(consumeId);
  },

  /**
   * Update all consume effects
   */
  update(deltaTime) {
    for (const [consumeId, consume] of this.activeConsumes) {
      const elapsed = Date.now() - consume.phaseTime;

      switch (consume.phase) {
        case 'extend':
          // Tendrils extending to target
          consume.progress = Math.min(1, elapsed / 500);
          if (consume.progress >= 1) {
            consume.phase = 'wrap';
            consume.phaseTime = Date.now();
          }
          break;

        case 'wrap':
          // Tendrils wrapping around target
          consume.progress = Math.min(1, elapsed / 300);
          if (consume.progress >= 1) {
            consume.phase = 'drag';
            consume.phaseTime = Date.now();
          }
          break;

        case 'drag':
          // Dragging target toward Leviathan
          consume.progress = Math.min(1, elapsed / consume.config.dragDuration);
          break;

        case 'dissolve':
          // Target dissolving
          consume.progress = Math.min(1, elapsed / 400);
          if (consume.progress >= 1) {
            this.activeConsumes.delete(consumeId);
          }
          break;
      }
    }
  },

  /**
   * Draw all consume effects
   */
  draw(ctx, camera) {
    for (const [consumeId, consume] of this.activeConsumes) {
      const levX = consume.leviathan.x - camera.x;
      const levY = consume.leviathan.y - camera.y;
      const targetX = consume.target.x - camera.x;
      const targetY = consume.target.y - camera.y;

      ctx.save();

      switch (consume.phase) {
        case 'extend':
          this.drawExtend(ctx, levX, levY, targetX, targetY, consume);
          break;
        case 'wrap':
          this.drawWrap(ctx, levX, levY, targetX, targetY, consume);
          break;
        case 'drag':
          this.drawDrag(ctx, levX, levY, targetX, targetY, consume);
          break;
        case 'dissolve':
          this.drawDissolve(ctx, targetX, targetY, consume);
          break;
      }

      ctx.restore();
    }
  },

  /**
   * Draw extending tendrils
   */
  drawExtend(ctx, levX, levY, targetX, targetY, consume) {
    const { tendrils, config, progress } = consume;
    const dx = targetX - levX;
    const dy = targetY - levY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = config.colors.tendril;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowColor = config.colors.energy;
    ctx.shadowBlur = 8;

    for (const tendril of tendrils) {
      ctx.beginPath();
      ctx.moveTo(levX, levY);

      const segmentCount = 10;
      for (let i = 1; i <= segmentCount; i++) {
        const t = (i / segmentCount) * progress;
        const segDist = dist * t;

        // Sinusoidal offset perpendicular to main direction
        const wobble = Math.sin(t * tendril.frequency * Math.PI + tendril.phase) * tendril.amplitude * (1 - t * 0.5);
        const perpAngle = angle + Math.PI / 2 + tendril.angleOffset * 0.1;

        const px = levX + Math.cos(angle) * segDist + Math.cos(perpAngle) * wobble;
        const py = levY + Math.sin(angle) * segDist + Math.sin(perpAngle) * wobble;

        ctx.lineTo(px, py);
      }

      ctx.stroke();
    }

    // Glow on tips
    const tipX = levX + Math.cos(angle) * dist * progress;
    const tipY = levY + Math.sin(angle) * dist * progress;

    ctx.fillStyle = config.colors.energy;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  },

  /**
   * Draw wrapping tendrils
   */
  drawWrap(ctx, levX, levY, targetX, targetY, consume) {
    const { tendrils, config, progress } = consume;
    const dx = targetX - levX;
    const dy = targetY - levY;
    const angle = Math.atan2(dy, dx);

    // Draw tendrils to target
    this.drawExtend(ctx, levX, levY, targetX, targetY, { ...consume, progress: 1 });

    // Draw wrapping circle around target
    ctx.strokeStyle = config.colors.tendril;
    ctx.lineWidth = 3;
    ctx.shadowColor = config.colors.energy;
    ctx.shadowBlur = 10;

    const wrapRadius = 25 * (1 - progress * 0.5);
    for (const tendril of tendrils) {
      const wrapAngle = tendril.angleOffset + progress * Math.PI * 2;
      const startAngle = wrapAngle;
      const endAngle = wrapAngle + progress * Math.PI;

      ctx.beginPath();
      ctx.arc(targetX, targetY, wrapRadius, startAngle, endAngle);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  },

  /**
   * Draw dragging effect
   */
  drawDrag(ctx, levX, levY, targetX, targetY, consume) {
    const { tendrils, config, progress } = consume;

    // Taut tendrils
    ctx.strokeStyle = config.colors.tendril;
    ctx.lineWidth = 5 - progress * 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = config.colors.energy;
    ctx.shadowBlur = 12;

    const dx = targetX - levX;
    const dy = targetY - levY;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    for (const tendril of tendrils) {
      ctx.beginPath();
      ctx.moveTo(levX, levY);

      // Less wobble as it gets closer
      const wobbleScale = (1 - progress) * 0.5;
      const segments = 8;

      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const segDist = dist * t;
        const wobble = Math.sin(t * tendril.frequency * Math.PI + Date.now() * 0.01) *
                       tendril.amplitude * wobbleScale;
        const perpAngle = angle + Math.PI / 2 + tendril.angleOffset * 0.1;

        const px = levX + Math.cos(angle) * segDist + Math.cos(perpAngle) * wobble;
        const py = levY + Math.sin(angle) * segDist + Math.sin(perpAngle) * wobble;

        ctx.lineTo(px, py);
      }

      ctx.stroke();
    }

    // Wrapped target with drain effect
    const drainPulse = Math.sin(Date.now() * 0.02) * 0.3 + 0.7;
    ctx.fillStyle = config.colors.energy + '60';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 20 * drainPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  },

  /**
   * Draw dissolve effect
   */
  drawDissolve(ctx, targetX, targetY, consume) {
    const { config, progress } = consume;

    // Expanding dissolve ring
    const ringRadius = 10 + progress * 40;
    const ringAlpha = 1 - progress;

    ctx.strokeStyle = config.colors.dissolve;
    ctx.lineWidth = 4 * ringAlpha;
    ctx.globalAlpha = ringAlpha;

    ctx.beginPath();
    ctx.arc(targetX, targetY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Central flash
    if (progress < 0.5) {
      const flashIntensity = 1 - progress * 2;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = flashIntensity;
      ctx.beginPath();
      ctx.arc(targetX, targetY, 15 * flashIntensity, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particle burst
    if (progress > 0.2 && typeof ParticleSystem !== 'undefined') {
      const particleChance = 0.3 * (1 - progress);
      if (Math.random() < particleChance) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        ParticleSystem.spawn({
          x: consume.target.x,
          y: consume.target.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: config.colors.dissolve,
          size: 3 + Math.random() * 3,
          life: 300 + Math.random() * 200,
          type: 'glow',
          decay: 1.2,
          drag: 0.96
        });
      }
    }

    ctx.globalAlpha = 1;
  }
};


/**
 * VoidEffects - Main module combining all void visual systems
 */
const VoidEffects = {
  particles: VoidParticles,
  rifts: RiftPortal,
  gravityWell: GravityWellEffect,
  consume: ConsumeTendrilEffect,

  /**
   * Update all void effects
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    RiftPortal.update(deltaTime);
    GravityWellEffect.update(deltaTime);
    ConsumeTendrilEffect.update(deltaTime);
  },

  /**
   * Draw all void effects (rifts, gravity wells, consume)
   * Note: Particles are drawn per-NPC via VoidParticles.draw()
   */
  draw(ctx, camera) {
    RiftPortal.draw(ctx, camera);
    GravityWellEffect.draw(ctx, camera);
    ConsumeTendrilEffect.draw(ctx, camera);
  },

  /**
   * Spawn minion emergence effect at rift positions
   * @param {Array} riftPositions - Array of { x, y } positions
   */
  spawnMinions(riftPositions) {
    for (const pos of riftPositions) {
      const riftId = `minion_rift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      RiftPortal.create(riftId, pos.x, pos.y, 'void_whisper', 'spawn');

      // Auto-close after spawn animation
      setTimeout(() => {
        RiftPortal.setState(riftId, 'close');
      }, 1500);
    }

    // Spawn particle burst at each rift
    if (typeof ParticleSystem !== 'undefined') {
      for (const pos of riftPositions) {
        ParticleSystem.spawnBurst({
          x: pos.x,
          y: pos.y,
          color: '#660099',
          secondaryColor: '#aa00ff',
          size: 4,
          life: 500,
          type: 'glow',
          decay: 1,
          drag: 0.95
        }, 8, {
          vx: 100,
          vy: 100,
          life: 200
        });
      }
    }
  },

  /**
   * Handle rift retreat effect (NPC phasing back into rift)
   * @param {string} riftId - Rift identifier
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} npcType - void_whisper, void_shadow, etc.
   */
  riftRetreat(riftId, x, y, npcType) {
    // Create closing rift if not exists
    if (!RiftPortal.activeRifts.has(riftId)) {
      RiftPortal.create(riftId, x, y, npcType, 'retreat');
    } else {
      RiftPortal.setState(riftId, 'retreat');
    }

    // Collapse after delay
    setTimeout(() => {
      RiftPortal.setState(riftId, 'close');
    }, 800);

    // Void particle implosion
    if (typeof ParticleSystem !== 'undefined') {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const startDist = 50 + Math.random() * 30;

        ParticleSystem.spawn({
          x: x + Math.cos(angle) * startDist,
          y: y + Math.sin(angle) * startDist,
          vx: -Math.cos(angle) * 80,
          vy: -Math.sin(angle) * 80,
          color: '#660099',
          size: 3,
          life: 400,
          type: 'trail',
          decay: 1,
          drag: 0.98
        });
      }
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.VoidEffects = VoidEffects;
  window.VoidParticles = VoidParticles;
  window.RiftPortal = RiftPortal;
  window.GravityWellEffect = GravityWellEffect;
  window.ConsumeTendrilEffect = ConsumeTendrilEffect;
}
