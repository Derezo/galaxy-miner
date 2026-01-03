'use strict';

/**
 * Derelict Socket Handler
 * Events: derelict:getNearby, derelict:salvage, derelict:checkCooldown
 */

const config = require('../config');
const derelict = require('../game/derelict');
const loot = require('../game/loot');
const logger = require('../../shared/logger');

/**
 * Register derelict socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const { connectedPlayers, broadcastToNearby } = deps.state;

  // Derelict: Get nearby derelicts
  socket.on('derelict:getNearby', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Get derelicts within radar range (expanded for large derelicts)
    const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1) * 2;
    const nearby = derelict.getDerelictsInRange(player.position, radarRange);

    socket.emit('derelict:nearby', {
      derelicts: nearby.map(d => ({
        id: d.id,
        x: d.x,
        y: d.y,
        size: d.size,
        rotation: d.rotation,
        shipType: d.shipType,
        orbitingDebrisCount: d.orbitingDebrisCount,
        distance: d.distance,
        onCooldown: d.onCooldown,
        cooldownRemaining: d.cooldownRemaining
      }))
    });
  });

  // Derelict: Salvage derelict
  socket.on('derelict:salvage', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate input
    if (!data || typeof data.derelictId !== 'string') {
      socket.emit('derelict:error', { message: 'Invalid derelict ID' });
      return;
    }

    const { derelictId } = data;

    // Attempt salvage
    const result = derelict.salvageDerelict(derelictId, player.position);

    if (!result.success) {
      socket.emit('derelict:error', {
        message: result.error,
        cooldownRemaining: result.cooldownRemaining || 0
      });
      return;
    }

    // Salvage successful - spawn wreckage pieces
    const spawnedWreckage = [];

    for (let i = 0; i < result.wreckagePositions.length; i++) {
      const pos = result.wreckagePositions[i];

      // Distribute loot across wreckage pieces (first piece gets most/all)
      const wreckageContents = i === 0 ? result.loot : [];

      // Create wreckage entity
      const wreckageEntity = {
        id: `derelict_salvage_${derelictId}_${i}`,
        type: 'derelict_salvage',
        name: 'Derelict Salvage',
        faction: null,
        creditReward: 0 // Credits are in contents
      };

      // Debug: log wreckage contents before spawning
      logger.log('[DERELICT] Spawning wreckage', i, 'with', wreckageContents.length, 'items:',
        wreckageContents.map(c => `${c.type}${c.resourceType ? ':' + c.resourceType : ''}`).join(', '));

      const wreckage = loot.spawnWreckage(
        wreckageEntity,
        pos,
        wreckageContents,
        null, // No damage contributors
        { source: 'derelict' }
      );

      logger.log('[DERELICT] Wreckage spawned:', wreckage.id, 'contents:', wreckage.contents.length);

      spawnedWreckage.push(wreckage);

      // Build wreckage spawn data
      const wreckageData = {
        id: wreckage.id,
        x: wreckage.position.x,
        y: wreckage.position.y,
        size: wreckage.size,
        source: 'derelict',
        faction: null,
        npcType: 'derelict_salvage',
        npcName: 'Derelict Salvage',
        contentCount: wreckage.contents.length,
        despawnTime: wreckage.despawnTime,
        // Origin position for spawn animation (center of derelict)
        originX: result.derelict.x,
        originY: result.derelict.y
      };

      // Emit to the salvaging player (broadcastToNearby skips the emitting socket)
      socket.emit('wreckage:spawn', wreckageData);

      // Broadcast wreckage spawn to nearby players
      broadcastToNearby(socket, player, 'wreckage:spawn', wreckageData);
    }

    // Emit salvage success to player
    socket.emit('derelict:salvaged', {
      derelictId,
      wreckageIds: spawnedWreckage.map(w => w.id),
      wreckageCount: spawnedWreckage.length,
      cooldownMs: config.DERELICT_CONFIG?.SALVAGE_COOLDOWN || 30000
    });

    // Broadcast salvage effect to nearby players (for visual/audio feedback)
    broadcastToNearby(socket, player, 'derelict:salvageEffect', {
      derelictId,
      derelictX: result.derelict.x,
      derelictY: result.derelict.y,
      playerId: authenticatedUserId
    });

    logger.log(`[DERELICT] Player ${authenticatedUserId} salvaged ${derelictId}, spawned ${spawnedWreckage.length} wreckage pieces`);
  });

  // Derelict: Check cooldown status
  socket.on('derelict:checkCooldown', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    if (!data || typeof data.derelictId !== 'string') {
      return;
    }

    const { derelictId } = data;
    const onCooldown = derelict.isOnCooldown(derelictId);
    const remaining = derelict.getCooldownRemaining(derelictId);

    socket.emit('derelict:cooldownStatus', {
      derelictId,
      onCooldown,
      cooldownRemaining: remaining
    });
  });
}

module.exports = { register };
