// Galaxy Miner - NPC System (Server-side)

const config = require('../config');
const world = require('../world');
const combat = require('./combat');
const ai = require('./ai');
const logger = require('../../shared/logger');
const LootPools = require('./loot-pools');
const CONSTANTS = require('../../shared/constants');

// NPC types with faction, weapon, and tier info
const NPC_TYPES = {
  // === PIRATES (Flanking AI, Retreat at 40%) ===
  pirate_scout: {
    name: 'Pirate Scout',
    faction: 'pirate',
    hull: 50,
    shield: 25,
    speed: 120,
    weaponType: 'kinetic',
    weaponTier: 1,
    weaponDamage: 5,
    weaponRange: 200,
    aggroRange: 400,
    creditReward: 30,  // Tier: low (was 25) - loot via loot-pools.js
    deathEffect: 'explosion'
  },
  pirate_fighter: {
    name: 'Pirate Fighter',
    faction: 'pirate',
    hull: 100,
    shield: 50,
    speed: 100,
    weaponType: 'kinetic',
    weaponTier: 2,
    weaponDamage: 10,
    weaponRange: 250,
    aggroRange: 500,
    creditReward: 80,  // Tier: mid (was 75)
    deathEffect: 'explosion'
  },
  pirate_captain: {
    name: 'Pirate Captain',
    faction: 'pirate',
    hull: 200,
    shield: 100,
    speed: 80,
    weaponType: 'kinetic',
    weaponTier: 3,
    weaponDamage: 20,
    weaponRange: 300,
    aggroRange: 600,
    creditReward: 220,  // Tier: high (was 200)
    deathEffect: 'explosion'
  },
  pirate_dreadnought: {
    name: 'Pirate Dreadnought',
    faction: 'pirate',
    hull: 400,
    shield: 200,
    speed: 60,
    weaponType: 'kinetic',
    weaponTier: 4,
    weaponDamage: 52,  // Buffed +50% (was 35)
    weaponRange: 350,
    aggroRange: 700,
    creditReward: 550,  // Tier: boss (was 500)
    deathEffect: 'explosion',
    isBoss: true
  },

  // === SCAVENGERS (Retreat AI, Retreat at 20%) ===
  scavenger_scrapper: {
    name: 'Scavenger Scrapper',
    faction: 'scavenger',
    hull: 40,
    shield: 10,
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
    shield: 20,
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
    shield: 30,
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
    shield: 40,
    speed: 50,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 12,
    weaponRange: 250,
    aggroRange: 450,
    creditReward: 180,  // Tier: high (was 150) - NOT boss, they flee
    deathEffect: 'break_apart'
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
  void_whisper: {
    name: 'Void Whisper',
    faction: 'void',
    hull: 45,
    shield: 35,
    speed: 140,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 7,
    weaponRange: 250,
    aggroRange: 450,
    creditReward: 40,  // Tier: low (was 35)
    deathEffect: 'implode'
  },
  void_shadow: {
    name: 'Void Shadow',
    faction: 'void',
    hull: 80,
    shield: 60,
    speed: 120,
    weaponType: 'energy',
    weaponTier: 2,
    weaponDamage: 12,
    weaponRange: 280,
    aggroRange: 500,
    creditReward: 100,  // Tier: mid (was 90)
    deathEffect: 'implode'
  },
  void_phantom: {
    name: 'Void Phantom',
    faction: 'void',
    hull: 150,
    shield: 120,
    speed: 100,
    weaponType: 'energy',
    weaponTier: 3,
    weaponDamage: 18,
    weaponRange: 320,
    aggroRange: 550,
    creditReward: 200,  // Tier: high (was 180)
    deathEffect: 'implode'
  },
  void_leviathan: {
    name: 'Void Leviathan',
    faction: 'void',
    hull: 500,
    shield: 300,
    speed: 50,
    weaponType: 'energy',
    weaponTier: 5,
    weaponDamage: 60,  // Buffed +50% (was 40)
    weaponRange: 400,
    aggroRange: 800,
    creditReward: 1200,  // Tier: boss (was 1000)
    deathEffect: 'implode',
    isBoss: true,
    formationLeader: true
  },

  // === ROGUE MINERS (Territorial AI, Retreat at 50%) ===
  rogue_prospector: {
    name: 'Rogue Prospector',
    faction: 'rogue_miner',
    hull: 60,
    shield: 30,
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
    shield: 45,
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
    shield: 70,
    speed: 70,
    weaponType: 'energy',
    weaponTier: 3,
    weaponDamage: 16,
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
    shield: 120,
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
    // Skip swarm bases and already assimilated bases
    if (base.faction === 'swarm' || assimilatedBases.has(baseId)) continue;

    const dx = base.x - droneX;
    const dy = base.y - droneY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < searchRange && dist < nearestDist) {
      nearestDist = dist;
      nearestBase = { ...base, id: baseId, distance: dist };
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

  if (!drone || !base) {
    return { success: false, reason: 'invalid_target' };
  }

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
  drone.position = {
    x: base.x + Math.cos(angle) * attachRadius,
    y: base.y + Math.sin(angle) * attachRadius
  };
  drone.x = drone.position.x;
  drone.y = drone.position.y;

  progress.attachedDrones.add(droneId);

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
 * @returns {Object|null} Update info or null if drone wasn't attached
 */
function detachDroneFromBase(droneId) {
  const drone = activeNPCs.get(droneId);
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
 * Legacy function - now just calls attachDroneToBase
 * @deprecated Use attachDroneToBase instead
 */
function processDroneAssimilation(droneId, baseId) {
  return attachDroneToBase(droneId, baseId);
}

/**
 * Convert a base to swarm faction
 * @param {string} baseId - Base ID
 * @param {Object} base - Base data
 * @returns {Object} Conversion result with converted NPCs
 */
function convertBaseToSwarm(baseId, base) {
  const sectorKey = getSectorKey(base.x, base.y);

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
      const newType = CONSTANTS.SWARM_CONVERSION_MAP[npc.type];
      if (newType) {
        const converted = convertNpcToSwarm(npc, newType);
        convertedNpcs.push({ npcId, oldType: npc.type, newType });
      }
    }
  }

  // Preserve attached drone IDs on the base before clearing assimilation progress
  // This ensures we can still clean them up when the base is destroyed
  const progress = assimilationProgress.get(baseId);
  if (progress && progress.attachedDrones && progress.attachedDrones.size > 0) {
    base.attachedDroneIds = Array.from(progress.attachedDrones);
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
  const queenCheck = checkQueenSpawnConditions({ x: base.x, y: base.y });

  logger.info(`Base ${baseId} assimilated to swarm. Total assimilated bases: ${assimilatedBases.size}. Queen spawn: ${queenCheck?.shouldSpawn || false}`);

  // SPAWN QUEEN DIRECTLY HERE instead of relying on engine.js to do it
  // This ensures the queen spawns atomically with the base conversion
  let spawnedQueen = null;
  if (queenCheck?.shouldSpawn) {
    const spawnPos = queenCheck.spawnPosition || { x: base.x, y: base.y };
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

  // Preserve position and some state
  const oldX = npc.x;
  const oldY = npc.y;
  const oldVx = npc.vx;
  const oldVy = npc.vy;

  // Update to new type
  npc.type = newType;
  npc.faction = 'swarm';
  npc.hull = template.hull;
  npc.maxHull = template.hull;
  npc.shield = template.shield;
  npc.maxShield = template.shield;
  npc.speed = template.speed;
  npc.weaponType = template.weaponType;
  npc.weaponTier = template.weaponTier;
  npc.weaponDamage = template.weaponDamage;
  npc.weaponRange = template.weaponRange;
  npc.aggroRange = template.aggroRange;

  // Keep position
  npc.x = oldX;
  npc.y = oldY;
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
  if (activeQueen) return null;

  // Check cooldown (1 hour between spawns)
  const cooldown = CONSTANTS.SWARM_QUEEN_SPAWN?.QUEEN_SPAWN_COOLDOWN || 3600000;
  if (Date.now() - lastQueenSpawnTime < cooldown) return null;

  // Find primary swarm hive (original swarm_hive type base)
  let primaryHive = null;
  for (const [baseId, base] of activeBases) {
    if (base.type === 'swarm_hive' && !base.destroyed) {
      primaryHive = base;
      break;
    }
  }

  // If no primary hive, use the new base position
  const referencePoint = primaryHive
    ? { x: primaryHive.x, y: primaryHive.y }
    : newBasePosition;

  // Count assimilated bases within 10,000 units of reference point
  const QUEEN_TRIGGER_RANGE = 10000;
  let assimilatedCount = 0;

  for (const [baseId, info] of assimilatedBases) {
    const base = activeBases.get(baseId);
    if (!base) continue;

    const dx = base.x - referencePoint.x;
    const dy = base.y - referencePoint.y;
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

  for (const [baseId, base] of activeBases) {
    // Only affect swarm and assimilated bases
    if (base.faction !== 'swarm' && !assimilatedBases.has(baseId)) continue;

    const dx = base.x - activeQueen.x;
    const dy = base.y - activeQueen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= auraRange) {
      const maxHealth = base.maxHull || base.hull;
      const healAmount = maxHealth * regenPerSecond;
      const oldHealth = base.currentHull || base.hull;
      base.currentHull = Math.min(maxHealth, oldHealth + healAmount);

      if (base.currentHull > oldHealth) {
        affectedBases.push({
          baseId,
          health: base.currentHull,
          maxHealth,
          healed: base.currentHull - oldHealth
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
    activeQueen: activeQueen ? {
      id: activeQueen.id,
      x: activeQueen.x,
      y: activeQueen.y,
      hull: activeQueen.hull,
      maxHull: activeQueen.maxHull,
      shield: activeQueen.shield,
      maxShield: activeQueen.maxShield
    } : null,
    sectorCounts: Object.fromEntries(sectorAssimilationCount)
  };
}

/**
 * Get the active queen reference
 * @returns {Object|null} Active queen or null
 */
function getActiveQueen() {
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
    lastLeaderId: formation.lastLeaderId
  };
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
      npcToFormation.delete(formation.leaderId);
    }

    // Remove formation if no leader and no members
    if (leaderDead && formation.memberIds.size === 0) {
      formations.delete(formationId);
    }
  }
}

// Base type to NPC type mapping (spawn pool per base)
const BASE_NPC_SPAWNS = {
  pirate_outpost: {
    npcs: ['pirate_scout', 'pirate_fighter', 'pirate_captain'],
    weights: [0.5, 0.35, 0.15],  // Probability weights
    maxNPCs: 5,                  // Max NPCs spawned from this base
    spawnCooldown: 30000,        // 30 seconds between spawns (for initial/continuous)
    respawnDelay: 300000,        // 5 minutes before respawning after death
    initialSpawn: 3              // Initial NPCs when base activates
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
    maxNPCs: 4,
    spawnCooldown: 40000,
    respawnDelay: 300000,        // 5 minutes
    initialSpawn: 2
  },
  mining_claim: {
    npcs: ['rogue_prospector', 'rogue_driller', 'rogue_excavator'],
    weights: [0.5, 0.35, 0.15],
    maxNPCs: 3,
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

// Activate a base for NPC spawning
function activateBase(base) {
  if (activeBases.has(base.id)) return;

  const spawnConfig = BASE_NPC_SPAWNS[base.type];
  if (!spawnConfig) return;

  // Get current computed position for orbital/binary bases
  // This ensures consistency with NPC spawn positions
  const computedPos = world.getObjectPosition(base.id);
  const activatedX = computedPos ? computedPos.x : base.x;
  const activatedY = computedPos ? computedPos.y : base.y;

  activeBases.set(base.id, {
    ...base,
    // Store computed position for consistency (will be recomputed for orbital bases)
    activatedX,
    activatedY,
    spawnedNPCs: [],
    pendingRespawns: [],  // Array of { respawnAt: timestamp } for killed NPCs
    lastSpawnTime: 0,
    activated: true
  });

  // Do initial spawn
  for (let i = 0; i < spawnConfig.initialSpawn; i++) {
    spawnNPCFromBase(base.id);
  }

  logger.log(`[NPC] Activated base ${base.name} (${base.type}) at (${Math.round(activatedX)}, ${Math.round(activatedY)})${computedPos ? ' (computed)' : ''}`);
}

// Deactivate a base (when no players nearby for a while)
function deactivateBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return;

  // Remove all NPCs spawned by this base
  for (const npcId of base.spawnedNPCs) {
    activeNPCs.delete(npcId);
  }

  activeBases.delete(baseId);
  logger.log(`[NPC] Deactivated base ${base.name}`);
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

  // Check if at max NPCs
  if (base.spawnedNPCs.length >= spawnConfig.maxNPCs) return null;

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

  activeNPCs.set(npcId, npc);
  base.spawnedNPCs.push(npcId);
  base.lastSpawnTime = Date.now();

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

    // Initialize pendingRespawns if missing (for bases activated before this update)
    if (!base.pendingRespawns) {
      base.pendingRespawns = [];
    }

    // Track which NPCs died this tick and add to pending respawns
    const previousCount = base.spawnedNPCs.length;
    base.spawnedNPCs = base.spawnedNPCs.filter(npcId => activeNPCs.has(npcId));
    const deadCount = previousCount - base.spawnedNPCs.length;

    // For each NPC that died, add a pending respawn with the respawn delay
    if (deadCount > 0) {
      const respawnDelay = spawnConfig.respawnDelay || 300000; // Default 5 minutes
      for (let i = 0; i < deadCount; i++) {
        base.pendingRespawns.push({
          respawnAt: now + respawnDelay
        });
      }
      logger.log(`[NPC] ${base.name}: ${deadCount} NPC(s) killed, respawn in ${respawnDelay / 1000}s`);
    }

    // Check if we're at max capacity
    if (base.spawnedNPCs.length >= spawnConfig.maxNPCs) continue;

    // Check spawn cooldown (between any spawns)
    if (now - base.lastSpawnTime < spawnConfig.spawnCooldown) continue;

    // Check if any player is in range (patrol radius)
    const patrolRadius = (base.patrolRadius || 3) * config.SECTOR_SIZE;
    const hasNearbyPlayer = nearbyPlayers.some(player => {
      const dx = player.position.x - base.x;
      const dy = player.position.y - base.y;
      return Math.sqrt(dx * dx + dy * dy) < patrolRadius;
    });

    // Continuous spawn bases (like swarm hive) can spawn freely when players nearby
    if (spawnConfig.continuousSpawn && hasNearbyPlayer) {
      // Check if any pending respawns are ready
      const readyIndex = base.pendingRespawns.findIndex(pr => pr.respawnAt <= now);
      if (readyIndex !== -1) {
        // Remove the pending respawn and spawn a new NPC
        base.pendingRespawns.splice(readyIndex, 1);
        const newNPC = spawnNPCFromBase(baseId);
        if (newNPC) {
          logger.log(`[NPC] ${base.name} respawned ${newNPC.name}`);
        }
      }
    } else if (!spawnConfig.continuousSpawn) {
      // Regular bases: only respawn when respawn delay has passed
      // Check if there are any pending respawns that are ready
      const readyIndex = base.pendingRespawns.findIndex(pr => pr.respawnAt <= now);
      if (readyIndex !== -1 && base.spawnedNPCs.length < spawnConfig.initialSpawn) {
        // Remove the pending respawn and spawn a new NPC
        base.pendingRespawns.splice(readyIndex, 1);
        const newNPC = spawnNPCFromBase(baseId);
        if (newNPC) {
          logger.log(`[NPC] ${base.name} respawned ${newNPC.name} (after delay)`);
        }
      }
    }
  }
}

// Get active base by ID
function getActiveBase(baseId) {
  return activeBases.get(baseId);
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

  if (base.health <= 0) {
    // Base destroyed
    const participants = Array.from(base.damageContributors.keys());
    const participantCount = Math.max(1, participants.length);
    const teamMultiplier = TEAM_MULTIPLIERS[Math.min(participantCount, 4)] || 2.5;

    // Calculate credits based on base size/difficulty
    const baseCredits = base.maxHealth * 0.5; // Half of max health as credits
    const totalCredits = Math.round(baseCredits * teamMultiplier);
    const creditsPerPlayer = Math.round(totalCredits / participantCount);

    // Destroy any attached assimilation drones - they die with the base
    const progress = assimilationProgress.get(baseId);
    const destroyedDrones = [];
    if (progress && progress.attachedDrones) {
      for (const droneId of progress.attachedDrones) {
        activeNPCs.delete(droneId);
        destroyedDrones.push(droneId);
      }
      assimilationProgress.delete(baseId);
    }

    // Method 2: Scan for any NPCs still attached to this base (catches edge cases)
    // Some worms may have attachedToBase set but not be tracked in assimilationProgress
    for (const [npcId, npc] of activeNPCs) {
      if (npc.attachedToBase === baseId) {
        activeNPCs.delete(npcId);
        if (!destroyedDrones.includes(npcId)) {
          destroyedDrones.push(npcId);
        }
      }
    }

    // Method 3: Use stored attached drone IDs from assimilation (for assimilated bases)
    // These were preserved in convertBaseToSwarm() before assimilationProgress was cleared
    if (base.attachedDroneIds && base.attachedDroneIds.length > 0) {
      for (const droneId of base.attachedDroneIds) {
        if (activeNPCs.has(droneId)) {
          activeNPCs.delete(droneId);
          if (!destroyedDrones.includes(droneId)) {
            destroyedDrones.push(droneId);
          }
        }
      }
    }

    // Orphan all NPCs from this base - enter rage mode instead of deletion
    const orphanedNpcIds = [];
    for (const npcId of base.spawnedNPCs) {
      const npc = activeNPCs.get(npcId);
      if (npc) {
        // Handle formation leader succession before orphaning
        const formationInfo = getFormationForNpc(npcId);
        if (formationInfo && formationInfo.isLeader) {
          handleLeaderDeath(formationInfo.formationId);
        }

        // Mark as orphaned and enter rage mode
        npc.homeBaseId = null;
        npc.homeBasePosition = null;
        npc.orphaned = true;
        npc.orphanedAt = Date.now();
        npc.state = 'rage';

        // Increase aggro range and damage for rage mode
        npc.baseAggroRange = npc.baseAggroRange || npc.aggroRange;
        npc.aggroRange = Math.round(npc.baseAggroRange * ORPHAN_RAGE_AGGRO_MULTIPLIER);
        npc.rageMultiplier = ORPHAN_RAGE_DAMAGE_MULTIPLIER;

        orphanedNpcIds.push(npcId);
      }
    }

    // Clear the base's spawned NPC list (they're now orphaned, not tracked by base)
    base.spawnedNPCs = [];

    // Generate special loot for bases
    const loot = generateBaseLoot(base);

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

// Mark base as destroyed and schedule respawn
function destroyBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return;

  base.destroyed = true;
  base.destroyedAt = Date.now();

  // NPCs will be removed in damageBase, but ensure cleanup
  for (const npcId of base.spawnedNPCs) {
    activeNPCs.delete(npcId);
  }
  base.spawnedNPCs = [];
}

// Check if a destroyed base should respawn
function checkBaseRespawn(baseId) {
  const base = activeBases.get(baseId);
  if (!base || !base.destroyed) return false;

  const respawnTime = config.SPAWN_HUB_TYPES?.[base.type]?.respawnTime || 300000;
  const timeSinceDestruction = Date.now() - base.destroyedAt;

  if (timeSinceDestruction >= respawnTime) {
    // Respawn the base
    base.destroyed = false;
    base.health = base.maxHealth;
    base.damageContributors = new Map();
    base.lastSpawnTime = 0;

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
      basesInRange.push({
        id: baseId,
        x: baseX,
        y: baseY,
        size: baseSize,
        position: { x: baseX, y: baseY },
        health: base.health,
        maxHealth: base.maxHealth,
        faction: base.faction,
        type: base.type,
        name: base.name
      });
    }
  }
  return basesInRange;
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

  // 20% chance of spawns in each sector
  if (rng() < 0.2) {
    const count = Math.floor(rng() * 3) + 1; // 1-3 spawn points
    for (let i = 0; i < count; i++) {
      const x = sectorX * config.SECTOR_SIZE + rng() * config.SECTOR_SIZE;
      const y = sectorY * config.SECTOR_SIZE + rng() * config.SECTOR_SIZE;

      // Determine NPC type based on distance from origin (harder enemies further out)
      const distFromOrigin = Math.sqrt(sectorX * sectorX + sectorY * sectorY);
      let npcType;
      if (distFromOrigin > 10) {
        npcType = 'pirate_captain';
      } else if (distFromOrigin > 5) {
        npcType = 'pirate_fighter';
      } else {
        npcType = 'pirate_scout';
      }

      spawnPoints.push({ x, y, type: npcType });
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
      spawnPoint: { ...point },
      state: 'patrol',
      targetPlayer: null,
      lastFireTime: 0,
      lastDamageTime: 0,
      patrolAngle: Math.random() * Math.PI * 2,
      damageContributors: new Map()
    };

    activeNPCs.set(npcId, npc);
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

  // Use the new AI system for faction-specific behavior
  return ai.updateNPCAI(npc, players, activeNPCs, deltaTime);
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

function damageNPC(npcId, damage, attackerId = null) {
  const npc = activeNPCs.get(npcId);
  if (!npc) return null;

  // Track damage contributor
  if (attackerId) {
    const currentDamage = npc.damageContributors.get(attackerId) || 0;
    npc.damageContributors.set(attackerId, currentDamage + damage);
  }

  // Record damage time for shield recharge delay
  npc.lastDamageTime = Date.now();

  // Apply damage to shield first
  if (npc.shield > 0) {
    if (damage <= npc.shield) {
      npc.shield -= damage;
      damage = 0;
    } else {
      damage -= npc.shield;
      npc.shield = 0;
    }
  }

  // Remaining damage to hull
  npc.hull -= damage;

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
    if (npc.spawnPoint && !npc.homeBaseId) {
      const spawnKey = `${Math.round(npc.spawnPoint.x)}_${Math.round(npc.spawnPoint.y)}`;
      deadSpawnPoints.set(spawnKey, {
        respawnAt: Date.now() + SECTOR_NPC_RESPAWN_DELAY
      });
    }

    activeNPCs.delete(npcId);

    return {
      destroyed: true,
      loot,
      participants,
      participantCount,
      teamMultiplier,
      totalCredits,
      creditsPerPlayer,
      faction: npc.faction
    };
  }

  return {
    destroyed: false,
    hull: npc.hull,
    shield: npc.shield,
    hitShield: npc.shield > 0
  };
}

// Note: generateLoot removed - now using LootPools.generateLoot() for centralized loot generation

function getNPCsInRange(position, range) {
  const result = [];
  for (const [id, npc] of activeNPCs) {
    // Defensive validation: skip invalid/dead NPCs
    if (!npc || !npc.position || npc.hull <= 0) continue;

    const dx = npc.position.x - position.x;
    const dy = npc.position.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= range) {
      result.push({ ...npc, distance: dist });
    }
  }
  return result;
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
 * @returns {Array} List of affected NPCs with damage info
 */
function applySwarmLinkedDamage(damagedNpc, damage) {
  if (!damagedNpc.linkedHealth || damagedNpc.faction !== 'swarm') {
    return [];
  }

  const linkedDamage = damage * 0.2; // 20% of damage spreads
  const affected = [];

  for (const [id, npc] of activeNPCs) {
    if (id === damagedNpc.id) continue;
    if (npc.faction !== 'swarm') continue;
    if (!npc.linkedHealth) continue;

    // Check distance
    const dx = npc.position.x - damagedNpc.position.x;
    const dy = npc.position.y - damagedNpc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 300) { // Linked within 300 units
      npc.hull -= linkedDamage;
      affected.push({
        id: npc.id,
        damage: linkedDamage,
        destroyed: npc.hull <= 0,
        hull: npc.hull,
        hullMax: npc.hullMax
      });

      // Remove destroyed NPCs
      if (npc.hull <= 0) {
        activeNPCs.delete(id);
      }
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
      deathEffect: typeData.deathEffect || 'dissolve',
      linkedHealth: typeData.linkedHealth || false,
      state: 'idle',
      target: queen.target, // Inherit queen's target
      lastFireTime: 0,
      damageContributors: new Map(),
      spawnPoint: { x: spawnX, y: spawnY },
      spawnedBy: queen.id
    };

    activeNPCs.set(minionId, minion);
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

  // Check time-based spawning (every 15 seconds if in combat > 10 seconds)
  const combatDuration = now - queen.combatStartTime;
  if (combatDuration > QUEEN_SPAWN_CONFIG.combatSpawnDelay) {
    if (now - queen.lastSpawnTime >= QUEEN_SPAWN_CONFIG.spawnCooldown) {
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
  getNPC,
  activeNPCs,
  // Base spawning functions
  activateBase,
  deactivateBase,
  spawnNPCFromBase,
  updateBaseSpawning,
  getActiveBase,
  isInBaseTerritory,
  activeBases,
  // Base health/destruction functions
  damageBase,
  destroyBase,
  checkBaseRespawn,
  getDestroyedBases,
  getBasesInRange,
  // Swarm linked health
  applySwarmLinkedDamage,
  // Swarm Queen spawning
  updateSwarmQueenSpawning,
  spawnQueenMinions,
  getQueenMinions,
  QUEEN_SPAWN_CONFIG,
  // Swarm egg hatching
  isHatching,
  // Formation tracking (Void faction succession)
  formations,
  getFormationForNpc,
  registerFormation,
  handleLeaderDeath,
  scoreNpcForLeadership,
  removeFromFormation,
  cleanupFormations,
  SUCCESSION_TIER_SCORES,
  // Swarm Assimilation System
  assimilationProgress,
  assimilatedBases,
  sectorAssimilationCount,
  getSectorKey,
  findAssimilationTarget,
  processDroneAssimilation,
  convertBaseToSwarm,
  convertNpcToSwarm,
  checkQueenSpawnConditions,
  spawnSwarmQueen,
  handleQueenDeath,
  applyQueenAura,
  getDronesAssimilating,
  clearAssimilationProgress,
  getAssimilationState,
  getActiveQueen,
  // Attached drone management (new persistent attachment system)
  attachDroneToBase,
  detachDroneFromBase,
  getAttachedDrones,
  isAttachedDrone
};
