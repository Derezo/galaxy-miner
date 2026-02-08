// Galaxy Miner - World Generation (Client)
// Now uses StarSystem layer for Solar System model generation

// Module-level reusable structures to reduce GC pressure in getVisibleObjects()
const _visibleObjectsResult = {
  stars: [],
  planets: [],
  asteroids: [],
  wormholes: [],
  bases: []
};
const _systemCache = new Map();
// Reusable star position object for orbital computations
const _starPos = { x: 0, y: 0 };

const World = {
  seed: null,
  sectors: new Map(),
  currentSector: { x: 0, y: 0 },
  worldChanges: new Map(),
  useStarSystemModel: true, // Feature flag for new generation

  init(seed) {
    this.seed = seed;
    this.sectors.clear();
    this.worldChanges.clear();
    // Reset debug flags
    this._confirmedStarSystem = false;
    this._debugLogCount = 0;
    // Clear StarSystem cache if available
    if (typeof StarSystem !== 'undefined') {
      StarSystem.clearCache();
      StarSystem._debugLogged = false;  // Reset debug flag
      Logger.category('worldGeneration', 'StarSystem loaded and cache cleared');
    } else {
      Logger.error('StarSystem NOT LOADED! Check for JS errors above.');
    }
    Logger.category('worldGeneration', 'World initialized with seed:', seed);
  },

  update(playerPosition) {
    // Calculate current sector
    const sectorX = Math.floor(playerPosition.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(playerPosition.y / CONSTANTS.SECTOR_SIZE);

    // Load 5x5 grid of sectors (expanded from 3x3 for large stars)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const key = `${sectorX + dx}_${sectorY + dy}`;
        if (!this.sectors.has(key)) {
          this.generateSector(sectorX + dx, sectorY + dy);
        }
      }
    }

    // Unload distant sectors (keep memory low)
    for (const [key, sector] of this.sectors) {
      const [sx, sy] = key.split('_').map(Number);
      if (Math.abs(sx - sectorX) > 3 || Math.abs(sy - sectorY) > 3) {
        this.sectors.delete(key);
      }
    }

    this.currentSector = { x: sectorX, y: sectorY };
  },

  generateSector(sectorX, sectorY) {
    const key = `${sectorX}_${sectorY}`;

    // Use new StarSystem model if available
    if (this.useStarSystemModel && typeof StarSystem !== 'undefined') {
      // Log once to confirm we're using new generation
      if (!this._confirmedStarSystem) {
        Logger.category('worldGeneration', 'Using StarSystem generation');
        this._confirmedStarSystem = true;
      }
      return this.generateSectorFromStarSystem(sectorX, sectorY);
    }

    // Fallback to legacy generation - log warning
    Logger.category('worldGeneration', 'Using LEGACY generation - StarSystem not available!');
    return this.generateSectorLegacy(sectorX, sectorY);
  },

  // New Solar System model generation
  generateSectorFromStarSystem(sectorX, sectorY) {
    const key = `${sectorX}_${sectorY}`;
    const rng = this.seededRandom(this.hash(this.seed, sectorX, sectorY));

    // Debug: log first few sector generations
    if (!this._debugLogCount) this._debugLogCount = 0;
    if (this._debugLogCount < 5) {
      const systems = StarSystem.getStarSystemsForSector(sectorX, sectorY);
      Logger.category('worldGeneration', `Sector (${sectorX},${sectorY}): ${systems.length} systems from StarSystem`);
      this._debugLogCount++;
    }

    const sector = {
      x: sectorX,
      y: sectorY,
      stars: [],
      planets: [],
      asteroids: [],
      wormholes: [],
      bases: [],
      systems: [] // Reference to parent star systems
    };

    const sectorMinX = sectorX * CONSTANTS.SECTOR_SIZE;
    const sectorMinY = sectorY * CONSTANTS.SECTOR_SIZE;
    const sectorMaxX = sectorMinX + CONSTANTS.SECTOR_SIZE;
    const sectorMaxY = sectorMinY + CONSTANTS.SECTOR_SIZE;

    // Helper: check if position is within this sector
    const isInSector = (x, y) => {
      return x >= sectorMinX && x < sectorMaxX && y >= sectorMinY && y < sectorMaxY;
    };

    // Get all star systems that could influence this sector
    const systems = StarSystem.getStarSystemsForSector(sectorX, sectorY);
    sector.systems = systems.map(s => s.id);

    for (const system of systems) {
      // Add primary star if in this sector
      if (isInSector(system.primaryStar.x, system.primaryStar.y)) {
        sector.stars.push({
          ...system.primaryStar,
          systemId: system.id,
          isBinary: !!system.binaryInfo
        });
      }

      // Add binary companion if exists and in sector
      if (system.binaryInfo) {
        const secondary = system.binaryInfo.secondaryStar;
        if (isInSector(secondary.x, secondary.y)) {
          sector.stars.push({
            ...secondary,
            systemId: system.id,
            isPrimaryBinary: false,
            binaryInfo: system.binaryInfo
          });
        }
      }

      // Add planets that could be in this sector (orbit might cross it)
      for (const planet of system.planets) {
        // Check if planet's orbit could intersect this sector
        const starX = system.primaryStar.x;
        const starY = system.primaryStar.y;
        const maxReach = planet.orbitRadius + planet.size;

        // Simple bounding box check for orbit
        if (starX + maxReach >= sectorMinX && starX - maxReach < sectorMaxX &&
            starY + maxReach >= sectorMinY && starY - maxReach < sectorMaxY) {
          sector.planets.push({
            ...planet,
            starX: starX,
            starY: starY,
            systemId: system.id
          });
        }
      }

      // Generate belt asteroids for this sector
      for (const belt of system.asteroidBelts) {
        const beltAsteroids = StarSystem.generateBeltAsteroidsForSector(
          system, belt, sectorX, sectorY, rng
        );
        for (const asteroid of beltAsteroids) {
          sector.asteroids.push({
            ...asteroid,
            starX: system.primaryStar.x,
            starY: system.primaryStar.y,
            systemId: system.id,
            isOrbital: true // Flag for orbital vs bouncing
          });
        }
      }

      // Add bases from this system that are in this sector
      // Include starX/starY for position computation in binary systems
      // Check if this sector is in the Graveyard safe zone (with 1 sector buffer for hostile bases)
      const graveyardConfig = CONSTANTS.GRAVEYARD_ZONE;
      // Extended zone: block hostile bases 1 sector beyond graveyard to prevent edge spawns
      const inGraveyardBuffer = graveyardConfig &&
        sectorX >= graveyardConfig.MIN_SECTOR_X - 1 && sectorX <= graveyardConfig.MAX_SECTOR_X + 1 &&
        sectorY >= graveyardConfig.MIN_SECTOR_Y - 1 && sectorY <= graveyardConfig.MAX_SECTOR_Y + 1;

      // Pre-calculate buffer zone world coordinates for orbital check
      const sectorSize = CONSTANTS.SECTOR_SIZE || 1000;
      const bufferMinX = (graveyardConfig?.MIN_SECTOR_X - 1) * sectorSize;
      const bufferMaxX = (graveyardConfig?.MAX_SECTOR_X + 2) * sectorSize;
      const bufferMinY = (graveyardConfig?.MIN_SECTOR_Y - 1) * sectorSize;
      const bufferMaxY = (graveyardConfig?.MAX_SECTOR_Y + 2) * sectorSize;

      for (const base of system.bases) {
        // Skip hostile faction bases in Graveyard zone and buffer zone (must match server filtering)
        if (inGraveyardBuffer && graveyardConfig.BLOCKED_FACTIONS &&
            graveyardConfig.BLOCKED_FACTIONS.includes(base.faction)) {
          Logger.category('graveyard', `Blocking ${base.type} (faction: ${base.faction}) in sector (${sectorX},${sectorY})`);
          continue;
        }

        const starX = system.primaryStar.x;
        const starY = system.primaryStar.y;

        if (base.orbitRadius && base.orbitSpeed) {
          // For orbital hostile bases, check if orbit could cross INTO buffer zone
          // If so, block entirely to prevent visibility from within graveyard
          if (graveyardConfig?.BLOCKED_FACTIONS?.includes(base.faction)) {
            const maxReach = base.orbitRadius + (base.size || 100);
            const orbitCouldCrossBuffer =
              starX + maxReach >= bufferMinX && starX - maxReach < bufferMaxX &&
              starY + maxReach >= bufferMinY && starY - maxReach < bufferMaxY;
            if (orbitCouldCrossBuffer) {
              Logger.category('graveyard', `Blocking orbital ${base.type} (faction: ${base.faction}) - orbit crosses buffer zone`);
              continue;
            }
          }

          // Orbital base - check if orbit crosses sector
          const maxReach = base.orbitRadius + (base.size || 100);
          if (starX + maxReach >= sectorMinX && starX - maxReach < sectorMaxX &&
              starY + maxReach >= sectorMinY && starY - maxReach < sectorMaxY) {
            // Debug: log bases added near graveyard
            if (Math.abs(sectorX) <= 3 && Math.abs(sectorY) <= 3) {
              Logger.category('graveyard', `Adding orbital ${base.type} (faction: ${base.faction}, id: ${base.id}) to sector (${sectorX},${sectorY})`);
            }
            sector.bases.push({
              ...base,
              starX: starX,
              starY: starY,
              systemId: system.id
            });
          }
        } else if (isInSector(base.x, base.y)) {
          // Static base - just check if in sector
          // Debug: log bases added near graveyard
          if (Math.abs(sectorX) <= 3 && Math.abs(sectorY) <= 3) {
            Logger.category('graveyard', `Adding static ${base.type} (faction: ${base.faction}, id: ${base.id}) to sector (${sectorX},${sectorY})`);
          }
          sector.bases.push({
            ...base,
            starX: starX,
            starY: starY,
            systemId: system.id
          });
        }
      }

      // Add wormholes from this system that are in this sector
      for (const wormhole of system.wormholes) {
        if (isInSector(wormhole.x, wormhole.y)) {
          sector.wormholes.push({
            ...wormhole,
            systemId: system.id,
            destinationSector: {
              x: wormhole.destinationSectorX,
              y: wormhole.destinationSectorY
            }
          });
        }
      }

      // Add mining claim objects (asteroids/planets generated near mining claims)
      if (system.miningClaimObjects) {
        // DEBUG: Log mining claim objects for troubleshooting
        if (system.miningClaimObjects.length > 0 && !this._debugMiningClaimLogged) {
          Logger.category('worldGeneration', 'System', system.id, 'has', system.miningClaimObjects.length, 'miningClaimObjects');
          Logger.category('worldGeneration', 'Current sector:', sectorX, sectorY);
          Logger.category('worldGeneration', 'First object:', system.miningClaimObjects[0]);
          this._debugMiningClaimLogged = true;
        }
        for (const obj of system.miningClaimObjects) {
          if (isInSector(obj.x, obj.y)) {
            Logger.category('worldGeneration', 'Adding mining claim object to sector:', obj.id, 'at', obj.x?.toFixed(0), obj.y?.toFixed(0));
            if (obj.type === 'planet') {
              sector.planets.push({
                ...obj,
                starX: system.primaryStar.x,
                starY: system.primaryStar.y,
                systemId: system.id,
                isOrbital: false  // Mining claim objects don't orbit
              });
            } else {
              // Asteroid
              sector.asteroids.push({
                ...obj,
                starX: system.primaryStar.x,
                starY: system.primaryStar.y,
                systemId: system.id,
                isOrbital: false  // Mining claim objects don't orbit
              });
            }
          }
        }
      }
    }

    // Generate deep-space content (void rifts, scavenger yards) if no systems nearby
    if (systems.length === 0) {
      this.generateDeepSpaceContent(sector, sectorX, sectorY, rng);
    }

    this.sectors.set(key, sector);
    return sector;
  },

  // Generate content for sectors far from any star
  generateDeepSpaceContent(sector, sectorX, sectorY, rng) {
    const sectorMinX = sectorX * CONSTANTS.SECTOR_SIZE;
    const sectorMinY = sectorY * CONSTANTS.SECTOR_SIZE;

    // Check if this sector is in the Graveyard safe zone (with buffer)
    const graveyardConfig = CONSTANTS.GRAVEYARD_ZONE;
    // Extended zone: block hostile bases 1 sector beyond graveyard to prevent edge spawns
    const inGraveyardBuffer = graveyardConfig &&
      sectorX >= graveyardConfig.MIN_SECTOR_X - 1 && sectorX <= graveyardConfig.MAX_SECTOR_X + 1 &&
      sectorY >= graveyardConfig.MIN_SECTOR_Y - 1 && sectorY <= graveyardConfig.MAX_SECTOR_Y + 1;

    // Void rifts prefer deep space (blocked in Graveyard and buffer zone)
    const voidRift = CONSTANTS.SPAWN_HUB_TYPES?.void_rift;
    const voidBlocked = inGraveyardBuffer && graveyardConfig?.BLOCKED_FACTIONS?.includes('void');
    if (voidRift && !voidBlocked && rng() < voidRift.spawnChance * 3) { // Higher chance in void
      const size = voidRift.size || 120;
      const x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
      const y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);

      sector.bases.push({
        id: `${sectorX}_${sectorY}_base_void_rift`,
        x, y, size,
        type: 'void_rift',
        faction: 'void',
        name: 'Void Rift',
        health: voidRift.health,
        maxHealth: voidRift.health,
        patrolRadius: voidRift.patrolRadius || 4,
        isDeepSpace: true
      });
    }

    // Scavenger yards in debris fields
    const scavengerYard = CONSTANTS.SPAWN_HUB_TYPES?.scavenger_yard;
    if (scavengerYard && rng() < scavengerYard.spawnChance * 2) {
      const size = scavengerYard.size || 100;
      const x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
      const y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);

      sector.bases.push({
        id: `${sectorX}_${sectorY}_base_scavenger_yard`,
        x, y, size,
        type: 'scavenger_yard',
        faction: 'scavenger',
        name: 'Scavenger Yard',
        health: scavengerYard.health,
        maxHealth: scavengerYard.health,
        patrolRadius: scavengerYard.patrolRadius || 2,
        isDeepSpace: true
      });
    }

    // Some drifting debris/asteroids in deep space
    const debrisCount = Math.floor(rng() * 3) + 1;
    for (let i = 0; i < debrisCount; i++) {
      const size = CONSTANTS.ASTEROID_SIZE_MIN + rng() * (CONSTANTS.ASTEROID_SIZE_MAX - CONSTANTS.ASTEROID_SIZE_MIN);
      const x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
      const y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);

      // Deep space asteroids drift slowly
      const speed = 2 + rng() * 5;
      const angle = rng() * Math.PI * 2;

      sector.asteroids.push({
        id: `${sectorX}_${sectorY}_debris_${i}`,
        x, y, size,
        resources: [['IRON', 'CARBON'][Math.floor(rng() * 2)]],
        initialX: x,
        initialY: y,
        initialVx: Math.cos(angle) * speed,
        initialVy: Math.sin(angle) * speed,
        sectorBounds: {
          minX: sectorMinX,
          minY: sectorMinY,
          maxX: sectorMinX + CONSTANTS.SECTOR_SIZE,
          maxY: sectorMinY + CONSTANTS.SECTOR_SIZE
        },
        isDeepSpace: true,
        isOrbital: false
      });
    }
  },

  // Legacy sector generation (fallback)
  generateSectorLegacy(sectorX, sectorY) {
    const key = `${sectorX}_${sectorY}`;
    const rng = this.seededRandom(this.hash(this.seed, sectorX, sectorY));

    const sector = {
      x: sectorX,
      y: sectorY,
      stars: [],
      planets: [],
      asteroids: [],
      wormholes: [],
      bases: []
    };

    // Track all placed objects for spacing checks
    const placedObjects = [];
    const sectorMinX = sectorX * CONSTANTS.SECTOR_SIZE;
    const sectorMinY = sectorY * CONSTANTS.SECTOR_SIZE;
    const sectorMaxX = sectorMinX + CONSTANTS.SECTOR_SIZE;
    const sectorMaxY = sectorMinY + CONSTANTS.SECTOR_SIZE;

    // Helper: check if position is valid (not too close to existing objects)
    const canPlace = (x, y, size) => {
      for (const obj of placedObjects) {
        const dx = x - obj.x;
        const dy = y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = size + obj.size + CONSTANTS.MIN_OBJECT_SPACING;
        if (dist < minDist) return false;
      }
      return true;
    };

    // Generate stars (with spacing)
    const starCount = Math.floor(rng() * (CONSTANTS.STARS_PER_SECTOR_MAX - CONSTANTS.STARS_PER_SECTOR_MIN + 1)) + CONSTANTS.STARS_PER_SECTOR_MIN;
    for (let i = 0; i < starCount; i++) {
      const size = CONSTANTS.STAR_SIZE_MIN + rng() * (CONSTANTS.STAR_SIZE_MAX - CONSTANTS.STAR_SIZE_MIN);
      let x, y, placed = false;

      for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        if (canPlace(x, y, size)) {
          placed = true;
          break;
        }
      }

      if (!placed) continue;

      const star = {
        id: `${sectorX}_${sectorY}_star_${i}`,
        x,
        y,
        size,
        color: this.getStarColor(rng),
        mass: size * CONSTANTS.STAR_MASS_FACTOR,
        gravityRadius: size * (CONSTANTS.STAR_GRAVITY?.INFLUENCE_RADIUS_FACTOR || CONSTANTS.GRAVITY_RADIUS_FACTOR)
      };
      sector.stars.push(star);
      placedObjects.push({ x, y, size });

      // Generate planets around star (with spacing)
      const planetCount = Math.floor(rng() * (CONSTANTS.PLANETS_PER_STAR_MAX - CONSTANTS.PLANETS_PER_STAR_MIN + 1)) + CONSTANTS.PLANETS_PER_STAR_MIN;
      for (let j = 0; j < planetCount; j++) {
        const orbitRadius = star.size + 50 + rng() * 200;
        const planetSize = CONSTANTS.PLANET_SIZE_MIN + rng() * (CONSTANTS.PLANET_SIZE_MAX - CONSTANTS.PLANET_SIZE_MIN);
        let angle, px, py, planetPlaced = false;

        for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
          angle = rng() * Math.PI * 2;
          px = star.x + Math.cos(angle) * orbitRadius;
          py = star.y + Math.sin(angle) * orbitRadius;
          if (canPlace(px, py, planetSize)) {
            planetPlaced = true;
            break;
          }
        }

        if (!planetPlaced) continue;

        // Orbit speed inversely proportional to orbit radius (Kepler-ish)
        const orbitSpeed = CONSTANTS.PLANET_ORBIT_SPEED_BASE * (star.mass / orbitRadius);

        const planet = {
          id: `${sectorX}_${sectorY}_planet_${i}_${j}`,
          x: px,
          y: py,
          size: planetSize,
          type: this.getPlanetType(rng),
          resources: this.getPlanetResources(rng),
          starId: star.id,
          orbitRadius,
          orbitAngle: angle,
          orbitSpeed
        };
        sector.planets.push(planet);
        placedObjects.push({ x: px, y: py, size: planetSize });
      }
    }

    // Generate asteroids (with spacing and velocity)
    const sectorBounds = {
      minX: sectorMinX,
      minY: sectorMinY,
      maxX: sectorMaxX,
      maxY: sectorMaxY
    };

    const asteroidCount = Math.floor(rng() * (CONSTANTS.ASTEROIDS_PER_SECTOR_MAX - CONSTANTS.ASTEROIDS_PER_SECTOR_MIN + 1)) + CONSTANTS.ASTEROIDS_PER_SECTOR_MIN;
    for (let i = 0; i < asteroidCount; i++) {
      const size = CONSTANTS.ASTEROID_SIZE_MIN + rng() * (CONSTANTS.ASTEROID_SIZE_MAX - CONSTANTS.ASTEROID_SIZE_MIN);
      let x, y, placed = false;

      for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        if (canPlace(x, y, size)) {
          placed = true;
          break;
        }
      }

      if (!placed) continue;

      // Generate velocity (random direction, varying speed)
      const speed = CONSTANTS.ASTEROID_VELOCITY_MIN + rng() * (CONSTANTS.ASTEROID_VELOCITY_MAX - CONSTANTS.ASTEROID_VELOCITY_MIN);
      const angle = rng() * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const asteroid = {
        id: `${sectorX}_${sectorY}_asteroid_${i}`,
        x,
        y,
        size,
        resources: this.getAsteroidResources(rng),
        initialX: x,
        initialY: y,
        initialVx: vx,
        initialVy: vy,
        sectorBounds,
        isOrbital: false
      };
      sector.asteroids.push(asteroid);
      placedObjects.push({ x, y, size });
    }

    // Maybe generate wormhole (with spacing)
    if (rng() < CONSTANTS.WORMHOLE_CHANCE) {
      const size = CONSTANTS.WORMHOLE_SIZE;
      let x, y, placed = false;

      for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        if (canPlace(x, y, size)) {
          placed = true;
          break;
        }
      }

      if (placed) {
        const wormhole = {
          id: `${sectorX}_${sectorY}_wormhole_0`,
          x,
          y,
          size,
          destinationSector: {
            x: Math.floor(rng() * 100 - 50),
            y: Math.floor(rng() * 100 - 50)
          }
        };
        sector.wormholes.push(wormhole);
        placedObjects.push({ x, y, size });
      }
    }

    // Generate faction bases (deterministic based on sector coordinates)
    // Check if this sector is in the Graveyard safe zone (with buffer)
    const graveyardConfig = CONSTANTS.GRAVEYARD_ZONE;
    const inGraveyardBuffer = graveyardConfig &&
      sectorX >= graveyardConfig.MIN_SECTOR_X - 1 && sectorX <= graveyardConfig.MAX_SECTOR_X + 1 &&
      sectorY >= graveyardConfig.MIN_SECTOR_Y - 1 && sectorY <= graveyardConfig.MAX_SECTOR_Y + 1;

    const spawnHubTypes = Object.values(CONSTANTS.SPAWN_HUB_TYPES || {});
    for (const hubType of spawnHubTypes) {
      if (!hubType.spawnChance) continue;

      // Skip hostile faction bases in Graveyard zone and buffer zone
      if (inGraveyardBuffer && graveyardConfig?.BLOCKED_FACTIONS?.includes(hubType.faction)) {
        continue;
      }

      // Roll for this base type in this sector
      if (rng() < hubType.spawnChance) {
        const size = hubType.size || 100;
        let x, y, placed = false;

        for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
          x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
          y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
          if (canPlace(x, y, size)) {
            placed = true;
            break;
          }
        }

        if (placed) {
          const base = {
            id: `${sectorX}_${sectorY}_base_${hubType.id}`,
            x,
            y,
            size,
            type: hubType.id,
            faction: hubType.faction,
            name: hubType.name,
            health: hubType.health,
            maxHealth: hubType.health,
            patrolRadius: hubType.patrolRadius || 3,
            continuousSpawn: hubType.continuousSpawn || false,
            spawnInterval: hubType.spawnInterval || null,
            territoryRadius: hubType.territoryRadius || null
          };
          sector.bases.push(base);
          placedObjects.push({ x, y, size });
        }
      }
    }

    this.sectors.set(key, sector);
    return sector;
  },

  getSector(sectorX, sectorY) {
    const key = `${sectorX}_${sectorY}`;
    if (!this.sectors.has(key)) {
      this.generateSector(sectorX, sectorY);
    }
    return this.sectors.get(key);
  },

  getVisibleObjects(position, viewDistance) {
    // Reuse module-level result object and clear arrays (avoids per-call allocation)
    const objects = _visibleObjectsResult;
    objects.stars.length = 0;
    objects.planets.length = 0;
    objects.asteroids.length = 0;
    objects.wormholes.length = 0;
    objects.bases.length = 0;

    const orbitTime = Physics.getOrbitTime();
    const asteroidTime = Physics.getPhysicsTime();

    // Get objects from nearby sectors (5x5 grid for large stars)
    const sectorX = Math.floor(position.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(position.y / CONSTANTS.SECTOR_SIZE);

    // Viewport AABB for sector culling (500px margin for large stars)
    const SECTOR_CULL_MARGIN = 500;
    const halfExtent = viewDistance / 2 + SECTOR_CULL_MARGIN;
    const viewMinX = position.x - halfExtent;
    const viewMaxX = position.x + halfExtent;
    const viewMinY = position.y - halfExtent;
    const viewMaxY = position.y + halfExtent;

    // Reuse module-level Map for star system binary cache
    _systemCache.clear();
    const systemCache = _systemCache;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        // Sector AABB vs viewport AABB culling
        const sectorWorldX = (sectorX + dx) * CONSTANTS.SECTOR_SIZE;
        const sectorWorldY = (sectorY + dy) * CONSTANTS.SECTOR_SIZE;
        const sectorMaxX = sectorWorldX + CONSTANTS.SECTOR_SIZE;
        const sectorMaxY = sectorWorldY + CONSTANTS.SECTOR_SIZE;

        if (sectorMaxX < viewMinX || sectorWorldX > viewMaxX ||
            sectorMaxY < viewMinY || sectorWorldY > viewMaxY) {
          continue;
        }

        const sector = this.getSector(sectorX + dx, sectorY + dy);

        // Process stars - binary stars need position updates
        for (const star of sector.stars) {
          if (star.binaryInfo) {
            // This is part of a binary system - compute current positions
            const positions = Physics.computeBinaryStarPositions(
              { binaryInfo: star.binaryInfo },
              orbitTime
            );
            // Store for planet reference
            systemCache.set(star.systemId, {
              primaryPos: positions.primary,
              secondaryPos: positions.secondary,
              binaryInfo: star.binaryInfo
            });
            // Mutate in-place (positions are recomputed every frame from physics)
            if (star.isPrimaryBinary === false) {
              star.x = positions.secondary.x;
              star.y = positions.secondary.y;
            } else {
              star.x = positions.primary.x;
              star.y = positions.primary.y;
            }
            objects.stars.push(star);
          } else if (star.isBinary && star.systemId) {
            // Primary star of binary - check if we already computed positions
            const cached = systemCache.get(star.systemId);
            if (cached) {
              // Mutate in-place (positions are recomputed every frame from physics)
              star.x = cached.primaryPos.x;
              star.y = cached.primaryPos.y;
            }
            objects.stars.push(star);
          } else {
            // Single star - no movement
            objects.stars.push(star);
          }
        }

        // Planets orbit their stars - compute current positions
        for (const planet of sector.planets) {
          // Find parent star to check for binary system
          const parentStar = planet.starId
            ? sector.stars.find(s => s.id === planet.starId)
            : null;

          let starPos;
          if (parentStar && parentStar.binaryInfo) {
            // Binary system - use computed star position
            const cached = systemCache.get(planet.systemId || parentStar.systemId);
            if (cached) {
              // Use primary or secondary based on which star the planet orbits
              starPos = parentStar.isPrimaryBinary === false ? cached.secondaryPos : cached.primaryPos;
            } else {
              // Compute positions if not cached
              const positions = Physics.computeBinaryStarPositions(
                { binaryInfo: parentStar.binaryInfo },
                orbitTime
              );
              starPos = parentStar.isPrimaryBinary === false ? positions.secondary : positions.primary;
            }
          } else if (planet.starX !== undefined) {
            _starPos.x = planet.starX;
            _starPos.y = planet.starY;
            starPos = _starPos;
          } else if (parentStar) {
            _starPos.x = parentStar.x;
            _starPos.y = parentStar.y;
            starPos = _starPos;
          }

          if (starPos && planet.orbitSpeed) {
            const pos = Physics.computePlanetPosition(planet, starPos, orbitTime);
            // Mutate in-place (positions are recomputed every frame from orbital mechanics)
            planet.x = pos.x;
            planet.y = pos.y;
          }
          objects.planets.push(planet);
        }

        // Asteroids - orbital vs bouncing physics
        for (const asteroid of sector.asteroids) {
          if (asteroid.isOrbital) {
            // Orbital belt asteroid - check for binary star system
            const parentStar = asteroid.starId
              ? sector.stars.find(s => s.id === asteroid.starId)
              : null;

            let starPos;
            if (parentStar && parentStar.binaryInfo) {
              // Binary system - use computed star position
              const cached = systemCache.get(asteroid.systemId || parentStar.systemId);
              if (cached) {
                starPos = parentStar.isPrimaryBinary === false ? cached.secondaryPos : cached.primaryPos;
              } else {
                const positions = Physics.computeBinaryStarPositions(
                  { binaryInfo: parentStar.binaryInfo },
                  orbitTime
                );
                starPos = parentStar.isPrimaryBinary === false ? positions.secondary : positions.primary;
              }
            } else if (asteroid.starX !== undefined) {
              _starPos.x = asteroid.starX;
              _starPos.y = asteroid.starY;
              starPos = _starPos;
            } else if (parentStar) {
              _starPos.x = parentStar.x;
              _starPos.y = parentStar.y;
              starPos = _starPos;
            } else {
              _starPos.x = asteroid.starX || asteroid.x;
              _starPos.y = asteroid.starY || asteroid.y;
              starPos = _starPos;
            }

            const pos = Physics.computeBeltAsteroidPosition(asteroid, starPos, orbitTime);
            // Mutate in-place (positions are recomputed every frame from physics)
            asteroid.x = pos.x;
            asteroid.y = pos.y;
            asteroid.currentAngle = pos.angle;
            asteroid.state = 'orbiting';
            objects.asteroids.push(asteroid);
          } else if (asteroid.initialX !== undefined) {
            // Bouncing/drifting asteroid - use legacy physics
            const state = Physics.getAsteroidPosition(asteroid, sector.stars, asteroidTime);
            // Mutate in-place (positions are recomputed every frame from physics)
            asteroid.x = state.x;
            asteroid.y = state.y;
            asteroid.state = state.state;
            asteroid.capturedBy = state.capturedBy;
            objects.asteroids.push(asteroid);
          } else {
            // Static asteroid
            objects.asteroids.push(asteroid);
          }
        }

        // Wormholes don't move - push individually to avoid spread allocation
        for (let wi = 0; wi < sector.wormholes.length; wi++) {
          objects.wormholes.push(sector.wormholes[wi]);
        }

        // Bases - compute positions for orbital bases and binary star systems
        for (const base of sector.bases) {
          // Find parent star to check for binary system
          const parentStar = base.starId
            ? sector.stars.find(s => s.id === base.starId)
            : null;

          let starPos;
          if (parentStar && parentStar.binaryInfo) {
            // Binary system - use computed star position
            const cached = systemCache.get(base.systemId || parentStar.systemId);
            if (cached) {
              starPos = parentStar.isPrimaryBinary === false ? cached.secondaryPos : cached.primaryPos;
            } else {
              const positions = Physics.computeBinaryStarPositions(
                { binaryInfo: parentStar.binaryInfo },
                orbitTime
              );
              starPos = parentStar.isPrimaryBinary === false ? positions.secondary : positions.primary;
            }
          } else if (base.starX !== undefined) {
            _starPos.x = base.starX;
            _starPos.y = base.starY;
            starPos = _starPos;
          } else if (parentStar) {
            _starPos.x = parentStar.x;
            _starPos.y = parentStar.y;
            starPos = _starPos;
          }

          if (starPos && base.orbitRadius && base.orbitSpeed) {
            // Orbital base - mutate in-place (recomputed every frame from orbit params)
            const elapsedSeconds = orbitTime / 1000;
            const currentAngle = base.orbitAngle + (base.orbitSpeed * elapsedSeconds);
            base.x = starPos.x + Math.cos(currentAngle) * base.orbitRadius;
            base.y = starPos.y + Math.sin(currentAngle) * base.orbitRadius;
            objects.bases.push(base);
          } else if (starPos && base.starX !== undefined) {
            // Static base in binary system - uses base.x for offset, so cannot mutate
            // This is a rare case (binary system static bases)
            const offsetX = base.x - base.starX;
            const offsetY = base.y - base.starY;
            objects.bases.push({
              ...base,
              x: starPos.x + offsetX,
              y: starPos.y + offsetY
            });
          } else {
            // Non-orbital, non-binary base - push directly
            objects.bases.push(base);
          }
        }
      }
    }

    return objects;
  },

  isObjectDepleted(objectId) {
    return this.worldChanges.has(objectId);
  },

  handleUpdate(data) {
    // Handle world change updates from server
    if (data.depleted) {
      this.worldChanges.set(data.objectId, data.respawnAt);
    } else if (data.respawned) {
      this.worldChanges.delete(data.objectId);
    }
  },

  // Seeded random number generator - Mulberry32 (deterministic across platforms)
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

  getStarColor(rng) {
    const colors = ['#ffff00', '#ffaa00', '#ff6600', '#ffffff', '#aaaaff'];
    return colors[Math.floor(rng() * colors.length)];
  },

  getPlanetType(rng) {
    const types = ['rocky', 'gas', 'ice', 'lava', 'ocean'];
    return types[Math.floor(rng() * types.length)];
  },

  getPlanetResources(rng) {
    const resources = [];
    const types = Object.keys(CONSTANTS.RESOURCE_TYPES);
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      resources.push(types[Math.floor(rng() * types.length)]);
    }
    return resources;
  },

  getAsteroidResources(rng) {
    const resources = [];
    const commonTypes = ['IRON', 'CARBON', 'SILICON'];
    resources.push(commonTypes[Math.floor(rng() * commonTypes.length)]);
    if (rng() < 0.3) {
      const rareTypes = ['COPPER', 'TITANIUM', 'PLATINUM'];
      resources.push(rareTypes[Math.floor(rng() * rareTypes.length)]);
    }
    return resources;
  }
};
