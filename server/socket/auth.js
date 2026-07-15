'use strict';

/**
 * Authentication Socket Handler
 * Events: auth:login, auth:register, auth:token, auth:logout
 */

const auth = require('../auth');
const combat = require('../game/combat');
const relicHandlers = require('./relic');
const {
  getPlayerBoostAuthority,
  getPlayerBoostSnapshot
} = require('./boost-authority');
const logger = require('../../shared/logger');

const MAX_PENDING_AUTHENTICATION_OPERATIONS = 8;

/**
 * Register authentication socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId, setAuthenticatedUserId } = deps;
  const { cleanupPlayer } = deps.handlers;
  let authenticationQueue = Promise.resolve();
  let pendingAuthenticationOperations = 0;

  // Socket.io does not await async listeners. Chain every authentication state
  // transition explicitly so overlapping login/register/token events cannot
  // install identities out of order on the same socket.
  const serializeAuthentication = (operation) => {
    if (pendingAuthenticationOperations >= MAX_PENDING_AUTHENTICATION_OPERATIONS) {
      socket.emit('auth:error', { message: 'Too many authentication requests. Please wait.' });
      return Promise.resolve();
    }

    pendingAuthenticationOperations++;
    const queued = authenticationQueue.then(operation, operation);
    authenticationQueue = queued.then(
      () => { pendingAuthenticationOperations--; },
      () => { pendingAuthenticationOperations--; }
    );
    return queued;
  };

  const installAuthenticatedIdentity = (playerData, token) => {
    try {
      if (socket.disconnected || socket.connected === false) {
        if (typeof token === 'string') auth.destroySession(token);
        return false;
      }

      // Validate the replacement before cleaning a working prior identity.
      if (!playerData || !Number.isSafeInteger(playerData.id) || playerData.id <= 0) {
        if (typeof token === 'string') auth.destroySession(token);
        return false;
      }

      playerData.plunderCooldownRemaining =
        relicHandlers.getPlayerPlunderCooldownRemaining(playerData.id);
      const boostSnapshot = getPlayerBoostSnapshot(playerData.id);
      playerData.boostRemaining = boostSnapshot.boostRemaining;
      playerData.boostRecoveryRemaining = boostSnapshot.recoveryRemaining;
      playerData.boostCooldownRemaining = boostSnapshot.cooldownRemaining;

      const previousUserId = getAuthenticatedUserId();
      if (previousUserId) {
        // Fully remove the old player/hash/room/action state before reusing this
        // socket for either the same account or a different identity.
        cleanupPlayer(socket, previousUserId, deps);
        setAuthenticatedUserId(null);
      }

      if (!setupAuthenticatedPlayer(socket, playerData, token, deps)) {
        if (typeof token === 'string') auth.destroySession(token);
        return false;
      }

      setAuthenticatedUserId(playerData.id);
      return true;
    } catch (error) {
      if (typeof token === 'string') auth.destroySession(token);
      throw error;
    }
  };

  // Authentication: Login
  socket.on('auth:login', (data) => {
    if (!data || typeof data !== 'object') {
      socket.emit('auth:error', { message: 'Invalid login request' });
      return Promise.resolve();
    }
    const { username, password } = data;

    // Check the IP limit before accepting work into the per-socket queue. A
    // slow bcrypt operation must not let a flood accumulate queued closures.
    const ip = socket.handshake.address;
    if (auth.isLoginRateLimited(ip)) {
      socket.emit('auth:error', { message: 'Too many login attempts. Please wait.' });
      return Promise.resolve();
    }

    return serializeAuthentication(async () => {
      try {
        const result = await auth.login(username, password);

        if (result.success && installAuthenticatedIdentity(result.player, result.token)) {
          socket.emit('auth:success', { token: result.token, player: result.player });
        } else {
          socket.emit('auth:error', { message: result.error || 'Login failed' });
        }
      } catch (error) {
        logger.error('Unhandled login failure:', error);
        socket.emit('auth:error', { message: 'Login failed' });
      }
    });
  });

  // Authentication: Register
  socket.on('auth:register', (data) => {
    if (!data || typeof data !== 'object') {
      socket.emit('auth:error', { message: 'Invalid registration request' });
      return Promise.resolve();
    }
    const { username, password } = data;

    // As with login, consume the rate-limit allowance before queueing work.
    const ip = socket.handshake.address;
    if (auth.isRegisterRateLimited(ip)) {
      socket.emit('auth:error', { message: 'Too many registration attempts. Please wait.' });
      return Promise.resolve();
    }

    return serializeAuthentication(async () => {
      try {
        const result = await auth.register(username, password);

        if (result.success && installAuthenticatedIdentity(result.player, result.token)) {
          socket.emit('auth:success', { token: result.token, player: result.player });
        } else {
          socket.emit('auth:error', { message: result.error || 'Registration failed' });
        }
      } catch (error) {
        logger.error('Unhandled registration failure:', error);
        socket.emit('auth:error', { message: 'Registration failed' });
      }
    });
  });

  // Authentication: Token (reconnect)
  socket.on('auth:token', (data) => {
    const token = data && typeof data === 'object' ? data.token : null;
    if (typeof token !== 'string' || token.length === 0) {
      socket.emit('auth:error', { message: 'Invalid or expired session' });
      return Promise.resolve();
    }

    return serializeAuthentication(() => {
      try {
        const userId = auth.validateToken(token);
        const playerData = userId ? auth.getPlayerData(userId) : null;

        if (userId && installAuthenticatedIdentity(playerData, token)) {
          socket.emit('auth:success', { token, player: playerData });
        } else {
          socket.emit('auth:error', { message: 'Invalid or expired session' });
        }
      } catch (error) {
        logger.error('Token authentication failure:', error);
        socket.emit('auth:error', { message: 'Invalid or expired session' });
      }
    });
  });

  // Authentication: Logout
  socket.on('auth:logout', () => serializeAuthentication(() => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (authenticatedUserId) {
      cleanupPlayer(socket, authenticatedUserId, deps);
      const token = socket.data?.authToken;
      if (typeof token === 'string') auth.destroySession(token);
      if (socket.data) delete socket.data.authToken;
      setAuthenticatedUserId(null);
    }
  }));
}

/**
 * Setup authenticated player
 * @param {Object} socket - Socket.io socket
 * @param {Object} playerData - Player data from database
 * @param {string} token - Auth token
 * @param {Object} deps - Shared dependencies
 */
function setupAuthenticatedPlayer(socket, playerData, token, deps) {
  if (!playerData || !Number.isSafeInteger(playerData.id) || playerData.id <= 0) {
    return false;
  }

  const { io } = deps;
  const { connectedPlayers, userSockets, joinSectorRooms, broadcastToNearby } = deps.state;

  // Check if already connected elsewhere
  const existingSocketId = userSockets.get(playerData.id);
  if (existingSocketId && existingSocketId !== socket.id) {
    // Disconnect old socket
    const oldSocket = io.sockets.sockets.get(existingSocketId);
    if (oldSocket) {
      oldSocket.emit('auth:error', { message: 'Connected from another location' });
      const oldToken = oldSocket.data?.authToken;
      if (typeof oldToken === 'string' && oldToken !== token) {
        auth.destroySession(oldToken);
        delete oldSocket.data.authToken;
      }
      // Complete the old session synchronously before installing the new one.
      // Otherwise its later disconnect callback can erase per-user state that
      // already belongs to this replacement socket.
      if (typeof deps.handlers?.cleanupPlayer === 'function') {
        deps.handlers.cleanupPlayer(oldSocket, playerData.id, deps);
      }
      oldSocket.disconnect(true);
    }
  }

  // Setup player data
  // Check if player died (hull <= 0) - mark as dead so they must respawn
  const wasDead = playerData.hull_hp <= 0;
  const boostAuthority = getPlayerBoostAuthority(playerData.id);
  playerData.debuffs = typeof deps.engine.getPlayerDebuffSnapshot === 'function'
    ? deps.engine.getPlayerDebuffSnapshot(playerData.id)
    : {};
  const relicTypes = Array.isArray(playerData.relics)
    ? playerData.relics
      .map(relic => relic?.relic_type)
      .filter(relicType => typeof relicType === 'string' && relicType.length > 0)
      .map(relicType => relicType.toUpperCase())
    : [];
  const player = {
    id: playerData.id,
    username: playerData.username,
    position: { x: playerData.position_x, y: playerData.position_y },
    velocity: { x: playerData.velocity_x, y: playerData.velocity_y },
    rotation: Math.atan2(
      Math.sin(Number(playerData.rotation) || 0),
      Math.cos(Number(playerData.rotation) || 0)
    ),
    hull: playerData.hull_hp,
    hullMax: playerData.hull_max,
    shield: playerData.shield_hp,
    shieldMax: playerData.shield_max,
    engineTier: playerData.engine_tier || 1,
    weaponType: playerData.weapon_type || 'kinetic',
    weaponTier: playerData.weapon_tier || 1,
    shieldTier: playerData.shield_tier || 1,
    miningTier: playerData.mining_tier || 1,
    cargoTier: playerData.cargo_tier || 1,
    radarTier: playerData.radar_tier || 1,
    energyCoreTier: playerData.energy_core_tier || 1,
    hullTier: playerData.hull_tier || 1,
    relicTypes,
    credits: playerData.credits,
    colorId: playerData.ship_color_id || 'green',
    profileId: playerData.profile_id || 'pilot',
    isDead: wasDead,
    deathTime: wasDead ? Date.now() : null,
    deathPosition: wasDead
      ? { x: playerData.position_x, y: playerData.position_y }
      : null,
    respawnOptions: null,
    lastMovementAt: Date.now(),
    movementBudget: null,
    movementBudgetAt: Date.now(),
    serverBoostEndAt: boostAuthority.boostEndAt,
    serverBoostRecoveryEndAt: boostAuthority.recoveryEndAt,
    serverBoostCooldownEndAt: boostAuthority.cooldownEndAt
  };

  connectedPlayers.set(socket.id, player);
  userSockets.set(playerData.id, socket.id);
  socket.data = socket.data || {};
  delete socket.data.playerCleanupComplete;
  const previousToken = socket.data.authToken;
  if (typeof previousToken === 'string' && previousToken !== token) {
    auth.destroySession(previousToken);
  }
  socket.data.authToken = token;

  // Insert into player spatial hash for efficient broadcast queries
  deps.engine.insertPlayerInHash(socket.id, player);

  // Join sector rooms for efficient proximity broadcasting
  joinSectorRooms(socket, player);

  logger.log(`Player ${playerData.username} authenticated${wasDead ? ' (dead - needs respawn)' : ''}`);

  // If player was dead (reconnected while dead), send death event so client shows respawn UI
  if (wasDead) {
    const respawnOptions = combat.buildRespawnOptions(playerData.id, player.position);
    player.respawnOptions = respawnOptions;
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
      hullMax: player.hullMax,
      shield: player.shield,
      shieldMax: player.shieldMax,
      colorId: player.colorId || 'green'
    });
  }

  return true;
}

module.exports = { register, setupAuthenticatedPlayer };
