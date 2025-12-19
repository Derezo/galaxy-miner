/**
 * Zone Sampler - Analyzes nearby objects for color palette and activity level
 * Samples colors from stars, planets, NPCs, bases weighted by distance
 */

const ZoneSampler = {
  // Cached zone data
  zoneData: {
    colors: [],           // Array of {color, weight} objects
    activityLevel: 0.15,  // 0-1 scale, baseline 0.15
    dominantFaction: null
  },

  // Sampling configuration
  config: {
    sampleRadius: 1000,   // Units to sample within
    updateInterval: 500,  // ms between full recalculations
    lastUpdate: 0
  },

  // Color mappings for different object types
  colorSources: {
    // Star colors (from constants)
    stars: {
      '#ffff00': { h: 60, s: 100, l: 50 },   // Yellow
      '#ffaa00': { h: 40, s: 100, l: 50 },   // Orange
      '#ff6600': { h: 25, s: 100, l: 50 },   // Red-orange
      '#ffffff': { h: 220, s: 20, l: 90 },   // White (slight blue)
      '#aaaaff': { h: 240, s: 50, l: 80 }    // Blue
    },
    // Planet type colors
    planets: {
      rocky: { h: 25, s: 60, l: 35 },        // Brown
      gas: { h: 35, s: 50, l: 70 },          // Tan
      ice: { h: 200, s: 60, l: 75 },         // Light blue
      lava: { h: 15, s: 100, l: 55 },        // Orange-red
      ocean: { h: 220, s: 70, l: 50 }        // Blue
    },
    // Faction colors (from FACTION_COLOR_PALETTES)
    factions: {
      pirate: { h: 10, s: 100, l: 50 },      // Red-orange
      scavenger: { h: 45, s: 70, l: 45 },    // Yellow-brown
      swarm: { h: 0, s: 70, l: 25 },         // Dark red
      void: { h: 280, s: 100, l: 50 },       // Purple
      rogue_miner: { h: 35, s: 100, l: 50 }  // Orange
    }
  },

  // Activity weights for different object types
  activityWeights: {
    star: 0.1,
    planet: 0.05,
    asteroid: 0.02,
    npc: 0.15,
    base: 0.25,
    player: 0.1
  },

  init() {
    this.zoneData = {
      colors: [],
      activityLevel: 0.15,
      dominantFaction: null
    };
    this.config.lastUpdate = 0;
    Logger.log('ZoneSampler initialized');
  },

  /**
   * Update zone sampling
   * @param {Object} visibleObjects - From World.getVisibleObjects()
   * @param {{x: number, y: number}} playerPosition
   */
  update(visibleObjects, playerPosition) {
    const now = Date.now();
    if (now - this.config.lastUpdate < this.config.updateInterval) {
      return; // Throttle updates
    }
    this.config.lastUpdate = now;

    const colors = [];
    let totalActivity = 0.15; // Baseline
    const factionCounts = {};

    // Sample stars
    if (visibleObjects.stars) {
      for (const star of visibleObjects.stars) {
        const dist = this.getDistance(playerPosition, star);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const hsl = this.colorSources.stars[star.color];
        if (hsl) {
          colors.push({ ...hsl, weight: weight * 2 }); // Stars are prominent
        }
        totalActivity += this.activityWeights.star * weight;
      }
    }

    // Sample planets
    if (visibleObjects.planets) {
      for (const planet of visibleObjects.planets) {
        const dist = this.getDistance(playerPosition, planet);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const hsl = this.colorSources.planets[planet.type];
        if (hsl) {
          colors.push({ ...hsl, weight });
        }
        totalActivity += this.activityWeights.planet * weight;
      }
    }

    // Sample asteroids (just for activity, minimal color contribution)
    if (visibleObjects.asteroids) {
      for (const asteroid of visibleObjects.asteroids) {
        const dist = this.getDistance(playerPosition, asteroid);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        totalActivity += this.activityWeights.asteroid * weight;
      }
    }

    // Sample bases
    if (visibleObjects.bases) {
      for (const base of visibleObjects.bases) {
        const dist = this.getDistance(playerPosition, base);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const faction = base.faction;
        const hsl = this.colorSources.factions[faction];
        if (hsl) {
          colors.push({ ...hsl, weight: weight * 1.5 });
          factionCounts[faction] = (factionCounts[faction] || 0) + weight;
        }
        totalActivity += this.activityWeights.base * weight;
      }
    }

    // Sample NPCs from Entities
    if (typeof Entities !== 'undefined' && Entities.npcs) {
      for (const [id, npc] of Entities.npcs) {
        const dist = this.getDistance(playerPosition, npc.position);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const faction = npc.faction;
        const hsl = this.colorSources.factions[faction];
        if (hsl) {
          colors.push({ ...hsl, weight: weight * 0.5 });
          factionCounts[faction] = (factionCounts[faction] || 0) + weight;
        }
        totalActivity += this.activityWeights.npc * weight;
      }
    }

    // Sample other players
    if (typeof Entities !== 'undefined' && Entities.players) {
      for (const [id, player] of Entities.players) {
        const dist = this.getDistance(playerPosition, player.position);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        totalActivity += this.activityWeights.player * weight;
      }
    }

    // Determine dominant faction
    let dominantFaction = null;
    let maxFactionWeight = 0;
    for (const [faction, weight] of Object.entries(factionCounts)) {
      if (weight > maxFactionWeight) {
        maxFactionWeight = weight;
        dominantFaction = faction;
      }
    }

    // Update zone data
    this.zoneData.colors = colors;
    this.zoneData.activityLevel = Math.min(1, totalActivity);
    this.zoneData.dominantFaction = dominantFaction;
  },

  /**
   * Get distance between player and object
   */
  getDistance(playerPos, obj) {
    const x = (obj.x !== undefined ? obj.x : obj.position?.x) || 0;
    const y = (obj.y !== undefined ? obj.y : obj.position?.y) || 0;
    const dx = playerPos.x - x;
    const dy = playerPos.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Get weight based on distance (inverse, 1 at 0, 0 at sampleRadius)
   */
  getDistanceWeight(dist) {
    return Math.max(0, 1 - (dist / this.config.sampleRadius));
  },

  /**
   * Get current zone data for palette manager
   */
  getZoneData() {
    return this.zoneData;
  }
};
