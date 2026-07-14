# Galaxy Miner repository guidance

## Project overview

Galaxy Miner is a multiplayer browser-based space mining game. Players navigate a procedurally generated galaxy, mine resources, fight NPCs, upgrade ships, and trade in real time.

The backend uses Node.js, Express, Socket.io, and SQLite through `better-sqlite3`. The frontend uses vanilla JavaScript and HTML5 Canvas.

## Commands

```bash
npm start              # Start the production server on port 3388
npm run dev            # Start development mode with auto-reload
npm test               # Run the Vitest suite once
npm run test:watch     # Run Vitest in watch mode
npm run test:coverage  # Generate a coverage report
npm run audit:network  # Audit socket event handler consistency
npm run audit:handlers # Check for duplicate socket handlers
```

Run one test file:

```bash
npx vitest run tests/unit/server/auth.test.js
```

Run tests matching a name:

```bash
npx vitest run -t "username validation"
```

The server listens at `http://0.0.0.0:3388`. There is no build step.

## Working conventions

- Follow the existing separation between rendering, game logic, UI, and network code on the client.
- Keep server systems separated by responsibility, such as combat, mining, and AI.
- Put code in `shared/` only when both the client and server use it.
- Treat the server as authoritative; preserve client prediction and server reconciliation behavior.
- Keep client and server procedural generation deterministic and synchronized.
- Update the relevant documentation when changing architecture, events, or game mechanics.
- Add or update tests for behavior changes. Run targeted tests while iterating and `npm test` before handing off a completed change.
- Never commit secrets. Production values belong in `.env.production`, which is ignored by Git.

## Architecture

### Game loop

- The authoritative server loop runs at 20 ticks per second in `server/game/engine.js`.
- The client runs at 60 FPS with `requestAnimationFrame`, local prediction, and server reconciliation.

### Client-server communication

Socket.io provides real-time bidirectional communication. Event namespaces include:

- `auth:*` - login, registration, and token authentication
- `player:*` - movement, death, and respawn
- `combat:*` - firing, hits, and damage
- `mining:*` - mining start, progress, and completion
- `npc:*` - NPC updates, deaths, and queen events
- `loot:*` - wreckage spawning and collection
- `market:*` - marketplace operations
- `ship:*` - upgrades and customization
- `fleet:*` - fleet management
- `chat:*` and `emote:*` - player communication
- `world:*` - asteroid depletion broadcasts

### Procedural generation

The client and server use identical seeded random generation with the seed `GALAXY_ALPHA_2025`. Sectors are 1000 by 1000 units and generated on demand. Preserve identical generation logic on both sides.

### Shared constants

`shared/constants.js` is loaded by both the client and server. It contains world-generation parameters, resources, NPC factions, weapons, upgrade costs, and physics settings. Test both sides when changing it.

### Proximity system

Updates broadcast only to players within radar range. Base radar range is 500 units and scales with tier; broadcast range is twice radar range. Player positions persist to the database every five seconds by default.

### NPC AI

NPC AI is modularized under `server/game/ai/` with faction-specific strategies. Each faction has spawn hubs that continuously create NPCs. The Swarm faction also supports queen spawning, base assimilation, and egg hatching.

## Key entry points

| Server | Client |
| --- | --- |
| `server/socket.js` - socket handler orchestrator | `client/js/network.js` - Socket.io client |
| `server/game/engine.js` - game tick loop | `client/js/game.js` - client loop |
| `server/game/combat.js` - combat system | `client/js/renderer.js` - Canvas renderer |
| `server/auth.js` - authentication | `client/js/player.js` - local player state |

## Documentation

Start with `docs/README.md` for the full documentation index. Client subsystem references include:

- `client/js/ui/README.md` - component-based UI system
- `client/js/audio/README.md` - spatial audio with the Web Audio API
- `client/js/mobile/README.md` - touch controls
- `client/js/network/README.md` - socket event handlers

## Database

- Database: `data/galaxy-miner.db`, created automatically
- Schema: `server/schema.sql`, applied automatically at startup
- Local reset: delete `data/*.db*` and restart the server

Primary tables include `users`, `ships`, `inventory`, `marketplace`, `world_changes`, `chat_messages`, `components`, `relics`, `active_buffs`, `fleets`, `fleet_members`, and `fleet_invites`.

## Testing

Tests use Vitest with in-memory SQLite. Shared helpers live in `tests/setup.js`:

```javascript
const {
  createTestDatabase,
  createTestUser,
  createTestShip,
  addInventory,
  getInventory,
  createListing,
  closeTestDatabase,
  MOCK_CONSTANTS,
} = require('../tests/setup');
```

Tests are organized by module under `tests/unit/`.

## Configuration

Copy `.env.example` to `.env` for local configuration.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3388` | Server port |
| `SESSION_SECRET` | none | Required in production for token signing |
| `DEBUG` | `true` | Set to `false` to silence log, info, and warning output |
| `TOKEN_EXPIRY_MS` | `86400000` | Token lifetime in milliseconds (24 hours) |
| `POSITION_SAVE_INTERVAL_MS` | `5000` | Database position-save interval in milliseconds |

## Runtime

Use Node.js 22 or newer, as declared in `package.json`. See `.nvmrc` for the repository's preferred version.
