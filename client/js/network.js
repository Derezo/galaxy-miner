// Galaxy Miner - Network Module

const Network = {
  socket: null,
  connected: false,
  token: null,

  init() {
    this.socket = io();

    // Debug: Log ALL incoming socket events
    this.socket.onAny((eventName, ...args) => {
      if (eventName.startsWith('loot:') || eventName.startsWith('wreckage:')) {
        Logger.log('[SOCKET] Received event:', eventName, args);
      }
    });

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
      Logger.error('Authentication error:', error);
      AuthUI.showError(error.message);
    });

    // player:update, player:leave - handled in /client/js/network/player.js

    // Ship color customization events
    this.socket.on('ship:colorChanged', (data) => {
      // Update local player color
      if (typeof Player !== 'undefined') {
        Player.colorId = data.colorId;
      }
      Logger.log('Ship color changed to:', data.colorId);
    });

    this.socket.on('ship:colorError', (data) => {
      Logger.error('Color change error:', data.message);
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
      Logger.error('Profile change error:', data.message);
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
      Logger.error('Upgrade error:', data.message);
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
      Logger.error('Server error:', data.message);
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

    // world:update, inventory:update - handled in /client/js/network/mining.js
    // Mining events (mining:started, mining:complete, mining:cancelled, mining:error,
    //   mining:playerStarted, mining:playerStopped) - handled in /client/js/network/mining.js
    // Combat events - handled in /client/js/network/combat.js
    // NPC events (npc:spawn, npc:update, npc:destroyed, npc:queenSpawn) - handled in /client/js/network/npc.js

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

      // Remove consumed drones from client-side entities
      // These drones were absorbed into the base during conversion
      if (data.consumedDroneIds && data.consumedDroneIds.length > 0) {
        for (const droneId of data.consumedDroneIds) {
          Entities.npcs.delete(droneId);
        }
        Logger.log('Removed', data.consumedDroneIds.length, 'consumed drones from assimilation');
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

      // Play queen roar sound for dramatic emergence
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.playAt('queen_roar', data.x, data.y);
      }

      // Global warning notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error('⚠ THE SWARM QUEEN HAS EMERGED!');
      }
    });

    // Queen death
    this.socket.on('swarm:queenDeath', (data) => {
      Logger.log('Swarm Queen destroyed!');

      // Play epic queen death sound
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.playAt('queen_death', data.x, data.y);
      }

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

    // ============================================
    // SCAVENGER FACTION EVENTS
    // ============================================

    // Scavenger rage triggered - visual indicator
    this.socket.on('scavenger:rage', (data) => {
      Logger.log('Scavenger rage triggered:', data);

      // Update NPC state for visual indicators
      let wasAlreadyEnraged = false;
      if (typeof Entities !== 'undefined') {
        const npc = Entities.npcs.get(data.npcId);
        if (npc) {
          // Check if already enraged before updating state
          wasAlreadyEnraged = npc.state === 'enraged';
          npc.state = 'enraged';
          npc.rageTarget = data.targetId;
        }
      }

      // Steam burst particles at NPC location (always show for visual feedback)
      if (typeof ParticleSystem !== 'undefined' && data.x !== undefined) {
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * 40,
            vy: Math.sin(angle) * 40 - 30,
            life: 400 + Math.random() * 200,
            color: '#ffffff',
            size: 4 + Math.random() * 4,
            type: 'smoke',
            drag: 0.95,
            decay: 1.5
          });
        }
      }

      // Warning notification only on FIRST enrage (not already enraged)
      if (!wasAlreadyEnraged &&
          typeof NotificationManager !== 'undefined' && typeof Player !== 'undefined' &&
          data.targetId === Player.id) {
        NotificationManager.warning('Scavengers are enraged!');
      }
    });

    // Scavenger rage cleared
    this.socket.on('scavenger:rageClear', (data) => {
      if (typeof Entities !== 'undefined') {
        const npc = Entities.npcs.get(data.npcId);
        if (npc) {
          npc.state = 'idle';
          npc.rageTarget = null;
        }
      }
    });

    // Scrap pile update at base
    this.socket.on('scavenger:scrapPileUpdate', (data) => {
      Logger.log('Scrap pile updated:', data);

      // Update base scrap pile data for rendering
      if (typeof Entities !== 'undefined') {
        const base = Entities.bases.get(data.baseId);
        if (base) {
          base.scrapPile = data.scrapPile;
        }
      }
    });

    // Hauler transformation starting
    this.socket.on('scavenger:haulerTransform', (data) => {
      Logger.log('Hauler transformation starting:', data);

      // Yellow construction particles during transformation
      if (typeof ParticleSystem !== 'undefined') {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 30 + Math.random() * 60;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 800 + Math.random() * 500,
            color: '#D4A017',
            size: 3 + Math.random() * 4,
            type: 'spark',
            drag: 0.95,
            decay: 1
          });
        }
      }
    });

    // Hauler spawned
    this.socket.on('scavenger:haulerSpawn', (data) => {
      Logger.log('Hauler spawned:', data);

      // Add Hauler to entities
      if (typeof Entities !== 'undefined') {
        Entities.updateNPC({
          id: data.haulerId,
          type: data.type,
          name: data.name,
          faction: data.faction,
          x: data.x,
          y: data.y,
          rotation: data.rotation || 0,
          hull: data.hull,
          hullMax: data.hullMax,
          shield: data.shield || 0,
          shieldMax: data.shieldMax || 0,
          size: data.size,
          sizeMultiplier: data.sizeMultiplier
        });
      }

      // Notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.info('A Scavenger Hauler has emerged!');
      }
    });

    // Hauler grew after collecting wreckage
    this.socket.on('scavenger:haulerGrow', (data) => {
      Logger.log('Hauler grew:', data);

      // Update Hauler size in entities
      if (typeof Entities !== 'undefined') {
        const npc = Entities.npcs.get(data.npcId);
        if (npc) {
          npc.sizeMultiplier = data.sizeMultiplier;
          // Update actual size based on multiplier
          const baseSize = 80; // Base hauler size
          npc.size = baseSize * data.sizeMultiplier;
        }
      }

      // Visual feedback - growth particles
      if (typeof ParticleSystem !== 'undefined') {
        const npc = Entities.npcs.get(data.npcId);
        if (npc) {
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            ParticleSystem.spawn({
              x: npc.x,
              y: npc.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 500 + Math.random() * 300,
              color: '#D4A017',
              size: 3 + Math.random() * 3,
              type: 'spark',
              drag: 0.95,
              decay: 1
            });
          }
        }
      }
    });

    // Barnacle King spawned (transformation from Hauler)
    this.socket.on('scavenger:barnacleKingSpawn', (data) => {
      Logger.log('BARNACLE KING SPAWNED!', data);

      // Massive construction explosion effect
      if (typeof ParticleSystem !== 'undefined') {
        // Yellow/copper burst
        for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 60 + Math.random() * 120;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1000 + Math.random() * 500,
            color: i % 2 === 0 ? '#D4A017' : '#B87333',
            size: 4 + Math.random() * 6,
            type: 'spark',
            drag: 0.92,
            decay: 1
          });
        }

        // Dark smoke plume
        for (let i = 0; i < 15; i++) {
          ParticleSystem.spawn({
            x: data.x + (Math.random() - 0.5) * 50,
            y: data.y + (Math.random() - 0.5) * 50,
            vx: (Math.random() - 0.5) * 30,
            vy: -20 - Math.random() * 40,
            life: 1500 + Math.random() * 700,
            color: '#333333',
            size: 10 + Math.random() * 15,
            type: 'smoke',
            drag: 0.98,
            decay: 0.8
          });
        }
      }

      // Add Barnacle King to entities (remove old Hauler)
      if (typeof Entities !== 'undefined') {
        // Remove old Hauler if exists
        if (data.haulerId) {
          Entities.npcs.delete(data.haulerId);
        }

        Entities.updateNPC({
          id: data.kingId,
          type: 'scavenger_barnacle_king',
          name: data.name,
          faction: 'scavenger',
          x: data.x,
          y: data.y,
          rotation: data.rotation || 0,
          hull: data.hull,
          hullMax: data.hullMax,
          shield: 0,
          shieldMax: 0,
          size: 250,
          isBoss: true
        });
      }

      // Screen shake
      if (typeof Renderer !== 'undefined' && Renderer.shake) {
        Renderer.shake(15, 500);
      }

      // Epic notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error('⚠ THE BARNACLE KING HAS EMERGED!');
      }
    });

    // Barnacle King drill charge warning
    this.socket.on('scavenger:drillCharge', (data) => {
      Logger.log('Barnacle King charging drill!', data);

      // Warning indicator at king position
      if (typeof ParticleSystem !== 'undefined') {
        // Red warning glow
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10;
          const radius = 60;
          ParticleSystem.spawn({
            x: data.kingX + Math.cos(angle) * radius,
            y: data.kingY + Math.sin(angle) * radius,
            vx: Math.cos(angle) * -20,
            vy: Math.sin(angle) * -20,
            life: 1500,
            color: '#ff0000',
            size: 5,
            type: 'glow',
            drag: 0.99,
            decay: 0.5
          });
        }
      }

      // Warning notification if player is the target
      if (typeof NotificationManager !== 'undefined' && typeof Player !== 'undefined' &&
          data.targetId === Player.id) {
        NotificationManager.error('⚠ INCOMING DRILL ATTACK - EVADE!');
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
      // Play faction-specific base destruction sound (8-second sequences)
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        const baseSoundMap = {
          'pirate_outpost': 'base_destruction_pirate',
          'scavenger_yard': 'base_destruction_scavenger',
          'swarm_hive': 'base_destruction_swarm',
          'void_rift': 'base_destruction_void',
          'mining_claim': 'base_destruction_mining'
        };
        const soundId = baseSoundMap[data.baseType] || 'base_destruction';
        AudioManager.playAt(soundId, data.x || 0, data.y || 0);
      }

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

    // combat:hit, combat:playerHit - handled in /client/js/network/combat.js

    // When local player takes damage
    this.socket.on('player:damaged', (data) => {
      // Ignore damage events while dead (server may still send these briefly)
      if (typeof Player !== 'undefined' && Player.isDead) return;

      Player.onDamaged(data);
      // Visual feedback at player's position
      if (typeof HitEffectRenderer !== 'undefined') {
        const isShieldHit = data.shield > 0;
        HitEffectRenderer.addHit(Player.position.x, Player.position.y, isShieldHit);
      }
    });

    // Star heat damage
    this.socket.on('star:damage', (data) => {
      // Ignore damage events while dead
      if (typeof Player !== 'undefined' && Player.isDead) return;

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

      // Play player death sound (non-spatial, always audible)
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.play('death_player');
      }

      // Calculate survival time before death
      const survivalTime = Player.getSurvivalTime();

      // Use enhanced killer info from server (new deferred respawn system)
      const killerType = data.killerType || data.cause || 'unknown';
      const killerName = data.killerName || null;
      const killerFaction = data.killerFaction || null;

      // Prepare death data for visual effect
      const deathData = {
        killerType,
        killerName,
        killerFaction,
        cause: data.cause,
        droppedCargo: data.droppedCargo || [],
        survivalTime,
        deathPosition: data.deathPosition || {
          x: Player.position.x,
          y: Player.position.y
        },
        message: data.message,
        respawnOptions: data.respawnOptions
      };

      // Mark player as dead
      Player.onDeath(deathData);

      // Trigger cinematic death effect
      if (typeof PlayerDeathEffect !== 'undefined') {
        PlayerDeathEffect.trigger(deathData);
      } else if (typeof NotificationManager !== 'undefined' && data.message) {
        // Fallback to notification if effect module not loaded
        NotificationManager.error(data.message);
      }
    });

    // player:respawn - handled in /client/js/network/player.js

    // Other players' weapon fire visualization
    this.socket.on('combat:fire', (data) => {
      // Skip if it's our own fire event
      if (data.playerId === Player.id) return;

      // Play weapon fire sound
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        const tier = data.weaponTier || 1;
        AudioManager.playAt('weapon_fire_' + tier, data.x, data.y);
      }

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
      // Play NPC weapon sound based on faction
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        const faction = data.faction || 'pirate';
        AudioManager.playAt('npc_weapon_' + faction, data.sourceX, data.sourceY);
      }

      if (typeof NPCWeaponEffects !== 'undefined') {
        // Use npcType for role-specific weapons, fall back to faction-based selection
        const visualWeaponType = data.npcType
          ? NPCWeaponEffects.getWeaponForNpcType(data.npcType)
          : NPCWeaponEffects.getWeaponForFaction(data.faction) || 'cannon';
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

    // combat:npcHit - handled in /client/js/network/combat.js

    // ============================================
    // TESLA CANNON EFFECTS (TIER 5 WEAPON)
    // ============================================

    // Chain lightning effect when Tesla Cannon hits NPCs
    this.socket.on('combat:chainLightning', (data) => {
      Logger.log('Chain lightning triggered!', data);

      // Play tesla chain sound (using generic weapon sound as placeholder)
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady() && data.sourceX && data.sourceY) {
        AudioManager.playAt('weapon_fire_5', data.sourceX, data.sourceY);
      }

      if (typeof ChainLightningEffect !== 'undefined') {
        ChainLightningEffect.triggerFromEvent(data);
      }
    });

    // Tesla coil effect when Tesla Cannon hits bases
    this.socket.on('combat:teslaCoil', (data) => {
      Logger.log('Tesla coil triggered!', data);
      if (typeof TeslaCoilEffect !== 'undefined') {
        TeslaCoilEffect.triggerFromEvent(data);
      }
    });

    // ============================================
    // SWARM QUEEN SPECIAL ATTACKS
    // ============================================

    // Queen web snare attack visual
    this.socket.on('queen:webSnare', (data) => {
      Logger.log('Queen web snare fired!', data);

      // Play web snare sound
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.playAt('queen_web_snare', data.sourceX, data.sourceY);
      }

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

      // Play acid burst sound
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.playAt('queen_acid_burst', data.sourceX, data.sourceY);
      }

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

      // Play phase change sound
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        const phaseMap = {
          'HUNT': 1,
          'SIEGE': 2,
          'SWARM': 2,
          'DESPERATION': 3
        };
        const phaseNum = phaseMap[data.phase] || 1;
        AudioManager.playAt('queen_phase_' + phaseNum, data.x, data.y);
      }

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

    // ============================================
    // PIRATE FACTION EVENTS
    // ============================================

    // Pirate scout returns with intel, alerting nearby pirates
    this.socket.on('pirate:intel', (data) => {
      Logger.log('Pirate intel broadcast at', data.scoutPos);

      // Validate data
      const pos = data.scoutPos || {};
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

      // Visual effect: red/orange signal pulse from scout
      if (typeof ParticleSystem !== 'undefined') {
        // Signal wave expanding outward
        for (let i = 0; i < 30; i++) {
          const angle = (Math.PI * 2 * i) / 30;
          const speed = 100 + Math.random() * 50;
          ParticleSystem.spawn({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 600 + Math.random() * 200,
            color: i % 2 === 0 ? '#ff4400' : '#ffaa00',
            size: 2 + Math.random() * 2,
            type: 'glow',
            drag: 0.96,
            decay: 0.8
          });
        }
      }

      // Show warning notification if player is in danger
      if (typeof NotificationManager !== 'undefined' && data.alertedPirateCount > 0) {
        NotificationManager.warning(`⚠ Pirate scout reported your position! ${data.alertedPirateCount} pirates alerted!`);
      }
    });

    // Pirate fighter/dreadnought boost dive attack
    this.socket.on('pirate:boostDive', (data) => {
      Logger.log('Pirate boost dive:', data.npcId, 'toward', data.targetX, data.targetY);

      // Validate data
      if (!Number.isFinite(data.startX) || !Number.isFinite(data.startY) ||
          !Number.isFinite(data.targetX) || !Number.isFinite(data.targetY)) return;

      // Visual effect: afterburner trail during boost
      if (typeof PirateEffects !== 'undefined' && PirateEffects.startBoostDive) {
        PirateEffects.startBoostDive(data.npcId, data.startX, data.startY, data.targetX, data.targetY, data.duration);
      } else if (typeof ParticleSystem !== 'undefined') {
        // Immediate burst at start position
        for (let i = 0; i < 20; i++) {
          const angle = Math.atan2(data.startY - data.targetY, data.startX - data.targetX) + (Math.random() - 0.5) * 0.8;
          const speed = 80 + Math.random() * 100;
          ParticleSystem.spawn({
            x: data.startX,
            y: data.startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 400 + Math.random() * 200,
            color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00',
            size: 3 + Math.random() * 4,
            type: 'glow',
            drag: 0.92,
            decay: 1.2
          });
        }
      }
    });

    // Pirate successfully steals from scavenger/rogue miner
    this.socket.on('pirate:stealSuccess', (data) => {
      Logger.log('Pirate steal:', data.targetType, 'amount:', data.stolenAmount);

      // Validate data
      const pos = data.position || {};
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

      // Visual effect: gold/orange particles at steal location
      if (typeof ParticleSystem !== 'undefined') {
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 30 + Math.random() * 60;
          ParticleSystem.spawn({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 400 + Math.random() * 300,
            color: i % 3 === 0 ? '#ffd700' : (i % 3 === 1 ? '#ff8800' : '#cc0000'),
            size: 2 + Math.random() * 3,
            type: 'spark',
            drag: 0.95,
            decay: 1
          });
        }
      }

      // Show notification based on target type
      if (typeof NotificationManager !== 'undefined') {
        const messages = {
          'scavenger_scrapPile': `Pirates plundered ${data.stolenAmount} wreckage from scavenger base!`,
          'scavenger_carried': `Pirates intercepted a scavenger with ${data.stolenAmount} wreckage!`,
          'rogue_credits': `Pirates stole ${data.stolenAmount} credits from mining claim!`
        };
        NotificationManager.warning(messages[data.targetType] || 'Pirates are raiding!');
      }
    });

    // Dreadnought blocks damage with invulnerability
    this.socket.on('npc:invulnerable', (data) => {
      Logger.log('NPC invulnerable proc:', data.npcId);

      // Validate data
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

      // Show "Invulnerable" floating text
      if (typeof FloatingTextSystem !== 'undefined') {
        FloatingTextSystem.addInvulnerable(data.x, data.y);
      } else if (typeof FloatingText !== 'undefined' && FloatingText.spawn) {
        FloatingText.spawn(data.x, data.y, 'Invulnerable', '#cccccc', 1200);
      }

      // Visual effect: shield flash
      if (typeof ParticleSystem !== 'undefined') {
        // Light grey shield shimmer
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12;
          const dist = 30;
          ParticleSystem.spawn({
            x: data.x + Math.cos(angle) * dist,
            y: data.y + Math.sin(angle) * dist,
            vx: Math.cos(angle) * 20,
            vy: Math.sin(angle) * 20,
            life: 300 + Math.random() * 100,
            color: '#aaaaaa',
            size: 4 + Math.random() * 3,
            type: 'glow',
            drag: 0.98,
            decay: 1.5
          });
        }
      }
    });

    // Dreadnought enters enraged state (base destroyed)
    this.socket.on('pirate:dreadnoughtEnraged', (data) => {
      Logger.log('Dreadnought ENRAGED:', data.npcId);

      // Validate data
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

      // Visual effect: massive red explosion/shockwave
      if (typeof ParticleSystem !== 'undefined') {
        // Angry red shockwave
        for (let i = 0; i < 60; i++) {
          const angle = (Math.PI * 2 * i) / 60;
          const speed = 200 + Math.random() * 150;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 800 + Math.random() * 400,
            color: i % 3 === 0 ? '#ff0000' : (i % 3 === 1 ? '#ff4400' : '#ff8800'),
            size: 5 + Math.random() * 5,
            type: 'glow',
            drag: 0.94,
            decay: 0.8
          });
        }

        // Inner fire particles
        for (let i = 0; i < 30; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 50 + Math.random() * 100;
          ParticleSystem.spawn({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 600 + Math.random() * 300,
            color: '#ffffff',
            size: 3 + Math.random() * 3,
            type: 'spark',
            drag: 0.9,
            decay: 1.5
          });
        }
      }

      // Show warning notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error('⚠ PIRATE DREADNOUGHT ENRAGED! ⚠');
      }
    });

    // Captain healing at base
    this.socket.on('pirate:captainHeal', (data) => {
      // Validate data
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

      // Visual effect: healing particles around captain
      if (typeof ParticleSystem !== 'undefined') {
        // Red healing sparkles rising up
        for (let i = 0; i < 5; i++) {
          ParticleSystem.spawn({
            x: data.x + (Math.random() - 0.5) * 40,
            y: data.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 10,
            vy: -20 - Math.random() * 30,
            life: 500 + Math.random() * 300,
            color: '#ff4444',
            size: 2 + Math.random() * 2,
            type: 'glow',
            drag: 0.99,
            decay: 0.8
          });
        }
      }
    });

    this.socket.on('chat:message', (data) => {
      // Play chat receive sound (non-spatial)
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.play('chat_receive');
      }

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
      Logger.error('Market error:', data.message);
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
      // If player was collecting this wreckage, cancel the collection state
      if (Player.collectingWreckage && Player.collectingWreckage.id === data.id) {
        Player.onLootCollectionCancelled({ reason: 'Wreckage despawned' });
      }
    });

    this.socket.on('wreckage:collected', (data) => {
      Entities.removeWreckage(data.wreckageId);
      // If player was collecting this wreckage (but someone else got it), cancel
      if (Player.collectingWreckage && Player.collectingWreckage.id === data.wreckageId) {
        Player.onLootCollectionCancelled({ reason: 'Wreckage collected by another player' });
      }
    });

    // Loot collection events - handled in /client/js/network/loot.js
    // (loot:started, loot:progress, loot:complete, loot:cancelled,
    //  loot:multiStarted, loot:multiComplete, loot:error,
    //  team:creditReward, team:lootShare)

    // Buff events (buff:applied) - handled in /client/js/network/loot.js
    // Relic collection events (relic:collected) - handled in /client/js/network/loot.js

    // Wormhole transit events - handled in /client/js/network/wormhole.js
    // Events: wormhole:entered, wormhole:transitStarted, wormhole:progress,
    //         wormhole:exitComplete, wormhole:cancelled, wormhole:error,
    //         wormhole:nearestPosition

    // Skull and Bones plunder events
    this.socket.on('relic:plunderSuccess', (data) => {
      Logger.log('[Plunder] Plunder success!', data);

      // Show success notification
      if (data.credits > 0) {
        NotificationManager.success(`Plundered ${data.credits} credits!`);
      }
      if (data.loot && data.loot.length > 0) {
        NotificationManager.success(`Plundered ${data.loot.length} items!`);
      }

      // Spawn visual effects at base position
      if (data.position && typeof ParticleSystem !== 'undefined') {
        ParticleSystem.spawnPlunderEffect(data.position.x, data.position.y);
      }

      // Show floating text
      if (data.position && typeof FloatingTextSystem !== 'undefined') {
        FloatingTextSystem.add(data.position.x, data.position.y, 'PLUNDERED!', '#ffd700');
      }

      // Update player credits
      if (data.credits > 0) {
        Player.credits += data.credits;
        if (typeof UIState !== 'undefined') {
          UIState.set({ credits: Player.credits });
        }
      }

      // Add loot items to inventory
      if (data.loot && data.loot.length > 0) {
        data.loot.forEach(item => {
          if (item.type === 'resource') {
            Player.addResource(item.resource, item.quantity);
          }
        });
      }
    });

    this.socket.on('relic:plunderFailed', (data) => {
      Logger.log('[Plunder] Plunder failed:', data.reason);
      NotificationManager.error(data.reason || 'Plunder failed');
      // Reset cooldown on failure
      Player.plunderCooldownEnd = 0;
    });

    // Broadcast when any player plunders (for visual effect)
    this.socket.on('base:plundered', (data) => {
      Logger.log('[Base] Base plundered at', data.position);
      // Spawn plunder visual effect for all nearby players
      if (data.position && typeof ParticleSystem !== 'undefined') {
        ParticleSystem.spawnPlunderEffect(data.position.x, data.position.y);
      }
    });

    // Register modular network handlers (npc:destroyed, wreckage:spawn, etc.)
    if (window.NetworkHandlers && window.NetworkHandlers.registerAll) {
      window.NetworkHandlers.registerAll(this.socket);
      Logger.log('[Network] Registered modular network handlers');
    }
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

  // Scrap Siphon multi-collect
  sendMultiCollect() {
    if (!this.connected) return;
    this.socket.emit('wreckage:multiCollect');
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
  },

  // Skull and Bones plunder
  sendPlunderBase(baseId) {
    if (!this.connected) return;
    this.socket.emit('relic:plunder', { baseId });
  },

  // Respawn location selection
  sendRespawnSelect(type, targetId = null) {
    if (!this.connected) return;
    this.socket.emit('respawn:select', { type, targetId });
  }
};
