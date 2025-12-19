// Galaxy Miner - Auto-Fire System
// Automatically fires at nearest enemy when aimed within tolerance (mobile only)

const AutoFire = {
  enabled: true,
  aimTolerance: Math.PI / 6, // 30 degrees tolerance
  lastFireTime: 0,
  currentTarget: null,

  init() {
    // Auto-fire only active on mobile
    if (typeof DeviceDetect === 'undefined' || !DeviceDetect.isMobile) {
      Logger.log('AutoFire: Not initializing (not mobile)');
      return;
    }

    Logger.log('AutoFire initialized');
  },

  /**
   * Update auto-fire system - called from game loop
   * @param {number} dt - Delta time
   */
  update(dt) {
    // Only run on mobile when enabled
    if (typeof DeviceDetect === 'undefined' || !DeviceDetect.isMobile) return;
    if (!this.enabled) return;

    // Skip if manual firing is active (fire button held)
    if (typeof MobileHUD !== 'undefined' && MobileHUD._manualFiringActive) return;

    // Don't fire if game hasn't started
    if (typeof GalaxyMiner === 'undefined' || !GalaxyMiner.gameStarted) return;

    // Don't fire if player is dead or in transit
    if (typeof Player === 'undefined' || Player.isDead || Player.inWormholeTransit) return;

    const now = Date.now();

    // Get weapon range based on tier
    const weaponRange = this.getWeaponRange();

    // Find NPCs in range
    const npcsInRange = this.getNPCsInRange(weaponRange);

    if (npcsInRange.length === 0) {
      this.currentTarget = null;
      return;
    }

    // Sort by distance, get nearest
    npcsInRange.sort((a, b) => a.distance - b.distance);
    const nearest = npcsInRange[0];
    this.currentTarget = nearest;

    // Calculate angle to target
    const dx = nearest.x - Player.position.x;
    const dy = nearest.y - Player.position.y;
    const angleToTarget = Math.atan2(dy, dx);

    // Check if aimed within tolerance
    let angleDiff = angleToTarget - Player.rotation;
    // Normalize to -PI to PI
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) < this.aimTolerance) {
      // Aimed at target - fire if cooldown allows
      const cooldown = this.getWeaponCooldown();
      if (now - this.lastFireTime >= cooldown) {
        Player.fire();
        this.lastFireTime = now;
      }
    }
  },

  /**
   * Get weapon range based on tier
   * @returns {number} Weapon range in units
   */
  getWeaponRange() {
    if (typeof CONSTANTS === 'undefined') return 180;

    const tier = Player.ship.weaponTier || 1;

    // Check WEAPON_RANGES if defined
    if (CONSTANTS.WEAPON_RANGES && CONSTANTS.WEAPON_RANGES[tier]) {
      return CONSTANTS.WEAPON_RANGES[tier];
    }

    // Fallback: calculate from base range with tier scaling
    const baseRange = CONSTANTS.BASE_WEAPON_RANGE || 180;
    const tierMultiplier = CONSTANTS.TIER_MULTIPLIER || 1.5;
    return baseRange * Math.pow(tierMultiplier, tier - 1);
  },

  /**
   * Get weapon cooldown based on tier
   * @returns {number} Cooldown in milliseconds
   */
  getWeaponCooldown() {
    if (typeof CONSTANTS === 'undefined') return 500;

    const tier = Player.ship.weaponTier || 1;
    const energyTier = Player.ship.energyCoreTier || 1;

    let cooldown = CONSTANTS.BASE_WEAPON_COOLDOWN / Math.pow(CONSTANTS.TIER_MULTIPLIER, tier - 1);

    // Apply energy core cooldown reduction
    const cooldownReduction = CONSTANTS.ENERGY_CORE?.COOLDOWN_REDUCTION?.[energyTier] || 0;
    cooldown = cooldown * (1 - cooldownReduction);

    return cooldown;
  },

  /**
   * Get NPCs within range of player
   * @param {number} range - Maximum range
   * @returns {Array} Array of NPCs with distance
   */
  getNPCsInRange(range) {
    const results = [];

    // Check if Entities module exists
    if (typeof Entities === 'undefined' || !Entities.npcs) return results;

    const playerX = Player.position.x;
    const playerY = Player.position.y;

    for (const [id, npc] of Entities.npcs) {
      if (!npc || npc.isDead) continue;

      const dx = npc.x - playerX;
      const dy = npc.y - playerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= range) {
        results.push({
          id: id,
          x: npc.x,
          y: npc.y,
          distance: distance,
          faction: npc.faction,
          npc: npc
        });
      }
    }

    return results;
  },

  /**
   * Get current auto-fire target for UI indicator
   * @returns {Object|null} Current target or null
   */
  getTarget() {
    return this.currentTarget;
  },

  /**
   * Check if auto-fire has a target
   * @returns {boolean}
   */
  hasTarget() {
    return this.currentTarget !== null;
  },

  /**
   * Toggle auto-fire enabled state
   * @returns {boolean} New enabled state
   */
  toggle() {
    this.enabled = !this.enabled;
    Logger.log('AutoFire toggled:', this.enabled ? 'ON' : 'OFF');
    return this.enabled;
  },

  /**
   * Enable auto-fire
   */
  enable() {
    this.enabled = true;
  },

  /**
   * Disable auto-fire
   */
  disable() {
    this.enabled = false;
    this.currentTarget = null;
  },

  /**
   * Set aim tolerance in radians
   * @param {number} radians - Tolerance angle
   */
  setAimTolerance(radians) {
    this.aimTolerance = radians;
  }
};
