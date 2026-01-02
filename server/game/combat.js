// Galaxy Miner - Combat System (Server-side)

const config = require('../config');
const { statements } = require('../database');
const world = require('../world');
const logger = require('../../shared/logger');
const npc = require('./npc');
const loot = require('./loot');
const Constants = require('../../shared/constants');

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
 * All players respawn in The Graveyard safe zone (near origin)
 * Exception: Players with SWARM_HIVE_CORE relic respawn at nearest Swarm Hive
 * @param {number} userId - Player's user ID
 * @param {Object} deathPosition - Where the player died
 * @returns {Object} Respawn options for the client
 */
function buildRespawnOptions(userId, deathPosition) {
  // Check if player has Swarm Hive Core relic
  const hasHiveCore = statements.hasRelic.get(userId, 'SWARM_HIVE_CORE');

  if (hasHiveCore) {
    // Find nearest Swarm Hive
    const nearestHive = findNearestSwarmHive(deathPosition);

    if (nearestHive) {
      return {
        type: 'swarm_hive_core',
        hiveId: nearestHive.id,
        hivePosition: { x: nearestHive.x, y: nearestHive.y },
        message: 'Your consciousness is drawn to the nearest Swarm Hive...'
      };
    }
  }

  // Default: Respawn in The Graveyard (no choices - automatic)
  return {
    type: 'graveyard',
    message: 'Returning to The Graveyard...'
  };
}

/**
 * Find the nearest active Swarm Hive to a given position
 * @param {Object} position - { x, y } position to search from
 * @returns {Object|null} Nearest hive base or null if none exist
 */
function findNearestSwarmHive(position) {
  const activeBases = npc.getActiveBases();
  let nearestHive = null;
  let nearestDistance = Infinity;

  for (const [baseId, base] of activeBases) {
    // Check for swarm_hive type (both original and assimilated)
    if ((base.type === 'swarm_hive' || base.faction === 'swarm') && !base.destroyed) {
      const dx = base.x - position.x;
      const dy = base.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestHive = { id: baseId, ...base };
      }
    }
  }

  return nearestHive;
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
 * Apply respawn after player triggers respawn
 * All respawns go to The Graveyard unless player has Swarm Hive Core relic
 * @param {number} userId - Player's user ID
 * @param {string} respawnType - 'graveyard' | 'swarm_hive_core' (from buildRespawnOptions)
 * @param {string|null} targetId - Hive ID for swarm_hive_core respawn
 * @returns {Object} Respawn result with position, location name, and special effects
 */
function applyRespawn(userId, respawnType = 'graveyard', targetId = null) {
  const ship = statements.getShipByUserId.get(userId);
  let respawnPosition;
  let locationName = 'The Graveyard';
  let hiveDestructionResult = null;

  switch (respawnType) {
    case 'swarm_hive_core':
      // Respawn at Swarm Hive and destroy it
      if (targetId) {
        const base = npc.getActiveBase(targetId);
        if (base && !base.destroyed && (base.type === 'swarm_hive' || base.faction === 'swarm')) {
          // Respawn position is at the hive center
          respawnPosition = { x: base.x, y: base.y };
          locationName = 'Swarm Hive (Destroyed)';

          // Destroy the hive and kill nearby swarm NPCs
          hiveDestructionResult = destroyHiveWithAoE(targetId, base);

          logger.log(`[HIVE CORE RESPAWN] Player ${userId} respawning at hive ${targetId}, destroying it and ${hiveDestructionResult.killedNpcs.length} nearby Swarm NPCs`);
        } else {
          // Hive no longer exists, fall back to Graveyard
          respawnPosition = findGraveyardSpawnLocation();
          locationName = 'The Graveyard';
          logger.log(`[HIVE CORE RESPAWN] Hive ${targetId} not found, falling back to Graveyard for player ${userId}`);
        }
      } else {
        // No target specified, fall back to Graveyard
        respawnPosition = findGraveyardSpawnLocation();
        locationName = 'The Graveyard';
      }
      break;

    case 'graveyard':
    default:
      // All other respawns go to The Graveyard (near origin 0,0)
      respawnPosition = findGraveyardSpawnLocation();
      locationName = 'The Graveyard';
      break;
  }

  // Apply the respawn to database
  statements.respawnShip.run(respawnPosition.x, respawnPosition.y, userId);

  const result = {
    position: respawnPosition,
    locationName,
    hull: ship?.hull_max || config.DEFAULT_HULL_HP,
    shield: ship?.shield_max || config.DEFAULT_SHIELD_HP
  };

  // Include hive destruction info if applicable
  if (hiveDestructionResult) {
    result.hiveDestruction = hiveDestructionResult;
  }

  return result;
}

/**
 * Find a spawn location in The Graveyard safe zone (near origin)
 * @returns {Object} { x, y } spawn position in The Graveyard
 */
function findGraveyardSpawnLocation() {
  // The Graveyard is centered on origin (0,0) - sectors (-1,-1) to (1,1)
  // SECTOR_SIZE is typically 1000, so the zone is roughly -1500 to +1500
  // We spawn near the center with some randomization to avoid stacking
  const sectorSize = config.SECTOR_SIZE || 1000;
  const graveyardRadius = sectorSize * 0.5; // Stay within ~500 units of origin

  // Add random offset to avoid all players spawning on exact same spot
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * graveyardRadius;

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance
  };
}

/**
 * Destroy a Swarm Hive and kill all Swarm NPCs within 500 units
 * Called when a player with Swarm Hive Core relic respawns at the hive
 * @param {string} hiveId - The hive base ID
 * @param {Object} hiveBase - The hive base object
 * @returns {Object} Destruction result with killed NPCs and wreckage spawned
 */
function destroyHiveWithAoE(hiveId, hiveBase) {
  const HIVE_DESTRUCTION_RADIUS = Constants.RELIC_TYPES?.SWARM_HIVE_CORE?.effects?.hiveDestructionRadius || 500;
  const hivePosition = { x: hiveBase.x, y: hiveBase.y };

  // Get all Swarm NPCs within the destruction radius
  const nearbyNpcs = npc.getNPCsInRange(hivePosition, HIVE_DESTRUCTION_RADIUS);
  const swarmNpcs = nearbyNpcs.filter(npcData => npcData.faction === 'swarm');

  const killedNpcs = [];
  const spawnedWreckage = [];

  // Kill each Swarm NPC and spawn wreckage
  for (const swarmNpc of swarmNpcs) {
    // Get the full NPC entity for wreckage generation
    const npcEntity = npc.getNPC(swarmNpc.id);

    if (npcEntity) {
      // Spawn wreckage at NPC location (similar to engine.js NPC death handling)
      const wreckage = loot.spawnWreckage(
        npcEntity,
        { x: swarmNpc.position.x, y: swarmNpc.position.y },
        null, // Generate loot based on NPC type
        null  // No damage contributors for hive core AoE kill
      );

      if (wreckage) {
        spawnedWreckage.push({
          id: wreckage.id,
          position: wreckage.position,
          size: wreckage.size,
          faction: wreckage.faction,
          npcType: wreckage.npcType,
          npcName: wreckage.npcName,
          contents: wreckage.contents
        });
      }
    }

    // Remove the NPC
    npc.removeNPC(swarmNpc.id);

    killedNpcs.push({
      id: swarmNpc.id,
      type: swarmNpc.type,
      position: swarmNpc.position
    });
  }

  // Destroy the hive base itself
  npc.destroyBase(hiveId);

  return {
    hiveId,
    hivePosition,
    killedNpcs,
    spawnedWreckage,
    destructionRadius: HIVE_DESTRUCTION_RADIUS
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
  getEffectiveCooldown,
  // Graveyard respawn helpers
  findGraveyardSpawnLocation,
  findNearestSwarmHive,
  destroyHiveWithAoE
};
