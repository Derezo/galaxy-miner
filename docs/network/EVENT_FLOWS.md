# Galaxy Miner Network Event Flows

Sequence diagrams showing the complete message flow for each game feature.

## Table of Contents
- [Authentication Flow](#authentication-flow)
- [Player Movement Flow](#player-movement-flow)
- [Death and Respawn Flow](#death-and-respawn-flow)
- [Combat Flow](#combat-flow)
- [Mining Flow](#mining-flow)
- [Loot Collection Flow](#loot-collection-flow)
- [Marketplace Flow](#marketplace-flow)
- [Wormhole Transit Flow](#wormhole-transit-flow)
- [Ship Upgrade Flow](#ship-upgrade-flow)

---

## Authentication Flow

### Login
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   auth:login                  │
     │   {username, password}        │
     │──────────────────────────────►│
     │                               │
     │                               ├── Validate credentials
     │                               ├── Generate JWT token
     │                               ├── Setup player session
     │                               │
     │   auth:success                │
     │   {token, player}             │
     │◄──────────────────────────────│
     │                               │
     ├── Store token in localStorage │
     ├── Initialize game state       │
     │                               │
```

### Token Reconnect
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   auth:token                  │
     │   {token}                     │
     │──────────────────────────────►│
     │                               │
     │                               ├── Validate JWT
     │                               ├── Retrieve player data
     │                               ├── Check if dead
     │                               │
     │   auth:success                │
     │   {token, player}             │
     │◄──────────────────────────────│
     │                               │
     │   [If dead] player:death      │
     │   {respawnOptions}            │
     │◄──────────────────────────────│
     │                               │
```

### Error Case
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   auth:login                  │
     │──────────────────────────────►│
     │                               │
     │                               ├── Validation fails
     │                               │
     │   auth:error                  │
     │   {message: "Invalid..."}     │
     │◄──────────────────────────────│
     │                               │
     ├── Show error to user          │
     │                               │
```

---

## Player Movement Flow

### Position Update Loop
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │   player:input                │                                 │
     │   {x, y, vx, vy, rotation}    │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Validate velocity             │
     │                               ├── Update state                  │
     │                               ├── Calculate sector              │
     │                               │                                 │
     │                               │   player:update                 │
     │                               │   {id, x, y, rotation, ...}     │
     │                               │────────────────────────────────►│
     │                               │                                 │
     │                               │                                 ├── Update entity
     │                               │                                 │
```

### Position Persistence (every 5s)
```
┌──────────┐                    ┌──────────┐                    ┌────────┐
│  Client  │                    │  Server  │                    │ SQLite │
└────┬─────┘                    └────┬─────┘                    └───┬────┘
     │                               │                              │
     │   player:input (throttled)    │                              │
     │──────────────────────────────►│                              │
     │                               │                              │
     │                               │  UPDATE users SET...         │
     │                               │─────────────────────────────►│
     │                               │                              │
```

---

## Death and Respawn Flow

### Player Death
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │                               │  (Player health <= 0)           │
     │                               │                                 │
     │                               ├── Mark player dead              │
     │                               ├── Drop cargo (random)           │
     │                               ├── Spawn wreckage                │
     │                               ├── Calculate respawn options     │
     │                               │                                 │
     │   player:death                │                                 │
     │   {killerType, killerName,    │                                 │
     │    cause, droppedCargo,       │                                 │
     │    deathPosition,             │                                 │
     │    respawnOptions}            │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   wreckage:spawn                │
     │                               │   {id, x, y, contents...}       │
     │                               │────────────────────────────────►│
     │                               │                                 │
     ├── Trigger death cinematic     │                                 │
     ├── Show respawn UI             │                                 │
     │                               │                                 │
```

### Respawn Selection
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   respawn:select              │
     │   {type: "hub", targetId}     │
     │──────────────────────────────►│
     │                               │
     │                               ├── Validate player dead
     │                               ├── Calculate spawn position
     │                               ├── Reset health
     │                               ├── Update position in DB
     │                               │
     │   player:respawn              │
     │   {position, hull, shield,    │
     │    locationName}              │
     │◄──────────────────────────────│
     │                               │
     ├── Hide respawn UI             │
     ├── Teleport player             │
     ├── Resume game                 │
     │                               │
```

---

## Combat Flow

### Player Fires Weapon
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │   combat:fire                 │                                 │
     │   {direction}                 │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Set status 'combat'           │
     │                               ├── Calculate weapon range        │
     │                               ├── Hit detection (NPCs)          │
     │                               ├── Hit detection (Bases)         │
     │                               │                                 │
     │                               │   combat:fire                   │
     │                               │   {playerId, x, y, weaponTier}  │
     │                               │────────────────────────────────►│
     │                               │                                 │
     │   combat:npcHit (if hit)      │                                 │
     │   {npcId, damage, destroyed}  │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
```

### Tesla Chain Lightning (Tier 5)
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   combat:fire                 │
     │──────────────────────────────►│
     │                               │
     │                               ├── Primary hit
     │                               ├── Calculate chain targets
     │                               ├── Apply chain damage
     │                               │
     │   combat:chainLightning       │
     │   {chains: [{targetId,        │
     │     targetX, targetY,         │
     │     damage, destroyed}]}      │
     │◄──────────────────────────────│
     │                               │
     ├── Trigger chain visual        │
     │                               │
```

### NPC Combat
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │                               │  (NPC AI decides to attack)     │
     │                               │                                 │
     │                               │   combat:npcFire                │
     │   combat:npcFire              │   {npcId, sourceX, sourceY,     │
     │   {npcId, faction, ...}       │    targetX, targetY, hitInfo}   │
     │◄──────────────────────────────│────────────────────────────────►│
     │                               │                                 │
     │                               │  (If hit player)                │
     │   player:damaged              │                                 │
     │   {attackerId, damage,        │                                 │
     │    hull, shield}              │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
```

---

## Mining Flow

### Start Mining
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │   mining:start                │                                 │
     │   {objectId}                  │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Validate target               │
     │                               ├── Set status 'mining'           │
     │                               ├── Start mining timer            │
     │                               │                                 │
     │   mining:started              │                                 │
     │   {objectId, miningTime}      │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   mining:playerStarted          │
     │                               │   {playerId, targetX, targetY}  │
     │                               │────────────────────────────────►│
     │                               │                                 │
     ├── Start drill animation       │                                 │
     ├── Play mining sound           │                                 │
     │                               │                                 │
```

### Mining Complete
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │                               │  (Mining timer complete)        │
     │                               │                                 │
     │                               ├── Calculate resource yield      │
     │                               ├── Add to inventory              │
     │                               ├── Check depletion               │
     │                               │                                 │
     │   mining:complete             │                                 │
     │   {resourceType, quantity}    │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │   inventory:update            │                                 │
     │   {inventory, credits}        │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   mining:playerStopped          │
     │                               │   {playerId}                    │
     │                               │────────────────────────────────►│
     │                               │                                 │
     │                               │   [If depleted] world:update    │
     │                               │   {objectId, depleted: true}    │
     │                               │────────────────────────────────►│
     │                               │                                 │
```

---

## Loot Collection Flow

### Single Wreckage Collection
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │   loot:startCollect           │                                 │
     │   {wreckageId}                │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Validate wreckage             │
     │                               ├── Check range                   │
     │                               ├── Set status 'collecting'       │
     │                               │                                 │
     │   loot:started                │                                 │
     │   {wreckageId, totalTime}     │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   loot:playerCollecting         │
     │                               │   {playerId, wreckageId}        │
     │                               │────────────────────────────────►│
     │                               │                                 │
     │   loot:progress (100ms loop)  │                                 │
     │   {progress: 0.1}             │                                 │
     │◄──────────────────────────────│                                 │
     │   ...                         │                                 │
     │   {progress: 1.0}             │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │   loot:complete               │                                 │
     │   {contents, results}         │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │   inventory:update            │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   wreckage:collected            │
     │                               │   {wreckageId}                  │
     │                               │────────────────────────────────►│
     │                               │                                 │
```

### Multi-Collect (Scrap Siphon Relic)
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   wreckage:multiCollect       │
     │   (no payload)                │
     │──────────────────────────────►│
     │                               │
     │                               ├── Validate relic
     │                               ├── Find nearby wreckage
     │                               ├── Start simultaneous collection
     │                               │
     │   loot:multiStarted           │
     │   {wreckageIds: [...],        │
     │    totalTime}                 │
     │◄──────────────────────────────│
     │                               │
     │   loot:multiComplete          │
     │   {wreckageIds, contents,     │
     │    results, teamCredits}      │
     │◄──────────────────────────────│
     │                               │
```

---

## Marketplace Flow

### List Item for Sale
```
┌──────────┐                    ┌──────────┐                    ┌─────────────┐
│  Client  │                    │  Server  │                    │ All Players │
└────┬─────┘                    └────┬─────┘                    └──────┬──────┘
     │                               │                                 │
     │   market:list                 │                                 │
     │   {resourceType, qty, price}  │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Validate inventory            │
     │                               ├── Remove from inventory         │
     │                               ├── Create listing                │
     │                               │                                 │
     │   market:listed               │                                 │
     │   {listingId}                 │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │   inventory:update            │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   market:update                 │
     │                               │   {action: 'new_listing'}       │
     │                               │────────────────────────────────►│
     │                               │                                 │
```

### Buy from Market
```
┌──────────┐                    ┌──────────┐                    ┌────────┐
│  Client  │                    │  Server  │                    │ Seller │
└────┬─────┘                    └────┬─────┘                    └───┬────┘
     │                               │                              │
     │   market:buy                  │                              │
     │   {listingId, quantity}       │                              │
     │──────────────────────────────►│                              │
     │                               │                              │
     │                               ├── Validate credits           │
     │                               ├── Process purchase           │
     │                               ├── Add to buyer inventory     │
     │                               ├── Credit seller              │
     │                               │                              │
     │   market:bought               │                              │
     │   {cost}                      │                              │
     │◄──────────────────────────────│                              │
     │                               │                              │
     │   inventory:update            │                              │
     │◄──────────────────────────────│                              │
     │                               │                              │
     │                               │   market:sold                │
     │                               │   {totalCredits, buyerName}  │
     │                               │─────────────────────────────►│
     │                               │                              │
```

---

## Wormhole Transit Flow

### Enter and Transit
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │   wormhole:enter              │                                 │
     │   {wormholeId}                │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Validate proximity            │
     │                               ├── Get destinations              │
     │                               │                                 │
     │   wormhole:entered            │                                 │
     │   {wormholeId, destinations}  │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   wormhole:playerEntered        │
     │                               │   {playerId, wormholeId}        │
     │                               │────────────────────────────────►│
     │                               │                                 │
     ├── Show destination UI         │                                 │
     │                               │                                 │
     │   wormhole:selectDestination  │                                 │
     │   {destinationId}             │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │                               ├── Start transit timer           │
     │                               │                                 │
     │   wormhole:transitStarted     │                                 │
     │   {destination, duration}     │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     │                               │   wormhole:playerTransiting     │
     │                               │────────────────────────────────►│
     │                               │                                 │
     ├── Start wormhole effect       │                                 │
     │                               │                                 │
     │   (after duration)            │                                 │
     │   wormhole:exitComplete       │                                 │
     │   {position, wormholeId}      │                                 │
     │◄──────────────────────────────│                                 │
     │                               │                                 │
     ├── Teleport player             │                                 │
     │                               │                                 │
```

---

## Ship Upgrade Flow

### Upgrade Component
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   ship:upgrade                │
     │   {component: "weapon"}       │
     │──────────────────────────────►│
     │                               │
     │                               ├── Validate component
     │                               ├── Check tier limit
     │                               ├── Check resources
     │                               ├── Check credits
     │                               ├── Consume resources
     │                               ├── Increment tier
     │                               ├── Update player cache
     │                               │
     │   upgrade:success             │
     │   {component, newTier,        │
     │    credits, shieldMax,        │
     │    hullMax}                   │
     │◄──────────────────────────────│
     │                               │
     │   inventory:update            │
     │◄──────────────────────────────│
     │                               │
     ├── Update UI                   │
     ├── Show notification           │
     │                               │
```

### Error Case
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   ship:upgrade                │
     │──────────────────────────────►│
     │                               │
     │                               ├── Check fails
     │                               │
     │   upgrade:error               │
     │   {message: "Not enough..."}  │
     │◄──────────────────────────────│
     │                               │
     ├── Show error notification     │
     │                               │
```

---

## NPC Spawn and Update Flow

### Proximity-Based Spawning
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   player:input                │
     │   (moves into new sector)     │
     │──────────────────────────────►│
     │                               │
     │                               ├── Detect sector change
     │                               ├── Find NPCs in range
     │                               │
     │   npc:spawn (for each)        │
     │   {id, type, faction, x, y,   │
     │    hull, hullMax, shield...}  │
     │◄──────────────────────────────│
     │                               │
     ├── Add to Entities             │
     │                               │
```

### Game Tick Updates
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │                               │  (Every 50ms - 20 ticks/sec)
     │                               │
     │   npc:update (batch)          │
     │   [{id, x, y, rotation,       │
     │     hull, shield, status}]    │
     │◄──────────────────────────────│
     │                               │
     ├── Interpolate positions       │
     │                               │
```

---

## Team Mechanics Flow

### Shared Kill Credits
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Player A │     │  Server  │     │ Player B │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     │ combat:fire    │                │
     │───────────────►│                │
     │                │                │
     │                │   combat:fire  │
     │                │◄───────────────│
     │                │                │
     │                │ (NPC destroyed)│
     │                │                │
     │                ├── Track damage │
     │                ├── Calculate    │
     │                │   team share   │
     │                │                │
     │ npc:destroyed  │                │
     │◄───────────────│───────────────►│
     │ {teamMultiplier│                │
     │  creditsPerPlayer}              │
     │                │                │
     │ team:creditReward               │
     │◄───────────────│───────────────►│
     │ {credits,      │                │
     │  participantCount}              │
     │                │                │
```

---

## Connection Lifecycle

### Connect and Disconnect
```
┌──────────┐                    ┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Server  │                    │ Nearby Player│
└────┬─────┘                    └────┬─────┘                    └──────┬───────┘
     │                               │                                 │
     │   (Socket.io connect)         │                                 │
     │══════════════════════════════►│                                 │
     │                               │                                 │
     │   auth:token                  │                                 │
     │──────────────────────────────►│                                 │
     │                               │                                 │
     │   ... (gameplay) ...          │                                 │
     │                               │                                 │
     │   (disconnect)                │                                 │
     │══════════════════════════════►│                                 │
     │                               │                                 │
     │                               ├── Save position to DB           │
     │                               ├── Clear mining/loot intervals   │
     │                               ├── Cancel active sessions        │
     │                               │                                 │
     │                               │   player:leave                  │
     │                               │   {userId}                      │
     │                               │────────────────────────────────►│
     │                               │                                 │
```

---

## Latency Measurement

### Ping/Pong
```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │   ping                        │
     │   timestamp                   │
     │──────────────────────────────►│
     │                               │
     │   pong                        │
     │   timestamp (echoed)          │
     │◄──────────────────────────────│
     │                               │
     ├── Calculate RTT               │
     ├── Update HUD                  │
     │                               │
```

---

## Legend

```
─────►  Event sent (single direction)
◄─────  Event received (single direction)
═══════  TCP/WebSocket connection event
────────►────────►  Broadcast to multiple recipients
```
