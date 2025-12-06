// Galaxy Miner - Network Module

const Network = {
  socket: null,
  connected: false,
  token: null,

  init() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;

      // Try to restore session
      const savedToken = localStorage.getItem('galaxy-miner-token');
      if (savedToken) {
        this.authenticate(savedToken);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.connected = false;
    });

    this.socket.on('auth:success', (data) => {
      console.log('Authentication successful');
      this.token = data.token;
      localStorage.setItem('galaxy-miner-token', data.token);
      GalaxyMiner.startGame(data.player);
    });

    this.socket.on('auth:error', (error) => {
      console.error('Authentication error:', error);
      AuthUI.showError(error.message);
    });

    this.socket.on('player:update', (data) => {
      Entities.updatePlayer(data);
    });

    this.socket.on('player:leave', (playerId) => {
      Entities.removePlayer(playerId);
    });

    this.socket.on('world:update', (data) => {
      World.handleUpdate(data);
    });

    this.socket.on('inventory:update', (data) => {
      Player.updateInventory(data);

      // Update UIState for new panels
      if (typeof UIState !== 'undefined') {
        UIState.set({
          inventory: data.inventory || Player.inventory,
          credits: data.credits || Player.credits
        });
      }

      // Refresh UI
      if (typeof CargoPanel !== 'undefined') {
        CargoPanel.refresh();
      } else if (typeof InventoryUI !== 'undefined') {
        InventoryUI.refresh();
      }
    });

    this.socket.on('mining:started', (data) => {
      Player.onMiningStarted(data);
    });

    this.socket.on('mining:complete', (data) => {
      Player.onMiningComplete(data);
    });

    this.socket.on('mining:cancelled', (data) => {
      Player.onMiningCancelled(data);
    });

    this.socket.on('mining:error', (data) => {
      Player.onMiningError(data);
    });

    // Other players' mining visualization
    this.socket.on('mining:playerStarted', (data) => {
      Entities.updatePlayerMining(data.playerId, {
        targetX: data.targetX,
        targetY: data.targetY,
        resourceType: data.resourceType,
        miningTier: data.miningTier
      });
    });

    this.socket.on('mining:playerStopped', (data) => {
      Entities.clearPlayerMining(data.playerId);
    });

    this.socket.on('combat:event', (data) => {
      // Handle combat events (hits, deaths, etc.)
    });

    // NPC events - spawn, update, destroyed
    this.socket.on('npc:spawn', (data) => {
      Entities.updateNPC({
        id: data.id,
        type: data.type,
        name: data.name,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        hull: data.hull,
        shield: data.shield
      });
    });

    this.socket.on('npc:update', (data) => {
      Entities.updateNPC({
        id: data.id,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        state: data.state,
        hull: data.hull,
        shield: data.shield
      });
    });

    this.socket.on('npc:destroyed', (data) => {
      // Get NPC data BEFORE removing it
      const npc = Entities.npcs.get(data.id);

      // Trigger faction-specific death effect
      if (npc && typeof DeathEffects !== 'undefined') {
        const effectType = DeathEffects.getEffectForFaction(npc.faction);
        DeathEffects.trigger(npc.position.x, npc.position.y, effectType, npc.faction);
      }

      // Now remove the NPC
      Entities.removeNPC(data.id);
    });

    // Base events
    this.socket.on('base:damaged', (data) => {
      // Track damaged base state for visual feedback
      if (typeof Entities !== 'undefined') {
        Entities.updateBaseHealth(data.baseId, data.health, data.maxHealth);
      }
    });

    this.socket.on('base:destroyed', (data) => {
      // Mark base as destroyed for rendering
      if (typeof Entities !== 'undefined') {
        Entities.destroyBase(data.id);
      }
      // Show destruction effect at base location
      if (typeof ParticleSystem !== 'undefined') {
        const colors = ['#ff6600', '#ffcc00', '#ff3300', '#ffffff'];
        for (let i = 0; i < 50; i++) {
          const angle = (Math.PI * 2 * i) / 50 + Math.random() * 0.5;
          const speed = 100 + Math.random() * 200;
          ParticleSystem.spawn({
            x: data.x || 0,
            y: data.y || 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 500 + Math.random() * 500,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 3 + Math.random() * 5,
            type: 'glow',
            drag: 0.95,
            decay: 1
          });
        }
      }
    });

    this.socket.on('base:respawn', (data) => {
      // Mark base as active again
      if (typeof Entities !== 'undefined') {
        Entities.respawnBase(data.id, data);
      }
    });

    this.socket.on('base:reward', (data) => {
      // Display notification for base destruction rewards
      console.log(`Base destroyed! Earned ${data.credits} credits (${data.teamMultiplier}x team bonus)`);
    });

    // Combat hit visualization
    this.socket.on('combat:hit', (data) => {
      // Skip if this is an NPC attack - NPCWeaponEffects handles hit timing
      if (data.attackerType === 'npc') {
        return; // Hit effect will be triggered by projectile/beam arrival
      }

      // Visual feedback for player-to-player hits
      if (typeof HitEffectRenderer !== 'undefined') {
        const isShieldHit = data.shieldDamage > 0 || data.hitShield;
        HitEffectRenderer.addHit(data.targetX || data.x, data.targetY || data.y, isShieldHit);
      }
    });

    this.socket.on('combat:playerHit', (data) => {
      // Visual feedback for player-to-player combat
      if (typeof HitEffectRenderer !== 'undefined') {
        HitEffectRenderer.addHit(data.targetX, data.targetY, data.hitShield);
      }
    });

    // When local player takes damage
    this.socket.on('player:damaged', (data) => {
      Player.onDamaged(data);
      // Visual feedback at player's position
      if (typeof HitEffectRenderer !== 'undefined') {
        const isShieldHit = data.shield > 0;
        HitEffectRenderer.addHit(Player.position.x, Player.position.y, isShieldHit);
      }
    });

    // Other players' weapon fire visualization
    this.socket.on('combat:fire', (data) => {
      // Skip if it's our own fire event
      if (data.playerId === Player.id) return;

      // Render weapon fire from other player
      if (typeof WeaponRenderer !== 'undefined') {
        WeaponRenderer.fire(
          { x: data.x, y: data.y },
          data.rotation || data.direction,
          data.weaponTier || 1,
          data.weaponTier || 1  // visualTier
        );
      }
    });

    // NPC weapon fire visualization
    this.socket.on('combat:npcFire', (data) => {
      if (typeof NPCWeaponEffects !== 'undefined') {
        // Use faction to get proper visual weapon type
        const visualWeaponType = NPCWeaponEffects.getWeaponForFaction(data.faction) || 'cannon';
        NPCWeaponEffects.fire(
          { x: data.sourceX, y: data.sourceY },
          { x: data.targetX, y: data.targetY },
          visualWeaponType,
          data.faction || 'pirate',
          data.hitInfo || null  // Pass hit info for proper timing of hit effects
        );
      }
    });

    // NPC hit feedback when we hit an NPC
    this.socket.on('combat:npcHit', (data) => {
      console.log('NPC hit:', data);

      // Get NPC position for hit effect
      const npcEntity = Entities.npcs.get(data.npcId);

      if (npcEntity) {
        // Register hit with WeaponRenderer for projectile-timed effects
        if (typeof WeaponRenderer !== 'undefined') {
          WeaponRenderer.registerHit(
            npcEntity.position.x,
            npcEntity.position.y,
            { isShieldHit: data.hitShield || false, damage: data.damage }
          );
        }

        // Show damage notification
        if (typeof Renderer !== 'undefined') {
          Renderer.addEffect({
            type: 'damage_number',
            x: npcEntity.position.x,
            y: npcEntity.position.y,
            damage: data.damage,
            duration: 1000
          });
        }
      }

      // If NPC destroyed, show loot notification
      if (data.destroyed && data.loot && data.loot.length > 0) {
        const lootText = data.loot.map(l => `+${l.quantity} ${l.resourceType}`).join(', ');
        console.log('NPC destroyed! Loot:', lootText);

        if (typeof Toast !== 'undefined') {
          Toast.success(`NPC destroyed! ${lootText}`);
        }
      }
    });

    this.socket.on('chat:message', (data) => {
      ChatUI.addMessage(data);
    });

    this.socket.on('market:update', (data) => {
      // Refresh market data
      if (typeof MarketPanel !== 'undefined') {
        MarketPanel.refresh();
      } else if (typeof MarketplaceUI !== 'undefined') {
        MarketplaceUI.refresh();
      }
    });

    this.socket.on('market:listings', (data) => {
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

    this.socket.on('market:myListings', (data) => {
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

    this.socket.on('market:listed', (data) => {
      console.log('Listing created:', data.listingId);
      // Refresh market to show new listing
      if (typeof MarketPanel !== 'undefined') {
        MarketPanel.refresh();
      }
    });

    this.socket.on('market:bought', (data) => {
      console.log('Purchase complete:', data.cost);
      // Refresh market after purchase
      if (typeof MarketPanel !== 'undefined') {
        MarketPanel.refresh();
      }
    });

    this.socket.on('market:cancelled', (data) => {
      console.log('Listing cancelled');
      // Refresh market after cancellation
      if (typeof MarketPanel !== 'undefined') {
        MarketPanel.refresh();
      }
    });

    this.socket.on('market:error', (data) => {
      console.error('Market error:', data.message);
      // Could show a modal notification here
    });

    // Seller notification when their listing is sold
    this.socket.on('market:sold', (data) => {
      if (typeof Toast !== 'undefined') {
        Toast.success(
          `Sold ${data.quantity} ${data.resourceName} to ${data.buyerName} for ${data.totalCredits} credits!`
        );
      }
      console.log('Market sale:', data);
    });

    // Emote broadcast from other players
    this.socket.on('emote:broadcast', (data) => {
      // Skip if it's our own emote (we show it locally already)
      if (data.playerId === Player.id) return;

      if (typeof EmoteRenderer !== 'undefined') {
        EmoteRenderer.show(data.x, data.y, data.emoteType, data.playerName);
      }
    });

    // Latency measurement
    this.socket.on('pong', (timestamp) => {
      const latency = Date.now() - timestamp;
      HUD.updateLatency(latency);
    });

    // Wreckage events
    this.socket.on('wreckage:spawn', (data) => {
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

    this.socket.on('wreckage:despawn', (data) => {
      Entities.removeWreckage(data.id);
    });

    this.socket.on('wreckage:collected', (data) => {
      Entities.removeWreckage(data.wreckageId);
    });

    // Loot collection events
    this.socket.on('loot:started', (data) => {
      Player.onLootCollectionStarted(data);
    });

    this.socket.on('loot:progress', (data) => {
      Player.onLootCollectionProgress(data);
    });

    this.socket.on('loot:complete', (data) => {
      Player.onLootCollectionComplete(data);
      Entities.removeWreckage(data.wreckageId);
    });

    this.socket.on('loot:cancelled', (data) => {
      Player.onLootCollectionCancelled(data);
    });

    this.socket.on('loot:error', (data) => {
      console.error('Loot error:', data.message);
      if (typeof Toast !== 'undefined') {
        Toast.error(data.message);
      }
    });

    // Buff events
    this.socket.on('buff:applied', (data) => {
      Player.onBuffApplied(data);
      if (typeof Toast !== 'undefined') {
        const buffNames = {
          SHIELD_BOOST: 'Shield Boost',
          SPEED_BURST: 'Speed Burst',
          DAMAGE_AMP: 'Damage Amplifier',
          RADAR_PULSE: 'Radar Pulse'
        };
        Toast.success(`Buff activated: ${buffNames[data.buffType] || data.buffType}`);
      }
    });

    this.socket.on('buff:expired', (data) => {
      Player.onBuffExpired(data);
    });
  },

  authenticate(token) {
    this.socket.emit('auth:token', { token });
  },

  login(username, password) {
    this.socket.emit('auth:login', { username, password });
  },

  register(username, password) {
    this.socket.emit('auth:register', { username, password });
  },

  logout() {
    localStorage.removeItem('galaxy-miner-token');
    this.token = null;
    this.socket.emit('auth:logout');
    GalaxyMiner.stopGame();
  },

  sendMovement(input) {
    if (!this.connected) return;
    this.socket.emit('player:input', input);
  },

  sendFire(direction) {
    if (!this.connected) return;
    this.socket.emit('combat:fire', { direction });
  },

  sendMine(objectId) {
    if (!this.connected) return;
    this.socket.emit('mining:start', { objectId });
  },

  sendChat(message) {
    if (!this.connected) return;
    this.socket.emit('chat:send', { message });
  },

  sendMarketList(resourceType, quantity, price) {
    if (!this.connected) return;
    this.socket.emit('market:list', { resourceType, quantity, price });
  },

  sendMarketBuy(listingId, quantity) {
    if (!this.connected) return;
    this.socket.emit('market:buy', { listingId, quantity });
  },

  sendMarketCancel(listingId) {
    if (!this.connected) return;
    this.socket.emit('market:cancel', { listingId });
  },

  sendMarketGetListings(resourceType = null) {
    if (!this.connected) return;
    this.socket.emit('market:getListings', { resourceType });
  },

  sendMarketGetMyListings() {
    if (!this.connected) return;
    this.socket.emit('market:getMyListings', {});
  },

  sendUpgrade(component) {
    if (!this.connected) return;
    this.socket.emit('ship:upgrade', { component });
  },

  ping() {
    this.socket.emit('ping', Date.now());
  },

  sendEmote(emoteType) {
    if (!this.connected) return;
    this.socket.emit('emote:send', { emoteType });
  },

  // Loot collection
  sendLootCollect(wreckageId) {
    if (!this.connected) return;
    this.socket.emit('loot:startCollect', { wreckageId });
  },

  sendLootCancel(wreckageId) {
    if (!this.connected) return;
    this.socket.emit('loot:cancelCollect', { wreckageId });
  },

  requestNearbyWreckage() {
    if (!this.connected) return;
    this.socket.emit('loot:getNearby');
  }
};
