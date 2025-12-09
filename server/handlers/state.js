/**
 * Centralized state management for Galaxy Miner server
 * Single source of truth for all game state
 *
 * This module exports a state object and helper functions that can be used
 * by all handlers without circular dependencies.
 */

const logger = require('../../shared/logger');
const config = require('../config');

// ============================================
// STATE MAPS
// ============================================

// Track connected players: socketId -> { userId, username, position, velocity, etc. }
const connectedPlayers = new Map();

// Reverse lookup: userId -> socketId
const userSockets = new Map();

// Track authenticated user ID per socket: socketId -> userId
const socketAuth = new Map();

// Track player status: userId -> { status, timeout }
const playerStatus = new Map();

// Track active intervals per socket for cleanup: socketId -> Set of intervalIds
const activeIntervals = new Map();

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Get authenticated user ID for a socket
 * @param {string} socketId - Socket ID
 * @returns {number|null} User ID or null if not authenticated
 */
function getAuthUserId(socketId) {
  return socketAuth.get(socketId) || null;
}

/**
 * Set authenticated user ID for a socket
 * @param {string} socketId - Socket ID
 * @param {number|null} userId - User ID or null to clear
 */
function setAuthUserId(socketId, userId) {
  if (userId === null) {
    socketAuth.delete(socketId);
  } else {
    socketAuth.set(socketId, userId);
  }
}

// ============================================
// PLAYER LOOKUP HELPERS
// ============================================

/**
 * Get player by socket ID
 * @param {string} socketId - Socket ID
 * @returns {Object|null} Player object or null
 */
function getPlayerBySocketId(socketId) {
  return connectedPlayers.get(socketId) || null;
}

/**
 * Get socket ID by user ID
 * @param {number} userId - User ID
 * @returns {string|null} Socket ID or null
 */
function getSocketIdByUserId(userId) {
  return userSockets.get(userId) || null;
}

/**
 * Set player data for a socket
 * @param {string} socketId - Socket ID
 * @param {Object} playerData - Player data object
 */
function setPlayer(socketId, playerData) {
  connectedPlayers.set(socketId, playerData);
  if (playerData.id) {
    userSockets.set(playerData.id, socketId);
  }
}

/**
 * Remove player data
 * @param {string} socketId - Socket ID
 */
function removePlayer(socketId) {
  const player = connectedPlayers.get(socketId);
  if (player && player.id) {
    userSockets.delete(player.id);
  }
  connectedPlayers.delete(socketId);
}

// ============================================
// PLAYER STATUS HELPERS
// ============================================

/**
 * Set player status with optional auto-clear timeout
 * @param {number} userId - User ID
 * @param {string} status - Status string ('idle', 'mining', 'collecting', 'combat', 'wormhole', etc.)
 * @param {number} timeout - Optional timeout in ms to auto-clear to 'idle'
 */
function setPlayerStatus(userId, status, timeout = 0) {
  // Clear any existing timeout
  const existing = playerStatus.get(userId);
  if (existing && existing.timeout) {
    clearTimeout(existing.timeout);
  }

  if (timeout > 0) {
    // Set status with auto-clear timeout
    const timeoutId = setTimeout(() => {
      setPlayerStatus(userId, 'idle');
    }, timeout);
    playerStatus.set(userId, { status, timeout: timeoutId });
  } else {
    playerStatus.set(userId, { status, timeout: null });
  }
}

/**
 * Get player status
 * @param {number} userId - User ID
 * @returns {string} Status or 'idle' if not set
 */
function getPlayerStatus(userId) {
  const data = playerStatus.get(userId);
  return data ? data.status : 'idle';
}

/**
 * Clear player status (including any timeout)
 * @param {number} userId - User ID
 */
function clearPlayerStatus(userId) {
  const statusData = playerStatus.get(userId);
  if (statusData && statusData.timeout) {
    clearTimeout(statusData.timeout);
  }
  playerStatus.delete(userId);
}

// ============================================
// INTERVAL TRACKING HELPERS
// ============================================

/**
 * Track an interval for cleanup on disconnect
 * @param {string} socketId - Socket ID
 * @param {number} intervalId - Interval ID from setInterval
 */
function trackInterval(socketId, intervalId) {
  if (!activeIntervals.has(socketId)) {
    activeIntervals.set(socketId, new Set());
  }
  activeIntervals.get(socketId).add(intervalId);
}

/**
 * Remove a tracked interval (when it completes normally)
 * @param {string} socketId - Socket ID
 * @param {number} intervalId - Interval ID
 */
function untrackInterval(socketId, intervalId) {
  const intervals = activeIntervals.get(socketId);
  if (intervals) {
    intervals.delete(intervalId);
    if (intervals.size === 0) {
      activeIntervals.delete(socketId);
    }
  }
}

/**
 * Clear all intervals for a socket
 * @param {string} socketId - Socket ID
 */
function clearAllIntervals(socketId) {
  const intervals = activeIntervals.get(socketId);
  if (intervals) {
    for (const intervalId of intervals) {
      clearInterval(intervalId);
    }
    activeIntervals.delete(socketId);
  }
}

// ============================================
// BROADCAST HELPERS
// ============================================

/**
 * Broadcast event to nearby players
 * @param {Object} socket - Socket instance
 * @param {Object} player - Player object with position and radarTier
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {Object} io - Socket.io server instance
 */
function broadcastToNearby(socket, player, event, data, io) {
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

// ============================================
// CLEANUP HELPER
// ============================================

/**
 * Full cleanup for a player on disconnect
 * This is the single source of truth for cleanup logic
 * @param {Object} socket - Socket instance
 * @param {number} userId - User ID
 * @param {Object} io - Socket.io server instance
 */
function cleanupPlayer(socket, userId, io) {
  const { statements } = require('../database');
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
    broadcastToNearby(socket, player, 'player:leave', userId, io);

    logger.log(`Player ${player.username} disconnected`);
  }

  // Clean up any active intervals (mining, loot collection, etc.)
  clearAllIntervals(socket.id);

  // Cancel any active mining session
  mining.cancelMining(userId);

  // Clean up maps
  removePlayer(socket.id);
  clearPlayerStatus(userId);
  setAuthUserId(socket.id, null);

  // Clean up any active wormhole transit
  wormhole.cleanupPlayer(userId);
}

// ============================================
// EXPORTS
// ============================================

// Export the state object with all maps and helper functions
const state = {
  // State maps (direct access for legacy compatibility)
  connectedPlayers,
  userSockets,
  playerStatus,
  activeIntervals,

  // Authentication helpers
  getAuthUserId,
  setAuthUserId,

  // Player lookup helpers
  getPlayerBySocketId,
  getSocketIdByUserId,
  setPlayer,
  removePlayer,

  // Player status helpers
  setPlayerStatus,
  getPlayerStatus,
  clearPlayerStatus,

  // Interval tracking helpers
  trackInterval,
  untrackInterval,
  clearAllIntervals,

  // Broadcast helpers
  broadcastToNearby,

  // Cleanup
  cleanupPlayer
};

// Export both as named exports (for destructuring) and as default state object
module.exports = {
  // Export state object
  state,

  // Also export everything individually for backward compatibility
  connectedPlayers,
  userSockets,
  playerStatus,
  activeIntervals,
  socketAuth,

  // Helper functions
  getAuthUserId,
  setAuthUserId,
  getPlayerBySocketId,
  getSocketIdByUserId,
  setPlayer,
  removePlayer,
  setPlayerStatus,
  getPlayerStatus,
  clearPlayerStatus,
  trackInterval,
  untrackInterval,
  clearAllIntervals,
  broadcastToNearby,
  cleanupPlayer
};
