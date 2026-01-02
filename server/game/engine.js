// Galaxy Miner - Game Engine (Server-side tick loop)

const config = require('../config');
const npc = require('./npc');
const combat = require('./combat');
const mining = require('./mining');
const loot = require('./loot');
const world = require('../world');
const starDamage = require('./star-damage');
const logger = require('../../shared/logger');
const Physics = require('../../shared/physics');

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
  return 1.0 - debuffs.slow.percent;
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
  // Get death position BEFORE any changes
  const deathPosition = { x: player.position.x, y: player.position.y };

  // Handle death with position for wreckage (no longer respawns immediately)
  const deathResult = combat.handleDeath(player.id, deathPosition);

  // Spawn player wreckage if there's anything to drop
  if (deathResult.wreckageContents && deathResult.wreckageContents.length > 0) {
    const playerEntity = {
      type: 'player',
      name: deathResult.playerName || player.username || 'Unknown',
      faction: null,
      creditReward: 0
    };

    const wreckage = loot.spawnWreckage(
      playerEntity,
      deathPosition,
      deathResult.wreckageContents,
      null, // No damage contributors for player wreckage
      { source: 'player', playerId: player.id }
    );

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

  // Emit death event with respawn OPTIONS (player chooses where to respawn)
  io.to(socketId).emit('player:death', {
    killedBy,
    // Enhanced killer info for better death messaging
    cause: killerInfo.cause || 'unknown',
    killerType: killerInfo.type || 'unknown',
    killerName: killerInfo.name || null,
    killerFaction: killerInfo.faction || null,
    // Death position for replay/visualization
    deathPosition,
    // Cargo lost info
    droppedCargo: deathResult.droppedCargo,
    wreckageSpawned: deathResult.wreckageContents && deathResult.wreckageContents.length > 0,
    // Respawn options for player to choose from
    respawnOptions: deathResult.respawnOptions
  });

  // Mark player as dead - DON'T respawn immediately, wait for respawn:select event
  player.isDead = true;
  player.deathTime = Date.now();
  player.deathPosition = deathPosition;

  return deathResult;
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

// === ACTIVATION AND BROADCAST RANGES ===
// Max tier 5 radar broadcast range: BASE_RADAR_RANGE * 1.5^4 * 2 = 500 * 5.0625 * 2 = ~5062
const MAX_TIER_BROADCAST_RANGE = config.BASE_RADAR_RANGE *
  Math.pow(config.TIER_MULTIPLIER, (config.MAX_TIER || 5) - 1) * 2;
// Add margin for sector boundary smoothing
const BASE_ACTIVATION_RANGE = Math.max(config.SECTOR_SIZE * 3, MAX_TIER_BROADCAST_RANGE + 500);
const BASE_BROADCAST_RANGE = BASE_ACTIVATION_RANGE;

// Calculate broadcast range for a player based on their radar tier
function getPlayerBroadcastRange(player) {
  const radarTier = player.radarTier || 1;
  const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, radarTier - 1);
  return radarRange * 2;
}

function init(socketIo, players, sockModule) {
  io = socketIo;
  connectedPlayers = players;
  socketModule = sockModule;
}

function start() {
  if (running) return;
  running = true;
  lastTickTime = Date.now();
  tick();
  logger.log('Game engine started');
}

function stop() {
  running = false;
  logger.log('Game engine stopped');
}

function tick() {
  if (!running) return;

  const now = Date.now();
  const deltaTime = now - lastTickTime;
  lastTickTime = now;

  // Update all game systems
  updatePlayers(deltaTime);
  updateBases(deltaTime);  // Check for bases near players and spawn NPCs
  updateNPCs(deltaTime);
  updateMining(deltaTime);
  updateWreckage(deltaTime);
  updateStarDamage(deltaTime);  // Apply star heat damage
  updateComets(deltaTime);  // Comet hazard collision detection
  broadcastNearbyBasesToPlayers(now);  // Send base positions for radar

  // Schedule next tick
  const tickInterval = 1000 / config.SERVER_TICK_RATE;
  const elapsed = Date.now() - now;
  const delay = Math.max(0, tickInterval - elapsed);
  setTimeout(tick, delay);
}

function updatePlayers(deltaTime) {
  if (!connectedPlayers) return;

  // Update shield recharge for all players
  for (const [socketId, player] of connectedPlayers) {
    const shieldUpdate = combat.updateShieldRecharge(player.id, deltaTime);
    if (shieldUpdate) {
      player.shield = shieldUpdate.shield;
      // Notify player of shield update
      io.to(socketId).emit('player:health', {
        hull: player.hull,
        shield: player.shield
      });
    }

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
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  const players = [...connectedPlayers.values()];
  const now = Date.now();
  const BASE_DEACTIVATION_TIME = 60000; // 1 minute without nearby players

  // Find all sectors with players and get bases from those sectors
  // Use Map to store sector coordinates directly, avoiding string parsing in loop
  const activeSectors = new Map();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors (5x5 grid to match client rendering range)
    const ACTIVE_SECTOR_RADIUS = 2;
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
      for (const player of players) {
        const dx = player.position.x - baseX;
        const dy = player.position.y - baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BASE_ACTIVATION_RANGE) {
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
                broadcastNearNpc(npcEntity, 'npc:spawn', {
                  id: npcEntity.id,
                  type: npcEntity.type,
                  name: npcEntity.name,
                  faction: npcEntity.faction,
                  x: npcEntity.position.x,
                  y: npcEntity.position.y,
                  rotation: npcEntity.rotation,
                  hull: npcEntity.hull,
                  hullMax: npcEntity.hullMax,
                  shield: npcEntity.shield,
                  shieldMax: npcEntity.shieldMax
                });
              }
            }
          }
        }
        lastBaseCheck.set(base.id, now);
      } else {
        // Check if base should be deactivated
        const lastCheck = lastBaseCheck.get(base.id) || 0;
        if (now - lastCheck > BASE_DEACTIVATION_TIME && npc.activeBases.has(base.id)) {
          npc.deactivateBase(base.id);
          lastBaseCheck.delete(base.id);
        }
      }
    }
  }

  // Update base spawning for all active bases
  npc.updateBaseSpawning(players);

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
        broadcastNearNpc(npcEntity, 'npc:spawn', {
          id: npcEntity.id,
          type: npcEntity.type,
          name: npcEntity.name,
          faction: npcEntity.faction,
          x: npcEntity.position.x,
          y: npcEntity.position.y,
          rotation: npcEntity.rotation,
          hull: npcEntity.hull,
          hullMax: npcEntity.hullMax,
          shield: npcEntity.shield,
          shieldMax: npcEntity.shieldMax
        });
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
          // Broadcast base respawn to nearby players
          broadcastNearBase(baseObj, 'base:respawn', {
            id: baseId,
            x: baseObj.x,
            y: baseObj.y,
            size: baseObj.size,
            type: baseObj.type,
            faction: baseObj.faction,
            name: baseObj.name,
            health: activeBase.health,
            maxHealth: activeBase.maxHealth
          });
        }
      }
    }
  }
}

function updateNPCs(deltaTime) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  // Get all player positions for NPC AI
  const players = [...connectedPlayers.values()];

  // Find active sectors (where players are)
  // Use Map to store sector coordinates directly, avoiding string parsing in loop
  const activeSectors = new Map();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors
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

  // Spawn NPCs in active sectors
  for (const [sectorKey, coords] of activeSectors) {
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
    // Check if NPC is in an active sector
    const npcSectorX = Math.floor(npcEntity.position.x / config.SECTOR_SIZE);
    const npcSectorY = Math.floor(npcEntity.position.y / config.SECTOR_SIZE);
    const npcSectorKey = `${npcSectorX}_${npcSectorY}`;

    if (!activeSectors.has(npcSectorKey)) {
      // NPC is in inactive sector, skip update
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
      // Broadcast the NPC update (state will be 'hatching' until complete)
      broadcastNearNpc(npcEntity, 'npc:update', {
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
        shieldMax: npcEntity.shieldMax
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
    const nearbyPlayers = players.filter(p => {
      // Don't target dead players
      if (p.isDead) return false;

      const dx = p.position.x - npcEntity.position.x;
      const dy = p.position.y - npcEntity.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= npcEntity.aggroRange;
    });

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

          const SwarmStrategy = require('./ai/swarm');
          const swarmAI = new SwarmStrategy();
          const assimAction = swarmAI.updateAssimilateBehavior(npcEntity, targetBase, deltaTime);

          if (assimAction && assimAction.action === 'assimilate') {
            // Process the drone sacrifice
            logger.info(`[ASSIMILATE] Drone ${assimAction.droneId} attempting to assimilate base ${assimAction.baseId}`);
            const result = npc.processDroneAssimilation(assimAction.droneId, assimAction.baseId);
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
                progress: result.progress,
                threshold: result.threshold,
                position: assimAction.position // For client visual effects
              });

              // If base was converted (check isComplete flag)
              logger.info(`[ASSIMILATE] Checking conversion: isComplete=${result.isComplete}, hasConversion=${!!result.conversion}`);
              if (result.isComplete && result.conversion) {
                logger.info(`[ASSIMILATE] Base converted! Broadcasting and checking queen spawn...`);
                socketModule.broadcastBaseAssimilated({
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

    // Update NPC shield recharge
    npc.updateNPCShieldRecharge(npcEntity, deltaTime);

    // Check for queen guard mode for swarm NPCs
    const activeQueen = npc.getActiveQueen();
    if (activeQueen && npcEntity.faction === 'swarm' && npcEntity.type !== 'swarm_queen') {
      const SwarmStrategy = require('./ai/swarm');
      const swarmAI = new SwarmStrategy();

      if (swarmAI.shouldGuardQueen(npcEntity, activeQueen)) {
        // Normalize queen position (handle both queen.position.x and queen.x formats)
        const queenX = activeQueen.position?.x ?? activeQueen.x;
        const queenY = activeQueen.position?.y ?? activeQueen.y;
        const guardRange = config.SWARM_QUEEN_SPAWN?.QUEEN_GUARD_RANGE ?? 500;

        // Get nearby guards for formation spacing
        const nearbyGuards = [];
        for (const [otherId, otherNpc] of npc.activeNPCs) {
          if (otherId !== npcId && otherNpc.faction === 'swarm' && otherNpc.type !== 'swarm_queen') {
            const dx = otherNpc.position.x - queenX;
            const dy = otherNpc.position.y - queenY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= guardRange) {
              nearbyGuards.push(otherNpc);
            }
          }
        }

        // Use queen guard AI instead of normal combat
        const guardAction = swarmAI.updateQueenGuard(
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
      shieldMax: npcEntity.shieldMax
    };

    // Include wreckage collection position for tractor beam animation
    if (npcEntity.collectingWreckagePos) {
      npcUpdateData.collectingWreckagePos = npcEntity.collectingWreckagePos;
    }

    // Include mining target position for rogue miner beam animation
    if (npcEntity.miningTargetPos) {
      npcUpdateData.miningTargetPos = npcEntity.miningTargetPos;
    }

    broadcastNearNpc(npcEntity, 'npc:update', npcUpdateData);

    // Handle NPC actions
    if (action && action.action === 'fire') {
      // NPC fired at player - use proper damage calculation
      const targetPlayer = action.target;

      // CRITICAL: Skip if target player is already dead
      // Prevents looping death events from multiple NPCs hitting same dead player
      if (targetPlayer.isDead) {
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

      // Scale by NPC's base damage factor (weaponDamage / BASE_WEAPON_DAMAGE ratio)
      const damageMultiplier = action.baseDamage / config.BASE_WEAPON_DAMAGE;
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
        // Update player state
        targetPlayer.hull = result.hull;
        targetPlayer.shield = result.shield;

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

        // Find player socket
        for (const [socketId, p] of connectedPlayers) {
          if (p.id === targetPlayer.id) {
            io.to(socketId).emit('player:damaged', {
              attackerId: npcId,
              attackerType: 'npc',
              damage: totalDamage,
              hull: result.hull,
              shield: result.shield
            });

            if (result.isDead) {
              // Handle player death with wreckage spawning
              handlePlayerDeathWithWreckage(targetPlayer, npcEntity.name, socketId, {
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
          const dx = player.position.x - action.targetX;
          const dy = player.position.y - action.targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= action.radius) {
            // Apply initial damage
            const initialDamage = { shieldDamage: action.damage * 0.5, hullDamage: action.damage * 0.5 };
            const result = combat.applyDamage(player.id, initialDamage);

            if (result) {
              player.hull = result.hull;
              player.shield = result.shield;

              io.to(socketId).emit('player:damaged', {
                attackerId: npcId,
                attackerType: 'npc',
                damage: action.damage,
                hull: result.hull,
                shield: result.shield,
                damageType: 'acid'
              });
            }

            // Apply DoT debuff
            applyDebuff(player.id, 'dot', {
              damage: action.dotDamage,
              interval: action.dotInterval || 1000,
              duration: action.dotDuration,
              sourceId: npcId,
              type: 'acid'
            });

            // Notify player of DoT
            io.to(socketId).emit('player:debuff', {
              type: 'dot',
              dotType: 'acid',
              damage: action.dotDamage,
              duration: action.dotDuration,
              source: 'swarm_queen'
            });
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
        sizeMultiplier: action.sizeMultiplier
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
      const hauler = npc.getNPC(npcId);
      if (hauler && hauler.type === 'scavenger_hauler') {
        // Create Barnacle King at Hauler position
        const kingType = npc.NPC_TYPES.scavenger_barnacle_king;
        const kingId = `npc_barnacle_king_${Date.now()}`;

        const barnacleKing = {
          id: kingId,
          type: 'scavenger_barnacle_king',
          name: kingType.name,
          faction: 'scavenger',
          position: { x: hauler.position.x, y: hauler.position.y },
          x: hauler.position.x,
          y: hauler.position.y,
          vx: 0,
          vy: 0,
          rotation: hauler.rotation,
          hull: kingType.hull,
          hullMax: kingType.hull,
          maxHull: kingType.hull,
          shield: kingType.shield,
          shieldMax: kingType.shield,
          maxShield: kingType.shield,
          speed: kingType.speed,
          weaponType: kingType.weaponType,
          weaponTier: kingType.weaponTier,
          weaponDamage: kingType.weaponDamage,
          weaponRange: kingType.weaponRange,
          aggroRange: kingType.aggroRange,
          lastFireTime: 0,
          state: 'patrol',
          targetId: null,
          isBoss: true,
          damageContributors: new Map(),
          // Inherit wreckage contents from Hauler
          carriedWreckage: hauler.carriedWreckage || [],
          // Inherit homeBase if Hauler had one
          homeBaseId: hauler.homeBaseId,
          homeBasePosition: hauler.homeBasePosition,
          patrolRadius: hauler.patrolRadius,
          spawnPoint: hauler.spawnPoint
        };

        // Add to active NPCs
        npc.activeNPCs.set(kingId, barnacleKing);

        // Remove Hauler from activeNPCs
        npc.activeNPCs.delete(npcId);

        // Broadcast transformation
        broadcastNearNpc(barnacleKing, 'scavenger:barnacleKingSpawn', {
          kingId: kingId,
          haulerId: npcId,
          x: barnacleKing.position.x,
          y: barnacleKing.position.y,
          rotation: barnacleKing.rotation,
          hull: barnacleKing.hull,
          hullMax: barnacleKing.hullMax,
          wreckageCount: barnacleKing.carriedWreckage.length
        });

        logger.info(`[SCAVENGER] Hauler ${npcId} transformed into Barnacle King ${kingId} at (${Math.round(barnacleKing.x)}, ${Math.round(barnacleKing.y)})`);
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
        broadcastNearNpc(spawnedNPC, 'npc:spawn', {
          npc: {
            id: spawnedNPC.id,
            type: spawnedNPC.type,
            name: spawnedNPC.name,
            faction: spawnedNPC.faction,
            x: spawnedNPC.position.x,
            y: spawnedNPC.position.y,
            rotation: spawnedNPC.rotation,
            hull: spawnedNPC.hull,
            hullMax: spawnedNPC.hullMax,
            shield: spawnedNPC.shield,
            shieldMax: spawnedNPC.shieldMax,
            isBoss: spawnedNPC.isBoss
          }
        });

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
      broadcastNearNpc(npcEntity, 'npc:action', {
        action: 'rage',
        faction: 'rogue_miner',
        triggeredBy: action.triggeredBy,
        targetId: action.targetId,
        enragedNPCs: action.enragedNPCs,
        rageRange: action.rageRange
      });
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
        targetInfo: action.targetInfo,
        alertedPirateCount: action.alertedPirates?.length || 0,
        baseId: action.baseId,
        timestamp: Date.now()
      });
      logger.log(`[PIRATE] Scout ${npcId} broadcast intel to ${action.alertedPirates?.length || 0} pirates`);
    } else if (action && action.action === 'pirate:boostDive') {
      // ============================================
      // PIRATE: Fighter/Dreadnought performing boost dive attack
      // ============================================
      broadcastNearNpc(npcEntity, 'pirate:boostDive', {
        npcId: npcId,
        npcType: npcEntity.type,
        startX: action.startX,
        startY: action.startY,
        targetX: action.targetX,
        targetY: action.targetY,
        speedMultiplier: action.speedMultiplier || 2.5,
        duration: action.duration
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
        healRate: action.healRate
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
        if (!player || player.isDead) continue;

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
            // Broadcast the consumed NPC's destruction
            broadcastNearNpc(consumedNpc, 'npc:destroyed', {
              npcId: action.targetNpcId,
              x: consumedNpc.position.x,
              y: consumedNpc.position.y,
              faction: consumedNpc.faction,
              deathEffect: 'void_consume'
            });
            npc.activeNPCs.delete(action.targetNpcId);
          }
        }
      }
    } else if (action && action.action === 'void_spawn_minions') {
      // ============================================
      // VOID LEVIATHAN: Spawn minions from rifts
      // ============================================
      broadcastNearNpc(npcEntity, 'void:spawnMinions', {
        leviathanId: action.leviathanId,
        position: action.position,
        riftCount: action.riftCount,
        trigger: action.trigger,
        healthThreshold: action.healthThreshold
      });

      // Spawn void_whispers from rifts (delayed for visual effect)
      const minionConfig = config.VOID_LEVIATHAN_MINIONS;
      const minionsPerRift = minionConfig?.minionsPerRift || { min: 1, max: 2 };

      setTimeout(() => {
        for (let i = 0; i < action.riftCount; i++) {
          // Spawn rifts in a circle around the Leviathan
          const angle = (i / action.riftCount) * Math.PI * 2;
          const distance = 150 + Math.random() * 100;
          const riftX = action.position.x + Math.cos(angle) * distance;
          const riftY = action.position.y + Math.sin(angle) * distance;

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
      broadcastNearNpc(npcEntity, 'void:riftRetreat', {
        npcId: action.npcId,
        riftPosition: action.riftPosition,
        npcType: action.npcType
      });

      // Store NPC data for respawn before deletion
      const retreatingNpc = npc.activeNPCs.get(action.npcId);

      // Skip if already scheduled for respawn (prevent duplicate timers)
      if (scheduledRiftRespawns.has(action.npcId)) {
        continue;
      }

      // Don't respawn Leviathans through rift retreat - they have their own spawn system
      if (retreatingNpc && retreatingNpc.type === 'void_leviathan') {
        // Mark for removal after rift animation
        setTimeout(() => {
          npc.activeNPCs.delete(action.npcId);
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

      // Mark as scheduled
      scheduledRiftRespawns.add(action.npcId);

      // Mark for removal after rift animation
      setTimeout(() => {
        npc.activeNPCs.delete(action.npcId);
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
    npc.activeNPCs.delete(npcId);
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
}

function updateMining(deltaTime) {
  // Mining updates are handled per-player when they send mining events
  // This could be used for mining progress broadcasts if needed
}

function updateWreckage(deltaTime) {
  // Cleanup expired wreckage
  const expired = loot.cleanupExpiredWreckage();

  // Notify players of despawned wreckage
  for (const wreckageId of expired) {
    if (io) {
      io.emit('wreckage:despawn', { id: wreckageId });
    }
  }
}

function updateStarDamage(deltaTime) {
  // Apply heat damage from stars to nearby players
  starDamage.update(connectedPlayers, io, deltaTime);
}

// Track comet warnings to avoid spamming
const cometWarningsSent = new Map(); // cometId -> lastWarningTime

function updateComets(deltaTime) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  const players = [...connectedPlayers.values()];
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
  for (const [sectorKey, coords] of activeSectors) {
    const sector = world.generateSector(coords.x, coords.y);
    if (!sector.comets || sector.comets.length === 0) continue;

    for (const comet of sector.comets) {
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
    // Use the larger of radar range or broadcast range for consistent sync
    // This ensures players see bases even at sector edges
    const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, (player.radarTier || 1) - 1);
    const syncRange = Math.max(radarRange, BASE_BROADCAST_RANGE);

    // Get bases within sync range (using existing npc.getBasesInRange)
    const nearbyBases = npc.getBasesInRange(player.position, syncRange);

    // Only send if there are bases to report
    if (nearbyBases.length > 0) {
      io.to(socketId).emit('bases:nearby', nearbyBases);
    }
  }
}

function broadcastWreckageNear(wreckage, event, data) {
  if (!connectedPlayers) return;

  for (const [socketId, player] of connectedPlayers) {
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

function broadcastNearNpc(npcEntity, event, data) {
  if (!connectedPlayers) return;

  for (const [socketId, player] of connectedPlayers) {
    const dx = player.position.x - npcEntity.position.x;
    const dy = player.position.y - npcEntity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Use player's tier-based broadcast range
    const broadcastRange = getPlayerBroadcastRange(player);
    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

// Broadcast to all players within a fixed range of a position
function broadcastInRange(position, range, event, data) {
  if (!connectedPlayers) return;

  for (const [socketId, player] of connectedPlayers) {
    const dx = player.position.x - position.x;
    const dy = player.position.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= range) {
      io.to(socketId).emit(event, data);
    }
  }
}

// Handle player attacking NPC
// damageOverride: optional parameter to override damage calculation (used for chain lightning falloff)
function playerAttackNPC(attackerId, npcId, weaponType, weaponTier, damageOverride) {
  const npcEntity = npc.getNPC(npcId);
  if (!npcEntity) return null;

  // DREADNOUGHT INVULNERABILITY CHECK
  // Pirate dreadnoughts have a chance to negate all damage
  if (npcEntity.type === 'pirate_dreadnought' && npcEntity.invulnerableChance) {
    if (Math.random() < npcEntity.invulnerableChance) {
      // Damage blocked - broadcast invulnerable effect
      logger.log(`[PIRATE] Dreadnought ${npcId} invulnerable proc! Broadcasting to nearby players.`);
      broadcastNearNpc(npcEntity, 'npc:invulnerable', {
        npcId: npcId,
        x: npcEntity.position.x,
        y: npcEntity.position.y,
        attackerId: attackerId
      });
      return { blocked: true, invulnerable: true, npcId };
    }
  }

  // Calculate damage using proper damage calculation, or use override if provided
  let totalDamage;
  if (typeof damageOverride === 'number' && damageOverride > 0) {
    totalDamage = damageOverride;
  } else {
    const damage = combat.calculateDamage(weaponType, weaponTier, 1);
    totalDamage = damage.shieldDamage + damage.hullDamage;
  }

  // Apply damage to NPC with attacker tracking
  const result = npc.damageNPC(npcId, totalDamage, attackerId);

  if (result && result.destroyed) {
    // Check if this was an attached assimilation drone
    if (npcEntity.attachedToBase) {
      const detachResult = npc.detachDroneFromBase(npcId);
      if (detachResult && socketModule) {
        // Broadcast the detachment so clients know the assimilation progress changed
        socketModule.broadcastAssimilationProgress({
          baseId: detachResult.baseId,
          attachedCount: detachResult.remainingDrones,
          threshold: detachResult.threshold,
          droneKilled: npcId,
          killedBy: attackerId
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
      destroyedBy: attackerId,
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
      attackerId: attackerId,
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
      logger.info(`[SCAVENGER] ${npcEntity.name} (${npcEntity.type}) enraged - targeting ${attackerId}`);
    }

    // Apply linked health damage for Swarm faction
    if (npcEntity.linkedHealth && npcEntity.faction === 'swarm') {
      const linkedResults = npc.applySwarmLinkedDamage(npcEntity, totalDamage);

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
            x: npc.getNPC(r.id)?.position?.x || 0,
            y: npc.getNPC(r.id)?.position?.y || 0
          }))
        });

        // Handle any linked deaths
        for (const linked of linkedResults) {
          if (linked.destroyed) {
            const linkedNpc = npc.getNPC(linked.id);
            if (linkedNpc) {
              // Spawn wreckage for linked death (inherit parent NPC's damage contributors for team credit)
              const wreckage = loot.spawnWreckage(linkedNpc, linkedNpc.position, null, npcEntity.damageContributors);

              broadcastNearNpc(linkedNpc, 'npc:destroyed', {
                id: linked.id,
                destroyedBy: attackerId,
                participants: [attackerId],
                participantCount: 1,
                teamMultiplier: 1,
                creditsPerPlayer: linkedNpc.creditReward || 0,
                faction: linkedNpc.faction,
                deathEffect: linkedNpc.deathEffect || 'dissolve',
                wreckageId: wreckage.id,
                linkedDeath: true
              });

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

  // Calculate damage using proper damage calculation
  const damage = combat.calculateDamage(weaponType, weaponTier, 1);
  const totalDamage = damage.shieldDamage + damage.hullDamage;

  // Apply damage to base with attacker tracking
  const result = npc.damageBase(baseId, totalDamage, attackerId);

  if (result && result.destroyed) {
    // Generate loot for the base
    const baseLoot = result.loot;

    // Create wreckage-like object for the base
    // Note: creditReward is 0 because credits are already awarded at destruction time
    // (see socket.js combat:fire handler for bases). Wreckage only contains resource loot.
    const wreckage = loot.spawnWreckage({
      id: baseId,
      name: baseObj.name,
      faction: baseObj.faction,
      type: 'base',
      creditReward: 0
    }, { x: baseObj.x, y: baseObj.y }, baseLoot, null);

    // Broadcast base destruction with team info and visual data
    broadcastNearBase(baseObj, 'base:destroyed', {
      id: baseId,
      destroyedBy: attackerId,
      participants: result.participants,
      participantCount: result.participantCount,
      teamMultiplier: result.teamMultiplier,
      creditsPerPlayer: result.creditsPerPlayer,
      faction: baseObj.faction,
      respawnTime: result.respawnTime,
      wreckageId: wreckage.id,
      // Visual data for destruction sequence
      x: baseObj.x,
      y: baseObj.y,
      baseType: baseObj.type,
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

    // Add wreckage to result for socket handler
    result.wreckage = wreckage;

    return result;
  }

  // Broadcast base damage for feedback
  if (result) {
    broadcastNearBase(baseObj, 'base:damaged', {
      baseId: baseId,
      attackerId: attackerId,
      damage: Math.round(totalDamage),
      health: result.health,
      maxHealth: result.maxHealth,
      x: baseObj.x,
      y: baseObj.y,
      faction: baseObj.faction,
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
  loot
};
