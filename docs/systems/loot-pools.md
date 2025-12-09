# Loot Pools System

## Overview

The Loot Pools system is a centralized, faction-first architecture for generating loot drops from NPCs and faction bases. It provides consistent, balanced rewards based on enemy type, faction, and difficulty tier, with support for resources, buffs, components, and relics.

## Purpose

- **Consistency**: All loot generation flows through a single system
- **Balance**: Tier-based templates ensure appropriate rewards for difficulty
- **Faction Identity**: Each faction has unique resource pools and special drops
- **Deduplication**: Map-based accumulation prevents duplicate resource entries
- **Maintainability**: Adding new NPCs only requires faction + tier mapping

## Architecture

### Faction-First Design

The system uses a three-layer approach:

1. **Faction Definitions** (`FACTION_LOOT`) - Resource pools, relics, buffs, components per faction
2. **Tier Templates** (`TIER_TEMPLATES`) - Drop profiles for low/mid/high/boss/base difficulty
3. **NPC Mapping** (`NPC_LOOT_MAPPING`) - Maps each NPC type to faction + tier

This eliminates duplication and makes the system data-driven.

## Loot Generation Flow

```
NPC dies → Look up faction + tier → Select tier template → 
  Roll resource slots → Pick from faction pool → Accumulate (dedupe) → 
  Roll special drops (buffs/components/relics) → Return contents
```

## Faction Definitions

Each faction has unique resource affinities and special drop tables:

### Pirates

**Resources**:
- Common: Iron, Carbon, Nickel
- Uncommon: Copper, Titanium, Helium-3
- Rare: Platinum, Dark Matter, Quantum Crystals
- Ultrarare: Exotic Matter, Antimatter

**Special Drops**:
- Relics: Pirate Treasure
- Buffs: Shield Boost, Speed Burst, Damage Amp
- Components: Engine Core, Weapon Matrix

**Identity**: Balanced loot with focus on weapons and engines

### Scavengers

**Resources**:
- Common: Iron, Nickel, Silicon
- Uncommon: Copper, Silver, Cobalt, Lithium
- Rare: Gold, Platinum, Iridium
- Ultrarare: Exotic Matter

**Special Drops**:
- Relics: Pirate Treasure, Ancient Star Map
- Buffs: Shield Boost, Speed Burst
- Components: Mining Capacitor, Engine Core

**Identity**: Salvaged materials, mining equipment, scavenged relics

### Swarm

**Resources**:
- Common: Carbon, Phosphorus, Nitrogen, Hydrogen (organic)
- Uncommon: Helium-3, Sulfur, Ice Crystals
- Rare: Dark Matter, Quantum Crystals
- Ultrarare: Exotic Matter, Antimatter, Void Crystals

**Special Drops**:
- Relics: Swarm Hive Core
- Buffs: Speed Burst, Damage Amp
- Components: Engine Core, Mining Capacitor

**Identity**: Organic/biological materials, extreme mobility, hive relics

### Void Entities

**Resources**:
- Common: NONE (void entities never drop common resources)
- Uncommon: Xenon, Dark Matter, Neon
- Rare: Quantum Crystals, Exotic Matter
- Ultrarare: Antimatter, Neutronium, Void Crystals

**Special Drops**:
- Relics: Void Crystal, Wormhole Gem, Ancient Star Map
- Buffs: Damage Amp, Radar Pulse
- Components: Weapon Matrix, Shield Cell

**Identity**: Only rare/exotic drops, mysterious relics, dimensional materials

### Rogue Miners

**Resources**:
- Common: Iron, Copper, Silicon
- Uncommon: Titanium, Cobalt, Lithium
- Rare: Gold, Uranium, Iridium, Platinum
- Ultrarare: Exotic Matter, Quantum Crystals

**Special Drops**:
- Relics: Ancient Star Map, Pirate Treasure
- Buffs: Shield Boost, Radar Pulse
- Components: Mining Capacitor, Shield Cell

**Identity**: Rich mineral deposits, mining gear, prospecting tools

## Tier Templates

Tier templates define drop profiles with guaranteed and bonus slots:

### Low Tier (Scouts, Scrappers, Drones)

```javascript
{
  slots: { guaranteed: 1, bonus: { count: 2, chance: 0.8 } },
  rarityWeights: {
    common:    { weight: 0.60, quantityRange: [2, 5] },
    uncommon:  { weight: 0.35, quantityRange: [1, 3] },
    rare:      { weight: 0.05, quantityRange: [1, 2] },
    ultrarare: { weight: 0.00, quantityRange: [1, 1] }
  },
  specialDrops: {
    buff:      { chance: 0.05 },   // 5% buff chance
    component: { chance: 0.01 },   // 1% component chance
    relic:     null                 // No relics
  }
}
```

**Expected drops**: 1-3 resource types, mostly common/uncommon, rare buffs

### Mid Tier (Fighters, Salvagers, Workers)

```javascript
{
  slots: { guaranteed: 2, bonus: { count: 2, chance: 0.85 } },
  rarityWeights: {
    common:    { weight: 0.40, quantityRange: [2, 6] },
    uncommon:  { weight: 0.45, quantityRange: [2, 4] },
    rare:      { weight: 0.14, quantityRange: [1, 3] },
    ultrarare: { weight: 0.01, quantityRange: [1, 1] }
  },
  specialDrops: {
    buff:      { chance: 0.15 },   // 15% buff chance
    component: { chance: 0.05 },   // 5% component chance
    relic:     null
  }
}
```

**Expected drops**: 2-4 resource types, balanced mix, occasional rare materials

### High Tier (Captains, Collectors, Warriors)

```javascript
{
  slots: { guaranteed: 2, bonus: { count: 3, chance: 0.9 } },
  rarityWeights: {
    common:    { weight: 0.20, quantityRange: [3, 6] },
    uncommon:  { weight: 0.45, quantityRange: [2, 5] },
    rare:      { weight: 0.30, quantityRange: [2, 4] },
    ultrarare: { weight: 0.05, quantityRange: [1, 2] }
  },
  specialDrops: {
    buff:      { chance: 0.25 },   // 25% buff chance
    component: { chance: 0.10 },   // 10% component chance
    relic:     null
  }
}
```

**Expected drops**: 2-5 resource types, lots of rare materials, good buff/component chance

### Boss Tier (Dreadnoughts, Queens, Leviathans)

```javascript
{
  slots: { guaranteed: 3, bonus: { count: 3, chance: 0.95 } },
  rarityWeights: {
    common:    { weight: 0.10, quantityRange: [3, 8] },
    uncommon:  { weight: 0.30, quantityRange: [3, 6] },
    rare:      { weight: 0.45, quantityRange: [2, 5] },
    ultrarare: { weight: 0.15, quantityRange: [1, 3] }
  },
  specialDrops: {
    buff:      { chance: 0.50 },   // 50% buff chance
    component: { chance: 0.30 },   // 30% component chance
    relic:     { chance: 0.15 }    // 15% relic chance (BOSS EXCLUSIVE)
  }
}
```

**Expected drops**: 3-6 resource types, high rare/ultrarare, relics only from bosses

### Base Tier (Faction Bases)

```javascript
{
  slots: { guaranteed: 2, bonus: { count: 2, chance: 0.7 } },
  rarityWeights: {
    common:    { weight: 0.05, quantityRange: [1, 2] },
    uncommon:  { weight: 0.15, quantityRange: [2, 4] },
    rare:      { weight: 0.60, quantityRange: [3, 8] },    // Bases give LOTS of rare
    ultrarare: { weight: 0.20, quantityRange: [1, 3] }
  },
  specialDrops: {
    buff:      { chance: 0.40 },   // 40% buff chance
    component: { chance: 0.50 },   // 50% component chance
    relic:     null                 // Bases don't drop relics
  }
}
```

**Expected drops**: 2-4 resource types, heavy focus on rare/ultrarare, high component chance

## Loot Drop Mechanics

### Resource Accumulation

The system uses **Map-based deduplication** to prevent duplicate entries:

```javascript
const loot = new Map();  // resourceType -> quantity

// Roll each slot
for (let i = 0; i < totalSlots; i++) {
  const rarity = weightedRarityPick(template.rarityWeights);
  const resource = randomPick(faction.resources[rarity]);
  const quantity = randomInRange(template.rarityWeights[rarity].quantityRange);

  // Accumulate (auto-dedupes)
  loot.set(resource, (loot.get(resource) || 0) + quantity);
}

// Convert to array
for (const [resourceType, quantity] of loot) {
  contents.push({ type: 'resource', resourceType, quantity, rarity });
}
```

**Result**: Same resource from multiple slots combines into single entry with summed quantity

### Special Drops

After resources, rolls for special items (independent probabilities):

```javascript
// Buffs (temporary power-ups)
if (Math.random() < template.specialDrops.buff.chance) {
  const buffType = randomPick(faction.buffs);
  contents.push({ type: 'buff', buffType });
}

// Components (upgrade materials)
if (Math.random() < template.specialDrops.component.chance) {
  const componentType = randomPick(faction.components);
  contents.push({ type: 'component', componentType });
}

// Relics (boss-exclusive, ultrarare collectibles)
if (template.specialDrops.relic && Math.random() < template.specialDrops.relic.chance) {
  const relicType = randomPick(faction.relics);
  contents.push({ type: 'relic', relicType });
}
```

### Loot Content Format

```javascript
[
  // Credits (handled by calling code, not loot pools)
  { type: 'credits', amount: 100 },

  // Resources
  { type: 'resource', resourceType: 'IRON', quantity: 8, rarity: 'common' },
  { type: 'resource', resourceType: 'PLATINUM', quantity: 3, rarity: 'rare' },

  // Buffs
  { type: 'buff', buffType: 'SHIELD_BOOST' },

  // Components
  { type: 'component', componentType: 'WEAPON_MATRIX' },

  // Relics (boss only)
  { type: 'relic', relicType: 'VOID_CRYSTAL' }
]
```

## Team Loot Distribution

Team multipliers apply to **credits only**, not resources:

| Team Size | Credits Multiplier | Per-Player Share |
|-----------|-------------------|------------------|
| 1 (Solo) | 1.0x (100%) | 100% |
| 2 (Duo) | 1.5x (150%) | 75% each |
| 3 (Trio) | 2.0x (200%) | 66% each |
| 4+ (Squad) | 2.5x (250%) | 62.5% each |

**Resources**: Full loot list given to ONE player (highest damage contributor)

**Credits**: Multiplied total split evenly among all participants

**Example**:
- NPC drops 100 credits + 10 Iron + 3 Platinum
- Killed by 3-player team
- Credits: 100 × 2.0 = 200 total, 66 per player
- Resources: All items go to player with most damage

## NPC Loot Mapping

All NPCs mapped to faction + tier in `/server/game/loot-pools.js`:

```javascript
const NPC_LOOT_MAPPING = {
  // Pirates
  pirate_scout:       { faction: 'pirate', tier: 'low' },
  pirate_fighter:     { faction: 'pirate', tier: 'mid' },
  pirate_captain:     { faction: 'pirate', tier: 'high' },
  pirate_dreadnought: { faction: 'pirate', tier: 'boss' },
  pirate_outpost:     { faction: 'pirate', tier: 'base' },

  // Scavengers
  scavenger_scrapper:  { faction: 'scavenger', tier: 'low' },
  scavenger_salvager:  { faction: 'scavenger', tier: 'low' },
  scavenger_collector: { faction: 'scavenger', tier: 'mid' },
  scavenger_hauler:    { faction: 'scavenger', tier: 'high' },
  scavenger_yard:      { faction: 'scavenger', tier: 'base' },

  // Swarm
  swarm_drone:   { faction: 'swarm', tier: 'low' },
  swarm_worker:  { faction: 'swarm', tier: 'low' },
  swarm_warrior: { faction: 'swarm', tier: 'mid' },
  swarm_queen:   { faction: 'swarm', tier: 'boss' },
  swarm_hive:    { faction: 'swarm', tier: 'base' },

  // Void Entities
  void_whisper:   { faction: 'void', tier: 'low' },
  void_shadow:    { faction: 'void', tier: 'mid' },
  void_phantom:   { faction: 'void', tier: 'high' },
  void_leviathan: { faction: 'void', tier: 'boss' },
  void_rift:      { faction: 'void', tier: 'base' },

  // Rogue Miners
  rogue_prospector: { faction: 'rogue_miner', tier: 'low' },
  rogue_driller:    { faction: 'rogue_miner', tier: 'mid' },
  rogue_excavator:  { faction: 'rogue_miner', tier: 'high' },
  rogue_foreman:    { faction: 'rogue_miner', tier: 'boss' },
  mining_claim:     { faction: 'rogue_miner', tier: 'base' }
};
```

## Usage API

### Main Function

```javascript
const LootPools = require('./loot-pools.js');

// Generate loot for any NPC or base
const loot = LootPools.generateLoot('pirate_captain');
// Returns array of loot items

// Spawn wreckage with loot
const wreckage = spawnWreckage(npc, position, loot);
```

### Helper Functions

```javascript
// Get faction/tier for an NPC
const mapping = LootPools.getMappingForNpc('swarm_queen');
// { faction: 'swarm', tier: 'boss' }

// Get faction loot definition
const factionLoot = LootPools.getFactionLoot('void');
// { resources, relics, buffs, components }

// Get tier template
const template = LootPools.getTierTemplate('boss');
// { slots, rarityWeights, specialDrops }

// Check if NPC is boss tier
const isBoss = LootPools.isBossTier('void_leviathan');
// true
```

## Related Files

### Core System
- `/server/game/loot-pools.js` - Centralized loot generation (358 lines)
- `/server/game/loot.js` - Wreckage spawning and collection
- `/shared/constants.js` - Resource types, buff types, relic types

### Integration Points
- `/server/game/npc.js` - Calls `generateLoot()` on NPC death
- `/server/game/combat.js` - Tracks damage contributors for team distribution
- `/server/socket.js` - Handles loot collection events

## Configuration

All configuration is data-driven and easily modifiable:

### Adding a New NPC

1. Add to `NPC_TYPES` in `/server/game/npc.js` with stats
2. Add to `NPC_LOOT_MAPPING` in `/server/game/loot-pools.js`:
   ```javascript
   new_enemy_type: { faction: 'pirate', tier: 'mid' }
   ```
3. Done! Loot automatically generated from faction + tier

### Adjusting Drop Rates

Edit tier templates in `TIER_TEMPLATES`:

```javascript
boss: {
  slots: { guaranteed: 3, bonus: { count: 3, chance: 0.95 } },
  rarityWeights: {
    // Adjust weights (must sum to 1.0)
    rare: { weight: 0.60, quantityRange: [3, 8] },  // 60% chance
    // Adjust quantity ranges
    ultrarare: { weight: 0.20, quantityRange: [2, 5] }  // More ultrarare
  },
  specialDrops: {
    relic: { chance: 0.25 }  // Increase boss relic chance to 25%
  }
}
```

### Modifying Faction Resources

Edit `FACTION_LOOT` to change resource pools:

```javascript
pirate: {
  resources: {
    // Add new resource types
    rare: ['PLATINUM', 'DARK_MATTER', 'IRIDIUM'],
    // Change pools
    ultrarare: ['NEUTRONIUM']  // Pirates now drop Neutronium
  }
}
```

## Design Rationale

### Why Faction-First?

- **Consistency**: All pirates drop similar materials
- **Identity**: Void entities feel alien (no commons)
- **Maintainability**: One place to change faction behavior
- **Extensibility**: New factions just need resource/relic definitions

### Why Map-Based Deduplication?

- **Clean Output**: No duplicate "Iron x3" + "Iron x5" entries
- **Simpler UI**: Wreckage shows combined quantities
- **Performance**: O(1) accumulation vs O(n) array search

### Why Tier Templates?

- **Balance**: Ensures boss loot is meaningfully better
- **Tuning**: Adjust all low-tier drops at once
- **Clarity**: Difficulty progression is explicit

## Examples

### Boss Loot (Swarm Queen)

```javascript
const loot = LootPools.generateLoot('swarm_queen');
// Example output:
[
  { type: 'resource', resourceType: 'DARK_MATTER', quantity: 4, rarity: 'rare' },
  { type: 'resource', resourceType: 'ANTIMATTER', quantity: 2, rarity: 'ultrarare' },
  { type: 'resource', resourceType: 'VOID_CRYSTALS', quantity: 1, rarity: 'ultrarare' },
  { type: 'resource', resourceType: 'CARBON', quantity: 5, rarity: 'common' },
  { type: 'buff', buffType: 'DAMAGE_AMP' },
  { type: 'component', componentType: 'ENGINE_CORE' },
  { type: 'relic', relicType: 'SWARM_HIVE_CORE' }
]
```

### Low-Tier Loot (Pirate Scout)

```javascript
const loot = LootPools.generateLoot('pirate_scout');
// Example output:
[
  { type: 'resource', resourceType: 'IRON', quantity: 3, rarity: 'common' },
  { type: 'resource', resourceType: 'COPPER', quantity: 2, rarity: 'uncommon' }
]
```

### Void Entity Loot (No Commons)

```javascript
const loot = LootPools.generateLoot('void_whisper');
// Example output (never has common rarity):
[
  { type: 'resource', resourceType: 'XENON', quantity: 2, rarity: 'uncommon' },
  { type: 'resource', resourceType: 'DARK_MATTER', quantity: 1, rarity: 'uncommon' }
]
```
