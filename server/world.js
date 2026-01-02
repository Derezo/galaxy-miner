// Galaxy Miner - Server-side World Generation
// Mirrors client-side generation for validation
// Now uses StarSystem layer for Solar System model generation

const config = require('./config');
const { statements } = require('./database');
const Physics = require('../shared/physics');
const StarSystem = require('../shared/star-system');
const logger = require('../shared/logger');
const { isGraveyardSector } = require('./game/npc');

// Cache generated sectors
const sectorCache = new Map();
const MAX_CACHED_SECTORS = 100;

// Feature flag for new generation model
const useStarSystemModel = true;

// Seeded random number generator - Mulberry32 (deterministic across platforms)
function seededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash function (same as client)
function hash(seed, x, y) {
  let h = 0;
  const str = `${seed}_${x}_${y}`;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

function getStarColor(rng) {
  const colors = ['#ffff00', '#ffaa00', '#ff6600', '#ffffff', '#aaaaff'];
  return colors[Math.floor(rng() * colors.length)];
}

function getPlanetType(rng) {
  const types = ['rocky', 'gas', 'ice', 'lava', 'ocean'];
  return types[Math.floor(rng() * types.length)];
}

function getPlanetResources(rng) {
  const resources = [];
  const types = Object.keys(config.RESOURCE_TYPES);
  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    resources.push(types[Math.floor(rng() * types.length)]);
  }
  return resources;
}

function getAsteroidResources(rng) {
  const resources = [];
  const commonTypes = ['IRON', 'CARBON', 'SILICON'];
  resources.push(commonTypes[Math.floor(rng() * commonTypes.length)]);
  if (rng() < 0.3) {
    const rareTypes = ['COPPER', 'TITANIUM', 'PLATINUM'];
    resources.push(rareTypes[Math.floor(rng() * rareTypes.length)]);
  }
  return resources;
}

function generateSector(sectorX, sectorY) {
  const key = `${sectorX}_${sectorY}`;

  // Check cache
  if (sectorCache.has(key)) {
    return sectorCache.get(key);
  }

  // Use new StarSystem model if enabled
  if (useStarSystemModel) {
    return generateSectorFromStarSystem(sectorX, sectorY);
  }

  // Fallback to legacy generation
  return generateSectorLegacy(sectorX, sectorY);
}

// New Solar System model generation
function generateSectorFromStarSystem(sectorX, sectorY) {
  const key = `${sectorX}_${sectorY}`;
  const rng = seededRandom(hash(config.GALAXY_SEED, sectorX, sectorY));

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

  const sectorMinX = sectorX * config.SECTOR_SIZE;
  const sectorMinY = sectorY * config.SECTOR_SIZE;
  const sectorMaxX = sectorMinX + config.SECTOR_SIZE;
  const sectorMaxY = sectorMinY + config.SECTOR_SIZE;

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
          isOrbital: true
        });
      }
    }

    // Add bases from this system that are in this sector
    // Include starX/starY for position computation in binary systems
    // Check if this sector is in the Graveyard safe zone
    const inGraveyard = isGraveyardSector(sectorX, sectorY);
    const graveyardConfig = config.GRAVEYARD_ZONE;

    for (const base of system.bases) {
      // Skip hostile faction bases in Graveyard zone
      if (inGraveyard && graveyardConfig?.BLOCKED_FACTIONS?.includes(base.faction)) {
        continue;
      }

      // For bases with orbital parameters, check if orbit could cross this sector
      const starX = system.primaryStar.x;
      const starY = system.primaryStar.y;

      if (base.orbitRadius && base.orbitSpeed) {
        // Orbital base - check if orbit crosses sector
        const maxReach = base.orbitRadius + (base.size || 100);
        if (starX + maxReach >= sectorMinX && starX - maxReach < sectorMaxX &&
            starY + maxReach >= sectorMinY && starY - maxReach < sectorMaxY) {
          sector.bases.push({
            ...base,
            starX: starX,
            starY: starY,
            systemId: system.id
          });
        }
      } else if (isInSector(base.x, base.y)) {
        // Static base - just check if in sector
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
      for (const obj of system.miningClaimObjects) {
        if (isInSector(obj.x, obj.y)) {
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
    generateDeepSpaceContent(sector, sectorX, sectorY, rng);
  }

  // Cache management
  if (sectorCache.size >= MAX_CACHED_SECTORS) {
    const firstKey = sectorCache.keys().next().value;
    sectorCache.delete(firstKey);
  }
  sectorCache.set(key, sector);

  return sector;
}

// Generate content for sectors far from any star
function generateDeepSpaceContent(sector, sectorX, sectorY, rng) {
  const sectorMinX = sectorX * config.SECTOR_SIZE;
  const sectorMinY = sectorY * config.SECTOR_SIZE;

  // Check if this sector is in the Graveyard safe zone
  const inGraveyard = isGraveyardSector(sectorX, sectorY);
  const graveyardConfig = config.GRAVEYARD_ZONE;

  // Void rifts prefer deep space (blocked in Graveyard)
  const voidRift = config.SPAWN_HUB_TYPES?.void_rift;
  const voidBlocked = inGraveyard && graveyardConfig?.BLOCKED_FACTIONS?.includes('void');
  if (voidRift && !voidBlocked && rng() < voidRift.spawnChance * 3) {
    const size = voidRift.size || 120;
    const x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
    const y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);

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

  // Scavenger yards in debris fields (allowed in Graveyard - scavengers are passive there)
  const scavengerYard = config.SPAWN_HUB_TYPES?.scavenger_yard;
  if (scavengerYard && rng() < scavengerYard.spawnChance * 2) {
    const size = scavengerYard.size || 100;
    const x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
    const y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);

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
    const size = config.ASTEROID_SIZE_MIN + rng() * (config.ASTEROID_SIZE_MAX - config.ASTEROID_SIZE_MIN);
    const x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
    const y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);

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
        maxX: sectorMinX + config.SECTOR_SIZE,
        maxY: sectorMinY + config.SECTOR_SIZE
      },
      isDeepSpace: true,
      isOrbital: false
    });
  }
}

// Legacy sector generation (fallback)
function generateSectorLegacy(sectorX, sectorY) {
  const key = `${sectorX}_${sectorY}`;
  const rng = seededRandom(hash(config.GALAXY_SEED, sectorX, sectorY));

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
  const sectorMinX = sectorX * config.SECTOR_SIZE;
  const sectorMinY = sectorY * config.SECTOR_SIZE;
  const sectorMaxX = sectorMinX + config.SECTOR_SIZE;
  const sectorMaxY = sectorMinY + config.SECTOR_SIZE;

  // Helper: check if position is valid (not too close to existing objects)
  const canPlace = (x, y, size) => {
    for (const obj of placedObjects) {
      const dx = x - obj.x;
      const dy = y - obj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = size + obj.size + config.MIN_OBJECT_SPACING;
      if (dist < minDist) return false;
    }
    return true;
  };

  // Generate stars (with spacing)
  const starCount = Math.floor(rng() * (config.STARS_PER_SECTOR_MAX - config.STARS_PER_SECTOR_MIN + 1)) + config.STARS_PER_SECTOR_MIN;
  for (let i = 0; i < starCount; i++) {
    const size = config.STAR_SIZE_MIN + rng() * (config.STAR_SIZE_MAX - config.STAR_SIZE_MIN);
    let x, y, placed = false;

    for (let attempt = 0; attempt < config.PLACEMENT_MAX_ATTEMPTS; attempt++) {
      x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
      y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);
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
      color: getStarColor(rng),
      mass: size * config.STAR_MASS_FACTOR,
      gravityRadius: size * config.GRAVITY_RADIUS_FACTOR
    };
    sector.stars.push(star);
    placedObjects.push({ x, y, size });

    // Generate planets around star (with spacing)
    const planetCount = Math.floor(rng() * (config.PLANETS_PER_STAR_MAX - config.PLANETS_PER_STAR_MIN + 1)) + config.PLANETS_PER_STAR_MIN;
    for (let j = 0; j < planetCount; j++) {
      const orbitRadius = star.size + 50 + rng() * 200;
      const planetSize = config.PLANET_SIZE_MIN + rng() * (config.PLANET_SIZE_MAX - config.PLANET_SIZE_MIN);
      let angle, px, py, planetPlaced = false;

      for (let attempt = 0; attempt < config.PLACEMENT_MAX_ATTEMPTS; attempt++) {
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
      const orbitSpeed = config.PLANET_ORBIT_SPEED_BASE * (star.mass / orbitRadius);

      const planet = {
        id: `${sectorX}_${sectorY}_planet_${i}_${j}`,
        x: px,
        y: py,
        size: planetSize,
        type: getPlanetType(rng),
        resources: getPlanetResources(rng),
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

  const asteroidCount = Math.floor(rng() * (config.ASTEROIDS_PER_SECTOR_MAX - config.ASTEROIDS_PER_SECTOR_MIN + 1)) + config.ASTEROIDS_PER_SECTOR_MIN;
  for (let i = 0; i < asteroidCount; i++) {
    const size = config.ASTEROID_SIZE_MIN + rng() * (config.ASTEROID_SIZE_MAX - config.ASTEROID_SIZE_MIN);
    let x, y, placed = false;

    for (let attempt = 0; attempt < config.PLACEMENT_MAX_ATTEMPTS; attempt++) {
      x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
      y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);
      if (canPlace(x, y, size)) {
        placed = true;
        break;
      }
    }

    if (!placed) continue;

    // Generate velocity (random direction, varying speed)
    const speed = config.ASTEROID_VELOCITY_MIN + rng() * (config.ASTEROID_VELOCITY_MAX - config.ASTEROID_VELOCITY_MIN);
    const angle = rng() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const asteroid = {
      id: `${sectorX}_${sectorY}_asteroid_${i}`,
      x,
      y,
      size,
      resources: getAsteroidResources(rng),
      initialX: x,
      initialY: y,
      initialVx: vx,
      initialVy: vy,
      sectorBounds
    };
    sector.asteroids.push(asteroid);
    placedObjects.push({ x, y, size });
  }

  // Maybe generate wormhole (with spacing)
  if (rng() < config.WORMHOLE_CHANCE) {
    const size = config.WORMHOLE_SIZE;
    let x, y, placed = false;

    for (let attempt = 0; attempt < config.PLACEMENT_MAX_ATTEMPTS; attempt++) {
      x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
      y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);
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
  // Check if this sector is in the Graveyard safe zone
  const inGraveyard = isGraveyardSector(sectorX, sectorY);
  const graveyardConfig = config.GRAVEYARD_ZONE;

  const spawnHubTypes = Object.values(config.SPAWN_HUB_TYPES || {});
  for (const hubType of spawnHubTypes) {
    if (!hubType.spawnChance) continue;

    // Skip hostile faction bases in Graveyard zone
    if (inGraveyard && graveyardConfig?.BLOCKED_FACTIONS?.includes(hubType.faction)) {
      continue;
    }

    // Roll for this base type in this sector
    if (rng() < hubType.spawnChance) {
      const size = hubType.size || 100;
      let x, y, placed = false;

      for (let attempt = 0; attempt < config.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (config.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (config.SECTOR_SIZE - size * 2);
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

  // Cache management
  if (sectorCache.size >= MAX_CACHED_SECTORS) {
    // Remove oldest entry
    const firstKey = sectorCache.keys().next().value;
    sectorCache.delete(firstKey);
  }
  sectorCache.set(key, sector);

  return sector;
}

// Helper function to find object in a specific sector
function findInSector(sector, type, objectId) {
  if (type === 'asteroid' || type === 'debris') {
    return sector.asteroids.find(a => a.id === objectId);
  } else if (type === 'planet') {
    return sector.planets.find(p => p.id === objectId);
  } else if (type === 'star') {
    return sector.stars.find(s => s.id === objectId);
  } else if (type === 'wormhole') {
    return sector.wormholes.find(w => w.id === objectId);
  } else if (type === 'base') {
    return sector.bases.find(b => b.id === objectId);
  }
  return null;
}

function getObjectById(objectId, debug = false) {
  // Check for StarSystem ID format: ss_{superX}_{superY}_{systemIndex}_{type}_{objectIndex}
  if (objectId.startsWith('ss_')) {
    return getStarSystemObjectById(objectId, debug);
  }

  // Legacy format: {sectorX}_{sectorY}_{type}_{index}
  const parts = objectId.split('_');
  if (parts.length < 4) {
    logger.log('[World] Invalid objectId format:', objectId, 'parts:', parts);
    return null;
  }

  const sectorX = parseInt(parts[0]);
  const sectorY = parseInt(parts[1]);
  const type = parts[2];

  if (debug) {
    logger.log('[World] Looking up legacy object:', {
      objectId,
      parsedSector: { x: sectorX, y: sectorY },
      type,
      idParts: parts
    });
  }

  const sector = generateSector(sectorX, sectorY);

  if (debug) {
    const count = type === 'asteroid' || type === 'debris'
      ? sector.asteroids.length
      : type === 'planet'
        ? sector.planets.length
        : 0;
    logger.log(`[World] Sector ${sectorX},${sectorY} has ${count} ${type}s`);
  }

  // Try primary sector first
  let result = findInSector(sector, type, objectId);

  if (debug && result) {
    logger.log('[World] Found in primary sector');
  }

  // For orbital objects, check neighboring sectors
  if (!result && (type === 'asteroid' || type === 'debris' || type === 'planet')) {
    if (debug) {
      logger.log('[World] Not found in primary sector, checking neighbors...');
    }
    for (let dx = -1; dx <= 1 && !result; dx++) {
      for (let dy = -1; dy <= 1 && !result; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighborSector = generateSector(sectorX + dx, sectorY + dy);
        result = findInSector(neighborSector, type, objectId);
        if (debug && result) {
          logger.log(`[World] Found in neighbor sector ${sectorX + dx},${sectorY + dy}`);
        }
      }
    }
  }

  if (!result && (type === 'asteroid' || type === 'debris' || type === 'planet')) {
    logger.log('[World] Object not found after checking neighbors:', objectId);
  }

  return result;
}

// Handle StarSystem ID format:
// - Stars: ss_{superX}_{superY}_{systemIndex}_star (5 parts)
// - Others: ss_{superX}_{superY}_{systemIndex}_{type}_{objectIndex} (6 parts)
function getStarSystemObjectById(objectId, debug = false) {
  const parts = objectId.split('_');
  // Stars have 5 parts, other objects (planets, bases, etc.) have 6 parts
  if (parts.length < 5) {
    logger.log('[World] Invalid StarSystem objectId format:', objectId, 'parts:', parts);
    return null;
  }

  // Determine type: for 5-part IDs, type is index 4; for 6-part IDs, type is also index 4
  const type = parts[4];

  // Stars and wormholes only have 5 parts - validate these cases
  // Exception: binary star companions have 6 parts with '_b' suffix (e.g., ss_0_0_0_star_b)
  const singletonTypes = ['star', 'wormhole'];
  const isBinaryStar = type === 'star' && parts.length === 6 && parts[5] === 'b';
  if (singletonTypes.includes(type) && parts.length !== 5 && !isBinaryStar) {
    logger.log(`[World] Invalid ${type} objectId format:`, objectId, 'expected 5 parts');
    return null;
  }

  // Other objects (planets, bases, asteroids) should have 6 parts (with object index/subtype)
  if (!singletonTypes.includes(type) && parts.length < 6) {
    logger.log('[World] Invalid StarSystem objectId format:', objectId, 'expected 6 parts for type:', type);
    return null;
  }

  const superX = parseInt(parts[1]);
  const superY = parseInt(parts[2]);
  const systemIndex = parseInt(parts[3]);
  // type already declared above at line 635
  const systemId = `ss_${superX}_${superY}_${systemIndex}`;

  if (debug) {
    logger.log('[World] Looking up StarSystem object:', {
      objectId,
      systemId,
      superSector: { x: superX, y: superY },
      systemIndex,
      type
    });
  }

  // Get the star system directly
  const system = StarSystem.getStarSystemById(systemId);

  if (!system) {
    if (debug) {
      logger.log('[World] StarSystem not found:', systemId);
    }
    // Fallback: search through sectors near the super-sector
    return findStarSystemObjectInSectors(objectId, type, superX, superY, debug);
  }

  // Find the object within the system
  let result = null;
  if (type === 'planet') {
    result = system.planets.find(p => p.id === objectId);
    // Also check miningClaimObjects for mining claim planets
    if (!result && system.miningClaimObjects) {
      result = system.miningClaimObjects.find(obj => obj.id === objectId && obj.type === 'planet');
    }
  } else if (type === 'asteroid') {
    // First check miningClaimObjects for mining claim asteroids
    if (system.miningClaimObjects) {
      result = system.miningClaimObjects.find(obj => obj.id === objectId && obj.type === 'asteroid');
    }
    // Belt asteroids are generated per-sector, search nearby sectors if not found
    if (!result) {
      return findStarSystemObjectInSectors(objectId, type, superX, superY, debug);
    }
  } else if (type === 'star') {
    if (system.primaryStar.id === objectId) {
      result = system.primaryStar;
    } else if (system.binaryInfo && system.binaryInfo.secondaryStar.id === objectId) {
      result = system.binaryInfo.secondaryStar;
    }
  } else if (type === 'base') {
    result = system.bases.find(b => b.id === objectId);
  } else if (type === 'wormhole') {
    result = system.wormholes.find(w => w.id === objectId);
  }

  if (debug) {
    logger.log('[World] StarSystem lookup result:', result ? 'Found' : 'Not found');
  }

  return result;
}

// Fallback: search for StarSystem objects through generated sectors
function findStarSystemObjectInSectors(objectId, type, superX, superY, debug = false) {
  // Super-sectors are larger, convert to approximate regular sector coordinates
  // Super-sector coordinates map to multiple regular sectors
  // Regular sectors are 1000x1000 units, super-sectors are ~6000x6000 units
  const superSectorSize = config.SUPER_SECTOR_SIZE || 6000;
  const sectorSize = config.SECTOR_SIZE || 1000;

  // Convert super-sector origin to regular sector coordinates
  const baseSectorX = Math.floor((superX * superSectorSize) / sectorSize);
  const baseSectorY = Math.floor((superY * superSectorSize) / sectorSize);

  // Calculate how many regular sectors span a super-sector
  const sectorsPerSuperSector = Math.ceil(superSectorSize / sectorSize);

  if (debug) {
    logger.log('[World] Searching sectors around:', { baseSectorX, baseSectorY, sectorsPerSuperSector });
  }

  // Search a grid of sectors within and around the super-sector
  // Add small margin (-2 to +sectorsPerSuperSector+2)
  for (let dx = -2; dx <= sectorsPerSuperSector + 2; dx++) {
    for (let dy = -2; dy <= sectorsPerSuperSector + 2; dy++) {
      const sector = generateSector(baseSectorX + dx, baseSectorY + dy);
      const result = findInSector(sector, type, objectId);
      if (result) {
        if (debug) {
          logger.log(`[World] Found in sector ${baseSectorX + dx},${baseSectorY + dy}`);
        }
        return result;
      }
    }
  }

  if (debug) {
    logger.log('[World] StarSystem object not found in any searched sector');
  }
  return null;
}

function isObjectDepleted(objectId) {
  const change = statements.getWorldChange.get(objectId);
  if (!change) return false;

  // Check if respawned
  const now = new Date();
  const respawnAt = new Date(change.respawn_at);
  if (now >= respawnAt) {
    statements.deleteWorldChange.run(objectId);
    return false;
  }

  return true;
}

function depleteObject(objectId) {
  const respawnTime = config.RESOURCE_RESPAWN_TIME_MIN +
    Math.random() * (config.RESOURCE_RESPAWN_TIME_MAX - config.RESOURCE_RESPAWN_TIME_MIN);
  const respawnAt = new Date(Date.now() + respawnTime).toISOString();

  statements.createWorldChange.run(objectId, 'depleted', respawnAt);
}

// Clean up expired world changes periodically
function cleanupExpiredChanges() {
  statements.deleteExpiredWorldChanges.run();
}

// Run cleanup every minute
setInterval(cleanupExpiredChanges, 60000);

// Get current computed position of an object (for moving objects)
function getObjectPosition(objectId, time) {
  const object = getObjectById(objectId);
  if (!object) return null;

  time = time || Physics.getPhysicsTime();
  const orbitTime = Physics.getOrbitTime();

  // Parse object type from ID - handle both legacy and StarSystem formats
  const parts = objectId.split('_');
  let type, sector;

  if (objectId.startsWith('ss_')) {
    // StarSystem format: ss_{superX}_{superY}_{systemIndex}_{type}_{objectIndex}
    type = parts[4]; // type is at index 4
    // Get sector from object's position or starX/starY
    const objX = object.starX !== undefined ? object.starX : (object.x || 0);
    const objY = object.starY !== undefined ? object.starY : (object.y || 0);
    const sectorX = Math.floor(objX / config.SECTOR_SIZE);
    const sectorY = Math.floor(objY / config.SECTOR_SIZE);
    sector = generateSector(sectorX, sectorY);
  } else {
    // Legacy format: {sectorX}_{sectorY}_{type}_{index}
    type = parts[2];
    const sectorX = parseInt(parts[0]);
    const sectorY = parseInt(parts[1]);
    sector = generateSector(sectorX, sectorY);
  }

  // Stars - check for binary systems
  if (type === 'star') {
    if (object.binaryInfo) {
      // Binary star - compute current position
      const positions = Physics.computeBinaryStarPositions(
        { binaryInfo: object.binaryInfo },
        orbitTime
      );
      if (object.isPrimaryBinary === false) {
        return { x: positions.secondary.x, y: positions.secondary.y };
      }
      return { x: positions.primary.x, y: positions.primary.y };
    }
    return { x: object.x, y: object.y };
  }

  // Wormholes don't move
  if (type === 'wormhole') {
    return { x: object.x, y: object.y };
  }

  // Planets orbit their stars
  if (type === 'planet') {
    // Find parent star to check for binary system
    const parentStar = object.starId
      ? sector.stars.find(s => s.id === object.starId)
      : null;

    let starPos;
    if (parentStar && parentStar.binaryInfo) {
      // Binary system - compute current star position
      const positions = Physics.computeBinaryStarPositions(
        { binaryInfo: parentStar.binaryInfo },
        orbitTime
      );
      // Use primary or secondary based on which star the planet orbits
      starPos = parentStar.isPrimaryBinary === false ? positions.secondary : positions.primary;
    } else if (object.starX !== undefined) {
      // Static position (non-binary or legacy)
      starPos = { x: object.starX, y: object.starY };
    } else if (parentStar) {
      starPos = { x: parentStar.x, y: parentStar.y };
    }

    if (starPos && object.orbitSpeed) {
      return Physics.computePlanetPosition(object, starPos, orbitTime);
    }
    return { x: object.x, y: object.y };
  }

  // Asteroids - orbital vs bouncing
  if (type === 'asteroid' || type === 'debris') {
    if (object.isOrbital) {
      // Orbital belt asteroid - check for binary star system
      const parentStar = object.starId
        ? sector.stars.find(s => s.id === object.starId)
        : null;

      let starPos;
      if (parentStar && parentStar.binaryInfo) {
        // Binary system - compute current star position
        const positions = Physics.computeBinaryStarPositions(
          { binaryInfo: parentStar.binaryInfo },
          orbitTime
        );
        starPos = parentStar.isPrimaryBinary === false ? positions.secondary : positions.primary;
      } else if (object.starX !== undefined) {
        starPos = { x: object.starX, y: object.starY };
      } else if (parentStar) {
        starPos = { x: parentStar.x, y: parentStar.y };
      } else {
        starPos = { x: object.starX || object.x, y: object.starY || object.y };
      }

      const pos = Physics.computeBeltAsteroidPosition(object, starPos, orbitTime);
      return { x: pos.x, y: pos.y, state: 'orbiting', currentAngle: pos.angle };
    }
    if (object.initialX !== undefined) {
      // Bouncing/drifting asteroid
      const state = Physics.getAsteroidPosition(object, sector.stars, time);
      return { x: state.x, y: state.y, state: state.state };
    }
    return { x: object.x, y: object.y };
  }

  // Bases - handle orbital bases and binary star systems
  if (type === 'base') {
    // Find parent star to check for binary system
    const parentStar = object.starId
      ? sector.stars.find(s => s.id === object.starId)
      : null;

    let starPos;
    if (parentStar && parentStar.binaryInfo) {
      // Binary system - compute current star position
      const positions = Physics.computeBinaryStarPositions(
        { binaryInfo: parentStar.binaryInfo },
        orbitTime
      );
      starPos = parentStar.isPrimaryBinary === false ? positions.secondary : positions.primary;
    } else if (object.starX !== undefined) {
      starPos = { x: object.starX, y: object.starY };
    } else if (parentStar) {
      starPos = { x: parentStar.x, y: parentStar.y };
    }

    // If base has orbital parameters, compute current position
    if (starPos && object.orbitRadius && object.orbitSpeed) {
      // Use same calculation as planets/asteroids
      const elapsedSeconds = orbitTime / 1000;
      const currentAngle = object.orbitAngle + (object.orbitSpeed * elapsedSeconds);
      return {
        x: starPos.x + Math.cos(currentAngle) * object.orbitRadius,
        y: starPos.y + Math.sin(currentAngle) * object.orbitRadius
      };
    }

    // Static base in binary system - compute offset from moving star
    if (starPos && object.starX !== undefined) {
      // Base was generated with offset from star's initial position
      // Compute current position based on star's current position
      const offsetX = object.x - object.starX;
      const offsetY = object.y - object.starY;
      return {
        x: starPos.x + offsetX,
        y: starPos.y + offsetY
      };
    }

    return { x: object.x, y: object.y };
  }

  return { x: object.x, y: object.y };
}

/**
 * Find a safe spawn location away from stars
 * @param {number} preferX - Preferred X coordinate
 * @param {number} preferY - Preferred Y coordinate
 * @param {number} searchRadius - Radius to search for safe spots
 * @returns {{x: number, y: number}} Safe spawn position
 */
function findSafeSpawnLocation(preferX = 0, preferY = 0, searchRadius = 3000) {
  const minDistFromStar = config.STAR_SIZE_MAX * 2; // Stay 2x max star size away

  // Try the preferred location first
  if (isLocationSafe(preferX, preferY, minDistFromStar)) {
    return { x: preferX, y: preferY };
  }

  // Search in expanding rings
  for (let radius = 500; radius <= searchRadius; radius += 500) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const testX = preferX + Math.cos(angle) * radius;
      const testY = preferY + Math.sin(angle) * radius;

      if (isLocationSafe(testX, testY, minDistFromStar)) {
        return { x: testX, y: testY };
      }
    }
  }

  // Fallback: find a deep space location (sector far from any system)
  // Try sectors in a spiral pattern
  for (let i = 1; i <= 10; i++) {
    const sectorX = i * 2;
    const sectorY = i * 2;
    const testX = sectorX * config.SECTOR_SIZE + config.SECTOR_SIZE / 2;
    const testY = sectorY * config.SECTOR_SIZE + config.SECTOR_SIZE / 2;

    if (isLocationSafe(testX, testY, minDistFromStar)) {
      return { x: testX, y: testY };
    }
  }

  // Ultimate fallback - return (5000, 5000) which is likely in deep space
  return { x: 5000, y: 5000 };
}

/**
 * Find a spawn location in deep space, far from any star systems.
 * Searches super-sector boundaries where stars are least likely to exist.
 * Used for new player spawns to avoid the gravity trap problem.
 * @returns {{x: number, y: number}} Deep space spawn position
 */
function findDeepSpaceSpawnLocation() {
  const superSectorSize = config.SUPER_SECTOR_SIZE || 6000;
  const sectorSize = config.SECTOR_SIZE || 1000;
  const minDistFromStar = (config.STAR_SIZE_MAX || 800) * 3; // Stay 3x max star size away

  // Strategy: Search at super-sector boundaries (edges between super-sectors)
  // where stars are least likely to exist. Stars spawn near super-sector centers.
  // Search in expanding rings from origin, checking boundary positions.
  for (let ring = 1; ring <= 15; ring++) {
    // Calculate positions at the edges/corners of super-sectors
    // These are the midpoints between super-sector centers
    const boundaryOffset = superSectorSize * 0.5; // Halfway between super-sector centers

    const positions = [
      // Cardinal directions (between super-sectors)
      { x: ring * superSectorSize + boundaryOffset, y: boundaryOffset },
      { x: -ring * superSectorSize - boundaryOffset, y: boundaryOffset },
      { x: boundaryOffset, y: ring * superSectorSize + boundaryOffset },
      { x: boundaryOffset, y: -ring * superSectorSize - boundaryOffset },
      // Diagonal corners (maximum distance from any star center)
      { x: ring * superSectorSize + boundaryOffset, y: ring * superSectorSize + boundaryOffset },
      { x: -ring * superSectorSize - boundaryOffset, y: -ring * superSectorSize - boundaryOffset },
      { x: ring * superSectorSize + boundaryOffset, y: -ring * superSectorSize - boundaryOffset },
      { x: -ring * superSectorSize - boundaryOffset, y: ring * superSectorSize + boundaryOffset }
    ];

    // Shuffle positions to add variety
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (const pos of positions) {
      // Check if this location is truly safe (far from all stars)
      if (isLocationSafe(pos.x, pos.y, minDistFromStar)) {
        // Double-check by scanning a wider area for any nearby stars
        const wideScan = isLocationSafe(pos.x, pos.y, minDistFromStar * 1.5);
        if (wideScan) {
          return { x: Math.round(pos.x), y: Math.round(pos.y) };
        }
      }
    }
  }

  // Fallback to original method if deep space search fails
  return findSafeSpawnLocation(0, 0, 10000);
}

/**
 * Check if a location is safe (not too close to any star)
 */
function isLocationSafe(x, y, minDistFromStar) {
  const sectorX = Math.floor(x / config.SECTOR_SIZE);
  const sectorY = Math.floor(y / config.SECTOR_SIZE);

  // Check 3x3 sectors around the position
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const sector = generateSector(sectorX + dx, sectorY + dy);

      for (const star of sector.stars) {
        const dist = Math.sqrt((x - star.x) ** 2 + (y - star.y) ** 2);
        if (dist < minDistFromStar) {
          return false;
        }
      }
    }
  }

  return true;
}

// Find the nearest wormhole to a given position
// Searches sectors in expanding rings up to maxSectorRadius
function findNearestWormhole(playerX, playerY, maxSectorRadius = 100) {
  const playerSectorX = Math.floor(playerX / config.SECTOR_SIZE);
  const playerSectorY = Math.floor(playerY / config.SECTOR_SIZE);

  let nearestWormhole = null;
  let nearestDistance = Infinity;

  // Search in expanding rings of sectors
  for (let radius = 0; radius <= maxSectorRadius; radius++) {
    // If we found a wormhole in a previous ring, and we've completed a full ring
    // beyond it, we can stop (no closer wormhole can exist)
    if (nearestWormhole && radius > 0) {
      const minPossibleDistance = (radius - 1) * config.SECTOR_SIZE;
      if (minPossibleDistance > nearestDistance) {
        break;
      }
    }

    // Check all sectors at this ring distance
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Only check sectors on the edge of the ring (skip interior, already checked)
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        const sectorX = playerSectorX + dx;
        const sectorY = playerSectorY + dy;
        const sector = generateSector(sectorX, sectorY);

        for (const wormhole of sector.wormholes) {
          const distance = Math.sqrt(
            (wormhole.x - playerX) ** 2 +
            (wormhole.y - playerY) ** 2
          );

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestWormhole = {
              x: wormhole.x,
              y: wormhole.y,
              id: wormhole.id,
              distance: distance
            };
          }
        }
      }
    }
  }

  return nearestWormhole;
}

module.exports = {
  generateSector,
  getObjectById,
  getObjectPosition,
  isObjectDepleted,
  depleteObject,
  findSafeSpawnLocation,
  findDeepSpaceSpawnLocation,
  isLocationSafe,
  findNearestWormhole
};
