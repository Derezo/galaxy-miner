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

      // SWARM QUEEN - Always prominent with special rendering
      if (npc.type === 'swarm_queen' || npc.isQueen) {
        this.drawSwarmQueen(ctx, pos.x, pos.y, npc.rotation || 0);
        continue;
      }

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

  // Draw Swarm Queen with spider silhouette - prominent dark crimson visuals
  drawSwarmQueen(ctx, x, y, rotation) {
    const size = 12; // Larger than normal NPCs for boss visibility
    const darkCrimson = '#8B0000';
    const crimsonGlow = '#DC143C';
    const time = Date.now();

    // Outer pulsing glow ring
    const pulse = Math.sin(time / 300) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(x, y, size + 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(139, 0, 0, ${pulse * 0.35})`;
    ctx.fill();

    // Second pulsing ring (slightly offset timing)
    const pulse2 = Math.sin(time / 250 + 1) * 0.25 + 0.75;
    ctx.beginPath();
    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 20, 60, ${pulse2 * 0.4})`;
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Draw spider body - cephalothorax (front) and abdomen (rear)
    // Abdomen (larger, rear)
    ctx.beginPath();
    ctx.ellipse(-2, 0, size * 0.5, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = darkCrimson;
    ctx.fill();
    ctx.strokeStyle = crimsonGlow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cephalothorax (smaller, front)
    ctx.beginPath();
    ctx.ellipse(size * 0.4, 0, size * 0.35, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = darkCrimson;
    ctx.fill();
    ctx.strokeStyle = crimsonGlow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw 8 spider legs radiating outward
    ctx.strokeStyle = darkCrimson;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Leg angles: 4 on each side, spreading from body
    const legAngles = [
      { base: -0.3, tip: -0.6, length: size * 0.9 },   // Front-left 1
      { base: -0.15, tip: -0.35, length: size * 1.0 }, // Front-left 2
      { base: 0.15, tip: 0.35, length: size * 1.0 },   // Front-right 1
      { base: 0.3, tip: 0.6, length: size * 0.9 },     // Front-right 2
      { base: Math.PI - 0.3, tip: Math.PI - 0.5, length: size * 0.85 },  // Rear-left 1
      { base: Math.PI - 0.15, tip: Math.PI - 0.3, length: size * 0.9 },  // Rear-left 2
      { base: Math.PI + 0.15, tip: Math.PI + 0.3, length: size * 0.9 },  // Rear-right 1
      { base: Math.PI + 0.3, tip: Math.PI + 0.5, length: size * 0.85 }   // Rear-right 2
    ];

    for (let i = 0; i < legAngles.length; i++) {
      const leg = legAngles[i];
      // Slight leg animation based on time
      const legPulse = Math.sin(time * 0.004 + i * 0.8) * 0.05;

      const startX = Math.cos(leg.base) * size * 0.25;
      const startY = Math.sin(leg.base) * size * 0.25;
      const endX = Math.cos(leg.tip + legPulse) * leg.length;
      const endY = Math.sin(leg.tip + legPulse) * leg.length;

      // Draw leg with a slight bend (2 segments)
      const midX = (startX + endX) * 0.5 + Math.cos(leg.base + Math.PI/2) * size * 0.15;
      const midY = (startY + endY) * 0.5 + Math.sin(leg.base + Math.PI/2) * size * 0.15;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(midX, midY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // Draw 2 glowing red eyes on cephalothorax
    const eyeGlow = 0.6 + Math.sin(time * 0.005) * 0.4;
    const eyeX = size * 0.55;
    const eyeSpacing = size * 0.12;

    // Left eye
    ctx.beginPath();
    ctx.arc(eyeX, -eyeSpacing, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 50, 50, ${eyeGlow})`;
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.arc(eyeX, eyeSpacing, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 50, 50, ${eyeGlow})`;
    ctx.fill();

    // Bright eye cores
    ctx.beginPath();
    ctx.arc(eyeX, -eyeSpacing, 1, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeSpacing, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
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
