// Shared constants between client and server

const CONSTANTS = {
  // World generation
  GALAXY_SEED: 'GALAXY_ALPHA_2025',
  SECTOR_SIZE: 1000,
  STARS_PER_SECTOR_MIN: 0,
  STARS_PER_SECTOR_MAX: 2,
  PLANETS_PER_STAR_MIN: 0,
  PLANETS_PER_STAR_MAX: 6,
  ASTEROIDS_PER_SECTOR_MIN: 3,
  ASTEROIDS_PER_SECTOR_MAX: 15,
  WORMHOLE_CHANCE: 0.05,

  // Physics
  PHYSICS_TIME_ORIGIN: 0,
  GRAVITY_CONSTANT: 0.5,
  STAR_MASS_FACTOR: 0.5,
  GRAVITY_RADIUS_FACTOR: 3,
  ASTEROID_VELOCITY_MIN: 5,
  ASTEROID_VELOCITY_MAX: 30,
  ASTEROID_ORBIT_VELOCITY: 0.2,
  PLANET_ORBIT_SPEED_BASE: 0.0003,
  SECTOR_BOUNDARY_MARGIN: 30,
  MIN_OBJECT_SPACING: 15,
  PLACEMENT_MAX_ATTEMPTS: 50,

  // Timing
  SERVER_TICK_RATE: 20,
  CLIENT_RENDER_RATE: 60,

  // Player defaults
  DEFAULT_HULL_HP: 100,
  DEFAULT_SHIELD_HP: 50,
  DEFAULT_CREDITS: 100,
  BASE_SPEED: 150,
  BASE_ROTATION_SPEED: 3,
  BASE_RADAR_RANGE: 500,

  // Ship component tiers
  MAX_TIER: 5,
  TIER_MULTIPLIER: 1.5,

  // Combat
  WEAPON_TYPES: ['kinetic', 'energy', 'explosive'],
  BASE_WEAPON_DAMAGE: 10,
  BASE_WEAPON_COOLDOWN: 500,
  BASE_WEAPON_RANGE: 300,
  SHIELD_RECHARGE_RATE: 2,
  SHIELD_RECHARGE_DELAY: 3000,
  DEATH_CARGO_DROP_PERCENT: 0.5,

  // Mining
  BASE_MINING_TIME: 3000,
  BASE_MINING_YIELD: 1,
  MINING_RANGE: 50,
  RESOURCE_RESPAWN_TIME_MIN: 30 * 60 * 1000,
  RESOURCE_RESPAWN_TIME_MAX: 60 * 60 * 1000,

  // Cargo
  BASE_CARGO_CAPACITY: 50,

  // Emotes for player communication
  EMOTES: {
    wave: { icon: '\uD83D\uDC4B', name: 'Wave', duration: 3000 },
    help: { icon: '\uD83C\uDD98', name: 'Help', duration: 5000 },
    trade: { icon: '\uD83E\uDD1D', name: 'Trade Request', duration: 5000 },
    danger: { icon: '\u26A0\uFE0F', name: 'Danger', duration: 4000 }
  },

  // Resources
  RESOURCE_TYPES: {
    // Common - Metals and basic elements
    IRON: {
      name: 'Iron',
      rarity: 'common',
      baseValue: 5,
      category: 'metal',
      description: 'Common structural metal, essential for basic ship repairs and construction.'
    },
    CARBON: {
      name: 'Carbon',
      rarity: 'common',
      baseValue: 5,
      category: 'gas',
      description: 'Versatile element forming the basis of organic compounds.'
    },
    SILICON: {
      name: 'Silicon',
      rarity: 'common',
      baseValue: 6,
      category: 'metal',
      description: 'Essential for computer chips and solar panel construction.'
    },
    HYDROGEN: {
      name: 'Hydrogen',
      rarity: 'common',
      baseValue: 4,
      category: 'gas',
      description: 'Lightest element, primary fuel source for fusion reactors.'
    },
    // Uncommon
    COPPER: {
      name: 'Copper',
      rarity: 'uncommon',
      baseValue: 15,
      category: 'metal',
      description: 'Conductive metal used in electrical systems and advanced circuitry.'
    },
    TITANIUM: {
      name: 'Titanium',
      rarity: 'uncommon',
      baseValue: 20,
      category: 'metal',
      description: 'Lightweight yet incredibly strong, ideal for hull reinforcement.'
    },
    HELIUM3: {
      name: 'Helium-3',
      rarity: 'uncommon',
      baseValue: 25,
      category: 'gas',
      description: 'Rare helium isotope, ideal for clean fusion power generation.'
    },
    ICE_CRYSTALS: {
      name: 'Ice Crystals',
      rarity: 'uncommon',
      baseValue: 18,
      category: 'crystal',
      description: 'Frozen water containing trace minerals, useful for life support systems.'
    },
    // Rare
    PLATINUM: {
      name: 'Platinum',
      rarity: 'rare',
      baseValue: 50,
      category: 'metal',
      description: 'Precious metal with excellent catalytic properties, highly valued.'
    },
    DARK_MATTER: {
      name: 'Dark Matter',
      rarity: 'rare',
      baseValue: 75,
      category: 'exotic',
      description: 'Mysterious substance that interacts only through gravity.'
    },
    QUANTUM_CRYSTALS: {
      name: 'Quantum Crystals',
      rarity: 'rare',
      baseValue: 100,
      category: 'crystal',
      description: 'Rare crystals exhibiting quantum properties, used in FTL navigation.'
    },
    // Ultra-rare
    EXOTIC_MATTER: {
      name: 'Exotic Matter',
      rarity: 'ultrarare',
      baseValue: 200,
      category: 'exotic',
      description: 'Theoretically impossible material with negative mass properties.'
    },
    ANTIMATTER: {
      name: 'Antimatter',
      rarity: 'ultrarare',
      baseValue: 300,
      category: 'exotic',
      description: 'Highly volatile matter-antimatter annihilation fuel source.'
    },
    // Common - New additions
    PHOSPHORUS: {
      name: 'Phosphorus',
      rarity: 'common',
      baseValue: 5,
      category: 'gas',
      description: 'Essential element for organic compounds and agricultural systems.'
    },
    NICKEL: {
      name: 'Nickel',
      rarity: 'common',
      baseValue: 5,
      category: 'metal',
      description: 'Abundant in asteroids, used for corrosion-resistant alloys and plating.'
    },
    SULFUR: {
      name: 'Sulfur',
      rarity: 'common',
      baseValue: 6,
      category: 'crystal',
      description: 'Volcanic mineral deposits, essential for industrial chemical processes.'
    },
    NITROGEN: {
      name: 'Nitrogen',
      rarity: 'common',
      baseValue: 4,
      category: 'gas',
      description: 'Atmospheric gas crucial for life support and cooling systems.'
    },
    // Uncommon - New additions
    SILVER: {
      name: 'Silver',
      rarity: 'uncommon',
      baseValue: 18,
      category: 'metal',
      description: 'Precious conductive metal with antimicrobial properties.'
    },
    COBALT: {
      name: 'Cobalt',
      rarity: 'uncommon',
      baseValue: 22,
      category: 'metal',
      description: 'Deep blue metal used in battery technology and superalloys.'
    },
    LITHIUM: {
      name: 'Lithium',
      rarity: 'uncommon',
      baseValue: 20,
      category: 'metal',
      description: 'Lightweight reactive metal essential for power cell production.'
    },
    NEON: {
      name: 'Neon',
      rarity: 'uncommon',
      baseValue: 15,
      category: 'gas',
      description: 'Noble gas used in holographic displays and signage systems.'
    },
    // Rare - New additions
    GOLD: {
      name: 'Gold',
      rarity: 'rare',
      baseValue: 60,
      category: 'metal',
      description: 'Universal precious metal, prized for electronics and currency.'
    },
    URANIUM: {
      name: 'Uranium',
      rarity: 'rare',
      baseValue: 80,
      category: 'metal',
      description: 'Radioactive heavy metal used for nuclear fuel and weapons systems.'
    },
    IRIDIUM: {
      name: 'Iridium',
      rarity: 'rare',
      baseValue: 90,
      category: 'metal',
      description: 'Ultra-hard asteroid-origin metal, iridescent and nearly indestructible.'
    },
    XENON: {
      name: 'Xenon',
      rarity: 'rare',
      baseValue: 70,
      category: 'gas',
      description: 'Heavy noble gas, primary propellant for ion thrusters.'
    },
    // Ultra-rare - New additions
    NEUTRONIUM: {
      name: 'Neutronium',
      rarity: 'ultrarare',
      baseValue: 250,
      category: 'exotic',
      description: 'Degenerate matter from neutron stars, impossibly dense.'
    },
    VOID_CRYSTALS: {
      name: 'Void Crystals',
      rarity: 'ultrarare',
      baseValue: 350,
      category: 'crystal',
      description: 'Formed in space-time anomalies, capable of bending reality itself.'
    }
  },

  // Upgrade costs (credits)
  UPGRADE_COSTS: {
    2: 500,
    3: 1500,
    4: 5000,
    5: 15000
  },

  // Object sizes (for rendering and collision)
  SHIP_SIZE: 20,
  STAR_SIZE_MIN: 80,
  STAR_SIZE_MAX: 200,
  PLANET_SIZE_MIN: 20,
  PLANET_SIZE_MAX: 60,
  ASTEROID_SIZE_MIN: 10,
  ASTEROID_SIZE_MAX: 30,
  WORMHOLE_SIZE: 100,

  // Colors
  COLORS: {
    SHIP_PLAYER: '#00ff00',
    SHIP_OTHER: '#00aaff',
    SHIP_NPC: '#ff0000',
    STAR: '#ffff00',
    PLANET: '#4488ff',
    ASTEROID: '#888888',
    WORMHOLE: '#ff00ff',
    BACKGROUND: '#000011'
  },

  // Network
  POSITION_SYNC_RATE: 50,
  MAX_PLAYERS: 50,

  // Chat
  CHAT_RATE_LIMIT: 1000,
  CHAT_MAX_LENGTH: 200,
  CHAT_HISTORY_SIZE: 100,

  // NPC Factions
  NPC_FACTIONS: {
    PIRATE: {
      id: 'pirate',
      name: 'Pirates',
      color: '#ff3300',
      secondaryColor: '#ff6600',
      spawnHub: 'pirate_outpost',
      spawnRate: 15, // 1 per N sectors
      patrolRadius: 5, // sectors
      retreatThreshold: 0.4,
      aiStrategy: 'flanking',
      weaponType: 'cannon',
      deathEffect: 'explosion'
    },
    SCAVENGER: {
      id: 'scavenger',
      name: 'Scavengers',
      color: '#999966',
      secondaryColor: '#666644',
      spawnHub: 'scavenger_yard',
      spawnRate: 25, // Sparse
      patrolRadius: 2,
      retreatThreshold: 0.2,
      aiStrategy: 'retreat',
      weaponType: 'jury_laser',
      deathEffect: 'break_apart'
    },
    SWARM: {
      id: 'swarm',
      name: 'The Swarm',
      color: '#00ff66',
      secondaryColor: '#00cc44',
      spawnHub: 'swarm_hive',
      spawnRate: 50, // Rare
      patrolRadius: 0, // Stays near hive
      retreatThreshold: 0, // Never retreat
      aiStrategy: 'swarm',
      weaponType: 'acid_bolt',
      deathEffect: 'dissolve',
      linkedHealth: true,
      continuousSpawn: true
    },
    VOID: {
      id: 'void',
      name: 'Void Entities',
      color: '#9900ff',
      secondaryColor: '#660099',
      spawnHub: 'void_rift',
      spawnRate: 40,
      patrolRadius: 3,
      retreatThreshold: 0.3,
      aiStrategy: 'formation',
      weaponType: 'dark_beam',
      deathEffect: 'implode'
    },
    ROGUE_MINER: {
      id: 'rogue_miner',
      name: 'Rogue Miners',
      color: '#ff9900',
      secondaryColor: '#cc7700',
      spawnHub: 'mining_claim',
      spawnRate: 20,
      patrolRadius: 3,
      retreatThreshold: 0.5,
      aiStrategy: 'territorial',
      weaponType: 'mining_laser',
      deathEffect: 'industrial_explosion'
    }
  },

  // NPC Weapon Types
  NPC_WEAPONS: {
    cannon: {
      id: 'cannon',
      name: 'Pirate Cannon',
      color: '#ff6600',
      type: 'projectile',
      damageType: 'kinetic',
      size: 8,
      trail: true
    },
    jury_laser: {
      id: 'jury_laser',
      name: 'Jury-Rigged Laser',
      color: '#ffff00',
      type: 'beam',
      damageType: 'energy',
      width: 3,
      flicker: true
    },
    acid_bolt: {
      id: 'acid_bolt',
      name: 'Acid Bolt',
      color: '#00ff66',
      type: 'projectile',
      damageType: 'explosive',
      size: 6,
      splash: true
    },
    dark_beam: {
      id: 'dark_beam',
      name: 'Dark Energy Beam',
      color: '#9900ff',
      type: 'beam',
      damageType: 'energy',
      width: 5,
      pulse: true
    },
    mining_laser: {
      id: 'mining_laser',
      name: 'Mining Laser',
      color: '#ff9900',
      type: 'beam',
      damageType: 'energy',
      width: 4,
      particles: true
    }
  },

  // NPC Death Effects
  NPC_DEATH_EFFECTS: {
    explosion: {
      particles: 30,
      colors: ['#ff3300', '#ff6600', '#ffcc00'],
      duration: 800,
      shockwave: true
    },
    break_apart: {
      particles: 20,
      colors: ['#666666', '#999999'],
      duration: 1200,
      debris: 5
    },
    dissolve: {
      particles: 50,
      colors: ['#00ff66', '#00cc44'],
      duration: 1000,
      fadeOut: true
    },
    implode: {
      particles: 40,
      colors: ['#9900ff', '#660099', '#000000'],
      duration: 600,
      inward: true,
      singularity: true
    },
    industrial_explosion: {
      particles: 35,
      colors: ['#ff9900', '#ffcc00', '#996600'],
      duration: 900,
      sparks: true
    }
  },

  // Loot Types
  LOOT_TYPES: {
    CREDITS: { id: 'credits', name: 'Credits', collectTime: 1000 },
    RESOURCE: { id: 'resource', name: 'Resources', collectTime: 1500 },
    BUFF: { id: 'buff', name: 'Power-Up', collectTime: 500 },
    COMPONENT: { id: 'component', name: 'Component', collectTime: 2000 },
    RELIC: { id: 'relic', name: 'Relic', collectTime: 2500 }
  },

  // Temporary Buffs
  BUFF_TYPES: {
    SHIELD_BOOST: {
      id: 'shield_boost',
      name: 'Shield Boost',
      duration: 60000,
      effect: { shieldMultiplier: 1.5 },
      color: '#00aaff'
    },
    SPEED_BURST: {
      id: 'speed_burst',
      name: 'Speed Burst',
      duration: 45000,
      effect: { speedMultiplier: 1.3 },
      color: '#ffff00'
    },
    DAMAGE_AMP: {
      id: 'damage_amp',
      name: 'Damage Amplifier',
      duration: 30000,
      effect: { damageMultiplier: 1.25 },
      color: '#ff3300'
    },
    RADAR_PULSE: {
      id: 'radar_pulse',
      name: 'Radar Pulse',
      duration: 90000,
      effect: { radarMultiplier: 2.0 },
      color: '#00ff00'
    }
  },

  // Upgrade Component Types
  COMPONENT_TYPES: {
    ENGINE_CORE: { id: 'engine_core', name: 'Engine Core', rarity: 'rare' },
    WEAPON_MATRIX: { id: 'weapon_matrix', name: 'Weapon Matrix', rarity: 'rare' },
    SHIELD_CELL: { id: 'shield_cell', name: 'Shield Cell', rarity: 'rare' },
    MINING_CAPACITOR: { id: 'mining_capacitor', name: 'Mining Capacitor', rarity: 'rare' }
  },

  // Relic Types
  RELIC_TYPES: {
    ANCIENT_STAR_MAP: { id: 'ancient_star_map', name: 'Ancient Star Map', rarity: 'ultrarare', value: 500 },
    VOID_CRYSTAL: { id: 'void_crystal', name: 'Void Crystal', rarity: 'ultrarare', value: 750 },
    SWARM_HIVE_CORE: { id: 'swarm_hive_core', name: 'Swarm Hive Core', rarity: 'ultrarare', value: 1000 },
    PIRATE_TREASURE: { id: 'pirate_treasure', name: 'Pirate Treasure', rarity: 'rare', value: 300 }
  },

  // Team Multipliers
  TEAM_MULTIPLIERS: {
    1: 1.0,   // Solo: 100%
    2: 1.5,   // Duo: 150%
    3: 2.0,   // Trio: 200%
    4: 2.5    // Squad: 250%
  },

  // Spawn Hub Types (faction bases that spawn NPCs)
  SPAWN_HUB_TYPES: {
    pirate_outpost: {
      id: 'pirate_outpost',
      name: 'Pirate Outpost',
      faction: 'pirate',
      health: 2000,
      size: 150,
      respawnTime: 300000, // 5 minutes
      spawnChance: 0.067,  // ~1 per 15 sectors
      patrolRadius: 5      // NPCs patrol 5 sectors out
    },
    scavenger_yard: {
      id: 'scavenger_yard',
      name: 'Scavenger Yard',
      faction: 'scavenger',
      health: 1000,
      size: 100,
      respawnTime: 180000,
      spawnChance: 0.04,   // ~1 per 25 sectors
      patrolRadius: 2
    },
    swarm_hive: {
      id: 'swarm_hive',
      name: 'Swarm Hive',
      faction: 'swarm',
      health: 5000,
      size: 200,
      respawnTime: 600000, // 10 minutes
      continuousSpawn: true,
      spawnInterval: 10000, // 10 seconds
      spawnChance: 0.02,   // ~1 per 50 sectors (rare)
      patrolRadius: 3
    },
    void_rift: {
      id: 'void_rift',
      name: 'Void Rift',
      faction: 'void',
      health: 3000,
      size: 120,
      respawnTime: 480000,
      spawnChance: 0.025,  // ~1 per 40 sectors
      patrolRadius: 4
    },
    mining_claim: {
      id: 'mining_claim',
      name: 'Mining Claim',
      faction: 'rogue_miner',
      health: 1500,
      size: 100,
      respawnTime: 240000,
      territoryRadius: 500,
      spawnChance: 0.05,   // ~1 per 20 sectors
      patrolRadius: 3
    }
  },

  // Wreckage
  WRECKAGE_DESPAWN_TIME: 120000, // 2 minutes
  WRECKAGE_COLLECT_RANGE: 50
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
