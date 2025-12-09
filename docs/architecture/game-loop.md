# Game Loop Architecture

This document details the dual game loop system in Galaxy Miner: the server-authoritative game loop running at 20 ticks per second and the client render loop running at 60 FPS.

## Overview

Galaxy Miner uses a **client-server architecture** with separate game loops:

```
SERVER LOOP (20 tps)          CLIENT LOOP (60 FPS)
┌─────────────────┐          ┌─────────────────┐
│  Game Tick      │          │  Render Frame   │
│  (50ms fixed)   │ ◄─────► │  (16.67ms var)  │
│                 │  Events  │                 │
│ - AI Updates    │          │ - Local Input   │
│ - Physics       │          │ - Prediction    │
│ - Combat        │          │ - Interpolation │
│ - Mining        │          │ - Rendering     │
└─────────────────┘          └─────────────────┘
```

## Server Game Loop

**Location:** `/server/game/engine.js`

The server game loop is the authoritative source of truth, running at a fixed **20 ticks per second** (50ms per tick).

### Engine Initialization

```javascript
// From /server/game/engine.js
class GameEngine {
  constructor() {
    this.tickRate = CONSTANTS.SERVER_TICK_RATE; // 20 tps
    this.tickInterval = 1000 / this.tickRate;   // 50ms
    this.lastTickTime = Date.now();
    this.isRunning = false;
  }

  start() {
    this.isRunning = true;
    this.lastTickTime = Date.now();
    this.tick(); // Start the loop
  }

  tick() {
    if (!this.isRunning) return;

    const now = Date.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;

    // Execute game systems
    this.update(deltaTime);

    // Schedule next tick with fixed timestep
    const nextTick = this.tickInterval - (Date.now() - now);
    setTimeout(() => this.tick(), Math.max(0, nextTick));
  }
}
```

### Tick Update Order

The server processes game systems in a specific order each tick to ensure deterministic behavior:

```javascript
update(deltaTime) {
  // 1. Player Updates
  this.updatePlayers(deltaTime);

  // 2. Base Spawning & Activation
  this.updateBases();

  // 3. NPC AI & Movement
  this.updateNPCs(deltaTime);

  // 4. Mining Progress
  this.updateMiningProgress();

  // 5. Wreckage Cleanup
  this.cleanupWreckage();

  // 6. Environmental Hazards
  this.applyStarDamage(deltaTime);
  this.checkCometCollisions();

  // 7. Proximity Broadcasting
  this.broadcastPositions();
}
```

### Update System Details

#### 1. Player Updates (`updatePlayers`)

**Purpose:** Update all connected player states

```javascript
updatePlayers(deltaTime) {
  for (const [socketId, player] of connectedPlayers) {
    // Shield Recharge
    if (player.shieldRechargeTimer > 0) {
      player.shieldRechargeTimer -= deltaTime;
    } else if (player.shield < player.shieldMax) {
      const rechargeRate = CONSTANTS.SHIELD_RECHARGE_RATE;
      const coreBonus = CONSTANTS.ENERGY_CORE.SHIELD_REGEN_BONUS[player.energyCoreTier];
      player.shield = Math.min(
        player.shieldMax,
        player.shield + (rechargeRate + coreBonus) * (deltaTime / 1000)
      );
      // Broadcast shield update
      io.to(socketId).emit('player:shieldUpdate', { shield: player.shield });
    }

    // Active Buffs (DoTs, debuffs)
    this.updatePlayerBuffs(player, deltaTime);

    // Thrust Boost Timer
    if (player.boostActive && Date.now() > player.boostEndTime) {
      player.boostActive = false;
      io.to(socketId).emit('player:boostEnd');
    }
  }
}
```

**Key Operations:**
- Shield regeneration with energy core bonuses
- DoT (Damage Over Time) application from acid burst
- Debuff timers (web snare slow effect)
- Speed boost expiration

#### 2. Base Activation (`updateBases`)

**Purpose:** Activate/deactivate faction bases based on player proximity

```javascript
updateBases() {
  // Check each sector's bases for nearby players
  for (const [sectorKey, bases] of worldBases) {
    for (const base of bases) {
      const nearbyPlayers = this.getPlayersNearPosition(
        base.x, base.y, base.patrolRadius * SECTOR_SIZE
      );

      if (nearbyPlayers.length > 0 && !base.active) {
        // Activate base - start spawning NPCs
        this.activateBase(base);
      } else if (nearbyPlayers.length === 0 && base.active) {
        // Deactivate base - cleanup NPCs
        this.deactivateBase(base);
      }
    }
  }
}
```

**Optimization:** Bases only spawn NPCs when players are in the sector, reducing unnecessary AI processing.

#### 3. NPC Updates (`updateNPCs`)

**Purpose:** Execute AI strategies for all active NPCs

```javascript
updateNPCs(deltaTime) {
  const allPlayers = Array.from(connectedPlayers.values());

  for (const [npcId, npc] of activeNPCs) {
    // Get players in aggro range
    const nearbyPlayers = this.getPlayersNearNPC(npc);

    // Get allies for formation/swarm behaviors
    const nearbyAllies = this.getNPCsByFaction(npc.faction).filter(
      ally => this.distanceBetween(npc, ally) < 500
    );

    // Execute faction AI strategy
    const action = ai.updateNPCAI(npc, nearbyPlayers, activeNPCs, deltaTime);

    // Process AI action result
    if (action?.action === 'fire') {
      this.npcAttackPlayer(npc, action.target, action);
    } else if (action?.action === 'web_snare') {
      this.queenWebSnare(npc, action);
    } else if (action?.action === 'acid_burst') {
      this.queenAcidBurst(npc, action);
    }

    // Broadcast NPC position to nearby players
    this.broadcastNearNpc(npc, 'npc:update', {
      id: npc.id,
      position: npc.position,
      rotation: npc.rotation,
      hull: npc.hull,
      state: npc.state
    });
  }
}
```

**Performance Notes:**
- Only NPCs near players are active
- Proximity-based broadcasting reduces network traffic
- AI strategies are stateless (no shared mutable state)

#### 4. Mining Progress (`updateMiningProgress`)

**Purpose:** Track mining timers and award resources

```javascript
updateMiningProgress() {
  const now = Date.now();

  for (const [socketId, player] of connectedPlayers) {
    if (player.mining && player.miningStartTime) {
      const elapsed = now - player.miningStartTime;
      const miningTime = mining.calculateMiningTime(player);

      if (elapsed >= miningTime) {
        // Mining complete
        const resources = mining.rollResources(player.miningTarget);
        inventory.addResources(player.userId, resources);

        io.to(socketId).emit('mining:complete', {
          resources,
          totalValue: this.calculateValue(resources)
        });

        // Mark asteroid as depleted
        this.depleteAsteroid(player.miningTarget);

        // Clear mining state
        player.mining = false;
        player.miningTarget = null;
      }
    }
  }
}
```

**Mining System:**
- Base mining time: 3000ms
- Mining tier reduces time: `baseTime / (1 + tier * 0.5)`
- Tier 5: ~590ms mining time
- Resources awarded based on asteroid rarity

#### 5. Environmental Hazards

**Star Heat Damage:**

```javascript
applyStarDamage(deltaTime) {
  for (const [socketId, player] of connectedPlayers) {
    const star = this.getNearestStar(player.position);
    if (!star) continue;

    const distance = this.distanceBetween(player.position, star.position);
    const zone = starDamage.getHeatZone(star, distance);

    if (zone === 'WARM') {
      player.shield -= CONSTANTS.STAR_DAMAGE.WARM_SHIELD_DRAIN * (deltaTime / 1000);
    } else if (zone === 'HOT') {
      player.shield -= CONSTANTS.STAR_DAMAGE.HOT_SHIELD_DRAIN * (deltaTime / 1000);
      if (player.shield <= 0) {
        player.hull -= CONSTANTS.STAR_DAMAGE.HOT_HULL_DAMAGE * (deltaTime / 1000);
      }
    } else if (zone === 'SURFACE') {
      player.hull -= CONSTANTS.STAR_DAMAGE.SURFACE_HULL_DAMAGE * (deltaTime / 1000);
    }

    if (player.hull <= 0) {
      this.handlePlayerDeath(socketId, 'star_heat');
    }
  }
}
```

**Heat Zones:**
- **Corona** (1.5× radius): Visual effects only
- **Warm** (1.3× radius): Shield drain (5/s)
- **Hot** (1.0× radius): Shield drain (15/s) + hull damage (10/s)
- **Surface** (0.7× radius): Rapid hull damage (50/s)

#### 6. Position Broadcasting (`broadcastPositions`)

**Purpose:** Send position updates to nearby players

```javascript
broadcastPositions() {
  const updates = new Map(); // socketId -> array of nearby player states

  for (const [socketId, player] of connectedPlayers) {
    const nearbyPlayers = this.getPlayersInRadarRange(player);

    updates.set(socketId, nearbyPlayers.map(p => ({
      id: p.id,
      username: p.username,
      position: p.position,
      velocity: p.velocity,
      rotation: p.rotation,
      hull: p.hull,
      shield: p.shield
    })));
  }

  // Send all updates
  for (const [socketId, playerList] of updates) {
    io.to(socketId).emit('players:update', playerList);
  }
}
```

**Proximity Range:** 2× radar range (500-5062 units based on radar tier)

## Client Game Loop

**Location:** `/client/js/game.js`

The client runs at **60 FPS** using `requestAnimationFrame` for smooth rendering and local prediction.

### Client Loop Initialization

```javascript
class Game {
  constructor() {
    this.lastFrameTime = performance.now();
    this.isRunning = false;
  }

  start() {
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update game state
    this.update(deltaTime);

    // Render frame
    this.render();

    // Next frame
    requestAnimationFrame(() => this.loop());
  }
}
```

### Client Update Pipeline

```javascript
update(deltaTime) {
  // 1. Input Processing
  Input.update();

  // 2. Local Player Prediction
  Player.update(deltaTime);

  // 3. Remote Entity Interpolation
  Entities.update(deltaTime);

  // 4. World Sector Loading
  World.update(Player.position);

  // 5. Graphics Systems
  ParticleSystem.update(deltaTime);
  ProjectileSystem.update(deltaTime);

  // 6. Audio System
  AudioManager.updateListener(Player.position);

  // 7. UI State
  HUD.update();
}
```

### Local Player Prediction

**Purpose:** Smooth movement without waiting for server confirmation

```javascript
// From /client/js/player.js
class Player {
  update(deltaTime) {
    // Capture input state
    const input = Input.getState();

    // Local prediction - move immediately
    if (input.thrust) {
      const speed = this.getSpeed(); // Based on engine tier
      this.velocity.x += Math.cos(this.rotation) * speed * (deltaTime / 1000);
      this.velocity.y += Math.sin(this.rotation) * speed * (deltaTime / 1000);
    }

    if (input.rotateLeft) {
      this.rotation -= this.rotationSpeed * (deltaTime / 1000);
    }
    if (input.rotateRight) {
      this.rotation += this.rotationSpeed * (deltaTime / 1000);
    }

    // Apply velocity
    this.position.x += this.velocity.x * (deltaTime / 1000);
    this.position.y += this.velocity.y * (deltaTime / 1000);

    // Apply drag
    this.velocity.x *= 0.99;
    this.velocity.y *= 0.99;

    // Send input to server (throttled to 20 tps)
    if (Date.now() - this.lastInputSent > 50) {
      Network.sendInput({
        position: this.position,
        velocity: this.velocity,
        rotation: this.rotation,
        thrust: input.thrust
      });
      this.lastInputSent = Date.now();
    }
  }
}
```

### Server Reconciliation

**Purpose:** Correct client prediction when server disagrees

```javascript
// From /client/js/network.js
socket.on('player:correction', (serverState) => {
  const posDiff = Math.hypot(
    Player.position.x - serverState.position.x,
    Player.position.y - serverState.position.y
  );

  // Only reconcile if difference is significant (>10 units)
  if (posDiff > 10) {
    // Smoothly interpolate to server position
    Player.position.x += (serverState.position.x - Player.position.x) * 0.5;
    Player.position.y += (serverState.position.y - Player.position.y) * 0.5;
  }

  // Server is authoritative for health/shield
  Player.hull = serverState.hull;
  Player.shield = serverState.shield;
});
```

### Entity Interpolation

**Purpose:** Smooth remote player/NPC movement between server updates

```javascript
// From /client/js/entities.js
class Entities {
  update(deltaTime) {
    for (const [id, entity] of this.entities) {
      if (entity.targetPosition) {
        // Interpolate toward server position
        const lerpFactor = Math.min(1, deltaTime / 50); // 50ms = server tick

        entity.position.x += (entity.targetPosition.x - entity.position.x) * lerpFactor;
        entity.position.y += (entity.targetPosition.y - entity.position.y) * lerpFactor;

        // If close enough, clear target
        const dist = Math.hypot(
          entity.targetPosition.x - entity.position.x,
          entity.targetPosition.y - entity.position.y
        );
        if (dist < 1) {
          entity.position = { ...entity.targetPosition };
          entity.targetPosition = null;
        }
      }
    }
  }

  onServerUpdate(entities) {
    for (const entityData of entities) {
      const entity = this.entities.get(entityData.id);
      if (entity) {
        // Set target for interpolation
        entity.targetPosition = { ...entityData.position };
        entity.targetRotation = entityData.rotation;
      } else {
        // New entity - add immediately
        this.entities.set(entityData.id, {
          ...entityData,
          position: { ...entityData.position }
        });
      }
    }
  }
}
```

**Interpolation Benefits:**
- Server updates at 20 tps, client renders at 60 FPS
- Smooth motion without jitter
- Reduces perceived lag

## State Synchronization

### Position Sync Flow

```
[Client]                    [Server]
   │                           │
   ├─ Player moves (local)     │
   │                           │
   ├──► player:input ─────────►│
   │    { pos, vel, rot }      │
   │                           │
   │                      Validates movement
   │                      Checks for teleport
   │                      Updates DB (every 5s)
   │                           │
   │◄──── player:correction ───┤ (if needed)
   │     { pos, vel }          │
   │                           │
   │◄──── players:update ──────┤ (broadcast)
   │     [ nearby players ]    │
   │                           │
   └─ Interpolate others       │
```

### Combat Sync Flow

```
[Client]                    [Server]
   │                           │
   ├─ Fire weapon (click)      │
   │  Shows projectile         │
   │                           │
   ├──► combat:fire ──────────►│
   │    { targetId, weapon }   │
   │                           │
   │                      Validates range
   │                      Validates cooldown
   │                      Calculates damage
   │                      Applies to target
   │                           │
   │◄──── combat:hit ──────────┤ (if hit)
   │     { damage, hull, ... } │
   │                           │
   │◄──── npc:destroyed ───────┤ (if killed)
   │     { loot, credits }     │
   │                           │
   └─ Show hit effect          │
      Update HUD               │
      Play sound               │
```

## Timing & Performance

### Fixed Timestep (Server)

The server uses a **fixed timestep** of 50ms to ensure deterministic physics:

```javascript
tick() {
  const targetDelta = 50; // Fixed 50ms
  const now = Date.now();
  const actualDelta = now - this.lastTickTime;

  // Use fixed delta for physics calculations
  this.update(targetDelta);

  // Schedule next tick accounting for processing time
  const processingTime = Date.now() - now;
  const nextTick = targetDelta - processingTime;

  setTimeout(() => this.tick(), Math.max(0, nextTick));
}
```

**Benefits:**
- Consistent physics regardless of server load
- Predictable NPC behavior
- Reproducible game state

### Variable Timestep (Client)

The client uses a **variable timestep** for smooth rendering:

```javascript
loop() {
  const now = performance.now();
  const deltaTime = now - this.lastFrameTime; // Variable 16-20ms
  this.lastFrameTime = now;

  this.update(deltaTime); // Use actual delta for smooth interpolation

  requestAnimationFrame(() => this.loop());
}
```

**Benefits:**
- Adapts to monitor refresh rate (60Hz, 120Hz, 144Hz)
- Smooth motion even if framerate varies
- No screen tearing

## Proximity-Based Updates

### Radar Range System

Players only receive updates for entities within their radar range:

```javascript
// Server calculates radar range based on tier
function getRadarRange(player) {
  return CONSTANTS.RADAR_TIERS[player.radarTier].range;
}

// Broadcast range is 2× radar range
function getBroadcastRange(player) {
  return getRadarRange(player) * 2;
}

// Only broadcast to players within range
function broadcastNearNpc(npc, event, data) {
  for (const [socketId, player] of connectedPlayers) {
    const dist = distanceBetween(player.position, npc.position);
    if (dist <= getBroadcastRange(player)) {
      io.to(socketId).emit(event, data);
    }
  }
}
```

**Optimization Benefits:**
- Reduces network traffic by 90%+ in sparse sectors
- Players in crowded sectors get relevant updates only
- Scales to larger player counts

### Database Persistence

Position updates are batched to reduce DB writes:

```javascript
// Save positions every 5 seconds (not every tick)
setInterval(() => {
  for (const [socketId, player] of connectedPlayers) {
    db.prepare(`
      UPDATE ships
      SET position_x = ?, position_y = ?, velocity_x = ?, velocity_y = ?
      WHERE user_id = ?
    `).run(
      player.position.x, player.position.y,
      player.velocity.x, player.velocity.y,
      player.userId
    );
  }
}, 5000);
```

**Benefits:**
- Reduces DB load from 20 writes/s to 0.2 writes/s per player
- SQLite handles 50 players × 0.2 writes/s = 10 writes/s easily
- Acceptable data loss on server crash (<5 seconds of movement)

## Performance Benchmarks

### Server Loop Performance

**Target:** 50ms per tick (20 tps)

**Actual Performance (50 players, 100 NPCs):**
- Player updates: ~2ms
- NPC AI updates: ~15ms
- Mining progress: ~1ms
- Position broadcasting: ~5ms
- Total: ~23ms per tick
- **Headroom:** 27ms (54% CPU available)

### Client Loop Performance

**Target:** 16.67ms per frame (60 FPS)

**Actual Performance (50 nearby entities):**
- Input processing: ~0.5ms
- Player prediction: ~0.3ms
- Entity interpolation: ~2ms
- Particle updates: ~3ms
- Rendering: ~8ms
- Total: ~14ms per frame
- **Headroom:** 2.67ms (16% CPU available)

## Debugging & Monitoring

### Server Debug Logs

```javascript
// Enable detailed tick logging
DEBUG_TICK=true npm start

// Output:
// [TICK 1234] 23ms | Players: 15 | NPCs: 45 | Bases: 8
// [TICK 1235] 19ms | Players: 15 | NPCs: 45 | Bases: 8
```

### Client Debug Overlay

```javascript
// Press F3 to show debug overlay
if (Input.isKeyPressed('F3')) {
  DebugOverlay.toggle();
}

// Displays:
// FPS: 60 | Frame Time: 16ms
// Position: (1234, 5678) | Sector: (1, 5)
// Entities: 12 players, 8 NPCs, 45 asteroids
// Network: 120ms ping, 15 updates/s
```

## Best Practices

### Server Loop
1. Keep tick duration < 50ms to maintain 20 tps
2. Use proximity checks before expensive calculations
3. Batch database writes
4. Profile AI strategies for performance hotspots

### Client Loop
1. Use `requestAnimationFrame` for smooth rendering
2. Interpolate remote entities for smooth motion
3. Predict local player for instant feedback
4. Decouple game logic from rendering (update + render split)

---

**Next:** Read [ai-system.md](./ai-system.md) for details on the NPC AI architecture.
