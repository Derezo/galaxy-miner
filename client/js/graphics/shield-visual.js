/**
 * Shield Visual Renderer
 * Renders shield bubbles around ships with tier-based shapes and effects
 *
 * Shield Shapes by Tier:
 * - Tier 1-2: Circular bubble (soft blue)
 * - Tier 3-4: Hexagonal energy field (teal)
 * - Tier 5: Dodecahedron (12-sided) pattern (vibrant green)
 */

const ShieldVisual = {
  // Cached Path2D objects for each shape type
  cachedPaths: {},

  // Active shield impacts for ripple effects
  impacts: [],

  // Animation time accumulator
  time: 0,

  // Smoothed shield values per entity for smooth transitions
  smoothedShields: new Map(),

  // Shield visual configuration by tier
  // New colors: Tier 1-2 soft blue, Tier 3-4 teal, Tier 5 green
  TIER_CONFIG: {
    1: {
      shape: 'circle',
      borderColor: 'rgba(100, 150, 220, 1)',      // Soft blue border
      innerColor: 'rgba(100, 150, 220, 0.08)',    // Very subtle interior
      glowColor: 'rgba(100, 150, 220, 0.3)',
      size: 1.0
    },
    2: {
      shape: 'circle',
      borderColor: 'rgba(110, 160, 230, 1)',      // Soft blue border
      innerColor: 'rgba(110, 160, 230, 0.10)',
      glowColor: 'rgba(110, 160, 230, 0.35)',
      size: 1.0
    },
    3: {
      shape: 'hexagon',
      borderColor: 'rgba(80, 200, 200, 1)',       // Teal border
      innerColor: 'rgba(80, 200, 200, 0.08)',
      glowColor: 'rgba(80, 200, 200, 0.35)',
      size: 1.05
    },
    4: {
      shape: 'hexagon',
      borderColor: 'rgba(90, 220, 210, 1)',       // Bright teal border
      innerColor: 'rgba(90, 220, 210, 0.10)',
      glowColor: 'rgba(90, 220, 210, 0.4)',
      size: 1.08
    },
    5: {
      shape: 'dodecagon',
      borderColor: 'rgba(100, 255, 120, 1)',      // Vibrant green border
      innerColor: 'rgba(100, 255, 120, 0.06)',    // Soft green interior
      glowColor: 'rgba(100, 255, 120, 0.4)',
      size: 1.12
    }
  },

  // Base shield radius relative to ship size
  BASE_RADIUS: 28,

  // Smooth interpolation speed (higher = faster response)
  SMOOTH_SPEED: 3.0,

  // Maximum border opacity at full shields
  MAX_BORDER_OPACITY: 0.7,
  MIN_BORDER_OPACITY: 0.15,

  // Maximum inner fill opacity (very subtle)
  MAX_INNER_OPACITY: 0.12,
  MIN_INNER_OPACITY: 0.02,

  /**
   * Initialize the shield visual system
   */
  init() {
    // Pre-create cached paths for each shape
    this.cachedPaths.circle = this.createCirclePath();
    this.cachedPaths.hexagon = this.createPolygonPath(6);
    this.cachedPaths.dodecagon = this.createPolygonPath(12);
  },

  /**
   * Create a circular path
   */
  createCirclePath() {
    const path = new Path2D();
    path.arc(0, 0, 1, 0, Math.PI * 2);
    return path;
  },

  /**
   * Create a regular polygon path with n sides
   */
  createPolygonPath(sides) {
    const path = new Path2D();
    const angleStep = (Math.PI * 2) / sides;

    for (let i = 0; i <= sides; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const x = Math.cos(angle);
      const y = Math.sin(angle);

      if (i === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.closePath();
    return path;
  },

  /**
   * Update shield animations
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;

    // Update and clean up impact effects
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const impact = this.impacts[i];
      impact.age += dt;

      if (impact.age > impact.duration) {
        this.impacts.splice(i, 1);
      }
    }

    // Clean up old smoothed shield entries (entities that haven't been drawn recently)
    // This prevents memory leaks for entities that leave the area
  },

  /**
   * Get smoothed shield value for an entity
   * @param {string} entityId - Unique entity identifier
   * @param {number} targetPercent - Target shield percentage
   * @param {number} dt - Delta time
   */
  getSmoothedShield(entityId, targetPercent, dt) {
    if (!this.smoothedShields.has(entityId)) {
      this.smoothedShields.set(entityId, {
        value: targetPercent,
        lastUpdate: this.time
      });
      return targetPercent;
    }

    const entry = this.smoothedShields.get(entityId);
    const diff = targetPercent - entry.value;

    // Smooth interpolation towards target
    const smoothFactor = 1 - Math.exp(-this.SMOOTH_SPEED * dt);
    entry.value += diff * smoothFactor;
    entry.lastUpdate = this.time;

    return entry.value;
  },

  /**
   * Add a shield impact effect
   * @param {number} worldX - World X position of impact
   * @param {number} worldY - World Y position of impact
   * @param {number} shipX - Ship center X position
   * @param {number} shipY - Ship center Y position
   * @param {number} tier - Shield tier (1-5)
   */
  addImpact(worldX, worldY, shipX, shipY, tier = 1) {
    // Calculate impact angle relative to ship center
    const angle = Math.atan2(worldY - shipY, worldX - shipX);

    const config = this.TIER_CONFIG[tier] || this.TIER_CONFIG[1];

    this.impacts.push({
      shipX,
      shipY,
      angle,
      age: 0,
      duration: 0.4, // 400ms
      intensity: 1.0,
      tier,
      color: config.borderColor
    });
  },

  /**
   * Draw shield for an entity (main entry point)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {number} rotation - Ship rotation in radians
   * @param {number} shieldPercent - Shield percentage (0-100)
   * @param {number} tier - Shield tier (1-5)
   * @param {number} shipSize - Base ship size (optional, default 20)
   */
  drawShield(ctx, screenX, screenY, rotation, shieldPercent, tier, shipSize = 20) {
    // Don't draw if no shield
    if (shieldPercent <= 0) return;

    // Use entity position as a simple ID for smoothing
    const entityId = `${Math.round(screenX)}_${Math.round(screenY)}`;
    const smoothedPercent = this.getSmoothedShield(entityId, shieldPercent, 0.016); // ~60fps

    const config = this.TIER_CONFIG[tier] || this.TIER_CONFIG[1];
    const path = this.cachedPaths[config.shape];
    if (!path) return;

    // Calculate shield radius
    const radius = this.BASE_RADIUS * config.size * (shipSize / 20);

    // Calculate opacities based on smoothed shield percentage
    const shieldRatio = smoothedPercent / 100;

    // Border is primary indicator - scales strongly with shield strength
    const borderOpacity = this.MIN_BORDER_OPACITY + (this.MAX_BORDER_OPACITY - this.MIN_BORDER_OPACITY) * shieldRatio;

    // Inner fill is subtle and only adjusts slightly
    const innerOpacity = this.MIN_INNER_OPACITY + (this.MAX_INNER_OPACITY - this.MIN_INNER_OPACITY) * shieldRatio;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Rotate hexagon/dodecagon with ship (circle doesn't need rotation)
    if (config.shape !== 'circle') {
      ctx.rotate(rotation);
    }

    // Scale to radius
    ctx.scale(radius, radius);

    // Draw radial gradient fill (darker outside, transparent inside)
    this.drawGradientFill(ctx, path, config, innerOpacity, radius);

    // Draw softened layered border
    this.drawSoftenedBorder(ctx, path, config, borderOpacity, radius, tier);

    ctx.restore();

    // Draw impact ripples
    this.drawImpacts(ctx, screenX, screenY, radius, tier);
  },

  /**
   * Draw radial gradient fill (darker edge, transparent center)
   */
  drawGradientFill(ctx, path, config, opacity, radius) {
    // Create radial gradient (we're in scaled space, so radius is 1)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);

    // Parse the inner color to extract RGB
    const rgb = this.parseRgba(config.innerColor);

    // Center is very transparent, edge is slightly more visible
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.1})`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.3})`);
    gradient.addColorStop(0.8, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.6})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);

    ctx.fillStyle = gradient;
    ctx.fill(path);
  },

  /**
   * Draw softened, layered border effect
   */
  drawSoftenedBorder(ctx, path, config, opacity, radius, tier) {
    const rgb = this.parseRgba(config.borderColor);

    // Multiple soft layers for a diffused edge effect
    const layers = [
      { width: 4.0, alpha: 0.15 },  // Outermost soft glow
      { width: 2.5, alpha: 0.25 },  // Middle layer
      { width: 1.5, alpha: 0.4 },   // Inner layer
      { width: 0.8, alpha: 0.8 }    // Core bright line
    ];

    // Add subtle outer glow
    ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.5})`;
    ctx.shadowBlur = 8 + tier * 2;

    for (const layer of layers) {
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * layer.alpha})`;
      ctx.lineWidth = layer.width / radius;
      ctx.stroke(path);
    }

    // Reset shadow
    ctx.shadowBlur = 0;
  },

  /**
   * Parse rgba color string to extract RGB values
   */
  parseRgba(colorStr) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    // Default to white if parsing fails
    return { r: 255, g: 255, b: 255 };
  },

  /**
   * Draw impact ripple effects
   */
  drawImpacts(ctx, screenX, screenY, radius, currentTier) {
    const config = this.TIER_CONFIG[currentTier] || this.TIER_CONFIG[1];
    const rgb = this.parseRgba(config.borderColor);

    for (const impact of this.impacts) {
      const progress = impact.age / impact.duration;
      const rippleOpacity = (1 - progress) * 0.8;

      // Impact point on shield circumference
      const impactX = Math.cos(impact.angle) * radius;
      const impactY = Math.sin(impact.angle) * radius;

      ctx.save();
      ctx.translate(screenX + impactX, screenY + impactY);

      // Draw ripple circles
      ctx.beginPath();
      ctx.arc(0, 0, 5 + progress * 15, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rippleOpacity})`;
      ctx.lineWidth = 2 * (1 - progress);
      ctx.stroke();

      // Inner flash
      if (progress < 0.3) {
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = (0.3 - progress) / 0.3 * 0.8;
        ctx.fill();
      }

      ctx.restore();
    }
  },

  /**
   * Draw shield with proper impact tracking (use this for entities)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {number} rotation - Ship rotation
   * @param {number} shieldPercent - Shield percentage
   * @param {number} tier - Shield tier
   * @param {string} entityId - Unique entity identifier
   * @param {number} shipSize - Ship size
   */
  drawShieldForEntity(ctx, worldX, worldY, screenX, screenY, rotation, shieldPercent, tier, entityId, shipSize = 20) {
    if (shieldPercent <= 0) return;

    // Get smoothed shield value for smooth transitions
    const smoothedPercent = this.getSmoothedShield(entityId, shieldPercent, 0.016);

    const config = this.TIER_CONFIG[tier] || this.TIER_CONFIG[1];
    const path = this.cachedPaths[config.shape];
    if (!path) return;

    const radius = this.BASE_RADIUS * config.size * (shipSize / 20);
    const shieldRatio = smoothedPercent / 100;

    // Border opacity - primary indicator
    const borderOpacity = this.MIN_BORDER_OPACITY + (this.MAX_BORDER_OPACITY - this.MIN_BORDER_OPACITY) * shieldRatio;

    // Inner fill - subtle adjustment
    const innerOpacity = this.MIN_INNER_OPACITY + (this.MAX_INNER_OPACITY - this.MIN_INNER_OPACITY) * shieldRatio;

    ctx.save();
    ctx.translate(screenX, screenY);

    if (config.shape !== 'circle') {
      ctx.rotate(rotation);
    }

    ctx.scale(radius, radius);

    // Gradient fill
    this.drawGradientFill(ctx, path, config, innerOpacity, radius);

    // Softened border
    this.drawSoftenedBorder(ctx, path, config, borderOpacity, radius, tier);

    ctx.restore();

    // Draw impacts for this entity
    this.drawEntityImpacts(ctx, worldX, worldY, screenX, screenY, radius, tier);
  },

  /**
   * Draw impacts that belong to a specific entity position
   */
  drawEntityImpacts(ctx, worldX, worldY, screenX, screenY, radius, tier) {
    const config = this.TIER_CONFIG[tier] || this.TIER_CONFIG[1];
    const rgb = this.parseRgba(config.borderColor);

    for (const impact of this.impacts) {
      // Check if impact belongs to this entity (within 50 units)
      const dx = impact.shipX - worldX;
      const dy = impact.shipY - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 50) continue;

      const progress = impact.age / impact.duration;
      const rippleOpacity = (1 - progress) * 0.8;

      // Impact point on shield circumference
      const impactX = Math.cos(impact.angle) * radius;
      const impactY = Math.sin(impact.angle) * radius;

      ctx.save();
      ctx.translate(screenX + impactX, screenY + impactY);

      // Ripple circle
      ctx.beginPath();
      ctx.arc(0, 0, 5 + progress * 20, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rippleOpacity})`;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.stroke();

      // Secondary ripple
      if (progress > 0.1) {
        ctx.beginPath();
        ctx.arc(0, 0, 3 + (progress - 0.1) * 15, 0, Math.PI * 2);
        ctx.lineWidth = 2 * (1 - progress);
        ctx.globalAlpha = rippleOpacity * 0.5;
        ctx.stroke();
      }

      // Inner flash
      if (progress < 0.2) {
        ctx.beginPath();
        ctx.arc(0, 0, 4 * (1 - progress / 0.2), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = (0.2 - progress) / 0.2 * 0.8;
        ctx.fill();
      }

      ctx.restore();
    }
  },

  /**
   * Clear all impact effects
   */
  clearImpacts() {
    this.impacts = [];
  },

  /**
   * Clean up smoothed shields for entities that haven't been updated recently
   */
  cleanupSmoothedShields() {
    const maxAge = 5; // seconds
    for (const [id, entry] of this.smoothedShields) {
      if (this.time - entry.lastUpdate > maxAge) {
        this.smoothedShields.delete(id);
      }
    }
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.ShieldVisual = ShieldVisual;
}
