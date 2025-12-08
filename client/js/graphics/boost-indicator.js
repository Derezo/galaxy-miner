/**
 * Boost Cooldown Indicator
 * Renders a soft light progress bar under the player ship during boost cooldown
 *
 * Only visible during cooldown - hidden when boost is ready
 * Progress from 0% to 100% as cooldown completes
 */

const BoostIndicator = {
  // Animation time accumulator
  time: 0,

  // Indicator dimensions
  BAR_WIDTH: 36,
  BAR_HEIGHT: 4,
  BAR_OFFSET_Y: 28, // Pixels below ship center

  // Colors
  COLORS: {
    background: 'rgba(0, 0, 0, 0.4)',
    fill: '#44ddff',
    fillGlow: 'rgba(68, 221, 255, 0.6)',
    ready: '#66ffaa'
  },

  /**
   * Initialize the boost indicator
   */
  init() {
    // Nothing to pre-initialize
  },

  /**
   * Update animations
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;
  },

  /**
   * Draw boost cooldown indicator
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {boolean} isOnCooldown - Whether boost is on cooldown
   * @param {number} cooldownPercent - Cooldown progress (0-100, 100 = ready)
   * @param {boolean} isActive - Whether boost is currently active
   */
  draw(ctx, screenX, screenY, isOnCooldown, cooldownPercent, isActive = false) {
    // Only show during cooldown
    if (!isOnCooldown && !isActive) {
      return;
    }

    const barX = screenX - this.BAR_WIDTH / 2;
    const barY = screenY + this.BAR_OFFSET_Y;

    ctx.save();

    // Different appearance for active vs cooldown
    if (isActive) {
      this.drawActiveIndicator(ctx, barX, barY);
    } else {
      this.drawCooldownIndicator(ctx, barX, barY, cooldownPercent);
    }

    ctx.restore();
  },

  /**
   * Draw indicator when boost is active
   */
  drawActiveIndicator(ctx, barX, barY) {
    // Pulsing bright bar during active boost
    const pulseIntensity = 0.7 + Math.sin(this.time * 8) * 0.3;

    // Glow effect
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12 * pulseIntensity;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.drawRoundedRect(ctx, barX, barY, this.BAR_WIDTH, this.BAR_HEIGHT, 2);
    ctx.fill();

    // Active fill (white/cyan gradient)
    const gradient = ctx.createLinearGradient(barX, barY, barX + this.BAR_WIDTH, barY);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#88eeff');
    gradient.addColorStop(1, '#ffffff');

    ctx.fillStyle = gradient;
    ctx.globalAlpha = pulseIntensity;
    this.drawRoundedRect(ctx, barX, barY, this.BAR_WIDTH, this.BAR_HEIGHT, 2);
    ctx.fill();
  },

  /**
   * Draw indicator during cooldown
   */
  drawCooldownIndicator(ctx, barX, barY, cooldownPercent) {
    const fillWidth = (cooldownPercent / 100) * this.BAR_WIDTH;

    // Subtle glow
    ctx.shadowColor = this.COLORS.fill;
    ctx.shadowBlur = 6;

    // Background bar (rounded)
    ctx.fillStyle = this.COLORS.background;
    this.drawRoundedRect(ctx, barX, barY, this.BAR_WIDTH, this.BAR_HEIGHT, 2);
    ctx.fill();

    // Progress fill
    if (fillWidth > 0) {
      // Gradient fill
      const gradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
      gradient.addColorStop(0, 'rgba(68, 221, 255, 0.4)');
      gradient.addColorStop(1, this.COLORS.fill);

      ctx.fillStyle = gradient;
      this.drawRoundedRect(ctx, barX, barY, fillWidth, this.BAR_HEIGHT, 2);
      ctx.fill();

      // Leading edge glow
      if (cooldownPercent < 100) {
        ctx.beginPath();
        ctx.arc(barX + fillWidth, barY + this.BAR_HEIGHT / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6 + Math.sin(this.time * 4) * 0.2;
        ctx.fill();
      }
    }

    // Ready flash when complete
    if (cooldownPercent >= 100) {
      const flashOpacity = Math.max(0, 1 - (this.time % 1) * 2);
      if (flashOpacity > 0) {
        ctx.fillStyle = this.COLORS.ready;
        ctx.globalAlpha = flashOpacity * 0.5;
        this.drawRoundedRect(ctx, barX, barY, this.BAR_WIDTH, this.BAR_HEIGHT, 2);
        ctx.fill();
      }
    }
  },

  /**
   * Draw a rounded rectangle path
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  },

  /**
   * Alternative arc-style indicator (optional style)
   */
  drawArcIndicator(ctx, screenX, screenY, cooldownPercent) {
    const radius = 22;
    const lineWidth = 3;
    const startAngle = Math.PI * 0.5; // Start from bottom
    const endAngle = startAngle + (cooldownPercent / 100) * Math.PI * 2;

    ctx.save();

    // Background arc
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(68, 221, 255, 0.2)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Progress arc
    if (cooldownPercent > 0) {
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, startAngle, endAngle);
      ctx.strokeStyle = this.COLORS.fill;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = this.COLORS.fill;
      ctx.shadowBlur = 8;
      ctx.stroke();
    }

    ctx.restore();
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.BoostIndicator = BoostIndicator;
}
