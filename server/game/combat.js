// Galaxy Miner - Combat System (Server-side)

const config = require('../config');
const { statements } = require('../database');
const world = require('../world');

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
 * Apply damage to a player with hull resistance
 * @param {number} targetUserId - Target player's user ID
 * @param {Object} damage - { shieldDamage, hullDamage }
 * @param {string} damageType - 'kinetic', 'energy', or 'explosive' (for hull resistance)
 * @returns {Object|null} Result with new shield/hull values, or null if player not found
 */
function applyDamage(targetUserId, damage, damageType = 'kinetic') {
  const ship = statements.getShipByUserId.get(targetUserId);
  if (!ship) return null;

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

  // Apply damage to shield first
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
  // - Shield overflow (shieldDamage after absorption) always goes to hull
  // - hullDamage only applies if shields broke during this hit (not if they were already down)
  let totalHullDamage = shieldDamage; // Overflow from shields
  if (hadShields && newShield <= 0) {
    // Shields broke this hit - apply hull damage component too
    totalHullDamage += hullDamage;
  } else if (!hadShields) {
    // Shields were already down - just use hullDamage (shieldDamage would double-count)
    totalHullDamage = hullDamage;
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
    resistedDamage: resistance > 0 ? Math.floor(totalHullDamage * resistance / (1 - resistance)) : 0
  };
}

function handleDeath(userId) {
  const ship = statements.getShipByUserId.get(userId);
  const inventory = statements.getInventory.all(userId);

  // Calculate cargo to drop
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
      console.log(`[INVENTORY] User ${userId} ${item.resource_type}: ${item.quantity} -> ${newQuantity} (death cargo drop -${dropAmount})`);
      if (newQuantity <= 0) {
        statements.removeInventoryItem.run(userId, item.resource_type);
      } else {
        statements.setInventoryQuantity.run(newQuantity, userId, item.resource_type);
      }
    }
  }

  // Find safe respawn position (away from stars)
  const safePos = world.findSafeSpawnLocation(0, 0, 5000);

  // Respawn ship
  statements.respawnShip.run(safePos.x, safePos.y, userId);

  return {
    droppedCargo,
    respawnPosition: safePos
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
  updateShieldRecharge,
  getWeaponRange,
  getHullResistances,
  getEffectiveCooldown
};
