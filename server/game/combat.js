// Galaxy Miner - Combat System (Server-side)

const config = require('../config');
const { statements } = require('../database');

// Track weapon cooldowns: playerId -> lastFireTime
const weaponCooldowns = new Map();

// Track shield recharge delay: playerId -> lastDamageTime
const shieldDelays = new Map();

function canFire(playerId, weaponTier) {
  const lastFire = weaponCooldowns.get(playerId) || 0;
  const cooldown = config.BASE_WEAPON_COOLDOWN / Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
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

  const effectiveRange = weaponRange * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);

  // Simple distance check (could add projectile travel time later)
  return distance <= effectiveRange + targetSize;
}

function applyDamage(targetUserId, damage) {
  const ship = statements.getShipByUserId.get(targetUserId);
  if (!ship) return null;

  let { shieldDamage, hullDamage } = damage;
  let newShield = ship.shield_hp;
  let newHull = ship.hull_hp;
  const hadShields = newShield > 0;

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
    hitShield: hadShields // True if shields absorbed any damage
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

      // Remove from inventory
      const newQuantity = item.quantity - dropAmount;
      if (newQuantity <= 0) {
        statements.removeInventoryItem.run(userId, item.resource_type);
      } else {
        statements.setInventoryQuantity.run(newQuantity, userId, item.resource_type);
      }
    }
  }

  // Random respawn position (near origin for simplicity)
  const respawnX = (Math.random() - 0.5) * config.SECTOR_SIZE * 2;
  const respawnY = (Math.random() - 0.5) * config.SECTOR_SIZE * 2;

  // Respawn ship
  statements.respawnShip.run(respawnX, respawnY, userId);

  return {
    droppedCargo,
    respawnPosition: { x: respawnX, y: respawnY }
  };
}

function updateShieldRecharge(userId, deltaTime) {
  const lastDamage = shieldDelays.get(userId) || 0;
  const timeSinceDamage = Date.now() - lastDamage;

  if (timeSinceDamage < config.SHIELD_RECHARGE_DELAY) {
    return null; // Still in recharge delay
  }

  const ship = statements.getShipByUserId.get(userId);
  if (!ship || ship.shield_hp >= ship.shield_max) {
    return null; // Already full
  }

  const rechargeAmount = config.SHIELD_RECHARGE_RATE * (deltaTime / 1000);
  const newShield = Math.min(ship.shield_max, ship.shield_hp + rechargeAmount);

  statements.updateShipHealth.run(ship.hull_hp, Math.floor(newShield), userId);

  return { shield: Math.floor(newShield) };
}

function getWeaponRange(weaponTier) {
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
  getWeaponRange
};
