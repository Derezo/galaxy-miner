'use strict';

/**
 * Connection Socket Handler
 * Events: ping, disconnect
 * Also contains player cleanup logic
 */

const config = require('../config');
const { statements } = require('../database');
const mining = require('../game/mining');
const wormhole = require('../game/wormhole');
const logger = require('../../shared/logger');

/**
 * Register connection socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;

  // Ping for latency measurement
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    logger.log(`Client disconnected: ${socket.id}`);
    if (authenticatedUserId) {
      cleanupPlayer(socket, authenticatedUserId, deps);
    }
  });
}

/**
 * Cleanup player on disconnect
 * @param {Object} socket - Socket.io socket
 * @param {number} userId - User ID
 * @param {Object} deps - Shared dependencies
 */
function cleanupPlayer(socket, userId, deps) {
  const {
    connectedPlayers,
    userSockets,
    clearAllIntervals,
    clearPlayerStatus,
    leaveSectorRooms,
    broadcastToNearby
  } = deps.state;

  const player = connectedPlayers.get(socket.id);
  if (player) {
    // Save final position
    try {
      statements.updateShipPosition.run(
        player.position.x, player.position.y, player.rotation,
        player.velocity.x, player.velocity.y,
        Math.floor(player.position.x / config.SECTOR_SIZE),
        Math.floor(player.position.y / config.SECTOR_SIZE),
        userId
      );
    } catch (err) {
      logger.error(`[DISCONNECT ERROR] Failed to save position for user ${userId}:`, err.message);
    }

    // Notify others
    broadcastToNearby(socket, player, 'player:leave', userId);

    logger.log(`Player ${player.username} disconnected`);
  }

  // Clean up any active intervals (mining, loot collection, etc.)
  clearAllIntervals(socket.id);

  // Cancel any active mining session
  mining.cancelMining(userId);

  // Leave sector rooms
  leaveSectorRooms(socket);

  // Remove from player spatial hash before deleting from connectedPlayers
  deps.engine.removePlayerFromHash(socket.id);

  connectedPlayers.delete(socket.id);
  userSockets.delete(userId);

  // Clean up player status
  clearPlayerStatus(userId);

  // Clean up any active wormhole transit
  wormhole.cleanupPlayer(userId);
}

module.exports = { register, cleanupPlayer };
