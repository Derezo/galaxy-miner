// Galaxy Miner - Authentication Network Handlers

/**
 * Registers authentication-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('auth:success', (data) => {
    window.Logger.log('Authentication successful');
    if (typeof ShipUpgradePanel !== 'undefined' &&
        typeof ShipUpgradePanel.reset === 'function') {
      // Authentication is a complete account snapshot, including a
      // same-account reconnect after a response was lost. Retire every old
      // request timer before applying it so that timer cannot invalidate the
      // newly reconciled state a moment later.
      ShipUpgradePanel.reset({ render: false });
    }
    if (typeof ShipUpgradePanel === 'undefined' &&
        typeof UpgradesUI !== 'undefined' &&
        typeof UpgradesUI.reset === 'function') {
      // Reconnection may follow a lost upgrade response. Clear the legacy
      // request timer before applying the complete authentication snapshot.
      UpgradesUI.reset({ refresh: false });
    }

    Network.token = data.token;
    localStorage.setItem('galaxy-miner-token', data.token);
    GalaxyMiner.startGame(data.player);

    // Authentication carries a complete account snapshot. Reinitialize the
    // panel even on same-account reconnects so no pre-disconnect cache wins.
    if (typeof ShipUpgradePanel !== 'undefined' &&
        typeof Player !== 'undefined') {
      ShipUpgradePanel.updateData({
        ship: Player.ship,
        inventory: Player.inventory || [],
        credits: Player.credits
      }, {
        authoritativeInventory: true,
        authoritativeShip: true
      });
    } else if (typeof UpgradesUI !== 'undefined') {
      if (typeof UpgradesUI.applyAuthoritativeSnapshot === 'function') {
        UpgradesUI.applyAuthoritativeSnapshot({ authoritativeShip: true });
      } else if (typeof UpgradesUI.refresh === 'function') {
        UpgradesUI.refresh();
      }
    }
    if (typeof HUD !== 'undefined' &&
        typeof HUD.updateUpgradeIndicator === 'function') {
      HUD.updateUpgradeIndicator();
    }
  });

  socket.on('auth:error', (error) => {
    console.error('Authentication error:', error);
    const message = typeof error?.message === 'string' ? error.message : 'Authentication failed';
    const sessionEnded = message === 'Connected from another location';
    if (typeof GalaxyMiner !== 'undefined' &&
        (GalaxyMiner.connectionPaused || sessionEnded)) {
      localStorage.removeItem('galaxy-miner-token');
      Network.token = null;
      GalaxyMiner.stopGame();
      if (typeof ShipUpgradePanel !== 'undefined' &&
          typeof ShipUpgradePanel.reset === 'function') {
        ShipUpgradePanel.reset();
      } else if (typeof UpgradesUI !== 'undefined' &&
          typeof UpgradesUI.reset === 'function') {
        UpgradesUI.reset();
      }
      if (typeof HUD !== 'undefined' &&
          typeof HUD.clearUpgradeIndicator === 'function') {
        HUD.clearUpgradeIndicator();
      }
    }
    AuthUI.showError(message);
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.auth = { register };
}
