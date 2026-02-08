# Ship Upgrades System

Complete reference for ship component upgrades, tiers, costs, and resource requirements.

## Table of Contents

- [Overview](#overview)
- [Component List](#component-list)
- [Tier Progression](#tier-progression)
- [Upgrade Requirements](#upgrade-requirements)
- [Effects by Component](#effects-by-component)
- [Upgrade Process](#upgrade-process)
- [Strategy Guide](#strategy-guide)

## Overview

Galaxy Miner features **8 upgradeable ship components**, each with **5 tiers**:

1. **Engine** - Speed & Thrust
2. **Weapons** - Damage & Range
3. **Shields** - Capacity & Recharge
4. **Mining Beam** - Mining Speed
5. **Cargo Hold** - Inventory Capacity
6. **Radar** - Detection Range
7. **Energy Core** - Power Output
8. **Hull** - Armor & Resistance

### Upgrade Costs

Starting at Tier 2, all upgrades require:
- **Credits**: 300 → 900 → 3000 → 9000
- **Resources**: Specific materials per component (see tables below)

Tier 1 is the default starting configuration (no upgrade needed).

## Component List

### Engine

**Effect**: Increases ship speed and maneuverability

```javascript
// Speed calculation
speed = BASE_SPEED * tier
BASE_SPEED = 150 units/second

Tier 1: 150 u/s
Tier 2: 300 u/s
Tier 3: 450 u/s
Tier 4: 600 u/s
Tier 5: 750 u/s
```

**Additional Benefits:**
- Gravity resistance: 20% reduction per tier above 1
- Escape velocity from stars improves significantly

### Weapons

**Effect**: Increases damage output and attack range

```javascript
// Damage calculation
damage = BASE_WEAPON_DAMAGE * tier
BASE_WEAPON_DAMAGE = 10

// Range by tier
WEAPON_RANGES: [0, 180, 210, 360, 400, 400]
// Index = tier (0 unused)

Tier 1: 10 damage, 180 range
Tier 2: 20 damage, 210 range
Tier 3: 30 damage, 360 range
Tier 4: 40 damage, 400 range
Tier 5: 50 damage, 400 range (Tesla Cannon with chain lightning)
```

**Tier 5 Special:** Tesla Cannon
- Chain lightning to 3 targets
- Damage falloff: 100% → 50% → 25%
- Chain range: 150 units per jump

### Shields

**Effect**: Increases shield capacity (2x multiplier per tier)

```javascript
// Shield HP calculation
shieldMax = DEFAULT_SHIELD_HP * (SHIELD_TIER_MULTIPLIER ^ (tier - 1))
DEFAULT_SHIELD_HP = 50
SHIELD_TIER_MULTIPLIER = 2.0

Tier 1: 50 HP
Tier 2: 100 HP
Tier 3: 200 HP
Tier 4: 400 HP
Tier 5: 800 HP
```

**Shield Recharge:**
- Base: 2 HP/sec after 3s delay
- Energy Core adds bonus regen (see Energy Core)

### Mining Beam

**Effect**: Reduces mining time

```javascript
// Mining time calculation
miningTime = BASE_MINING_TIME / tier
BASE_MINING_TIME = 3000ms

Tier 1: 3000ms (3.0s)
Tier 2: 1500ms (1.5s)
Tier 3: 1000ms (1.0s)
Tier 4: 750ms (0.75s)
Tier 5: 600ms (0.6s)
```

**Range:** 50 units (constant across tiers)

### Cargo Hold

**Effect**: Increases inventory capacity

```javascript
CARGO_CAPACITY: [0, 100, 250, 500, 750, 2000]

Tier 1: 100 units
Tier 2: 250 units (+150)
Tier 3: 500 units (+250)
Tier 4: 750 units (+250)
Tier 5: 2000 units (+1250) - Massive leap
```

### Radar

**Effect**: Increases detection range and unlocks features

```javascript
// Range calculation
radarRange = BASE_RADAR_RANGE * (TIER_MULTIPLIER ^ (tier - 1))
BASE_RADAR_RANGE = 500
TIER_MULTIPLIER = 1.5

Tier 1: 500 units
Tier 2: 750 units
Tier 3: 1125 units
Tier 4: 1688 units
Tier 5: 2531 units
```

**Progressive Feature Unlocks:**

| Tier | Range | Features |
|------|-------|----------|
| 1 | 500 | Basic - all objects as dots |
| 2 | 750 | Shape differentiation, heading indicators |
| 3 | 1125 | Faction identification, wormhole detection |
| 4 | 1688 | Combat awareness, loot rarity detection |
| 5 | 2531 | Sector map, predictive paths, threat zones |

### Energy Core

**Effect**: Boosts weapon cooldown, shield regen, and thrust

```javascript
// Weapon cooldown reduction
cooldownReduction = [0, 0.05, 0.10, 0.15, 0.20, 0.25]
effectiveCooldown = baseCooldown * (1 - cooldownReduction[tier])

// Shield regeneration bonus (HP/sec)
SHIELD_REGEN_BONUS: [0, 1.0, 2.0, 3.0, 4.0, 5.0]

Tier 1: 0% cooldown reduction, +0 regen
Tier 2: 5% faster firing, +1 HP/sec
Tier 3: 10% faster firing, +2 HP/sec
Tier 4: 15% faster firing, +3 HP/sec
Tier 5: 25% faster firing, +5 HP/sec
```

**Thrust Boost (Double-tap W):**

| Tier | Duration | Speed Mult | Cooldown |
|------|----------|------------|----------|
| 1 | 1000ms | 2.0x | 15s |
| 2 | 1250ms | 2.0x | 13s |
| 3 | 1500ms | 2.2x | 11s |
| 4 | 1750ms | 2.3x | 9s |
| 5 | 2000ms | 2.5x | 7s |

### Hull

**Effect**: Increases max HP and damage resistance

```javascript
// Hull HP calculation
hullMax = DEFAULT_HULL_HP * (TIER_MULTIPLIER ^ (tier - 1))
DEFAULT_HULL_HP = 100
TIER_MULTIPLIER = 1.5

Tier 1: 100 HP
Tier 2: 150 HP
Tier 3: 225 HP
Tier 4: 338 HP
Tier 5: 507 HP
```

**Damage Resistance by Type:**

| Tier | Kinetic | Energy | Explosive |
|------|---------|--------|-----------|
| 1 | 5% | 8% | 3% |
| 2 | 10% | 15% | 6% |
| 3 | 15% | 22% | 9% |
| 4 | 20% | 28% | 12% |
| 5 | 25% | 35% | 15% |

**Resistance Cap:** 50% (prevents future invincibility exploits)

## Tier Progression

### Tier 1 (Default)

- **Cost:** Free (starting configuration)
- **Resources:** None
- **Status:** All players begin here

### Tier 2

- **Credits:** 300
- **Resources:** 2-3 common resources (10-20 units each)
- **Example (Engine):** 15 Hydrogen, 10 Carbon

### Tier 3

- **Credits:** 900
- **Resources:** 2-3 uncommon + common mix (8-25 units)
- **Example (Engine):** 25 Hydrogen, 10 Helium-3, 8 Titanium

### Tier 4

- **Credits:** 3000
- **Resources:** Rare resources required (5-20 units)
- **Example (Engine):** 20 Helium-3, 10 Xenon, 5 Platinum

### Tier 5 (Max)

- **Credits:** 9000
- **Resources:** Ultrarare + rare mix (2-15 units)
- **Example (Engine):** 15 Xenon, 3 Antimatter, 2 Exotic Matter

## Upgrade Requirements

### Engine

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 15 Hydrogen, 10 Carbon |
| 3 | 900 | 25 Hydrogen, 10 Helium-3, 8 Titanium |
| 4 | 3000 | 20 Helium-3, 10 Xenon, 5 Platinum |
| 5 | 9000 | 15 Xenon, 3 Antimatter, 2 Exotic Matter |

### Weapons

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 15 Iron, 10 Nickel |
| 3 | 900 | 12 Titanium, 10 Cobalt, 8 Copper |
| 4 | 3000 | 8 Iridium, 5 Uranium, 8 Platinum |
| 5 | 9000 | 12 Uranium, 5 Dark Matter, 2 Neutronium |

### Shields

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 15 Silicon, 10 Sulfur |
| 3 | 900 | 12 Ice Crystals, 10 Lithium, 8 Silver |
| 4 | 3000 | 6 Quantum Crystals, 8 Dark Matter, 10 Gold |
| 5 | 9000 | 12 Quantum Crystals, 2 Void Crystals, 3 Exotic Matter |

### Mining Beam

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 20 Iron, 8 Carbon |
| 3 | 900 | 15 Titanium, 10 Copper, 8 Cobalt |
| 4 | 3000 | 10 Platinum, 6 Iridium, 8 Gold |
| 5 | 9000 | 12 Iridium, 3 Neutronium, 5 Dark Matter |

### Cargo Hold

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 20 Iron, 12 Nickel |
| 3 | 900 | 18 Titanium, 12 Copper, 6 Silver |
| 4 | 3000 | 25 Titanium, 8 Platinum, 5 Iridium |
| 5 | 9000 | 15 Iridium, 4 Neutronium, 1 Void Crystals |

### Radar

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 12 Copper, 15 Silicon |
| 3 | 900 | 10 Silver, 12 Neon, 8 Lithium |
| 4 | 3000 | 10 Gold, 5 Quantum Crystals, 8 Xenon |
| 5 | 9000 | 10 Quantum Crystals, 4 Exotic Matter, 2 Void Crystals |

### Energy Core

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 20 Hydrogen, 10 Phosphorus |
| 3 | 900 | 15 Helium-3, 12 Lithium, 3 Uranium |
| 4 | 3000 | 10 Uranium, 6 Dark Matter, 20 Helium-3 |
| 5 | 9000 | 5 Antimatter, 3 Exotic Matter, 2 Neutronium |

### Hull

| Tier | Credits | Resources |
|------|---------|-----------|
| 2 | 300 | 25 Iron, 15 Nickel |
| 3 | 900 | 20 Titanium, 12 Cobalt, 20 Iron |
| 4 | 3000 | 10 Iridium, 10 Platinum, 15 Titanium |
| 5 | 9000 | 5 Neutronium, 15 Iridium, 1 Void Crystals |

## Effects by Component

### Stat Multipliers

```javascript
// /shared/constants.js
MAX_TIER: 5
TIER_MULTIPLIER: 1.5        // Most components
SHIELD_TIER_MULTIPLIER: 2.0  // Shields only
```

### Cumulative Benefits

Upgrading multiple components creates synergistic effects:

**Example: Tier 5 Everything**
- Speed: 750 u/s (Engine T5)
- Damage: 50 w/ Tesla Cannon (Weapon T5)
- Shield: 800 HP + 7 HP/sec regen (Shield T5 + Energy Core T5)
- Hull: 507 HP + 25% kinetic resist (Hull T5)
- Mining: 0.6s per asteroid (Mining T5)
- Cargo: 2000 units (Cargo T5)
- Radar: 2531 range w/ full features (Radar T5)
- Cooldown: 25% faster firing (Energy Core T5)

## Upgrade Process

### Client Request

```javascript
// Client initiates upgrade
socket.emit('ship:upgrade', {
  component: 'engine'  // One of: engine, weapon, shield, mining, cargo, radar, energy_core, hull
});
```

### Server Validation

```javascript
// /server/handlers/ship.js - ship:upgrade handler

// 1. Check authentication
if (!authenticatedUserId) {
  socket.emit('upgrade:error', { message: 'Not authenticated' });
  return;
}

// 2. Get current tier
const ship = statements.getShipByUserId.get(userId);
const currentTier = ship.engine_tier;  // or weapon_tier, etc.

// 3. Check max tier
if (currentTier >= config.MAX_TIER) {
  socket.emit('upgrade:error', { message: 'Already at max tier' });
  return;
}

// 4. Get requirements
const nextTier = currentTier + 1;
const requirements = config.UPGRADE_REQUIREMENTS[component][nextTier];
// Example: { credits: 300, resources: { IRON: 15, NICKEL: 10 } }

// 5. Atomic transaction (credits + resources check + deduction + upgrade)
const result = performUpgrade(userId, component, requirements, config.MAX_TIER);
```

### Transaction (Atomic)

```javascript
// /server/database.js - performUpgrade()
const performUpgrade = db.transaction((userId, component, requirements, maxTier) => {
  // 1. Verify current tier
  const ship = statements.getShipByUserId.get(userId);
  const currentTier = ship[dbColumnMap[component]];

  // 2. Check credits
  if (ship.credits < requirements.credits) {
    return { success: false, error: 'Not enough credits' };
  }

  // 3. Check ALL resources
  const inventory = statements.getInventory.all(userId);
  for (const [resourceType, required] of Object.entries(requirements.resources)) {
    const available = inventory.find(i => i.resource_type === resourceType)?.quantity || 0;
    if (available < required) {
      return { success: false, error: `Need ${required} ${resourceType}` };
    }
  }

  // 4. Deduct credits
  statements.updateShipCredits.run(ship.credits - requirements.credits, userId);

  // 5. Deduct resources
  for (const [resourceType, quantity] of Object.entries(requirements.resources)) {
    // Decrement quantity or remove if 0
    statements.setInventoryQuantity.run(current - quantity, userId, resourceType);
  }

  // 6. Apply upgrade
  const nextTier = currentTier + 1;
  statements.upgradeShipComponent.run(/* ... nextTier params ... */, userId);

  return { success: true, newTier: nextTier };
});
```

### Client Response

```javascript
socket.on('upgrade:success', ({ component, newTier, credits, shieldMax, hullMax }) => {
  console.log(`Upgraded ${component} to tier ${newTier}`);
  // UI updates automatically via state sync
});

socket.on('upgrade:error', ({ message }) => {
  alert(message);
});
```

## Strategy Guide

### Early Game (Credits 0-1000)

**Priority:** Cargo > Mining > Engine

1. **Cargo Tier 2** (300cr) - Increases capacity to 250 (essential for stockpiling)
2. **Mining Tier 2** (300cr) - Halves mining time (doubles efficiency)
3. **Engine Tier 2** (300cr) - Doubles speed for faster travel

**Resource Focus:** Mine common resources (Iron, Carbon, Hydrogen) in inner belts.

### Mid Game (Credits 1000-10000)

**Priority:** Weapons/Shields > Radar > Mining/Cargo Tier 3

1. **Weapons Tier 3** (900cr) - Survive NPC encounters
2. **Shields Tier 3** (900cr) - 200 HP for PvE combat
3. **Radar Tier 3** (900cr) - Faction identification + wormhole detection
4. **Mining Tier 3** (900cr) - 1-second mining (fast farming)
5. **Cargo Tier 3** (900cr) - 500 capacity for extended trips

**Resource Focus:** Explore medium/large star systems for uncommon/rare resources.

### Late Game (Credits 10000+)

**Priority:** Tier 4 everything > Tier 5 selectively

1. **All components Tier 4** (24,000cr total) - Solid endgame baseline
2. **Weapons Tier 5** (9000cr) - Tesla Cannon for boss farming
3. **Cargo Tier 5** (9000cr) - 2000 capacity for mass trading
4. **Engine Tier 5** (9000cr) - Max speed for escaping ganks

**Resource Focus:** Farm bosses for ultrarare drops (Antimatter, Void Crystals, Neutronium).

### Resource Bottlenecks

**Tier 2-3:** Common resources are abundant—just mine consistently.

**Tier 4:**
- **Platinum** - Needed for Engine, Shield, Mining, Cargo, Hull (5 components!)
- **Helium-3** - Engine + Energy Core (stockpile early)

**Tier 5:**
- **Neutronium** - Weapon, Mining, Cargo, Energy Core, Hull (5 components!)
- **Exotic Matter** - Engine, Shield, Radar, Energy Core (boss drop only)
- **Void Crystals** - Shield, Cargo, Radar, Hull (boss/event drop)

### Total Cost for Max Tier

| Component | Total Credits | Total Resources |
|-----------|---------------|-----------------|
| Engine | 13,200 | 15 Hydrogen, 10 Carbon, 25 Hydrogen, 10 Helium-3, 8 Titanium, 20 Helium-3, 10 Xenon, 5 Platinum, 15 Xenon, 3 Antimatter, 2 Exotic Matter |
| Weapons | 13,200 | 15 Iron, 10 Nickel, 12 Titanium, 10 Cobalt, 8 Copper, 8 Iridium, 5 Uranium, 8 Platinum, 12 Uranium, 5 Dark Matter, 2 Neutronium |
| Shields | 13,200 | 15 Silicon, 10 Sulfur, 12 Ice Crystals, 10 Lithium, 8 Silver, 6 Quantum Crystals, 8 Dark Matter, 10 Gold, 12 Quantum Crystals, 2 Void Crystals, 3 Exotic Matter |
| Mining | 13,200 | 20 Iron, 8 Carbon, 15 Titanium, 10 Copper, 8 Cobalt, 10 Platinum, 6 Iridium, 8 Gold, 12 Iridium, 3 Neutronium, 5 Dark Matter |
| Cargo | 13,200 | 20 Iron, 12 Nickel, 18 Titanium, 12 Copper, 6 Silver, 25 Titanium, 8 Platinum, 5 Iridium, 15 Iridium, 4 Neutronium, 1 Void Crystals |
| Radar | 13,200 | 12 Copper, 15 Silicon, 10 Silver, 12 Neon, 8 Lithium, 10 Gold, 5 Quantum Crystals, 8 Xenon, 10 Quantum Crystals, 4 Exotic Matter, 2 Void Crystals |
| Energy Core | 13,200 | 20 Hydrogen, 10 Phosphorus, 15 Helium-3, 12 Lithium, 3 Uranium, 10 Uranium, 6 Dark Matter, 20 Helium-3, 5 Antimatter, 3 Exotic Matter, 2 Neutronium |
| Hull | 13,200 | 25 Iron, 15 Nickel, 20 Titanium, 12 Cobalt, 20 Iron, 10 Iridium, 10 Platinum, 15 Titanium, 5 Neutronium, 15 Iridium, 1 Void Crystals |

**Grand Total:** 105,600 credits + massive resource grind

## See Also

- [Resources System](resources.md) - Complete resource reference
- [Database Schema](database-schema.md#ships) - Ship component storage
- [Socket Events](../api/socket-events.md#ship-events) - Upgrade events
- [Configuration](../../CLAUDE.md) - Project configuration and constants
