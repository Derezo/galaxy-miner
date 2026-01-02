/**
 * Graveyard Atmosphere - Visual effects for The Graveyard safe zone
 *
 * Creates the atmosphere of ancient, frozen destruction:
 * - Dimmer ambient lighting (distant from major stars)
 * - Metallic glinting particle effects floating in space
 * - Darker, more muted colors
 */

const GraveyardAtmosphere = {
  // Current state
  inGraveyard: false,
  transitionProgress: 0,  // 0 = normal space, 1 = full graveyard effect

  // Metallic glint particles
  glintParticles: [],
  maxGlintParticles: 40,

  // Configuration
  config: {
    // Ambient dimming effect
    dimOpacity: 0.25,              // Maximum darkness overlay opacity
    dimColor: '#050510',            // Dark blue-black for cold, distant space
    transitionSpeed: 0.5,           // Seconds to fade in/out effects

    // Metallic glint particles
    glintSpawnRate: 0.15,           // Particles per second to spawn
    glintLifetimeMin: 2000,         // Minimum lifetime ms
    glintLifetimeMax: 5000,         // Maximum lifetime ms
    glintSizeMin: 1.5,              // Minimum size
    glintSizeMax: 4,                // Maximum size
    glintSpawnRadius: 800,          // Spawn within this radius of player
    glintColors: [
      '#888899',  // Dull silver
      '#7a7a8a',  // Dark silver
      '#6a6a7a',  // Steel gray
      '#9a9aaa',  // Light silver (rare bright glint)
      '#aabbcc',  // Cold blue steel
      '#8899aa'   // Blue-gray
    ],

    // Vignette effect for atmosphere
    vignetteStrength: 0.4           // How dark the edges get
  },

  // Animation time accumulator
  time: 0,
  spawnAccumulator: 0,

  init() {
    this.glintParticles = [];
    this.inGraveyard = false;
    this.transitionProgress = 0;
    this.time = 0;
    this.spawnAccumulator = 0;
    Logger.log('GraveyardAtmosphere initialized');
  },

  /**
   * Update graveyard effects
   * @param {number} dt - Delta time in seconds
   * @param {{x: number, y: number}} playerPosition - Player world position
   */
  update(dt, playerPosition) {
    this.time += dt;

    // Check if player is in Graveyard zone
    const wasInGraveyard = this.inGraveyard;
    this.inGraveyard = this.isInGraveyardZone(playerPosition);

    // Smooth transition in/out
    if (this.inGraveyard) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / this.config.transitionSpeed);
    } else {
      this.transitionProgress = Math.max(0, this.transitionProgress - dt / this.config.transitionSpeed);
    }

    // Only spawn particles if we have any graveyard effect active
    if (this.transitionProgress > 0.01) {
      // Spawn metallic glint particles
      this.spawnAccumulator += dt * this.config.glintSpawnRate * this.transitionProgress;

      while (this.spawnAccumulator >= 1 && this.glintParticles.length < this.maxGlintParticles) {
        this.spawnGlintParticle(playerPosition);
        this.spawnAccumulator -= 1;
      }

      // Update existing particles
      this.updateGlintParticles(dt, playerPosition);
    } else {
      // Clear particles when not in graveyard
      this.glintParticles = [];
      this.spawnAccumulator = 0;
    }
  },

  /**
   * Check if position is within the Graveyard zone
   * @param {{x: number, y: number}} position
   * @returns {boolean}
   */
  isInGraveyardZone(position) {
    if (!position || typeof CONSTANTS === 'undefined') return false;

    const zone = CONSTANTS.GRAVEYARD_ZONE;
    if (!zone) return false;

    const sectorSize = CONSTANTS.SECTOR_SIZE || 1000;
    const sectorX = Math.floor(position.x / sectorSize);
    const sectorY = Math.floor(position.y / sectorSize);

    return sectorX >= zone.MIN_SECTOR_X && sectorX <= zone.MAX_SECTOR_X &&
           sectorY >= zone.MIN_SECTOR_Y && sectorY <= zone.MAX_SECTOR_Y;
  },

  /**
   * Spawn a new metallic glint particle
   * @param {{x: number, y: number}} playerPosition
   */
  spawnGlintParticle(playerPosition) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (this.config.glintSpawnRadius - 100);
    const lifetime = this.config.glintLifetimeMin +
      Math.random() * (this.config.glintLifetimeMax - this.config.glintLifetimeMin);

    this.glintParticles.push({
      x: playerPosition.x + Math.cos(angle) * distance,
      y: playerPosition.y + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 5,  // Very slow drift
      vy: (Math.random() - 0.5) * 5,
      size: this.config.glintSizeMin + Math.random() * (this.config.glintSizeMax - this.config.glintSizeMin),
      color: this.config.glintColors[Math.floor(Math.random() * this.config.glintColors.length)],
      life: lifetime,
      maxLife: lifetime,
      phase: Math.random() * Math.PI * 2,  // Random phase for twinkle
      twinkleSpeed: 2 + Math.random() * 3   // Twinkle frequency
    });
  },

  /**
   * Update metallic glint particles
   * @param {number} dt
   * @param {{x: number, y: number}} playerPosition
   */
  updateGlintParticles(dt, playerPosition) {
    for (let i = this.glintParticles.length - 1; i >= 0; i--) {
      const p = this.glintParticles[i];

      // Update lifetime
      p.life -= dt * 1000;
      if (p.life <= 0) {
        this.glintParticles.splice(i, 1);
        continue;
      }

      // Apply drift
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Check if too far from player (despawn)
      const dx = p.x - playerPosition.x;
      const dy = p.y - playerPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.config.glintSpawnRadius * 1.5) {
        this.glintParticles.splice(i, 1);
      }
    }
  },

  /**
   * Draw graveyard atmosphere effects
   * Should be called AFTER background but BEFORE game objects
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  drawAmbient(ctx, camera, viewportWidth, viewportHeight) {
    if (this.transitionProgress <= 0.01) return;

    ctx.save();

    // Draw ambient dimming overlay
    const dimOpacity = this.config.dimOpacity * this.transitionProgress;
    ctx.fillStyle = this.config.dimColor;
    ctx.globalAlpha = dimOpacity;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Draw vignette effect for more atmosphere
    this.drawVignette(ctx, viewportWidth, viewportHeight);

    ctx.restore();
  },

  /**
   * Draw vignette overlay
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  drawVignette(ctx, viewportWidth, viewportHeight) {
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const radius = Math.max(viewportWidth, viewportHeight) * 0.7;

    const gradient = ctx.createRadialGradient(
      centerX, centerY, radius * 0.3,
      centerX, centerY, radius
    );

    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, 'transparent');
    gradient.addColorStop(1, `rgba(5, 5, 16, ${this.config.vignetteStrength * this.transitionProgress})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  },

  /**
   * Draw metallic glint particles
   * Should be called as part of the particle/effects layer
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  drawGlints(ctx, camera, viewportWidth, viewportHeight) {
    if (this.glintParticles.length === 0) return;

    ctx.save();

    const margin = 50;

    for (const p of this.glintParticles) {
      // Convert to screen coordinates
      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;

      // Skip if off screen
      if (screenX < -margin || screenX > viewportWidth + margin ||
          screenY < -margin || screenY > viewportHeight + margin) {
        continue;
      }

      // Calculate twinkle/glint effect
      const lifeRatio = p.life / p.maxLife;
      const twinkle = (Math.sin(this.time * p.twinkleSpeed + p.phase) + 1) / 2;

      // Fade in/out based on lifetime
      let alpha = lifeRatio;
      if (lifeRatio > 0.8) {
        alpha = (1 - lifeRatio) * 5;  // Fade in
      } else if (lifeRatio < 0.2) {
        alpha = lifeRatio * 5;  // Fade out
      }

      // Apply twinkle - particles "glint" brightly sometimes
      const glintStrength = twinkle * twinkle;  // Squared for sharper glints
      alpha *= 0.3 + glintStrength * 0.7;

      // Also apply transition progress
      alpha *= this.transitionProgress;

      if (alpha < 0.01) continue;

      ctx.globalAlpha = alpha;

      // Draw the metallic glint
      const size = p.size * (0.8 + glintStrength * 0.4);  // Size pulses with twinkle

      // Core of the glint
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
      ctx.fill();

      // Bright center during strong glints
      if (glintStrength > 0.6) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * (glintStrength - 0.6) * 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Cross-shaped glint flare for strong twinkles
        if (glintStrength > 0.8) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = alpha * (glintStrength - 0.8) * 5;

          // Horizontal flare
          ctx.beginPath();
          ctx.moveTo(screenX - size * 2, screenY);
          ctx.lineTo(screenX + size * 2, screenY);
          ctx.stroke();

          // Vertical flare
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - size * 2);
          ctx.lineTo(screenX, screenY + size * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  },

  /**
   * Check if graveyard effects are currently active
   * @returns {boolean}
   */
  isActive() {
    return this.transitionProgress > 0.01;
  },

  /**
   * Get current transition progress
   * @returns {number} 0-1 value
   */
  getTransitionProgress() {
    return this.transitionProgress;
  }
};

// Make globally available
if (typeof window !== 'undefined') {
  window.GraveyardAtmosphere = GraveyardAtmosphere;
}
