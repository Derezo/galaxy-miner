# AI System Architecture

This document details the modular AI system used for NPC behavior in Galaxy Miner, including faction-specific strategies, the Swarm Queen boss mechanics, and guidance for adding new AI behaviors.

## Overview

Galaxy Miner uses a **Strategy Pattern** for AI, where each NPC faction has a distinct AI strategy that determines movement, targeting, and combat behavior.

```
┌─────────────────────────────────────────────────┐
│              AI Dispatcher (index.js)           │
│    Maps faction → strategy, coordinates AI      │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴────────┬──────────┬──────────┬─────────┐
       │                │          │          │         │
┌──────▼──────┐  ┌──────▼──────┐  │          │         │
│  Flanking   │  │   Swarm     │  │          │         │
│  (Pirates)  │  │ (The Swarm) │  │          │         │
└─────────────┘  └─────────────┘  │          │         │
                                   │          │         │
              ┌──────▼──────┐  ┌──▼─────┐  ┌─▼────────┐
              │ Formation   │  │Retreat │  │Territorial│
              │ (Void)      │  │(Scav.) │  │(Rogue)   │
              └─────────────┘  └────────┘  └──────────┘
```

## AI Strategy Interface

All AI strategies extend the base `AIStrategy` class and implement core methods:

**Location:** `/server/game/ai/index.js`

```javascript
class AIStrategy {
  /**
   * Main update loop - called every server tick (20 tps)
   * @param {Object} npc - The NPC being updated
   * @param {Array} nearbyPlayers - Players within aggro range
   * @param {Array} nearbyAllies - Ally NPCs from same faction
   * @param {number} deltaTime - Time since last update (ms)
   * @param {Object} context - Additional context (base position, etc.)
   * @returns {Object|null} Action to take (fire, retreat, special attack)
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Implemented by each strategy
  }

  /**
   * Select the best target from available players
   * @returns {Object|null} Selected player target
   */
  selectTarget(npc, players) {
    // Default: nearest player
    // Override for faction-specific priority
  }

  /**
   * Calculate movement vector toward/around target
   * @returns {Object} Movement vector { x, y, rotation }
   */
  calculateMovement(npc, target, deltaTime) {
    // Standard movement calculation
  }

  /**
   * Check if NPC should retreat based on health
   * @returns {boolean} True if should retreat
   */
  shouldRetreat(npc) {
    // Faction-specific thresholds
  }

  /**
   * Patrol behavior when no targets
   */
  patrol(npc, deltaTime, context) {
    // Circle around home base
  }

  /**
   * Attempt to fire at target
   * @returns {Object|null} Fire action if successful
   */
  tryFire(npc, target) {
    // Check cooldown and range
  }
}
```

## Faction Strategies

### 1. Flanking Strategy (Pirates)

**File:** `/server/game/ai/flanking.js`
**Faction:** Pirates
**Playstyle:** Coordinated multi-angle attacks

**Key Characteristics:**
- Coordinates with allies to attack from different angles
- Focuses fire on same target for maximum damage
- Retreats at 40% health to home base
- Aggressive but tactical

**Implementation:**

```javascript
class FlankingStrategy {
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // 1. Check retreat condition
    if (this.shouldRetreat(npc)) {
      return this.retreat(npc, deltaTime, context);
    }

    // 2. No targets - patrol
    if (nearbyPlayers.length === 0) {
      this.patrol(npc, deltaTime, context);
      return null;
    }

    // 3. Select target (prefer targets already being attacked)
    const target = this.selectTarget(npc, nearbyPlayers, nearbyAllies);

    // 4. Calculate flanking position
    const flankPosition = this.calculateFlankPosition(npc, target, nearbyAllies);

    // 5. Move to position
    const movement = this.calculateMovement(npc, flankPosition, deltaTime);
    npc.position.x += movement.x;
    npc.position.y += movement.y;

    // 6. Face target and fire
    npc.rotation = Math.atan2(
      target.position.y - npc.position.y,
      target.position.x - npc.position.x
    );

    return this.tryFire(npc, target);
  }
}
```

**Flanking Position Calculation:**

```javascript
calculateFlankPosition(npc, target, allies) {
  // Count allies attacking same target
  const attackingAllies = allies.filter(a => a.targetPlayer === target.id);

  // Determine this NPC's index
  let myIndex = 0;
  for (const ally of attackingAllies) {
    if (ally.id < npc.id) myIndex++;
  }

  // Distribute around target in 270-degree arc
  const totalAttackers = attackingAllies.length + 1;
  const angleSpread = Math.PI * 1.5; // 270 degrees

  // Base angle: opposite side of pirate base
  const baseAngle = Math.atan2(
    npc.homeBasePosition.y - target.position.y,
    npc.homeBasePosition.x - target.position.x
  );

  // Calculate flanking angle for this NPC
  const angleOffset = (myIndex / totalAttackers) * angleSpread - angleSpread / 2;
  const flankAngle = baseAngle + Math.PI + angleOffset;

  // Position at 80% of weapon range
  const attackDist = npc.weaponRange * 0.8;

  return {
    x: target.position.x + Math.cos(flankAngle) * attackDist,
    y: target.position.y + Math.sin(flankAngle) * attackDist
  };
}
```

**Targeting Priority:**

Pirates use **focus fire** - they prioritize targets already being attacked by allies:

```javascript
selectTarget(npc, players, allies) {
  // Count how many allies attack each target
  const targetCounts = new Map();
  for (const ally of allies) {
    if (ally.targetPlayer) {
      targetCounts.set(ally.targetPlayer, (targetCounts.get(ally.targetPlayer) || 0) + 1);
    }
  }

  // Score targets: ally focus + proximity
  let bestTarget = null;
  let bestScore = -1;

  for (const player of players) {
    const allyCount = targetCounts.get(player.id) || 0;
    const proximityScore = 1 - (player.distance / npc.aggroRange);
    const score = allyCount * 2 + proximityScore;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = player;
    }
  }

  return bestTarget;
}
```

### 2. Swarm Strategy (The Swarm)

**File:** `/server/game/ai/swarm.js`
**Faction:** The Swarm
**Playstyle:** Collective behavior with orbiting attacks

**Key Characteristics:**
- Never retreats (fight to the death)
- Shares aggro across all swarm units
- Orbits player group in tightening spiral
- Linked health (20% damage spreads to nearby units)
- Queen boss with phase-based AI

**Implementation:**

```javascript
class SwarmStrategy {
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Special handling for Swarm Queen
    if (npc.type === 'swarm_queen') {
      return this.updateQueenAI(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
    }

    // Never retreat
    npc.state = nearbyPlayers.length > 0 ? 'combat' : 'patrol';

    if (nearbyPlayers.length === 0) {
      this.patrol(npc, deltaTime, context);
      return null;
    }

    // Calculate swarm and target centers
    const swarmCenter = this.calculateSwarmCenter(npc, nearbyAllies);
    const targetCenter = this.calculateTargetCenter(nearbyPlayers);

    // Select target (prioritize damaged players)
    const target = this.selectTarget(npc, nearbyPlayers);

    // Calculate orbiting position
    const orbitPosition = this.calculateOrbitPosition(
      npc, targetCenter, nearbyAllies, deltaTime
    );

    // Move and fire
    const movement = this.calculateMovement(npc, orbitPosition, deltaTime);
    npc.position.x += movement.x;
    npc.position.y += movement.y;

    npc.rotation = Math.atan2(
      targetCenter.y - npc.position.y,
      targetCenter.x - npc.position.x
    );

    return this.tryFire(npc, target);
  }
}
```

**Orbit Calculation:**

Swarm units orbit the center of the player group in a tightening spiral:

```javascript
calculateOrbitPosition(npc, targetCenter, allies, deltaTime) {
  // Determine position in swarm
  let myIndex = 0;
  for (const ally of allies) {
    if (ally.id < npc.id) myIndex++;
  }
  const totalSwarm = allies.length + 1;

  // Initialize orbit radius (starts at 1.2× weapon range)
  npc.orbitRadius = npc.orbitRadius || npc.weaponRange * 1.2;

  // Tighten spiral over time (minimum 60% of weapon range)
  npc.orbitRadius = Math.max(
    npc.weaponRange * 0.6,
    npc.orbitRadius - deltaTime * 0.01
  );

  // Orbit angle (faster units orbit faster)
  npc.orbitAngle = npc.orbitAngle || (myIndex / totalSwarm) * Math.PI * 2;
  const orbitSpeed = 0.8 + (npc.speed / 150) * 0.4;
  npc.orbitAngle += orbitSpeed * (deltaTime / 1000);

  // Distribute evenly around circle
  const baseAngle = (myIndex / totalSwarm) * Math.PI * 2;
  const angle = baseAngle + npc.orbitAngle;

  return {
    x: targetCenter.x + Math.cos(angle) * npc.orbitRadius,
    y: targetCenter.y + Math.sin(angle) * npc.orbitRadius
  };
}
```

**Linked Health System:**

When a swarm unit takes damage, 20% spreads to nearby units within 300 units:

```javascript
static applyLinkedDamage(damagedNpc, damage, allNPCs) {
  const linkedDamage = damage * 0.2;
  const affected = [];

  for (const [id, npc] of allNPCs) {
    if (id === damagedNpc.id) continue;
    if (npc.faction !== 'swarm') continue;

    const dx = npc.position.x - damagedNpc.position.x;
    const dy = npc.position.y - damagedNpc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 300) {
      npc.hull -= linkedDamage;
      affected.push({
        id: npc.id,
        damage: linkedDamage,
        destroyed: npc.hull <= 0
      });
    }
  }

  return affected;
}
```

**Targeting Priority:**

Swarm prioritizes **damaged players** (pack predator behavior):

```javascript
selectTarget(npc, players) {
  // Sort by health percentage (lowest first)
  const sorted = [...players].sort((a, b) => {
    const aHealth = a.hull / a.hullMax;
    const bHealth = b.hull / b.hullMax;
    return aHealth - bHealth;
  });

  return sorted[0]; // Attack weakest player
}
```

### 3. Swarm Queen Boss AI

The Swarm Queen is a multi-phase boss with special attacks and adaptive behavior.

**Phases:**

```javascript
SWARM_QUEEN_PHASES = {
  HUNT: {        // 100-75% health
    minHealth: 0.75,
    speedMultiplier: 2.0,      // Aggressive pursuit
    damageMultiplier: 1.0,
    spawnRateMultiplier: 0.5   // Fewer spawns
  },
  SIEGE: {       // 75-50% health
    minHealth: 0.50,
    speedMultiplier: 0.6,      // Defensive
    damageMultiplier: 0.8,
    spawnRateMultiplier: 2.0   // Double spawns
  },
  SWARM: {       // 50-10% health
    minHealth: 0.10,
    speedMultiplier: 0.8,
    damageMultiplier: 1.2,
    spawnRateMultiplier: 3.0   // Triple spawns
  },
  DESPERATION: { // 10-0% health
    minHealth: 0,
    speedMultiplier: 2.5,      // Berserk
    damageMultiplier: 2.0,     // Double damage
    spawnRateMultiplier: 0     // No spawns, all-in
  }
}
```

**Phase-Based Behavior:**

```javascript
updateQueenAI(queen, nearbyPlayers, nearbyGuards, deltaTime, context) {
  // Update phase based on health
  const phase = this.updateQueenPhase(queen);
  const modifiers = CONSTANTS.SWARM_QUEEN_PHASE_MODIFIERS[phase];

  switch (phase) {
    case 'HUNT':
      return this.huntPhase(queen, nearbyPlayers, deltaTime, modifiers);
    case 'SIEGE':
      return this.siegePhase(queen, nearbyPlayers, nearbyGuards, deltaTime, modifiers);
    case 'SWARM':
      return this.swarmPhase(queen, nearbyPlayers, deltaTime, modifiers);
    case 'DESPERATION':
      return this.desperationPhase(queen, nearbyPlayers, deltaTime, modifiers);
  }
}
```

**Special Attacks:**

**Web Snare** (Crowd Control):
```javascript
tryWebSnare(queen, nearbyPlayers) {
  const config = CONSTANTS.QUEEN_ATTACKS.WEB_SNARE;
  const now = Date.now();

  // Cooldown: 15 seconds (halved in desperation)
  const cooldown = config.cooldown * (queen.desperationCooldownMultiplier || 1);
  if (now - (queen.lastWebSnare || 0) < cooldown) return null;

  // Find players in range (400 units)
  const playersInRange = nearbyPlayers.filter(p => {
    const dist = Math.hypot(p.position.x - queen.position.x, p.position.y - queen.position.y);
    return dist <= config.range;
  });

  if (playersInRange.length === 0) return null;

  // Target center of player group
  const targetCenter = this.calculateTargetCenter(playersInRange);

  queen.lastWebSnare = now;

  return {
    action: 'web_snare',
    sourceX: queen.position.x,
    sourceY: queen.position.y,
    targetX: targetCenter.x,
    targetY: targetCenter.y,
    radius: 150,             // Effect area
    duration: 4000,          // 4 second slow
    slowPercent: 0.6,        // 60% movement reduction
    chargeTime: 1000,        // 1 second charge
    projectileSpeed: 300
  };
}
```

**Acid Burst** (AoE Damage + DoT):
```javascript
tryAcidBurst(queen, nearbyPlayers) {
  const config = CONSTANTS.QUEEN_ATTACKS.ACID_BURST;
  const now = Date.now();

  // Cooldown: 12 seconds
  if (now - (queen.lastAcidBurst || 0) < config.cooldown) return null;

  // Target nearest player in range
  const target = this.findBestAcidTarget(queen, nearbyPlayers, config.range);
  if (!target) return null;

  queen.lastAcidBurst = now;

  return {
    action: 'acid_burst',
    targetX: target.position.x,
    targetY: target.position.y,
    radius: 100,             // Explosion radius
    damage: 15,              // Impact damage
    dotDamage: 5,            // Damage per tick
    dotDuration: 5000,       // 5 second DoT
    dotInterval: 1000        // Tick every second
  };
}
```

**Queen Guard Mode:**

When the queen spawns, nearby swarm NPCs switch to **queen guard** mode, forming a tight protective formation:

```javascript
updateQueenGuard(npc, queen, nearbyPlayers, nearbyGuards, deltaTime) {
  const guardRange = 80;  // Tight orbit
  const orbitSpeed = 2.0; // Fast orbit

  // Calculate guard position in formation
  let myIndex = 0;
  for (const guard of nearbyGuards) {
    if (guard.id < npc.id) myIndex++;
  }

  // Initialize orbit angle
  npc.guardOrbitAngle = npc.guardOrbitAngle || (myIndex / nearbyGuards.length) * Math.PI * 2;
  npc.guardOrbitAngle += orbitSpeed * (deltaTime / 1000);

  // Calculate orbit position
  const orbitX = queen.position.x + Math.cos(npc.guardOrbitAngle) * guardRange;
  const orbitY = queen.position.y + Math.sin(npc.guardOrbitAngle) * guardRange;

  // Check for players too close to queen (intercept!)
  let interceptTarget = null;
  for (const player of nearbyPlayers) {
    const dist = Math.hypot(player.position.x - queen.position.x, player.position.y - queen.position.y);
    if (dist < 120) {
      interceptTarget = player;
      break;
    }
  }

  // Move to intercept or orbit
  const targetX = interceptTarget ? interceptTarget.position.x : orbitX;
  const targetY = interceptTarget ? interceptTarget.position.y : orbitY;

  const dx = targetX - npc.position.x;
  const dy = targetY - npc.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 5) {
    const moveSpeed = npc.speed * (interceptTarget ? 1.5 : 1.2) * (deltaTime / 1000);
    npc.position.x += (dx / dist) * moveSpeed;
    npc.position.y += (dy / dist) * moveSpeed;
  }

  // Fire at nearest threat
  const nearestThreat = this.findNearestTarget(npc, nearbyPlayers);
  return this.tryFire(npc, nearestThreat);
}
```

### 4. Formation Strategy (Void Entities)

**File:** `/server/game/ai/formation.js`
**Faction:** Void Entities
**Playstyle:** Organized formation flying

**Key Characteristics:**
- Maintains V-formation around leader
- Leader is strongest unit or marked as boss
- Retreats at 30% health
- Mysterious and coordinated

**Formation Position Calculation:**

```javascript
getFormationPosition(npc, leader, allies) {
  // Determine position in formation
  let myIndex = 0;
  for (const ally of allies) {
    if (ally.id === leader.id) continue;
    if (ally.id < npc.id) myIndex++;
  }

  // V-formation behind leader
  const spacing = 80;
  const angle = leader.rotation + Math.PI; // Behind
  const side = myIndex % 2 === 0 ? 1 : -1;
  const row = Math.floor(myIndex / 2) + 1;

  return {
    x: leader.position.x + Math.cos(angle + side * 0.4 * row) * spacing * row,
    y: leader.position.y + Math.sin(angle + side * 0.4 * row) * spacing * row
  };
}
```

### 5. Territorial Strategy (Rogue Miners)

**File:** `/server/game/ai/territorial.js`
**Faction:** Rogue Miners
**Playstyle:** Defend claimed territory

**Key Characteristics:**
- Aggressively defends territory around mining claim
- Retreats at 50% health (cautious)
- Prioritizes targets closest to home base
- More aggressive when defending home

**Territorial Targeting:**

```javascript
selectTerritorialTarget(npc, players, context) {
  // Score based on proximity to home base (defend territory)
  let bestTarget = null;
  let bestScore = Infinity;

  for (const player of players) {
    const distFromHome = Math.hypot(
      player.position.x - context.homeBase.x,
      player.position.y - context.homeBase.y
    );

    if (distFromHome < bestScore) {
      bestScore = distFromHome;
      bestTarget = player;
    }
  }

  return bestTarget;
}
```

### 6. Retreat Strategy (Scavengers)

**File:** `/server/game/ai/retreat.js`
**Faction:** Scavengers
**Playstyle:** Hit-and-run, flee when damaged

**Key Characteristics:**
- Retreats at 20% health (low threshold)
- Opportunistic - attacks vulnerable targets
- Fast evasion when retreating
- Cowardly but resourceful

## Rage Mode (Orphaned NPCs)

When an NPC's home base is destroyed, it enters **rage mode** - a special state where it ignores its faction AI and relentlessly pursues players.

**Activation:**

```javascript
// When base destroyed in /server/game/npc.js
function destroyBase(baseId) {
  const base = activeBases.get(baseId);
  if (!base) return;

  // Find all NPCs spawned by this base
  for (const [npcId, npc] of activeNPCs) {
    if (npc.homeBaseId === baseId) {
      npc.orphaned = true;
      npc.state = 'rage';
      npc.rageMultiplier = 1.5; // 50% damage bonus
      npc.orphanCenter = { ...npc.position };
    }
  }

  activeBases.delete(baseId);
}
```

**Rage Behavior:**

```javascript
function handleRageMode(npc, allPlayers, deltaTime) {
  // Find nearest player (extended aggro range)
  const target = findNearestPlayer(npc, allPlayers, npc.aggroRange * 1.5);

  if (!target) {
    // No target - patrol angrily around last position
    patrol(npc, deltaTime);
    return null;
  }

  // Aggressive pursuit (20% faster)
  const dx = target.position.x - npc.position.x;
  const dy = target.position.y - npc.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  npc.rotation = Math.atan2(dy, dx);

  if (dist > npc.weaponRange * 0.7) {
    const moveSpeed = npc.speed * 1.2 * (deltaTime / 1000);
    npc.position.x += (dx / dist) * moveSpeed;
    npc.position.y += (dy / dist) * moveSpeed;
  }

  // Fire more frequently (800ms cooldown instead of 1000ms)
  const canFire = Date.now() - (npc.lastFireTime || 0) > 800;

  if (canFire && dist <= npc.weaponRange) {
    npc.lastFireTime = Date.now();
    return {
      action: 'fire',
      target: target,
      baseDamage: npc.weaponDamage * npc.rageMultiplier // +50% damage
    };
  }

  return null;
}
```

## AI Dispatcher

**Location:** `/server/game/ai/index.js`

The dispatcher routes NPCs to their appropriate strategy and handles special cases:

```javascript
function updateNPCAI(npc, allPlayers, allNPCs, deltaTime) {
  // Special handling for orphaned NPCs
  if (npc.orphaned && npc.state === 'rage') {
    return handleRageMode(npc, allPlayers, deltaTime);
  }

  // Get faction strategy
  const strategy = getStrategy(npc);

  // Find players in aggro range
  const nearbyPlayers = allPlayers.filter(player => {
    const dist = Math.hypot(
      player.position.x - npc.position.x,
      player.position.y - npc.position.y
    );
    return dist <= npc.aggroRange;
  });

  // Find nearby allies (same faction, within 500 units)
  const nearbyAllies = Array.from(allNPCs.values()).filter(ally => {
    if (ally.id === npc.id) return false;
    if (ally.faction !== npc.faction) return false;
    const dist = Math.hypot(
      ally.position.x - npc.position.x,
      ally.position.y - npc.position.y
    );
    return dist <= 500;
  });

  // Build context
  const context = {
    homeBase: npc.homeBasePosition,
    patrolRadius: npc.patrolRadius || 600,
    territoryRadius: npc.territoryRadius || 500
  };

  // Execute strategy
  return strategy.update(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
}
```

## Adding New AI Behaviors

To add a new faction with custom AI:

### 1. Create Strategy File

Create `/server/game/ai/my-faction.js`:

```javascript
class MyFactionStrategy {
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Implement custom behavior
    if (nearbyPlayers.length === 0) {
      this.patrol(npc, deltaTime, context);
      return null;
    }

    const target = this.selectTarget(npc, nearbyPlayers);
    const movement = this.calculateMovement(npc, target.position, deltaTime);

    npc.position.x += movement.x;
    npc.position.y += movement.y;

    return this.tryFire(npc, target);
  }

  selectTarget(npc, players) {
    // Custom targeting logic
    return players[0];
  }

  calculateMovement(npc, target, deltaTime) {
    // Custom movement logic
    const dx = target.x - npc.position.x;
    const dy = target.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveSpeed = npc.speed * (deltaTime / 1000);

    return {
      x: (dx / dist) * moveSpeed,
      y: (dy / dist) * moveSpeed
    };
  }

  patrol(npc, deltaTime, context) {
    // Custom patrol logic
  }

  tryFire(npc, target) {
    if (!target) return null;

    const dist = Math.hypot(
      target.position.x - npc.position.x,
      target.position.y - npc.position.y
    );

    const canFire = Date.now() - (npc.lastFireTime || 0) > 1000;

    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();
      return {
        action: 'fire',
        target,
        weaponType: npc.weaponType,
        baseDamage: npc.weaponDamage
      };
    }

    return null;
  }
}

module.exports = MyFactionStrategy;
```

### 2. Register Strategy

Add to `/server/game/ai/index.js`:

```javascript
const MyFactionStrategy = require('./my-faction');

const FACTION_STRATEGIES = {
  pirate: 'flanking',
  scavenger: 'retreat',
  swarm: 'swarm',
  void: 'formation',
  rogue_miner: 'territorial',
  my_faction: 'my_faction'  // Add new mapping
};

const strategies = {
  flanking: new FlankingStrategy(),
  swarm: new SwarmStrategy(),
  formation: new FormationStrategy(),
  territorial: new TerritorialStrategy(),
  retreat: new RetreatStrategy(),
  my_faction: new MyFactionStrategy()  // Add new instance
};
```

### 3. Add Faction Constants

Add to `/shared/constants.js`:

```javascript
NPC_FACTIONS: {
  MY_FACTION: {
    id: 'my_faction',
    name: 'My Faction',
    color: '#00ff00',
    secondaryColor: '#00cc00',
    spawnHub: 'my_faction_base',
    spawnRate: 20,
    patrolRadius: 4,
    retreatThreshold: 0.35,
    aiStrategy: 'my_faction',
    weaponType: 'my_weapon',
    deathEffect: 'my_explosion'
  }
}
```

### 4. Create Spawn Hub

Add to `SPAWN_HUB_TYPES` in `/shared/constants.js`:

```javascript
SPAWN_HUB_TYPES: {
  my_faction_base: {
    id: 'my_faction_base',
    name: 'My Faction Base',
    faction: 'my_faction',
    health: 1500,
    size: 120,
    respawnTime: 300000,
    spawnChance: 0.05,
    patrolRadius: 4
  }
}
```

### 5. Implement Graphics

Add rendering in `/client/js/graphics/npc-ships.js`:

```javascript
function drawMyFactionShip(ctx, npc, screenX, screenY) {
  const palette = CONSTANTS.FACTION_COLOR_PALETTES.my_faction;

  // Custom ship rendering
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(npc.rotation);

  // Ship body
  ctx.fillStyle = palette.primary;
  ctx.fillRect(-10, -8, 20, 16);

  // Accents
  ctx.fillStyle = palette.accent;
  ctx.fillRect(-12, -2, 4, 4);

  ctx.restore();
}
```

## Performance Considerations

### AI Budget

Each AI update should complete in **< 1ms** to maintain 20 tps with 100 NPCs:

```
20 tps = 50ms per tick
100 NPCs × 1ms = 100ms total AI time (too slow!)

Optimization: Only update NPCs near players
- Typical: 5-15 active NPCs per player
- Budget: 15 NPCs × 1ms = 15ms (acceptable)
```

### Optimization Tips

1. **Proximity Checks:** Use sector grid for fast neighbor lookups
2. **Avoid Square Roots:** Use `distSquared` for comparisons
3. **Cache Calculations:** Store patrol angles, formation positions
4. **Throttle Updates:** Update distant NPCs less frequently
5. **Early Exits:** Return quickly when no targets nearby

### Profiling AI Performance

```javascript
// Add timing to AI dispatcher
function updateNPCAI(npc, allPlayers, allNPCs, deltaTime) {
  const startTime = performance.now();

  const result = strategy.update(npc, nearbyPlayers, nearbyAllies, deltaTime, context);

  const elapsed = performance.now() - startTime;
  if (elapsed > 2) {
    console.warn(`Slow AI update for ${npc.faction} NPC: ${elapsed.toFixed(2)}ms`);
  }

  return result;
}
```

## Testing AI Behaviors

### Spawn Test NPCs

```javascript
// In server console or test script
const { spawnNPC } = require('./server/game/npc');

// Spawn pirate at position
spawnNPC({
  faction: 'pirate',
  type: 'pirate_fighter',
  position: { x: 1000, y: 1000 },
  tier: 3
});

// Spawn swarm queen
spawnNPC({
  faction: 'swarm',
  type: 'swarm_queen',
  position: { x: 2000, y: 2000 },
  isBoss: true
});
```

### Debug AI State

```javascript
// Add debug logging to strategies
update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
  if (process.env.DEBUG_AI) {
    console.log(`[${npc.id}] State: ${npc.state}, Targets: ${nearbyPlayers.length}, Allies: ${nearbyAllies.length}`);
  }

  // ... rest of update logic
}
```

---

**See Also:**
- [overview.md](./overview.md) - System architecture
- [game-loop.md](./game-loop.md) - Game loop details
- `/server/game/ai/` - AI strategy implementations
