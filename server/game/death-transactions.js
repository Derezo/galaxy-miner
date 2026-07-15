'use strict';

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function requireSingleChange(result, message) {
  if (Number(result?.changes) !== 1) throw new Error(message);
}

/**
 * Settles death loss across both ordinary inventory and marketplace escrow.
 * Loss is calculated from each resource's combined total so splitting cargo
 * into many one-unit listings cannot evade floor rounding.
 */
function createDeathTransactions(db, statements, dropPercent) {
  if (!Number.isFinite(dropPercent) || dropPercent < 0 || dropPercent > 1) {
    throw new Error('Invalid death cargo drop percentage');
  }

  const settleDeathCargo = db.transaction((userId) => {
    if (!isPositiveSafeInteger(userId)) {
      throw new Error('Invalid death settlement user');
    }

    const ship = statements.getShipByUserId.get(userId);
    if (!ship) throw new Error('Death settlement ship not found');

    const inventory = statements.getInventory.all(userId);
    const listings = statements.getListingsBySeller.all(userId)
      .slice()
      .sort((left, right) => left.id - right.id);
    const totals = new Map();

    for (const item of inventory) {
      if (typeof item.resource_type !== 'string' || item.resource_type.length === 0 ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 0) {
        throw new Error('Invalid inventory row during death settlement');
      }
      const next = (totals.get(item.resource_type) || 0) + item.quantity;
      if (!Number.isSafeInteger(next)) throw new Error('Death cargo total overflow');
      totals.set(item.resource_type, next);
    }

    for (const listing of listings) {
      if (!isPositiveSafeInteger(listing.id) ||
          typeof listing.resource_type !== 'string' || listing.resource_type.length === 0 ||
          !isPositiveSafeInteger(listing.quantity) ||
          !isPositiveSafeInteger(listing.price_per_unit)) {
        throw new Error('Invalid marketplace row during death settlement');
      }
      const next = (totals.get(listing.resource_type) || 0) + listing.quantity;
      if (!Number.isSafeInteger(next)) throw new Error('Death cargo total overflow');
      totals.set(listing.resource_type, next);
    }

    const droppedCargo = [];
    let marketplaceChanged = false;

    for (const [resourceType, total] of totals) {
      const dropAmount = Math.floor(total * dropPercent);
      if (dropAmount <= 0) continue;
      if (!Number.isSafeInteger(dropAmount)) throw new Error('Invalid death cargo loss');

      let remaining = dropAmount;
      const inventoryItem = inventory.find(item => item.resource_type === resourceType);
      if (inventoryItem && inventoryItem.quantity > 0) {
        const removed = Math.min(remaining, inventoryItem.quantity);
        const nextQuantity = inventoryItem.quantity - removed;
        const result = nextQuantity === 0
          ? statements.removeInventoryItem.run(userId, resourceType)
          : statements.setInventoryQuantity.run(nextQuantity, userId, resourceType);
        requireSingleChange(result, 'Death inventory settlement failed');
        remaining -= removed;
      }

      if (remaining > 0) {
        for (const listing of listings) {
          if (remaining <= 0) break;
          if (listing.resource_type !== resourceType || listing.quantity <= 0) continue;

          const removed = Math.min(remaining, listing.quantity);
          const nextQuantity = listing.quantity - removed;
          const result = nextQuantity === 0
            ? statements.deleteListing.run(listing.id)
            : statements.updateListingQuantity.run(nextQuantity, listing.id);
          requireSingleChange(result, 'Death marketplace settlement failed');
          listing.quantity = nextQuantity;
          remaining -= removed;
          marketplaceChanged = true;
        }
      }

      if (remaining !== 0) throw new Error('Death cargo settlement mismatch');
      droppedCargo.push({ resource_type: resourceType, quantity: dropAmount });
    }

    // Read the authoritative post-settlement snapshot before commit. If this
    // read fails, the transaction rolls every cargo/escrow mutation back so a
    // client can never be told that death completed without also receiving the
    // inventory state that affordability and cargo UI must reconcile to.
    const remainingInventory = statements.getInventory.all(userId);
    if (!Array.isArray(remainingInventory)) {
      throw new Error('Death inventory snapshot failed');
    }

    return { ship, droppedCargo, marketplaceChanged, inventory: remainingInventory };
  });

  return { settleDeathCargo };
}

module.exports = { createDeathTransactions };
