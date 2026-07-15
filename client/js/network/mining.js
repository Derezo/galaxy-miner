// Galaxy Miner - Mining Network Handlers

/**
 * Registers mining-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('mining:started', (data) => {
    const tier = data.miningTier || Player.ship?.miningTier || 1;
    const previousTier = Network._activeMiningDrillTier;
    Network._activeMiningDrillTier = tier;

    // Loop intent is gameplay state, so keep it synchronized even while audio
    // is muted, suspended, or waiting for a user gesture.
    if (typeof AudioManager !== 'undefined') {
      if (
        previousTier !== null &&
        previousTier !== undefined &&
        previousTier !== tier &&
        typeof AudioManager.stopLoop === 'function'
      ) {
        AudioManager.stopLoop('mining_drill_' + previousTier);
      }
      if (typeof AudioManager.startLoop === 'function') {
        AudioManager.startLoop('mining_drill_' + tier);
      }
    }

    Player.onMiningStarted(data);
  });

  socket.on('mining:complete', (data) => {
    // Stop mining drill loop and play completion sound
    const tier = Network._activeMiningDrillTier;
    Network._activeMiningDrillTier = null;
    if (typeof AudioManager !== 'undefined') {
      if (tier !== null && tier !== undefined && typeof AudioManager.stopLoop === 'function') {
        AudioManager.stopLoop('mining_drill_' + tier);
      }
      if (typeof AudioManager.play === 'function') {
        AudioManager.play('mining_complete');
      }
    }

    // Track resources mined for session statistics
    if (typeof Player !== 'undefined' && data.quantity) {
      Player.onResourceMined(data.quantity);
    }

    Player.onMiningComplete(data);
  });

  socket.on('mining:cancelled', (data) => {
    // Stop mining drill loop
    const tier = Network._activeMiningDrillTier;
    Network._activeMiningDrillTier = null;
    if (
      typeof AudioManager !== 'undefined' &&
      tier !== null &&
      tier !== undefined &&
      typeof AudioManager.stopLoop === 'function'
    ) {
      AudioManager.stopLoop('mining_drill_' + tier);
    }

    Player.onMiningCancelled(data);
  });

  socket.on('mining:error', (data) => {
    Player.onMiningError(data);
  });

  // Other players' mining visualization
  socket.on('mining:playerStarted', (data) => {
    Entities.updatePlayerMining(data.playerId, {
      targetX: data.targetX,
      targetY: data.targetY,
      resourceType: data.resourceType,
      miningTier: data.miningTier
    });
  });

  socket.on('mining:playerStopped', (data) => {
    Entities.clearPlayerMining(data.playerId);
  });

  socket.on('world:update', (data) => {
    World.handleUpdate(data);
  });

  socket.on('inventory:update', (data) => {
    Player.updateInventory(data);

    // Sync credit animation with updated balance
    if (typeof CreditAnimation !== 'undefined') {
      CreditAnimation.sync();
    }

    // Update UIState for new panels
    if (typeof UIState !== 'undefined') {
      UIState.set({
        inventory: data.inventory ?? Player.inventory,
        credits: (typeof data.credits === 'number' && !Number.isNaN(data.credits)) ? data.credits : Player.credits
      });
    }

    // Refresh UI
    if (typeof CargoPanel !== 'undefined') {
      CargoPanel.refresh();
    }

    // Upgrade affordability must follow the same authoritative inventory
    // snapshot as the cargo UI. ShipUpgradePanel otherwise retains the values
    // from the last time its tab was opened.
    if (typeof ShipUpgradePanel !== 'undefined') {
      ShipUpgradePanel.updateData({
        ship: Player.ship,
        inventory: Player.inventory || [],
        credits: Player.credits
      }, { authoritativeInventory: true });
    } else if (typeof UpgradesUI !== 'undefined') {
      if (typeof UpgradesUI.applyAuthoritativeSnapshot === 'function') {
        UpgradesUI.applyAuthoritativeSnapshot();
      } else {
        UpgradesUI.refresh();
      }
    }

    if (typeof HUD !== 'undefined' &&
        typeof HUD.updateUpgradeIndicator === 'function') {
      HUD.updateUpgradeIndicator();
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.mining = { register };
}
