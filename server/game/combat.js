// Galaxy Miner - Combat System (Server-side)

const config = require('../config');
const { statements } = require('../database');
const world = require('../world');
const logger = require('../../shared/logger');

// Track weapon cooldowns: playerId -> lastFireTime
const weaponCooldowns = new Map();

// Track shield recharge delay: playerId -> lastDamageTime
const shieldDelays = new Map();

/**
 * Get hull resistance values for a given hull tier
 * @param {number} hullTier - Hull upgrade tier (1-5)
 * @returns {Object} Resistance percentages for each damage type
 */
function getHullResistances(hullTier) {
  const tier = Math.max(1, Math.min(5, hullTier || 1));
  return {
    kinetic: config.HULL.KINETIC_RESIST[tier] || 0,
    energy: config.HULL.ENERGY_RESIST[tier] || 0,
    explosive: config.HULL.EXPLOSIVE_RESIST[tier] || 0
  };
}

/**
 * Get effective weapon cooldown with energy core bonus
 * @param {number} weaponTier - Weapon upgrade tier
 * @param {number} energyCoreTier - Energy core upgrade tier (1-5)
 * @returns {number} Cooldown in milliseconds
 */
function getEffectiveCooldown(weaponTier, energyCoreTier = 1) {
  const baseCooldown = config.BASE_WEAPON_COOLDOWN / Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
  const cooldownReduction = config.ENERGY_CORE.COOLDOWN_REDUCTION[energyCoreTier] || 0;
  return baseCooldown * (1 - cooldownReduction);
}

function canFire(playerId, weaponTier, energyCoreTier = 1) {
  const lastFire = weaponCooldowns.get(playerId) || 0;
  const cooldown = getEffectiveCooldown(weaponTier, energyCoreTier);
  return Date.now() - lastFire >= cooldown;
}

function fire(playerId, weaponTier) {
  if (!canFire(playerId, weaponTier)) {
    return { success: false, error: 'Weapon on cooldown' };
  }

  weaponCooldowns.set(playerId, Date.now());
  return { success: true };
}

function calculateDamage(weaponType, weaponTier, targetShieldTier) {
  const baseDamage = config.BASE_WEAPON_DAMAGE;
  const tierMultiplier = Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
  const damage = baseDamage * tierMultiplier;

  // Damage type effectiveness (simple rock-paper-scissors)
  // Kinetic: good vs shields, normal vs hull
  // Energy: normal vs shields, good vs hull
  // Explosive: good vs both but lower base damage
  let shieldDamage = damage;
  let hullDamage = damage;

  switch (weaponType) {
    case 'kinetic':
      shieldDamage *= 1.3;
      break;
    case 'energy':
      hullDamage *= 1.3;
      break;
    case 'explosive':
      shieldDamage *= 0.8;
      hullDamage *= 0.8;
      // Area effect could be added later
      break;
  }

  return { shieldDamage, hullDamage };
}

function checkHit(attackerPos, targetPos, targetSize, weaponRange, weaponTier) {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Use per-tier weapon ranges if available (weaponRange param may already be tier-specific)
  // Only apply tier multiplier if weaponRange is the base range
  const effectiveRange = (config.WEAPON_RANGES && config.WEAPON_RANGES[weaponTier])
    ? config.WEAPON_RANGES[weaponTier]
    : weaponRange * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);

  // Simple distance check (could add projectile travel time later)
  return distance <= effectiveRange + targetSize;
}

/**
 * Apply damage to a player with hull resistance and optional shield piercing
 * @param {number} targetUserId - Target player's user ID
 * @param {Object} damage - { shieldDamage, hullDamage }
 * @param {string} damageType - 'kinetic', 'energy', or 'explosive' (for hull resistance)
 * @param {number} shieldPiercing - Fraction of damage that bypasses shields (0-1, default 0)
 * @returns {Object|null} Result with new shield/hull values, or null if player not found
 */
function applyDamage(targetUserId, damage, damageType = 'kinetic', shieldPiercing = 0) {
  const ship = statements.getShipByUserId.get(targetUserId);
  if (!ship) return null;

  // CRITICAL: Don't apply damage to dead players (hull <= 0)
  // This prevents multiple death events from stacking damage
  if (ship.hull_hp <= 0) {
    return null;
  }

  let { shieldDamage, hullDamage } = damage;
  let newShield = ship.shield_hp;
  let newHull = ship.hull_hp;
  const hadShields = newShield > 0;

  // Get hull resistance based on hull tier
  const hullTier = ship.hull_tier || 1;
  const resistances = getHullResistances(hullTier);
  const resistance = Math.min(resistances[damageType] || 0, config.HULL.RESISTANCE_CAP);

  // Record damage time for shield recharge delay
  shieldDelays.set(targetUserId, Date.now());

  // Calculate shield piercing damage (portion that bypasses shields entirely)
  let piercingDamage = 0;
  let shieldPierced = false;
  if (shieldPiercing > 0 && newShield > 0) {
    // Calculate total incoming damage and extract piercing portion
    const totalDamage = shieldDamage + hullDamage;
    piercingDamage = totalDamage * shieldPiercing;
    // Reduce the damage that goes through normal shield absorption
    shieldDamage = shieldDamage * (1 - shieldPiercing);
    hullDamage = hullDamage * (1 - shieldPiercing);
    shieldPierced = true;
  }

  // Apply damage to shield first (after piercing portion extracted)
  if (newShield > 0) {
    if (shieldDamage <= newShield) {
      newShield -= shieldDamage;
      shieldDamage = 0;
    } else {
      shieldDamage -= newShield;
      newShield = 0;
    }
  }

  // Calculate hull damage:
  // - Piercing damage always goes directly to hull
  // - Shield overflow (shieldDamage after absorption) always goes to hull
  // - hullDamage only applies if shields broke during this hit (not if they were already down)
  let totalHullDamage = piercingDamage + shieldDamage; // Piercing + overflow from shields
  if (hadShields && newShield <= 0) {
    // Shields broke this hit - apply hull damage component too
    totalHullDamage += hullDamage;
  } else if (!hadShields) {
    // Shields were already down - just use hullDamage (shieldDamage would double-count)
    totalHullDamage = hullDamage + piercingDamage;
  }

  // Apply hull resistance to reduce damage
  if (totalHullDamage > 0 && resistance > 0) {
    const resistedAmount = totalHullDamage * resistance;
    totalHullDamage = totalHullDamage - resistedAmount;
  }

  if (totalHullDamage > 0) {
    newHull = Math.max(0, newHull - totalHullDamage);
  }

  // Update database
  statements.updateShipHealth.run(Math.floor(newHull), Math.floor(newShield), targetUserId);

  const isDead = newHull <= 0;

  return {
    shield: Math.floor(newShield),
    hull: Math.floor(newHull),
    isDead,
    hitShield: hadShields, // True if shields absorbed any damage
    resistedDamage: resistance > 0 ? Math.floor(totalHullDamage * resistance / (1 - resistance)) : 0,
    shieldPierced, // True if damage bypassed shields via piercing
    piercingDamage: Math.floor(piercingDamage) // Amount that went directly to hull
  };
}

/**
 * Build respawn options for player death UI
 * @param {number} userId - Player's user ID
 * @param {Object} deathPosition - Where the player died
 * @returns {Object} Respawn options for the client
 */
function buildRespawnOptions(userId, deathPosition) {
  const ship = statements.getShipByUserId.get(userId);

  // Deep space is always available
  const options = {
    deepSpace: { available: true },
    lastSafe: {
      available: ship && ship.last_safe_x !== null && ship.last_safe_x !== undefined,
      position: ship && ship.last_safe_x !== null ? { x: ship.last_safe_x, y: ship.last_safe_y } : null
    },
    factionBases: [] // Could be populated with discovered friendly bases in future
  };

  return options;
}

/**
 * Handle player death - calculate dropped cargo and spawn wreckage
 * Does NOT respawn immediately - waits for player to select respawn location
 * @param {number} userId - Player's user ID
 * @param {Object} deathPosition - { x, y } position where player died (for wreckage)
 * @returns {Object} Death result with droppedCargo, wreckageContents, respawnOptions, deathPosition
 */
function handleDeath(userId, deathPosition = null) {
  const ship = statements.getShipByUserId.get(userId);
  const inventory = statements.getInventory.all(userId);

  // Calculate cargo to drop (50% of inventory)
  const droppedCargo = [];
  for (const item of inventory) {
    const dropAmount = Math.floor(item.quantity * config.DEATH_CARGO_DROP_PERCENT);
    if (dropAmount > 0) {
      droppedCargo.push({
        resource_type: item.resource_type,
        quantity: dropAmount
      });

      // Remove from inventory (death cargo drop)
      const newQuantity = item.quantity - dropAmount;
      logger.log(`[INVENTORY] User ${userId} ${item.resource_type}: ${item.quantity} -> ${newQuantity} (death cargo drop -${dropAmount})`);
      if (newQuantity <= 0) {
        statements.removeInventoryItem.run(userId, item.resource_type);
      } else {
        statements.setInventoryQuantity.run(newQuantity, userId, item.resource_type);
      }
    }
  }

  // Calculate wreckage contents (50% of dropped cargo = 25% of original inventory)
  // This is what goes into the wreckage for other players/Scavengers to collect
  const wreckageContents = [];
  for (const item of droppedCargo) {
    const wreckageAmount = Math.floor(item.quantity * 0.5); // Half of dropped goes to wreckage
    if (wreckageAmount > 0) {
      wreckageContents.push({
        type: 'resource',
        resourceType: item.resource_type.toUpperCase(),
        quantity: wreckageAmount,
        rarity: 'common'  // Default rarity for player cargo
      });
    }
  }

  // Build respawn options for player to choose from
  const respawnOptions = buildRespawnOptions(userId, deathPosition);

  // NOTE: We no longer respawn immediately - wait for player selection via respawn:select event

  return {
    droppedCargo,
    wreckageContents, // For spawning wreckage
    respawnOptions,   // Options for player to choose from
    deathPosition: deathPosition || { x: ship?.x || 0, y: ship?.y || 0 },
    playerName: ship?.username || 'Unknown'
  };
}

/**
 * Apply respawn after player selects location
 * @param {number} userId - Player's user ID
 * @param {string} respawnType - 'deep_space' | 'last_safe' | 'faction_base'
 * @param {string|null} targetId - Optional base ID for faction_base respawn
 * @returns {Object} Respawn result with position and location name
 */
function applyRespawn(userId, respawnType = 'deep_space', targetId = null) {
  const ship = statements.getShipByUserId.get(userId);
  let respawnPosition;
  let locationName = 'Deep Space';

  switch (respawnType) {
    case 'deep_space':
      respawnPosition = world.findDeepSpaceSpawnLocation();
      locationName = 'Deep Space';
      break;

    case 'last_safe':
      if (ship && ship.last_safe_x !== null && ship.last_safe_x !== undefined) {
        respawnPosition = { x: ship.last_safe_x, y: ship.last_safe_y };
        locationName = 'Last Safe Location';
      } else {
        // Fallback to deep space if no last safe location
        respawnPosition = world.findDeepSpaceSpawnLocation();
        locationName = 'Deep Space';
      }
      break;

    case 'faction_base':
      // Future: lookup base position from targetId
      // For now, fallback to deep space
      respawnPosition = world.findDeepSpaceSpawnLocation();
      locationName = 'Deep Space';
      break;

    default:
      respawnPosition = world.findDeepSpaceSpawnLocation();
      locationName = 'Deep Space';
  }

  // Apply the respawn to database
  statements.respawnShip.run(respawnPosition.x, respawnPosition.y, userId);

  return {
    position: respawnPosition,
    locationName,
    hull: ship?.hull_max || config.DEFAULT_HULL_HP,
    shield: ship?.shield_max || config.DEFAULT_SHIELD_HP
  };
}

/**
 * Update shield recharge for a player with energy core bonus
 * @param {number} userId - Player's user ID
 * @param {number} deltaTime - Time since last update in milliseconds
 * @param {number} energyCoreTier - Energy core tier (1-5) for bonus regen
 * @returns {Object|null} New shield value, or null if no change
 */
function updateShieldRecharge(userId, deltaTime, energyCoreTier = null) {
  const lastDamage = shieldDelays.get(userId) || 0;
  const timeSinceDamage = Date.now() - lastDamage;

  if (timeSinceDamage < config.SHIELD_RECHARGE_DELAY) {
    return null; // Still in recharge delay
  }

  const ship = statements.getShipByUserId.get(userId);
  if (!ship || ship.shield_hp >= ship.shield_max) {
    return null; // Already full
  }

  // Get energy core tier from ship if not provided
  const coreTier = energyCoreTier !== null ? energyCoreTier : (ship.energy_core_tier || 1);

  // Calculate recharge rate with energy core bonus
  const baseRate = config.SHIELD_RECHARGE_RATE;
  const bonusRate = config.ENERGY_CORE.SHIELD_REGEN_BONUS[coreTier] || 0;
  const effectiveRate = baseRate + bonusRate;

  const rechargeAmount = effectiveRate * (deltaTime / 1000);
  const newShield = Math.min(ship.shield_max, ship.shield_hp + rechargeAmount);

  statements.updateShipHealth.run(ship.hull_hp, Math.floor(newShield), userId);

  return { shield: Math.floor(newShield) };
}

function getWeaponRange(weaponTier) {
  // Use per-tier weapon ranges that match client visual projectile distance
  if (config.WEAPON_RANGES && config.WEAPON_RANGES[weaponTier]) {
    return config.WEAPON_RANGES[weaponTier];
  }
  // Fallback to legacy formula
  return config.BASE_WEAPON_RANGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
}

module.exports = {
  canFire,
  fire,
  calculateDamage,
  checkHit,
  applyDamage,
  handleDeath,
  applyRespawn,
  buildRespawnOptions,
  updateShieldRecharge,
  getWeaponRange,
  getHullResistances,
  getEffectiveCooldown
};
