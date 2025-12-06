// Galaxy Miner - Mining System (Server-side)

const config = require('../config');
const world = require('../world');
const { statements } = require('../database');

// Track active mining sessions: playerId -> { objectId, startTime, ... }
const activeMining = new Map();

function startMining(playerId, playerPosition, objectId) {
  // Check if object exists
  const object = world.getObjectById(objectId);
  if (!object) {
    return { success: false, error: 'Object not found' };
  }

  // Check if already depleted
  if (world.isObjectDepleted(objectId)) {
    return { success: false, error: 'Resource is depleted' };
  }

  // Get current computed position (for moving objects)
  const currentPos = world.getObjectPosition(objectId);
  const objectX = currentPos ? currentPos.x : object.x;
  const objectY = currentPos ? currentPos.y : object.y;

  // Check proximity using computed position
  const dx = objectX - playerPosition.x;
  const dy = objectY - playerPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy) - (object.size || 0);

  if (distance > config.MINING_RANGE) {
    return { success: false, error: 'Too far from resource' };
  }

  // Check cargo capacity
  const ship = statements.getShipByUserId.get(playerId);
  const cargoUsed = statements.getTotalCargoCount.get(playerId).total;
  const cargoMax = config.BASE_CARGO_CAPACITY * Math.pow(config.TIER_MULTIPLIER, ship.cargo_tier - 1);

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
  const resources = object.resources || [];
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

  // Get resources from object
  const resources = session.object.resources || [];
  if (resources.length === 0) {
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
  const quantity = Math.max(1, Math.floor(baseYield * yieldMultiplier));

  // Check cargo space
  const cargoUsed = statements.getTotalCargoCount.get(playerId).total;
  const ship = statements.getShipByUserId.get(playerId);
  const cargoMax = config.BASE_CARGO_CAPACITY * Math.pow(config.TIER_MULTIPLIER, ship.cargo_tier - 1);

  const actualQuantity = Math.min(quantity, Math.floor(cargoMax - cargoUsed));
  if (actualQuantity <= 0) {
    activeMining.delete(playerId);
    return { success: false, error: 'Cargo hold full' };
  }

  // Add to inventory
  statements.upsertInventory.run(playerId, resourceType, actualQuantity);

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
