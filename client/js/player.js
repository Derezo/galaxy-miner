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
    hullTier: 1,
    profileId: 'pilot'
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
  // Multi-collect (Scrap Siphon) state
  multiCollecting: false,
  multiCollectWreckageIds: null,
  multiCollectCooldownEnd: 0,  // Timestamp when cooldown ends
  // Active buffs
  activeBuffs: new Map(),
  // Gravity well state
  inGravityWell: false,
  nearestStarDistance: Infinity,
  nearestStar: null,

  // Death and survival tracking
  isDead: false,
  sessionStartTime: 0,  // When this life started (for survival time calculation)

  // Session statistics (tracked per life for death screen display)
  sessionStats: {
    distanceTraveled: 0,
    lastPosition: null,
    npcsKilled: 0,
    resourcesMined: 0,
    creditsEarned: 0
  },

  // Wormhole transit state
  inWormholeTransit: false,
  wormholeTransitPhase: null,  // 'selecting' | 'transit'
  wormholeDestinations: [],
  wormholeTransitProgress: 0,
  wormholeDestination: null,
  _nearestWormhole: null,

  // Plunder state (Skull and Bones relic)
  plunderCooldownEnd: 0,
  _nearestBase: null,

  // Audio state tracking
  _engineLoopActive: false,
  _boostLoopActive: false,
  _lastShieldState: 'damaged',  // 'damaged' | 'full'

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
      hullTier: data.hull_tier || 1,
      profileId: data.profile_id || 'pilot'
    };

    // Initialize ship color
    this.colorId = data.ship_color_id || 'green';

    // Initialize profile image from profileId
    if (typeof HUD !== 'undefined' && typeof CONSTANTS !== 'undefined') {
      const profileOptions = CONSTANTS.PROFILE_OPTIONS || [];
      const profile = profileOptions.find(p => p.id === this.ship.profileId);
      if (profile) {
        HUD.updateProfileImage(profile.emoji);
      }
    }

    // Reset boost state
    this.boostActive = false;
    this.boostEndTime = 0;
    this.boostCooldownEnd = 0;
    this.lastThrustKeyTime = 0;

    // Reset audio state
    this._engineLoopActive = false;
    this._boostLoopActive = false;
    this._lastShieldState = 'damaged';

    // Initialize survival tracking
    this.isDead = false;
    this.sessionStartTime = Date.now();

    // Reset session statistics
    this.sessionStats = {
      distanceTraveled: 0,
      lastPosition: { x: this.position.x, y: this.position.y },
      npcsKilled: 0,
      resourcesMined: 0,
      creditsEarned: 0
    };

    // Reset wormhole transit state
    this.inWormholeTransit = false;
    this.wormholeTransitPhase = null;
    this.wormholeDestinations = [];
    this.wormholeTransitProgress = 0;
    this.wormholeDestination = null;
    this._nearestWormhole = null;

    // Reset plunder state
    this.plunderCooldownEnd = 0;
    this._nearestBase = null;

    // Initialize UIState with player data
    if (typeof UIState !== 'undefined') {
      UIState.set({
        inventory: this.inventory,
        credits: this.credits,
        relics: this.relics,
        ship: this.ship
      });
    }

    Logger.log('Player initialized:', this.username);
  },

  update(dt) {
    // Skip physics updates during wormhole transit
    if (this.inWormholeTransit) {
      return;
    }

    // Get input from unified Input module (handles mobile/desktop automatically)
    const input = Input.getMovementInput();
    const isMobileInput = input.isMobile;

    const now = Date.now();

    // Calculate speed based on engine tier
    let speed = CONSTANTS.BASE_SPEED * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.engineTier - 1);
    const rotSpeed = CONSTANTS.BASE_ROTATION_SPEED;

    // Check for boost end
    if (this.boostActive && now >= this.boostEndTime) {
      this.boostActive = false;
      // Stop boost sustain loop
      if (this._boostLoopActive && typeof AudioManager !== 'undefined') {
        AudioManager.stopLoop('boost_sustain');
        this._boostLoopActive = false;
      }
    }

    // Apply boost speed multiplier if active
    if (this.boostActive) {
      const boostMultiplier = CONSTANTS.ENERGY_CORE?.BOOST?.SPEED_MULTIPLIER?.[this.ship.energyCoreTier] || 2.0;
      speed *= boostMultiplier;
    }

    // Rotation and movement (mobile vs desktop)
    if (isMobileInput && input.targetRotation !== undefined && input.thrustMagnitude > 0) {
      // Mobile: smooth rotation toward joystick direction
      let rotDiff = input.targetRotation - this.rotation;
      // Normalize angle to -PI to PI
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

      // Rotation speed scales with how far off target we are
      const mobileRotSpeed = rotSpeed * Math.min(1.5, Math.abs(rotDiff) * 2);
      this.rotation += Math.sign(rotDiff) * mobileRotSpeed * dt;

      // Apply thrust proportional to joystick magnitude
      const thrustFactor = input.thrustMagnitude;
      this.velocity.x += Math.cos(this.rotation) * speed * thrustFactor * dt;
      this.velocity.y += Math.sin(this.rotation) * speed * thrustFactor * dt;
      this.thrustDuration = Math.min(this.thrustDuration + dt * 1000 * thrustFactor, 2000);

      // Mobile boost via joystick at max thrust
      if (input.boost && !this.boostActive && now >= this.boostCooldownEnd) {
        this.activateBoost();
      }
    } else {
      // Desktop: discrete rotation
      if (input.left) this.rotation -= rotSpeed * dt;
      if (input.right) this.rotation += rotSpeed * dt;
    }

    // Thrust with duration tracking for visual effects (desktop only, mobile handled above)
    if (!isMobileInput && input.up) {
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
    } else if (!isMobileInput) {
      this._lastThrustKeyWasDown = false;
      // Decay thrust duration quickly when not thrusting (desktop only)
      this.thrustDuration = Math.max(this.thrustDuration - dt * 5000, 0);
    }

    // Mobile thrust decay when joystick released
    const isMobileDevice = typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile;
    if (isMobileDevice && (!isMobileInput || input.thrustMagnitude === 0)) {
      this.thrustDuration = Math.max(this.thrustDuration - dt * 5000, 0);
    }

    // Reverse thrust (desktop only)
    if (!isMobileInput && input.down) {
      this.velocity.x -= Math.cos(this.rotation) * speed * 0.5 * dt;
      this.velocity.y -= Math.sin(this.rotation) * speed * 0.5 * dt;
    }

    // Apply friction/drag
    const drag = 0.98;
    this.velocity.x *= drag;
    this.velocity.y *= drag;

    // Update engine audio based on velocity
    this.updateEngineAudio();

    // Apply star gravity wells
    this.applyStarGravity(dt);

    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Track distance traveled for session stats
    this.updateSessionStats();

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

    // Play local weapon fire sound immediately for responsiveness
    if (typeof AudioManager !== 'undefined') {
      const weaponSound = `weapon_fire_${this.ship.weaponTier}`;
      AudioManager.play(weaponSound);
    }

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
      Logger.log('[Mining Debug] Attempting to mine:', {
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
    const wasDamaged = this.shield.current < this.shield.max;

    if (wasDamaged) {
      // Base recharge rate + energy core bonus
      const baseRate = CONSTANTS.SHIELD_RECHARGE_RATE;
      const bonusRate = CONSTANTS.ENERGY_CORE?.SHIELD_REGEN_BONUS?.[this.ship.energyCoreTier] || 0;
      const effectiveRate = baseRate + bonusRate;

      this.shield.current = Math.min(
        this.shield.max,
        this.shield.current + effectiveRate * dt
      );

      // Check if shield just became fully charged
      const isNowFull = this.shield.current >= this.shield.max;
      if (isNowFull && this._lastShieldState === 'damaged') {
        // Shield fully recharged - play sound
        if (typeof AudioManager !== 'undefined') {
          AudioManager.play('shield_recharge');
        }
        this._lastShieldState = 'full';
      }
    } else {
      this._lastShieldState = 'full';
    }
  },

  /**
   * Update engine audio loop based on player movement
   */
  updateEngineAudio() {
    if (typeof AudioManager === 'undefined') return;

    // Calculate velocity magnitude
    const velocityMag = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    const isMoving = velocityMag > 0.1; // Small threshold to avoid audio flickering

    if (isMoving && !this._engineLoopActive) {
      // Play thrust start sound once (no loop - current engine sounds don't loop well)
      AudioManager.play('thrust_start');
      this._engineLoopActive = true;
    } else if (!isMoving && this._engineLoopActive) {
      // Play thrust stop sound once
      AudioManager.play('thrust_stop');
      this._engineLoopActive = false;
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
    // Show reward pop-up
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.queueReward({
        resources: [{ type: data.resourceType, name: data.resourceName, quantity: data.quantity }]
      });
    }

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
    Logger.error('[Mining Debug] Error received:', {
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
    NotificationManager.error(data.message);
  },

  onDamaged(data) {
    // Update health values
    this.hull.current = data.hull;
    const previousShield = this.shield.current;
    this.shield.current = data.shield;

    // Track shield state for recharge sound
    if (this.shield.current < previousShield) {
      this._lastShieldState = 'damaged';
    }
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
    Logger.log('Started collecting wreckage:', data.wreckageId);
  },

  onLootCollectionProgress(data) {
    this.collectProgress = data.progress;
  },

  onLootCollectionComplete(data) {
    Logger.log('Loot collected:', data.contents);

    // Show reward pop-ups
    // Note: Exclude buffs from results since they're already queued via the
    // separate 'buff:applied' event handler to avoid duplicate notifications
    if (data.results && typeof NotificationManager !== 'undefined') {
      const { buffs, ...resultsWithoutBuffs } = data.results;
      NotificationManager.queueReward(resultsWithoutBuffs);
    }

    this.collectingWreckage = null;
    this.collectProgress = 0;
    this.collectTotalTime = 0;
  },

  onLootCollectionCancelled(data) {
    Logger.log('Loot collection cancelled:', data.reason);
    this.collectingWreckage = null;
    this.collectProgress = 0;
    this.collectTotalTime = 0;
  },

  // Multi-collect for Scrap Siphon relic
  tryMultiCollectWreckage() {
    // Check if already collecting or on cooldown
    if (this.collectingWreckage || this.miningTarget || this.multiCollecting) return;
    if (Date.now() < this.multiCollectCooldownEnd) return;

    if (!this.hasRelic('SCRAP_SIPHON')) {
      // Fall back to single collect if no relic
      this.tryCollectWreckage();
      return;
    }

    // Scrap Siphon multi-collect
    this.multiCollecting = true;
    this.collectProgress = 0;
    Network.sendMultiCollect();
  },

  onMultiCollectStarted(data) {
    this.collectTotalTime = data.totalTime;
    this.multiCollectWreckageIds = data.wreckageIds;
    Logger.log('Started multi-collecting wreckage:', data.wreckageIds);
  },

  onMultiCollectComplete(data) {
    Logger.log('Multi-collect complete:', data.contents);

    // Show reward pop-ups
    if (data.results && typeof NotificationManager !== 'undefined') {
      const { buffs, ...resultsWithoutBuffs } = data.results;
      NotificationManager.queueReward(resultsWithoutBuffs);
    }

    this.multiCollecting = false;
    this.multiCollectWreckageIds = null;
    this.collectProgress = 0;
    this.collectTotalTime = 0;
    // Set cooldown to prevent rapid re-triggering (matches animation duration)
    this.multiCollectCooldownEnd = Date.now() + 700;
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

    // Play boost activation and start sustain loop
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('boost_activate');
      AudioManager.startLoop('boost_sustain');
      this._boostLoopActive = true;
    }

    Logger.log(`Thrust boost activated! Duration: ${boostDuration}ms, Cooldown: ${boostCooldown}ms`);
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

    // Reset audio state (engine sounds are one-shot, not loops)
    if (typeof AudioManager !== 'undefined') {
      this._engineLoopActive = false;
      if (this._boostLoopActive) {
        AudioManager.stopLoop('boost_sustain');
        this._boostLoopActive = false;
      }
    }
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

    // Reset session statistics for new life
    this.resetSessionStats();

    // Clear death replay buffer for new life
    if (typeof DeathReplay !== 'undefined') {
      DeathReplay.clearBuffer();
    }

    // Reset audio state (engine sounds are one-shot, not loops)
    if (typeof AudioManager !== 'undefined') {
      this._engineLoopActive = false;
      if (this._boostLoopActive) {
        AudioManager.stopLoop('boost_sustain');
        this._boostLoopActive = false;
      }
    }

    Logger.log('[Player] Respawned at:', this.position);
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
          Logger.log('[Wormhole] Found wormhole at', Math.round(wormhole.x), Math.round(wormhole.y),
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
        Logger.log('[Wormhole] Near wormhole! hasGem:', hasGem, 'inTransit:', this.inWormholeTransit,
          'relics:', this.relics?.map(r => r.relic_type));
        this._lastHintLog = Date.now();
      }

      if (nearestWormhole && hasGem && !this.inWormholeTransit) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }

    // Track nearest base for plundering (Skull and Bones relic)
    this._nearestBase = this.findNearestBase();
  },

  /**
   * Find the nearest base within plunder range
   * @returns {Object|null} Nearest base or null
   */
  findNearestBase() {
    // Only check if player has the relic to save performance
    if (!this.hasRelic('SKULL_AND_BONES')) return null;

    const plunderRange = CONSTANTS.RELIC_TYPES?.SKULL_AND_BONES?.plunderRange || 200;
    let nearestBase = null;
    let nearestDist = Infinity;

    // Get all bases from Entities
    if (typeof Entities !== 'undefined' && Entities.bases) {
      for (const [baseId, base] of Entities.bases) {
        if (!base || base.destroyed) continue;

        const dx = base.x - this.position.x;
        const dy = base.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const baseSize = base.size || 100;

        // Check if within plunder range (edge of base, not center)
        if (dist - baseSize < plunderRange && dist < nearestDist) {
          nearestDist = dist;
          nearestBase = base;
        }
      }
    }

    return nearestBase;
  },

  /**
   * Attempt to enter a nearby wormhole
   */
  tryEnterWormhole() {
    Logger.log('[Wormhole] tryEnterWormhole called, nearestWormhole:', this._nearestWormhole);

    if (!this._nearestWormhole) {
      NotificationManager.error('No wormhole nearby');
      return;
    }

    if (!this.hasRelic('WORMHOLE_GEM')) {
      NotificationManager.error('You need the Wormhole Gem to enter wormholes');
      return;
    }

    if (this.inWormholeTransit) {
      NotificationManager.error('Already in wormhole transit');
      return;
    }

    Logger.log('[Wormhole] Sending enter request for wormhole:', this._nearestWormhole.id);
    Network.sendEnterWormhole(this._nearestWormhole.id);
  },

  /**
   * Attempt to plunder a nearby faction base (Skull and Bones relic)
   */
  tryPlunderBase() {
    Logger.log('[Plunder] tryPlunderBase called, nearestBase:', this._nearestBase);

    // Check cooldown
    if (Date.now() < this.plunderCooldownEnd) {
      const remaining = Math.ceil((this.plunderCooldownEnd - Date.now()) / 1000);
      NotificationManager.error(`Plunder on cooldown: ${remaining}s`);
      return;
    }

    // Check relic
    if (!this.hasRelic('SKULL_AND_BONES')) {
      NotificationManager.error('You need the Skull and Bones relic');
      return;
    }

    // Check base nearby
    if (!this._nearestBase) {
      NotificationManager.error('No base nearby to plunder');
      return;
    }

    // Send plunder request to server
    Logger.log('[Plunder] Sending plunder request for base:', this._nearestBase.id);
    Network.sendPlunderBase(this._nearestBase.id);

    // Set cooldown (15 seconds)
    const cooldown = CONSTANTS.RELIC_TYPES?.SKULL_AND_BONES?.cooldown || 15000;
    this.plunderCooldownEnd = Date.now() + cooldown;
  },

  /**
   * Handle entering wormhole - show destination selection
   * @param {Object} data - { destinations: Array }
   */
  onWormholeEntered(data) {
    this.inWormholeTransit = true;
    this.wormholeTransitPhase = 'selecting';
    this.wormholeDestinations = data.destinations || [];

    // Start wormhole ambient sound loop
    if (typeof AudioManager !== 'undefined') {
      AudioManager.startLoop('wormhole_ambient');
    }

    // Show the transit UI
    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.show(this.wormholeDestinations);
    }

    Logger.log('[Wormhole] Entered, selecting destination from', this.wormholeDestinations.length, 'options');
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

    // Stop ambient and play transit sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.stopLoop('wormhole_ambient');
      AudioManager.play('wormhole_transit');
    }

    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.startTransit(data.duration, data.destination);
    }

    Logger.log('[Wormhole] Transit started to', data.destination);
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

    // Stop any wormhole sounds
    if (typeof AudioManager !== 'undefined') {
      AudioManager.stopLoop('wormhole_ambient');
    }

    // Hide the transit UI
    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.hide();
    }

    NotificationManager.success('Wormhole transit complete!');
    Logger.log('[Wormhole] Exited at', data.position);
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

    // Stop any wormhole sounds
    if (typeof AudioManager !== 'undefined') {
      AudioManager.stopLoop('wormhole_ambient');
    }

    if (typeof WormholeTransitUI !== 'undefined') {
      WormholeTransitUI.hide();
    }

    if (data.reason) {
      NotificationManager.info('Transit cancelled: ' + data.reason);
    }

    Logger.log('[Wormhole] Transit cancelled:', data.reason);
  },

  /**
   * Handle wormhole error
   * @param {Object} data - { error }
   */
  onWormholeError(data) {
    NotificationManager.error(data.error || 'Wormhole error');
    Logger.error('[Wormhole] Error:', data.error);
  },

  // ==================== Session Statistics Methods ====================

  /**
   * Update session statistics (called each frame)
   * Tracks distance traveled
   */
  updateSessionStats() {
    if (this.isDead) return;

    // Track distance traveled
    if (this.sessionStats.lastPosition) {
      const dx = this.position.x - this.sessionStats.lastPosition.x;
      const dy = this.position.y - this.sessionStats.lastPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only track if moved at least 1 unit to avoid floating point accumulation
      if (dist > 1) {
        this.sessionStats.distanceTraveled += dist;
        this.sessionStats.lastPosition = { x: this.position.x, y: this.position.y };
      }
    } else {
      this.sessionStats.lastPosition = { x: this.position.x, y: this.position.y };
    }
  },

  /**
   * Record an NPC kill for session statistics
   */
  onNPCKill() {
    this.sessionStats.npcsKilled++;
  },

  /**
   * Record resources mined for session statistics
   * @param {number} quantity - Amount of resources mined
   */
  onResourceMined(quantity) {
    this.sessionStats.resourcesMined += quantity;
  },

  /**
   * Record credits earned for session statistics
   * @param {number} amount - Amount of credits earned
   */
  onCreditsEarned(amount) {
    this.sessionStats.creditsEarned += amount;
  },

  /**
   * Get current session statistics for death screen display
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    return {
      survivalTime: this.getSurvivalTime(),
      distanceTraveled: Math.round(this.sessionStats.distanceTraveled),
      npcsKilled: this.sessionStats.npcsKilled,
      resourcesMined: this.sessionStats.resourcesMined,
      creditsEarned: this.sessionStats.creditsEarned
    };
  },

  /**
   * Reset session statistics (called on respawn)
   */
  resetSessionStats() {
    this.sessionStats = {
      distanceTraveled: 0,
      lastPosition: { x: this.position.x, y: this.position.y },
      npcsKilled: 0,
      resourcesMined: 0,
      creditsEarned: 0
    };
  }
};
