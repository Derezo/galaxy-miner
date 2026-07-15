'use strict';

/**
 * Player Socket Handler
 * Events: player:input, respawn:select
 */

const config = require('../config');
const { statements } = require('../database');
const combat = require('../game/combat');
const { normalizeRotation, validatePlayerInput } = require('../validators');
const {
  setPlayerBoostAuthority,
  clearPlayerBoostAuthority
} = require('./boost-authority');
const logger = require('../../shared/logger');

const MOVEMENT_PREDICTION_CUSHION = 1.25;
const MOVEMENT_BURST_WINDOW_MS = 250;
const BOOST_INERTIA_GRACE_MS = 2000;

function getPlayerTier(player, key) {
  return Math.max(
    1,
    Math.min(config.MAX_TIER || 5, Number(player[key]) || 1)
  );
}

function playerHasWarpDrive(player) {
  if (Array.isArray(player.relicTypes) && player.relicTypes.includes('SUBSPACE_WARP_DRIVE')) {
    return true;
  }

  try {
    return !!statements.hasRelic?.get(player.id, 'SUBSPACE_WARP_DRIVE');
  } catch (_error) {
    return false;
  }
}

function updateBoostAuthority(player, requested, now) {
  if (now < (player.serverBoostRecoveryEndAt || 0)) return true;
  if (!requested || now < (player.serverBoostCooldownEndAt || 0)) return false;

  const energyCoreTier = getPlayerTier(player, 'energyCoreTier');
  const boostConfig = config.ENERGY_CORE?.BOOST || {};
  let duration = Number(boostConfig.DURATION?.[energyCoreTier]) || 1000;
  let cooldown = Number(boostConfig.COOLDOWN?.[energyCoreTier]) || 15000;

  if (playerHasWarpDrive(player)) {
    const effects = config.RELIC_TYPES?.SUBSPACE_WARP_DRIVE?.effects || {};
    duration *= Number(effects.boostDurationMultiplier) || 2.5;
    cooldown *= Number(effects.boostCooldownMultiplier) || 0.75;
  }

  duration = Math.max(0, Math.round(duration));
  cooldown = Math.max(duration, Math.round(cooldown));
  player.serverBoostEndAt = now + duration;
  player.serverBoostRecoveryEndAt = player.serverBoostEndAt + BOOST_INERTIA_GRACE_MS;
  player.serverBoostCooldownEndAt = now + cooldown;
  setPlayerBoostAuthority(player.id, {
    boostEndAt: player.serverBoostEndAt,
    recoveryEndAt: player.serverBoostRecoveryEndAt,
    cooldownEndAt: player.serverBoostCooldownEndAt
  });
  return true;
}

function getMovementSpeedLimit(player, boostEnvelopeActive) {
  const engineTier = Math.max(
    1,
    Math.min(config.MAX_TIER || 5, Number(player.engineTier) || 1)
  );
  const energyCoreTier = Math.max(
    1,
    Math.min(config.MAX_TIER || 5, Number(player.energyCoreTier) || 1)
  );
  const boostMultipliers = config.ENERGY_CORE?.BOOST?.SPEED_MULTIPLIER || [];
  const maximumBoostMultiplier = Math.max(
    1,
    Number(boostMultipliers[energyCoreTier]) || 1
  );
  const boostMultiplier = boostEnvelopeActive ? maximumBoostMultiplier : 1;

  return (config.BASE_SPEED || 150) *
    Math.pow(config.TIER_MULTIPLIER || 1.5, engineTier - 1) * boostMultiplier;
}

/**
 * Token-bucket movement envelope. Time refills a bounded displacement budget;
 * packets never receive a fresh minimum allowance merely by arriving.
 */
function consumeMovementBudget(player, displacement, maxSpeed, now) {
  const syncInterval = config.POSITION_SYNC_RATE || 50;
  const tolerance = config.POSITION_SYNC_TOLERANCE || 30;
  const refillRate = maxSpeed * MOVEMENT_PREDICTION_CUSHION;
  const capacity = refillRate * (MOVEMENT_BURST_WINDOW_MS / 1000) + tolerance;
  const initialBudget = refillRate * (syncInterval / 1000) + tolerance;
  const previousBudgetAt = Number.isFinite(player.movementBudgetAt)
    ? player.movementBudgetAt
    : now;
  const elapsedMs = Math.max(0, Math.min(1000, now - previousBudgetAt));
  const previousBudget = Number.isFinite(player.movementBudget)
    ? player.movementBudget
    : initialBudget;
  const available = Math.min(capacity, previousBudget + refillRate * (elapsedMs / 1000));

  player.movementBudgetAt = now;
  if (displacement > available) {
    player.movementBudget = available;
    return false;
  }

  player.movementBudget = Math.max(0, available - displacement);
  return true;
}

/**
 * Register player socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId } = deps;
  const { connectedPlayers, getPlayerStatus, updatePlayerSectorRooms, broadcastToNearby } = deps.state;

  // Player movement input
  socket.on('player:input', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const validation = validatePlayerInput(data);
    if (!validation.valid) {
      logger.warn(`Rejected invalid movement input from ${player.username}: ${validation.error}`);
      return;
    }

    // Dead players and players being moved by the wormhole system cannot
    // overwrite their authoritative server position with client prediction.
    if (player.isDead || deps.wormhole.isInTransit(authenticatedUserId)) {
      return;
    }

    const now = Date.now();
    const displacement = Math.hypot(
      data.x - player.position.x,
      data.y - player.position.y
    );
    const boostEnvelopeActive = updateBoostAuthority(player, data.boostActive === true, now);
    const slowModifier = typeof deps.engine.getSlowModifier === 'function'
      ? Math.max(0.1, Math.min(1, deps.engine.getSlowModifier(authenticatedUserId)))
      : 1;
    const movementSpeedLimit = getMovementSpeedLimit(player, boostEnvelopeActive) * slowModifier;
    const reportedSpeed = Math.hypot(data.vx, data.vy);
    if (reportedSpeed > movementSpeedLimit * MOVEMENT_PREDICTION_CUSHION * 1.5) {
      logger.warn(`Rejected impossible velocity from ${player.username}: ${reportedSpeed.toFixed(1)}`);
      return;
    }

    if (!consumeMovementBudget(player, displacement, movementSpeedLimit, now)) {
      logger.warn(
        `Rejected teleport displacement from ${player.username}: ` +
        `${displacement.toFixed(1)} exceeds accumulated movement budget`
      );
      return;
    }

    // Update player state
    player.position = { x: data.x, y: data.y };
    player.velocity = { x: data.vx, y: data.vy };
    player.rotation = normalizeRotation(data.rotation);
    player.lastMovementAt = now;

    // Update player spatial hash for efficient broadcast queries
    deps.engine.updatePlayerInHash(socket.id, player);

    // Update sector rooms if player moved to a different sector
    updatePlayerSectorRooms(socket, player);

    // Calculate sector
    const sectorX = Math.floor(data.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(data.y / config.SECTOR_SIZE);

    // Save to database periodically (throttled)
    // Use faster interval during combat for better hit detection accuracy
    const status = getPlayerStatus(authenticatedUserId);
    const saveInterval = status === 'combat'
      ? (config.POSITION_SAVE_INTERVAL_COMBAT || 100)
      : (config.POSITION_SAVE_INTERVAL || 5000);

    if (!player.lastSave || Date.now() - player.lastSave > saveInterval) {
      statements.updateShipPosition.run(
        data.x, data.y, player.rotation,
        data.vx, data.vy,
        sectorX, sectorY,
        authenticatedUserId
      );
      player.lastSave = Date.now();
    }

    // Broadcast to nearby players
    broadcastToNearby(socket, player, 'player:update', {
      id: authenticatedUserId,
      username: player.username,
      x: data.x,
      y: data.y,
      rotation: player.rotation,
      hull: player.hull,
      hullMax: player.hullMax,
      shield: player.shield,
      shieldMax: player.shieldMax,
      status: getPlayerStatus(authenticatedUserId),
      colorId: player.colorId || 'green'
    });
  });

  // Respawn: Player selects respawn location
  // With Graveyard system: all players respawn in The Graveyard unless they have Swarm Hive Core relic
  socket.on('respawn:select', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    logger.log(`[RESPAWN] respawn:select received, type: ${data?.type}, userId: ${authenticatedUserId}`);

    if (!authenticatedUserId) {
      logger.warn('[RESPAWN] No authenticated user');
      return;
    }

    const player = connectedPlayers.get(socket.id);
    if (!player) {
      logger.warn('[RESPAWN] Player not found in connectedPlayers');
      socket.emit('respawn:error', { message: 'Player session is not ready' });
      return;
    }

    logger.log(`[RESPAWN] Player ${player.username} isDead: ${player.isDead}, hull: ${player.hull}`);

    // Validate player is actually dead
    if (!player.isDead) {
      logger.warn(`[RESPAWN] Player ${player.username} tried to respawn but isDead=${player.isDead}`);
      socket.emit('respawn:error', { message: 'You are not awaiting respawn' });
      return;
    }

    if (!data || typeof data !== 'object') {
      logger.warn(`[RESPAWN] Player ${player.username} sent an invalid selection`);
      socket.emit('respawn:error', { message: 'Invalid respawn selection' });
      return;
    }

    const { type, targetId } = data;

    // Apply respawn at selected location
    let respawnResult;
    let respawnInventory;
    try {
      // Inventory does not change during respawn. Read and validate it before
      // committing the respawn so a snapshot failure cannot leave the server
      // alive while the client is still waiting for player:respawn.
      respawnInventory = statements.getInventory.all(authenticatedUserId);
      if (!Array.isArray(respawnInventory)) {
        throw new Error('Respawn inventory snapshot failed');
      }
      respawnResult = combat.applyRespawn(
        authenticatedUserId,
        type,
        targetId,
        player.respawnOptions || null
      );
    } catch (error) {
      logger.error(`[RESPAWN] Failed for player ${player.username}:`, error);
      socket.emit('respawn:error', { message: 'Respawn failed; please try again' });
      return;
    }

    // Update player state
    player.position = respawnResult.position;
    player.velocity = { x: 0, y: 0 };
    player.hull = respawnResult.hull;
    player.shield = respawnResult.shield;
    player.isDead = false;
    player.deathTime = null;
    player.deathPosition = null;
    player.respawnOptions = null;
    player.lastMovementAt = Date.now();
    player.movementBudget = null;
    player.movementBudgetAt = player.lastMovementAt;
    player.serverBoostEndAt = 0;
    player.serverBoostRecoveryEndAt = 0;
    player.serverBoostCooldownEndAt = 0;
    clearPlayerBoostAuthority(player.id);

    // Update player spatial hash for new respawn position
    deps.engine.updatePlayerInHash(socket.id, player);

    // Emit respawn event to player
    socket.emit('player:respawn', {
      position: respawnResult.position,
      hull: respawnResult.hull,
      shield: respawnResult.shield,
      inventory: respawnInventory,
      locationName: respawnResult.locationName,
      // Include hive destruction info if applicable
      hiveDestruction: respawnResult.hiveDestruction || null
    });

    // If a hive was destroyed via Swarm Hive Core respawn, broadcast the destruction
    if (respawnResult.hiveDestruction) {
      const destruction = respawnResult.hiveDestruction;

      // Hive Core effects reveal authoritative world positions, so deliver
      // them only to recipients whose radar broadcast range reaches the AoE.
      deps.broadcasts?.emitNear(destruction.hivePosition, 'hive:coreImplosion', {
        hiveId: destruction.hiveId,
        position: destruction.hivePosition,
        destructionRadius: destruction.destructionRadius,
        killedNpcCount: destruction.killedNpcs.length,
        playerId: authenticatedUserId,
        playerName: player.username
      }, destruction.destructionRadius);

      // Broadcast each spawned wreckage
      for (const wreckage of destruction.spawnedWreckage) {
        deps.broadcasts?.emitNear(wreckage.position, 'wreckage:spawn', {
          id: wreckage.id,
          x: wreckage.position.x,
          y: wreckage.position.y,
          size: wreckage.size,
          source: 'npc',
          faction: wreckage.faction,
          npcType: wreckage.npcType,
          npcName: wreckage.npcName,
          contentCount: wreckage.contents?.length || 0
        }, Number(wreckage.size) || 0);
      }

      // Broadcast each NPC death
      for (const killedNpc of destruction.killedNpcs) {
        deps.broadcasts?.emitNear(killedNpc.position, 'npc:destroyed', {
          id: killedNpc.id,
          destroyedBy: authenticatedUserId,
          faction: 'swarm',
          deathEffect: 'dissolve',
          hiveCoreKill: true,
          position: killedNpc.position
        });
      }

      logger.log(`[HIVE CORE] Player ${player.username} triggered hive implosion at (${destruction.hivePosition.x.toFixed(0)}, ${destruction.hivePosition.y.toFixed(0)}), killed ${destruction.killedNpcs.length} NPCs`);
    }

    logger.log(`Player ${player.username} respawned at ${respawnResult.locationName} (${respawnResult.position.x.toFixed(0)}, ${respawnResult.position.y.toFixed(0)})`);
  });
}

module.exports = { register };
