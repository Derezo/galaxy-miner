'use strict';

/**
 * Wormhole Socket Handler
 * Events: wormhole:enter, wormhole:selectDestination, wormhole:cancel, wormhole:getProgress, wormhole:getNearestPosition
 */

const config = require('../config');
const { statements } = require('../database');
const wormhole = require('../game/wormhole');
const world = require('../world');
const logger = require('../../shared/logger');

/**
 * Register wormhole socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const { connectedPlayers, setPlayerStatus, broadcastToNearby } = deps.state;

  // Wormhole: Enter wormhole
  socket.on('wormhole:enter', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const { wormholeId } = data;

    // Create player object with required properties
    const playerData = {
      id: authenticatedUserId,
      x: player.position.x,
      y: player.position.y
    };

    const result = wormhole.enterWormhole(playerData, wormholeId);

    if (result.success) {
      // Set player status to show they're in wormhole
      setPlayerStatus(authenticatedUserId, 'wormhole');

      socket.emit('wormhole:entered', {
        wormholeId,
        destinations: result.destinations
      });

      // Broadcast to nearby players that player entered wormhole
      broadcastToNearby(socket, player, 'wormhole:playerEntered', {
        playerId: authenticatedUserId,
        wormholeId
      });
    } else {
      socket.emit('wormhole:error', { message: result.error });
    }
  });

  // Wormhole: Select destination
  socket.on('wormhole:selectDestination', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const { destinationId } = data;

    const result = wormhole.selectDestination(authenticatedUserId, destinationId);

    if (result.success) {
      socket.emit('wormhole:transitStarted', {
        destinationId,
        destination: result.destination,
        duration: result.duration,
        hasVoidWarp: result.hasVoidWarp || false
      });

      // Broadcast transit start to nearby players
      broadcastToNearby(socket, player, 'wormhole:playerTransiting', {
        playerId: authenticatedUserId,
        destinationId
      });

      // Set up transit completion check
      setTimeout(() => {
        const completeResult = wormhole.completeTransit(authenticatedUserId);

        if (completeResult.success) {
          // Update player position
          player.position = { x: completeResult.position.x, y: completeResult.position.y };
          player.velocity = { x: 0, y: 0 };

          // Update player spatial hash for new wormhole exit position
          deps.engine.updatePlayerInHash(socket.id, player);

          // Save new position to database
          const sectorX = Math.floor(completeResult.position.x / config.SECTOR_SIZE);
          const sectorY = Math.floor(completeResult.position.y / config.SECTOR_SIZE);
          statements.updateShipPosition.run(
            completeResult.position.x, completeResult.position.y, player.rotation,
            0, 0,
            sectorX, sectorY,
            authenticatedUserId
          );

          // Clear player status
          setPlayerStatus(authenticatedUserId, 'idle');

          socket.emit('wormhole:exitComplete', {
            position: completeResult.position,
            wormholeId: completeResult.wormholeId,
            hasVoidWarp: completeResult.hasVoidWarp || false
          });

          // Broadcast exit to nearby players at new location
          broadcastToNearby(socket, player, 'wormhole:playerExited', {
            playerId: authenticatedUserId,
            x: completeResult.position.x,
            y: completeResult.position.y
          });
        }
      }, wormhole.TRANSIT_DURATION);
    } else {
      socket.emit('wormhole:error', { message: result.error });
    }
  });

  // Wormhole: Cancel transit
  socket.on('wormhole:cancel', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const result = wormhole.cancelTransit(authenticatedUserId, 'Cancelled by player');

    if (result.success) {
      setPlayerStatus(authenticatedUserId, 'idle');
      socket.emit('wormhole:cancelled', { reason: result.reason });

      // Broadcast cancellation to nearby players
      broadcastToNearby(socket, player, 'wormhole:playerCancelled', {
        playerId: authenticatedUserId
      });
    }
  });

  // Wormhole: Get transit progress
  socket.on('wormhole:getProgress', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const progress = wormhole.getTransitProgress(authenticatedUserId);
    socket.emit('wormhole:progress', progress);
  });

  // Wormhole: Get nearest wormhole position (for wormhole gem directional indicator)
  socket.on('wormhole:getNearestPosition', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player || !player.position) {
      logger.log('[Wormhole] getNearestPosition - no player or position');
      return;
    }

    logger.log('[Wormhole] getNearestPosition request from player at', Math.round(player.position.x), Math.round(player.position.y));

    const nearestWormhole = world.findNearestWormhole(
      player.position.x,
      player.position.y
    );

    if (nearestWormhole) {
      logger.log('[Wormhole] Found nearest at', Math.round(nearestWormhole.x), Math.round(nearestWormhole.y), 'distance:', Math.round(nearestWormhole.distance));
    } else {
      logger.log('[Wormhole] No wormhole found in search radius');
    }

    socket.emit('wormhole:nearestPosition', nearestWormhole);
  });
}

module.exports = { register };
