# Galaxy Miner - Socket.io Events API Reference

Complete documentation of all real-time Socket.io events used in Galaxy Miner for client-server communication.

## Table of Contents

- [Overview](#overview)
- [Authentication Events](#authentication-events)
- [Player Events](#player-events)
- [Combat Events](#combat-events)
- [Mining Events](#mining-events)
- [Marketplace Events](#marketplace-events)
- [Chat Events](#chat-events)
- [Ship Events](#ship-events)
- [Loot Events](#loot-events)
- [Wormhole Events](#wormhole-events)
- [NPC Events](#npc-events)
- [World Events](#world-events)
- [Emote Events](#emote-events)
- [Base Events](#base-events)
- [Swarm Events](#swarm-events)
- [Queen Events](#queen-events)
- [Team Events](#team-events)
- [Utility Events](#utility-events)
- [Event Flow Examples](#event-flow-examples)
- [Notes](#notes)

---

## Overview

Galaxy Miner uses Socket.io for real-time bidirectional communication between clients and server. Events follow a consistent naming pattern:

**Naming Convention:** `category:action`
- `auth:login` - Authentication category, login action
- `combat:fire` - Combat category, fire action
- `npc:update` - NPC category, update action

**Event Flow Patterns:**

1. **Request-Response**: Client sends request, server responds with success/error
   - Request: `mining:start` → Response: `mining:started` or `mining:error`

2. **Broadcast**: Server broadcasts state changes to nearby/all players
   - `player:update` - Position updates broadcast to nearby players
   - `chat:message` - Messages broadcast to all players

3. **Proximity-Based**: Events only sent to players within range
   - Range: 2× player radar range (base 500 units × tier multiplier)
   - Used for: player updates, combat, NPCs, mining visualization

**Server Architecture:**
- Game tick rate: 20 ticks/second
- Position saves: Every 5 seconds
- Base radar updates: Every 500ms

---

## Authentication Events

### `auth:login`

Player login with username and password.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Player username |
| `password` | string | Yes | Player password |

**Response:** `auth:success` or `auth:error`

**Example:**
```javascript
socket.emit('auth:login', {
  username: 'player123',
  password: 'securepassword'
});
```

**Rate Limiting:** IP-based rate limiting applies (see server config for limits)

**Related Events:** `auth:success`, `auth:error`

---

### `auth:register`

Register new player account.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Desired username (unique) |
| `password` | string | Yes | Account password |

**Response:** `auth:success` or `auth:error`

**Example:**
```javascript
socket.emit('auth:register', {
  username: 'newplayer',
  password: 'securepassword'
});
```

**Rate Limiting:** IP-based rate limiting applies

**Related Events:** `auth:success`, `auth:error`

---

### `auth:token`

Reconnect using saved session token.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Session authentication token |

**Response:** `auth:success` or `auth:error`

**Example:**
```javascript
const savedToken = localStorage.getItem('galaxy-miner-token');
socket.emit('auth:token', { token: savedToken });
```

**Related Events:** `auth:success`, `auth:error`

---

### `auth:logout`

Disconnect player session.

**Direction:** Client → Server

**Payload:** None

**Response:** None (socket disconnects)

**Example:**
```javascript
socket.emit('auth:logout');
```

**Related Events:** `disconnect`

---

### `auth:success`

Authentication successful response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Session token (save to localStorage) |
| `player` | object | Complete player data object |
| `player.id` | number | Player user ID |
| `player.username` | string | Player username |
| `player.position_x` | number | Current X coordinate |
| `player.position_y` | number | Current Y coordinate |
| `player.rotation` | number | Ship rotation (radians) |
| `player.velocity_x` | number | Velocity X component |
| `player.velocity_y` | number | Velocity Y component |
| `player.hull_hp` | number | Current hull HP |
| `player.hull_max` | number | Maximum hull HP |
| `player.shield_hp` | number | Current shield HP |
| `player.shield_max` | number | Maximum shield HP |
| `player.credits` | number | Player credits |
| `player.engine_tier` | number | Engine upgrade tier (1-5) |
| `player.weapon_tier` | number | Weapon upgrade tier (1-5) |
| `player.weapon_type` | string | Weapon type (kinetic/energy/explosive) |
| `player.shield_tier` | number | Shield upgrade tier (1-5) |
| `player.mining_tier` | number | Mining upgrade tier (1-5) |
| `player.cargo_tier` | number | Cargo upgrade tier (1-5) |
| `player.radar_tier` | number | Radar upgrade tier (1-5) |
| `player.energy_core_tier` | number | Energy core tier (1-5) |
| `player.hull_tier` | number | Hull tier (1-5) |
| `player.ship_color_id` | string | Ship color ID |
| `player.profile_id` | string | Player profile ID |

**Example:**
```javascript
socket.on('auth:success', (data) => {
  localStorage.setItem('galaxy-miner-token', data.token);
  initializeGame(data.player);
});
```

**Related Events:** `auth:login`, `auth:register`, `auth:token`

---

### `auth:error`

Authentication failure response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message describing failure |

**Example:**
```javascript
socket.on('auth:error', (data) => {
  console.error('Auth failed:', data.message);
  // "Invalid credentials"
  // "Too many login attempts. Please wait."
  // "Invalid or expired session"
});
```

**Related Events:** `auth:login`, `auth:register`, `auth:token`

---

## Player Events

### `player:input`

Send player movement and position update to server.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x` | number | Yes | Player X coordinate |
| `y` | number | Yes | Player Y coordinate |
| `vx` | number | Yes | Velocity X component |
| `vy` | number | Yes | Velocity Y component |
| `rotation` | number | Yes | Ship rotation (radians) |

**Response:** Position saved periodically (every 5 seconds)

**Example:**
```javascript
socket.emit('player:input', {
  x: player.position.x,
  y: player.position.y,
  vx: player.velocity.x,
  vy: player.velocity.y,
  rotation: player.rotation
});
```

**Validation:** Server performs sanity check on velocity (max speed validation)

**Related Events:** `player:update`

---

### `player:update`

Broadcast player state to nearby players.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Player user ID |
| `username` | string | Player username |
| `x` | number | Player X coordinate |
| `y` | number | Player Y coordinate |
| `rotation` | number | Ship rotation (radians) |
| `hull` | number | Current hull HP |
| `shield` | number | Current shield HP |
| `status` | string | Player status (idle/mining/combat/collecting/wormhole) |
| `colorId` | string | Ship color ID |

**Example:**
```javascript
socket.on('player:update', (data) => {
  updateOtherPlayer(data.id, {
    position: { x: data.x, y: data.y },
    rotation: data.rotation,
    hull: data.hull,
    shield: data.shield,
    status: data.status
  });
});
```

**Broadcast Range:** 2x radar range from player

**Related Events:** `player:input`, `player:leave`

---

### `player:leave`

Player disconnected from server.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | number | ID of player who disconnected |

**Example:**
```javascript
socket.on('player:leave', (playerId) => {
  removePlayer(playerId);
});
```

**Related Events:** `disconnect`, `player:update`

---

### `player:colorChanged`

Other player changed ship color.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player user ID |
| `colorId` | string | New ship color ID |

**Example:**
```javascript
socket.on('player:colorChanged', (data) => {
  updatePlayerColor(data.playerId, data.colorId);
});
```

**Related Events:** `ship:setColor`, `ship:colorChanged`

---

### `player:profileChanged`

Other player changed profile.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player user ID |
| `profileId` | string | New profile ID |

**Example:**
```javascript
socket.on('player:profileChanged', (data) => {
  updatePlayerProfile(data.playerId, data.profileId);
});
```

**Related Events:** `ship:setProfile`, `ship:profileChanged`

---

### `player:damaged`

Local player took damage.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hull` | number | New hull HP |
| `shield` | number | New shield HP |
| `damage` | number | Damage amount |
| `attackerId` | number/string | ID of attacker (player ID or NPC ID) |
| `attackerType` | string | Type of attacker (player/npc) |

**Example:**
```javascript
socket.on('player:damaged', (data) => {
  player.hull.current = data.hull;
  player.shield.current = data.shield;
  showHitEffect(player.position, data.shield > 0);
});
```

**Related Events:** `combat:hit`, `combat:npcFire`

---

### `player:death`

Local player died.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cause` | string | Cause of death (npc/player/star/stellar_radiation) |
| `message` | string | Death message for display |
| `killerType` | string | Type of killer (npc/player/star/unknown) |
| `killerName` | string | Name of killer (if applicable) |
| `npcName` | string | NPC name (if killed by NPC) |
| `droppedCargo` | array | List of dropped cargo items |

**Example:**
```javascript
socket.on('player:death', (data) => {
  console.log('Died:', data.message);
  // "You were destroyed by Pirate Marauder"
  // "You were destroyed by stellar radiation"
  showDeathScreen(data);
});
```

**Related Events:** `player:respawn`

---

### `player:respawn`

Player respawned after death.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `position` | object | Respawn position {x, y} |
| `hull` | number | Respawned hull HP |
| `shield` | number | Respawned shield HP |

**Example:**
```javascript
socket.on('player:respawn', (data) => {
  player.position = data.position;
  player.hull.current = data.hull;
  player.shield.current = data.shield;
  player.isDead = false;
});
```

**Related Events:** `player:death`

---

### `player:debuff`

Debuff applied to player (slow, etc.).

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Debuff type (slow) |
| `duration` | number | Duration in milliseconds |
| `slowPercent` | number | Slow percentage (0.0-1.0) |

**Example:**
```javascript
socket.on('player:debuff', (data) => {
  player.debuffs[data.type] = {
    expiresAt: Date.now() + data.duration,
    percent: data.slowPercent
  };
  showNotification(`Slowed for ${data.duration/1000}s`);
});
```

**Related Events:** `queen:webSnare`

---

### `player:dot`

Damage over time tick (acid, etc.).

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | DoT type (acid) |
| `damage` | number | Tick damage amount |

**Example:**
```javascript
socket.on('player:dot', (data) => {
  showDamageNumber(player.position, data.damage, '#44ff44');
  spawnAcidParticles(player.position);
});
```

**Related Events:** `queen:acidBurst`

---

## Combat Events

### `combat:fire`

Player or other player fired weapon.

**Direction:** Bidirectional
- Client → Server: Local player fires
- Server → Client: Broadcast nearby player firing

**Payload (Client → Server):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `direction` | number | Yes | Fire direction (radians) |

**Payload (Server → Client):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Firing player ID |
| `x` | number | Fire origin X |
| `y` | number | Fire origin Y |
| `rotation` | number | Ship rotation |
| `direction` | number | Fire direction |
| `weaponTier` | number | Weapon tier (1-5) for visuals |

**Example:**
```javascript
// Client sends fire
socket.emit('combat:fire', { direction: player.rotation });

// Client receives nearby fire
socket.on('combat:fire', (data) => {
  if (data.playerId !== player.id) {
    renderWeaponFire(data.x, data.y, data.direction, data.weaponTier);
  }
});
```

**Related Events:** `combat:npcHit`, `combat:baseHit`, `combat:chainLightning`

---

### `combat:hit`

Generic hit event (deprecated in favor of specific hit events).

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `x` | number | Hit location X |
| `y` | number | Hit location Y |
| `targetX` | number | Target X coordinate |
| `targetY` | number | Target Y coordinate |
| `shieldDamage` | number | Shield damage dealt |
| `hitShield` | boolean | Whether shield was hit |
| `attackerType` | string | Attacker type (player/npc) |
| `targetTier` | number | Target tier for sound effects |

**Example:**
```javascript
socket.on('combat:hit', (data) => {
  showHitEffect(data.targetX, data.targetY, data.hitShield);
  playHitSound(data.hitShield, data.targetTier);
});
```

**Related Events:** `combat:fire`, `player:damaged`

---

### `combat:playerHit`

Player-to-player combat hit.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetX` | number | Target X coordinate |
| `targetY` | number | Target Y coordinate |
| `hitShield` | boolean | Whether shield was hit |

**Example:**
```javascript
socket.on('combat:playerHit', (data) => {
  showHitEffect(data.targetX, data.targetY, data.hitShield);
});
```

**Related Events:** `combat:fire`, `player:damaged`

---

### `combat:npcHit`

Player hit an NPC.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `npcId` | string | NPC ID that was hit |
| `damage` | number | Damage dealt |
| `destroyed` | boolean | Whether NPC was destroyed |

**Example:**
```javascript
socket.on('combat:npcHit', (data) => {
  showDamageNumber(npc.position, data.damage);
  if (data.destroyed) {
    // Rewards now granted when collecting wreckage
  }
});
```

**Related Events:** `combat:fire`, `npc:destroyed`, `wreckage:spawn`

---

### `combat:baseHit`

Player hit a faction base.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseId` | string | Base ID |
| `damage` | number | Damage dealt |
| `destroyed` | boolean | Whether base was destroyed |
| `health` | number | Base current health |
| `maxHealth` | number | Base maximum health |

**Example:**
```javascript
socket.on('combat:baseHit', (data) => {
  updateBaseHealth(data.baseId, data.health, data.maxHealth);
  if (data.destroyed) {
    // base:reward event will follow with credits
  }
});
```

**Related Events:** `combat:fire`, `base:destroyed`, `base:reward`

---

### `combat:npcFire`

NPC fired weapon at target.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `npcId` | string | Firing NPC ID |
| `faction` | string | NPC faction (pirate/scavenger/swarm/void/rogue_miner) |
| `sourceX` | number | Fire origin X |
| `sourceY` | number | Fire origin Y |
| `targetX` | number | Target X |
| `targetY` | number | Target Y |
| `hitInfo` | object/null | Hit information for timing effects |

**Example:**
```javascript
socket.on('combat:npcFire', (data) => {
  renderNPCWeaponEffect(
    { x: data.sourceX, y: data.sourceY },
    { x: data.targetX, y: data.targetY },
    data.faction,
    data.hitInfo
  );
});
```

**Related Events:** `player:damaged`, `combat:hit`

---

### `combat:chainLightning`

Tesla Cannon (tier 5 weapon) chain lightning effect.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Firing player ID |
| `sourceNpcId` | string | Initial hit NPC ID |
| `sourceX` | number | Chain origin X |
| `sourceY` | number | Chain origin Y |
| `chains` | array | Array of chain targets |
| `chains[].targetId` | string | Chained NPC ID |
| `chains[].targetX` | number | Chain target X |
| `chains[].targetY` | number | Chain target Y |
| `chains[].damage` | number | Damage dealt to target |
| `chains[].destroyed` | boolean | Whether target was destroyed |

**Example:**
```javascript
socket.on('combat:chainLightning', (data) => {
  renderChainLightning(data.sourceX, data.sourceY, data.chains);
  playSound('tesla_chain');
});
```

**Related Events:** `combat:fire`, `combat:npcHit`

---

### `combat:teslaCoil`

Tesla Cannon tesla coil effect when hitting bases.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Firing player ID |
| `baseId` | string | Hit base ID |
| `impactX` | number | Impact X coordinate |
| `impactY` | number | Impact Y coordinate |
| `baseSize` | number | Base size for effect scaling |
| `duration` | number | Effect duration (ms) |
| `targets` | array | Visual arc targets (no damage) |
| `targets[].npcId` | string | NPC ID for visual arc |
| `targets[].x` | number | NPC X position |
| `targets[].y` | number | NPC Y position |

**Example:**
```javascript
socket.on('combat:teslaCoil', (data) => {
  renderTeslaCoil(
    data.impactX,
    data.impactY,
    data.baseSize,
    data.targets,
    data.duration
  );
});
```

**Related Events:** `combat:baseHit`

---

## Mining Events

### `mining:start`

Start mining an asteroid/resource.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectId` | string | Yes | World object ID to mine |

**Response:** `mining:started` or `mining:error`

**Example:**
```javascript
socket.emit('mining:start', { objectId: 'asteroid_12345' });
```

**Related Events:** `mining:started`, `mining:complete`, `mining:cancelled`, `mining:error`

---

### `mining:started`

Mining successfully started.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `objectId` | string | Object being mined |
| `miningTime` | number | Total mining time (ms) |

**Example:**
```javascript
socket.on('mining:started', (data) => {
  startMiningAnimation(data.objectId, data.miningTime);
  audioManager.startLoop('mining_drill_' + player.miningTier);
});
```

**Related Events:** `mining:start`, `mining:complete`, `mining:playerStarted`

---

### `mining:complete`

Mining completed successfully.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resourceType` | string | Resource type mined |
| `resourceName` | string | Display name of resource |
| `quantity` | number | Quantity mined |

**Example:**
```javascript
socket.on('mining:complete', (data) => {
  showNotification(`Mined ${data.quantity}x ${data.resourceName}`);
  audioManager.stopLoop('mining_drill_' + player.miningTier);
  audioManager.play('mining_complete');
});
```

**Related Events:** `mining:started`, `inventory:update`, `world:update`

---

### `mining:cancelled`

Mining was cancelled.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reason` | string | Cancellation reason ("moved_too_far", "cancelled_by_player", etc.) |

**Example:**
```javascript
socket.on('mining:cancelled', (data) => {
  stopMiningAnimation();
  audioManager.stopLoop('mining_drill_' + player.miningTier);
  if (data.reason !== 'cancelled_by_player') {
    showNotification('Mining cancelled: ' + data.reason);
  }
});
```

**Related Events:** `mining:cancel`, `mining:started`

---

### `mining:cancel`

Request to cancel active mining.

**Direction:** Client → Server

**Payload:** None

**Response:** `mining:cancelled`

**Example:**
```javascript
socket.emit('mining:cancel');
```

**Related Events:** `mining:cancelled`

---

### `mining:error`

Mining failed to start.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |
| `objectId` | string | Object ID that failed |

**Example:**
```javascript
socket.on('mining:error', (data) => {
  console.error('Mining failed:', data.message);
  // "Already mining"
  // "Resource depleted"
  // "Object not found"
});
```

**Related Events:** `mining:start`

---

### `mining:playerStarted`

Other player started mining (for visualization).

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Mining player ID |
| `targetX` | number | Mining target X |
| `targetY` | number | Mining target Y |
| `resourceType` | string | Resource type being mined |
| `miningTier` | number | Player's mining tier |

**Example:**
```javascript
socket.on('mining:playerStarted', (data) => {
  showMiningBeam(data.playerId, data.targetX, data.targetY, data.miningTier);
});
```

**Related Events:** `mining:playerStopped`

---

### `mining:playerStopped`

Other player stopped mining.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player ID |

**Example:**
```javascript
socket.on('mining:playerStopped', (data) => {
  hideMiningBeam(data.playerId);
});
```

**Related Events:** `mining:playerStarted`

---

## Marketplace Events

### `market:list`

List item for sale on marketplace.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceType` | string | Yes | Resource type to sell |
| `quantity` | number | Yes | Quantity to list |
| `price` | number | Yes | Price per unit (credits) |

**Response:** `market:listed` or `market:error`

**Example:**
```javascript
socket.emit('market:list', {
  resourceType: 'iron_ore',
  quantity: 50,
  price: 10
});
```

**Related Events:** `market:listed`, `market:error`, `market:update`

---

### `market:listed`

Item successfully listed.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `listingId` | number | Created listing ID |

**Example:**
```javascript
socket.on('market:listed', (data) => {
  console.log('Listed item ID:', data.listingId);
});
```

**Related Events:** `market:list`, `inventory:update`, `market:update`

---

### `market:buy`

Purchase item from marketplace.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listingId` | number | Yes | Listing ID to purchase |
| `quantity` | number | Yes | Quantity to buy |

**Response:** `market:bought` or `market:error`

**Example:**
```javascript
socket.emit('market:buy', {
  listingId: 12345,
  quantity: 10
});
```

**Related Events:** `market:bought`, `market:error`, `market:sold`, `market:update`

---

### `market:bought`

Purchase successful.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cost` | number | Total cost of purchase |

**Example:**
```javascript
socket.on('market:bought', (data) => {
  console.log('Purchased for', data.cost, 'credits');
});
```

**Related Events:** `market:buy`, `inventory:update`, `market:update`

---

### `market:sold`

Your listing was purchased by another player.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resourceType` | string | Resource type sold |
| `resourceName` | string | Display name |
| `quantity` | number | Quantity sold |
| `totalCredits` | number | Total credits earned |
| `buyerName` | string | Buyer username |

**Example:**
```javascript
socket.on('market:sold', (data) => {
  showNotification(
    `${data.buyerName} bought ${data.quantity}x ${data.resourceName} for ${data.totalCredits} credits`
  );
  animateCredits(data.totalCredits);
});
```

**Related Events:** `market:buy`, `inventory:update`

---

### `market:cancel`

Cancel your own listing.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listingId` | number | Yes | Listing ID to cancel |

**Response:** `market:cancelled` or `market:error`

**Example:**
```javascript
socket.emit('market:cancel', { listingId: 12345 });
```

**Related Events:** `market:cancelled`, `market:error`, `market:update`

---

### `market:cancelled`

Listing successfully cancelled.

**Direction:** Server → Client

**Payload:** Empty object `{}`

**Example:**
```javascript
socket.on('market:cancelled', () => {
  console.log('Listing cancelled, items returned to inventory');
});
```

**Related Events:** `market:cancel`, `inventory:update`, `market:update`

---

### `market:getListings`

Request marketplace listings.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceType` | string | No | Filter by resource type (null for all) |

**Response:** `market:listings`

**Example:**
```javascript
// Get all listings
socket.emit('market:getListings', { resourceType: null });

// Get iron ore listings only
socket.emit('market:getListings', { resourceType: 'iron_ore' });
```

**Related Events:** `market:listings`

---

### `market:listings`

Marketplace listings response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `listings` | array | Array of listing objects |
| `listings[].id` | number | Listing ID |
| `listings[].seller_id` | number | Seller user ID |
| `listings[].seller_name` | string | Seller username |
| `listings[].resource_type` | string | Resource type |
| `listings[].quantity` | number | Quantity available |
| `listings[].price` | number | Price per unit |
| `listings[].created_at` | string | ISO timestamp |

**Example:**
```javascript
socket.on('market:listings', (data) => {
  renderMarketListings(data.listings);
});
```

**Related Events:** `market:getListings`

---

### `market:getMyListings`

Request your own active listings.

**Direction:** Client → Server

**Payload:** Empty object `{}`

**Response:** `market:myListings`

**Example:**
```javascript
socket.emit('market:getMyListings', {});
```

**Related Events:** `market:myListings`

---

### `market:myListings`

Your active listings response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `listings` | array | Array of your listing objects (same format as market:listings) |

**Example:**
```javascript
socket.on('market:myListings', (data) => {
  renderMyListings(data.listings);
});
```

**Related Events:** `market:getMyListings`

---

### `market:update`

Marketplace changed (generic refresh trigger).

**Direction:** Server → Client (broadcast to all)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Action type (new_listing/purchase/cancelled) |

**Example:**
```javascript
socket.on('market:update', (data) => {
  // Refresh marketplace UI
  requestMarketListings();
});
```

**Related Events:** `market:list`, `market:buy`, `market:cancel`

---

### `market:error`

Marketplace operation failed.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('market:error', (data) => {
  console.error('Market error:', data.message);
  // "Not enough credits"
  // "Not enough inventory"
  // "Listing not found"
});
```

**Related Events:** `market:list`, `market:buy`, `market:cancel`

---

## Chat Events

### `chat:send`

Send chat message to all players.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Chat message (max 200 chars) |

**Response:** `chat:message` (broadcast)

**Example:**
```javascript
socket.emit('chat:send', { message: 'Hello galaxy!' });
```

**Rate Limiting:** Configurable rate limit per player (default 1s cooldown)

**Related Events:** `chat:message`

---

### `chat:message`

Chat message broadcast.

**Direction:** Server → Client (broadcast to all)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Sender username |
| `message` | string | Chat message text |
| `timestamp` | number | Message timestamp (ms) |

**Example:**
```javascript
socket.on('chat:message', (data) => {
  addChatMessage(data.username, data.message, new Date(data.timestamp));
  playSound('chat_receive');
});
```

**Related Events:** `chat:send`

---

## Ship Events

### `ship:upgrade`

Upgrade ship component.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `component` | string | Yes | Component type (engine/weapon/shield/mining/cargo/radar/energy_core/hull) |

**Response:** `upgrade:success` or `upgrade:error`

**Example:**
```javascript
socket.emit('ship:upgrade', { component: 'weapon' });
```

**Validation:** Server checks credits, resource requirements, and max tier

**Related Events:** `upgrade:success`, `upgrade:error`, `inventory:update`

---

### `upgrade:success`

Upgrade successful.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `component` | string | Upgraded component |
| `newTier` | number | New tier level (1-5) |
| `credits` | number | Updated credits balance |
| `shieldMax` | number | New max shield (if shield upgrade) |
| `hullMax` | number | New max hull (if hull upgrade) |

**Example:**
```javascript
socket.on('upgrade:success', (data) => {
  player.ship[data.component + 'Tier'] = data.newTier;
  player.credits = data.credits;
  if (data.shieldMax) player.shieldMax = data.shieldMax;
  if (data.hullMax) player.hullMax = data.hullMax;
  showNotification(`${data.component} upgraded to tier ${data.newTier}!`);
});
```

**Related Events:** `ship:upgrade`, `inventory:update`

---

### `upgrade:error`

Upgrade failed.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('upgrade:error', (data) => {
  console.error('Upgrade failed:', data.message);
  // "Not enough credits"
  // "Missing required resources"
  // "Already at max tier"
  // "Invalid component"
});
```

**Related Events:** `ship:upgrade`

---

### `ship:getData`

Request ship data refresh.

**Direction:** Client → Server

**Payload:** None

**Response:** `ship:data`

**Example:**
```javascript
socket.emit('ship:getData');
```

**Related Events:** `ship:data`

---

### `ship:data`

Ship data response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `engine_tier` | number | Engine tier |
| `weapon_type` | string | Weapon type |
| `weapon_tier` | number | Weapon tier |
| `shield_tier` | number | Shield tier |
| `mining_tier` | number | Mining tier |
| `cargo_tier` | number | Cargo tier |
| `radar_tier` | number | Radar tier |
| `energy_core_tier` | number | Energy core tier |
| `hull_tier` | number | Hull tier |
| `credits` | number | Credits balance |
| `ship_color_id` | string | Ship color ID |
| `profile_id` | string | Profile ID |

**Example:**
```javascript
socket.on('ship:data', (data) => {
  updateShipStats(data);
});
```

**Related Events:** `ship:getData`

---

### `ship:setColor`

Change ship color.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `colorId` | string | Yes | Color ID from available options |

**Response:** `ship:colorChanged` or `ship:colorError`

**Example:**
```javascript
socket.emit('ship:setColor', { colorId: 'red' });
```

**Related Events:** `ship:colorChanged`, `ship:colorError`, `player:colorChanged`

---

### `ship:colorChanged`

Ship color changed successfully.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `colorId` | string | New color ID |

**Example:**
```javascript
socket.on('ship:colorChanged', (data) => {
  player.colorId = data.colorId;
  console.log('Color changed to:', data.colorId);
});
```

**Related Events:** `ship:setColor`, `player:colorChanged`

---

### `ship:colorError`

Color change failed.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('ship:colorError', (data) => {
  console.error('Color change failed:', data.message);
  // "Invalid color selection"
  // "Failed to save color preference"
});
```

**Related Events:** `ship:setColor`

---

### `ship:setProfile`

Change player profile.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `profileId` | string | Yes | Profile ID from available options |

**Response:** `ship:profileChanged` or `ship:profileError`

**Example:**
```javascript
socket.emit('ship:setProfile', { profileId: 'trader' });
```

**Related Events:** `ship:profileChanged`, `ship:profileError`

---

### `ship:profileChanged`

Profile changed successfully.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `profileId` | string | New profile ID |

**Example:**
```javascript
socket.on('ship:profileChanged', (data) => {
  player.profileId = data.profileId;
});
```

**Related Events:** `ship:setProfile`, `player:profileChanged`

---

### `ship:profileError`

Profile change failed.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('ship:profileError', (data) => {
  console.error('Profile change failed:', data.message);
});
```

**Related Events:** `ship:setProfile`

---

## Loot Events

### `loot:startCollect`

Start collecting wreckage/scrap.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wreckageId` | string | Yes | Wreckage ID to collect |

**Response:** `loot:started` or `loot:error`

**Example:**
```javascript
socket.emit('loot:startCollect', { wreckageId: 'wreck_12345' });
```

**Related Events:** `loot:started`, `loot:complete`, `loot:error`

---

### `loot:started`

Loot collection started.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `wreckageId` | string | Wreckage ID |
| `totalTime` | number | Total collection time (ms) |

**Example:**
```javascript
socket.on('loot:started', (data) => {
  startCollectionAnimation(data.wreckageId, data.totalTime);
});
```

**Related Events:** `loot:startCollect`, `loot:progress`, `loot:complete`

---

### `loot:progress`

Loot collection progress update.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `wreckageId` | string | Wreckage ID |
| `progress` | number | Progress (0.0-1.0) |

**Example:**
```javascript
socket.on('loot:progress', (data) => {
  updateCollectionProgress(data.wreckageId, data.progress);
});
```

**Related Events:** `loot:started`, `loot:complete`

---

### `loot:complete`

Loot collection complete.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `wreckageId` | string | Wreckage ID |
| `contents` | array | Array of loot items |
| `contents[].type` | string | Item type (credits/resource/component/relic/buff) |
| `contents[].amount` | number | Credits amount (if type=credits) |
| `contents[].resourceType` | string | Resource type (if type=resource) |
| `contents[].quantity` | number | Resource quantity (if type=resource) |
| `contents[].rarity` | string | Resource rarity (common/uncommon/rare/ultrarare) |
| `results` | object | Processed loot results |
| `results.credits` | number | Total credits earned |
| `results.resources` | array | Resources collected |
| `results.components` | array | Components collected |
| `results.relics` | array | Relics collected |
| `results.buffs` | array | Buffs applied |
| `teamCredits` | number | Team-shared credits total |

**Example:**
```javascript
socket.on('loot:complete', (data) => {
  displayRewards(data.results);
  removeWreckage(data.wreckageId);
  if (data.teamCredits > data.results.credits) {
    showNotification(`Team bonus: ${data.teamCredits} total credits`);
  }
});
```

**Related Events:** `loot:started`, `inventory:update`, `wreckage:collected`

---

### `loot:cancelCollect`

Cancel active loot collection.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wreckageId` | string | Yes | Wreckage ID |

**Response:** `loot:cancelled`

**Example:**
```javascript
socket.emit('loot:cancelCollect', { wreckageId: 'wreck_12345' });
```

**Related Events:** `loot:cancelled`

---

### `loot:cancelled`

Loot collection cancelled.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reason` | string | Cancellation reason |

**Example:**
```javascript
socket.on('loot:cancelled', (data) => {
  stopCollectionAnimation();
  console.log('Collection cancelled:', data.reason);
});
```

**Related Events:** `loot:cancelCollect`, `loot:started`

---

### `loot:error`

Loot collection error.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('loot:error', (data) => {
  console.error('Loot error:', data.message);
  // "Wreckage not found"
  // "Too far from wreckage"
  // "Already collecting"
});
```

**Related Events:** `loot:startCollect`

---

### `loot:getNearby`

Request nearby wreckage list.

**Direction:** Client → Server

**Payload:** None

**Response:** `loot:nearby`

**Example:**
```javascript
socket.emit('loot:getNearby');
```

**Related Events:** `loot:nearby`

---

### `loot:nearby`

Nearby wreckage response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `wreckage` | array | Array of nearby wreckage |
| `wreckage[].id` | string | Wreckage ID |
| `wreckage[].x` | number | X coordinate |
| `wreckage[].y` | number | Y coordinate |
| `wreckage[].faction` | string | Faction type |
| `wreckage[].npcName` | string | NPC name |
| `wreckage[].contentCount` | number | Number of items |
| `wreckage[].distance` | number | Distance from player |
| `wreckage[].despawnTime` | number | Despawn timestamp |

**Example:**
```javascript
socket.on('loot:nearby', (data) => {
  updateWreckageList(data.wreckage);
});
```

**Related Events:** `loot:getNearby`

---

### `loot:playerCollecting`

Other player started collecting wreckage.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Collecting player ID |
| `wreckageId` | string | Wreckage ID |
| `x` | number | Wreckage X |
| `y` | number | Wreckage Y |

**Example:**
```javascript
socket.on('loot:playerCollecting', (data) => {
  showCollectionBeam(data.playerId, data.x, data.y);
});
```

**Related Events:** `loot:playerStopped`

---

### `loot:playerStopped`

Other player stopped collecting.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player ID |

**Example:**
```javascript
socket.on('loot:playerStopped', (data) => {
  hideCollectionBeam(data.playerId);
});
```

**Related Events:** `loot:playerCollecting`

---

## Wormhole Events

### `wormhole:enter`

Enter wormhole.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wormholeId` | string | Yes | Wormhole ID to enter |

**Response:** `wormhole:entered` or `wormhole:error`

**Example:**
```javascript
socket.emit('wormhole:enter', { wormholeId: 'wormhole_12345' });
```

**Related Events:** `wormhole:entered`, `wormhole:error`

---

### `wormhole:entered`

Successfully entered wormhole.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `wormholeId` | string | Entered wormhole ID |
| `destinations` | array | Available destination wormholes |
| `destinations[].id` | string | Destination wormhole ID |
| `destinations[].x` | number | Destination X |
| `destinations[].y` | number | Destination Y |
| `destinations[].distance` | number | Transit distance |

**Example:**
```javascript
socket.on('wormhole:entered', (data) => {
  showDestinationSelector(data.destinations);
  player.status = 'wormhole';
});
```

**Related Events:** `wormhole:enter`, `wormhole:selectDestination`

---

### `wormhole:selectDestination`

Select wormhole destination.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destinationId` | string | Yes | Destination wormhole ID |

**Response:** `wormhole:transitStarted` or `wormhole:error`

**Example:**
```javascript
socket.emit('wormhole:selectDestination', { destinationId: 'wormhole_67890' });
```

**Related Events:** `wormhole:transitStarted`, `wormhole:error`

---

### `wormhole:transitStarted`

Wormhole transit started.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `destinationId` | string | Destination wormhole ID |
| `destination` | object | Destination position {x, y} |
| `duration` | number | Transit duration (ms) |

**Example:**
```javascript
socket.on('wormhole:transitStarted', (data) => {
  showTransitAnimation(data.destination, data.duration);
});
```

**Related Events:** `wormhole:selectDestination`, `wormhole:exitComplete`

---

### `wormhole:exitComplete`

Wormhole transit complete, player exited at destination.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `position` | object | Exit position {x, y} |
| `wormholeId` | string | Exit wormhole ID |

**Example:**
```javascript
socket.on('wormhole:exitComplete', (data) => {
  player.position = data.position;
  player.velocity = { x: 0, y: 0 };
  player.status = 'idle';
  hideTransitUI();
});
```

**Related Events:** `wormhole:transitStarted`

---

### `wormhole:cancel`

Cancel wormhole transit.

**Direction:** Client → Server

**Payload:** None

**Response:** `wormhole:cancelled`

**Example:**
```javascript
socket.emit('wormhole:cancel');
```

**Related Events:** `wormhole:cancelled`

---

### `wormhole:cancelled`

Wormhole transit cancelled.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reason` | string | Cancellation reason |

**Example:**
```javascript
socket.on('wormhole:cancelled', (data) => {
  hideTransitUI();
  player.status = 'idle';
  console.log('Transit cancelled:', data.reason);
});
```

**Related Events:** `wormhole:cancel`

---

### `wormhole:error`

Wormhole operation error.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('wormhole:error', (data) => {
  console.error('Wormhole error:', data.message);
  // "Wormhole not found"
  // "Too far from wormhole"
  // "Invalid destination"
});
```

**Related Events:** `wormhole:enter`, `wormhole:selectDestination`

---

### `wormhole:getProgress`

Request transit progress.

**Direction:** Client → Server

**Payload:** None

**Response:** `wormhole:progress`

**Example:**
```javascript
socket.emit('wormhole:getProgress');
```

**Related Events:** `wormhole:progress`

---

### `wormhole:progress`

Transit progress response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `progress` | number | Progress (0.0-1.0) |
| `destination` | object | Destination {x, y} |

**Example:**
```javascript
socket.on('wormhole:progress', (data) => {
  updateTransitProgress(data.progress);
});
```

**Related Events:** `wormhole:getProgress`

---

### `wormhole:getNearestPosition`

Request nearest wormhole position (for directional indicator).

**Direction:** Client → Server

**Payload:** None

**Response:** `wormhole:nearestPosition`

**Example:**
```javascript
socket.emit('wormhole:getNearestPosition');
```

**Related Events:** `wormhole:nearestPosition`

---

### `wormhole:nearestPosition`

Nearest wormhole position response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `x` | number | Wormhole X coordinate (null if none nearby) |
| `y` | number | Wormhole Y coordinate (null if none nearby) |
| `distance` | number | Distance to wormhole (null if none nearby) |

**Example:**
```javascript
socket.on('wormhole:nearestPosition', (data) => {
  if (data) {
    showWormholeIndicator(data.x, data.y, data.distance);
  } else {
    hideWormholeIndicator();
  }
});
```

**Related Events:** `wormhole:getNearestPosition`

---

### `wormhole:playerEntered`

Other player entered wormhole.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player ID |
| `wormholeId` | string | Wormhole ID |

**Example:**
```javascript
socket.on('wormhole:playerEntered', (data) => {
  console.log(`Player ${data.playerId} entered wormhole`);
});
```

---

### `wormhole:playerTransiting`

Other player started wormhole transit.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player ID |
| `destinationId` | string | Destination wormhole ID |

**Example:**
```javascript
socket.on('wormhole:playerTransiting', (data) => {
  console.log(`Player ${data.playerId} transiting via wormhole`);
});
```

---

### `wormhole:playerExited`

Other player exited wormhole at new location.

**Direction:** Server → Client (broadcast to nearby at destination)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player ID |
| `x` | number | Exit X coordinate |
| `y` | number | Exit Y coordinate |

**Example:**
```javascript
socket.on('wormhole:playerExited', (data) => {
  console.log(`Player ${data.playerId} exited wormhole at ${data.x}, ${data.y}`);
});
```

---

### `wormhole:playerCancelled`

Other player cancelled wormhole transit.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Player ID |

**Example:**
```javascript
socket.on('wormhole:playerCancelled', (data) => {
  console.log(`Player ${data.playerId} cancelled wormhole transit`);
});
```

---

## NPC Events

### `npc:spawn`

NPC spawned in world.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | NPC unique ID |
| `type` | string | NPC type (e.g., swarm_drone, pirate_marauder, swarm_queen) |
| `name` | string | NPC display name |
| `faction` | string | Faction (pirate/scavenger/swarm/void/rogue_miner) |
| `x` | number | Spawn X coordinate |
| `y` | number | Spawn Y coordinate |
| `rotation` | number | Initial rotation |
| `hull` | number | Current hull HP |
| `hullMax` | number | Maximum hull HP |
| `shield` | number | Current shield HP |
| `shieldMax` | number | Maximum shield HP |

**Example:**
```javascript
socket.on('npc:spawn', (data) => {
  createNPC(data);
});
```

**Related Events:** `npc:update`, `npc:destroyed`

---

### `npc:update`

NPC state update.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | NPC ID |
| `type` | string | NPC type |
| `name` | string | NPC name |
| `faction` | string | Faction |
| `x` | number | X coordinate |
| `y` | number | Y coordinate |
| `rotation` | number | Rotation |
| `state` | string | AI state (idle/patrol/chase/attack/flee/etc.) |
| `hull` | number | Current hull HP |
| `hullMax` | number | Maximum hull HP |
| `shield` | number | Current shield HP |
| `shieldMax` | number | Maximum shield HP |

**Example:**
```javascript
socket.on('npc:update', (data) => {
  updateNPC(data);
});
```

**Broadcast Frequency:** Every game tick (20 ticks/second) to players within range

**Related Events:** `npc:spawn`, `npc:destroyed`

---

### `npc:destroyed`

NPC was destroyed.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | NPC ID |

**Example:**
```javascript
socket.on('npc:destroyed', (data) => {
  const npc = getNPC(data.id);
  triggerDeathEffect(npc);
  playDeathSound(npc.faction);
  removeNPC(data.id);
});
```

**Related Events:** `npc:update`, `wreckage:spawn`

---

### `npc:queenSpawn`

Swarm Queen spawned minions.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `queenX` | number | Queen X position |
| `queenY` | number | Queen Y position |
| `spawned` | array | Array of spawned minion data |
| `spawned[].id` | string | Minion NPC ID |
| `spawned[].x` | number | Minion X position |
| `spawned[].y` | number | Minion Y position |

**Example:**
```javascript
socket.on('npc:queenSpawn', (data) => {
  triggerQueenSpawnEffect(data.queenX, data.queenY, data.spawned);
});
```

**Related Events:** `swarm:queenSpawn`, `npc:spawn`

---

## World Events

### `world:update`

World state changed (resource depleted, etc.).

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `depleted` | boolean | Whether resource was depleted |
| `objectId` | string | World object ID |

**Example:**
```javascript
socket.on('world:update', (data) => {
  if (data.depleted) {
    markObjectDepleted(data.objectId);
  }
});
```

**Related Events:** `mining:complete`

---

## Emote Events

### `emote:send`

Send emote to nearby players.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `emoteType` | string | Yes | Emote type from config.EMOTES |

**Response:** `emote:broadcast` (to nearby players)

**Example:**
```javascript
socket.emit('emote:send', { emoteType: 'wave' });
```

**Related Events:** `emote:broadcast`

---

### `emote:broadcast`

Emote broadcast from nearby player.

**Direction:** Server → Client (broadcast to nearby players)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | number | Emoting player ID |
| `playerName` | string | Player username |
| `emoteType` | string | Emote type |
| `x` | number | Player X position |
| `y` | number | Player Y position |

**Example:**
```javascript
socket.on('emote:broadcast', (data) => {
  if (data.playerId !== player.id) {
    showEmote(data.x, data.y, data.emoteType, data.playerName);
  }
});
```

**Related Events:** `emote:send`

---

## Base Events

### `bases:nearby`

Nearby faction bases update (radar broadcast).

**Direction:** Server → Client (broadcast every 500ms)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| bases | array | Array of base objects |
| bases[].id | string | Base ID |
| bases[].type | string | Base type (pirate_outpost/swarm_hive/etc.) |
| bases[].faction | string | Faction |
| bases[].x | number | X coordinate |
| bases[].y | number | Y coordinate |
| bases[].size | number | Base size |
| bases[].health | number | Current health |
| bases[].maxHealth | number | Maximum health |
| bases[].destroyed | boolean | Whether base is destroyed |

**Example:**
```javascript
socket.on('bases:nearby', (bases) => {
  updateBases(bases);
});
```

**Broadcast Range:** Player radar range

**Related Events:** `base:damaged`, `base:destroyed`

---

### `base:damaged`

Faction base took damage.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseId` | string | Base ID |
| `health` | number | Current health |
| `maxHealth` | number | Maximum health |
| `damage` | number | Damage dealt |
| `x` | number | Base X coordinate |
| `y` | number | Base Y coordinate |
| `size` | number | Base size |
| `faction` | string | Base faction |

**Example:**
```javascript
socket.on('base:damaged', (data) => {
  updateBaseHealth(data.baseId, data.health, data.maxHealth);
  showHitEffect(data.x, data.y, data.health > data.maxHealth * 0.7);
});
```

**Related Events:** `combat:baseHit`, `base:destroyed`

---

### `base:destroyed`

Faction base destroyed.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Base ID |
| `baseType` | string | Base type |
| `x` | number | Base X coordinate |
| `y` | number | Base Y coordinate |
| `size` | number | Base size |
| `destroyedDrones` | array | Attached drones destroyed with base (swarm faction) |

**Example:**
```javascript
socket.on('base:destroyed', (data) => {
  triggerBaseDestructionSequence(data.x, data.y, data.baseType, data.size);
  playSound('base_destruction_' + data.baseType.split('_')[0]);
  removeBase(data.id);
  if (data.destroyedDrones) {
    data.destroyedDrones.forEach(id => removeNPC(id));
  }
});
```

**Related Events:** `base:damaged`, `base:reward`, `base:respawn`

---

### `base:respawn`

Faction base respawned.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Base ID |
| (other base properties) | | Full base data |

**Example:**
```javascript
socket.on('base:respawn', (data) => {
  respawnBase(data.id, data);
});
```

**Related Events:** `base:destroyed`

---

### `base:reward`

Base destruction rewards awarded.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `credits` | number | Credits earned |
| `teamMultiplier` | number | Team bonus multiplier applied |
| `participantCount` | number | Number of contributors |
| `baseName` | string | Base name |
| `faction` | string | Base faction |

**Example:**
```javascript
socket.on('base:reward', (data) => {
  console.log(`Base destroyed! Earned ${data.credits} credits (${data.teamMultiplier}x team bonus)`);
  animateCredits(data.credits);
});
```

**Related Events:** `base:destroyed`, `inventory:update`

---

## Swarm Events

### `swarm:droneSacrifice`

Swarm drone sacrificed for assimilation.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `droneId` | string | Drone NPC ID |
| `baseId` | string | Target base ID |
| `x` | number | Sacrifice X position |
| `y` | number | Sacrifice Y position |

**Example:**
```javascript
socket.on('swarm:droneSacrifice', (data) => {
  triggerSacrificeEffect(data.x, data.y);
});
```

**Related Events:** `swarm:assimilationProgress`

---

### `swarm:assimilationProgress`

Swarm base assimilation progress update.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseId` | string | Base being assimilated |
| `progress` | number | Assimilation progress count |
| `threshold` | number | Assimilation threshold |
| `position` | object | Base position {x, y} |

**Example:**
```javascript
socket.on('swarm:assimilationProgress', (data) => {
  updateAssimilationProgress(data.baseId, data.progress, data.threshold);
  showPulseEffect(data.position.x, data.position.y);
});
```

**Related Events:** `swarm:droneSacrifice`, `swarm:baseAssimilated`

---

### `swarm:baseAssimilated`

Base successfully assimilated by swarm.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseId` | string | Assimilated base ID |
| `newType` | string | New base type (assimilated variant) |
| `originalFaction` | string | Original faction |
| `convertedNpcs` | array | NPCs converted to swarm faction |
| `position` | object | Base position {x, y} |
| `consumedDroneIds` | array | Drone IDs consumed in conversion |

**Example:**
```javascript
socket.on('swarm:baseAssimilated', (data) => {
  updateBase(data.baseId, { type: data.newType, faction: 'swarm' });
  triggerAssimilationEffect(data.position.x, data.position.y);
  data.consumedDroneIds.forEach(id => removeNPC(id));
  showNotification('The Swarm has assimilated a base!');
});
```

**Related Events:** `swarm:assimilationProgress`

---

### `swarm:linkedDamage`

Swarm linked damage visualization (damage shared across linked units).

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sourceId` | string | Damaged NPC ID |
| `linkedIds` | array | Linked NPC IDs sharing damage |
| `sourceX` | number | Source X position |
| `sourceY` | number | Source Y position |
| `targets` | array | Array of {id, x, y} for linked units |

**Example:**
```javascript
socket.on('swarm:linkedDamage', (data) => {
  renderLinkedDamageEffect(data);
});
```

**Related Events:** `combat:npcHit`

---

## Queen Events

### `swarm:queenSpawn`

Swarm Queen has emerged.

**Direction:** Server → Client (broadcast to all)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Queen NPC ID |
| `x` | number | Spawn X position |
| `y` | number | Spawn Y position |
| `hull` | number | Queen hull HP |
| `shield` | number | Queen shield HP |
| `name` | string | Queen name |

**Example:**
```javascript
socket.on('swarm:queenSpawn', (data) => {
  triggerQueenEmergenceEffect(data.x, data.y);
  playSound('queen_roar', data.x, data.y);
  showNotification('⚠ THE SWARM QUEEN HAS EMERGED!');
});
```

**Related Events:** `swarm:queenDeath`

---

### `swarm:queenDeath`

Swarm Queen destroyed.

**Direction:** Server → Client (broadcast to all)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Queen NPC ID |
| `x` | number | Death X position |
| `y` | number | Death Y position |

**Example:**
```javascript
socket.on('swarm:queenDeath', (data) => {
  playSound('queen_death', data.x, data.y);
  showNotification('The Swarm Queen has been destroyed!');
});
```

**Related Events:** `swarm:queenSpawn`, `npc:destroyed`

---

### `swarm:queenAura`

Queen aura regeneration effect on swarm bases.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `affectedBases` | array | Bases receiving regeneration |
| `affectedBases[].baseId` | string | Base ID |
| `affectedBases[].health` | number | New health |
| `affectedBases[].maxHealth` | number | Max health |
| `affectedBases[].x` | number | Base X position |
| `affectedBases[].y` | number | Base Y position |

**Example:**
```javascript
socket.on('swarm:queenAura', (data) => {
  data.affectedBases.forEach(base => {
    updateBaseHealth(base.baseId, base.health, base.maxHealth);
    showHealingParticles(base.x, base.y);
  });
});
```

**Broadcast Frequency:** Throttled (once per second max)

**Related Events:** `swarm:queenSpawn`

---

### `queen:webSnare`

Queen fired web snare attack.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sourceX` | number | Queen X position |
| `sourceY` | number | Queen Y position |
| `targetX` | number | Target X position |
| `targetY` | number | Target Y position |
| `radius` | number | Web area radius |
| `duration` | number | Slow duration (ms) |
| `chargeTime` | number | Charge time before firing |
| `projectileSpeed` | number | Projectile speed |

**Example:**
```javascript
socket.on('queen:webSnare', (data) => {
  playSound('queen_web_snare', data.sourceX, data.sourceY);
  renderWebSnareProjectile(data);
  scheduleWebAreaEffect(data);
});
```

**Related Events:** `player:debuff`

---

### `queen:acidBurst`

Queen fired acid burst attack.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sourceX` | number | Queen X position |
| `sourceY` | number | Queen Y position |
| `targetX` | number | Target X position |
| `targetY` | number | Target Y position |
| `radius` | number | Acid puddle radius |
| `dotDuration` | number | Damage over time duration (ms) |
| `projectileSpeed` | number | Projectile speed |

**Example:**
```javascript
socket.on('queen:acidBurst', (data) => {
  playSound('queen_acid_burst', data.sourceX, data.sourceY);
  renderAcidBurstProjectile(data);
  scheduleAcidPuddleEffect(data);
});
```

**Related Events:** `player:dot`

---

### `queen:phaseChange`

Queen changed combat phase.

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `phase` | string | New phase (HUNT/SIEGE/SWARM/DESPERATION) |
| `x` | number | Queen X position |
| `y` | number | Queen Y position |

**Example:**
```javascript
socket.on('queen:phaseChange', (data) => {
  triggerPhaseTransition(data.x, data.y, data.phase);
  playSound('queen_phase_' + getPhaseNum(data.phase), data.x, data.y);
  showPhaseNotification(data.phase);
});
```

**Related Events:** `swarm:queenSpawn`

---

## Team Events

### `team:creditReward`

Team credit share from assist.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `credits` | number | Credits earned from team kill |
| `totalTeamCredits` | number | Total team credits pool |
| `participantCount` | number | Number of contributors |

**Example:**
```javascript
socket.on('team:creditReward', (data) => {
  console.log(`Team kill! Earned ${data.credits} credits`);
  animateCredits(data.credits);
  showNotification(`Team bonus: ${data.credits} credits`);
});
```

**Related Events:** `loot:complete`, `inventory:update`

---

### `team:lootShare`

Team resource share from NPC kill.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resources` | array | Shared resources |
| `resources[].type` | string | Resource type |
| `resources[].resourceType` | string | Resource type ID |
| `resources[].quantity` | number | Quantity received |
| `resources[].rarity` | string | Rarity tier |
| `rareDropNotification` | array/null | Rare items collector received |
| `collectorId` | string | Collector player ID |

**Example:**
```javascript
socket.on('team:lootShare', (data) => {
  if (data.resources.length > 0) {
    showRewardPopup(data.resources);
  }
  if (data.rareDropNotification) {
    data.rareDropNotification.forEach(rare => {
      showNotification(`Teammate collected ${rare.quantity}x ${rare.resourceType}`);
    });
  }
});
```

**Related Events:** `loot:complete`, `inventory:update`

---

## Utility Events

### `inventory:update`

Player inventory/credits updated.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `inventory` | array | Full inventory array |
| `inventory[].resource_type` | string | Resource type |
| `inventory[].quantity` | number | Quantity owned |
| `credits` | number | Updated credits balance |

**Example:**
```javascript
socket.on('inventory:update', (data) => {
  player.inventory = data.inventory;
  player.credits = data.credits;
  updateInventoryUI();
  syncCreditAnimation();
});
```

**Triggered By:** Mining complete, loot collection, market transactions, upgrades, etc.

---

### `buff:applied`

Buff applied to player.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffType` | string | Buff type (SHIELD_BOOST/SPEED_BURST/DAMAGE_AMP/RADAR_PULSE) |
| `duration` | number | Duration in milliseconds |
| `expiresAt` | number | Expiration timestamp |

**Example:**
```javascript
socket.on('buff:applied', (data) => {
  player.buffs[data.buffType] = {
    expiresAt: data.expiresAt,
    duration: data.duration
  };
  showNotification(`Buff: ${data.buffType}`);
});
```

**Related Events:** `buff:expired`

---

### `buff:expired`

Buff expired.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffType` | string | Expired buff type |

**Example:**
```javascript
socket.on('buff:expired', (data) => {
  delete player.buffs[data.buffType];
  console.log('Buff expired:', data.buffType);
});
```

**Related Events:** `buff:applied`

---

### `relic:collected`

Relic collected.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `relicType` | string | Relic type collected |

**Example:**
```javascript
socket.on('relic:collected', (data) => {
  player.relics.push(data.relicType);
  showRewardPopup([{ type: 'relic', relicType: data.relicType }]);
});
```

**Related Events:** `loot:complete`

---

### `wreckage:spawn`

Wreckage spawned from NPC death.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Wreckage ID |
| `x` | number | X coordinate |
| `y` | number | Y coordinate |
| `faction` | string | NPC faction |
| `npcName` | string | NPC name |
| `contentCount` | number | Number of loot items |
| `despawnTime` | number | Despawn timestamp (ms) |

**Example:**
```javascript
socket.on('wreckage:spawn', (data) => {
  createWreckage(data);
});
```

**Related Events:** `npc:destroyed`, `wreckage:collected`, `wreckage:despawn`

---

### `wreckage:despawn`

Wreckage despawned (timed out).

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Wreckage ID |

**Example:**
```javascript
socket.on('wreckage:despawn', (data) => {
  removeWreckage(data.id);
});
```

**Related Events:** `wreckage:spawn`

---

### `wreckage:collected`

Wreckage collected by player.

**Direction:** Server → Client (broadcast to nearby)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `wreckageId` | string | Wreckage ID |
| `collectedBy` | number | Collector player ID |

**Example:**
```javascript
socket.on('wreckage:collected', (data) => {
  removeWreckage(data.wreckageId);
});
```

**Related Events:** `loot:complete`, `wreckage:spawn`

---

### `formation:leaderChange`

Void faction formation leader changed (succession).

**Direction:** Server → Client (broadcast)

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `newLeaderId` | string | New leader NPC ID |
| `oldLeaderId` | string | Previous leader ID (if any) |
| `formationId` | string | Formation ID |

**Example:**
```javascript
socket.on('formation:leaderChange', (data) => {
  triggerSuccessionEffect(data);
  const newLeader = getNPC(data.newLeaderId);
  newLeader.isFormationLeader = true;
});
```

**Related Events:** `npc:destroyed`

---

### `star:damage`

Star heat damage applied to player.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hull` | number | New hull HP |
| `shield` | number | New shield HP |

**Example:**
```javascript
socket.on('star:damage', (data) => {
  player.hull.current = data.hull;
  player.shield.current = data.shield;
  // Heat overlay handled by StarEffects module
});
```

**Related Events:** `star:zone`, `player:death`

---

### `star:zone`

Star zone change notification.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `zone` | string | Zone name (safe/warm/hot/scorching/lethal) |

**Example:**
```javascript
socket.on('star:zone', (data) => {
  console.log('Star zone:', data.zone);
  // Visual effects handled by StarEffects module
});
```

**Related Events:** `star:damage`

---

### `error:generic`

Generic server error.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | Error message |

**Example:**
```javascript
socket.on('error:generic', (data) => {
  console.error('Server error:', data.message);
  showNotification(data.message, 'error');
});
```

---

### `ping`

Latency measurement request.

**Direction:** Client → Server

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| timestamp | number | Client timestamp (Date.now()) |

**Response:** `pong`

**Example:**
```javascript
socket.emit('ping', Date.now());
```

**Related Events:** `pong`

---

### `pong`

Latency measurement response.

**Direction:** Server → Client

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| timestamp | number | Original timestamp from ping |

**Example:**
```javascript
socket.on('pong', (timestamp) => {
  const latency = Date.now() - timestamp;
  updateLatencyDisplay(latency);
});
```

**Related Events:** `ping`

---

### `disconnect`

Socket disconnected.

**Direction:** Bidirectional (automatic Socket.io event)

**Payload:** Varies by disconnect reason

**Example:**
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showReconnectUI();
});
```

**Related Events:** `connect`, `auth:logout`

---

### `connect`

Socket connected to server.

**Direction:** Bidirectional (automatic Socket.io event)

**Payload:** None

**Example:**
```javascript
socket.on('connect', () => {
  console.log('Connected to server');
  attemptTokenAuth();
});
```

**Related Events:** `disconnect`, `auth:token`

---

## Event Flow Examples

### Complete Login Flow

```javascript
// 1. Client connects
socket.on('connect', () => {
  // 2. Attempt token auth
  const token = localStorage.getItem('galaxy-miner-token');
  if (token) {
    socket.emit('auth:token', { token });
  } else {
    showLoginForm();
  }
});

// 3. Auth success
socket.on('auth:success', (data) => {
  localStorage.setItem('galaxy-miner-token', data.token);
  initializeGame(data.player);
});

// 4. Auth failure - show login
socket.on('auth:error', (error) => {
  showLoginForm();
});
```

### Mining Flow

```javascript
// 1. Start mining
socket.emit('mining:start', { objectId: 'asteroid_123' });

// 2. Mining started
socket.on('mining:started', (data) => {
  startMiningAnimation(data.miningTime);
});

// 3. Mining complete
socket.on('mining:complete', (data) => {
  showNotification(`Mined ${data.quantity}x ${data.resourceName}`);
});

// 4. Inventory updated
socket.on('inventory:update', (data) => {
  player.inventory = data.inventory;
  updateUI();
});

// 5. World updated (asteroid depleted)
socket.on('world:update', (data) => {
  if (data.depleted) {
    markObjectDepleted(data.objectId);
  }
});
```

### Combat and Loot Flow

```javascript
// 1. Fire weapon
socket.emit('combat:fire', { direction: player.rotation });

// 2. Hit NPC
socket.on('combat:npcHit', (data) => {
  if (data.destroyed) {
    // NPC destroyed, wreckage will spawn
  }
});

// 3. Wreckage spawns
socket.on('wreckage:spawn', (data) => {
  createWreckage(data);
});

// 4. Collect wreckage
socket.emit('loot:startCollect', { wreckageId: data.id });

// 5. Collection complete
socket.on('loot:complete', (data) => {
  displayRewards(data.results);
});

// 6. Team members get share
socket.on('team:creditReward', (data) => {
  animateCredits(data.credits);
});

socket.on('team:lootShare', (data) => {
  showResourceRewards(data.resources);
});

// 7. Inventory updated
socket.on('inventory:update', (data) => {
  updateInventory(data.inventory, data.credits);
});
```

### Wormhole Transit Flow

```javascript
// 1. Enter wormhole
socket.emit('wormhole:enter', { wormholeId: 'wormhole_123' });

// 2. Wormhole entered, choose destination
socket.on('wormhole:entered', (data) => {
  showDestinationSelector(data.destinations);
});

// 3. Select destination
socket.emit('wormhole:selectDestination', { destinationId: 'wormhole_456' });

// 4. Transit started
socket.on('wormhole:transitStarted', (data) => {
  showTransitAnimation(data.duration);
});

// 5. Transit complete
socket.on('wormhole:exitComplete', (data) => {
  player.position = data.position;
  hideTransitUI();
});
```

---

## Notes

### Broadcast Ranges

Events are broadcast to players within specific ranges:

- **Radar range**: Base 500 units × tier multiplier
- **Broadcast range**: 2× radar range
- **Global events**: All connected players (chat, market updates, queen events)

### Rate Limiting

Several events have rate limiting:

- `auth:login`: IP-based rate limiting
- `auth:register`: IP-based rate limiting
- `chat:send`: Per-player rate limiting (default 1s cooldown)
- `player:input`: Position saves throttled to 5-second intervals

### Data Persistence

- Position updates saved every 5 seconds
- Chat messages pruned to last N messages (configurable)
- Marketplace listings persist until cancelled or purchased
- Inventory and credits persist to database on changes

### Client-Side Prediction

- `player:input` uses client-side prediction with server reconciliation
- Movement is smoothed on client while awaiting server confirmation
- Server performs sanity checks on velocity/position

### Team Mechanics

- Credits from NPC kills: Split equally among all damage contributors with team bonus multiplier
- Resources: Common/Uncommon split equally, Rare/Ultrarare go to collector only
- Team bonuses: 1 player = 1.0x, 2 players = 1.5x, 3 players = 2.0x, 4+ players = 2.5x

---

## Version Information

**API Version:** 1.0
**Last Updated:** 2025-12-09
**Game Version:** Galaxy Miner Alpha
**Server Tick Rate:** 20 ticks/second
**Client Frame Rate:** 60 FPS (requestAnimationFrame)
