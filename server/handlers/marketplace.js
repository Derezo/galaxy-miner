/**
 * Marketplace Socket.io Event Handlers
 *
 * Handles all marketplace-related events:
 * - market:list - List an item for sale
 * - market:buy - Purchase an item
 * - market:cancel - Cancel a listing
 * - market:getListings - Get all marketplace listings
 * - market:getMyListings - Get current user's listings
 */

const logger = require('../../shared/logger');
const { validateMarketListing, validateMarketPurchase, isPositiveInteger } = require('../validators');
const { statements, getSafeCredits } = require('../database');

/**
 * Register marketplace event handlers for a socket connection
 * @param {Object} ctx - Context object with socket, io, state, marketplace, db
 */
function register(ctx) {
  const { socket, io, state, marketplace } = ctx;

  // Marketplace: List item
  socket.on('market:list', (data) => {
    const authenticatedUserId = state.getAuthUserId(socket.id);
    if (!authenticatedUserId) return;

    // Validate input
    const validation = validateMarketListing(data);
    if (!validation.valid) {
      socket.emit('market:error', { message: validation.error });
      return;
    }

    const result = marketplace.listItem(
      authenticatedUserId,
      data.resourceType,
      data.quantity,
      data.price
    );

    if (result.success) {
      socket.emit('market:listed', { listingId: result.listingId });
      // Get current credits from database
      const ship = statements.getShipByUserId.get(authenticatedUserId);
      socket.emit('inventory:update', {
        inventory: result.inventory,
        credits: getSafeCredits(ship)
      });
      // Notify all players of new listing
      io.emit('market:update', { action: 'new_listing' });
    } else {
      socket.emit('market:error', { message: result.error });
    }
  });

  // Marketplace: Buy item
  socket.on('market:buy', (data) => {
    const authenticatedUserId = state.getAuthUserId(socket.id);
    if (!authenticatedUserId) return;

    // Validate input
    const validation = validateMarketPurchase(data);
    if (!validation.valid) {
      socket.emit('market:error', { message: validation.error });
      return;
    }

    // Get listing info before purchase (for seller notification)
    const listing = statements.getListingById.get(data.listingId);
    if (!listing) {
      socket.emit('market:error', { message: 'Listing not found' });
      return;
    }

    const result = marketplace.buyItem(
      authenticatedUserId,
      data.listingId,
      data.quantity
    );

    if (result.success) {
      // Update buyer
      const player = state.getPlayerBySocketId(socket.id);
      if (player) player.credits = result.credits;

      socket.emit('market:bought', { cost: result.cost });
      socket.emit('inventory:update', {
        inventory: result.inventory,
        credits: result.credits
      });
      // Notify all players
      io.emit('market:update', { action: 'purchase' });

      // Notify seller if they're online
      const sellerSocketId = state.getSocketIdByUserId(listing.seller_id);
      if (sellerSocketId) {
        const config = require('../config');
        const resourceInfo = config.RESOURCE_TYPES[listing.resource_type];
        io.to(sellerSocketId).emit('market:sold', {
          resourceType: listing.resource_type,
          resourceName: resourceInfo ? resourceInfo.name : listing.resource_type,
          quantity: data.quantity,
          totalCredits: result.cost,
          buyerName: player ? player.username : 'Unknown'
        });
      }
    } else {
      socket.emit('market:error', { message: result.error });
    }
  });

  // Marketplace: Cancel listing
  socket.on('market:cancel', (data) => {
    const authenticatedUserId = state.getAuthUserId(socket.id);
    if (!authenticatedUserId) return;

    // Validate listing ID
    if (!isPositiveInteger(data.listingId)) {
      socket.emit('market:error', { message: 'Invalid listing ID' });
      return;
    }

    const result = marketplace.cancelListing(authenticatedUserId, data.listingId);

    if (result.success) {
      socket.emit('market:cancelled', {});
      // Get current credits from database
      const ship = statements.getShipByUserId.get(authenticatedUserId);
      socket.emit('inventory:update', {
        inventory: result.inventory,
        credits: getSafeCredits(ship)
      });
      io.emit('market:update', { action: 'cancelled' });
    } else {
      socket.emit('market:error', { message: result.error });
    }
  });

  // Marketplace: Get listings
  socket.on('market:getListings', (data) => {
    const authenticatedUserId = state.getAuthUserId(socket.id);
    if (!authenticatedUserId) return;

    const listings = data && data.resourceType
      ? marketplace.getListings(data.resourceType)
      : marketplace.getListings();

    socket.emit('market:listings', { listings });
  });

  // Marketplace: Get my listings
  socket.on('market:getMyListings', () => {
    const authenticatedUserId = state.getAuthUserId(socket.id);
    if (!authenticatedUserId) return;

    const listings = marketplace.getMyListings(authenticatedUserId);
    socket.emit('market:myListings', { listings });
  });
}

module.exports = { register };
