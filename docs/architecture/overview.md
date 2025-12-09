# Galaxy Miner Architecture Overview

## High-Level System Architecture

Galaxy Miner is a real-time multiplayer space mining game built with a client-server architecture using vanilla JavaScript, Node.js, and Socket.io for bidirectional communication.

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Renderer    │  │  Game Loop   │  │  UI System   │     │
│  │  (Canvas)    │  │  (60 FPS)    │  │  (Reactive)  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│  ┌──────┴─────────────────┴─────────────────┴───────┐     │
│  │          Network Layer (Socket.io Client)        │     │
│  └───────────────────────┬──────────────────────────┘     │
└────────────────────────────┼────────────────────────────────┘
                             │ Real-time Events
┌────────────────────────────┼────────────────────────────────┐
│  ┌───────────────────────┴──────────────────────────┐     │
│  │          Network Layer (Socket.io Server)        │     │
│  └───────────────────────┬──────────────────────────┘     │
│         │                 │                 │              │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐     │
│  │  Game Engine │  │  Auth System │  │  Database    │     │
│  │  (20 tps)    │  │  (bcrypt)    │  │  (SQLite)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                       SERVER LAYER                          │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Server Framework**: Express.js
- **Real-time Communication**: Socket.io
- **Database**: SQLite with better-sqlite3
- **Authentication**: bcrypt password hashing
- **Session Management**: In-memory connected players map

### Frontend
- **Rendering**: HTML5 Canvas API (2D context)
- **Language**: Vanilla JavaScript (ES6+)
- **No Build Step**: Direct file serving
- **Real-time Updates**: Socket.io client

### Shared
- **Constants**: `/shared/constants.js` used by both client and server
- **Physics**: `/shared/physics.js` for orbital mechanics
- **Logging**: `/shared/logger.js` for consistent logging

## Directory Structure

```
galaxy-miner/
├── client/                    # Frontend code (served directly)
│   ├── js/
│   │   ├── game.js            # Client game loop (60 FPS)
│   │   ├── renderer.js        # Canvas rendering system
│   │   ├── player.js          # Local player state & prediction
│   │   ├── network.js         # Socket.io client event handlers
│   │   ├── input.js           # Keyboard/mouse input handling
│   │   ├── entities.js        # Entity management (players/NPCs)
│   │   ├── world.js           # Client-side world generation
│   │   ├── graphics/          # Visual effects modules
│   │   │   ├── ships.js       # Player ship rendering
│   │   │   ├── npc-ships.js   # NPC faction-specific ships
│   │   │   ├── weapons.js     # Weapon projectile effects
│   │   │   ├── particles.js   # Particle system
│   │   │   └── death-effects.js # Per-faction death animations
│   │   ├── ui/                # UI component system
│   │   │   ├── core/          # Component factory, Modal, UIState
│   │   │   ├── panels/        # CargoPanel, MarketPanel, etc.
│   │   │   └── icons/         # SVG icon generator
│   │   └── audio/             # Web Audio API system
│   │       ├── AudioManager.js
│   │       ├── SpatialAudio.js
│   │       └── config/SoundConfig.js
│   ├── assets/                # Static assets (audio, images)
│   └── index.html             # Entry point
│
├── server/                    # Backend code
│   ├── server.js              # Express server + Socket.io setup
│   ├── socket.js              # Socket event handlers (dispatch layer)
│   ├── auth.js                # Authentication logic
│   ├── database.js            # SQLite connection & queries
│   ├── config.js              # Server configuration
│   ├── world.js               # Server-side world generation
│   ├── schema.sql             # Database schema
│   └── game/                  # Game systems
│       ├── engine.js          # Main game loop (20 tps)
│       ├── combat.js          # Damage calculation & combat
│       ├── mining.js          # Mining mechanics
│       ├── npc.js             # NPC spawning & management
│       ├── loot.js            # Loot drops & wreckage
│       ├── marketplace.js     # Player trading
│       ├── star-damage.js     # Star heat zones
│       └── ai/                # AI strategy system
│           ├── index.js       # AI dispatcher
│           ├── flanking.js    # Pirate AI (flanking attacks)
│           ├── swarm.js       # Swarm AI (collective behavior)
│           ├── formation.js   # Void AI (formation flying)
│           ├── territorial.js # Rogue Miner AI (defend territory)
│           └── retreat.js     # Scavenger AI (flee when low HP)
│
├── shared/                    # Shared between client & server
│   ├── constants.js           # Game constants (world gen, combat, etc.)
│   ├── physics.js             # Orbital mechanics & gravity
│   └── logger.js              # Logging utility
│
├── data/                      # Runtime data
│   └── galaxy-miner.db        # SQLite database (auto-created)
│
└── tools/                     # Development tools
    └── audio-generator/       # ElevenLabs sound generation
```

## Key Modules and Responsibilities

### Server Modules

#### `/server/game/engine.js` - Game Loop Coordinator
**Responsibilities:**
- Executes at 20 ticks per second
- Coordinates all game subsystems in order:
  1. Player shield recharge & debuffs (DoTs)
  2. Base spawning & activation
  3. NPC AI updates & movement
  4. Mining progress tracking
  5. Wreckage cleanup
  6. Star heat damage application
  7. Comet hazard detection
- Broadcasts position updates within proximity range
- Handles orphaned NPC rage mode

**Key Functions:**
- `tick()`: Main game loop with fixed timestep
- `updatePlayers(deltaTime)`: Updates all player state
- `updateNPCs(deltaTime)`: Runs AI for all active NPCs
- `playerAttackNPC(attackerId, npcId, ...)`: Handles player weapon fire
- `broadcastNearNpc(npc, event, data)`: Proximity-based broadcasting

#### `/server/game/npc.js` - NPC Management
**Responsibilities:**
- NPC spawning from faction bases and sector spawn points
- Base activation/deactivation based on player proximity
- Health tracking and damage application
- Loot generation on NPC death
- Team credit calculations with multipliers
- Swarm assimilation system
- Queen spawning logic

**Key Data Structures:**
- `activeNPCs`: Map of all spawned NPCs
- `activeBases`: Map of active faction bases
- `assimilationProgress`: Tracks drone attachment to bases
- `formations`: Void faction formation tracking

#### `/server/game/ai/` - AI Strategy System
**Responsibilities:**
- Faction-specific AI behaviors
- Target selection and priority
- Movement and positioning
- Retreat mechanics
- Special abilities (web snare, acid burst, etc.)

**Strategy Pattern:**
- `index.js`: Dispatcher that routes NPCs to faction-specific strategies
- Each strategy implements: `update()`, `selectTarget()`, `patrol()`, `tryFire()`

#### `/server/socket.js` - Event Dispatcher
**Responsibilities:**
- Socket.io event handler registration
- Input validation and rate limiting
- Dispatches to appropriate game systems
- Broadcasts updates to nearby players

**Event Categories:**
- Auth: `auth:login`, `auth:register`, `auth:token`
- Movement: `player:input` (position/velocity sync)
- Combat: `combat:fire`, `combat:hit`
- Mining: `mining:start`, `mining:complete`
- Trading: `market:list`, `market:buy`
- Chat: `chat:send`, `emote:send`

### Client Modules

#### `/client/js/renderer.js` - Canvas Rendering
**Responsibilities:**
- 60 FPS rendering pipeline
- Camera system (follows player with shake effects)
- Layer-based rendering:
  1. Background (starfield parallax)
  2. World objects (stars, planets, asteroids, bases)
  3. Entities (players, NPCs, projectiles)
  4. Effects (particles, explosions)
  5. UI overlay (heat warnings, status icons)
- Screen shake for explosions/impacts
- Advanced graphics module integration

**Key Functions:**
- `clear()`: Clears canvas and draws starfield
- `drawWorld()`: Renders all celestial objects
- `drawEntities()`: Renders ships, NPCs, effects
- `drawPlayer()`: Renders local player with special effects

#### `/client/js/game.js` - Client Game Loop
**Responsibilities:**
- 60 FPS client-side update loop using `requestAnimationFrame`
- Local player prediction for smooth movement
- Entity interpolation for remote players
- World sector loading/unloading
- Graphics system updates (particles, projectiles)
- HUD updates

**Update Pipeline:**
```javascript
update(deltaTime) {
  Player.update(dt);        // Local prediction
  Entities.update(dt);      // Remote entity interpolation
  World.update(position);   // Sector loading
  Renderer.update(dt);      // Graphics systems
  HUD.update();             // UI refresh
}
```

#### `/client/js/network.js` - Socket.io Client
**Responsibilities:**
- Socket connection management
- Event listener registration
- Server reconciliation (corrects prediction errors)
- Broadcasts local player input
- Handles server-authoritative events

**Event Listeners:**
- `player:state`: Initial player data
- `world:update`: Asteroid depletion broadcasts
- `npc:update`, `npc:spawn`, `npc:destroyed`: NPC lifecycle
- `player:damaged`, `player:death`: Combat feedback

#### `/client/js/ui/` - Reactive UI System
**Responsibilities:**
- Component-based UI with factory pattern
- Modal management (ship customization, cargo, market)
- Reactive state management (UIState store)
- Toast notifications
- SVG icon generation (26 resource types)

**Architecture:**
- `core/Component.js`: Base component with lifecycle
- `core/Modal.js`: Modal controller (singleton)
- `core/UIState.js`: Reactive state store with subscribers
- `panels/`: Specialized UI panels (cargo, market, ship)

## Data Flow Diagrams

### Combat Flow
```
Player Input (Fire)
     │
     ├─ [Client] Input.js detects mouse click
     │
     ├─ [Client] WeaponRenderer.fire() creates visual effect
     │
     ├─ [Network] Socket emits 'combat:fire' with target
     │
     ├─ [Server] socket.js validates fire request
     │
     ├─ [Server] engine.playerAttackNPC() applies damage
     │      │
     │      ├─ combat.calculateDamage() (weapon type vs. shield type)
     │      ├─ npc.damageNPC() (hull/shield calculation)
     │      └─ If destroyed: loot.spawnWreckage()
     │
     ├─ [Server] Broadcast 'combat:npcHit' to nearby players
     │
     └─ [Client] Renderer shows hit effect & damage number
```

### Mining Flow
```
Player Input (Click asteroid)
     │
     ├─ [Client] Detects asteroid within mining range
     │
     ├─ [Network] Socket emits 'mining:start'
     │
     ├─ [Server] mining.js validates target & starts timer
     │
     ├─ [Client] Renders tractor beam & progress bar
     │
     ├─ [Server] After duration: mining.js rolls for resources
     │      │
     │      └─ database.js updates inventory
     │
     ├─ [Network] Socket emits 'mining:complete' with loot
     │
     └─ [Client] Shows reward animation & updates cargo UI
```

### NPC AI Flow
```
Game Tick (20 tps)
     │
     ├─ [Server] engine.updateNPCs() for each active NPC
     │      │
     │      ├─ ai/index.js routes to faction strategy
     │      │      │
     │      │      ├─ Strategy.update(npc, players, allies, deltaTime)
     │      │      │      │
     │      │      │      ├─ selectTarget() (choose player to attack)
     │      │      │      ├─ calculateMovement() (positioning logic)
     │      │      │      └─ tryFire() (weapon cooldown check)
     │      │      │
     │      │      └─ Returns action: { action: 'fire', target, ... }
     │      │
     │      ├─ npc.position updated based on movement
     │      └─ If action.fire: engine applies damage to player
     │
     ├─ [Server] Broadcast 'npc:update' positions to nearby players
     │
     └─ [Client] Entities.js interpolates NPC positions for smooth rendering
```

## Procedural World Generation

### Deterministic Generation
Both client and server use **identical seeded random generation** (seed: `GALAXY_ALPHA_2025`) to ensure world consistency without transmitting all world data.

**Key Parameters:**
- `SECTOR_SIZE`: 1000 × 1000 units
- Sectors generated on-demand when players enter
- Same seed → same star systems, asteroids, planets

**Generation Process:**
1. Hash sector coordinates with seed
2. Generate random values using seeded RNG
3. Spawn stars (0-2 per sector)
4. For each star: spawn planets (2-9) and asteroid belts
5. Spawn faction bases based on spawn chance
6. Client and server generate identical results

### Orbital Mechanics
- Planets orbit stars with realistic physics (`/shared/physics.js`)
- Orbital periods: 30-120 seconds
- Gravity wells affect player movement near stars
- Heat zones cause damage at different star radii

## Proximity-Based Updates

To optimize network traffic, updates are only sent to players within a certain range:

**Broadcast Ranges (by radar tier):**
- Tier 1: 1000 units (500 radar × 2)
- Tier 2: 1500 units
- Tier 3: 2250 units
- Tier 4: 3375 units
- Tier 5: 5062 units (max)

**What Gets Broadcast:**
- Player positions (within radar range)
- NPC updates (within broadcast range)
- Combat events (hits, deaths)
- Loot spawns (wreckage drops)

**Position Persistence:**
- Player positions saved to DB every 5 seconds
- On disconnect: position persisted for next login
- On death: respawn at safe coordinates

## State Synchronization

### Server-Authoritative Model
The server is the source of truth for all game state:
- Health/shield values
- Inventory contents
- Credits and upgrades
- NPC positions and AI state

### Client Prediction
For smooth gameplay, the client predicts local player movement:
1. Client sends input to server
2. Client immediately moves player (prediction)
3. Server validates and applies movement
4. Server sends correction if prediction was wrong
5. Client smoothly reconciles position

### Entity Interpolation
Remote players and NPCs are interpolated between server updates:
- Server sends position updates at 20 tps
- Client renders at 60 FPS
- Client interpolates positions between updates for smooth motion

## Upgrade System

**8 Ship Components:**
1. **Engine**: Speed & thrust (base 150 → 759 units/s at tier 5)
2. **Weapon**: Damage & range (5 → 50 damage at tier 5)
3. **Shield**: Capacity & recharge (50 → 800 HP at tier 5)
4. **Mining**: Mining speed (3s → 0.59s at tier 5)
5. **Cargo**: Inventory capacity (100 → 2000 units at tier 5)
6. **Radar**: Detection range (500 → 2531 units at tier 5)
7. **Energy Core**: Weapon cooldown, shield regen, boost ability
8. **Hull**: Armor, damage resistance (kinetic/energy/explosive)

**Tier Progression:**
- Max tier: 5
- Cost scaling: Tier 2: $300, Tier 3: $900, Tier 4: $3000, Tier 5: $9000
- Resource requirements: Common → ultrarare materials
- Multiplier: 1.5× per tier for most stats

## Combat System

### Weapon Types
- **Kinetic**: High hull damage, blocked by shields
- **Energy**: Balanced, extra damage to shields
- **Explosive**: Area effect (future: splash damage)

### Damage Calculation
```javascript
// Base damage = BASE_WEAPON_DAMAGE (10) × tierMultiplier^(tier-1)
// Tier 5 = 10 × 1.5^4 = 50 damage

// Shield absorbs percentage based on type effectiveness
shieldDamage = baseDamage × shieldAbsorption[weaponType]
hullDamage = baseDamage × (1 - shieldAbsorption) × (1 - hullResistance)

// Shield absorbs first, then hull
if (shield > 0) {
  shield -= shieldDamage;
  if (shield < 0) hull += shield; // Overflow to hull
} else {
  hull -= hullDamage;
}
```

### Death & Respawn
- On death: Drop 50% of cargo
- Respawn at safe coordinates (sector 0,0)
- Full health/shield restored
- Dropped cargo becomes wreckage (collectible for 2 minutes)

## Performance Considerations

### Server Optimizations
- **Fixed Tick Rate**: 20 tps ensures consistent game state
- **Proximity Updates**: Only send updates to nearby players
- **Sector-Based Activation**: NPCs/bases only active when players nearby
- **Efficient Collision**: Broad-phase with sector grid

### Client Optimizations
- **Canvas Layers**: Off-screen canvas for complex graphics
- **Particle Pooling**: Reuse particle objects
- **Entity Culling**: Don't render off-screen objects
- **Throttled Updates**: UI updates at lower frequency than game loop

### Database Optimizations
- **Prepared Statements**: All queries use prepared statements
- **Batch Writes**: Position updates every 5 seconds
- **Indexes**: Primary keys and foreign keys indexed
- **WAL Mode**: Better concurrency (Write-Ahead Logging)

## Security & Anti-Cheat

### Server-Side Validation
- All game state changes validated server-side
- Position updates checked for teleportation
- Fire requests checked for range and cooldown
- Mining validated against resource availability

### Authentication
- bcrypt password hashing (salt rounds: 10)
- JWT-like token system for session management
- Rate limiting on chat and actions
- SQL injection prevention via prepared statements

## Scalability Notes

Current architecture supports:
- **50 concurrent players** (configurable)
- **Unlimited sector generation** (deterministic, no storage)
- **Thousands of NPCs** (sector-based activation)

Future scaling considerations:
- Horizontal scaling: Shard by sector ranges
- Database: Migrate to PostgreSQL for multi-server
- Redis for shared state across servers
- Load balancer for Socket.io connections

---

**Next:** Read [game-loop.md](./game-loop.md) for detailed game loop architecture, or [ai-system.md](./ai-system.md) for AI behavior details.
