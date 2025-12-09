// Galaxy Miner - Marketplace Network Handlers

/**
 * Registers marketplace-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('market:update', (data) => {
    // Refresh market data
    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.refresh();
    } else if (typeof MarketplaceUI !== 'undefined') {
      MarketplaceUI.refresh();
    }
  });

  socket.on('market:listings', (data) => {
    // Update UIState with market listings
    if (typeof UIState !== 'undefined') {
      UIState.set('marketListings', data.listings || []);
    }

    // Update MarketPanel
    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.listings = data.listings || [];
      MarketPanel.render();
    }
  });

  socket.on('market:myListings', (data) => {
    // Update UIState with my listings
    if (typeof UIState !== 'undefined') {
      UIState.set('myListings', data.listings || []);
    }

    // Update MarketPanel
    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.myListings = data.listings || [];
      MarketPanel.render();
    }
  });

  socket.on('market:listed', (data) => {
    window.Logger.log('Listing created:', data.listingId);
    // Refresh market to show new listing
    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.refresh();
    }
  });

  socket.on('market:bought', (data) => {
    window.Logger.log('Purchase complete:', data.cost);
    // Refresh market after purchase
    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.refresh();
    }
  });

  socket.on('market:cancelled', (data) => {
    window.Logger.log('Listing cancelled');
    // Refresh market after cancellation
    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.refresh();
    }
  });

  socket.on('market:error', (data) => {
    console.error('Market error:', data.message);
    // Could show a modal notification here
  });

  // Seller notification when their listing is sold
  socket.on('market:sold', (data) => {
    // Animate credit gain instead of toast
    if (typeof CreditAnimation !== 'undefined' && data.totalCredits > 0) {
      CreditAnimation.addCredits(data.totalCredits);
    }
    window.Logger.log('Market sale:', data);
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.marketplace = { register };
}
