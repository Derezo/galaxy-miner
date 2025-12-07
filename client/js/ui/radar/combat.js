// Galaxy Miner - Radar Combat Renderer
// Renders weapon fire trails on radar (Tier 4+)

const RadarCombat = {
  // Draw weapon fire trails
  draw(ctx, center, scale, radarRange, radarTier, playerPos) {
    // Only render at Tier 4+
    if (!RadarBaseRenderer.hasFeature(radarTier, 'weapon_fire')) return;

    if (typeof Entities === 'undefined' || !Entities.projectileTrails) return;
    if (Entities.projectileTrails.length === 0) return;

    const now = Date.now();

    for (const trail of Entities.projectileTrails) {
      // Check if trail start is in radar range
      const distance = RadarBaseRenderer.getDistance(
        trail.startX, trail.startY,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      // Calculate age and opacity (fade out over 500ms)
      const age = now - trail.timestamp;
      const maxAge = 500;
      if (age > maxAge) continue;

      const opacity = 1 - (age / maxAge);

      // Convert to radar coordinates
      const startPos = RadarBaseRenderer.worldToRadar(
        trail.startX, trail.startY,
        playerPos.x, playerPos.y,
        center, scale
      );

      const endPos = RadarBaseRenderer.worldToRadar(
        trail.endX, trail.endY,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Determine color based on trail type
      let color;
      if (trail.type === 'player') {
        color = '#00ff00'; // Green for player fire
      } else if (trail.type === 'npc' && trail.faction) {
        color = CONSTANTS.FACTION_RADAR_COLORS[trail.faction] || '#ff4444';
      } else {
        color = '#ff4444'; // Default red for enemy fire
      }

      // Draw flash at source (brighter, larger based on tier)
      const flashSize = 2 + (trail.tier || 1);
      RadarBaseRenderer.drawFlash(ctx, startPos.x, startPos.y, flashSize, color, opacity);

      // Draw trajectory line (width based on tier)
      const lineWidth = 1 + ((trail.tier || 1) * 0.3);
      RadarBaseRenderer.drawTrail(
        ctx,
        startPos.x, startPos.y,
        endPos.x, endPos.y,
        color,
        opacity * 0.7,
        lineWidth
      );
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarCombat = RadarCombat;
}
