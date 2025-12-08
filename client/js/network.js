// Galaxy Miner - Network Module

const Network = {
  socket: null,
  connected: false,
  token: null,

  init() {
    this.socket = io();

    this.socket.on('connect', () => {
      Logger.log('Connected to server');
      this.connected = true;

      // Try to restore session
      const savedToken = localStorage.getItem('galaxy-miner-token');
      if (savedToken) {
        this.authenticate(savedToken);
      }
    });

    this.socket.on('disconnect', () => {
      Logger.log('Disconnected from server');
      this.connected = false;
    });

    this.socket.on('auth:success', (data) => {
      Logger.log('Authentication successful');
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

    // Ship color customization events
    this.socket.on('ship:colorChanged', (data) => {
      // Update local player color
      if (typeof Player !== 'undefined') {
        Player.colorId = data.colorId;
      }
      Logger.log('Ship color changed to:', data.colorId);
    });

    this.socket.on('ship:colorError', (data) => {
      console.error('Color change error:', data.message);
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error(data.message);
      }
    });

    // Ship profile customization events
    this.socket.on('ship:profileChanged', (data) => {
      // Update local player profile
      if (typeof Player !== 'undefined') {
        Player.ship.profileId = data.profileId;
      }
      Logger.log('Ship profile changed to:', data.profileId);
    });

    this.socket.on('ship:profileError', (data) => {
      console.error('Profile change error:', data.message);
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error(data.message);
      }
    });

    // Upgrade event handlers
    this.socket.on('upgrade:success', (data) => {
      Logger.log('Upgrade success:', data.component, 'to tier', data.newTier);
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

    this.socket.on('upgrade:error', (data) => {
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
    this.socket.on('error:generic', (data) => {
      console.error('Server error:', data.message);
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error(data.message);
      }
    });

    this.socket.on('player:colorChanged', (data) => {
      // Update other player's color
      if (typeof Entities !== 'undefined') {
        Entities.updatePlayerColor(data.playerId, data.colorId);
      }
    });

    this.socket.on('world:update', (data) => {
      World.handleUpdate(data);
    });

    this.socket.on('inventory:update', (data) => {
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
        faction: data.faction,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        hull: data.hull,
        hullMax: data.hullMax,
        shield: data.shield,
        shieldMax: data.shieldMax
      });
    });

    this.socket.on('npc:update', (data) => {
      // Server now sends full NPC data in updates, so we can create NPCs
      // if they don't exist (happens when player enters range of existing NPC)
      Entities.updateNPC({
        id: data.id,
        type: data.type,
        name: data.name,
        faction: data.faction,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        state: data.state,
        hull: data.hull,
        hullMax: data.hullMax,
        shield: data.shield,
        shieldMax: data.shieldMax
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

    // Swarm Queen spawning minions
    this.socket.on('npc:queenSpawn', (data) => {
      // Visual effect: organic burst at queen location
      if (typeof ParticleSystem !== 'undefined') {
        // Green organic burst
        for (let i = 0; i < 20; i++) {
          const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
          const speed = 50 + Math.random() * 100;
          ParticleSystem.spawn({
            x: data.queenX,
            y: data.queenY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 400 + Math.random() * 200,
            color: '#00ff66',
            size: 4 + Math.random() * 4,
            type: 'glow',
            drag: 0.92,
            decay: 1
          });
        }

        // Bio-electric "birth lines" to each spawned unit
        if (data.spawned && Array.isArray(data.spawned)) {
          for (const minion of data.spawned) {
            // Draw connecting particles from queen to minion
            const dx = minion.x - data.queenX;
            const dy = minion.y - data.queenY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.floor(dist / 20);

            for (let i = 0; i < steps; i++) {
              const t = i / steps;
              ParticleSystem.spawn({
                x: data.queenX + dx * t,
                y: data.queenY + dy * t,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 300 + i * 30,
                color: i % 2 === 0 ? '#00ff66' : '#00cc44',
                size: 2 + Math.random() * 2,
                type: 'glow',
                drag: 0.98,
                decay: 1
              });
            }
          }
        }
      }
    });

    // Swarm linked damage visualization
    this.socket.on('swarm:linkedDamage', (data) => {
      if (typeof LinkedDamageEffect !== 'undefined') {
        LinkedDamageEffect.triggerFromEvent(data);
      }
    });

    // ============================================
    // SWARM ASSIMILATION EVENTS
    // ============================================

    // Drone sacrifice visual effect
    this.socket.on('swarm:droneSacrifice', (data) => {
      Logger.log('Swarm drone sacrifice at', data.position);

      // Visual effect: organic burst at sacrifice location
      if (typeof ParticleSystem !== 'undefined') {
        // Red organic burst
        for (let i = 0; i < 15; i++) {
          const angle = (Math.PI * 2 * i) / 15 + Math.random() * 0.3;
          const speed = 30 + Math.random() * 60;
          ParticleSystem.spawn({
            x: data.position.x,
            y: data.position.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 300 + Math.random() * 200,
            color: '#8b0000',
            size: 3 + Math.random() * 3,
            type: 'glow',
            drag: 0.94,
            decay: 1
          });
        }

        // Organic tendrils toward base
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          ParticleSystem.spawn({
            x: data.position.x,
            y: data.position.y,
            vx: Math.cos(angle) * 15,
            vy: Math.sin(angle) * 15,
            life: 500 + Math.random() * 300,
            color: '#990000',
            size: 2 + Math.random() * 2,
            type: 'trail',
            drag: 0.99,
            decay: 0.8
          });
        }
      }
    });

    // Assimilation progress indicator
    this.socket.on('swarm:assimilationProgress', (data) => {
      Logger.log('Assimilation progress:', data.baseId, data.progress + '/' + data.threshold);

      // Update base state with assimilation progress
      if (typeof Entities !== 'undefined') {
        const base = Entities.bases.get(data.baseId);
        if (base) {
          base.assimilationProgress = data.progress;
          base.assimilationThreshold = data.threshold;
        }
      }

      // Pulsing effect on base being assimilated
      if (typeof ParticleSystem !== 'undefined') {
        // Red pulse ring around base
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12;
          const radius = 60 + Math.random() * 20;
          ParticleSystem.spawn({
            x: data.position.x + Math.cos(angle) * radius,
            y: data.position.y + Math.sin(angle) * radius,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            life: 400,
            color: '#ff0000',
            size: 2 + Math.random() * 2,
            type: 'glow',
            drag: 0.98,
            decay: 1
          });
        }
      }
    });

    // Base assimilated - update base type for rendering
    this.socket.on('swarm:baseAssimilated', (data) => {
      Logger.log('Base assimilated!', data.baseId, '-> type:', data.newType);

      // Update base in Entities.bases to use new assimilated type
      if (typeof Entities !== 'undefined') {
        const base = Entities.bases.get(data.baseId);
        if (base) {
          base.type = data.newType;
          base.faction = 'swarm';
          base.assimilationProgress = null; // Clear progress
        }
      }

      // Major visual effect: assimilation complete burst
      if (typeof ParticleSystem !== 'undefined' && data.position) {
        // Massive red shockwave
        for (let i = 0; i < 30; i++) {
          const angle = (Math.PI * 2 * i) / 30;
          const speed = 80 + Math.random() * 120;
          ParticleSystem.spawn({
            x: data.position.x,
            y: data.position.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 600 + Math.random() * 400,
            color: '#8b0000',
            size: 5 + Math.random() * 5,
            type: 'glow',
            drag: 0.92,
            decay: 1
          });
        }

        // Organic veins spreading outward
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 100;
          ParticleSystem.spawn({
            x: data.position.x + Math.cos(angle) * dist,
            y: data.position.y + Math.sin(angle) * dist,
            vx: Math.cos(angle) * 20,
            vy: Math.sin(angle) * 20,
            life: 800 + Math.random() * 400,
            color: '#990000',
            size: 3 + Math.random() * 3,
            type: 'trail',
            drag: 0.96,
            decay: 0.9
          });
        }
      }

      // Show notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.warning('The Swarm has assimilated a base!');
      }
    });

    // Queen spawned - faction-wide event
    this.socket.on('swarm:queenSpawn', (data) => {
      Logger.log('Swarm Queen has emerged at', data.x, data.y);

      // Massive visual effect for queen emergence
      if (typeof ParticleSystem !== 'undefined') {
        // Crimson vortex effect
        for (let i = 0; i < 50; i++) {
          const angle = (Math.PI * 2 * i) / 50;
          const radius = 50 + Math.random() * 100;
          const speed = 100 + Math.random() * 150;
          ParticleSystem.spawn({
            x: data.x + Math.cos(angle) * radius,
            y: data.y + Math.sin(angle) * radius,
            vx: -Math.cos(angle) * speed * 0.3, // Spiral inward
            vy: -Math.sin(angle) * speed * 0.3,
            life: 800 + Math.random() * 500,
            color: i % 2 === 0 ? '#8b0000' : '#ff0000',
            size: 4 + Math.random() * 6,
            type: 'glow',
            drag: 0.94,
            decay: 1
          });
        }

        // Bio-electric discharge
        for (let i = 0; i < 25; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 150 + Math.random() * 100;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 400 + Math.random() * 300,
            color: '#ff4444',
            size: 2 + Math.random() * 3,
            type: 'spark',
            drag: 0.9,
            decay: 1.2
          });
        }
      }

      // Global warning notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error('⚠ THE SWARM QUEEN HAS EMERGED!');
      }
    });

    // Queen death
    this.socket.on('swarm:queenDeath', (data) => {
      Logger.log('Swarm Queen destroyed!');

      // Notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.success('The Swarm Queen has been destroyed!');
      }
    });

    // Queen aura regeneration effect
    this.socket.on('swarm:queenAura', (data) => {
      // Visual effect showing aura on affected bases
      if (typeof ParticleSystem !== 'undefined' && data.affectedBases) {
        for (const baseData of data.affectedBases) {
          // Subtle healing particles around regenerating bases
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 30 + Math.random() * 30;
            ParticleSystem.spawn({
              x: baseData.x + Math.cos(angle) * radius,
              y: baseData.y + Math.sin(angle) * radius,
              vx: 0,
              vy: -10 - Math.random() * 10, // Float upward
              life: 300 + Math.random() * 200,
              color: '#990000',
              size: 2 + Math.random() * 2,
              type: 'glow',
              drag: 0.99,
              decay: 0.8
            });
          }
        }
      }
    });

    // Formation leader succession (Void faction)
    this.socket.on('formation:leaderChange', (data) => {
      Logger.log('Formation leader changed:', data);

      // Trigger visual effect
      if (typeof FormationSuccessionEffect !== 'undefined') {
        FormationSuccessionEffect.trigger(data);
      }

      // Update NPC entity with new leader status
      if (typeof Entities !== 'undefined') {
        const newLeader = Entities.npcs.get(data.newLeaderId);
        if (newLeader) {
          newLeader.isFormationLeader = true;
          newLeader.formationLeader = true;
        }
      }
    });

    // Base events
    this.socket.on('base:damaged', (data) => {
      // Track damaged base state for visual feedback
      if (typeof Entities !== 'undefined') {
        Entities.updateBaseHealth(data.baseId, data.health, data.maxHealth);
      }

      // Trigger visual hit effects at base position
      if (data.x !== undefined && data.y !== undefined) {
        // Determine if shield or hull hit based on health percentage
        const healthPercent = data.health / data.maxHealth;
        const isShieldHit = healthPercent > 0.7; // Bases have "shields" at high health

        // Add hit effect using HitEffectRenderer
        if (typeof HitEffectRenderer !== 'undefined') {
          // Scale effect based on damage dealt
          const tier = Math.min(5, Math.max(1, Math.ceil(data.damage / 20)));
          HitEffectRenderer.addHit(data.x, data.y, isShieldHit, tier);
        }

        // Add shield flash effect to the base
        if (typeof FactionBases !== 'undefined' && FactionBases.addDamageFlash) {
          FactionBases.addDamageFlash(data.baseId, data.x, data.y, data.size, data.faction, isShieldHit);
        }
      }
    });

    this.socket.on('base:destroyed', (data) => {
      // Mark base as destroyed for rendering
      if (typeof Entities !== 'undefined') {
        Entities.destroyBase(data.id);

        // Remove any attached assimilation drones (worm visuals) that died with the base
        if (data.destroyedDrones && data.destroyedDrones.length > 0) {
          for (const droneId of data.destroyedDrones) {
            Entities.npcs.delete(droneId);
          }
        }
      }

      // Trigger faction-specific multi-phase destruction sequence
      if (typeof BaseDestructionSequence !== 'undefined') {
        BaseDestructionSequence.trigger(
          data.x || 0,
          data.y || 0,
          data.baseType || 'pirate_outpost',
          data.size || 80
        );
      } else if (typeof ParticleSystem !== 'undefined') {
        // Fallback to basic particles if destruction system not loaded
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

    // Radar base updates (broadcast every 500ms from server)
    this.socket.on('bases:nearby', (bases) => {
      if (typeof Entities !== 'undefined') {
        Entities.updateBases(bases);
      }
    });

    this.socket.on('base:reward', (data) => {
      // Display notification for base destruction rewards
      Logger.log(`Base destroyed! Earned ${data.credits} credits (${data.teamMultiplier}x team bonus)`);

      // Animate credit gain
      if (typeof CreditAnimation !== 'undefined' && data.credits > 0) {
        CreditAnimation.addCredits(data.credits);
      }
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

    // Star heat damage
    this.socket.on('star:damage', (data) => {
      Player.hull.current = data.hull;
      Player.shield.current = data.shield;
      // Heat damage is visual via StarEffects heat overlay
    });

    // Star zone change notifications
    this.socket.on('star:zone', (data) => {
      if (typeof StarEffects !== 'undefined') {
        // StarEffects handles zone changes internally based on player position
        // This is just a server confirmation of zone state
        Logger.log('Star zone:', data.zone);
      }
    });

    // Player death events (including from star damage)
    this.socket.on('player:death', (data) => {
      Logger.log('Player died:', data.cause, data.message);

      // Calculate survival time before death
      const survivalTime = Player.getSurvivalTime();

      // Determine killer type and name
      let killerType = 'unknown';
      let killerName = null;

      if (data.cause === 'star' || data.cause === 'stellar_radiation') {
        killerType = 'star';
      } else if (data.killerType) {
        killerType = data.killerType;
        killerName = data.killerName;
      } else if (data.cause === 'npc' || data.npcName) {
        killerType = 'npc';
        killerName = data.npcName || data.cause;
      } else if (data.cause === 'player' || data.killerName) {
        killerType = 'player';
        killerName = data.killerName;
      }

      // Prepare death data for visual effect
      const deathData = {
        killerType,
        killerName,
        droppedCargo: data.droppedCargo || [],
        survivalTime,
        deathPosition: {
          x: Player.position.x,
          y: Player.position.y
        },
        message: data.message
      };

      // Mark player as dead
      Player.onDeath(deathData);

      // Trigger cinematic death effect
      if (typeof PlayerDeathEffect !== 'undefined') {
        PlayerDeathEffect.trigger(deathData);
      } else {
        // Fallback to notification if effect module not loaded
        if (typeof NotificationManager !== 'undefined' && data.message) {
          NotificationManager.error(data.message);
        }
      }
    });

    // Player respawn after death
    this.socket.on('player:respawn', (data) => {
      Logger.log('Player respawn received:', data.position);

      // Prepare respawn data
      const respawnData = {
        position: data.position,
        hull: data.hull,
        shield: data.shield
      };

      // If death effect is active, queue respawn for after sequence
      if (typeof PlayerDeathEffect !== 'undefined' && PlayerDeathEffect.isActive()) {
        PlayerDeathEffect.queueRespawn(respawnData);
      } else {
        // Apply respawn immediately
        Player.onRespawn(respawnData);
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

      // Track for radar display (Tier 4+)
      if (typeof Entities !== 'undefined') {
        Entities.addProjectileTrail({
          x: data.x,
          y: data.y,
          direction: data.rotation || data.direction,
          type: 'player',
          tier: data.weaponTier || 1
        });
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

      // Track for radar display (Tier 4+)
      if (typeof Entities !== 'undefined') {
        const dx = data.targetX - data.sourceX;
        const dy = data.targetY - data.sourceY;
        const direction = Math.atan2(dy, dx);
        Entities.addProjectileTrail({
          x: data.sourceX,
          y: data.sourceY,
          direction: direction,
          type: 'npc',
          tier: 1,
          faction: data.faction
        });
      }
    });

    // NPC hit feedback when we hit an NPC
    this.socket.on('combat:npcHit', (data) => {
      Logger.log('NPC hit:', data);

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

      // NPC destroyed notification removed - rewards are now shown when collecting scrap
    });

    // ============================================
    // SWARM QUEEN SPECIAL ATTACKS
    // ============================================

    // Queen web snare attack visual
    this.socket.on('queen:webSnare', (data) => {
      Logger.log('Queen web snare fired!', data);

      // Trigger projectile visual via NPCWeaponEffects
      if (typeof NPCWeaponEffects !== 'undefined') {
        NPCWeaponEffects.fire(
          { x: data.sourceX, y: data.sourceY },
          { x: data.targetX, y: data.targetY },
          'web_snare',
          'swarm',
          {
            radius: data.radius,
            duration: data.duration,
            chargeTime: data.chargeTime
          }
        );
      }

      // Schedule area effect at impact location after projectile travel
      const dx = data.targetX - data.sourceX;
      const dy = data.targetY - data.sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const travelTime = dist / (data.projectileSpeed || 200) * 1000;

      setTimeout(() => {
        // Create web area effect at target location
        if (typeof ParticleSystem !== 'undefined') {
          // Expanding web ring
          for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 * i) / 24;
            const radius = data.radius || 150;
            ParticleSystem.spawn({
              x: data.targetX + Math.cos(angle) * radius * 0.3,
              y: data.targetY + Math.sin(angle) * radius * 0.3,
              vx: Math.cos(angle) * 30,
              vy: Math.sin(angle) * 30,
              life: data.duration || 4000,
              color: '#660022',
              size: 3,
              type: 'trail',
              drag: 0.99,
              decay: 0.3
            });
          }

          // Central web strands
          for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            ParticleSystem.spawn({
              x: data.targetX,
              y: data.targetY,
              vx: Math.cos(angle) * 15,
              vy: Math.sin(angle) * 15,
              life: data.duration || 4000,
              color: '#440011',
              size: 2,
              type: 'trail',
              drag: 0.995,
              decay: 0.2
            });
          }
        }
      }, travelTime);
    });

    // Queen acid burst attack visual
    this.socket.on('queen:acidBurst', (data) => {
      Logger.log('Queen acid burst fired!', data);

      // Trigger projectile visual via NPCWeaponEffects
      if (typeof NPCWeaponEffects !== 'undefined') {
        NPCWeaponEffects.fire(
          { x: data.sourceX, y: data.sourceY },
          { x: data.targetX, y: data.targetY },
          'acid_burst',
          'swarm',
          {
            radius: data.radius,
            dotDuration: data.dotDuration
          }
        );
      }

      // Schedule acid puddle at impact location after projectile travel
      const dx = data.targetX - data.sourceX;
      const dy = data.targetY - data.sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const travelTime = dist / (data.projectileSpeed || 180) * 1000;

      setTimeout(() => {
        // Create acid puddle effect at target location
        if (typeof ParticleSystem !== 'undefined') {
          // Acid splash
          for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            ParticleSystem.spawn({
              x: data.targetX,
              y: data.targetY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 600 + Math.random() * 400,
              color: '#44ff44',
              size: 3 + Math.random() * 3,
              type: 'glow',
              drag: 0.92,
              decay: 1
            });
          }

          // Create persistent puddle indicator
          const puddleStart = Date.now();
          const puddleDuration = data.dotDuration || 5000;
          const puddleInterval = setInterval(() => {
            if (Date.now() - puddleStart > puddleDuration) {
              clearInterval(puddleInterval);
              return;
            }

            // Bubbling acid particles
            for (let i = 0; i < 3; i++) {
              const offsetX = (Math.random() - 0.5) * (data.radius || 100);
              const offsetY = (Math.random() - 0.5) * (data.radius || 100);
              ParticleSystem.spawn({
                x: data.targetX + offsetX,
                y: data.targetY + offsetY,
                vx: 0,
                vy: -5 - Math.random() * 10,
                life: 300 + Math.random() * 200,
                color: Math.random() > 0.5 ? '#33ff33' : '#22cc22',
                size: 2 + Math.random() * 2,
                type: 'glow',
                drag: 0.99,
                decay: 1
              });
            }
          }, 200);
        }
      }, travelTime);
    });

    // Player debuff applied (slow from web snare)
    this.socket.on('player:debuff', (data) => {
      Logger.log('Debuff applied:', data.type, 'for', data.duration, 'ms');

      // Store debuff state on player for movement/UI
      if (typeof Player !== 'undefined') {
        if (!Player.debuffs) Player.debuffs = {};
        Player.debuffs[data.type] = {
          expiresAt: Date.now() + data.duration,
          percent: data.slowPercent || 0
        };

        // Clear debuff when it expires
        setTimeout(() => {
          if (Player.debuffs && Player.debuffs[data.type]) {
            delete Player.debuffs[data.type];
            Logger.log('Debuff expired:', data.type);
          }
        }, data.duration);
      }

      // Show debuff notification
      if (typeof NotificationManager !== 'undefined') {
        if (data.type === 'slow') {
          NotificationManager.warning('Ensnared! Movement slowed for ' + (data.duration / 1000) + 's');
        }
      }
    });

    // Player DoT tick damage
    this.socket.on('player:dot', (data) => {
      Logger.log('DoT tick:', data.type, data.damage, 'damage');

      // Visual effect at player position
      if (typeof Player !== 'undefined' && typeof ParticleSystem !== 'undefined') {
        // Acid drip effect
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 10 + Math.random() * 20;
          ParticleSystem.spawn({
            x: Player.position.x + (Math.random() - 0.5) * 20,
            y: Player.position.y + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 300 + Math.random() * 200,
            color: '#44ff44',
            size: 2 + Math.random() * 2,
            type: 'glow',
            drag: 0.95,
            decay: 1.2
          });
        }
      }

      // Show damage number
      if (typeof Renderer !== 'undefined' && typeof Player !== 'undefined') {
        Renderer.addEffect({
          type: 'damage_number',
          x: Player.position.x,
          y: Player.position.y - 20,
          damage: data.damage,
          duration: 800,
          color: '#44ff44'  // Green for acid damage
        });
      }
    });

    // Queen phase transition visual
    this.socket.on('queen:phaseChange', (data) => {
      Logger.log('Queen phase changed to:', data.phase);

      // Trigger phase transition visual at queen location
      if (typeof QueenVisuals !== 'undefined' && QueenVisuals.triggerPhaseTransition) {
        QueenVisuals.triggerPhaseTransition(data.x, data.y, data.phase);
      } else if (typeof ParticleSystem !== 'undefined') {
        // Fallback shockwave effect
        const phaseColors = {
          HUNT: '#ff4444',
          SIEGE: '#ff8800',
          SWARM: '#ff0044',
          DESPERATION: '#ff0000'
        };
        const color = phaseColors[data.phase] || '#ff0000';

        // Expanding shockwave
        for (let i = 0; i < 40; i++) {
          const angle = (Math.PI * 2 * i) / 40;
          const speed = 150 + Math.random() * 100;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 600 + Math.random() * 400,
            color: color,
            size: 4 + Math.random() * 4,
            type: 'glow',
            drag: 0.94,
            decay: 1
          });
        }

        // Inner flash
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 50 + Math.random() * 80;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 300 + Math.random() * 200,
            color: '#ffffff',
            size: 3 + Math.random() * 3,
            type: 'spark',
            drag: 0.9,
            decay: 1.5
          });
        }
      }

      // Show notification
      if (typeof NotificationManager !== 'undefined') {
        const phaseMessages = {
          HUNT: 'The Queen enters hunting mode!',
          SIEGE: 'The Queen retreats behind her swarm!',
          SWARM: 'The Queen summons endless reinforcements!',
          DESPERATION: '⚠ THE QUEEN IS ENRAGED!'
        };
        NotificationManager.warning(phaseMessages[data.phase] || 'Queen phase: ' + data.phase);
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
      Logger.log('Listing created:', data.listingId);
      // Refresh market to show new listing
      if (typeof MarketPanel !== 'undefined') {
        MarketPanel.refresh();
      }
    });

    this.socket.on('market:bought', (data) => {
      Logger.log('Purchase complete:', data.cost);
      // Refresh market after purchase
      if (typeof MarketPanel !== 'undefined') {
        MarketPanel.refresh();
      }
    });

    this.socket.on('market:cancelled', (data) => {
      Logger.log('Listing cancelled');
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
      // Animate credit gain instead of toast
      if (typeof CreditAnimation !== 'undefined' && data.totalCredits > 0) {
        CreditAnimation.addCredits(data.totalCredits);
      }
      Logger.log('Market sale:', data);
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

    // Team credit reward - when another player collects scrap we contributed damage to
    this.socket.on('team:creditReward', (data) => {
      Logger.log('[TEAM] Received credit share:', data.credits, 'from team kill');

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
    this.socket.on('team:lootShare', (data) => {
      Logger.log('[TEAM] Received resource share from team kill');

      // Show resources received
      if (data.resources && data.resources.length > 0 && typeof NotificationManager !== 'undefined') {
        NotificationManager.queueReward({ resources: data.resources });
      }

      // Notify about rare drops that went to collector
      if (data.rareDropNotification && data.rareDropNotification.length > 0) {
        for (const rareDrop of data.rareDropNotification) {
          Logger.log('[TEAM] Teammate collected rare:', rareDrop.resourceType, '(' + rareDrop.rarity + ')');
          if (typeof NotificationManager !== 'undefined') {
            NotificationManager.info(
              'Teammate collected ' + rareDrop.quantity + 'x ' + rareDrop.resourceType.replace(/_/g, ' ')
            );
          }
        }
      }
    });

    this.socket.on('loot:error', (data) => {
      console.error('Loot error:', data.message);
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error(data.message);
      }
    });

    // Buff events
    this.socket.on('buff:applied', (data) => {
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

    this.socket.on('buff:expired', (data) => {
      Player.onBuffExpired(data);
    });

    // Relic collection events
    this.socket.on('relic:collected', (data) => {
      Logger.log('Relic collected:', data.relicType);

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

    // Wormhole transit events
    this.socket.on('wormhole:entered', (data) => {
      Player.onWormholeEntered(data);
    });

    this.socket.on('wormhole:transitStarted', (data) => {
      Player.onWormholeTransitStarted(data);
    });

    this.socket.on('wormhole:transitProgress', (data) => {
      Player.onWormholeTransitProgress(data);
    });

    this.socket.on('wormhole:exitComplete', (data) => {
      Player.onWormholeExitComplete(data);
    });

    this.socket.on('wormhole:cancelled', (data) => {
      Player.onWormholeTransitCancelled(data);
    });

    this.socket.on('wormhole:error', (data) => {
      Player.onWormholeError(data);
    });

    // Wormhole nearest position (for gem directional indicator)
    this.socket.on('wormhole:nearestPosition', (data) => {
      if (data) {
        Logger.log('[Network] Received nearest wormhole at', Math.round(data.x), Math.round(data.y));
      } else {
        Logger.log('[Network] Received null wormhole position');
      }
      if (typeof RadarObjects !== 'undefined') {
        RadarObjects.cachedNearestWormhole = data;
        RadarObjects.lastWormholeUpdate = Date.now();
      }
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
  },

  // Ship color customization
  sendSetColor(colorId) {
    if (!this.connected) return;
    this.socket.emit('ship:setColor', { colorId });
  },

  requestShipData() {
    if (!this.connected) return;
    this.socket.emit('ship:getData');
  },

  // Wormhole transit
  sendEnterWormhole(wormholeId) {
    if (!this.connected) return;
    this.socket.emit('wormhole:enter', { wormholeId });
  },

  sendSelectWormholeDestination(destinationId) {
    if (!this.connected) return;
    this.socket.emit('wormhole:selectDestination', { destinationId });
  },

  sendCancelWormhole() {
    if (!this.connected) return;
    this.socket.emit('wormhole:cancel');
  },

  requestNearestWormholePosition() {
    if (!this.connected) return;
    this.socket.emit('wormhole:getNearestPosition');
  }
};
