'use strict';

/**
 * Socket Handler Helpers
 * Shared utilities, state maps, and broadcast functions for socket handlers.
 */

const config = require('../config');
const { statements, safeUpdateCredits, getSafeCredits, safeUpsertInventory } = require('../database');
const logger = require('../../shared/logger');

// ============================================
// SHARED STATE MAPS
// ============================================

// Track connected players: socketId -> { userId, username, position, etc. }
const connectedPlayers = new Map();

// Reverse lookup: userId -> socketId
const userSockets = new Map();

// Track player status: userId -> { status, statusTimeout }
const playerStatus = new Map();

// Track active intervals per socket for cleanup: socketId -> Set of intervalIds
const activeIntervals = new Map();

// Track current sector room for each player: socketId -> 'sector:X:Y'
const playerSectorRooms = new Map();

// Pre-computed Sets for O(1) validation (avoid Array.includes in hot paths)
const VALID_COMPONENTS = new Set(['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar', 'energy_core', 'hull']);
const VALID_COLORS = new Set(config.PLAYER_COLOR_OPTIONS.map(c => c.id));
const VALID_PROFILES = new Set((config.PROFILE_OPTIONS || []).map(p => p.id));

// ============================================
// INTERVAL TRACKING
// ============================================

/**
 * Track an interval for cleanup on disconnect
 * @param {string} socketId - Socket ID
 * @param {number} intervalId - Interval/timeout ID to track
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
 * @param {number} intervalId - Interval/timeout ID to untrack
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
 * Clear all tracked intervals for a socket
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
// PLAYER STATUS
// ============================================

/**
 * Set player status with optional timeout
 * @param {number} userId - User ID
 * @param {string} status - Status string ('idle', 'combat', 'mining', 'collecting', 'wormhole')
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
 * @returns {string} Current status or 'idle'
 */
function getPlayerStatus(userId) {
  const statusData = playerStatus.get(userId);
  return statusData ? statusData.status : 'idle';
}

/**
 * Clean up player status on disconnect
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
// SECTOR ROOMS
// ============================================

/**
 * Get sector room name from position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {string} Room name like 'sector:5:3'
 */
function getSectorRoom(x, y) {
  const sectorX = Math.floor(x / config.SECTOR_SIZE);
  const sectorY = Math.floor(y / config.SECTOR_SIZE);
  return `sector:${sectorX}:${sectorY}`;
}

/**
 * Get all adjacent sector rooms (3x3 grid centered on position)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {string[]} Array of room names
 */
function getAdjacentSectorRooms(x, y) {
  const sectorX = Math.floor(x / config.SECTOR_SIZE);
  const sectorY = Math.floor(y / config.SECTOR_SIZE);
  const rooms = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      rooms.push(`sector:${sectorX + dx}:${sectorY + dy}`);
    }
  }
  return rooms;
}

/**
 * Update player's sector rooms when they move between sectors
 * @param {Object} socket - Socket.io socket
 * @param {Object} player - Player data with position
 * @returns {boolean} True if sector changed
 */
function updatePlayerSectorRooms(socket, player) {
  const newCenterRoom = getSectorRoom(player.position.x, player.position.y);
  const currentRoom = playerSectorRooms.get(socket.id);

  // Only update if sector changed
  if (currentRoom === newCenterRoom) return false;

  // Leave old sector rooms
  if (currentRoom) {
    const [, oldSectorX, oldSectorY] = currentRoom.split(':');
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        socket.leave(`sector:${parseInt(oldSectorX) + dx}:${parseInt(oldSectorY) + dy}`);
      }
    }
  }

  // Join new sector rooms (3x3 grid)
  const newRooms = getAdjacentSectorRooms(player.position.x, player.position.y);
  for (const room of newRooms) {
    socket.join(room);
  }

  // Track current center sector
  playerSectorRooms.set(socket.id, newCenterRoom);
  return true;
}

/**
 * Join initial sector rooms for a new player
 * @param {Object} socket - Socket.io socket
 * @param {Object} player - Player data with position
 */
function joinSectorRooms(socket, player) {
  const rooms = getAdjacentSectorRooms(player.position.x, player.position.y);
  for (const room of rooms) {
    socket.join(room);
  }
  playerSectorRooms.set(socket.id, getSectorRoom(player.position.x, player.position.y));
}

/**
 * Leave all sector rooms on disconnect
 * @param {Object} socket - Socket.io socket
 */
function leaveSectorRooms(socket) {
  const currentRoom = playerSectorRooms.get(socket.id);
  if (currentRoom) {
    const [, sectorX, sectorY] = currentRoom.split(':');
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        socket.leave(`sector:${parseInt(sectorX) + dx}:${parseInt(sectorY) + dy}`);
      }
    }
    playerSectorRooms.delete(socket.id);
  }
}

// ============================================
// BROADCASTING
// ============================================

/**
 * Broadcast to nearby players using sector rooms
 * Uses Socket.io rooms for O(1) broadcast instead of iterating all players
 * @param {Object} socket - Socket.io socket (sender, excluded from broadcast)
 * @param {Object} player - Player data with position
 * @param {string} event - Event name
 * @param {*} data - Event data
 */
function broadcastToNearby(socket, player, event, data) {
  const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
  const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

  // Broadcast to 3x3 sector grid (current + adjacent sectors)
  // This covers the radar range which is typically less than 2 sectors
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const room = `sector:${sectorX + dx}:${sectorY + dy}`;
      socket.to(room).emit(event, data);
    }
  }
}

// ============================================
// TEAM LOOT DISTRIBUTION
// ============================================

/**
 * Distribute credits to team members who contributed damage
 * @param {number} baseCredits - Base credit amount
 * @param {Object} damageContributors - Map of playerId -> damage dealt
 * @param {number} collectorId - ID of player who collected
 * @returns {Object} { total, collectorCredits, distributed: [{ playerId, credits }] }
 */
function distributeTeamCredits(io, baseCredits, damageContributors, collectorId) {
  // If no base credits or invalid, return 0 for all
  if (!baseCredits || typeof baseCredits !== 'number' || baseCredits <= 0) {
    return { total: 0, collectorCredits: 0, distributed: [] };
  }

  // If no damage contributors, collector gets all credits
  if (!damageContributors || Object.keys(damageContributors).length === 0) {
    // Solo kill - collector gets base credits
    const ship = statements.getShipByUserId.get(collectorId);
    if (ship) {
      const currentCredits = getSafeCredits(ship);
      safeUpdateCredits(currentCredits + baseCredits, collectorId);
    }
    return { total: baseCredits, collectorCredits: baseCredits, distributed: [{ playerId: collectorId, credits: baseCredits }] };
  }

  const participants = Object.keys(damageContributors);
  const participantCount = participants.length;
  // Convert collectorId to string to match Object.keys() output (keys are always strings)
  const collectorIdStr = String(collectorId);

  // Apply team bonus multiplier
  const teamMultipliers = config.TEAM_MULTIPLIERS || { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 };
  const teamMultiplier = teamMultipliers[Math.min(participantCount, 4)] || 2.5;
  const totalCredits = Math.round(baseCredits * teamMultiplier);
  const creditsPerPlayer = Math.round(totalCredits / participantCount);

  const distributed = [];
  let collectorCredits = 0;

  // Distribute credits to all contributors
  for (const playerId of participants) {
    try {
      const ship = statements.getShipByUserId.get(playerId);
      if (ship) {
        const currentCredits = getSafeCredits(ship);
        safeUpdateCredits(currentCredits + creditsPerPlayer, playerId);

        distributed.push({ playerId, credits: creditsPerPlayer });

        if (playerId === collectorIdStr) {
          collectorCredits = creditsPerPlayer;
        }

        // Notify non-collector team members of their credit reward
        if (playerId !== collectorIdStr) {
          const socketId = userSockets.get(playerId);
          if (socketId) {
            io.to(socketId).emit('team:creditReward', {
              credits: creditsPerPlayer,
              totalTeamCredits: totalCredits,
              participantCount
            });

            // Also update their inventory display
            const inventory = statements.getInventory.all(playerId);
            const updatedShip = statements.getShipByUserId.get(playerId);
            io.to(socketId).emit('inventory:update', {
              inventory,
              credits: getSafeCredits(updatedShip)
            });
          }
        }
      }
    } catch (err) {
      logger.error(`[TEAM CREDITS] Error distributing to ${playerId}:`, err.message);
    }
  }

  // If collector wasn't a contributor (rare - e.g., collected someone else's kill), they still get share
  if (!participants.includes(collectorIdStr)) {
    const ship = statements.getShipByUserId.get(collectorId);
    if (ship) {
      const currentCredits = getSafeCredits(ship);
      safeUpdateCredits(currentCredits + creditsPerPlayer, collectorId);
      collectorCredits = creditsPerPlayer;
      distributed.push({ playerId: collectorId, credits: creditsPerPlayer });
    }
  }

  logger.log(`[TEAM CREDITS] Distributed ${totalCredits} credits (${teamMultiplier}x bonus) to ${participantCount} players`);

  return { total: totalCredits, collectorCredits, distributed };
}

/**
 * Distribute resources to team members based on rarity
 * Common/Uncommon: Split equally between all participants
 * Rare/Ultrarare: Collector only, team gets notification
 * @param {Object} io - Socket.io server instance
 * @param {Array} contents - Loot contents
 * @param {Object} damageContributors - Map of playerId -> damage dealt
 * @param {number} collectorId - ID of player who collected
 * @returns {Object} { collectorLoot, teamShares, rareDropNotifications }
 */
function distributeTeamResources(io, contents, damageContributors, collectorId) {
  const collectorIdStr = String(collectorId);
  const result = {
    collectorLoot: [],      // Items that go to collector
    teamShares: new Map(),  // playerId -> [items]
    rareDropNotifications: [] // Rare items collector got (for team notification)
  };

  // If no team (solo kill), collector gets everything
  if (!damageContributors || Object.keys(damageContributors).length <= 1) {
    result.collectorLoot = contents;
    return result;
  }

  const participants = Object.keys(damageContributors);
  const participantCount = participants.length;

  // Initialize team shares
  for (const playerId of participants) {
    if (playerId !== collectorIdStr) {
      result.teamShares.set(playerId, []);
    }
  }

  for (const item of contents) {
    if (item.type === 'resource') {
      const rarity = item.rarity || 'common';

      if (rarity === 'common' || rarity === 'uncommon') {
        // Split common/uncommon resources equally
        const perPlayer = Math.floor(item.quantity / participantCount);
        const remainder = item.quantity % participantCount;

        if (perPlayer > 0) {
          // Collector gets their share + remainder
          result.collectorLoot.push({
            ...item,
            quantity: perPlayer + remainder
          });

          // Other team members get their share
          for (const playerId of participants) {
            if (playerId !== collectorIdStr) {
              const shares = result.teamShares.get(playerId);
              shares.push({
                ...item,
                quantity: perPlayer
              });
            }
          }
        } else {
          // Not enough to split - collector gets all
          result.collectorLoot.push(item);
        }
      } else {
        // Rare/Ultrarare resources go to collector only
        result.collectorLoot.push(item);
        result.rareDropNotifications.push({
          resourceType: item.resourceType,
          quantity: item.quantity,
          rarity
        });
      }
    } else {
      // Non-resource items (buffs, components, relics) go to collector only
      result.collectorLoot.push(item);
    }
  }

  // Process team member shares and send notifications
  for (const [playerId, items] of result.teamShares) {
    if (items.length > 0) {
      // Add resources to team member's inventory
      for (const item of items) {
        try {
          safeUpsertInventory(playerId, item.resourceType, item.quantity);
        } catch (err) {
          logger.error(`[TEAM LOOT] Error giving resource to ${playerId}:`, err.message);
        }
      }

      // Notify team member of their share
      const socketId = userSockets.get(playerId);
      if (socketId) {
        io.to(socketId).emit('team:lootShare', {
          resources: items,
          rareDropNotification: result.rareDropNotifications.length > 0 ? result.rareDropNotifications : null,
          collectorId: collectorIdStr
        });

        // Update their inventory display
        const inventory = statements.getInventory.all(playerId);
        const ship = statements.getShipByUserId.get(playerId);
        io.to(socketId).emit('inventory:update', {
          inventory,
          credits: getSafeCredits(ship)
        });
      }
    } else if (result.rareDropNotifications.length > 0) {
      // No shared resources but notify about rare drops
      const socketId = userSockets.get(playerId);
      if (socketId) {
        io.to(socketId).emit('team:lootShare', {
          resources: [],
          rareDropNotification: result.rareDropNotifications,
          collectorId: collectorIdStr
        });
      }
    }
  }

  if (result.rareDropNotifications.length > 0) {
    logger.log(`[TEAM LOOT] Collector got ${result.rareDropNotifications.length} rare+ drops, team notified`);
  }

  return result;
}

/**
 * Process collected loot and add to player
 * @param {Object} io - Socket.io server instance
 * @param {number} userId - User ID
 * @param {Array} contents - Loot contents
 * @returns {Object} Results with credits, resources, components, relics, buffs, errors
 */
function processCollectedLoot(io, userId, contents) {
  const results = {
    credits: 0,
    resources: [],
    components: [],
    relics: [],
    buffs: [],
    errors: []
  };

  for (const item of contents) {
    try {
      switch (item.type) {
        case 'credits':
          // Add credits to player (only if amount is valid)
          if (typeof item.amount === 'number' && item.amount > 0 && !Number.isNaN(item.amount)) {
            const ship = statements.getShipByUserId.get(userId);
            const currentCredits = getSafeCredits(ship);
            safeUpdateCredits(currentCredits + item.amount, userId);
            results.credits += item.amount;
          }
          break;

        case 'resource':
          // Add resource to inventory using safe wrapper
          const resourceResult = safeUpsertInventory(userId, item.resourceType, item.quantity);
          if (resourceResult.changes > 0) {
            results.resources.push({
              type: item.resourceType,
              quantity: item.quantity
            });
          }
          break;

        case 'component':
          // Add component to components table
          statements.upsertComponent.run(userId, item.componentType, 1);
          results.components.push({
            type: item.componentType
          });
          break;

        case 'relic':
          // Add relic to relics table (only if not already owned)
          statements.addRelic.run(userId, item.relicType);
          results.relics.push({
            type: item.relicType
          });
          break;

        case 'buff':
          // Apply temporary buff
          const buffConfig = config.BUFF_TYPES ? config.BUFF_TYPES[item.buffType] : null;
          const duration = buffConfig ? buffConfig.duration : 60000; // Default 60s
          const expiresAt = Date.now() + duration;
          statements.addBuff.run(userId, item.buffType, expiresAt);
          results.buffs.push({
            type: item.buffType,
            duration,
            expiresAt
          });

          // Notify player of buff application
          const socketId = userSockets.get(userId);
          if (socketId) {
            io.to(socketId).emit('buff:applied', {
              buffType: item.buffType,
              duration,
              expiresAt
            });
          }
          break;
      }
    } catch (err) {
      logger.error(`[LOOT ERROR] User ${userId} processing ${item.type}:`, err.message);
      results.errors.push({ type: item.type, error: err.message });
    }
  }

  return results;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // State maps
  connectedPlayers,
  userSockets,
  playerStatus,
  activeIntervals,
  playerSectorRooms,

  // Validation sets
  VALID_COMPONENTS,
  VALID_COLORS,
  VALID_PROFILES,

  // Interval tracking
  trackInterval,
  untrackInterval,
  clearAllIntervals,

  // Player status
  setPlayerStatus,
  getPlayerStatus,
  clearPlayerStatus,

  // Sector rooms
  getSectorRoom,
  getAdjacentSectorRooms,
  updatePlayerSectorRooms,
  joinSectorRooms,
  leaveSectorRooms,

  // Broadcasting
  broadcastToNearby,

  // Team loot distribution
  distributeTeamCredits,
  distributeTeamResources,
  processCollectedLoot
};
