// Galaxy Miner - Radar Advanced Features
// Tier 5: Sector map, predictive paths, threat zones

const RadarAdvanced = {
  // Caching for performance
  lastThreatUpdate: 0,
  cachedThreatZones: [],
  THREAT_UPDATE_INTERVAL: 500,

  // Sector map state
  sectorMapMode: false,

  init() {
    // Listen for sector map toggle (Tab key)
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Only work when game has started
      if (typeof GalaxyMiner !== 'undefined' && !GalaxyMiner.gameStarted) return;

      // Only work at Tier 5
      if (typeof Player === 'undefined' || (Player.ship.radarTier || 1) < 5) return;

      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent browser tab switching
        this.toggleSectorMap();
      }
    });
  },

  toggleSectorMap() {
    this.sectorMapMode = !this.sectorMapMode;
    Logger.log('Sector map mode:', this.sectorMapMode ? 'ON' : 'OFF');
  },

  // Main draw function for all Tier 5 features
  draw(ctx, center, scale, radarRange, radarTier, playerPos) {
    // Only render at Tier 5
    if (radarTier < 5) return;

    const now = Date.now();

    // Draw threat zones first (background layer)
    if (RadarBaseRenderer.hasFeature(radarTier, 'threat_zones')) {
      this.drawThreatZones(ctx, center, scale, radarRange, playerPos, now);
    }

    // Draw predictive paths
    if (RadarBaseRenderer.hasFeature(radarTier, 'predictive_paths')) {
      this.drawPredictivePaths(ctx, center, scale, radarRange, playerPos);
    }

    // Sector map is drawn separately by the main radar when toggled
  },

  // Draw threat assessment zones
  drawThreatZones(ctx, center, scale, radarRange, playerPos, now) {
    // Update threat zones periodically
    if (now - this.lastThreatUpdate > this.THREAT_UPDATE_INTERVAL) {
      this.updateThreatZones(playerPos, radarRange);
      this.lastThreatUpdate = now;
    }

    // Draw cached threat zones as gradient overlays
    for (const zone of this.cachedThreatZones) {
      const pos = RadarBaseRenderer.worldToRadar(
        zone.x, zone.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Draw gradient circle
      const gradient = ctx.createRadialGradient(
        pos.x, pos.y, 0,
        pos.x, pos.y, zone.radius * scale
      );
      gradient.addColorStop(0, zone.color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, zone.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  updateThreatZones(playerPos, radarRange) {
    this.cachedThreatZones = [];

    if (typeof Entities === 'undefined') return;

    // Analyze NPCs to create threat zones
    const npcGroups = new Map(); // Grid-based grouping

    for (const [id, npc] of Entities.npcs) {
      const distance = RadarBaseRenderer.getDistance(
        npc.position.x, npc.position.y,
        playerPos.x, playerPos.y
      );
      if (distance > radarRange) continue;

      // Group NPCs by grid cell (100 unit cells)
      const cellX = Math.floor(npc.position.x / 100);
      const cellY = Math.floor(npc.position.y / 100);
      const cellKey = `${cellX}_${cellY}`;

      if (!npcGroups.has(cellKey)) {
        npcGroups.set(cellKey, {
          x: cellX * 100 + 50,
          y: cellY * 100 + 50,
          count: 0,
          totalTier: 0
        });
      }

      const group = npcGroups.get(cellKey);
      group.count++;
      group.totalTier += (npc.tier || 1);
    }

    // Check for bases
    for (const [id, base] of Entities.bases) {
      const distance = RadarBaseRenderer.getDistance(
        base.position.x, base.position.y,
        playerPos.x, playerPos.y
      );
      if (distance > radarRange) continue;

      // Bases create large threat zones
      const threat = 200; // High base threat
      const color = this.getThreatColor(threat);
      this.cachedThreatZones.push({
        x: base.position.x,
        y: base.position.y,
        radius: 150,
        threat: threat,
        color: color
      });
    }

    // Convert NPC groups to threat zones
    for (const [key, group] of npcGroups) {
      // Calculate threat: count * average tier * proximity factor
      const threat = group.count * (group.totalTier / group.count) * 10;
      const color = this.getThreatColor(threat);
      const radius = 50 + group.count * 20;

      this.cachedThreatZones.push({
        x: group.x,
        y: group.y,
        radius: radius,
        threat: threat,
        color: color
      });
    }
  },

  getThreatColor(threat) {
    if (threat <= 0) {
      return CONSTANTS.RADAR_THREAT_ZONES.safe.color;
    } else if (threat <= 50) {
      return CONSTANTS.RADAR_THREAT_ZONES.caution.color;
    } else if (threat <= 150) {
      return CONSTANTS.RADAR_THREAT_ZONES.dangerous.color;
    } else {
      return CONSTANTS.RADAR_THREAT_ZONES.extreme.color;
    }
  },

  // Draw predictive movement paths
  drawPredictivePaths(ctx, center, scale, radarRange, playerPos) {
    if (typeof Entities === 'undefined') return;

    // Collect all entities with positions
    const entities = [];

    // Add NPCs
    for (const [id, npc] of Entities.npcs) {
      const distance = RadarBaseRenderer.getDistance(
        npc.position.x, npc.position.y,
        playerPos.x, playerPos.y
      );
      if (distance <= radarRange * 0.5) { // Only show for nearby entities
        entities.push({
          position: npc.position,
          targetPosition: npc.targetPosition,
          color: CONSTANTS.FACTION_RADAR_COLORS[npc.faction] || '#ff4444',
          distance: distance
        });
      }
    }

    // Add players
    for (const [id, player] of Entities.players) {
      const distance = RadarBaseRenderer.getDistance(
        player.position.x, player.position.y,
        playerPos.x, playerPos.y
      );
      if (distance <= radarRange * 0.5) {
        entities.push({
          position: player.position,
          targetPosition: player.targetPosition,
          color: '#00ff00',
          distance: distance
        });
      }
    }

    // Sort by distance and limit to 10 nearest
    entities.sort((a, b) => a.distance - b.distance);
    const nearest = entities.slice(0, 10);

    // Draw predicted paths
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;

    for (const entity of nearest) {
      if (!entity.targetPosition) continue;

      const currentPos = RadarBaseRenderer.worldToRadar(
        entity.position.x, entity.position.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Calculate velocity from position delta
      const vx = entity.targetPosition.x - entity.position.x;
      const vy = entity.targetPosition.y - entity.position.y;

      // Project 3-5 seconds into the future
      const projectionTime = 3; // seconds
      const futureX = entity.position.x + vx * projectionTime * 10;
      const futureY = entity.position.y + vy * projectionTime * 10;

      const futurePos = RadarBaseRenderer.worldToRadar(
        futureX, futureY,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Draw dotted line from current to predicted position
      ctx.strokeStyle = entity.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(currentPos.x, currentPos.y);
      ctx.lineTo(futurePos.x, futurePos.y);
      ctx.stroke();

      // Draw small circle at predicted position
      ctx.fillStyle = entity.color;
      ctx.beginPath();
      ctx.arc(futurePos.x, futurePos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  },

  // Draw full sector map (called when in sector map mode)
  drawSectorMap(ctx, size, playerPos) {
    if (!this.sectorMapMode) return false;

    const sectorSize = CONSTANTS.SECTOR_SIZE;
    const currentSectorX = Math.floor(playerPos.x / sectorSize);
    const currentSectorY = Math.floor(playerPos.y / sectorSize);

    // Map covers full sector (1000x1000 units)
    const mapScale = size / sectorSize;
    const center = size / 2;

    // Clear with darker background
    ctx.fillStyle = 'rgba(0, 0, 20, 0.95)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Draw sector grid lines
    ctx.strokeStyle = '#222244';
    ctx.lineWidth = 1;
    const sectorStartX = currentSectorX * sectorSize;
    const sectorStartY = currentSectorY * sectorSize;

    // Draw grid
    for (let i = 0; i <= 10; i++) {
      const x = (sectorStartX + i * 100 - playerPos.x) * mapScale + center;
      const y = (sectorStartY + i * 100 - playerPos.y) * mapScale + center;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Draw sector label
    ctx.fillStyle = '#00aaff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Sector (${currentSectorX}, ${currentSectorY})`, center, 12);

    // Draw player position
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(center, center, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw all entities as small dots
    if (typeof Entities !== 'undefined') {
      // NPCs
      for (const [id, npc] of Entities.npcs) {
        const dx = npc.position.x - playerPos.x;
        const dy = npc.position.y - playerPos.y;
        const rx = center + dx * mapScale;
        const ry = center + dy * mapScale;

        // Only draw if within the circular map
        const distFromCenter = Math.sqrt((rx - center) ** 2 + (ry - center) ** 2);
        if (distFromCenter > center) continue;

        ctx.fillStyle = CONSTANTS.FACTION_RADAR_COLORS[npc.faction] || '#ff4444';
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bases
      for (const [id, base] of Entities.bases) {
        const dx = base.position.x - playerPos.x;
        const dy = base.position.y - playerPos.y;
        const rx = center + dx * mapScale;
        const ry = center + dy * mapScale;

        const distFromCenter = Math.sqrt((rx - center) ** 2 + (ry - center) ** 2);
        if (distFromCenter > center) continue;

        ctx.fillStyle = CONSTANTS.FACTION_RADAR_COLORS[base.faction] || '#ff4444';
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return true; // Indicates sector map was drawn
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarAdvanced = RadarAdvanced;
}
