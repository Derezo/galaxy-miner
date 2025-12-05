-- Galaxy Miner Database Schema

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ships table (one per user)
CREATE TABLE IF NOT EXISTS ships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  rotation REAL DEFAULT 0,
  velocity_x REAL DEFAULT 0,
  velocity_y REAL DEFAULT 0,
  current_sector_x INTEGER DEFAULT 0,
  current_sector_y INTEGER DEFAULT 0,
  hull_hp INTEGER DEFAULT 100,
  hull_max INTEGER DEFAULT 100,
  shield_hp INTEGER DEFAULT 50,
  shield_max INTEGER DEFAULT 50,
  credits INTEGER DEFAULT 100,
  -- Component tiers (1-5)
  engine_tier INTEGER DEFAULT 1,
  weapon_type TEXT DEFAULT 'kinetic',
  weapon_tier INTEGER DEFAULT 1,
  shield_tier INTEGER DEFAULT 1,
  mining_tier INTEGER DEFAULT 1,
  cargo_tier INTEGER DEFAULT 1,
  radar_tier INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory (resources in cargo)
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  UNIQUE(user_id, resource_type)
);

-- Marketplace listings
CREATE TABLE IF NOT EXISTS marketplace (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit INTEGER NOT NULL,
  listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- World modifications (mined/depleted resources)
CREATE TABLE IF NOT EXISTS world_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT UNIQUE NOT NULL,
  change_type TEXT NOT NULL,
  depleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  respawn_at TIMESTAMP NOT NULL
);

-- Chat messages (keep last N for history)
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ships_user_id ON ships(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_resource ON marketplace(resource_type);
CREATE INDEX IF NOT EXISTS idx_world_changes_object ON world_changes(object_id);
CREATE INDEX IF NOT EXISTS idx_world_changes_respawn ON world_changes(respawn_at);
CREATE INDEX IF NOT EXISTS idx_chat_sent ON chat_messages(sent_at);
