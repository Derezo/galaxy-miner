'use strict';

/**
 * Authentication Socket Handler
 * Events: auth:login, auth:register, auth:token, auth:logout
 */

const auth = require('../auth');
const combat = require('../game/combat');
const logger = require('../../shared/logger');

/**
 * Register authentication socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId, setAuthenticatedUserId } = deps;
  const { connectedPlayers, userSockets, joinSectorRooms, broadcastToNearby } = deps.state;
  const { cleanupPlayer } = deps.handlers;

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
      setAuthenticatedUserId(result.player.id);
      setupAuthenticatedPlayer(socket, result.player, result.token, deps);
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
      setAuthenticatedUserId(result.player.id);
      setupAuthenticatedPlayer(socket, result.player, result.token, deps);
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
      setAuthenticatedUserId(userId);
      setupAuthenticatedPlayer(socket, playerData, token, deps);
      socket.emit('auth:success', { token, player: playerData });
    } else {
      socket.emit('auth:error', { message: 'Invalid or expired session' });
    }
  });

  // Authentication: Logout
  socket.on('auth:logout', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (authenticatedUserId) {
      cleanupPlayer(socket, authenticatedUserId, deps);
      setAuthenticatedUserId(null);
    }
  });
}

/**
 * Setup authenticated player
 * @param {Object} socket - Socket.io socket
 * @param {Object} playerData - Player data from database
 * @param {string} token - Auth token
 * @param {Object} deps - Shared dependencies
 */
function setupAuthenticatedPlayer(socket, playerData, token, deps) {
  const { io } = deps;
  const { connectedPlayers, userSockets, joinSectorRooms, broadcastToNearby } = deps.state;

  // Check if already connected elsewhere
  const existingSocketId = userSockets.get(playerData.id);
  if (existingSocketId && existingSocketId !== socket.id) {
    // Disconnect old socket
    const oldSocket = io.sockets.sockets.get(existingSocketId);
    if (oldSocket) {
      oldSocket.emit('auth:error', { message: 'Connected from another location' });
      oldSocket.disconnect();
    }
  }

  // Setup player data
  // Check if player died (hull <= 0) - mark as dead so they must respawn
  const wasDead = playerData.hull_hp <= 0;
  const player = {
    id: playerData.id,
    username: playerData.username,
    position: { x: playerData.position_x, y: playerData.position_y },
    velocity: { x: playerData.velocity_x, y: playerData.velocity_y },
    rotation: playerData.rotation,
    hull: playerData.hull_hp,
    hullMax: playerData.hull_max,
    shield: playerData.shield_hp,
    shieldMax: playerData.shield_max,
    radarTier: playerData.radar_tier,
    miningTier: playerData.mining_tier,
    weaponTier: playerData.weapon_tier,
    credits: playerData.credits,
    colorId: playerData.ship_color_id || 'green',
    profileId: playerData.profile_id || 'pilot',
    isDead: wasDead,
    deathTime: wasDead ? Date.now() : null
  };

  connectedPlayers.set(socket.id, player);
  userSockets.set(playerData.id, socket.id);

  // Insert into player spatial hash for efficient broadcast queries
  deps.engine.insertPlayerInHash(socket.id, player);

  // Join sector rooms for efficient proximity broadcasting
  joinSectorRooms(socket, player);

  logger.log(`Player ${playerData.username} authenticated${wasDead ? ' (dead - needs respawn)' : ''}`);

  // If player was dead (reconnected while dead), send death event so client shows respawn UI
  if (wasDead) {
    const respawnOptions = combat.buildRespawnOptions(playerData.id, player.position);
    socket.emit('player:death', {
      killedBy: 'Reconnected while dead',
      cause: 'reconnect',
      killerType: 'environment',
      killerName: null,
      deathPosition: player.position,
      droppedCargo: [],
      wreckageSpawned: false,
      respawnOptions
    });
  }

  // Notify nearby players of new player (only if alive)
  if (!wasDead) {
    broadcastToNearby(socket, player, 'player:update', {
      id: playerData.id,
      username: playerData.username,
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation,
      hull: player.hull,
      shield: player.shield,
      colorId: player.colorId || 'green'
    });
  }
}

module.exports = { register, setupAuthenticatedPlayer };
