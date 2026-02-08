'use strict';

/**
 * Mining Socket Handler
 * Events: mining:start, mining:cancel
 */

const config = require('../config');
const { statements, getSafeCredits } = require('../database');
const mining = require('../game/mining');

/**
 * Register mining socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const { connectedPlayers, trackInterval, untrackInterval, setPlayerStatus, broadcastToNearby } = deps.state;
  const logger = require('../../shared/logger');

  // Mining: Start mining
  socket.on('mining:start', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const result = mining.startMining(
        authenticatedUserId,
        player.position,
        data.objectId,
        data.clientObjectPosition || null
      );

      if (result.success) {
        socket.emit('mining:started', {
          objectId: data.objectId,
          miningTime: config.BASE_MINING_TIME / Math.pow(config.TIER_MULTIPLIER, player.miningTier - 1 || 0)
        });

        // Set player status to mining
        setPlayerStatus(authenticatedUserId, 'mining');

        // Broadcast mining start to nearby players
        broadcastToNearby(socket, player, 'mining:playerStarted', {
          playerId: authenticatedUserId,
          targetX: result.target.x,
          targetY: result.target.y,
          resourceType: result.target.resourceType || 'default',
          miningTier: player.miningTier || 1
        });

        // Set up mining completion check
        const checkMining = setInterval(() => {
          const progress = mining.updateMining(authenticatedUserId, player.position);

          if (!progress) {
            clearInterval(checkMining);
            untrackInterval(socket.id, checkMining);
            return;
          }

          if (progress.cancelled) {
            clearInterval(checkMining);
            untrackInterval(socket.id, checkMining);
            socket.emit('mining:cancelled', { reason: progress.reason });
            // Clear player status
            setPlayerStatus(authenticatedUserId, 'idle');
            // Broadcast mining stopped to nearby players
            broadcastToNearby(socket, player, 'mining:playerStopped', {
              playerId: authenticatedUserId
            });
            return;
          }

          if (progress.success) {
            clearInterval(checkMining);
            untrackInterval(socket.id, checkMining);
            socket.emit('mining:complete', {
              resourceType: progress.resourceType,
              resourceName: progress.resourceName,
              quantity: progress.quantity
            });
            // Get current credits from database
            const ship = statements.getShipByUserId.get(authenticatedUserId);
            socket.emit('inventory:update', {
              inventory: progress.inventory,
              credits: getSafeCredits(ship)
            });
            // Notify nearby players of depletion
            broadcastToNearby(socket, player, 'world:update', {
              depleted: true,
              objectId: progress.objectId
            });
            // Clear player status
            setPlayerStatus(authenticatedUserId, 'idle');
            // Broadcast mining stopped to nearby players
            broadcastToNearby(socket, player, 'mining:playerStopped', {
              playerId: authenticatedUserId
            });
          }
        }, 100);
        // Track interval for cleanup on disconnect
        trackInterval(socket.id, checkMining);
      } else {
        logger.log('[Socket] Mining error for user', authenticatedUserId, ':', result.error, 'objectId:', data.objectId);
        socket.emit('mining:error', { message: result.error, objectId: data.objectId });
      }
    } catch (err) {
      logger.error(`[HANDLER] mining:start error:`, err);
    }
  });

  // Mining: Cancel
  socket.on('mining:cancel', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;
    mining.cancelMining(authenticatedUserId);
  });
}

module.exports = { register };
