// Galaxy Miner - Radar Entities Renderer
// Renders players, NPCs, and bases with tier-aware visuals

const RadarEntities = {
  // Draw all entities within radar range
  draw(ctx, center, scale, radarRange, radarTier, playerPos, playerRotation) {
    // Note: Bases are now drawn from world data in RadarObjects
    // Entities.bases is used for server-side health/damage tracking only

    // Draw NPCs
    this.drawNPCs(ctx, center, scale, radarRange, radarTier, playerPos);

    // Draw other players
    this.drawPlayers(ctx, center, scale, radarRange, radarTier, playerPos);

    // Draw local player at center (always on top)
    this.drawLocalPlayer(ctx, center, radarTier, playerRotation);
  },

  // Draw faction bases
  drawBases(ctx, center, scale, radarRange, radarTier, playerPos) {
    // Check if bases are available in Entities
    if (typeof Entities === 'undefined' || !Entities.bases) return;

    const useFactionShapes = RadarBaseRenderer.hasFeature(radarTier, 'faction_base_shapes');
    const useFactionColors = RadarBaseRenderer.hasFeature(radarTier, 'faction_colors');
    const useCircles = RadarBaseRenderer.hasFeature(radarTier, 'bases_circles');

    for (const [id, base] of Entities.bases) {
      const distance = RadarBaseRenderer.getDistance(
        base.position.x, base.position.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        base.position.x, base.position.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Determine visual representation based on tier
      if (useFactionShapes && base.faction) {
        // Tier 3+: Unique faction shapes with faction colors
        const shape = CONSTANTS.FACTION_BASE_SHAPES[base.faction] || 'circle';
        const color = CONSTANTS.FACTION_RADAR_COLORS[base.faction] || '#ff4444';
        const size = CONSTANTS.RADAR_ICON_SIZES.base_shape;
        RadarBaseRenderer.drawShape(ctx, pos.x, pos.y, shape, size, color);
      } else if (useCircles) {
        // Tier 2: Red circles (larger than dots)
        const color = useFactionColors && base.faction
          ? CONSTANTS.FACTION_RADAR_COLORS[base.faction]
          : '#ff4444';
        const size = CONSTANTS.RADAR_ICON_SIZES.base_circle;
        RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, size, color);
      } else {
        // Tier 1: Simple red dots
        const size = CONSTANTS.RADAR_ICON_SIZES.medium_dot;
        RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, size, '#ff4444');
      }
    }
  },

  // Draw NPCs
  drawNPCs(ctx, center, scale, radarRange, radarTier, playerPos) {
    if (typeof Entities === 'undefined' || !Entities.npcs) return;
    if (Entities.npcs.size === 0) return;

    const useTriangles = RadarBaseRenderer.hasFeature(radarTier, 'npcs_triangles');
    const useFactionColors = RadarBaseRenderer.hasFeature(radarTier, 'faction_colors');

    for (const [id, npc] of Entities.npcs) {
      const distance = RadarBaseRenderer.getDistance(
        npc.position.x, npc.position.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        npc.position.x, npc.position.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Determine color based on tier and faction
      let color = '#ff4444'; // Default red
      if (useFactionColors && npc.faction) {
        color = CONSTANTS.FACTION_RADAR_COLORS[npc.faction] || '#ff4444';
      }

      if (useTriangles) {
        // Tier 2+: Triangles showing heading
        const rotation = npc.rotation || 0;
        const size = CONSTANTS.RADAR_ICON_SIZES.triangle_small;
        RadarBaseRenderer.drawTriangle(ctx, pos.x, pos.y, size, rotation, color);
      } else {
        // Tier 1: Simple red dots
        const size = CONSTANTS.RADAR_ICON_SIZES.medium_dot;
        RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, size, color);
      }
    }
  },

  // Draw other players
  drawPlayers(ctx, center, scale, radarRange, radarTier, playerPos) {
    if (typeof Entities === 'undefined' || !Entities.players) return;
    if (Entities.players.size === 0) return;

    const useTriangles = RadarBaseRenderer.hasFeature(radarTier, 'players_triangles');

    for (const [id, player] of Entities.players) {
      const distance = RadarBaseRenderer.getDistance(
        player.position.x, player.position.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        player.position.x, player.position.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      if (useTriangles) {
        // Tier 2+: Green triangles showing heading
        const rotation = player.rotation || 0;
        const size = CONSTANTS.RADAR_ICON_SIZES.triangle_small;
        RadarBaseRenderer.drawTriangle(ctx, pos.x, pos.y, size, rotation, '#00ff00');
      } else {
        // Tier 1: Red dots (can't distinguish from enemies)
        const size = CONSTANTS.RADAR_ICON_SIZES.medium_dot;
        RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, size, '#ff4444');
      }
    }
  },

  // Draw local player at center
  drawLocalPlayer(ctx, center, radarTier, playerRotation) {
    const useTriangles = RadarBaseRenderer.hasFeature(radarTier, 'players_triangles');
    const size = CONSTANTS.RADAR_ICON_SIZES.triangle_medium;

    if (useTriangles) {
      // Tier 2+: Bright green triangle showing heading
      RadarBaseRenderer.drawTriangle(ctx, center, center, size + 1, playerRotation, '#00ff00');
    } else {
      // Tier 1: Green dot
      RadarBaseRenderer.drawDot(ctx, center, center, CONSTANTS.RADAR_ICON_SIZES.medium_dot + 1, '#00ff00');
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarEntities = RadarEntities;
}
