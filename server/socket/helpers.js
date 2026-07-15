'use strict';

/**
 * Socket Handler Helpers
 * Shared utilities, state maps, and broadcast functions for socket handlers.
 */

const config = require('../config');
const { statements, safeUpdateCredits, getSafeCredits, safeUpsertInventory } = require('../database');
const {
  playerHasRelic,
  invalidatePlayerRelicCache,
  calculateNpcCreditShare,
  classifyRelicInsert
} = require('../game/relic-effects');
const logger = require('../../shared/logger');
const { getRadarRange } = require('../../shared/utils');

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
const SAFE_SOCKET_BOUNDARY = Symbol('safeSocketBoundary');

// ============================================
// SOCKET ERROR BOUNDARY
// ============================================

/**
 * Guard every subsequently registered socket handler. Socket.io does not catch
 * exceptions or rejected promises from application listeners; without this
 * boundary one malformed authenticated event can reach the process-level fatal
 * handler and terminate the server.
 *
 * Individual handlers should still validate payloads and emit useful domain
 * errors. This is the last line of defence for unexpected programmer/database
 * failures.
 *
 * @param {Object} socket - Socket.io socket
 * @param {Object} handlerLogger - Logger implementation
 * @returns {Object} The socket
 */
function installSafeSocketBoundary(socket, handlerLogger = logger) {
  if (!socket || socket[SAFE_SOCKET_BOUNDARY] || typeof socket.on !== 'function') {
    return socket;
  }

  const originalOn = socket.on.bind(socket);

  const reportFailure = (eventName, error) => {
    const err = error instanceof Error ? error : new Error(String(error));
    handlerLogger.error(`[SOCKET] Unhandled ${eventName} handler failure:`, err);

    if (eventName !== 'disconnect' && typeof socket.emit === 'function') {
      socket.emit('error:generic', { message: 'Unable to process that request.' });
    }
  };

  socket.on = (eventName, handler) => {
    if (typeof handler !== 'function') {
      return originalOn(eventName, handler);
    }

    return originalOn(eventName, function guardedSocketHandler(...args) {
      try {
        const result = handler.apply(this, args);
        if (result && typeof result.then === 'function') {
          return result.catch(error => reportFailure(eventName, error));
        }
        return result;
      } catch (error) {
        reportFailure(eventName, error);
        return undefined;
      }
    });
  };

  Object.defineProperty(socket, SAFE_SOCKET_BOUNDARY, { value: true });
  return socket;
}

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

function getPlayerBroadcastRange(player) {
  const tier = Math.max(
    1,
    Math.min(config.MAX_TIER || 5, Number(player?.radarTier) || 1)
  );
  return getRadarRange(tier) * 2;
}

function getBroadcastCandidateIds(socket, position) {
  const rooms = socket?.nsp?.adapter?.rooms;
  if (!(rooms instanceof Map)) return new Set(connectedPlayers.keys());

  const maxRange = getPlayerBroadcastRange({ radarTier: config.MAX_TIER || 5 });
  // Players currently join their center plus one adjacent sector, so include
  // that membership margin when collecting room candidates.
  const sectorRadius = Math.ceil(maxRange / config.SECTOR_SIZE) + 1;
  const centerX = Math.floor(position.x / config.SECTOR_SIZE);
  const centerY = Math.floor(position.y / config.SECTOR_SIZE);
  const candidates = new Set();

  for (let dx = -sectorRadius; dx <= sectorRadius; dx++) {
    for (let dy = -sectorRadius; dy <= sectorRadius; dy++) {
      const members = rooms.get(`sector:${centerX + dx}:${centerY + dy}`);
      if (!members) continue;
      for (const socketId of members) candidates.add(socketId);
    }
  }
  return candidates;
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
 * Broadcast to nearby players. Sector rooms provide a coarse candidate set;
 * recipient-specific radar distance is then enforced before direct delivery.
 * @param {Object} socket - Socket.io socket (sender, excluded from broadcast)
 * @param {Object} player - Player data with position
 * @param {string} event - Event name
 * @param {*} data - Event data
 */
function broadcastToNearby(socket, player, event, data) {
  if (!player?.position || !Number.isFinite(player.position.x) ||
      !Number.isFinite(player.position.y) || typeof event !== 'string') {
    return 0;
  }

  const candidates = getBroadcastCandidateIds(socket, player.position);
  let delivered = 0;
  for (const socketId of candidates) {
    if (socketId === socket.id) continue;
    const recipient = connectedPlayers.get(socketId);
    if (!recipient?.position) continue;

    const dx = recipient.position.x - player.position.x;
    const dy = recipient.position.y - player.position.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) ||
        Math.hypot(dx, dy) > getPlayerBroadcastRange(recipient)) {
      continue;
    }

    const broadcaster = typeof socket.to === 'function'
      ? socket.to(socketId)
      : socket.nsp?.to?.(socketId);
    if (broadcaster && typeof broadcaster.emit === 'function') {
      broadcaster.emit(event, data);
      delivered++;
    }
  }
  return delivered;
}

// ============================================
// TEAM LOOT DISTRIBUTION
// ============================================

function getContributorIds(damageContributors) {
  if (!damageContributors) return [];

  const rawIds = damageContributors instanceof Map
    ? [...damageContributors.keys()]
    : Object.keys(damageContributors);
  const contributorIds = new Set();

  for (const rawId of rawIds) {
    const playerId = Number(rawId);
    if (Number.isSafeInteger(playerId) && playerId > 0) {
      contributorIds.add(playerId);
    }
  }

  return [...contributorIds];
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  const normalized = Math.floor(numericValue);
  return Number.isSafeInteger(normalized) ? normalized : 0;
}

function getCargoSpace(userId) {
  try {
    const ship = statements.getShipByUserId.get(userId);
    if (!ship) return 0;

    const cargoTier = Math.max(1, Math.floor(Number(ship.cargo_tier) || 1));
    const cargoCapacity = Number(config.CARGO_CAPACITY?.[cargoTier] ?? config.CARGO_CAPACITY?.[1]);
    if (!Number.isFinite(cargoCapacity) || cargoCapacity <= 0) return 0;

    let cargoUsed = 0;
    if (statements.getTotalCargoCount && typeof statements.getTotalCargoCount.get === 'function') {
      cargoUsed = Number(statements.getTotalCargoCount.get(userId, userId)?.total) || 0;
    } else if (statements.getInventory && typeof statements.getInventory.all === 'function') {
      cargoUsed = statements.getInventory.all(userId).reduce(
        (total, item) => total + normalizePositiveInteger(item?.quantity),
        0
      );
    }

    return Math.max(0, Math.floor(cargoCapacity - cargoUsed));
  } catch (error) {
    logger.error(`[LOOT] Unable to read cargo capacity for ${userId}:`, error.message);
    return 0;
  }
}

function splitResourceForCargo(item, availableCapacity) {
  const quantity = normalizePositiveInteger(item?.quantity);
  if (!item || item.type !== 'resource' || typeof item.resourceType !== 'string' || quantity <= 0) {
    return { granted: null, remaining: item || null, usedCapacity: 0 };
  }

  const grantedQuantity = Math.min(quantity, Math.max(0, Math.floor(availableCapacity)));
  return {
    granted: grantedQuantity > 0 ? { ...item, quantity: grantedQuantity } : null,
    remaining: quantity > grantedQuantity ? { ...item, quantity: quantity - grantedQuantity } : null,
    usedCapacity: grantedQuantity
  };
}

function persistResourceShare(playerId, item, availableCapacity) {
  const allocation = splitResourceForCargo(item, availableCapacity);
  if (!allocation.granted) return allocation;

  try {
    const writeResult = safeUpsertInventory(
      playerId,
      allocation.granted.resourceType,
      allocation.granted.quantity
    );
    if (!writeResult || writeResult.changes <= 0) {
      return { granted: null, remaining: item, usedCapacity: 0 };
    }
    return allocation;
  } catch (error) {
    logger.error(`[TEAM LOOT] Error giving resource to ${playerId}:`, error.message);
    return { granted: null, remaining: item, usedCapacity: 0 };
  }
}

/**
 * Distribute credits to team members who contributed damage
 * @param {number} baseCredits - Base credit amount
 * @param {Object} damageContributors - Map of playerId -> damage dealt
 * @param {number} collectorId - ID of player who collected
 * @returns {Object} { total, collectorCredits, distributed: [{ playerId, credits }] }
 */
function distributeTeamCredits(io, baseCredits, damageContributors, collectorId, pendingCredits = null) {
  const numericCollectorId = Number(collectorId);
  if (!Number.isSafeInteger(numericCollectorId) || numericCollectorId <= 0) {
    return { total: 0, collectorCredits: 0, distributed: [], pendingCredits: [] };
  }

  const participants = getContributorIds(damageContributors);
  const normalizedBaseCredits = normalizePositiveInteger(baseCredits);
  const exactPending = Array.isArray(pendingCredits) && pendingCredits.length > 0;
  let plannedRewards = [];
  let teamMultiplier = 1;

  if (exactPending) {
    // Pending rewards already include team and relic bonuses. Retry their exact
    // owner-bound amounts so a transient write failure cannot multiply them.
    const aggregated = new Map();
    for (const reward of pendingCredits) {
      const playerId = Number(reward?.playerId);
      const credits = normalizePositiveInteger(reward?.credits);
      if (!Number.isSafeInteger(playerId) || playerId <= 0 || credits <= 0) continue;
      const updated = (aggregated.get(playerId) || 0) + credits;
      if (Number.isSafeInteger(updated)) aggregated.set(playerId, updated);
    }
    plannedRewards = [...aggregated].map(([playerId, credits]) => ({ playerId, credits }));
  } else if (normalizedBaseCredits > 0 && participants.length === 0) {
    const credits = normalizePositiveInteger(calculateNpcCreditShare(
      normalizedBaseCredits,
      playerHasRelic(statements, numericCollectorId, 'PIRATE_TREASURE')
    ));
    if (credits > 0) plannedRewards.push({ playerId: numericCollectorId, credits });
  } else if (normalizedBaseCredits > 0) {
    const participantCount = participants.length;
    const teamMultipliers = config.TEAM_MULTIPLIERS || { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 };
    teamMultiplier = teamMultipliers[Math.min(participantCount, 4)] || 2.5;
    const teamPool = normalizePositiveInteger(Math.round(normalizedBaseCredits * teamMultiplier));
    const perPlayer = Math.floor(teamPool / participantCount);
    let remainder = teamPool % participantCount;

    // Split the team pool without rounding inflation, then apply each owner's
    // Pirate Treasure bonus independently.
    plannedRewards = participants.map(playerId => {
      const baseShare = perPlayer + (remainder-- > 0 ? 1 : 0);
      return {
        playerId,
        credits: normalizePositiveInteger(calculateNpcCreditShare(
          baseShare,
          playerHasRelic(statements, playerId, 'PIRATE_TREASURE')
        ))
      };
    }).filter(reward => reward.credits > 0);
  }

  if (plannedRewards.length === 0) {
    return { total: 0, collectorCredits: 0, distributed: [], pendingCredits: [] };
  }

  const distributed = [];
  const unawarded = [];
  let collectorCredits = 0;
  let totalCredits = 0;

  for (const reward of plannedRewards) {
    const { playerId, credits } = reward;
    try {
      const ship = statements.getShipByUserId.get(playerId);
      const currentCredits = getSafeCredits(ship);
      const nextCredits = currentCredits + credits;
      if (!ship || !Number.isSafeInteger(nextCredits)) {
        unawarded.push(reward);
        continue;
      }

      const writeResult = safeUpdateCredits(nextCredits, playerId);
      if (!writeResult || writeResult.changes <= 0) {
        unawarded.push(reward);
        continue;
      }

      distributed.push(reward);
      totalCredits += credits;
      if (playerId === numericCollectorId) {
        collectorCredits += credits;
      }
    } catch (err) {
      logger.error(`[TEAM CREDITS] Error distributing to ${playerId}:`, err.message);
      unawarded.push(reward);
    }
  }

  // Notify non-collector recipients after the actual relic-adjusted total is known.
  for (const reward of distributed) {
    if (reward.playerId === numericCollectorId) continue;

    const socketId = userSockets.get(reward.playerId) || userSockets.get(String(reward.playerId));
    if (socketId) {
      try {
        io.to(socketId).emit('team:creditReward', {
          credits: reward.credits,
          totalTeamCredits: totalCredits,
          participantCount: plannedRewards.length
        });

        const inventory = statements.getInventory.all(reward.playerId);
        const updatedShip = statements.getShipByUserId.get(reward.playerId);
        io.to(socketId).emit('inventory:update', {
          inventory,
          credits: getSafeCredits(updatedShip)
        });
      } catch (error) {
        // Reward persistence already succeeded. A notification failure must not
        // make the settlement retry and duplicate the durable credit write.
        logger.error(`[TEAM CREDITS] Unable to notify ${reward.playerId}:`, error.message);
      }
    }
  }

  logger.log(`[TEAM CREDITS] Distributed ${totalCredits} credits (${teamMultiplier}x team pool plus owner relic bonuses) to ${distributed.length} players`);

  return { total: totalCredits, collectorCredits, distributed, pendingCredits: unawarded };
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
  const numericCollectorId = Number(collectorId);
  const participants = getContributorIds(damageContributors);
  const collectorContributed = participants.includes(numericCollectorId);
  const result = {
    collectorLoot: [],      // Items that go to collector
    teamShares: new Map(),  // playerId -> [items]
    rareDropNotifications: [], // Rare items collector got (for team notification)
    remainingLoot: []       // Cargo overflow or rejected durable writes
  };

  // With no contribution record, the collector is treated as the solo owner.
  if (participants.length === 0 ||
      !Number.isSafeInteger(numericCollectorId) || numericCollectorId <= 0) {
    result.collectorLoot = contents;
    return result;
  }

  const recipientCount = participants.length;

  // Initialize team shares
  for (const playerId of participants) {
    if (playerId !== numericCollectorId) {
      result.teamShares.set(playerId, []);
    }
  }

  for (const item of contents) {
    if (item.type === 'resource') {
      const rarity = item.rarity || 'common';

      if (rarity === 'common' || rarity === 'uncommon') {
        // Split common/uncommon resources equally
        const perPlayer = Math.floor(item.quantity / recipientCount);
        const remainder = item.quantity % recipientCount;

        if (perPlayer > 0) {
          // The collector receives a common-resource share only if they helped
          // earn the wreckage. Otherwise all common cargo stays with contributors.
          if (collectorContributed) {
            result.collectorLoot.push({
              ...item,
              quantity: perPlayer + remainder
            });
          }

          let remainderAssigned = collectorContributed;
          for (const playerId of participants) {
            if (playerId === numericCollectorId) continue;

            const shares = result.teamShares.get(playerId);
            const playerRemainder = !remainderAssigned ? remainder : 0;
            remainderAssigned = true;
            shares.push({
              ...item,
              quantity: perPlayer + playerRemainder
            });
          }
        } else {
          // Not enough to split: prefer a contributing collector, otherwise
          // preserve the units for the first damage contributor.
          if (collectorContributed) {
            result.collectorLoot.push(item);
          } else {
            result.teamShares.get(participants[0]).push(item);
          }
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

  // Persist team member shares within each owner's cargo limit. Replace the
  // planned shares with the actually awarded shares and preserve every rejected
  // or overflow unit for the wreckage settlement phase.
  for (const [playerId, plannedItems] of result.teamShares) {
    let availableCapacity = getCargoSpace(playerId);
    const awardedItems = [];
    for (const item of plannedItems) {
      const allocation = persistResourceShare(playerId, item, availableCapacity);
      if (allocation.granted) {
        awardedItems.push(allocation.granted);
        availableCapacity -= allocation.usedCapacity;
      }
      if (allocation.remaining) result.remainingLoot.push(allocation.remaining);
    }
    result.teamShares.set(playerId, awardedItems);

    if (awardedItems.length > 0) {

      // Notify team member of their share
      const socketId = userSockets.get(playerId);
      if (socketId) {
        try {
          io.to(socketId).emit('team:lootShare', {
            resources: awardedItems,
            rareDropNotification: result.rareDropNotifications.length > 0 ? result.rareDropNotifications : null,
            collectorId: numericCollectorId
          });

          // Update their inventory display
          const inventory = statements.getInventory.all(playerId);
          const ship = statements.getShipByUserId.get(playerId);
          io.to(socketId).emit('inventory:update', {
            inventory,
            credits: getSafeCredits(ship)
          });
        } catch (error) {
          logger.error(`[TEAM LOOT] Unable to notify ${playerId}:`, error.message);
        }
      }
    } else if (result.rareDropNotifications.length > 0) {
      // No shared resources but notify about rare drops
      const socketId = userSockets.get(playerId);
      if (socketId) {
        try {
          io.to(socketId).emit('team:lootShare', {
            resources: [],
            rareDropNotification: result.rareDropNotifications,
            collectorId: numericCollectorId
          });
        } catch (error) {
          logger.error(`[TEAM LOOT] Unable to notify ${playerId}:`, error.message);
        }
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
    duplicateRelics: [],
    buffs: [],
    errors: [],
    remainingLoot: []
  };

  let availableCargo = getCargoSpace(userId);

  for (const item of contents) {
    try {
      switch (item.type) {
        case 'credits':
          // Add credits to player (only if amount is valid)
          if (normalizePositiveInteger(item.amount) > 0) {
            const amount = normalizePositiveInteger(item.amount);
            const ship = statements.getShipByUserId.get(userId);
            const currentCredits = getSafeCredits(ship);
            const nextCredits = currentCredits + amount;
            const creditResult = ship && Number.isSafeInteger(nextCredits)
              ? safeUpdateCredits(nextCredits, userId)
              : null;
            if (creditResult && creditResult.changes > 0) {
              results.credits += amount;
            } else {
              results.remainingLoot.push({ ...item, amount });
            }
          }
          break;

        case 'resource': {
          const allocation = persistResourceShare(userId, item, availableCargo);
          if (allocation.granted) {
            availableCargo -= allocation.usedCapacity;
            results.resources.push({
              type: allocation.granted.resourceType,
              quantity: allocation.granted.quantity
            });
          }
          if (allocation.remaining) results.remainingLoot.push(allocation.remaining);
          break;
        }

        case 'component':
          // Add component to components table
          statements.upsertComponent.run(userId, item.componentType, 1);
          results.components.push({
            type: item.componentType
          });
          break;

        case 'relic':
          // INSERT OR IGNORE reports whether this was a real acquisition. Never
          // show an "acquired" result for a duplicate that the database rejected.
          const relicInsert = statements.addRelic.run(userId, item.relicType);
          const acquisition = classifyRelicInsert(item.relicType, relicInsert);
          if (acquisition.acquired) {
            invalidatePlayerRelicCache(statements, userId, item.relicType);
            results.relics.push(acquisition.result);

            // Update the live client collection immediately; the loot result owns
            // the reward popup, so this state-sync event is intentionally silent.
            const relicSocketId = userSockets.get(userId);
            if (relicSocketId) {
              const connectedPlayer = connectedPlayers.get(relicSocketId);
              if (connectedPlayer) {
                if (!Array.isArray(connectedPlayer.relicTypes)) connectedPlayer.relicTypes = [];
                if (!connectedPlayer.relicTypes.includes(acquisition.result.type)) {
                  connectedPlayer.relicTypes.push(acquisition.result.type);
                }
              }
              io.to(relicSocketId).emit('relic:collected', {
                relicType: item.relicType,
                showReward: false
              });
            }
          } else {
            if (acquisition.result) results.duplicateRelics.push(acquisition.result);
          }
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

        default:
          results.errors.push({ type: item?.type, error: 'Unsupported loot item' });
          results.remainingLoot.push(item);
          break;
      }
    } catch (err) {
      logger.error(`[LOOT ERROR] User ${userId} processing ${item?.type}:`, err.message);
      results.errors.push({ type: item?.type, error: err.message });
      results.remainingLoot.push(item);
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

  // Socket safety
  installSafeSocketBoundary,

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
  getPlayerBroadcastRange,
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
