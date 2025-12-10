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
    window.Logger.error('Loot error:', data.message);
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error(data.message);
    }
    // Reset multi-collect state on error so player can retry
    if (typeof Player !== 'undefined') {
      Player.multiCollecting = false;
      Player.multiCollectWreckageIds = null;
      Player.collectProgress = 0;
      Player.collectTotalTime = 0;
    }
  });

  // Scrap Siphon multi-collect events
  socket.on('loot:multiStarted', (data) => {
    window.Logger.category('relics', 'Siphon multi-collect started:', data.wreckageIds, 'totalTime:', data.totalTime);
    Player.onMultiCollectStarted(data);

    // Start siphon animation for each wreckage piece
    // Use a minimum animation duration of 600ms for visibility, even if server collection is faster
    if (typeof Entities !== 'undefined' && typeof Player !== 'undefined') {
      const playerPos = { x: Player.x, y: Player.y };
      const animDuration = Math.max(600, data.totalTime);
      window.Logger.category('relics', 'Siphon animation starting at player pos:', playerPos, 'duration:', animDuration);
      Entities.startSiphonAnimation(data.wreckageIds, playerPos, animDuration);
    }
  });

  socket.on('loot:multiComplete', (data) => {
    window.Logger.category('relics', 'Siphon multi-collect complete:', data.wreckageIds);
    Player.onMultiCollectComplete(data);

    // Delay wreckage removal to let animation complete (minimum 600ms animation)
    // The animation was started with Math.max(600, totalTime), so wait that long
    const animDelay = 650; // slightly longer than min animation duration
    setTimeout(() => {
      window.Logger.category('relics', 'Siphon removing wreckage after animation delay');
      if (typeof Entities !== 'undefined') {
        Entities.clearSiphonAnimations(data.wreckageIds);
      }
      for (const wreckageId of data.wreckageIds) {
        Entities.removeWreckage(wreckageId);
      }
    }, animDelay);
  });

  // Team credit reward - when another player collects scrap we contributed damage to
  socket.on('team:creditReward', (data) => {
    window.Logger.category('teams', 'Received credit share:', data.credits, 'from team kill');

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
    window.Logger.category('teams', 'Received resource share from team kill');

    // Show resources received
    if (data.resources && data.resources.length > 0 && typeof NotificationManager !== 'undefined') {
      NotificationManager.queueReward({ resources: data.resources });
    }

    // Notify about rare drops that went to collector
    if (data.rareDropNotification && data.rareDropNotification.length > 0) {
      for (const rareDrop of data.rareDropNotification) {
        window.Logger.category('teams', 'Teammate collected rare:', rareDrop.resourceType, '(' + rareDrop.rarity + ')');
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
    window.Logger.category('relics', 'Relic collected:', data.relicType);

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
