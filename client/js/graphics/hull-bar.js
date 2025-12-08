/**
 * Hull HP Bar Renderer
 * Renders HP bars above ships with visibility logic and critical health warning
 *
 * Visibility Rules:
 * - Hidden at 100% HP
 * - Shown when damaged (visible for 2s after healing to full)
 * - Always visible below 100% HP
 * - Critical warning (<25%): Red glow + pulse animation
 */

const HullBarRenderer = {
  // Animation time accumulator
  time: 0,

  // Bar dimensions
  BAR_WIDTH: 40,
  BAR_HEIGHT: 4,
  BAR_OFFSET_Y: -35, // Pixels above ship center

  // Visibility timeout (ms)
  VISIBILITY_TIMEOUT: 2000,

  // Color thresholds and colors
  COLORS: {
    high: '#00ff00',    // 60-100%
    medium: '#ffaa00',  // 30-59%
    low: '#ff3300',     // 0-29%
    background: '#333333',
    border: '#555555'
  },

  /**
   * Initialize the hull bar renderer
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
   * Check if hull bar should be visible
   * @param {number} hullCurrent - Current hull HP
   * @param {number} hullMax - Maximum hull HP
   * @param {number} lastDamageTime - Timestamp of last damage taken
   * @returns {boolean} - Whether bar should be drawn
   */
  shouldShow(hullCurrent, hullMax, lastDamageTime) {
    // Always hide at full health after timeout
    if (hullCurrent >= hullMax) {
      const timeSinceDamage = Date.now() - lastDamageTime;
      return timeSinceDamage < this.VISIBILITY_TIMEOUT;
    }
    // Always show when not at full health
    return true;
  },

  /**
   * Get hull bar color based on percentage
   * @param {number} percent - Hull percentage (0-100)
   * @returns {string} - Color hex code
   */
  getColor(percent) {
    if (percent >= 60) return this.COLORS.high;
    if (percent >= 30) return this.COLORS.medium;
    return this.COLORS.low;
  },

  /**
   * Draw hull bar for an entity
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {number} hullCurrent - Current hull HP
   * @param {number} hullMax - Maximum hull HP
   * @param {number} lastDamageTime - Timestamp of last damage (optional)
   */
  drawBar(ctx, screenX, screenY, hullCurrent, hullMax, lastDamageTime = 0) {
    // Check visibility
    if (!this.shouldShow(hullCurrent, hullMax, lastDamageTime)) {
      return;
    }

    const percent = (hullCurrent / hullMax) * 100;
    const fillWidth = (percent / 100) * this.BAR_WIDTH;

    // Calculate position (centered above ship)
    const barX = screenX - this.BAR_WIDTH / 2;
    const barY = screenY + this.BAR_OFFSET_Y;

    ctx.save();

    // Critical health warning effect
    if (percent < 25) {
      // Pulsing glow
      const pulseIntensity = 0.5 + Math.sin(this.time * 6) * 0.3;
      ctx.shadowColor = this.COLORS.low;
      ctx.shadowBlur = 8 * pulseIntensity;

      // Slight scale pulse
      const scalePulse = 1 + Math.sin(this.time * 4) * 0.05;
      ctx.translate(screenX, barY + this.BAR_HEIGHT / 2);
      ctx.scale(scalePulse, scalePulse);
      ctx.translate(-screenX, -(barY + this.BAR_HEIGHT / 2));
    }

    // Background bar
    ctx.fillStyle = this.COLORS.background;
    ctx.fillRect(barX, barY, this.BAR_WIDTH, this.BAR_HEIGHT);

    // Health fill
    const color = this.getColor(percent);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, fillWidth, this.BAR_HEIGHT);

    // Border
    ctx.strokeStyle = this.COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, this.BAR_WIDTH, this.BAR_HEIGHT);

    // Segment markers (every 25%)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const segX = barX + (this.BAR_WIDTH * i / 4);
      ctx.beginPath();
      ctx.moveTo(segX, barY);
      ctx.lineTo(segX, barY + this.BAR_HEIGHT);
      ctx.stroke();
    }

    ctx.restore();
  },

  /**
   * Draw hull bar with shield bar stacked (for entities with shields)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {number} hullCurrent - Current hull HP
   * @param {number} hullMax - Maximum hull HP
   * @param {number} shieldCurrent - Current shield HP (optional)
   * @param {number} shieldMax - Maximum shield HP (optional)
   * @param {number} lastDamageTime - Timestamp of last damage
   */
  drawBars(ctx, screenX, screenY, hullCurrent, hullMax, shieldCurrent = 0, shieldMax = 0, lastDamageTime = 0) {
    // Check if we should show anything
    const hullPercent = (hullCurrent / hullMax) * 100;
    const showHull = this.shouldShow(hullCurrent, hullMax, lastDamageTime);
    const hasShield = shieldMax > 0;
    const showShield = hasShield && (shieldCurrent > 0 || showHull);

    if (!showHull && !showShield) return;

    const barX = screenX - this.BAR_WIDTH / 2;
    let currentY = screenY + this.BAR_OFFSET_Y;

    ctx.save();

    // Critical health warning effect (only for hull)
    if (hullPercent < 25 && showHull) {
      const pulseIntensity = 0.5 + Math.sin(this.time * 6) * 0.3;
      ctx.shadowColor = this.COLORS.low;
      ctx.shadowBlur = 8 * pulseIntensity;
    }

    // Draw shield bar first (on top)
    if (showShield && shieldMax > 0) {
      const shieldPercent = (shieldCurrent / shieldMax) * 100;
      const shieldFillWidth = (shieldPercent / 100) * this.BAR_WIDTH;

      // Shield background
      ctx.fillStyle = this.COLORS.background;
      ctx.fillRect(barX, currentY, this.BAR_WIDTH, this.BAR_HEIGHT);

      // Shield fill (cyan)
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(barX, currentY, shieldFillWidth, this.BAR_HEIGHT);

      // Border
      ctx.strokeStyle = '#0088cc';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, currentY, this.BAR_WIDTH, this.BAR_HEIGHT);

      currentY += this.BAR_HEIGHT + 2; // Gap between bars
    }

    // Draw hull bar
    if (showHull) {
      const fillWidth = (hullPercent / 100) * this.BAR_WIDTH;

      // Background
      ctx.fillStyle = this.COLORS.background;
      ctx.fillRect(barX, currentY, this.BAR_WIDTH, this.BAR_HEIGHT);

      // Health fill
      ctx.fillStyle = this.getColor(hullPercent);
      ctx.fillRect(barX, currentY, fillWidth, this.BAR_HEIGHT);

      // Border
      ctx.strokeStyle = this.COLORS.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, currentY, this.BAR_WIDTH, this.BAR_HEIGHT);
    }

    ctx.restore();
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.HullBarRenderer = HullBarRenderer;
}
