/**
 * Emote event handlers
 *
 * Handles player emote sending and broadcasting to nearby players
 */

const logger = require('../../shared/logger');
const config = require('../config');
const { isValidEmote } = require('../validators');

/**
 * Register emote-related event handlers
 * @param {Object} ctx - Handler context { socket, io, state, authenticatedUserId }
 */
function register(ctx) {
  const { socket, state, authenticatedUserId } = ctx;

  // Emotes: Send emote to nearby players
  socket.on('emote:send', (data) => {
    if (!authenticatedUserId) return;

    const player = state.connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate emote type using validator
    if (!data || !data.emoteType || !isValidEmote(data.emoteType)) {
      logger.warn(`Invalid emote type from player ${player.username}:`, data?.emoteType);
      return;
    }

    logger.log(`Player ${player.username} sent emote: ${data.emoteType}`);

    // Broadcast to nearby players
    broadcastToNearby(ctx, socket, player, 'emote:broadcast', {
      playerId: authenticatedUserId,
      playerName: player.username,
      emoteType: data.emoteType,
      x: player.position.x,
      y: player.position.y
    });
  });
}

/**
 * Helper: Broadcast to nearby players
 * @param {Object} ctx - Handler context
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} player - Player object
 * @param {string} event - Event name to broadcast
 * @param {Object} data - Data to send
 */
function broadcastToNearby(ctx, socket, player, event, data) {
  const { io, state } = ctx;
  const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1);
  const broadcastRange = radarRange * 2; // Broadcast slightly further than radar

  for (const [socketId, otherPlayer] of state.connectedPlayers) {
    if (socketId === socket.id) continue;

    const dx = otherPlayer.position.x - player.position.x;
    const dy = otherPlayer.position.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

module.exports = { register };
