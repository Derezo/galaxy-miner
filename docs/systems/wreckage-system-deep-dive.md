# Wreckage System Deep Dive

## Table of Contents
1. [Data Structures](#data-structures)
2. [Wreckage Spawn Flow](#wreckage-spawn-flow)
3. [Standard Collection Flow](#standard-collection-flow)
4. [Scrap Siphon Multi-Collection Flow](#scrap-siphon-multi-collection-flow)
5. [Scavenger NPC Collection Flow](#scavenger-npc-collection-flow)
6. [Client Rendering Pipeline](#client-rendering-pipeline)
7. [Event Reference](#event-reference)
8. [Code Paths](#code-paths)

---

## Data Structures

### Server: Wreckage Object
```javascript
// /server/game/loot.js - activeWreckage Map
{
  id: "wreckage_123",
  position: { x: 5000, y: 3000 },
  size: 20,                        // 20=NPC, 25=player, 40=base
  source: "npc",                   // "npc" | "player" | "base"
  faction: "pirate",               // Faction color for rendering
  npcType: "pirate_raider",        // Original entity type
  npcName: "Pirate Raider",        // Display name
  playerId: null,                  // Set if player wreckage
  creditReward: 100,               // Credits in wreckage
  contents: [                      // Loot items
    { type: "credits", amount: 100 },
    { type: "IRON", quantity: 5 },
    { type: "buff", buffType: "SHIELD_BOOST" }
  ],
  damageContributors: {            // For team credit sharing
    "user_1": 150,
    "user_2": 50
  },
  spawnTime: 1699999999999,        // Date.now() at spawn
  despawnTime: 1700000059999,      // spawnTime + 60000ms
  beingCollectedBy: null,          // Player ID if being collected
  collectionProgress: 0,           // 0-totalCollectionTime
  collectionStartTime: null,       // When collection started
  totalCollectionTime: 3500        // Calculated from contents
}
```

### Client: Wreckage Entity
```javascript
// /client/js/entities.js - Entities.wreckage Map
{
  id: "wreckage_123",
  position: { x: 5000, y: 3000 },
  faction: "pirate",
  npcName: "Pirate Raider",
  contentCount: 3,                 // Number of items (for UI)
  despawnTime: 1700000059999,
  spawnTime: 1699999999999,
  rotation: 1.234,                 // Visual rotation (radians)
  rotationSpeed: 0.15              // Rotation per second
}
```

### Client: Siphon Animation State
```javascript
// /client/js/entities.js - Entities.siphonAnimations Map
{
  startTime: 1699999999999,        // Animation start
  duration: 600,                   // Animation length (ms)
  startPos: { x: 5000, y: 3000 },  // Original wreckage position
  targetPos: { x: 5100, y: 3050 }, // Player position (destination)
  faction: "pirate"                // For color fallback
}
```

---

## Wreckage Spawn Flow

### Sequence Diagram: NPC Death → Wreckage Spawn

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     ┌────────┐
│ Player │     │ socket.js│     │engine.js │     │ loot.js│     │ Client │
└───┬────┘     └────┬─────┘     └────┬─────┘     └───┬────┘     └───┬────┘
    │               │                │               │              │
    │ combat:fire   │                │               │              │
    │──────────────▶│                │               │              │
    │               │                │               │              │
    │               │ applyDamage()  │               │              │
    │               │───────────────▶│               │              │
    │               │                │               │              │
    │               │                │ NPC HP <= 0   │              │
    │               │                │───────┐       │              │
    │               │                │       │       │              │
    │               │                │◀──────┘       │              │
    │               │                │               │              │
    │               │                │ spawnWreckage │              │
    │               │                │──────────────▶│              │
    │               │                │               │              │
    │               │                │  wreckage obj │              │
    │               │                │◀──────────────│              │
    │               │                │               │              │
    │               │ broadcastWreckageNear()        │              │
    │               │◀───────────────│               │              │
    │               │                │               │              │
    │               │                │               │              │
    │               │           wreckage:spawn       │              │
    │               │───────────────────────────────────────────────▶
    │               │                │               │              │
    │               │                │               │              │
    │               │                │               │   Entities.  │
    │               │                │               │ updateWreckage
    │               │                │               │   ───────┐   │
    │               │                │               │          │   │
    │               │                │               │   ◀──────┘   │
    │               │                │               │              │
```

### Code Path: NPC Death

```
1. Player fires weapon
   └─▶ socket.js: socket.on('combat:fire')
       └─▶ engine.js: applyDamageToNPC()

2. NPC health reaches 0
   └─▶ engine.js: handleNPCDeath()
       ├─▶ loot.js: spawnWreckage(npcEntity, position, null, damageContributors)
       │   └─▶ Creates wreckage object
       │   └─▶ Adds to activeWreckage Map
       │   └─▶ Returns wreckage object
       │
       └─▶ engine.js: broadcastWreckageNear(wreckage, 'wreckage:spawn', {...})
           └─▶ Emits to all players within broadcast range

3. Client receives event
   └─▶ network.js: socket.on('wreckage:spawn')
       └─▶ Entities.updateWreckage(data)
           └─▶ Adds to Entities.wreckage Map
```

### Source Files
| Step | File | Line | Function |
|------|------|------|----------|
| Combat handler | `/server/socket.js` | ~760 | `socket.on('combat:fire')` |
| Apply damage | `/server/game/engine.js` | ~1450 | `applyDamageToNPC()` |
| Handle death | `/server/game/engine.js` | ~1500 | `handleNPCDeath()` |
| Spawn wreckage | `/server/game/loot.js` | 41 | `spawnWreckage()` |
| Broadcast | `/server/game/engine.js` | ~1528 | `broadcastWreckageNear()` |
| Client receive | `/client/js/network.js` | ~1692 | `socket.on('wreckage:spawn')` |
| Store entity | `/client/js/entities.js` | ~300 | `updateWreckage()` |

---

## Standard Collection Flow

### Sequence Diagram: Player Collection

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     ┌────────┐
│ Player │     │ input.js │     │network.js│     │socket.js│    │ loot.js│
└───┬────┘     └────┬─────┘     └────┬─────┘     └───┬────┘     └───┬────┘
    │               │                │               │              │
    │  Press M key  │                │               │              │
    │──────────────▶│                │               │              │
    │               │                │               │              │
    │               │tryCollectWreck │               │              │
    │               │───────────────▶│               │              │
    │               │                │               │              │
    │               │                │loot:startColl │              │
    │               │                │──────────────▶│              │
    │               │                │               │              │
    │               │                │               │startCollect  │
    │               │                │               │─────────────▶│
    │               │                │               │              │
    │               │                │               │  {success}   │
    │               │                │               │◀─────────────│
    │               │                │               │              │
    │               │                │ loot:started  │              │
    │               │                │◀──────────────│              │
    │               │                │               │              │
    │               │   update UI    │               │              │
    │◀──────────────│◀───────────────│               │              │
    │               │                │               │              │
    │               │    ... 50ms interval ...       │              │
    │               │                │               │              │
    │               │                │ loot:progress │              │
    │               │                │◀──────────────│              │
    │               │                │               │              │
    │               │    ... collection complete ... │              │
    │               │                │               │              │
    │               │                │loot:complete  │              │
    │               │                │◀──────────────│              │
    │               │                │               │              │
    │               │ rewards popup  │               │              │
    │◀──────────────│◀───────────────│               │              │
    │               │                │               │              │
```

### State Machine: Player Collection State

```
                    ┌──────────────┐
                    │    IDLE      │
                    │ (no target)  │
                    └──────┬───────┘
                           │
                           │ Press M near wreckage
                           ▼
                    ┌──────────────┐
          ┌────────│  COLLECTING  │────────┐
          │        │ (progress 0%)│        │
          │        └──────┬───────┘        │
          │               │                │
     Cancel/Move    Progress updates  Complete
          │               │                │
          │               ▼                │
          │        ┌──────────────┐        │
          │        │  COLLECTING  │        │
          │        │(progress N%) │        │
          │        └──────┬───────┘        │
          │               │                │
          ▼               ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │  CANCELLED   │ │  COLLECTING  │ │   COMPLETE   │
   │              │ │(progress 99%)│ │   (rewards)  │
   └──────┬───────┘ └──────────────┘ └──────┬───────┘
          │                                 │
          └────────────────┬────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    IDLE      │
                    └──────────────┘
```

### Code Path: Standard Collection

```
1. Player presses M key
   └─▶ input.js: handleKeyDown('m')
       └─▶ Player.tryCollectWreckage()

2. Find nearest wreckage
   └─▶ player.js: tryCollectWreckage()
       └─▶ Entities.getClosestWreckage(position, 50)
       └─▶ Network.sendLootStartCollect(wreckageId)

3. Server validates and starts
   └─▶ socket.js: socket.on('loot:startCollect')
       └─▶ Validate player position
       └─▶ loot.startCollection(wreckageId, playerId)
       └─▶ socket.emit('loot:started', { wreckageId, totalTime })

4. Progress loop (server-side interval)
   └─▶ socket.js: setInterval (50ms)
       └─▶ loot.updateCollection(wreckageId, playerId, 50)
       └─▶ socket.emit('loot:progress', { progress })
       └─▶ When complete: socket.emit('loot:complete', { contents })

5. Client updates UI
   └─▶ network.js: socket.on('loot:progress')
       └─▶ Player.onLootCollectionProgress(data)
   └─▶ network.js: socket.on('loot:complete')
       └─▶ Player.onLootCollectionComplete(data)
       └─▶ NotificationManager.queueReward(results)
```

---

## Scrap Siphon Multi-Collection Flow

### Sequence Diagram: Multi-Collection

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐
│ Player │     │network.js│     │socket.js │     │entities.js │
└───┬────┘     └────┬─────┘     └────┬─────┘     └─────┬──────┘
    │               │                │                  │
    │  Press M      │                │                  │
    │  (has relic)  │                │                  │
    │──────────────▶│                │                  │
    │               │                │                  │
    │               │wreckage:multi  │                  │
    │               │   Collect      │                  │
    │               │───────────────▶│                  │
    │               │                │                  │
    │               │                │ Validate relic   │
    │               │                │ Find 3 nearest   │
    │               │                │ within 300 units │
    │               │                │                  │
    │               │loot:multiStart │                  │
    │               │◀───────────────│                  │
    │               │                │                  │
    │               │                │                  │
    │               │ startSiphon    │                  │
    │               │ Animation()    │                  │
    │               │───────────────────────────────────▶
    │               │                │                  │
    │               │                │  Store animation │
    │               │                │  state per       │
    │               │                │  wreckageId      │
    │               │                │                  │
    │               │    ... 500ms server timeout ...  │
    │               │                │                  │
    │               │loot:multiCompl │                  │
    │               │◀───────────────│                  │
    │               │                │                  │
    │               │  setTimeout    │                  │
    │               │  (650ms)       │                  │
    │               │  ────────┐     │                  │
    │               │          │     │                  │
    │  Render       │          │     │                  │
    │  animation    │          │     │                  │
    │◀──────────────│          │     │                  │
    │               │          │     │                  │
    │               │  ◀───────┘     │                  │
    │               │                │                  │
    │               │clearSiphon     │                  │
    │               │Animation()     │                  │
    │               │───────────────────────────────────▶
    │               │                │                  │
    │               │removeWreckage()│                  │
    │               │───────────────────────────────────▶
    │               │                │                  │
```

### Animation Timeline

```
Time: 0ms                                              650ms
      │                                                  │
      ▼                                                  ▼
┌─────┬──────────────────────────────────────────────────┬─────┐
│START│         ANIMATION PLAYING (600ms)                │ END │
└─────┴──────────────────────────────────────────────────┴─────┘
      │                                                  │
      │ loot:multiStarted                                │
      │ ▼                                                │
      │ startSiphonAnimation()                           │
      │   - Store start position                         │
      │   - Store player position as target              │
      │   - Duration = max(600, serverTime)              │
      │                                                  │
      │        loot:multiComplete (500ms)                │
      │        ▼                                         │
      │        setTimeout(650ms) ───────────────────────▶│
      │                                                  │
      │        Renderer draws:                           │ clearSiphonAnimations()
      │          - Copper glow color                     │ removeWreckage()
      │          - Position interpolation                │
      │          - Scale down to 50%                     │
      │          - Fade out last 30%                     │
      │                                                  │
```

### Code Path: Scrap Siphon Collection

```
1. Player presses M with Scrap Siphon relic
   └─▶ input.js: handleKeyDown('m')
       └─▶ Player.tryMultiCollectWreckage()
           └─▶ Player.hasRelic('SCRAP_SIPHON') → true
           └─▶ Network.sendMultiCollect()

2. Server validates and starts
   └─▶ socket.js: socket.on('wreckage:multiCollect')
       └─▶ Check player has SCRAP_SIPHON relic
       └─▶ engine.getWreckageInRange(position, 300)
       └─▶ Take up to 3 nearest
       └─▶ socket.emit('loot:multiStarted', { wreckageIds, totalTime: 500 })
       └─▶ setTimeout(500ms) → socket.emit('loot:multiComplete', {...})

3. Client starts animation
   └─▶ network.js: socket.on('loot:multiStarted')
       └─▶ Player.onMultiCollectStarted(data)
       └─▶ Entities.startSiphonAnimation(wreckageIds, playerPos, 600)
           └─▶ For each wreckageId:
               └─▶ siphonAnimations.set(id, { startTime, duration, startPos, targetPos })

4. Renderer draws animated wreckage
   └─▶ renderer.js: drawWreckage()
       └─▶ For each wreckage in Entities.wreckage:
           └─▶ Entities.getSiphonAnimationState(id)
           └─▶ If animating:
               └─▶ Calculate progress (0-1)
               └─▶ Ease position toward player
               └─▶ Apply copper glow color
               └─▶ Scale down
               └─▶ Fade out last 30%

5. Client cleans up after animation delay
   └─▶ network.js: socket.on('loot:multiComplete')
       └─▶ Player.onMultiCollectComplete(data)
       └─▶ setTimeout(650ms):
           └─▶ Entities.clearSiphonAnimations(wreckageIds)
           └─▶ Entities.removeWreckage(wreckageId) for each
```

---

## Scavenger NPC Collection Flow

### State Machine: Scavenger AI

```
                         ┌──────────────┐
              ┌─────────▶│    IDLE      │◀─────────┐
              │          │  (patrol)    │          │
              │          └──────┬───────┘          │
              │                 │                  │
              │    Wreckage detected               │
              │                 │                  │
              │                 ▼                  │
              │          ┌──────────────┐          │
              │          │   SEEKING    │          │
              │          │(move to wreck)│         │
              │          └──────┬───────┘          │
              │                 │                  │
     Rage cleared         Arrived                 │
              │                 │                  │
              │                 ▼                  │
              │          ┌──────────────┐          │
              │          │  COLLECTING  │          │
              │          │  (1.5 sec)   │          │
              │          └──────┬───────┘          │
              │                 │                  │
              │           Complete                 │
              │                 │                  │
              │                 ▼                  │
              │          ┌──────────────┐     Hauler: grow +10%
              │          │  RETURNING   │─────────▶│
              │          │ (to base)    │          │
              │          └──────┬───────┘          │
              │                 │                  │
              │           At base                  │
              │                 │                  │
              │                 ▼                  │
              │          ┌──────────────┐          │
              └──────────│   DUMPING    │──────────┘
                         │  (1 sec)     │
                         └──────────────┘


            RAGE TRIGGER (any state)
                         │
                         ▼
                  ┌──────────────┐
                  │   ENRAGED    │
                  │(chase target)│
                  └──────────────┘
```

### Rage Trigger Events

```
Player attacks scavenger
        │
        ▼
┌───────────────────┐
│ triggerRage(npc,  │
│   attackerId)     │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌───────────────────┐
│ Spread to nearby  │────▶│ socket.emit       │
│ scavengers        │     │ 'scavenger:rage'  │
│ within 1000 units │     │ (targetId, npcId) │
└───────────────────┘     └───────────────────┘


Player collects wreckage near scavenger (within 300 units)
        │
        ▼
┌───────────────────┐
│checkWreckageTheft │
│ (onWreckageCollect│
│ callback)         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ If !hasScrapSiphon│────▶ RAGE TRIGGERED
│ and dist < 300    │
└───────────────────┘
```

---

## Client Rendering Pipeline

### Render Order

```
renderer.js: render()
    │
    ├─▶ drawBackground()
    │
    ├─▶ drawWreckage()          ◀── Wreckage rendered here
    │       │
    │       ├─▶ For each in Entities.wreckage:
    │       │       │
    │       │       ├─▶ getSiphonAnimationState(id)
    │       │       │
    │       │       ├─▶ If siphoning:
    │       │       │       ├─▶ Interpolate position
    │       │       │       ├─▶ Apply copper color
    │       │       │       ├─▶ Scale down
    │       │       │       └─▶ Fade out
    │       │       │
    │       │       └─▶ Draw debris pieces
    │       │           Draw glow
    │       │           Draw label
    │       │
    │       └─▶ End loop
    │
    ├─▶ drawAsteroids()
    │
    ├─▶ drawNPCs()
    │       │
    │       └─▶ If scavenger collecting:
    │               └─▶ Draw tractor beam to wreckage
    │
    ├─▶ drawPlayers()
    │
    ├─▶ drawCollectionProgress()  ◀── Progress bar for player collection
    │
    └─▶ drawUI()
```

### Siphon Animation Rendering

```javascript
// /client/js/renderer.js - drawWreckage()

// Check if being siphoned
const siphonState = Entities.getSiphonAnimationState(id);
const isSiphoning = siphonState !== null;

if (isSiphoning) {
  const progress = siphonState.progress;  // 0.0 to 1.0

  // Ease-in-out cubic interpolation
  const easedProgress = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  // Position: lerp from start to player
  drawX = startPos.x + (targetPos.x - startPos.x) * easedProgress;
  drawY = startPos.y + (targetPos.y - startPos.y) * easedProgress;

  // Scale: shrink to 50%
  siphonScale = 1 - (progress * 0.5);

  // Alpha: fade out in last 30%
  if (progress > 0.7) {
    siphonAlpha = 1 - ((progress - 0.7) / 0.3);
  }

  // Color: copper instead of faction color
  color = "#B87333";  // SIPHON_COPPER
}
```

---

## Event Reference

### All Wreckage-Related Socket Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `wreckage:spawn` | S→C | `{id, x, y, faction, npcName, contentCount, despawnTime}` | New wreckage created |
| `wreckage:despawn` | S→C | `{id}` | Wreckage timeout expired |
| `wreckage:collected` | S→C | `{wreckageId, collectedBy}` | Someone collected it |
| `loot:startCollect` | C→S | `{wreckageId}` | Request to start collecting |
| `loot:cancelCollect` | C→S | `{wreckageId}` | Request to stop collecting |
| `loot:started` | S→C | `{wreckageId, totalTime}` | Collection started |
| `loot:progress` | S→C | `{wreckageId, progress}` | Progress update (0-1) |
| `loot:complete` | S→C | `{wreckageId, contents, results}` | Standard collection done |
| `loot:cancelled` | S→C | `{reason}` | Collection interrupted |
| `loot:error` | S→C | `{message}` | Collection failed |
| `wreckage:multiCollect` | C→S | (none) | Scrap Siphon request |
| `loot:multiStarted` | S→C | `{wreckageIds, totalTime}` | Multi-collect started |
| `loot:multiComplete` | S→C | `{wreckageIds, contents, results}` | Multi-collect done |
| `loot:getNearby` | C→S | (none) | Request nearby wreckage |
| `loot:nearby` | S→C | `{wreckage: [...]}` | Nearby wreckage list |
| `loot:playerCollecting` | S→C | `{playerId, wreckageId}` | Other player started |
| `loot:playerMultiCollecting` | S→C | `{playerId, wreckageIds}` | Other player multi-collect |
| `loot:playerStopped` | S→C | `{playerId}` | Other player stopped |
| `scavenger:collecting` | S→C | `{npcId, wreckageId, position}` | NPC started collecting |
| `scavenger:rage` | S→C | `{npcId, targetId, x, y}` | Scavenger enraged |
| `scavenger:rageClear` | S→C | `{npcId}` | Scavenger calmed down |

---

## Code Paths

### Quick Reference: File Locations

#### Server
```
/server/game/loot.js
├── activeWreckage (Map)        - Line 7
├── spawnWreckage()             - Line 41
├── getWreckage()               - Line 80
├── removeWreckage()            - Line 84
├── getWreckageInRange()        - Line 88
├── startCollection()           - Line 101
├── updateCollection()          - Line 133
├── cancelCollection()          - Line 158
└── cleanupExpiredWreckage()    - Line 168

/server/game/engine.js
├── handlePlayerDeath()         - Line ~145  (spawns player wreckage)
├── handleNPCDeath()            - Line ~1500 (spawns NPC wreckage)
├── handleBaseDestruction()     - Line ~1745 (spawns base wreckage)
└── updateWreckage()            - Line ~1270 (despawn cleanup)

/server/socket.js
├── loot:startCollect           - Line ~863
├── loot:cancelCollect          - Line ~1004
└── wreckage:multiCollect       - Line ~1043

/server/game/ai/scavenger.js
├── findNearestWreckage()       - Line 103
├── seekWreckage()              - Line 125
├── startCollecting()           - Line 150
└── triggerRage()               - Line ~250
```

#### Client
```
/client/js/network.js
├── wreckage:spawn              - Line ~1692
├── wreckage:despawn            - Line ~1704
├── wreckage:collected          - Line ~1712
├── loot:started                - Line ~1721
├── loot:progress               - Line ~1725
├── loot:complete               - Line ~1729
├── loot:cancelled              - Line ~1735
├── loot:multiStarted           - Line ~1740
├── loot:multiComplete          - Line ~1754
└── scavenger:rage              - Line ~660

/client/js/entities.js
├── wreckage (Map)              - Line 14
├── siphonAnimations (Map)      - Line 22
├── updateWreckage()            - Line ~295
├── removeWreckage()            - Line ~316
├── getWreckageInRange()        - Line ~320
├── startSiphonAnimation()      - Line ~357
├── clearSiphonAnimations()     - Line ~378
└── getSiphonAnimationState()   - Line ~383

/client/js/renderer.js
├── drawWreckage()              - Line 806
├── drawCollectionProgress()    - Line ~966
└── (siphon animation logic)    - Lines 833-960

/client/js/player.js
├── tryCollectWreckage()        - Line ~580
├── tryMultiCollectWreckage()   - Line ~616
├── onLootCollectionStarted()   - Line ~560
├── onLootCollectionProgress()  - Line ~565
├── onLootCollectionComplete()  - Line ~570
├── onMultiCollectStarted()     - Line ~630
└── onMultiCollectComplete()    - Line ~636
```

---

## Refactoring Recommendations

### Issue 1: Duplicate Handler Systems
**Problem:** Both `/client/js/network.js` and `/client/js/network/loot.js` exist. Only network.js is loaded.

**Recommendation:** Either:
- Remove the `/client/js/network/` folder entirely, OR
- Wire up the modular system and migrate handlers

### Issue 2: Event Name Inconsistency
**Problem:** Mix of `wreckage:*` and `loot:*` prefixes for related events.

**Recommendation:** Consolidate under `wreckage:` namespace:
- `wreckage:startCollect` instead of `loot:startCollect`
- `wreckage:complete` instead of `loot:complete`

### Issue 3: Animation/Server Timing Mismatch
**Problem:** Server collection (500ms) completes before client animation (600ms).

**Recommendation:** Either:
- Make animation duration configurable from server, OR
- Store animation state separate from wreckage data

### Issue 4: No TypeScript Types
**Problem:** No type definitions for wreckage objects.

**Recommendation:** Add JSDoc types or convert to TypeScript for better IDE support.
