// Galaxy Miner - Player Death Effect System
// Cinematic death experience with phases, text animation, and respawn handling

const PlayerDeathEffect = {
  // State
  active: false,
  phase: 'inactive', // 'impact', 'text_fadein', 'info_display', 'text_explosion', 'respawn', 'inactive'
  startTime: 0,
  phaseStartTime: 0,
  deathData: null,

  // Timings (milliseconds)
  TIMINGS: {
    IMPACT_DURATION: 500,
    TEXT_FADEIN_START: 500,
    TEXT_FADEIN_DURATION: 1500,
    INFO_DISPLAY_START: 2000,
    INFO_DISPLAY_DURATION: 2500,
    TEXT_EXPLOSION_START: 4500,
    TEXT_EXPLOSION_DURATION: 500,
    TOTAL_DURATION: 5000,
    INVULNERABILITY_DURATION: 3000
  },

  // Screen shake
  screenShake: {
    x: 0,
    y: 0,
    intensity: 0,
    decay: 0.92
  },

  // Visual state
  textAlpha: 0,
  overlayAlpha: 0,
  textScale: 0.9,
  whiteFlashAlpha: 0,

  // Wreckage particles
  wreckageParticles: [],

  // Text explosion particles
  textParticles: [],

  // Respawn data (queued from server)
  respawnData: null,

  // Invulnerability tracking
  invulnerableUntil: 0,

  /**
   * Trigger the death effect sequence
   * @param {Object} data - Death data from server
   * @param {string} data.killerName - Name of killer (player/NPC) or null for environmental
   * @param {string} data.killerType - 'player', 'npc', 'star', 'unknown'
   * @param {Array} data.droppedCargo - Array of {resource_type, quantity}
   * @param {number} data.survivalTime - Time survived in milliseconds
   * @param {Object} data.deathPosition - {x, y} where player died
   */
  trigger(data) {
    this.active = true;
    this.phase = 'impact';
    this.startTime = Date.now();
    this.phaseStartTime = Date.now();
    this.deathData = data;

    // Initialize screen shake (intense)
    this.screenShake.intensity = 25;
    this.screenShake.x = 0;
    this.screenShake.y = 0;

    // Reset visual state
    this.textAlpha = 0;
    this.overlayAlpha = 0;
    this.textScale = 0.9;
    this.whiteFlashAlpha = 1.0; // Start with flash

    // Create wreckage particles
    this.createWreckageParticles(data.deathPosition);

    // Clear any previous text particles
    this.textParticles = [];

    console.log('[PlayerDeathEffect] Triggered:', data);
  },

  /**
   * Create wreckage particles at death position
   */
  createWreckageParticles(position) {
    this.wreckageParticles = [];
    const numParticles = 15;

    for (let i = 0; i < numParticles; i++) {
      const angle = (Math.PI * 2 * i) / numParticles + Math.random() * 0.3;
      const speed = 20 + Math.random() * 40;

      this.wreckageParticles.push({
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 3,
        size: 5 + Math.random() * 10,
        alpha: 1.0,
        type: Math.floor(Math.random() * 3) // Different debris shapes
      });
    }
  },

  /**
   * Create text explosion particles from the death message
   */
  createTextExplosionParticles(centerX, centerY) {
    this.textParticles = [];
    const text = "You've been destroyed.";
    const numParticles = 40;

    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const char = text[Math.floor(Math.random() * text.length)];

      this.textParticles.push({
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        char: char,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 10,
        alpha: 1.0,
        scale: 0.5 + Math.random() * 0.5,
        color: Math.random() > 0.3 ? '#8B0000' : '#FF4500' // Crimson or orange sparks
      });
    }
  },

  /**
   * Update the death effect state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.active) return;

    const elapsed = Date.now() - this.startTime;
    const T = this.TIMINGS;

    // Update screen shake
    if (this.screenShake.intensity > 0.1) {
      this.screenShake.x = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
      this.screenShake.y = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
      this.screenShake.intensity *= this.screenShake.decay;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
      this.screenShake.intensity = 0;
    }

    // Update white flash (peaks at 100ms, fades by 400ms)
    if (elapsed < 100) {
      this.whiteFlashAlpha = elapsed / 100;
    } else if (elapsed < 400) {
      this.whiteFlashAlpha = 1.0 - ((elapsed - 100) / 300);
    } else {
      this.whiteFlashAlpha = 0;
    }

    // Update overlay alpha (fade in during impact, stay during display)
    if (elapsed < T.IMPACT_DURATION) {
      this.overlayAlpha = (elapsed / T.IMPACT_DURATION) * 0.7;
    } else if (elapsed < T.TEXT_EXPLOSION_START) {
      this.overlayAlpha = 0.7;
    } else {
      // Fade out during explosion
      const explosionProgress = (elapsed - T.TEXT_EXPLOSION_START) / T.TEXT_EXPLOSION_DURATION;
      this.overlayAlpha = 0.7 * (1 - explosionProgress);
    }

    // Phase transitions and updates
    if (elapsed < T.IMPACT_DURATION) {
      this.phase = 'impact';
    } else if (elapsed < T.INFO_DISPLAY_START) {
      this.phase = 'text_fadein';
      // Slowly fade in text
      const fadeProgress = (elapsed - T.TEXT_FADEIN_START) / T.TEXT_FADEIN_DURATION;
      this.textAlpha = Math.min(1.0, fadeProgress);
      this.textScale = 0.9 + fadeProgress * 0.1; // Scale from 0.9 to 1.0
    } else if (elapsed < T.TEXT_EXPLOSION_START) {
      this.phase = 'info_display';
      this.textAlpha = 1.0;
      this.textScale = 1.0;
    } else if (elapsed < T.TOTAL_DURATION) {
      if (this.phase !== 'text_explosion') {
        this.phase = 'text_explosion';
        // Create explosion particles when entering this phase
        // We'll use screen center as the explosion origin
        this.textExplosionTriggered = true;
      }
      // Update text explosion
      const explosionProgress = (elapsed - T.TEXT_EXPLOSION_START) / T.TEXT_EXPLOSION_DURATION;
      this.textScale = 1.0 + explosionProgress * 0.5; // Scale up
      this.textAlpha = 1.0 - explosionProgress; // Fade out
    } else {
      // Sequence complete
      this.phase = 'respawn';
      this.completeDeathSequence();
    }

    // Update wreckage particles
    for (const p of this.wreckageParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98; // Friction
      p.vy *= 0.98;
      p.rotation += p.rotationSpeed * dt;
      p.alpha = Math.max(0, p.alpha - dt * 0.3);
    }

    // Update text explosion particles
    for (const p of this.textParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
      p.alpha = Math.max(0, p.alpha - dt * 2.5);
    }
  },

  /**
   * Complete the death sequence and trigger respawn
   */
  completeDeathSequence() {
    this.active = false;
    this.phase = 'inactive';

    // Apply invulnerability
    this.invulnerableUntil = Date.now() + this.TIMINGS.INVULNERABILITY_DURATION;

    // Trigger respawn if we have queued data
    if (this.respawnData && typeof window.handleRespawnComplete === 'function') {
      window.handleRespawnComplete(this.respawnData);
      this.respawnData = null;
    }

    console.log('[PlayerDeathEffect] Sequence complete, invulnerable until:', this.invulnerableUntil);
  },

  /**
   * Queue respawn data to be applied after death sequence
   * @param {Object} data - Respawn data from server
   */
  queueRespawn(data) {
    this.respawnData = data;
    console.log('[PlayerDeathEffect] Respawn queued:', data);
  },

  /**
   * Draw the death effect overlay
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  draw(ctx, width, height) {
    if (!this.active && !this.isInvulnerable()) return;

    ctx.save();

    if (this.active) {
      // Draw white flash
      if (this.whiteFlashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.whiteFlashAlpha * 0.8})`;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw crimson vignette overlay
      if (this.overlayAlpha > 0) {
        this.drawVignetteOverlay(ctx, width, height);
      }

      // Draw death text and info
      if (this.phase === 'text_fadein' || this.phase === 'info_display' || this.phase === 'text_explosion') {
        this.drawDeathText(ctx, width, height);

        if (this.phase === 'info_display' || this.phase === 'text_explosion') {
          this.drawDeathInfo(ctx, width, height);
        }
      }

      // Draw text explosion particles
      if (this.phase === 'text_explosion') {
        this.drawTextExplosionParticles(ctx);
      }
    }

    ctx.restore();
  },

  /**
   * Draw dark crimson vignette overlay
   */
  drawVignetteOverlay(ctx, width, height) {
    // Create radial gradient for vignette effect
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );

    gradient.addColorStop(0, `rgba(20, 0, 0, ${this.overlayAlpha * 0.3})`);
    gradient.addColorStop(0.5, `rgba(40, 0, 0, ${this.overlayAlpha * 0.5})`);
    gradient.addColorStop(1, `rgba(60, 0, 0, ${this.overlayAlpha * 0.8})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  },

  /**
   * Draw the main death text with ominous glow
   */
  drawDeathText(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2 - 50;

    // Trigger text explosion particles on first draw of explosion phase
    if (this.phase === 'text_explosion' && this.textExplosionTriggered) {
      this.createTextExplosionParticles(centerX, centerY);
      this.textExplosionTriggered = false;
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(this.textScale, this.textScale);

    // Text properties
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Ominous glow effect (multiple shadow layers)
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw glow layers
    ctx.fillStyle = `rgba(139, 0, 0, ${this.textAlpha * 0.3})`;
    ctx.fillText("You've been destroyed.", 0, 0);

    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(139, 0, 0, ${this.textAlpha * 0.5})`;
    ctx.fillText("You've been destroyed.", 0, 0);

    // Main text
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(139, 0, 0, ${this.textAlpha})`; // Dark crimson #8B0000
    ctx.fillText("You've been destroyed.", 0, 0);

    ctx.restore();
  },

  /**
   * Draw death info: killer, cargo lost, survival time
   */
  drawDeathInfo(ctx, width, height) {
    if (!this.deathData) return;

    const centerX = width / 2;
    let currentY = height / 2 + 30;
    const lineHeight = 30;

    ctx.save();
    ctx.font = '20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;

    // Info fade in slightly after main text
    const infoAlpha = Math.min(1.0, this.textAlpha);

    // Killer info
    let killerText = '';
    switch (this.deathData.killerType) {
      case 'player':
        killerText = `by ${this.deathData.killerName || 'another player'}`;
        break;
      case 'npc':
        killerText = `by ${this.deathData.killerName || 'hostile forces'}`;
        break;
      case 'star':
        killerText = 'by stellar radiation';
        break;
      default:
        killerText = 'cause unknown';
    }

    ctx.fillStyle = `rgba(200, 100, 100, ${infoAlpha})`;
    ctx.fillText(killerText, centerX, currentY);
    currentY += lineHeight + 10;

    // Cargo lost (up to 4 items)
    if (this.deathData.droppedCargo && this.deathData.droppedCargo.length > 0) {
      ctx.fillStyle = `rgba(180, 120, 80, ${infoAlpha * 0.9})`;
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('Cargo lost:', centerX, currentY);
      currentY += 22;

      const itemsToShow = this.deathData.droppedCargo.slice(0, 4);
      for (const item of itemsToShow) {
        const itemText = `${item.quantity}x ${this.formatResourceName(item.resource_type)}`;
        ctx.fillText(itemText, centerX, currentY);
        currentY += 20;
      }

      if (this.deathData.droppedCargo.length > 4) {
        ctx.fillText(`...and ${this.deathData.droppedCargo.length - 4} more`, centerX, currentY);
        currentY += 20;
      }

      currentY += 10;
    }

    // Survival time
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = `rgba(150, 150, 200, ${infoAlpha})`;
    const survivalText = `Survived: ${this.formatSurvivalTime(this.deathData.survivalTime)}`;
    ctx.fillText(survivalText, centerX, currentY);

    ctx.restore();
  },

  /**
   * Draw text explosion particles
   */
  drawTextExplosionParticles(ctx) {
    ctx.save();

    for (const p of this.textParticles) {
      if (p.alpha <= 0) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scale, p.scale);

      ctx.font = 'bold 48px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = p.color.replace(')', `, ${p.alpha})`).replace('rgb', 'rgba').replace('#', '');

      // Handle hex colors
      if (p.color.startsWith('#')) {
        const r = parseInt(p.color.slice(1, 3), 16);
        const g = parseInt(p.color.slice(3, 5), 16);
        const b = parseInt(p.color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
      }

      ctx.fillText(p.char, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  },

  /**
   * Draw wreckage particles (called from world space rendering)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera offset {x, y}
   */
  drawWreckage(ctx, camera) {
    if (!this.active || this.wreckageParticles.length === 0) return;

    ctx.save();

    for (const p of this.wreckageParticles) {
      if (p.alpha <= 0) continue;

      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;

      // Draw debris based on type
      ctx.fillStyle = '#444';
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;

      switch (p.type) {
        case 0: // Triangle debris
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.7, p.size * 0.5);
          ctx.lineTo(-p.size * 0.7, p.size * 0.5);
          ctx.closePath();
          break;
        case 1: // Rectangle debris
          ctx.beginPath();
          ctx.rect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
          break;
        case 2: // Irregular polygon
          ctx.beginPath();
          ctx.moveTo(p.size * 0.5, 0);
          ctx.lineTo(p.size * 0.2, p.size * 0.4);
          ctx.lineTo(-p.size * 0.4, p.size * 0.3);
          ctx.lineTo(-p.size * 0.5, -p.size * 0.2);
          ctx.lineTo(0, -p.size * 0.5);
          ctx.closePath();
          break;
      }

      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  },

  /**
   * Get screen shake offset for camera
   * @returns {Object} {x, y} offset
   */
  getScreenShakeOffset() {
    return {
      x: this.screenShake.x,
      y: this.screenShake.y
    };
  },

  /**
   * Check if player is currently invulnerable
   * @returns {boolean}
   */
  isInvulnerable() {
    return Date.now() < this.invulnerableUntil;
  },

  /**
   * Get invulnerability remaining ratio (0-1) for visual effects
   * @returns {number}
   */
  getInvulnerabilityRatio() {
    if (!this.isInvulnerable()) return 0;
    const remaining = this.invulnerableUntil - Date.now();
    return remaining / this.TIMINGS.INVULNERABILITY_DURATION;
  },

  /**
   * Draw invulnerability glow effect around player ship
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Ship screen X
   * @param {number} y - Ship screen Y
   * @param {number} size - Ship size for glow radius
   */
  drawInvulnerabilityGlow(ctx, x, y, size) {
    const ratio = this.getInvulnerabilityRatio();
    if (ratio <= 0) return;

    ctx.save();

    // Pulsing effect
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
    const alpha = ratio * (0.3 + pulse * 0.4);

    // Outer glow
    const gradient = ctx.createRadialGradient(x, y, size * 0.5, x, y, size * 2);
    gradient.addColorStop(0, `rgba(100, 200, 255, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(50, 150, 255, ${alpha * 0.5})`);
    gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Inner shield ring
    ctx.strokeStyle = `rgba(150, 220, 255, ${alpha * 1.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.2 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Check if death sequence is active
   * @returns {boolean}
   */
  isActive() {
    return this.active;
  },

  /**
   * Format resource type name for display
   * @param {string} type - Resource type key
   * @returns {string} Formatted name
   */
  formatResourceName(type) {
    // Convert IRON_ORE -> Iron Ore
    return type.toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Format survival time for display
   * @param {number} ms - Time in milliseconds
   * @returns {string} Formatted time string "Xm Ys"
   */
  formatSurvivalTime(ms) {
    if (!ms || ms < 0) return '0s';

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PlayerDeathEffect = PlayerDeathEffect;
}
