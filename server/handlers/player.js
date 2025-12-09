const logger = require('../../shared/logger');
const { validatePlayerInput } = require('../validators');
const config = require('../config');
const { statements } = require('../database');

/**
 * Register player-related event handlers
 * @param {Object} ctx - Handler context
 * @param {Object} ctx.socket - Socket.io socket instance
 * @param {Object} ctx.io - Socket.io server instance
 * @param {Object} ctx.state - Shared state object
 * @param {Object} ctx.engine - Game engine instance
 * @param {Object} ctx.db - Database instance
 */
function register(ctx) {
  const { socket, io, state, engine } = ctx;
  const { connectedPlayers, userSockets, playerStatus } = state;

  // Player movement input
  socket.on('player:input', (data) => {
    const authenticatedUserId = socket.authenticatedUserId;
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate and update position
    // For MVP, we trust the client position with basic sanity checks
    const maxSpeed = config.BASE_SPEED * Math.pow(config.TIER_MULTIPLIER, 5); // Max possible speed

    // Basic sanity check on velocity
    const speed = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
    if (speed > maxSpeed * 2) {
      logger.warn(`Player ${player.username} moving too fast: ${speed}`);
      return;
    }

    // Update player state
    player.position = { x: data.x, y: data.y };
    player.velocity = { x: data.vx, y: data.vy };
    player.rotation = data.rotation;

    // Calculate sector
    const sectorX = Math.floor(data.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(data.y / config.SECTOR_SIZE);

    // Save to database periodically (throttled)
    if (!player.lastSave || Date.now() - player.lastSave > 5000) {
      statements.updateShipPosition.run(
        data.x, data.y, data.rotation,
        data.vx, data.vy,
        sectorX, sectorY,
        authenticatedUserId
      );
      player.lastSave = Date.now();
    }

    // Broadcast to nearby players
    broadcastToNearby(socket, player, 'player:update', {
      id: authenticatedUserId,
      username: player.username,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      hull: player.hull,
      shield: player.shield,
      status: getPlayerStatus(authenticatedUserId, playerStatus),
      colorId: player.colorId || 'green'
    }, connectedPlayers, io);
  });

  // Player respawn (triggered after death)
  socket.on('player:respawn', async () => {
    const authenticatedUserId = socket.authenticatedUserId;
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Get ship data from database
    const ship = statements.getShipByUserId.get(authenticatedUserId);
    if (!ship) {
      socket.emit('respawn:error', { message: 'Ship data not found' });
      return;
    }

    // Update player state to reflect respawn
    player.hull = ship.hull_max;
    player.shield = ship.shield_max;
    player.position = { x: ship.position_x, y: ship.position_y };
    player.velocity = { x: 0, y: 0 };
    player.rotation = ship.rotation;

    // Confirm respawn to client
    socket.emit('player:respawned', {
      hull: player.hull,
      shield: player.shield,
      position: player.position,
      rotation: player.rotation
    });

    // Clear player status
    setPlayerStatus(authenticatedUserId, 'idle', playerStatus);

    // Broadcast respawn to nearby players
    broadcastToNearby(socket, player, 'player:update', {
      id: authenticatedUserId,
      username: player.username,
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation,
      hull: player.hull,
      shield: player.shield,
      status: 'idle',
      colorId: player.colorId || 'green'
    }, connectedPlayers, io);
  });

  // Ping for latency measurement
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  // Player disconnect
  socket.on('disconnect', () => {
    const authenticatedUserId = socket.authenticatedUserId;
    logger.log(`Client disconnected: ${socket.id}`);
    if (authenticatedUserId) {
      cleanupPlayer(socket, authenticatedUserId, state, io);
    }
  });
}

/**
 * Helper: Set player status with optional timeout
 * @param {number} userId - User ID
 * @param {string} status - Status to set
 * @param {Map} playerStatus - Player status map
 * @param {number} timeout - Optional timeout in ms
 */
function setPlayerStatus(userId, status, playerStatus, timeout = 0) {
  // Clear any existing timeout
  const existing = playerStatus.get(userId);
  if (existing && existing.timeout) {
    clearTimeout(existing.timeout);
  }

  if (timeout > 0) {
    // Set status with auto-clear timeout
    const timeoutId = setTimeout(() => {
      setPlayerStatus(userId, 'idle', playerStatus);
    }, timeout);
    playerStatus.set(userId, { status, timeout: timeoutId });
  } else {
    playerStatus.set(userId, { status, timeout: null });
  }
}

/**
 * Helper: Get player status
 * @param {number} userId - User ID
 * @param {Map} playerStatus - Player status map
 * @returns {string} - Player status
 */
function getPlayerStatus(userId, playerStatus) {
  const statusData = playerStatus.get(userId);
  return statusData ? statusData.status : 'idle';
}

/**
 * Helper: Broadcast to nearby players
 * @param {Object} socket - Socket instance
 * @param {Object} player - Player object
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {Map} connectedPlayers - Connected players map
 * @param {Object} io - Socket.io server
 */
function broadcastToNearby(socket, player, event, data, connectedPlayers, io) {
  const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1);
  const broadcastRange = radarRange * 2; // Broadcast slightly further than radar

  for (const [socketId, otherPlayer] of connectedPlayers) {
    if (socketId === socket.id) continue;

    const dx = otherPlayer.position.x - player.position.x;
    const dy = otherPlayer.position.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

/**
 * Helper: Cleanup player on disconnect
 * @param {Object} socket - Socket instance
 * @param {number} userId - User ID
 * @param {Object} state - Shared state object
 * @param {Object} io - Socket.io server
 */
function cleanupPlayer(socket, userId, state, io) {
  const { connectedPlayers, userSockets, playerStatus, activeIntervals } = state;
  const mining = require('../game/mining');
  const wormhole = require('../game/wormhole');

  const player = connectedPlayers.get(socket.id);
  if (player) {
    // Save final position
    try {
      statements.updateShipPosition.run(
        player.position.x, player.position.y, player.rotation,
        player.velocity.x, player.velocity.y,
        Math.floor(player.position.x / config.SECTOR_SIZE),
        Math.floor(player.position.y / config.SECTOR_SIZE),
        userId
      );
    } catch (err) {
      logger.error(`[DISCONNECT ERROR] Failed to save position for user ${userId}:`, err.message);
    }

    // Notify others
    broadcastToNearby(socket, player, 'player:leave', userId, connectedPlayers, io);

    logger.log(`Player ${player.username} disconnected`);
  }

  // Clean up any active intervals (mining, loot collection, etc.)
  const intervals = activeIntervals.get(socket.id);
  if (intervals) {
    for (const intervalId of intervals) {
      clearInterval(intervalId);
    }
    activeIntervals.delete(socket.id);
  }

  // Cancel any active mining session
  mining.cancelMining(userId);

  connectedPlayers.delete(socket.id);
  userSockets.delete(userId);
  // Clean up player status
  const statusData = playerStatus.get(userId);
  if (statusData && statusData.timeout) {
    clearTimeout(statusData.timeout);
  }
  playerStatus.delete(userId);

  // Clean up any active wormhole transit
  wormhole.cleanupPlayer(userId);
}

module.exports = { register };
