/**
 * Authentication event handlers for Galaxy Miner
 * Handles: auth:login, auth:register, auth:token, auth:logout
 */

const logger = require('../../shared/logger');
const { validateAuthCredentials } = require('../validators');

/**
 * Register authentication event handlers on socket
 * @param {Object} ctx - Handler context
 * @param {Object} ctx.socket - Socket.io socket instance
 * @param {Object} ctx.io - Socket.io server instance
 * @param {Object} ctx.state - Shared state object
 * @param {Object} ctx.auth - Auth module
 * @param {Object} ctx.db - Database statements
 * @param {Function} ctx.setupAuthenticatedPlayer - Setup function for authenticated players
 * @param {Function} ctx.cleanupPlayer - Cleanup function for disconnecting players
 * @param {Function} ctx.getAuthUserId - Get current authenticated user ID
 * @param {Function} ctx.setAuthUserId - Set authenticated user ID
 */
function register(ctx) {
  const { socket, auth, setupAuthenticatedPlayer, getAuthUserId, setAuthUserId, cleanupPlayer } = ctx;

  // Authentication: Login
  socket.on('auth:login', async (data) => {
    const { username, password } = data;

    // Rate limiting by IP
    const ip = socket.handshake.address;
    if (auth.isLoginRateLimited(ip)) {
      socket.emit('auth:error', { message: 'Too many login attempts. Please wait.' });
      return;
    }

    const result = await auth.login(username, password);

    if (result.success) {
      const authenticatedUserId = result.player.id;
      setAuthUserId(authenticatedUserId);
      setupAuthenticatedPlayer(socket, result.player, result.token);
      socket.emit('auth:success', { token: result.token, player: result.player });
    } else {
      socket.emit('auth:error', { message: result.error });
    }
  });

  // Authentication: Register
  socket.on('auth:register', async (data) => {
    const { username, password } = data;

    // Rate limiting by IP
    const ip = socket.handshake.address;
    if (auth.isRegisterRateLimited(ip)) {
      socket.emit('auth:error', { message: 'Too many registration attempts. Please wait.' });
      return;
    }

    const result = await auth.register(username, password);

    if (result.success) {
      const authenticatedUserId = result.player.id;
      setAuthUserId(authenticatedUserId);
      setupAuthenticatedPlayer(socket, result.player, result.token);
      socket.emit('auth:success', { token: result.token, player: result.player });
    } else {
      socket.emit('auth:error', { message: result.error });
    }
  });

  // Authentication: Token (reconnect)
  socket.on('auth:token', (data) => {
    const { token } = data;
    const userId = auth.validateToken(token);

    if (userId) {
      const playerData = auth.getPlayerData(userId);
      const authenticatedUserId = userId;
      setAuthUserId(authenticatedUserId);
      setupAuthenticatedPlayer(socket, playerData, token);
      socket.emit('auth:success', { token, player: playerData });
    } else {
      socket.emit('auth:error', { message: 'Invalid or expired session' });
    }
  });

  // Authentication: Logout
  socket.on('auth:logout', () => {
    const authenticatedUserId = getAuthUserId();
    if (authenticatedUserId) {
      cleanupPlayer(socket, authenticatedUserId);
      setAuthUserId(null);
    }
  });
}

module.exports = { register };
