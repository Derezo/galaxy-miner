// Galaxy Miner - Loot System (Server-side)

const config = require('../config');
const LootPools = require('./loot-pools.js');

// Active wreckage in the world: wreckageId -> wreckageData
const activeWreckage = new Map();
// A player may own one collection session at a time. A Scrap Siphon session
// contains several wreckage IDs, while an ordinary session contains one.
const activeCollectionsByPlayer = new Map();
let wreckageIdCounter = 0;
const COLLECTION_LOCK_GRACE_MS = 5000;

function normalizePlayerId(playerId) {
  const numericId = Number(playerId);
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
}

function normalizeCreditAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  const normalized = Math.floor(numericValue);
  return Number.isSafeInteger(normalized) ? normalized : 0;
}

function getContentsCreditReward(contents) {
  if (!Array.isArray(contents)) return 0;
  return contents.reduce((total, item) => {
    if (item?.type !== 'credits') return total;
    const amount = normalizeCreditAmount(item.amount);
    return Number.isSafeInteger(total + amount) ? total + amount : total;
  }, 0);
}

function calculateCollectionTime(wreckage) {
  let totalTime = 0;
  const contents = Array.isArray(wreckage.contents) ? wreckage.contents : [];

  for (const item of contents) {
    if (!item || typeof item.type !== 'string') {
      totalTime += 1000;
      continue;
    }
    const lootType = config.LOOT_TYPES[item.type.toUpperCase()];
    totalTime += lootType ? lootType.collectTime : 1000;
  }

  const minTime = wreckage.source === 'derelict' ? 3000 : 500;
  return Math.max(totalTime, minTime);
}

function hasPendingCredits(wreckage) {
  return Array.isArray(wreckage.pendingCredits) && wreckage.pendingCredits.some(
    reward => normalizePlayerId(reward?.playerId) && normalizeCreditAmount(reward?.credits) > 0
  );
}

function releaseCollectionLock(wreckage) {
  if (!wreckage) return false;

  const playerId = normalizePlayerId(wreckage.beingCollectedBy);
  wreckage.beingCollectedBy = null;
  wreckage.collectionProgress = 0;
  wreckage.collectionStartTime = null;
  wreckage.totalCollectionTime = null;

  if (playerId) {
    const session = activeCollectionsByPlayer.get(playerId);
    if (session) {
      session.wreckageIds.delete(wreckage.id);
      if (session.wreckageIds.size === 0) {
        activeCollectionsByPlayer.delete(playerId);
      }
    }
  }

  return true;
}

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

/**
 * Spawn wreckage at a position with optional contents
 * @param {Object} entity - The entity that died (NPC, base, or player data)
 * @param {Object} position - { x, y } position to spawn wreckage
 * @param {Array|null} providedContents - Optional pre-defined loot contents
 * @param {Map|Object|null} damageContributors - Who contributed damage for team rewards
 * @param {Object|null} options - Additional options { source: 'npc'|'base'|'player' }
 * @returns {Object} The spawned wreckage object
 */
function spawnWreckage(entity, position, providedContents = null, damageContributors = null, options = {}) {
  const wreckageId = `wreckage_${++wreckageIdCounter}`;
  // Use provided contents (e.g., from base destruction) or generate from NPC
  const contents = providedContents || generateLootContents(entity);

  // Convert Map to plain object for storage (if provided)
  let contributors = null;
  if (damageContributors instanceof Map) {
    contributors = Object.fromEntries(damageContributors);
  } else if (damageContributors && typeof damageContributors === 'object') {
    contributors = damageContributors;
  }

  // Determine source type (player, npc, or base)
  const source = options.source || (entity.type === 'base' ? 'base' : 'npc');

  const wreckage = {
    id: wreckageId,
    position: { x: position.x, y: position.y },
    size: source === 'base' ? 40 : (source === 'player' ? 25 : 20), // Vary size by source
    source, // 'player', 'npc', or 'base' - used by Scavengers to identify wreckage
    faction: entity.faction || null,
    npcType: entity.type,
    npcName: entity.name,
    playerId: options.playerId || null, // Track player ID if player wreckage
    creditReward: entity.creditReward || 0, // Store credit reward for team distribution
    contents,
    damageContributors: contributors, // Track who contributed damage for team rewards
    spawnTime: Date.now(),
    despawnTime: Date.now() + config.WRECKAGE_DESPAWN_TIME,
    beingCollectedBy: null,
    collectionProgress: 0,
    collectionStartTime: null,
    totalCollectionTime: null,
    pendingCredits: []
  };

  activeWreckage.set(wreckageId, wreckage);
  return wreckage;
}

function getWreckage(wreckageId) {
  return activeWreckage.get(wreckageId);
}

function removeWreckage(wreckageId) {
  const wreckage = activeWreckage.get(wreckageId);
  if (wreckage?.beingCollectedBy) releaseCollectionLock(wreckage);
  return activeWreckage.delete(wreckageId);
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
  const numericPlayerId = normalizePlayerId(playerId);
  if (!numericPlayerId || typeof wreckageId !== 'string' || wreckageId.length === 0) {
    return { error: 'Invalid collection request' };
  }

  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage) return null;
  if (activeCollectionsByPlayer.has(numericPlayerId)) {
    return { error: 'You are already collecting wreckage' };
  }
  // A lock is exclusive even when the duplicate request comes from the same
  // player. This prevents duplicate socket events from creating parallel timers.
  if (wreckage.beingCollectedBy) {
    return { error: 'Wreckage is already being collected' };
  }

  wreckage.beingCollectedBy = numericPlayerId;
  wreckage.collectionStartTime = Date.now();
  wreckage.collectionProgress = 0;
  wreckage.totalCollectionTime = calculateCollectionTime(wreckage);

  activeCollectionsByPlayer.set(numericPlayerId, {
    mode: 'single',
    wreckageIds: new Set([wreckageId])
  });

  return { success: true, totalTime: wreckage.totalCollectionTime };
}

/**
 * Atomically reserve a bounded group of wreckage for Scrap Siphon. The relic's
 * speed value is a duration multiplier (0.5 means twice as fast), not a fixed
 * 500ms collection time. Parallel beams complete when the slowest target does.
 */
function startMultiCollection(wreckageIds, playerId, options = {}) {
  const numericPlayerId = normalizePlayerId(playerId);
  const configuredMaxCount = Math.max(1, Math.floor(Number(
    config.RELIC_TYPES?.SCRAP_SIPHON?.effects?.multiWreckageCount
  ) || 1));
  const requestedMaxCount = Math.max(1, Math.floor(Number(options.maxCount) || 1));
  const maxCount = Math.min(configuredMaxCount, requestedMaxCount);
  const durationMultiplier = Number(options.durationMultiplier);
  const speedMultiplier = Number.isFinite(durationMultiplier) && durationMultiplier > 0
    ? durationMultiplier
    : 1;
  const uniqueIds = [...new Set(Array.isArray(wreckageIds) ? wreckageIds : [])];

  if (!numericPlayerId || uniqueIds.length === 0 || uniqueIds.length > maxCount ||
      uniqueIds.some(id => typeof id !== 'string' || id.length === 0)) {
    return { error: 'Invalid multi-collection request' };
  }
  if (activeCollectionsByPlayer.has(numericPlayerId)) {
    return { error: 'You are already collecting wreckage' };
  }

  const wreckages = uniqueIds.map(id => activeWreckage.get(id));
  if (wreckages.some(wreckage => !wreckage)) {
    return { error: 'Wreckage not found' };
  }
  if (wreckages.some(wreckage => wreckage.beingCollectedBy)) {
    return { error: 'Some wreckage is already being collected' };
  }

  const baseTotalTime = Math.max(...wreckages.map(calculateCollectionTime));
  const totalTime = Math.max(1, Math.ceil(baseTotalTime * speedMultiplier));
  const startTime = Date.now();

  for (const wreckage of wreckages) {
    wreckage.beingCollectedBy = numericPlayerId;
    wreckage.collectionStartTime = startTime;
    wreckage.collectionProgress = 0;
    wreckage.totalCollectionTime = totalTime;
  }
  activeCollectionsByPlayer.set(numericPlayerId, {
    mode: 'multi',
    wreckageIds: new Set(uniqueIds)
  });

  return { success: true, wreckageIds: uniqueIds, totalTime };
}

function updateCollection(wreckageId, playerId) {
  const numericPlayerId = normalizePlayerId(playerId);
  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage) return null;
  if (!numericPlayerId || wreckage.beingCollectedBy !== numericPlayerId ||
      !Number.isFinite(wreckage.collectionStartTime) ||
      !Number.isFinite(wreckage.totalCollectionTime)) return null;

  // Never trust a caller-provided delta. Progress is derived exclusively from
  // the server clock so packet/timer spam cannot accelerate collection.
  wreckage.collectionProgress = Math.max(0, Date.now() - wreckage.collectionStartTime);

  if (wreckage.collectionProgress >= wreckage.totalCollectionTime) {
    // Settlement is deliberately two-phase. Keep the wreckage locked and alive
    // until durable reward writes have succeeded and finalizeCollection records
    // any cargo overflow or rejected reward.
    return {
      complete: true,
      contents: wreckage.contents || [],
      creditReward: getContentsCreditReward(wreckage.contents) ||
        normalizeCreditAmount(wreckage.creditReward),
      damageContributors: wreckage.damageContributors || null,
      pendingCredits: Array.isArray(wreckage.pendingCredits) ? wreckage.pendingCredits : []
    };
  }

  return {
    complete: false,
    progress: wreckage.collectionProgress / wreckage.totalCollectionTime
  };
}

function cancelCollection(wreckageId, playerId) {
  const numericPlayerId = normalizePlayerId(playerId);
  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage || !numericPlayerId || wreckage.beingCollectedBy !== numericPlayerId) {
    return false;
  }
  return releaseCollectionLock(wreckage);
}

function cancelCollectionsForPlayer(playerId) {
  const numericPlayerId = normalizePlayerId(playerId);
  if (!numericPlayerId) return 0;

  let cancelled = 0;
  // Scan the source of truth as well as the session map. This also repairs any
  // stale lock left behind by an interrupted older server version.
  for (const wreckage of activeWreckage.values()) {
    if (wreckage.beingCollectedBy === numericPlayerId) {
      releaseCollectionLock(wreckage);
      cancelled++;
    }
  }
  activeCollectionsByPlayer.delete(numericPlayerId);
  return cancelled;
}

/**
 * Finish the two-phase claim after reward persistence. Unawarded contents and
 * exact pending credit shares remain claimable; an empty wreckage is removed.
 */
function finalizeCollection(wreckageId, playerId, settlement = {}) {
  const numericPlayerId = normalizePlayerId(playerId);
  const wreckage = activeWreckage.get(wreckageId);
  if (!wreckage || !numericPlayerId || wreckage.beingCollectedBy !== numericPlayerId) {
    return { success: false, error: 'Collection is no longer active' };
  }

  const remainingContents = Array.isArray(settlement.remainingContents)
    ? settlement.remainingContents.filter(Boolean)
    : [];
  const pendingCredits = Array.isArray(settlement.pendingCredits)
    ? settlement.pendingCredits.filter(reward =>
      normalizePlayerId(reward?.playerId) && normalizeCreditAmount(reward?.credits) > 0)
    : [];

  wreckage.contents = remainingContents;
  wreckage.creditReward = 0;
  wreckage.pendingCredits = pendingCredits.map(reward => ({
    playerId: normalizePlayerId(reward.playerId),
    credits: normalizeCreditAmount(reward.credits)
  }));

  releaseCollectionLock(wreckage);

  if (wreckage.contents.length === 0 && !hasPendingCredits(wreckage)) {
    activeWreckage.delete(wreckageId);
    return { success: true, removed: true, remaining: false };
  }

  // Remaining value gets a fresh despawn window so cargo overflow is not lost
  // at the same instant a completed collection releases its lock.
  wreckage.despawnTime = Math.max(
    Number(wreckage.despawnTime) || 0,
    Date.now() + config.WRECKAGE_DESPAWN_TIME
  );
  return { success: true, removed: false, remaining: true };
}

function cleanupExpiredWreckage(onExpired = null) {
  const now = Date.now();
  const expired = [];

  for (const [id, wreckage] of activeWreckage) {
    if (wreckage.beingCollectedBy) {
      if (!Number.isFinite(wreckage.collectionStartTime)) {
        releaseCollectionLock(wreckage);
      } else {
        const lockDeadline = wreckage.collectionStartTime +
          (Number(wreckage.totalCollectionTime) || 0) + COLLECTION_LOCK_GRACE_MS;
        if (now >= lockDeadline) releaseCollectionLock(wreckage);
      }
    }

    if (now >= wreckage.despawnTime && !wreckage.beingCollectedBy) {
      expired.push(id);
    }
  }

  for (const id of expired) {
    const wreckage = activeWreckage.get(id);
    activeWreckage.delete(id);
    if (wreckage && typeof onExpired === 'function') {
      onExpired(wreckage);
    }
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
  activeCollectionsByPlayer,
  generateLootContents,
  spawnWreckage,
  getWreckage,
  removeWreckage,
  getWreckageInRange,
  startCollection,
  startMultiCollection,
  updateCollection,
  cancelCollection,
  cancelCollectionsForPlayer,
  finalizeCollection,
  cleanupExpiredWreckage,
  getActiveWreckageForSector,
  calculateCollectionTime
};
