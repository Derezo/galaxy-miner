// Galaxy Miner - Radar Objects Renderer
// Renders stars, planets, asteroids, and wormholes on radar

const RadarObjects = {
  // Cached nearest wormhole from server (set by network.js)
  cachedNearestWormhole: null,
  lastWormholeUpdate: 0,
  WORMHOLE_UPDATE_INTERVAL: 5000,  // Request update every 5 seconds

  // Draw all world objects within radar range
  draw(ctx, center, scale, radarRange, radarTier, playerPos, objects) {
    if (!objects) return;

    // Stars - always visible (Tier 1+)
    if (objects.stars && objects.stars.length > 0) {
      this.drawStars(ctx, center, scale, radarRange, playerPos, objects.stars);
    }

    // Asteroids - always visible (Tier 1+)
    if (objects.asteroids && objects.asteroids.length > 0) {
      this.drawAsteroids(ctx, center, scale, radarRange, playerPos, objects.asteroids);
    }

    // Planets - always visible (Tier 1+)
    if (objects.planets && objects.planets.length > 0) {
      this.drawPlanets(ctx, center, scale, radarRange, playerPos, objects.planets);
    }

    // Bases - always visible (Tier 1+), from world generation
    if (objects.bases && objects.bases.length > 0) {
      this.drawBases(ctx, center, scale, radarRange, radarTier, playerPos, objects.bases);
    }

    // Wormholes - Tier 3+ only (or if player has wormhole gem for direction indicator)
    let wormholeOnRadar = false;
    if (RadarBaseRenderer.hasFeature(radarTier, 'wormholes') &&
        objects.wormholes && objects.wormholes.length > 0) {
      wormholeOnRadar = this.drawWormholes(ctx, center, scale, radarRange, playerPos, objects.wormholes);
    }

    // Wormhole directional indicator - show if player has wormhole gem and no wormhole on radar
    if (typeof Player !== 'undefined' && Player.hasRelic && Player.hasRelic('WORMHOLE_GEM')) {
      if (!wormholeOnRadar) {
        // Request server update if needed
        this.maybeRequestWormholeUpdate();
        // Use server-provided nearest wormhole position
        this.drawWormholeIndicatorFromCache(ctx, center, playerPos);
      }
    }
  },

  // Request wormhole position update from server if cache is stale
  maybeRequestWormholeUpdate() {
    const now = Date.now();
    if (now - this.lastWormholeUpdate > this.WORMHOLE_UPDATE_INTERVAL) {
      if (typeof Network !== 'undefined' && Network.requestNearestWormholePosition) {
        Logger.log('[Radar] Requesting nearest wormhole position from server');
        Network.requestNearestWormholePosition();
        this.lastWormholeUpdate = now;
      } else {
        Logger.log('[Radar] Network.requestNearestWormholePosition not available');
      }
    }
  },

  // Draw wormhole indicator using server-cached position
  drawWormholeIndicatorFromCache(ctx, center, playerPos) {
    if (!this.cachedNearestWormhole) {
      // Only log once per second to avoid spam
      if (!this._lastCacheLog || Date.now() - this._lastCacheLog > 1000) {
        Logger.log('[Radar] No cached wormhole position yet');
        this._lastCacheLog = Date.now();
      }
      return;
    }

    // Calculate angle from player to wormhole
    const dx = this.cachedNearestWormhole.x - playerPos.x;
    const dy = this.cachedNearestWormhole.y - playerPos.y;
    const angle = Math.atan2(dy, dx);

    // Draw the directional indicator on the radar edge
    RadarBaseRenderer.drawDirectionIndicator(ctx, center, angle, CONSTANTS.COLORS.WORMHOLE);
  },

  // Draw stars as yellow/orange dots
  drawStars(ctx, center, scale, radarRange, playerPos, stars) {
    const iconSize = CONSTANTS.RADAR_ICON_SIZES.star;

    for (const star of stars) {
      const distance = RadarBaseRenderer.getDistance(
        star.x, star.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        star.x, star.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Size based on star size (larger stars = bigger radar blip)
      const sizeMultiplier = star.size ? Math.min(star.size / 400, 2) : 1;
      const displaySize = iconSize * sizeMultiplier;

      // Color based on star color or default yellow
      const color = star.color || CONSTANTS.COLORS.STAR;

      RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, displaySize, color);
    }
  },

  // Draw planets as blue dots
  drawPlanets(ctx, center, scale, radarRange, playerPos, planets) {
    const iconSize = CONSTANTS.RADAR_ICON_SIZES.small_dot;

    for (const planet of planets) {
      const distance = RadarBaseRenderer.getDistance(
        planet.x, planet.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        planet.x, planet.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      // Size based on planet size
      const sizeMultiplier = planet.size ? Math.min(planet.size / 40, 1.5) : 1;
      const displaySize = iconSize * sizeMultiplier;

      RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, displaySize, CONSTANTS.COLORS.PLANET);
    }
  },

  // Draw asteroids as gray dots
  drawAsteroids(ctx, center, scale, radarRange, playerPos, asteroids) {
    const iconSize = CONSTANTS.RADAR_ICON_SIZES.dot;

    for (const asteroid of asteroids) {
      const distance = RadarBaseRenderer.getDistance(
        asteroid.x, asteroid.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      const pos = RadarBaseRenderer.worldToRadar(
        asteroid.x, asteroid.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, iconSize, CONSTANTS.COLORS.ASTEROID);
    }
  },

  // Draw wormholes as animated swirl icons (Tier 3+)
  // Returns true if any wormhole was drawn on the radar
  drawWormholes(ctx, center, scale, radarRange, playerPos, wormholes) {
    const iconSize = 12; // Larger size for animated mini vortex

    let anyVisible = false;

    for (const wormhole of wormholes) {
      const distance = RadarBaseRenderer.getDistance(
        wormhole.x, wormhole.y,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      anyVisible = true;

      const pos = RadarBaseRenderer.worldToRadar(
        wormhole.x, wormhole.y,
        playerPos.x, playerPos.y,
        center, scale
      );

      RadarBaseRenderer.drawWormhole(ctx, pos.x, pos.y, iconSize, CONSTANTS.COLORS.WORMHOLE);
    }

    return anyVisible;
  },

  // Draw bases from world generation data (tier-aware visuals)
  // Uses server-authoritative positions when available
  drawBases(ctx, center, scale, radarRange, radarTier, playerPos, bases) {
    const useFactionShapes = RadarBaseRenderer.hasFeature(radarTier, 'faction_base_shapes');
    const useFactionColors = RadarBaseRenderer.hasFeature(radarTier, 'faction_colors');
    const useCircles = RadarBaseRenderer.hasFeature(radarTier, 'bases_circles');

    // Track which bases we've rendered (to add server-only bases later)
    const renderedIds = new Set();

    for (const base of bases) {
      // Check if base is destroyed (from Entities.baseStates)
      if (typeof Entities !== 'undefined' && Entities.isBaseDestroyed && Entities.isBaseDestroyed(base.id)) {
        continue; // Don't render destroyed bases
      }

      // Use server position if available
      let baseX = base.x;
      let baseY = base.y;
      if (typeof Entities !== 'undefined' && Entities.bases) {
        const serverBase = Entities.bases.get(base.id);
        if (serverBase && serverBase.position) {
          baseX = serverBase.position.x;
          baseY = serverBase.position.y;
        }
      }

      const distance = RadarBaseRenderer.getDistance(
        baseX, baseY,
        playerPos.x, playerPos.y
      );

      if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

      renderedIds.add(base.id);

      const pos = RadarBaseRenderer.worldToRadar(
        baseX, baseY,
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

    // Also render server-known bases not in procedural list
    if (typeof Entities !== 'undefined' && Entities.bases) {
      for (const [baseId, serverBase] of Entities.bases) {
        if (renderedIds.has(baseId)) continue;
        if (Entities.isBaseDestroyed && Entities.isBaseDestroyed(baseId)) continue;
        if (!serverBase.position) continue;

        const distance = RadarBaseRenderer.getDistance(
          serverBase.position.x, serverBase.position.y,
          playerPos.x, playerPos.y
        );

        if (!RadarBaseRenderer.isInRange(distance, radarRange)) continue;

        const pos = RadarBaseRenderer.worldToRadar(
          serverBase.position.x, serverBase.position.y,
          playerPos.x, playerPos.y,
          center, scale
        );

        // Use appropriate visual based on tier
        if (useFactionShapes && serverBase.faction) {
          const shape = CONSTANTS.FACTION_BASE_SHAPES[serverBase.faction] || 'circle';
          const color = CONSTANTS.FACTION_RADAR_COLORS[serverBase.faction] || '#ff4444';
          const size = CONSTANTS.RADAR_ICON_SIZES.base_shape;
          RadarBaseRenderer.drawShape(ctx, pos.x, pos.y, shape, size, color);
        } else if (useCircles) {
          const color = useFactionColors && serverBase.faction
            ? CONSTANTS.FACTION_RADAR_COLORS[serverBase.faction]
            : '#ff4444';
          const size = CONSTANTS.RADAR_ICON_SIZES.base_circle;
          RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, size, color);
        } else {
          const size = CONSTANTS.RADAR_ICON_SIZES.medium_dot;
          RadarBaseRenderer.drawDot(ctx, pos.x, pos.y, size, '#ff4444');
        }
      }
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarObjects = RadarObjects;
}
