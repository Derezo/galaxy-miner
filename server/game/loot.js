// Galaxy Miner - Loot System (Server-side)

const config = require('../config');
const LootPools = require('./loot-pools.js');

// Active wreckage in the world: wreckageId -> wreckageData
const activeWreckage = new Map();
let wreckageIdCounter = 0;

/**
 * Generate loot contents for an NPC using the centralized loot pool system.
 * Uses Map-based deduplication to prevent duplicate resource entries.
 * @param {Object} npc - The NPC object with type, faction, and creditReward
 * @returns {Array} Array of loot items (resources, buffs, components, relics)
 */
function generateLootContents(npc) {
  // Use centralized loot pool system for resource/buff/component/relic generation
  const contents = LootPools.generateLoot(npc.type);

  // Add credits if valid (loot pools handle resources, this handles credits)
  const creditReward = npc.creditReward;
  if (typeof creditReward === 'number' && creditReward > 0 && !Number.isNaN(creditReward)) {
    contents.unshift({
      type: 'credits',
      amount: creditReward
    });
  }

  return contents;
}

function spawnWreckage(npc, position, providedContents = null, damageContributors = null) {
  const wreckageId = `wreckage_${++wreckageIdCounter}`;
  // Use provided contents (e.g., from base destruction) or generate from NPC
  const contents = providedContents || generateLootContents(npc);

  // Convert Map to plain object for storage (if provided)
  let contributors = null;
  if (damageContributors instanceof Map) {
    contributors = Object.fromEntries(damageContributors);
  } else if (damageContributors && typeof damageContributors === 'object') {
    contributors = damageContributors;
  }

  const wreckage = {
    id: wreckageId,
    position: { x: position.x, y: position.y },
    size: 20, // Standard wreckage size for range calculations
    faction: npc.faction,
    npcType: npc.type,
    npcName: npc.name,
    creditReward: npc.creditReward || 0, // Store credit reward for team distribution
    contents,
    damageContributors: contributors, // Track who contributed damage for team rewards
    spawnTime: Date.now(),
    despawnTime: Date.now() + config.WRECKAGE_DESPAWN_TIME,
    beingCollectedBy: null,
    collectionProgress: 0,
    collectionStartTime: null
  };

  activeWreckage.set(wreckageId, wreckage);
  return wreckage;
}

function getWreckage(wreckageId) {
  return activeWreckage.get(wreckageId);
}

function removeWreckage(wreckageId) {
  activeWreckage.delete(wreckageId);
}

function getWreckageInRange(position, range) {
  const result = [];
  for (const [id, wreckage] of activeWreckage) {
    const dx = wreckage.position.x - position.x;
    const dy = wreckage.position.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= range) {
      result.push({ ...wreckage, distance: dist });
    }
  }
  return result;
}

function startCollection(wreckageId, playerId) {
  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage) return null;
  if (wreckage.beingCollectedBy && wreckage.beingCollectedBy !== playerId) {
    return { error: 'Already being collected by another player' };
  }

  wreckage.beingCollectedBy = playerId;
  wreckage.collectionStartTime = Date.now();
  wreckage.collectionProgress = 0;

  // Calculate total collection time based on contents
  let totalTime = 0;
  for (const item of wreckage.contents) {
    const lootType = config.LOOT_TYPES[item.type.toUpperCase()];
    if (lootType) {
      totalTime += lootType.collectTime;
    } else {
      totalTime += 1000; // Default 1 second
    }
  }
  wreckage.totalCollectionTime = totalTime;

  return { success: true, totalTime };
}

function updateCollection(wreckageId, playerId, deltaTime) {
  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage) return null;
  if (wreckage.beingCollectedBy !== playerId) return null;

  wreckage.collectionProgress += deltaTime;

  if (wreckage.collectionProgress >= wreckage.totalCollectionTime) {
    // Collection complete - include wreckage metadata for team distribution
    const result = {
      complete: true,
      contents: wreckage.contents,
      creditReward: wreckage.creditReward || 0,
      damageContributors: wreckage.damageContributors || null
    };
    removeWreckage(wreckageId);
    return result;
  }

  return {
    complete: false,
    progress: wreckage.collectionProgress / wreckage.totalCollectionTime
  };
}

function cancelCollection(wreckageId, playerId) {
  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage) return;
  if (wreckage.beingCollectedBy === playerId) {
    wreckage.beingCollectedBy = null;
    wreckage.collectionProgress = 0;
    wreckage.collectionStartTime = null;
  }
}

function cleanupExpiredWreckage() {
  const now = Date.now();
  const expired = [];

  for (const [id, wreckage] of activeWreckage) {
    if (now >= wreckage.despawnTime) {
      expired.push(id);
    }
  }

  for (const id of expired) {
    activeWreckage.delete(id);
  }

  return expired;
}

function getActiveWreckageForSector(sectorX, sectorY) {
  const result = [];
  const sectorSize = config.SECTOR_SIZE;

  for (const [id, wreckage] of activeWreckage) {
    const wx = Math.floor(wreckage.position.x / sectorSize);
    const wy = Math.floor(wreckage.position.y / sectorSize);

    // Include wreckage in this sector or adjacent sectors
    if (Math.abs(wx - sectorX) <= 1 && Math.abs(wy - sectorY) <= 1) {
      result.push(wreckage);
    }
  }

  return result;
}

module.exports = {
  activeWreckage,
  generateLootContents,
  spawnWreckage,
  getWreckage,
  removeWreckage,
  getWreckageInRange,
  startCollection,
  updateCollection,
  cancelCollection,
  cleanupExpiredWreckage,
  getActiveWreckageForSector
};
