/**
 * Test setup and utilities for Galaxy Miner
 * Provides in-memory SQLite database helpers and test fixtures
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Create an in-memory SQLite database with the full schema applied
 * @returns {Database} In-memory better-sqlite3 database instance
 */
function createTestDatabase() {
  const db = new Database(':memory:');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Read and apply the schema
  const schemaPath = path.join(__dirname, '..', 'server', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  return db;
}

/**
 * Create a test user in the database
 * @param {Database} db - Database instance
 * @param {Object} userData - User data
 * @param {string} userData.username - Username
 * @param {string} userData.passwordHash - Pre-hashed password
 * @returns {Object} Created user with id
 */
function createTestUser(db, { username = 'testuser', passwordHash = '$2b$10$test' } = {}) {
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  const result = stmt.run(username, passwordHash);
  return {
    id: result.lastInsertRowid,
    username,
    passwordHash
  };
}

/**
 * Create a test ship for a user
 * @param {Database} db - Database instance
 * @param {number} userId - User ID to create ship for
 * @param {Object} shipData - Optional ship data overrides
 * @returns {Object} Created ship
 */
function createTestShip(db, userId, shipData = {}) {
  const defaults = {
    position_x: 0,
    position_y: 0,
    rotation: 0,
    velocity_x: 0,
    velocity_y: 0,
    current_sector_x: 0,
    current_sector_y: 0,
    hull_hp: 100,
    hull_max: 100,
    shield_hp: 50,
    shield_max: 50,
    credits: 100,
    engine_tier: 1,
    weapon_type: 'kinetic',
    weapon_tier: 1,
    shield_tier: 1,
    mining_tier: 1,
    cargo_tier: 1,
    radar_tier: 1,
    energy_core_tier: 1,
    hull_tier: 1,
    ship_color_id: 'green'
  };

  const data = { ...defaults, ...shipData };

  const stmt = db.prepare(`
    INSERT INTO ships (
      user_id, position_x, position_y, rotation, velocity_x, velocity_y,
      current_sector_x, current_sector_y, hull_hp, hull_max, shield_hp, shield_max,
      credits, engine_tier, weapon_type, weapon_tier, shield_tier, mining_tier,
      cargo_tier, radar_tier, energy_core_tier, hull_tier, ship_color_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const result = stmt.run(
    userId, data.position_x, data.position_y, data.rotation,
    data.velocity_x, data.velocity_y, data.current_sector_x, data.current_sector_y,
    data.hull_hp, data.hull_max, data.shield_hp, data.shield_max, data.credits,
    data.engine_tier, data.weapon_type, data.weapon_tier, data.shield_tier,
    data.mining_tier, data.cargo_tier, data.radar_tier, data.energy_core_tier,
    data.hull_tier, data.ship_color_id
  );

  return {
    id: result.lastInsertRowid,
    user_id: userId,
    ...data
  };
}

/**
 * Add resources to a user's inventory
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @param {string} resourceType - Resource type (e.g., 'IRON', 'COPPER')
 * @param {number} quantity - Amount to add
 */
function addInventory(db, userId, resourceType, quantity) {
  const stmt = db.prepare(`
    INSERT INTO inventory (user_id, resource_type, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, resource_type)
    DO UPDATE SET quantity = quantity + excluded.quantity
  `);
  stmt.run(userId, resourceType, quantity);
}

/**
 * Get a user's inventory
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {Array} Array of inventory items
 */
function getInventory(db, userId) {
  const stmt = db.prepare('SELECT * FROM inventory WHERE user_id = ?');
  return stmt.all(userId);
}

/**
 * Create a marketplace listing
 * @param {Database} db - Database instance
 * @param {Object} listingData - Listing data
 * @returns {Object} Created listing
 */
function createListing(db, { sellerId, resourceType, quantity, pricePerUnit }) {
  const stmt = db.prepare(`
    INSERT INTO marketplace (seller_id, resource_type, quantity, price_per_unit)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(sellerId, resourceType, quantity, pricePerUnit);
  return {
    id: result.lastInsertRowid,
    seller_id: sellerId,
    resource_type: resourceType,
    quantity,
    price_per_unit: pricePerUnit
  };
}

/**
 * Clean up database and close connection
 * @param {Database} db - Database instance
 */
function closeTestDatabase(db) {
  if (db && db.open) {
    db.close();
  }
}

// Mock CONSTANTS for testing shared modules
const MOCK_CONSTANTS = {
  TIER_MULTIPLIER: 1.5,
  BASE_MINING_TIME: 3000,
  BASE_WEAPON_DAMAGE: 10,
  BASE_WEAPON_COOLDOWN: 500,
  SHIELD_RECHARGE_RATE: 5,
  BASE_SPEED: 150,
  RADAR_TIERS: {
    1: { range: 500 },
    2: { range: 750 },
    3: { range: 1125 },
    4: { range: 1687 },
    5: { range: 2531 }
  },
  CARGO_CAPACITY: {
    1: 50,
    2: 75,
    3: 112,
    4: 168,
    5: 253
  },
  SECTOR_BOUNDARY_MARGIN: 30,
  ASTEROID_ORBIT_VELOCITY: 0.2,
  STAR_GRAVITY: {
    BASE_STRENGTH: 800,
    FALLOFF_POWER: 2,
    INFLUENCE_RADIUS_FACTOR: 3,
    ENGINE_TIER_REDUCTION: 0.15
  },
  STAR_ZONES: {
    CORONA: 1.5,
    WARM: 1.3,
    HOT: 1.0,
    SURFACE: 0.7
  },
  STAR_DAMAGE: {
    WARM_SHIELD_DRAIN: 5,
    WARM_HULL_DAMAGE: 0,
    HOT_SHIELD_DRAIN: 15,
    HOT_HULL_DAMAGE: 10,
    SURFACE_HULL_DAMAGE: 50
  }
};

module.exports = {
  createTestDatabase,
  createTestUser,
  createTestShip,
  addInventory,
  getInventory,
  createListing,
  closeTestDatabase,
  MOCK_CONSTANTS
};
