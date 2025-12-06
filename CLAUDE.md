# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Galaxy Miner is a multiplayer browser-based space mining game. Players navigate a procedurally generated galaxy, mine resources, upgrade ships, and trade with each other in real-time.

**Tech Stack**: Node.js + Express + Socket.io (backend), vanilla JavaScript + HTML5 Canvas (frontend), SQLite with better-sqlite3 (persistence)

## Commands

```bash
npm start          # Production server on port 3388
npm run dev        # Development with auto-reload (--watch)
```

Server runs at `http://0.0.0.0:3388`. No build step required - vanilla JS served directly.

## Architecture

### Client-Server Communication
Real-time bidirectional via Socket.io events:
- **Auth**: `auth:login`, `auth:register`, `auth:token`, `auth:logout`
- **Movement**: `player:input` (position/velocity sync)
- **Mining**: `mining:start`, `mining:cancel`, `mining:complete`
- **Marketplace**: `market:list`, `market:buy`, `market:cancel`, `market:getListings`
- **Chat**: `chat:send`, `chat:message`
- **Upgrades**: `ship:upgrade`, `ship:getData`
- **World**: `world:update` (asteroid depletion broadcasts)

### Procedural Generation
Both client and server use identical seeded random generation (seed: `GALAXY_ALPHA_2025`) for world consistency. Sectors are 1000x1000 units, generated on-demand.

### Game Loop Architecture
- **Server**: 20 ticks/second (`/server/game/engine.js`) - updates players, NPCs, mining progress
- **Client**: 60 FPS via requestAnimationFrame - local prediction with server validation

### Key Modules

| Server | Purpose |
|--------|---------|
| `/server/socket.js` | All Socket.io event handlers, dispatches to game systems |
| `/server/game/engine.js` | Game tick loop, coordinates all subsystems |
| `/server/game/mining.js` | Mining mechanics and resource drops |
| `/server/game/combat.js` | Damage calculation, weapons, health (TODO Phase 9) |
| `/server/game/marketplace.js` | Player-to-player trading |
| `/server/game/npc.js` | NPC spawning and AI behavior |
| `/server/auth.js` | Authentication, bcrypt hashing, session management |
| `/server/database.js` | SQLite setup and prepared statements |
| `/server/world.js` | Server-side world generation |

| Client | Purpose |
|--------|---------|
| `/client/js/network.js` | Socket.io client, event handlers |
| `/client/js/game.js` | Client game loop controller |
| `/client/js/renderer.js` | Canvas rendering, camera system |
| `/client/js/player.js` | Local player physics and state |
| `/client/js/world.js` | Client-side procedural generation |
| `/client/js/input.js` | Keyboard/mouse input handling |
| `/client/js/ui/*.js` | UI modules (auth, hud, chat, terminal, upgrades) |
| `/client/js/ui/core/*.js` | Core UI infrastructure (Component, Modal, State) |
| `/client/js/ui/icons/*.js` | Parameterized SVG icon system |
| `/client/js/ui/panels/*.js` | Panel components (CargoPanel, MarketPanel) |

### UI System

See `/client/js/ui/README.md` for detailed documentation.

**Core modules** (`/client/js/ui/core/`):
- `Component.js` - Lightweight component factory with lifecycle hooks
- `Modal.js` - Centralized modal controller with stacking, confirm/prompt dialogs
- `State.js` - Reactive pub/sub state store (UIState)

**Icon system** (`/client/js/ui/icons/`):
- `IconFactory.js` - Generates parameterized SVG icons for all 13 resource types
- Three shape generators: Crystal (minerals), Orbital (gases), Material (metals)
- CSS animations for shimmer, spin, and pulse effects

**Panels** (`/client/js/ui/panels/`):
- `CargoPanel.js` - Two-column cargo with slide-out detail panel, integrated selling
- `MarketPanel.js` - Browse/My Listings tabs with filter, sort, quick-buy

**CSS architecture** (`/client/css/`):
- Modular CSS with `index.css` as entry point
- CSS custom properties for theming in `base.css`
- Component styles in `components.css`, `panels.css`, `icons.css`

### Shared Constants
`/shared/constants.js` is used by both client and server - contains world generation params, resource types/values, upgrade costs, physics settings, object sizes. Changes here affect both sides.

### Database Schema
SQLite tables in `/server/schema.sql`:
- `users` - credentials
- `ships` - player state (position, health, tiers, credits)
- `inventory` - cargo (user_id, resource_type, quantity)
- `marketplace` - active listings
- `world_changes` - depleted resources with respawn timers
- `chat_messages` - global chat history

### Proximity System
Updates only broadcast to players within radar range (base 500 units, scales with tier). Broadcast range = 2x radar range. Positions persist to DB every 5 seconds.

## Game Systems Reference

**Mining**: Range 50 units, base time 3000ms, cargo capacity 50 base + tier upgrades, resources respawn 30-60 min

**Ship Upgrades**: 6 components (engine, weapon, shield, mining, cargo, radar), max tier 5, costs escalate ($500 → $15000)

**Physics**: Base speed 150 units/sec (scales with engine tier), rotation 3 rad/sec, drag 0.98/frame

**Auth**: bcrypt (10 rounds), UUID session tokens (24h expiry, in-memory), rate limits on login/registration

## Node Version

Requires Node.js >=18.0.0
