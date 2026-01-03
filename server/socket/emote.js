'use strict';

/**
 * Emote Socket Handler
 * Events: emote:send
 */

const config = require('../config');

/**
 * Register emote socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const { connectedPlayers, broadcastToNearby } = deps.state;

  // Emotes: Send emote to nearby players
  socket.on('emote:send', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate emote type
    if (!config.EMOTES || !config.EMOTES[data.emoteType]) return;

    // Broadcast to nearby players
    broadcastToNearby(socket, player, 'emote:broadcast', {
      playerId: authenticatedUserId,
      playerName: player.username,
      emoteType: data.emoteType,
      x: player.position.x,
      y: player.position.y
    });
  });
}

module.exports = { register };
