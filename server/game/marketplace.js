// Galaxy Miner - Marketplace System (Server-side)

const config = require('../config');
const { statements, purchaseListing, safeUpsertInventory } = require('../database');

function listItem(sellerId, resourceType, quantity, pricePerUnit) {
  // Validate inputs
  if (!resourceType || quantity <= 0 || pricePerUnit <= 0) {
    return { success: false, error: 'Invalid listing parameters' };
  }

  // Check if resource type is valid
  if (!config.RESOURCE_TYPES[resourceType]) {
    return { success: false, error: 'Invalid resource type' };
  }

  // Check if player has enough resources
  const inventoryItem = statements.getInventoryItem.get(sellerId, resourceType);
  if (!inventoryItem || inventoryItem.quantity < quantity) {
    return { success: false, error: 'Not enough resources' };
  }

  // Remove from inventory (for marketplace listing)
  const newQuantity = inventoryItem.quantity - quantity;
  console.log(`[INVENTORY] User ${sellerId} ${resourceType}: ${inventoryItem.quantity} -> ${newQuantity} (marketplace listing -${quantity})`);
  if (newQuantity <= 0) {
    statements.removeInventoryItem.run(sellerId, resourceType);
  } else {
    statements.setInventoryQuantity.run(newQuantity, sellerId, resourceType);
  }

  // Create listing
  const result = statements.createListing.run(sellerId, resourceType, quantity, pricePerUnit);

  // Get updated inventory
  const inventory = statements.getInventory.all(sellerId);

  return {
    success: true,
    listingId: result.lastInsertRowid,
    inventory
  };
}

function buyItem(buyerId, listingId, quantity) {
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
  // Get listing
  const listing = statements.getListingById.get(listingId);

  if (!listing) {
    return { success: false, error: 'Listing not found' };
  }

  if (listing.seller_id !== sellerId) {
    return { success: false, error: 'Not your listing' };
  }

  // Return resources to inventory using safe wrapper
  safeUpsertInventory(sellerId, listing.resource_type, listing.quantity);

  // Delete listing
  statements.deleteListing.run(listingId);

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
