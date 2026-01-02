// Galaxy Miner - Derelict System (Server-side)
// Handles ancient derelict ships in The Graveyard zone

const config = require('../config');
const logger = require('../../shared/logger');
const { isGraveyardSector: isGraveyardSectorFn } = require('../../shared/graveyard');

// Wrapper for consistent API
function isGraveyardSector(sectorX, sectorY) {
  return isGraveyardSectorFn(sectorX, sectorY, config);
}

// Track salvage cooldowns: derelictId -> cooldownExpiry timestamp
const salvageCooldowns = new Map();

// Cache generated derelicts per sector: sectorKey -> [derelicts]
const derelictCache = new Map();
const MAX_CACHED_SECTORS = 50;

// Seeded random number generator - Mulberry32 (deterministic)
function seededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash function for deterministic sector seeding
function hash(seed, x, y, extra = '') {
  let h = 0;
  const str = `${seed}_derelict_${x}_${y}_${extra}`;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

/**
 * Generate derelicts for a Graveyard sector
 * Uses deterministic seeded random for consistent placement
 * @param {number} sectorX - Sector X coordinate
 * @param {number} sectorY - Sector Y coordinate
 * @returns {Array} Array of derelict objects
 */
function generateDerelictsForSector(sectorX, sectorY) {
  // Only generate for Graveyard sectors
  if (!isGraveyardSector(sectorX, sectorY)) {
    return [];
  }

  const cacheKey = `${sectorX}_${sectorY}`;

  // Check cache first
  if (derelictCache.has(cacheKey)) {
    return derelictCache.get(cacheKey);
  }

  const derelictConfig = config.DERELICT_CONFIG;
  if (!derelictConfig) {
    logger.warn('[DERELICT] DERELICT_CONFIG not found in config');
    return [];
  }

  const graveyardConfig = config.GRAVEYARD_ZONE;
  const rng = seededRandom(hash(config.GALAXY_SEED, sectorX, sectorY));

  // Determine number of derelicts for this sector
  const minDerelicts = graveyardConfig.DERELICTS_PER_SECTOR_MIN || 4;
  const maxDerelicts = graveyardConfig.DERELICTS_PER_SECTOR_MAX || 6;
  const derelictCount = minDerelicts + Math.floor(rng() * (maxDerelicts - minDerelicts + 1));

  const derelicts = [];
  const sectorSize = config.SECTOR_SIZE || 1000;
  const sectorMinX = sectorX * sectorSize;
  const sectorMinY = sectorY * sectorSize;

  // Track placed positions to avoid overlap
  const placedPositions = [];

  for (let i = 0; i < derelictCount; i++) {
    // Generate deterministic derelict properties
    const size = derelictConfig.SIZE_MIN + rng() * (derelictConfig.SIZE_MAX - derelictConfig.SIZE_MIN);

    // Place derelict with margin from sector edges and other derelicts
    let x, y, placed = false;
    const margin = size * 0.6; // Allow some overlap visually

    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      x = sectorMinX + margin + rng() * (sectorSize - margin * 2);
      y = sectorMinY + margin + rng() * (sectorSize - margin * 2);

      // Check distance from other placed derelicts
      let tooClose = false;
      for (const pos of placedPositions) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (size + pos.size) * 0.4;
        if (dist < minDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        placed = true;
      }
    }

    if (!placed) {
      // Fallback: place anyway (sector might be tight)
      x = sectorMinX + margin + rng() * (sectorSize - margin * 2);
      y = sectorMinY + margin + rng() * (sectorSize - margin * 2);
    }

    // Generate rotation (radians) for visual variety
    const rotation = rng() * Math.PI * 2;

    // Generate ship "type" for visual variety (1-5)
    const shipType = Math.floor(rng() * 5) + 1;

    const derelict = {
      id: `derelict_${sectorX}_${sectorY}_${i}`,
      x,
      y,
      size,
      rotation,
      shipType,
      sectorX,
      sectorY,
      // Orbiting debris count for client visuals
      orbitingDebrisCount: derelictConfig.ORBITING_DEBRIS_MIN +
        Math.floor(rng() * (derelictConfig.ORBITING_DEBRIS_MAX - derelictConfig.ORBITING_DEBRIS_MIN + 1))
    };

    derelicts.push(derelict);
    placedPositions.push({ x, y, size });
  }

  // Cache management
  if (derelictCache.size >= MAX_CACHED_SECTORS) {
    const firstKey = derelictCache.keys().next().value;
    derelictCache.delete(firstKey);
  }
  derelictCache.set(cacheKey, derelicts);

  return derelicts;
}

/**
 * Get a specific derelict by ID
 * @param {string} derelictId - Derelict ID (format: derelict_sectorX_sectorY_index)
 * @returns {Object|null} Derelict object or null if not found
 */
function getDerelictById(derelictId) {
  // Parse derelict ID to get sector coordinates
  const parts = derelictId.split('_');
  if (parts.length !== 4 || parts[0] !== 'derelict') {
    return null;
  }

  const sectorX = parseInt(parts[1]);
  const sectorY = parseInt(parts[2]);
  const index = parseInt(parts[3]);

  if (isNaN(sectorX) || isNaN(sectorY) || isNaN(index) || index < 0) {
    return null;
  }

  const derelicts = generateDerelictsForSector(sectorX, sectorY);
  return derelicts.find(d => d.id === derelictId) || null;
}

/**
 * Get derelicts in range of a position
 * @param {Object} position - { x, y } world position
 * @param {number} range - Maximum distance to search
 * @returns {Array} Array of derelicts with distance added
 */
function getDerelictsInRange(position, range) {
  const sectorSize = config.SECTOR_SIZE || 1000;
  const sectorX = Math.floor(position.x / sectorSize);
  const sectorY = Math.floor(position.y / sectorSize);

  const result = [];

  // Check current sector and neighbors (3x3 grid)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const derelicts = generateDerelictsForSector(sectorX + dx, sectorY + dy);

      for (const derelict of derelicts) {
        const ddx = derelict.x - position.x;
        const ddy = derelict.y - position.y;
        const distance = Math.sqrt(ddx * ddx + ddy * ddy);

        if (distance <= range) {
          result.push({
            ...derelict,
            distance,
            onCooldown: isOnCooldown(derelict.id),
            cooldownRemaining: getCooldownRemaining(derelict.id)
          });
        }
      }
    }
  }

  return result.sort((a, b) => a.distance - b.distance);
}

/**
 * Check if a derelict is on salvage cooldown
 * @param {string} derelictId - Derelict ID
 * @returns {boolean} True if on cooldown
 */
function isOnCooldown(derelictId) {
  const expiry = salvageCooldowns.get(derelictId);
  if (!expiry) return false;

  if (Date.now() >= expiry) {
    salvageCooldowns.delete(derelictId);
    return false;
  }

  return true;
}

/**
 * Get remaining cooldown time for a derelict
 * @param {string} derelictId - Derelict ID
 * @returns {number} Milliseconds remaining, or 0 if not on cooldown
 */
function getCooldownRemaining(derelictId) {
  const expiry = salvageCooldowns.get(derelictId);
  if (!expiry) return 0;

  const remaining = expiry - Date.now();
  if (remaining <= 0) {
    salvageCooldowns.delete(derelictId);
    return 0;
  }

  return remaining;
}

/**
 * Set a salvage cooldown on a derelict
 * @param {string} derelictId - Derelict ID
 */
function setSalvageCooldown(derelictId) {
  const cooldownMs = config.DERELICT_CONFIG?.SALVAGE_COOLDOWN || 30000;
  salvageCooldowns.set(derelictId, Date.now() + cooldownMs);
}

/**
 * Attempt to salvage a derelict
 * Returns loot contents based on DERELICT_CONFIG.LOOT_TABLE
 * @param {string} derelictId - Derelict ID
 * @param {Object} playerPosition - Player's position { x, y }
 * @returns {Object} Result { success, error?, loot?, wreckagePositions? }
 */
function salvageDerelict(derelictId, playerPosition) {
  const derelict = getDerelictById(derelictId);

  if (!derelict) {
    return { success: false, error: 'Derelict not found' };
  }

  // Check interaction range
  const interactionRange = config.DERELICT_CONFIG?.INTERACTION_RANGE || 100;
  const dx = derelict.x - playerPosition.x;
  const dy = derelict.y - playerPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Account for derelict size (player needs to be within range of the edge)
  const effectiveDistance = distance - (derelict.size / 2);

  if (effectiveDistance > interactionRange) {
    return { success: false, error: 'Too far from derelict' };
  }

  // Check cooldown
  if (isOnCooldown(derelictId)) {
    const remaining = getCooldownRemaining(derelictId);
    return {
      success: false,
      error: 'Derelict on cooldown',
      cooldownRemaining: remaining
    };
  }

  // Set cooldown
  setSalvageCooldown(derelictId);

  // Generate loot and wreckage positions
  const loot = generateDerelictLoot();
  const wreckagePositions = generateWreckagePositions(derelict);

  return {
    success: true,
    derelict,
    loot,
    wreckagePositions
  };
}

/**
 * Generate loot contents from a derelict based on LOOT_TABLE
 * NOTE: Uses Math.random() intentionally - each salvage generates fresh loot
 * (unlike derelict placement which is deterministic per-sector)
 * @returns {Array} Array of loot items
 */
function generateDerelictLoot() {
  const lootTable = config.DERELICT_CONFIG?.LOOT_TABLE;
  if (!lootTable) {
    logger.warn('[DERELICT] LOOT_TABLE not found in DERELICT_CONFIG');
    return [];
  }

  const loot = [];
  const resourceTypes = config.RESOURCE_TYPES || {};

  // Common resources (70% chance, 2-5 qty)
  if (Math.random() < lootTable.COMMON_CHANCE) {
    const commonResources = Object.keys(resourceTypes).filter(
      key => resourceTypes[key].rarity === 'common'
    );
    if (commonResources.length > 0) {
      const resourceType = commonResources[Math.floor(Math.random() * commonResources.length)];
      const quantity = lootTable.COMMON_QTY_MIN +
        Math.floor(Math.random() * (lootTable.COMMON_QTY_MAX - lootTable.COMMON_QTY_MIN + 1));
      loot.push({
        type: 'resource',
        resourceType,
        quantity,
        rarity: 'common'
      });
    }
  }

  // Uncommon resources (25% chance, 1-2 qty)
  if (Math.random() < lootTable.UNCOMMON_CHANCE) {
    const uncommonResources = Object.keys(resourceTypes).filter(
      key => resourceTypes[key].rarity === 'uncommon'
    );
    if (uncommonResources.length > 0) {
      const resourceType = uncommonResources[Math.floor(Math.random() * uncommonResources.length)];
      const quantity = lootTable.UNCOMMON_QTY_MIN +
        Math.floor(Math.random() * (lootTable.UNCOMMON_QTY_MAX - lootTable.UNCOMMON_QTY_MIN + 1));
      loot.push({
        type: 'resource',
        resourceType,
        quantity,
        rarity: 'uncommon'
      });
    }
  }

  // Credits (50% chance, 10-30)
  if (Math.random() < lootTable.CREDITS_CHANCE) {
    const amount = lootTable.CREDITS_MIN +
      Math.floor(Math.random() * (lootTable.CREDITS_MAX - lootTable.CREDITS_MIN + 1));
    loot.push({
      type: 'credits',
      amount
    });
  }

  // Rare resources (5% chance, 1 qty)
  if (Math.random() < lootTable.RARE_CHANCE) {
    const rareResources = Object.keys(resourceTypes).filter(
      key => resourceTypes[key].rarity === 'rare'
    );
    if (rareResources.length > 0) {
      const resourceType = rareResources[Math.floor(Math.random() * rareResources.length)];
      const quantity = lootTable.RARE_QTY || 1;
      loot.push({
        type: 'resource',
        resourceType,
        quantity,
        rarity: 'rare'
      });
    }
  }

  return loot;
}

/**
 * Generate positions for wreckage spawning around a derelict
 * @param {Object} derelict - Derelict object
 * @returns {Array} Array of { x, y } positions
 */
function generateWreckagePositions(derelict) {
  const derelictConfig = config.DERELICT_CONFIG;
  const minSpawn = derelictConfig?.WRECKAGE_SPAWN_MIN || 1;
  const maxSpawn = derelictConfig?.WRECKAGE_SPAWN_MAX || 3;
  const minDist = derelictConfig?.WRECKAGE_SPAWN_RADIUS_MIN || 50;
  const maxDist = derelictConfig?.WRECKAGE_SPAWN_RADIUS_MAX || 100;

  const count = minSpawn + Math.floor(Math.random() * (maxSpawn - minSpawn + 1));
  const positions = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDist + Math.random() * (maxDist - minDist);

    positions.push({
      x: derelict.x + Math.cos(angle) * distance,
      y: derelict.y + Math.sin(angle) * distance
    });
  }

  return positions;
}

/**
 * Clean up expired cooldowns periodically
 */
function cleanupExpiredCooldowns() {
  const now = Date.now();
  for (const [derelictId, expiry] of salvageCooldowns) {
    if (now >= expiry) {
      salvageCooldowns.delete(derelictId);
    }
  }
}

// Clean up cooldowns every minute
setInterval(cleanupExpiredCooldowns, 60000);

module.exports = {
  generateDerelictsForSector,
  getDerelictById,
  getDerelictsInRange,
  isOnCooldown,
  getCooldownRemaining,
  setSalvageCooldown,
  salvageDerelict,
  generateDerelictLoot,
  generateWreckagePositions,
  isGraveyardSector,
  cleanupExpiredCooldowns,
  // Exposed for testing
  salvageCooldowns,
  derelictCache
};
