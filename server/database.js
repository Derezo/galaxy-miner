const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

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

module.exports = {
  db,
  statements,
  createUserWithShip,
  purchaseListing
};
