# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Galaxy Miner is a multiplayer browser-based space mining game. Players navigate a procedurally generated galaxy, mine resources, fight NPCs, upgrade ships, and trade with each other in real-time.

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
- `flanking.js` - Pirates: aggressive flanking maneuvers
- `swarm.js` - Swarm: coordinated group attacks, linked health pools
- `territorial.js` - Rogue Miners: defend claimed territory
- `retreat.js` - Scavengers: flee when damaged
- `formation.js` - Void Entities: maintain formation patterns

Each faction has a spawn hub type (bases) that continuously spawns NPCs. Hub destruction stops spawning until respawn timer.

### Key Client Modules

| Module | Purpose |
|--------|---------|
| `/client/js/network.js` | Socket.io client, event handlers |
| `/client/js/game.js` | Client game loop controller |
| `/client/js/renderer.js` | Canvas rendering, camera system |
| `/client/js/player.js` | Local player physics and state |
| `/client/js/world.js` | Client-side procedural generation |
| `/client/js/entities.js` | Entity management (players, NPCs, projectiles) |
| `/client/js/input.js` | Keyboard/mouse input handling |

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

## Game Systems Reference

**Resources**: 26 types across 4 rarities (common/uncommon/rare/ultrarare) and 4 categories (metal/gas/crystal/exotic)

**NPC Factions**: Pirates (flanking), Scavengers (retreat), Swarm (linked health), Void (formation), Rogue Miners (territorial)

**Ship Upgrades**: 6 components (engine, weapon, shield, mining, cargo, radar), max tier 5, costs $500→$15000

**Combat**: Weapon types (kinetic/energy/explosive), shield recharge with delay, 50% cargo drop on death

**Mining**: Range 50 units, base time 3000ms, resources respawn 30-60 min

## Node Version

Requires Node.js >=18.0.0
