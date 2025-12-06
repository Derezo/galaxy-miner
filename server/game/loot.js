// Galaxy Miner - Loot System (Server-side)

const config = require('../config');

// Active wreckage in the world: wreckageId -> wreckageData
const activeWreckage = new Map();
let wreckageIdCounter = 0;

// Loot drop rates by NPC tier (based on creditReward ranges)
const DROP_RATES = {
  // Low tier (credits < 50)
  low: {
    credits: 1.0,      // Always drop credits
    resource: 0.8,     // 80% chance
    buff: 0.05,        // 5% chance
    component: 0.01,   // 1% chance
    relic: 0.005       // 0.5% chance
  },
  // Mid tier (credits 50-150)
  mid: {
    credits: 1.0,
    resource: 0.9,
    buff: 0.15,
    component: 0.05,
    relic: 0.02
  },
  // High tier (credits 150-400)
  high: {
    credits: 1.0,
    resource: 1.0,
    buff: 0.25,
    component: 0.10,
    relic: 0.05
  },
  // Boss tier (credits > 400)
  boss: {
    credits: 1.0,
    resource: 1.0,
    buff: 0.5,
    component: 0.30,
    relic: 0.15
  }
};

// Buff pool for random selection
const BUFF_POOL = ['SHIELD_BOOST', 'SPEED_BURST', 'DAMAGE_AMP', 'RADAR_PULSE'];

// Component pool for random selection
const COMPONENT_POOL = ['ENGINE_CORE', 'WEAPON_MATRIX', 'SHIELD_CELL', 'MINING_CAPACITOR'];

// Relic pool by faction
const RELIC_POOLS = {
  pirate: ['PIRATE_TREASURE'],
  scavenger: ['PIRATE_TREASURE', 'ANCIENT_STAR_MAP'],
  swarm: ['SWARM_HIVE_CORE'],
  void: ['VOID_CRYSTAL', 'ANCIENT_STAR_MAP'],
  rogue_miner: ['ANCIENT_STAR_MAP', 'PIRATE_TREASURE']
};

function getTierFromCredits(creditReward) {
  if (creditReward > 400) return 'boss';
  if (creditReward > 150) return 'high';
  if (creditReward > 50) return 'mid';
  return 'low';
}

function generateLootContents(npc) {
  const tier = getTierFromCredits(npc.creditReward);
  const rates = DROP_RATES[tier];
  const contents = [];

  // Credits (always)
  if (Math.random() < rates.credits) {
    contents.push({
      type: 'credits',
      amount: npc.creditReward
    });
  }

  // Resources from NPC's loot table
  if (Math.random() < rates.resource && npc.lootTable && npc.lootTable.length > 0) {
    const numDrops = Math.floor(Math.random() * 3) + 1; // 1-3 resource types
    for (let i = 0; i < numDrops; i++) {
      const resourceType = npc.lootTable[Math.floor(Math.random() * npc.lootTable.length)];
      const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 of each
      contents.push({
        type: 'resource',
        resourceType,
        quantity
      });
    }
  }

  // Buff (temporary power-up)
  if (Math.random() < rates.buff) {
    const buffType = BUFF_POOL[Math.floor(Math.random() * BUFF_POOL.length)];
    contents.push({
      type: 'buff',
      buffType
    });
  }

  // Component (for advanced upgrades)
  if (Math.random() < rates.component) {
    const componentType = COMPONENT_POOL[Math.floor(Math.random() * COMPONENT_POOL.length)];
    contents.push({
      type: 'component',
      componentType
    });
  }

  // Relic (collectible)
  if (Math.random() < rates.relic) {
    const factionRelics = RELIC_POOLS[npc.faction] || ['ANCIENT_STAR_MAP'];
    const relicType = factionRelics[Math.floor(Math.random() * factionRelics.length)];
    contents.push({
      type: 'relic',
      relicType
    });
  }

  return contents;
}

function spawnWreckage(npc, position) {
  const wreckageId = `wreckage_${++wreckageIdCounter}`;
  const contents = generateLootContents(npc);

  const wreckage = {
    id: wreckageId,
    position: { x: position.x, y: position.y },
    faction: npc.faction,
    npcType: npc.type,
    npcName: npc.name,
    contents,
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
    // Collection complete
    const contents = wreckage.contents;
    removeWreckage(wreckageId);
    return { complete: true, contents };
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
