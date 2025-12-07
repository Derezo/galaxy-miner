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

  // Check if distance is within range
  isInRange(distance, range) {
    return distance <= range;
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

  // Draw wormhole swirl icon
  drawWormhole(ctx, x, y, size, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.translate(x, y);

    // Spiral pattern
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const startAngle = i * Math.PI;
      for (let t = 0; t <= Math.PI; t += 0.2) {
        const r = size * (1 - t / Math.PI) * 0.8 + size * 0.2;
        const angle = startAngle + t * 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

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
