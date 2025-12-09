# NPC Factions System

## Overview

Galaxy Miner features 5 distinct NPC factions, each with unique behaviors, AI strategies, visual designs, and loot pools. Factions spawn from procedurally-placed bases and patrol defined territories, creating dynamic PvE encounters throughout the galaxy.

## Faction Roster

| Faction | AI Strategy | Retreat Threshold | Spawn Hub | Spawn Rate |
|---------|-------------|-------------------|-----------|------------|
| Pirates | Flanking | 40% | Pirate Outpost | 1 per 15 sectors |
| Scavengers | Retreat | 20% | Scavenger Yard | 1 per 25 sectors |
| Swarm | Swarm (never retreat) | 0% | Swarm Hive | 1 per 50 sectors (rare) |
| Void Entities | Formation | 30% | Void Rift | 1 per 40 sectors |
| Rogue Miners | Territorial | 50% | Mining Claim | 1 per 20 sectors |

## Pirates

### Identity
**Aggressive raiders** who attack from multiple angles using coordinated flanking tactics. Known for hit-and-run strikes on miners and traders.

### Visual Design
- **Colors**: Red/orange (primary: #ff3300, accent: #ff6600)
- **Ship Style**: Angular, aggressive designs with weapon pods
- **Weapon Visual**: Orange cannon projectiles with trails
- **Death Effect**: Violent explosion with orange/red particles

### AI Strategy: Flanking

**Behavior** (`/server/game/ai/flanking.js`):
1. **Target Selection**: Focus fire on targets already being attacked by allies
2. **Positioning**: Distribute around target in 270° arc on opposite side from base
3. **Movement**: Approach to 80% of weapon range, then hold position
4. **Coordination**: Attack angle spacing based on number of attackers
5. **Retreat**: Fall back to base when health drops below 40%

**Tactical Patterns**:
- Solo pirate: Direct frontal assault
- 2-3 pirates: Pincer attack from sides
- 4+ pirates: Full surround with front/back coverage

**Combat Stats** (example: Pirate Captain):
```javascript
{
  hull: 200,
  shield: 100,
  speed: 80,
  weaponType: 'kinetic',
  weaponDamage: 20,
  weaponRange: 300,
  aggroRange: 600,
  retreatThreshold: 0.4
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Credits | Description |
|------|------|------|--------|-------|--------|---------|-------------|
| Pirate Scout | Low | 50 | 25 | 120 | 5 | 30 | Fast harassment unit |
| Pirate Fighter | Mid | 100 | 50 | 100 | 10 | 80 | Standard combat ship |
| Pirate Captain | High | 200 | 100 | 80 | 20 | 220 | Elite officer vessel |
| Pirate Dreadnought | Boss | 400 | 200 | 60 | 52 | 550 | Heavily armed battleship |

### Spawn Mechanics

**Base**: Pirate Outpost
- Health: 2000
- Size: 150 units
- Patrol Radius: 5 sectors (5000 units)
- Respawn Time: 5 minutes after destruction
- Initial Spawn: 3 NPCs
- Max NPCs: 5 concurrent
- Spawn Cooldown: 30 seconds
- Strategic Placement: Outer asteroid belts (ambush points)

**Spawn Pool**:
- 50% Scouts (fast scouts)
- 35% Fighters (mainline)
- 15% Captains (elites)

### Loot Drops

**Resources**: Balanced industrial materials
- Common: Iron, Carbon, Nickel
- Uncommon: Copper, Titanium, Helium-3
- Rare: Platinum, Dark Matter, Quantum Crystals
- Ultrarare: Exotic Matter, Antimatter

**Special**: Shield Boost, Speed Burst, Damage Amp buffs; Engine Core, Weapon Matrix components; Pirate Treasure relic

## Scavengers

### Identity
**Opportunistic salvagers** who avoid direct combat, preferring to flee and return later. They pick through wreckage and scavenge resources.

### Visual Design
- **Colors**: Rusty browns/grays (primary: #999966, accent: #cccc88)
- **Ship Style**: Asymmetrical, patched-together designs
- **Weapon Visual**: Flickering yellow jury-rigged lasers
- **Death Effect**: Breaking apart into scrap debris

### AI Strategy: Retreat

**Behavior** (`/server/game/ai/retreat.js`):
1. **Aggression**: Only attacks if player is significantly weaker
2. **Flee Threshold**: Retreats at 20% health (earliest of all factions)
3. **Evasion**: Runs at 130% normal speed when fleeing
4. **Return**: Cautiously returns to patrol after fleeing to safety
5. **Target Priority**: Prefers damaged targets (finish-off strategy)

**Tactical Patterns**:
- Keep distance, fire from range
- Flee immediately when damaged
- Circle back after player moves away
- Gang up on low-health targets

**Combat Stats** (example: Scavenger Hauler):
```javascript
{
  hull: 180,
  shield: 40,
  speed: 50,
  weaponType: 'energy',
  weaponDamage: 12,
  weaponRange: 250,
  aggroRange: 450,
  retreatThreshold: 0.2  // Earliest retreat
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Credits | Description |
|------|------|------|--------|-------|--------|---------|-------------|
| Scavenger Scrapper | Low | 40 | 10 | 90 | 4 | 20 | Weak scavenger |
| Scavenger Salvager | Low | 70 | 20 | 80 | 6 | 45 | Cargo hauler |
| Scavenger Collector | Mid | 100 | 30 | 70 | 8 | 90 | Industrial collector |
| Scavenger Hauler | High | 180 | 40 | 50 | 12 | 180 | Heavy salvage vessel (flees, not boss) |

**Note**: Hauler is high-tier but NOT a boss (flees instead of fighting)

### Spawn Mechanics

**Base**: Scavenger Yard
- Health: 1000
- Size: 100 units
- Patrol Radius: 2 sectors (2000 units)
- Respawn Time: 3 minutes
- Initial Spawn: 2 NPCs
- Max NPCs: 3 concurrent
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

**Special**: Shield Boost, Speed Burst buffs; Mining Capacitor, Engine Core components; Pirate Treasure, Ancient Star Map relics

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
- 3+ assimilated bases within 10km spawns Swarm Queen

**Tactical Patterns**:
- Swarm circles target group
- Gradually tightens spiral
- Fast fire rate (0.8s cooldown)
- Linked damage punishes AoE

**Combat Stats** (example: Swarm Warrior):
```javascript
{
  hull: 158,        // +50% from linked health bonus
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
| Swarm Queen | Boss | 788 | 263 | 80-200 | 37 | 800 | Phase-based boss, spawns minions |

**Hull/Shield Note**: All swarm units have +162.5% hull/shield from baseline (75% base + 50% buff)

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
- Common: Carbon, Phosphorus, Nitrogen, Hydrogen
- Uncommon: Helium-3, Sulfur, Ice Crystals
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
  hull: 150,
  shield: 120,
  speed: 100,
  weaponType: 'energy',
  weaponDamage: 18,
  weaponRange: 320,
  aggroRange: 550,
  retreatThreshold: 0.3,
  formationMember: true
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Credits | Description |
|------|------|------|--------|-------|--------|---------|-------------|
| Void Whisper | Low | 45 | 35 | 140 | 7 | 40 | Scout entity |
| Void Shadow | Mid | 80 | 60 | 120 | 12 | 100 | Standard entity |
| Void Phantom | High | 150 | 120 | 100 | 18 | 200 | Elite entity |
| Void Leviathan | Boss | 500 | 300 | 50 | 60 | 1200 | Massive formation leader |

### Spawn Mechanics

**Base**: Void Rift
- Health: 3000
- Size: 120 units
- Patrol Radius: 4 sectors
- Respawn Time: 8 minutes
- Initial Spawn: 2 NPCs
- Max NPCs: 4 concurrent
- Spawn Cooldown: 40 seconds
- Strategic Placement: Deep space (1.5+ sectors from stars)

**Spawn Pool**:
- 50% Whispers
- 35% Shadows
- 15% Phantoms

### Loot Drops

**Resources**: Exotic dimensional materials (NO COMMONS)
- Common: NONE (void entities never drop commons)
- Uncommon: Xenon, Dark Matter, Neon
- Rare: Quantum Crystals, Exotic Matter
- Ultrarare: Antimatter, Neutronium, Void Crystals

**Special**: Damage Amp, Radar Pulse buffs; Weapon Matrix, Shield Cell components; Void Crystal, Wormhole Gem, Ancient Star Map relics

## Rogue Miners

### Identity
**Territorial claim defenders** who warn intruders before attacking. Defend resource-rich sectors with industrial mining equipment repurposed as weapons.

### Visual Design
- **Colors**: Orange/yellow (primary: #ff9900, accent: #ffcc00)
- **Ship Style**: Industrial, boxy mining vessels
- **Weapon Visual**: Orange mining laser beams with particles
- **Death Effect**: Industrial explosion with sparks

### AI Strategy: Territorial

**Behavior** (`/server/game/ai/territorial.js`):
1. **Warning Phase**: Flash weapons for 3 seconds before firing
2. **Territory Defense**: Won't chase beyond 500-unit claim radius
3. **Mining Priority**: Immediately attacks anyone mining in territory
4. **Defender Bonus**: +20% damage when defending claim
5. **Retreat**: Fall back to claim center at 50% health

**Warning System**:
- Intruders get 3-second warning on first entry
- Warning skipped if player is actively mining
- After warning expires, becomes aggressive
- Returns to warning mode if intruder leaves and re-enters

**Territory Mechanics**:
- Define 500-unit radius around mining claim
- Patrol within 60% of radius (300 units)
- Won't leave territory even when chasing
- Stop at territory edge if target outside

**Combat Stats** (example: Rogue Excavator):
```javascript
{
  hull: 140,
  shield: 70,
  speed: 70,
  weaponType: 'energy',
  weaponDamage: 16,        // 19.2 with defender bonus
  weaponRange: 270,
  aggroRange: 450,
  retreatThreshold: 0.5,
  territorial: true,
  defenderBonus: true
}
```

### NPC Progression

| Type | Tier | Hull | Shield | Speed | Damage | Credits | Description |
|------|------|------|--------|-------|--------|---------|-------------|
| Rogue Prospector | Low | 60 | 30 | 100 | 6 (7.2) | 35 | Scout miner |
| Rogue Driller | Mid | 90 | 45 | 85 | 10 (12) | 75 | Industrial driller |
| Rogue Excavator | High | 140 | 70 | 70 | 16 (19.2) | 160 | Heavy excavator |
| Rogue Foreman | Boss | 250 | 120 | 55 | 42 (50.4) | 450 | Claim supervisor |

**Note**: Damage values in parentheses include +20% defender bonus

### Spawn Mechanics

**Base**: Mining Claim
- Health: 1500
- Size: 100 units
- Patrol Radius: 3 sectors
- Territory Radius: 500 units (strict boundary)
- Respawn Time: 4 minutes
- Initial Spawn: 2 NPCs
- Max NPCs: 3 concurrent
- Spawn Cooldown: 60 seconds (slowest, territorial)
- Strategic Placement: Inner asteroid belts with rare resources

**Spawn Pool**:
- 50% Prospectors
- 35% Drillers
- 15% Excavators

### Loot Drops

**Resources**: Mining claim riches
- Common: Iron, Copper, Silicon
- Uncommon: Titanium, Cobalt, Lithium
- Rare: Gold, Uranium, Iridium, Platinum
- Ultrarare: Exotic Matter, Quantum Crystals

**Special**: Shield Boost, Radar Pulse buffs; Mining Capacitor, Shield Cell components; Ancient Star Map, Pirate Treasure relics

## Common Mechanics

### Base Spawning System

All factions use same base-spawned NPC system:

1. **Activation**: Base activates when player within patrol radius
2. **Initial Spawn**: Spawns starting NPCs immediately
3. **Respawn Tracking**: Dead NPCs added to respawn queue with 5-minute timer
4. **Spawn Cooldown**: Minimum time between any spawns (prevents spam)
5. **Max NPCs**: Hard cap on concurrent units per base
6. **Deactivation**: Base deactivates when no players nearby for extended period

**Respawn System**:
```javascript
// When NPC dies
base.pendingRespawns.push({
  respawnAt: Date.now() + 300000  // 5 minutes
});

// Check for ready respawns
if (now >= pendingRespawn.respawnAt && base.spawnedNPCs.length < maxNPCs) {
  spawnNPCFromBase(baseId);
}
```

### Orphan Rage Mode

When base is destroyed, surviving NPCs enter rage mode:

- **Duration**: 90 seconds
- **Aggro Range**: +50% (1.5x normal)
- **Damage**: +25% (1.25x normal)
- **Behavior**: Aggressive, seek revenge
- **Despawn**: After 90 seconds, NPCs disappear

**Purpose**: Gives players brief challenge after base destruction, then cleans up stragglers

### Damage Contributors & Team Rewards

All NPCs and bases track damage from each attacker:

```javascript
npc.damageContributors = new Map();  // playerId -> totalDamage
damageContributors.set(attackerId, currentDamage + newDamage);
```

**Team Credit Distribution**:
- Credits multiplied by team size bonus (1x/1.5x/2x/2.5x)
- Total credits split evenly among all participants
- Resources/loot go to ONE player (highest damage contributor)

**Example**: 3-player team kills 100-credit NPC
- Total: 100 × 2.0 = 200 credits
- Per player: 200 ÷ 3 = 66 credits each
- Loot: All items to player with most damage

## Related Files

### Core Systems
- `/server/game/npc.js` - NPC spawning, base management, lifecycle (2357 lines)
- `/server/game/ai/` - AI strategy implementations:
  - `flanking.js` - Pirates (237 lines)
  - `retreat.js` - Scavengers (201 lines)
  - `swarm.js` - Swarm + Queen boss AI (949 lines)
  - `formation.js` - Void entities (252 lines)
  - `territorial.js` - Rogue miners (291 lines)
  - `index.js` - AI router (183 lines)

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

1. **AI Behavior**: Flanking vs retreat vs formation vs swarm
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
