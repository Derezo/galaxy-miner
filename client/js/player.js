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

    // Thrust
    if (input.up) {
      this.velocity.x += Math.cos(this.rotation) * speed * dt;
      this.velocity.y += Math.sin(this.rotation) * speed * dt;
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

    // Visual feedback (muzzle flash, etc.)
    Renderer.addEffect({
      type: 'fire',
      x: this.position.x + Math.cos(this.rotation) * CONSTANTS.SHIP_SIZE,
      y: this.position.y + Math.sin(this.rotation) * CONSTANTS.SHIP_SIZE,
      duration: 100
    });
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
    // Check if still in range
    const dist = this.distanceTo(this.miningTarget);
    if (dist > CONSTANTS.MINING_RANGE * 1.5) {
      this.miningTarget = null;
      this.miningProgress = 0;
      return;
    }

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

  getCargoUsed() {
    return this.inventory.reduce((sum, item) => sum + item.quantity, 0);
  },

  getCargoMax() {
    return CONSTANTS.BASE_CARGO_CAPACITY * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.cargoTier - 1);
  },

  getRadarRange() {
    return CONSTANTS.BASE_RADAR_RANGE * Math.pow(CONSTANTS.TIER_MULTIPLIER, this.ship.radarTier - 1);
  }
};
