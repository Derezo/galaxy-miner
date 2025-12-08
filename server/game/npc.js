// Galaxy Miner - NPC System (Server-side)

const config = require('../config');
const world = require('../world');
const combat = require('./combat');
const ai = require('./ai');
const logger = require('../../shared/logger');

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
    lootTable: ['IRON', 'CARBON', 'COPPER'],
    creditReward: 25,
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
    lootTable: ['COPPER', 'TITANIUM', 'HELIUM3'],
    creditReward: 75,
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
    lootTable: ['PLATINUM', 'DARK_MATTER', 'QUANTUM_CRYSTALS'],
    creditReward: 200,
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
    lootTable: ['DARK_MATTER', 'QUANTUM_CRYSTALS', 'EXOTIC_MATTER'],
    creditReward: 500,
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
    lootTable: ['IRON', 'NICKEL', 'SILICON'],
    creditReward: 15,
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
    lootTable: ['COPPER', 'SILVER', 'COBALT'],
    creditReward: 40,
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
    lootTable: ['TITANIUM', 'LITHIUM', 'NEON'],
    creditReward: 80,
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
    lootTable: ['GOLD', 'PLATINUM', 'IRIDIUM'],
    creditReward: 150,
    deathEffect: 'break_apart',
    isBoss: true
  },

  // === THE SWARM (Swarm AI, Never Retreat, Linked Health) ===
  swarm_drone: {
    name: 'Swarm Drone',
    faction: 'swarm',
    hull: 20,
    shield: 0,
    speed: 150,
    weaponType: 'explosive',
    weaponTier: 1,
    weaponDamage: 3,
    weaponRange: 150,
    aggroRange: 500,
    lootTable: ['CARBON', 'PHOSPHORUS', 'NITROGEN'],
    creditReward: 10,
    deathEffect: 'dissolve',
    linkedHealth: true
  },
  swarm_worker: {
    name: 'Swarm Worker',
    faction: 'swarm',
    hull: 35,
    shield: 0,
    speed: 130,
    weaponType: 'explosive',
    weaponTier: 1,
    weaponDamage: 5,
    weaponRange: 180,
    aggroRange: 550,
    lootTable: ['HELIUM3', 'SULFUR', 'ICE_CRYSTALS'],
    creditReward: 25,
    deathEffect: 'dissolve',
    linkedHealth: true
  },
  swarm_warrior: {
    name: 'Swarm Warrior',
    faction: 'swarm',
    hull: 60,
    shield: 15,
    speed: 110,
    weaponType: 'explosive',
    weaponTier: 2,
    weaponDamage: 10,
    weaponRange: 220,
    aggroRange: 600,
    lootTable: ['DARK_MATTER', 'QUANTUM_CRYSTALS'],
    creditReward: 60,
    deathEffect: 'dissolve',
    linkedHealth: true
  },
  swarm_queen: {
    name: 'Swarm Queen',
    faction: 'swarm',
    hull: 300,
    shield: 100,
    speed: 40,
    weaponType: 'explosive',
    weaponTier: 4,
    weaponDamage: 37,  // Buffed +50% (was 25)
    weaponRange: 300,
    aggroRange: 800,
    lootTable: ['EXOTIC_MATTER', 'ANTIMATTER', 'VOID_CRYSTALS'],
    creditReward: 750,
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
    lootTable: ['XENON', 'DARK_MATTER'],
    creditReward: 35,
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
    lootTable: ['DARK_MATTER', 'QUANTUM_CRYSTALS'],
    creditReward: 90,
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
    lootTable: ['QUANTUM_CRYSTALS', 'EXOTIC_MATTER', 'VOID_CRYSTALS'],
    creditReward: 180,
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
    lootTable: ['ANTIMATTER', 'NEUTRONIUM', 'VOID_CRYSTALS'],
    creditReward: 1000,
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
    lootTable: ['IRON', 'COPPER', 'SILICON'],
    creditReward: 30,
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
    lootTable: ['TITANIUM', 'COBALT', 'LITHIUM'],
    creditReward: 65,
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
    lootTable: ['GOLD', 'URANIUM', 'IRIDIUM'],
    creditReward: 130,
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
    lootTable: ['PLATINUM', 'EXOTIC_MATTER', 'QUANTUM_CRYSTALS'],
    creditReward: 350,
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
    weights: [0.6, 0.3, 0.1],
    maxNPCs: 8,                  // Can have many drones
    spawnCooldown: 10000,        // Fast spawning (continuous)
    respawnDelay: 60000,         // 1 minute for swarm (they respawn faster)
    initialSpawn: 4,
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
function selectNPCFromPool(baseType) {
  const config = BASE_NPC_SPAWNS[baseType];
  if (!config) return null;

  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < config.npcs.length; i++) {
    cumulative += config.weights[i];
    if (roll < cumulative) {
      return config.npcs[i];
    }
  }
  return config.npcs[config.npcs.length - 1];
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

  const spawnConfig = BASE_NPC_SPAWNS[base.type];
  if (!spawnConfig) return null;

  // Check if at max NPCs
  if (base.spawnedNPCs.length >= spawnConfig.maxNPCs) return null;

  const npcType = selectNPCFromPool(base.type);
  if (!npcType) return null;

  const npcTypeData = NPC_TYPES[npcType];
  if (!npcTypeData) return null;

  const npcId = `npc_${++npcIdCounter}`;

  // Get current computed position for orbital/binary bases
  const currentPos = world.getObjectPosition(baseId);
  const baseX = currentPos ? currentPos.x : base.x;
  const baseY = currentPos ? currentPos.y : base.y;

  // Spawn position - random around base within patrol radius
  const patrolRadius = (base.patrolRadius || 3) * config.SECTOR_SIZE;
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = Math.random() * patrolRadius * 0.5; // Spawn within 50% of patrol radius
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
    lootTable: npcTypeData.lootTable,
    creditReward: npcTypeData.creditReward,
    // Link to home base (use computed position for orbital/binary bases)
    homeBaseId: baseId,
    homeBasePosition: { x: baseX, y: baseY },
    patrolRadius: patrolRadius,
    spawnPoint: { x: spawnX, y: spawnY },
    state: 'patrol',
    targetPlayer: null,
    lastFireTime: 0,
    lastDamageTime: 0,
    patrolAngle: Math.random() * Math.PI * 2,
    damageContributors: new Map()
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
    const spawnConfig = BASE_NPC_SPAWNS[base.type];
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
      orphanedNpcIds  // NPCs that entered rage mode
    };
  }

  return {
    destroyed: false,
    health: base.health,
    maxHealth: base.maxHealth
  };
}

// Generate loot specific to bases (better rewards)
function generateBaseLoot(base) {
  const loot = [];
  const faction = base.faction;

  // More loot from bases than individual NPCs
  const numDrops = Math.floor(Math.random() * 4) + 3; // 3-6 drops

  // Faction-specific high-tier resources
  const factionResources = {
    pirate: ['GOLD', 'PLATINUM', 'DARK_MATTER'],
    scavenger: ['TITANIUM', 'IRIDIUM', 'URANIUM'],
    swarm: ['EXOTIC_MATTER', 'ANTIMATTER', 'VOID_CRYSTALS'],
    void: ['DARK_MATTER', 'QUANTUM_CRYSTALS', 'NEUTRONIUM'],
    rogue_miner: ['PLATINUM', 'URANIUM', 'EXOTIC_MATTER']
  };

  const resources = factionResources[faction] || ['PLATINUM', 'DARK_MATTER'];

  for (let i = 0; i < numDrops; i++) {
    const resourceType = resources[Math.floor(Math.random() * resources.length)];
    const quantity = Math.floor(Math.random() * 10) + 5; // 5-14 per drop
    loot.push({ type: 'resource', resourceType, quantity });
  }

  // Chance for component or relic
  if (Math.random() < 0.5) { // 50% chance for component
    loot.push({ type: 'component', componentType: `${faction}_core` });
  }
  if (Math.random() < 0.2) { // 20% chance for relic
    loot.push({ type: 'relic', relicType: `${faction}_artifact` });
  }

  return loot;
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
    const existing = [...activeNPCs.values()].find(npc =>
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
      lootTable: npcTypeData.lootTable,
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
    // NPC died - generate loot and calculate team rewards
    const loot = generateLoot(npc);
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

function generateLoot(npc) {
  const loot = [];
  const numDrops = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < numDrops; i++) {
    const resourceType = npc.lootTable[Math.floor(Math.random() * npc.lootTable.length)];
    const quantity = Math.floor(Math.random() * 5) + 1;
    loot.push({ resourceType, quantity });
  }

  return loot;
}

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
      lootTable: typeData.lootTable,
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
  // Formation tracking (Void faction succession)
  formations,
  getFormationForNpc,
  registerFormation,
  handleLeaderDeath,
  scoreNpcForLeadership,
  removeFromFormation,
  cleanupFormations,
  SUCCESSION_TIER_SCORES
};
