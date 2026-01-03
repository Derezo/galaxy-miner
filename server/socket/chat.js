'use strict';

/**
 * Chat Socket Handler
 * Events: chat:send
 */

const config = require('../config');
const { statements } = require('../database');

/**
 * Register chat socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId } = deps;
  const { connectedPlayers } = deps.state;

  // Chat: Send message
  socket.on('chat:send', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Rate limiting
    if (player.lastChat && Date.now() - player.lastChat < config.CHAT_RATE_LIMIT) {
      return;
    }
    player.lastChat = Date.now();

    // Validate message
    let message = (data.message || '').trim();
    if (!message || message.length > config.CHAT_MAX_LENGTH) return;

    // Save to database
    statements.addChatMessage.run(authenticatedUserId, player.username, message);

    // Broadcast to all players
    io.emit('chat:message', {
      username: player.username,
      message: message,
      timestamp: Date.now()
    });

    // Prune old messages
    statements.pruneOldChat.run(config.CHAT_HISTORY_SIZE);
  });
}

module.exports = { register };
