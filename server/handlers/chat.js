/**
 * Chat event handlers
 * Handles all chat-related socket events
 */

const config = require('../config');
const { statements } = require('../database');
const logger = require('../../shared/logger');
const { isValidMessage } = require('../validators');

/**
 * Register chat event handlers
 * @param {Object} ctx - Handler context
 * @param {Object} ctx.socket - Socket.io socket instance
 * @param {Object} ctx.io - Socket.io server instance
 * @param {Object} ctx.state - Game state (connectedPlayers, userSockets, etc.)
 * @param {Object} ctx.db - Database access (statements)
 */
function register(ctx) {
  const { socket, io, state } = ctx;
  const { connectedPlayers } = state;

  // Chat: Send message
  socket.on('chat:send', (data) => {
    const authenticatedUserId = state.getAuthenticatedUserId(socket.id);
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

    // Alternatively, use the validator:
    // if (!isValidMessage(message)) return;

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
