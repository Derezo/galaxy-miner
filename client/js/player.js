// Galaxy Miner - Local Player

const Player = {
  id: null,
  username: '',
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  rotation: 0,
  hull: { current: 100, max: 100 },
  shield: { current: 50, max: 50 },
  credits: 0,
  inventory: [],
  colorId: 'green',  // Ship color customization
  ship: {
    engineTier: 1,
    weaponType: 'kinetic',
    weaponTier: 1,
    shieldTier: 1,
    miningTier: 1,
    cargoTier: 1,
    radarTier: 1,
    energyCoreTier: 1,
    hullTier: 1
  },
  lastFireTime: 0,
  miningTarget: null,
  miningProgress: 0,
  miningConfirmed: false,  // Server confirmed mining started
  thrustDuration: 0,       // Duration of continuous thrust in ms (for visual effects)
  // Thrust boost state (Energy Core ability)
  boostActive: false,
  boostEndTime: 0,
  boostCooldownEnd: 0,
  lastThrustKeyTime: 0,    // For double-tap detection
  // Loot collection state
  collectingWreckage: null,
  collectProgress: 0,
  collectTotalTime: 0,
  // Active buffs
  activeBuffs: new Map(),
  // Gravity well state
  inGravityWell: false,
  nearestStarDistance: Infinity,
  nearestStar: null,

  // Death and survival tracking
  isDead: false,
  sessionStartTime: 0,  // When this life started (for survival time calculation)

  // Wormhole transit state
  inWormholeTransit: false,
  wormholeTransitPhase: null,  // 'selecting' | 'transit'
  wormholeDestinations: [],
  wormholeTransitProgress: 0,
  wormholeDestination: null,
  _nearestWormhole: null,

  init(data) {
    this.id = data.id;
    this.username = data.username;
    this.position = { x: data.position_x || 0, y: data.position_y || 0 };
    this.velocity = { x: data.velocity_x || 0, y: data.velocity_y || 0 };
    this.rotation = data.rotation || 0;
    this.hull = { current: data.hull_hp, max: data.hull_max };
    this.shield = { current: data.shield_hp, max: data.shield_max };
    this.credits = (typeof data.credits === 'number' && !Number.isNaN(data.credits)) ? data.credits : 0;
    this.inventory = data.inventory || [];
    this.relics = data.relics || [];

    this.ship = {
      engineTier: data.engine_tier,
      weaponType: data.weapon_type,
      weaponTier: data.weapon_tier,
      shieldTier: data.shield_tier,
      miningTier: data.mining_tier,
      cargoTier: data.cargo_tier,
      radarTier: data.radar_tier,
      energyCoreTier: data.energy_core_tier || 1,
      hullTier: data.hull_tier || 1
    };

    // Initialize ship color
    this.colorId = data.ship_color_id || 'green';

    // Reset boost state
    this.boostActive = false;
    this.boostEndTime = 0;
    this.boostCooldownEnd = 0;
    this.lastThrustKeyTime = 0;

    // Initialize survival tracking
    this.isDead = false;
    this.sessionStartTime = Date.now();

    // Reset wormhole transit state
    this.inWormholeTransit = false;
    this.wormholeTransitPhase = null;
    this.wormholeDestinations = [];
    this.wormholeTransitProgress = 0;
    this.wormholeDestination = null;
    this._nearestWormhole = null;

    // Initialize UIState with player data
    if (typeof UIState !== 'undefined') {
      UIState.set({
        inventory: this.inventory,
        credits: this.credits,
        relics: this.relics,
        ship: this.ship
      });
    }

    console.log('Player initialized:', this.username);
  },

  update(dt) {
    // Skip physics updates during wormhole transit
    if (this.inWormholeTransit) {
      return;
    }

    const input = Input.getMovementInput();
    const now = Date.now();

    // Calculate speed based on engine tier
    let speed = CONSTANTS.BASE_SPEED * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.engineTier - 1);
    const rotSpeed = CONSTANTS.BASE_ROTATION_SPEED;

    // Check for boost end
    if (this.boostActive && now >= this.boostEndTime) {
      this.boostActive = false;
    }

    // Apply boost speed multiplier if active
    if (this.boostActive) {
      const boostMultiplier = CONSTANTS.ENERGY_CORE?.BOOST?.SPEED_MULTIPLIER?.[this.ship.energyCoreTier] || 2.0;
      speed *= boostMultiplier;
    }

    // Rotation
    if (input.left) this.rotation -= rotSpeed * dt;
    if (input.right) this.rotation += rotSpeed * dt;

    // Thrust with duration tracking for visual effects
    if (input.up) {
      // Double-tap detection for thrust boost
      if (!this._lastThrustKeyWasDown) {
        // Key just pressed - check for double-tap
        const timeSinceLastPress = now - this.lastThrustKeyTime;
        const doubleTapWindow = CONSTANTS.ENERGY_CORE?.BOOST?.DOUBLE_TAP_WINDOW || 300;

        if (timeSinceLastPress < doubleTapWindow && !this.boostActive && now >= this.boostCooldownEnd) {
          // Activate boost!
          this.activateBoost();
        }
        this.lastThrustKeyTime = now;
      }
      this._lastThrustKeyWasDown = true;

      this.velocity.x += Math.cos(this.rotation) * speed * dt;
      this.velocity.y += Math.sin(this.rotation) * speed * dt;
      // Accumulate thrust duration (cap at 2000ms for visual saturation)
      this.thrustDuration = Math.min(this.thrustDuration + dt * 1000, 2000);
    } else {
      this._lastThrustKeyWasDown = false;
      // Decay thrust duration quickly when not thrusting
      this.thrustDuration = Math.max(this.thrustDuration - dt * 5000, 0);
    }
    if (input.down) {
      this.velocity.x -= Math.cos(this.rotation) * speed * 0.5 * dt;
      this.velocity.y -= Math.sin(this.rotation) * speed * 0.5 * dt;
    }

    // Apply friction/drag
    const drag = 0.98;
    this.velocity.x *= drag;
    this.velocity.y *= drag;

    // Apply star gravity wells
    this.applyStarGravity(dt);

    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Send position to server periodically
    this.sendPositionUpdate();

    // Check for nearby mineable objects
    this.checkMiningProximity();

    // Check for nearby wreckage
    this.checkWreckageProximity();

    // Check for nearby wormholes
    this.checkWormholeProximity();

    // Update mining progress if mining
    if (this.miningTarget) {
      this.updateMining(dt);
    }

    // Shield regeneration
    this.regenShield(dt);
  },

  sendPositionUpdate() {
    // Throttle position updates
    if (!this._lastPositionSend || Date.now() - this._lastPositionSend > CONSTANTS.POSITION_SYNC_RATE) {
      Network.sendMovement({
        x: this.position.x,
        y: this.position.y,
        vx: this.velocity.x,
        vy: this.velocity.y,
        rotation: this.rotation
      });
      this._lastPositionSend = Date.now();
    }
  },

  fire() {
    const now = Date.now();
    // Base cooldown from weapon tier
    let cooldown = CONSTANTS.BASE_WEAPON_COOLDOWN / Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.weaponTier - 1);
    // Apply energy core cooldown reduction
    const cooldownReduction = CONSTANTS.ENERGY_CORE?.COOLDOWN_REDUCTION?.[this.ship.energyCoreTier] || 0;
    cooldown = cooldown * (1 - cooldownReduction);

    if (now - this.lastFireTime < cooldown) return;

    this.lastFireTime = now;
    Network.sendFire(this.rotation);

    // Trigger weapon visual effect with tier-based rendering
    Renderer.fireWeapon();
  },

  checkMiningProximity() {
    const objects = World.getVisibleObjects(this.position, CONSTANTS.MINING_RANGE * 2);
    let nearestMineable = null;
    let nearestDist = CONSTANTS.MINING_RANGE;

    // Check asteroids
    for (const asteroid of objects.asteroids) {
      if (World.isObjectDepleted(asteroid.id)) continue;
      const dist = this.distanceTo(asteroid);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestMineable = asteroid;
      }
    }

    // Check planets
    for (const planet of objects.planets) {
      if (World.isObjectDepleted(planet.id)) continue;
      const dist = this.distanceTo(planet) - planet.size;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestMineable = planet;
      }
    }

    // Update UI hint
    const hint = document.getElementById('mining-hint');
    if (nearestMineable && !this.miningTarget) {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }

    this._nearestMineable = nearestMineable;
  },

  tryMine() {
    if (this._nearestMineable && !this.miningTarget) {
      this.miningTarget = this._nearestMineable;
      this.miningProgress = 0;

      // Debug logging for mining issues
      console.log('[Mining Debug] Attempting to mine:', {
        objectId: this.miningTarget.id,
        objectPos: { x: Math.round(this.miningTarget.x), y: Math.round(this.miningTarget.y) },
        objectSize: this.miningTarget.size,
        isOrbital: this.miningTarget.isOrbital,
        starId: this.miningTarget.starId,
        playerPos: { x: Math.round(this.position.x), y: Math.round(this.position.y) },
        playerSector: {
          x: Math.floor(this.position.x / CONSTANTS.SECTOR_SIZE),
          y: Math.floor(this.position.y / CONSTANTS.SECTOR_SIZE)
        }
      });

      Network.sendMine(this.miningTarget.id);
    }
  },

  updateMining(dt) {
    // Update target position to track moving asteroid/planet
    // Find current position of the mining target
    const objects = World.getVisibleObjects(this.position, 2000);
    const allObjects = [...objects.asteroids, ...objects.planets];
    const currentTarget = allObjects.find(obj => obj.id === this.miningTarget.id);
    if (currentTarget) {
      // Update position for rendering the progress bar
      this.miningTarget.x = currentTarget.x;
      this.miningTarget.y = currentTarget.y;
    }

    // Once mining starts, it continues (mining beam locks onto target)
    // No distance check - server handles validation

    // Progress mining
    const miningSpeed = Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.miningTier - 1);
    this.miningProgress += (dt * 1000 * miningSpeed) / CONSTANTS.BASE_MINING_TIME;

    // Mining is completed server-side, this is just for visual feedback
  },

  regenShield(dt) {
    if (this.shield.current < this.shield.max) {
      // Base recharge rate + energy core bonus
      const baseRate = CONSTANTS.SHIELD_RECHARGE_RATE;
      const bonusRate = CONSTANTS.ENERGY_CORE?.SHIELD_REGEN_BONUS?.[this.ship.energyCoreTier] || 0;
      const effectiveRate = baseRate + bonusRate;

      this.shield.current = Math.min(
        this.shield.max,
        this.shield.current + effectiveRate * dt
      );
    }
  },

  /**
   * Apply gravity from nearby stars
   * Higher engine tiers provide more resistance to gravity
   */
  applyStarGravity(dt) {
    // Get visible stars from world
    if (typeof World === 'undefined') return;

    const objects = World.getVisibleObjects(this.position, 2000);
    if (!objects.stars || objects.stars.length === 0) return;

    // Track if we're in any gravity well (for UI feedback)
    this.inGravityWell = false;
    this.nearestStarDistance = Infinity;

    for (const star of objects.stars) {
      if (!star) continue;

      // Use the physics module for gravity calculation
      const gravity = Physics.computeStarGravity(
        this.position.x,
        this.position.y,
        star,
        this.ship.engineTier,
        dt
      );

      if (gravity.inGravity) {
        this.inGravityWell = true;
        this.velocity.x += gravity.fx;
        this.velocity.y += gravity.fy;

        // Track nearest star for UI
        if (gravity.distance < this.nearestStarDistance) {
          this.nearestStarDistance = gravity.distance;
          this.nearestStar = star;
        }
      }
    }
  },

  distanceTo(obj) {
    const dx = obj.x - this.position.x;
    const dy = obj.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  updateInventory(data) {
    this.inventory = data.inventory;
    // Prevent credits from ever being set to null/undefined
    if (typeof data.credits === 'number' && !Number.isNaN(data.credits)) {
      this.credits = data.credits;
    }
  },

  onMiningStarted(data) {
    this.miningConfirmed = true;
  },

  onMiningComplete(data) {
    // Show notification of what was mined
    Renderer.showMiningResult(data.resourceName, data.quantity);

    // Clear mining state
    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningConfirmed = false;
  },

  onMiningCancelled(data) {
    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningConfirmed = false;
  },

  onMiningError(data) {
    // Debug logging for mining errors
    console.error('[Mining Debug] Error received:', {
      message: data.message,
      serverRejectedObjectId: data.objectId,
      clientTargetWas: this.miningTarget ? {
        id: this.miningTarget.id,
        pos: { x: Math.round(this.miningTarget.x), y: Math.round(this.miningTarget.y) },
        isOrbital: this.miningTarget.isOrbital,
        starId: this.miningTarget.starId
      } : null,
      idsMatch: this.miningTarget ? (this.miningTarget.id === data.objectId) : 'no target',
      playerPos: { x: Math.round(this.position.x), y: Math.round(this.position.y) },
      playerSector: {
        x: Math.floor(this.position.x / CONSTANTS.SECTOR_SIZE),
        y: Math.floor(this.position.y / CONSTANTS.SECTOR_SIZE)
      }
    });

    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningConfirmed = false;
    Toast.error(data.message);
  },

  onDamaged(data) {
    // Update health values
    this.hull.current = data.hull;
    this.shield.current = data.shield;
  },

  getCargoUsed() {
    return this.inventory.reduce((sum, item) => sum + item.quantity, 0);
  },

  getCargoMax() {
    const tier = this.ship.cargoTier || 1;
    return CONSTANTS.CARGO_CAPACITY[tier] || CONSTANTS.CARGO_CAPACITY[1];
  },

  getRadarRange() {
    return CONSTANTS.BASE_RADAR_RANGE * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.radarTier - 1);
  },

  /**
   * Get thrust intensity for visual effects
   * Ramps up over 2 seconds of continuous thrust
   * 0-500ms: 30% -> 60% (quick ignition)
   * 500-2000ms: 60% -> 100% (build to full)
   * @returns {number} Intensity 0-1
   */
  getThrustIntensity() {
    if (this.thrustDuration <= 0) return 0;

    if (this.thrustDuration < 500) {
      // Quick ignition phase: 0.3 -> 0.6
      return 0.3 + (this.thrustDuration / 500) * 0.3;
    }

    // Build to full: 0.6 -> 1.0
    const buildPhase = Math.min(1, (this.thrustDuration - 500) / 1500);
    return 0.6 + buildPhase * 0.4;
  },

  /**
   * Check if player is currently thrusting
   * @returns {boolean}
   */
  isThrusting() {
    return this.thrustDuration > 0;
  },

  // Loot collection methods
  tryCollectWreckage() {
    if (this.collectingWreckage || this.miningTarget) return;

    const collectRange = CONSTANTS.MINING_RANGE || 100;
    const closestWreckage = Entities.getClosestWreckage(this.position, collectRange);

    if (closestWreckage) {
      this.collectingWreckage = closestWreckage;
      this.collectProgress = 0;
      Network.sendLootCollect(closestWreckage.id);
    }
  },

  cancelCollectWreckage() {
    if (this.collectingWreckage) {
      Network.sendLootCancel(this.collectingWreckage.id);
      this.collectingWreckage = null;
      this.collectProgress = 0;
      this.collectTotalTime = 0;
    }
  },

  onLootCollectionStarted(data) {
    this.collectTotalTime = data.totalTime;
    console.log('Started collecting wreckage:', data.wreckageId);
  },

  onLootCollectionProgress(data) {
    this.collectProgress = data.progress;
  },

  onLootCollectionComplete(data) {
    console.log('Loot collected:', data.contents);

    // Show loot notification
    if (data.results) {
      let message = '';
      if (data.results.credits > 0) {
        message += `+${data.results.credits} credits `;
      }
      if (data.results.resources.length > 0) {
        const resourceText = data.results.resources.map(r => `+${r.quantity} ${r.type}`).join(', ');
        message += resourceText;
      }
      if (data.results.components.length > 0) {
        message += ` +${data.results.components.length} component(s)`;
      }
      if (data.results.relics.length > 0) {
        message += ` +${data.results.relics.length} relic(s)!`;
      }

      if (message && typeof Toast !== 'undefined') {
        Toast.success(message.trim());
      }
    }

    this.collectingWreckage = null;
    this.collectProgress = 0;
    this.collectTotalTime = 0;
  },

  onLootCollectionCancelled(data) {
    console.log('Loot collection cancelled:', data.reason);
    this.collectingWreckage = null;
    this.collectProgress = 0;
    this.collectTotalTime = 0;
  },

  // Buff methods
  onBuffApplied(data) {
    this.activeBuffs.set(data.buffType, {
      type: data.buffType,
      expiresAt: data.expiresAt,
      duration: data.duration
    });
  },

  onBuffExpired(data) {
    this.activeBuffs.delete(data.buffType);
  },

  hasBuff(buffType) {
    const buff = this.activeBuffs.get(buffType);
    if (!buff) return false;
    return Date.now() < buff.expiresAt;
  },

  /**
   * Check if player has a specific relic
   * @param {string} relicType - The relic type key (e.g., 'WORMHOLE_GEM')
   * @returns {boolean}
   */
  hasRelic(relicType) {
    if (!this.relics || !Array.isArray(this.relics)) return false;
    const normalizedType = relicType.toUpperCase();
    return this.relics.some(r => r.relic_type.toUpperCase() === normalizedType);
  },

  getBuffTimeRemaining(buffType) {
    const buff = this.activeBuffs.get(buffType);
    if (!buff) return 0;
    return Math.max(0, buff.expiresAt - Date.now());
  },

  // Check for nearby wreckage
  checkWreckageProximity() {
    const collectRange = CONSTANTS.MINING_RANGE || 100;
    const nearestWreckage = Entities.getClosestWreckage(this.position, collectRange);

    // Update UI hint for wreckage collection
    const hint = document.getElementById('loot-hint');
    if (hint) {
      if (nearestWreckage && !this.collectingWreckage && !this.miningTarget) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }

    return nearestWreckage;
  },

  // Thrust boost methods (Energy Core ability)
  activateBoost() {
    const now = Date.now();
    const tier = this.ship.energyCoreTier || 1;

    // Get boost duration and cooldown from constants
    const boostDuration = CONSTANTS.ENERGY_CORE?.BOOST?.DURATION?.[tier] || 1000;
    const boostCooldown = CONSTANTS.ENERGY_CORE?.BOOST?.COOLDOWN?.[tier] || 15000;

    this.boostActive = true;
    this.boostEndTime = now + boostDuration;
    this.boostCooldownEnd = now + boostCooldown;

    console.log(`Thrust boost activated! Duration: ${boostDuration}ms, Cooldown: ${boostCooldown}ms`);
  },

  isBoostActive() {
    return this.boostActive && Date.now() < this.boostEndTime;
  },

  isBoostOnCooldown() {
    return Date.now() < this.boostCooldownEnd;
  },

  getBoostCooldownRemaining() {
    const remaining = this.boostCooldownEnd - Date.now();
    return Math.max(0, remaining);
  },

  getBoostCooldownPercent() {
    const tier = this.ship.energyCoreTier || 1;
    const totalCooldown = CONSTANTS.ENERGY_CORE?.BOOST?.COOLDOWN?.[tier] || 15000;
    const remaining = this.getBoostCooldownRemaining();
    return remaining / totalCooldown;
  },

  // Death and survival methods

  /**
   * Get time survived since last spawn/respawn
   * @returns {number} Time in milliseconds
   */
  getSurvivalTime() {
    if (this.sessionStartTime <= 0) return 0;
    return Date.now() - this.sessionStartTime;
  },

  /**
   * Handle player death event
   * @param {Object} data - Death data from server
   */
  onDeath(data) {
    this.isDead = true;
    // Note: Don't reset sessionStartTime here - we use it for survival time display
  },

  /**
   * Handle player respawn
   * @param {Object} data - Respawn data from server
   */
  onRespawn(data) {
    this.isDead = false;
    this.sessionStartTime = Date.now(); // Start new survival timer

    // Update position from server
    if (data.position) {
      this.position.x = data.position.x;
      this.position.y = data.position.y;
    }

    // Reset velocity
    this.velocity.x = 0;
    this.velocity.y = 0;

    // Restore health
    if (typeof data.hull !== 'undefined') {
      this.hull.current = data.hull;
    }
    if (typeof data.shield !== 'undefined') {
      this.shield.current = data.shield;
    }

    console.log('[Player] Respawned at:', this.position);
  },

  /**
   * Check if player is invulnerable (after respawn)
   * @returns {boolean}
   */
  isInvulnerable() {
    if (typeof PlayerDeathEffect !== 'undefined') {
      return PlayerDeathEffect.isInvulnerable();
    }
    return false;
  },

  // ==================== Wormhole Transit Methods ====================

  /**
   * Check for nearby wormholes and update UI hint
   */
  checkWormholeProximity() {
    const WORMHOLE_RANGE = 100; // Must match server WORMHOLE_RANGE
    const objects = World.getVisibleObjects(this.position, 2000);
    let nearestWormhole = null;
    let nearestDist = Infinity;

    if (objects.wormholes && objects.wormholes.length > 0) {
      for (const wormhole of objects.wormholes) {
        const dx = wormhole.x - this.position.x;
        const dy = wormhole.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Debug log (throttled)
        if (!this._lastWormholeLog || Date.now() - this._lastWormholeLog > 2000) {
          console.log('[Wormhole] Found wormhole at', Math.round(wormhole.x), Math.round(wormhole.y),
            'dist:', Math.round(dist), 'size:', wormhole.size, 'range:', WORMHOLE_RANGE + wormhole.size);
          this._lastWormholeLog = Date.now();
        }

        if (dist < nearestDist && dist < WORMHOLE_RANGE + wormhole.size) {
          nearestDist = dist;
          nearestWormhole = wormhole;
        }
      }
    }

    this._nearestWormhole = nearestWormhole;

    // Update UI hint
    const hint = document.getElementById('wormhole-hint');
    if (hint) {
      const hasGem = this.hasRelic('WORMHOLE_GEM');

      // Debug log when near wormhole
      if (nearestWormhole && (!this._lastHintLog || Date.now() - this._lastHintLog > 2000)) {
        console.log('[Wormhole] Near wormhole! hasGem:', hasGem, 'inTransit:', this.inWormholeTransit,
          'relics:', this.relics?.map(r => r.relic_type));
        this._lastHintLog = Date.now();
      }

      if (nearestWormhole && hasGem && !this.inWormholeTransit) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }
  },

  /**
   * Attempt to enter a nearby wormhole
   */
  tryEnterWormhole() {
    console.log('[Wormhole] tryEnterWormhole called, nearestWormhole:', this._nearestWormhole);

    if (!this._nearestWormhole) {
      Toast.error('No wormhole nearby');
      return;
    }

    if (!this.hasRelic('WORMHOLE_GEM')) {
      Toast.error('You need the Wormhole Gem to enter wormholes');
      return;
    }

    if (this.inWormholeTransit) {
      Toast.error('Already in wormhole transit');
      return;
    }

    console.log('[Wormhole] Sending enter request for wormhole:', this._nearestWormhole.id);
    Network.sendEnterWormhole(this._nearestWormhole.id);
  },

  /**
   * Handle entering wormhole - show destination selection
   * @param {Object} data - { destinations: Array }
   */
  onWormholeEntered(data) {
    this.inWormholeTransit = true;
    this.wormholeTransitPhase = 'selecting';
    this.wormholeDestinations = data.destinations || [];

    // Show the transit UI
    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.show(this.wormholeDestinations);
    }

    console.log('[Wormhole] Entered, selecting destination from', this.wormholeDestinations.length, 'options');
  },

  /**
   * Select a wormhole destination to transit to
   * @param {string} destinationId - Destination wormhole ID
   */
  selectWormholeDestination(destinationId) {
    if (this.wormholeTransitPhase !== 'selecting') {
      return;
    }

    Network.sendSelectWormholeDestination(destinationId);
  },

  /**
   * Handle transit started - begin transport animation
   * @param {Object} data - { duration, destination }
   */
  onWormholeTransitStarted(data) {
    this.wormholeTransitPhase = 'transit';
    this.wormholeDestination = data.destination;
    this.wormholeTransitProgress = 0;

    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.startTransit(data.duration, data.destination);
    }

    console.log('[Wormhole] Transit started to', data.destination);
  },

  /**
   * Handle transit progress update
   * @param {Object} data - { progress: 0-1 }
   */
  onWormholeTransitProgress(data) {
    this.wormholeTransitProgress = data.progress;

    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.updateProgress(data.progress);
    }
  },

  /**
   * Handle transit completion - teleport to new location
   * @param {Object} data - { position, wormholeId }
   */
  onWormholeExitComplete(data) {
    // Update position
    this.position.x = data.position.x;
    this.position.y = data.position.y;
    this.velocity.x = 0;
    this.velocity.y = 0;

    // Reset transit state
    this.inWormholeTransit = false;
    this.wormholeTransitPhase = null;
    this.wormholeDestinations = [];
    this.wormholeTransitProgress = 0;
    this.wormholeDestination = null;

    // Hide the transit UI
    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.hide();
    }

    Toast.success('Wormhole transit complete!');
    console.log('[Wormhole] Exited at', data.position);
  },

  /**
   * Cancel wormhole transit during selection phase
   */
  cancelWormholeTransit() {
    if (!this.inWormholeTransit || this.wormholeTransitPhase !== 'selecting') {
      return;
    }

    Network.sendCancelWormhole();
  },

  /**
   * Handle transit cancelled (by player or server)
   * @param {Object} data - { reason }
   */
  onWormholeTransitCancelled(data) {
    this.inWormholeTransit = false;
    this.wormholeTransitPhase = null;
    this.wormholeDestinations = [];
    this.wormholeTransitProgress = 0;
    this.wormholeDestination = null;

    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.hide();
    }

    if (data.reason) {
      Toast.info('Transit cancelled: ' + data.reason);
    }

    console.log('[Wormhole] Transit cancelled:', data.reason);
  },

  /**
   * Handle wormhole error
   * @param {Object} data - { error }
   */
  onWormholeError(data) {
    Toast.error(data.error || 'Wormhole error');
    console.error('[Wormhole] Error:', data.error);
  }
};
