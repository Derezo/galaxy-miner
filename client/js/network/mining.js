// Galaxy Miner - Mining Network Handlers

/**
 * Registers mining-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('mining:started', (data) => {
    // Start mining drill loop
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const tier = data.miningTier || 1;
      Network._activeMiningDrillTier = tier;
      AudioManager.startLoop('mining_drill_' + tier);
    }

    Player.onMiningStarted(data);
  });

  socket.on('mining:complete', (data) => {
    // Stop mining drill loop and play completion sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const tier = Network._activeMiningDrillTier || 1;
      AudioManager.stopLoop('mining_drill_' + tier);
      Network._activeMiningDrillTier = null;
      AudioManager.play('mining_complete');
    }

    // Track resources mined for session statistics
    if (typeof Player !== 'undefined' && data.quantity) {
      Player.onResourceMined(data.quantity);
    }

    Player.onMiningComplete(data);
  });

  socket.on('mining:cancelled', (data) => {
    // Stop mining drill loop
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const tier = Network._activeMiningDrillTier || 1;
      AudioManager.stopLoop('mining_drill_' + tier);
      Network._activeMiningDrillTier = null;
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
    } else if (typeof InventoryUI !== 'undefined') {
      InventoryUI.refresh();
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
