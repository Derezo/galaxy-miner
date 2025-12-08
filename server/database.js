const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');
const CONSTANTS = require('../shared/constants');

const DB_PATH = path.join(__dirname, '..', 'data', 'galaxy-miner.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Run migrations for existing databases
// Add ship_color_id column if it doesn't exist
try {
  db.exec(`ALTER TABLE ships ADD COLUMN ship_color_id TEXT DEFAULT 'green'`);
} catch (e) {
  // Column already exists, ignore error
}

// Add energy_core_tier column if it doesn't exist
try {
  db.exec(`ALTER TABLE ships ADD COLUMN energy_core_tier INTEGER DEFAULT 1`);
} catch (e) {
  // Column already exists, ignore error
}

// Add hull_tier column if it doesn't exist
try {
  db.exec(`ALTER TABLE ships ADD COLUMN hull_tier INTEGER DEFAULT 1`);
} catch (e) {
  // Column already exists, ignore error
}

// Add profile_id column if it doesn't exist
try {
  db.exec(`ALTER TABLE ships ADD COLUMN profile_id TEXT DEFAULT 'pilot'`);
} catch (e) {
  // Column already exists, ignore error
}

// Prepared statements for common operations
const statements = {
  // Users
  createUser: db.prepare(`
    INSERT INTO users (username, password_hash) VALUES (?, ?)
  `),
  getUserByUsername: db.prepare(`
    SELECT * FROM users WHERE username = ?
  `),
  getUserById: db.prepare(`
    SELECT * FROM users WHERE id = ?
  `),

  // Ships
  createShip: db.prepare(`
    INSERT INTO ships (user_id) VALUES (?)
  `),
  getShipByUserId: db.prepare(`
    SELECT * FROM ships WHERE user_id = ?
  `),
  updateShipPosition: db.prepare(`
    UPDATE ships SET
      position_x = ?, position_y = ?, rotation = ?,
      velocity_x = ?, velocity_y = ?,
      current_sector_x = ?, current_sector_y = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  updateShipHealth: db.prepare(`
    UPDATE ships SET hull_hp = ?, shield_hp = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  updateShipCredits: db.prepare(`
    UPDATE ships SET credits = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  upgradeShipComponent: db.prepare(`
    UPDATE ships SET
      engine_tier = COALESCE(?, engine_tier),
      weapon_type = COALESCE(?, weapon_type),
      weapon_tier = COALESCE(?, weapon_tier),
      shield_tier = COALESCE(?, shield_tier),
      mining_tier = COALESCE(?, mining_tier),
      cargo_tier = COALESCE(?, cargo_tier),
      radar_tier = COALESCE(?, radar_tier),
      energy_core_tier = COALESCE(?, energy_core_tier),
      hull_tier = COALESCE(?, hull_tier),
      shield_max = COALESCE(?, shield_max),
      hull_max = COALESCE(?, hull_max),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  respawnShip: db.prepare(`
    UPDATE ships SET
      hull_hp = hull_max, shield_hp = shield_max,
      position_x = ?, position_y = ?,
      velocity_x = 0, velocity_y = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  setShipPosition: db.prepare(`
    UPDATE ships SET
      position_x = ?, position_y = ?,
      current_sector_x = ?, current_sector_y = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  updateShipColor: db.prepare(`
    UPDATE ships SET ship_color_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  updateShipProfile: db.prepare(`
    UPDATE ships SET profile_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),

  // Inventory
  getInventory: db.prepare(`
    SELECT * FROM inventory WHERE user_id = ?
  `),
  getInventoryItem: db.prepare(`
    SELECT * FROM inventory WHERE user_id = ? AND resource_type = ?
  `),
  upsertInventory: db.prepare(`
    INSERT INTO inventory (user_id, resource_type, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, resource_type) DO UPDATE SET quantity = quantity + excluded.quantity
  `),
  setInventoryQuantity: db.prepare(`
    UPDATE inventory SET quantity = ? WHERE user_id = ? AND resource_type = ?
  `),
  removeInventoryItem: db.prepare(`
    DELETE FROM inventory WHERE user_id = ? AND resource_type = ? AND quantity <= 0
  `),
  getTotalCargoCount: db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total FROM inventory WHERE user_id = ?
  `),

  // Marketplace
  createListing: db.prepare(`
    INSERT INTO marketplace (seller_id, resource_type, quantity, price_per_unit)
    VALUES (?, ?, ?, ?)
  `),
  getListings: db.prepare(`
    SELECT m.*, u.username as seller_name
    FROM marketplace m
    JOIN users u ON m.seller_id = u.id
    ORDER BY m.listed_at DESC
  `),
  getListingsByResource: db.prepare(`
    SELECT m.*, u.username as seller_name
    FROM marketplace m
    JOIN users u ON m.seller_id = u.id
    WHERE m.resource_type = ?
    ORDER BY m.price_per_unit ASC
  `),
  getListingById: db.prepare(`
    SELECT * FROM marketplace WHERE id = ?
  `),
  getListingsBySeller: db.prepare(`
    SELECT * FROM marketplace WHERE seller_id = ?
  `),
  deleteListing: db.prepare(`
    DELETE FROM marketplace WHERE id = ?
  `),
  updateListingQuantity: db.prepare(`
    UPDATE marketplace SET quantity = ? WHERE id = ?
  `),

  // World changes
  getWorldChange: db.prepare(`
    SELECT * FROM world_changes WHERE object_id = ?
  `),
  createWorldChange: db.prepare(`
    INSERT OR REPLACE INTO world_changes (object_id, change_type, depleted_at, respawn_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
  `),
  getExpiredWorldChanges: db.prepare(`
    SELECT * FROM world_changes WHERE respawn_at <= datetime('now')
  `),
  deleteWorldChange: db.prepare(`
    DELETE FROM world_changes WHERE object_id = ?
  `),
  deleteExpiredWorldChanges: db.prepare(`
    DELETE FROM world_changes WHERE respawn_at <= datetime('now')
  `),

  // Chat
  addChatMessage: db.prepare(`
    INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)
  `),
  getRecentChat: db.prepare(`
    SELECT * FROM chat_messages ORDER BY sent_at DESC LIMIT ?
  `),
  pruneOldChat: db.prepare(`
    DELETE FROM chat_messages WHERE id NOT IN (
      SELECT id FROM chat_messages ORDER BY sent_at DESC LIMIT ?
    )
  `),

  // Components (upgrade materials)
  getComponents: db.prepare(`
    SELECT * FROM components WHERE user_id = ?
  `),
  getComponent: db.prepare(`
    SELECT * FROM components WHERE user_id = ? AND component_type = ?
  `),
  upsertComponent: db.prepare(`
    INSERT INTO components (user_id, component_type, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, component_type) DO UPDATE SET quantity = quantity + excluded.quantity
  `),
  removeComponent: db.prepare(`
    UPDATE components SET quantity = quantity - ? WHERE user_id = ? AND component_type = ?
  `),
  deleteEmptyComponents: db.prepare(`
    DELETE FROM components WHERE user_id = ? AND quantity <= 0
  `),

  // Relics (rare collectibles)
  getRelics: db.prepare(`
    SELECT * FROM relics WHERE user_id = ? ORDER BY obtained_at DESC
  `),
  hasRelic: db.prepare(`
    SELECT 1 FROM relics WHERE user_id = ? AND UPPER(relic_type) = UPPER(?)
  `),
  addRelic: db.prepare(`
    INSERT OR IGNORE INTO relics (user_id, relic_type) VALUES (?, ?)
  `),

  // Active Buffs (temporary power-ups)
  getActiveBuffs: db.prepare(`
    SELECT * FROM active_buffs WHERE user_id = ? AND expires_at > ?
  `),
  addBuff: db.prepare(`
    INSERT INTO active_buffs (user_id, buff_type, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, buff_type) DO UPDATE SET expires_at = excluded.expires_at
  `),
  removeBuff: db.prepare(`
    DELETE FROM active_buffs WHERE user_id = ? AND buff_type = ?
  `),
  cleanupExpiredBuffs: db.prepare(`
    DELETE FROM active_buffs WHERE expires_at <= ?
  `)
};

// Transaction helpers
const createUserWithShip = db.transaction((username, passwordHash) => {
  const userResult = statements.createUser.run(username, passwordHash);
  statements.createShip.run(userResult.lastInsertRowid);
  return userResult.lastInsertRowid;
});

const purchaseListing = db.transaction((buyerId, listingId, quantity) => {
  const listing = statements.getListingById.get(listingId);
  if (!listing) return { success: false, error: 'Listing not found' };
  if (listing.quantity < quantity) return { success: false, error: 'Not enough quantity' };

  const totalCost = listing.price_per_unit * quantity;
  const buyerShip = statements.getShipByUserId.get(buyerId);
  if (buyerShip.credits < totalCost) return { success: false, error: 'Not enough credits' };

  // Transfer credits
  statements.updateShipCredits.run(buyerShip.credits - totalCost, buyerId);
  const sellerShip = statements.getShipByUserId.get(listing.seller_id);
  statements.updateShipCredits.run(sellerShip.credits + totalCost, listing.seller_id);

  // Transfer resources
  statements.upsertInventory.run(buyerId, listing.resource_type, quantity);

  // Update or remove listing
  if (listing.quantity === quantity) {
    statements.deleteListing.run(listingId);
  } else {
    statements.updateListingQuantity.run(listing.quantity - quantity, listingId);
  }

  return { success: true, cost: totalCost };
});

/**
 * Perform ship upgrade with resource deduction (atomic transaction)
 * @param {number} userId - User ID
 * @param {string} component - Component key (engine, weapon, shield, etc.)
 * @param {Object} requirements - { credits: number, resources: { RESOURCE_TYPE: quantity } }
 * @param {number} maxTier - Maximum tier (default 5)
 * @returns {Object} { success: boolean, error?: string, newTier?: number, creditsSpent?: number }
 */
const performUpgrade = db.transaction((userId, component, requirements, maxTier = 5) => {
  // 1. Get ship and verify current tier
  const ship = statements.getShipByUserId.get(userId);
  if (!ship) return { success: false, error: 'Ship not found' };

  // Map component key to database column name
  const dbColumnMap = {
    'engine': 'engine_tier',
    'weapon': 'weapon_tier',
    'shield': 'shield_tier',
    'mining': 'mining_tier',
    'cargo': 'cargo_tier',
    'radar': 'radar_tier',
    'energy_core': 'energy_core_tier',
    'hull': 'hull_tier'
  };

  const dbColumn = dbColumnMap[component];
  if (!dbColumn) return { success: false, error: 'Invalid component' };

  const currentTier = ship[dbColumn] || 1;
  if (currentTier >= maxTier) return { success: false, error: 'Already at max tier' };

  // 2. Check credits
  const shipCredits = ship.credits || 0;
  if (shipCredits < requirements.credits) {
    return { success: false, error: `Not enough credits (need ${requirements.credits}, have ${shipCredits})` };
  }

  // 3. Check all resources
  const inventory = statements.getInventory.all(userId);
  const inventoryMap = new Map(inventory.map(i => [i.resource_type, i.quantity]));

  for (const [resourceType, required] of Object.entries(requirements.resources || {})) {
    const available = inventoryMap.get(resourceType) || 0;
    if (available < required) {
      return {
        success: false,
        error: `Need ${required} ${resourceType} (have ${available})`
      };
    }
  }

  // 4. Deduct credits
  statements.updateShipCredits.run(shipCredits - requirements.credits, userId);

  // 5. Deduct resources
  for (const [resourceType, quantity] of Object.entries(requirements.resources || {})) {
    const current = inventoryMap.get(resourceType);
    const newQuantity = current - quantity;
    logger.log(`[INVENTORY] User ${userId} ${resourceType}: ${current} -> ${newQuantity} (upgrade -${quantity})`);
    if (newQuantity <= 0) {
      // Remove entry entirely
      db.prepare('DELETE FROM inventory WHERE user_id = ? AND resource_type = ?')
        .run(userId, resourceType);
    } else {
      statements.setInventoryQuantity.run(newQuantity, userId, resourceType);
    }
  }

  // 6. Apply upgrade - build params array for upgradeShipComponent
  // Order: engine, weapon_type, weapon, shield, mining, cargo, radar, energy_core, hull, shield_max, hull_max, user_id
  const nextTier = currentTier + 1;
  const updateParams = [null, null, null, null, null, null, null, null, null, null, null, userId];
  const componentToIndex = {
    'engine': 0,
    'weapon': 2,
    'shield': 3,
    'mining': 4,
    'cargo': 5,
    'radar': 6,
    'energy_core': 7,
    'hull': 8
  };
  updateParams[componentToIndex[component]] = nextTier;

  // Recalculate max HP values for shield/hull upgrades
  // Shield uses SHIELD_TIER_MULTIPLIER (2.0x), Hull uses TIER_MULTIPLIER (1.5x)
  if (component === 'shield') {
    const shieldMultiplier = CONSTANTS.SHIELD_TIER_MULTIPLIER || 2.0;
    const newShieldMax = Math.round(CONSTANTS.DEFAULT_SHIELD_HP * Math.pow(shieldMultiplier, nextTier - 1));
    updateParams[9] = newShieldMax;  // shield_max
  } else if (component === 'hull') {
    const hullMultiplier = CONSTANTS.TIER_MULTIPLIER || 1.5;
    const newHullMax = Math.round(CONSTANTS.DEFAULT_HULL_HP * Math.pow(hullMultiplier, nextTier - 1));
    updateParams[10] = newHullMax;  // hull_max
  }

  statements.upgradeShipComponent.run(...updateParams);

  return { success: true, newTier: nextTier, creditsSpent: requirements.credits };
});

/**
 * Safely update ship credits - prevents null/NaN from ever being written
 * @param {number} credits - New credit value
 * @param {number} userId - User ID
 * @returns {Object} Result of the update
 */
function safeUpdateCredits(credits, userId) {
  // Validate credits is a valid number - if invalid, don't update (preserve current value)
  if (credits === null || credits === undefined || Number.isNaN(credits) || typeof credits !== 'number') {
    logger.warn(`safeUpdateCredits: Invalid credits value (${credits}) for user ${userId}, skipping update`);
    return { changes: 0 }; // Return empty result, don't update
  }

  const safeCredits = Math.max(0, Math.floor(credits)); // Ensure non-negative integer
  return statements.updateShipCredits.run(safeCredits, userId);
}

/**
 * Safely get credits from a ship object, never returns null
 * @param {Object|null} ship - Ship object from database
 * @returns {number} Credits value, defaults to 0
 */
function getSafeCredits(ship) {
  if (!ship) return 0;
  const credits = ship.credits;
  if (credits === null || credits === undefined || Number.isNaN(credits)) {
    return 0;
  }
  return credits;
}

/**
 * Safely add resources to inventory - validates inputs before updating
 * @param {number} userId - User ID
 * @param {string} resourceType - Resource type string
 * @param {number} quantity - Quantity to add (must be positive)
 * @returns {Object} Result of the update, or { changes: 0 } if invalid
 */
function safeUpsertInventory(userId, resourceType, quantity) {
  // Validate userId
  if (!userId || typeof userId !== 'number') {
    logger.warn(`[INVENTORY] Invalid userId (${userId}), skipping`);
    return { changes: 0 };
  }

  // Validate resourceType
  if (!resourceType || typeof resourceType !== 'string') {
    logger.warn(`[INVENTORY] Invalid resourceType (${resourceType}) for user ${userId}, skipping`);
    return { changes: 0 };
  }

  // Validate quantity - MUST be positive to add resources
  if (quantity === null || quantity === undefined || Number.isNaN(quantity) || typeof quantity !== 'number' || quantity <= 0) {
    logger.warn(`[INVENTORY] Invalid quantity (${quantity}) for ${resourceType}, user ${userId}, skipping`);
    return { changes: 0 };
  }

  const safeQuantity = Math.floor(quantity); // Ensure integer

  // Get current quantity before update for logging
  const before = statements.getInventoryItem.get(userId, resourceType);
  const beforeQty = before ? before.quantity : 0;

  const result = statements.upsertInventory.run(userId, resourceType, safeQuantity);

  // Verify the update and log
  const after = statements.getInventoryItem.get(userId, resourceType);
  const afterQty = after ? after.quantity : 0;

  // CRITICAL: Detect if quantity unexpectedly decreased
  if (afterQty < beforeQty) {
    logger.error(`[INVENTORY CRITICAL] User ${userId} ${resourceType}: quantity DECREASED from ${beforeQty} to ${afterQty}! Adding ${safeQuantity}`);
  }

  // Log significant changes for debugging
  if (beforeQty !== afterQty) {
    logger.log(`[INVENTORY] User ${userId} ${resourceType}: ${beforeQty} -> ${afterQty} (+${safeQuantity})`);
  }

  return result;
}

module.exports = {
  db,
  statements,
  createUserWithShip,
  purchaseListing,
  performUpgrade,
  safeUpdateCredits,
  getSafeCredits,
  safeUpsertInventory
};
