// Galaxy Miner - Marketplace System (Server-side)

const config = require('../config');
const {
  statements,
  createMarketplaceListing,
  purchaseListing,
  cancelMarketplaceListing
} = require('../database');
const { isPositiveSafeInteger } = require('./marketplace-transactions');

function listItem(sellerId, resourceType, quantity, pricePerUnit) {
  if (!isPositiveSafeInteger(sellerId) ||
      !isPositiveSafeInteger(quantity) ||
      !isPositiveSafeInteger(pricePerUnit)) {
    return { success: false, error: 'Invalid listing parameters' };
  }

  // Check if resource type is valid
  if (!config.RESOURCE_TYPES[resourceType]) {
    return { success: false, error: 'Invalid resource type' };
  }

  const result = createMarketplaceListing(sellerId, resourceType, quantity, pricePerUnit);
  if (!result.success) return result;

  // Get updated inventory
  const inventory = statements.getInventory.all(sellerId);

  return {
    success: true,
    listingId: result.listingId,
    inventory
  };
}

function buyItem(buyerId, listingId, quantity) {
  if (!isPositiveSafeInteger(buyerId) ||
      !isPositiveSafeInteger(listingId) ||
      !isPositiveSafeInteger(quantity)) {
    return { success: false, error: 'Invalid purchase parameters' };
  }

  // Use transaction helper
  const result = purchaseListing(buyerId, listingId, quantity);

  if (result.success) {
    // Get updated data
    const ship = statements.getShipByUserId.get(buyerId);
    const inventory = statements.getInventory.all(buyerId);

    return {
      success: true,
      cost: result.cost,
      credits: ship?.credits ?? 0,
      inventory
    };
  }

  return result;
}

function cancelListing(sellerId, listingId) {
  if (!isPositiveSafeInteger(sellerId) || !isPositiveSafeInteger(listingId)) {
    return { success: false, error: 'Invalid cancellation parameters' };
  }

  const result = cancelMarketplaceListing(sellerId, listingId);
  if (!result.success) return result;

  // Get updated inventory
  const inventory = statements.getInventory.all(sellerId);

  return {
    success: true,
    inventory
  };
}

function getListings(resourceType = null) {
  if (resourceType) {
    return statements.getListingsByResource.all(resourceType);
  }
  return statements.getListings.all();
}

function getMyListings(sellerId) {
  return statements.getListingsBySeller.all(sellerId);
}

function getResourcePrice(resourceType) {
  // Get average market price or base value
  const listings = statements.getListingsByResource.all(resourceType);

  if (listings.length === 0) {
    const resourceInfo = config.RESOURCE_TYPES[resourceType];
    return resourceInfo ? resourceInfo.baseValue : 0;
  }

  // Return lowest current price
  return listings[0].price_per_unit;
}

module.exports = {
  listItem,
  buyItem,
  cancelListing,
  getListings,
  getMyListings,
  getResourcePrice
};
