# Wreckage System Overview

## Purpose

The wreckage system handles the spawning, collection, and lifecycle of loot drops when entities (NPCs, players, bases) are destroyed. It's a critical gameplay mechanic that provides rewards for combat and creates opportunities for resource gathering.

## Key Concepts

### Wreckage
Wreckage is a collectible entity spawned at the location of a destroyed NPC, player, or base. It contains:
- **Credits** - Currency reward
- **Resources** - Various mineable materials (metals, gases, crystals, exotics)
- **Buffs** - Temporary power-ups (shield boost, speed burst, damage amp)
- **Components** - Upgrade parts for tier 6+ equipment
- **Relics** - Rare permanent collectibles with special abilities

### Collection Methods
1. **Standard Collection** - Hold position near wreckage, progress bar fills over time
2. **Scrap Siphon (Relic)** - Multi-collect up to 3 wreckage pieces instantly within range

### Wreckage Sources
| Source | Trigger | Contents |
|--------|---------|----------|
| NPC Death | Combat kill | Credits + resources based on NPC type |
| Player Death | Combat kill | 50% of player's cargo (shared) |
| Base Destruction | Combat kill | Large resource cache |
| Scavenger Dumps | NPC behavior | Accumulated collected wreckage |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   combat.js  │───▶│  engine.js   │───▶│   loot.js    │       │
│  │  (triggers)  │    │ (processes)  │    │  (spawns)    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                             │                    │               │
│                             ▼                    │               │
│                      ┌──────────────┐            │               │
│                      │  socket.js   │◀───────────┘               │
│                      │  (events)    │                            │
│                      └──────────────┘                            │
│                             │                                    │
└─────────────────────────────│────────────────────────────────────┘
                              │ Socket.io Events
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  network.js  │───▶│ entities.js  │───▶│ renderer.js  │       │
│  │  (receives)  │    │  (stores)    │    │  (draws)     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │  player.js   │───▶│   input.js   │                           │
│  │ (collection) │    │  (triggers)  │                           │
│  └──────────────┘    └──────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Socket Events Summary

### Server → Client
| Event | Purpose | When Fired |
|-------|---------|------------|
| `wreckage:spawn` | New wreckage created | Entity death |
| `wreckage:despawn` | Wreckage removed (timeout) | After 60s |
| `wreckage:collected` | Someone collected wreckage | Collection complete |
| `loot:started` | Collection begun | Player starts collecting |
| `loot:progress` | Collection progress update | During collection |
| `loot:complete` | Collection finished | Standard collect done |
| `loot:cancelled` | Collection interrupted | Player moved/cancelled |
| `loot:error` | Collection failed | Various error conditions |
| `loot:multiStarted` | Scrap Siphon started | Multi-collect initiated |
| `loot:multiComplete` | Scrap Siphon done | Multi-collect finished |

### Client → Server
| Event | Purpose | When Sent |
|-------|---------|-----------|
| `loot:startCollect` | Begin collecting | Player presses M near wreckage |
| `loot:cancelCollect` | Stop collecting | Player moves or presses M again |
| `wreckage:multiCollect` | Scrap Siphon | Player with relic presses M |
| `loot:getNearby` | Query nearby wreckage | UI/radar needs data |

## File Locations

### Server
| File | Responsibility |
|------|----------------|
| `/server/game/loot.js` | Core wreckage data structure, spawn/remove/query |
| `/server/game/loot-pools.js` | Loot table definitions per NPC type |
| `/server/game/engine.js` | Wreckage lifecycle, cleanup, broadcasts |
| `/server/socket.js` | Socket event handlers for collection |
| `/server/handlers/loot.js` | Modular handler (NOT currently used) |
| `/server/game/ai/scavenger.js` | NPC wreckage collection behavior |

### Client
| File | Responsibility |
|------|----------------|
| `/client/js/network.js` | Socket event handlers (ACTIVE) |
| `/client/js/network/loot.js` | Modular handlers (NOT loaded) |
| `/client/js/entities.js` | Wreckage storage, animation state |
| `/client/js/renderer.js` | Wreckage rendering, siphon effects |
| `/client/js/player.js` | Collection state, progress tracking |
| `/client/js/input.js` | M key handling for collection |

## Known Issues & Technical Debt

### Duplicate Handler Architecture
The codebase has TWO network handler systems:
1. **Main handlers** in `/client/js/network.js` - ACTIVE, loaded via index.html
2. **Modular handlers** in `/client/js/network/*.js` - NOT LOADED

The modular system exists but isn't wired up. Events must be added to `network.js` to work.

### Cache Busting Required
Client JS files use `?v=N` cache busters. After editing network.js or entities.js, increment the version in `index.html`:
```html
<script src="js/network.js?v=9"></script>
<script src="js/entities.js?v=9"></script>
```

### Animation Timing
The Scrap Siphon animation (600ms minimum) is longer than the server collection time (500ms). The client delays wreckage removal to let the animation complete:
```javascript
// network.js - loot:multiComplete handler
setTimeout(() => {
  Entities.removeWreckage(wreckageId);
}, 650); // Wait for animation
```

## Related Systems

- **Combat System** - Triggers wreckage spawns on kills
- **Scavenger AI** - NPCs that collect and transport wreckage
- **Team Credits** - Damage contributors share rewards
- **Relics** - Scrap Siphon provides enhanced collection
- **Radar** - Shows nearby wreckage locations

## See Also

- [Wreckage System Deep Dive](./wreckage-system-deep-dive.md) - Detailed flow diagrams and code paths
- [Socket Events API](../api/socket-events.md) - Full event documentation
- [Team Multiplayer System](./team-multiplayer.md) - Credit sharing mechanics
