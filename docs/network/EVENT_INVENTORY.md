# Galaxy Miner Network Event Inventory

Complete documentation of all Socket.io events used for client-server communication.

## Overview

| Metric | Count |
|--------|-------|
| Total Events | ~93 |
| Client→Server Events | ~28 |
| Server→Client Events | ~65 |
| Event Categories | 22 |
| Handler Modules (Client) | 10 |
| Handler Modules (Server) | 9 |

## Event Naming Convention

All events follow the pattern: `category:action`

- **Category**: Feature namespace (auth, player, combat, mining, etc.)
- **Action**: Specific operation (login, update, fire, start, etc.)
- **Direction indicators**:
  - `C→S` = Client emits, Server handles
  - `S→C` = Server emits, Client handles
  - `Bi` = Bidirectional (both directions)

## Known Issues

### Resolved Issues

| Issue | Location | Status |
|-------|----------|--------|
| ~~`combat:event` placeholder~~ | `/client/js/network/combat.js` | **FIXED** - Removed legacy handler |
| ~~`comet:warning` missing handler~~ | `/client/js/network/npc.js:857` | **FIXED** - Handler added |
| ~~`comet:collision` missing handler~~ | `/client/js/network/npc.js:886` | **FIXED** - Handler added |
| ~~`ship:data` missing handler~~ | `/client/js/network/ship.js:40` | **FIXED** - Handler added |
| ~~`loot:nearby` missing handler~~ | `/client/js/network/loot.js:29` | **FIXED** - Handler added |
| ~~`wormhole:progress` name mismatch~~ | `/client/js/network/wormhole.js:17` | **FIXED** - Changed from transitProgress |
| ~~`combat:baseHit` missing handler~~ | `/client/js/network/combat.js:173` | **FIXED** - Handler added |
| ~~`respawn:error` missing handler~~ | `/client/js/network/player.js:164` | **FIXED** - Handler added |
| ~~`player:health` missing handler~~ | `/client/js/network/player.js:179` | **FIXED** - Handler added |
| ~~`npc:death` missing handler~~ | `/client/js/network/npc.js:925` | **FIXED** - Handler added |
| ~~`swarm:queenDeathRage` missing handler~~ | `/client/js/network/npc.js:945` | **FIXED** - Handler added |
| ~~`player:respawned` name mismatch~~ | `/server/handlers/player.js:95` | **FIXED** - Changed to player:respawn |
| ~~`combat:playerHit` dead code~~ | `/client/js/network/combat.js` | **FIXED** - Removed unused handler |
| ~~`buff:expired` dead code~~ | `/client/js/network/loot.js` | **FIXED** - Removed (handled client-side) |
| ~~Duplicate handler registrations~~ | `/client/js/network.js` | **FIXED** - Removed duplicates, using modular handlers |

### Accepted Naming Inconsistencies

| Issue | Location | Status |
|-------|----------|--------|
| `respawn:select` naming | - | Uses `respawn:` instead of `player:` (documented, not fixing) |
| `upgrade:success/error` naming | - | Uses `upgrade:` instead of `ship:` (documented, not fixing) |
| `rogueMiner:foremanSpawn` naming | - | Uses camelCase category (documented, not fixing) |

### Audit Script

Run `npm run audit:network` to check for event mismatches between client and server.

### Contract Tests

Run `npm test -- tests/unit/network/event-contracts.test.js` to verify event contracts.

---

## Authentication Events

### auth:login
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2210`
- **Server Location:** `/server/socket.js:35`, `/server/handlers/auth.js:26`
- **Payload:**
  ```javascript
  { username: string, password: string }
  ```
- **Response:** `auth:success` or `auth:error`
- **Status:** OK

### auth:register
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2214`
- **Server Location:** `/server/socket.js:57`, `/server/handlers/auth.js:49`
- **Payload:**
  ```javascript
  { username: string, password: string }
  ```
- **Response:** `auth:success` or `auth:error`
- **Status:** OK

### auth:token
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2206`
- **Server Location:** `/server/socket.js:79`, `/server/handlers/auth.js:72`
- **Payload:**
  ```javascript
  { token: string }
  ```
- **Response:** `auth:success` or `auth:error`
- **Status:** OK

### auth:logout
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2220`
- **Server Location:** `/server/socket.js:94`, `/server/handlers/auth.js:88`
- **Payload:** None
- **Status:** OK

### auth:success
- **Direction:** S→C
- **Server Location:** `/server/handlers/auth.js:42`
- **Client Location:** `/client/js/network/auth.js:8`
- **Payload:**
  ```javascript
  {
    token: string,
    player: {
      id: number,
      username: string,
      position_x: number,
      position_y: number,
      // ... full player data
    }
  }
  ```
- **Status:** OK

### auth:error
- **Direction:** S→C
- **Server Location:** `/server/handlers/auth.js:28`
- **Client Location:** `/client/js/network/auth.js:15`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

---

## Player Events

### player:input
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2226`
- **Server Location:** `/server/socket.js:102`, `/server/handlers/player.js:20`
- **Payload:**
  ```javascript
  {
    x: number,      // Current X position
    y: number,      // Current Y position
    vx: number,     // X velocity
    vy: number,     // Y velocity
    rotation: number // Rotation in radians
  }
  ```
- **Validation:** Velocity sanity check (max speed)
- **Status:** OK

### player:update
- **Direction:** S→C (broadcast to nearby players)
- **Server Location:** `/server/socket.js:140`
- **Client Location:** `/client/js/network/player.js:8`
- **Payload:**
  ```javascript
  {
    id: number,
    username: string,
    x: number,
    y: number,
    rotation: number,
    hull: number,
    shield: number,
    status: string,
    colorId: number
  }
  ```
- **Status:** OK

### player:leave
- **Direction:** S→C (broadcast to nearby players)
- **Server Location:** `/server/socket.js:1510`
- **Client Location:** `/client/js/network/player.js:12`
- **Payload:**
  ```javascript
  playerId: number
  ```
- **Status:** OK

### player:colorChanged
- **Direction:** S→C (broadcast to nearby players)
- **Server Location:** `/server/socket.js:848`
- **Client Location:** `/client/js/network/player.js:16`
- **Payload:**
  ```javascript
  { playerId: number, colorId: number }
  ```
- **Status:** OK

### player:profileChanged
- **Direction:** S→C (broadcast to nearby players)
- **Server Location:** `/server/socket.js:884`
- **Client Location:** `/client/js/network/player.js` (implied)
- **Payload:**
  ```javascript
  { playerId: number, profileId: number }
  ```
- **Status:** OK

### player:damaged
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:985`
- **Client Location:** `/client/js/network/player.js:23`
- **Payload:**
  ```javascript
  {
    attackerId: string,
    attackerType: string,
    damage: number,
    hull: number,
    shield: number
  }
  ```
- **Status:** OK

### player:death
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:183`
- **Client Location:** `/client/js/network/player.js:35`
- **Payload:**
  ```javascript
  {
    killedBy: string,
    cause: string,
    killerType: string,
    killerName: string,
    deathPosition: { x: number, y: number },
    droppedCargo: array,
    wreckageSpawned: boolean,
    respawnOptions: array
  }
  ```
- **Status:** OK

### player:respawn
- **Direction:** S→C
- **Server Location:** `/server/socket.js:195`
- **Client Location:** `/client/js/network/player.js:80`
- **Payload:**
  ```javascript
  {
    position: { x: number, y: number },
    hull: number,
    shield: number,
    locationName: string
  }
  ```
- **Status:** OK

### player:debuff
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1044`
- **Client Location:** `/client/js/network/player.js:99`
- **Payload:**
  ```javascript
  {
    type: string,           // 'slow', 'dot', etc.
    duration: number,       // ms
    slowPercent: number,    // For slow debuffs
    dotType: string,        // For DoT debuffs
    source: string
  }
  ```
- **Status:** OK

### player:dot
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:316`
- **Client Location:** `/client/js/network/player.js:127`
- **Payload:**
  ```javascript
  {
    damage: number,
    hull: number,
    shield: number,
    type: string
  }
  ```
- **Status:** OK

### respawn:select
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2346`
- **Server Location:** `/server/socket.js:154`
- **Payload:**
  ```javascript
  { type: string, targetId: string }
  ```
- **Note:** Naming inconsistency - uses `respawn:` instead of `player:`
- **Status:** OK (functional)

---

## Combat Events

### combat:fire
- **Direction:** Bidirectional
- **Client Location (emit):** `/client/js/network.js:2231`
- **Server Location (handler):** `/server/socket.js:202`
- **Server Location (broadcast):** `/server/socket.js:250`
- **Client Location (handler):** `/client/js/network/combat.js:40`
- **Payload (C→S):**
  ```javascript
  { direction: number }  // radians
  ```
- **Payload (S→C broadcast):**
  ```javascript
  {
    playerId: number,
    x: number,
    y: number,
    rotation: number,
    direction: number,
    weaponTier: number
  }
  ```
- **Status:** OK

### combat:event
- **Direction:** S→C
- **Server Location:** Unknown (not found in codebase)
- **Client Location:** `/client/js/network/combat.js:8-10`
- **Payload:** Unknown
- **Status:** **PLACEHOLDER** - Empty handler, likely unused

### combat:hit
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:970`
- **Client Location:** `/client/js/network/combat.js:12`
- **Payload:**
  ```javascript
  {
    attackerId: string,
    attackerType: string,
    targetX: number,
    targetY: number,
    hitShield: boolean,
    damage: number,
    weaponType: string,
    shieldPierced: boolean,
    piercingDamage: number
  }
  ```
- **Status:** OK

### combat:playerHit
- **Direction:** S→C
- **Server Location:** (inferred from client)
- **Client Location:** `/client/js/network/combat.js:33`
- **Payload:**
  ```javascript
  { targetX: number, targetY: number, hitShield: boolean }
  ```
- **Status:** OK

### combat:npcFire
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:870, 906, 940`
- **Client Location:** `/client/js/network/combat.js:72`
- **Payload:**
  ```javascript
  {
    npcId: string,
    npcType: string,
    faction: string,
    weaponType: string,
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    rotation: number,
    hitInfo: object|null
  }
  ```
- **Status:** OK

### combat:npcHit
- **Direction:** S→C
- **Server Location:** `/server/socket.js:380`, `/server/game/engine.js:1882`
- **Client Location:** `/client/js/network/combat.js:107`
- **Payload:**
  ```javascript
  {
    npcId: string,
    damage: number,
    destroyed: boolean,
    hitShield: boolean
  }
  ```
- **Status:** OK

### combat:chainLightning
- **Direction:** S→C
- **Server Location:** `/server/socket.js:400`
- **Client Location:** `/client/js/network/combat.js:137`
- **Payload:**
  ```javascript
  {
    playerId: number,
    sourceNpcId: string,
    sourceX: number,
    sourceY: number,
    chains: [{
      targetId: string,
      targetX: number,
      targetY: number,
      damage: number,
      destroyed: boolean
    }]
  }
  ```
- **Status:** OK

### combat:teslaCoil
- **Direction:** S→C
- **Server Location:** `/server/socket.js:420`
- **Client Location:** `/client/js/network/combat.js:151`
- **Payload:**
  ```javascript
  { baseId: string, x: number, y: number, chains: array }
  ```
- **Status:** OK

### star:damage
- **Direction:** S→C
- **Server Location:** `/server/game/star-damage.js`
- **Client Location:** `/client/js/network/combat.js:159`
- **Payload:**
  ```javascript
  { hull: number, shield: number }
  ```
- **Status:** OK

### star:zone
- **Direction:** S→C
- **Server Location:** `/server/game/star-damage.js`
- **Client Location:** `/client/js/network/combat.js:166`
- **Payload:**
  ```javascript
  { zone: string }
  ```
- **Status:** OK

---

## Mining Events

### mining:start
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2236`
- **Server Location:** `/server/socket.js:458`, `/server/handlers/mining.js:13`
- **Payload:**
  ```javascript
  { objectId: string }
  ```
- **Status:** OK

### mining:cancel
- **Direction:** C→S
- **Client Location:** `/client/js/player.js` (via input)
- **Server Location:** `/server/socket.js:543`, `/server/handlers/mining.js:114`
- **Payload:** None
- **Status:** OK

### mining:started
- **Direction:** S→C
- **Server Location:** `/server/handlers/mining.js:48`
- **Client Location:** `/client/js/network/mining.js:8`
- **Payload:**
  ```javascript
  { objectId: string, miningTime: number, miningTier: number }
  ```
- **Status:** OK

### mining:complete
- **Direction:** S→C
- **Server Location:** `/server/handlers/mining.js:78`
- **Client Location:** `/client/js/network/mining.js:19`
- **Payload:**
  ```javascript
  {
    resourceType: string,
    resourceName: string,
    quantity: number
  }
  ```
- **Status:** OK

### mining:cancelled
- **Direction:** S→C
- **Server Location:** `/server/handlers/mining.js:90`
- **Client Location:** `/client/js/network/mining.js:36`
- **Payload:**
  ```javascript
  { reason: string }
  ```
- **Status:** OK

### mining:error
- **Direction:** S→C
- **Server Location:** `/server/handlers/mining.js:25`
- **Client Location:** `/client/js/network/mining.js:47`
- **Payload:**
  ```javascript
  { message: string, objectId: string }
  ```
- **Status:** OK

### mining:playerStarted
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/mining.js:55`
- **Client Location:** `/client/js/network/mining.js:52`
- **Payload:**
  ```javascript
  {
    playerId: number,
    targetX: number,
    targetY: number,
    resourceType: string,
    miningTier: number
  }
  ```
- **Status:** OK

### mining:playerStopped
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/mining.js:100`
- **Client Location:** `/client/js/network/mining.js:61`
- **Payload:**
  ```javascript
  { playerId: number }
  ```
- **Status:** OK

---

## Marketplace Events

### market:list
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2246`
- **Server Location:** `/server/socket.js:580`, `/server/handlers/marketplace.js:24`
- **Payload:**
  ```javascript
  { resourceType: string, quantity: number, price: number }
  ```
- **Status:** OK

### market:buy
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2251`
- **Server Location:** `/server/socket.js:606`, `/server/handlers/marketplace.js:58`
- **Payload:**
  ```javascript
  { listingId: number, quantity: number }
  ```
- **Status:** OK

### market:cancel
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2256`
- **Server Location:** `/server/socket.js:653`, `/server/handlers/marketplace.js:114`
- **Payload:**
  ```javascript
  { listingId: number }
  ```
- **Status:** OK

### market:getListings
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2261`
- **Server Location:** `/server/socket.js:673`, `/server/handlers/marketplace.js:141`
- **Payload:**
  ```javascript
  { resourceType: string }  // optional filter
  ```
- **Status:** OK

### market:getMyListings
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2266`
- **Server Location:** `/server/socket.js:684`, `/server/handlers/marketplace.js:153`
- **Payload:** None
- **Status:** OK

### market:listed
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:42`
- **Client Location:** `/client/js/network/marketplace.js:43`
- **Payload:**
  ```javascript
  { listingId: number }
  ```
- **Status:** OK

### market:bought
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:90`
- **Client Location:** `/client/js/network/marketplace.js:51`
- **Payload:**
  ```javascript
  { cost: number }
  ```
- **Status:** OK

### market:sold
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:100`
- **Client Location:** `/client/js/network/marketplace.js:73`
- **Payload:**
  ```javascript
  {
    resourceType: string,
    resourceName: string,
    quantity: number,
    totalCredits: number,
    buyerName: string
  }
  ```
- **Status:** OK

### market:cancelled
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:130`
- **Client Location:** `/client/js/network/marketplace.js:59`
- **Payload:** `{}`
- **Status:** OK

### market:listings
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:145`
- **Client Location:** `/client/js/network/marketplace.js:17`
- **Payload:**
  ```javascript
  { listings: array }
  ```
- **Status:** OK

### market:myListings
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:157`
- **Client Location:** `/client/js/network/marketplace.js:30`
- **Payload:**
  ```javascript
  { listings: array }
  ```
- **Status:** OK

### market:update
- **Direction:** S→C (broadcast to all)
- **Server Location:** `/server/handlers/marketplace.js:50`
- **Client Location:** `/client/js/network/marketplace.js:8`
- **Payload:**
  ```javascript
  { action: string }  // 'new_listing', 'purchase', 'cancelled'
  ```
- **Status:** OK

### market:error
- **Direction:** S→C
- **Server Location:** `/server/handlers/marketplace.js:35`
- **Client Location:** `/client/js/network/marketplace.js:67`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

---

## Ship Events

### ship:upgrade
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2271`, `/client/js/ui/panels/ShipUpgradePanel.js:270`
- **Server Location:** `/server/socket.js:692`, `/server/handlers/ship.js:21`
- **Payload:**
  ```javascript
  { component: string }  // engine, weapon, shield, mining, cargo, radar, energy_core, hull
  ```
- **Status:** OK

### ship:getData
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2313`
- **Server Location:** `/server/socket.js:795`, `/server/handlers/ship.js:124`
- **Payload:** None
- **Status:** OK

### ship:data
- **Direction:** S→C
- **Server Location:** `/server/handlers/ship.js:135`
- **Client Location:** `/client/js/network/ship.js` (implied)
- **Payload:**
  ```javascript
  {
    engine_tier: number,
    weapon_type: string,
    weapon_tier: number,
    shield_tier: number,
    mining_tier: number,
    cargo_tier: number,
    radar_tier: number,
    energy_core_tier: number,
    hull_tier: number,
    credits: number,
    ship_color_id: number,
    profile_id: number
  }
  ```
- **Status:** OK

### ship:setColor
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2308`
- **Server Location:** `/server/socket.js:818`, `/server/handlers/ship.js:147`
- **Payload:**
  ```javascript
  { colorId: number }
  ```
- **Status:** OK

### ship:colorChanged
- **Direction:** S→C
- **Server Location:** `/server/handlers/ship.js:165`
- **Client Location:** `/client/js/network/ship.js:9`
- **Payload:**
  ```javascript
  { colorId: number }
  ```
- **Status:** OK

### ship:colorError
- **Direction:** S→C
- **Server Location:** `/server/handlers/ship.js:155`
- **Client Location:** `/client/js/network/ship.js:17`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

### ship:setProfile
- **Direction:** C→S
- **Client Location:** `/client/js/ui/profile-modal.js`
- **Server Location:** `/server/socket.js:855`
- **Payload:**
  ```javascript
  { profileId: number }
  ```
- **Status:** OK

### ship:profileChanged
- **Direction:** S→C
- **Server Location:** `/server/socket.js:880`
- **Client Location:** `/client/js/network/ship.js:25`
- **Payload:**
  ```javascript
  { profileId: number }
  ```
- **Status:** OK

### ship:profileError
- **Direction:** S→C
- **Server Location:** `/server/socket.js:870`
- **Client Location:** `/client/js/network/ship.js:33`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

### upgrade:success
- **Direction:** S→C
- **Server Location:** `/server/handlers/ship.js:85`
- **Client Location:** `/client/js/network/ship.js:41`
- **Payload:**
  ```javascript
  {
    component: string,
    newTier: number,
    credits: number,
    shieldMax: number,
    hullMax: number
  }
  ```
- **Note:** Naming inconsistency - uses `upgrade:` instead of `ship:`
- **Status:** OK (functional)

### upgrade:error
- **Direction:** S→C
- **Server Location:** `/server/handlers/ship.js:45`
- **Client Location:** `/client/js/network/ship.js:102`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Note:** Naming inconsistency - uses `upgrade:` instead of `ship:`
- **Status:** OK (functional)

---

## Loot/Wreckage Events

### loot:startCollect
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2286`
- **Server Location:** `/server/socket.js:912`, `/server/handlers/loot.js:22`
- **Payload:**
  ```javascript
  { wreckageId: string }
  ```
- **Status:** OK

### loot:cancelCollect
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2291`
- **Server Location:** `/server/socket.js:1053`, `/server/handlers/loot.js:183`
- **Payload:**
  ```javascript
  { wreckageId: string }
  ```
- **Status:** OK

### loot:getNearby
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2302`
- **Server Location:** `/server/socket.js:1068`, `/server/handlers/loot.js:204`
- **Payload:** None
- **Status:** OK

### wreckage:multiCollect
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2297`
- **Server Location:** `/server/socket.js:1092`, `/server/handlers/loot.js:228`
- **Payload:** None
- **Note:** Scrap Siphon relic ability
- **Status:** OK

### loot:started
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:65`
- **Client Location:** `/client/js/network/loot.js:30`
- **Payload:**
  ```javascript
  { wreckageId: string, totalTime: number }
  ```
- **Status:** OK

### loot:progress
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:78`
- **Client Location:** `/client/js/network/loot.js:34`
- **Payload:**
  ```javascript
  { wreckageId: string, progress: number }
  ```
- **Status:** OK

### loot:complete
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:95`
- **Client Location:** `/client/js/network/loot.js:38`
- **Payload:**
  ```javascript
  {
    wreckageId: string,
    contents: array,
    results: object,
    teamCredits: number
  }
  ```
- **Status:** OK

### loot:cancelled
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:175`
- **Client Location:** `/client/js/network/loot.js:44`
- **Payload:**
  ```javascript
  { reason: string }
  ```
- **Status:** OK

### loot:error
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:35`
- **Client Location:** `/client/js/network/loot.js:48`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

### loot:nearby
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:218`
- **Client Location:** `/client/js/network/loot.js` (implied)
- **Payload:**
  ```javascript
  {
    wreckage: [{
      id: string,
      x: number,
      y: number,
      faction: string,
      npcName: string,
      contentCount: number,
      distance: number,
      despawnTime: number
    }]
  }
  ```
- **Status:** OK

### loot:multiStarted
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:280`
- **Client Location:** `/client/js/network/loot.js:63`
- **Payload:**
  ```javascript
  { wreckageIds: array, totalTime: number }
  ```
- **Status:** OK

### loot:multiComplete
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:320`
- **Client Location:** `/client/js/network/loot.js:77`
- **Payload:**
  ```javascript
  { wreckageIds: array, contents: array, results: object, teamCredits: number }
  ```
- **Status:** OK

### loot:playerCollecting
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/loot.js:70`
- **Client Location:** `/client/js/network/loot.js` (implied)
- **Payload:**
  ```javascript
  { playerId: number, wreckageId: string, x: number, y: number }
  ```
- **Status:** OK

### loot:playerStopped
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/loot.js:170`
- **Client Location:** `/client/js/network/loot.js` (implied)
- **Payload:**
  ```javascript
  { playerId: number }
  ```
- **Status:** OK

### wreckage:spawn
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/game/engine.js:167, 1776, 2028`
- **Client Location:** `/client/js/network/loot.js:9`
- **Payload:**
  ```javascript
  {
    id: string,
    x: number,
    y: number,
    faction: string,
    npcName: string,
    contentCount: number,
    despawnTime: number
  }
  ```
- **Status:** OK

### wreckage:despawn
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/game/engine.js:1487`
- **Client Location:** `/client/js/network/loot.js:21`
- **Payload:**
  ```javascript
  { id: string }
  ```
- **Status:** OK

### wreckage:collected
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/loot.js:130`
- **Client Location:** `/client/js/network/loot.js:25`
- **Payload:**
  ```javascript
  { wreckageId: string, collectedBy: number }
  ```
- **Status:** OK

---

## Wormhole Events

### wormhole:enter
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2319`
- **Server Location:** `/server/socket.js:1240`, `/server/handlers/wormhole.js:11`
- **Payload:**
  ```javascript
  { wormholeId: string }
  ```
- **Status:** OK

### wormhole:selectDestination
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2324`
- **Server Location:** `/server/socket.js:1277`, `/server/handlers/wormhole.js:56`
- **Payload:**
  ```javascript
  { destinationId: string }
  ```
- **Status:** OK

### wormhole:cancel
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2329`
- **Server Location:** `/server/socket.js:1341`, `/server/handlers/wormhole.js:128`
- **Payload:** None
- **Status:** OK

### wormhole:getProgress
- **Direction:** C→S
- **Client Location:** (implied)
- **Server Location:** `/server/socket.js:1361`, `/server/handlers/wormhole.js:149`
- **Payload:** None
- **Status:** OK

### wormhole:getNearestPosition
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2334`
- **Server Location:** `/server/socket.js:1369`, `/server/handlers/wormhole.js:158`
- **Payload:** None
- **Status:** OK

### wormhole:entered
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:35`
- **Client Location:** `/client/js/network/wormhole.js:8`
- **Payload:**
  ```javascript
  { wormholeId: string, destinations: array }
  ```
- **Status:** OK

### wormhole:transitStarted
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:80`
- **Client Location:** `/client/js/network/wormhole.js:12`
- **Payload:**
  ```javascript
  { destinationId: string, destination: { x: number, y: number }, duration: number }
  ```
- **Status:** OK

### wormhole:progress
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:100`
- **Client Location:** `/client/js/network/wormhole.js:16`
- **Payload:**
  ```javascript
  { progress: number }
  ```
- **Status:** OK (Previously documented as wormhole:transitProgress - fixed to match server emit)

### wormhole:exitComplete
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:115`
- **Client Location:** `/client/js/network/wormhole.js:20`
- **Payload:**
  ```javascript
  { position: { x: number, y: number }, wormholeId: string }
  ```
- **Status:** OK

### wormhole:cancelled
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:140`
- **Client Location:** `/client/js/network/wormhole.js:24`
- **Payload:**
  ```javascript
  { reason: string }
  ```
- **Status:** OK

### wormhole:progress
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:152`
- **Client Location:** (same as transitProgress)
- **Payload:** Progress object
- **Status:** OK

### wormhole:nearestPosition
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:175`
- **Client Location:** `/client/js/network/wormhole.js:33`
- **Payload:**
  ```javascript
  { x: number, y: number } | null
  ```
- **Status:** OK

### wormhole:error
- **Direction:** S→C
- **Server Location:** `/server/handlers/wormhole.js:25`
- **Client Location:** `/client/js/network/wormhole.js:28`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

### wormhole:playerEntered
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/wormhole.js:40`
- **Client Location:** (visual only)
- **Payload:**
  ```javascript
  { playerId: number, wormholeId: string }
  ```
- **Status:** OK

### wormhole:playerTransiting
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/wormhole.js:85`
- **Client Location:** (visual only)
- **Payload:**
  ```javascript
  { playerId: number, destinationId: string }
  ```
- **Status:** OK

### wormhole:playerExited
- **Direction:** S→C (broadcast to new location players)
- **Server Location:** `/server/handlers/wormhole.js:120`
- **Client Location:** (visual only)
- **Payload:**
  ```javascript
  { playerId: number, x: number, y: number }
  ```
- **Status:** OK

### wormhole:playerCancelled
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/handlers/wormhole.js:145`
- **Client Location:** (visual only)
- **Payload:**
  ```javascript
  { playerId: number }
  ```
- **Status:** OK

---

## NPC Events

### npc:spawn
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/game/engine.js:404, 548`
- **Client Location:** `/client/js/network/npc.js:9`
- **Payload:**
  ```javascript
  {
    id: string,
    type: string,
    name: string,
    faction: string,
    x: number,
    y: number,
    rotation: number,
    hull: number,
    hullMax: number,
    shield: number,
    shieldMax: number
  }
  ```
- **Status:** OK

### npc:update
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/game/engine.js:847`
- **Client Location:** `/client/js/network/npc.js:25`
- **Payload:**
  ```javascript
  {
    id: string,
    x: number,
    y: number,
    rotation: number,
    hull: number,
    shield: number,
    status: string,
    miningTargetPos: { x: number, y: number } | null  // For rogue miners
  }
  ```
- **Status:** OK

### npc:action
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1297, 1316, 1363, 1376`
- **Client Location:** `/client/js/network/npc.js:47`
- **Payload:**
  ```javascript
  { npcId: string, action: string, targetPos: { x: number, y: number } }
  ```
- **Actions:** `startMining`, `miningComplete`
- **Status:** OK

### npc:destroyed
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/game/engine.js:1794`
- **Client Location:** `/client/js/network/npc.js:69`
- **Payload:**
  ```javascript
  {
    id: string,
    destroyedBy: string,
    participants: array,
    teamMultiplier: number,
    creditsPerPlayer: number,
    faction: string,
    deathEffect: string,
    wreckageId: string
  }
  ```
- **Status:** OK

### npc:queenSpawn
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:773`
- **Client Location:** `/client/js/network/npc.js:114`
- **Payload:**
  ```javascript
  { queenX: number, queenY: number, spawned: array }
  ```
- **Status:** OK

### npc:invulnerable
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1717`
- **Client Location:** `/client/js/network.js:1717`
- **Payload:**
  ```javascript
  { npcId: string, x: number, y: number }
  ```
- **Status:** OK

### npc:death
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1125`
- **Client Location:** (cleanup/despawn)
- **Payload:**
  ```javascript
  { id: string }
  ```
- **Status:** OK

---

## Base Events

### bases:nearby
- **Direction:** S→C (broadcast every 500ms)
- **Server Location:** `/server/game/engine.js:1653`
- **Client Location:** `/client/js/network/npc.js:831`
- **Payload:**
  ```javascript
  [{ id: string, type: string, faction: string, x: number, y: number, health: number, maxHealth: number, ... }]
  ```
- **Status:** OK

### base:damaged
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:2049`
- **Client Location:** `/client/js/network/npc.js:741`
- **Payload:**
  ```javascript
  {
    baseId: string,
    health: number,
    maxHealth: number,
    x: number,
    y: number,
    size: number,
    faction: string,
    damage: number
  }
  ```
- **Status:** OK

### base:destroyed
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:2008`
- **Client Location:** `/client/js/network/npc.js:767`
- **Payload:**
  ```javascript
  {
    id: string,
    destroyedBy: string,
    participants: array,
    faction: string,
    respawnTime: number,
    wreckageId: string,
    x: number,
    y: number,
    baseType: string,
    size: number,
    destroyedDrones: array
  }
  ```
- **Status:** OK

### base:respawn
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:499`
- **Client Location:** `/client/js/network/npc.js:823`
- **Payload:** Base entity data
- **Status:** OK

### base:reward
- **Direction:** S→C
- **Server Location:** `/server/socket.js:435`
- **Client Location:** `/client/js/network/npc.js:837`
- **Payload:**
  ```javascript
  {
    credits: number,
    teamMultiplier: number,
    participantCount: number,
    baseName: string,
    faction: string
  }
  ```
- **Status:** OK

### base:plundered
- **Direction:** S→C (broadcast)
- **Server Location:** `/server/socket.js:1490`
- **Client Location:** `/client/js/network.js` (visual effect)
- **Payload:**
  ```javascript
  { baseId: string, position: { x: number, y: number } }
  ```
- **Status:** OK

---

## Swarm Faction Events

### swarm:linkedDamage
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1910`
- **Client Location:** `/client/js/network/npc.js:165`
- **Payload:** Linked damage cascade data
- **Status:** OK

### swarm:droneSacrifice
- **Direction:** S→C
- **Server Location:** `/server/socket.js` (broadcast)
- **Client Location:** `/client/js/network/npc.js:172`
- **Payload:**
  ```javascript
  { position: { x: number, y: number } }
  ```
- **Status:** OK

### swarm:assimilationProgress
- **Direction:** S→C
- **Server Location:** `/server/socket.js` (broadcast)
- **Client Location:** `/client/js/network/npc.js:213`
- **Payload:**
  ```javascript
  { baseId: string, progress: number, threshold: number, position: { x: number, y: number } }
  ```
- **Status:** OK

### swarm:baseAssimilated
- **Direction:** S→C
- **Server Location:** `/server/socket.js` (broadcast)
- **Client Location:** `/client/js/network/npc.js:247`
- **Payload:**
  ```javascript
  {
    baseId: string,
    newType: string,
    position: { x: number, y: number },
    consumedDroneIds: array
  }
  ```
- **Status:** OK

### swarm:queenSpawn
- **Direction:** S→C
- **Server Location:** `/server/socket.js` (broadcast)
- **Client Location:** `/client/js/network/npc.js:314`
- **Payload:**
  ```javascript
  { x: number, y: number }
  ```
- **Status:** OK

### swarm:queenDeath
- **Direction:** S→C
- **Server Location:** (broadcast)
- **Client Location:** `/client/js/network/npc.js:368`
- **Payload:**
  ```javascript
  { x: number, y: number }
  ```
- **Status:** OK

### swarm:queenAura
- **Direction:** S→C
- **Server Location:** `/server/socket.js` (broadcast)
- **Client Location:** `/client/js/network/npc.js:382`
- **Payload:**
  ```javascript
  { affectedBases: array }
  ```
- **Status:** OK

### swarm:queenDeathRage
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1867`
- **Client Location:** Needs verification
- **Payload:** Queen death rage data
- **Status:** Needs verification

---

## Queen Events

### queen:webSnare
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1012`
- **Client Location:** `/client/js/network/npc.js:408`
- **Payload:**
  ```javascript
  {
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    radius: number,
    duration: number,
    projectileSpeed: number
  }
  ```
- **Status:** OK

### queen:acidBurst
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1059`
- **Client Location:** `/client/js/network/npc.js:478`
- **Payload:**
  ```javascript
  {
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    radius: number,
    dotDuration: number,
    projectileSpeed: number
  }
  ```
- **Status:** OK

### queen:phaseChange
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:802`
- **Client Location:** `/client/js/network/npc.js:558`
- **Payload:**
  ```javascript
  { phase: string, x: number, y: number }  // HUNT, SIEGE, SWARM, DESPERATION
  ```
- **Status:** OK

---

## Pirate Faction Events

### pirate:intel
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1385`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { scoutPos: { x: number, y: number }, alertedPirateCount: number }
  ```
- **Status:** OK

### pirate:boostDive
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1398`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { npcId: string, startX: number, startY: number, targetX: number, targetY: number, duration: number }
  ```
- **Status:** OK

### pirate:stealSuccess
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1412`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { position: { x: number, y: number }, targetType: string, stolenAmount: number }
  ```
- **Status:** OK

### pirate:dreadnoughtEnraged
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1426`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { npcId: string, x: number, y: number }
  ```
- **Status:** OK

### pirate:captainHeal
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1438`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { x: number, y: number }
  ```
- **Status:** OK

---

## Scavenger Faction Events

### scavenger:rage
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1174, 1893`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { npcId: string, targetId: string, x: number, y: number }
  ```
- **Status:** OK

### scavenger:rageClear
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1167`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { npcId: string }
  ```
- **Status:** OK

### scavenger:haulerSpawn
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:443`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  {
    haulerId: string,
    type: string,
    name: string,
    faction: string,
    x: number,
    y: number,
    rotation: number,
    hull: number,
    hullMax: number,
    size: number,
    sizeMultiplier: number
  }
  ```
- **Status:** OK

### scavenger:haulerGrow
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1158`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { npcId: string, sizeMultiplier: number }
  ```
- **Status:** OK

### scavenger:barnacleKingSpawn
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1245`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { x: number, y: number, kingId: string, haulerId: string, name: string, hull: number, hullMax: number, rotation: number }
  ```
- **Status:** OK

### scavenger:haulerTransform
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1279`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { x: number, y: number }
  ```
- **Status:** OK

### scavenger:scrapPileUpdate
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1269`
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { baseId: string, scrapPile: number }
  ```
- **Status:** OK

### scavenger:drillCharge
- **Direction:** S→C
- **Server Location:** (from AI)
- **Client Location:** `/client/js/network.js`
- **Payload:**
  ```javascript
  { kingX: number, kingY: number, targetId: string }
  ```
- **Status:** OK

---

## Rogue Miner Events

### rogueMiner:foremanSpawn
- **Direction:** S→C (5000 unit radius)
- **Server Location:** `/server/game/engine.js:1350`
- **Client Location:** `/client/js/network/npc.js:655`
- **Payload:**
  ```javascript
  { x: number, y: number }
  ```
- **Status:** OK

---

## Void Faction Events

### formation:leaderChange
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1812`
- **Client Location:** `/client/js/network/npc.js:636`
- **Payload:**
  ```javascript
  { newLeaderId: string }
  ```
- **Status:** OK

---

## Hazard Events

### comet:warning
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1557`
- **Client Location:** `/client/js/network/npc.js:856`
- **Payload:**
  ```javascript
  {
    cometId: string,
    x: number,
    y: number,
    angle: number,
    size: number
  }
  ```
- **Handler:** Plays warning sound, shows notification, spawns warning particles
- **Status:** OK

### comet:collision
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js:1597`
- **Client Location:** `/client/js/network/npc.js:885`
- **Payload:**
  ```javascript
  {
    cometId: string,
    damage: number,
    hull: number,
    shield: number,
    knockbackX: number,
    knockbackY: number
  }
  ```
- **Handler:** Updates player health, applies knockback, plays collision sound, shows damage notification, triggers screen shake
- **Status:** OK

---

## Team Events

### team:creditReward
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:145`
- **Client Location:** `/client/js/network/loot.js:96`
- **Payload:**
  ```javascript
  { credits: number, totalTeamCredits: number, participantCount: number }
  ```
- **Status:** OK

### team:lootShare
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:160`
- **Client Location:** `/client/js/network/loot.js:116`
- **Payload:**
  ```javascript
  {
    resources: array,
    rareDropNotification: string|null,
    collectorId: number
  }
  ```
- **Status:** OK

---

## Buff/Relic Events

### buff:applied
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:120`
- **Client Location:** `/client/js/network/loot.js:138`
- **Payload:**
  ```javascript
  { buffType: string, duration: number, expiresAt: number }
  ```
- **Status:** OK

### buff:expired
- **Direction:** S→C
- **Server Location:** `/server/game/engine.js`
- **Client Location:** `/client/js/network/loot.js:151`
- **Payload:**
  ```javascript
  { buffType: string }
  ```
- **Status:** OK

### relic:collected
- **Direction:** S→C
- **Server Location:** `/server/handlers/loot.js:110`
- **Client Location:** `/client/js/network/loot.js:156`
- **Payload:**
  ```javascript
  { relicType: string }
  ```
- **Status:** OK

### relic:plunder
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2340`
- **Server Location:** `/server/socket.js:1395`
- **Payload:**
  ```javascript
  { baseId: string }
  ```
- **Status:** OK

### relic:plunderSuccess
- **Direction:** S→C
- **Server Location:** `/server/socket.js:1480`
- **Client Location:** `/client/js/network.js:2149`
- **Payload:**
  ```javascript
  { credits: number, loot: array, position: { x: number, y: number } }
  ```
- **Status:** OK

### relic:plunderFailed
- **Direction:** S→C
- **Server Location:** `/server/socket.js:1445`
- **Client Location:** `/client/js/network.js:2188`
- **Payload:**
  ```javascript
  { reason: string }
  ```
- **Status:** OK

---

## Misc Events

### world:update
- **Direction:** S→C
- **Server Location:** `/server/handlers/mining.js:85`
- **Client Location:** `/client/js/network/mining.js:65`
- **Payload:**
  ```javascript
  { depleted: boolean, objectId: string }
  ```
- **Status:** OK

### inventory:update
- **Direction:** S→C
- **Server Location:** Various (mining, loot, market, upgrade)
- **Client Location:** `/client/js/network/mining.js:69`
- **Payload:**
  ```javascript
  { inventory: object, credits: number }
  ```
- **Status:** OK

### error:generic
- **Direction:** S→C
- **Server Location:** `/server/socket.js:450`
- **Client Location:** `/client/js/network/ship.js:115`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Status:** OK

### chat:send
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2241`
- **Server Location:** `/server/socket.js:549`
- **Payload:**
  ```javascript
  { message: string }
  ```
- **Rate Limit:** Per-player (CHAT_RATE_LIMIT)
- **Status:** OK

### chat:message
- **Direction:** S→C (broadcast to all)
- **Server Location:** `/server/socket.js:575`
- **Client Location:** `/client/js/network/chat.js:8`
- **Payload:**
  ```javascript
  { username: string, message: string, timestamp: number }
  ```
- **Status:** OK

### emote:send
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2280`
- **Server Location:** `/server/socket.js:892`
- **Payload:**
  ```javascript
  { emoteType: string }  // wave, help, trade, danger
  ```
- **Status:** OK

### emote:broadcast
- **Direction:** S→C (broadcast to nearby)
- **Server Location:** `/server/socket.js:905`
- **Client Location:** `/client/js/network/chat.js:18`
- **Payload:**
  ```javascript
  { playerId: number, playerName: string, emoteType: string, x: number, y: number }
  ```
- **Status:** OK

### ping
- **Direction:** C→S
- **Client Location:** `/client/js/network.js:2275`
- **Server Location:** `/server/socket.js:1501`
- **Payload:** `timestamp: number`
- **Status:** OK

### pong
- **Direction:** S→C
- **Server Location:** `/server/socket.js:1503`
- **Client Location:** `/client/js/network/chat.js:28`
- **Payload:** `timestamp: number`
- **Status:** OK

---

## Appendix: Event Handler Modules

### Server Handlers (`/server/handlers/`)
| Module | Events Handled |
|--------|----------------|
| auth.js | auth:login, auth:register, auth:token, auth:logout |
| player.js | player:input, ping |
| combat.js | combat:fire |
| mining.js | mining:start, mining:cancel |
| marketplace.js | market:list, market:buy, market:cancel, market:getListings, market:getMyListings |
| ship.js | ship:upgrade, ship:getData, ship:setColor |
| loot.js | loot:startCollect, loot:cancelCollect, loot:getNearby, wreckage:multiCollect |
| wormhole.js | wormhole:enter, wormhole:selectDestination, wormhole:cancel, wormhole:getProgress, wormhole:getNearestPosition |

### Client Handlers (`/client/js/network/`)
| Module | Events Handled |
|--------|----------------|
| auth.js | auth:success, auth:error |
| player.js | player:update, player:leave, player:colorChanged, player:damaged, player:death, player:respawn, player:debuff, player:dot, respawn:error, player:health |
| combat.js | combat:hit, combat:fire, combat:npcFire, combat:npcHit, combat:chainLightning, combat:teslaCoil, star:damage, star:zone, combat:baseHit |
| mining.js | mining:started, mining:complete, mining:cancelled, mining:error, mining:playerStarted, mining:playerStopped, world:update, inventory:update |
| marketplace.js | market:update, market:listings, market:myListings, market:listed, market:bought, market:cancelled, market:error, market:sold |
| ship.js | ship:colorChanged, ship:colorError, ship:profileChanged, ship:profileError, upgrade:success, upgrade:error, error:generic, ship:data |
| loot.js | wreckage:spawn, wreckage:despawn, wreckage:collected, loot:started, loot:progress, loot:complete, loot:cancelled, loot:error, loot:multiStarted, loot:multiComplete, team:creditReward, team:lootShare, buff:applied, relic:collected, loot:nearby |
| wormhole.js | wormhole:entered, wormhole:transitStarted, wormhole:progress, wormhole:exitComplete, wormhole:cancelled, wormhole:error, wormhole:nearestPosition |
| chat.js | chat:message, emote:broadcast, pong |
| npc.js | npc:spawn, npc:update, npc:action, npc:destroyed, npc:queenSpawn, npc:death, swarm:*, swarm:queenDeathRage, queen:*, formation:*, base:*, rogueMiner:*, scavenger:* (partial), pirate:* (partial), comet:warning, comet:collision |

### Main Network File (`/client/js/network.js`)
Contains additional handlers for faction-specific events not in modular files:
- npc:invulnerable
- pirate:intel, pirate:boostDive, pirate:stealSuccess, pirate:dreadnoughtEnraged, pirate:captainHeal
- scavenger:rage, scavenger:rageClear, scavenger:haulerSpawn, scavenger:haulerGrow, scavenger:barnacleKingSpawn, scavenger:haulerTransform, scavenger:scrapPileUpdate, scavenger:drillCharge
- relic:plunderSuccess, relic:plunderFailed
