'use strict';

/**
 * Marketplace transaction factory.
 *
 * Keeping the mutations behind injected statements makes the economy rules
 * testable with an in-memory database while production continues to use the
 * prepared statements owned by server/database.js.
 */

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidResourceType(resourceType) {
  return typeof resourceType === 'string' && resourceType.length > 0;
}

function createMarketplaceTransactions(db, statements, logger = console, options = {}) {
  const cargoCapacityByTier = options.cargoCapacityByTier || null;

  function getCargoCapacity(ship) {
    if (!cargoCapacityByTier) return Number.POSITIVE_INFINITY;
    const tier = ship?.cargo_tier || 1;
    return cargoCapacityByTier[tier] || cargoCapacityByTier[1] || 0;
  }

  function hasCargoSpace(userId, ship, incomingQuantity, releasedEscrow = 0) {
    if (!statements.getTotalCargoCount) return true;
    const row = statements.getTotalCargoCount.get(userId, userId);
    const used = Math.max(0, (Number(row?.total) || 0) - releasedEscrow);
    return used + incomingQuantity <= getCargoCapacity(ship);
  }

  const createListing = db.transaction((sellerId, resourceType, quantity, pricePerUnit) => {
    if (!isPositiveSafeInteger(sellerId) ||
        !isValidResourceType(resourceType) ||
        !isPositiveSafeInteger(quantity) ||
        !isPositiveSafeInteger(pricePerUnit)) {
      return { success: false, error: 'Invalid listing parameters' };
    }

    const inventoryItem = statements.getInventoryItem.get(sellerId, resourceType);
    if (!inventoryItem || inventoryItem.quantity < quantity) {
      return { success: false, error: 'Not enough resources' };
    }

    const newQuantity = inventoryItem.quantity - quantity;
    if (newQuantity === 0) {
      statements.removeInventoryItem.run(sellerId, resourceType);
    } else {
      statements.setInventoryQuantity.run(newQuantity, sellerId, resourceType);
    }

    const result = statements.createListing.run(
      sellerId,
      resourceType,
      quantity,
      pricePerUnit
    );

    logger.log?.(
      `[MARKET] User ${sellerId} escrowed ${quantity} ${resourceType} ` +
      `(${inventoryItem.quantity} -> ${newQuantity})`
    );

    return { success: true, listingId: result.lastInsertRowid };
  });

  const purchaseListing = db.transaction((buyerId, listingId, quantity) => {
    if (!isPositiveSafeInteger(buyerId) ||
        !isPositiveSafeInteger(listingId) ||
        !isPositiveSafeInteger(quantity)) {
      return { success: false, error: 'Invalid purchase parameters' };
    }

    const listing = statements.getListingById.get(listingId);
    if (!listing) return { success: false, error: 'Listing not found' };
    if (listing.seller_id === buyerId) {
      return { success: false, error: 'Cannot buy your own listing' };
    }
    if (!isPositiveSafeInteger(listing.quantity) ||
        !isPositiveSafeInteger(listing.price_per_unit)) {
      return { success: false, error: 'Listing is invalid' };
    }
    if (listing.quantity < quantity) {
      return { success: false, error: 'Not enough quantity' };
    }

    const totalCost = listing.price_per_unit * quantity;
    if (!Number.isSafeInteger(totalCost) || totalCost <= 0) {
      return { success: false, error: 'Purchase total is invalid' };
    }

    const buyerShip = statements.getShipByUserId.get(buyerId);
    const sellerShip = statements.getShipByUserId.get(listing.seller_id);
    if (!buyerShip || !sellerShip) {
      return { success: false, error: 'Buyer or seller ship not found' };
    }
    if (!Number.isSafeInteger(buyerShip.credits) || buyerShip.credits < totalCost) {
      return { success: false, error: 'Not enough credits' };
    }
    if (!hasCargoSpace(buyerId, buyerShip, quantity)) {
      return { success: false, error: 'Not enough cargo space' };
    }
    if (!Number.isSafeInteger(sellerShip.credits) ||
        !Number.isSafeInteger(sellerShip.credits + totalCost)) {
      return { success: false, error: 'Credit balance is invalid' };
    }

    statements.updateShipCredits.run(buyerShip.credits - totalCost, buyerId);
    statements.updateShipCredits.run(sellerShip.credits + totalCost, listing.seller_id);
    statements.upsertInventory.run(buyerId, listing.resource_type, quantity);

    if (listing.quantity === quantity) {
      statements.deleteListing.run(listingId);
    } else {
      statements.updateListingQuantity.run(listing.quantity - quantity, listingId);
    }

    return {
      success: true,
      cost: totalCost,
      sellerId: listing.seller_id,
      resourceType: listing.resource_type,
      quantity
    };
  });

  const cancelListing = db.transaction((sellerId, listingId) => {
    if (!isPositiveSafeInteger(sellerId) || !isPositiveSafeInteger(listingId)) {
      return { success: false, error: 'Invalid cancellation parameters' };
    }

    const listing = statements.getListingById.get(listingId);
    if (!listing) return { success: false, error: 'Listing not found' };
    if (listing.seller_id !== sellerId) {
      return { success: false, error: 'Not your listing' };
    }
    if (!isPositiveSafeInteger(listing.quantity)) {
      return { success: false, error: 'Listing is invalid' };
    }

    const sellerShip = statements.getShipByUserId.get(sellerId);
    if (!sellerShip) return { success: false, error: 'Seller ship not found' };
    // This listing already counts as cargo escrow. Exclude it before checking
    // the same quantity returning to inventory, so cancellation is neutral.
    if (!hasCargoSpace(sellerId, sellerShip, listing.quantity, listing.quantity)) {
      return { success: false, error: 'Not enough cargo space to cancel listing' };
    }

    statements.upsertInventory.run(sellerId, listing.resource_type, listing.quantity);
    statements.deleteListing.run(listingId);

    return { success: true };
  });

  return { createListing, purchaseListing, cancelListing };
}

module.exports = {
  createMarketplaceTransactions,
  isPositiveSafeInteger
};
