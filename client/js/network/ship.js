// Galaxy Miner - Ship Customization & Upgrade Network Handlers

/**
 * Registers ship customization and upgrade-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  // Ship color customization events
  socket.on('ship:colorChanged', (data) => {
    // Update local player color
    if (typeof Player !== 'undefined') {
      Player.colorId = data.colorId;
    }
    window.Logger.log('Ship color changed to:', data.colorId);
  });

  socket.on('ship:colorError', (data) => {
    console.error('Color change error:', data.message);
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error(data.message);
    }
  });

  // Ship profile customization events
  socket.on('ship:profileChanged', (data) => {
    // Update local player profile
    if (typeof Player !== 'undefined') {
      Player.ship.profileId = data.profileId;
    }
    window.Logger.log('Ship profile changed to:', data.profileId);
  });

  socket.on('ship:profileError', (data) => {
    console.error('Profile change error:', data.message);
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error(data.message);
    }
  });

  // Upgrade event handlers
  socket.on('upgrade:success', (data) => {
    window.Logger.log('Upgrade success:', data.component, 'to tier', data.newTier);
    if (typeof Player !== 'undefined') {
      // Map component key to Player.ship property name
      const componentToTierKey = {
        'engine': 'engineTier',
        'weapon': 'weaponTier',
        'shield': 'shieldTier',
        'mining': 'miningTier',
        'cargo': 'cargoTier',
        'radar': 'radarTier',
        'energy_core': 'energyCoreTier',
        'hull': 'hullTier'
      };
      const tierKey = componentToTierKey[data.component];
      if (tierKey) {
        Player.ship[tierKey] = data.newTier;
      }
      // Update max HP values if provided (for shield/hull upgrades)
      if (data.shieldMax !== undefined) {
        Player.shieldMax = data.shieldMax;
      }
      if (data.hullMax !== undefined) {
        Player.hullMax = data.hullMax;
      }
      Player.credits = data.credits;
      // Sync credit animation with new balance
      if (typeof CreditAnimation !== 'undefined') {
        CreditAnimation.sync();
      }
    }
    if (typeof ShipUpgradePanel !== 'undefined') {
      ShipUpgradePanel.updateData({
        ship: Player.ship,
        inventory: Player.inventory || [],
        credits: Player.credits
      });
      ShipUpgradePanel.onUpgradeSuccess(data);
    } else if (typeof UpgradesUI !== 'undefined') {
      UpgradesUI.refresh();
    }
    if (typeof HUD !== 'undefined') {
      HUD.update();
    }
    if (typeof Toast !== 'undefined') {
      // Get friendly component name
      const componentNames = {
        'engine': 'Engine',
        'weapon': 'Weapons',
        'shield': 'Shields',
        'mining': 'Mining Beam',
        'cargo': 'Cargo Hold',
        'radar': 'Radar',
        'energy_core': 'Energy Core',
        'hull': 'Hull'
      };
      const displayName = componentNames[data.component] || data.component;
      NotificationManager.success(`${displayName} upgraded to tier ${data.newTier}!`);
    }
  });

  socket.on('upgrade:error', (data) => {
    console.error('Upgrade error:', data.message);
    if (typeof ShipUpgradePanel !== 'undefined') {
      ShipUpgradePanel.onUpgradeError(data.message);
    }
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error(data.message);
    } else {
      alert(data.message);
    }
  });

  // Generic error handler for server-side errors
  socket.on('error:generic', (data) => {
    console.error('Server error:', data.message);
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error(data.message);
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.ship = { register };
}
