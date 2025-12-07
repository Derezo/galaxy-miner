// Shared constants between client and server

const CONSTANTS = {
  // World generation
  GALAXY_SEED: 'GALAXY_ALPHA_2025',
  SECTOR_SIZE: 1000,

  // Solar System model - stars organized into systems spanning multiple sectors
  SUPER_SECTOR_SIZE: 6000,        // 6x6 normal sectors = 1 super-sector
  MIN_STAR_SEPARATION: 3000,      // Minimum 3 sectors between stars (won't overlap on screen)
  BINARY_SYSTEM_CHANCE: 0.05,     // 5% of systems are binary
  SYSTEMS_PER_SUPER_SECTOR_MIN: 1, // At least 1 star per super-sector
  SYSTEMS_PER_SUPER_SECTOR_MAX: 2, // Occasionally 2 systems per super-sector

  // System influence radius based on star size (in sectors)
  SYSTEM_INFLUENCE_SMALL: 1.5,    // Stars 320-450px
  SYSTEM_INFLUENCE_MEDIUM: 2,     // Stars 450-600px
  SYSTEM_INFLUENCE_LARGE: 3,      // Stars 600-800px

  // Legacy per-sector params (kept for fallback, superseded by star-system.js)
  STARS_PER_SECTOR_MIN: 0,
  STARS_PER_SECTOR_MAX: 2,
  PLANETS_PER_STAR_MIN: 2,
  PLANETS_PER_STAR_MAX: 8,
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
  PLANET_ORBIT_SPEED_BASE: 0.02,   // Base orbit speed - visible orbits (30-120 sec per orbit)
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

  // Radar tier configuration - progressive feature unlocks
  RADAR_TIERS: {
    1: {
      range: 500,
      features: ['stars', 'planets', 'asteroids', 'players_dots', 'npcs_dots', 'bases_dots'],
      description: 'Basic radar - all objects as simple dots'
    },
    2: {
      range: 750,
      features: ['players_triangles', 'npcs_triangles', 'bases_circles', 'direction_indicators'],
      description: 'Enhanced radar - shape differentiation and heading indicators'
    },
    3: {
      range: 1125,
      features: ['faction_colors', 'faction_base_shapes', 'wormholes'],
      description: 'Advanced radar - faction identification and wormhole detection'
    },
    4: {
      range: 1688,
      features: ['weapon_fire', 'wreckage_rarity', 'hover_tooltips'],
      description: 'Tactical radar - combat awareness and loot detection'
    },
    5: {
      range: 2531,
      features: ['sector_map', 'predictive_paths', 'threat_zones'],
      description: 'Strategic radar - full battlefield awareness'
    }
  },

  // Radar icon sizes (in pixels)
  RADAR_ICON_SIZES: {
    dot: 2,
    small_dot: 3,
    medium_dot: 4,
    triangle_small: 5,
    triangle_medium: 6,
    triangle_large: 7,
    base_circle: 6,
    base_shape: 8,
    star: 5,
    wormhole: 6,
    wreckage: 3
  },

  // Faction radar colors (matches FACTION_COLOR_PALETTES but for radar visibility)
  FACTION_RADAR_COLORS: {
    pirate: '#ff6600',
    scavenger: '#888888',
    swarm: '#ffff00',
    void: '#aa00ff',
    rogue_miner: '#00aaff'
  },

  // Faction base shape identifiers
  FACTION_BASE_SHAPES: {
    pirate: 'skull',
    scavenger: 'gear',
    swarm: 'hexagon',
    void: 'star4',
    rogue_miner: 'pickaxe'
  },

  // Radar rarity colors for wreckage/loot
  RADAR_RARITY_COLORS: {
    common: '#888888',
    uncommon: '#00cc00',
    rare: '#4488ff',
    ultrarare: '#aa44ff'
  },

  // Threat zone thresholds and colors
  RADAR_THREAT_ZONES: {
    safe: { maxThreat: 0, color: '#00ff0030' },
    caution: { maxThreat: 50, color: '#ffff0030' },
    dangerous: { maxThreat: 150, color: '#ff880030' },
    extreme: { maxThreat: Infinity, color: '#ff000030' }
  },

  // Combat
  WEAPON_TYPES: ['kinetic', 'energy', 'explosive'],
  BASE_WEAPON_DAMAGE: 10,
  BASE_WEAPON_COOLDOWN: 500,
  BASE_WEAPON_RANGE: 300,  // Legacy - use WEAPON_RANGES for tier-specific ranges
  // Per-tier weapon ranges (must match client visual projectile travel distance)
  // Client calculates: speed * duration/1000 for projectiles, maxRange for beams
  WEAPON_RANGES: [0, 180, 210, 360, 400, 400],  // [unused, tier1, tier2, tier3, tier4, tier5]
  PROJECTILE_SPEED: 800,  // Units per second for trajectory prediction
  SHIELD_RECHARGE_RATE: 2,
  SHIELD_RECHARGE_DELAY: 3000,
  DEATH_CARGO_DROP_PERCENT: 0.5,

  // Mining
  BASE_MINING_TIME: 3000,
  BASE_MINING_YIELD: 1,
  MINING_RANGE: 50,
  RESOURCE_RESPAWN_TIME_MIN: 30 * 60 * 1000,
  RESOURCE_RESPAWN_TIME_MAX: 60 * 60 * 1000,

  // Cargo capacity per tier [0, tier1, tier2, tier3, tier4, tier5]
  CARGO_CAPACITY: [0, 100, 250, 500, 750, 2000],

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

  // Upgrade costs (credits only - legacy, reduced by 40% since resources now also required)
  UPGRADE_COSTS: {
    2: 300,
    3: 900,
    4: 3000,
    5: 9000
  },

  // Upgrade requirements with resources (per component per tier)
  UPGRADE_REQUIREMENTS: {
    engine: {
      2: { credits: 300, resources: { HYDROGEN: 15, CARBON: 10 } },
      3: { credits: 900, resources: { HYDROGEN: 25, HELIUM3: 10, TITANIUM: 8 } },
      4: { credits: 3000, resources: { HELIUM3: 20, XENON: 10, PLATINUM: 5 } },
      5: { credits: 9000, resources: { XENON: 15, ANTIMATTER: 3, EXOTIC_MATTER: 2 } }
    },
    weapon: {
      2: { credits: 300, resources: { IRON: 15, NICKEL: 10 } },
      3: { credits: 900, resources: { TITANIUM: 12, COBALT: 10, COPPER: 8 } },
      4: { credits: 3000, resources: { IRIDIUM: 8, URANIUM: 5, PLATINUM: 8 } },
      5: { credits: 9000, resources: { URANIUM: 12, DARK_MATTER: 5, NEUTRONIUM: 2 } }
    },
    shield: {
      2: { credits: 300, resources: { SILICON: 15, SULFUR: 10 } },
      3: { credits: 900, resources: { ICE_CRYSTALS: 12, LITHIUM: 10, SILVER: 8 } },
      4: { credits: 3000, resources: { QUANTUM_CRYSTALS: 6, DARK_MATTER: 8, GOLD: 10 } },
      5: { credits: 9000, resources: { QUANTUM_CRYSTALS: 12, VOID_CRYSTALS: 2, EXOTIC_MATTER: 3 } }
    },
    mining: {
      2: { credits: 300, resources: { IRON: 20, CARBON: 8 } },
      3: { credits: 900, resources: { TITANIUM: 15, COPPER: 10, COBALT: 8 } },
      4: { credits: 3000, resources: { PLATINUM: 10, IRIDIUM: 6, GOLD: 8 } },
      5: { credits: 9000, resources: { IRIDIUM: 12, NEUTRONIUM: 3, DARK_MATTER: 5 } }
    },
    cargo: {
      2: { credits: 300, resources: { IRON: 20, NICKEL: 12 } },
      3: { credits: 900, resources: { TITANIUM: 18, COPPER: 12, SILVER: 6 } },
      4: { credits: 3000, resources: { TITANIUM: 25, PLATINUM: 8, IRIDIUM: 5 } },
      5: { credits: 9000, resources: { IRIDIUM: 15, NEUTRONIUM: 4, VOID_CRYSTALS: 1 } }
    },
    radar: {
      2: { credits: 300, resources: { COPPER: 12, SILICON: 15 } },
      3: { credits: 900, resources: { SILVER: 10, NEON: 12, LITHIUM: 8 } },
      4: { credits: 3000, resources: { GOLD: 10, QUANTUM_CRYSTALS: 5, XENON: 8 } },
      5: { credits: 9000, resources: { QUANTUM_CRYSTALS: 10, EXOTIC_MATTER: 4, VOID_CRYSTALS: 2 } }
    },
    energy_core: {
      2: { credits: 300, resources: { HYDROGEN: 20, PHOSPHORUS: 10 } },
      3: { credits: 900, resources: { HELIUM3: 15, LITHIUM: 12, URANIUM: 3 } },
      4: { credits: 3000, resources: { URANIUM: 10, DARK_MATTER: 6, HELIUM3: 20 } },
      5: { credits: 9000, resources: { ANTIMATTER: 5, EXOTIC_MATTER: 3, NEUTRONIUM: 2 } }
    },
    hull: {
      2: { credits: 300, resources: { IRON: 25, NICKEL: 15 } },
      3: { credits: 900, resources: { TITANIUM: 20, COBALT: 12, IRON: 20 } },
      4: { credits: 3000, resources: { IRIDIUM: 10, PLATINUM: 10, TITANIUM: 15 } },
      5: { credits: 9000, resources: { NEUTRONIUM: 5, IRIDIUM: 15, VOID_CRYSTALS: 1 } }
    }
  },

  // Energy Core component mechanics
  ENERGY_CORE: {
    // Weapon cooldown reduction per tier (index = tier, 0 unused)
    COOLDOWN_REDUCTION: [0, 0.05, 0.10, 0.15, 0.20, 0.25],
    // Shield recharge bonus per tier (HP/sec added to base rate)
    SHIELD_REGEN_BONUS: [0, 0.5, 1.0, 1.5, 2.0, 2.5],
    // Thrust boost configuration
    BOOST: {
      DOUBLE_TAP_WINDOW: 300,  // ms to detect double-tap
      DURATION: [0, 1000, 1250, 1500, 1750, 2000],  // ms per tier
      SPEED_MULTIPLIER: [0, 2.0, 2.0, 2.2, 2.3, 2.5],
      COOLDOWN: [0, 15000, 13000, 11000, 9000, 7000]  // ms per tier
    }
  },

  // Hull component mechanics
  HULL: {
    // Resistance percentages per tier (index = tier, 0 unused)
    KINETIC_RESIST: [0, 0.05, 0.10, 0.15, 0.20, 0.25],
    ENERGY_RESIST: [0, 0.08, 0.15, 0.22, 0.28, 0.35],
    EXPLOSIVE_RESIST: [0, 0.03, 0.06, 0.09, 0.12, 0.15],
    // Maximum resistance cap (prevents invincibility with future buffs)
    RESISTANCE_CAP: 0.50
  },

  // Ship components list (for UI iteration)
  SHIP_COMPONENTS: [
    { key: 'engine', name: 'Engine', effect: 'Speed & Thrust', tierKey: 'engineTier', dbKey: 'engine_tier' },
    { key: 'weapon', name: 'Weapons', effect: 'Damage & Range', tierKey: 'weaponTier', dbKey: 'weapon_tier' },
    { key: 'shield', name: 'Shields', effect: 'Capacity & Recharge', tierKey: 'shieldTier', dbKey: 'shield_tier' },
    { key: 'mining', name: 'Mining Beam', effect: 'Mining Speed', tierKey: 'miningTier', dbKey: 'mining_tier' },
    { key: 'cargo', name: 'Cargo Hold', effect: 'Inventory Capacity', tierKey: 'cargoTier', dbKey: 'cargo_tier' },
    { key: 'radar', name: 'Radar', effect: 'Detection Range', tierKey: 'radarTier', dbKey: 'radar_tier' },
    { key: 'energy_core', name: 'Energy Core', effect: 'Power Output', tierKey: 'energyCoreTier', dbKey: 'energy_core_tier' },
    { key: 'hull', name: 'Hull', effect: 'Armor & Resistance', tierKey: 'hullTier', dbKey: 'hull_tier' }
  ],

  // Object sizes (for rendering and collision)
  SHIP_SIZE: 20,
  STAR_SIZE_MIN: 320,             // 4x increase (was 80)
  STAR_SIZE_MAX: 800,             // 4x increase (was 200)
  PLANET_SIZE_MIN: 20,
  PLANET_SIZE_MAX: 60,
  ASTEROID_SIZE_MIN: 10,
  ASTEROID_SIZE_MAX: 30,
  WORMHOLE_SIZE: 100,

  // Star danger zones (multipliers of star radius)
  STAR_ZONES: {
    CORONA: 1.5,                  // Visual flares only, no damage
    WARM: 1.3,                    // Light damage, shield drain
    HOT: 1.0,                     // Heavy damage to both shield and hull
    SURFACE: 0.7                  // Deadly, rapid destruction
  },

  // Star heat damage (per second)
  STAR_DAMAGE: {
    WARM_SHIELD_DRAIN: 5,         // Shield drain per second in warm zone
    WARM_HULL_DAMAGE: 0,          // No hull damage in warm zone
    HOT_SHIELD_DRAIN: 15,         // Shield drain per second in hot zone
    HOT_HULL_DAMAGE: 10,          // Hull damage per second in hot zone
    SURFACE_HULL_DAMAGE: 50       // Rapid destruction at surface
  },

  // Star gravity well physics
  STAR_GRAVITY: {
    BASE_STRENGTH: 250,           // Base gravity acceleration (reduced from 800)
    FALLOFF_POWER: 2,             // Inverse square falloff
    INFLUENCE_RADIUS_FACTOR: 2.5, // Gravity extends to 2.5x star radius (reduced from 3)
    ESCAPE_THRUST_FACTOR: 1.2,    // Thrust multiplier needed to escape (reduced from 1.5)
    ENGINE_TIER_REDUCTION: 0.20   // 20% gravity reduction per engine tier above 1 (buffed)
  },

  // Star exclusion zone (prevents object spawning)
  STAR_EXCLUSION_MARGIN: 30,      // Minimum distance from star surface

  // Asteroid orbital belts
  BELT_ORBIT_SPEED_BASE: 0.008,   // Base orbit speed for belt asteroids (visible rotation)
  ASTEROID_BELT_CONFIG: {
    small: {                      // Stars 320-450px
      belts: [
        { radiusMin: 1.5, radiusMax: 2.5, density: 0.8, resourceType: 'common' }
      ]
    },
    medium: {                     // Stars 450-600px
      belts: [
        { radiusMin: 1.3, radiusMax: 2.0, density: 1.0, resourceType: 'common' },
        { radiusMin: 3.5, radiusMax: 4.5, density: 0.5, resourceType: 'uncommon' }
      ]
    },
    large: {                      // Stars 600-800px
      belts: [
        { radiusMin: 1.2, radiusMax: 1.8, density: 1.2, resourceType: 'common' },
        { radiusMin: 2.5, radiusMax: 3.5, density: 0.8, resourceType: 'uncommon' },
        { radiusMin: 5.0, radiusMax: 6.0, density: 0.3, resourceType: 'rare' }
      ]
    }
  },

  // Corona flare particle effects
  CORONA_FLARE: {
    SPAWN_INTERVAL_MIN: 2000,     // Min ms between flares
    SPAWN_INTERVAL_MAX: 5000,     // Max ms between flares
    PARTICLES_PER_FLARE: 8,       // Particles in each flare
    FLARE_DISTANCE_FACTOR: 0.3,   // How far flares extend (30% of star radius)
    PARTICLE_LIFETIME: 1500,      // Particle lifetime in ms
    COLORS: {
      yellow: ['#ffff00', '#ffaa00', '#ff6600'],
      orange: ['#ffaa00', '#ff6600', '#ff3300'],
      white: ['#ffffff', '#aaaaff', '#8888ff'],
      red: ['#ff6600', '#ff3300', '#cc0000']
    }
  },

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

  // Faction color palettes for ships, bases, and effects
  FACTION_COLOR_PALETTES: {
    pirate: {
      primary: '#ff3300',
      secondary: '#cc2200',
      accent: '#ff6600',
      glow: '#ff330060',
      outline: '#ff7744',
      gradient: ['#ff4400', '#cc1100']
    },
    scavenger: {
      primary: '#999966',
      secondary: '#666644',
      accent: '#cccc88',
      glow: '#99996640',
      outline: '#bbbb77',
      gradient: ['#aaaa77', '#555533']
    },
    swarm: {
      // Stealthy predator theme - black hull with crimson accents
      primary: '#1a1a1a',
      secondary: '#0d0d0d',
      accent: '#8b0000',
      glow: '#8b000040',
      outline: '#660000',
      gradient: ['#2a1a1a', '#0a0505'],
      veinColor: '#990000',
      eyeColor: '#ff0000'
    },
    void: {
      primary: '#9900ff',
      secondary: '#660099',
      accent: '#cc66ff',
      glow: '#9900ff80',
      outline: '#bb44ff',
      gradient: ['#aa22ff', '#550088']
    },
    rogue_miner: {
      primary: '#ff9900',
      secondary: '#cc7700',
      accent: '#ffcc00',
      glow: '#ff990050',
      outline: '#ffbb44',
      gradient: ['#ffaa22', '#aa6600']
    }
  },

  // Player ship color options (preset palette)
  PLAYER_COLOR_OPTIONS: [
    { id: 'green', name: 'Default Green', primary: '#00ff00', accent: '#00cc00', glow: '#00ff0060' },
    { id: 'cyan', name: 'Cyan', primary: '#00ffff', accent: '#00cccc', glow: '#00ffff60' },
    { id: 'blue', name: 'Royal Blue', primary: '#4466ff', accent: '#3355cc', glow: '#4466ff60' },
    { id: 'purple', name: 'Purple', primary: '#aa44ff', accent: '#8833cc', glow: '#aa44ff60' },
    { id: 'red', name: 'Crimson', primary: '#ff4444', accent: '#cc3333', glow: '#ff444460' },
    { id: 'orange', name: 'Orange', primary: '#ff8800', accent: '#cc6600', glow: '#ff880060' },
    { id: 'gold', name: 'Gold', primary: '#ffcc00', accent: '#cc9900', glow: '#ffcc0060' },
    { id: 'white', name: 'Silver', primary: '#dddddd', accent: '#aaaaaa', glow: '#dddddd60' },
    { id: 'pink', name: 'Pink', primary: '#ff66aa', accent: '#cc5588', glow: '#ff66aa60' }
  ],

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
      color: '#1a1a1a',        // Black hull - stealthy predator
      secondaryColor: '#8b0000', // Dark crimson accents
      spawnHub: 'swarm_hive',
      spawnRate: 50, // Rare
      patrolRadius: 0, // Stays near hive
      retreatThreshold: 0, // Never retreat
      aiStrategy: 'swarm',
      weaponType: 'dark_energy',
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
    dark_energy: {
      id: 'dark_energy',
      name: 'Dark Energy Bolt',
      color: '#8b0000',        // Dark crimson
      coreColor: '#000000',    // Black core
      glowColor: '#ff000040',  // Red glow
      type: 'projectile',
      damageType: 'explosive',
      size: 7,
      speed: 400,
      trail: true,
      voidTear: true           // Leaves brief void tears in trail
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
      colors: ['#1a1a1a', '#8b0000', '#990000'],  // Black/crimson Swarm death
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
    ANCIENT_STAR_MAP: {
      id: 'ancient_star_map',
      name: 'Ancient Star Map',
      rarity: 'ultrarare',
      value: 500,
      description: 'A weathered artifact containing coordinates to lost civilizations. The symbols shift when viewed from different angles.',
      iconType: 'relic',
      glyphVariant: 'constellation',
      glowColor: '#00aaff'
    },
    VOID_CRYSTAL: {
      id: 'void_crystal',
      name: 'Void Crystal',
      rarity: 'ultrarare',
      value: 750,
      description: 'A shard of crystallized void energy, pulsing with otherworldly power. It whispers of dimensions beyond our own.',
      iconType: 'relic',
      glyphVariant: 'void',
      glowColor: '#aa00ff'
    },
    SWARM_HIVE_CORE: {
      id: 'swarm_hive_core',
      name: 'Swarm Hive Core',
      rarity: 'ultrarare',
      value: 1000,
      description: 'The neural nexus of a Swarm hive. Still pulses with bio-electric signals, as if searching for its lost collective.',
      iconType: 'relic',
      glyphVariant: 'organic',
      glowColor: '#00ff66'
    },
    PIRATE_TREASURE: {
      id: 'pirate_treasure',
      name: 'Pirate Treasure',
      rarity: 'rare',
      value: 300,
      description: 'A chest of ill-gotten gains, marked with the insignia of Captain Vex. The lock mechanism is impossibly intricate.',
      iconType: 'relic',
      glyphVariant: 'currency',
      glowColor: '#ffcc00'
    },
    WORMHOLE_GEM: {
      id: 'wormhole_gem',
      name: 'Wormhole Gem',
      rarity: 'ultrarare',
      value: 2000,
      description: 'A deep purple gemstone mined from the void, with a softly swirling wormhole sigil at its core. Allows transit through wormholes.',
      iconType: 'wormhole_gem',
      glowColor: '#9900ff',
      effect: 'wormhole_transit'
    }
  },

  // Team Multipliers
  TEAM_MULTIPLIERS: {
    1: 1.0,   // Solo: 100%
    2: 1.5,   // Duo: 150%
    3: 2.0,   // Trio: 200%
    4: 2.5    // Squad: 250%
  },

  // Spawn Hub Types (faction bases that spawn NPCs)
  // Now with strategic placement rules for the Solar System model
  SPAWN_HUB_TYPES: {
    pirate_outpost: {
      id: 'pirate_outpost',
      name: 'Pirate Outpost',
      faction: 'pirate',
      health: 2000,
      size: 150,
      respawnTime: 300000, // 5 minutes
      spawnChance: 0.067,  // ~1 per 15 sectors
      patrolRadius: 5,     // NPCs patrol 5 sectors out
      // Strategic placement: outer asteroid belt (ambush miners)
      placement: {
        strategy: 'outer_system',
        minDistFromStar: 0.7,   // 70%+ of system influence radius
        maxDistFromStar: 1.0,
        requiresBelt: true,
        orbitsWithBelt: true    // Base orbits with the belt
      }
    },
    scavenger_yard: {
      id: 'scavenger_yard',
      name: 'Scavenger Yard',
      faction: 'scavenger',
      health: 1000,
      size: 100,
      respawnTime: 180000,
      spawnChance: 0.04,   // ~1 per 25 sectors
      patrolRadius: 2,
      // Strategic placement: between systems (salvage operations)
      placement: {
        strategy: 'debris_field',
        minDistFromStar: 0.8,
        maxDistFromStar: 1.5,   // Can be outside system
        requiresBelt: false,
        preferVoid: false
      }
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
      patrolRadius: 3,
      // Strategic placement: attached to large asteroid in belt (organic horror)
      placement: {
        strategy: 'organic_cave',
        minDistFromStar: 0.4,
        maxDistFromStar: 0.8,
        requiresBelt: true,
        requiresLargeAsteroid: true,
        orbitsWithBelt: true
      }
    },
    void_rift: {
      id: 'void_rift',
      name: 'Void Rift',
      faction: 'void',
      health: 3000,
      size: 120,
      respawnTime: 480000,
      spawnChance: 0.025,  // ~1 per 40 sectors
      patrolRadius: 4,
      // Strategic placement: deep space far from stars (mysterious)
      placement: {
        strategy: 'deep_space',
        minDistFromStar: 1.5,   // Outside all systems
        maxDistFromStar: Infinity,
        requiresBelt: false,
        preferVoid: true
      }
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
      patrolRadius: 3,
      // Strategic placement: inner belt with rare resources (territorial)
      placement: {
        strategy: 'resource_rich',
        minDistFromStar: 0.3,
        maxDistFromStar: 0.6,
        requiresBelt: true,
        preferRareBelt: true,
        orbitsWithBelt: true
      }
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
