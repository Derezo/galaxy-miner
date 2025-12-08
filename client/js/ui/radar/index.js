// Galaxy Miner - Main Radar Module
// Coordinates all radar sub-renderers

const Radar = {
  canvas: null,
  ctx: null,
  size: 150,
  center: 75,
  radarRadius: 63,  // Radar circle radius (smaller than center to leave margin for indicators)
  initialized: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.center = this.size / 2;
    this.radarRadius = this.center - 12;  // 12px margin for external indicators

    // Initialize tooltips system
    if (typeof RadarTooltips !== 'undefined') {
      RadarTooltips.init(canvas);
    }

    // Initialize advanced features
    if (typeof RadarAdvanced !== 'undefined') {
      RadarAdvanced.init();
    }

    this.initialized = true;
    Logger.log('Radar system initialized');
  },

  // Main draw function called by HUD
  draw(ctx, radarRange, radarTier) {
    if (!ctx) return;

    const size = this.size;
    const center = this.center;
    const playerPos = Player.position;
    const playerRotation = Player.rotation;

    // Calculate scale (pixels per world unit)
    const scale = center / radarRange;

    // Check for sector map mode (Tier 5)
    if (radarTier >= 5 && typeof RadarAdvanced !== 'undefined' && RadarAdvanced.sectorMapMode) {
      if (RadarAdvanced.drawSectorMap(ctx, size, playerPos)) {
        return; // Sector map replaces normal radar
      }
    }

    // Clear radar with background
    ctx.fillStyle = 'rgba(0, 0, 34, 0.8)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Draw range circles
    this.drawRangeCircles(ctx, center);

    // Draw crosshairs
    this.drawCrosshairs(ctx, center, size);

    // Update tooltip params for hover detection
    if (typeof RadarTooltips !== 'undefined' && RadarBaseRenderer.hasFeature(radarTier, 'hover_tooltips')) {
      RadarTooltips.updateParams(center, scale, radarRange, playerPos);
    }

    // Get world objects
    const objects = typeof World !== 'undefined'
      ? World.getVisibleObjects(playerPos, radarRange)
      : null;

    // Draw layers in order (back to front):

    // 1. Advanced features (threat zones - Tier 5) - background
    if (typeof RadarAdvanced !== 'undefined') {
      RadarAdvanced.draw(ctx, center, scale, radarRange, radarTier, playerPos);
    }

    // 2. World objects (stars, planets, asteroids, wormholes)
    if (typeof RadarObjects !== 'undefined') {
      RadarObjects.draw(ctx, center, scale, radarRange, radarTier, playerPos, objects);
    }

    // 3. Loot/wreckage (Tier 4+)
    if (typeof RadarLoot !== 'undefined') {
      RadarLoot.draw(ctx, center, scale, radarRange, radarTier, playerPos);
    }

    // 4. Combat trails (Tier 4+)
    if (typeof RadarCombat !== 'undefined') {
      RadarCombat.draw(ctx, center, scale, radarRange, radarTier, playerPos);
    }

    // 5. Entities (bases, NPCs, players) - foreground
    if (typeof RadarEntities !== 'undefined') {
      RadarEntities.draw(ctx, center, scale, radarRange, radarTier, playerPos, playerRotation);
    }

    // Draw radar border
    this.drawBorder(ctx, center, radarTier);
  },

  drawRangeCircles(ctx, center) {
    ctx.strokeStyle = '#333366';
    ctx.lineWidth = 1;

    for (let r = 0.25; r <= 1; r += 0.25) {
      ctx.beginPath();
      ctx.arc(center, center, center * r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawCrosshairs(ctx, center, size) {
    ctx.strokeStyle = '#333366';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();
  },

  drawBorder(ctx, center, radarTier) {
    // Border color based on tier
    const tierColors = {
      1: '#333366',
      2: '#446688',
      3: '#5588aa',
      4: '#66aacc',
      5: '#88ccff'
    };

    ctx.strokeStyle = tierColors[radarTier] || '#333366';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, center - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Tier 5: Add glow effect
    if (radarTier >= 5) {
      ctx.strokeStyle = '#88ccff40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(center, center, center - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // Get current radar tier from player
  getRadarTier() {
    if (typeof Player !== 'undefined' && Player.ship) {
      return Player.ship.radarTier || 1;
    }
    return 1;
  },

  // Get current radar range
  getRadarRange() {
    if (typeof Player !== 'undefined' && typeof Player.getRadarRange === 'function') {
      return Player.getRadarRange();
    }
    return CONSTANTS.BASE_RADAR_RANGE;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.Radar = Radar;
}
