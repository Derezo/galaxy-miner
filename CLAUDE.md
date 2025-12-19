# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Galaxy Miner is a multiplayer browser-based space mining game. Players navigate a procedurally generated galaxy, mine resources, fight NPCs, upgrade ships, and trade with each other in real-time.

**Tech Stack**: Node.js + Express + Socket.io (backend), vanilla JavaScript + HTML5 Canvas (frontend), SQLite with better-sqlite3 (persistence)

## Commands

```bash
npm start              # Production server on port 3388
npm run dev            # Development with auto-reload (--watch)
npm test               # Run test suite (vitest)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
```

Run a single test file:
```bash
npx vitest run tests/unit/server/auth.test.js
```

Run tests matching a pattern:
```bash
npx vitest run -t "username validation"
```

Server runs at `http://0.0.0.0:3388`. No build step required - vanilla JS served directly.

## Architecture

### Client-Server Communication
Real-time bidirectional via Socket.io events:
- **Auth**: `auth:login`, `auth:register`, `auth:token`, `auth:logout`
- **Movement**: `player:input` (position/velocity sync)
- **Mining**: `mining:start`, `mining:cancel`, `mining:complete`
- **Combat**: `combat:fire`, `combat:hit`, `player:death`, `player:respawn`
- **NPCs**: `npc:update`, `npc:death`, `loot:spawn`, `loot:collect`
- **Marketplace**: `market:list`, `market:buy`, `market:cancel`, `market:getListings`
- **Chat/Emotes**: `chat:send`, `chat:message`, `emote:send`, `emote:broadcast`
- **Upgrades**: `ship:upgrade`, `ship:getData`, `ship:setColor`
- **World**: `world:update` (asteroid depletion broadcasts)

### Procedural Generation
Both client and server use identical seeded random generation (seed: `GALAXY_ALPHA_2025`) for world consistency. Sectors are 1000x1000 units, generated on-demand. Faction bases spawn procedurally with configurable rates per faction.

### Game Loop Architecture
- **Server**: 20 ticks/second (`/server/game/engine.js`) - updates players, NPCs, combat, mining progress
- **Client**: 60 FPS via requestAnimationFrame - local prediction with server reconciliation

### Key Server Modules

| Module | Purpose |
|--------|---------|
| `/server/socket.js` | All Socket.io event handlers, dispatches to game systems |
| `/server/game/engine.js` | Game tick loop, coordinates all subsystems |
| `/server/game/combat.js` | Damage calculation, weapons, health, death/respawn |
| `/server/game/npc.js` | NPC spawning, faction base management, AI coordination |
| `/server/game/ai/*.js` | AI behavior strategies (see below) |
| `/server/game/loot.js` | Loot drops, buffs, components, relics |
| `/server/game/mining.js` | Mining mechanics and resource drops |
| `/server/game/marketplace.js` | Player-to-player trading |
| `/server/auth.js` | Authentication, bcrypt hashing, session management |
| `/server/database.js` | SQLite setup and prepared statements |
| `/server/world.js` | Server-side world generation |

### NPC AI System (`/server/game/ai/`)

Modular AI with faction-specific strategies:
- `pirate.js` - Pirates: primary AI coordinator with aggression logic
- `flanking.js` - Flanking maneuvers with shield piercing
- `swarm.js` - Swarm: coordinated group attacks, linked health pools, assimilation mechanics
- `territorial.js` - Rogue Miners: defend claimed territory around mining claims
- `scavenger.js` - Scavengers: target wreckage, opportunistic behavior
- `retreat.js` - Retreat behavior when damaged
- `formation.js` - Void Entities: maintain formation patterns in deep space
- `mining.js` - NPC mining behavior for resource-gathering NPCs

Each faction has a spawn hub type (bases) that continuously spawns NPCs. Hub destruction stops spawning until respawn timer. The Swarm faction has unique mechanics including queen spawning, base assimilation, and egg hatching.

### Key Client Modules

| Module | Purpose |
|--------|---------|
| `/client/js/network.js` | Socket.io client, event handlers |
| `/client/js/game.js` | Client game loop controller |
| `/client/js/renderer.js` | Canvas rendering, camera system |
| `/client/js/player.js` | Local player physics and state |
| `/client/js/world.js` | Client-side procedural generation |
| `/client/js/entities.js` | Entity management (players, NPCs, projectiles) |
| `/client/js/input.js` | Keyboard/mouse input handling (unified mobile/desktop) |

### Mobile System (`/client/js/mobile/`)

Touch-optimized controls for mobile devices. See `/client/js/mobile/README.md` for detailed API.

- `device-detect.js` - Device detection, body classes (`is-mobile`, `is-touch`, `is-landscape`)
- `virtual-joystick.js` - Floating touch joystick for movement (left 40% of screen)
- `auto-fire.js` - Automatic firing when aimed at enemies within tolerance
- `mobile-hud.js` - Touch action buttons (fire, context action, menu)

Mobile CSS in `/client/css/mobile.css` handles responsive layout, safe area insets, and touch targets.

### Network Handlers (`/client/js/network/`)

Modular Socket.io event handlers (88 handlers across 10 modules). See `/client/js/network/README.md`.

| Module | Events |
|--------|--------|
| `auth.js` | Login, register, token auth |
| `player.js` | Player updates, death, respawn |
| `combat.js` | Fire, hit, damage |
| `mining.js` | Mining start, progress, complete |
| `npc.js` | NPC updates, death, queen events |
| `loot.js` | Wreckage spawn, collect, buffs |
| `marketplace.js` | List, buy, cancel |
| `ship.js` | Upgrades, customization |
| `chat.js` | Messages, emotes |
| `wormhole.js` | Transit events |

### Graphics System (`/client/js/graphics/`)

Canvas rendering modules for visual effects:
- `ships.js` / `npc-ships.js` - Ship rendering with faction-specific designs
- `weapons.js` / `npc-weapons.js` - Projectiles and beam weapons
- `particles.js` - Particle system for explosions, trails
- `death-effects.js` - Per-faction death animations
- `faction-bases.js` - Spawn hub rendering
- `hit-effects.js` - Damage feedback visuals
- `thrust.js` / `tractor-beam.js` - Engine and mining beam effects

### UI System (`/client/js/ui/`)

See `/client/js/ui/README.md` for detailed API documentation.

- **Core** (`core/`): Component factory, Modal controller, reactive UIState store, Toast notifications
- **Icons** (`icons/`): Parameterized SVG generator for 26 resource types (Crystal/Orbital/Material shapes)
- **Panels** (`panels/`): CargoPanel, MarketPanel, ShipCustomizationPanel

### Audio System (`/client/js/audio/`)

Web Audio API engine with spatial audio support. See `/client/js/audio/README.md` for detailed API.

- `AudioManager.js` - Central API: `play(soundId)`, `playAt(soundId, x, y)`, `startLoop()`, `stopLoop()`
- `SpatialAudio.js` - Distance-based volume/pan (range: 0-1000 units)
- `SoundPool.js` - Buffer pooling, max 32 concurrent sounds with priority culling
- `config/SoundConfig.js` - Sound definitions with categories: `sfx`, `ambient`, `ui`

Audio assets in `/client/assets/audio/` organized by category (weapons, destruction, rewards, etc.).

### Shared Constants
`/shared/constants.js` is used by both client and server - contains world generation params, resource types/values, NPC factions, weapon definitions, upgrade costs, physics settings. Changes here affect both sides.

### Database Schema
SQLite tables in `/server/schema.sql`:
- `users` - credentials
- `ships` - player state (position, health, tiers, credits, color)
- `inventory` - cargo (user_id, resource_type, quantity)
- `marketplace` - active listings
- `world_changes` - depleted resources with respawn timers
- `chat_messages` - global chat history
- `components` - upgrade components for tier 6+ (future)
- `relics` - rare collectibles
- `active_buffs` - temporary power-ups with expiry

### Proximity System
Updates only broadcast to players within radar range (base 500 units, scales with tier). Broadcast range = 2x radar range. Positions persist to DB every 5 seconds.

### Data Storage

- Database: `/data/galaxy-miner.db` (SQLite, auto-created on first run)
- Schema: `/server/schema.sql` (auto-applied on startup)
- To reset: delete `data/*.db*` files and restart server

### Tools

- `/tools/audio-generator/` - ElevenLabs-based sound effect generation scripts

### Testing

Tests use Vitest with in-memory SQLite databases. Test utilities in `/tests/setup.js` provide:
- `createTestDatabase()` - In-memory SQLite with schema applied
- `createTestUser(db, { username, passwordHash })` - Create test user
- `createTestShip(db, userId, shipData)` - Create test ship with defaults
- `addInventory(db, userId, resourceType, quantity)` - Add resources to inventory
- `getInventory(db, userId)` - Get user's inventory array
- `createListing(db, { sellerId, resourceType, quantity, pricePerUnit })` - Create marketplace listing
- `closeTestDatabase(db)` - Clean up database connection
- `MOCK_CONSTANTS` - Test-safe constants for unit tests

Tests are organized under `/tests/unit/` by module (server, shared).

## Configuration

Environment variables can be set in `.env` (copy from `.env.example`). The server uses defaults if not specified.

Key environment variables:
- `PORT` - Server port (default: 3388)
- `SESSION_SECRET` - Required for production, token signing secret
- `DEBUG` - When `false` (production), silences logger.log/info/warn; logger.error() and logger.network() always log

## Game Systems Reference

**Resources**: 26 types across 4 rarities (common/uncommon/rare/ultrarare) and 4 categories (metal/gas/crystal/exotic)

**NPC Factions**: Pirates (flanking), Scavengers (retreat), Swarm (linked health), Void (formation), Rogue Miners (territorial)

**Ship Upgrades**: 8 components (engine, weapon, shield, mining, cargo, radar, energy_core, hull), max tier 5, costs $500→$15000

**Combat**: Weapon types (kinetic/energy/explosive), shield recharge with delay, 50% cargo drop on death

**Mining**: Range 50 units, base time 3000ms, resources respawn 30-60 min

**Loot System**: NPC deaths drop wreckage containing buffs (temporary power-ups), components (tier 6+ upgrades), and relics (permanent collectibles). See `/docs/systems/loot-pools.md`

**Relics**: Permanent collectibles with unique effects - Wormhole Gem (wormhole transit), Pirate Treasure (credit bonus), Scrap Siphon (faster wreckage collection), Mining Rites (5x mining yield), Skull and Bones (plunder faction bases)

**Teams**: Players can form teams with shared credits and friendly fire protection. See `/docs/systems/team-multiplayer.md`

**Wormholes**: 8% of star systems have wormholes enabling instant travel between linked systems. Requires Wormhole Gem relic. See `/docs/systems/wormhole-transit.md`

**Swarm Mechanics**: Unique faction with egg hatching, base assimilation (converting enemy bases), queen boss spawning (requires 3 assimilated bases in sector), and phase-based queen AI (Hunt → Siege → Swarm → Desperation)

## Node Version

Requires Node.js >=18.0.0 (18.11+ for `--watch` flag used by `npm run dev`)
