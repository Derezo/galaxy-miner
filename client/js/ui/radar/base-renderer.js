// Galaxy Miner - Radar Base Renderer
// Utility functions for radar rendering

const RadarBaseRenderer = {
  // Convert world coordinates to radar canvas coordinates
  worldToRadar(worldX, worldY, playerX, playerY, center, scale) {
    const dx = worldX - playerX;
    const dy = worldY - playerY;
    return {
      x: center + dx * scale,
      y: center + dy * scale
    };
  },

  // Calculate distance between two positions
  getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Hysteresis buffer (10% extra range for exit threshold)
  HYSTERESIS_FACTOR: 1.1,
  // Fade zone starts at 90% of range
  FADE_ZONE_START: 0.9,

  // Check if distance is within range (with hysteresis for smooth transitions)
  // Use exitCheck=true when checking if already-visible entities should disappear
  isInRange(distance, range, exitCheck = false) {
    const threshold = exitCheck ? range * this.HYSTERESIS_FACTOR : range;
    return distance <= threshold;
  },

  // Calculate opacity for fade zone (items near edge fade out)
  // Returns 1.0 for items well inside range, 0.0-1.0 for items in fade zone
  getEdgeOpacity(distance, range) {
    const fadeStart = range * this.FADE_ZONE_START;
    if (distance <= fadeStart) return 1.0;
    if (distance > range) return 0.0;
    // Linear fade from fadeStart to range
    return 1.0 - (distance - fadeStart) / (range - fadeStart);
  },

  // Draw a filled dot
  drawDot(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  },

  // Draw a triangle (for ships) pointing in a direction
  drawTriangle(ctx, x, y, size, rotation, color) {
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(size, 0);           // nose
    ctx.lineTo(-size * 0.6, -size * 0.5);  // left tail
    ctx.lineTo(-size * 0.6, size * 0.5);   // right tail
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Draw faction-specific base shapes
  drawShape(ctx, x, y, shape, size, color) {
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);

    switch (shape) {
      case 'skull':
        this._drawSkull(ctx, size, color);
        break;
      case 'gear':
        this._drawGear(ctx, size, color);
        break;
      case 'hexagon':
        this._drawHexagon(ctx, size, color);
        break;
      case 'star4':
        this._drawStar4(ctx, size, color);
        break;
      case 'pickaxe':
        this._drawPickaxe(ctx, size, color);
        break;
      default:
        // Fallback to circle
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  },

  // Draw skull shape (Pirates)
  _drawSkull(ctx, size, color) {
    ctx.fillStyle = color;
    // Main skull circle
    ctx.beginPath();
    ctx.arc(0, -size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Jaw
    ctx.beginPath();
    ctx.moveTo(-size * 0.4, size * 0.2);
    ctx.lineTo(size * 0.4, size * 0.2);
    ctx.lineTo(size * 0.3, size * 0.6);
    ctx.lineTo(-size * 0.3, size * 0.6);
    ctx.closePath();
    ctx.fill();
    // Eye sockets (dark)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.25, size * 0.15, 0, Math.PI * 2);
    ctx.arc(size * 0.25, -size * 0.25, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  },

  // Draw gear shape (Scavengers)
  _drawGear(ctx, size, color) {
    ctx.fillStyle = color;
    const teeth = 6;
    const innerRadius = size * 0.5;
    const outerRadius = size;

    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const angle1 = (i / teeth) * Math.PI * 2;
      const angle2 = ((i + 0.3) / teeth) * Math.PI * 2;
      const angle3 = ((i + 0.5) / teeth) * Math.PI * 2;
      const angle4 = ((i + 0.8) / teeth) * Math.PI * 2;

      if (i === 0) {
        ctx.moveTo(Math.cos(angle1) * outerRadius, Math.sin(angle1) * outerRadius);
      }
      ctx.lineTo(Math.cos(angle2) * outerRadius, Math.sin(angle2) * outerRadius);
      ctx.lineTo(Math.cos(angle3) * innerRadius, Math.sin(angle3) * innerRadius);
      ctx.lineTo(Math.cos(angle4) * innerRadius, Math.sin(angle4) * innerRadius);
      ctx.lineTo(Math.cos(((i + 1) / teeth) * Math.PI * 2) * outerRadius,
                 Math.sin(((i + 1) / teeth) * Math.PI * 2) * outerRadius);
    }
    ctx.closePath();
    ctx.fill();

    // Center hole
    ctx.fillStyle = '#000022';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  },

  // Draw hexagon shape (Swarm)
  _drawHexagon(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  },

  // Draw 4-point star shape (Void Entities)
  _drawStar4(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? size : size * 0.4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  },

  // Draw pickaxe shape (Rogue Miners)
  _drawPickaxe(ctx, size, color) {
    ctx.fillStyle = color;
    // Handle
    ctx.fillRect(-size * 0.1, -size * 0.3, size * 0.2, size * 1.2);
    // Head
    ctx.beginPath();
    ctx.moveTo(-size * 0.8, -size * 0.5);
    ctx.lineTo(-size * 0.3, -size * 0.3);
    ctx.lineTo(-size * 0.3, -size * 0.1);
    ctx.lineTo(-size * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.8, -size * 0.5);
    ctx.lineTo(size * 0.3, -size * 0.3);
    ctx.lineTo(size * 0.3, -size * 0.1);
    ctx.lineTo(size * 0.6, 0);
    ctx.closePath();
    ctx.fill();
  },

  // Draw diamond shape (for wreckage/loot)
  drawDiamond(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.6, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Draw animated wormhole vortex icon (mini version - matches main renderer style)
  drawWormhole(ctx, x, y, size, color) {
    const time = Date.now() / 1000;
    ctx.save();
    ctx.translate(x, y);

    // Background - dark outer, transparent edge (no border)
    const voidGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    voidGradient.addColorStop(0, 'rgba(200, 230, 255, 0.2)');  // Bright center
    voidGradient.addColorStop(0.3, 'rgba(50, 100, 150, 0.15)');
    voidGradient.addColorStop(0.7, 'rgba(10, 20, 40, 0.2)');
    voidGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = voidGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Rotating spiral arms (4 arms) - fast spin with mixed colors
    const armColors = ['#00ffff', '#ff8844', '#88ddff', '#ffaa44'];
    for (let arm = 0; arm < 4; arm++) {
      const rotationSpeed = 3.5 + (arm % 2) * 0.8;
      const baseRotation = time * rotationSpeed + (arm / 4) * Math.PI * 2;
      ctx.save();
      ctx.rotate(baseRotation);

      ctx.beginPath();
      for (let i = 0; i <= 25; i++) {
        const t = i / 25;
        const angle = t * Math.PI * 2;  // Full spiral turn
        const radius = size * 0.85 - size * 0.75 * Math.pow(t, 0.8);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.strokeStyle = armColors[arm];
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6 + Math.sin(time * 6 + arm) * 0.3;
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // Pulsing ring - faster
    const ringPhase = (time * 2.5) % 1;
    const ringRadius = size * (0.2 + ringPhase * 0.6);
    const ringAlpha = 0.4 * (1 - ringPhase);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Bright center core
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.3);
    coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coreGlow.addColorStop(0.4, 'rgba(180, 220, 255, 0.5)');
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Inner pulsing core
    const corePulse = 0.7 + Math.sin(time * 8) * 0.3;
    ctx.fillStyle = `rgba(255, 255, 255, ${corePulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // Draw directional indicator as a colored arc on radar border
  // Subtly highlights the direction to the target
  drawDirectionIndicator(ctx, center, angle, color) {
    const arcWidth = Math.PI / 3;  // 60 degree arc
    const startAngle = angle - arcWidth / 2;
    const endAngle = angle + arcWidth / 2;

    // Pulsing glow effect
    const time = Date.now() / 1000;
    const pulse = 0.5 + Math.sin(time * 2) * 0.3;

    ctx.save();

    // Draw glowing arc on the radar border
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * pulse;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = pulse;

    ctx.beginPath();
    ctx.arc(center, center, center - 2, startAngle, endAngle);
    ctx.stroke();

    // Draw a brighter inner line for emphasis
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.globalAlpha = pulse + 0.2;

    ctx.beginPath();
    ctx.arc(center, center, center - 2, startAngle, endAngle);
    ctx.stroke();

    ctx.restore();
  },

  // Draw a fading line (for weapon trails)
  drawTrail(ctx, x1, y1, x2, y2, color, opacity, width) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  // Draw a flash/pulse effect
  drawFlash(ctx, x, y, size, color, opacity) {
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  // Check if a tier has a specific feature
  hasFeature(tier, feature) {
    // Accumulate features from tier 1 up to current tier
    for (let t = 1; t <= tier; t++) {
      const tierConfig = CONSTANTS.RADAR_TIERS[t];
      if (tierConfig && tierConfig.features.includes(feature)) {
        return true;
      }
    }
    return false;
  },

  // Get radar range for a tier
  getRadarRange(tier) {
    const tierConfig = CONSTANTS.RADAR_TIERS[tier];
    return tierConfig ? tierConfig.range : CONSTANTS.BASE_RADAR_RANGE;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarBaseRenderer = RadarBaseRenderer;
}
