// Galaxy Miner - Game Engine (Server-side tick loop)

const config = require('../config');
const npc = require('./npc');
const combat = require('./combat');
const mining = require('./mining');
const loot = require('./loot');
const wormhole = require('./wormhole');
const world = require('../world');
const starDamage = require('./star-damage');
const { statements } = require('../database');
const {
  playerHasRelic,
  calculateFactionDamage
} = require('./relic-effects');
const { createNpcDelta } = require('./npc-delta');
const { getNpcDamageMultiplier } = require('./npc-combat-modifiers');
const {
  getNpcCandidateRange,
  getNpcDeliveryRange,
  getNpcEngagementRange
} = require('./npc-visibility');
const {
  createNpcSpawnPayload,
  createRogueMinerRageEvent,
  createConsumedNpcDestroyedPayload,
  createVoidMinionRiftPositions
} = require('./npc-event-payloads');
const logger = require('../../shared/logger');
const Physics = require('../../shared/physics');
const { getRadarRange } = require('../../shared/utils');
const SpatialHash = require('./spatial-hash');
const aiSystem = require('./ai');
const { getSwarmStrategy, getFormationStrategy } = aiSystem;
// Keep engine-focused test doubles and older embedders compatible; production
// AI exports the explicit retention contract.
const getPlayerTargetRetentionRange =
  typeof aiSystem.getPlayerTargetRetentionRange === 'function'
    ? aiSystem.getPlayerTargetRetentionRange
    : () => 0;
const clearRetainedPlayerTarget =
  typeof aiSystem.clearRetainedPlayerTarget === 'function'
    ? aiSystem.clearRetainedPlayerTarget
    : () => false;
const pruneMissingPlayerTargetState =
  typeof aiSystem.pruneMissingPlayerTargetState === 'function'
    ? aiSystem.pruneMissingPlayerTargetState
    : () => 0;

// Shared with the normal faction dispatcher so collective Swarm state is not
// discarded and no support-strategy objects are allocated in the tick loop.
const swarmSupportAI = getSwarmStrategy();
const voidFormationAI = getFormationStrategy();

let io = null;
let connectedPlayers = null;
let running = false;
let lastTickTime = Date.now();

// Socket module reference for broadcasts (set by server.js)
let socketModule = null;

// Swarm assimilation throttling
let lastQueenAuraBroadcast = 0;
const QUEEN_AURA_BROADCAST_INTERVAL = 1000; // 1 second

// Track which bases are currently active
const lastBaseCheck = new Map(); // baseId -> lastCheckTime

// Track void NPCs scheduled for rift respawn (prevent duplicate timers)
const scheduledRiftRespawns = new Set(); // npcId -> scheduled

// Per-player NPC update batches - accumulated during tick, flushed at end
const npcBatches = new Map(); // socketId -> [npcUpdateData, ...]

// Spatial hash for player positions - used by broadcast functions to avoid O(players) scans
const playerSpatialHash = new SpatialHash(500); // 500 unit cells

// Delta compression: track last NPC state sent to each player
const playerLastSeen = new Map(); // socketId -> Map<npcId, { x, y, rotation, state, hull, shield, tick }>
let lastRetainedCleanupPlayerSignature = null;

// Full refresh interval (every 100 ticks = 5 seconds at 20 ticks/sec)
const FULL_REFRESH_INTERVAL = 100;
let currentTick = 0;

// ============================================
// PLAYER DEBUFF SYSTEM
// Tracks active debuffs (slows, DoTs) on players
// ============================================
const activeDebuffs = new Map(); // playerId -> { slow: {}, dot: [] }

/**
 * Apply a debuff to a player
 */
function applyDebuff(playerId, debuffType, data) {
  if (!activeDebuffs.has(playerId)) {
    activeDebuffs.set(playerId, { slow: null, dots: [] });
  }
  const debuffs = activeDebuffs.get(playerId);

  if (debuffType === 'slow') {
    debuffs.slow = {
      percent: data.slowPercent,
      expiresAt: Date.now() + data.duration,
      sourceId: data.sourceId
    };
  } else if (debuffType === 'dot') {
    debuffs.dots.push({
      damage: data.damage,
      interval: data.interval,
      expiresAt: Date.now() + data.duration,
      nextTick: Date.now() + data.interval,
      sourceId: data.sourceId,
      type: data.type || 'acid'
    });
  }
}

/**
 * Check if player has a specific debuff
 */
function hasDebuff(playerId, debuffType) {
  const debuffs = activeDebuffs.get(playerId);
  if (!debuffs) return false;

  if (debuffType === 'slow') {
    return debuffs.slow && debuffs.slow.expiresAt > Date.now();
  }
  return false;
}

/**
 * Get slow modifier for a player (1.0 = no slow, 0.4 = 60% slow)
 */
function getSlowModifier(playerId) {
  const debuffs = activeDebuffs.get(playerId);
  if (!debuffs || !debuffs.slow || debuffs.slow.expiresAt <= Date.now()) {
    return 1.0;
  }
  const percent = Number(debuffs.slow.percent);
  if (!Number.isFinite(percent)) return 1.0;
  return 1.0 - Math.max(0, Math.min(0.9, percent));
}

function getPlayerDebuffSnapshot(playerId) {
  const debuffs = activeDebuffs.get(playerId);
  const now = Date.now();
  if (!debuffs?.slow || debuffs.slow.expiresAt <= now) return {};
  const percent = Number(debuffs.slow.percent);
  return {
    slow: {
      percent: Number.isFinite(percent) ? Math.max(0, Math.min(0.9, percent)) : 0,
      expiresAt: debuffs.slow.expiresAt
    }
  };
}

/**
 * Players choosing or traversing a wormhole are outside the simulated world
 * and therefore cannot be selected for, or receive, any damage source.
 */
function canPlayerTakeDamage(player) {
  const inTransit = player && typeof wormhole.isInTransit === 'function'
    ? wormhole.isInTransit(player.id)
    : false;
  return Boolean(player && !player.isDead && !inTransit);
}

/**
 * Process DoT ticks for a player, returns total damage dealt
 */
function processPlayerDoTs(playerId) {
  const debuffs = activeDebuffs.get(playerId);
  if (!debuffs || debuffs.dots.length === 0) return 0;

  const now = Date.now();
  let totalDamage = 0;

  // Process active DoTs
  debuffs.dots = debuffs.dots.filter(dot => {
    if (now >= dot.expiresAt) return false; // Expired

    if (now >= dot.nextTick) {
      totalDamage += dot.damage;
      dot.nextTick = now + dot.interval;
    }
    return true;
  });

  return totalDamage;
}

/**
 * Clean up expired debuffs for all players
 */
function cleanupExpiredDebuffs() {
  const now = Date.now();
  for (const [playerId, debuffs] of activeDebuffs) {
    // Clean up expired slow
    if (debuffs.slow && debuffs.slow.expiresAt <= now) {
      debuffs.slow = null;
    }
    // Clean up expired DoTs
    debuffs.dots = debuffs.dots.filter(dot => dot.expiresAt > now);
    // Remove entry if no active debuffs
    if (!debuffs.slow && debuffs.dots.length === 0) {
      activeDebuffs.delete(playerId);
    }
  }
}

/**
 * Handle player death with wreckage spawning
 * Spawns wreckage at death location containing 50% of dropped cargo (25% of original inventory)
 * Now emits respawn OPTIONS for player to choose from (deferred respawn)
 * @param {Object} player - The player object (from connectedPlayers)
 * @param {string} killedBy - Description of what killed the player
 * @param {string} socketId - The player's socket ID
 * @param {Object} killerInfo - Additional info about what killed the player
 * @param {string} killerInfo.cause - 'star' | 'npc' | 'player' | 'comet' | 'environment'
 * @param {string} killerInfo.type - 'player' | 'npc' | 'environment'
 * @param {string} killerInfo.name - Name of killer (NPC/player name)
 * @param {string} killerInfo.faction - Faction for NPCs (pirate, swarm, etc.)
 * @returns {Object} Death result for event emission
 */
function handlePlayerDeathWithWreckage(player, killedBy, socketId, killerInfo = {}) {
  // A lethal source can be followed by another queued hit in the same tick.
  // Claim the death synchronously before any database, loot, or socket work so
  // every other authority gate observes the player as dead immediately.
  if (!player || player.isDead) return null;

  // Get death position BEFORE any changes
  const deathPosition = { x: player.position.x, y: player.position.y };

  player.isDead = true;
  player.deathTime = Date.now();
  player.deathPosition = deathPosition;
  mining.cancelMining(player.id);
  socketModule?.setPlayerStatus?.(player.id, 'idle');
  if (typeof loot.cancelCollectionsForPlayer === 'function') {
    loot.cancelCollectionsForPlayer(player.id);
  }
  activeDebuffs.delete(player.id);
  wormhole.cleanupPlayer(player.id);

  let deathResult;
  try {
    // Cargo and marketplace escrow settle in one database transaction.
    deathResult = combat.handleDeath(player.id, deathPosition);
  } catch (error) {
    // The player must remain non-actionable even if persistence is temporarily
    // unavailable. The transaction guarantees that cargo was not half-settled.
    logger.error(`[DEATH] Failed to settle cargo for player ${player.id}:`, error);
    let inventory = null;
    try {
      inventory = statements.getInventory.all(player.id);
    } catch (snapshotError) {
      logger.error(`[DEATH] Failed to read inventory snapshot for player ${player.id}:`, snapshotError);
    }
    deathResult = {
      droppedCargo: [],
      wreckageContents: [],
      respawnOptions: {
        type: 'graveyard',
        message: 'Returning to The Graveyard...'
      },
      deathPosition,
      playerName: player.username || 'Unknown',
      marketplaceChanged: false,
      // Settlement failed atomically, so the persisted inventory is unchanged.
      // Include the best available authoritative snapshot rather than leaving
      // affordability UI on an unknowable pre/post-death state.
      inventory
    };
  }
  player.respawnOptions = deathResult.respawnOptions;
  let wreckageSpawned = false;

  // Spawn player wreckage if there's anything to drop
  if (deathResult.wreckageContents && deathResult.wreckageContents.length > 0) {
    const playerEntity = {
      type: 'player',
      name: deathResult.playerName || player.username || 'Unknown',
      faction: null,
      creditReward: 0
    };

    try {
      const wreckage = loot.spawnWreckage(
        playerEntity,
        deathPosition,
        deathResult.wreckageContents,
        null, // No damage contributors for player wreckage
        { source: 'player', playerId: player.id }
      );

      if (wreckage) {
        wreckageSpawned = true;
        // Broadcast wreckage spawn to nearby players
        broadcastWreckageNear(wreckage, 'wreckage:spawn', {
          id: wreckage.id,
          x: wreckage.position.x,
          y: wreckage.position.y,
          size: wreckage.size,
          source: wreckage.source,
          faction: null,
          npcType: 'player',
          npcName: wreckage.npcName,
          contents: wreckage.contents
        });

        logger.log(`[WRECKAGE] Player ${player.id} death spawned wreckage ${wreckage.id} with ${wreckage.contents.length} items`);
      }
    } catch (error) {
      logger.error(`[DEATH] Failed to spawn wreckage for player ${player.id}:`, error);
    }
  }

  // Emit death event with respawn OPTIONS (player chooses where to respawn)
  io.to(socketId).emit('player:death', {
    killedBy,
    // Enhanced killer info for better death messaging
    cause: killerInfo.cause || 'unknown',
    killerType: killerInfo.type || 'unknown',
    killerName: killerInfo.name || null,
    killerFaction: killerInfo.faction || null,
    starId: killerInfo.starId || null,
    // Death position for replay/visualization
    deathPosition,
    // Cargo lost info
    droppedCargo: deathResult.droppedCargo,
    // Remaining cargo is authoritative. droppedCargo can include marketplace
    // escrow and therefore cannot be subtracted safely on the client.
    inventory: deathResult.inventory,
    wreckageSpawned,
    // Respawn options for player to choose from
    respawnOptions: deathResult.respawnOptions
  });

  // The death screen is not an authoritative world observer. Retire every NPC
  // the socket had seen and discard any update queued earlier in this tick so
  // client dead reckoning cannot keep the last velocity moving indefinitely.
  retireNpcVisibilityForSocket(socketId);

  if (deathResult.marketplaceChanged) {
    io.emit('market:update', { action: 'death_settlement' });
  }

  return deathResult;
}

/**
 * Resolve one player hit from a Queen acid burst. Keeping this in one path
 * ensures lethal initial damage receives the same death/wreckage/action cleanup
 * as every other NPC kill, and never installs a DoT on an already-dead player.
 */
function applyQueenAcidBurstDamage(npcEntity, action, socketId, player) {
  if (!canPlayerTakeDamage(player)) return false;

  const initialDamage = {
    shieldDamage: action.damage * 0.5,
    hullDamage: action.damage * 0.5
  };
  const result = combat.applyDamage(player.id, initialDamage);
  if (!result) return false;

  player.hull = result.hull;
  player.shield = result.shield;

  io.to(socketId).emit('player:damaged', {
    attackerId: npcEntity.id,
    attackerType: 'npc',
    damage: action.damage,
    hull: result.hull,
    shield: result.shield,
    damageType: 'acid'
  });

  if (result.isDead) {
    handlePlayerDeathWithWreckage(player, npcEntity.name || 'Swarm Queen', socketId, {
      cause: 'npc',
      type: 'npc',
      name: npcEntity.name || 'Swarm Queen',
      faction: npcEntity.faction || 'swarm',
      npcType: npcEntity.type || 'swarm_queen'
    });
    return true;
  }

  applyDebuff(player.id, 'dot', {
    damage: action.dotDamage,
    interval: action.dotInterval || 1000,
    duration: action.dotDuration,
    sourceId: npcEntity.id,
    type: 'acid'
  });

  io.to(socketId).emit('player:debuff', {
    type: 'dot',
    dotType: 'acid',
    damage: action.dotDamage,
    duration: action.dotDuration,
    source: 'swarm_queen'
  });

  return true;
}

// NPC Accuracy System Configuration
// Makes NPC weapons dodgeable by adding miss chance based on distance and target movement
const NPC_ACCURACY = {
  // Base accuracy per faction (0-1, 1 = perfect aim)
  FACTION_BASE: {
    pirate: 0.65,      // Pirates are decent shots
    scavenger: 0.45,   // Scavengers have jury-rigged weapons
    swarm: 0.55,       // Swarm fires rapidly but less accurate
    void: 0.75,        // Void entities are precise
    rogue_miner: 0.50  // Miners aren't combat-focused
  },
  // Distance penalty: accuracy drops at longer range
  // At max range, accuracy is reduced by this multiplier
  RANGE_PENALTY_MAX: 0.4,  // Lose up to 40% accuracy at max range
  // Moving target penalty: fast targets are harder to hit
  // Velocity in units/sec that causes max penalty
  VELOCITY_THRESHOLD: 150,
  VELOCITY_PENALTY_MAX: 0.35  // Lose up to 35% accuracy vs fast targets
};

// Throttle base radar broadcasts (every 500ms)
let lastBaseBroadcastTime = 0;
const BASE_BROADCAST_INTERVAL = 500;
let lastBaseDiscoveryTime = 0;
const BASE_DISCOVERY_INTERVAL = 500;

// === ACTIVATION AND BROADCAST RANGES ===
// Max-tier broadcast range is twice the explicit shared radar-tier range.
// Base activation intentionally includes an additional loading margin, but
// that server-side margin must never be used as a client synchronization range.
const MAX_TIER_BROADCAST_RANGE = getRadarRange(config.MAX_TIER || 5) * 2;
// Add margin for sector boundary smoothing
const BASE_ACTIVATION_RANGE = Math.max(config.SECTOR_SIZE * 3, MAX_TIER_BROADCAST_RANGE + 500);

function getPlayerRadarRange(player) {
  const radarTier = Math.max(
    1,
    Math.min(config.MAX_TIER || 5, Math.floor(Number(player?.radarTier) || 1))
  );
  return getRadarRange(radarTier);
}

// Calculate broadcast range for a player based on their radar tier
function getPlayerBroadcastRange(player) {
  return getPlayerRadarRange(player) * 2;
}

function getPlayerBaseActivationRange(player) {
  const radarRange = getPlayerRadarRange(player);
  const ownsStarMap = Array.isArray(player?.relicTypes) &&
    player.relicTypes.includes('ANCIENT_STAR_MAP');
  const effects = config.RELIC_TYPES?.ANCIENT_STAR_MAP?.effects || {};
  const contactMultiplier = ownsStarMap
    ? Math.max(1, Number(effects.strategicContactRangeMultiplier) || 2)
    : 1;
  return Math.max(
    config.SECTOR_SIZE * 3,
    // Base populations must stay loaded everywhere their ordinary NPC updates
    // are deliverable, plus a margin that prevents boundary churn.
    getPlayerBroadcastRange(player) + 500,
    radarRange * contactMultiplier + 500
  );
}

/**
 * Keep NPC authority alive everywhere the player can legitimately receive or
 * engage that NPC. Base activation intentionally extends beyond ordinary radar,
 * so using a fixed +/-1 sector simulation window leaves live base populations
 * frozen while their last client velocity continues to render.
 */
function getNpcSimulationRange(npcEntity, player) {
  const targetRetentionRange = getPlayerTargetRetentionRange(npcEntity);
  return Math.max(
    getPlayerBaseActivationRange(player),
    getNpcDeliveryRange(
      npcEntity,
      player,
      getPlayerBroadcastRange(player),
      targetRetentionRange
    ),
    getNpcEngagementRange(npcEntity)
  );
}

function shouldSimulateNpc(npcEntity, players) {
  if (!npcEntity?.position || !Number.isFinite(npcEntity.position.x) ||
      !Number.isFinite(npcEntity.position.y)) {
    return false;
  }

  const retentionRange = getPlayerTargetRetentionRange(npcEntity);
  const retainedTargetId = retentionRange > 0 &&
    npcEntity.targetPlayer !== null && npcEntity.targetPlayer !== undefined
    ? String(npcEntity.targetPlayer)
    : null;

  return players.some(player => {
    // Run one authoritative cleanup tick even when a retained target has moved
    // beyond both its strategy limit and the normal simulation radius. The AI
    // filter will omit it and the owning strategy will clear its rage/raid map.
    if (retainedTargetId !== null && String(player?.id) === retainedTargetId) {
      return true;
    }
    const range = getNpcSimulationRange(npcEntity, player);
    const dx = player.position.x - npcEntity.position.x;
    const dy = player.position.y - npcEntity.position.y;
    return dx * dx + dy * dy <= range * range;
  });
}

/**
 * Strategy-retained aggression must not survive the loss of its authoritative
 * player. This runs even with no eligible players, when distance-based AI
 * simulation has no candidate that could otherwise clear the strategy maps.
 */
function clearMissingRetainedPlayerTargets(players) {
  const livePlayerIds = new Set();
  for (const player of players || []) {
    if (player?.id !== null && player?.id !== undefined) {
      livePlayerIds.add(String(player.id));
    }
  }

  // Dormant base populations retain their exact NPC objects and strategy maps
  // for later restoration. Include them so a reconnect cannot revive rage or
  // Pirate intel that was active before the base unloaded.
  const stateEntities = new Map(npc.activeNPCs || []);
  for (const base of npc.dormantBases?.values?.() || []) {
    if (!Array.isArray(base?.dormantNPCs)) continue;
    for (const npcEntity of base.dormantNPCs) {
      if (npcEntity?.id !== null && npcEntity?.id !== undefined &&
          !stateEntities.has(npcEntity.id)) {
        stateEntities.set(npcEntity.id, npcEntity);
      }
    }
  }

  let clearedCount = pruneMissingPlayerTargetState(
    livePlayerIds,
    stateEntities
  );
  for (const npcEntity of stateEntities.values()) {
    const targetId = npcEntity?.targetPlayer;
    if (targetId === null || targetId === undefined ||
        getPlayerTargetRetentionRange(npcEntity) <= 0 ||
        livePlayerIds.has(String(targetId))) {
      continue;
    }
    if (clearRetainedPlayerTarget(npcEntity)) clearedCount++;
  }
  return clearedCount;
}

function clearMissingRetainedPlayerTargetsIfChanged(players) {
  const livePlayerSignature = JSON.stringify(
    (players || [])
      .map(player => String(player?.id))
      .sort()
  );
  if (livePlayerSignature === lastRetainedCleanupPlayerSignature) return 0;

  lastRetainedCleanupPlayerSignature = livePlayerSignature;
  return clearMissingRetainedPlayerTargets(players);
}

function getActiveNpcById(npcId) {
  return npc.getNPC?.(npcId) || npc.activeNPCs?.get?.(npcId) || null;
}

function updateNpcVelocity(npcEntity, previousPosition, deltaTime) {
  npcEntity.velocity = npcEntity.velocity || { x: 0, y: 0 };
  const dtSec = deltaTime / 1000;
  if (dtSec > 0) {
    npcEntity.velocity.x = (npcEntity.position.x - previousPosition.x) / dtSec;
    npcEntity.velocity.y = (npcEntity.position.y - previousPosition.y) / dtSec;
  } else {
    npcEntity.velocity.x = 0;
    npcEntity.velocity.y = 0;
  }
  npcEntity._vx = npcEntity.velocity.x;
  npcEntity._vy = npcEntity.velocity.y;
  return npcEntity.velocity;
}

function tryBlockNpcDamage(npcEntity, attackerId) {
  if (npcEntity.type !== 'pirate_dreadnought' ||
      !npcEntity.invulnerableChance ||
      Math.random() >= npcEntity.invulnerableChance) {
    return null;
  }

  logger.log(`[PIRATE] Dreadnought ${npcEntity.id} invulnerable proc! Broadcasting to nearby players.`);
  broadcastNearNpc(npcEntity, 'npc:invulnerable', {
    npcId: npcEntity.id,
    x: npcEntity.position.x,
    y: npcEntity.position.y,
    attackerId
  });
  return { blocked: true, invulnerable: true, npcId: npcEntity.id };
}

function handleNpcFireAtNpc(attacker, target, action) {
  if (!attacker || !target || attacker.id === target.id || target.hull <= 0) {
    return null;
  }

  const dx = target.position.x - attacker.position.x;
  const dy = target.position.y - attacker.position.y;
  const distance = Math.hypot(dx, dy);
  const maxRange = Math.max(0, Number(attacker.weaponRange) || 0) * 1.1;
  if (!Number.isFinite(distance) || distance > maxRange) return null;

  const weaponType = action.weaponType || attacker.weaponType || 'kinetic';
  const weaponTier = action.weaponTier || attacker.weaponTier || 1;
  const configuredDamage = Number(action.baseDamage ?? attacker.weaponDamage);
  const calculatedDamage = combat.calculateDamage(weaponType, weaponTier, 1);
  const totalDamage = Number.isFinite(configuredDamage) && configuredDamage > 0
    ? configuredDamage
    : calculatedDamage.shieldDamage + calculatedDamage.hullDamage;
  const shieldPiercing = Math.max(
    0,
    Math.min(1, Number(action.shieldPiercing ?? attacker.shieldPiercing) || 0)
  );

  // Resolve the target's proc before advertising a hit. Otherwise an
  // invulnerable Dreadnought visibly takes damage from an NPC even though the
  // authoritative damage path rejects the shot.
  const blocked = tryBlockNpcDamage(target, attacker.id);

  broadcastNearNpc(attacker, 'combat:npcFire', {
    npcId: attacker.id,
    npcType: attacker.type,
    faction: attacker.faction,
    weaponType,
    sourceX: attacker.position.x,
    sourceY: attacker.position.y,
    targetX: target.position.x,
    targetY: target.position.y,
    targetNpcId: target.id,
    rotation: attacker.rotation,
    hitInfo: blocked ? null : {
      isShieldHit: target.shield > 0,
      damage: Math.round(totalDamage),
      shieldPiercing: shieldPiercing > 0
    }
  });

  if (blocked) return blocked;

  // Reuse the canonical NPC death/wreckage/formation path, but do not register
  // an NPC id as a player reward contributor.
  return playerAttackNPC(
    null,
    target.id,
    weaponType,
    weaponTier,
    totalDamage,
    {
      sourceNpcId: attacker.id,
      shieldPiercing,
      skipInvulnerabilityCheck: true
    }
  );
}

function isStrategicBoss(entity) {
  const type = String(entity?.type || '').toLowerCase();
  return entity?.isBoss === true || entity?.isQueen === true ||
    type === 'swarm_queen' || type === 'void_leviathan' ||
    type.includes('dreadnought') || type.includes('foreman') ||
    type.includes('barnacle_king');
}

function buildStrategicContacts(position, radarRange, strategicRange, maxContacts, bases, npcs) {
  const contacts = new Map();
  const add = (entity, contactType) => {
    const entityPosition = entity?.position || entity;
    const x = Number(entityPosition?.x);
    const y = Number(entityPosition?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const distance = Math.hypot(x - position.x, y - position.y);
    if (distance <= radarRange || distance > strategicRange) return;
    const id = String(entity.id || `${contactType}:${x}:${y}`);
    contacts.set(`${contactType}:${id}`, {
      id,
      x,
      y,
      faction: entity.faction || null,
      contactType,
      distance
    });
  };

  for (const base of bases || []) {
    if (base?.faction && !base.destroyed) add(base, 'base');
  }
  for (const entity of npcs || []) {
    if (isStrategicBoss(entity)) add(entity, 'boss');
  }

  return [...contacts.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, Math.floor(Number(maxContacts) || 8)))
    .map(({ distance, ...contact }) => contact);
}

function init(socketIo, players, sockModule) {
  io = socketIo;
  connectedPlayers = players;
  socketModule = sockModule;
  playerSpatialHash.rebuild(players || new Map());
  playerLastSeen.clear();
  npcBatches.clear();
  lastRetainedCleanupPlayerSignature = null;
}

function start() {
  if (running) return;
  running = true;
  lastTickTime = Date.now();
  tick();
  logger.log('Game engine started');

  // Cleanup swarm hives in exclusion zone on startup
  // (handles legacy hives that violate the new 10-sector exclusion)
  const removedHives = npc.cleanupExcludedSwarmHives();
  if (removedHives > 0) {
    logger.log(`[Engine] Startup cleanup: removed ${removedHives} swarm hive(s) from exclusion zone`);
  }
}

function stop() {
  running = false;
  logger.log('Game engine stopped');
}

function tick() {
  if (!running) return;

  currentTick++;

  const now = Date.now();
  const deltaTime = now - lastTickTime;
  lastTickTime = now;

  try {
    if (currentTick % FULL_REFRESH_INTERVAL === 0) {
      npc.cleanupFormations();
    }

    // Update all game systems
    updatePlayers(deltaTime);
    updateBases(deltaTime);  // Check for bases near players and spawn NPCs
    updateNPCs(deltaTime);
    updateMining(deltaTime);
    updateWreckage(deltaTime);
    updateStarDamage(deltaTime);  // Apply star heat damage
    updateComets(deltaTime);  // Comet hazard collision detection
    broadcastNearbyBasesToPlayers(now);  // Send base positions for radar
  } catch (err) {
    logger.error('[Engine] Tick error:', err);
  }

  // Schedule next tick (always, even on error)
  const tickInterval = 1000 / config.SERVER_TICK_RATE;
  const elapsed = Date.now() - now;
  const delay = Math.max(0, tickInterval - elapsed);
  setTimeout(tick, delay);
}

function updatePlayers(deltaTime) {
  if (!connectedPlayers) return;

  // Update shield recharge for all players
  for (const [socketId, player] of connectedPlayers) {
    if (!player || player.isDead) continue;

    const shieldUpdate = combat.updateShieldRecharge(player.id, deltaTime, player.energyCoreTier || 1);
    if (shieldUpdate) {
      player.shield = shieldUpdate.shield;
      // Notify player of shield update
      io.to(socketId).emit('player:health', {
        hull: player.hull,
        shield: player.shield
      });
    }

    if (!canPlayerTakeDamage(player)) continue;

    // Process DoT damage from debuffs (queen acid, etc.)
    const dotDamage = processPlayerDoTs(player.id);
    if (dotDamage > 0) {
      // Apply DoT damage (splits between shield/hull)
      const damageObj = { shieldDamage: dotDamage * 0.3, hullDamage: dotDamage * 0.7 };
      const result = combat.applyDamage(player.id, damageObj);

      if (result) {
        player.hull = result.hull;
        player.shield = result.shield;

        // Notify player of DoT tick
        io.to(socketId).emit('player:dot', {
          damage: dotDamage,
          hull: result.hull,
          shield: result.shield,
          type: 'acid'
        });

        // Handle death from DoT with wreckage spawning
        if (result.isDead) {
          handlePlayerDeathWithWreckage(player, 'Acid damage', socketId, {
            cause: 'environment',
            type: 'environment',
            name: 'Swarm Acid'
          });
        }
      }
    }
  }

  // Periodic cleanup of expired debuffs (every ~5 seconds)
  if (Math.random() < 0.01) {
    cleanupExpiredDebuffs();
  }
}

function updateBases(deltaTime) {
  if (!connectedPlayers) return;

  const players = [...connectedPlayers.values()].filter(player =>
    canPlayerTakeDamage(player) &&
    Number.isFinite(player.position?.x) && Number.isFinite(player.position?.y)
  );
  const now = Date.now();
  const BASE_DEACTIVATION_TIME = 60000; // 1 minute without nearby players
  const shouldDiscoverBases = now - lastBaseDiscoveryTime >= BASE_DISCOVERY_INTERVAL;
  if (shouldDiscoverBases) lastBaseDiscoveryTime = now;

  // Find all sectors with players and get bases from those sectors
  // Use Map to store sector coordinates directly, avoiding string parsing in loop
  const activeSectors = new Map();
  for (const player of shouldDiscoverBases ? players : []) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Discover every sector that can contain a base inside the authoritative
    // activation radius. This is intentionally independent of client viewport
    // size; high-tier radar and Ancient Star Map contacts extend much farther.
    const ACTIVE_SECTOR_RADIUS = Math.ceil(
      getPlayerBaseActivationRange(player) / config.SECTOR_SIZE
    );
    for (let dx = -ACTIVE_SECTOR_RADIUS; dx <= ACTIVE_SECTOR_RADIUS; dx++) {
      for (let dy = -ACTIVE_SECTOR_RADIUS; dy <= ACTIVE_SECTOR_RADIUS; dy++) {
        const sx = sectorX + dx;
        const sy = sectorY + dy;
        const key = `${sx}_${sy}`;
        if (!activeSectors.has(key)) {
          activeSectors.set(key, { x: sx, y: sy });
        }
      }
    }
  }

  // Check each active sector for bases
  for (const [sectorKey, coords] of activeSectors) {
    const sector = world.generateSector(coords.x, coords.y);

    if (!sector.bases || sector.bases.length === 0) continue;

    for (const base of sector.bases) {
      // Get computed position for orbital bases (critical for sync with NPC spawning)
      const computedPos = world.getObjectPosition(base.id);
      const baseX = computedPos ? computedPos.x : base.x;
      const baseY = computedPos ? computedPos.y : base.y;

      // Check if any player is within activation range
      let hasNearbyPlayer = false;
      const candidates = playerSpatialHash.query(
        baseX,
        baseY,
        BASE_ACTIVATION_RANGE
      );
      for (const socketId of candidates) {
        const player = connectedPlayers.get(socketId);
        if (!player || player.isDead || !player.position) continue;
        const dx = player.position.x - baseX;
        const dy = player.position.y - baseY;
        const playerActivationRange = getPlayerBaseActivationRange(player);
        if (dx * dx + dy * dy < playerActivationRange * playerActivationRange) {
          hasNearbyPlayer = true;
          break;
        }
      }

      if (hasNearbyPlayer) {
        // Activate base if not already active
        if (!npc.activeBases.has(base.id)) {
          npc.activateBase(base);

          // Broadcast initial NPC spawns from this base
          const activeBase = npc.getActiveBase(base.id);
          if (activeBase) {
            for (const npcId of activeBase.spawnedNPCs) {
              const npcEntity = npc.getNPC(npcId);
              if (npcEntity) {
                broadcastNearNpc(
                  npcEntity,
                  'npc:spawn',
                  createNpcSpawnPayload(npcEntity)
                );
              }
            }
          }
        }
        lastBaseCheck.set(base.id, now);
      }
    }
  }

  // Update base spawning for all active bases
  npc.updateBaseSpawning(players);

  // A base's sector drops out of activeSectors as soon as players travel away,
  // so stale checks must iterate the active registry rather than only sectors
  // visited this tick. Run after spawning bookkeeping so recent NPC deaths are
  // converted to pending timers before the population is unloaded.
  for (const [baseId, activeBase] of npc.activeBases) {
    if (activeBase.destroyed) continue;
    const lastNearbyAt = lastBaseCheck.get(baseId);
    if (lastNearbyAt && now - lastNearbyAt > BASE_DEACTIVATION_TIME) {
      npc.deactivateBase(baseId);
      lastBaseCheck.delete(baseId);
    }
  }

  // Check for newly spawned NPCs and broadcast them
  for (const [baseId, activeBase] of npc.activeBases) {
    // Check for pending Hauler spawn broadcasts (scavenger_yard specific)
    if (activeBase.pendingHaulerBroadcast) {
      const hauler = npc.getNPC(activeBase.pendingHaulerBroadcast.haulerId);
      if (hauler && now - activeBase.pendingHaulerBroadcast.timestamp < deltaTime * 2) {
        // Broadcast Hauler spawn event
        broadcastNearBase(activeBase, 'scavenger:haulerSpawn', {
          haulerId: hauler.id,
          type: hauler.type,
          name: hauler.name,
          faction: hauler.faction,
          x: hauler.position.x,
          y: hauler.position.y,
          rotation: hauler.rotation,
          hull: hauler.hull,
          hullMax: hauler.hullMax,
          shield: hauler.shield,
          shieldMax: hauler.shieldMax,
          sizeMultiplier: hauler.sizeMultiplier || 1.8,
          baseId: baseId,
          baseX: activeBase.x,
          baseY: activeBase.y
        });

        // Clear the pending broadcast
        delete activeBase.pendingHaulerBroadcast;
      } else if (now - activeBase.pendingHaulerBroadcast.timestamp >= deltaTime * 2) {
        // Cleanup old pending broadcasts
        delete activeBase.pendingHaulerBroadcast;
      }
    }

    for (const npcId of activeBase.spawnedNPCs) {
      const npcEntity = npc.getNPC(npcId);
      // Only broadcast NPCs that were just spawned (within last tick)
      if (npcEntity && now - activeBase.lastSpawnTime < deltaTime * 2) {
        broadcastNearNpc(
          npcEntity,
          'npc:spawn',
          createNpcSpawnPayload(npcEntity)
        );
      }
    }
  }

  // Check for destroyed bases that should respawn
  for (const [baseId, activeBase] of npc.activeBases) {
    if (activeBase.destroyed) {
      const respawned = npc.checkBaseRespawn(baseId);
      if (respawned) {
        // Get base data for broadcast
        const baseObj = world.getObjectById(baseId);
        if (baseObj) {
          // Get computed position for orbital bases
          const computedPos = world.getObjectPosition(baseId);
          const currentX = computedPos ? computedPos.x : baseObj.x;
          const currentY = computedPos ? computedPos.y : baseObj.y;

          // Broadcast base respawn to nearby players using computed position
          broadcastNearBase({ ...baseObj, x: currentX, y: currentY }, 'base:respawn', {
            id: baseId,
            x: currentX,
            y: currentY,
            size: baseObj.size,
            type: baseObj.type,
            faction: baseObj.faction,
            name: baseObj.name,
            health: activeBase.health,
            maxHealth: activeBase.maxHealth,
            // Include orbital parameters so client can track position
            isOrbital: !!(baseObj.orbitRadius && baseObj.orbitSpeed),
            orbitRadius: baseObj.orbitRadius,
            orbitSpeed: baseObj.orbitSpeed,
            orbitAngle: baseObj.orbitAngle,
            starX: baseObj.starX,
            starY: baseObj.starY
          });
        }
      }
    }
  }
}

function updateNPCs(deltaTime) {
  if (!connectedPlayers) return;

  // Get all player positions for NPC AI
  const players = [...connectedPlayers.values()].filter(player =>
    canPlayerTakeDamage(player) &&
    Number.isFinite(player.position?.x) && Number.isFinite(player.position?.y)
  );
  clearMissingRetainedPlayerTargetsIfChanged(players);
  if (players.length === 0) {
    // Visibility still has work to do when every connected player is dead or in
    // transit. In particular, retire their last velocity-bearing NPC snapshots.
    flushNpcBatches();
    return;
  }

  // Procedural sector NPCs are spawned only around the player's immediate
  // neighborhood. Simulation authority below is distance-based and wider so
  // already-active/base NPCs cannot freeze while still deliverable.
  const spawnSectors = new Map();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sx = sectorX + dx;
        const sy = sectorY + dy;
        const key = `${sx}_${sy}`;
        if (!spawnSectors.has(key)) {
          spawnSectors.set(key, { x: sx, y: sy });
        }
      }
    }
  }

  // Spawn NPCs in active sectors
  for (const [sectorKey, coords] of spawnSectors) {
    const spawned = npc.spawnNPCsForSector(coords.x, coords.y);

    // Notify nearby players of new NPCs
    for (const newNpc of spawned) {
      broadcastNearNpc(newNpc, 'npc:spawn', {
        id: newNpc.id,
        type: newNpc.type,
        name: newNpc.name,
        faction: newNpc.faction,
        x: newNpc.position.x,
        y: newNpc.position.y,
        rotation: newNpc.rotation,
        hull: newNpc.hull,
        hullMax: newNpc.hullMax,
        shield: newNpc.shield,
        shieldMax: newNpc.shieldMax
      });
    }
  }

  // Update all NPCs
  const npcsToRemove = [];  // Track NPCs to remove after iteration (for despawning)
  for (const [npcId, npcEntity] of npc.activeNPCs) {
    // Preserve the pre-anchor position so orbital base motion becomes canonical
    // NPC velocity, while evaluating visibility at the newly anchored position.
    const prevX = npcEntity.position.x;
    const prevY = npcEntity.position.y;
    if (npcEntity.attachedToBase) {
      // An attachment without a live or dormant authoritative base is invalid.
      // Retire it canonically instead of freezing a targetable worm forever.
      if (!npc.reanchorAttachedDrone(npcEntity)) {
        npcsToRemove.push(npcId);
        continue;
      }
    }

    if (!shouldSimulateNpc(npcEntity, players)) {
      // Clear canonical velocity when authority goes dormant. Visibility exit
      // reconciliation removes this entity from clients that just lost range;
      // retaining the last non-zero velocity would otherwise create a phantom.
      npcEntity.velocity = npcEntity.velocity || { x: 0, y: 0 };
      npcEntity.velocity.x = 0;
      npcEntity.velocity.y = 0;
      npcEntity._vx = 0;
      npcEntity._vy = 0;
      continue;
    }

    // ============================================
    // SWARM EGG HATCHING - Skip AI for eggs, only broadcast position
    // ============================================
    if (npc.isHatching(npcEntity)) {
      // Eggs are stationary - no AI, no movement, just update state if hatch completes
      const elapsed = Date.now() - npcEntity.hatchTime;
      if (elapsed >= npcEntity.hatchDuration) {
        // Hatching complete - transition to patrol state
        npcEntity.state = 'patrol';
        npcEntity.hatchTime = null; // Clear hatch time so isHatching returns false
      }
      // Eggs are stationary - zero velocity
      npcEntity.velocity = npcEntity.velocity || { x: 0, y: 0 };
      npcEntity.velocity.x = 0;
      npcEntity.velocity.y = 0;
      npcEntity._vx = 0;
      npcEntity._vy = 0;
      // Queue the NPC update for batched delivery (state will be 'hatching' until complete)
      queueNpcUpdate(npcEntity, {
        id: npcId,
        type: npcEntity.type,
        name: npcEntity.name,
        faction: npcEntity.faction,
        x: npcEntity.position.x,
        y: npcEntity.position.y,
        rotation: npcEntity.rotation,
        state: npcEntity.state,
        hull: npcEntity.hull,
        hullMax: npcEntity.hullMax,
        shield: npcEntity.shield,
        shieldMax: npcEntity.shieldMax,
        vx: 0,
        vy: 0
      });
      continue; // Skip all AI processing for hatching eggs
    }

    // Check for rage expiration (from queen death)
    if (npcEntity.rageExpires && Date.now() >= npcEntity.rageExpires) {
      // Rage has worn off - restore original stats
      if (npcEntity.originalAggroRange) {
        npcEntity.aggroRange = npcEntity.originalAggroRange;
        delete npcEntity.originalAggroRange;
      }
      if (npcEntity.originalSpeed) {
        npcEntity.speed = npcEntity.originalSpeed;
        delete npcEntity.originalSpeed;
      }
      if (npcEntity.state === 'rage') {
        npcEntity.state = 'patrol';
      }
      delete npcEntity.rageExpires;
    }

    // Get players in NPC's aggro range for AI (exclude dead players)
    const nearbyPlayers = [];
    const aggroRange = Math.max(0, Number(npcEntity.aggroRange) || 0);
    const aggroRangeSq = aggroRange * aggroRange;
    const playerCandidates = playerSpatialHash.query(
      npcEntity.position.x,
      npcEntity.position.y,
      aggroRange
    );
    for (const socketId of playerCandidates) {
      const candidate = connectedPlayers.get(socketId);
      if (!canPlayerTakeDamage(candidate) || !candidate.position) continue;
      const dx = candidate.position.x - npcEntity.position.x;
      const dy = candidate.position.y - npcEntity.position.y;
      if (dx * dx + dy * dy <= aggroRangeSq) nearbyPlayers.push(candidate);
    }

    // Passive factions can be hit from outside their normal detection radius.
    // Preserve an already-authoritative player target so the faction strategy
    // can pursue it until its own rage/raid retention limit is reached.
    includeRetainedNpcTargetPlayer(npcEntity, players, nearbyPlayers);

    // ============================================
    // SWARM DRONE ASSIMILATION - CHECK FIRST (priority over combat)
    // ============================================
    // Drones prioritize base assimilation over player combat when a base is nearby
    let useAssimilationBehavior = false;
    if (npcEntity.faction === 'swarm' && npcEntity.type === 'swarm_drone') {
      // Check for nearby enemy bases (uses SEARCH_RANGE from constants, default 2000)
      const targetBase = npc.findAssimilationTarget(npcEntity, config.SWARM_ASSIMILATION?.SEARCH_RANGE || 2000);

      if (targetBase) {
        // Calculate distance to base
        const dx = targetBase.x - npcEntity.position.x;
        const dy = targetBase.y - npcEntity.position.y;
        const distToBase = Math.sqrt(dx * dx + dy * dy);

        // Priority range: if base is within 800 units, prioritize assimilation over combat
        const ASSIMILATION_PRIORITY_RANGE = 800;

        if (distToBase <= ASSIMILATION_PRIORITY_RANGE || nearbyPlayers.length === 0) {
          // Use assimilation behavior - ignore players, focus on base
          useAssimilationBehavior = true;

          const assimAction = swarmSupportAI.updateAssimilateBehavior(
            npcEntity,
            targetBase,
            deltaTime
          );

          if (assimAction && assimAction.action === 'assimilate') {
            // Process the drone sacrifice
            logger.info(`[ASSIMILATE] Drone ${assimAction.droneId} attempting to assimilate base ${assimAction.baseId}`);
            const result = npc.attachDroneToBase(assimAction.droneId, assimAction.baseId);
            logger.info(`[ASSIMILATE] Result: success=${result?.success}, isComplete=${result?.isComplete}, hasConversion=${!!result?.conversion}`);

            if (result && socketModule) {
              // Broadcast sacrifice visual
              socketModule.broadcastDroneSacrifice({
                droneId: assimAction.droneId,
                baseId: assimAction.baseId,
                position: assimAction.position
              });

              // Broadcast progress update
              socketModule.broadcastAssimilationProgress({
                baseId: assimAction.baseId,
                progress: result.attachedCount,
                threshold: result.threshold,
                position: assimAction.position // For client visual effects
              });

              // If base was converted (check isComplete flag)
              logger.info(`[ASSIMILATE] Checking conversion: isComplete=${result.isComplete}, hasConversion=${!!result.conversion}`);
              if (result.isComplete && result.conversion) {
                logger.info(`[ASSIMILATE] Base converted! Broadcasting and checking queen spawn...`);
                broadcastBaseAssimilated({
                  baseId: assimAction.baseId,
                  newType: result.conversion.newType,
                  originalFaction: result.conversion.originalFaction,
                  convertedNpcs: result.conversion.convertedNpcs,
                  position: assimAction.position, // For client visual effects
                  consumedDroneIds: result.consumedDroneIds || [] // Drones consumed in conversion - client removes these
                });

                // Check for queen spawn - queen is now spawned directly in convertBaseToSwarm
                // We just need to broadcast if a queen was spawned
                if (result.conversion.spawnedQueen) {
                  const queen = result.conversion.spawnedQueen;
                  logger.info(`[ASSIMILATE] Broadcasting queen spawn: ${queen.id} at (${Math.round(queen.x)}, ${Math.round(queen.y)})`);
                  socketModule.broadcastQueenSpawn(queen);
                } else if (result.conversion.shouldSpawnQueen) {
                  // Fallback: if shouldSpawnQueen was true but no queen object, something went wrong
                  logger.error(`[ASSIMILATE] shouldSpawnQueen was true but no queen was spawned!`);
                }
              }

              // Drone was sacrificed - mark for removal
              if (result.droneSacrificed) {
                npcsToRemove.push(npcId);
                continue; // Skip rest of update for this NPC
              }
            }
          }
        }
      }
    }

    // Update NPC AI (skip for drones in assimilation mode)
    let action = null;
    if (!useAssimilationBehavior) {
      action = npc.updateNPC(npcEntity, nearbyPlayers, deltaTime);
    }

    // An emitted fire action and the NPC's retained target must agree before
    // recipient selection. Long-range targets therefore receive the attacker
    // update before its weapon event and damage notification.
    if (action?.action === 'fire' && action.target?.id !== undefined) {
      const targetNpc = getActiveNpcById(action.target.id);
      if (targetNpc && targetNpc.id !== npcEntity.id) {
        npcEntity.targetNPC = targetNpc.id;
        if (String(npcEntity.targetPlayer) === String(targetNpc.id)) {
          npcEntity.targetPlayer = null;
        }
      } else if (typeof action.target.id !== 'string') {
        npcEntity.targetPlayer = action.target.id;
        npcEntity.targetNPC = null;
      }
    }

    // Update NPC shield recharge
    npc.updateNPCShieldRecharge(npcEntity, deltaTime);

    // Check for queen guard mode for swarm NPCs
    const activeQueen = npc.getActiveQueen();
    if (activeQueen && !npcEntity.attachedToBase &&
        npcEntity.faction === 'swarm' && npcEntity.type !== 'swarm_queen') {
      if (swarmSupportAI.shouldGuardQueen(npcEntity, activeQueen)) {
        // Normalize queen position (handle both queen.position.x and queen.x formats)
        const queenX = activeQueen.position?.x ?? activeQueen.x;
        const queenY = activeQueen.position?.y ?? activeQueen.y;
        const guardRange = config.SWARM_QUEEN_SPAWN?.QUEEN_GUARD_RANGE ?? 500;

        // Get nearby guards for formation spacing
        const nearbyGuards = npc.getNPCsInRange(
          { x: queenX, y: queenY },
          guardRange
        ).filter(otherNpc =>
          otherNpc.id !== npcId &&
          otherNpc.faction === 'swarm' &&
          otherNpc.type !== 'swarm_queen' &&
          !otherNpc.attachedToBase
        );

        // Use queen guard AI instead of normal combat
        const guardAction = swarmSupportAI.updateQueenGuard(
          npcEntity,
          activeQueen,
          nearbyPlayers,
          nearbyGuards,
          deltaTime
        );

        // Override normal action with guard action
        if (guardAction) {
          action = guardAction;
        }
      }
    }

    // Check for Swarm Queen spawning
    if (npcEntity.spawnsUnits && npcEntity.type === 'swarm_queen') {
      const spawnResult = npc.updateSwarmQueenSpawning(npcEntity, nearbyPlayers, deltaTime);

      if (spawnResult && spawnResult.spawned && spawnResult.spawned.length > 0) {
        // Broadcast queen spawn event for visual effects
        broadcastNearNpc(npcEntity, 'npc:queenSpawn', {
          queenId: npcEntity.id,
          queenX: npcEntity.position.x,
          queenY: npcEntity.position.y,
          triggerType: spawnResult.type,
          threshold: spawnResult.threshold,
          spawned: spawnResult.spawned
        });

        // Also broadcast each minion as regular NPC spawns
        for (const minion of spawnResult.spawned) {
          broadcastNearNpc(npcEntity, 'npc:spawn', {
            id: minion.id,
            type: minion.type,
            name: minion.name,
            faction: minion.faction,
            x: minion.x,
            y: minion.y,
            rotation: minion.rotation,
            hull: minion.hull,
            hullMax: minion.hullMax,
            shield: minion.shield,
            shieldMax: minion.shieldMax
          });
        }
      }

      // Check for phase transition and broadcast
      if (npcEntity.phaseTransitionPending) {
        broadcastNearNpc(npcEntity, 'queen:phaseChange', {
          queenId: npcEntity.id,
          x: npcEntity.position.x,
          y: npcEntity.position.y,
          phase: npcEntity.phaseManager?.currentPhase || npcEntity.phaseTransitionPending.to,
          fromPhase: npcEntity.phaseTransitionPending.from
        });
        // Clear the pending flag
        npcEntity.phaseTransitionPending = null;
      }
    }

    // Pre-set miningTargetPos for startMining action BEFORE broadcast
    // This ensures the first npc:update with state='mining' includes the target position
    if (action && action.action === 'rogueMiner:startMining' && action.targetPos) {
      npcEntity.miningTargetPos = action.targetPos;
    }

    // Compute velocity from position delta for client-side dead reckoning
    // deltaTime is in ms; convert to seconds for units/sec velocity
    updateNpcVelocity(npcEntity, { x: prevX, y: prevY }, deltaTime);

    // Incrementally update this NPC's position in the spatial hash (no-op if same cell)
    npc.updateNPCInHash(npcId, npcEntity);

    // Broadcast NPC position update
    // Include name/type/faction so players who just entered range get full data
    const npcUpdateData = {
      id: npcId,
      type: npcEntity.type,
      name: npcEntity.name,
      faction: npcEntity.faction,
      x: npcEntity.position.x,
      y: npcEntity.position.y,
      rotation: npcEntity.rotation,
      state: npcEntity.state,
      hull: npcEntity.hull,
      hullMax: npcEntity.hullMax,
      shield: npcEntity.shield,
      shieldMax: npcEntity.shieldMax,
      isBoss: npcEntity.isBoss === true,
      sizeMultiplier: npcEntity.sizeMultiplier || 1,
      phase: npcEntity.phaseManager?.currentPhase || npcEntity.phase || null,
      vx: npcEntity.velocity.x,
      vy: npcEntity.velocity.y
    };

    // Include wreckage collection position for tractor beam animation
    if (npcEntity.collectingWreckagePos) {
      npcUpdateData.collectingWreckagePos = npcEntity.collectingWreckagePos;
    }

    // Include mining target position for rogue miner beam animation
    if (npcEntity.miningTargetPos) {
      npcUpdateData.miningTargetPos = npcEntity.miningTargetPos;
    }

    queueNpcUpdate(npcEntity, npcUpdateData);

    // Handle NPC actions
    if (action && action.action === 'fire') {
      const authoritativeNpcTarget = action.target?.id !== undefined
        ? getActiveNpcById(action.target.id)
        : null;
      if (authoritativeNpcTarget && authoritativeNpcTarget.id !== npcEntity.id) {
        handleNpcFireAtNpc(npcEntity, authoritativeNpcTarget, action);
        continue;
      }
      if (typeof action.target?.id === 'string') {
        // The NPC target was removed earlier in this tick; never reinterpret its
        // string id as a database-backed player id.
        continue;
      }

      // NPC fired at player - use proper damage calculation
      const targetPlayer = action.target;

      // CRITICAL: Skip if target player is already dead
      // Prevents looping death events from multiple NPCs hitting same dead player
      if (!canPlayerTakeDamage(targetPlayer)) {
        continue; // Skip to next NPC
      }

      // VALIDATION: Re-verify distance before applying damage
      // This prevents hits when player has moved out of range since AI check
      const actualDx = targetPlayer.position.x - npcEntity.position.x;
      const actualDy = targetPlayer.position.y - npcEntity.position.y;
      const actualDist = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

      // Allow slight tolerance (10%) to account for position updates during tick
      const maxRange = npcEntity.weaponRange * 1.1;
      if (actualDist > maxRange) {
        // Target moved out of range - skip damage but still show visual (miss)
        broadcastNearNpc(npcEntity, 'combat:npcFire', {
          npcId: npcId,
          npcType: npcEntity.type,
          faction: npcEntity.faction,
          weaponType: action.weaponType || 'kinetic',
          sourceX: npcEntity.position.x,
          sourceY: npcEntity.position.y,
          targetX: targetPlayer.position.x,
          targetY: targetPlayer.position.y,
          rotation: npcEntity.rotation,
          hitInfo: null // No hit - shot missed
        });
        continue; // Skip to next NPC
      }

      // ACCURACY CHECK: Calculate hit chance based on faction, distance, and target velocity
      const baseAccuracy = NPC_ACCURACY.FACTION_BASE[npcEntity.faction] || 0.6;

      // Distance penalty: accuracy drops at longer range (linear interpolation)
      const rangeRatio = actualDist / npcEntity.weaponRange;
      const rangePenalty = rangeRatio * NPC_ACCURACY.RANGE_PENALTY_MAX;

      // Velocity penalty: moving targets are harder to hit
      const targetVelocity = Math.sqrt(
        targetPlayer.velocity.x * targetPlayer.velocity.x +
        targetPlayer.velocity.y * targetPlayer.velocity.y
      );
      const velocityRatio = Math.min(1, targetVelocity / NPC_ACCURACY.VELOCITY_THRESHOLD);
      const velocityPenalty = velocityRatio * NPC_ACCURACY.VELOCITY_PENALTY_MAX;

      // Final accuracy (clamped to 15-95% to prevent guaranteed hits/misses)
      const finalAccuracy = Math.max(0.15, Math.min(0.95, baseAccuracy - rangePenalty - velocityPenalty));

      // Roll for hit
      if (Math.random() > finalAccuracy) {
        // MISS - show visual but no damage
        broadcastNearNpc(npcEntity, 'combat:npcFire', {
          npcId: npcId,
          npcType: npcEntity.type,
          faction: npcEntity.faction,
          weaponType: action.weaponType || 'kinetic',
          sourceX: npcEntity.position.x,
          sourceY: npcEntity.position.y,
          targetX: targetPlayer.position.x,
          targetY: targetPlayer.position.y,
          rotation: npcEntity.rotation,
          hitInfo: null // No hit - shot missed
        });
        continue; // Skip to next NPC
      }

      const damage = combat.calculateDamage(
        action.weaponType || 'kinetic',
        action.weaponTier || 1,
        1 // targetShieldTier (could be enhanced to use player shield tier)
      );

      // Scale by the NPC's configured damage and any finite phase modifier
      // supplied by boss AI (for example, the Swarm Queen phases).
      const damageMultiplier = getNpcDamageMultiplier(
        action.baseDamage,
        config.BASE_WEAPON_DAMAGE,
        action.damageMultiplier
      );
      damage.shieldDamage *= damageMultiplier;
      damage.hullDamage *= damageMultiplier;

      // Pre-calculate hit result for visual synchronization
      const previewShip = require('../database').statements.getShipByUserId.get(targetPlayer.id);
      const willHitShield = previewShip && previewShip.shield_hp > 0;

      // Get shield piercing amount for pirate weapons
      const shieldPiercing = npcEntity.shieldPiercing || 0;

      // Broadcast NPC weapon fire visual with hit info for proper timing
      broadcastNearNpc(npcEntity, 'combat:npcFire', {
        npcId: npcId,
        npcType: npcEntity.type,
        faction: npcEntity.faction,
        weaponType: action.weaponType || 'kinetic',
        sourceX: npcEntity.position.x,
        sourceY: npcEntity.position.y,
        targetX: targetPlayer.position.x,
        targetY: targetPlayer.position.y,
        rotation: npcEntity.rotation,
        // Include hit info for client-side hit effect timing
        hitInfo: {
          isShieldHit: willHitShield,
          damage: Math.round(damage.shieldDamage + damage.hullDamage),
          shieldPiercing: shieldPiercing > 0
        }
      });

      // Apply damage with shield piercing (pirate weapons bypass 10% of shields)
      const result = combat.applyDamage(targetPlayer.id, damage, action.weaponType || 'kinetic', shieldPiercing);

      if (result) {
        // Update player state on the ORIGINAL (not the copy from AI)
        // We'll update 'p' inside the loop when we find the matching player

        // Calculate total damage dealt for broadcasts
        const totalDamage = Math.round(damage.shieldDamage + damage.hullDamage);

        // Broadcast hit effect to nearby players (with shield pierce indicator)
        broadcastNearNpc(npcEntity, 'combat:hit', {
          attackerId: npcId,
          attackerType: 'npc',
          targetX: targetPlayer.position.x,
          targetY: targetPlayer.position.y,
          hitShield: result.hitShield,
          damage: totalDamage,
          weaponType: action.weaponType,
          shieldPierced: result.shieldPierced,
          piercingDamage: result.piercingDamage
        });

        // Find player socket and update ORIGINAL player state
        for (const [socketId, p] of connectedPlayers) {
          if (p.id === targetPlayer.id) {
            // Update hull/shield on the ORIGINAL player object
            p.hull = result.hull;
            p.shield = result.shield;

            io.to(socketId).emit('player:damaged', {
              attackerId: npcId,
              attackerType: 'npc',
              damage: totalDamage,
              hull: result.hull,
              shield: result.shield
            });

            if (result.isDead) {
              // Handle player death with wreckage spawning
              // CRITICAL: Pass 'p' (original from connectedPlayers), not 'targetPlayer' (copy from AI)
              // The AI creates copies with { ...player, distance }, so mutations on targetPlayer
              // don't affect the original. We need isDead=true set on the original.
              handlePlayerDeathWithWreckage(p, npcEntity.name, socketId, {
                cause: 'npc',
                type: 'npc',
                name: npcEntity.name,
                faction: npcEntity.faction,
                npcType: npcEntity.type
              });
            }
            break;
          }
        }
      }
    } else if (action && action.action === 'scavenger:drillCharge') {
      // The drill is lethal by design, so its wind-up must be visible to the
      // target and nearby observers rather than existing only in server AI.
      if (socketModule?.broadcastDrillCharge) {
        socketModule.broadcastDrillCharge(npcEntity, action);
      }
    } else if (action && action.action === 'web_snare') {
      // ============================================
      // QUEEN SPECIAL ATTACK: Web Snare
      // Slows players in area for duration
      // ============================================
      broadcastNearNpc(npcEntity, 'queen:webSnare', {
        npcId: npcId,
        sourceX: action.sourceX,
        sourceY: action.sourceY,
        targetX: action.targetX,
        targetY: action.targetY,
        radius: action.radius,
        duration: action.duration,
        chargeTime: action.chargeTime,
        projectileSpeed: action.projectileSpeed
      });

      // Apply slow debuff to all players in radius after projectile travel time
      const travelTime = Math.sqrt(
        Math.pow(action.targetX - action.sourceX, 2) +
        Math.pow(action.targetY - action.sourceY, 2)
      ) / (action.projectileSpeed || 200) * 1000;

      setTimeout(() => {
        for (const [socketId, player] of connectedPlayers) {
          if (!canPlayerTakeDamage(player) || !player.position) continue;
          const dx = player.position.x - action.targetX;
          const dy = player.position.y - action.targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= action.radius) {
            applyDebuff(player.id, 'slow', {
              slowPercent: action.slowPercent,
              duration: action.duration,
              sourceId: npcId
            });

            // Notify player of debuff
            io.to(socketId).emit('player:debuff', {
              type: 'slow',
              slowPercent: action.slowPercent,
              duration: action.duration,
              source: 'swarm_queen'
            });
          }
        }
      }, travelTime);

    } else if (action && action.action === 'acid_burst') {
      // ============================================
      // QUEEN SPECIAL ATTACK: Acid Burst
      // AoE damage with DoT effect
      // ============================================
      broadcastNearNpc(npcEntity, 'queen:acidBurst', {
        npcId: npcId,
        sourceX: action.sourceX,
        sourceY: action.sourceY,
        targetX: action.targetX,
        targetY: action.targetY,
        radius: action.radius,
        projectileSpeed: action.projectileSpeed,
        dotDuration: action.dotDuration
      });

      // Apply damage and DoT after projectile travel time
      const travelTime = Math.sqrt(
        Math.pow(action.targetX - action.sourceX, 2) +
        Math.pow(action.targetY - action.sourceY, 2)
      ) / (action.projectileSpeed || 200) * 1000;

      setTimeout(() => {
        for (const [socketId, player] of connectedPlayers) {
          if (!canPlayerTakeDamage(player) || !player.position) continue;
          const dx = player.position.x - action.targetX;
          const dy = player.position.y - action.targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= action.radius) {
            applyQueenAcidBurstDamage(npcEntity, action, socketId, player);
          }
        }
      }, travelTime);

    } else if (action && action.action === 'despawn') {
      // Handle orphaned NPC despawn (rage timer expired)
      // Broadcast death effect first
      broadcastNearNpc(npcEntity, 'npc:death', {
        npcId: npcId,
        x: npcEntity.position.x,
        y: npcEntity.position.y,
        faction: npcEntity.faction,
        deathType: 'despawn',
        reason: action.reason || 'rage_expired'
      });

      // Remove from activeNPCs (will be handled after loop to avoid modification during iteration)
      npcsToRemove.push(npcId);
    } else if (action && action.action === 'scavenger:collected') {
      // ============================================
      // SCAVENGER: Collected wreckage - notify clients to remove it
      // ============================================
      broadcastNearNpc(npcEntity, 'wreckage:collected', {
        wreckageId: action.wreckageId,
        collectedBy: npcId,
        isNPC: true
      });
    } else if (action && action.action === 'scavenger:haulerGrow') {
      // ============================================
      // SCAVENGER: Hauler grew after collecting wreckage
      // ============================================
      // First broadcast wreckage removal to clients
      if (action.wreckageId) {
        broadcastNearNpc(npcEntity, 'wreckage:collected', {
          wreckageId: action.wreckageId,
          collectedBy: npcId,
          isNPC: true
        });
      }
      // Then broadcast hauler growth
      broadcastNearNpc(npcEntity, 'scavenger:haulerGrow', {
        npcId: action.npcId,
        wreckageCount: action.wreckageCount,
        sizeMultiplier: action.sizeMultiplier,
        position: {
          x: npcEntity.position.x,
          y: npcEntity.position.y
        }
      });
    } else if (action && action.action === 'scavenger:rageClear') {
      // ============================================
      // SCAVENGER: Rage cleared - target escaped
      // ============================================
      broadcastNearNpc(npcEntity, 'scavenger:rageClear', {
        npcId: action.npcId
      });
    } else if (action && action.action === 'scavenger:rage') {
      // ============================================
      // SCAVENGER: Rage triggered (from wreckage theft)
      // ============================================
      broadcastNearNpc(npcEntity, 'scavenger:rage', {
        npcId: action.npcId,
        targetId: action.targetId,
        reason: action.reason,
        rageRange: action.rageRange,
        x: npcEntity.position.x,
        y: npcEntity.position.y
      });
      logger.info(`[SCAVENGER] ${npcEntity.name} (${npcEntity.type}) enraged - reason: ${action.reason}`);
    } else if (action && action.action === 'scavenger:transform') {
      // ============================================
      // SCAVENGER: Hauler → Barnacle King transformation
      // ============================================
      // First broadcast wreckage removal to clients (the 5th wreckage that triggered transform)
      if (action.wreckageId) {
        broadcastNearNpc(npcEntity, 'wreckage:collected', {
          wreckageId: action.wreckageId,
          collectedBy: npcId,
          isNPC: true
        });
      }
      const barnacleKing = npc.transformHaulerToBarnacleKing(npcId);
      if (barnacleKing) {
        // Broadcast transformation
        broadcastNearNpc(barnacleKing, 'scavenger:barnacleKingSpawn', {
          kingId: barnacleKing.id,
          haulerId: npcId,
          name: barnacleKing.name,
          x: barnacleKing.position.x,
          y: barnacleKing.position.y,
          rotation: barnacleKing.rotation,
          hull: barnacleKing.hull,
          hullMax: barnacleKing.hullMax,
          wreckageCount: barnacleKing.carriedWreckage.length
        });

        logger.info(`[SCAVENGER] Hauler ${npcId} transformed into Barnacle King ${barnacleKing.id} at (${Math.round(barnacleKing.x)}, ${Math.round(barnacleKing.y)})`);
      }
    } else if (action && action.action === 'scavenger:dumped') {
      // ============================================
      // SCAVENGER: Wreckage dumped at base
      // Update scrap pile and check for Hauler spawn
      // ============================================
      const dumpResult = npc.handleScavengerDump(action);

      if (dumpResult) {
        // Broadcast scrap pile update
        const base = npc.getActiveBase(action.baseId);
        if (base) {
          broadcastNearBase(base, 'scavenger:scrapPileUpdate', {
            baseId: action.baseId,
            x: base.x,
            y: base.y,
            scrapPile: dumpResult.scrapPile,
            npcId: action.npcId
          });

          // If transformation started, broadcast it
          if (dumpResult.transforming) {
            broadcastNearBase(base, 'scavenger:haulerTransform', {
              baseId: action.baseId,
              x: base.x,
              y: base.y,
              startTime: dumpResult.transforming.startTime,
              duration: dumpResult.transforming.duration
            });

            // Note: The actual Hauler spawn is handled by setTimeout in handleScavengerDump
            // and will be broadcast in the next section when it's added to spawnedNPCs
          }
        }
      }
    } else if (action && action.action === 'rogueMiner:startMining') {
      // ============================================
      // ROGUE MINER: Started mining an asteroid/planet
      // ============================================
      // Note: miningTargetPos already set above (line ~795) before npc:update broadcast
      broadcastNearNpc(npcEntity, 'npc:action', {
        npcId: npcId,
        action: 'startMining',
        targetId: action.targetId,
        targetPos: action.targetPos,
        duration: action.duration
      });
    } else if (action && action.action === 'rogueMiner:miningProgress') {
      // ============================================
      // ROGUE MINER: Mining in progress (for beam rendering)
      // ============================================
      // Update NPC's mining target position for client rendering
      npcEntity.miningTargetPos = action.targetPos;
      // Progress updates are sent with NPC data, no need for separate event
    } else if (action && action.action === 'rogueMiner:miningComplete') {
      // ============================================
      // ROGUE MINER: Mining complete, returning to base
      // ============================================
      npcEntity.miningTargetPos = null; // Clear beam
      broadcastNearNpc(npcEntity, 'npc:action', {
        npcId: npcId,
        action: 'miningComplete',
        targetId: action.targetId
      });
    } else if (action && action.action === 'rogueMiner:deposited') {
      // ============================================
      // ROGUE MINER: Deposited haul at base
      // May trigger Excavator or Foreman spawn
      // ============================================
      const depositResult = npc.handleRogueMinerDeposit(action.baseId, action.npcType, action.creditBonus);

      if (depositResult && depositResult.spawnResult) {
        const spawnedNPC = depositResult.spawnResult;
        // Broadcast new NPC spawn
        broadcastNearNpc(
          spawnedNPC,
          'npc:spawn',
          createNpcSpawnPayload(spawnedNPC)
        );

        // Special announcement for Foreman spawn (5000 unit radius)
        if (spawnedNPC.isForeman || spawnedNPC.type === 'rogue_foreman') {
          broadcastInRange(spawnedNPC.position, 5000, 'rogueMiner:foremanSpawn', {
            id: spawnedNPC.id,
            x: spawnedNPC.position.x,
            y: spawnedNPC.position.y,
            timestamp: Date.now()
          });
          logger.info(`[ROGUE_MINER] Foreman ${spawnedNPC.id} spawned at (${Math.round(spawnedNPC.position.x)}, ${Math.round(spawnedNPC.position.y)})`);
        }
      }
    } else if (action && action.action === 'rogueMiner:rage') {
      // ============================================
      // ROGUE MINER: Rage mode triggered
      // ============================================
      const rageEvent = createRogueMinerRageEvent(npcEntity, action);
      broadcastInRange(
        rageEvent.position,
        rageEvent.range,
        'npc:action',
        rageEvent.payload
      );
      logger.info(`[ROGUE_MINER] ${npcEntity.name} triggered rage - ${action.enragedNPCs.length} miners enraged`);
    } else if (action && action.action === 'rogueMiner:rageClear') {
      // ============================================
      // ROGUE MINER: Rage cleared for this NPC
      // ============================================
      broadcastNearNpc(npcEntity, 'npc:action', {
        action: 'rageClear',
        faction: 'rogue_miner',
        npcId: action.npcId
      });
    } else if (action && action.action === 'pirate:intelBroadcast') {
      // ============================================
      // PIRATE: Scout returned with intel, alerting nearby pirates
      // ============================================
      broadcastInRange(npcEntity.position, action.broadcastRange || 1000, 'pirate:intel', {
        scoutId: npcId,
        scoutPos: { x: npcEntity.position.x, y: npcEntity.position.y },
        targetInfo: action.targetInfo || action.intel || null,
        alertedPirateCount: Array.isArray(action.alertedPirates)
          ? action.alertedPirates.length
          : Math.max(0, Number(action.alertedPirateCount) || 0),
        baseId: action.baseId,
        timestamp: Date.now()
      });
      const alertedPirateCount = Array.isArray(action.alertedPirates)
        ? action.alertedPirates.length
        : Math.max(0, Number(action.alertedPirateCount) || 0);
      logger.log(`[PIRATE] Scout ${npcId} broadcast intel to ${alertedPirateCount} pirates`);
    } else if (action && action.action === 'pirate:boostDive') {
      // ============================================
      // PIRATE: Fighter/Dreadnought performing boost dive attack
      // ============================================
      broadcastNearNpc(npcEntity, 'pirate:boostDive', {
        npcId: npcId,
        npcType: npcEntity.type,
        startX: action.startX ?? action.fromX,
        startY: action.startY ?? action.fromY,
        targetX: action.targetX ?? action.toX,
        targetY: action.targetY ?? action.toY,
        speedMultiplier: action.speedMultiplier || 2.5,
        duration: action.duration || 0
      });
    } else if (action && action.action === 'pirate:steal') {
      // ============================================
      // PIRATE: Successfully stole from scavenger/rogue miner base
      // ============================================
      broadcastNearNpc(npcEntity, 'pirate:stealSuccess', {
        npcId: npcId,
        npcType: npcEntity.type,
        targetType: action.targetType,  // 'scavenger_scrapPile', 'scavenger_carried', 'rogue_credits'
        targetBaseId: action.targetBaseId,
        stolenAmount: action.stolenAmount,
        stolenItems: action.stolenItems,
        position: { x: npcEntity.position.x, y: npcEntity.position.y }
      });
      logger.log(`[PIRATE] ${npcEntity.type} stole from ${action.targetType}: ${action.stolenAmount}`);
    } else if (action && action.action === 'pirate:dreadnoughtEnraged') {
      // ============================================
      // PIRATE: Dreadnought entered enraged state (base destroyed)
      // ============================================
      broadcastInRange(npcEntity.position, 3000, 'pirate:dreadnoughtEnraged', {
        npcId: npcId,
        x: npcEntity.position.x,
        y: npcEntity.position.y,
        destroyedBaseId: action.destroyedBaseId,
        timestamp: Date.now()
      });
      logger.info(`[PIRATE] Dreadnought ${npcId} entered ENRAGED state - base ${action.destroyedBaseId} destroyed`);
    } else if (action && action.action === 'pirate:captainHeal') {
      // ============================================
      // PIRATE: Captain healing at base
      // ============================================
      broadcastNearNpc(npcEntity, 'pirate:captainHeal', {
        npcId: npcId,
        hull: npcEntity.hull,
        hullMax: npcEntity.hullMax,
        shield: npcEntity.shield,
        shieldMax: npcEntity.shieldMax,
        healRate: action.healRate,
        shieldHealRate: action.shieldHealRate,
        x: action.x ?? npcEntity.position.x,
        y: action.y ?? npcEntity.position.y
      });
    } else if (action && action.action === 'void_gravity_well') {
      // ============================================
      // VOID LEVIATHAN: Gravity Well ability
      // ============================================
      broadcastNearNpc(npcEntity, 'void:gravityWell', {
        leviathanId: action.leviathanId,
        position: action.position,
        phase: action.phase,
        radius: action.radius,
        warningDuration: action.warningDuration,
        activeDuration: action.activeDuration
      });
    } else if (action && action.action === 'void_gravity_well_tick') {
      // ============================================
      // VOID LEVIATHAN: Gravity Well active tick - apply pull and damage
      // ============================================
      const gravityConfig = config.VOID_LEVIATHAN_ABILITIES?.GRAVITY_WELL;
      if (!gravityConfig) continue;

      for (const affected of action.affectedPlayers || []) {
        const playerSocketId = [...connectedPlayers.entries()]
          .find(([, p]) => p.id === affected.id)?.[0];

        if (!playerSocketId) continue;
        const player = connectedPlayers.get(playerSocketId);
        if (!canPlayerTakeDamage(player)) continue;

        // Calculate damage based on distance from center
        const distRatio = affected.distance / action.radius;
        const damage = distRatio < 0.3
          ? gravityConfig.damageCenter  // Center zone - high damage
          : gravityConfig.damageEdge + (gravityConfig.damageCenter - gravityConfig.damageEdge) * (1 - distRatio);

        // Apply damage scaled by deltaTime
        const damageThisTick = (damage * deltaTime) / 1000;
        const result = combat.applyDamage(player.id, {
          shieldDamage: damageThisTick * 0.3,
          hullDamage: damageThisTick * 0.7
        });

        if (result) {
          player.hull = result.hull;
          player.shield = result.shield;

          io.to(playerSocketId).emit('player:damaged', {
            attackerId: npcId,
            attackerType: 'npc',
            damage: damageThisTick,
            hull: result.hull,
            shield: result.shield,
            damageType: 'void'
          });

          // Check for death
          if (result.hull <= 0) {
            handlePlayerDeathWithWreckage(player, npcEntity.name, playerSocketId, {
              cause: 'void_gravity_well',
              type: 'npc',
              name: npcEntity.name,
              faction: 'void',
              npcType: 'void_leviathan'
            });
          }
        }

        // Apply pull force toward gravity well center
        const pullDx = action.position.x - player.position.x;
        const pullDy = action.position.y - player.position.y;
        const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy);
        if (pullDist > 1) {
          const pullStrength = gravityConfig.pullStrength * (deltaTime / 1000);
          player.position.x += (pullDx / pullDist) * pullStrength;
          player.position.y += (pullDy / pullDist) * pullStrength;
        }
      }
    } else if (action && action.action === 'void_consume') {
      // ============================================
      // VOID LEVIATHAN: Consume ability
      // ============================================
      broadcastNearNpc(npcEntity, 'void:consume', {
        leviathanId: action.leviathanId,
        targetNpcId: action.targetNpcId,
        targetPosition: action.targetPosition,
        phase: action.phase,
        tendrilSpeed: action.tendrilSpeed,
        dragDuration: action.dragDuration,
        healAmount: action.healAmount
      });

      // Handle dissolve phase - heal Leviathan and remove consumed NPC
      if (action.phase === 'dissolve' && action.removeTarget) {
        // Heal the Leviathan
        if (action.healAmount > 0) {
          npcEntity.hull = Math.min(npcEntity.hullMax, npcEntity.hull + action.healAmount);
        }

        // Remove the consumed NPC
        if (action.targetNpcId) {
          const consumedNpc = npc.activeNPCs.get(action.targetNpcId);
          if (consumedNpc) {
            const formationInfo = npc.getFormationForNpc(action.targetNpcId);
            let successionResult = null;
            if (formationInfo?.isLeader && formationInfo.memberIds.size > 0) {
              successionResult = npc.handleLeaderDeath(formationInfo.formationId);
            }

            // Broadcast the consumed NPC's destruction
            broadcastNearNpc(
              consumedNpc,
              'npc:destroyed',
              createConsumedNpcDestroyedPayload(consumedNpc)
            );

            if (successionResult?.success && successionResult.newLeader) {
              voidFormationAI.setFormationState(
                formationInfo.formationId,
                'confusion',
                successionResult.newLeader.id
              );
              broadcastNearNpc(consumedNpc, 'formation:leaderChange', {
                formationId: formationInfo.formationId,
                oldLeaderId: action.targetNpcId,
                oldLeaderType: consumedNpc.type,
                newLeaderId: successionResult.newLeader.id,
                newLeaderType: successionResult.newLeader.type,
                newLeaderName: successionResult.newLeader.name,
                newLeaderPosition: successionResult.newLeader.position,
                memberIds: successionResult.memberIds,
                confusionDuration: 1000,
                reformationDuration: 2000
              });
            }

            npc.removeNPC(action.targetNpcId, { scheduleBaseRespawn: true });
          }
        }
      }
    } else if (action && action.action === 'void_spawn_minions') {
      // ============================================
      // VOID LEVIATHAN: Spawn minions from rifts
      // ============================================
      // Generate the portals once so the warning animation and delayed server
      // spawns share the exact same authoritative positions.
      const riftPositions = createVoidMinionRiftPositions(
        action.position,
        action.riftCount
      );
      broadcastNearNpc(npcEntity, 'void:spawnMinions', {
        leviathanId: action.leviathanId,
        position: action.position,
        riftCount: riftPositions.length,
        riftPositions,
        trigger: action.trigger,
        healthThreshold: action.healthThreshold
      });

      // Spawn void_whispers from rifts (delayed for visual effect)
      const minionConfig = config.VOID_LEVIATHAN_MINIONS;
      const minionsPerRift = minionConfig?.minionsPerRift || { min: 1, max: 2 };

      setTimeout(() => {
        for (let i = 0; i < riftPositions.length; i++) {
          const { x: riftX, y: riftY } = riftPositions[i];

          // Spawn 1-2 minions per rift
          const minionCount = minionsPerRift.min + Math.floor(Math.random() * (minionsPerRift.max - minionsPerRift.min + 1));
          for (let j = 0; j < minionCount; j++) {
            // Create void_whisper minion
            const minionId = `void_minion_${Date.now()}_${i}_${j}`;
            const minionType = npc.NPC_TYPES.void_whisper;
            const minion = {
              id: minionId,
              type: 'void_whisper',
              name: minionType.name,
              faction: 'void',
              position: { x: riftX + (Math.random() - 0.5) * 30, y: riftY + (Math.random() - 0.5) * 30 },
              velocity: { x: 0, y: 0 },
              rotation: Math.random() * Math.PI * 2,
              hull: minionType.hull,
              hullMax: minionType.hull,
              shield: minionType.shield,
              shieldMax: minionType.shield,
              speed: minionType.speed,
              weaponType: minionType.weaponType,
              weaponTier: minionType.weaponTier,
              weaponDamage: minionType.weaponDamage,
              weaponRange: minionType.weaponRange,
              aggroRange: minionType.aggroRange,
              creditReward: minionType.creditReward,
              deathEffect: minionType.deathEffect,
              lastFireTime: 0,
              state: 'combat',
              spawnedByLeviathan: action.leviathanId,
              riftPortal: { x: riftX, y: riftY },
              damageContributors: new Map()
            };

            npc.activeNPCs.set(minionId, minion);
            npc.insertNPCInHash(minionId, minion.position.x, minion.position.y);

            // Register minion with Leviathan AI
            const { voidLeviathanAI } = require('./ai/void-leviathan');
            voidLeviathanAI.registerMinion(action.leviathanId, minionId);

            // Broadcast spawn
            broadcastNearNpc(minion, 'npc:spawn', {
              id: minionId,
              type: 'void_whisper',
              name: minion.name,
              faction: 'void',
              x: minion.position.x,
              y: minion.position.y,
              hull: minion.hull,
              hullMax: minion.hullMax,
              shield: minion.shield,
              shieldMax: minion.shieldMax,
              fromRift: true,
              riftPosition: { x: riftX, y: riftY }
            });
          }
        }
      }, 1500); // Delay spawn for rift animation
    } else if (action && action.action === 'void_rift_retreat') {
      // ============================================
      // VOID NPC: Retreat into rift portal
      // ============================================
      // The NPC remains in the simulation for its one-second phase-out. Do not
      // rebroadcast or schedule the same retreat on every 20 Hz tick.
      if (scheduledRiftRespawns.has(action.npcId)) {
        continue;
      }

      broadcastNearNpc(npcEntity, 'void:riftRetreat', {
        npcId: action.npcId,
        riftPosition: action.riftPosition,
        npcType: action.npcType
      });

      // Store NPC data for respawn before deletion
      const retreatingNpc = npc.activeNPCs.get(action.npcId);
      scheduledRiftRespawns.add(action.npcId);

      // Don't respawn Leviathans through rift retreat - they have their own spawn system
      if (retreatingNpc && retreatingNpc.type === 'void_leviathan') {
        // Mark for removal after rift animation
        setTimeout(() => {
          npc.removeNPC(action.npcId);
          npc.handleLeviathanDeath(action.npcId);
          scheduledRiftRespawns.delete(action.npcId);
        }, 1000);
        continue;
      }

      const respawnData = retreatingNpc ? {
        type: retreatingNpc.type,
        faction: retreatingNpc.faction,
        riftPosition: action.riftPosition,
        spawnPoint: retreatingNpc.spawnPoint || action.riftPosition,
        baseId: retreatingNpc.homeBaseId || retreatingNpc.baseId
      } : null;

      // Mark for removal after rift animation
      setTimeout(() => {
        npc.removeNPC(action.npcId);
        if (!respawnData) {
          scheduledRiftRespawns.delete(action.npcId);
        }
      }, 1000);

      // Schedule respawn after 10-15 seconds with full health
      if (respawnData) {
        const respawnDelay = 10000 + Math.random() * 5000; // 10-15 seconds
        setTimeout(() => {
          // Clear from scheduled set
          scheduledRiftRespawns.delete(action.npcId);

          // Only respawn if the base still exists and is valid
          if (respawnData.baseId) {
            const base = npc.getActiveBase(respawnData.baseId);
            if (!base || base.destroyed) return;
          }

          // Spawn 2 NPCs from the rift (reinforcements)
          const spawnCount = 2;
          for (let i = 0; i < spawnCount; i++) {
            // Slight offset for each spawn
            const offsetAngle = Math.random() * Math.PI * 2;
            const offsetDist = 30 + Math.random() * 20;
            const spawnPos = {
              x: respawnData.riftPosition.x + Math.cos(offsetAngle) * offsetDist * i,
              y: respawnData.riftPosition.y + Math.sin(offsetAngle) * offsetDist * i
            };

            const newNpc = npc.spawnVoidNPCFromRift(respawnData.type, spawnPos, {
              spawnPoint: respawnData.spawnPoint,
              baseId: respawnData.baseId
            });

            if (newNpc && socketModule) {
              // Broadcast spawn to nearby players
              broadcastNearNpc(newNpc, 'npc:spawn', {
                id: newNpc.id,
                type: newNpc.type,
                name: newNpc.name,
                faction: newNpc.faction,
                x: newNpc.position.x,
                y: newNpc.position.y,
                rotation: newNpc.rotation,
                hull: newNpc.hull,
                hullMax: newNpc.hullMax,
                shield: newNpc.shield,
                shieldMax: newNpc.shieldMax,
                fromRift: true,
                riftPosition: respawnData.riftPosition
              });
            }
          }
        }, respawnDelay);
      }
    }
  }

  // Remove any NPCs that need to despawn (outside the iteration loop)
  for (const npcId of npcsToRemove) {
    const npcToRemove = npc.activeNPCs.get(npcId);
    if (npcToRemove && npcToRemove.attachedToBase) {
      logger.warn(`[WORM_DESPAWN] Attached worm ${npcId} being despawned while attached to base ${npcToRemove.attachedToBase}`);
    }
    npc.removeNPC(npcId);
  }

  // ============================================
  // SWARM QUEEN AURA - Apply regeneration to nearby bases
  // ============================================
  const now = Date.now();
  const queenForAura = npc.getActiveQueen();
  if (queenForAura && socketModule) {
    // Apply aura effect (runs every tick)
    const auraResult = npc.applyQueenAura(deltaTime);

    // Throttle broadcasts to once per second
    if (auraResult && auraResult.length > 0 && now - lastQueenAuraBroadcast >= QUEEN_AURA_BROADCAST_INTERVAL) {
      lastQueenAuraBroadcast = now;
      socketModule.broadcastQueenAura(auraResult);
    }
  }

  // Flush all accumulated NPC updates as batched messages (one per player)
  flushNpcBatches();
}

/**
 * Add an NPC's retained living player target to the AI candidate list when the
 * spatial aggro query did not include it. Strategies remain responsible for
 * enforcing their faction-specific chase/clear distances.
 */
function includeRetainedNpcTargetPlayer(npcEntity, alivePlayers, nearbyPlayers) {
  if (getPlayerTargetRetentionRange(npcEntity) <= 0 ||
      npcEntity?.targetPlayer === null || npcEntity?.targetPlayer === undefined) {
    return nearbyPlayers;
  }

  const targetId = String(npcEntity.targetPlayer);
  if (nearbyPlayers.some(player => String(player?.id) === targetId)) {
    return nearbyPlayers;
  }

  const retainedTarget = alivePlayers.find(player => String(player?.id) === targetId);
  if (retainedTarget) nearbyPlayers.push(retainedTarget);
  return nearbyPlayers;
}

function updateMining(deltaTime) {
  // Mining updates are handled per-player when they send mining events
  // This could be used for mining progress broadcasts if needed
}

function updateWreckage(deltaTime) {
  // Cleanup expired wreckage
  loot.cleanupExpiredWreckage(wreckage => {
    if (!io) return;
    broadcastWreckageNear(wreckage, 'wreckage:despawn', { id: wreckage.id });
  });
}

function updateStarDamage(deltaTime) {
  // Apply heat damage from stars to nearby players
  starDamage.update(
    connectedPlayers,
    io,
    deltaTime,
    socketModule?.setPlayerStatus,
    handlePlayerDeathWithWreckage
  );
}

// Track comet warnings to avoid spamming
const cometWarningsSent = new Map(); // cometId -> lastWarningTime

function updateComets(deltaTime) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  const players = [...connectedPlayers.values()].filter(player =>
    canPlayerTakeDamage(player) &&
    Number.isFinite(player.position?.x) && Number.isFinite(player.position?.y)
  );
  if (players.length === 0) return;
  const now = Date.now();
  const orbitTime = Physics.getOrbitTime();

  // Comet config
  const cometConfig = config.COMET_CONFIG || {};
  const collisionDamage = cometConfig.PLAYER_COLLISION_DAMAGE || 50;
  const knockbackForce = cometConfig.KNOCKBACK_FORCE || 200;
  const warningInterval = 5000; // Don't spam warnings - once per 5 seconds per comet

  // Find active sectors (same approach as updateBases/updateNPCs)
  const activeSectors = new Map();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors for comet detection
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sx = sectorX + dx;
        const sy = sectorY + dy;
        const key = `${sx}_${sy}`;
        if (!activeSectors.has(key)) {
          activeSectors.set(key, { x: sx, y: sy });
        }
      }
    }
  }

  // Check each active sector for comets
  const seenCometIds = new Set();
  for (const [sectorKey, coords] of activeSectors) {
    const sector = world.generateSector(coords.x, coords.y);
    if (!sector.comets || sector.comets.length === 0) continue;

    for (const comet of sector.comets) {
      // Comet Bezier bounds intentionally overlap sector caches. Process each
      // stable hazard once per update so overlap cannot multiply damage.
      if (comet.id && seenCometIds.has(comet.id)) continue;
      if (comet.id) seenCometIds.add(comet.id);

      // Compute comet position using physics
      const cometState = Physics.computeCometPosition(comet, orbitTime);

      if (!cometState.visible) continue;

      // Check for warning phase - broadcast to nearby players
      if (cometState.isWarning && cometState.timeUntilArrival > 0) {
        const lastWarning = cometWarningsSent.get(comet.id) || 0;
        if (now - lastWarning >= warningInterval) {
          cometWarningsSent.set(comet.id, now);

          // Broadcast warning to players near the comet's trajectory
          for (const [socketId, player] of connectedPlayers) {
            if (!canPlayerTakeDamage(player) || !player.position) continue;
            const dx = player.position.x - cometState.x;
            const dy = player.position.y - cometState.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Warn players within 1500 units of comet's current position
            if (dist <= 1500) {
              io.to(socketId).emit('comet:warning', {
                cometId: comet.id,
                x: cometState.x,
                y: cometState.y,
                angle: cometState.angle,
                size: comet.size,
                timeUntilArrival: cometState.timeUntilArrival,
                speed: comet.speed
              });
            }
          }
        }
      }

      // Check for player collisions (only during active traversal, not warning)
      if (!cometState.isWarning) {
        const cometRadius = comet.size * 0.5; // Collision radius is half the visual size

        for (const [socketId, player] of connectedPlayers) {
          if (!canPlayerTakeDamage(player) || !player.position) continue;
          const dx = player.position.x - cometState.x;
          const dy = player.position.y - cometState.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Check if player collides with comet (ship radius ~15 + comet radius)
          const collisionRadius = cometRadius + 15;
          if (dist <= collisionRadius) {
            // Apply damage
            const damage = { shieldDamage: collisionDamage * 0.3, hullDamage: collisionDamage * 0.7 };
            const result = combat.applyDamage(player.id, damage);

            if (result) {
              player.hull = result.hull;
              player.shield = result.shield;

              // Calculate knockback direction (away from comet trajectory)
              const knockbackAngle = Math.atan2(dy, dx);
              const knockbackX = Math.cos(knockbackAngle) * knockbackForce;
              const knockbackY = Math.sin(knockbackAngle) * knockbackForce;

              // Notify player of collision
              io.to(socketId).emit('comet:collision', {
                cometId: comet.id,
                damage: collisionDamage,
                hull: result.hull,
                shield: result.shield,
                knockbackX: knockbackX,
                knockbackY: knockbackY,
                cometX: cometState.x,
                cometY: cometState.y
              });

              // Handle death from comet collision with wreckage spawning
              if (result.isDead) {
                handlePlayerDeathWithWreckage(player, 'Comet impact', socketId, {
                  cause: 'comet',
                  type: 'environment',
                  name: 'Comet'
                });
              }
            }
          }
        }
      }
    }
  }

  // Periodic cleanup of old warning entries (every ~30 seconds)
  if (Math.random() < 0.001) {
    const cutoff = now - 60000; // Remove entries older than 1 minute
    for (const [cometId, timestamp] of cometWarningsSent) {
      if (timestamp < cutoff) {
        cometWarningsSent.delete(cometId);
      }
    }
  }
}

// Broadcast nearby bases to each player for radar display
function broadcastNearbyBasesToPlayers(now) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  // Throttle broadcasts
  if (now - lastBaseBroadcastTime < BASE_BROADCAST_INTERVAL) return;
  lastBaseBroadcastTime = now;

  for (const [socketId, player] of connectedPlayers) {
    if (!player?.position || player.isDead) continue;

    // Exact base coordinates are radar data. The larger activation radius is
    // only for keeping server simulation warm and must not leak into payloads.
    const radarRange = getPlayerRadarRange(player);
    const nearbyBases = npc.getBasesInRange(player.position, radarRange);

    // Empty snapshots are significant: they let the client age out bases that
    // have just moved beyond this recipient's radar range.
    io.to(socketId).emit('bases:nearby', nearbyBases);

    // Ancient Star Map contacts are a deliberately sparse, server-authoritative
    // bearing feed. It avoids generating or scanning distant procedural sectors
    // in the 60 Hz client world query and does not expose combat/health state.
    if (Array.isArray(player.relicTypes) && player.relicTypes.includes('ANCIENT_STAR_MAP')) {
      const effects = config.RELIC_TYPES?.ANCIENT_STAR_MAP?.effects || {};
      const strategicRange = radarRange * Math.max(
        1,
        Number(effects.strategicContactRangeMultiplier) || 2
      );
      const strategicBases = npc.getBasesInRange(player.position, strategicRange);
      const strategicNpcs = npc.getNPCsInRange(player.position, strategicRange);
      const contacts = buildStrategicContacts(
        player.position,
        radarRange,
        strategicRange,
        effects.maxStrategicContacts,
        strategicBases,
        strategicNpcs
      );
      io.to(socketId).emit('relic:strategicContacts', contacts);
    }
  }
}

function broadcastWreckageNear(wreckage, event, data) {
  if (!connectedPlayers) return;

  // Query spatial hash for nearby players instead of scanning all players
  const candidates = playerSpatialHash.query(
    wreckage.position.x, wreckage.position.y, MAX_TIER_BROADCAST_RANGE
  );

  for (const socketId of candidates) {
    const player = connectedPlayers.get(socketId);
    if (!player) continue;

    const dx = player.position.x - wreckage.position.x;
    const dy = player.position.y - wreckage.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Use player's tier-based broadcast range
    const broadcastRange = getPlayerBroadcastRange(player);
    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

/**
 * Determine whether an NPC update should be sent to a player based on distance.
 * Closer NPCs get higher update rates; far-away NPCs (radar dots) get throttled.
 * Always sends on full refresh ticks or when NPC state has meaningfully changed.
 *
 * Distance tiers:
 *   0-500u:   every tick (20Hz)
 *   500-1000u: every 2 ticks (10Hz)
 *   1000-2000u: every 4 ticks (5Hz)
 *   2000u+:   every 10 ticks (2Hz)
 */
function shouldSendNpcUpdate(dist, data, socketId) {
  // Always send on full refresh ticks
  if (currentTick % FULL_REFRESH_INTERVAL === 0) return true;

  // Always send if NPC state changed (hull, shield, or AI state transition)
  const lastSeenMap = playerLastSeen.get(socketId);
  if (lastSeenMap) {
    const prev = lastSeenMap.get(data.id);
    if (prev) {
      if (data.type !== prev.type) return true;
      if (data.name !== prev.name) return true;
      if (data.faction !== prev.faction) return true;
      if (data.hull !== prev.hull) return true;
      if (data.hullMax !== prev.hullMax) return true;
      if (data.shield !== prev.shield) return true;
      if (data.shieldMax !== prev.shieldMax) return true;
      if (data.state !== prev.state) return true;
      if (data.isBoss !== prev.isBoss) return true;
      if (data.sizeMultiplier !== prev.sizeMultiplier) return true;
      if (data.phase !== prev.phase) return true;
    }
  }
  // No previous state means first encounter - always send
  if (!lastSeenMap || !lastSeenMap.get(data.id)) return true;

  // Distance-based throttling
  if (dist <= 500) return true;
  if (dist <= 1000) return currentTick % 2 === 0;
  if (dist <= 2000) return currentTick % 4 === 0;
  return currentTick % 10 === 0;
}

/**
 * Queue an NPC update for batched delivery with delta compression.
 * Instead of emitting individual npc:update events, this accumulates
 * updates per-player and flushes them as a single npc:batch message.
 * Delta compression sends only changed fields after the first full state.
 * Updates are throttled by distance - far NPCs update less frequently.
 */
function queueNpcUpdate(npcEntity, data) {
  if (!connectedPlayers) return;

  const targetRetentionRange = getPlayerTargetRetentionRange(npcEntity);

  // Query spatial hash for nearby players instead of scanning all players
  const candidates = playerSpatialHash.query(
    npcEntity.position.x,
    npcEntity.position.y,
    getNpcCandidateRange(
      npcEntity,
      MAX_TIER_BROADCAST_RANGE,
      targetRetentionRange
    )
  );

  for (const socketId of candidates) {
    const player = connectedPlayers.get(socketId);
    if (!canPlayerTakeDamage(player)) continue;

    const dx = player.position.x - npcEntity.position.x;
    const dy = player.position.y - npcEntity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const broadcastRange = getNpcDeliveryRange(
      npcEntity,
      player,
      getPlayerBroadcastRange(player),
      targetRetentionRange
    );
    if (dist <= broadcastRange) {
      // Distance-based throttling: skip update for far-away NPCs on non-scheduled ticks
      if (!shouldSendNpcUpdate(dist, data, socketId)) continue;

      if (!npcBatches.has(socketId)) {
        npcBatches.set(socketId, []);
      }

      // Build delta-compressed update for this player
      const delta = buildNpcDelta(socketId, data);
      npcBatches.get(socketId).push(delta);
    }
  }
}

/**
 * Build a delta-compressed NPC update for a specific player.
 * First-time encounters and periodic refreshes send full state (f=1 flag).
 * Subsequent updates send only id + position + rotation + changed fields.
 */
function buildNpcDelta(socketId, fullData) {
  if (!playerLastSeen.has(socketId)) {
    playerLastSeen.set(socketId, new Map());
  }
  const lastSeen = playerLastSeen.get(socketId);
  const npcId = fullData.id;
  const { delta, nextState } = createNpcDelta(
    lastSeen.get(npcId),
    fullData,
    currentTick,
    FULL_REFRESH_INTERVAL
  );
  lastSeen.set(npcId, nextState);
  return delta;
}

/**
 * Remember an explicit spawn delivery before the first batched state arrives.
 * A null snapshot deliberately keeps the next delta as a full refresh while
 * still making death/range reconciliation aware that the client owns the NPC.
 */
function trackNpcSpawnVisibility(socketId, npcId) {
  if (typeof npcId !== 'string' || npcId.length === 0) return;
  if (!playerLastSeen.has(socketId)) {
    playerLastSeen.set(socketId, new Map());
  }
  const lastSeen = playerLastSeen.get(socketId);
  if (!lastSeen.has(npcId)) lastSeen.set(npcId, null);
}

/**
 * Retire all NPC visibility owned by one socket without playing death effects.
 * Pending deltas are discarded so a leave event cannot be followed by an older
 * update that recreates the entity on the client.
 */
function retireNpcVisibilityForSocket(socketId) {
  const lastSeen = playerLastSeen.get(socketId);
  if (lastSeen && io) {
    for (const npcId of lastSeen.keys()) {
      io.to(socketId).emit('npc:leave', { id: npcId });
    }
  }
  playerLastSeen.delete(socketId);
  npcBatches.delete(socketId);
}

/**
 * Explicitly retire NPCs from clients when they leave authoritative delivery
 * range. Delta state otherwise remembers the entity forever and the client can
 * keep blending its last velocity against an obsolete target position.
 */
function reconcileNpcVisibility() {
  if (!connectedPlayers || !io) return;

  for (const [socketId, lastSeen] of playerLastSeen) {
    const player = connectedPlayers.get(socketId);
    if (!player) continue;
    if (!canPlayerTakeDamage(player)) {
      retireNpcVisibilityForSocket(socketId);
      continue;
    }

    for (const npcId of [...lastSeen.keys()]) {
      const npcEntity = getActiveNpcById(npcId);
      if (!npcEntity?.position) {
        // Rich destruction events may already have removed the entity, but leave
        // is deliberately idempotent and also covers silent lifecycle removals.
        io.to(socketId).emit('npc:leave', { id: npcId });
        lastSeen.delete(npcId);
        continue;
      }

      const dx = player.position.x - npcEntity.position.x;
      const dy = player.position.y - npcEntity.position.y;
      const targetRetentionRange = getPlayerTargetRetentionRange(npcEntity);
      const deliveryRange = getNpcDeliveryRange(
        npcEntity,
        player,
        getPlayerBroadcastRange(player),
        targetRetentionRange
      );
      if (dx * dx + dy * dy > deliveryRange * deliveryRange) {
        io.to(socketId).emit('npc:leave', { id: npcId });
        lastSeen.delete(npcId);
      }
    }
  }
}

/**
 * Flush all accumulated NPC update batches to players.
 * Sends one npc:batch message per player containing all NPC updates for this tick.
 * Also cleans up stale playerLastSeen entries for disconnected players.
 */
function flushNpcBatches() {
  reconcileNpcVisibility();

  for (const [socketId, batch] of npcBatches) {
    const player = connectedPlayers?.get(socketId);
    const visibleIds = playerLastSeen.get(socketId);
    if (!canPlayerTakeDamage(player) || !visibleIds) continue;

    // Reconciliation runs after actions. An NPC may therefore have died, been
    // despawned, or left range after its update was queued earlier in this tick.
    const authoritativeBatch = batch.filter(update =>
      update?.id && visibleIds.has(update.id) && getActiveNpcById(update.id)
    );
    if (authoritativeBatch.length > 0) {
      io.to(socketId).emit('npc:batch', authoritativeBatch);
    }
  }
  npcBatches.clear();

  // Clean up stale playerLastSeen entries for disconnected players
  for (const socketId of playerLastSeen.keys()) {
    if (!connectedPlayers || !connectedPlayers.has(socketId)) {
      playerLastSeen.delete(socketId);
    }
  }
}

function broadcastNearNpc(npcEntity, event, data) {
  if (!connectedPlayers) return;

  const targetRetentionRange = getPlayerTargetRetentionRange(npcEntity);

  // Query spatial hash for nearby players instead of scanning all players
  const candidates = playerSpatialHash.query(
    npcEntity.position.x,
    npcEntity.position.y,
    getNpcCandidateRange(
      npcEntity,
      MAX_TIER_BROADCAST_RANGE,
      targetRetentionRange
    )
  );

  for (const socketId of candidates) {
    const player = connectedPlayers.get(socketId);
    if (!canPlayerTakeDamage(player)) continue;

    const dx = player.position.x - npcEntity.position.x;
    const dy = player.position.y - npcEntity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Targets must see their attacker throughout its authoritative range.
    const broadcastRange = getNpcDeliveryRange(
      npcEntity,
      player,
      getPlayerBroadcastRange(player),
      targetRetentionRange
    );
    if (dist <= broadcastRange) {
      if (event === 'npc:spawn') {
        trackNpcSpawnVisibility(socketId, data?.id);
      }
      io.to(socketId).emit(event, data);
    }
  }
}

// Broadcast to all players within a fixed range of a position
function broadcastInRange(position, range, event, data) {
  if (!connectedPlayers) return;

  // Query spatial hash for nearby players instead of scanning all players
  const candidates = playerSpatialHash.query(position.x, position.y, range);

  for (const socketId of candidates) {
    const player = connectedPlayers.get(socketId);
    if (!canPlayerTakeDamage(player)) continue;

    const dx = player.position.x - position.x;
    const dy = player.position.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= range) {
      if (event === 'npc:spawn') {
        trackNpcSpawnVisibility(socketId, data?.id);
      }
      io.to(socketId).emit(event, data);
    }
  }
}

/**
 * Deliver an assimilation transition through engine-owned visibility state.
 * The event can create converted NPC entities on the client, so every delivered
 * NPC id must participate in the same leave/death reconciliation as a spawn.
 */
function broadcastBaseAssimilated(data) {
  const position = data?.position;
  if (!connectedPlayers || !io ||
      !Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    return 0;
  }

  const convertedNpcs = Array.isArray(data.convertedNpcs)
    ? data.convertedNpcs
    : [];
  const payload = {
    baseId: data.baseId,
    newType: data.newType,
    originalFaction: data.originalFaction,
    convertedNpcs,
    position,
    consumedDroneIds: Array.isArray(data.consumedDroneIds)
      ? data.consumedDroneIds
      : []
  };
  const candidates = playerSpatialHash.query(
    position.x,
    position.y,
    MAX_TIER_BROADCAST_RANGE
  );
  let delivered = 0;

  for (const socketId of candidates) {
    const player = connectedPlayers.get(socketId);
    if (!canPlayerTakeDamage(player) || !player.position) continue;

    const distance = Math.hypot(
      player.position.x - position.x,
      player.position.y - position.y
    );
    if (distance > getPlayerBroadcastRange(player)) continue;

    for (const conversion of convertedNpcs) {
      trackNpcSpawnVisibility(socketId, conversion?.id || conversion?.npcId);
    }
    io.to(socketId).emit('swarm:baseAssimilated', payload);
    delivered++;
  }

  return delivered;
}

/**
 * Complete all side effects for an NPC killed by Swarm linked health. The
 * linked-damage pass deliberately retains dead entities until this function
 * has detached assimilation worms, created wreckage, emitted death state, and
 * removed the entity from both the active map and spatial hash.
 */
function handleLinkedSwarmDeath(linked, sourceNpc, attackerId) {
  const linkedNpc = linked.entity || npc.getNPC(linked.id);
  if (!linkedNpc) return null;

  if (linkedNpc.attachedToBase) {
    const detachResult = npc.detachDroneFromBase(linked.id);
    if (detachResult && socketModule?.broadcastAssimilationProgress) {
      socketModule.broadcastAssimilationProgress({
        baseId: detachResult.baseId,
        progress: detachResult.remainingDrones,
        threshold: detachResult.threshold,
        position: linkedNpc.position,
        droneKilled: linked.id,
        killedBy: attackerId
      });
    }
  }

  const wasHatchingEgg = linkedNpc.faction === 'swarm' && linkedNpc.hatchTime &&
    (Date.now() - linkedNpc.hatchTime) < (linkedNpc.hatchDuration || 2500);
  const contributors = linkedNpc.damageContributors instanceof Map
    ? Array.from(linkedNpc.damageContributors.keys())
    : [attackerId].filter(Boolean);
  const participants = contributors.length > 0 ? contributors : [attackerId].filter(Boolean);
  let wreckage = null;

  if (!wasHatchingEgg) {
    wreckage = loot.spawnWreckage(
      linkedNpc,
      linkedNpc.position,
      null,
      linkedNpc.damageContributors || sourceNpc.damageContributors
    );
    broadcastWreckageNear(wreckage, 'wreckage:spawn', {
      id: wreckage.id,
      x: wreckage.position.x,
      y: wreckage.position.y,
      size: wreckage.size,
      source: wreckage.source,
      faction: wreckage.faction,
      npcType: wreckage.npcType,
      npcName: wreckage.npcName,
      contentCount: wreckage.contents.length,
      despawnTime: wreckage.despawnTime
    });
  }

  broadcastNearNpc(linkedNpc, 'npc:destroyed', {
    id: linked.id,
    destroyedBy: attackerId,
    participants,
    participantCount: Math.max(1, participants.length),
    teamMultiplier: npc.TEAM_MULTIPLIERS[Math.min(Math.max(1, participants.length), 4)] || 1,
    creditsPerPlayer: linkedNpc.creditReward || 0,
    faction: linkedNpc.faction,
    deathEffect: wasHatchingEgg ? 'egg_pop' : (linkedNpc.deathEffect || 'dissolve'),
    wreckageId: wreckage?.id || null,
    linkedDeath: true
  });

  npc.removeNPC(linked.id);
  return wreckage;
}

// Handle player attacking NPC
// damageOverride: optional parameter to override damage calculation (used for chain lightning falloff)
function playerAttackNPC(
  attackerId,
  npcId,
  weaponType,
  weaponTier,
  damageOverride,
  attackContext = {}
) {
  const npcEntity = npc.getNPC(npcId);
  if (!npcEntity) return null;

  // DREADNOUGHT INVULNERABILITY CHECK
  // Pirate dreadnoughts have a chance to negate all damage
  const sourceId = attackContext?.sourceNpcId ?? attackerId;
  if (!attackContext?.skipInvulnerabilityCheck) {
    const blocked = tryBlockNpcDamage(npcEntity, sourceId);
    if (blocked) return blocked;
  }

  // Calculate damage using proper damage calculation, or use override if provided
  let totalDamage;
  if (typeof damageOverride === 'number' && damageOverride > 0) {
    totalDamage = damageOverride;
  } else {
    const damage = combat.calculateDamage(weaponType, weaponTier, 1);
    totalDamage = damage.shieldDamage + damage.hullDamage;
  }

  totalDamage = calculateFactionDamage(
    totalDamage,
    npcEntity.faction,
    playerHasRelic(statements, attackerId, 'VOID_CRYSTAL')
  );

  // Apply damage to NPC with attacker tracking
  const result = npc.damageNPC(npcId, totalDamage, attackerId, {
    sourceNpcId: attackContext?.sourceNpcId ?? null,
    shieldPiercing: attackContext?.shieldPiercing ?? 0
  });

  if (result && result.destroyed) {
    // Check if this was an attached assimilation drone
    if (npcEntity.attachedToBase) {
      // damageNPC removes destroyed entities before returning, so pass the
      // retained entity to let assimilation bookkeeping finish correctly.
      const detachResult = npc.detachDroneFromBase(npcId, npcEntity);
      if (detachResult && socketModule) {
        // Broadcast the detachment so clients know the assimilation progress changed
        socketModule.broadcastAssimilationProgress({
          baseId: detachResult.baseId,
          progress: detachResult.remainingDrones,
          threshold: detachResult.threshold,
          position: npcEntity.position,
          droneKilled: npcId,
          killedBy: sourceId
        });
      }
    }

    // Check if this was a hatching swarm egg - no wreckage drops from eggs
    const wasHatchingEgg = npcEntity.faction === 'swarm' && npcEntity.hatchTime &&
      (Date.now() - npcEntity.hatchTime) < (npcEntity.hatchDuration || 2500);

    let wreckage = null;
    if (!wasHatchingEgg) {
      // Spawn wreckage at NPC position with loot, passing damage contributors for team rewards
      wreckage = loot.spawnWreckage(npcEntity, npcEntity.position, null, npcEntity.damageContributors);

      // Barnacle King: Add accumulated wreckage contents to the wreckage drop
      if (npcEntity.type === 'scavenger_barnacle_king' && npcEntity.carriedWreckage) {
        for (const carried of npcEntity.carriedWreckage) {
          if (carried.contents && Array.isArray(carried.contents)) {
            // Merge carried wreckage contents into the king's wreckage
            wreckage.contents.push(...carried.contents);
          }
        }
        logger.info(`[BARNACLE KING] Dropped ${npcEntity.carriedWreckage.length} accumulated wreckage pieces with SCRAP_SIPHON`);
      }

      // Broadcast wreckage spawn
      broadcastWreckageNear(wreckage, 'wreckage:spawn', {
        id: wreckage.id,
        x: wreckage.position.x,
        y: wreckage.position.y,
        size: wreckage.size,
        source: wreckage.source,
        faction: wreckage.faction,
        npcType: wreckage.npcType,
        npcName: wreckage.npcName,
        contentCount: wreckage.contents.length,
        despawnTime: wreckage.despawnTime
      });

      // Add wreckage to result for socket handler
      result.wreckage = wreckage;
    }

    // Broadcast NPC death with team info (use 'egg_pop' effect for hatching eggs)
    broadcastNearNpc(npcEntity, 'npc:destroyed', {
      id: npcId,
      destroyedBy: sourceId,
      participants: result.participants,
      participantCount: result.participantCount,
      teamMultiplier: result.teamMultiplier,
      creditsPerPlayer: result.creditsPerPlayer,
      faction: result.faction,
      deathEffect: wasHatchingEgg ? 'egg_pop' : (npcEntity.deathEffect || 'explosion'),
      wreckageId: wreckage ? wreckage.id : null
    });

    // Check for formation leader death (Void faction succession)
    if (npcEntity.formationLeader || (npcEntity.isBoss && npcEntity.faction === 'void')) {
      const formationInfo = npc.getFormationForNpc(npcId);
      if (formationInfo && formationInfo.memberIds.size > 0) {
        const successionResult = npc.handleLeaderDeath(formationInfo.formationId);
        if (successionResult.success && successionResult.newLeader) {
          voidFormationAI.setFormationState(
            formationInfo.formationId,
            'confusion',
            successionResult.newLeader.id
          );
          broadcastNearNpc(npcEntity, 'formation:leaderChange', {
            formationId: formationInfo.formationId,
            oldLeaderId: npcId,
            oldLeaderType: npcEntity.type,
            newLeaderId: successionResult.newLeader.id,
            newLeaderType: successionResult.newLeader.type,
            newLeaderName: successionResult.newLeader.name,
            newLeaderPosition: successionResult.newLeader.position,
            memberIds: successionResult.memberIds,
            confusionDuration: 1000,  // 1 second confusion
            reformationDuration: 2000  // 2 seconds to reform
          });
        }
      }
    }

    // Swarm Queen death - all nearby guards enter rage mode!
    if (npcEntity.type === 'swarm_queen') {
      const queenX = npcEntity.position?.x ?? npcEntity.x;
      const queenY = npcEntity.position?.y ?? npcEntity.y;

      // `damageNPC` has already removed the entity from the active registry,
      // but the singleton must also be cleared or the aura/guard systems keep
      // treating a dead Queen as authoritative forever.
      npc.handleQueenDeath(npcId);
      if (socketModule?.broadcastQueenDeath) {
        socketModule.broadcastQueenDeath(npcId, { x: queenX, y: queenY });
      }

      const rageRange = 500; // Guards within 500 units enter rage
      const rageDuration = 30000; // 30 seconds of rage
      const ragingGuards = [];

      for (const [guardId, guard] of npc.activeNPCs) {
        if (guard.faction !== 'swarm') continue;
        if (guard.type === 'swarm_queen') continue; // Skip the dying queen

        const guardX = guard.position?.x ?? guard.x;
        const guardY = guard.position?.y ?? guard.y;
        const dx = guardX - queenX;
        const dy = guardY - queenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= rageRange) {
          // Enter rage mode!
          guard.state = 'rage';
          guard.originalAggroRange = guard.originalAggroRange || guard.aggroRange || 200;
          guard.originalSpeed = guard.originalSpeed || guard.speed;
          guard.aggroRange = guard.originalAggroRange * 2; // Double aggro range
          guard.speed = guard.originalSpeed * 1.3; // 30% faster
          guard.rageExpires = Date.now() + rageDuration;
          guard.isGuarding = false; // No longer guarding dead queen

          ragingGuards.push({
            id: guardId,
            type: guard.type,
            x: guardX,
            y: guardY
          });
        }
      }

      // Broadcast rage event for visual feedback
      if (ragingGuards.length > 0) {
        broadcastNearNpc(npcEntity, 'swarm:queenDeathRage', {
          queenId: npcId,
          queenX: queenX,
          queenY: queenY,
          ragingGuards: ragingGuards,
          rageDuration: rageDuration
        });
      }
    }

    // Void Leviathan death - cleanup and start cooldown
    if (npcEntity.type === 'void_leviathan') {
      npc.handleLeviathanDeath(npcId);
    }

    // Void NPC death (non-Leviathan) - chance to spawn Leviathan
    if (npcEntity.faction === 'void' && npcEntity.type !== 'void_leviathan') {
      const leviathanSpawn = npc.checkLeviathanSpawn(npcEntity, npcEntity.position);
      if (leviathanSpawn) {
        // Broadcast the spawn sequence to nearby players
        const spawnPosition = leviathanSpawn.spawnPosition;
        broadcastInRange(spawnPosition, 2000, 'void:leviathanSpawn', {
          position: spawnPosition,
          sequenceDuration: leviathanSpawn.sequenceDuration
        });

        // Spawn the Leviathan after the cinematic sequence
        setTimeout(() => {
          // Double-check no leviathan spawned during the cinematic delay
          if (npc.getActiveLeviathan()) {
            npc.clearLeviathanPending();
            return;
          }
          const leviathan = npc.spawnVoidLeviathan(spawnPosition);
          if (leviathan) {
            // Broadcast the Leviathan emergence
            broadcastInRange(leviathan.position, 2000, 'npc:spawn', {
              id: leviathan.id,
              type: 'void_leviathan',
              name: leviathan.name,
              faction: 'void',
              x: leviathan.position.x,
              y: leviathan.position.y,
              hull: leviathan.hull,
              hullMax: leviathan.hullMax,
              shield: leviathan.shield,
              shieldMax: leviathan.shieldMax,
              isBoss: true,
              isLeviathan: true,
              fromRift: true,
              riftPosition: leviathan.riftPortal
            });
          } else {
            npc.clearLeviathanPending();
          }
        }, leviathanSpawn.sequenceDuration);
      }
    }

    return result;
  }

  // Broadcast NPC hit for damage feedback
  if (result) {
    broadcastNearNpc(npcEntity, 'combat:npcHit', {
      npcId: npcId,
      attackerId: sourceId,
      damage: Math.round(totalDamage),
      hull: result.hull,
      shield: result.shield,
      hitShield: result.hitShield
    });

    // Broadcast scavenger rage event if triggered
    if (result.rageAction && result.rageAction.action === 'scavenger:rage') {
      broadcastNearNpc(npcEntity, 'scavenger:rage', {
        npcId: result.rageAction.npcId,
        targetId: result.rageAction.targetId,
        reason: result.rageAction.reason,
        rageRange: result.rageAction.rageRange,
        x: npcEntity.position.x,
        y: npcEntity.position.y
      });
      logger.info(`[SCAVENGER] ${npcEntity.name} (${npcEntity.type}) enraged - targeting ${sourceId}`);
    }

    // Apply linked health damage for Swarm faction
    if (npcEntity.linkedHealth && npcEntity.faction === 'swarm') {
      const linkedResults = npc.applySwarmLinkedDamage(npcEntity, totalDamage, attackerId);

      if (linkedResults.length > 0) {
        // Broadcast linked damage event for visual feedback
        broadcastNearNpc(npcEntity, 'swarm:linkedDamage', {
          sourceId: npcId,
          sourceX: npcEntity.position.x,
          sourceY: npcEntity.position.y,
          affected: linkedResults.map(r => ({
            id: r.id,
            damage: Math.round(r.damage),
            destroyed: r.destroyed,
            hull: r.hull,
            hullMax: r.hullMax,
            x: r.position?.x ?? 0,
            y: r.position?.y ?? 0
          }))
        });

        // Handle any linked deaths
        for (const linked of linkedResults) {
          if (linked.destroyed) {
            handleLinkedSwarmDeath(linked, npcEntity, sourceId);
          }
        }
      }
    }
  }

  return result;
}

// Handle player attacking a faction base
function playerAttackBase(attackerId, baseId, weaponType, weaponTier) {
  // Get base info from world
  const baseObj = world.getObjectById(baseId);
  if (!baseObj) return null;

  // Defensive validation: verify base is active and not destroyed
  const activeBase = npc.getActiveBase(baseId);
  if (!activeBase) {
    logger.debug(`playerAttackBase: Base ${baseId} is not active`);
    return null;
  }
  if (activeBase.destroyed) {
    logger.debug(`playerAttackBase: Base ${baseId} is already destroyed`);
    return null;
  }

  // Get computed position for orbital bases (handles orbiting and binary star systems)
  // This ensures visual effects appear at the correct location where the base is rendered
  const computedPos = world.getObjectPosition(baseId);
  const currentX = computedPos ? computedPos.x : baseObj.x;
  const currentY = computedPos ? computedPos.y : baseObj.y;

  // Calculate damage using proper damage calculation
  const damage = combat.calculateDamage(weaponType, weaponTier, 1);
  let totalDamage = damage.shieldDamage + damage.hullDamage;
  totalDamage = calculateFactionDamage(
    totalDamage,
    activeBase.faction || baseObj.faction,
    playerHasRelic(statements, attackerId, 'VOID_CRYSTAL')
  );

  // Apply damage to base with attacker tracking
  const result = npc.damageBase(baseId, totalDamage, attackerId);

  if (result && result.destroyed) {
    // Generate loot for the base
    const baseLoot = result.loot;
    const destroyedBaseType = result.baseType || activeBase.type || baseObj.type;
    const destroyedFaction = result.faction || activeBase.faction || baseObj.faction;
    const destroyedBaseName = result.baseName || activeBase.name || baseObj.name;

    // Create wreckage-like object for the base
    // Note: creditReward is 0 because credits are already awarded at destruction time
    // (see socket.js combat:fire handler for bases). Wreckage only contains resource loot.
    const wreckageContributors = new Map(
      (result.participants || []).map(participantId => [participantId, 1])
    );
    const wreckage = loot.spawnWreckage({
      id: baseId,
      name: destroyedBaseName,
      faction: destroyedFaction,
      type: destroyedBaseType,
      creditReward: 0
    }, { x: currentX, y: currentY }, baseLoot, wreckageContributors, { source: 'base' });

    // Broadcast base destruction with team info and visual data
    // Use computed position for broadcasting range check and visual coordinates
    broadcastNearBase({ ...baseObj, x: currentX, y: currentY }, 'base:destroyed', {
      id: baseId,
      destroyedBy: attackerId,
      participants: result.participants,
      participantCount: result.participantCount,
      teamMultiplier: result.teamMultiplier,
      creditsPerPlayer: result.creditsPerPlayer,
      faction: destroyedFaction,
      respawnTime: result.respawnTime,
      wreckageId: wreckage.id,
      // Visual data for destruction sequence
      x: currentX,
      y: currentY,
      baseType: destroyedBaseType,
      size: baseObj.size || 80,
      // Assimilation drones that died with the base (client should remove worm visuals)
      destroyedDrones: result.destroyedDrones || []
    });

    // Broadcast wreckage spawn
    broadcastWreckageNear(wreckage, 'wreckage:spawn', {
      id: wreckage.id,
      x: wreckage.position.x,
      y: wreckage.position.y,
      size: wreckage.size,
      source: wreckage.source,
      faction: wreckage.faction,
      npcType: wreckage.npcType,
      npcName: wreckage.npcName,
      contentCount: wreckage.contents.length,
      despawnTime: wreckage.despawnTime
    });

    // damageBase transitions surviving Dreadnoughts directly into their
    // permanent enraged state, so the ordinary AI action branch is bypassed.
    // Announce that transition at the same authoritative destruction point.
    for (const orphanedNpcId of result.orphanedNpcIds || []) {
      const orphanedNpc = npc.getNPC(orphanedNpcId);
      if (orphanedNpc?.type !== 'pirate_dreadnought' ||
          orphanedNpc.state !== 'enraged') {
        continue;
      }
      broadcastInRange(orphanedNpc.position, 3000, 'pirate:dreadnoughtEnraged', {
        npcId: orphanedNpc.id,
        x: orphanedNpc.position.x,
        y: orphanedNpc.position.y,
        destroyedBaseId: baseId,
        timestamp: Date.now()
      });
    }

    // Add wreckage to result for socket handler
    result.wreckage = wreckage;

    return result;
  }

  // Broadcast base damage for feedback
  if (result) {
    // Use computed position for broadcasting range check and visual coordinates
    broadcastNearBase({ ...baseObj, x: currentX, y: currentY }, 'base:damaged', {
      baseId: baseId,
      attackerId: attackerId,
      damage: Math.round(totalDamage),
      health: result.health,
      maxHealth: result.maxHealth,
      x: currentX,
      y: currentY,
      faction: activeBase.faction || baseObj.faction,
      size: baseObj.size || 80
    });
  }

  return result;
}

function broadcastNearBase(base, event, data) {
  if (!connectedPlayers) return;

  const baseSize = base.size || 100;

  for (const [socketId, player] of connectedPlayers) {
    const dx = player.position.x - base.x;
    const dy = player.position.y - base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Use player's tier-based broadcast range, accounting for base size
    const broadcastRange = getPlayerBroadcastRange(player);
    if (dist - baseSize <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

// Wreckage collection handlers
function startWreckageCollection(wreckageId, playerId) {
  return loot.startCollection(wreckageId, playerId);
}

function updateWreckageCollection(wreckageId, playerId, deltaTime) {
  return loot.updateCollection(wreckageId, playerId, deltaTime);
}

function cancelWreckageCollection(wreckageId, playerId) {
  loot.cancelCollection(wreckageId, playerId);
}

function getWreckageInRange(position, range) {
  return loot.getWreckageInRange(position, range);
}

function getWreckage(wreckageId) {
  return loot.getWreckage(wreckageId);
}

function removeWreckage(wreckageId) {
  return loot.removeWreckage(wreckageId);
}

function getAllNPCs() {
  return npc.activeNPCs;
}

// === Player Spatial Hash Management ===
// These functions maintain the player spatial hash used by broadcast functions.
// Called from socket handlers on auth, movement, and disconnect.

function insertPlayerInHash(socketId, player) {
  // Clear stale delta-compression state to prevent incorrect updates if socketId is reused
  playerLastSeen.delete(socketId);
  playerSpatialHash.insert(socketId, player.position.x, player.position.y);
}

function removePlayerFromHash(socketId) {
  playerSpatialHash.remove(socketId);
}

function updatePlayerInHash(socketId, player) {
  playerSpatialHash.update(socketId, player.position.x, player.position.y);
}

module.exports = {
  init,
  start,
  stop,
  playerAttackNPC,
  playerAttackBase,
  startWreckageCollection,
  updateWreckageCollection,
  cancelWreckageCollection,
  getWreckageInRange,
  getWreckage,
  removeWreckage,
  getAllNPCs,
  getPlayerRadarRange,
  getPlayerBroadcastRange,
  getPlayerBaseActivationRange,
  getNpcSimulationRange,
  shouldSimulateNpc,
  clearMissingRetainedPlayerTargets,
  includeRetainedNpcTargetPlayer,
  updateNPCs,
  updateNpcVelocity,
  handleNpcFireAtNpc,
  buildStrategicContacts,
  broadcastNearbyBasesToPlayers,
  broadcastNearNpc,
  broadcastInRange,
  broadcastBaseAssimilated,
  queueNpcUpdate,
  flushNpcBatches,
  getSlowModifier,
  getPlayerDebuffSnapshot,
  canPlayerTakeDamage,
  applyQueenAcidBurstDamage,
  loot,
  insertPlayerInHash,
  removePlayerFromHash,
  updatePlayerInHash
};
