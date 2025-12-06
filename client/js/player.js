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
  ship: {
    engineTier: 1,
    weaponType: 'kinetic',
    weaponTier: 1,
    shieldTier: 1,
    miningTier: 1,
    cargoTier: 1,
    radarTier: 1
  },
  lastFireTime: 0,
  miningTarget: null,
  miningProgress: 0,
  miningConfirmed: false,  // Server confirmed mining started
  thrustDuration: 0,       // Duration of continuous thrust in ms (for visual effects)
  // Loot collection state
  collectingWreckage: null,
  collectProgress: 0,
  collectTotalTime: 0,
  // Active buffs
  activeBuffs: new Map(),

  init(data) {
    this.id = data.id;
    this.username = data.username;
    this.position = { x: data.position_x || 0, y: data.position_y || 0 };
    this.velocity = { x: data.velocity_x || 0, y: data.velocity_y || 0 };
    this.rotation = data.rotation || 0;
    this.hull = { current: data.hull_hp, max: data.hull_max };
    this.shield = { current: data.shield_hp, max: data.shield_max };
    this.credits = data.credits;
    this.inventory = data.inventory || [];

    this.ship = {
      engineTier: data.engine_tier,
      weaponType: data.weapon_type,
      weaponTier: data.weapon_tier,
      shieldTier: data.shield_tier,
      miningTier: data.mining_tier,
      cargoTier: data.cargo_tier,
      radarTier: data.radar_tier
    };

    console.log('Player initialized:', this.username);
  },

  update(dt) {
    const input = Input.getMovementInput();

    // Calculate speed based on engine tier
    const speed = CONSTANTS.BASE_SPEED * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.engineTier - 1);
    const rotSpeed = CONSTANTS.BASE_ROTATION_SPEED;

    // Rotation
    if (input.left) this.rotation -= rotSpeed * dt;
    if (input.right) this.rotation += rotSpeed * dt;

    // Thrust with duration tracking for visual effects
    if (input.up) {
      this.velocity.x += Math.cos(this.rotation) * speed * dt;
      this.velocity.y += Math.sin(this.rotation) * speed * dt;
      // Accumulate thrust duration (cap at 2000ms for visual saturation)
      this.thrustDuration = Math.min(this.thrustDuration + dt * 1000, 2000);
    } else {
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

    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Send position to server periodically
    this.sendPositionUpdate();

    // Check for nearby mineable objects
    this.checkMiningProximity();

    // Check for nearby wreckage
    this.checkWreckageProximity();

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
    const cooldown = CONSTANTS.BASE_WEAPON_COOLDOWN / Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.weaponTier - 1);

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
      this.shield.current = Math.min(
        this.shield.max,
        this.shield.current + CONSTANTS.SHIELD_RECHARGE_RATE * dt
      );
    }
  },

  distanceTo(obj) {
    const dx = obj.x - this.position.x;
    const dy = obj.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  updateInventory(data) {
    this.inventory = data.inventory;
    this.credits = data.credits;
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
    return CONSTANTS.BASE_CARGO_CAPACITY * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.cargoTier - 1);
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
  }
};
