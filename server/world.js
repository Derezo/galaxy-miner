// Galaxy Miner - Server-side World Generation
// Mirrors client-side generation for validation

const config = require('./config');
const { statements } = require('./database');
const Physics = require('../shared/physics');

// Cache generated sectors
const sectorCache = new Map();
const MAX_CACHED_SECTORS = 100;

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
  const spawnHubTypes = Object.values(config.SPAWN_HUB_TYPES || {});
  for (const hubType of spawnHubTypes) {
    if (!hubType.spawnChance) continue;

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

function getObjectById(objectId) {
  // Parse object ID to get sector and type
  const parts = objectId.split('_');
  if (parts.length < 4) {
    console.log('[World] Invalid objectId format:', objectId, 'parts:', parts);
    return null;
  }

  const sectorX = parseInt(parts[0]);
  const sectorY = parseInt(parts[1]);
  const type = parts[2];

  const sector = generateSector(sectorX, sectorY);

  // Find object
  let result = null;
  if (type === 'asteroid') {
    result = sector.asteroids.find(a => a.id === objectId);
    if (!result) {
      console.log('[World] Asteroid not found:', objectId);
      console.log('[World] Available asteroids:', sector.asteroids.map(a => a.id));
    }
  } else if (type === 'planet') {
    result = sector.planets.find(p => p.id === objectId);
    if (!result) {
      console.log('[World] Planet not found:', objectId);
      console.log('[World] Available planets:', sector.planets.map(p => p.id));
    }
  } else if (type === 'star') {
    result = sector.stars.find(s => s.id === objectId);
  } else if (type === 'wormhole') {
    result = sector.wormholes.find(w => w.id === objectId);
  } else if (type === 'base') {
    result = sector.bases.find(b => b.id === objectId);
  }

  return result;
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

  // Parse object type from ID
  const parts = objectId.split('_');
  const type = parts[2];

  // Stars and wormholes don't move
  if (type === 'star' || type === 'wormhole') {
    return { x: object.x, y: object.y };
  }

  // Get sector for stars lookup
  const sectorX = parseInt(parts[0]);
  const sectorY = parseInt(parts[1]);
  const sector = generateSector(sectorX, sectorY);

  // Planets orbit their stars
  if (type === 'planet') {
    const star = sector.stars.find(s => s.id === object.starId);
    if (star && object.orbitSpeed) {
      return Physics.computePlanetPosition(object, star, time);
    }
    return { x: object.x, y: object.y };
  }

  // Asteroids move with physics
  if (type === 'asteroid') {
    if (object.initialX !== undefined) {
      const state = Physics.getAsteroidPosition(object, sector.stars, time);
      return { x: state.x, y: state.y, state: state.state };
    }
    return { x: object.x, y: object.y };
  }

  return { x: object.x, y: object.y };
}

module.exports = {
  generateSector,
  getObjectById,
  getObjectPosition,
  isObjectDepleted,
  depleteObject
};
