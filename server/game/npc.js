// Galaxy Miner - NPC System (Server-side)

const config = require('../config');
const world = require('../world');
const combat = require('./combat');
const ai = require('./ai');
const logger = require('../../shared/logger');
const LootPools = require('./loot-pools');
const CONSTANTS = require('../../shared/constants');
const { isGraveyardSector: isGraveyardSectorFn, isInGraveyard: isInGraveyardFn, isInSwarmExclusionWorld: isInSwarmExclusionWorldFn } = require('../../shared/graveyard');
const SpatialHash = require('./spatial-hash');

// Spatial hash for efficient NPC range queries (200 unit cells for ~weapon range)
const npcSpatialHash = new SpatialHash(200);

// NPC types with faction, weapon, and tier info
const NPC_TYPES = {
  // === PIRATES (Pirate AI with role-specific behaviors) ===
  // All pirates have shield-piercing weapons (10% damage bypasses shields)
  pirate_scout: {
    name: 'Pirate Scout',
    faction: 'pirate',
    hull: 40,
    shield: 20,
    speed: 130,          // Fast for espionage/fleeing
    weaponType: 'pirate_light_blaster',
    weaponTier: 1,
    weaponDamage: 5,
    weaponRange: 200,
    aggroRange: 500,     // Extended for spotting targets
    creditReward: 30,
    deathEffect: 'explosion',
    shieldPiercing: 0.1  // 10% damage bypasses shields
  },
  pirate_fighter: {
    name: 'Pirate Fighter',
    faction: 'pirate',
    hull: 100,
    shield: 50,
    speed: 110,          // Fast for boost dive attacks
    weaponType: 'pirate_heavy_blaster',
    weaponTier: 2,
    weaponDamage: 12,    // Increased for burst damage
    weaponRange: 280,
    aggroRange: 500,
    creditReward: 80,
    deathEffect: 'explosion',
    shieldPiercing: 0.1  // 10% damage bypasses shields
  },
  pirate_captain: {
    name: 'Pirate Captain',
    faction: 'pirate',
    hull: 200,
    shield: 100,
    speed: 90,           // Moderate speed
    weaponType: 'pirate_heavy_blaster',
    weaponTier: 3,
    weaponDamage: 22,    // Higher damage for close-range engagement
    weaponRange: 300,
    aggroRange: 600,
    creditReward: 220,
    deathEffect: 'explosion',
    shieldPiercing: 0.1  // 10% damage bypasses shields
  },
  pirate_dreadnought: {
    name: 'Pirate Dreadnought',
    faction: 'pirate',
    hull: 600,           // Increased - no shields, special hull
    shield: 0,           // No shields - relies on invulnerability proc
    speed: 180,          // Extremely fast
    weaponType: 'pirate_cannon',
    weaponTier: 4,
    weaponDamage: 65,    // Increased damage
    weaponRange: 1400,   // 300% increase (was 350) - massive cannon range
    aggroRange: 1500,    // Extended aggro range to match weapon range
    creditReward: 800,   // Tier: boss
    deathEffect: 'explosion',
    isBoss: true,
    invulnerableChance: 0.35,  // 35% chance to negate all damage
    shieldPiercing: 0.1        // 10% damage bypasses shields
  },

  // === SCAVENGERS (Retreat AI, Retreat at 20%) ===
  // Scavengers have no shields - they rely on retreat behavior and hull only
  scavenger_scrapper: {
    name: 'Scavenger Scrapper',
    faction: 'scavenger',
    hull: 40,
    shield: 0,
    speed: 90,
    weaponType: 'energy',
    weaponTier: 1,
    weaponDamage: 4,
    weaponRange: 180,
    aggroRange: 300,
    creditReward: 20,  // Tier: low (was 15)
    deathEffect: 'break_apart'
  },
  scavenger_salvager: {
    name: 'Scavenger Salvager',
    faction: 'scavenger',
    hull: 70,
    shield: 0,
    speed: 80,
    weaponType: 'energy',
    weaponTier: 1,
    weaponDamage: 6,
    weaponRange: 200,
    aggroRange: 350,
    creditReward: 45,  // Tier: low (was 40)
    deathEffect: 'break_apart'
  },
  scavenger_collector: {
    name: 'Scavenger Collector',
    faction: 'scavenger',
    hull: 100,
    shield: 0,
    speed: 70,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 8,
    weaponRange: 220,
    aggroRange: 400,
    creditReward: 90,  // Tier: mid (was 80)
    deathEffect: 'break_apart'
  },
  scavenger_hauler: {
    name: 'Scavenger Hauler',
    faction: 'scavenger',
    hull: 180,
    shield: 0,
    speed: 50,
    weaponType: 'energy',  // Uses loader_slam melee weapon (defined in AI)
    weaponTier: 3,
    weaponDamage: 50,  // Melee damage (40-60 range)
    weaponRange: 35,   // Melee range
    aggroRange: 450,
    creditReward: 180,  // Tier: high (was 150) - NOT boss, they flee
    deathEffect: 'deconstruction',
    sizeMultiplier: 1.8  // 80% larger than base scavenger
  },
  scavenger_barnacle_king: {
    name: 'Barnacle King',
    faction: 'scavenger',
    hull: 25000,
    shield: 0,
    speed: 15,
    size: 200,
    weaponType: 'boring_drill',
    weaponDamage: 99999, // instant kill
    weaponRange: 50,
    weaponTier: 5,
    aggroRange: 600,
    creditReward: 5000,
    deathEffect: 'deconstruction',
    isBoss: true
  },

  // === THE SWARM (Swarm AI, Never Retreat, Linked Health) ===
  // All swarm units have +162.5% hull/shield (75% + 50% = 162.5% from baseline)
  swarm_drone: {
    name: 'Swarm Drone',
    faction: 'swarm',
    hull: 53,      // +50% (was 35, baseline 20)
    shield: 0,
    speed: 150,
    weaponType: 'explosive',
    weaponTier: 1,
    weaponDamage: 3,
    weaponRange: 150,
    aggroRange: 500,
    creditReward: 12,
    deathEffect: 'dissolve',
    linkedHealth: true
  },
  swarm_worker: {
    name: 'Swarm Worker',
    faction: 'swarm',
    hull: 92,      // +50% (was 61, baseline 35)
    shield: 0,
    speed: 130,
    weaponType: 'explosive',
    weaponTier: 1,
    weaponDamage: 5,
    weaponRange: 180,
    aggroRange: 550,
    creditReward: 28,
    deathEffect: 'dissolve',
    linkedHealth: true
  },
  swarm_warrior: {
    name: 'Swarm Warrior',
    faction: 'swarm',
    hull: 158,     // +50% (was 105, baseline 60)
    shield: 39,    // +50% (was 26, baseline 15)
    speed: 110,
    weaponType: 'explosive',
    weaponTier: 2,
    weaponDamage: 10,
    weaponRange: 220,
    aggroRange: 600,
    creditReward: 70,
    deathEffect: 'dissolve',
    linkedHealth: true
  },
  swarm_queen: {
    name: 'Swarm Queen',
    faction: 'swarm',
    hull: 788,     // +50% (was 525, baseline 300) - BOSS TIER
    shield: 263,   // +50% (was 175, baseline 100)
    speed: 80,     // Base speed (was 40) - phase modifiers apply (80-200 u/s)
    weaponType: 'explosive',
    weaponTier: 4,
    weaponDamage: 37,
    weaponRange: 300,
    aggroRange: 800,
    creditReward: 800,
    deathEffect: 'dissolve',
    isBoss: true,
    spawnsUnits: true,
    linkedHealthMaster: true
  },

  // === VOID ENTITIES (Formation AI, Retreat at 30%) ===
  // Health increased by 150% (x2.5) to make void faction more challenging
  void_whisper: {
    name: 'Void Whisper',
    faction: 'void',
    hull: 60,            // Nerfed for early game accessibility
    shield: 40,          // Nerfed for early game accessibility
    speed: 140,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 5,     // Nerfed from 7
    weaponRange: 250,
    aggroRange: 450,
    creditReward: 60,    // Increased reward for difficulty
    deathEffect: 'implode'
  },
  void_shadow: {
    name: 'Void Shadow',
    faction: 'void',
    hull: 120,           // Nerfed for early game accessibility
    shield: 80,          // Nerfed for early game accessibility
    speed: 120,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 9,     // Nerfed from 12
    weaponRange: 280,
    aggroRange: 500,
    creditReward: 150,   // Increased reward for difficulty
    deathEffect: 'implode'
  },
  void_phantom: {
    name: 'Void Phantom',
    faction: 'void',
    hull: 200,           // Nerfed for early game accessibility
    shield: 150,         // Nerfed for early game accessibility
    speed: 100,
    weaponType: 'energy',
    weaponTier: 3,
    weaponDamage: 15,    // Nerfed from 18
    weaponRange: 320,
    aggroRange: 550,
    creditReward: 300,   // Increased reward for difficulty
    deathEffect: 'implode'
  },
  void_leviathan: {
    name: 'Void Leviathan',
    faction: 'void',
    hull: 1500,          // 3x base (was 500)
    shield: 900,         // 3x base (was 300)
    speed: 50,
    weaponType: 'energy',
    weaponTier: 5,
    weaponDamage: 60,
    weaponRange: 400,
    aggroRange: 800,
    creditReward: 2500,  // Increased for difficulty (was 1200)
    deathEffect: 'void_leviathan_death',  // Special death sequence
    isBoss: true,
    formationLeader: true,
    // Leviathan boss abilities
    hasGravityWell: true,
    canConsume: true,
    spawnsMinions: true
  },

  // === ROGUE MINERS (Mining AI, Retreat at 50%) ===
  rogue_prospector: {
    name: 'Rogue Prospector',
    faction: 'rogue_miner',
    hull: 60,
    shield: 300,  // Heavy shields (was 150, orig 30)
    speed: 100,
    weaponType: 'energy',
    weaponTier: 1,
    weaponDamage: 6,
    weaponRange: 200,
    aggroRange: 350,
    creditReward: 35,  // Tier: low
    deathEffect: 'industrial_explosion',
    territorial: true
  },
  rogue_driller: {
    name: 'Rogue Driller',
    faction: 'rogue_miner',
    hull: 90,
    shield: 450,  // Heavy shields (was 225, orig 45)
    speed: 85,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 10,
    weaponRange: 230,
    aggroRange: 400,
    creditReward: 75,  // Tier: mid
    deathEffect: 'industrial_explosion',
    territorial: true
  },
  rogue_excavator: {
    name: 'Rogue Excavator',
    faction: 'rogue_miner',
    hull: 140,
    shield: 875,  // Heavy shields (+25%, was 700)
    speed: 70,
    weaponType: 'energy',
    weaponTier: 3,
    weaponDamage: 20,  // Buffed +25% (was 16)
    weaponRange: 270,
    aggroRange: 450,
    creditReward: 160,  // Tier: high
    deathEffect: 'industrial_explosion',
    territorial: true
  },
  rogue_foreman: {
    name: 'Rogue Foreman',
    faction: 'rogue_miner',
    hull: 250,
    shield: 1200,  // Heavy shields (was 600, orig 120)
    speed: 55,
    weaponType: 'energy',
    weaponTier: 4,
    weaponDamage: 42,  // Buffed +50% (was 28)
    weaponRange: 320,
    aggroRange: 550,
    creditReward: 450,  // Tier: boss
    deathEffect: 'industrial_explosion',
    isBoss: true,
    territorial: true,
    defenderBonus: true
  }
};

// Properties outside the common movement/combat schema must survive every
// production spawn path. Keeping this list centralized prevents faction
// mechanics from silently disappearing when a new factory is added.
const NPC_TEMPLATE_SPECIAL_FIELDS = Object.freeze([
  'deathEffect',
  'linkedHealth',
  'linkedHealthMaster',
  'spawnsUnits',
  'spawnsMinions',
  'isBoss',
  'size',
  'sizeMultiplier',
  'shieldPiercing',
  'invulnerableChance',
  'formationLeader',
  'hasGravityWell',
  'canConsume',
  'territorial',
  'defenderBonus'
]);

function copyNpcTemplateSpecialFields(template) {
  const fields = {};
  for (const field of NPC_TEMPLATE_SPECIAL_FIELDS) {
    if (template?.[field] !== undefined) fields[field] = template[field];
  }
  return fields;
}

// Active NPCs: npcId -> npcData
const activeNPCs = new Map();
let npcIdCounter = 0;

// Spawn points by sector (generated on demand)
const sectorSpawnPoints = new Map();

// Track dead spawn points with respawn timers
// Key: "x_y" (spawn point coords), Value: { respawnAt: timestamp }
const deadSpawnPoints = new Map();

// Respawn delay for sector-based NPCs (5 minutes)
const SECTOR_NPC_RESPAWN_DELAY = 300000;

// Orphan NPC rage mode duration (90 seconds) - NPCs become aggressive then despawn
const ORPHAN_RAGE_DURATION = 90000;

// Damage multiplier for enraged orphaned NPCs
const ORPHAN_RAGE_DAMAGE_MULTIPLIER = 1.25;

// Aggro range multiplier for enraged orphaned NPCs
const ORPHAN_RAGE_AGGRO_MULTIPLIER = 1.5;

// Active bases: baseId -> baseData (runtime tracking)
const activeBases = new Map();
// Bases outside every player's activation range retain authoritative economy
// and damage state here without keeping their NPC populations in the tick loop.
const dormantBases = new Map();

// ============================================
// FORMATION TRACKING (Void faction leader succession)
// ============================================

// Formation registry: formationId -> { leaderId, memberIds: Set, lastLeaderId }
const formations = new Map();

// Reverse lookup for O(1) formation queries: npcId -> formationId
const npcToFormation = new Map();

// Tier scores for succession priority (higher = more likely to become leader)
const SUCCESSION_TIER_SCORES = {
  void_phantom: 3,
  void_shadow: 2,
  void_whisper: 1
};

// ============================================
// SWARM ASSIMILATION SYSTEM
// ============================================

// Assimilation progress tracking: baseId -> { progress, attachedDrones: Set }
const assimilationProgress = new Map();

// Assimilated bases: baseId -> { originalType, originalFaction, sectorKey, assimilatedAt }
const assimilatedBases = new Map();

// Sector assimilation count: "sectorX_sectorY" -> count
const sectorAssimilationCount = new Map();

// Active swarm queen reference (server-wide singleton)
let activeQueen = null;
let lastQueenSpawnTime = 0;

// Void Leviathan tracking
let activeLeviathan = null;
let lastLeviathanSpawnTime = 0;
let leviathanSpawnPending = false;
let lastQueenAuraBroadcast = 0;

/**
 * Get sector key for a position
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @returns {string} Sector key like "5_-3"
 */
function getSectorKey(x, y) {
  const sectorX = Math.floor(x / CONSTANTS.SECTOR_SIZE);
  const sectorY = Math.floor(y / CONSTANTS.SECTOR_SIZE);
  return `${sectorX}_${sectorY}`;
}

/**
 * Check if a position is within The Graveyard safe zone
 * The Graveyard is a 3x3 sector area at origin (sectors -1,-1 to 1,1)
 * In this zone, hostile factions don't spawn bases and friendly NPCs are passive
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @returns {boolean} True if position is in Graveyard
 */
function isGraveyardSector(sectorX, sectorY) {
  return isGraveyardSectorFn(sectorX, sectorY, CONSTANTS);
}

/**
 * Check if world coordinates are within The Graveyard safe zone
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @returns {boolean} True if position is in The Graveyard
 */
function isInGraveyard(x, y) {
  return isInGraveyardFn(x, y, CONSTANTS);
}

/**
 * Check if world coordinates are within the Swarm exclusion zone
 * (within 10 sectors of origin - no swarm assimilation allowed)
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @returns {boolean} True if position is in the exclusion zone
 */
function isInSwarmExclusionZone(x, y) {
  return isInSwarmExclusionWorldFn(x, y, CONSTANTS);
}

/**
 * Check if an NPC should be passive (non-aggressive until attacked) based on location
 * NPCs in Graveyard zone from non-hostile factions become passive
 * @param {Object} npc - NPC object with position and faction
 * @returns {boolean} True if NPC should be passive
 */
function shouldBePassive(npc) {
  // Only scavengers and rogue miners are passive in Graveyard
  const passiveFactions = ['scavenger', 'rogue_miner'];
  if (!passiveFactions.includes(npc.faction)) return false;

  // Check if NPC is in Graveyard zone
  const x = npc.position ? npc.position.x : npc.x;
  const y = npc.position ? npc.position.y : npc.y;

  return isInGraveyard(x, y);
}

function isLiveAssimilationTarget(baseId, base) {
  if (!base || base.destroyed === true || base.isAssimilated === true ||
      base.faction === 'swarm' || assimilatedBases.has(baseId)) {
    return false;
  }

  const rawHealth = base.health ?? base.currentHull ?? base.hull;
  if (rawHealth !== undefined && rawHealth !== null) {
    const health = Number(rawHealth);
    if (!Number.isFinite(health) || health <= 0) return false;
  }

  return true;
}

/**
 * Find nearest non-swarm base for drone targeting
 * @param {Object} drone - Drone NPC object
 * @param {number} searchRange - Search radius
 * @returns {Object|null} Target base or null
 */
function findAssimilationTarget(drone, searchRange = CONSTANTS.SWARM_ASSIMILATION.SEARCH_RANGE) {
  let nearestBase = null;
  let nearestDist = Infinity;

  // Get drone position (support both position.x and x formats)
  const droneX = drone.position ? drone.position.x : drone.x;
  const droneY = drone.position ? drone.position.y : drone.y;

  for (const [baseId, base] of activeBases) {
    // A target may be destroyed or converted after the previous AI tick.
    if (!isLiveAssimilationTarget(baseId, base)) continue;

    const currentPos = world.getObjectPosition(baseId);
    const bx = currentPos ? currentPos.x : base.x;
    const by = currentPos ? currentPos.y : base.y;

    // Skip bases in swarm exclusion zone (within 10 sectors of origin)
    if (isInSwarmExclusionZone(bx, by)) continue;

    const dx = bx - droneX;
    const dy = by - droneY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < searchRange && dist < nearestDist) {
      nearestDist = dist;
      nearestBase = { ...base, id: baseId, x: bx, y: by, distance: dist };
    }
  }

  return nearestBase;
}

/**
 * Attach a drone to a base for assimilation (drone becomes a "worm" parasite)
 * Drones remain as targetable NPCs until killed or assimilation completes
 * @param {string} droneId - ID of drone attaching
 * @param {string} baseId - ID of target base
 * @returns {Object} Result with attachment info
 */
function attachDroneToBase(droneId, baseId) {
  const drone = activeNPCs.get(droneId);
  const base = activeBases.get(baseId);

  // Revalidate at the mutation boundary. Selection and attachment occur on
  // different ticks, so a zero-health wreck or newly converted hive must not
  // accumulate worms or trigger another conversion/Queen check.
  if (!drone || !isLiveAssimilationTarget(baseId, base)) {
    return { success: false, reason: 'invalid_target' };
  }

  const currentPos = world.getObjectPosition(baseId);
  const bx = currentPos ? currentPos.x : base.x;
  const by = currentPos ? currentPos.y : base.y;

  // Check if drone is already attached somewhere
  if (drone.attachedToBase) {
    return { success: false, reason: 'already_attached' };
  }

  // Initialize progress tracking if needed
  if (!assimilationProgress.has(baseId)) {
    assimilationProgress.set(baseId, {
      attachedDrones: new Set()
    });
  }

  const progress = assimilationProgress.get(baseId);

  // Attach the drone - it becomes a "worm" burrowing into the base
  drone.attachedToBase = baseId;
  drone.state = 'attached';
  drone.attachedAt = Date.now();
  // Position drone at base with small offset for visual variety
  const angle = progress.attachedDrones.size * (Math.PI * 2 / 3); // Spread around base
  const attachRadius = 30; // Distance from base center
  drone.attachmentOffset = {
    x: Math.cos(angle) * attachRadius,
    y: Math.sin(angle) * attachRadius
  };
  drone.position = {
    x: bx + drone.attachmentOffset.x,
    y: by + drone.attachmentOffset.y
  };
  drone.x = drone.position.x;
  drone.y = drone.position.y;

  progress.attachedDrones.add(droneId);
  logger.info(`[WORM_ATTACH] Drone ${droneId} attached to base ${baseId}. Total attached: ${progress.attachedDrones.size}`);

  const threshold = CONSTANTS.SWARM_ASSIMILATION.ASSIMILATION_THRESHOLD;
  const attachedCount = progress.attachedDrones.size;

  const result = {
    success: true,
    droneId,
    baseId,
    attachedCount,
    threshold,
    isComplete: attachedCount >= threshold,
    attachPosition: { x: drone.x, y: drone.y }
  };

  // Check if assimilation is complete (3+ drones attached simultaneously)
  if (result.isComplete) {
    const conversionResult = convertBaseToSwarm(baseId, base);
    result.conversion = conversionResult;

    // NOTE: Worms (attached drones) are NOT removed on assimilation completion.
    // They persist on the converted base until the base is destroyed.
    // Cleanup happens in damageBase() when the base is destroyed.
  }

  return result;
}

/**
 * Handle an attached drone being killed - reduces attachment count
 * @param {string} droneId - ID of killed drone
 * @param {Object|null} retainedDrone - Snapshot retained after active-map removal
 * @returns {Object|null} Update info or null if drone wasn't attached
 */
function detachDroneFromBase(droneId, retainedDrone = null) {
  const drone = activeNPCs.get(droneId) || retainedDrone;
  if (!drone || !drone.attachedToBase) {
    return null;
  }

  const baseId = drone.attachedToBase;
  const progress = assimilationProgress.get(baseId);

  if (progress) {
    progress.attachedDrones.delete(droneId);

    // If no drones remain, clear progress entirely
    if (progress.attachedDrones.size === 0) {
      assimilationProgress.delete(baseId);
    }

    return {
      baseId,
      remainingDrones: progress ? progress.attachedDrones.size : 0,
      threshold: CONSTANTS.SWARM_ASSIMILATION.ASSIMILATION_THRESHOLD
    };
  }

  return null;
}

/**
 * Get the attached drones for a specific base
 * @param {string} baseId - Base ID
 * @returns {Array} Array of attached drone IDs
 */
function getAttachedDrones(baseId) {
  const progress = assimilationProgress.get(baseId);
  if (!progress) return [];
  return Array.from(progress.attachedDrones);
}

/**
 * Check if an NPC is an attached assimilation drone
 * @param {string} npcId - NPC ID
 * @returns {boolean} True if attached
 */
function isAttachedDrone(npcId) {
  const npc = activeNPCs.get(npcId);
  return npc && npc.attachedToBase;
}

/**
 * Keep an attached worm at its original local offset from an orbital base.
 * The offset fallback supports worms attached before attachmentOffset existed.
 * @param {Object} drone - Active attached Swarm drone
 * @returns {boolean} Whether a live authoritative base position was applied
 */
function reanchorAttachedDrone(drone) {
  if (!drone?.attachedToBase || !drone.position) return false;

  const baseId = drone.attachedToBase;
  const base = activeBases.get(baseId) || dormantBases.get(baseId);
  if (!base || base.destroyed === true ||
      (Number.isFinite(base.health) && base.health <= 0)) {
    return false;
  }

  const currentPos = world.getObjectPosition(baseId);
  const bx = currentPos?.x ?? base.x;
  const by = currentPos?.y ?? base.y;
  if (!Number.isFinite(bx) || !Number.isFinite(by)) return false;

  let offset = drone.attachmentOffset;
  if (!Number.isFinite(offset?.x) || !Number.isFinite(offset?.y)) {
    offset = {
      x: drone.position.x - bx,
      y: drone.position.y - by
    };
    drone.attachmentOffset = offset;
  }

  drone.position.x = bx + offset.x;
  drone.position.y = by + offset.y;
  drone.x = drone.position.x;
  drone.y = drone.position.y;
  if (drone.id !== undefined && drone.id !== null) {
    npcSpatialHash.update(drone.id, drone.position.x, drone.position.y);
  }
  return true;
}

function createNpcConversionSnapshot(npcEntity, oldType, oldFaction) {
  return {
    id: npcEntity.id,
    npcId: npcEntity.id,
    oldType,
    oldFaction,
    type: npcEntity.type,
    newType: npcEntity.type,
    name: npcEntity.name,
    faction: npcEntity.faction,
    x: npcEntity.position.x,
    y: npcEntity.position.y,
    rotation: npcEntity.rotation,
    state: npcEntity.state,
    hull: npcEntity.hull,
    hullMax: npcEntity.hullMax,
    shield: npcEntity.shield,
    shieldMax: npcEntity.shieldMax,
    isBoss: npcEntity.isBoss === true,
    sizeMultiplier: npcEntity.sizeMultiplier || 1,
    phase: npcEntity.phase || null,
    vx: npcEntity.velocity?.x ?? npcEntity.vx ?? 0,
    vy: npcEntity.velocity?.y ?? npcEntity.vy ?? 0,
    collectingWreckagePos: null,
    miningTargetPos: null,
    formationLeader: false,
    isFormationLeader: false
  };
}

/**
 * Convert a base to swarm faction
 * @param {string} baseId - Base ID
 * @param {Object} base - Base data
 * @returns {Object} Conversion result with converted NPCs
 */
function convertBaseToSwarm(baseId, base) {
  const currentPos = world.getObjectPosition(baseId);
  const bx = currentPos ? currentPos.x : base.x;
  const by = currentPos ? currentPos.y : base.y;
  const sectorKey = getSectorKey(bx, by);

  // Store original info
  assimilatedBases.set(baseId, {
    originalType: base.type,
    originalFaction: base.faction,
    sectorKey,
    assimilatedAt: Date.now()
  });

  // Update sector count
  const currentCount = sectorAssimilationCount.get(sectorKey) || 0;
  sectorAssimilationCount.set(sectorKey, currentCount + 1);

  // Convert the base
  const assimilatedType = `assimilated_${base.type}`;
  base.faction = 'swarm';
  base.originalType = base.type;
  base.type = assimilatedType;
  base.isAssimilated = true;

  // Convert nearby NPCs from this base to swarm
  const convertedNpcs = [];
  for (const [npcId, npc] of activeNPCs) {
    if (npc.homeBaseId === baseId && npc.faction !== 'swarm') {
      const oldType = npc.type;
      const oldFaction = npc.faction;
      const newType = CONSTANTS.SWARM_CONVERSION_MAP[oldType];
      if (newType) {
        const converted = convertNpcToSwarm(npc, newType);
        if (converted) {
          convertedNpcs.push(createNpcConversionSnapshot(
            converted,
            oldType,
            oldFaction
          ));
        }
      }
    }
  }

  // Preserve attached drone IDs on the base before clearing assimilation progress
  // This ensures we can still clean them up when the base is destroyed
  const progress = assimilationProgress.get(baseId);
  if (progress && progress.attachedDrones && progress.attachedDrones.size > 0) {
    base.attachedDroneIds = Array.from(progress.attachedDrones);
    logger.info(`[WORM_CONVERSION] Storing ${base.attachedDroneIds.length} attached drone IDs on base ${baseId}: ${JSON.stringify(base.attachedDroneIds)}`);
  } else {
    logger.warn(`[WORM_CONVERSION] No attached drones found in assimilationProgress for base ${baseId}`);
  }

  // Clear assimilation progress
  assimilationProgress.delete(baseId);

  // Update base spawn config to swarm
  base.spawnConfig = BASE_NPC_SPAWNS.swarm_hive;

  // Initialize spawn state for the newly assimilated hive
  // Without this, the base won't spawn any NPCs after conversion
  base.lastSpawnTime = 0;  // Allow immediate spawning
  base.pendingRespawns = base.pendingRespawns || [];
  base.spawnedNPCs = base.spawnedNPCs || [];

  // Queue up initial spawns so the base starts spawning swarm NPCs
  const spawnConfig = BASE_NPC_SPAWNS.swarm_hive;
  const neededSpawns = Math.max(0, spawnConfig.initialSpawn - base.spawnedNPCs.length);
  for (let i = 0; i < neededSpawns; i++) {
    base.pendingRespawns.push({ respawnAt: Date.now() + (i * 500) }); // Stagger spawns by 500ms
  }

  // Check if queen should spawn (range-based: 3+ bases within 10,000 units)
  const queenCheck = checkQueenSpawnConditions({ x: bx, y: by });

  logger.info(`Base ${baseId} assimilated to swarm. Total assimilated bases: ${assimilatedBases.size}. Queen spawn: ${queenCheck?.shouldSpawn || false}`);

  // SPAWN QUEEN DIRECTLY HERE instead of relying on engine.js to do it
  // This ensures the queen spawns atomically with the base conversion
  let spawnedQueen = null;
  if (queenCheck?.shouldSpawn) {
    const spawnPos = queenCheck.spawnPosition || { x: bx, y: by };
    logger.info(`[NPC] Spawning queen directly from convertBaseToSwarm at (${Math.round(spawnPos.x)}, ${Math.round(spawnPos.y)})`);
    spawnedQueen = spawnSwarmQueen(spawnPos);
    if (spawnedQueen) {
      logger.info(`[NPC] Queen EGG successfully created: ${spawnedQueen.id}`);
    } else {
      logger.error(`[NPC] Queen spawn FAILED - spawnSwarmQueen returned null`);
    }
  }

  return {
    baseId,
    newType: assimilatedType,
    originalFaction: assimilatedBases.get(baseId).originalFaction,
    sectorKey,
    assimilatedCount: assimilatedBases.size,
    convertedNpcs,
    // Queen spawn info (for engine.js to broadcast)
    shouldSpawnQueen: queenCheck?.shouldSpawn || false,
    queenSpawnPosition: queenCheck?.spawnPosition || null,
    spawnedQueen: spawnedQueen // The actual queen object if spawned
  };
}

/**
 * Convert an NPC to swarm faction
 * @param {Object} npc - NPC to convert
 * @param {string} newType - New swarm NPC type
 * @returns {Object} Converted NPC data
 */
function convertNpcToSwarm(npc, newType) {
  const template = NPC_TYPES[newType];
  if (!template) return null;

  // Retire state owned by the old faction before changing the discriminator
  // used by canonical cleanup. Void formation conversion dissolves the whole
  // group because every defender of the assimilated base changes faction.
  cleanupFactionStrategyState(npc);
  detachFormationForFactionConversion(npc);

  const position = npc.position || { x: npc.x, y: npc.y };
  const oldVx = npc.velocity?.x ?? npc.vx ?? 0;
  const oldVy = npc.velocity?.y ?? npc.vy ?? 0;

  // Update to new type
  npc.type = newType;
  npc.name = template.name;
  npc.faction = 'swarm';
  npc.hull = template.hull;
  npc.hullMax = template.hull;
  npc.maxHull = template.hull;
  npc.shield = template.shield;
  npc.shieldMax = template.shield;
  npc.maxShield = template.shield;
  npc.speed = template.speed;
  npc.weaponType = template.weaponType;
  npc.weaponTier = template.weaponTier;
  npc.weaponDamage = template.weaponDamage;
  npc.weaponRange = template.weaponRange;
  npc.aggroRange = template.aggroRange;
  npc.creditReward = template.creditReward;
  for (const field of NPC_TEMPLATE_SPECIAL_FIELDS) delete npc[field];
  Object.assign(npc, copyNpcTemplateSpecialFields(template));

  // Begin the new faction lifecycle without stale raid, mining, collection,
  // boost, or formation presentation state from the converted entity.
  npc.state = 'patrol';
  npc.targetPlayer = null;
  npc.targetNPC = null;
  npc.collectingWreckagePos = null;
  npc.miningTargetPos = null;
  npc.phase = null;
  for (const field of [
    // Pirate raid/intel/boost state
    'raidTargetType',
    'raidTargetPos',
    'lastTargetSeenTime',
    'isRaidingBase',
    'raidBaseId',
    'raidBaseType',
    'raidBaseStaleSince',
    'ignoredIntelReportedAt',
    'activeIntelReportedAt',
    'lastRaidTarget',
    'lastIntelTarget',
    'circleAngle',
    'wanderTarget',
    'lastStealTime',
    'isBoosting',
    'boostDiveStart',
    'spawnStartTime',
    // Scavenger collection/cargo state
    'targetWreckage',
    'targetWreckageId',
    'collectionStartTime',
    'carriedWreckage',
    'drillCharging',
    'drillChargeStart',
    // Rogue Miner target/haul state. patrolTarget is shared by the two old
    // collection strategies, but is not part of Swarm patrol behavior.
    'miningTarget',
    'miningTargetId',
    'miningTargetSize',
    'miningTargetType',
    'miningTargetIsOrbital',
    'hasHaul',
    'patrolTarget',
    // Generic rage fields are read outside faction strategies. Retaining them
    // could despawn the converted unit or restore pre-conversion movement stats.
    'orphaned',
    'orphanedAt',
    'baseAggroRange',
    'rageMultiplier',
    'rageExpires',
    'originalAggroRange',
    'originalSpeed',
    // Void presentation/runtime state
    'riftPortal',
    'fromRift'
  ]) {
    delete npc[field];
  }

  // Keep authoritative position and velocity continuous across conversion.
  npc.position = position;
  npc.velocity = npc.velocity || { x: oldVx, y: oldVy };
  npc.velocity.x = oldVx;
  npc.velocity.y = oldVy;
  npc.x = position.x;
  npc.y = position.y;
  npc.vx = oldVx;
  npc.vy = oldVy;

  return npc;
}

/**
 * Check if queen spawn conditions are met
 * Uses range-based check (10,000 units) instead of sector-based
 * @param {Object} newBasePosition - Position of newly assimilated base { x, y }
 * @returns {Object|null} { shouldSpawn: true, spawnPosition, primaryHive } or null
 */
function checkQueenSpawnConditions(newBasePosition) {
  // Only one queen allowed server-wide
  if (getActiveQueen()) return null;

  // Check cooldown (1 hour between spawns)
  const cooldown = CONSTANTS.SWARM_QUEEN_SPAWN?.QUEEN_SPAWN_COOLDOWN || 3600000;
  if (Date.now() - lastQueenSpawnTime < cooldown) return null;

  // Find primary swarm hive (original swarm_hive type base)
  let primaryHive = null;
  let primaryHiveId = null;
  for (const [baseId, base] of activeBases) {
    if (base.type === 'swarm_hive' && !base.destroyed) {
      primaryHive = base;
      primaryHiveId = baseId;
      break;
    }
  }

  // If no primary hive, use the new base position
  let referencePoint;
  if (primaryHive) {
    const hivePos = world.getObjectPosition(primaryHiveId);
    referencePoint = hivePos || { x: primaryHive.x, y: primaryHive.y };
  } else {
    referencePoint = newBasePosition;
  }

  // Count assimilated bases within 10,000 units of reference point
  const QUEEN_TRIGGER_RANGE = 10000;
  let assimilatedCount = 0;

  for (const [baseId, info] of assimilatedBases) {
    const base = activeBases.get(baseId);
    if (!base) continue;

    const basePos = world.getObjectPosition(baseId);
    const dx = (basePos ? basePos.x : base.x) - referencePoint.x;
    const dy = (basePos ? basePos.y : base.y) - referencePoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= QUEEN_TRIGGER_RANGE) {
      assimilatedCount++;
    }
  }

  const required = CONSTANTS.SWARM_QUEEN_SPAWN?.ASSIMILATED_BASES_REQUIRED || 3;

  if (assimilatedCount >= required) {
    logger.info(`Queen spawn triggered: ${assimilatedCount} assimilated bases within ${QUEEN_TRIGGER_RANGE} units`);
    return {
      shouldSpawn: true,
      spawnPosition: referencePoint,
      primaryHive: primaryHive
    };
  }

  return null;
}

/**
 * Spawn the swarm queen as an EGG near assimilated bases
 * Queen starts in 'hatching' state and emerges after hatch duration
 * @param {Object} position - Spawn position { x, y }
 * @returns {Object} Queen NPC data (in egg/hatching state)
 */
function spawnSwarmQueen(position) {
  const queenType = NPC_TYPES.swarm_queen;
  const queenId = `swarm_queen_${Date.now()}`;

  // Spawn queen as egg with longer hatch time (4 seconds)
  const hatchDuration = CONSTANTS.SWARM_HATCHING?.QUEEN_HATCH_DURATION || 4000;

  const queen = {
    id: queenId,
    type: 'swarm_queen',
    name: queenType.name,
    faction: 'swarm',
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    rotation: 0,
    hull: queenType.hull,
    hullMax: queenType.hull,
    maxHull: queenType.hull,
    shield: queenType.shield,
    shieldMax: queenType.shield,
    maxShield: queenType.shield,
    speed: queenType.speed,
    weaponType: queenType.weaponType,
    weaponTier: queenType.weaponTier,
    weaponDamage: queenType.weaponDamage,
    weaponRange: queenType.weaponRange,
    aggroRange: queenType.aggroRange,
    creditReward: queenType.creditReward,
    ...copyNpcTemplateSpecialFields(queenType),
    lastFireTime: 0,
    // Start as hatching egg
    state: 'hatching',
    hatchTime: Date.now(),
    hatchDuration: hatchDuration,
    targetId: null,
    spawnedMinions: [],
    isBoss: true,
    isQueen: true,
    damageContributors: new Map()
  };

  activeNPCs.set(queenId, queen);
  npcSpatialHash.insert(queenId, queen.position.x, queen.position.y);
  activeQueen = queen;
  lastQueenSpawnTime = Date.now();

  logger.info(`Swarm Queen EGG spawned at (${Math.round(position.x)}, ${Math.round(position.y)}) - hatching in ${hatchDuration}ms`);

  return queen;
}

/**
 * Handle queen death - clear singleton and start cooldown
 * @param {string} queenId - Queen NPC ID
 */
function handleQueenDeath(queenId) {
  if (activeQueen && activeQueen.id === queenId) {
    logger.info('Swarm Queen destroyed. Cooldown started.');
    activeQueen = null;
    lastQueenSpawnTime = Date.now(); // Start cooldown from death
  }
}

// ==========================================
// VOID LEVIATHAN BOSS SPAWNING
// ==========================================

/**
 * Check if Void Leviathan should spawn after void NPC death
 * @param {Object} deadNPC - The void NPC that just died
 * @param {Object} position - Position where NPC died { x, y }
 * @returns {Object|null} Spawn data if triggered, null otherwise
 */
function checkLeviathanSpawn(deadNPC, position) {
  // Skip if dead NPC is already a leviathan
  if (deadNPC.type === 'void_leviathan') return null;

  // Skip if not void faction
  if (deadNPC.faction !== 'void') return null;

  const config = CONSTANTS.VOID_LEVIATHAN_SPAWN;
  if (!config) return null;

  // Check if already active or spawn pending
  if (activeLeviathan) return null;
  if (leviathanSpawnPending) return null;

  // Check cooldown
  if (Date.now() - lastLeviathanSpawnTime < config.SPAWN_COOLDOWN) return null;

  // Roll for spawn chance (5%)
  if (Math.random() > config.SPAWN_CHANCE) return null;

  leviathanSpawnPending = true;
  logger.info(`[VOID] Leviathan spawn triggered by death of ${deadNPC.type} at (${Math.round(position.x)}, ${Math.round(position.y)})`);

  return {
    spawnPosition: position,
    spawnSequence: true,
    sequenceDuration: config.SPAWN_SEQUENCE_DURATION
  };
}

/**
 * Spawn Void Leviathan with cinematic entrance
 * @param {Object} position - Spawn position { x, y }
 * @returns {Object} Leviathan NPC data
 */
function spawnVoidLeviathan(position) {
  const leviathanType = NPC_TYPES.void_leviathan;
  const leviathanId = `void_leviathan_${Date.now()}`;

  const leviathan = {
    id: leviathanId,
    type: 'void_leviathan',
    name: leviathanType.name,
    faction: 'void',
    position: { x: position.x, y: position.y },
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    rotation: 0,
    hull: leviathanType.hull,
    hullMax: leviathanType.hull,
    maxHull: leviathanType.hull,
    shield: leviathanType.shield,
    shieldMax: leviathanType.shield,
    maxShield: leviathanType.shield,
    speed: leviathanType.speed,
    weaponType: leviathanType.weaponType,
    weaponTier: leviathanType.weaponTier,
    weaponDamage: leviathanType.weaponDamage,
    weaponRange: leviathanType.weaponRange,
    aggroRange: leviathanType.aggroRange,
    creditReward: leviathanType.creditReward,
    deathEffect: leviathanType.deathEffect,
    lastFireTime: 0,
    state: 'spawning',  // Start in spawning state for cinematic
    spawnTime: Date.now(),
    spawnDuration: CONSTANTS.VOID_LEVIATHAN_SPAWN.SPAWN_SEQUENCE_DURATION,
    targetId: null,
    isBoss: true,
    isLeviathan: true,
    formationLeader: true,
    // Boss abilities
    hasGravityWell: true,
    canConsume: true,
    spawnsMinions: true,
    // Rift portal for retreat (massive chaotic rift)
    riftPortal: { x: position.x, y: position.y },
    // Damage tracking
    damageContributors: new Map()
  };

  activeNPCs.set(leviathanId, leviathan);
  npcSpatialHash.insert(leviathanId, leviathan.position.x, leviathan.position.y);
  activeLeviathan = leviathan;
  leviathanSpawnPending = false;
  lastLeviathanSpawnTime = Date.now();

  logger.info(`[VOID] Leviathan spawning at (${Math.round(position.x)}, ${Math.round(position.y)})`);

  return leviathan;
}

/**
 * Handle Leviathan death - clear singleton and start cooldown
 * @param {string} leviathanId - Leviathan NPC ID
 */
function handleLeviathanDeath(leviathanId) {
  if (activeLeviathan && activeLeviathan.id === leviathanId) {
    logger.info('[VOID] Leviathan destroyed. Cooldown started.');
    activeLeviathan = null;
    lastLeviathanSpawnTime = Date.now(); // Start cooldown from death
  }
}

/**
 * Get active Leviathan (if any)
 * @returns {Object|null} Active Leviathan or null
 */
function getActiveLeviathan() {
  return activeLeviathan;
}

/**
 * Clear the leviathan spawn pending flag (used when spawn is aborted)
 */
function clearLeviathanPending() {
  leviathanSpawnPending = false;
}

/**
 * Apply queen aura health regeneration to swarm/assimilated bases
 * @param {number} deltaTime - Time since last update in ms
 * @returns {Array} Affected bases with health changes
 */
function applyQueenAura(deltaTime) {
  if (!activeQueen) return [];

  const affectedBases = [];
  const auraRange = CONSTANTS.SWARM_QUEEN_SPAWN.QUEEN_AURA_RANGE;
  const regenPercent = CONSTANTS.SWARM_QUEEN_SPAWN.BASE_REGEN_PERCENT;
  const regenPerSecond = regenPercent * (deltaTime / 1000);
  const queenX = activeQueen.position?.x ?? activeQueen.x;
  const queenY = activeQueen.position?.y ?? activeQueen.y;

  if (!Number.isFinite(queenX) || !Number.isFinite(queenY) ||
      !Number.isFinite(regenPerSecond) || regenPerSecond <= 0) {
    return affectedBases;
  }

  for (const [baseId, base] of activeBases) {
    // Only affect swarm and assimilated bases
    if (base.destroyed) continue;
    if (base.faction !== 'swarm' && !assimilatedBases.has(baseId)) continue;

    // Orbital bases must regenerate at their current authoritative position,
    // not the procedural position captured when the sector was generated.
    const currentPos = world.getObjectPosition(baseId);
    const baseX = currentPos?.x ?? base.x;
    const baseY = currentPos?.y ?? base.y;
    if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) continue;

    const dx = baseX - queenX;
    const dy = baseY - queenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= auraRange) {
      const maxHealth = Number(base.maxHealth ?? base.maxHull ?? base.hullMax);
      const oldHealth = Number(base.health ?? base.currentHull ?? base.hull);
      if (!Number.isFinite(maxHealth) || maxHealth <= 0 ||
          !Number.isFinite(oldHealth) || oldHealth >= maxHealth) {
        continue;
      }

      const healAmount = maxHealth * regenPerSecond;
      const newHealth = Math.min(maxHealth, oldHealth + healAmount);

      // `health`/`maxHealth` are the canonical base-combat fields. Mirror the
      // legacy field only when it exists so older dormant snapshots remain
      // compatible without creating a second source of truth.
      base.health = newHealth;
      if (Object.prototype.hasOwnProperty.call(base, 'currentHull')) {
        base.currentHull = newHealth;
      }

      if (newHealth > oldHealth) {
        affectedBases.push({
          baseId,
          x: baseX,
          y: baseY,
          health: newHealth,
          maxHealth,
          healed: newHealth - oldHealth
        });
      }
    }
  }

  return affectedBases;
}

/**
 * Get all drones currently targeting bases for assimilation
 * @returns {Map} Map of droneId -> targetBaseId
 */
function getDronesAssimilating() {
  const drones = new Map();
  for (const [baseId, progress] of assimilationProgress) {
    for (const droneId of progress.attachedDrones) {
      drones.set(droneId, baseId);
    }
  }
  return drones;
}

/**
 * Clear assimilation progress for a destroyed base
 * @param {string} baseId - Destroyed base ID
 */
function clearAssimilationProgress(baseId) {
  assimilationProgress.delete(baseId);
}

/**
 * Get assimilation state for broadcasting
 * @returns {Object} Current assimilation state
 */
function getAssimilationState() {
  const queen = getActiveQueen();
  return {
    assimilatedBases: Array.from(assimilatedBases.entries()).map(([id, data]) => ({
      id,
      ...data
    })),
    inProgress: Array.from(assimilationProgress.entries()).map(([baseId, data]) => ({
      baseId,
      progress: data.progress,
      threshold: CONSTANTS.SWARM_ASSIMILATION.ASSIMILATION_THRESHOLD
    })),
    activeQueen: queen ? {
      id: queen.id,
      x: queen.position?.x ?? queen.x,
      y: queen.position?.y ?? queen.y,
      hull: queen.hull,
      maxHull: queen.hullMax ?? queen.maxHull,
      shield: queen.shield,
      maxShield: queen.shieldMax ?? queen.maxShield
    } : null,
    sectorCounts: Object.fromEntries(sectorAssimilationCount)
  };
}

/**
 * Get the active queen reference
 * @returns {Object|null} Active queen or null
 */
function getActiveQueen() {
  // The active registry is authoritative. Heal legacy/direct-deletion paths
  // defensively so a stale singleton cannot keep the aura and spawn lock alive.
  if (activeQueen && activeNPCs.get(activeQueen.id) !== activeQueen) {
    logger.warn(`[SWARM] Clearing stale Queen singleton ${activeQueen.id}`);
    activeQueen = null;
    lastQueenSpawnTime = Date.now();
  }
  return activeQueen;
}

/**
 * Get formation info for an NPC (O(1) lookup via reverse map)
 * @param {string} npcId - NPC ID to look up
 * @returns {Object|null} Formation info { formationId, leaderId, memberIds } or null
 */
function getFormationForNpc(npcId) {
  const formationId = npcToFormation.get(npcId);
  if (!formationId) {
    return null;
  }

  const formation = formations.get(formationId);
  if (!formation) {
    // Stale entry - clean it up
    npcToFormation.delete(npcId);
    return null;
  }

  return {
    formationId,
    leaderId: formation.leaderId,
    memberIds: formation.memberIds,
    lastLeaderId: formation.lastLeaderId,
    isLeader: formation.leaderId === npcId
  };
}

function clearNpcFormationMetadata(npcEntity) {
  if (!npcEntity) return;
  delete npcEntity.formationId;
  delete npcEntity.formationLeader;
  delete npcEntity.isFormationLeader;
}

/**
 * Dissolve a living formation without running leader-death succession.
 * Faction conversion removes the formation behavior from every member at
 * once, so promoting another member would only create stale Void authority.
 */
function dissolveFormation(formationId) {
  const formation = formations.get(formationId);
  if (!formation) return false;

  const npcIds = new Set([formation.leaderId, ...formation.memberIds]);
  for (const npcId of npcIds) {
    npcToFormation.delete(npcId);
    clearNpcFormationMetadata(activeNPCs.get(npcId));
  }
  formations.delete(formationId);
  ai.getFormationStrategy()?.formationStates?.delete(formationId);
  return true;
}

function detachFormationForFactionConversion(npcEntity) {
  const formationInfo = getFormationForNpc(npcEntity.id);
  if (formationInfo) {
    dissolveFormation(formationInfo.formationId);
  } else {
    clearNpcFormationMetadata(npcEntity);
  }
}

/**
 * Register or update a formation
 * @param {string} leaderId - Formation leader NPC ID
 * @param {Array|Set} memberIds - Member NPC IDs (excluding leader)
 * @returns {string} Formation ID
 */
function registerFormation(leaderId, memberIds) {
  // Check if leader already has a formation
  const existing = getFormationForNpc(leaderId);
  if (existing) {
    // Update existing formation
    const formation = formations.get(existing.formationId);

    // Clear old reverse mappings
    npcToFormation.delete(formation.leaderId);
    for (const oldMember of formation.memberIds) {
      npcToFormation.delete(oldMember);
    }

    formation.leaderId = leaderId;
    formation.memberIds = new Set(memberIds);
    formation.memberIds.delete(leaderId); // Leader shouldn't be in members

    // Update reverse mappings
    npcToFormation.set(leaderId, existing.formationId);
    for (const memberId of formation.memberIds) {
      npcToFormation.set(memberId, existing.formationId);
    }

    return existing.formationId;
  }

  // Create new formation
  const formationId = `formation_${leaderId}_${Date.now()}`;
  const newMemberIds = new Set(memberIds);
  newMemberIds.delete(leaderId); // Leader shouldn't be in members

  formations.set(formationId, {
    leaderId,
    memberIds: newMemberIds,
    lastLeaderId: null,
    createdAt: Date.now()
  });

  // Add reverse mappings
  npcToFormation.set(leaderId, formationId);
  for (const memberId of newMemberIds) {
    npcToFormation.set(memberId, formationId);
  }

  return formationId;
}

/**
 * Keep the Void population belonging to one rift base in one authoritative
 * formation. The behavioral strategy can infer a leader locally, but the
 * registry is what makes leader succession reachable after a real death.
 *
 * @param {string} baseId - Active Void rift base ID
 * @returns {Object|null} Registered formation summary
 */
function reconcileVoidFormationForBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base || !Array.isArray(base.spawnedNPCs)) return null;

  const members = base.spawnedNPCs
    .map(npcId => activeNPCs.get(npcId))
    .filter(entity => entity?.faction === 'void' && entity.hull > 0);
  if (members.length === 0) return null;

  // Preserve a live registered leader. On first registration, select the best
  // succession candidate so higher-tier entities naturally lead the group.
  let leader = members.find(entity => {
    const formation = getFormationForNpc(entity.id);
    return formation?.leaderId === entity.id;
  });
  if (!leader) {
    leader = members.reduce((best, candidate) =>
      scoreNpcForLeadership(candidate) > scoreNpcForLeadership(best)
        ? candidate
        : best
    , null);
  }
  if (!leader) return null;

  const memberIds = members
    .filter(entity => entity.id !== leader.id)
    .map(entity => entity.id);
  const formationId = registerFormation(leader.id, memberIds);

  for (const entity of members) {
    const isLeader = entity.id === leader.id;
    entity.formationId = formationId;
    entity.formationLeader = isLeader;
    entity.isFormationLeader = isLeader;
  }

  return { formationId, leaderId: leader.id, memberIds };
}

/**
 * Score an NPC for leadership succession
 * Higher scores = more likely to become new leader
 * @param {Object} npcEntity - NPC to score
 * @returns {number} Leadership score
 */
function scoreNpcForLeadership(npcEntity) {
  if (!npcEntity || npcEntity.hull <= 0) return -1;

  const healthPercent = npcEntity.hull / npcEntity.hullMax;
  const tierScore = SUCCESSION_TIER_SCORES[npcEntity.type] || 0;

  // Score = health% * 100 + tierScore * 10
  return (healthPercent * 100) + (tierScore * 10);
}

/**
 * Handle formation leader death - select new leader
 * @param {string} formationId - Formation ID
 * @returns {Object} Succession result { newLeader, memberIds, success }
 */
function handleLeaderDeath(formationId) {
  const formation = formations.get(formationId);
  if (!formation) {
    return { success: false, reason: 'Formation not found' };
  }

  const oldLeaderId = formation.leaderId;

  // Clean up dead members and their reverse mappings
  for (const memberId of formation.memberIds) {
    if (!activeNPCs.has(memberId)) {
      formation.memberIds.delete(memberId);
      npcToFormation.delete(memberId);
    }
  }

  // Remove old leader from reverse map
  npcToFormation.delete(oldLeaderId);

  // No members left - dissolve formation
  if (formation.memberIds.size === 0) {
    formations.delete(formationId);
    return { success: false, reason: 'No surviving members' };
  }

  // Score all surviving members
  let bestScore = -1;
  let bestCandidate = null;

  for (const memberId of formation.memberIds) {
    const member = activeNPCs.get(memberId);
    if (!member) continue;

    const score = scoreNpcForLeadership(member);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = member;
    }
  }

  if (!bestCandidate) {
    // Clean up all reverse mappings for this formation
    for (const memberId of formation.memberIds) {
      npcToFormation.delete(memberId);
    }
    formations.delete(formationId);
    return { success: false, reason: 'No viable candidates' };
  }

  // Promote new leader
  formation.lastLeaderId = oldLeaderId;
  formation.leaderId = bestCandidate.id;
  formation.memberIds.delete(bestCandidate.id);

  // Update reverse mapping for new leader (stays mapped to same formationId)
  // npcToFormation.set(bestCandidate.id, formationId) - already set from before

  // Mark new leader in NPC data
  bestCandidate.isFormationLeader = true;
  bestCandidate.formationLeader = true;

  logger.log(`[FORMATION] Leader succession: ${bestCandidate.name} (${bestCandidate.id}) is now leader of formation ${formationId}`);

  return {
    success: true,
    newLeader: {
      id: bestCandidate.id,
      type: bestCandidate.type,
      name: bestCandidate.name,
      position: bestCandidate.position,
      score: bestScore
    },
    memberIds: Array.from(formation.memberIds),
    formationId
  };
}

/**
 * Remove an NPC from any formation they belong to (O(1) lookup)
 * @param {string} npcId - NPC ID to remove
 */
function removeFromFormation(npcId) {
  const formationId = npcToFormation.get(npcId);
  if (!formationId) {
    return; // Not in any formation
  }

  const formation = formations.get(formationId);
  if (formation) {
    if (formation.memberIds.has(npcId)) {
      formation.memberIds.delete(npcId);
    }
    // If leader was removed (shouldn't happen via this function normally)
    if (formation.leaderId === npcId) {
      formation.leaderId = null;
    }
  }

  // Remove from reverse map
  npcToFormation.delete(npcId);
}

/**
 * Clean up empty formations and stale reverse mappings
 */
function cleanupFormations() {
  for (const [formationId, formation] of formations) {
    // Remove dead members and their reverse mappings
    for (const memberId of formation.memberIds) {
      if (!activeNPCs.has(memberId)) {
        formation.memberIds.delete(memberId);
        npcToFormation.delete(memberId);
      }
    }

    // Check if leader is dead
    const leaderDead = !activeNPCs.has(formation.leaderId);

    if (leaderDead) {
      // Recover from legacy/direct deletion paths by either promoting a live
      // member or dissolving the now-empty formation.
      handleLeaderDeath(formationId);
    }
  }
}

// Base type to NPC type mapping (spawn pool per base)
const BASE_NPC_SPAWNS = {
  pirate_outpost: {
    npcs: ['pirate_fighter'],    // Only fighters spawn regularly - captains spawn on intel
    weights: [1.0],              // 100% fighters in regular spawn
    maxNPCs: 4,                  // Max regular NPCs (fighters) from base
    spawnCooldown: 30000,        // 30 seconds between spawns
    respawnDelay: 300000,        // 5 minutes before respawning after death
    initialSpawn: 2,             // Fighters spawn on base creation
    // Scout spawning configuration (scouts spawn away from base)
    scoutConfig: {
      maxScouts: 2,              // Max scouts per base
      spawnCooldown: 45000,      // 45 seconds between scout spawns
      spawnRadius: 600,          // Scouts spawn 600 units from base
      npcType: 'pirate_scout'
    },
    // Captain spawning configuration (captains spawn when scout returns with intel)
    captainConfig: {
      maxCaptains: 2,            // Max captains per base
      npcType: 'pirate_captain'
    },
    // Dreadnought spawn trigger (spawns once per base lifetime at 25% health)
    dreadnoughtConfig: {
      healthTrigger: 0.25,       // Spawn when base reaches 25% health
      npcType: 'pirate_dreadnought'
    }
  },
  scavenger_yard: {
    npcs: ['scavenger_scrapper', 'scavenger_salvager', 'scavenger_collector'],
    weights: [0.45, 0.35, 0.2],
    maxNPCs: 3,
    spawnCooldown: 45000,
    respawnDelay: 300000,        // 5 minutes
    initialSpawn: 2
  },
  swarm_hive: {
    npcs: ['swarm_drone', 'swarm_worker', 'swarm_warrior'],
    weights: [0.7, 0.2, 0.1],    // More drones (70%) for assimilation
    maxNPCs: 20,                 // Large swarm capacity for assimilation waves
    spawnCooldown: 3000,         // Fast spawning (3s between spawns)
    respawnDelay: 15000,         // Quick respawn (15s)
    initialSpawn: 10,            // Start with swarm ready
    continuousSpawn: true        // Keeps spawning when players nearby
  },
  void_rift: {
    npcs: ['void_whisper', 'void_shadow', 'void_phantom'],
    weights: [0.5, 0.35, 0.15],
    maxNPCs: 8,                  // Doubled from 4 for more void presence
    spawnCooldown: 20000,        // Halved from 40s for faster spawning
    respawnDelay: 120000,        // Reduced from 5 min to 2 min
    initialSpawn: 4              // Doubled from 2
  },
  mining_claim: {
    npcs: ['rogue_prospector', 'rogue_driller', 'rogue_excavator'],
    weights: [0.5, 0.35, 0.15],
    maxNPCs: 5,                  // Increased to allow dynamic spawns + Foreman
    spawnCooldown: 60000,        // Slower spawning (territorial)
    respawnDelay: 300000,        // 5 minutes
    initialSpawn: 2
  }
};

// Select NPC type from weighted pool
// Can accept either a base type string OR a spawn config object directly (DRY)
function selectNPCFromPool(baseTypeOrConfig) {
  const spawnConfig = typeof baseTypeOrConfig === 'string'
    ? BASE_NPC_SPAWNS[baseTypeOrConfig]
    : baseTypeOrConfig;
  if (!spawnConfig) return null;

  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < spawnConfig.npcs.length; i++) {
    cumulative += spawnConfig.weights[i];
    if (roll < cumulative) {
      return spawnConfig.npcs[i];
    }
  }
  return spawnConfig.npcs[spawnConfig.npcs.length - 1];
}

/**
 * Count only NPCs produced by a base's regular spawn pool. Pirate scouts,
 * captains, and dreadnoughts have independent lifecycle rules and must not
 * consume fighter capacity merely because they share `spawnedNPCs`.
 *
 * @param {Object} base - Active base state
 * @param {Object} spawnConfig - Base spawn configuration
 * @returns {number} Number of live regular-pool NPCs
 */
function countRegularBaseNPCs(base, spawnConfig) {
  if (!Array.isArray(base?.spawnedNPCs) || !Array.isArray(spawnConfig?.npcs)) {
    return 0;
  }

  return base.spawnedNPCs.reduce((count, npcId) => {
    const entity = activeNPCs.get(npcId);
    return count + (entity && spawnConfig.npcs.includes(entity.type) ? 1 : 0);
  }, 0);
}

/**
 * Retain a killed base NPC's type until the spawn loop consumes its stale ID.
 * `activeNPCs` is intentionally cleared before the engine broadcasts death,
 * so the base cannot otherwise distinguish a fighter from a scout afterward.
 */
function rememberBaseNpcCombatDeath(npcEntity) {
  const homeBaseId = npcEntity?.homeBaseId || npcEntity?.baseId;
  const base = homeBaseId ? activeBases.get(homeBaseId) : null;
  if (!base || !base.spawnedNPCs?.includes(npcEntity.id)) return;

  if (!(base._combatDeathTypes instanceof Map)) {
    base._combatDeathTypes = new Map();
  }
  base._combatDeathTypes.set(npcEntity.id, npcEntity.type);
}

// Activate a base for NPC spawning
function activateBase(base) {
  if (activeBases.has(base.id)) return;

  const dormantBase = dormantBases.get(base.id);
  const spawnConfig = dormantBase?.spawnConfig ||
    BASE_NPC_SPAWNS[dormantBase?.type || base.type];
  if (!spawnConfig) return;

  // Get current computed position for orbital/binary bases
  // This ensures consistency with NPC spawn positions
  const computedPos = world.getObjectPosition(base.id);
  const activatedX = computedPos ? computedPos.x : base.x;
  const activatedY = computedPos ? computedPos.y : base.y;

  const activeBase = dormantBase || {
    ...base,
    spawnedNPCs: [],
    pendingRespawns: [],  // Array of { respawnAt: timestamp } for killed NPCs
    lastSpawnTime: 0
  };
  activeBase.activatedX = activatedX;
  activeBase.activatedY = activatedY;
  const dormantNPCs = Array.isArray(activeBase.dormantNPCs)
    ? activeBase.dormantNPCs
    : [];
  const dormantBasePosition = activeBase.dormantBasePosition;
  const restoreOffsetX = dormantBasePosition
    ? activatedX - dormantBasePosition.x
    : 0;
  const restoreOffsetY = dormantBasePosition
    ? activatedY - dormantBasePosition.y
    : 0;
  activeBase.spawnedNPCs = [];
  activeBase.pendingRespawns = activeBase.pendingRespawns || [];
  activeBase.activated = true;
  dormantBases.delete(base.id);

  // Initialize scrap pile for scavenger_yard bases
  if (activeBase.type === 'scavenger_yard' && !activeBase.scrapPile) {
    activeBase.scrapPile = {
      count: 0,
      contents: []
    };
    activeBase.hasHauler = false;
    activeBase.isTransforming = false;
  }

  activeBases.set(base.id, activeBase);

  // Restore the same live identities after dormancy. This preserves boss and
  // faction state (Hauler cargo/growth, Foreman identity, Void formation IDs)
  // instead of rerolling the population into unrelated base-pool NPCs.
  for (const dormantNpc of dormantNPCs) {
    if (!dormantNpc?.id || dormantNpc.hull <= 0 || !dormantNpc.position) continue;

    // Orbital bases continue moving while dormant. Preserve each NPC's local
    // offset from the base instead of restoring it at the stale world point.
    dormantNpc.position.x += restoreOffsetX;
    dormantNpc.position.y += restoreOffsetY;
    if (dormantNpc.spawnPoint) {
      dormantNpc.spawnPoint.x += restoreOffsetX;
      dormantNpc.spawnPoint.y += restoreOffsetY;
    }
    if (dormantNpc.riftPortal) {
      dormantNpc.riftPortal.x += restoreOffsetX;
      dormantNpc.riftPortal.y += restoreOffsetY;
    }
    dormantNpc.homeBasePosition = { x: activatedX, y: activatedY };
    activeNPCs.set(dormantNpc.id, dormantNpc);
    npcSpatialHash.insert(
      dormantNpc.id,
      dormantNpc.position.x,
      dormantNpc.position.y
    );
    activeBase.spawnedNPCs.push(dormantNpc.id);
  }
  delete activeBase.dormantNPCs;
  delete activeBase.dormantBasePosition;

  // Fresh bases get their configured initial population. The count fallback
  // supports dormant state created by older server versions.
  const spawnCount = dormantNPCs.length > 0
    ? 0
    : dormantBase
      ? Math.max(0, Math.min(spawnConfig.maxNPCs, dormantBase.dormantPopulationCount || 0))
      : spawnConfig.initialSpawn;
  delete activeBase.dormantPopulationCount;
  for (let i = 0; i < spawnCount; i++) {
    spawnNPCFromBase(base.id);
  }

  if (activeBase.type === 'void_rift') {
    reconcileVoidFormationForBase(base.id);
  }

  logger.log(`[NPC] Activated base ${base.name} (${base.type}) at (${Math.round(activatedX)}, ${Math.round(activatedY)})${computedPos ? ' (computed)' : ''}`);
}

// Deactivate a base (when no players nearby for a while)
function deactivateBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return;

  let dormantPopulationCount = 0;
  const dormantNPCs = [];
  const currentBasePosition = world.getObjectPosition(baseId);
  base.dormantBasePosition = {
    x: currentBasePosition?.x ?? base.activatedX ?? base.x,
    y: currentBasePosition?.y ?? base.activatedY ?? base.y
  };

  // Remove all NPCs spawned by this base, EXCEPT worms attached to other bases
  for (const npcId of base.spawnedNPCs) {
    const npc = activeNPCs.get(npcId);
    // Don't remove worms that are attached to another base - they'll be cleaned up
    // when that base is destroyed
    if (npc && npc.attachedToBase && npc.attachedToBase !== baseId) {
      logger.info(`[NPC] Skipping worm ${npcId} during deactivation - attached to ${npc.attachedToBase}`);
      continue;
    }
    if (npc && npc.hull > 0) {
      dormantPopulationCount++;
      dormantNPCs.push(npc);
    }
    activeNPCs.delete(npcId);
    npcSpatialHash.remove(npcId);
  }

  base.spawnedNPCs = [];
  base.dormantPopulationCount = dormantPopulationCount;
  base.dormantNPCs = dormantNPCs;
  base.activated = false;
  activeBases.delete(baseId);
  dormantBases.set(baseId, base);
  logger.log(`[NPC] Deactivated base ${base.name}`);
}

/**
 * Cleanup swarm hives that violate the exclusion zone constraint
 * Called on server startup to remove legacy hives within 10 sectors of origin
 * @returns {number} Number of hives removed
 */
function cleanupExcludedSwarmHives() {
  let removedCount = 0;

  for (const [baseId, base] of activeBases) {
    if (base.type !== 'swarm_hive') continue;

    // Check if this hive is in the exclusion zone
    if (isInSwarmExclusionZone(base.x, base.y)) {
      logger.log(`[NPC] Removing swarm hive ${baseId} from exclusion zone (${Math.floor(base.x)}, ${Math.floor(base.y)})`);
      deactivateBase(baseId);
      dormantBases.delete(baseId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.log(`[NPC] Cleaned up ${removedCount} swarm hive(s) from exclusion zone`);
  }

  return removedCount;
}

// Spawn a single NPC from a base
function spawnNPCFromBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return null;

  // Skip destroyed bases
  if (base.destroyed) return null;

  // DRY: Use base.spawnConfig if set (e.g., for assimilated bases),
  // otherwise fall back to BASE_NPC_SPAWNS lookup by type
  const spawnConfig = base.spawnConfig || BASE_NPC_SPAWNS[base.type];
  if (!spawnConfig) return null;

  // Special faction units use their own caps and lifecycle queues.
  if (countRegularBaseNPCs(base, spawnConfig) >= spawnConfig.maxNPCs) return null;

  // Pass spawnConfig directly to use the correct pool (DRY)
  const npcType = selectNPCFromPool(spawnConfig);
  if (!npcType) return null;

  const npcTypeData = NPC_TYPES[npcType];
  if (!npcTypeData) return null;

  const npcId = `npc_${++npcIdCounter}`;

  // Get current computed position for orbital/binary bases
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  // Spawn position - swarm spawns close to base (eggs), others within patrol radius
  const isSwarmFaction = npcTypeData.faction === 'swarm';
  const patrolRadius = (base.patrolRadius || 3) * config.SECTOR_SIZE;
  const spawnAngle = Math.random() * Math.PI * 2;
  // Swarm spawns within SPAWN_RADIUS (100 units) for egg hatching, others within 50% of patrol radius
  const spawnRadius = isSwarmFaction
    ? (config.SWARM_HATCHING?.SPAWN_RADIUS || 100)
    : patrolRadius * 0.5;
  const spawnDist = Math.random() * spawnRadius;
  const spawnX = baseX + Math.cos(spawnAngle) * spawnDist;
  const spawnY = baseY + Math.sin(spawnAngle) * spawnDist;

  const npc = {
    id: npcId,
    type: npcType,
    name: npcTypeData.name,
    faction: npcTypeData.faction,
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    rotation: Math.random() * Math.PI * 2,
    hull: npcTypeData.hull,
    hullMax: npcTypeData.hull,
    shield: npcTypeData.shield,
    shieldMax: npcTypeData.shield,
    speed: npcTypeData.speed,
    weaponType: npcTypeData.weaponType,
    weaponTier: npcTypeData.weaponTier,
    weaponDamage: npcTypeData.weaponDamage,
    weaponRange: npcTypeData.weaponRange,
    aggroRange: npcTypeData.aggroRange,
    creditReward: npcTypeData.creditReward,
    ...copyNpcTemplateSpecialFields(npcTypeData),
    // Link to home base (use computed position for orbital/binary bases)
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    patrolRadius: patrolRadius,
    spawnPoint: { x: spawnX, y: spawnY },
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map(),
    // Swarm egg hatching - track spawn time and hatch duration
    hatchTime: isSwarmFaction ? Date.now() : null,
    hatchDuration: isSwarmFaction
      ? (npcType === 'swarm_queen'
        ? (config.SWARM_HATCHING?.QUEEN_HATCH_DURATION || 4000)
        : (config.SWARM_HATCHING?.HATCH_DURATION || 2500))
      : 0,
    state: isSwarmFaction ? 'hatching' : 'patrol'
  };

  // Void NPCs spawn with a persistent rift portal they can retreat into
  if (npcTypeData.faction === 'void') {
    npc.riftPortal = { x: spawnX, y: spawnY };
  }

  activeNPCs.set(npcId, npc);
  npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);
  base.spawnedNPCs.push(npcId);
  base.lastSpawnTime = Date.now();

  if (npcTypeData.faction === 'void') {
    reconcileVoidFormationForBase(baseId);
  }

  return npc;
}

/**
 * Spawn a pirate scout away from the base (for espionage patrol)
 * @param {string} baseId - The pirate outpost base ID
 * @returns {Object|null} The spawned scout NPC or null
 */
function spawnScoutFromBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base || base.type !== 'pirate_outpost' || base.destroyed) return null;

  const spawnConfig = BASE_NPC_SPAWNS.pirate_outpost;
  const scoutConfig = spawnConfig?.scoutConfig;
  if (!scoutConfig) return null;

  // Count current scouts
  const currentScouts = base.spawnedNPCs.filter(npcId => {
    const npc = activeNPCs.get(npcId);
    return npc && npc.type === 'pirate_scout';
  }).length;

  if (currentScouts >= scoutConfig.maxScouts) return null;

  const npcTypeData = NPC_TYPES[scoutConfig.npcType];
  if (!npcTypeData) return null;

  const npcId = `npc_scout_${++npcIdCounter}`;

  // Get base position
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  // Spawn AWAY from base (at scoutConfig.spawnRadius distance)
  const angle = Math.random() * Math.PI * 2;
  const spawnX = baseX + Math.cos(angle) * scoutConfig.spawnRadius;
  const spawnY = baseY + Math.sin(angle) * scoutConfig.spawnRadius;

  const npc = {
    id: npcId,
    type: 'pirate_scout',
    name: npcTypeData.name,
    faction: 'pirate',
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    rotation: Math.random() * Math.PI * 2,
    hull: npcTypeData.hull,
    hullMax: npcTypeData.hull,
    shield: npcTypeData.shield,
    shieldMax: npcTypeData.shield,
    speed: npcTypeData.speed,
    weaponType: npcTypeData.weaponType,
    weaponTier: npcTypeData.weaponTier,
    weaponDamage: npcTypeData.weaponDamage,
    weaponRange: npcTypeData.weaponRange,
    aggroRange: npcTypeData.aggroRange,
    creditReward: npcTypeData.creditReward,
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    spawnPoint: { x: spawnX, y: spawnY },
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map(),
    state: 'patrol',
    shieldPiercing: npcTypeData.shieldPiercing || 0.1
  };

  activeNPCs.set(npcId, npc);
  npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);
  base.spawnedNPCs.push(npcId);

  logger.log(`[PIRATE] Scout ${npcId} spawned at distance ${scoutConfig.spawnRadius} from base ${base.name}`);

  return npc;
}

/**
 * Spawn a pirate captain when a scout returns with intel
 * Captains only spawn in response to scout intel, not regularly
 * @param {string} baseId - The pirate outpost base ID
 * @param {Object} intel - The intel report from the scout
 * @returns {Object|null} The spawned captain NPC or null
 */
function spawnCaptainFromIntel(baseId, intel) {
  const base = activeBases.get(baseId);
  if (!base || base.type !== 'pirate_outpost' || base.destroyed) return null;

  const spawnConfig = BASE_NPC_SPAWNS.pirate_outpost;
  const captainConfig = spawnConfig?.captainConfig;
  if (!captainConfig) return null;

  // Count current captains
  const currentCaptains = base.spawnedNPCs.filter(npcId => {
    const npc = activeNPCs.get(npcId);
    return npc && npc.type === 'pirate_captain';
  }).length;

  if (currentCaptains >= captainConfig.maxCaptains) {
    logger.log(`[PIRATE] Max captains (${captainConfig.maxCaptains}) already at base ${base.name}`);
    return null;
  }

  const npcTypeData = NPC_TYPES[captainConfig.npcType];
  if (!npcTypeData) return null;

  const npcId = `npc_captain_${++npcIdCounter}`;

  // Get base position - captains spawn AT the base
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  // Small random offset so they don't stack
  const offsetAngle = Math.random() * Math.PI * 2;
  const offsetDist = 30 + Math.random() * 50;
  const spawnX = baseX + Math.cos(offsetAngle) * offsetDist;
  const spawnY = baseY + Math.sin(offsetAngle) * offsetDist;

  const npc = {
    id: npcId,
    type: 'pirate_captain',
    name: npcTypeData.name,
    faction: 'pirate',
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    rotation: Math.random() * Math.PI * 2,
    hull: npcTypeData.hull,
    hullMax: npcTypeData.hull,
    shield: npcTypeData.shield,
    shieldMax: npcTypeData.shield,
    speed: npcTypeData.speed,
    weaponType: npcTypeData.weaponType,
    weaponTier: npcTypeData.weaponTier,
    weaponDamage: npcTypeData.weaponDamage,
    weaponRange: npcTypeData.weaponRange,
    aggroRange: npcTypeData.aggroRange,
    creditReward: npcTypeData.creditReward,
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    spawnPoint: { x: spawnX, y: spawnY },
    targetPlayer: intel.targetId,
    raidTargetPos: intel.targetPos,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map(),
    state: 'raid',  // Captains spawned from intel go directly to raid
    spawnedFromIntel: true,
    shieldPiercing: npcTypeData.shieldPiercing || 0.1,
    // Base raid info - captains prioritize stealing from bases
    isRaidingBase: intel.isBaseTarget || false,
    raidBaseType: intel.baseType || null,
    raidBaseId: intel.isBaseTarget ? intel.targetId : null
  };

  activeNPCs.set(npcId, npc);
  npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);
  base.spawnedNPCs.push(npcId);

  const targetDesc = intel.isBaseTarget ? `${intel.baseType} base` : intel.targetType;
  logger.log(`[PIRATE] Captain ${npcId} spawned from intel at base ${base.name}, targeting ${targetDesc}`);

  return npc;
}

/**
 * Spawn a pirate dreadnought when base reaches critical health (25%)
 * @param {string} baseId - The pirate outpost base ID
 * @returns {Object|null} The spawned dreadnought NPC or null
 */
function spawnDreadnoughtAtBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base || base.type !== 'pirate_outpost') return null;

  const npcTypeData = NPC_TYPES.pirate_dreadnought;
  if (!npcTypeData) return null;

  const npcId = `npc_dreadnought_${Date.now()}`;

  // Get base position
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  const npc = {
    id: npcId,
    type: 'pirate_dreadnought',
    name: npcTypeData.name,
    faction: 'pirate',
    position: { x: baseX, y: baseY },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    hull: npcTypeData.hull,
    hullMax: npcTypeData.hull,
    shield: 0,
    shieldMax: 0,
    speed: npcTypeData.speed,
    weaponType: npcTypeData.weaponType,
    weaponTier: npcTypeData.weaponTier,
    weaponDamage: npcTypeData.weaponDamage,
    weaponRange: npcTypeData.weaponRange,
    aggroRange: npcTypeData.aggroRange,
    creditReward: npcTypeData.creditReward,
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    spawnPoint: { x: baseX, y: baseY },
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    damageContributors: new Map(),
    state: 'spawning',
    isBoss: true,
    invulnerableChance: npcTypeData.invulnerableChance,
    shieldPiercing: npcTypeData.shieldPiercing || 0.1
  };

  activeNPCs.set(npcId, npc);
  npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);
  base.spawnedNPCs.push(npcId);

  return npc;
}

// Update base spawning (called from game loop)
function updateBaseSpawning(nearbyPlayers) {
  const now = Date.now();

  for (const [baseId, base] of activeBases) {
    // Skip destroyed bases - they cannot spawn NPCs
    if (base.destroyed) continue;

    // DRY: Use base.spawnConfig if set (e.g., for assimilated bases),
    // otherwise fall back to BASE_NPC_SPAWNS lookup by type
    const spawnConfig = base.spawnConfig || BASE_NPC_SPAWNS[base.type];
    if (!spawnConfig) continue;

    base.pendingRespawns ||= [];
    if (base.type === 'pirate_outpost' && spawnConfig.scoutConfig) {
      base.pendingScoutRespawns ||= [];
    }

    // Remove stale IDs while preserving the combat-death classification that
    // was recorded before the entity left the authoritative active map.
    const missingIds = base.spawnedNPCs.filter(npcId => !activeNPCs.has(npcId));
    base.spawnedNPCs = base.spawnedNPCs.filter(npcId => activeNPCs.has(npcId));

    let deadRegularCount = 0;
    let deadScoutCount = 0;
    for (const npcId of missingIds) {
      const deadType = base._combatDeathTypes?.get(npcId);
      base._combatDeathTypes?.delete(npcId);

      // An unclassified stale ID comes from an older/direct deletion path.
      // Preserve the legacy behavior by treating it as a regular-pool death.
      if (!deadType || spawnConfig.npcs.includes(deadType)) {
        deadRegularCount++;
      } else if (deadType === spawnConfig.scoutConfig?.npcType) {
        deadScoutCount++;
      }
      // Captains, dreadnoughts, and other special units do not auto-respawn.
    }
    if (base._combatDeathTypes?.size === 0) delete base._combatDeathTypes;

    const respawnDelay = spawnConfig.respawnDelay || 300000;
    for (let i = 0; i < deadRegularCount; i++) {
      base.pendingRespawns.push({ respawnAt: now + respawnDelay });
    }
    if (deadRegularCount > 0) {
      logger.log(`[NPC] ${base.name}: ${deadRegularCount} regular NPC(s) killed, respawn in ${respawnDelay / 1000}s`);
    }

    for (let i = 0; i < deadScoutCount; i++) {
      base.pendingScoutRespawns.push({ respawnAt: now + respawnDelay });
    }
    if (deadScoutCount > 0) {
      logger.log(`[PIRATE] ${base.name}: ${deadScoutCount} scout(s) killed, respawn in ${respawnDelay / 1000}s`);
    }

    let regularCount = countRegularBaseNPCs(base, spawnConfig);
    const regularSpawnReady = regularCount < spawnConfig.maxNPCs &&
      now - (base.lastSpawnTime || 0) >= spawnConfig.spawnCooldown;

    // Check if any player is in range (patrol radius)
    // Use computed position for orbital/binary bases that move over time
    const currentBasePos = world.getObjectPosition(baseId);
    const baseX = currentBasePos ? currentBasePos.x : base.x;
    const baseY = currentBasePos ? currentBasePos.y : base.y;
    const patrolRadius = (base.patrolRadius || 3) * config.SECTOR_SIZE;
    const hasNearbyPlayer = nearbyPlayers.some(player => {
      const dx = player.position.x - baseX;
      const dy = player.position.y - baseY;
      return Math.sqrt(dx * dx + dy * dy) < patrolRadius;
    });

    // Continuous spawn bases (like swarm hive) can spawn freely when players nearby.
    if (regularSpawnReady && spawnConfig.continuousSpawn && hasNearbyPlayer) {
      // Priority 1: Process pending respawns (dead NPCs coming back)
      const readyIndex = base.pendingRespawns.findIndex(pr => pr.respawnAt <= now);
      if (readyIndex !== -1) {
        const newNPC = spawnNPCFromBase(baseId);
        if (newNPC) {
          base.pendingRespawns.splice(readyIndex, 1);
          regularCount++;
          logger.log(`[NPC] ${base.name} respawned ${newNPC.name}`);
        }
      } else if (regularCount < spawnConfig.maxNPCs) {
        // Priority 2: Grow toward maxNPCs even without pending respawns
        const newNPC = spawnNPCFromBase(baseId);
        if (newNPC) {
          regularCount++;
          logger.log(`[NPC] ${base.name} spawned ${newNPC.name} (${regularCount}/${spawnConfig.maxNPCs})`);
        }
      }
    } else if (regularSpawnReady && !spawnConfig.continuousSpawn) {
      // Regular bases: respawn when delay has passed, up to maxNPCs
      const readyIndex = base.pendingRespawns.findIndex(pr => pr.respawnAt <= now);
      if (readyIndex !== -1 && regularCount < spawnConfig.maxNPCs) {
        const newNPC = spawnNPCFromBase(baseId);
        if (newNPC) {
          base.pendingRespawns.splice(readyIndex, 1);
          regularCount++;
          logger.log(`[NPC] ${base.name} respawned ${newNPC.name} (after delay)`);
        }
      }
    }

    // Pirate outpost scout spawning (separate from normal spawns)
    if (base.type === 'pirate_outpost' && spawnConfig.scoutConfig) {
      const scoutConfig = spawnConfig.scoutConfig;

      base.lastScoutSpawnTime ||= 0;

      let currentScouts = base.spawnedNPCs.filter(npcId => {
        const npc = activeNPCs.get(npcId);
        return npc && npc.type === 'pirate_scout';
      }).length;

      // Keep ready entries queued if capacity is full or spawning fails.
      for (let i = 0; i < base.pendingScoutRespawns.length &&
           currentScouts < scoutConfig.maxScouts;) {
        if (base.pendingScoutRespawns[i].respawnAt > now) {
          i++;
          continue;
        }
        const scout = spawnScoutFromBase(baseId);
        if (scout) {
          base.pendingScoutRespawns.splice(i, 1);
          currentScouts++;
          base.lastScoutSpawnTime = now;
        } else {
          break;
        }
      }

      // Also check regular spawn cooldown for initial spawns (when below max and no pending)
      if (currentScouts < scoutConfig.maxScouts && base.pendingScoutRespawns.length === 0) {
        if (now - base.lastScoutSpawnTime >= scoutConfig.spawnCooldown) {
          const scout = spawnScoutFromBase(baseId);
          if (scout) {
            base.lastScoutSpawnTime = now;
          }
        }
      }
    }
  }
}

// Get active base by ID
function getActiveBase(baseId) {
  return activeBases.get(baseId);
}

// Get active base by ID with computed orbital position
function getActiveBaseWithPosition(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return null;
  const currentPos = world.getObjectPosition(baseId);
  if (currentPos) {
    return { ...base, x: currentPos.x, y: currentPos.y };
  }
  return base;
}

// Get all active bases (returns the Map)
function getActiveBases() {
  return activeBases;
}

function cleanupFactionStrategyState(npcEntity) {
  if (npcEntity.faction === 'scavenger') {
    ai.getScavengerStrategy()?.cleanup?.(npcEntity.id);
  } else if (npcEntity.faction === 'rogue_miner') {
    ai.getMiningStrategy()?.cleanup?.(npcEntity.id);
  } else if (npcEntity.faction === 'pirate') {
    ai.getPirateStrategy()?.cleanup?.(npcEntity.id);
  }

  if (npcEntity.type === 'void_leviathan') {
    const { voidLeviathanAI } = require('./ai/void-leviathan');
    voidLeviathanAI.cleanup(npcEntity.id);
  }
}

/**
 * Finalize the registries shared by combat deaths and non-combat removals.
 * Combat defers leader succession so engine.js can broadcast the promoted
 * leader using the retained dead snapshot after `damageNPC` returns.
 */
function finalizeNpcRegistryRemoval(npcEntity, { deferLeaderSuccession = false } = {}) {
  cleanupFactionStrategyState(npcEntity);

  const formationInfo = getFormationForNpc(npcEntity.id);
  if (formationInfo?.isLeader) {
    if (!deferLeaderSuccession) handleLeaderDeath(formationInfo.formationId);
  } else if (formationInfo) {
    removeFromFormation(npcEntity.id);
  }

  activeNPCs.delete(npcEntity.id);
  npcSpatialHash.remove(npcEntity.id);
}

/**
 * Queue a replacement for a base-pool NPC removed outside the normal combat
 * damage path. Normal combat leaves a stale spawned ID for updateBaseSpawning
 * to classify; scripted deaths such as Leviathan consumption must remove the
 * entity immediately, so they opt into the same replenishment explicitly.
 */
function scheduleBaseRespawnForRemoval(base, npcEntity) {
  if (!base || base.destroyed || !base.spawnedNPCs?.includes(npcEntity.id)) {
    return false;
  }

  const spawnConfig = base.spawnConfig || BASE_NPC_SPAWNS[base.type];
  if (!spawnConfig?.npcs?.includes(npcEntity.type)) return false;

  const respawnDelay = spawnConfig.respawnDelay || 300000;
  base.pendingRespawns ||= [];
  base.pendingRespawns.push({ respawnAt: Date.now() + respawnDelay });
  return true;
}

/**
 * Remove an NPC by ID (for AoE kills, scripted deaths, despawns, etc.).
 * @param {string} npcId
 * @param {Object} options
 * @param {boolean} options.scheduleBaseRespawn - Replenish a regular base slot
 * @returns {Object|null} The retained removed entity, or null when not active
 */
function removeNPC(npcId, { scheduleBaseRespawn = false } = {}) {
  const npcEntity = activeNPCs.get(npcId);
  if (!npcEntity) return null;

  // Remove from any base's spawned list
  const homeBaseId = npcEntity.homeBaseId || npcEntity.baseId;
  if (homeBaseId) {
    const base = activeBases.get(homeBaseId);
    if (base && Array.isArray(base.spawnedNPCs)) {
      if (scheduleBaseRespawn) {
        scheduleBaseRespawnForRemoval(base, npcEntity);
      }
      base.spawnedNPCs = base.spawnedNPCs.filter(id => id !== npcId);
    }

    if (base && (npcEntity.type === 'scavenger_hauler' ||
                 npcEntity.type === 'scavenger_barnacle_king')) {
      base.hasHauler = false;
      if (base.pendingHaulerBroadcast?.haulerId === npcId) {
        delete base.pendingHaulerBroadcast;
      }
    }

    if (base && npcEntity.type === 'rogue_foreman') {
      base.hasForeman = false;
    }
  }

  // Attached Swarm worms participate in a second authoritative registry.
  // Generic AoE/despawn removal must release that bookkeeping as well.
  if (npcEntity.attachedToBase) {
    const attachedBase = activeBases.get(npcEntity.attachedToBase) ||
      dormantBases.get(npcEntity.attachedToBase);
    detachDroneFromBase(npcId, npcEntity);
    if (Array.isArray(attachedBase?.attachedDroneIds)) {
      attachedBase.attachedDroneIds = attachedBase.attachedDroneIds
        .filter(id => id !== npcId);
    }
  }

  if (npcEntity.type === 'swarm_queen') {
    handleQueenDeath(npcId);
  }
  if (npcEntity.type === 'void_leviathan') {
    handleLeviathanDeath(npcId);
  }

  finalizeNpcRegistryRemoval(npcEntity);
  return npcEntity;
}

// Check if a position is within any base's territory
function isInBaseTerritory(position) {
  for (const [baseId, base] of activeBases) {
    if (base.territoryRadius) {
      const dx = position.x - base.x;
      const dy = position.y - base.y;
      if (Math.sqrt(dx * dx + dy * dy) < base.territoryRadius) {
        return { baseId, base };
      }
    }
  }
  return null;
}

// Damage a base (returns destruction result if destroyed)
function damageBase(baseId, damage, attackerId = null) {
  const base = activeBases.get(baseId);
  if (!base) return null;

  // Track damage contributor
  if (!base.damageContributors) {
    base.damageContributors = new Map();
  }
  if (attackerId) {
    const currentDamage = base.damageContributors.get(attackerId) || 0;
    base.damageContributors.set(attackerId, currentDamage + damage);
  }

  // Apply damage to base health
  base.health -= damage;

  // Check for pirate dreadnought spawn (pirate_outpost only, at 25% health)
  if (base.type === 'pirate_outpost' && !base.dreadnoughtSpawned) {
    const healthPercent = base.health / base.maxHealth;
    const spawnConfig = BASE_NPC_SPAWNS.pirate_outpost;
    const dreadnoughtConfig = spawnConfig?.dreadnoughtConfig;

    if (dreadnoughtConfig && healthPercent <= dreadnoughtConfig.healthTrigger) {
      const pirateStrategy = ai.getPirateStrategy();
      if (pirateStrategy.shouldSpawnDreadnought(baseId, healthPercent)) {
        const dreadnought = spawnDreadnoughtAtBase(baseId);
        if (dreadnought) {
          base.dreadnoughtSpawned = true;
          pirateStrategy.markDreadnoughtSpawned(baseId, dreadnought.id);
          logger.warn(`[PIRATE] DREADNOUGHT SPAWNED at ${base.name}! Base at ${Math.round(healthPercent * 100)}% health`);
        }
      }
    }
  }

  if (base.health <= 0) {
    // Base destroyed
    const participants = Array.from(base.damageContributors.keys());
    const participantCount = Math.max(1, participants.length);
    const teamMultiplier = TEAM_MULTIPLIERS[Math.min(participantCount, 4)] || 2.5;

    // Calculate credits based on base size/difficulty
    const baseCredits = base.maxHealth * 0.5; // Half of max health as credits
    const totalCredits = Math.round(baseCredits * teamMultiplier);
    const creditsPerPlayer = Math.floor(totalCredits / participantCount);
    const creditRemainder = totalCredits - (creditsPerPlayer * participantCount);

    // Destroy any attached assimilation drones - they die with the base
    const progress = assimilationProgress.get(baseId);
    const destroyedDrones = [];

    // Debug: Log what we're looking for
    logger.info(`[WORM_CLEANUP] Base ${baseId} destroyed. isAssimilated=${base.isAssimilated}, attachedDroneIds=${JSON.stringify(base.attachedDroneIds || [])}`);

    if (progress && progress.attachedDrones) {
      logger.info(`[WORM_CLEANUP] Method 1: Found ${progress.attachedDrones.size} drones in assimilationProgress`);
      for (const droneId of progress.attachedDrones) {
        activeNPCs.delete(droneId);
        npcSpatialHash.remove(droneId);
        destroyedDrones.push(droneId);
      }
      assimilationProgress.delete(baseId);
    }

    // Method 2: Scan for any NPCs still attached to this base (catches edge cases)
    // Some worms may have attachedToBase set but not be tracked in assimilationProgress
    let method2Count = 0;
    for (const [npcId, npc] of activeNPCs) {
      if (npc.attachedToBase === baseId) {
        method2Count++;
        activeNPCs.delete(npcId);
        npcSpatialHash.remove(npcId);
        if (!destroyedDrones.includes(npcId)) {
          destroyedDrones.push(npcId);
        }
      }
    }
    if (method2Count > 0) {
      logger.info(`[WORM_CLEANUP] Method 2: Found ${method2Count} drones with attachedToBase=${baseId}`);
    }

    // Method 3: Use stored attached drone IDs from assimilation (for assimilated bases)
    // These were preserved in convertBaseToSwarm() before assimilationProgress was cleared
    if (base.attachedDroneIds && base.attachedDroneIds.length > 0) {
      let method3Count = 0;
      for (const droneId of base.attachedDroneIds) {
        if (activeNPCs.has(droneId)) {
          method3Count++;
          activeNPCs.delete(droneId);
          npcSpatialHash.remove(droneId);
          if (!destroyedDrones.includes(droneId)) {
            destroyedDrones.push(droneId);
          }
        }
      }
      logger.info(`[WORM_CLEANUP] Method 3: Found ${method3Count} of ${base.attachedDroneIds.length} stored drone IDs still in activeNPCs`);
    }

    logger.info(`[WORM_CLEANUP] Total destroyedDrones: ${destroyedDrones.length} - IDs: ${JSON.stringify(destroyedDrones)}`);

    // Orphan all NPCs from this base - enter rage mode instead of deletion
    const orphanedNpcIds = [];
    for (const npcId of base.spawnedNPCs) {
      const npc = activeNPCs.get(npcId);
      if (npc) {
        // Dreadnoughts have their own permanent post-base rampage state. Other
        // survivors use the bounded generic orphan-rage lifecycle.
        npc.homeBaseId = null;
        npc.homeBasePosition = null;
        const isDreadnought = npc.type === 'pirate_dreadnought';
        npc.orphaned = !isDreadnought;
        npc.orphanedAt = isDreadnought ? null : Date.now();
        npc.state = isDreadnought ? 'enraged' : 'rage';

        // Increase aggro range and damage for rage mode
        npc.baseAggroRange = npc.baseAggroRange || npc.aggroRange;
        npc.aggroRange = Math.round(npc.baseAggroRange * ORPHAN_RAGE_AGGRO_MULTIPLIER);
        npc.rageMultiplier = isDreadnought ? 1.5 : ORPHAN_RAGE_DAMAGE_MULTIPLIER;

        orphanedNpcIds.push(npcId);
      }
    }

    // Clear the base's spawned NPC list (they're now orphaned, not tracked by base)
    base.spawnedNPCs = [];

    // Generate special loot for bases
    const loot = generateBaseLoot(base);

    // Add scrap pile contents to loot for scavenger_yard bases
    if (base.type === 'scavenger_yard' && base.scrapPile && base.scrapPile.contents.length > 0) {
      logger.log(`[SCAVENGER] Adding ${base.scrapPile.contents.length} items from scrap pile to base loot`);
      loot.push(...base.scrapPile.contents);
    }

    // Store destruction time for respawn
    base.destroyedAt = Date.now();
    base.destroyed = true;

    return {
      destroyed: true,
      loot,
      participants,
      participantCount,
      teamMultiplier,
      totalCredits,
      creditsPerPlayer,
      creditRemainder,
      faction: base.faction,
      baseType: base.type,
      baseName: base.name,
      respawnTime: config.SPAWN_HUB_TYPES?.[base.type]?.respawnTime || 300000,
      orphanedNpcIds,  // NPCs that entered rage mode
      destroyedDrones // Assimilation drones killed with the base
    };
  }

  return {
    destroyed: false,
    health: base.health,
    maxHealth: base.maxHealth
  };
}

// Generate loot specific to bases (better rewards) - uses centralized loot pool system
function generateBaseLoot(base) {
  // Use the loot pool system with base type mapping
  return LootPools.generateLoot(base.type);
}

/**
 * Handle scavenger dumping wreckage at base
 * Called from engine.js when scavenger AI emits 'scavenger:dumped' action
 * @param {Object} dumpAction - Action object from AI { action: 'scavenger:dumped', npcId, wreckageCount, contents, baseId }
 * @returns {Object|null} Result with scrap pile update and potential Hauler spawn
 */
function handleScavengerDump(dumpAction) {
  const base = activeBases.get(dumpAction.baseId);
  if (!base || base.type !== 'scavenger_yard') {
    return null;
  }

  // Initialize scrap pile if missing (for bases activated before this update)
  if (!base.scrapPile) {
    base.scrapPile = { count: 0, contents: [] };
    base.hasHauler = false;
    base.isTransforming = false;
  }

  // Add wreckage to scrap pile
  const wreckageCount = dumpAction.wreckageCount || 0;
  base.scrapPile.count += wreckageCount;

  // Merge contents into pile
  if (dumpAction.contents && Array.isArray(dumpAction.contents)) {
    for (const wreckage of dumpAction.contents) {
      if (wreckage.contents) {
        base.scrapPile.contents.push(...wreckage.contents);
      }
    }
  }

  const result = {
    baseId: dumpAction.baseId,
    scrapPile: {
      count: base.scrapPile.count,
      totalItems: base.scrapPile.contents.length
    },
    haulerSpawn: null
  };

  logger.log(`[SCAVENGER] Base ${base.name} scrap pile: ${base.scrapPile.count} wreckage, ${base.scrapPile.contents.length} items`);

  // Check if Hauler should spawn (3+ wreckage, no existing Hauler, not transforming)
  if (base.scrapPile.count >= 3 && !base.hasHauler && !base.isTransforming) {
    // Start 4-second transformation
    base.isTransforming = true;
    base.transformStartTime = Date.now();
    base.transformDuration = 4000;

    logger.log(`[SCAVENGER] Base ${base.name} starting Hauler transformation (4 seconds)`);

    // Schedule Hauler spawn after transformation
    setTimeout(() => {
      const currentBase = activeBases.get(dumpAction.baseId);
      if (currentBase && currentBase.isTransforming) {
        const hauler = spawnHauler(dumpAction.baseId);
        if (hauler) {
          logger.log(`[SCAVENGER] Hauler spawned at base ${currentBase.name}: ${hauler.id}`);

          // Mark the base with pending Hauler spawn broadcast
          currentBase.pendingHaulerBroadcast = {
            haulerId: hauler.id,
            timestamp: Date.now()
          };
        }
        currentBase.isTransforming = false;
      }
    }, 4000);

    result.transforming = {
      startTime: base.transformStartTime,
      duration: base.transformDuration
    };
  }

  return result;
}

/**
 * Spawn a Hauler NPC at a scavenger_yard base
 * @param {string} baseId - Base ID
 * @returns {Object|null} Spawned Hauler NPC or null
 */
function spawnHauler(baseId) {
  const base = activeBases.get(baseId);
  if (!base || base.type !== 'scavenger_yard') {
    return null;
  }

  // Get current computed position for orbital/binary bases
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  const haulerType = NPC_TYPES.scavenger_hauler;
  if (!haulerType) {
    logger.error('[SCAVENGER] scavenger_hauler type not found in NPC_TYPES!');
    return null;
  }

  const haulerId = `npc_${++npcIdCounter}`;

  // Spawn at base location with small offset
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = 50 + Math.random() * 30; // 50-80 units from base
  const spawnX = baseX + Math.cos(spawnAngle) * spawnDist;
  const spawnY = baseY + Math.sin(spawnAngle) * spawnDist;

  const hauler = {
    id: haulerId,
    type: 'scavenger_hauler',
    name: haulerType.name,
    faction: haulerType.faction,
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    rotation: Math.random() * Math.PI * 2,
    hull: haulerType.hull,
    hullMax: haulerType.hull,
    shield: haulerType.shield,
    shieldMax: haulerType.shield,
    speed: haulerType.speed,
    weaponType: haulerType.weaponType,
    weaponTier: haulerType.weaponTier,
    weaponDamage: haulerType.weaponDamage,
    weaponRange: haulerType.weaponRange,
    aggroRange: haulerType.aggroRange,
    creditReward: haulerType.creditReward,
    deathEffect: haulerType.deathEffect || 'deconstruction',
    sizeMultiplier: haulerType.sizeMultiplier || 1.8,
    // Link to home base
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    patrolRadius: (base.patrolRadius || 3) * config.SECTOR_SIZE,
    spawnPoint: { x: spawnX, y: spawnY },
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map(),
    state: 'patrol',
    // Hauler doesn't carry wreckage initially
    carriedWreckage: []
  };

  activeNPCs.set(haulerId, hauler);
  npcSpatialHash.insert(haulerId, hauler.position.x, hauler.position.y);
  base.spawnedNPCs.push(haulerId);
  base.hasHauler = true;

  // Reset scrap pile count after spawning Hauler
  base.scrapPile.count = 0;

  return hauler;
}

/**
 * Replace a live Scavenger Hauler with the Barnacle King while retaining its
 * accumulated wreckage and its exact base population slot.
 *
 * @param {string} haulerId - Active Hauler NPC ID
 * @returns {Object|null} Spawned Barnacle King
 */
function transformHaulerToBarnacleKing(haulerId) {
  const hauler = activeNPCs.get(haulerId);
  if (!hauler || hauler.type !== 'scavenger_hauler') return null;

  const kingType = NPC_TYPES.scavenger_barnacle_king;
  const kingId = `npc_barnacle_king_${++npcIdCounter}`;
  const barnacleKing = {
    id: kingId,
    type: 'scavenger_barnacle_king',
    name: kingType.name,
    faction: kingType.faction,
    position: { x: hauler.position.x, y: hauler.position.y },
    velocity: { x: 0, y: 0 },
    x: hauler.position.x,
    y: hauler.position.y,
    vx: 0,
    vy: 0,
    rotation: hauler.rotation,
    hull: kingType.hull,
    hullMax: kingType.hull,
    maxHull: kingType.hull,
    shield: kingType.shield,
    shieldMax: kingType.shield,
    maxShield: kingType.shield,
    speed: kingType.speed,
    weaponType: kingType.weaponType,
    weaponTier: kingType.weaponTier,
    weaponDamage: kingType.weaponDamage,
    weaponRange: kingType.weaponRange,
    aggroRange: kingType.aggroRange,
    creditReward: kingType.creditReward,
    ...copyNpcTemplateSpecialFields(kingType),
    lastFireTime: 0,
    lastDamageTime: 0,
    state: 'patrol',
    targetId: null,
    targetPlayer: null,
    damageContributors: new Map(),
    carriedWreckage: hauler.carriedWreckage || [],
    homeBaseId: hauler.homeBaseId,
    homeBasePosition: hauler.homeBasePosition,
    patrolRadius: hauler.patrolRadius,
    patrolAngle: hauler.patrolAngle || Math.random() * Math.PI * 2,
    spawnPoint: hauler.spawnPoint
  };

  activeNPCs.set(kingId, barnacleKing);
  npcSpatialHash.insert(kingId, barnacleKing.position.x, barnacleKing.position.y);

  const base = hauler.homeBaseId ? activeBases.get(hauler.homeBaseId) : null;
  if (base?.spawnedNPCs) {
    const haulerIndex = base.spawnedNPCs.indexOf(haulerId);
    if (haulerIndex !== -1) {
      base.spawnedNPCs[haulerIndex] = kingId;
    } else if (!base.spawnedNPCs.includes(kingId)) {
      base.spawnedNPCs.push(kingId);
    }
    base.hasHauler = true;
  }

  activeNPCs.delete(haulerId);
  npcSpatialHash.remove(haulerId);
  ai.getScavengerStrategy()?.cleanup?.(haulerId);

  return barnacleKing;
}

// Mark a base as destroyed and orphan any defenders that survived the killing
// effect. Callers remove actual casualties first through removeNPC so cleanup,
// wreckage, and destruction broadcasts all describe the same set of entities.
function destroyBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return;

  base.destroyed = true;
  base.destroyedAt = Date.now();

  const orphanedNpcIds = [];
  for (const npcId of base.spawnedNPCs) {
    const survivingNpc = activeNPCs.get(npcId);
    if (!survivingNpc) continue;

    survivingNpc.homeBaseId = null;
    if (survivingNpc.baseId === baseId) survivingNpc.baseId = null;
    survivingNpc.homeBasePosition = null;
    const isDreadnought = survivingNpc.type === 'pirate_dreadnought';
    survivingNpc.orphaned = !isDreadnought;
    survivingNpc.orphanedAt = isDreadnought ? null : Date.now();
    survivingNpc.state = isDreadnought ? 'enraged' : 'rage';
    survivingNpc.baseAggroRange = survivingNpc.baseAggroRange || survivingNpc.aggroRange;
    survivingNpc.aggroRange = Math.round(
      survivingNpc.baseAggroRange * ORPHAN_RAGE_AGGRO_MULTIPLIER
    );
    survivingNpc.rageMultiplier = isDreadnought
      ? 1.5
      : ORPHAN_RAGE_DAMAGE_MULTIPLIER;
    orphanedNpcIds.push(npcId);
  }
  base.spawnedNPCs = [];

  return { orphanedNpcIds };
}

// Check if a destroyed base should respawn
function checkBaseRespawn(baseId) {
  const base = activeBases.get(baseId);
  if (!base || !base.destroyed) return false;

  const respawnTime = config.SPAWN_HUB_TYPES?.[base.type]?.respawnTime || 300000;
  const timeSinceDestruction = Date.now() - base.destroyedAt;

  if (timeSinceDestruction >= respawnTime) {
    const spawnConfig = base.spawnConfig || BASE_NPC_SPAWNS[base.type];
    const now = Date.now();

    // Respawn the base
    base.destroyed = false;
    base.health = base.maxHealth;
    base.damageContributors = new Map();
    base.lastSpawnTime = 0;
    base.pendingRespawns = Array.from(
      { length: Math.max(0, spawnConfig?.initialSpawn || 0) },
      () => ({ respawnAt: now })
    );

    // A respawn is a new base lifecycle. Reset finite faction economy and
    // one-per-life special spawn state before repopulating it.
    if (base.type === 'scavenger_yard') {
      base.scrapPile = { count: 0, contents: [] };
      base.hasHauler = false;
      base.isTransforming = false;
      delete base.pendingHaulerBroadcast;
    } else if (base.type === 'mining_claim') {
      base.claimCredits = 0;
      base.hasForeman = false;
    } else if (base.type === 'pirate_outpost') {
      base.dreadnoughtSpawned = false;
      const pirateStrategy = ai.getPirateStrategy();
      pirateStrategy?.spawnedDreadnoughts?.delete(baseId);
      pirateStrategy?.clearIntel?.(baseId);
    }

    logger.log(`[NPC] Base ${base.name} has respawned`);
    return true;
  }

  return false;
}

// Get all destroyed bases that are pending respawn
function getDestroyedBases() {
  const destroyed = [];
  for (const [baseId, base] of activeBases) {
    if (base.destroyed) {
      const respawnTime = config.SPAWN_HUB_TYPES?.[base.type]?.respawnTime || 300000;
      const timeSinceDestruction = Date.now() - base.destroyedAt;
      const timeRemaining = respawnTime - timeSinceDestruction;
      destroyed.push({
        ...base,
        timeRemaining: Math.max(0, timeRemaining)
      });
    }
  }
  return destroyed;
}

// Get all active (non-destroyed) bases within range of a position
// Returns bases where edge (center - size) is within range
// Uses computed positions for orbital bases and binary star systems
function getBasesInRange(position, range) {
  const basesInRange = [];
  for (const [baseId, base] of activeBases) {
    if (base.destroyed) continue;

    // Compute current position (handles orbital bases and binary star movement)
    const currentPos = world.getObjectPosition(baseId);
    const baseX = currentPos ? currentPos.x : base.x;
    const baseY = currentPos ? currentPos.y : base.y;

    const dx = baseX - position.x;
    const dy = baseY - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const baseSize = base.size || 100;

    // Check if edge of base (not center) is within range
    // effectiveDistance = dist - baseSize, check if <= range
    // Equivalent: dist <= range + baseSize
    if (dist - baseSize <= range) {
      const baseData = {
        id: baseId,
        x: baseX,
        y: baseY,
        size: baseSize,
        position: { x: baseX, y: baseY },
        health: base.health,
        maxHealth: base.maxHealth,
        faction: base.faction,
        type: base.type,
        name: base.name,
        scrapPile: base.scrapPile || null,
        claimCredits: base.claimCredits || 0
      };

      // AI receives a lightweight view of each base. Primitive values such as
      // claimCredits would otherwise be copied and pirate theft would mutate
      // only that temporary view. Keep the mutation hook non-enumerable so it
      // is available to server AI but never enters Socket.io payloads.
      if (base.type === 'mining_claim') {
        Object.defineProperty(baseData, 'consumeClaimCredits', {
          enumerable: false,
          value(requestedAmount) {
            if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) return 0;
            const available = Number.isSafeInteger(base.claimCredits) ? base.claimCredits : 0;
            const consumed = Math.min(available, requestedAmount);
            base.claimCredits = available - consumed;
            baseData.claimCredits = base.claimCredits;
            return consumed;
          }
        });
      }

      // Include orbital parameters for client-side position prediction
      if (base.orbitRadius && base.orbitSpeed) {
        baseData.isOrbital = true;
        baseData.orbitRadius = base.orbitRadius;
        baseData.orbitSpeed = base.orbitSpeed;
        baseData.orbitAngle = base.orbitAngle || 0;
        baseData.starX = base.starX;
        baseData.starY = base.starY;
        baseData.starId = base.starId;
      }

      basesInRange.push(baseData);
    }
  }
  return basesInRange;
}

/**
 * Get all active (non-destroyed) bases for a specific faction
 * @param {string} faction - Faction name (e.g., 'pirate', 'scavenger')
 * @returns {Array} Array of bases for that faction
 */
function getActiveBasesByFaction(faction) {
  const factionBases = [];
  for (const [baseId, base] of activeBases) {
    if (base.destroyed) continue;
    if (base.faction === faction) {
      // Compute current position for orbital bases
      const currentPos = world.getObjectPosition(baseId);
      factionBases.push({
        id: baseId,
        x: currentPos ? currentPos.x : base.x,
        y: currentPos ? currentPos.y : base.y,
        size: base.size || 100,
        faction: base.faction,
        type: base.type,
        name: base.name,
        destroyed: base.destroyed
      });
    }
  }
  return factionBases;
}

function generateSpawnPoints(sectorX, sectorY) {
  const key = `${sectorX}_${sectorY}`;
  if (sectorSpawnPoints.has(key)) {
    return sectorSpawnPoints.get(key);
  }

  // No NPCs in the origin sector (player spawn area)
  if (sectorX === 0 && sectorY === 0) {
    sectorSpawnPoints.set(key, []);
    return [];
  }

  // Use seeded random for deterministic spawn points
  const seed = hashSector(sectorX, sectorY);
  const rng = seededRandom(seed);

  const spawnPoints = [];

  // 10% chance of spawns in each sector (reduced from 20%)
  // Only pirate scouts spawn in sectors - they patrol looking for targets
  // Fighters/captains only spawn from pirate outpost bases
  if (rng() < 0.1) {
    const count = Math.floor(rng() * 2) + 1; // 1-2 spawn points (reduced from 1-3)
    for (let i = 0; i < count; i++) {
      const x = sectorX * config.SECTOR_SIZE + rng() * config.SECTOR_SIZE;
      const y = sectorY * config.SECTOR_SIZE + rng() * config.SECTOR_SIZE;

      // Only scouts patrol sectors - they report intel back to bases
      // Fighters stay near bases, captains only spawn from intel
      spawnPoints.push({ x, y, type: 'pirate_scout' });
    }
  }

  sectorSpawnPoints.set(key, spawnPoints);
  return spawnPoints;
}

function spawnNPCsForSector(sectorX, sectorY) {
  const spawnPoints = generateSpawnPoints(sectorX, sectorY);
  const spawned = [];
  const now = Date.now();

  for (const point of spawnPoints) {
    // Check if NPC already exists at this spawn point
    // Note: Some NPCs (queen, base-spawned) don't have spawnPoint, so check for it
    const existing = [...activeNPCs.values()].find(npc =>
      npc.spawnPoint &&
      Math.abs(npc.spawnPoint.x - point.x) < 10 &&
      Math.abs(npc.spawnPoint.y - point.y) < 10
    );

    if (existing) continue;

    // Check if spawn point is on respawn cooldown
    const spawnKey = `${Math.round(point.x)}_${Math.round(point.y)}`;
    const deadPoint = deadSpawnPoints.get(spawnKey);
    if (deadPoint) {
      if (now < deadPoint.respawnAt) {
        continue; // Still on cooldown
      } else {
        // Cooldown expired, remove from dead list
        deadSpawnPoints.delete(spawnKey);
      }
    }

    const npcTypeData = NPC_TYPES[point.type];
    const npcId = `npc_${++npcIdCounter}`;

    const npc = {
      id: npcId,
      type: point.type,
      name: npcTypeData.name,
      faction: npcTypeData.faction,
      position: { x: point.x, y: point.y },
      velocity: { x: 0, y: 0 },
      rotation: Math.random() * Math.PI * 2,
      hull: npcTypeData.hull,
      hullMax: npcTypeData.hull,
      shield: npcTypeData.shield,
      shieldMax: npcTypeData.shield,
      speed: npcTypeData.speed,
      weaponType: npcTypeData.weaponType,
      weaponTier: npcTypeData.weaponTier,
      weaponDamage: npcTypeData.weaponDamage,
      weaponRange: npcTypeData.weaponRange,
      aggroRange: npcTypeData.aggroRange,
      creditReward: npcTypeData.creditReward,
      ...copyNpcTemplateSpecialFields(npcTypeData),
      spawnPoint: { ...point },
      sectorSpawned: true, // Flag to track sector-spawned NPCs even after base reassignment
      state: 'patrol',
      targetPlayer: null,
      lastFireTime: 0,
      lastDamageTime: 0,
      patrolAngle: Math.random() * Math.PI * 2,
      damageContributors: new Map()
    };

    activeNPCs.set(npcId, npc);
    npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);
    spawned.push(npc);
  }

  return spawned;
}

/**
 * Update NPC AI using faction-specific strategy
 * @param {Object} npc - NPC to update
 * @param {Array} players - All nearby players
 * @param {number} deltaTime - Time since last update in ms
 * @returns {Object|null} Action result (fire, warning, etc.)
 */
function updateNPC(npc, players, deltaTime) {
  // Direct/test callers and older engine integrations still receive correct
  // orbital attachment authority. The engine also invokes this before its
  // simulation gate so range and velocity use the re-anchored position.
  if (npc.attachedToBase) reanchorAttachedDrone(npc);

  // Check if orphaned NPC has exceeded rage duration - needs to despawn
  if (npc.orphaned && npc.orphanedAt) {
    const rageElapsed = Date.now() - npc.orphanedAt;
    if (rageElapsed >= ORPHAN_RAGE_DURATION) {
      return {
        action: 'despawn',
        reason: 'rage_expired',
        npcId: npc.id
      };
    }
  }

  // Refresh homeBasePosition with current orbital position
  if (npc.homeBaseId) {
    const currentPos = world.getObjectPosition(npc.homeBaseId);
    if (currentPos) {
      npc.homeBasePosition = currentPos;
    }
  }

  // Use the new AI system for faction-specific behavior
  // Pass getActiveBaseWithPosition for scavengers, getBasesInRange for pirates
  return ai.updateNPCAI(npc, players, activeNPCs, deltaTime, getActiveBaseWithPosition, getBasesInRange, npcSpatialHash);
}

/**
 * Legacy updateNPC for backwards compatibility (if needed)
 * Uses simple chase-and-shoot behavior
 */
function updateNPCLegacy(npc, players, deltaTime) {
  // Find nearest player in aggro range
  let nearestPlayer = null;
  let nearestDist = npc.aggroRange;

  for (const player of players) {
    const dx = player.position.x - npc.position.x;
    const dy = player.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPlayer = player;
    }
  }

  if (nearestPlayer) {
    npc.state = 'chase';
    npc.targetPlayer = nearestPlayer.id;

    // Move towards player
    const dx = nearestPlayer.position.x - npc.position.x;
    const dy = nearestPlayer.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      // Update rotation to face player
      npc.rotation = Math.atan2(dy, dx);

      // Move towards player (stop at weapon range)
      if (dist > npc.weaponRange * 0.8) {
        const moveSpeed = npc.speed * (deltaTime / 1000);
        npc.position.x += (dx / dist) * moveSpeed;
        npc.position.y += (dy / dist) * moveSpeed;
      }
    }

    // Try to fire
    const canFire = Date.now() - npc.lastFireTime > 1000; // 1 second cooldown
    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();
      return {
        action: 'fire',
        target: nearestPlayer,
        weaponType: npc.weaponType,
        weaponTier: npc.weaponTier,
        baseDamage: npc.weaponDamage
      };
    }
  } else {
    npc.state = 'patrol';
    npc.targetPlayer = null;

    // Patrol around spawn point
    const patrolRadius = 200;
    const patrolSpeed = npc.speed * 0.3 * (deltaTime / 1000);

    npc.patrolAngle += 0.5 * (deltaTime / 1000);
    const targetX = npc.spawnPoint.x + Math.cos(npc.patrolAngle) * patrolRadius;
    const targetY = npc.spawnPoint.y + Math.sin(npc.patrolAngle) * patrolRadius;

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    }
  }

  return null;
}

// Team bonus multipliers based on participant count
const TEAM_MULTIPLIERS = {
  1: 1.0,   // Solo: 100%
  2: 1.5,   // Duo: 150% (75% each)
  3: 2.0,   // Trio: 200% (66% each)
  4: 2.5    // Squad: 250% (62.5% each)
};

function damageNPC(npcId, damage, attackerId = null, options = {}) {
  const npc = activeNPCs.get(npcId);
  if (!npc) return null;

  const totalIncomingDamage = Math.max(0, Number(damage) || 0);
  const sourceNpcId = options?.sourceNpcId ?? null;
  const reactionAttackerId = sourceNpcId ?? attackerId;
  const attackerType = sourceNpcId !== null && sourceNpcId !== undefined
    ? 'npc'
    : 'player';
  const shieldPiercing = Math.max(
    0,
    Math.min(1, Number(options?.shieldPiercing) || 0)
  );

  // Only player damage participates in player reward attribution. NPC attackers
  // still retain their identity for retaliation and target acquisition.
  if (attackerId !== null && attackerId !== undefined &&
      (sourceNpcId === null || sourceNpcId === undefined)) {
    const currentDamage = npc.damageContributors.get(attackerId) || 0;
    npc.damageContributors.set(attackerId, currentDamage + totalIncomingDamage);
  }

  // Record damage time for shield recharge delay
  npc.lastDamageTime = Date.now();

  // Strategy hooks may mutate behavior immediately and optionally return an
  // action for the engine to broadcast. Keep the legacy rageAction contract
  // while exposing the faction-neutral reactionAction alongside it.
  let rageAction = null;
  let reactionAction = null;
  if (npc.faction === 'scavenger' && reactionAttackerId !== null &&
      reactionAttackerId !== undefined) {
    // Find nearby allies for rage spreading
    const nearbyAllies = [];
    for (const [id, ally] of activeNPCs) {
      if (id === npc.id) continue;
      if (ally.faction !== 'scavenger') continue;

      const dx = ally.position.x - npc.position.x;
      const dy = ally.position.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 1000) { // RAGE_SPREAD_RANGE
        nearbyAllies.push(ally);
      }
    }

    // Call scavenger AI's onDamaged to trigger rage
    const scavengerStrategy = ai.getScavengerStrategy();
    if (scavengerStrategy && scavengerStrategy.onDamaged) {
      rageAction = scavengerStrategy.onDamaged(
        npc,
        reactionAttackerId,
        nearbyAllies,
        attackerType
      );
      reactionAction = rageAction;
    }
  }

  // Trigger rogue miner rage when damaged (spreads to ALL miners within 3000 units)
  if (npc.faction === 'rogue_miner' && reactionAttackerId !== null &&
      reactionAttackerId !== undefined) {
    const miningStrategy = ai.getMiningStrategy();
    if (miningStrategy && miningStrategy.onDamaged) {
      rageAction = miningStrategy.onDamaged(
        npc,
        reactionAttackerId,
        activeNPCs,
        attackerType
      );
      reactionAction = rageAction;
    }
  }

  // Pirate reactions are strategy-owned (target acquisition, coordinated
  // movement, etc.) even though they do not use the scavenger rage event.
  if (npc.faction === 'pirate' && reactionAttackerId !== null &&
      reactionAttackerId !== undefined) {
    const pirateStrategy = ai.getPirateStrategy();
    if (pirateStrategy?.onDamaged) {
      reactionAction = pirateStrategy.onDamaged(
        npc,
        reactionAttackerId,
        activeNPCs
      );
    }
  }

  const hitShield = npc.shield > 0;
  const piercingDamage = hitShield
    ? totalIncomingDamage * shieldPiercing
    : 0;
  let absorbableDamage = totalIncomingDamage - piercingDamage;

  // Apply the non-piercing portion to shields first.
  if (hitShield) {
    if (absorbableDamage <= npc.shield) {
      npc.shield -= absorbableDamage;
      absorbableDamage = 0;
    } else {
      absorbableDamage -= npc.shield;
      npc.shield = 0;
    }
  }

  // Shield overflow and the configured piercing fraction damage hull.
  npc.hull -= absorbableDamage + piercingDamage;

  if (npc.hull <= 0) {
    // NPC died - generate loot using pool system and calculate team rewards
    const loot = LootPools.generateLoot(npc.type);
    const participants = Array.from(npc.damageContributors.keys());
    const participantCount = Math.max(1, participants.length);
    const teamMultiplier = TEAM_MULTIPLIERS[Math.min(participantCount, 4)] || 2.5;

    // Calculate credit rewards per player
    const totalCredits = Math.round(npc.creditReward * teamMultiplier);
    const creditsPerPlayer = Math.round(totalCredits / participantCount);

    // Mark spawn point as dead for respawn delay (sector-spawned NPCs only)
    // Use sectorSpawned flag instead of !homeBaseId because scouts may get reassigned
    // to a base when fleeing but still need their original spawn point tracked
    if (npc.spawnPoint && npc.sectorSpawned) {
      const spawnKey = `${Math.round(npc.spawnPoint.x)}_${Math.round(npc.spawnPoint.y)}`;
      deadSpawnPoints.set(spawnKey, {
        respawnAt: Date.now() + SECTOR_NPC_RESPAWN_DELAY
      });
    }

    // Reset the special scavenger lifecycle when either stage dies.
    if ((npc.type === 'scavenger_hauler' ||
         npc.type === 'scavenger_barnacle_king') && npc.homeBaseId) {
      const base = activeBases.get(npc.homeBaseId);
      if (base) {
        base.hasHauler = false;
        if (base.pendingHaulerBroadcast?.haulerId === npcId) {
          delete base.pendingHaulerBroadcast;
        }
        logger.log(`[SCAVENGER] ${npc.type} ${npcId} died, base ${base.name} can spawn a new Hauler`);
      }
    }

    // Reset hasForeman flag if a Foreman died
    if (npc.type === 'rogue_foreman' && npc.homeBaseId) {
      const base = activeBases.get(npc.homeBaseId);
      if (base && base.hasForeman) {
        base.hasForeman = false;
        logger.log(`[ROGUE_MINER] Foreman ${npcId} died, base ${base.name} can spawn new Foreman`);
      }
    }

    // Note: Void Leviathan spawn check is handled by engine.js after damageNPC returns,
    // to avoid setting leviathanSpawnPending before the engine can act on it.

    // Log if this was an attached worm being killed
    if (npc.attachedToBase) {
      logger.warn(`[WORM_KILLED] Attached worm ${npcId} killed while attached to base ${npc.attachedToBase}. Killer: ${reactionAttackerId}`);
    }

    rememberBaseNpcCombatDeath(npc);
    finalizeNpcRegistryRemoval(npc, { deferLeaderSuccession: true });

    return {
      destroyed: true,
      loot,
      participants,
      participantCount,
      teamMultiplier,
      totalCredits,
      creditsPerPlayer,
      faction: npc.faction,
      reactionAction
    };
  }

  return {
    destroyed: false,
    hull: npc.hull,
    shield: npc.shield,
      hitShield,
      shieldPierced: piercingDamage > 0,
      piercingDamage,
    rageAction,
    reactionAction
  };
}

// Note: generateLoot removed - now using LootPools.generateLoot() for centralized loot generation

/**
 * Get NPCs within range of a position using spatial hash for O(k) lookup
 * @param {Object} position - {x, y} position to query from
 * @param {number} range - Query radius
 * @returns {Array} NPCs within range with distance property added
 */
function getNPCsInRange(position, range) {
  const result = [];
  const rangeSq = range * range; // Avoid sqrt in hot path

  // Query spatial hash for candidate NPCs
  const candidates = npcSpatialHash.query(position.x, position.y, range);

  for (const id of candidates) {
    const npc = activeNPCs.get(id);
    // Defensive validation: skip invalid/dead NPCs
    if (!npc || !npc.position || npc.hull <= 0) continue;

    const dx = npc.position.x - position.x;
    const dy = npc.position.y - position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= rangeSq) {
      result.push({ ...npc, distance: Math.sqrt(distSq) });
    }
  }
  return result;
}

/**
 * Notify the nearest scavenger cluster that a player completed a wreckage
 * collection. Scrap Siphon is deliberately passed through the strategy hook so
 * its immunity is enforced by the same behavior that would otherwise enrage
 * the cluster.
 *
 * @returns {{npc: Object, action: Object|null, ignored: boolean}|null}
 */
function notifyWreckageCollectedNearby(playerId, playerPosition, hasScrapSiphon = false) {
  const numericPlayerId = Number(playerId);
  if (!Number.isSafeInteger(numericPlayerId) || numericPlayerId <= 0 ||
      !playerPosition || !Number.isFinite(playerPosition.x) ||
      !Number.isFinite(playerPosition.y)) {
    return null;
  }

  const scavengerStrategy = ai.getScavengerStrategy();
  if (!scavengerStrategy?.onWreckageCollectedNearby) return null;

  const theftRange = Math.max(
    0,
    Number(scavengerStrategy.WRECKAGE_THEFT_RANGE) || 300
  );
  let nearest = null;
  let nearestDistanceSq = Infinity;

  for (const candidate of activeNPCs.values()) {
    if (candidate.faction !== 'scavenger' || candidate.hull <= 0 || !candidate.position) continue;
    const dx = candidate.position.x - playerPosition.x;
    const dy = candidate.position.y - playerPosition.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq <= theftRange * theftRange && distanceSq < nearestDistanceSq) {
      nearest = candidate;
      nearestDistanceSq = distanceSq;
    }
  }

  if (!nearest) return null;

  const spreadRange = Math.max(
    0,
    Number(scavengerStrategy.RAGE_SPREAD_RANGE) || 1000
  );
  const nearbyAllies = [];
  for (const candidate of activeNPCs.values()) {
    if (candidate === nearest || candidate.faction !== 'scavenger' ||
        candidate.hull <= 0 || !candidate.position) continue;
    const dx = candidate.position.x - nearest.position.x;
    const dy = candidate.position.y - nearest.position.y;
    if (dx * dx + dy * dy <= spreadRange * spreadRange) {
      nearbyAllies.push(candidate);
    }
  }

  const action = scavengerStrategy.onWreckageCollectedNearby(
    nearest,
    numericPlayerId,
    playerPosition,
    nearbyAllies,
    hasScrapSiphon === true
  );

  return {
    npc: nearest,
    action: action || null,
    ignored: hasScrapSiphon === true && !action
  };
}

/**
 * Rebuild the NPC spatial hash from activeNPCs
 * Kept as a safety net but no longer called every tick.
 * Use incremental insert/update/remove instead.
 */
function rebuildNPCSpatialHash() {
  npcSpatialHash.rebuild(activeNPCs);
}

/**
 * Incrementally update a single NPC's position in the spatial hash.
 * No-op if the NPC is still in the same cell (cell size 200u).
 * @param {string|number} id - NPC ID
 * @param {Object} entity - NPC entity with {position: {x, y}}
 */
function updateNPCInHash(id, entity) {
  if (entity && entity.position) {
    npcSpatialHash.update(id, entity.position.x, entity.position.y);
  }
}

/**
 * Insert a single NPC into the spatial hash (for spawning).
 * @param {string|number} id - NPC ID
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 */
function insertNPCInHash(id, x, y) {
  npcSpatialHash.insert(id, x, y);
}

/**
 * Remove a single NPC from the spatial hash (for despawning/death).
 * @param {string|number} id - NPC ID
 */
function removeNPCFromHash(id) {
  npcSpatialHash.remove(id);
}

// Update NPC shield recharge
function updateNPCShieldRecharge(npc, deltaTime) {
  // Check if enough time has passed since last damage
  const timeSinceDamage = Date.now() - (npc.lastDamageTime || 0);
  if (timeSinceDamage < config.SHIELD_RECHARGE_DELAY) {
    return false; // Still in recharge delay
  }

  // Check if shields need recharging
  if (npc.shield >= npc.shieldMax) {
    return false; // Already full
  }

  // Recharge shields
  const rechargeAmount = config.SHIELD_RECHARGE_RATE * (deltaTime / 1000);
  npc.shield = Math.min(npc.shieldMax, npc.shield + rechargeAmount);

  return true; // Shield was recharged
}

function getNPC(npcId) {
  return activeNPCs.get(npcId);
}

// Helper functions
function hashSector(x, y) {
  let h = 0;
  const str = `${config.GALAXY_SEED}_npc_${x}_${y}`;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = Math.sin(s * 9999) * 10000;
    return s - Math.floor(s);
  };
}

/**
 * Apply linked damage to nearby swarm units
 * @param {Object} damagedNpc - The NPC that took damage
 * @param {number} damage - Amount of damage dealt
 * @param {string|number|null} attackerId - Player credited for linked damage
 * @returns {Array} List of affected NPCs with damage info
 */
function applySwarmLinkedDamage(damagedNpc, damage, attackerId = null) {
  if (!damagedNpc.linkedHealth || damagedNpc.faction !== 'swarm') {
    return [];
  }
  if (!Number.isFinite(damage) || damage <= 0) return [];

  const linkedDamage = damage * 0.2; // 20% of damage spreads
  const affected = [];

  for (const [id, linkedNpc] of activeNPCs) {
    if (id === damagedNpc.id) continue;
    if (linkedNpc.faction !== 'swarm') continue;
    if (!linkedNpc.linkedHealth || linkedNpc.hull <= 0) continue;

    // Check distance
    const dx = linkedNpc.position.x - damagedNpc.position.x;
    const dy = linkedNpc.position.y - damagedNpc.position.y;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared <= 300 * 300) { // Linked within 300 units
      linkedNpc.hull = Math.max(0, linkedNpc.hull - linkedDamage);
      linkedNpc.lastDamageTime = Date.now();
      if (attackerId) {
        linkedNpc.damageContributors = linkedNpc.damageContributors || new Map();
        const contributed = linkedNpc.damageContributors.get(attackerId) || 0;
        linkedNpc.damageContributors.set(attackerId, contributed + linkedDamage);
      }

      const destroyed = linkedNpc.hull <= 0;
      if (destroyed && linkedNpc.spawnPoint && linkedNpc.sectorSpawned) {
        const spawnKey = `${Math.round(linkedNpc.spawnPoint.x)}_${Math.round(linkedNpc.spawnPoint.y)}`;
        deadSpawnPoints.set(spawnKey, {
          respawnAt: Date.now() + SECTOR_NPC_RESPAWN_DELAY
        });
      }

      affected.push({
        id: linkedNpc.id,
        damage: linkedDamage,
        destroyed,
        hull: linkedNpc.hull,
        hullMax: linkedNpc.hullMax,
        position: { x: linkedNpc.position.x, y: linkedNpc.position.y },
        entity: linkedNpc
      });
    }
  }

  return affected;
}

// ============================================
// SWARM QUEEN SPAWNING MECHANICS
// ============================================

// Queen spawn configuration
const QUEEN_SPAWN_CONFIG = {
  maxMinions: 12,                    // Max alive minions per queen
  spawnCooldown: 15000,              // 15 seconds between spawns
  healthThresholds: [0.75, 0.5, 0.25], // Spawn at these health percentages
  combatSpawnDelay: 10000,           // Wait 10s in combat before time-based spawns
  unitsPerSpawn: { min: 2, max: 4 }, // Units spawned each time
  spawnTypes: {
    swarm_drone: 0.7,   // 70% chance
    swarm_worker: 0.2,  // 20% chance
    swarm_warrior: 0.1  // 10% chance
  }
};

function getQueenTimedSpawnCooldown(queen) {
  const phase = queen.phaseManager?.currentPhase;
  const configuredMultiplier = CONSTANTS.SWARM_QUEEN_PHASE_MODIFIERS?.[phase]?.spawnRateMultiplier;

  if (configuredMultiplier === 0) return Infinity;
  if (!Number.isFinite(configuredMultiplier) || configuredMultiplier < 0) {
    return QUEEN_SPAWN_CONFIG.spawnCooldown;
  }

  // Cap unexpected configuration to prevent a corrupted value from creating
  // an unbounded spawn loop. Current phase values are all at or below 3x.
  const safeMultiplier = Math.min(configuredMultiplier, 10);
  return QUEEN_SPAWN_CONFIG.spawnCooldown / safeMultiplier;
}

/**
 * Initialize queen spawn tracking data on NPC
 * @param {Object} npc - Queen NPC to initialize
 */
function initQueenSpawnData(npc) {
  if (!npc.spawnsUnits) return;

  npc.spawnedMinions = npc.spawnedMinions || [];
  npc.lastSpawnTime = npc.lastSpawnTime || 0;
  npc.combatStartTime = npc.combatStartTime || null;
  npc.lastHealthThreshold = npc.lastHealthThreshold || 1.0;
  npc.spawnThresholdsTriggered = npc.spawnThresholdsTriggered || [];
}

/**
 * Select random minion type based on spawn weights
 * @returns {string} NPC type to spawn
 */
function selectMinionType() {
  const roll = Math.random();
  let cumulative = 0;

  for (const [type, weight] of Object.entries(QUEEN_SPAWN_CONFIG.spawnTypes)) {
    cumulative += weight;
    if (roll <= cumulative) {
      return type;
    }
  }
  return 'swarm_drone'; // Fallback
}

/**
 * Spawn minion units for a Swarm Queen
 * @param {Object} queen - The queen spawning minions
 * @param {number} count - Number of minions to spawn
 * @returns {Array} Spawned NPC data for broadcasting
 */
function spawnQueenMinions(queen, count) {
  initQueenSpawnData(queen);

  // Remove dead minions from tracking
  queen.spawnedMinions = queen.spawnedMinions.filter(id => activeNPCs.has(id));

  // Check if at max minions
  const canSpawn = QUEEN_SPAWN_CONFIG.maxMinions - queen.spawnedMinions.length;
  if (canSpawn <= 0) return [];

  const spawnCount = Math.min(count, canSpawn);
  const spawned = [];

  for (let i = 0; i < spawnCount; i++) {
    const minionType = selectMinionType();
    const typeData = NPC_TYPES[minionType];
    if (!typeData) continue;

    const minionId = `npc_${++npcIdCounter}`;

    // Spawn position - emerge from queen
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 30; // 40-70 units from queen
    const spawnX = queen.position.x + Math.cos(angle) * dist;
    const spawnY = queen.position.y + Math.sin(angle) * dist;

    const minion = {
      id: minionId,
      type: minionType,
      name: typeData.name,
      faction: typeData.faction,
      position: { x: spawnX, y: spawnY },
      rotation: Math.random() * Math.PI * 2,
      velocity: { x: 0, y: 0 },
      hull: typeData.hull,
      hullMax: typeData.hull,
      shield: typeData.shield || 0,
      shieldMax: typeData.shield || 0,
      speed: typeData.speed,
      aggroRange: typeData.aggroRange,
      weaponType: typeData.weaponType,
      weaponTier: typeData.weaponTier,
      weaponDamage: typeData.weaponDamage,
      weaponRange: typeData.weaponRange,
      creditReward: typeData.creditReward,
      ...copyNpcTemplateSpecialFields(typeData),
      state: 'idle',
      target: queen.target, // Inherit queen's target
      lastFireTime: 0,
      damageContributors: new Map(),
      spawnPoint: { x: spawnX, y: spawnY },
      spawnedBy: queen.id
    };

    activeNPCs.set(minionId, minion);
    npcSpatialHash.insert(minionId, minion.position.x, minion.position.y);
    queen.spawnedMinions.push(minionId);

    spawned.push({
      id: minionId,
      type: minionType,
      name: minion.name,
      faction: minion.faction,
      x: minion.position.x,
      y: minion.position.y,
      rotation: minion.rotation,
      hull: minion.hull,
      hullMax: minion.hullMax,
      shield: minion.shield,
      shieldMax: minion.shieldMax,
      queenId: queen.id // For client-side spawn effect
    });
  }

  queen.lastSpawnTime = Date.now();
  return spawned;
}

/**
 * Update Swarm Queen spawning logic
 * Call this from the game loop for each queen with nearby players
 * @param {Object} queen - Queen NPC
 * @param {Array} nearbyPlayers - Players within aggro range
 * @param {number} deltaTime - Time since last update in ms
 * @returns {Object|null} Spawn event data if spawning occurred
 */
function updateSwarmQueenSpawning(queen, nearbyPlayers, deltaTime) {
  if (!queen.spawnsUnits || queen.type !== 'swarm_queen') return null;

  initQueenSpawnData(queen);

  const now = Date.now();
  const healthPercent = queen.hull / queen.hullMax;

  // No players nearby - reset combat state
  if (!nearbyPlayers || nearbyPlayers.length === 0) {
    queen.combatStartTime = null;
    return null;
  }

  // Start combat tracking if not started
  if (!queen.combatStartTime) {
    queen.combatStartTime = now;

    // First target triggers initial spawn
    const spawnCount = QUEEN_SPAWN_CONFIG.unitsPerSpawn.min +
      Math.floor(Math.random() * (QUEEN_SPAWN_CONFIG.unitsPerSpawn.max - QUEEN_SPAWN_CONFIG.unitsPerSpawn.min + 1));
    const spawned = spawnQueenMinions(queen, spawnCount);

    if (spawned.length > 0) {
      return { type: 'combat_start', spawned };
    }
  }

  // Check health threshold spawns
  for (const threshold of QUEEN_SPAWN_CONFIG.healthThresholds) {
    if (healthPercent <= threshold && !queen.spawnThresholdsTriggered.includes(threshold)) {
      queen.spawnThresholdsTriggered.push(threshold);

      const spawnCount = QUEEN_SPAWN_CONFIG.unitsPerSpawn.min +
        Math.floor(Math.random() * (QUEEN_SPAWN_CONFIG.unitsPerSpawn.max - QUEEN_SPAWN_CONFIG.unitsPerSpawn.min + 1));
      const spawned = spawnQueenMinions(queen, spawnCount);

      if (spawned.length > 0) {
        return { type: 'health_threshold', threshold, spawned };
      }
    }
  }

  // Check time-based spawning. Queen phases can slow, accelerate, or disable
  // this cadence through their spawnRateMultiplier.
  const combatDuration = now - queen.combatStartTime;
  if (combatDuration > QUEEN_SPAWN_CONFIG.combatSpawnDelay) {
    const spawnCooldown = getQueenTimedSpawnCooldown(queen);
    if (now - queen.lastSpawnTime >= spawnCooldown) {
      const spawnCount = QUEEN_SPAWN_CONFIG.unitsPerSpawn.min +
        Math.floor(Math.random() * (QUEEN_SPAWN_CONFIG.unitsPerSpawn.max - QUEEN_SPAWN_CONFIG.unitsPerSpawn.min + 1));
      const spawned = spawnQueenMinions(queen, spawnCount);

      if (spawned.length > 0) {
        return { type: 'time_interval', spawned };
      }
    }
  }

  return null;
}

/**
 * Get all minions spawned by a queen
 * @param {string} queenId - Queen's ID
 * @returns {Array} List of minion NPCs
 */
function getQueenMinions(queenId) {
  const queen = activeNPCs.get(queenId);
  if (!queen || !queen.spawnedMinions) return [];

  return queen.spawnedMinions
    .filter(id => activeNPCs.has(id))
    .map(id => activeNPCs.get(id));
}

/**
 * Check if a swarm NPC is still hatching (egg phase)
 * Hatching eggs should not move, have AI, or drop wreckage when destroyed
 * @param {Object} npcEntity - The NPC to check
 * @returns {boolean} True if the NPC is still in hatching state
 */
function isHatching(npcEntity) {
  if (!npcEntity) return false;
  if (npcEntity.faction !== 'swarm') return false;
  if (!npcEntity.hatchTime) return false;

  const elapsed = Date.now() - npcEntity.hatchTime;
  return elapsed < (npcEntity.hatchDuration || config.SWARM_HATCHING?.HATCH_DURATION || 2500);
}

// ============================================================================
// ROGUE MINER DEPOSIT AND DYNAMIC SPAWNING SYSTEM
// ============================================================================

/**
 * Handle rogue miner haul deposit - may trigger spawns
 * @param {string} baseId - The mining claim base ID
 * @param {string} npcType - Type of NPC that deposited ('rogue_prospector', 'rogue_driller', 'rogue_excavator')
 * @param {number} creditBonus - Credits added to claim reward
 * @returns {Object} Result with spawn info if applicable
 */
function handleRogueMinerDeposit(baseId, npcType, creditBonus) {
  const base = activeBases.get(baseId);
  if (!base || base.type !== 'mining_claim') {
    return { success: false, reason: 'Invalid base' };
  }

  // Initialize tracking if needed
  if (typeof base.claimCredits !== 'number') base.claimCredits = 0;
  if (typeof base.hasForeman !== 'boolean') base.hasForeman = false;

  // Add credits to claim
  base.claimCredits += creditBonus;

  logger.log(`[ROGUE_MINER] ${npcType} deposited at ${base.name}: +${creditBonus} credits (total: ${base.claimCredits})`);

  // Check for spawn conditions
  let spawnResult = null;

  if (npcType === 'rogue_prospector' || npcType === 'rogue_driller') {
    // 5-10% chance to spawn Excavator
    const spawnChance = 0.05 + Math.random() * 0.05; // 5-10%
    if (Math.random() < spawnChance) {
      spawnResult = spawnRogueMinerNPC(baseId, 'rogue_excavator');
      if (spawnResult) {
        logger.log(`[ROGUE_MINER] Excavator spawned from ${npcType} deposit!`);
      }
    }
  } else if (npcType === 'rogue_excavator') {
    // 10% chance to spawn Foreman (only if none exists)
    if (!base.hasForeman && Math.random() < 0.10) {
      spawnResult = spawnRogueMinerNPC(baseId, 'rogue_foreman');
      if (spawnResult) {
        base.hasForeman = true;
        spawnResult.isForeman = true;
        logger.log(`[ROGUE_MINER] FOREMAN spawned from Excavator deposit!`);
      }
    }
  }

  return {
    success: true,
    baseId,
    claimCredits: base.claimCredits,
    spawnResult
  };
}

/**
 * Spawn a specific rogue miner NPC type at a mining claim
 * @param {string} baseId - The mining claim base ID
 * @param {string} npcType - The NPC type to spawn
 * @returns {Object|null} The spawned NPC or null
 */
function spawnRogueMinerNPC(baseId, npcType) {
  const base = activeBases.get(baseId);
  if (!base || base.type !== 'mining_claim') {
    return null;
  }

  const spawnConfig = BASE_NPC_SPAWNS[base.type];
  if (!spawnConfig) return null;

  // Check max capacity (allow +1 for Foreman)
  const maxAllowed = npcType === 'rogue_foreman' ? spawnConfig.maxNPCs + 1 : spawnConfig.maxNPCs;
  if (base.spawnedNPCs && base.spawnedNPCs.length >= maxAllowed) {
    return null;
  }

  const npcTypeData = NPC_TYPES[npcType];
  if (!npcTypeData) {
    logger.error(`[ROGUE_MINER] Unknown NPC type: ${npcType}`);
    return null;
  }

  const npcId = `npc_${++npcIdCounter}`;

  // Get current position for base (may be orbital)
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  // Spawn near base
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = 50 + Math.random() * 50; // 50-100 units from base
  const spawnX = baseX + Math.cos(spawnAngle) * spawnDist;
  const spawnY = baseY + Math.sin(spawnAngle) * spawnDist;

  const npc = {
    id: npcId,
    type: npcType,
    name: npcTypeData.name,
    faction: npcTypeData.faction,
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    rotation: Math.random() * Math.PI * 2,
    hull: npcTypeData.hull,
    hullMax: npcTypeData.hull,
    shield: npcTypeData.shield,
    shieldMax: npcTypeData.shield,
    speed: npcTypeData.speed,
    weaponType: npcTypeData.weaponType,
    weaponTier: npcTypeData.weaponTier,
    weaponDamage: npcTypeData.weaponDamage,
    weaponRange: npcTypeData.weaponRange,
    aggroRange: npcTypeData.aggroRange,
    creditReward: npcTypeData.creditReward,
    deathEffect: npcTypeData.deathEffect || 'industrial_explosion',
    // Link to home base
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    patrolRadius: (base.patrolRadius || 3) * config.SECTOR_SIZE,
    spawnPoint: { x: spawnX, y: spawnY },
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map(),
    state: 'idle',
    // Mining state
    miningTargetId: null,
    miningTargetPos: null,
    hasHaul: false
  };

  // Boss properties for Foreman
  if (npcType === 'rogue_foreman') {
    npc.isBoss = true;
    npc.sizeMultiplier = 1.5;
  }

  activeNPCs.set(npcId, npc);
  npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);

  // Track in base spawned list
  if (!base.spawnedNPCs) base.spawnedNPCs = [];
  base.spawnedNPCs.push(npcId);
  base.lastSpawnTime = Date.now();

  return npc;
}

/**
 * Spawn a void NPC from a rift portal (for respawning after retreat)
 * @param {string} npcType - NPC type to spawn
 * @param {Object} riftPosition - Position {x, y} of the rift
 * @param {Object} options - Optional spawn options
 * @returns {Object|null} The spawned NPC or null
 */
function spawnVoidNPCFromRift(npcType, riftPosition, options = {}) {
  const npcTypeData = NPC_TYPES[npcType];
  if (!npcTypeData || npcTypeData.faction !== 'void') return null;

  let homeBase = null;
  if (options.baseId) {
    homeBase = activeBases.get(options.baseId);
    if (!homeBase || homeBase.destroyed) return null;
    const spawnConfig = homeBase.spawnConfig || BASE_NPC_SPAWNS[homeBase.type];
    homeBase.spawnedNPCs = (homeBase.spawnedNPCs || [])
      .filter(id => activeNPCs.has(id));
    if (spawnConfig && homeBase.spawnedNPCs.length >= spawnConfig.maxNPCs) {
      return null;
    }
  }

  const npcId = `npc_rift_${++npcIdCounter}`;

  const npc = {
    id: npcId,
    type: npcType,
    name: npcTypeData.name,
    faction: 'void',
    position: { x: riftPosition.x, y: riftPosition.y },
    velocity: { x: 0, y: 0 },
    rotation: Math.random() * Math.PI * 2,
    hull: npcTypeData.hull,
    hullMax: npcTypeData.hull,
    shield: npcTypeData.shield,
    shieldMax: npcTypeData.shield,
    speed: npcTypeData.speed,
    weaponType: npcTypeData.weaponType,
    weaponTier: npcTypeData.weaponTier,
    weaponDamage: npcTypeData.weaponDamage,
    weaponRange: npcTypeData.weaponRange,
    aggroRange: npcTypeData.aggroRange,
    creditReward: npcTypeData.creditReward,
    homeBaseId: options.baseId || null,
    homeBasePosition: options.spawnPoint || riftPosition,
    patrolRadius: options.patrolRadius || 3 * config.SECTOR_SIZE,
    spawnPoint: options.spawnPoint || riftPosition,
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map(),
    state: 'patrol',
    // Rift portal for retreat
    riftPortal: { x: riftPosition.x, y: riftPosition.y },
    fromRift: true
  };

  activeNPCs.set(npcId, npc);
  npcSpatialHash.insert(npcId, npc.position.x, npc.position.y);

  // Track in base if provided
  if (homeBase) {
    homeBase.spawnedNPCs.push(npcId);
    reconcileVoidFormationForBase(options.baseId);
  }

  return npc;
}

module.exports = {
  NPC_TYPES,
  TEAM_MULTIPLIERS,
  BASE_NPC_SPAWNS,
  spawnNPCsForSector,
  updateNPC,
  updateNPCLegacy,
  updateNPCShieldRecharge,
  damageNPC,
  getNPCsInRange,
  notifyWreckageCollectedNearby,
  getNPC,
  activeNPCs,
  // Base spawning functions
  activateBase,
  deactivateBase,
  spawnNPCFromBase,
  updateBaseSpawning,
  getActiveBase,
  getActiveBaseWithPosition,
  getActiveBases,
  isInBaseTerritory,
  activeBases,
  dormantBases,
  // NPC removal helper
  removeNPC,
  // Base health/destruction functions
  damageBase,
  destroyBase,
  checkBaseRespawn,
  getDestroyedBases,
  getBasesInRange,
  getActiveBasesByFaction,
  // Swarm linked health
  applySwarmLinkedDamage,
  // Swarm Queen spawning
  updateSwarmQueenSpawning,
  spawnQueenMinions,
  getQueenMinions,
  QUEEN_SPAWN_CONFIG,
  getQueenTimedSpawnCooldown,
  // Swarm egg hatching
  isHatching,
  // Formation tracking (Void faction succession)
  formations,
  getFormationForNpc,
  registerFormation,
  reconcileVoidFormationForBase,
  handleLeaderDeath,
  scoreNpcForLeadership,
  removeFromFormation,
  cleanupFormations,
  SUCCESSION_TIER_SCORES,
  // Graveyard safe zone
  isGraveyardSector,
  isInGraveyard,
  shouldBePassive,
  // Swarm Assimilation System
  assimilationProgress,
  assimilatedBases,
  sectorAssimilationCount,
  getSectorKey,
  findAssimilationTarget,
  convertBaseToSwarm,
  convertNpcToSwarm,
  checkQueenSpawnConditions,
  spawnSwarmQueen,
  handleQueenDeath,
  applyQueenAura,
  getDronesAssimilating,
  // Void Leviathan Boss
  checkLeviathanSpawn,
  spawnVoidLeviathan,
  handleLeviathanDeath,
  getActiveLeviathan,
  clearLeviathanPending,
  // Void rift respawning
  spawnVoidNPCFromRift,
  clearAssimilationProgress,
  getAssimilationState,
  getActiveQueen,
  // Attached drone management (new persistent attachment system)
  attachDroneToBase,
  detachDroneFromBase,
  getAttachedDrones,
  isAttachedDrone,
  reanchorAttachedDrone,
  // Scavenger scrap pile and Hauler system
  handleScavengerDump,
  spawnHauler,
  transformHaulerToBarnacleKing,
  // Rogue Miner deposit and dynamic spawning
  handleRogueMinerDeposit,
  spawnRogueMinerNPC,
  // Pirate faction spawning
  spawnScoutFromBase,
  spawnCaptainFromIntel,
  spawnDreadnoughtAtBase,
  // Spatial hash for efficient range queries
  rebuildNPCSpatialHash,
  updateNPCInHash,
  insertNPCInHash,
  removeNPCFromHash,
  // Swarm exclusion zone cleanup
  cleanupExcludedSwarmHives,
  isInSwarmExclusionZone
};
