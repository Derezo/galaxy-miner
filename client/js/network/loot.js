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
      despawnTime: data.despawnTime,
      source: data.source,  // 'npc', 'base', 'player', or 'derelict'
      size: data.size,
      // Origin for derelict spawn animation
      originX: data.originX,
      originY: data.originY
    });
  });

  socket.on('wreckage:despawn', (data) => {
    Entities.removeWreckage(data.id);
    // If player was collecting this wreckage, cancel the collection state
    if (Player.collectingWreckage && Player.collectingWreckage.id === data.id) {
      Player.onLootCollectionCancelled({ reason: 'Wreckage despawned' });
    }
  });

  socket.on('wreckage:collected', (data) => {
    Entities.removeWreckage(data.wreckageId);
    // If player was collecting this wreckage (but someone else got it), cancel
    if (Player.collectingWreckage && Player.collectingWreckage.id === data.wreckageId) {
      Player.onLootCollectionCancelled({ reason: 'Wreckage collected by another player' });
    }
  });

  // Nearby wreckage response (from loot:getNearby request)
  socket.on('loot:nearby', (data) => {
    window.Logger.log('Nearby wreckage:', data.wreckage?.length || 0);

    // Update entities with nearby wreckage for radar display
    if (typeof Entities !== 'undefined' && data.wreckage) {
      Entities.nearbyWreckage = data.wreckage;
    }

    // Update UI if loot panel is open
    if (typeof LootPanel !== 'undefined' && LootPanel.isVisible) {
      LootPanel.updateNearbyList(data.wreckage);
    }
  });

  // Loot collection events
  socket.on('loot:started', (data) => {
    Player.onLootCollectionStarted(data);
  });

  socket.on('loot:progress', (data) => {
    Player.onLootCollectionProgress(data);
  });

  socket.on('loot:complete', (data) => {
    // Debug: log what we received
    window.Logger?.category('loot', '[LOOT] loot:complete received:',
      'wreckageId:', data.wreckageId,
      'contents:', data.contents?.length || 0,
      'results:', JSON.stringify(data.results));

    // Sounds are now played by RewardDisplay when each resource is displayed
    Player.onLootCollectionComplete(data);
    Entities.removeWreckage(data.wreckageId);
  });

  socket.on('loot:cancelled', (data) => {
    Player.onLootCollectionCancelled(data);
  });

  socket.on('loot:error', (data) => {
    // Handle common collection errors with minimal feedback
    if (data.message === 'Too far from wreckage') {
      // Show brief floating text so player knows why collection failed
      if (typeof Player !== 'undefined') {
        Player.multiCollecting = false;
        Player.multiCollectWreckageIds = null;
        Player.collectProgress = 0;
        Player.collectTotalTime = 0;
        if (typeof FloatingTextSystem !== 'undefined' && Player.position) {
          FloatingTextSystem.add(Player.position.x, Player.position.y, 'Too far', '#ff8800');
        }
      }
      window.Logger.log('[Loot] Error (too far):', data.message);
      return;
    }
    if (data.message === 'No wreckage within range') {
      // Wreckage already collected - silently reset
      if (typeof Player !== 'undefined') {
        Player.multiCollecting = false;
        Player.multiCollectWreckageIds = null;
        Player.collectProgress = 0;
        Player.collectTotalTime = 0;
      }
      window.Logger.log('[Loot] Error (silent):', data.message);
      return;
    }

    window.Logger.log('[Loot] Error:', data.message);
    // Only show unexpected errors
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
    if (typeof Entities !== 'undefined') {
      const animDuration = Math.max(600, data.totalTime);
      window.Logger.category('relics', 'Siphon animation starting, duration:', animDuration);
      // Note: startSiphonAnimation only takes (wreckageIds, duration) - player position is read during render
      Entities.startSiphonAnimation(data.wreckageIds, animDuration);
    }
  });

  socket.on('loot:multiComplete', (data) => {
    window.Logger.category('relics', 'Siphon multi-collect complete:', data.wreckageIds);
    Player.onMultiCollectComplete(data);

    const removedIds = Array.isArray(data.wreckageIds) ? data.wreckageIds : [];
    const attemptedIds = Array.isArray(data.attemptedWreckageIds)
      ? data.attemptedWreckageIds
      : removedIds;

    // Delay wreckage removal to let animation complete (minimum 600ms animation)
    // The animation was started with Math.max(600, totalTime), so wait that long
    const animDelay = 650; // slightly longer than min animation duration
    setTimeout(() => {
      window.Logger.category('relics', 'Siphon removing wreckage after animation delay');
      if (typeof Entities !== 'undefined') {
        Entities.clearSiphonAnimations(attemptedIds);
      }
      for (const wreckageId of removedIds) {
        Entities.removeWreckage(wreckageId);
      }
    }, animDelay);
  });

  // Team credit reward - when another player collects scrap we contributed damage to
  socket.on('team:creditReward', (data) => {
    window.Logger.category('teams', 'Received credit share:', data.credits, 'from team kill');

    // Track credits earned for session statistics
    if (typeof Player !== 'undefined' && data.credits > 0) {
      Player.onCreditsEarned(data.credits);
    }

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

  // Note: 'buff:expired' handler removed - server never emits this event.
  // Buff expiration is handled client-side via timers in Player.onBuffApplied()

  // Relic collection events
  socket.on('relic:collected', (data) => {
    window.Logger.category('relics', 'Relic collected:', data.relicType);

    const normalizedType = String(data.relicType || '').toUpperCase();
    if (!normalizedType) return;
    const obtainedAt = new Date().toISOString();

    // Add relic to player's collection
    if (typeof Player !== 'undefined') {
      if (!Player.relics) Player.relics = [];
      const alreadyOwned = Player.relics.some(relic =>
        String(relic.relic_type || '').toUpperCase() === normalizedType
      );
      if (!alreadyOwned) {
        Player.relics.push({ relic_type: normalizedType, obtained_at: obtainedAt });
      }
    }

    // Update UIState
    if (typeof UIState !== 'undefined') {
      const currentRelics = UIState.get('relics') || [];
      const alreadyTracked = currentRelics.some(relic =>
        String(relic.relic_type || '').toUpperCase() === normalizedType
      );
      if (!alreadyTracked) {
        UIState.set('relics', [...currentRelics, {
          relic_type: normalizedType,
          obtained_at: obtainedAt
        }]);
      }
    }

    // Loot completion already renders the reward. Other acquisition sources can
    // omit showReward:false and still use this event for their popup.
    if (data.showReward !== false && typeof NotificationManager !== 'undefined') {
      NotificationManager.queueReward({ relics: [normalizedType] });
    }

    // Refresh RelicsPanel if open
    if (typeof RelicsPanel !== 'undefined') {
      RelicsPanel.refresh();
    }
  });

  // Skull and Bones plunder events
  socket.on('relic:plunderSuccess', (data) => {
    Logger.log('[Plunder] Plunder success!', data);

    if (typeof Player !== 'undefined') {
      const cooldown = Number(data.playerCooldown)
        || CONSTANTS.RELIC_TYPES?.SKULL_AND_BONES?.cooldown
        || 15000;
      Player.plunderCooldownEnd = Date.now() + cooldown;
    }

    // Show plunder rewards using the same reward display as mining/wreckage
    if (typeof NotificationManager !== 'undefined') {
      const reward = {};
      if (data.credits > 0) reward.credits = data.credits;
      if (data.loot && data.loot.length > 0) {
        reward.resources = data.loot
          .filter(item => item.type === 'resource')
          .map(item => ({ type: item.resource, name: item.resource.replace(/_/g, ' '), quantity: item.quantity }));
      }
      NotificationManager.queueReward(reward);
    }

    // Spawn visual effects at base position
    if (data.position && typeof ParticleSystem !== 'undefined') {
      ParticleSystem.spawnPlunderEffect(data.position.x, data.position.y);
    }

    // Show floating text
    if (data.position && typeof FloatingTextSystem !== 'undefined') {
      FloatingTextSystem.add(data.position.x, data.position.y, 'PLUNDERED!', '#ffd700');
    }

    if (data.cargoLimited && typeof NotificationManager !== 'undefined') {
      NotificationManager.info('Cargo limit reached; unclaimed base reserves remain');
    } else if (data.baseDepleted && typeof NotificationManager !== 'undefined') {
      NotificationManager.info('Base reserves depleted until its next lifecycle');
    }

    // Credits and inventory are updated by the server's 'inventory:update' event
    // which fires immediately after plunderSuccess (see server/socket/relic.js)
  });

  socket.on('relic:plunderFailed', (data) => {
    Logger.log('[Plunder] Plunder failed:', data.reason);
    const remaining = Math.max(0, Number(data.cooldownRemaining) || 0);
    const suffix = remaining > 0 ? ` (${Math.ceil(remaining / 1000)}s)` : '';
    NotificationManager.error(`${data.reason || 'Plunder failed'}${suffix}`);

    // Only a server-owned player cooldown applies globally. A base alert should
    // not prevent the player from trying a different base.
    if (data.cooldownScope === 'player' && remaining > 0) {
      Player.plunderCooldownEnd = Date.now() + remaining;
    } else {
      Player.plunderCooldownEnd = 0;
    }
  });

  // Broadcast when any player plunders (for visual effect)
  socket.on('base:plundered', (data) => {
    Logger.log('[Base] Base plundered at', data.position);
    // Spawn plunder visual effect for all nearby players
    if (data.position && typeof ParticleSystem !== 'undefined') {
      ParticleSystem.spawnPlunderEffect(data.position.x, data.position.y);
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
