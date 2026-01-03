# Deferred Network Optimizations Roadmap

## Overview

These optimizations were identified during the Network Performance & Sync Improvements implementation but deferred due to complexity. They are lower priority since the core issues have been resolved.

**Related Plan:** `/home/eric/.claude/plans/snuggly-sleeping-whistle.md`

---

## Phase 1.3: Deferred Hit Detection

### Goal
Split fire handling into immediate visual feedback + deferred hit processing to reduce blocking time in the combat:fire handler.

### Current State
The `combat:fire` handler in `/server/socket.js` (lines 251-504) performs all operations synchronously:
1. Validates player state and weapon
2. Broadcasts visual effects to nearby players
3. Performs hit detection against NPCs
4. Calculates damage and applies effects
5. Updates NPC state and broadcasts results

This blocks for 8-15ms during heavy combat, causing perceived lag.

### Target State
- Fire handler returns in <1ms (visual broadcast only)
- Hit detection queued for game loop processing
- Combat events processed in batches with time budgets

### Implementation Details

#### 1. Add Combat Queue to Engine (`/server/game/engine.js`)

```javascript
// Add after line 35 (activeDebuffs)
const combatQueue = [];
const MAX_COMBAT_PROCESS_TIME = 5; // ms per tick

function queueCombatEvent(event) {
  combatQueue.push({
    ...event,
    timestamp: Date.now()
  });
}

function processCombatQueue(maxTime = MAX_COMBAT_PROCESS_TIME) {
  const startTime = Date.now();
  let processed = 0;

  while (combatQueue.length > 0 && (Date.now() - startTime) < maxTime) {
    const event = combatQueue.shift();
    processCombatHit(event);
    processed++;
  }

  return processed;
}

function processCombatHit(event) {
  const { playerId, socketId, weaponData, position, direction } = event;

  // Get NPCs in range using spatial hash
  const npcsInRange = npc.getNPCsInRange(position, weaponData.range);

  // Perform hit detection
  for (const target of npcsInRange) {
    // Ray-circle intersection or cone check
    if (isInFireCone(position, direction, target, weaponData)) {
      const damage = combat.calculateDamage(weaponData, target);
      const result = npc.damageNPC(target.id, damage, playerId);

      // Broadcast hit result
      if (io && socketId) {
        io.to(socketId).emit('combat:hit', {
          targetId: target.id,
          damage: result.damage,
          destroyed: result.destroyed
        });
      }
    }
  }
}
```

#### 2. Add to Game Tick (`/server/game/engine.js`)

```javascript
// In tick() function, after updateNPCs(deltaTime):
processCombatQueue();
```

#### 3. Refactor combat:fire Handler (`/server/socket.js`)

```javascript
// IMMEDIATE: Broadcast visual (non-blocking)
socket.on('combat:fire', (data) => {
  if (!authenticatedUserId) return;

  const player = connectedPlayers.get(socket.id);
  if (!player) return;

  // Validate weapon (fast check)
  const weapon = getPlayerWeapon(player);
  if (!weapon || !canFire(player, weapon)) return;

  // Update cooldown
  updateWeaponCooldown(player, weapon);

  // IMMEDIATE: Broadcast visual to nearby players
  broadcastToNearby(socket, player, 'combat:fire', {
    playerId: authenticatedUserId,
    position: player.position,
    angle: data.angle,
    weaponType: weapon.type
  });

  // DEFERRED: Queue hit detection for game loop
  engine.queueCombatEvent({
    playerId: authenticatedUserId,
    socketId: socket.id,
    weaponData: weapon,
    position: { ...player.position },
    direction: data.angle
  });
});
```

### Complexity Assessment
- **Lines of code:** ~250 new/modified
- **Risk:** Medium - changes core combat flow
- **Testing:** Requires combat timing tests, multiplayer stress tests
- **Dependencies:** Spatial hash (completed in Phase 1.2)

### Files Affected
| File | Changes |
|------|---------|
| `/server/socket.js` | Refactor combat:fire handler (~100 lines) |
| `/server/game/engine.js` | Add combat queue system (~80 lines) |
| `/server/game/combat.js` | Extract hit detection logic (~50 lines) |
| `/tests/unit/server/combat-queue.test.js` | New test file |

---

## Phase 1.5: Mining Interval Consolidation

### Goal
Move mining progress checks from per-player `setInterval` to the game tick loop to reduce interval competition with combat events.

### Current State
Each active miner spawns a 100ms `setInterval` in `/server/socket.js` (lines 550-600):
```javascript
const checkMining = setInterval(() => {
  const progress = mining.updateMining(authenticatedUserId, player.position);
  // ... handle progress, emit events
}, 100);
```

With 10 miners, this creates 10 competing intervals plus the game tick, causing timing jitter.

### Target State
- Single `updateMining()` call per game tick
- Mining state tracked in player/mining module
- Socket references stored for event emission

### Implementation Details

#### 1. Add Mining Session Registry (`/server/game/mining.js`)

```javascript
// Add mining session tracking
const activeSessions = new Map(); // playerId -> { socketId, startTime, ... }

function registerMiningSession(playerId, socketId, targetData) {
  activeSessions.set(playerId, {
    socketId,
    startTime: Date.now(),
    targetId: targetData.objectId,
    targetPosition: { x: targetData.x, y: targetData.y },
    resourceType: targetData.resourceType
  });
}

function unregisterMiningSession(playerId) {
  activeSessions.delete(playerId);
}

function getActiveSessions() {
  return activeSessions;
}
```

#### 2. Add Tick-Based Mining Update (`/server/game/engine.js`)

```javascript
// Replace empty updateMining() with:
function updateMining(deltaTime) {
  if (!io) return;

  const sessions = mining.getActiveSessions();

  for (const [playerId, session] of sessions) {
    const player = getPlayerById(playerId);
    if (!player) {
      mining.unregisterMiningSession(playerId);
      continue;
    }

    const progress = mining.updateMining(playerId, player.position);

    if (!progress) {
      mining.unregisterMiningSession(playerId);
      continue;
    }

    if (progress.cancelled) {
      mining.unregisterMiningSession(playerId);
      io.to(session.socketId).emit('mining:cancelled', { reason: progress.reason });
      setPlayerStatus(playerId, 'idle');
      // Broadcast to nearby...
      continue;
    }

    if (progress.success) {
      mining.unregisterMiningSession(playerId);
      io.to(session.socketId).emit('mining:complete', {
        resourceType: progress.resourceType,
        resourceName: progress.resourceName,
        quantity: progress.quantity
      });
      // ... inventory update, world update, status change
    }
  }
}
```

#### 3. Refactor mining:start Handler (`/server/socket.js`)

```javascript
socket.on('mining:start', (data) => {
  // ... existing validation ...

  if (result.success) {
    socket.emit('mining:started', { ... });
    setPlayerStatus(authenticatedUserId, 'mining');
    broadcastToNearby(socket, player, 'mining:playerStarted', { ... });

    // Register session instead of creating interval
    mining.registerMiningSession(authenticatedUserId, socket.id, {
      objectId: data.objectId,
      x: result.target.x,
      y: result.target.y,
      resourceType: result.target.resourceType
    });

    // NO setInterval - handled in game tick
  }
});
```

#### 4. Handle Disconnect Cleanup

```javascript
// In disconnect handler, add:
mining.unregisterMiningSession(authenticatedUserId);
```

### Architecture Considerations

**Challenge:** Engine needs socket references to emit events, but currently only has `io` (global) and `connectedPlayers` (Map by socketId).

**Solutions:**
1. Pass socket module to engine (partially done via `socketModule`)
2. Store socketId in mining session and use `io.to(socketId).emit()`
3. Return events from `updateMining()` and have socket module process them

**Recommended:** Option 2 - Store socketId in session, use `io.to()` for targeted emission.

### Complexity Assessment
- **Lines of code:** ~150 new/modified
- **Risk:** Low - mining is isolated system
- **Testing:** Mining timing tests, disconnect handling
- **Dependencies:** None (self-contained refactor)

### Files Affected
| File | Changes |
|------|---------|
| `/server/socket.js` | Remove setInterval, register sessions (~30 lines) |
| `/server/game/mining.js` | Add session registry (~40 lines) |
| `/server/game/engine.js` | Implement updateMining() (~60 lines) |
| `/tests/unit/server/mining-tick.test.js` | New test file |

---

## Priority and Sequencing

| Phase | Priority | Effort | Dependency |
|-------|----------|--------|------------|
| 1.5 | Medium | 3-4 hrs | None |
| 1.3 | Lower | 5-6 hrs | Spatial hash (done) |

**Recommended order:** 1.5 first (simpler, isolated), then 1.3 (more complex).

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Fire handler time | 8-15ms | <1ms |
| Active intervals per miner | 1 | 0 |
| Combat events per tick | Blocking | Batched (5ms budget) |

---

## Notes

- These optimizations are not critical for gameplay
- The completed phases (1.1, 1.2, 1.4, 2.x, 3.x) address the primary issues
- Implement these if performance issues persist under heavy load
