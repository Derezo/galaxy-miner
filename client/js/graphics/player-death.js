// Galaxy Miner - Player Death Effect System
// Cinematic death experience with phases, text animation, and respawn handling

const PlayerDeathEffect = {
  // State
  active: false,
  phase: 'inactive', // 'impact', 'text_fadein', 'info_display', 'respawn_waiting', 'inactive'
  startTime: 0,
  phaseStartTime: 0,
  deathData: null,

  // Timings (milliseconds) - simplified to 4 seconds total
  TIMINGS: {
    IMPACT_DURATION: 500,
    TEXT_FADEIN_START: 500,
    TEXT_FADEIN_DURATION: 1000,
    INFO_DISPLAY_START: 1500,
    INFO_DISPLAY_DURATION: 2500,
    TOTAL_DURATION: 4000,
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
    // CRITICAL: Don't restart if death sequence is already active
    // This prevents NPC attacks from interrupting/looping the death sequence
    if (this.active) {
      Logger.log('[PlayerDeathEffect] Already active, ignoring duplicate trigger');
      return;
    }

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

    Logger.log('[PlayerDeathEffect] Triggered:', data);
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
    } else {
      this.overlayAlpha = 0.7;
    }

    // Phase transitions and updates (simplified - no text explosion)
    if (elapsed < T.IMPACT_DURATION) {
      this.phase = 'impact';
    } else if (elapsed < T.INFO_DISPLAY_START) {
      this.phase = 'text_fadein';
      // Slowly fade in text
      const fadeProgress = (elapsed - T.TEXT_FADEIN_START) / T.TEXT_FADEIN_DURATION;
      this.textAlpha = Math.min(1.0, fadeProgress);
      this.textScale = 0.9 + fadeProgress * 0.1; // Scale from 0.9 to 1.0
    } else if (elapsed < T.TOTAL_DURATION) {
      this.phase = 'info_display';
      this.textAlpha = 1.0;
      this.textScale = 1.0;
    } else if (this.phase !== 'respawn_waiting') {
      // Animation complete - show respawn button
      this.phase = 'respawn_waiting';
      this.showRespawnButton();
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
  },

  /**
   * Show the respawn button after death animation completes
   */
  showRespawnButton() {
    // Remove any existing button first
    const existing = document.getElementById('respawn-button');
    if (existing) existing.remove();

    // Create simple centered button
    const btn = document.createElement('button');
    btn.id = 'respawn-button';
    btn.className = 'respawn-button';
    btn.textContent = 'RESPAWN';
    btn.onclick = () => this.handleRespawn();

    const container = document.getElementById('ui-container');
    if (container) {
      container.appendChild(btn);
    }

    Logger.log('[PlayerDeathEffect] Respawn button shown');
  },

  /**
   * Handle respawn button click
   */
  handleRespawn() {
    Logger.log('[PlayerDeathEffect] Respawn button clicked, Player.isDead:', Player?.isDead);

    // Remove button
    const btn = document.getElementById('respawn-button');
    if (btn) btn.remove();

    // Send respawn request to server (always deep_space for auto-respawn)
    if (typeof Network !== 'undefined' && Network.socket) {
      Logger.log('[PlayerDeathEffect] Sending respawn:select to server');
      Network.sendRespawnSelect('deep_space', null);
    } else {
      Logger.error('[PlayerDeathEffect] Network not available for respawn!');
    }

    // Cleanup will happen when server confirms respawn via onRespawnConfirmed()
  },

  /**
   * Called when server confirms respawn - cleanup death effect state
   * @param {Object} data - Respawn data from server
   */
  onRespawnConfirmed(data) {
    // Remove respawn button if still present
    const btn = document.getElementById('respawn-button');
    if (btn) btn.remove();

    // End death effect
    this.active = false;
    this.phase = 'inactive';

    // Apply invulnerability
    this.invulnerableUntil = Date.now() + this.TIMINGS.INVULNERABILITY_DURATION;

    Logger.log('[PlayerDeathEffect] Respawn confirmed, death effect ended');
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
      // Draw white flash first
      if (this.whiteFlashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.whiteFlashAlpha * 0.8})`;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw crimson vignette overlay
      if (this.overlayAlpha > 0) {
        this.drawVignetteOverlay(ctx, width, height);
      }

      // Draw death text and info (including during respawn_waiting)
      if (this.phase === 'text_fadein' || this.phase === 'info_display' || this.phase === 'respawn_waiting') {
        this.drawDeathText(ctx, width, height);

        if (this.phase === 'info_display' || this.phase === 'respawn_waiting') {
          this.drawDeathInfo(ctx, width, height);
        }
      }
    }

    ctx.restore();
  },

  /**
   * Draw dark crimson vignette overlay
   * @param {number} alphaMultiplier - Optional multiplier for overlay alpha (0-1, default 1.0)
   */
  drawVignetteOverlay(ctx, width, height, alphaMultiplier = 1.0) {
    const effectiveAlpha = this.overlayAlpha * alphaMultiplier;

    // Create radial gradient for vignette effect
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );

    gradient.addColorStop(0, `rgba(20, 0, 0, ${effectiveAlpha * 0.3})`);
    gradient.addColorStop(0.5, `rgba(40, 0, 0, ${effectiveAlpha * 0.5})`);
    gradient.addColorStop(1, `rgba(60, 0, 0, ${effectiveAlpha * 0.8})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  },

  /**
   * Draw the main death text with ominous glow
   */
  drawDeathText(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2 - 50;

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

    // Killer info with enhanced faction display
    let killerText = '';
    let killerSubtext = '';

    switch (this.deathData.killerType) {
      case 'player':
        killerText = `by ${this.deathData.killerName || 'another player'}`;
        break;
      case 'npc':
        killerText = `by ${this.deathData.killerName || 'hostile forces'}`;
        if (this.deathData.killerFaction) {
          killerSubtext = `(${this.formatFactionName(this.deathData.killerFaction)})`;
        }
        break;
      case 'star':
      case 'environment':
        killerText = `by ${this.deathData.killerName || 'stellar radiation'}`;
        break;
      case 'comet':
        killerText = 'by comet impact';
        break;
      default:
        killerText = 'cause unknown';
    }

    ctx.fillStyle = `rgba(200, 100, 100, ${infoAlpha})`;
    ctx.fillText(killerText, centerX, currentY);
    currentY += lineHeight;

    // Show faction subtext if present
    if (killerSubtext) {
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = `rgba(150, 100, 100, ${infoAlpha * 0.8})`;
      ctx.fillText(killerSubtext, centerX, currentY);
      currentY += 20;
    }

    currentY += 10;

    // Cargo lost (all items in a two-column table with icons)
    if (this.deathData.droppedCargo && this.deathData.droppedCargo.length > 0) {
      ctx.fillStyle = `rgba(180, 120, 80, ${infoAlpha * 0.9})`;
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('Cargo lost:', centerX, currentY);
      currentY += 22;

      // Draw all items in a two-column table
      const items = this.deathData.droppedCargo;
      const iconSize = 18;
      const columnWidth = 140;
      const rowHeight = 24;
      const tableWidth = columnWidth * 2;
      const tableLeft = centerX - tableWidth / 2;

      ctx.font = '14px "Courier New", monospace';
      ctx.textAlign = 'left';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const col = i % 2;
        const row = Math.floor(i / 2);

        const itemX = tableLeft + col * columnWidth;
        const itemY = currentY + row * rowHeight;

        // Draw resource icon using IconCache
        if (typeof IconCache !== 'undefined') {
          const icon = IconCache.getResourceIcon(item.resource_type, iconSize);
          if (icon && icon.complete) {
            ctx.drawImage(icon, itemX, itemY - iconSize + 4, iconSize, iconSize);
          }
        }

        // Draw quantity and name
        ctx.fillStyle = `rgba(180, 120, 80, ${infoAlpha * 0.9})`;
        const itemText = `${item.quantity}x ${this.formatResourceName(item.resource_type)}`;
        ctx.fillText(itemText, itemX + iconSize + 4, itemY);
      }

      // Calculate how many rows we used
      const totalRows = Math.ceil(items.length / 2);
      currentY += totalRows * rowHeight + 10;

      // Reset text alignment
      ctx.textAlign = 'center';
    }

    // Session statistics section
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = `rgba(150, 150, 200, ${infoAlpha})`;

    // Get session stats
    const stats = typeof Player !== 'undefined' ? Player.getSessionStats() : null;

    // Survival time (use stats or deathData)
    const survivalTime = stats?.survivalTime || this.deathData.survivalTime;
    const survivalText = `Survived: ${this.formatSurvivalTime(survivalTime)}`;
    ctx.fillText(survivalText, centerX, currentY);
    currentY += 25;

    // Additional stats if available
    if (stats) {
      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = `rgba(130, 130, 180, ${infoAlpha * 0.9})`;

      // Distance traveled
      if (stats.distanceTraveled > 0) {
        const distText = `Distance: ${this.formatDistance(stats.distanceTraveled)}`;
        ctx.fillText(distText, centerX, currentY);
        currentY += 18;
      }

      // NPCs destroyed
      if (stats.npcsKilled > 0) {
        ctx.fillStyle = `rgba(200, 100, 100, ${infoAlpha * 0.9})`;
        const killsText = `Enemies destroyed: ${stats.npcsKilled}`;
        ctx.fillText(killsText, centerX, currentY);
        currentY += 18;
      }

      // Resources mined
      if (stats.resourcesMined > 0) {
        ctx.fillStyle = `rgba(130, 130, 180, ${infoAlpha * 0.9})`;
        const mineText = `Resources mined: ${stats.resourcesMined}`;
        ctx.fillText(mineText, centerX, currentY);
        currentY += 18;
      }

      // Credits earned
      if (stats.creditsEarned > 0) {
        ctx.fillStyle = `rgba(200, 180, 100, ${infoAlpha * 0.9})`;
        const creditsText = `Credits earned: ${stats.creditsEarned.toLocaleString()}`;
        ctx.fillText(creditsText, centerX, currentY);
      }
    }

    ctx.restore();
  },

  /**
   * Format distance for display
   * @param {number} distance - Distance in units
   * @returns {string} Formatted distance
   */
  formatDistance(distance) {
    if (distance >= 10000) {
      return (distance / 1000).toFixed(1) + 'k units';
    }
    return Math.round(distance) + ' units';
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
  },

  /**
   * Format faction name for display
   * @param {string} faction - Faction key
   * @returns {string} Formatted faction name
   */
  formatFactionName(faction) {
    const factionNames = {
      pirate: 'Pirates',
      scavenger: 'Scavengers',
      swarm: 'The Swarm',
      void: 'Void Entities',
      rogue_miner: 'Rogue Miners'
    };
    return factionNames[faction] || faction;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PlayerDeathEffect = PlayerDeathEffect;
}
