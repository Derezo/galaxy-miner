// Galaxy Miner - Mining System (Server-side)

const config = require('../config');
const world = require('../world');
const { statements, completeMiningYield } = require('../database');
const {
  playerHasRelic,
  calculateMiningYield,
  getRelicEffect
} = require('./relic-effects');
const logger = require('../../shared/logger');

// Track active mining sessions: playerId -> { objectId, startTime, ... }
const activeMining = new Map();

function isFinitePosition(position) {
  return !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
}

function startMining(playerId, playerPosition, objectId, clientObjectPosition = null) {
  if (!isFinitePosition(playerPosition)) {
    return { success: false, error: 'Invalid player position' };
  }

  if (clientObjectPosition !== null && !isFinitePosition(clientObjectPosition)) {
    return { success: false, error: 'Invalid resource position' };
  }

  // Debug logging for mining issues
  logger.log('[Mining] Start request:', {
    playerId,
    objectId,
    playerPosition: { x: Math.round(playerPosition.x), y: Math.round(playerPosition.y) },
    clientObjectPosition: clientObjectPosition
      ? { x: Math.round(clientObjectPosition.x), y: Math.round(clientObjectPosition.y) }
      : null,
    playerSector: {
      x: Math.floor(playerPosition.x / config.SECTOR_SIZE),
      y: Math.floor(playerPosition.y / config.SECTOR_SIZE)
    }
  });

  // Check if object exists
  const object = world.getObjectById(objectId, true); // Enable debug mode
  if (!object) {
    logger.log('[Mining] FAILED - Object not found:', objectId);
    return { success: false, error: 'Object not found' };
  }

  logger.log('[Mining] Object found:', {
    id: object.id,
    hasResources: !!object.resources,
    size: object.size,
    isOrbital: object.isOrbital,
    starId: object.starId
  });

  // Check if already depleted
  if (world.isObjectDepleted(objectId)) {
    return { success: false, error: 'Resource is depleted' };
  }

  // Get current computed position (for moving objects)
  const serverPos = world.getObjectPosition(objectId);
  if (!isFinitePosition(serverPos)) {
    logger.warn('[Mining] FAILED - Authoritative object position is not finite:', {
      objectId,
      serverPos
    });
    return { success: false, error: 'Unable to resolve resource position' };
  }
  const serverX = serverPos.x;
  const serverY = serverPos.y;

  // Use client position if provided and within tolerance, otherwise use server position
  // This handles client/server desync for orbital objects
  let objectX = serverX;
  let objectY = serverY;

  if (clientObjectPosition) {
    const positionDx = clientObjectPosition.x - serverX;
    const positionDy = clientObjectPosition.y - serverY;
    const positionDivergence = Math.sqrt(positionDx * positionDx + positionDy * positionDy);

    // If client position is within tolerance, use it (allows for minor desync)
    if (positionDivergence <= config.POSITION_SYNC_TOLERANCE) {
      objectX = clientObjectPosition.x;
      objectY = clientObjectPosition.y;
    } else {
      // Log significant divergence for debugging
      logger.log('[Mining] Position divergence exceeds tolerance:', {
        divergence: Math.round(positionDivergence),
        tolerance: config.POSITION_SYNC_TOLERANCE,
        clientPos: { x: Math.round(clientObjectPosition.x), y: Math.round(clientObjectPosition.y) },
        serverPos: { x: Math.round(serverX), y: Math.round(serverY) }
      });
    }
  }

  // Check proximity using the resolved position with tolerance multiplier
  const dx = objectX - playerPosition.x;
  const dy = objectY - playerPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy) - (object.size || 0);
  const effectiveRange = config.MINING_RANGE * (config.MINING_POSITION_TOLERANCE || 1.0);

  if (!Number.isFinite(distance) || distance > effectiveRange) {
    return { success: false, error: 'Too far from resource' };
  }

  // Check cargo capacity
  const ship = statements.getShipByUserId.get(playerId);
  const cargoUsed = statements.getTotalCargoCount.get(playerId, playerId).total;
  const cargoTier = ship.cargo_tier || 1;
  const cargoMax = config.CARGO_CAPACITY[cargoTier] || config.CARGO_CAPACITY[1];

  if (cargoUsed >= cargoMax) {
    return { success: false, error: 'Cargo hold full' };
  }

  const rawResources = object.resources || [];
  const resources = (Array.isArray(rawResources) ? rawResources : [rawResources])
    .filter(resourceType => typeof resourceType === 'string' && config.RESOURCE_TYPES[resourceType]);
  if (resources.length === 0) {
    return { success: false, error: 'No resources to mine' };
  }
  // Select the seam once. The same authoritative type drives the beam and the
  // eventual inventory award, even when the deposit lists several materials.
  const resourceType = resources[Math.floor(Math.random() * resources.length)];

  // Start mining session
  activeMining.set(playerId, {
    objectId,
    object,
    startTime: Date.now(),
    playerPosition: { ...playerPosition },
    miningTier: ship.mining_tier,
    resourceType
  });

  // Return target info for broadcast
  return {
    success: true,
    object,
    target: {
      x: objectX,
      y: objectY,
      resourceType
    }
  };
}

function updateMining(playerId, playerPosition) {
  const session = activeMining.get(playerId);
  if (!session) return null;

  // Once mining starts, it continues regardless of movement
  // (mining beam locks onto target)

  // Calculate progress
  const miningSpeed = Math.pow(config.TIER_MULTIPLIER, session.miningTier - 1);
  const elapsed = Date.now() - session.startTime;
  const miningTime = config.BASE_MINING_TIME / miningSpeed;
  const progress = elapsed / miningTime;

  if (progress >= 1) {
    // Mining complete
    return completeMining(playerId);
  }

  return { progress, remaining: miningTime - elapsed };
}

function completeMining(playerId) {
  const session = activeMining.get(playerId);
  if (!session) return null;

  // Double-check depletion
  if (world.isObjectDepleted(session.objectId)) {
    activeMining.delete(playerId);
    return { success: false, error: 'Resource was depleted' };
  }

  const resourceType = session.resourceType;
  const resourceInfo = config.RESOURCE_TYPES[resourceType];

  if (!resourceInfo) {
    activeMining.delete(playerId);
    return { success: false, error: 'Invalid resource type' };
  }

  // Calculate yield (based on mining tier)
  const tier = Math.max(1, Math.min(config.MAX_TIER || 5, Number(session.miningTier) || 1));
  let quantity = Math.max(
    1,
    Math.floor(config.MINING_YIELD_BY_TIER?.[tier] || config.BASE_MINING_YIELD || 1)
  );

  // Apply the shared, integer-safe Mining Rites multiplier.
  const hasMiningRites = playerHasRelic(statements, playerId, 'MINING_RITES');
  if (hasMiningRites) {
    quantity = calculateMiningYield(quantity, true);
    const multiplier = getRelicEffect('MINING_RITES', 'miningYieldMultiplier', 1);
    logger.log(`[Mining] Mining Rites active for player ${playerId}, yield multiplied ${multiplier}x to ${quantity}`);
  }

  const ship = statements.getShipByUserId.get(playerId);
  const cargoTier = ship.cargo_tier || 1;
  const cargoMax = config.CARGO_CAPACITY[cargoTier] || config.CARGO_CAPACITY[1];
  const respawnTime = config.RESOURCE_RESPAWN_TIME_MIN +
    Math.random() * (config.RESOURCE_RESPAWN_TIME_MAX - config.RESOURCE_RESPAWN_TIME_MIN);
  let completion;
  try {
    completion = completeMiningYield(
      playerId,
      resourceType,
      quantity,
      cargoMax,
      session.objectId,
      new Date(Date.now() + respawnTime).toISOString()
    );
  } catch (error) {
    logger.error(`[Mining] Atomic completion failed for player ${playerId}:`, error);
    completion = { success: false, error: 'Mining completion failed' };
  } finally {
    // A failed database operation must not leave a completion poll retrying the
    // same session indefinitely.
    activeMining.delete(playerId);
  }

  if (!completion.success) return completion;
  const actualQuantity = completion.quantity;

  return {
    success: true,
    resourceType,
    resourceName: resourceInfo.name,
    quantity: actualQuantity,
    objectId: session.objectId,
    inventory: completion.inventory
  };
}

function cancelMining(playerId) {
  activeMining.delete(playerId);
}

function isMining(playerId) {
  return activeMining.has(playerId);
}

function getMiningProgress(playerId) {
  const session = activeMining.get(playerId);
  if (!session) return null;

  const miningSpeed = Math.pow(config.TIER_MULTIPLIER, session.miningTier - 1);
  const elapsed = Date.now() - session.startTime;
  const miningTime = config.BASE_MINING_TIME / miningSpeed;

  return {
    objectId: session.objectId,
    progress: Math.min(1, elapsed / miningTime),
    remaining: Math.max(0, miningTime - elapsed)
  };
}

module.exports = {
  startMining,
  updateMining,
  completeMining,
  cancelMining,
  isMining,
  getMiningProgress
};
