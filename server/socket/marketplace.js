'use strict';

/**
 * Marketplace Socket Handler
 * Events: market:list, market:buy, market:cancel, market:getListings, market:getMyListings
 */

const config = require('../config');
const { statements, getSafeCredits } = require('../database');
const marketplace = require('../game/marketplace');
const logger = require('../../shared/logger');

/**
 * Register marketplace socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId } = deps;
  const { connectedPlayers, userSockets } = deps.state;

  // Marketplace: List item
  socket.on('market:list', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;

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
    } catch (err) {
      logger.error(`[HANDLER] market:list error:`, err);
    }
  });

  // Marketplace: Buy item
  socket.on('market:buy', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;

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
        const player = connectedPlayers.get(socket.id);
        if (player) player.credits = result.credits;

        socket.emit('market:bought', { cost: result.cost });
        socket.emit('inventory:update', {
          inventory: result.inventory,
          credits: result.credits
        });
        // Notify all players
        io.emit('market:update', { action: 'purchase' });

        // Notify seller if they're online
        const sellerSocketId = userSockets.get(listing.seller_id);
        if (sellerSocketId) {
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
    } catch (err) {
      logger.error(`[HANDLER] market:buy error:`, err);
    }
  });

  // Marketplace: Cancel listing
  socket.on('market:cancel', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;

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
    } catch (err) {
      logger.error(`[HANDLER] market:cancel error:`, err);
    }
  });

  // Marketplace: Get listings
  socket.on('market:getListings', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const listings = data && data.resourceType
      ? marketplace.getListings(data.resourceType)
      : marketplace.getListings();

    socket.emit('market:listings', { listings });
  });

  // Marketplace: Get my listings
  socket.on('market:getMyListings', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const listings = marketplace.getMyListings(authenticatedUserId);
    socket.emit('market:myListings', { listings });
  });
}

module.exports = { register };
