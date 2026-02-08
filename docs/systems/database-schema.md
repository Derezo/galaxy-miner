# Database Schema

Complete SQLite database schema reference for Galaxy Miner.

## Table of Contents

- [Overview](#overview)
- [Initialization](#initialization)
- [Tables](#tables)
  - [users](#users)
  - [ships](#ships)
  - [inventory](#inventory)
  - [marketplace](#marketplace)
  - [world_changes](#world_changes)
  - [chat_messages](#chat_messages)
  - [components](#components)
  - [relics](#relics)
  - [active_buffs](#active_buffs)
  - [fleets](#fleets)
  - [fleet_members](#fleet_members)
  - [fleet_invites](#fleet_invites)
- [Relationships](#relationships)
- [Indexes](#indexes)
- [WAL Mode and Pragmas](#wal-mode-and-pragmas)
- [Migrations](#migrations)
- [Backup and Recovery](#backup-and-recovery)

## Overview

Galaxy Miner uses SQLite via the `better-sqlite3` driver for all persistent data. SQLite was chosen for its zero-configuration setup, single-file storage, and strong performance for the expected player count (50+ concurrent). The database stores player accounts, ship state, inventory, marketplace listings, world modifications, chat history, collectibles, buffs, and fleet data.

All database access uses prepared statements to prevent SQL injection. Transactions wrap multi-step operations (user registration, marketplace purchases, ship upgrades) to maintain consistency.

**Database file**: `/data/galaxy-miner.db` (auto-created on first startup)

## Initialization

On server startup (`/server/database.js`), the following sequence runs:

1. The `data/` directory is created if it does not exist.
2. The database file is opened (or created) at `/data/galaxy-miner.db`.
3. Two pragmas are set: `journal_mode = WAL` and `foreign_keys = ON`.
4. The full schema from `/server/schema.sql` is executed. All `CREATE TABLE` statements use `IF NOT EXISTS`, making this safe to run repeatedly.
5. Column migrations run via `ALTER TABLE ... ADD COLUMN` wrapped in try/catch blocks. If the column already exists, the error is silently ignored.

The schema is defined in `/server/schema.sql` and is the single source of truth for table structure.

## Tables

### users

Player accounts and authentication credentials.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique user identifier |
| `username` | TEXT | UNIQUE NOT NULL | Player display name (case-sensitive, unique) |
| `password_hash` | TEXT | NOT NULL | bcrypt hash of the player's password |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ships

Ship state including position, health, component tiers, credits, and cosmetics. Each user has exactly one ship (enforced by the `UNIQUE` constraint on `user_id`).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | INTEGER | (auto) | Primary key |
| `user_id` | INTEGER | - | Owner's user ID (unique, cascading delete) |
| `position_x` | REAL | 0 | X world coordinate |
| `position_y` | REAL | 0 | Y world coordinate |
| `rotation` | REAL | 0 | Ship facing angle (radians) |
| `velocity_x` | REAL | 0 | X velocity component |
| `velocity_y` | REAL | 0 | Y velocity component |
| `current_sector_x` | INTEGER | 0 | Current sector grid X |
| `current_sector_y` | INTEGER | 0 | Current sector grid Y |
| `hull_hp` | INTEGER | 100 | Current hull hit points |
| `hull_max` | INTEGER | 100 | Maximum hull HP (scales with hull_tier) |
| `shield_hp` | INTEGER | 50 | Current shield points |
| `shield_max` | INTEGER | 50 | Maximum shield (scales with shield_tier) |
| `credits` | INTEGER | 100 | Player currency balance |
| `engine_tier` | INTEGER | 1 | Engine upgrade level (1-5) |
| `weapon_type` | TEXT | 'kinetic' | Active weapon type |
| `weapon_tier` | INTEGER | 1 | Weapon upgrade level (1-5) |
| `shield_tier` | INTEGER | 1 | Shield upgrade level (1-5) |
| `mining_tier` | INTEGER | 1 | Mining laser upgrade level (1-5) |
| `cargo_tier` | INTEGER | 1 | Cargo hold upgrade level (1-5) |
| `radar_tier` | INTEGER | 1 | Radar range upgrade level (1-5) |
| `energy_core_tier` | INTEGER | 1 | Energy core upgrade level (1-5) |
| `hull_tier` | INTEGER | 1 | Hull plating upgrade level (1-5) |
| `ship_color_id` | TEXT | 'green' | Ship color customization ID |
| `profile_id` | TEXT | 'pilot' | Player profile avatar ID |
| `updated_at` | TIMESTAMP | CURRENT_TIMESTAMP | Last modification time |

```sql
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
  engine_tier INTEGER DEFAULT 1,
  weapon_type TEXT DEFAULT 'kinetic',
  weapon_tier INTEGER DEFAULT 1,
  shield_tier INTEGER DEFAULT 1,
  mining_tier INTEGER DEFAULT 1,
  cargo_tier INTEGER DEFAULT 1,
  radar_tier INTEGER DEFAULT 1,
  energy_core_tier INTEGER DEFAULT 1,
  hull_tier INTEGER DEFAULT 1,
  ship_color_id TEXT DEFAULT 'green',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Position is saved to the database every 5 seconds (configurable via `POSITION_SAVE_INTERVAL_MS`). Hull/shield are updated on combat events. Component tiers are updated on upgrade transactions.

### inventory

Player cargo hold contents. Each row represents a stack of one resource type. The `UNIQUE(user_id, resource_type)` constraint ensures one row per resource per player. Quantities are modified via upsert operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Row identifier |
| `user_id` | INTEGER | NOT NULL, FK -> users | Owner |
| `resource_type` | TEXT | NOT NULL | Resource identifier (e.g., 'iron', 'diamond') |
| `quantity` | INTEGER | DEFAULT 0 | Stack count |

```sql
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  UNIQUE(user_id, resource_type)
);
```

Resources are added via `INSERT ... ON CONFLICT DO UPDATE SET quantity = quantity + excluded.quantity` (upsert). When quantity reaches zero after a deduction, the row is deleted.

### marketplace

Active player-to-player trade listings. Listings are created when a player lists resources for sale and removed when fully purchased or cancelled.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Listing identifier |
| `seller_id` | INTEGER | NOT NULL, FK -> users | Seller's user ID |
| `resource_type` | TEXT | NOT NULL | Resource being sold |
| `quantity` | INTEGER | NOT NULL | Units available |
| `price_per_unit` | INTEGER | NOT NULL | Price in credits per unit |
| `listed_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the listing was created |

```sql
CREATE TABLE IF NOT EXISTS marketplace (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit INTEGER NOT NULL,
  listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Purchases run inside a transaction that atomically: checks buyer credits, transfers credits between buyer and seller, transfers resources, and updates or removes the listing.

### world_changes

Tracks depleted asteroids and other world modifications. When a player fully mines an asteroid, a record is created with a `respawn_at` timestamp. The game engine periodically checks for expired entries and deletes them, allowing the asteroid to regenerate.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Row identifier |
| `object_id` | TEXT | UNIQUE NOT NULL | Procedural ID of the world object |
| `change_type` | TEXT | NOT NULL | Type of change (e.g., 'depleted') |
| `depleted_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the change occurred |
| `respawn_at` | TIMESTAMP | NOT NULL | When the object should reappear |

```sql
CREATE TABLE IF NOT EXISTS world_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT UNIQUE NOT NULL,
  change_type TEXT NOT NULL,
  depleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  respawn_at TIMESTAMP NOT NULL
);
```

The `object_id` corresponds to procedurally generated identifiers, ensuring the same asteroid is tracked consistently across sessions.

### chat_messages

Global chat message history. Older messages are pruned periodically to keep the table bounded.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Message identifier |
| `user_id` | INTEGER | NOT NULL, FK -> users | Author's user ID |
| `username` | TEXT | NOT NULL | Author's display name (denormalized for query speed) |
| `message` | TEXT | NOT NULL | Message content |
| `sent_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the message was sent |

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The `username` column is denormalized (duplicated from `users.username`) to avoid joins when fetching chat history. A `pruneOldChat` prepared statement keeps only the N most recent messages.

### components

Upgrade component inventory for advanced ship upgrades (tier 6+ system). Components are rare drops from NPC loot pools.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Row identifier |
| `user_id` | INTEGER | NOT NULL, FK -> users | Owner |
| `component_type` | TEXT | NOT NULL | Component identifier |
| `quantity` | INTEGER | DEFAULT 1 | Stack count |

```sql
CREATE TABLE IF NOT EXISTS components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  UNIQUE(user_id, component_type)
);
```

### relics

Rare permanent collectibles obtained from special encounters (e.g., plundering faction bases). Each relic type can only be held once per player, enforced by `UNIQUE(user_id, relic_type)`. The `INSERT OR IGNORE` pattern prevents duplicates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Row identifier |
| `user_id` | INTEGER | NOT NULL, FK -> users | Owner |
| `relic_type` | TEXT | NOT NULL | Relic identifier |
| `obtained_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the relic was obtained |

```sql
CREATE TABLE IF NOT EXISTS relics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relic_type TEXT NOT NULL,
  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, relic_type)
);
```

### active_buffs

Temporary power-ups with expiration timestamps. Buffs are granted from loot drops and automatically cleaned up when expired. The `UNIQUE(user_id, buff_type)` constraint means applying the same buff again updates its expiration via upsert.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Row identifier |
| `user_id` | INTEGER | NOT NULL, FK -> users | Affected player |
| `buff_type` | TEXT | NOT NULL | Buff identifier |
| `expires_at` | INTEGER | NOT NULL | Expiration as Unix timestamp (ms) |

```sql
CREATE TABLE IF NOT EXISTS active_buffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buff_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(user_id, buff_type)
);
```

### fleets

Player party/fleet definitions. Each player can lead at most one fleet (enforced by `UNIQUE(leader_id)`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Fleet identifier |
| `leader_id` | INTEGER | NOT NULL, FK -> users, UNIQUE | Fleet leader's user ID |
| `name` | TEXT | NOT NULL, DEFAULT 'Fleet' | Fleet display name |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |

```sql
CREATE TABLE IF NOT EXISTS fleets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Fleet',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(leader_id)
);
```

### fleet_members

Fleet membership records. Uses a composite primary key `(fleet_id, user_id)` so each player can only be in one fleet at a time per fleet.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `fleet_id` | INTEGER | PK, FK -> fleets | Fleet identifier |
| `user_id` | INTEGER | PK, FK -> users | Member's user ID |
| `role` | TEXT | DEFAULT 'member' | Role: 'leader' or 'member' |
| `joined_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the player joined |

```sql
CREATE TABLE IF NOT EXISTS fleet_members (
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(fleet_id, user_id)
);
```

### fleet_invites

Pending fleet invitations with expiration. The `UNIQUE(fleet_id, invitee_id)` constraint prevents duplicate invites to the same player from the same fleet.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Invite identifier |
| `fleet_id` | INTEGER | NOT NULL, FK -> fleets | Target fleet |
| `inviter_id` | INTEGER | NOT NULL, FK -> users | Who sent the invite |
| `invitee_id` | INTEGER | NOT NULL, FK -> users | Who received the invite |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the invite was sent |
| `expires_at` | TIMESTAMP | NOT NULL | Invitation expiration time |

```sql
CREATE TABLE IF NOT EXISTS fleet_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  inviter_id INTEGER NOT NULL REFERENCES users(id),
  invitee_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(fleet_id, invitee_id)
);
```

## Relationships

All tables with a `user_id` foreign key use `ON DELETE CASCADE`, meaning that deleting a user removes all their related data (ship, inventory, listings, messages, components, relics, buffs, fleet memberships, and invites).

```
users (1) ──── (1) ships              One user has exactly one ship
users (1) ──── (N) inventory          One user has many resource stacks
users (1) ──── (N) marketplace        One user has many active listings
users (1) ──── (N) chat_messages      One user has many messages
users (1) ──── (N) components         One user has many component stacks
users (1) ──── (N) relics             One user has many relics
users (1) ──── (N) active_buffs       One user has many active buffs
users (1) ──── (0..1) fleets          One user can lead at most one fleet
users (1) ──── (N) fleet_members      One user can be a member of fleets
fleets (1) ──── (N) fleet_members     One fleet has many members
fleets (1) ──── (N) fleet_invites     One fleet has many pending invites
```

The `world_changes` table is standalone -- it references procedurally generated object IDs rather than user records.

## Indexes

Performance indexes are defined in `/server/schema.sql` after all table definitions. They cover the most common query patterns:

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_ships_user_id` | ships | user_id | Ship lookup by owner |
| `idx_inventory_user_id` | inventory | user_id | Fetch all cargo for a player |
| `idx_marketplace_seller` | marketplace | seller_id | Seller's active listings |
| `idx_marketplace_resource` | marketplace | resource_type | Browse marketplace by resource |
| `idx_world_changes_object` | world_changes | object_id | Check if an asteroid is depleted |
| `idx_world_changes_respawn` | world_changes | respawn_at | Find expired depletion records |
| `idx_chat_sent` | chat_messages | sent_at | Fetch recent chat in order |
| `idx_components_user_id` | components | user_id | Player's component inventory |
| `idx_relics_user_id` | relics | user_id | Player's relic collection |
| `idx_active_buffs_user_id` | active_buffs | user_id | Player's active buffs |
| `idx_active_buffs_expires` | active_buffs | expires_at | Cleanup expired buffs |
| `idx_fleet_members_user` | fleet_members | user_id | Find which fleet a player belongs to |
| `idx_fleet_invites_invitee` | fleet_invites | invitee_id | Find pending invites for a player |

## WAL Mode and Pragmas

The database is initialized with two key pragmas in `/server/database.js`:

```javascript
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

**WAL (Write-Ahead Logging)** mode provides:
- Better concurrency: readers do not block writers and writers do not block readers
- Improved write performance for the frequent position-save operations (every 5 seconds for all online players)
- Crash safety: the WAL file ensures incomplete transactions are rolled back on recovery

This creates two additional files alongside the main database:
- `galaxy-miner.db-wal` -- the write-ahead log
- `galaxy-miner.db-shm` -- shared memory file for WAL coordination

Both files are managed automatically by SQLite and should not be deleted while the server is running.

**Foreign keys** are enabled explicitly because SQLite disables them by default. This ensures cascading deletes work correctly when a user account is removed.

## Migrations

Galaxy Miner uses a simple migration strategy suited to its single-database, single-server architecture:

1. **Schema file** (`/server/schema.sql`): All `CREATE TABLE IF NOT EXISTS` statements. Safe to run on every startup because existing tables are skipped.

2. **Column additions** (`/server/database.js`): New columns are added via `ALTER TABLE ... ADD COLUMN` wrapped in try/catch. If the column already exists, SQLite throws an error that is silently caught. Current migrations:
   - `ships.ship_color_id` (TEXT, default 'green')
   - `ships.energy_core_tier` (INTEGER, default 1)
   - `ships.hull_tier` (INTEGER, default 1)
   - `ships.profile_id` (TEXT, default 'pilot')

3. **Trigger-based migration**: A trigger in `schema.sql` ensures `ship_color_id` defaults to `'green'` for any insert that would leave it null (backward compatibility).

New migrations should follow the existing pattern: add an `ALTER TABLE` in `database.js` wrapped in try/catch, with a comment explaining when it was added.

## Backup and Recovery

### Backup

Stop the server before backing up to ensure a clean snapshot:

```bash
# Simple backup
cp data/galaxy-miner.db data/galaxy-miner.db.backup

# Timestamped backup
cp data/galaxy-miner.db "data/backup-$(date +%Y%m%d-%H%M%S).db"
```

If you cannot stop the server, the WAL mode ensures the main `.db` file is always in a consistent state, but you should also copy the `-wal` and `-shm` files together for a complete backup.

### Reset

Delete all database files and restart the server. A fresh database is created automatically:

```bash
rm -f data/galaxy-miner.db*
npm start
```

This removes all player accounts, ships, inventory, marketplace listings, and world changes. The procedural world regenerates identically from the seed.

### Production Backups

The deployment script (`scripts/deploy-production.sh`) automatically creates compressed backups of the remote application directory before each deployment, keeping the last 5 backups in `/var/backups/galaxy-miner/`.

## See Also

- [Authentication System](authentication.md) - Login/register flow using the `users` table
- [Resources System](resources.md) - Resource types stored in `inventory`
- [Ship Upgrades](ship-upgrades.md) - Upgrade tiers stored in `ships`
- [Marketplace Events](../api/socket-events.md#marketplace-events) - Socket events for trading
- [Deployment Guide](../deployment.md) - Database management in production
