// Galaxy Miner - Radar Loot Renderer
// Renders wreckage with rarity colors on radar (Tier 4+)

const RadarLoot = {
  // Draw wreckage/loot markers
  draw(ctx, center, scale, radarRange, radarTier, playerPos) {
    // Only render at Tier 4+
    if (!RadarBaseRenderer.hasFeature(radarTier, 'wreckage_rarity')) return;

    if (typeof Entities === 'undefined' || !Entities.wreckage) return;
    if (Entities.wreckage.size === 0) return;

    const iconSize = CONSTANTS.RADAR_ICON_SIZES.wreckage;

    for (const [id, wreckage] of Entities.wreckage) {
      const distance = RadarBaseRenderer.getDistance(
        wreckage.position.x, wreckage.position.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        wreckage.position.x, wreckage.position.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Determine rarity color based on content count or faction
      const color = this.getRarityColor(wreckage);

      // Draw as diamond shape
      RadarBaseRenderer.drawDiamond(ctx, pos.x, pos.y, iconSize, color);
    }
  },

  // Determine rarity color based on wreckage properties
  getRarityColor(wreckage) {
    // Higher content count = higher rarity
    const contentCount = wreckage.contentCount || 0;

    if (contentCount >= 5) {
      return CONSTANTS.RADAR_RARITY_COLORS.ultrarare;
    } else if (contentCount >= 3) {
      return CONSTANTS.RADAR_RARITY_COLORS.rare;
    } else if (contentCount >= 2) {
      return CONSTANTS.RADAR_RARITY_COLORS.uncommon;
    } else {
      return CONSTANTS.RADAR_RARITY_COLORS.common;
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarLoot = RadarLoot;
}
