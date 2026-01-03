# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Galaxy Miner is a multiplayer browser-based space mining game. Players navigate a procedurally generated galaxy, mine resources, fight NPCs, upgrade ships, and trade in real-time.

**Tech Stack**: Node.js + Express + Socket.io (backend), vanilla JavaScript + HTML5 Canvas (frontend), SQLite with better-sqlite3 (persistence)

## Commands

```bash
npm start              # Production server on port 3388
npm run dev            # Development with auto-reload (--watch)
npm test               # Run test suite (vitest)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run audit:network  # Audit socket event handler consistency
npm run audit:handlers # Check for duplicate socket handlers
```

Run a single test file:
```bash
npx vitest run tests/unit/server/auth.test.js
```

Run tests matching a pattern:
```bash
npx vitest run -t "username validation"
```

Server runs at `http://0.0.0.0:3388`. No build step required.

## Architecture

### Game Loop
- **Server**: 20 ticks/second (`/server/game/engine.js`) - authoritative game state
- **Client**: 60 FPS via requestAnimationFrame - local prediction with server reconciliation

### Client-Server Communication
Real-time bidirectional via Socket.io. Event namespaces:
- `auth:*` - Login, register, token auth
- `player:*` - Movement, death, respawn
- `combat:*` - Fire, hit, damage
- `mining:*` - Start, progress, complete
- `npc:*` - Updates, death, queen events
- `loot:*` - Wreckage spawn, collect
- `market:*` - Marketplace operations
- `ship:*` - Upgrades, customization
- `chat:*` / `emote:*` - Communication
- `world:*` - Asteroid depletion broadcasts

### Procedural Generation
Both client and server use identical seeded random generation (seed: `GALAXY_ALPHA_2025`). Sectors are 1000x1000 units, generated on-demand. This ensures world consistency without server-client sync.

### Shared Constants
`/shared/constants.js` is used by both client and server - contains world generation params, resource types, NPC factions, weapon definitions, upgrade costs, physics settings. Changes here affect both sides.

### Proximity System
Updates only broadcast to players within radar range (base 500 units, scales with tier). Broadcast range = 2x radar range. Positions persist to DB every 5 seconds.

### NPC AI System
Modular AI in `/server/game/ai/` with faction-specific strategies. Each faction has spawn hubs (bases) that continuously spawn NPCs. The Swarm faction has unique mechanics: queen spawning, base assimilation, egg hatching.

### Graveyard System
Player death creates derelict wreckage that persists and can be looted. Features atmosphere effects, respawn UI, and siphon collection mechanics. Server tracks derelicts in `/server/game/derelict.js`.

## Key Entry Points

| Server | Client |
|--------|--------|
| `/server/socket.js` - All event handlers | `/client/js/network.js` - Socket.io client |
| `/server/game/engine.js` - Game tick loop | `/client/js/game.js` - Client loop |
| `/server/game/combat.js` - Combat system | `/client/js/renderer.js` - Canvas rendering |
| `/server/auth.js` - Authentication | `/client/js/player.js` - Local player state |

## Subsystem Documentation

Each major subsystem has its own README:
- `/client/js/ui/README.md` - Component-based UI system
- `/client/js/audio/README.md` - Web Audio API spatial audio
- `/client/js/mobile/README.md` - Touch controls
- `/client/js/network/README.md` - Socket event handlers
- `/docs/README.md` - Full documentation index

## Database

- Location: `/data/galaxy-miner.db` (auto-created)
- Schema: `/server/schema.sql` (auto-applied on startup)
- Reset: Delete `data/*.db*` files and restart server

Tables: `users`, `ships`, `inventory`, `marketplace`, `world_changes`, `chat_messages`, `components`, `relics`, `active_buffs`

## Testing

Tests use Vitest with in-memory SQLite. Test utilities in `/tests/setup.js`:

```javascript
const { createTestDatabase, createTestUser, createTestShip,
        addInventory, getInventory, createListing,
        closeTestDatabase, MOCK_CONSTANTS } = require('../tests/setup');
```

Tests are organized under `/tests/unit/` by module (server, shared).

## Configuration

Environment variables in `.env` (copy from `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3388 | Server port |
| `SESSION_SECRET` | - | **Required for production** - token signing |
| `DEBUG` | true | When `false`, silences logger.log/info/warn |
| `TOKEN_EXPIRY_MS` | 86400000 | Token lifetime (24h) |
| `POSITION_SAVE_INTERVAL_MS` | 5000 | DB save frequency |

## Node Version

Requires Node.js >=18.0.0 (18.11+ for `--watch` flag)
