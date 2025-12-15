// Shared constants between client and server

const CONSTANTS = {
  // World generation
  GALAXY_SEED: 'GALAXY_ALPHA_2025',
  SECTOR_SIZE: 1000,

  // Solar System model - stars organized into systems spanning multiple sectors
  SUPER_SECTOR_SIZE: 6000,        // 6x6 normal sectors = 1 super-sector
  MIN_STAR_SEPARATION: 3000,      // Minimum 3 sectors between stars (won't overlap on screen)
  BINARY_SYSTEM_CHANCE: 0.05,     // 5% of systems are binary

  // Binary star orbital configuration
  BINARY_STAR_CONFIG: {
    ECCENTRICITY_MIN: 0.0,        // Circular orbit minimum
    ECCENTRICITY_MAX: 0.5,        // Maximum orbital eccentricity
    SECONDARY_COLOR_SHIFT: true,  // Visual distinction for secondary star
    ORBIT_PERIOD_BASE: 120        // Base seconds for one complete orbit
  },

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
  PLANETS_PER_STAR_MAX: 9,  // Increased from 8 for 10% boost
  ASTEROIDS_PER_SECTOR_MIN: 3,
  ASTEROIDS_PER_SECTOR_MAX: 15,
  WORMHOLE_CHANCE: 0.08,  // 8% of star systems have wormholes (spawn area guaranteed)

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
  SHIELD_TIER_MULTIPLIER: 2.0,  // Shields scale 2x per tier (T5 = 800 HP base)

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
    // Shield recharge bonus per tier (HP/sec added to base rate) - doubled for combat viability
    SHIELD_REGEN_BONUS: [0, 1.0, 2.0, 3.0, 4.0, 5.0],
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
  WORMHOLE_SIZE: 200,

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

  // Star Spectral Classes - astronomically accurate star types
  STAR_SPECTRAL_CLASSES: {
    O: {
      name: 'Blue Giant',
      tempK: 30000,
      color: '#9bb0ff',
      coronaColor: '#aaddff',
      coreColor: '#ffffff',
      sizeRange: [700, 800],
      massMultiplier: 2.0,
      rarity: 0.03  // 3% - Very rare
    },
    B: {
      name: 'Blue-White',
      tempK: 20000,
      color: '#aabfff',
      coronaColor: '#bbccff',
      coreColor: '#ffffff',
      sizeRange: [600, 700],
      massMultiplier: 1.6,
      rarity: 0.08  // 8%
    },
    A: {
      name: 'White',
      tempK: 10000,
      color: '#cad7ff',
      coronaColor: '#ddeeff',
      coreColor: '#ffffff',
      sizeRange: [500, 600],
      massMultiplier: 1.4,
      rarity: 0.12  // 12%
    },
    F: {
      name: 'Yellow-White',
      tempK: 7500,
      color: '#f8f7ff',
      coronaColor: '#ffffee',
      coreColor: '#ffffff',
      sizeRange: [450, 500],
      massMultiplier: 1.2,
      rarity: 0.15  // 15%
    },
    G: {
      name: 'Yellow',
      tempK: 6000,
      color: '#fff4ea',
      coronaColor: '#ffeecc',
      coreColor: '#ffffee',
      sizeRange: [400, 450],
      massMultiplier: 1.0,
      rarity: 0.20  // 20% - Most common sun-like
    },
    K: {
      name: 'Orange',
      tempK: 4500,
      color: '#ffd2a1',
      coronaColor: '#ffcc88',
      coreColor: '#ffeecc',
      sizeRange: [350, 400],
      massMultiplier: 0.8,
      rarity: 0.22  // 22%
    },
    M: {
      name: 'Red Dwarf',
      tempK: 3000,
      color: '#ffcc6f',
      coronaColor: '#ff9944',
      coreColor: '#ffddaa',
      sizeRange: [320, 350],
      massMultiplier: 0.5,
      rarity: 0.20  // 20% - Common small stars
    }
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

  // Asteroid belt density multiplier (10% increase)
  ASTEROID_BELT_DENSITY_MULTIPLIER: 1.1,

  // Expanded Planet Types (15 types total)
  PLANET_TYPES: {
    // Original 7 types
    rocky: {
      name: 'Rocky Planet',
      colors: ['#8B4513', '#A0522D', '#6B4423'],
      sizeRange: [20, 40],
      hasCraters: true,
      hasAtmosphere: false,
      rarity: 0.15
    },
    gas: {
      name: 'Gas Giant',
      colors: ['#DEB887', '#D2B48C', '#C4A066'],
      sizeRange: [50, 60],
      hasBands: true,
      hasAtmosphere: true,
      rarity: 0.10
    },
    ice: {
      name: 'Ice World',
      colors: ['#ADD8E6', '#B0E0E6', '#87CEEB'],
      sizeRange: [25, 45],
      hasPolarCaps: true,
      hasAtmosphere: false,
      rarity: 0.08
    },
    lava: {
      name: 'Lava Planet',
      colors: ['#FF4500', '#FF6347', '#DC143C'],
      sizeRange: [20, 35],
      hasLavaGlow: true,
      hasAtmosphere: false,
      rarity: 0.06
    },
    ocean: {
      name: 'Ocean World',
      colors: ['#4169E1', '#1E90FF', '#00CED1'],
      sizeRange: [30, 50],
      hasClouds: true,
      hasAtmosphere: true,
      rarity: 0.08
    },
    desert: {
      name: 'Desert Planet',
      colors: ['#DAA520', '#CD853F', '#D2691E'],
      sizeRange: [25, 45],
      hasDunes: true,
      hasAtmosphere: false,
      rarity: 0.10
    },
    jungle: {
      name: 'Jungle World',
      colors: ['#228B22', '#32CD32', '#006400'],
      sizeRange: [30, 50],
      hasClouds: true,
      hasAtmosphere: true,
      rarity: 0.06
    },
    // NEW 8 types
    hot_jupiter: {
      name: 'Hot Jupiter',
      colors: ['#FF8C00', '#FF7F50', '#FF6600'],
      sizeRange: [55, 60],
      hasBands: true,
      hasHeatGlow: true,
      hasAtmosphere: true,
      rarity: 0.05
    },
    super_earth: {
      name: 'Super Earth',
      colors: ['#708090', '#778899', '#5F6A6A'],
      sizeRange: [35, 50],
      hasAtmosphere: true,
      hasClouds: true,
      rarity: 0.07
    },
    dwarf: {
      name: 'Dwarf Planet',
      colors: ['#A9A9A9', '#808080', '#696969'],
      sizeRange: [10, 20],
      hasCraters: true,
      hasAtmosphere: false,
      rarity: 0.08
    },
    ringed_giant: {
      name: 'Ringed Giant',
      colors: ['#F4A460', '#DEB887', '#D2B48C'],
      sizeRange: [50, 60],
      hasBands: true,
      hasRings: true,
      hasAtmosphere: true,
      rarity: 0.04
    },
    volcanic: {
      name: 'Volcanic World',
      colors: ['#B22222', '#8B0000', '#660000'],
      sizeRange: [15, 25],
      hasLavaGlow: true,
      hasVolcanoes: true,
      hasAtmosphere: false,
      rarity: 0.05
    },
    barren: {
      name: 'Barren World',
      colors: ['#696969', '#808080', '#5A5A5A'],
      sizeRange: [20, 40],
      hasCraters: true,
      hasAtmosphere: false,
      rarity: 0.08
    },
    temperate: {
      name: 'Temperate World',
      colors: ['#4682B4', '#5F9EA0', '#3CB371'],
      sizeRange: [30, 50],
      hasClouds: true,
      hasAtmosphere: true,
      hasOceans: true,
      rarity: 0.05
    },
    toxic: {
      name: 'Toxic World',
      colors: ['#9ACD32', '#6B8E23', '#556B2F'],
      sizeRange: [25, 45],
      hasToxicClouds: true,
      hasAtmosphere: true,
      rarity: 0.05
    }
  },

  // Asteroid Types (composition-based)
  ASTEROID_TYPES: {
    metallic: {
      name: 'Metallic Asteroid',
      colors: ['#C0C0C0', '#A8A8A8', '#909090'],
      highlightColor: '#D8D8D8',
      surfacePattern: 'smooth',
      rarity: 0.30
    },
    carbonaceous: {
      name: 'Carbonaceous Asteroid',
      colors: ['#2F2F2F', '#3D3D3D', '#4A4A4A'],
      highlightColor: '#5A5A5A',
      surfacePattern: 'porous',
      rarity: 0.40
    },
    silicate: {
      name: 'Silicate Asteroid',
      colors: ['#8B7355', '#6B5344', '#7A6450'],
      highlightColor: '#A08060',
      surfacePattern: 'rocky',
      rarity: 0.30
    }
  },

  // Asteroid Size Classes (determines rotation speed and vertex count)
  ASTEROID_SIZE_CLASSES: {
    small: {
      sizeRange: [5, 12],
      rotationSpeed: [0.5, 2.0],  // radians per second
      vertices: [5, 7],
      irregularity: 0.3          // Shape irregularity factor
    },
    medium: {
      sizeRange: [12, 20],
      rotationSpeed: [0.2, 0.8],
      vertices: [6, 9],
      irregularity: 0.25
    },
    large: {
      sizeRange: [20, 35],
      rotationSpeed: [0.05, 0.3],
      vertices: [8, 12],
      irregularity: 0.2
    }
  },

  // Comet Configuration (rare hazards)
  COMET_CONFIG: {
    SPAWN_CHANCE: 0.005,          // 0.5% per system
    WARNING_TIME: 10000,          // 10 second warning before comet arrives
    TRAVERSAL_SPEED: 500,         // units/second (very fast)
    SIZE_RANGE: [30, 60],         // Comet nucleus size
    PLAYER_COLLISION_DAMAGE: 50,  // Damage to player on collision
    KNOCKBACK_FORCE: 200,         // Force applied on collision
    TAIL_LENGTH_FACTOR: 8,        // Tail length = size * factor
    CORE_COLOR: '#88CCFF',        // Icy blue core
    COMA_COLOR: '#AADDFF',        // Fuzzy coma around nucleus
    ION_TAIL_COLORS: ['#88CCFF', '#AADDFF', '#FFFFFF'],  // Blue ion tail
    DUST_TAIL_COLORS: ['#FFE4B5', '#F5DEB3', '#DEB887'], // Yellowish dust tail
    DUST_TAIL_CURVE: 0.3,         // How much dust tail curves away from ion tail
    TRAJECTORY_TYPES: ['flyby', 'perihelion', 'hyperbolic']
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
    WORMHOLE: '#00ccff',
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
      primary: '#D4A017',      // Construction yellow
      secondary: '#8B4513',    // Saddle brown
      accent: '#B87333',       // Copper
      steel: '#71797E',        // Steel gray
      glow: '#D4A01740',
      outline: '#FFD700',
      gradient: ['#D4A017', '#8B4513']
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

  // Player ship color options (preset palette - 21 colors in 7x3 grid)
  PLAYER_COLOR_OPTIONS: [
    // Row 1: Greens, Cyans, Blues
    { id: 'green', name: 'Green', primary: '#00ff00', accent: '#00cc00', glow: '#00ff0060' },
    { id: 'lime', name: 'Lime', primary: '#32cd32', accent: '#228b22', glow: '#32cd3260' },
    { id: 'teal', name: 'Teal', primary: '#20b2aa', accent: '#008080', glow: '#20b2aa60' },
    { id: 'cyan', name: 'Cyan', primary: '#00ffff', accent: '#00cccc', glow: '#00ffff60' },
    { id: 'sky', name: 'Sky', primary: '#00bfff', accent: '#0099cc', glow: '#00bfff60' },
    { id: 'blue', name: 'Blue', primary: '#4466ff', accent: '#3355dd', glow: '#4466ff60' },
    { id: 'deeppurple', name: 'Deep Purple', primary: '#4b0082', accent: '#380062', glow: '#4b008260' },
    // Row 2: Purples, Reds, Oranges
    { id: 'purple', name: 'Purple', primary: '#9932cc', accent: '#7722aa', glow: '#9932cc60' },
    { id: 'violet', name: 'Violet', primary: '#8a2be2', accent: '#6a1bb2', glow: '#8a2be260' },
    { id: 'magenta', name: 'Magenta', primary: '#ff00ff', accent: '#cc00cc', glow: '#ff00ff60' },
    { id: 'red', name: 'Red', primary: '#ff4444', accent: '#cc3333', glow: '#ff444460' },
    { id: 'crimson', name: 'Crimson', primary: '#dc143c', accent: '#b01030', glow: '#dc143c60' },
    { id: 'orange', name: 'Orange', primary: '#ff8800', accent: '#cc6600', glow: '#ff880060' },
    { id: 'amber', name: 'Amber', primary: '#ffbf00', accent: '#cc9900', glow: '#ffbf0060' },
    // Row 3: Yellows, Neutrals, Pinks
    { id: 'gold', name: 'Gold', primary: '#ffd700', accent: '#ccac00', glow: '#ffd70060' },
    { id: 'yellow', name: 'Yellow', primary: '#ffff00', accent: '#cccc00', glow: '#ffff0060' },
    { id: 'white', name: 'White', primary: '#ffffff', accent: '#cccccc', glow: '#ffffff60' },
    { id: 'silver', name: 'Silver', primary: '#c0c0c0', accent: '#a0a0a0', glow: '#c0c0c060' },
    { id: 'stealth', name: 'Stealth', primary: '#3a3a3a', accent: '#2a2a2a', glow: '#3a3a3a40' },
    { id: 'pink', name: 'Pink', primary: '#ff69b4', accent: '#cc5590', glow: '#ff69b460' },
    { id: 'coral', name: 'Coral', primary: '#ff7f50', accent: '#cc6640', glow: '#ff7f5060' }
  ],

  // Shield visual configuration by tier
  SHIELD_VISUALS: {
    1: { shape: 'circle', color: '#4488ff', glow: 'rgba(68, 136, 255, 0.25)', pulseSpeed: 0, size: 1.0 },
    2: { shape: 'circle', color: '#55aaff', glow: 'rgba(85, 170, 255, 0.3)', pulseSpeed: 0.5, size: 1.0 },
    3: { shape: 'hexagon', color: '#66ccff', glow: 'rgba(102, 204, 255, 0.35)', pulseSpeed: 1.0, size: 1.05 },
    4: { shape: 'hexagon', color: '#88ddff', glow: 'rgba(136, 221, 255, 0.4)', pulseSpeed: 1.5, size: 1.08 },
    5: { shape: 'dodecagon', color: '#aaeeff', glow: 'rgba(170, 238, 255, 0.45)', pulseSpeed: 2.0, size: 1.12 }
  },

  // Profile avatar options (emoji placeholders for now)
  PROFILE_OPTIONS: [
    { id: 'pilot', emoji: '\u{1F680}', name: 'Pilot' },
    { id: 'pirate', emoji: '\u{2620}', name: 'Pirate' },
    { id: 'trader', emoji: '\u{1F4B0}', name: 'Trader' },
    { id: 'explorer', emoji: '\u{1F52D}', name: 'Explorer' },
    { id: 'miner', emoji: '\u{26CF}', name: 'Miner' },
    { id: 'warrior', emoji: '\u{2694}', name: 'Warrior' },
    { id: 'scientist', emoji: '\u{1F52C}', name: 'Scientist' },
    { id: 'alien', emoji: '\u{1F47D}', name: 'Alien' }
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
      aiStrategy: 'pirate',
      weaponType: 'pirate_heavy_blaster',
      deathEffect: 'explosion',
      shieldPiercing: 0.1  // All pirate weapons pierce 10% of shields
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
    // Pirate faction weapons - all have 10% shield piercing
    pirate_light_blaster: {
      id: 'pirate_light_blaster',
      name: 'Light Blaster',
      color: '#ff4400',
      coreColor: '#ffffff',
      glowColor: '#ff440060',
      type: 'projectile',
      damageType: 'kinetic',
      size: 5,
      speed: 500,
      trail: true,
      shieldPiercing: 0.1,
      description: 'Fast-firing scout weapon with shield piercing'
    },
    pirate_heavy_blaster: {
      id: 'pirate_heavy_blaster',
      name: 'Heavy Blaster',
      color: '#ff2200',
      coreColor: '#ffffff',
      glowColor: '#ff220080',
      type: 'projectile',
      damageType: 'kinetic',
      size: 8,
      speed: 450,
      trail: true,
      hasGlow: true,
      shieldPiercing: 0.1,
      description: 'Powerful pirate weapon with pulsing glow and shield piercing'
    },
    pirate_cannon: {
      id: 'pirate_cannon',
      name: 'Pirate Cannon',
      color: '#333333',
      secondaryColor: '#ff6600',
      glowColor: '#ff660050',
      smokeColor: '#666666',
      sparkColor: '#ffcc00',
      type: 'projectile',
      damageType: 'explosive',
      size: 12,
      speed: 350,
      trail: true,
      isCannonball: true,
      hasSmoke: true,
      shieldPiercing: 0.1,
      description: 'Massive cannonball with fire trail, used by dreadnoughts'
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
    },
    dual_laser: {
      id: 'dual_laser',
      name: 'Dual Laser',
      color: '#D4A017',      // Construction yellow
      coreColor: '#FFD700',  // Gold core
      glowColor: '#D4A01740',
      type: 'projectile',
      damageType: 'energy',
      size: 4,
      speed: 500,
      trail: false,
      dual: true             // Fires two parallel shots
    },
    boring_drill: {
      id: 'boring_drill',
      name: 'Boring Drill',
      color: '#999966',
      type: 'melee',
      damageType: 'kinetic',
      chargeTime: 1500,
      instantKill: true
    },
    loader_slam: {
      id: 'loader_slam',
      name: 'Loader Slam',
      color: '#666644',
      type: 'melee',
      damageType: 'kinetic',
      size: 20,
      knockback: true
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
      description: 'A chest of ill-gotten gains. Increases credits from NPC wreckage by 10%.',
      iconType: 'relic',
      glyphVariant: 'currency',
      glowColor: '#ffcc00',
      effect: 'credit_bonus',
      effects: {
        npcWreckageCreditBonus: 0.10  // +10% credits from NPC wreckage
      }
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
    },
    SCRAP_SIPHON: {
      id: 'scrap_siphon',
      name: 'Scrap Siphon',
      rarity: 'legendary',
      value: 2500,
      description: 'Collect wreckage faster and grab multiple pieces at once. Scavengers ignore your wreckage collection.',
      iconType: 'scrap_siphon',
      glyphVariant: 'mechanical',
      glowColor: '#D4A017',
      effects: {
        wreckageCollectionSpeed: 0.5,
        multiWreckageCount: 3,
        multiWreckageRange: 300,
        scavengerWreckageImmunity: true
      }
    },
    MINING_RITES: {
      id: 'mining_rites',
      name: 'Mining Rites',
      rarity: 'legendary',
      value: 2500,
      description: 'An ancient amethyst pickaxe blessed by the Rogue Foremen. Multiplies mining yield by 5x.',
      iconType: 'mining_rites',
      glyphVariant: 'mining',
      glowColor: '#9b59b6',
      effects: {
        miningYieldMultiplier: 5
      }
    },
    SKULL_AND_BONES: {
      id: 'skull_and_bones',
      name: 'Skull and Bones',
      rarity: 'ultrarare',
      value: 3000,
      description: 'A cursed pirate banner that allows plundering faction bases without destroying them. Press M near any base to steal resources instantly.',
      iconType: 'skull_and_bones',
      glowColor: '#1a1a1a',
      effect: 'plunder',
      cooldown: 15000,          // 15 second cooldown
      plunderRange: 200,        // Must be within 200 units of base edge
      aggroRange: 600           // NPCs within 600 units become hostile
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
      size: 240,  // Increased 20% from 200
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

  // Mining claim asteroid generation (for NPC mining targets)
  MINING_CLAIM_ASTEROIDS: {
    COUNT_MIN: 3,           // Minimum asteroids/planets near a mining claim
    COUNT_MAX: 5,           // Maximum asteroids/planets near a mining claim
    SPAWN_RADIUS: 1000,     // Generate within 1000 units of mining claim
    MIN_SPACING: 100,       // Minimum distance between spawned objects
    PLANET_CHANCE: 0.2      // 20% chance each object is a planet vs asteroid
  },

  // Swarm Assimilation System
  SWARM_ASSIMILATION: {
    DRONE_ASSIMILATE_SPEED: 120,        // Movement speed toward target base
    ASSIMILATION_THRESHOLD: 3,          // Drones needed to convert a base
    ASSIMILATE_RANGE: 50,               // Distance to "reach" the base for sacrifice
    SEARCH_RANGE: 2000                  // Range drones search for enemy bases
  },

  // Swarm Egg Hatching
  SWARM_HATCHING: {
    SPAWN_RADIUS: 100,                  // Eggs spawn within 100 units of base
    HATCH_DURATION: 2500,               // 2.5 seconds hatch time for regular swarm
    QUEEN_HATCH_DURATION: 4000          // 4 seconds hatch time for queen
  },

  // Swarm Queen Spawning
  SWARM_QUEEN_SPAWN: {
    ASSIMILATED_BASES_REQUIRED: 3,      // Bases in same sector to trigger queen
    QUEEN_SPAWN_COOLDOWN: 3600000,      // 1 hour between queen spawns (server-wide)
    MAX_QUEENS: 1,                       // Maximum queens at any time
    QUEEN_AURA_RANGE: 2000,             // Range for base health regen aura
    BASE_REGEN_PERCENT: 0.005,          // 0.5% health/second for bases in aura
    QUEEN_GUARD_RANGE: 500,             // Range where swarm NPCs switch to guard mode
    QUEEN_SIZE_MULTIPLIER: 2.5          // 150% larger than normal boss visual (spider)
  },

  // Swarm Queen Phase-Based Boss AI
  SWARM_QUEEN_PHASES: {
    // Phase thresholds (percentage of max health)
    HUNT: {
      minHealth: 0.75,
      maxHealth: 1.0,
      name: 'Hunt Phase',
      color: { primary: '#8b0000', glow: '#ff000040' }
    },
    SIEGE: {
      minHealth: 0.50,
      maxHealth: 0.75,
      name: 'Siege Phase',
      color: { primary: '#990033', glow: '#ff336640' }
    },
    SWARM: {
      minHealth: 0.10,
      maxHealth: 0.50,
      name: 'Swarm Phase',
      color: { primary: '#660066', glow: '#9900ff60' }
    },
    DESPERATION: {
      minHealth: 0,
      maxHealth: 0.10,
      name: 'Desperation Phase',
      color: { primary: '#ff3300', glow: '#ff660080' }
    }
  },

  // Phase-specific modifiers
  SWARM_QUEEN_PHASE_MODIFIERS: {
    HUNT: {
      speedMultiplier: 2.0,           // 40 -> 80 units/sec for pursuit
      damageMultiplier: 1.0,
      spawnRateMultiplier: 0.5,       // Slower spawns during hunt
      aggroMultiplier: 1.5
    },
    SIEGE: {
      speedMultiplier: 0.6,           // Slower, defensive
      damageMultiplier: 0.8,
      spawnRateMultiplier: 2.0,       // Double spawn rate
      aggroMultiplier: 1.0
    },
    SWARM: {
      speedMultiplier: 0.8,
      damageMultiplier: 1.2,
      spawnRateMultiplier: 3.0,       // Triple spawn rate
      aggroMultiplier: 2.0
    },
    DESPERATION: {
      speedMultiplier: 2.5,           // Berserk speed
      damageMultiplier: 2.0,          // Double damage
      spawnRateMultiplier: 0,         // No more spawning, all-in attack
      aggroMultiplier: 3.0
    }
  },

  // Queen Special Attacks
  QUEEN_ATTACKS: {
    WEB_SNARE: {
      cooldown: 15000,                // 15 second cooldown
      range: 400,                      // Cast range
      radius: 150,                     // Effect radius
      duration: 4000,                  // 4 seconds of slow
      slowPercent: 0.6,                // 60% movement speed reduction
      chargeTime: 1000,                // 1 second charge animation
      projectileSpeed: 300             // Web projectile speed
    },
    ACID_BURST: {
      cooldown: 12000,                // 12 second cooldown
      range: 350,                      // Cast range
      radius: 100,                     // Explosion radius
      damage: 15,                      // Impact damage
      dotDamage: 5,                    // Damage per tick
      dotDuration: 5000,               // 5 seconds DoT
      dotInterval: 1000,               // Tick every second
      projectileSpeed: 250
    }
  },

  // Tesla Cannon - Tier 5 Player Weapon with Chain Lightning
  TESLA_CANNON: {
    chainJumps: 3,                    // Max targets (primary + 2 chains)
    chainRange: 150,                  // Units per jump to find next target
    damageFalloff: [1.0, 0.5, 0.25], // Damage multiplier per jump
    teslaCoilDuration: 500,           // ms for base impact tesla effect
    teslaCoilRange: 200,              // Range to find NPCs for tesla coil arcs
    colors: {
      primary: '#00ccff',             // Electric blue
      secondary: '#44ffaa',           // Cyan-green
      core: '#ffffff',                // White core
      glow: '#00ccff60'               // Blue glow 40% opacity
    }
  },

  // NPC to Swarm conversion mapping
  SWARM_CONVERSION_MAP: {
    // Pirates
    pirate_scout: 'swarm_drone',
    pirate_fighter: 'swarm_worker',
    pirate_captain: 'swarm_warrior',
    // Scavengers
    scavenger_scrapper: 'swarm_drone',
    scavenger_salvager: 'swarm_worker',
    scavenger_collector: 'swarm_warrior',
    // Void
    void_whisper: 'swarm_drone',
    void_shadow: 'swarm_worker',
    void_phantom: 'swarm_warrior',
    // Rogue Miners
    rogue_prospector: 'swarm_drone',
    rogue_driller: 'swarm_worker',
    rogue_excavator: 'swarm_warrior'
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
