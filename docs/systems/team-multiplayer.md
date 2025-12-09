# Team Multiplayer System

Cooperative gameplay mechanics for shared loot, damage credit, and team bonuses.

## Table of Contents

- [Overview](#overview)
- [Team Loot Distribution](#team-loot-distribution)
- [Damage Contribution System](#damage-contribution-system)
- [Team Multipliers](#team-multipliers)
- [Credit Distribution](#credit-distribution)
- [Resource Distribution](#resource-distribution)
- [Implementation Details](#implementation-details)

## Overview

Galaxy Miner implements a **team loot system** where players who contribute damage to NPCs share the rewards when wreckage is collected. There is no formal "party" or "team formation" system—teams are automatically created based on **damage contribution**.

### Key Features

- **Automatic Teaming**: Players who damage the same NPC become temporary teammates
- **Damage Tracking**: Server tracks each player's damage contribution
- **Shared Credits**: Credits distributed proportionally based on damage dealt
- **Rarity-Based Resource Distribution**: Common/uncommon split, rare/ultrarare to collector only
- **Team Bonus Multipliers**: More participants = higher total rewards

### No Formal Teams

Unlike traditional MMOs, Galaxy Miner does not have:
- Team invitations or party UI
- Team chat channels
- Shared health pools
- Friendly fire protection

**Damage contribution = team membership.** Attack the same target, share the loot.

## Team Loot Distribution

When an NPC dies, it creates **wreckage** containing:

1. **Credits** (base reward from NPC tier/faction)
2. **Resources** (random drops based on NPC type)
3. **Optional**: Buffs, components, relics (rare)

### Distribution Rules

| Item Type | Distribution Method |
|-----------|---------------------|
| Credits | Proportional to damage dealt (with team multiplier) |
| Common Resources | Split equally among all contributors |
| Uncommon Resources | Split equally among all contributors |
| Rare Resources | Collector only (teammates notified) |
| Ultrarare Resources | Collector only (teammates notified) |
| Buffs | Collector only |
| Components | Collector only |
| Relics | Collector only |

### Example: 3-Player Kill

**Scenario:**
- NPC has 100 HP
- Player A deals 50 damage (50%)
- Player B deals 30 damage (30%)
- Player C deals 20 damage (20%)
- Wreckage contains: 100 credits, 10 Iron (common), 5 Platinum (rare)

**Distribution:**
1. **Credits** (with 2.0x team multiplier for 3 players):
   - Total pool: 100 × 2.0 = 200 credits
   - Player A: 200 × 0.50 = 100 credits
   - Player B: 200 × 0.30 = 60 credits
   - Player C: 200 × 0.20 = 40 credits

2. **Iron (common, split equally)**:
   - Player A: 3 Iron (4 if rounding)
   - Player B: 3 Iron
   - Player C: 3 Iron
   - (10 total: 3+3+4 = 10, extra to player with highest damage)

3. **Platinum (rare, collector only)**:
   - Whoever collects wreckage gets 5 Platinum
   - Other players see notification: "Teammate found Platinum x5!"

## Damage Contribution System

### Tracking

The server maintains a **damage contribution map** for each NPC:

```javascript
// /server/game/engine.js - NPC object
npc.damageContributors = {
  123: 50,  // userId: damageAmount
  456: 30,
  789: 20
};
```

### Recording Damage

```javascript
// /server/handlers/combat.js - combat:hit handler
const npc = engine.getNPC(data.targetId);

// Record damage contribution
if (!npc.damageContributors) {
  npc.damageContributors = {};
}
npc.damageContributors[shooterId] = (npc.damageContributors[shooterId] || 0) + damage;
```

### Wreckage Metadata

When NPC dies, damage contributors are stored in wreckage:

```javascript
// /server/game/npc.js - createWreckage()
const wreckage = {
  id: generateId(),
  position: npc.position,
  faction: npc.faction,
  npcName: npc.name,
  contents: lootContents,
  damageContributors: npc.damageContributors,  // Stored here!
  creditReward: baseCredits,
  despawnTime: Date.now() + WRECKAGE_DESPAWN_TIME
};
```

## Team Multipliers

Team size determines the **credit multiplier** applied to the base reward:

```javascript
// /shared/constants.js
TEAM_MULTIPLIERS: {
  1: 1.0,   // Solo: 100% of base credits
  2: 1.5,   // Duo: 150% total (75% each if equal damage)
  3: 2.0,   // Trio: 200% total
  4: 2.5    // Squad: 250% total (max)
}
```

### Examples

**Solo Kill (1 player):**
- Base reward: 100 credits
- Multiplier: 1.0x
- Total: 100 credits
- Player gets: 100 credits

**Duo Kill (2 players, 50-50 damage):**
- Base reward: 100 credits
- Multiplier: 1.5x
- Total: 150 credits
- Each player gets: 75 credits

**Trio Kill (3 players, 40-40-20 damage):**
- Base reward: 100 credits
- Multiplier: 2.0x
- Total: 200 credits
- Player A: 200 × 0.40 = 80 credits
- Player B: 200 × 0.40 = 80 credits
- Player C: 200 × 0.20 = 40 credits

**Squad Kill (4+ players):**
- Base reward: 100 credits
- Multiplier: 2.5x (capped at 4)
- Total: 250 credits
- Distributed proportionally

### Rationale

Team multipliers **encourage cooperation** without punishing solo players:

- Solo players get 100% of base reward (no penalty)
- Teams get bonus total rewards split proportionally
- High-contribution players still earn more than low-contribution
- 4+ players capped to prevent exploitation

## Credit Distribution

### Implementation

```javascript
// /server/handlers/loot.js - distributeTeamCredits()
function distributeTeamCredits(baseCredits, damageContributors, collectorId, io, userSockets) {
  const participants = Object.keys(damageContributors);
  const participantCount = participants.length;

  // Apply team multiplier
  const teamMultiplier = config.TEAM_MULTIPLIERS[Math.min(participantCount, 4)] || 2.5;
  const totalCredits = Math.floor(baseCredits * teamMultiplier);

  // Calculate total damage
  const totalDamage = Object.values(damageContributors).reduce((sum, dmg) => sum + dmg, 0);

  const distributed = [];

  for (const [userIdStr, damage] of Object.entries(damageContributors)) {
    const userId = parseInt(userIdStr, 10);
    const proportion = damage / totalDamage;
    const playerCredits = Math.floor(totalCredits * proportion);

    // Add credits to database
    const ship = statements.getShipByUserId.get(userId);
    if (ship) {
      const newCredits = getSafeCredits(ship) + playerCredits;
      safeUpdateCredits(newCredits, userId);

      distributed.push({ playerId: userId, credits: playerCredits });

      // Notify player
      const socketId = userSockets.get(userId);
      if (socketId && userId !== collectorId) {
        io.to(socketId).emit('loot:teamShare', {
          credits: playerCredits,
          yourDamage: damage,
          totalDamage: totalDamage,
          teamSize: participantCount
        });
      }
    }
  }

  return {
    total: totalCredits,
    collectorCredits: distributed.find(d => d.playerId === collectorId)?.credits || 0,
    distributed
  };
}
```

### Player Notification

When a teammate contributes to a kill, they receive:

```javascript
socket.on('loot:teamShare', ({ credits, yourDamage, totalDamage, teamSize }) => {
  console.log(`Team kill! You earned ${credits} credits (${yourDamage}/${totalDamage} damage, ${teamSize} players)`);
});
```

## Resource Distribution

### By Rarity

```javascript
// /server/handlers/loot.js - distributeTeamResources()
function distributeTeamResources(contents, damageContributors, collectorId, io, userSockets) {
  const participants = Object.keys(damageContributors);
  const participantCount = participants.length;

  const collectorLoot = [];
  const teamNotifications = [];

  for (const item of contents) {
    if (item.type === 'resource') {
      const rarity = getRarity(item.resourceType);

      if (rarity === 'common' || rarity === 'uncommon') {
        // Split equally among all contributors
        const perPlayer = Math.floor(item.quantity / participantCount);
        const remainder = item.quantity % participantCount;

        for (const [userIdStr, damage] of Object.entries(damageContributors)) {
          const userId = parseInt(userIdStr, 10);
          let share = perPlayer;

          // Give remainder to highest damage contributor
          if (remainder > 0 && userId === getHighestDamagePlayer(damageContributors)) {
            share += remainder;
          }

          // Add to inventory
          safeUpsertInventory(userId, item.resourceType, share);

          if (userId === collectorId) {
            collectorLoot.push({ type: 'resource', resourceType: item.resourceType, quantity: share });
          }
        }
      } else if (rarity === 'rare' || rarity === 'ultrarare') {
        // Collector only, notify teammates
        collectorLoot.push(item);

        teamNotifications.push({
          type: 'rare_drop',
          resourceType: item.resourceType,
          quantity: item.quantity,
          rarity
        });
      }
    } else {
      // Buffs, components, relics always go to collector
      collectorLoot.push(item);
    }
  }

  // Notify teammates of rare drops
  for (const [userIdStr] of Object.entries(damageContributors)) {
    const userId = parseInt(userIdStr, 10);
    if (userId !== collectorId) {
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit('loot:teamNotification', {
          rareDrops: teamNotifications
        });
      }
    }
  }

  return {
    collectorLoot,
    rareDropNotifications: teamNotifications
  };
}
```

### Rationale

**Why split common/uncommon?**
- Encourages team play (everyone gets baseline resources)
- Prevents "loot ninjas" (race to collect wreckage)
- Fair distribution for resource grinding

**Why collector-only rare/ultrarare?**
- Rewards the risk of collecting (must approach wreckage)
- Maintains value of rare drops (not diluted across team)
- Creates emergent gameplay (who collects high-value wreckage?)

## Implementation Details

### Server Flow

```
1. NPC takes damage
   ├─ Record damage contributor (userId → damage)
   └─ Update npc.damageContributors map

2. NPC dies
   ├─ Generate loot contents
   ├─ Calculate base credit reward
   ├─ Create wreckage with damageContributors metadata
   └─ Broadcast wreckage spawn

3. Player starts collecting wreckage
   ├─ Validate range and ownership
   └─ Begin collection progress (locked to player)

4. Collection completes
   ├─ Calculate team multiplier (based on contributor count)
   ├─ Distribute credits proportionally
   ├─ Distribute common/uncommon resources equally
   ├─ Give rare/ultrarare to collector only
   ├─ Update all player inventories/credits in database
   ├─ Notify all contributors via socket events
   └─ Remove wreckage from world
```

### Database Transactions

Credit and resource distribution uses **atomic transactions** to prevent:

- Race conditions (multiple collectors)
- Partial updates (credit transfer but not resources)
- Data loss (server crash during distribution)

```javascript
// /server/database.js - Transaction helpers
const distributeLoot = db.transaction((wreckage, collectorId) => {
  // All credit updates and inventory inserts happen atomically
  // Either all succeed or all rollback
});
```

### Edge Cases

**1. Collector didn't contribute damage:**

- Collector still receives rare/ultrarare resources
- Credits distributed to damage contributors only
- Common/uncommon resources to contributors only
- Collector gets wreckage notification but no share

**2. Contributor offline when collected:**

- Credits and resources added to offline player's account
- Notification queued for next login (not implemented in MVP)

**3. NPC despawns before collection:**

- No loot distributed
- Wreckage auto-despawns after 2 minutes (WRECKAGE_DESPAWN_TIME)

**4. Solo player collects team kill:**

- Receives full rare/ultrarare loot
- Credits/common resources already distributed to contributors
- Only gets collector's proportional share

## Configuration

### Constants

```javascript
// /shared/constants.js
TEAM_MULTIPLIERS: {
  1: 1.0,   // Solo
  2: 1.5,   // Duo
  3: 2.0,   // Trio
  4: 2.5    // Squad (max)
}

WRECKAGE_DESPAWN_TIME: 120000  // 2 minutes
```

### Rarity Definitions

```javascript
// /shared/constants.js - RESOURCE_TYPES
IRON: { rarity: 'common', ... }
PLATINUM: { rarity: 'rare', ... }
ANTIMATTER: { rarity: 'ultrarare', ... }
```

## Player Experience

### Solo Player

- Kills NPC alone → 100% base credits
- Collects wreckage → 100% resources
- No team notifications

### Duo Players

- Both attack NPC → total 150% base credits (split by damage)
- Common/uncommon resources split 50-50
- Rare drops to whoever collects (other player sees "Teammate found X")

### Large Group (4+ players)

- Maximum 250% base credits total
- More resource types split among team
- Rare drops create interesting "who collects?" gameplay

## UI/UX Considerations

### Current Implementation

**Team notifications are minimal:**

- Socket event: `loot:teamShare` (credits earned)
- Socket event: `loot:teamNotification` (rare drop by teammate)
- No team HUD, member list, or damage meters

### Future Enhancements

- Team damage meter UI (show contributions)
- Loot split preferences (agree before collection)
- Team chat channel (temporary, based on recent co-op)
- Loot roll system (all roll for rare drops)

## Testing Team Mechanics

### Manual Test Scenario

```javascript
// 1. Two players attack same NPC
// Player A
socket.emit('combat:fire', { targetId: 'npc-123', ... });

// Player B
socket.emit('combat:fire', { targetId: 'npc-123', ... });

// 2. NPC dies, creates wreckage
// Server broadcasts: wreckage:spawn

// 3. Player A collects
socket.emit('loot:startCollect', { wreckageId: 'wreck-456' });

// 4. Check results
socket.on('loot:complete', ({ contents, results, teamCredits }) => {
  console.log('Collected:', contents);
  console.log('My portion:', results);
  console.log('Team total credits:', teamCredits);
});

// Player B receives:
socket.on('loot:teamShare', ({ credits }) => {
  console.log('Team share:', credits);
});
```

## Related Files

- `/server/handlers/loot.js` - Team distribution logic
- `/server/handlers/combat.js` - Damage contribution tracking
- `/server/game/npc.js` - Wreckage creation
- `/server/game/engine.js` - NPC state management
- `/shared/constants.js` - Team multipliers
- `/server/database.js` - Transaction helpers

## See Also

- [Combat System](../api/socket-events.md#combat-events) - Damage mechanics
- [Loot System](loot-pools.md) - Wreckage contents
- [NPC Factions](npc-factions.md) - NPC credit rewards
- [Resources](resources.md) - Resource rarities
