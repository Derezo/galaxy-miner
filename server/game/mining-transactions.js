'use strict';

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function parseTimestamp(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * Atomically awards one completed mining cycle and claims the world object.
 * The world-change row is the shared lock: only the first completion can grant
 * cargo, and an inventory failure cannot leave a depleted object behind (or
 * vice versa).
 */
function createMiningTransactions(db, statements) {
  const completeMiningYield = db.transaction((
    userId,
    resourceType,
    requestedQuantity,
    cargoCapacity,
    objectId,
    respawnAt,
    now = Date.now()
  ) => {
    if (!isPositiveSafeInteger(userId) ||
        typeof resourceType !== 'string' || resourceType.length === 0 ||
        !isPositiveSafeInteger(requestedQuantity) ||
        !isPositiveSafeInteger(cargoCapacity) ||
        typeof objectId !== 'string' || objectId.length === 0 ||
        !Number.isFinite(now)) {
      return { success: false, error: 'Invalid mining completion' };
    }

    const respawnTimestamp = parseTimestamp(respawnAt);
    if (!Number.isFinite(respawnTimestamp) || respawnTimestamp <= now) {
      return { success: false, error: 'Invalid resource respawn time' };
    }

    const ship = statements.getShipByUserId.get(userId);
    if (!ship) return { success: false, error: 'Ship not found' };

    const existingChange = statements.getWorldChange.get(objectId);
    if (existingChange) {
      const existingRespawn = parseTimestamp(existingChange.respawn_at);
      if (!Number.isFinite(existingRespawn)) {
        throw new Error('Invalid world-change timestamp');
      }
      if (existingRespawn > now) {
        return { success: false, error: 'Resource was depleted' };
      }
      const deleteResult = statements.deleteWorldChange.run(objectId);
      if (Number(deleteResult?.changes) !== 1) {
        throw new Error('Expired resource cleanup failed');
      }
    }

    const cargoRow = statements.getTotalCargoCount.get(userId, userId);
    const cargoUsed = Number(cargoRow?.total);
    if (!Number.isSafeInteger(cargoUsed) || cargoUsed < 0) {
      throw new Error('Invalid cargo balance');
    }

    const quantity = Math.min(requestedQuantity, cargoCapacity - cargoUsed);
    if (!isPositiveSafeInteger(quantity)) {
      return { success: false, error: 'Cargo hold full' };
    }

    const inventoryItem = statements.getInventoryItem.get(userId, resourceType);
    const currentQuantity = inventoryItem ? Number(inventoryItem.quantity) : 0;
    if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0 ||
        !Number.isSafeInteger(currentQuantity + quantity)) {
      throw new Error('Invalid inventory balance');
    }

    const inventoryResult = statements.upsertInventory.run(userId, resourceType, quantity);
    if (Number(inventoryResult?.changes) !== 1) {
      throw new Error('Mining inventory grant failed');
    }

    const worldResult = statements.createWorldChange.run(
      objectId,
      'depleted',
      new Date(respawnTimestamp).toISOString()
    );
    if (Number(worldResult?.changes) !== 1) {
      throw new Error('Mining world claim failed');
    }

    // Read the response snapshot before commit. If this read fails, both the
    // cargo grant and world claim roll back instead of succeeding invisibly.
    const inventory = statements.getInventory.all(userId);
    if (!Array.isArray(inventory)) throw new Error('Mining inventory snapshot failed');

    return { success: true, quantity, inventory };
  });

  return { completeMiningYield };
}

module.exports = { createMiningTransactions };
