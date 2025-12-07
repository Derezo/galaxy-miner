/**
 * Linked Damage Visual Effect
 *
 * Displays bio-electric arcs between swarm units when linked damage spreads.
 * Shows damage numbers at the midpoint of each link.
 */

const LinkedDamageEffect = {
  // Active link effects
  links: [],

  // Configuration
  config: {
    duration: 300,           // ms per link effect
    arcSegments: 8,          // Number of segments in the arc
    arcAmplitude: 15,        // Max amplitude of arc wobble
    arcFrequency: 3,         // Wobble frequency
    lineWidth: 3,
    colors: {
      primary: '#00ff66',    // Bright green
      secondary: '#00cc44',  // Darker green
      glow: 'rgba(0, 255, 102, 0.4)'
    },
    damageTextSize: 14,
    damageTextColor: '#ff6666',
    damageTextOutline: '#000000'
  },

  /**
   * Initialize the effect system
   */
  init() {
    this.links = [];
  },

  /**
   * Trigger a linked damage effect between two units
   * @param {number} sourceX - Source unit X position
   * @param {number} sourceY - Source unit Y position
   * @param {number} targetX - Target unit X position
   * @param {number} targetY - Target unit Y position
   * @param {number} damage - Damage amount to display
   */
  trigger(sourceX, sourceY, targetX, targetY, damage) {
    this.links.push({
      sourceX,
      sourceY,
      targetX,
      targetY,
      damage,
      startTime: Date.now(),
      duration: this.config.duration,
      // Random offset for arc variation
      arcOffset: Math.random() * Math.PI * 2,
      // Random arc direction
      arcDirection: Math.random() > 0.5 ? 1 : -1
    });
  },

  /**
   * Trigger multiple linked damage effects from event data
   * @param {Object} data - Event data with links array
   */
  triggerFromEvent(data) {
    if (!data.links || !Array.isArray(data.links)) return;

    for (const link of data.links) {
      this.trigger(
        link.sourceX,
        link.sourceY,
        link.targetX,
        link.targetY,
        link.damage
      );
    }
  },

  /**
   * Update all active link effects
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const now = Date.now();

    // Remove expired links
    this.links = this.links.filter(link => {
      const elapsed = now - link.startTime;
      return elapsed < link.duration;
    });
  },

  /**
   * Draw all active link effects
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera object with x, y properties
   */
  draw(ctx, camera) {
    if (this.links.length === 0) return;

    const now = Date.now();

    for (const link of this.links) {
      const elapsed = now - link.startTime;
      const progress = elapsed / link.duration;

      // Fade out over duration
      const alpha = 1 - progress;

      // Screen coordinates
      const sx = link.sourceX - camera.x;
      const sy = link.sourceY - camera.y;
      const tx = link.targetX - camera.x;
      const ty = link.targetY - camera.y;

      // Draw the bio-electric arc
      this.drawArc(ctx, sx, sy, tx, ty, alpha, link.arcOffset, link.arcDirection, elapsed);

      // Draw damage number at midpoint
      this.drawDamageNumber(ctx, sx, sy, tx, ty, link.damage, alpha, progress);
    }
  },

  /**
   * Draw a bio-electric arc between two points
   */
  drawArc(ctx, x1, y1, x2, y2, alpha, arcOffset, arcDirection, elapsed) {
    const config = this.config;
    const segments = config.arcSegments;

    // Calculate perpendicular direction for arc displacement
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 1) return;

    // Perpendicular unit vector
    const px = -dy / length;
    const py = dx / length;

    // Time-based animation
    const time = elapsed / 1000;

    ctx.save();

    // Draw glow layer
    ctx.strokeStyle = config.colors.glow;
    ctx.lineWidth = config.lineWidth * 3;
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawArcPath(ctx, x1, y1, x2, y2, segments, px, py, config.arcAmplitude, config.arcFrequency, arcOffset, arcDirection, time);
    ctx.stroke();

    // Draw main arc
    ctx.strokeStyle = config.colors.primary;
    ctx.lineWidth = config.lineWidth;
    ctx.globalAlpha = alpha;

    this.drawArcPath(ctx, x1, y1, x2, y2, segments, px, py, config.arcAmplitude, config.arcFrequency, arcOffset, arcDirection, time);
    ctx.stroke();

    // Draw inner bright core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = config.lineWidth * 0.5;
    ctx.globalAlpha = alpha * 0.7;

    this.drawArcPath(ctx, x1, y1, x2, y2, segments, px, py, config.arcAmplitude * 0.5, config.arcFrequency, arcOffset, arcDirection, time);
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw the actual arc path
   */
  drawArcPath(ctx, x1, y1, x2, y2, segments, px, py, amplitude, frequency, offset, direction, time) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;

      // Base interpolated position
      const bx = x1 + (x2 - x1) * t;
      const by = y1 + (y2 - y1) * t;

      // Arc displacement (peaks in the middle, zero at endpoints)
      const arcT = Math.sin(t * Math.PI);

      // Animated wobble
      const wobble = Math.sin(t * Math.PI * frequency + offset + time * 15) * direction;

      // Final displacement
      const displacement = arcT * amplitude * wobble;

      ctx.lineTo(bx + px * displacement, by + py * displacement);
    }
  },

  /**
   * Draw damage number at the midpoint of the link
   */
  drawDamageNumber(ctx, x1, y1, x2, y2, damage, alpha, progress) {
    const config = this.config;

    // Midpoint with slight upward drift
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - progress * 20; // Drift up as it fades

    ctx.save();

    // Set up text style
    ctx.font = `bold ${config.damageTextSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;

    const text = `-${Math.round(damage)}`;

    // Draw outline
    ctx.strokeStyle = config.damageTextOutline;
    ctx.lineWidth = 3;
    ctx.strokeText(text, mx, my);

    // Draw text
    ctx.fillStyle = config.damageTextColor;
    ctx.fillText(text, mx, my);

    ctx.restore();
  },

  /**
   * Check if there are any active effects
   */
  hasActiveEffects() {
    return this.links.length > 0;
  },

  /**
   * Clear all effects
   */
  clear() {
    this.links = [];
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.LinkedDamageEffect = LinkedDamageEffect;
}
