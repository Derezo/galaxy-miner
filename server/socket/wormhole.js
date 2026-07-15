'use strict';

/**
 * Wormhole Socket Handler
 * Events: wormhole:enter, wormhole:selectDestination, wormhole:cancel, wormhole:getProgress, wormhole:getNearestPosition
 */

const config = require('../config');
const { statements } = require('../database');
const wormhole = require('../game/wormhole');
const world = require('../world');
const {
  getPlayerBoostAuthority,
  setPlayerBoostAuthority
} = require('./boost-authority');
const logger = require('../../shared/logger');

const NEAREST_WORMHOLE_REQUEST_INTERVAL_MS = 5000;
const NEAREST_WORMHOLE_CACHE_TTL_MS = 60000;
const MAX_NEAREST_WORMHOLE_CACHE_ENTRIES = 256;
const nearestWormholeBySector = new Map();

function getNearestWormholeCacheKey(position) {
  const sectorX = Math.floor(position.x / config.SECTOR_SIZE);
  const sectorY = Math.floor(position.y / config.SECTOR_SIZE);
  return `${sectorX}:${sectorY}`;
}

function readNearestWormholeCache(key, now) {
  const cached = nearestWormholeBySector.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= now) {
    nearestWormholeBySector.delete(key);
    return undefined;
  }

  // Refresh insertion order so the bounded map behaves as an LRU cache.
  nearestWormholeBySector.delete(key);
  nearestWormholeBySector.set(key, cached);
  return cached.wormhole;
}

function writeNearestWormholeCache(key, wormhole, now) {
  if (nearestWormholeBySector.has(key)) {
    nearestWormholeBySector.delete(key);
  }
  while (nearestWormholeBySector.size >= MAX_NEAREST_WORMHOLE_CACHE_ENTRIES) {
    const oldestKey = nearestWormholeBySector.keys().next().value;
    nearestWormholeBySector.delete(oldestKey);
  }
  nearestWormholeBySector.set(key, {
    wormhole,
    expiresAt: now + NEAREST_WORMHOLE_CACHE_TTL_MS
  });
}

function normalizeNearestWormhole(wormhole) {
  if (!wormhole ||
      typeof wormhole.id !== 'string' ||
      !Number.isFinite(wormhole.x) ||
      !Number.isFinite(wormhole.y)) {
    return null;
  }
  return { id: wormhole.id, x: wormhole.x, y: wormhole.y };
}

function withDistance(wormhole, position) {
  if (!wormhole) return null;
  return {
    ...wormhole,
    distance: Math.hypot(wormhole.x - position.x, wormhole.y - position.y)
  };
}

/**
 * Register wormhole socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  let lastNearestWormholeRequestAt = 0;
  const {
    connectedPlayers,
    setPlayerStatus,
    getPlayerStatus,
    broadcastToNearby,
    updatePlayerSectorRooms,
    trackInterval,
    untrackInterval
  } = deps.state;

  // Wormhole: Enter wormhole
  socket.on('wormhole:enter', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    if (player.isDead) {
      socket.emit('wormhole:error', { message: 'Cannot enter a wormhole while destroyed.' });
      return;
    }

    if (!data || typeof data.wormholeId !== 'string') {
      socket.emit('wormhole:error', { message: 'Invalid wormhole.' });
      return;
    }
    const { wormholeId } = data;

    // Create player object with required properties
    const playerData = {
      id: authenticatedUserId,
      x: player.position.x,
      y: player.position.y
    };

    const result = wormhole.enterWormhole(playerData, wormholeId, cancellation => {
      if (!connectedPlayers.has(socket.id)) return;
      setPlayerStatus(authenticatedUserId, 'idle');
      socket.emit('wormhole:cancelled', { reason: cancellation.reason });
      broadcastToNearby(socket, player, 'wormhole:playerCancelled', {
        playerId: authenticatedUserId
      });
    });

    if (result.success) {
      // Entering a wormhole is an authoritative action transition. End mining
      // immediately instead of waiting for its socket poll to notice transit.
      const miningSystem = deps.mining;
      if (miningSystem?.isMining?.(authenticatedUserId)) {
        miningSystem.cancelMining(authenticatedUserId);
        if (typeof getPlayerStatus !== 'function' ||
            getPlayerStatus(authenticatedUserId) === 'mining') {
          setPlayerStatus(authenticatedUserId, 'idle');
        }
        socket.emit('mining:cancelled', { reason: 'Wormhole transit started' });
        broadcastToNearby(socket, player, 'mining:playerStopped', {
          playerId: authenticatedUserId
        });
      }

      // Set player status to show they're in wormhole
      setPlayerStatus(authenticatedUserId, 'wormhole');

      socket.emit('wormhole:entered', {
        wormholeId,
        destinations: result.destinations
      });

      // Broadcast to nearby players that player entered wormhole
      broadcastToNearby(socket, player, 'wormhole:playerEntered', {
        playerId: authenticatedUserId,
        wormholeId
      });
    } else {
      socket.emit('wormhole:error', { message: result.error });
    }
  });

  // Wormhole: Select destination
  socket.on('wormhole:selectDestination', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    if (player.isDead) {
      wormhole.cancelTransit(authenticatedUserId, 'Player destroyed', true);
      setPlayerStatus(authenticatedUserId, 'idle');
      return;
    }

    if (!data || typeof data.destinationId !== 'string') {
      socket.emit('wormhole:error', { message: 'Invalid destination.' });
      return;
    }
    const { destinationId } = data;

    const result = wormhole.selectDestination(authenticatedUserId, destinationId);

    if (result.success) {
      socket.emit('wormhole:transitStarted', {
        destinationId,
        destination: result.destination,
        duration: result.duration,
        hasVoidWarp: result.hasVoidWarp || false
      });

      // Broadcast transit start to nearby players
      broadcastToNearby(socket, player, 'wormhole:playerTransiting', {
        playerId: authenticatedUserId,
        destinationId
      });

      // Set up transit completion check
      const transitTimeout = setTimeout(() => {
        untrackInterval?.(socket.id, transitTimeout);
        const completeResult = wormhole.completeTransit(authenticatedUserId);

        if (completeResult.success) {
          // Update player position
          player.position = { x: completeResult.position.x, y: completeResult.position.y };
          player.velocity = { x: 0, y: 0 };
          player.lastMovementAt = Date.now();
          player.movementBudget = null;
          player.movementBudgetAt = player.lastMovementAt;
          const persistedBoost = getPlayerBoostAuthority(player.id);
          const now = Date.now();
          const localCooldownEndAt = Number(player.serverBoostCooldownEndAt) || 0;
          const cooldownEndAt = Math.max(
            localCooldownEndAt > now ? localCooldownEndAt : 0,
            persistedBoost.cooldownEndAt > now ? persistedBoost.cooldownEndAt : 0
          );
          player.serverBoostEndAt = 0;
          player.serverBoostRecoveryEndAt = 0;
          player.serverBoostCooldownEndAt = cooldownEndAt;
          setPlayerBoostAuthority(player.id, {
            boostEndAt: 0,
            recoveryEndAt: 0,
            cooldownEndAt
          });

          // Update player spatial hash for new wormhole exit position
          deps.engine.updatePlayerInHash(socket.id, player);
          updatePlayerSectorRooms?.(socket, player);

          // Save new position to database
          const sectorX = Math.floor(completeResult.position.x / config.SECTOR_SIZE);
          const sectorY = Math.floor(completeResult.position.y / config.SECTOR_SIZE);
          statements.updateShipPosition.run(
            completeResult.position.x, completeResult.position.y, player.rotation,
            0, 0,
            sectorX, sectorY,
            authenticatedUserId
          );

          // Clear player status
          setPlayerStatus(authenticatedUserId, 'idle');

          socket.emit('wormhole:exitComplete', {
            position: completeResult.position,
            wormholeId: completeResult.wormholeId,
            hasVoidWarp: completeResult.hasVoidWarp || false
          });

          // Broadcast exit to nearby players at new location
          broadcastToNearby(socket, player, 'wormhole:playerExited', {
            playerId: authenticatedUserId,
            x: completeResult.position.x,
            y: completeResult.position.y
          });
        }
      }, result.duration);
      trackInterval?.(socket.id, transitTimeout);
    } else {
      socket.emit('wormhole:error', { message: result.error });
    }
  });

  // Wormhole: Cancel transit
  socket.on('wormhole:cancel', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const result = wormhole.cancelTransit(authenticatedUserId, 'Cancelled by player');

    if (result.success) {
      setPlayerStatus(authenticatedUserId, 'idle');
      socket.emit('wormhole:cancelled', { reason: result.reason });

      // Broadcast cancellation to nearby players
      broadcastToNearby(socket, player, 'wormhole:playerCancelled', {
        playerId: authenticatedUserId
      });
    } else {
      socket.emit('wormhole:error', { message: result.error });
    }
  });

  // Wormhole: Get transit progress
  socket.on('wormhole:getProgress', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const progress = wormhole.getTransitProgress(authenticatedUserId);
    socket.emit('wormhole:progress', progress);
  });

  // Wormhole: Get nearest wormhole position (for wormhole gem directional indicator)
  socket.on('wormhole:getNearestPosition', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player || !player.position) {
      logger.log('[Wormhole] getNearestPosition - no player or position');
      return;
    }

    // Throttle before even touching SQLite so unauthorized event floods remain
    // cheap as well as being unable to trigger procedural generation.
    const now = Date.now();
    if (now - lastNearestWormholeRequestAt < NEAREST_WORMHOLE_REQUEST_INTERVAL_MS) {
      return;
    }
    lastNearestWormholeRequestAt = now;

    // This is a relic effect, not a general-purpose procedural-world query.
    // Fail closed if the authoritative ownership lookup is unavailable.
    let hasWormholeGem = false;
    try {
      hasWormholeGem = !!statements.hasRelic.get(authenticatedUserId, 'WORMHOLE_GEM');
    } catch (error) {
      logger.error('[Wormhole] Failed to verify Wormhole Gem ownership:', error);
    }
    if (!hasWormholeGem) {
      socket.emit('wormhole:error', { message: 'Wormhole Gem required.' });
      return;
    }

    logger.log('[Wormhole] getNearestPosition request from player at', Math.round(player.position.x), Math.round(player.position.y));

    const cacheKey = getNearestWormholeCacheKey(player.position);
    let cachedWormhole = readNearestWormholeCache(cacheKey, now);
    if (cachedWormhole === undefined) {
      cachedWormhole = normalizeNearestWormhole(world.findNearestWormhole(
        player.position.x,
        player.position.y
      ));
      // Cache misses too: an empty 100-sector scan is the most expensive case.
      writeNearestWormholeCache(cacheKey, cachedWormhole, now);
    }
    const nearestWormhole = withDistance(cachedWormhole, player.position);

    if (nearestWormhole) {
      logger.log('[Wormhole] Found nearest at', Math.round(nearestWormhole.x), Math.round(nearestWormhole.y), 'distance:', Math.round(nearestWormhole.distance));
    } else {
      logger.log('[Wormhole] No wormhole found in search radius');
    }

    socket.emit('wormhole:nearestPosition', nearestWormhole);
  });
}

module.exports = { register };
