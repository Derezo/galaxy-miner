/**
 * Leviathan Spawn Sequence
 * Cinematic 6-8 second emergence sequence for Void Leviathan boss
 *
 * Phases:
 * 1. (0-2s) Multiple cracks spread across area
 * 2. (2-4s) Void energy pools and swirls
 * 3. (4-6s) Cracks converge into massive chaotic tear
 * 4. (6-7s) Leviathan slowly pushes through, reality resisting
 */

const LeviathanSpawn = {
  // Active spawn sequences
  activeSpawns: new Map(),

  // Phase timing (ms)
  PHASES: {
    CRACKS_SPREAD: { start: 0, end: 2000, name: 'cracks' },
    ENERGY_POOL: { start: 2000, end: 4000, name: 'energy' },
    CONVERGENCE: { start: 4000, end: 6000, name: 'converge' },
    EMERGENCE: { start: 6000, end: 7000, name: 'emerge' }
  },

  // Colors
  COLORS: {
    crack: '#9900ff',
    crackGlow: '#cc66ff',
    energy: '#660099',
    energyBright: '#aa00ff',
    void: '#000000',
    rift: '#330066',
    lightning: '#ff66ff'
  },

  /**
   * Start a Leviathan spawn sequence
   * @param {string} spawnId - Unique spawn identifier
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} duration - Total sequence duration (default 7000ms)
   */
  start(spawnId, x, y, duration = 7000) {
    // Generate initial cracks
    const cracks = [];
    const crackCount = 8;
    for (let i = 0; i < crackCount; i++) {
      cracks.push({
        angle: (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        length: 80 + Math.random() * 120,
        width: 2 + Math.random() * 2,
        segments: this.generateCrackSegments(5),
        delay: Math.random() * 500, // Staggered appearance
        speed: 0.8 + Math.random() * 0.4
      });
    }

    // Generate energy pool swirls
    const swirls = [];
    for (let i = 0; i < 5; i++) {
      swirls.push({
        radius: 40 + i * 25,
        speed: 0.002 + Math.random() * 0.002,
        offset: Math.random() * Math.PI * 2
      });
    }

    this.activeSpawns.set(spawnId, {
      x,
      y,
      startTime: Date.now(),
      duration,
      cracks,
      swirls,
      currentPhase: 'cracks',
      screenShake: { intensity: 0, decay: 0.95 },
      particles: [],
      complete: false
    });

    return spawnId;
  },

  /**
   * Generate jagged crack segment offsets
   */
  generateCrackSegments(count) {
    const segments = [];
    for (let i = 0; i < count; i++) {
      segments.push({
        offset: (Math.random() - 0.5) * 30,
        phase: Math.random() * Math.PI * 2
      });
    }
    return segments;
  },

  /**
   * Check if spawn sequence is complete
   */
  isComplete(spawnId) {
    const spawn = this.activeSpawns.get(spawnId);
    return spawn?.complete || false;
  },

  /**
   * Get screen shake intensity for camera
   */
  getScreenShake(spawnId) {
    const spawn = this.activeSpawns.get(spawnId);
    if (!spawn) return { x: 0, y: 0 };

    const intensity = spawn.screenShake.intensity;
    return {
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2
    };
  },

  /**
   * Update spawn sequence
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    const now = Date.now();

    for (const [spawnId, spawn] of this.activeSpawns) {
      const elapsed = now - spawn.startTime;

      // Determine current phase
      if (elapsed < this.PHASES.CRACKS_SPREAD.end) {
        spawn.currentPhase = 'cracks';
        spawn.screenShake.intensity = 2 + (elapsed / 2000) * 3;
      } else if (elapsed < this.PHASES.ENERGY_POOL.end) {
        spawn.currentPhase = 'energy';
        spawn.screenShake.intensity = 5 + ((elapsed - 2000) / 2000) * 5;
      } else if (elapsed < this.PHASES.CONVERGENCE.end) {
        spawn.currentPhase = 'converge';
        spawn.screenShake.intensity = 10 + ((elapsed - 4000) / 2000) * 10;
      } else if (elapsed < this.PHASES.EMERGENCE.end) {
        spawn.currentPhase = 'emerge';
        spawn.screenShake.intensity = 20;
      } else {
        spawn.complete = true;
        spawn.screenShake.intensity *= 0.9;
      }

      // Decay screen shake
      spawn.screenShake.intensity *= spawn.screenShake.decay;

      // Spawn ambient particles
      this.updateParticles(spawn, elapsed);

      // Clean up completed spawns after a delay
      if (spawn.complete && elapsed > spawn.duration + 2000) {
        this.activeSpawns.delete(spawnId);
      }
    }
  },

  /**
   * Update ambient particles during spawn
   */
  updateParticles(spawn, elapsed) {
    if (typeof ParticleSystem === 'undefined') return;

    const phase = spawn.currentPhase;
    const particleMultiplier = ParticleSystem.getParticleMultiplier();

    // Cracks phase: sparks along crack lines
    if (phase === 'cracks' && Math.random() < 0.3 * particleMultiplier) {
      const crack = spawn.cracks[Math.floor(Math.random() * spawn.cracks.length)];
      const progress = Math.random();
      const angle = crack.angle;
      const dist = progress * crack.length * (elapsed / 2000);

      ParticleSystem.spawn({
        x: spawn.x + Math.cos(angle) * dist,
        y: spawn.y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        color: this.COLORS.crackGlow,
        size: 2 + Math.random() * 2,
        life: 300,
        type: 'spark',
        decay: 1.2,
        drag: 0.95
      });
    }

    // Energy phase: swirling void particles
    if (phase === 'energy' && Math.random() < 0.5 * particleMultiplier) {
      const swirl = spawn.swirls[Math.floor(Math.random() * spawn.swirls.length)];
      const angle = Date.now() * swirl.speed + swirl.offset;
      const radius = swirl.radius * ((elapsed - 2000) / 2000);

      ParticleSystem.spawn({
        x: spawn.x + Math.cos(angle) * radius,
        y: spawn.y + Math.sin(angle) * radius,
        vx: Math.cos(angle + Math.PI / 2) * 30,
        vy: Math.sin(angle + Math.PI / 2) * 30,
        color: this.COLORS.energy,
        size: 3 + Math.random() * 3,
        life: 500,
        type: 'glow',
        decay: 1,
        drag: 0.98
      });
    }

    // Convergence phase: inward-rushing particles
    if (phase === 'converge' && Math.random() < 0.6 * particleMultiplier) {
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = 150 + Math.random() * 100;

      ParticleSystem.spawn({
        x: spawn.x + Math.cos(spawnAngle) * spawnDist,
        y: spawn.y + Math.sin(spawnAngle) * spawnDist,
        vx: -Math.cos(spawnAngle) * 150,
        vy: -Math.sin(spawnAngle) * 150,
        color: this.COLORS.energyBright,
        size: 4 + Math.random() * 3,
        life: 600,
        type: 'trail',
        decay: 0.8,
        drag: 0.97
      });
    }

    // Emergence phase: explosive burst from center
    if (phase === 'emerge' && Math.random() < 0.8 * particleMultiplier) {
      const burstAngle = Math.random() * Math.PI * 2;
      const burstSpeed = 100 + Math.random() * 150;

      ParticleSystem.spawn({
        x: spawn.x,
        y: spawn.y,
        vx: Math.cos(burstAngle) * burstSpeed,
        vy: Math.sin(burstAngle) * burstSpeed,
        color: Math.random() > 0.5 ? this.COLORS.lightning : this.COLORS.crack,
        size: 3 + Math.random() * 4,
        life: 400,
        type: 'glow',
        decay: 1.1,
        drag: 0.96
      });
    }
  },

  /**
   * Draw all active spawn sequences
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera - { x, y }
   */
  draw(ctx, camera) {
    for (const [spawnId, spawn] of this.activeSpawns) {
      const screenX = spawn.x - camera.x;
      const screenY = spawn.y - camera.y;

      // Skip if off-screen
      if (screenX < -300 || screenX > ctx.canvas.width + 300 ||
          screenY < -300 || screenY > ctx.canvas.height + 300) {
        continue;
      }

      const elapsed = Date.now() - spawn.startTime;

      ctx.save();
      ctx.translate(screenX, screenY);

      // Draw based on current phase
      switch (spawn.currentPhase) {
        case 'cracks':
          this.drawCracksPhase(ctx, spawn, elapsed);
          break;
        case 'energy':
          this.drawCracksPhase(ctx, spawn, 2000); // Keep cracks visible
          this.drawEnergyPhase(ctx, spawn, elapsed - 2000);
          break;
        case 'converge':
          this.drawCracksPhase(ctx, spawn, 2000);
          this.drawEnergyPhase(ctx, spawn, 2000);
          this.drawConvergencePhase(ctx, spawn, elapsed - 4000);
          break;
        case 'emerge':
          this.drawEmergencePhase(ctx, spawn, elapsed - 6000);
          break;
      }

      // Draw completion state if done
      if (spawn.complete) {
        this.drawComplete(ctx, spawn, elapsed - spawn.duration);
      }

      ctx.restore();
    }
  },

  /**
   * Phase 1: Cracks spreading across area (0-2s)
   */
  drawCracksPhase(ctx, spawn, elapsed) {
    const progress = Math.min(1, elapsed / 2000);

    ctx.lineCap = 'round';
    ctx.shadowColor = this.COLORS.crackGlow;
    ctx.shadowBlur = 10;

    for (const crack of spawn.cracks) {
      // Staggered appearance
      const crackProgress = Math.max(0, Math.min(1,
        (elapsed - crack.delay) / (1500 * crack.speed)
      ));

      if (crackProgress <= 0) continue;

      const currentLength = crack.length * crackProgress;

      // Draw crack with jagged segments
      ctx.strokeStyle = this.COLORS.crack;
      ctx.lineWidth = crack.width;
      ctx.beginPath();
      ctx.moveTo(0, 0);

      const segCount = crack.segments.length;
      for (let i = 1; i <= segCount; i++) {
        const t = i / segCount;
        if (t > crackProgress) break;

        const segDist = currentLength * t;
        const seg = crack.segments[i - 1];
        const jitter = seg.offset * Math.sin(elapsed * 0.005 + seg.phase) * 0.5;
        const perpAngle = crack.angle + Math.PI / 2;

        const x = Math.cos(crack.angle) * segDist + Math.cos(perpAngle) * jitter;
        const y = Math.sin(crack.angle) * segDist + Math.sin(perpAngle) * jitter;

        ctx.lineTo(x, y);
      }

      ctx.stroke();

      // Brighter inner line
      ctx.strokeStyle = this.COLORS.crackGlow;
      ctx.lineWidth = crack.width * 0.5;
      ctx.stroke();
    }

    // Pulsing center point
    const centerPulse = 0.5 + Math.sin(elapsed * 0.01) * 0.3;
    const centerSize = 15 * progress * centerPulse;

    ctx.fillStyle = this.COLORS.void;
    ctx.beginPath();
    ctx.arc(0, 0, centerSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.COLORS.crack;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
  },

  /**
   * Phase 2: Energy pooling and swirling (2-4s)
   */
  drawEnergyPhase(ctx, spawn, elapsed) {
    const progress = Math.min(1, elapsed / 2000);

    // Swirling energy rings
    ctx.lineWidth = 3;

    for (const swirl of spawn.swirls) {
      const radius = swirl.radius * progress;
      const rotation = Date.now() * swirl.speed + swirl.offset;

      // Partial arc that rotates
      const arcLength = Math.PI * (0.8 + Math.sin(elapsed * 0.003) * 0.2);

      ctx.strokeStyle = this.COLORS.energy + '80';
      ctx.beginPath();
      ctx.arc(0, 0, radius, rotation, rotation + arcLength);
      ctx.stroke();

      // Brighter leading edge
      ctx.strokeStyle = this.COLORS.energyBright;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, rotation + arcLength - 0.3, rotation + arcLength);
      ctx.stroke();
    }

    // Central void growing
    const voidSize = 25 + progress * 35;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, voidSize);
    gradient.addColorStop(0, this.COLORS.void);
    gradient.addColorStop(0.6, this.COLORS.rift + '80');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, voidSize, 0, Math.PI * 2);
    ctx.fill();

    // Energy lightning bolts
    if (progress > 0.3) {
      ctx.strokeStyle = this.COLORS.lightning;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.COLORS.lightning;
      ctx.shadowBlur = 8;

      for (let i = 0; i < 4; i++) {
        const boltAngle = (i / 4) * Math.PI * 2 + elapsed * 0.003;
        const boltLength = 30 + Math.sin(elapsed * 0.02 + i) * 15;

        this.drawLightningBolt(ctx, 0, 0, boltAngle, boltLength);
      }

      ctx.shadowBlur = 0;
    }
  },

  /**
   * Phase 3: Convergence into massive tear (4-6s)
   */
  drawConvergencePhase(ctx, spawn, elapsed) {
    const progress = Math.min(1, elapsed / 2000);

    // Cracks converging - they bend toward center
    ctx.lineCap = 'round';
    ctx.shadowColor = this.COLORS.crackGlow;
    ctx.shadowBlur = 15;

    for (const crack of spawn.cracks) {
      ctx.strokeStyle = this.COLORS.crack;
      ctx.lineWidth = crack.width * (1 + progress);
      ctx.beginPath();

      // Bend cracks inward as progress increases
      const bendFactor = progress * 0.5;
      let prevX = 0, prevY = 0;

      ctx.moveTo(0, 0);

      const segCount = crack.segments.length;
      for (let i = 1; i <= segCount; i++) {
        const t = i / segCount;
        const segDist = crack.length * t;

        // Original position
        let x = Math.cos(crack.angle) * segDist;
        let y = Math.sin(crack.angle) * segDist;

        // Bend toward center
        const distFromCenter = Math.sqrt(x * x + y * y);
        const pullStrength = bendFactor * (1 - 1 / (1 + distFromCenter * 0.01));
        x *= (1 - pullStrength);
        y *= (1 - pullStrength);

        // Add convergence jitter
        const jitter = Math.sin(elapsed * 0.01 + i) * 10 * progress;
        const perpAngle = crack.angle + Math.PI / 2;
        x += Math.cos(perpAngle) * jitter;
        y += Math.sin(perpAngle) * jitter;

        ctx.lineTo(x, y);
        prevX = x;
        prevY = y;
      }

      ctx.stroke();
    }

    // Growing chaotic rift
    const riftSize = 60 + progress * 60;
    const riftPulse = Math.sin(elapsed * 0.015) * 0.2 + 1;

    // Jagged rift shape
    ctx.fillStyle = this.COLORS.void;
    ctx.beginPath();

    const riftPoints = 12;
    for (let i = 0; i <= riftPoints; i++) {
      const angle = (i / riftPoints) * Math.PI * 2;
      const wobble = Math.sin(angle * 5 + elapsed * 0.008) * 0.3;
      const r = riftSize * riftPulse * (0.7 + wobble);

      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }

    ctx.closePath();
    ctx.fill();

    // Rift edge glow
    ctx.strokeStyle = this.COLORS.crack;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Intense lightning from rift
    ctx.strokeStyle = this.COLORS.lightning;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.COLORS.lightning;
    ctx.shadowBlur = 12;

    for (let i = 0; i < 8; i++) {
      const boltAngle = (i / 8) * Math.PI * 2 + elapsed * 0.004;
      const boltLength = riftSize * 0.6 + Math.sin(elapsed * 0.03 + i * 2) * 20;

      this.drawLightningBolt(ctx, 0, 0, boltAngle, boltLength);
    }

    ctx.shadowBlur = 0;
  },

  /**
   * Phase 4: Leviathan emergence (6-7s)
   */
  drawEmergencePhase(ctx, spawn, elapsed) {
    const progress = Math.min(1, elapsed / 1000);

    // Massive rift tear
    const riftSize = 120;
    const pushProgress = Math.min(1, progress * 1.5); // Faster emergence

    // Dark void background
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, riftSize * 1.5);
    gradient.addColorStop(0, this.COLORS.void);
    gradient.addColorStop(0.5, this.COLORS.rift);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, riftSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Resistance lines - reality resisting
    const resistanceIntensity = Math.sin(elapsed * 0.02) * 0.3 + 0.7;
    ctx.strokeStyle = this.COLORS.crackGlow + '60';
    ctx.lineWidth = 1;

    for (let i = 0; i < 16; i++) {
      const resistAngle = (i / 16) * Math.PI * 2;
      const innerR = riftSize * 0.8;
      const outerR = riftSize * 1.3 * resistanceIntensity;

      ctx.beginPath();
      ctx.moveTo(Math.cos(resistAngle) * innerR, Math.sin(resistAngle) * innerR);

      // Jagged resistance line
      for (let j = 0; j < 4; j++) {
        const t = (j + 1) / 4;
        const r = innerR + (outerR - innerR) * t;
        const jitter = (Math.random() - 0.5) * 15;
        const perpAngle = resistAngle + Math.PI / 2;

        ctx.lineTo(
          Math.cos(resistAngle) * r + Math.cos(perpAngle) * jitter,
          Math.sin(resistAngle) * r + Math.sin(perpAngle) * jitter
        );
      }

      ctx.stroke();
    }

    // Leviathan silhouette pushing through
    const silhouetteSize = 80 * pushProgress;
    const silhouetteY = -30 * (1 - pushProgress); // Rising up

    ctx.save();
    ctx.translate(0, silhouetteY);

    // Dark menacing shape
    ctx.fillStyle = this.COLORS.void;
    ctx.beginPath();
    ctx.moveTo(0, -silhouetteSize * 0.8);
    ctx.lineTo(silhouetteSize * 0.6, -silhouetteSize * 0.3);
    ctx.lineTo(silhouetteSize * 0.8, silhouetteSize * 0.2);
    ctx.lineTo(silhouetteSize * 0.3, silhouetteSize * 0.5);
    ctx.lineTo(-silhouetteSize * 0.3, silhouetteSize * 0.5);
    ctx.lineTo(-silhouetteSize * 0.8, silhouetteSize * 0.2);
    ctx.lineTo(-silhouetteSize * 0.6, -silhouetteSize * 0.3);
    ctx.closePath();
    ctx.fill();

    // Glowing eyes
    if (pushProgress > 0.5) {
      const eyeGlow = (pushProgress - 0.5) * 2;
      ctx.fillStyle = this.COLORS.energyBright;
      ctx.globalAlpha = eyeGlow;

      ctx.beginPath();
      ctx.arc(-silhouetteSize * 0.2, -silhouetteSize * 0.2, 5, 0, Math.PI * 2);
      ctx.arc(silhouetteSize * 0.2, -silhouetteSize * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Edge rift energy
    ctx.strokeStyle = this.COLORS.crack;
    ctx.lineWidth = 5;
    ctx.shadowColor = this.COLORS.crackGlow;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.arc(0, 0, riftSize, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
  },

  /**
   * Post-emergence: rift closing, Leviathan fully materialized
   */
  drawComplete(ctx, spawn, elapsed) {
    const fadeProgress = Math.min(1, elapsed / 1500);

    // Fading rift remnants
    const riftSize = 120 * (1 - fadeProgress);

    if (riftSize > 5) {
      ctx.strokeStyle = this.COLORS.crack;
      ctx.lineWidth = 3 * (1 - fadeProgress);
      ctx.globalAlpha = 1 - fadeProgress;

      ctx.beginPath();
      ctx.arc(0, 0, riftSize, 0, Math.PI * 2);
      ctx.stroke();

      // Final energy dissipation
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, riftSize);
      gradient.addColorStop(0, this.COLORS.rift + '40');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, riftSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  },

  /**
   * Draw a jagged lightning bolt
   */
  drawLightningBolt(ctx, startX, startY, angle, length) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    let x = startX, y = startY;
    const segments = 5;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const segLen = length * t;
      const jitter = (i < segments) ? (Math.random() - 0.5) * 25 : 0;
      const perpAngle = angle + Math.PI / 2;

      x = startX + Math.cos(angle) * segLen + Math.cos(perpAngle) * jitter;
      y = startY + Math.sin(angle) * segLen + Math.sin(perpAngle) * jitter;

      ctx.lineTo(x, y);
    }

    ctx.stroke();
  },

  /**
   * Remove a spawn sequence
   */
  remove(spawnId) {
    this.activeSpawns.delete(spawnId);
  },

  /**
   * Clear all spawn sequences
   */
  clear() {
    this.activeSpawns.clear();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.LeviathanSpawn = LeviathanSpawn;
}
