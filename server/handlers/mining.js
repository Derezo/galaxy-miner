/**
 * Mining event handlers
 * Handles mining start, cancel, and progress tracking
 */

const logger = require('../../shared/logger');
const { validateMiningStart } = require('../validators');

function register(ctx) {
  const { socket, io, state, mining, config } = ctx;

  // Mining: Start mining
  socket.on('mining:start', (data) => {
    const authenticatedUserId = state.getAuthenticatedUserId(socket.id);
    if (!authenticatedUserId) return;

    const player = state.getPlayer(socket.id);
    if (!player) return;

    // Validate input
    const validation = validateMiningStart(data);
    if (!validation.valid) {
      logger.warn(`[Mining] Invalid mining start data from user ${authenticatedUserId}:`, validation.error);
      socket.emit('mining:error', { message: validation.error });
      return;
    }

    const result = mining.startMining(authenticatedUserId, player.position, data.objectId);

    if (result.success) {
      socket.emit('mining:started', {
        objectId: data.objectId,
        miningTime: config.BASE_MINING_TIME / Math.pow(config.TIER_MULTIPLIER, player.miningTier - 1 || 0)
      });

      // Set player status to mining
      state.setPlayerStatus(authenticatedUserId, 'mining');

      // Broadcast mining start to nearby players
      state.broadcastToNearby(socket, player, 'mining:playerStarted', {
        playerId: authenticatedUserId,
        targetX: result.target.x,
        targetY: result.target.y,
        resourceType: result.target.resourceType || 'default',
        miningTier: player.miningTier || 1
      });

      // Set up mining completion check
      const checkMining = setInterval(() => {
        const currentPlayer = state.getPlayer(socket.id);
        if (!currentPlayer) {
          clearInterval(checkMining);
          state.untrackInterval(socket.id, checkMining);
          return;
        }

        const progress = mining.updateMining(authenticatedUserId, currentPlayer.position);

        if (!progress) {
          clearInterval(checkMining);
          state.untrackInterval(socket.id, checkMining);
          return;
        }

        if (progress.cancelled) {
          clearInterval(checkMining);
          state.untrackInterval(socket.id, checkMining);
          socket.emit('mining:cancelled', { reason: progress.reason });
          // Clear player status
          state.setPlayerStatus(authenticatedUserId, 'idle');
          // Broadcast mining stopped to nearby players
          state.broadcastToNearby(socket, currentPlayer, 'mining:playerStopped', {
            playerId: authenticatedUserId
          });
          return;
        }

        if (progress.success) {
          clearInterval(checkMining);
          state.untrackInterval(socket.id, checkMining);
          socket.emit('mining:complete', {
            resourceType: progress.resourceType,
            resourceName: progress.resourceName,
            quantity: progress.quantity
          });
          // Get current credits from database
          const ship = state.getShipByUserId(authenticatedUserId);
          socket.emit('inventory:update', {
            inventory: progress.inventory,
            credits: state.getSafeCredits(ship)
          });
          // Notify nearby players of depletion
          state.broadcastToNearby(socket, currentPlayer, 'world:update', {
            depleted: true,
            objectId: progress.objectId
          });
          // Clear player status
          state.setPlayerStatus(authenticatedUserId, 'idle');
          // Broadcast mining stopped to nearby players
          state.broadcastToNearby(socket, currentPlayer, 'mining:playerStopped', {
            playerId: authenticatedUserId
          });
        }
      }, 100);
      // Track interval for cleanup on disconnect
      state.trackInterval(socket.id, checkMining);
    } else {
      logger.log('[Socket] Mining error for user', authenticatedUserId, ':', result.error, 'objectId:', data.objectId);
      socket.emit('mining:error', { message: result.error, objectId: data.objectId });
    }
  });

  // Mining: Cancel
  socket.on('mining:cancel', () => {
    const authenticatedUserId = state.getAuthenticatedUserId(socket.id);
    if (!authenticatedUserId) return;
    mining.cancelMining(authenticatedUserId);
  });
}

module.exports = { register };
