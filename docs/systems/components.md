# Upgrade Components System

## Overview

The Upgrade Components system provides materials for **tier 6+ ship upgrades** (future feature). Components are rare drops from mid/high-tier NPCs and faction bases, with higher tiers requiring component-based crafting instead of just credits and resources.

## Purpose

- **End-Game Progression**: Extends upgrade path beyond tier 5
- **Resource Sink**: Provides value for component farming
- **Rarity System**: Components are harder to obtain than regular resources
- **Crafting Preparation**: Infrastructure for future crafting mechanics

## Component Types

All components defined in `CONSTANTS.COMPONENT_TYPES`:

### Engine Core

**ID**: `engine_core`
**Rarity**: Rare
**Description**: Advanced propulsion matrix for tier 6+ engines
**Drop Sources**: Pirates, Scavengers, Swarm (engine-focused factions)
**Future Use**: Engine tier 6-10 upgrades

### Weapon Matrix

**ID**: `weapon_matrix`
**Rarity**: Rare
**Description**: Targeting and fire control system for tier 6+ weapons
**Drop Sources**: Pirates, Void Entities (combat-focused factions)
**Future Use**: Weapon tier 6-10 upgrades

### Shield Cell

**ID**: `shield_cell`
**Rarity**: Rare
**Description**: Advanced shield generator cells for tier 6+ shields
**Drop Sources**: Void Entities, Rogue Miners (defensive factions)
**Future Use**: Shield tier 6-10 upgrades

### Mining Capacitor

**ID**: `mining_capacitor`
**Rarity**: Rare
**Description**: Power storage for industrial mining equipment
**Drop Sources**: Scavengers, Swarm, Rogue Miners (industrial factions)
**Future Use**: Mining beam tier 6-10 upgrades

## Drop Rates by Tier

Components drop from NPCs based on tier (defined in loot-pools.js):

| NPC Tier | Component Chance | Typical Enemies |
|----------|-----------------|-----------------|
| Low | 1% | Scouts, Scrappers, Drones |
| Mid | 5% | Fighters, Salvagers, Workers |
| High | 10% | Captains, Collectors, Warriors |
| Boss | 30% | Dreadnoughts, Queens, Leviathans |
| Base | 50% | Faction bases (outposts, hives, rifts) |

**Note**: Bases have highest component drop rate (50%) to reward coordinated assaults

## Faction Component Pools

Each faction drops specific components based on thematic focus:

### Pirates
- Engine Core (mobility/speed)
- Weapon Matrix (offensive power)

### Scavengers
- Mining Capacitor (salvage operations)
- Engine Core (scavenging mobility)

### Swarm
- Engine Core (swarm speed)
- Mining Capacitor (resource extraction)

### Void Entities
- Weapon Matrix (dark energy weapons)
- Shield Cell (void protection)

### Rogue Miners
- Mining Capacitor (industrial mining)
- Shield Cell (defensive operations)

## Current Implementation Status

### Implemented
- Database schema (`components` table)
- Drop system integration (loot-pools.js)
- Faction-specific component pools
- Inventory storage and tracking
- Loot collection mechanics

### Planned (Tier 6+ Update)
- Crafting UI for combining components + resources
- Tier 6-10 upgrade requirements
- Component quality tiers (common/rare/legendary)
- Disassembly system (break down for scrap)
- Component trading in marketplace

## Database Schema

Components stored in SQLite with quantity tracking:

```sql
CREATE TABLE components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  component_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  obtained_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, component_type)
);
```

**Indexes**:
- Primary key on `id`
- Unique constraint on `(user_id, component_type)` prevents duplicates
- Foreign key cascades delete player components on account deletion

## Loot Collection

Components follow same collection flow as resources:

1. NPC/base dies, drops wreckage with loot
2. Player collects wreckage (2-second collect time per component)
3. Component added to player inventory via database
4. UI shows component collected with rarity indicator
5. Cargo panel displays component count

**Collection Time**: 2000ms per component (slower than resources)

## Related Files

### Core System
- `/server/game/loot-pools.js` - Component drop generation (lines 299-306)
- `/server/schema.sql` - Components table definition
- `/shared/constants.js` - Component type definitions (lines 1126-1131)

### Database Integration
- `/server/database.js` - Prepared statements for component queries
- `/server/game/loot.js` - Component collection mechanics

### UI (Future)
- `/client/js/ui/panels/CargoPanel.js` - Will display component inventory
- `/client/js/ui/CraftingUI.js` - Planned crafting interface

## Configuration

### Adding New Component Types

1. Add to `CONSTANTS.COMPONENT_TYPES` in `/shared/constants.js`:
```javascript
NEW_COMPONENT: {
  id: 'new_component',
  name: 'New Component',
  rarity: 'rare',
  description: 'Purpose and usage'
}
```

2. Add to faction component pools in `/server/game/loot-pools.js`:
```javascript
pirate: {
  components: ['ENGINE_CORE', 'WEAPON_MATRIX', 'NEW_COMPONENT']
}
```

3. Component automatically becomes available in loot drops

### Adjusting Drop Rates

Edit tier templates in `/server/game/loot-pools.js`:

```javascript
high: {
  specialDrops: {
    component: { chance: 0.15 }  // Increase to 15%
  }
}
```

## Future Crafting System Design

### Tier 6 Upgrade Requirements (Planned)

```javascript
// Example future requirements
UPGRADE_REQUIREMENTS: {
  weapon: {
    6: {
      credits: 20000,
      resources: { URANIUM: 20, IRIDIUM: 15, DARK_MATTER: 10 },
      components: { WEAPON_MATRIX: 3 }  // Requires 3 components
    },
    7: {
      credits: 50000,
      resources: { NEUTRONIUM: 10, VOID_CRYSTALS: 5 },
      components: { WEAPON_MATRIX: 5, SHIELD_CELL: 2 }
    }
  }
}
```

### Quality Tiers (Planned)

Components may have quality variants:

- **Standard** (50% drop rate) - Base component
- **Enhanced** (35% drop rate) - 20% upgrade bonus
- **Legendary** (15% drop rate) - 50% upgrade bonus

Quality affects upgrade stat bonuses when crafted

### Disassembly (Planned)

Break down unwanted components:
- Standard → 2 scrap metal
- Enhanced → 5 scrap metal
- Legendary → 15 scrap metal

Scrap metal used in basic repairs or sold for credits

## Examples

### Component Drop from Boss

```javascript
// Void Leviathan killed (boss tier, 30% component chance)
const loot = LootPools.generateLoot('void_leviathan');
// Possible output includes:
[
  // ... resources ...
  { type: 'component', componentType: 'WEAPON_MATRIX' },
  // Component chosen from Void faction pool
]
```

### Base Destruction Loot

```javascript
// Pirate Outpost destroyed (base tier, 50% component chance)
const loot = LootPools.generateLoot('pirate_outpost');
// High chance of components:
[
  // ... rare resources ...
  { type: 'component', componentType: 'ENGINE_CORE' },
  { type: 'component', componentType: 'WEAPON_MATRIX' }
  // 50% chance means often drops multiple components
]
```

### Component Collection

```javascript
// Player collects wreckage with component
function collectComponent(playerId, componentType) {
  // Add to database
  const stmt = db.prepare(`
    INSERT INTO components (user_id, component_type, quantity)
    VALUES (?, ?, 1)
    ON CONFLICT(user_id, component_type)
    DO UPDATE SET quantity = quantity + 1
  `);
  stmt.run(playerId, componentType);

  // Notify player
  socket.emit('component:collected', {
    componentType,
    quantity: getComponentQuantity(playerId, componentType)
  });
}
```

## Design Notes

### Why Separate from Resources?

- **Different Purpose**: Components for high-tier crafting, resources for basic upgrades
- **Rarity Control**: Can tune drop rates independently
- **Future Expansion**: Allows complex crafting recipes and quality tiers
- **Inventory Management**: Clear distinction in cargo UI

### Why Low Drop Rates?

- **End-Game Content**: Tier 6+ should take significant time to achieve
- **Player Retention**: Long-term goals keep players engaged
- **Economy Balance**: Prevents instant progression to max tier
- **Value Proposition**: Makes base destruction rewarding (50% vs 1-10%)

### Integration with Existing Systems

- Uses same loot-pools architecture as resources
- Collected via existing wreckage system
- Stored in database like resources
- Future crafting UI reuses upgrade panel patterns
