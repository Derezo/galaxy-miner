/**
 * Chain Lightning Effect
 * Renders lightning arcs jumping between targets for Tesla Cannon
 */

const ChainLightningEffect = {
  chains: [],

  // Tesla color palette
  colors: {
    primary: '#00ccff',
    secondary: '#44ffaa',
    core: '#ffffff',
    glow: '#00ccff60'
  },

  /**
   * Process server chain lightning event
   * @param {Object} data - Chain lightning data from server
   */
  triggerFromEvent(data) {
    const { sourceX, sourceY, chains } = data;

    if (!chains || chains.length === 0) return;

    let prevX = sourceX;
    let prevY = sourceY;

    chains.forEach((chain, index) => {
      this.chains.push({
        startX: prevX,
        startY: prevY,
        endX: chain.targetX,
        endY: chain.targetY,
        startTime: Date.now() + index * 50, // Stagger by 50ms
        duration: 400,
        jumpIndex: index,
        destroyed: chain.destroyed,
        // Generate random offsets for consistent jitter
        offsets: this.generateOffsets(10)
      });

      prevX = chain.targetX;
      prevY = chain.targetY;
    });
  },

  /**
   * Generate random offsets for lightning path consistency
   */
  generateOffsets(count) {
    const offsets = [];
    for (let i = 0; i < count; i++) {
      offsets.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    return offsets;
  },

  /**
   * Update chain lightning effects
   */
  update(dt) {
    const now = Date.now();
    this.chains = this.chains.filter(chain => {
      const elapsed = now - chain.startTime;
      return elapsed < chain.duration;
    });
  },

  /**
   * Draw all active chain lightning effects
   */
  draw(ctx, camera) {
    const now = Date.now();

    for (const chain of this.chains) {
      const elapsed = now - chain.startTime;
      if (elapsed < 0) continue; // Not started yet (staggered)

      const progress = elapsed / chain.duration;
      const alpha = 1 - progress * progress; // Ease out

      const screenStartX = chain.startX - camera.x;
      const screenStartY = chain.startY - camera.y;
      const screenEndX = chain.endX - camera.x;
      const screenEndY = chain.endY - camera.y;

      // Amplitude decreases with each jump
      const baseAmplitude = 20 - chain.jumpIndex * 6;
      const amplitude = Math.max(baseAmplitude * (1 - progress * 0.5), 5);

      this.drawLightningArc(
        ctx,
        screenStartX, screenStartY,
        screenEndX, screenEndY,
        amplitude,
        alpha,
        chain.offsets
      );

      // Draw impact burst at end point if target was destroyed
      if (chain.destroyed && progress > 0.3 && progress < 0.7) {
        this.drawImpactBurst(ctx, screenEndX, screenEndY, alpha);
      }
    }
  },

  /**
   * Draw a single lightning arc with 3 layers
   */
  drawLightningArc(ctx, startX, startY, endX, endY, amplitude, alpha, offsets) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Calculate arc segments
    const segments = 10;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const perpAngle = angle + Math.PI / 2;

    // Build the jagged path
    const points = [{ x: startX, y: startY }];

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = startX + dx * t;
      const baseY = startY + dy * t;

      // Use stored offsets for consistent jitter with sine wave wobble
      const offset = offsets[i % offsets.length];
      const wobble = Math.sin(t * Math.PI * 3 + Date.now() * 0.01) * 0.5;
      const jitter = (offset.x + wobble) * amplitude * (1 - Math.abs(t - 0.5) * 2);

      points.push({
        x: baseX + Math.cos(perpAngle) * jitter,
        y: baseY + Math.sin(perpAngle) * jitter
      });
    }

    points.push({ x: endX, y: endY });

    // Layer 1: Outer glow (widest)
    ctx.strokeStyle = this.colors.glow;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.strokePath(ctx, points);

    // Layer 2: Primary color
    ctx.strokeStyle = this.colors.primary;
    ctx.lineWidth = 4;
    this.strokePath(ctx, points);

    // Layer 3: White core (thinnest)
    ctx.strokeStyle = this.colors.core;
    ctx.lineWidth = 2;
    this.strokePath(ctx, points);

    ctx.restore();
  },

  /**
   * Stroke a path through points
   */
  strokePath(ctx, points) {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
  },

  /**
   * Draw burst effect at impact point
   */
  drawImpactBurst(ctx, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;

    // Radial burst
    const burstRadius = 15 + Math.random() * 5;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, burstRadius);
    gradient.addColorStop(0, this.colors.core);
    gradient.addColorStop(0.3, this.colors.secondary);
    gradient.addColorStop(0.6, this.colors.primary);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, burstRadius, 0, Math.PI * 2);
    ctx.fill();

    // Small lightning tendrils
    const tendrilCount = 4;
    ctx.strokeStyle = this.colors.core;
    ctx.lineWidth = 1;

    for (let i = 0; i < tendrilCount; i++) {
      const angle = (i / tendrilCount) * Math.PI * 2 + Math.random() * 0.5;
      const length = 10 + Math.random() * 8;

      ctx.beginPath();
      ctx.moveTo(x, y);

      let tx = x;
      let ty = y;

      for (let j = 0; j < 3; j++) {
        const jitter = (Math.random() - 0.5) * 6;
        tx += Math.cos(angle + jitter * 0.2) * (length / 3);
        ty += Math.sin(angle + jitter * 0.2) * (length / 3);
        ctx.lineTo(tx, ty);
      }

      ctx.stroke();
    }

    ctx.restore();
  },

  /**
   * Clear all effects
   */
  clear() {
    this.chains = [];
  }
};
