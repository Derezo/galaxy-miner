# NPC Factions System

## Overview

Galaxy Miner features 5 distinct NPC factions, each with unique behaviors, AI strategies, visual designs, and loot pools. Factions spawn from procedurally-placed bases and patrol defined territories, creating dynamic PvE encounters throughout the galaxy.

## Faction Roster

| Faction | Live strategy | Signature behavior | Spawn hub | Spawn rate |
|---------|---------------|--------------------|-----------|------------|
| Pirates | Pirate role strategy | Scouts gather intel; fighters dive; captains raid; Dreadnoughts rampage | Pirate Outpost | 1 per 15 sectors |
| Scavengers | Scavenging strategy | Collect wreckage while passive; rage when provoked | Scavenger Yard | 1 per 25 sectors |
| Swarm | Swarm strategy | Never retreats; linked health, assimilation, Queen phases | Swarm Hive | 1 per 50 sectors (rare) |
| Void Entities | Formation strategy | Formation succession, coordinated fire, Leviathan abilities | Void Rift | 1 per 40 sectors |
| Rogue Miners | Mining strategy | Mine and deposit resources; claim-wide rage when attacked | Mining Claim | 1 per 20 sectors |

`server/game/ai/index.js` is the strategy router. The older generic flanking,
retreat, and territorial strategies remain available as reusable modules, but
Pirates, Scavengers, and Rogue Miners use their dedicated `pirate`,
`scavenger`, and `mining` strategies in live faction dispatch.

## Pirates

### Identity
**Aggressive raiders** who attack from multiple angles using coordinated flanking tactics. Known for hit-and-run strikes on miners and traders.

### Visual Design
- **Colors**: Red/orange (primary: #ff3300, accent: #ff6600)
- **Ship Style**: Angular, aggressive designs with weapon pods
- **Weapon Visual**: Orange cannon projectiles with trails
- **Death Effect**: Violent explosion with orange/red particles

### AI Strategy: Espionage and Raids

**Behavior** (`/server/game/ai/pirate.js`):
1. **Scouts** patrol away from the outpost, observe targets, and return with
   short-lived intel.
2. **Fighters** use circling and boost-dive attack phases against reported or
   nearby targets.
3. **Captains** spawn from delivered intel, raid aggressively, and return to
   their base to heal when badly damaged.
4. **Dreadnoughts** spawn once per outpost lifecycle at 25% base health, have a
   35% damage-negation chance, and enter a permanent enraged rampage if their
   outpost is destroyed.
5. Every Pirate weapon bypasses 10% of shields. Pirates can also steal from
   Scavenger scrap piles and Rogue Miner claim-credit reserves.
6. Scout and Captain intel retains an explicit player/NPC target type. Fighters
   and Scouts close to a range derived from their equipped weapon before firing,
   so non-player raids use the same authoritative combat path as player raids.
7. Player snapshots are distance-ranked before direct engagement. Captains
   refresh moving base coordinates and abandon destroyed or exhausted,
   undefended raid targets after the bounded target-memory window.

**Combat Stats** (example: Pirate Captain):
```javascript
{
  hull: 200,
  shield: 100,
  speed: 90,
  weaponType: 'pirate_heavy_blaster',
  weaponDamage: 22,
  weaponRange: 300,
  aggroRange: 600
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Range | Credits |
|------|------|------|--------|-------|--------|-------|---------|
| Pirate Scout | Low | 40 | 20 | 130 | 5 | 200 | 30 |
| Pirate Fighter | Mid | 100 | 50 | 110 | 12 | 280 | 80 |
| Pirate Captain | High | 200 | 100 | 90 | 22 | 300 | 220 |
| Pirate Dreadnought | Boss | 600 | 0 | 180 | 65 | 1,400 | 800 |

### Spawn Mechanics

**Base**: Pirate Outpost
- Health: 2000
- Size: 150 units
- Patrol Radius: 5 sectors (5000 units)
- Respawn Time: 5 minutes after destruction
- Initial Spawn: 2 Fighters
- Max regular population: 4 Fighters
- Regular Spawn Cooldown: 30 seconds
- Strategic Placement: Outer asteroid belts (ambush points)

**Role Spawns**:
- Up to 2 Scouts spawn 600 units from the outpost, with a 45-second cooldown.
- Up to 2 Captains can be created when Scouts return with valid intel.
- One Dreadnought can spawn per base lifecycle when the outpost reaches 25%
  health.

### Loot Drops

**Resources**: Balanced industrial materials
- Common: Iron, Carbon, Nickel
- Uncommon: Copper, Titanium, Helium-3
- Rare: Platinum, Dark Matter, Quantum Crystals
- Ultrarare: Exotic Matter, Antimatter

**Special**: Shield Boost, Speed Burst, Damage Amp buffs; Engine Core, Weapon Matrix components; Pirate Treasure and Skull and Bones boss-relic pool. Pirate Dreadnought loot guarantees Skull and Bones, and a destroyed Pirate Outpost has an additional 5% Pirate Treasure roll.

## Scavengers

### Identity
**Opportunistic salvagers** who avoid direct combat, preferring to flee and return later. They pick through wreckage and scavenge resources.

### Visual Design
- **Colors**: Rusty browns/grays (primary: #999966, accent: #cccc88)
- **Ship Style**: Asymmetrical, patched-together designs
- **Weapon Visual**: Flickering yellow jury-rigged lasers
- **Death Effect**: Breaking apart into scrap debris

### AI Strategy: Scavenging and Provocation

**Behavior** (`/server/game/ai/scavenger.js`):
1. **Salvage loop**: Passive units seek unreserved wreckage, collect it, return
   to their yard, and deposit the contents into its finite scrap pile.
2. **Provocation**: Attacking a Scavenger, or collecting nearby wreckage
   without Scrap Siphon immunity, enrages its local group. A player attacker is
   retained beyond passive detection only while the explicit 1,000-unit rage
   contract remains active; leaving that range clears the target.
3. **Hauler lifecycle**: Three deposited wreckages start a four-second Hauler
   transformation at the yard. A Hauler grows as it collects wreckage and
   becomes the Barnacle King after five pieces.
4. **Reservation safety**: Scavengers cannot consume wreckage that still has a
   player-bound pending credit share.
5. **Boss telegraph**: The Barnacle King's lethal boring drill has a 1.5-second
   server-authoritative charge broadcast to nearby clients.

**Tactical Patterns**:
- Ignore neutral players while harvesting the battlefield
- Spread rage through the nearby Scavenger group when provoked
- Use the Hauler's close-range loader slam only after it becomes hostile
- Give the Barnacle King charge telegraph space instead of staying in drill range

**Combat Stats** (example: Scavenger Hauler):
```javascript
{
  hull: 180,
  shield: 0,
  speed: 50,
  weaponType: 'energy',
  weaponDamage: 50,
  weaponRange: 35,
  aggroRange: 450
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Range | Credits |
|------|------|------|--------|-------|--------|-------|---------|
| Scavenger Scrapper | Low | 40 | 0 | 90 | 4 | 180 | 20 |
| Scavenger Salvager | Low | 70 | 0 | 80 | 6 | 200 | 45 |
| Scavenger Collector | Mid | 100 | 0 | 70 | 8 | 220 | 90 |
| Scavenger Hauler | High | 180 | 0 | 50 | 50 | 35 | 180 |
| Barnacle King | Boss | 25,000 | 0 | 15 | Lethal drill | 50 | 5,000 |

**Note**: The Hauler is high-tier but is not a boss. The Barnacle King
transformation replaces that same live base-population slot and preserves its
carried wreckage.

The Barnacle King is the faction boss. Its lethal boring-drill attack has a
1.5-second server-authoritative charge; nearby clients receive a spatial
`scavenger:drillCharge` telegraph with the king and target IDs so the attack is
avoidable on both desktop and mobile.

### Spawn Mechanics

**Base**: Scavenger Yard
- Health: 1000
- Size: 100 units
- Patrol Radius: 2 sectors (2000 units)
- Respawn Time: 3 minutes
- Initial Spawn: 2 NPCs
- Max regular population: 3 NPCs, plus one Hauler/Barnacle King lifecycle slot
- Spawn Cooldown: 45 seconds
- Strategic Placement: Between star systems (debris fields)

**Spawn Pool**:
- 45% Scrappers
- 35% Salvagers
- 20% Collectors

### Loot Drops

**Resources**: Scavenged components and salvage
- Common: Iron, Nickel, Silicon
- Uncommon: Copper, Silver, Cobalt, Lithium
- Rare: Gold, Platinum, Iridium
- Ultrarare: Exotic Matter

**Special**: Shield Boost, Speed Burst buffs; Mining Capacitor, Engine Core components; Pirate Treasure, Ancient Star Map, and Scrap Siphon boss-relic pool. Barnacle King loot guarantees Scrap Siphon.

## The Swarm

### Identity
**Hive-mind bio-organic collective** that never retreats. Linked health system where damage spreads to nearby units. Can assimilate enemy bases and spawn Swarm Queen boss.

### Visual Design
- **Colors**: Black hull with crimson accents (primary: #1a1a1a, accent: #8b0000)
- **Ship Style**: Organic, spider-like creatures with segmented bodies
- **Weapon Visual**: Dark crimson energy bolts with void tears
- **Death Effect**: Dissolve into black/crimson particles
- **Special**: Hatching from eggs (2.5 second emergence)

### AI Strategy: Swarm

**Behavior** (`/server/game/ai/swarm.js`):
1. **Never Retreat**: Fights to the death, no health threshold
2. **Collective Targeting**: All units focus damaged targets
3. **Orbital Attack**: Circle around player group in coordinated spiral
4. **Linked Health**: 20% damage spreads to units within 300 units
5. **Queen Guard**: Forms tight protective formation around queen when present

**Assimilation Mechanics**:
- Drones seek enemy bases when no players nearby
- 3 drones attach to base simultaneously to convert it
- Assimilated base spawns swarm units and keeps original position
- Converted defenders immediately receive their complete Swarm identity/stats;
  old faction AI, Void formation authority, and persistent Void effects are
  retired instead of waiting for a periodic client refresh
- Attached worms remain targetable but non-combat, and preserve their local
  offset as an assimilated orbital base moves
- 3+ assimilated bases within 10km spawns Swarm Queen

**Tactical Patterns**:
- Swarm circles target group
- Gradually tightens spiral
- Fast fire rate (0.8s cooldown)
- Linked damage punishes AoE

**Combat Stats** (example: Swarm Warrior):
```javascript
{
  hull: 158,
  shield: 39,
  speed: 110,
  weaponType: 'explosive',
  weaponDamage: 10,
  weaponRange: 220,
  aggroRange: 600,
  retreatThreshold: 0,  // Never retreats
  linkedHealth: true
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Credits | Special |
|------|------|------|--------|-------|--------|---------|---------|
| Swarm Drone | Low | 53 | 0 | 150 | 3 | 12 | Scouts for assimilation |
| Swarm Worker | Low | 92 | 0 | 130 | 5 | 28 | Standard unit |
| Swarm Warrior | Mid | 158 | 39 | 110 | 10 | 70 | Elite combat unit |
| Swarm Queen | Boss | 788 | 263 | 48-200 by phase | 37 | 800 | Phase-based boss, spawns minions |

Drone, Worker, and Warrior hull/shield values are the live authored values in
`NPC_TYPES`; there is no additional blanket faction-health multiplier applied
after spawning. Linked units instead spread 20% of incoming hull damage to
other linked Swarm units within 300 units.

### Swarm Queen Boss

**Phase-Based AI** (4 phases based on health %):

1. **Hunt Phase** (100-75% HP):
   - Speed: 2.0x (80 → 160 units/sec)
   - Behavior: Aggressive pursuit
   - Spawning: Reduced (0.5x rate)

2. **Siege Phase** (75-50% HP):
   - Speed: 0.6x (defensive)
   - Behavior: Retreat behind guards
   - Spawning: Double rate (2.0x)

3. **Swarm Phase** (50-10% HP):
   - Speed: 0.8x
   - Damage: 1.2x
   - Spawning: Triple rate (3.0x)
   - Special Attacks: Web Snare, Acid Burst

4. **Desperation Phase** (<10% HP):
   - Speed: 2.5x (berserk)
   - Damage: 2.0x
   - Spawning: None (all-in attack)
   - Attack Cooldowns: Halved

**Special Attacks**:

*Web Snare* (15s cooldown):
- Range: 400 units
- AoE: 150 unit radius
- Effect: 60% slow for 4 seconds
- Projectile speed: 300 units/sec

*Acid Burst* (12s cooldown):
- Range: 350 units
- AoE: 100 unit radius
- Impact: 15 damage
- DoT: 5 damage/sec for 5 seconds

**Minion Spawning**:
- Max 12 minions alive at once
- Spawns 2-4 units per wave
- Spawn types: 70% drones, 20% workers, 10% warriors
- Triggered by: Combat start, health thresholds (75/50/25%), time intervals (15s)

**Queen Aura** (when alive):
- Range: 2000 units
- Effect: 0.5% health/sec regeneration for swarm/assimilated bases
- Strategic: Creates fortified zone around queen

### Spawn Mechanics

**Base**: Swarm Hive
- Health: 5000
- Size: 240 units (20% larger than standard)
- Patrol Radius: 3 sectors
- Respawn Time: 10 minutes
- Initial Spawn: 10 NPCs
- Max NPCs: 20 concurrent (highest of all factions)
- Spawn Cooldown: 3 seconds (fastest)
- Continuous Spawn: Yes (when players nearby)
- Strategic Placement: Attached to large asteroids in belts (organic cave)

**Spawn Pool**:
- 70% Drones (scouts for assimilation)
- 20% Workers
- 10% Warriors

### Loot Drops

**Resources**: Organic/biological materials
- Common: Carbon, Phosphorus, Nitrogen, Hydrogen, Sulfur
- Uncommon: Helium-3, Ice Crystals
- Rare: Dark Matter, Quantum Crystals
- Ultrarare: Exotic Matter, Antimatter, Void Crystals

**Special**: Speed Burst, Damage Amp buffs; Engine Core, Mining Capacitor components; Swarm Hive Core relic (boss only)

## Void Entities

### Identity
**Mysterious dimensional beings** that use formation tactics and energy weapons. Appear from void rifts in deep space with coordinated group attacks.

### Visual Design
- **Colors**: Purple/magenta (primary: #9900ff, accent: #cc66ff)
- **Ship Style**: Ethereal, crystalline structures
- **Weapon Visual**: Pulsing dark energy beams
- **Death Effect**: Implosion with singularity pull

### AI Strategy: Formation

**Behavior** (`/server/game/ai/formation.js`):
1. **Formation Leader**: Strongest unit leads, others follow in formation
2. **Leader Succession**: When leader dies, healthiest high-tier unit promoted
3. **Coordinated Fire**: Time attacks for simultaneous strikes
4. **Formation Hold**: Maintain relative positions while attacking
5. **Retreat**: Fall back together when leader health drops below 30%

**Formation Patterns**:
- V-formation for approach
- Diamond for surrounded targets
- Line formation for ranged bombardment
- Break formation only when leader dies

**Succession Priority**:
- Void Phantom (tier score: 3)
- Void Shadow (tier score: 2)
- Void Whisper (tier score: 1)
- Score = health% × 100 + tier_score × 10

**Combat Stats** (example: Void Phantom):
```javascript
{
  hull: 200,
  shield: 150,
  speed: 100,
  weaponType: 'energy',
  weaponDamage: 15,
  weaponRange: 320,
  aggroRange: 550
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Range | Credits |
|------|------|------|--------|-------|--------|-------|---------|
| Void Whisper | Low | 60 | 40 | 140 | 5 | 250 | 60 |
| Void Shadow | Mid | 120 | 80 | 120 | 9 | 280 | 150 |
| Void Phantom | High | 200 | 150 | 100 | 15 | 320 | 300 |
| Void Leviathan | Boss | 1,500 | 900 | 50 | 60 | 400 | 2,500 |

### Spawn Mechanics

**Base**: Void Rift
- Health: 3000
- Size: 120 units
- Patrol Radius: 4 sectors
- Respawn Time: 8 minutes
- Initial Spawn: 4 NPCs
- Max NPCs: 8 concurrent
- Spawn Cooldown: 20 seconds
- NPC Respawn Delay: 2 minutes
- Strategic Placement: Deep space (1.5+ sectors from stars)

**Spawn Pool**:
- 50% Whispers
- 35% Shadows
- 15% Phantoms

Leviathan minion waves use server-selected rift coordinates. The
`void:spawnMinions` warning and the delayed `npc:spawn` events reuse those same
positions so the emergence animation matches authoritative gameplay. Explicit
spawn visibility is tracked just like batched updates, and dead or in-transit
players are excluded, so a delayed Leviathan cannot remain as an unretired
client-side entity after respawn.

### Loot Drops

**Resources**: Exotic dimensional materials (NO COMMONS)
- Common: NONE (void entities never drop commons)
- Uncommon: Neon
- Rare: Xenon, Dark Matter, Quantum Crystals
- Ultrarare: Exotic Matter, Antimatter, Neutronium, Void Crystals

**Special**: Damage Amp, Radar Pulse buffs; Weapon Matrix, Shield Cell components; Void Crystal, Wormhole Gem, Ancient Star Map, and Subspace Warp Drive boss-relic pool. Void Leviathan loot has an additional independent 25% Subspace Warp Drive roll.

## Rogue Miners

### Identity
**Industrial claim operators** that mine nearby world objects, build a finite
claim-credit reserve, and defend the operation as a coordinated group when any
member is attacked.

### Visual Design
- **Colors**: Orange/yellow (primary: #ff9900, accent: #ffcc00)
- **Ship Style**: Industrial, boxy mining vessels
- **Weapon Visual**: Orange mining laser beams with particles
- **Death Effect**: Industrial explosion with sparks

### AI Strategy: Mining Economy and Claim Rage

**Behavior** (`/server/game/ai/mining.js`):
1. Each miner claims a unique asteroid, planet, or derelict within 2,000 units,
   mines for three seconds, and returns its haul to the claim.
2. A deposit adds 2 credits to the claim reserve, or 6 while a Foreman is
   present.
3. Prospector and Driller deposits have a 5-10% chance to add an Excavator;
   Excavator deposits have a 10% chance to add the single Foreman.
4. Damaging any Rogue Miner enrages every Rogue Miner within 3,000 units
   against that player. Rage clears after the target leaves that range, even
   when a spread-rage miner first sees the attacker outside normal aggro.
5. A Foreman triples same-claim movement and shortens the enraged fire cooldown
   from 1,000 ms to 300 ms.

The generic `territorial.js` warning strategy remains in the repository for
reuse, but it is not the live Rogue Miner faction route.

**Combat Stats** (example: Rogue Excavator):
```javascript
{
  hull: 140,
  shield: 875,
  speed: 70,
  weaponType: 'energy',
  weaponDamage: 20,
  weaponRange: 270,
  aggroRange: 450,
  territorial: true
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Range | Credits |
|------|------|------|--------|-------|--------|-------|---------|
| Rogue Prospector | Low | 60 | 300 | 100 | 6 | 200 | 35 |
| Rogue Driller | Mid | 90 | 450 | 85 | 10 | 230 | 75 |
| Rogue Excavator | High | 140 | 875 | 70 | 20 | 270 | 160 |
| Rogue Foreman | Boss | 250 | 1,200 | 55 | 42 | 320 | 450 |

### Spawn Mechanics

**Base**: Mining Claim
- Health: 1500
- Size: 100 units
- Patrol Radius: 3 sectors
- Territory Radius: 500 units (strict boundary)
- Respawn Time: 4 minutes
- Initial Spawn: 2 NPCs
- Max regular population: 5 NPCs; the Foreman may occupy one additional slot
- Spawn Cooldown: 60 seconds (slowest regular cadence)
- Strategic Placement: Inner asteroid belts with rare resources

**Spawn Pool**:
- 50% Prospectors
- 35% Drillers
- 15% Excavators

### Loot Drops

**Resources**: Mining claim riches
- Common: Iron, Silicon
- Uncommon: Copper, Titanium, Cobalt, Lithium
- Rare: Gold, Uranium, Iridium, Platinum, Quantum Crystals
- Ultrarare: Exotic Matter

**Special**: Shield Boost, Radar Pulse buffs; Mining Capacitor, Shield Cell components; Ancient Star Map, Pirate Treasure, and Mining Rites boss-relic pool. Rogue Foreman loot guarantees Mining Rites.

## Common Mechanics

### Base Spawning System

All factions use same base-spawned NPC system:

1. **Activation**: Base discovery runs every 500 ms and activates hubs inside a
   player-specific server range (at least three sectors, extended for high-tier
   radar and Ancient Star Map contacts). This range always exceeds ordinary NPC
   delivery range, preventing a visible population from unloading underneath a
   high-tier radar client.
2. **Initial Spawn**: Spawns starting NPCs immediately
3. **Respawn Tracking**: Dead NPCs enter the delay configured for their hub.
4. **Spawn Cooldown**: Minimum time between any spawns (prevents spam)
5. **Population Caps**: Each regular pool has a hard cap; documented special
   lifecycle slots (Hauler/King and Foreman) are counted separately.
6. **Dormancy**: After 60 seconds without a nearby living player, the NPC
   population unloads from the tick loop. Health, damage contributors, pending
   respawns, scrap reserves, and assimilation state remain in a dormant base
   snapshot and are restored on reactivation.

| Hub | Initial population | Population cap | Spawn cooldown | NPC respawn delay |
| --- | ---: | ---: | ---: | ---: |
| Pirate Outpost | 2 Fighters | 4 regular Fighters | 30 s | 5 min |
| Scavenger Yard | 2 | 3 regular units | 45 s | 5 min |
| Swarm Hive | 10 | 20 | 3 s | 15 s |
| Void Rift | 4 | 8 | 20 s | 2 min |
| Mining Claim | 2 | 5 regular units (+1 Foreman) | 60 s | 5 min |

### Orphan Rage Mode

When a base is destroyed, ordinary surviving NPCs enter bounded rage mode:

- **Duration**: 90 seconds
- **Aggro Range**: +50% (1.5x normal)
- **Damage**: +25% (1.25x normal)
- **Behavior**: Aggressive, seek revenge
- **Despawn**: After 90 seconds, NPCs disappear

The Pirate Dreadnought is the deliberate exception: it enters a permanent
`enraged` rampage with a 1.5× damage multiplier after its outpost is destroyed.
Living Void defenders orphaned by rift destruction keep their existing
formation registry; leader succession runs only for an actual leader death.

Scripted removals use the same lifecycle registry cleanup as combat deaths.
Leviathan-consumed Void-rift units and neighboring-hive defenders lost to a
Hive Core implosion therefore retain their configured replacement timers;
Hive defenders outside the 500-unit implosion radius survive as orphans.

**Purpose**: Gives players brief challenge after base destruction, then cleans up stragglers

### Damage Contributors & Team Rewards

All NPCs and bases track player damage contributors for rewards:

```javascript
npc.damageContributors = new Map();  // playerId -> totalDamage
damageContributors.set(attackerId, currentDamage + newDamage);
```

NPC attackers keep a separate source identity for retaliation without entering
the player reward map. Passive Scavengers and Rogue Miners can consequently
retain and fire back at a Pirate NPC, and Pirate shield piercing applies to
their real hull/shield totals rather than only the projectile visual.

Player-target retention is an explicit faction-strategy contract rather than a
generic `targetPlayer` exception. Provoked Scavengers, enraged Rogue Miners,
and active Pirate raids may retain an attacker up to their documented clear
range. Swarm and Void NPCs still disengage at ordinary aggro range. The engine
runs one cleanup tick when a retained player crosses its limit, delivers the
attacker to that target throughout the strategy-owned chase range, and clears
rage, raids, and Pirate intel immediately when the player dies or disconnects,
including identities preserved inside dormant base populations.

**Team Credit Distribution**:
- Damage contributors define the reward team; the collector is treated as the solo owner only when no contributor record exists.
- Credits use a 1×/1.5×/2×/2.5× team pool for one/two/three/four-or-more contributors, then split without rounding inflation.
- Pirate Treasure is applied independently to each owner's own credit share.
- Common and uncommon resources split across contributors; the contributing collector receives any integer remainder.
- Rare and ultrarare resources plus buffs, components, and relics go to the collector, with rare-drop notifications sent to teammates.
- Each resource award is capped to that recipient's cargo space. Overflow or failed durable writes remain in the wreckage settlement.

**Example**: 3-player team kills 100-credit NPC
- Total: 100 × 2.0 = 200 credits
- Shares: 67, 67, and 66 credits before any owner-specific Pirate Treasure bonus
- Common/uncommon stacks split across contributors; rare and special items remain with the collector

## Related Files

### Core Systems
- `/server/game/npc.js` - NPC spawning, base management, lifecycle
- `/server/game/ai/` - AI strategy implementations:
  - `pirate.js` - Live Pirate roles, intel, dives, raids, and Dreadnought state
  - `scavenger.js` - Live Scavenger salvage economy and provocation behavior
  - `swarm.js` - Swarm, linked units, and Queen behavior
  - `formation.js` and `void-leviathan.js` - Void formations and boss behavior
  - `mining.js` - Live Rogue Miner economy and rage behavior
  - `flanking.js`, `retreat.js`, and `territorial.js` - Reusable generic strategies
  - `index.js` - AI router

### Loot & Combat
- `/server/game/loot-pools.js` - Faction loot definitions
- `/server/game/combat.js` - Damage calculation, weapon types
- `/server/game/loot.js` - Wreckage spawning

### Rendering & Graphics
- `/client/js/graphics/npc-ships.js` - Faction ship rendering
- `/client/js/graphics/death-effects.js` - Faction death animations
- `/client/js/graphics/npc-weapons.js` - Weapon projectile visuals

### Configuration
- `/shared/constants.js` - NPC definitions, faction configurations (lines 925-1082)
- `/server/config.js` - Server-side spawn rates, timings

## Design Philosophy

### Faction Differentiation

Each faction has unique identity through:

1. **AI Behavior**: Pirate roles, salvage/provocation, Swarm coordination,
   Void formations, and Rogue Miner economy/rage
2. **Combat Stats**: Speed/damage/health trade-offs
3. **Visual Design**: Colors, ships, weapons, death effects
4. **Loot Tables**: Thematic resource pools
5. **Spawn Patterns**: Base placement and patrol behavior

### Difficulty Progression

- **Low Tier**: Scouts/scrappers (learning curve)
- **Mid Tier**: Fighters/workers (skill check)
- **High Tier**: Captains/warriors (challenge)
- **Boss Tier**: Dreadnoughts/queens/leviathans (group content)
- **Bases**: High-value targets requiring strategy

### Player Experience

- **Visual Clarity**: Faction colors instantly readable
- **Behavioral Telegraphing**: Players learn faction patterns
- **Reward Scaling**: Harder factions drop better loot
- **Strategic Depth**: Different tactics needed per faction
- **Emergent Gameplay**: Factions interact with world systems (assimilation, territorial control)
