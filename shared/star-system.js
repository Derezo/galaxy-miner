// Galaxy Miner - Star System Generation
// Generates solar systems with stars, planets, asteroid belts across multiple sectors

// Get constants - works in both Node.js and browser
const getConfig = () => {
  // Browser: check window.CONSTANTS (set by constants.js)
  if (typeof window !== 'undefined' && window.CONSTANTS) return window.CONSTANTS;
  // Also check global CONSTANTS (for script scope)
  if (typeof CONSTANTS !== 'undefined') return CONSTANTS;
  // Node.js: require the module
  if (typeof module !== 'undefined') return require('./constants');
  console.error('[StarSystem] No config found!');
  return {};
};

// Define StarSystem and immediately attach to window for browser
const StarSystem = (typeof window !== 'undefined') ? (window.StarSystem = {}) : {};

// Now populate the object
Object.assign(StarSystem, {
  // Cache for generated super-sectors (LRU with max 50 entries)
  superSectorCache: new Map(),
  cacheOrder: [],
  MAX_CACHE_SIZE: 50,

  // Seeded random number generator - Mulberry32 (identical to world.js for determinism)
  seededRandom(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // Hash function for combining seed with coordinates
  hash(seed, x, y) {
    let h = 0;
    const str = `${seed}_${x}_${y}`;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h);
  },

  // Generate a super-sector containing star systems
  generateSuperSector(superX, superY) {
    const config = getConfig();
    const cacheKey = `${superX}_${superY}`;

    // Check cache
    if (this.superSectorCache.has(cacheKey)) {
      return this.superSectorCache.get(cacheKey);
    }

    const seed = this.hash(config.GALAXY_SEED + '_super', superX, superY);
    const rng = this.seededRandom(seed);

    // Use constants with balanced fallbacks
    const superSectorSize = config.SUPER_SECTOR_SIZE || 6000;
    const minStarSeparation = config.MIN_STAR_SEPARATION || 3000;
    const systemCountMin = config.SYSTEMS_PER_SUPER_SECTOR_MIN ?? 1;
    const systemCountMax = config.SYSTEMS_PER_SUPER_SECTOR_MAX || 2;

    // Debug: log params on first generation only
    if (!this._debugLogged) {
      console.log('[StarSystem] Config:', {
        SUPER_SECTOR_SIZE: superSectorSize,
        MIN_STAR_SEPARATION: minStarSeparation,
        SYSTEMS_MIN: systemCountMin,
        SYSTEMS_MAX: systemCountMax,
        configLoaded: !!config.SUPER_SECTOR_SIZE
      });
      this._debugLogged = true;
    }

    // Calculate world position of super-sector origin
    const originX = superX * superSectorSize;
    const originY = superY * superSectorSize;

    const systems = [];
    const systemCount = systemCountMin + Math.floor(rng() * (systemCountMax - systemCountMin + 1));

    // Keep stars away from super-sector edges to prevent cross-boundary clustering
    // With 6000 min separation and 12000 super-sector, need 3000+ margin per edge
    // Using 35% margin ensures stars are at least 0.35*12000*2 = 8400 apart at boundaries
    const edgeMargin = superSectorSize * 0.35;
    const placementSize = superSectorSize - edgeMargin * 2;

    for (let i = 0; i < systemCount; i++) {
      // Try to place a star with minimum separation
      let placed = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = originX + edgeMargin + rng() * placementSize;
        const y = originY + edgeMargin + rng() * placementSize;

        if (this.canPlaceStar(x, y, systems, minStarSeparation, superX, superY)) {
          const system = this.createStarSystem(x, y, rng, superX, superY, i);
          systems.push(system);
          placed = true;
          break;
        }
      }
    }

    // Cache the result
    this.superSectorCache.set(cacheKey, systems);
    this.cacheOrder.push(cacheKey);

    // LRU cache eviction
    if (this.cacheOrder.length > this.MAX_CACHE_SIZE) {
      const oldKey = this.cacheOrder.shift();
      this.superSectorCache.delete(oldKey);
    }

    return systems;
  },

  // Check if a star can be placed at given position
  // Now checks BOTH current super-sector AND neighboring super-sectors
  canPlaceStar(x, y, existingSystems, minSeparation, superX, superY) {
    // First check against systems in current super-sector being built
    for (const system of existingSystems) {
      const dx = x - system.primaryStar.x;
      const dy = y - system.primaryStar.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minSeparation) return false;

      // Also check binary companion if exists
      if (system.binaryInfo) {
        const bx = x - system.binaryInfo.secondaryStar.x;
        const by = y - system.binaryInfo.secondaryStar.y;
        const bDist = Math.sqrt(bx * bx + by * by);
        if (bDist < minSeparation * 0.5) return false;
      }
    }

    // CRITICAL: Check against already-generated neighboring super-sectors
    // This prevents stars from clustering at super-sector boundaries
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip current super-sector

        const neighborKey = `${superX + dx}_${superY + dy}`;
        const neighborSystems = this.superSectorCache.get(neighborKey);

        if (neighborSystems) {
          for (const system of neighborSystems) {
            const sdx = x - system.primaryStar.x;
            const sdy = y - system.primaryStar.y;
            const dist = Math.sqrt(sdx * sdx + sdy * sdy);
            if (dist < minSeparation) return false;
          }
        }
      }
    }

    return true;
  },

  // Create a complete star system
  createStarSystem(x, y, rng, superX, superY, index) {
    const config = getConfig();
    const id = `ss_${superX}_${superY}_${index}`;

    // Star size (4x larger than before)
    const starSizeMin = config.STAR_SIZE_MIN || 320;
    const starSizeMax = config.STAR_SIZE_MAX || 800;
    const size = starSizeMin + rng() * (starSizeMax - starSizeMin);

    // Star properties
    const primaryStar = {
      id: `${id}_star`,
      x,
      y,
      size,
      color: this.getStarColor(rng),
      mass: size * (config.STAR_MASS_FACTOR || 0.5),
      gravityRadius: size * (config.STAR_GRAVITY?.INFLUENCE_RADIUS_FACTOR || 3),
      spectralClass: this.getSpectralClass(size)
    };

    // Calculate influence radius based on star size
    const influenceRadius = this.getInfluenceRadius(size) * (config.SECTOR_SIZE || 1000);

    // Exclusion zone - nothing spawns here
    const exclusionRadius = size + (config.STAR_EXCLUSION_MARGIN || 30) * (size / 100);

    // Binary system (5% chance)
    let binaryInfo = null;
    if (rng() < (config.BINARY_SYSTEM_CHANCE || 0.05)) {
      binaryInfo = this.createBinarySystem(primaryStar, rng);
    }

    // Generate asteroid belts
    const asteroidBelts = this.generateAsteroidBelts(primaryStar, rng);

    // Generate planets
    const planets = this.generatePlanets(primaryStar, asteroidBelts, rng, id);

    // Generate bases (faction-specific placement)
    const bases = this.generateBases(primaryStar, asteroidBelts, influenceRadius, rng, id);

    // Generate wormholes
    const wormholes = this.generateWormholes(primaryStar, binaryInfo, influenceRadius, rng, id);

    return {
      id,
      primaryStar,
      binaryInfo,
      influenceRadius,
      exclusionRadius,
      asteroidBelts,
      planets,
      bases,
      wormholes
    };
  },

  // Create binary star companion
  createBinarySystem(primaryStar, rng) {
    const config = getConfig();

    // Secondary star is 30-80% of primary size
    const secondarySize = primaryStar.size * (0.3 + rng() * 0.5);
    const massRatio = secondarySize / primaryStar.size;

    // Orbit separation: 1.5-3x primary size
    const separation = primaryStar.size * (1.5 + rng() * 1.5);

    // Barycenter divides separation inversely by mass
    const baryOffset = separation * massRatio / (1 + massRatio);

    // Initial position angle
    const phase = rng() * Math.PI * 2;

    // Position barycenter near primary
    const baryCenter = {
      x: primaryStar.x,
      y: primaryStar.y
    };

    // Calculate initial positions
    const r1 = separation * massRatio / (1 + massRatio);
    const r2 = separation - r1;

    return {
      secondaryStar: {
        id: primaryStar.id + '_b',
        x: baryCenter.x + Math.cos(phase + Math.PI) * r2,
        y: baryCenter.y + Math.sin(phase + Math.PI) * r2,
        size: secondarySize,
        color: this.getStarColor(rng),
        mass: secondarySize * (config.STAR_MASS_FACTOR || 0.5)
      },
      baryCenter,
      separation,
      orbitPeriod: 60 + rng() * 180, // 60-240 seconds for full orbit
      orbitPhase: phase,
      primaryOrbitRadius: r1,
      secondaryOrbitRadius: r2
    };
  },

  // Compute current binary star positions based on time
  computeBinaryPositions(system, time) {
    if (!system.binaryInfo) {
      return {
        primary: { x: system.primaryStar.x, y: system.primaryStar.y },
        secondary: null
      };
    }

    const bi = system.binaryInfo;
    const elapsedSeconds = time / 1000;
    const phase = bi.orbitPhase + (elapsedSeconds / bi.orbitPeriod) * Math.PI * 2;

    return {
      primary: {
        x: bi.baryCenter.x + Math.cos(phase) * bi.primaryOrbitRadius,
        y: bi.baryCenter.y + Math.sin(phase) * bi.primaryOrbitRadius
      },
      secondary: {
        x: bi.baryCenter.x + Math.cos(phase + Math.PI) * bi.secondaryOrbitRadius,
        y: bi.baryCenter.y + Math.sin(phase + Math.PI) * bi.secondaryOrbitRadius
      }
    };
  },

  // Generate asteroid belts based on star size
  generateAsteroidBelts(star, rng) {
    const config = getConfig();
    const beltConfig = config.ASTEROID_BELT_CONFIG || {};

    // Determine star size category
    let sizeCategory = 'small';
    if (star.size > 600) sizeCategory = 'large';
    else if (star.size > 450) sizeCategory = 'medium';

    const categoryConfig = beltConfig[sizeCategory] || { belts: [] };
    const belts = [];

    categoryConfig.belts.forEach((beltDef, index) => {
      const innerRadius = star.size * beltDef.radiusMin;
      const outerRadius = star.size * beltDef.radiusMax;

      // Kepler-like orbit speed (slower for outer belts)
      const avgRadius = (innerRadius + outerRadius) / 2;
      const baseSpeed = config.BELT_ORBIT_SPEED_BASE || 0.0001;
      const orbitSpeed = baseSpeed * Math.sqrt(star.mass / avgRadius);

      belts.push({
        index,
        innerRadius,
        outerRadius,
        density: beltDef.density,
        resourceType: beltDef.resourceType,
        orbitSpeed,
        starId: star.id
      });
    });

    return belts;
  },

  // Generate asteroids for a specific belt within a sector
  generateBeltAsteroidsForSector(system, belt, sectorX, sectorY, rng) {
    const config = getConfig();
    const sectorSize = config.SECTOR_SIZE || 1000;
    const asteroids = [];

    const star = system.primaryStar;
    const sectorMinX = sectorX * sectorSize;
    const sectorMinY = sectorY * sectorSize;
    const sectorMaxX = sectorMinX + sectorSize;
    const sectorMaxY = sectorMinY + sectorSize;

    // Calculate how many asteroids this sector should have
    // Based on belt area and density
    const beltArea = Math.PI * (belt.outerRadius ** 2 - belt.innerRadius ** 2);
    const sectorArea = sectorSize * sectorSize;

    // Estimate overlap with sector (simplified)
    const centerDist = Math.sqrt((sectorMinX + sectorSize/2 - star.x)**2 +
                                  (sectorMinY + sectorSize/2 - star.y)**2);

    // Skip if sector is outside belt range
    if (centerDist > belt.outerRadius + sectorSize * 0.7) return [];
    if (centerDist < belt.innerRadius - sectorSize * 0.7) return [];

    // Approximate asteroids for this sector
    const asteroidCount = Math.max(1, Math.floor(belt.density * 3 * rng() + 1));

    for (let i = 0; i < asteroidCount; i++) {
      // Random position within belt annulus
      const r = Math.sqrt(
        rng() * (belt.outerRadius**2 - belt.innerRadius**2) + belt.innerRadius**2
      );
      const theta = rng() * Math.PI * 2;

      const ax = star.x + Math.cos(theta) * r;
      const ay = star.y + Math.sin(theta) * r;

      // Only include if within this sector
      if (ax >= sectorMinX && ax < sectorMaxX && ay >= sectorMinY && ay < sectorMaxY) {
        const size = (config.ASTEROID_SIZE_MIN || 10) +
                     rng() * ((config.ASTEROID_SIZE_MAX || 30) - (config.ASTEROID_SIZE_MIN || 10));

        asteroids.push({
          id: `${sectorX}_${sectorY}_asteroid_belt${belt.index}_${i}`,
          orbitRadius: r,
          orbitAngle: theta,
          orbitSpeed: belt.orbitSpeed * (1 + (rng() - 0.5) * 0.2), // Slight variation
          size,
          resources: this.getAsteroidResources(rng, belt.resourceType),
          starId: star.id,
          beltIndex: belt.index
        });
      }
    }

    return asteroids;
  },

  // Generate planets orbiting the star
  generatePlanets(star, belts, rng, systemId) {
    const config = getConfig();
    const planets = [];

    const minPlanets = config.PLANETS_PER_STAR_MIN || 2;
    const maxPlanets = config.PLANETS_PER_STAR_MAX || 8;
    const planetCount = minPlanets + Math.floor(rng() * (maxPlanets - minPlanets + 1));

    // Create orbital slots that avoid asteroid belts
    const slots = this.generatePlanetSlots(star, belts, planetCount, rng);

    slots.forEach((slot, index) => {
      const planetSize = (config.PLANET_SIZE_MIN || 20) +
                         rng() * ((config.PLANET_SIZE_MAX || 60) - (config.PLANET_SIZE_MIN || 20));

      // Kepler orbit speed
      const orbitSpeed = (config.PLANET_ORBIT_SPEED_BASE || 0.0003) *
                         Math.sqrt(star.mass / slot.radius);

      planets.push({
        id: `${systemId}_planet_${index}`,
        orbitRadius: slot.radius,
        orbitAngle: rng() * Math.PI * 2,
        orbitSpeed,
        size: planetSize,
        type: this.getPlanetType(rng),
        resources: this.getPlanetResources(rng),
        starId: star.id
      });
    });

    return planets;
  },

  // Generate planet orbital slots avoiding belts
  generatePlanetSlots(star, belts, count, rng) {
    const slots = [];
    const exclusionRadius = star.size + (getConfig().STAR_EXCLUSION_MARGIN || 30) * 2;
    const maxRadius = star.size * 6; // Planets within 6x star radius

    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const radius = exclusionRadius + rng() * (maxRadius - exclusionRadius);

        // Check if radius conflicts with any belt
        let inBelt = false;
        for (const belt of belts) {
          if (radius >= belt.innerRadius && radius <= belt.outerRadius) {
            inBelt = true;
            break;
          }
        }

        // Check if too close to existing slots
        let tooClose = false;
        for (const slot of slots) {
          if (Math.abs(radius - slot.radius) < star.size * 0.3) {
            tooClose = true;
            break;
          }
        }

        if (!inBelt && !tooClose) {
          slots.push({ radius });
          placed = true;
          break;
        }
      }
    }

    return slots;
  },

  // Generate faction bases with strategic placement
  generateBases(star, belts, influenceRadius, rng, systemId) {
    const config = getConfig();
    const bases = [];
    const hubTypes = config.SPAWN_HUB_TYPES || {};

    for (const [hubType, hubConfig] of Object.entries(hubTypes)) {
      const placement = hubConfig.placement;
      if (!placement) continue;

      // Check spawn chance
      if (rng() > hubConfig.spawnChance * 10) continue; // Adjusted for system-level spawning

      // Find valid position based on strategy
      const position = this.findBasePosition(star, belts, influenceRadius, placement, rng);
      if (!position) continue;

      bases.push({
        id: `${systemId}_base_${hubType}`,
        type: hubType,
        name: hubConfig.name,
        x: position.x,
        y: position.y,
        orbitRadius: position.orbitRadius || null,
        orbitAngle: position.orbitAngle || null,
        orbitSpeed: position.orbitSpeed || null,
        faction: hubConfig.faction,
        health: hubConfig.health,
        maxHealth: hubConfig.health,
        size: hubConfig.size,
        patrolRadius: hubConfig.patrolRadius,
        starId: star.id
      });
    }

    return bases;
  },

  // Find valid base position based on placement strategy
  findBasePosition(star, belts, influenceRadius, placement, rng) {
    const minDist = influenceRadius * placement.minDistFromStar;
    const maxDist = Math.min(influenceRadius * placement.maxDistFromStar, influenceRadius * 1.5);

    // Strategy: outer_system or resource_rich - place in belt
    if (placement.requiresBelt && belts.length > 0) {
      // Select appropriate belt
      let targetBelt = belts[belts.length - 1]; // Default to outer

      if (placement.preferRareBelt) {
        // Find rare belt
        targetBelt = belts.find(b => b.resourceType === 'rare') || targetBelt;
      } else if (placement.strategy === 'organic_cave') {
        // Swarm prefers middle belt
        targetBelt = belts[Math.floor(belts.length / 2)] || targetBelt;
      }

      const radius = targetBelt.innerRadius +
                     rng() * (targetBelt.outerRadius - targetBelt.innerRadius);
      const angle = rng() * Math.PI * 2;

      return {
        x: star.x + Math.cos(angle) * radius,
        y: star.y + Math.sin(angle) * radius,
        orbitRadius: radius,
        orbitAngle: angle,
        orbitSpeed: placement.orbitsWithBelt ? targetBelt.orbitSpeed * 0.1 : 0
      };
    }

    // Strategy: deep_space - place far from star
    if (placement.preferVoid) {
      const radius = minDist + rng() * (maxDist - minDist);
      const angle = rng() * Math.PI * 2;
      return {
        x: star.x + Math.cos(angle) * radius,
        y: star.y + Math.sin(angle) * radius
      };
    }

    // Default: random in valid range
    const radius = minDist + rng() * (maxDist - minDist);
    const angle = rng() * Math.PI * 2;
    return {
      x: star.x + Math.cos(angle) * radius,
      y: star.y + Math.sin(angle) * radius
    };
  },

  // Generate wormholes
  generateWormholes(star, binaryInfo, influenceRadius, rng, systemId) {
    const config = getConfig();
    const wormholes = [];

    // 5% chance per system
    if (rng() > (config.WORMHOLE_CHANCE || 0.05)) return wormholes;

    let x, y;

    // Binary systems: place at Lagrange-like point
    if (binaryInfo) {
      // L4 or L5 point (60 degrees ahead/behind in orbit)
      const angle = binaryInfo.orbitPhase + (rng() > 0.5 ? Math.PI / 3 : -Math.PI / 3);
      const radius = binaryInfo.separation;
      x = binaryInfo.baryCenter.x + Math.cos(angle) * radius;
      y = binaryInfo.baryCenter.y + Math.sin(angle) * radius;
    } else {
      // Single star: outer system
      const radius = influenceRadius * 0.9;
      const angle = rng() * Math.PI * 2;
      x = star.x + Math.cos(angle) * radius;
      y = star.y + Math.sin(angle) * radius;
    }

    // Destination: random far sector
    const destOffsetX = Math.floor((rng() - 0.5) * 100);
    const destOffsetY = Math.floor((rng() - 0.5) * 100);
    const sectorSize = config.SECTOR_SIZE || 1000;
    const currentSectorX = Math.floor(star.x / sectorSize);
    const currentSectorY = Math.floor(star.y / sectorSize);

    wormholes.push({
      id: `${systemId}_wormhole`,
      x,
      y,
      size: config.WORMHOLE_SIZE || 100,
      destinationSectorX: currentSectorX + destOffsetX,
      destinationSectorY: currentSectorY + destOffsetY,
      starId: star.id
    });

    return wormholes;
  },

  // Get all star systems that could affect a given sector
  getStarSystemsForSector(sectorX, sectorY) {
    const config = getConfig();
    const sectorSize = config.SECTOR_SIZE || 1000;
    const superSectorSize = config.SUPER_SECTOR_SIZE || 6000;

    // Calculate which super-sector this sector is in
    const superX = Math.floor((sectorX * sectorSize) / superSectorSize);
    const superY = Math.floor((sectorY * sectorSize) / superSectorSize);

    const systems = [];
    const sectorCenterX = sectorX * sectorSize + sectorSize / 2;
    const sectorCenterY = sectorY * sectorSize + sectorSize / 2;
    const sectorDiagonal = Math.sqrt(2) * sectorSize / 2;

    // Check 3x3 super-sector grid
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const superSystems = this.generateSuperSector(superX + dx, superY + dy);

        for (const system of superSystems) {
          // Check if system's influence reaches this sector
          const distToSystem = Math.sqrt(
            (sectorCenterX - system.primaryStar.x) ** 2 +
            (sectorCenterY - system.primaryStar.y) ** 2
          );

          // Include if influence + diagonal reaches sector
          if (distToSystem < system.influenceRadius + sectorDiagonal) {
            systems.push(system);
          }
        }
      }
    }

    return systems;
  },

  // Get a specific star system by its ID (format: ss_{superX}_{superY}_{index})
  getStarSystemById(systemId) {
    const parts = systemId.split('_');
    if (parts.length < 4 || parts[0] !== 'ss') {
      return null;
    }

    const superX = parseInt(parts[1]);
    const superY = parseInt(parts[2]);
    const systemIndex = parseInt(parts[3]);

    if (isNaN(superX) || isNaN(superY) || isNaN(systemIndex)) {
      return null;
    }

    const superSystems = this.generateSuperSector(superX, superY);
    return superSystems.find(s => s.id === systemId) || null;
  },

  // Get influence radius based on star size (in sectors)
  getInfluenceRadius(starSize) {
    const config = getConfig();
    if (starSize > 600) return config.SYSTEM_INFLUENCE_LARGE || 3;
    if (starSize > 450) return config.SYSTEM_INFLUENCE_MEDIUM || 2;
    return config.SYSTEM_INFLUENCE_SMALL || 1.5;
  },

  // Helper functions
  getStarColor(rng) {
    const colors = ['#ffff00', '#ffaa00', '#ff6600', '#ffffff', '#aaaaff', '#ffccaa'];
    return colors[Math.floor(rng() * colors.length)];
  },

  getSpectralClass(size) {
    if (size > 700) return 'O';      // Blue giant
    if (size > 600) return 'B';      // Blue
    if (size > 500) return 'A';      // White
    if (size > 450) return 'F';      // Yellow-white
    if (size > 400) return 'G';      // Yellow (like our Sun)
    if (size > 350) return 'K';      // Orange
    return 'M';                       // Red dwarf
  },

  getPlanetType(rng) {
    const types = ['rocky', 'gas', 'ice', 'lava', 'ocean', 'desert', 'jungle'];
    return types[Math.floor(rng() * types.length)];
  },

  getPlanetResources(rng) {
    const config = getConfig();
    const resources = [];
    const types = Object.keys(config.RESOURCE_TYPES || {});
    if (types.length === 0) return resources;

    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      resources.push(types[Math.floor(rng() * types.length)]);
    }
    return resources;
  },

  getAsteroidResources(rng, beltType) {
    const resources = [];

    const resourcePools = {
      common: ['IRON', 'CARBON', 'SILICON', 'NICKEL', 'SULFUR'],
      uncommon: ['COPPER', 'TITANIUM', 'SILVER', 'COBALT', 'LITHIUM'],
      rare: ['PLATINUM', 'GOLD', 'URANIUM', 'IRIDIUM', 'QUANTUM_CRYSTALS']
    };

    const pool = resourcePools[beltType] || resourcePools.common;
    resources.push(pool[Math.floor(rng() * pool.length)]);

    // Chance for secondary resource
    if (rng() < 0.3) {
      const secondaryPool = beltType === 'rare' ? resourcePools.uncommon : resourcePools.common;
      resources.push(secondaryPool[Math.floor(rng() * secondaryPool.length)]);
    }

    return resources;
  },

  // Clear cache (useful for testing or world reset)
  clearCache() {
    this.superSectorCache.clear();
    this.cacheOrder = [];
  }
});  // Close Object.assign

// Export for Node.js (browser already has window.StarSystem from line 17)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StarSystem;
}
