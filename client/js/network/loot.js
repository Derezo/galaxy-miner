// Galaxy Miner - Loot Collection Network Handlers

/**
 * Registers loot and wreckage-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  // Wreckage events
  socket.on('wreckage:spawn', (data) => {
    Entities.updateWreckage({
      id: data.id,
      x: data.x,
      y: data.y,
      faction: data.faction,
      npcName: data.npcName,
      contentCount: data.contentCount,
      despawnTime: data.despawnTime
    });
  });

  socket.on('wreckage:despawn', (data) => {
    Entities.removeWreckage(data.id);
  });

  socket.on('wreckage:collected', (data) => {
    Entities.removeWreckage(data.wreckageId);
  });

  // Loot collection events
  socket.on('loot:started', (data) => {
    Player.onLootCollectionStarted(data);
  });

  socket.on('loot:progress', (data) => {
    Player.onLootCollectionProgress(data);
  });

  socket.on('loot:complete', (data) => {
    // Sounds are now played by RewardDisplay when each resource is displayed
    Player.onLootCollectionComplete(data);
    Entities.removeWreckage(data.wreckageId);
  });

  socket.on('loot:cancelled', (data) => {
    Player.onLootCollectionCancelled(data);
  });

  socket.on('loot:error', (data) => {
    console.error('Loot error:', data.message);
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error(data.message);
    }
  });

  // Team credit reward - when another player collects scrap we contributed damage to
  socket.on('team:creditReward', (data) => {
    window.Logger.log('[TEAM] Received credit share:', data.credits, 'from team kill');

    // Show reward pop-up
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.queueReward({ credits: data.credits });
    }

    // Animate credit counter if available
    if (typeof CreditAnimation !== 'undefined') {
      CreditAnimation.addCredits(data.credits);
    }
  });

  // Team resource share - when another player collects scrap with shared resources
  socket.on('team:lootShare', (data) => {
    window.Logger.log('[TEAM] Received resource share from team kill');

    // Show resources received
    if (data.resources && data.resources.length > 0 && typeof NotificationManager !== 'undefined') {
      NotificationManager.queueReward({ resources: data.resources });
    }

    // Notify about rare drops that went to collector
    if (data.rareDropNotification && data.rareDropNotification.length > 0) {
      for (const rareDrop of data.rareDropNotification) {
        window.Logger.log('[TEAM] Teammate collected rare:', rareDrop.resourceType, '(' + rareDrop.rarity + ')');
        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.info(
            'Teammate collected ' + rareDrop.quantity + 'x ' + rareDrop.resourceType.replace(/_/g, ' ')
          );
        }
      }
    }
  });

  // Buff events
  socket.on('buff:applied', (data) => {
    Player.onBuffApplied(data);
    if (typeof NotificationManager !== 'undefined') {
      const buffNames = {
        SHIELD_BOOST: 'Shield Boost',
        SPEED_BURST: 'Speed Burst',
        DAMAGE_AMP: 'Damage Amplifier',
        RADAR_PULSE: 'Radar Pulse'
      };
      NotificationManager.queueReward({ buffs: [{ type: data.buffType, name: buffNames[data.buffType] || data.buffType }] });
    }
  });

  socket.on('buff:expired', (data) => {
    Player.onBuffExpired(data);
  });

  // Relic collection events
  socket.on('relic:collected', (data) => {
    window.Logger.log('Relic collected:', data.relicType);

    // Add relic to player's collection
    if (typeof Player !== 'undefined') {
      if (!Player.relics) Player.relics = [];
      Player.relics.push({
        relic_type: data.relicType,
        obtained_at: new Date().toISOString()
      });
    }

    // Update UIState
    if (typeof UIState !== 'undefined') {
      const currentRelics = UIState.get('relics') || [];
      UIState.set('relics', [...currentRelics, {
        relic_type: data.relicType,
        obtained_at: new Date().toISOString()
      }]);
    }

    // Show reward pop-up
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.queueReward({ relics: [data.relicType] });
    }

    // Refresh RelicsPanel if open
    if (typeof RelicsPanel !== 'undefined') {
      RelicsPanel.refresh();
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.loot = { register };
}
