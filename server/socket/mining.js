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
  const {
    connectedPlayers,
    trackInterval,
    untrackInterval,
    setPlayerStatus,
    getPlayerStatus,
    broadcastToNearby
  } = deps.state;
  const logger = require('../../shared/logger');
  let activeMiningTimer = null;

  function clearMiningTimer(timer = activeMiningTimer) {
    if (!timer) return;
    clearInterval(timer);
    untrackInterval(socket.id, timer);
    if (activeMiningTimer === timer) activeMiningTimer = null;
  }

  function resetMiningStatus(playerId) {
    // Do not overwrite a newer authoritative state such as wormhole transit.
    if (typeof getPlayerStatus !== 'function' || getPlayerStatus(playerId) === 'mining') {
      setPlayerStatus(playerId, 'idle');
      return true;
    }
    return false;
  }

  function stopMiningVisuals(player, playerId) {
    if (!player) return;
    broadcastToNearby(socket, player, 'mining:playerStopped', { playerId });
  }

  function interruptMining(playerId, player, reason, options = {}) {
    clearMiningTimer(options.timer);
    if (options.cancelSession !== false) mining.cancelMining(playerId);
    resetMiningStatus(playerId);
    if (options.broadcast !== false) stopMiningVisuals(player, playerId);
    if (options.emit !== false) {
      socket.emit('mining:cancelled', { reason });
    }
  }

  // Mining: Start mining
  socket.on('mining:start', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;
      if (player.isDead || deps.wormhole?.isInTransit?.(authenticatedUserId)) {
        socket.emit('mining:error', { message: 'Cannot mine right now' });
        return;
      }
      if (!data || typeof data !== 'object' || typeof data.objectId !== 'string') {
        socket.emit('mining:error', { message: 'Invalid mining target' });
        return;
      }
      if (typeof mining.isMining === 'function' && mining.isMining(authenticatedUserId)) {
        socket.emit('mining:error', { message: 'Mining is already active' });
        return;
      }

      const result = mining.startMining(
        authenticatedUserId,
        player.position,
        data.objectId,
        data.clientObjectPosition || null
      );

      if (result.success) {
        socket.emit('mining:started', {
          objectId: data.objectId,
          miningTime: config.BASE_MINING_TIME / Math.pow(config.TIER_MULTIPLIER, player.miningTier - 1 || 0),
          miningTier: player.miningTier || 1,
          resourceType: result.target.resourceType
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
          try {
            if (player.isDead || deps.wormhole?.isInTransit?.(authenticatedUserId)) {
              const statusStillMining = typeof getPlayerStatus !== 'function' ||
                getPlayerStatus(authenticatedUserId) === 'mining';
              const sessionStillMining = typeof mining.isMining !== 'function' ||
                mining.isMining(authenticatedUserId);
              const shouldNotify = statusStillMining || sessionStillMining;
              interruptMining(
                authenticatedUserId,
                player,
                player.isDead ? 'Player destroyed' : 'Wormhole transit started',
                {
                  timer: checkMining,
                  cancelSession: sessionStillMining,
                  emit: shouldNotify,
                  broadcast: shouldNotify
                }
              );
              return;
            }

            const progress = mining.updateMining(authenticatedUserId, player.position);

            if (!progress) {
              // The game layer may be cancelled by death, transit, or another
              // authoritative system before this socket interval observes it.
              const statusStillMining = typeof getPlayerStatus !== 'function' ||
                getPlayerStatus(authenticatedUserId) === 'mining';
              interruptMining(
                authenticatedUserId,
                player,
                'Mining session ended',
                {
                  timer: checkMining,
                  cancelSession: false,
                  emit: false,
                  broadcast: statusStillMining
                }
              );
              return;
            }

            if (progress.cancelled || progress.success === false) {
              const reason = progress.reason || progress.error || 'Mining failed';
              interruptMining(
                authenticatedUserId,
                player,
                reason,
                { timer: checkMining, cancelSession: false }
              );
              if (progress.success === false) {
                socket.emit('mining:error', { message: reason });
              }
              return;
            }

            if (progress.success) {
              clearMiningTimer(checkMining);
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
              resetMiningStatus(authenticatedUserId);
              stopMiningVisuals(player, authenticatedUserId);
            }
          } catch (error) {
            logger.error('[Mining] Completion poll failed:', error);
            interruptMining(
              authenticatedUserId,
              player,
              'Mining interrupted',
              { timer: checkMining }
            );
          }
        }, 100);
        activeMiningTimer = checkMining;
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
    const player = connectedPlayers.get(socket.id);
    interruptMining(authenticatedUserId, player, 'Cancelled by player');
  });
}

module.exports = { register };
