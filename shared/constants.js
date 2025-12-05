// Shared constants between client and server

const CONSTANTS = {
  // World generation
  GALAXY_SEED: 'GALAXY_ALPHA_2025',
  SECTOR_SIZE: 1000,
  STARS_PER_SECTOR_MIN: 1,
  STARS_PER_SECTOR_MAX: 5,
  PLANETS_PER_STAR_MIN: 0,
  PLANETS_PER_STAR_MAX: 6,
  ASTEROIDS_PER_SECTOR_MIN: 3,
  ASTEROIDS_PER_SECTOR_MAX: 15,
  WORMHOLE_CHANCE: 0.05,

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

  // Resources
  RESOURCE_TYPES: {
    // Common
    IRON: { name: 'Iron', rarity: 'common', baseValue: 5 },
    CARBON: { name: 'Carbon', rarity: 'common', baseValue: 5 },
    SILICON: { name: 'Silicon', rarity: 'common', baseValue: 6 },
    HYDROGEN: { name: 'Hydrogen', rarity: 'common', baseValue: 4 },
    // Uncommon
    COPPER: { name: 'Copper', rarity: 'uncommon', baseValue: 15 },
    TITANIUM: { name: 'Titanium', rarity: 'uncommon', baseValue: 20 },
    HELIUM3: { name: 'Helium-3', rarity: 'uncommon', baseValue: 25 },
    ICE_CRYSTALS: { name: 'Ice Crystals', rarity: 'uncommon', baseValue: 18 },
    // Rare
    PLATINUM: { name: 'Platinum', rarity: 'rare', baseValue: 50 },
    DARK_MATTER: { name: 'Dark Matter', rarity: 'rare', baseValue: 75 },
    QUANTUM_CRYSTALS: { name: 'Quantum Crystals', rarity: 'rare', baseValue: 100 },
    // Ultra-rare
    EXOTIC_MATTER: { name: 'Exotic Matter', rarity: 'ultrarare', baseValue: 200 },
    ANTIMATTER: { name: 'Antimatter', rarity: 'ultrarare', baseValue: 300 }
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
  CHAT_HISTORY_SIZE: 100
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
