// Galaxy Miner - Mining System (Server-side)

const config = require('../config');
const world = require('../world');
const { statements, safeUpsertInventory } = require('../database');
const logger = require('../../shared/logger');

// Track active mining sessions: playerId -> { objectId, startTime, ... }
const activeMining = new Map();

function startMining(playerId, playerPosition, objectId, clientObjectPosition = null) {
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
  const serverX = serverPos ? serverPos.x : object.x;
  const serverY = serverPos ? serverPos.y : object.y;

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

  if (distance > effectiveRange) {
    return { success: false, error: 'Too far from resource' };
  }

  // Check cargo capacity
  const ship = statements.getShipByUserId.get(playerId);
  const cargoUsed = statements.getTotalCargoCount.get(playerId).total;
  const cargoTier = ship.cargo_tier || 1;
  const cargoMax = config.CARGO_CAPACITY[cargoTier] || config.CARGO_CAPACITY[1];

  if (cargoUsed >= cargoMax) {
    return { success: false, error: 'Cargo hold full' };
  }

  // Start mining session
  activeMining.set(playerId, {
    objectId,
    object,
    startTime: Date.now(),
    playerPosition: { ...playerPosition },
    miningTier: ship.mining_tier
  });

  // Return target info for broadcast
  // Handle both array and string resources
  const rawResources = object.resources || [];
  const resources = Array.isArray(rawResources) ? rawResources : [rawResources];
  return {
    success: true,
    object,
    target: {
      x: objectX,
      y: objectY,
      resourceType: resources.length > 0 ? resources[0] : 'default'
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

  // Get resources from object (handle both array and string)
  const rawResources = session.object.resources || [];
  const resources = Array.isArray(rawResources) ? rawResources : [rawResources];
  if (resources.length === 0 || (resources.length === 1 && !resources[0])) {
    activeMining.delete(playerId);
    return { success: false, error: 'No resources to mine' };
  }

  // Pick a random resource from available
  const resourceType = resources[Math.floor(Math.random() * resources.length)];
  const resourceInfo = config.RESOURCE_TYPES[resourceType];

  if (!resourceInfo) {
    activeMining.delete(playerId);
    return { success: false, error: 'Invalid resource type' };
  }

  // Calculate yield (based on mining tier)
  const yieldMultiplier = Math.pow(config.TIER_MULTIPLIER, session.miningTier - 1);
  const baseYield = config.BASE_MINING_YIELD;
  let quantity = Math.max(1, Math.floor(baseYield * yieldMultiplier));

  // Apply Mining Rites relic bonus (5x yield)
  const hasMiningRites = statements.hasRelic.get(playerId, 'MINING_RITES');
  if (hasMiningRites) {
    quantity *= 5;
    logger.log(`[Mining] Mining Rites active for player ${playerId}, yield multiplied 5x to ${quantity}`);
  }

  // Check cargo space
  const cargoUsed = statements.getTotalCargoCount.get(playerId).total;
  const ship = statements.getShipByUserId.get(playerId);
  const cargoTier = ship.cargo_tier || 1;
  const cargoMax = config.CARGO_CAPACITY[cargoTier] || config.CARGO_CAPACITY[1];

  const actualQuantity = Math.min(quantity, Math.floor(cargoMax - cargoUsed));
  if (actualQuantity <= 0 || Number.isNaN(actualQuantity)) {
    activeMining.delete(playerId);
    return { success: false, error: 'Cargo hold full' };
  }

  // Add to inventory using safe wrapper (validates inputs)
  const insertResult = safeUpsertInventory(playerId, resourceType, actualQuantity);
  if (insertResult.changes === 0) {
    activeMining.delete(playerId);
    return { success: false, error: 'Failed to add resource to inventory' };
  }

  // Mark object as depleted
  world.depleteObject(session.objectId);

  // Clean up session
  activeMining.delete(playerId);

  // Get updated inventory
  const inventory = statements.getInventory.all(playerId);

  return {
    success: true,
    resourceType,
    resourceName: resourceInfo.name,
    quantity: actualQuantity,
    objectId: session.objectId,
    inventory
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
