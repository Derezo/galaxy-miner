'use strict';

/**
 * Player Socket Handler
 * Events: player:input, respawn:select
 */

const config = require('../config');
const { statements } = require('../database');
const combat = require('../game/combat');
const logger = require('../../shared/logger');

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

    // Validate and update position
    // For MVP, we trust the client position with basic sanity checks
    const maxSpeed = config.BASE_SPEED * Math.pow(config.TIER_MULTIPLIER, 5); // Max possible speed

    // Basic sanity check on velocity
    const speed = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
    if (speed > maxSpeed * 2) {
      logger.warn(`Player ${player.username} moving too fast: ${speed}`);
      return;
    }

    // Update player state
    player.position = { x: data.x, y: data.y };
    player.velocity = { x: data.vx, y: data.vy };
    player.rotation = data.rotation;

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
        data.x, data.y, data.rotation,
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
      rotation: data.rotation,
      hull: player.hull,
      shield: player.shield,
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
      return;
    }

    logger.log(`[RESPAWN] Player ${player.username} isDead: ${player.isDead}, hull: ${player.hull}`);

    // Validate player is actually dead
    if (!player.isDead) {
      logger.warn(`[RESPAWN] Player ${player.username} tried to respawn but isDead=${player.isDead}`);
      return;
    }

    const { type, targetId } = data;

    // Apply respawn at selected location
    const respawnResult = combat.applyRespawn(authenticatedUserId, type, targetId);

    // Update player state
    player.position = respawnResult.position;
    player.velocity = { x: 0, y: 0 };
    player.hull = respawnResult.hull;
    player.shield = respawnResult.shield;
    player.isDead = false;
    player.deathTime = null;
    player.deathPosition = null;

    // Emit respawn event to player
    socket.emit('player:respawn', {
      position: respawnResult.position,
      hull: respawnResult.hull,
      shield: respawnResult.shield,
      locationName: respawnResult.locationName,
      // Include hive destruction info if applicable
      hiveDestruction: respawnResult.hiveDestruction || null
    });

    // If a hive was destroyed via Swarm Hive Core respawn, broadcast the destruction
    if (respawnResult.hiveDestruction) {
      const destruction = respawnResult.hiveDestruction;

      // Broadcast hive implosion to all players (dramatic effect visible from far away)
      io.emit('hive:coreImplosion', {
        hiveId: destruction.hiveId,
        position: destruction.hivePosition,
        destructionRadius: destruction.destructionRadius,
        killedNpcCount: destruction.killedNpcs.length,
        playerId: authenticatedUserId,
        playerName: player.username
      });

      // Broadcast each spawned wreckage
      for (const wreckage of destruction.spawnedWreckage) {
        io.emit('wreckage:spawn', {
          id: wreckage.id,
          x: wreckage.position.x,
          y: wreckage.position.y,
          size: wreckage.size,
          source: 'npc',
          faction: wreckage.faction,
          npcType: wreckage.npcType,
          npcName: wreckage.npcName,
          contentCount: wreckage.contents?.length || 0
        });
      }

      // Broadcast each NPC death
      for (const killedNpc of destruction.killedNpcs) {
        io.emit('npc:destroyed', {
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
