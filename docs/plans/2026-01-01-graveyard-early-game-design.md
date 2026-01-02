# The Graveyard & Early Game Overhaul

## Overview

A comprehensive redesign of the new player experience featuring a safe starting zone ("The Graveyard"), rebalanced player stats, and adjusted NPC difficulty curves.

**Goals:**
- Provide a safe area for new players to learn mechanics
- Create a compelling visual/narrative experience at spawn
- Smooth the early game difficulty curve
- Give the Swarm Hive Core relic a meaningful ability

---

## The Graveyard (Safe Zone)

### Location
- **Sectors:** (-1,-1) to (1,1) - a 3x3 grid centered on origin (9 sectors total)
- **Coordinates:** Roughly -1500 to +1500 on both axes

### Visual Identity
- Dense fields of ancient derelict spacecraft
- Dimmer ambient lighting (distant from major stars)
- Metallic glinting particle effects
- Atmosphere of ancient, frozen destruction

### Faction Rules
- **No hostile faction bases spawn** (no Pirates, Void, or Swarm)
- **Scavengers present** - non-aggressive, patrol and salvage derelicts
- **Rogue Miners present** - non-aggressive, mine asteroids and debris
- Hostile NPCs do not patrol into this zone

### NPC Behavior (Graveyard-Specific)
- Scavengers and Rogue Miners are **passive until attacked**
- If attacked: Defend themselves but do not call reinforcements
- Scavengers actively mine derelicts (same as wreckage collection behavior)
- On death: Drop standard faction loot (teaches players what these NPCs drop)

---

## Civilization Derelicts

### Description
Massive abandoned spacecraft from an ancient alien civilization. These form the core interactive element of The Graveyard.

### Visual Design
| Property | Value |
|----------|-------|
| Size | 400-600 units length (larger than faction bases) |
| Style | Multi-deck capital ships, alien architecture |
| Condition | Destroyed, broken apart, exposed interior decks |
| Reference | Battlestar Galactica, Dead Space Ishimura aesthetic |

### Ambient Detail
- 10-20 wreckage chunks slowly orbit each derelict
- Gentle drift and slight rotation
- Occasional electrical sparking
- Metallic glint particles

### Quantity
- 4-6 derelicts per sector
- 36-54 total across The Graveyard

### Player Interaction
1. Approach within 100 units of derelict
2. Press [M] to "Salvage Derelict"
3. Brief animation (1-2 sec) - chunks break off, dust cloud
4. Spawns 1-3 wreckage pieces nearby (50-100 units away)
5. **30-second cooldown** per derelict (server-tracked, global)

### Wreckage Loot Table
| Drop | Chance | Quantity |
|------|--------|----------|
| Common resources | 70% | 2-5 |
| Uncommon resources | 25% | 1-2 |
| Credits | 50% | 10-30 |
| Rare resources | 5% | 1 |

### Design Intent
- Enough value to fund T2 upgrades, possibly early T3
- Incentivizes venturing out for rare/ultra-rare resources
- Natural discovery - no tutorial prompts

---

## Respawn System Overhaul

### Default Respawn
- **All players respawn in The Graveyard** (near 0,0)
- No respawn location choices
- Safe recovery point, but potentially far from death location

### Swarm Hive Core Relic Respawn
If player possesses the SWARM_HIVE_CORE relic:
1. On death, automatically respawn at **nearest Swarm Hive**
2. Player materializes inside the hive
3. **Hive immediately destroyed** (dramatic implosion visual)
4. **All Swarm NPCs within ~500 units killed instantly**
5. Wreckage spawns from destroyed NPCs (lootable)

**No choice prompt** - automatic based on relic ownership.

### Relic Description Update
> *"This pulsing core resonates with Swarm hive-minds. Upon death, your consciousness is drawn to the nearest hive, triggering a catastrophic rejection that destroys the hive from within."*

### Strategic Implications
- Hive Core becomes a tactical "suicide bomb" option
- Players may intentionally die near problem hives
- Risk: Respawn in hostile Swarm territory
- Reward: Instant hive destruction + loot opportunity

---

## Player Stat Buffs

### Base Stats
| Stat | Current | New | Change |
|------|---------|-----|--------|
| BASE_SPEED | 150 | 180 | +20% |
| DEFAULT_HULL_HP | 100 | 120 | +20% |
| DEFAULT_SHIELD_HP | 50 | 60 | +20% |

### Weapon Stats
| Stat | Current | New | Change |
|------|---------|-----|--------|
| T1 Weapon Range | 180 | 200 | +11% |

### Engine Scaling
| Stat | Current | New | Notes |
|------|---------|-----|-------|
| TIER_MULTIPLIER (engine) | 1.5x | 1.4x | Prevents T5 from being too fast |

### Result
- T1 player speed: 180 (was 150) - 29% faster than fastest NPC
- T5 player speed: ~692 (was 759) - still very fast but less extreme
- ~20% more effective HP at start

---

## NPC Rebalancing

### Void Faction (Major Nerfs)
Previously buffed +150%, now reduced to manageable levels:

| NPC | Old Hull/Shield | New Hull/Shield | Old Dmg | New Dmg |
|-----|-----------------|-----------------|---------|---------|
| Void Whisper | 113/88 | 60/40 | 7 | 5 |
| Void Shadow | 200/150 | 120/80 | 12 | 9 |
| Void Phantom | 375/300 | 200/150 | 18 | 15 |

### Pirate Faction (Minor Tweaks)
| NPC | Old Hull/Shield | New Hull/Shield | Notes |
|-----|-----------------|-----------------|-------|
| Pirate Scout | 50/25 | 40/20 | Weaker scouts (they flee anyway) |
| Pirate Fighter | 100/50 | 100/50 | Unchanged (fair T1 matchup) |

### Other Factions
- Scavengers: Unchanged
- Rogue Miners: Unchanged
- Swarm: Unchanged

---

## Implementation Checklist

### Phase 1: Constants & Data
- [ ] Update `shared/constants.js` - BASE_SPEED, DEFAULT_HULL_HP, DEFAULT_SHIELD_HP
- [ ] Update `shared/constants.js` - WEAPON_RANGES T1 value
- [ ] Update `shared/constants.js` - TIER_MULTIPLIER for engines
- [ ] Add GRAVEYARD_ZONE config (sector bounds, derelict count)
- [ ] Add DERELICT_CONFIG (size, cooldown, loot table)

### Phase 2: Server - Safe Zone
- [ ] Modify `server/game/npc.js` - prevent hostile base spawning in Graveyard sectors
- [ ] Modify `server/game/npc.js` - Scavenger/Rogue Miner passive behavior flag
- [ ] Add Graveyard sector detection helper function

### Phase 3: Server - Derelicts
- [ ] Create derelict spawn system (procedural placement per sector)
- [ ] Add derelict interaction handler (salvage action)
- [ ] Implement 30s cooldown tracking per derelict
- [ ] Add wreckage spawning from derelict interaction
- [ ] Wire Scavenger AI to interact with derelicts

### Phase 4: Server - Respawn
- [ ] Modify `server/game/combat.js` - remove respawn choices, always Graveyard
- [ ] Add Swarm Hive Core respawn logic (find nearest hive)
- [ ] Implement hive destruction on Hive Core respawn
- [ ] Add AoE NPC kill on hive destruction

### Phase 5: Server - NPC Balance
- [ ] Update `server/game/npc.js` - Void faction stat changes
- [ ] Update `server/game/npc.js` - Pirate Scout stat changes

### Phase 6: Client - Derelict Visuals
- [ ] Create derelict ship renderer (large alien vessels)
- [ ] Add orbiting debris particle system
- [ ] Add salvage interaction UI/feedback
- [ ] Add cooldown visual indicator

### Phase 7: Client - Respawn UI
- [ ] Remove respawn location selection UI
- [ ] Add "Returning to Graveyard" message
- [ ] Add Hive Core respawn visual (if applicable)

### Phase 8: Client - Graveyard Atmosphere
- [ ] Adjust ambient lighting for Graveyard sectors
- [ ] Add metallic particle effects
- [ ] Optional: Unique background music/ambience

---

## Future Considerations (Not In Scope)
- Derelict interiors (docking, exploration)
- Additional relic respawn effects (Pirate, Void)
- Graveyard-specific quests or NPCs
- Tutorial beacon/greeter NPC
