// Galaxy Miner - NPC System (Server-side)

const config = require('../config');
const world = require('../world');
const combat = require('./combat');
const ai = require('./ai');

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
    weaponDamage: 35,
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
    weaponDamage: 25,
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
    weaponDamage: 40,
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
    weaponDamage: 28,
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

// Active bases: baseId -> baseData (runtime tracking)
const activeBases = new Map();

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

  activeBases.set(base.id, {
    ...base,
    spawnedNPCs: [],
    pendingRespawns: [],  // Array of { respawnAt: timestamp } for killed NPCs
    lastSpawnTime: 0,
    activated: true
  });

  // Do initial spawn
  for (let i = 0; i < spawnConfig.initialSpawn; i++) {
    spawnNPCFromBase(base.id);
  }

  console.log(`[NPC] Activated base ${base.name} (${base.type}) at (${Math.round(base.x)}, ${Math.round(base.y)})`);
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
  console.log(`[NPC] Deactivated base ${base.name}`);
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

  // Spawn position - random around base within patrol radius
  const patrolRadius = (base.patrolRadius || 3) * config.SECTOR_SIZE;
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = Math.random() * patrolRadius * 0.5; // Spawn within 50% of patrol radius
  const spawnX = base.x + Math.cos(spawnAngle) * spawnDist;
  const spawnY = base.y + Math.sin(spawnAngle) * spawnDist;

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
    // Link to home base
    homeBaseId: baseId,
    homeBasePosition: { x: base.x, y: base.y },
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
      console.log(`[NPC] ${base.name}: ${deadCount} NPC(s) killed, respawn in ${respawnDelay / 1000}s`);
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
          console.log(`[NPC] ${base.name} respawned ${newNPC.name}`);
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
          console.log(`[NPC] ${base.name} respawned ${newNPC.name} (after delay)`);
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

    // Remove all NPCs from this base
    for (const npcId of base.spawnedNPCs) {
      activeNPCs.delete(npcId);
    }

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
      respawnTime: config.SPAWN_HUB_TYPES?.[base.type]?.respawnTime || 300000
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
    loot.push({ resourceType, quantity });
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

    console.log(`[NPC] Base ${base.name} has respawned`);
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
function getBasesInRange(position, range) {
  const basesInRange = [];
  for (const [baseId, base] of activeBases) {
    if (base.destroyed) continue;

    const dx = base.x - position.x;
    const dy = base.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Add base size to range check (bases are large targets)
    if (dist <= range + (base.size || 100)) {
      basesInRange.push({
        id: baseId,
        x: base.x,
        y: base.y,
        size: base.size || 100,
        position: { x: base.x, y: base.y },
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
  applySwarmLinkedDamage
};
