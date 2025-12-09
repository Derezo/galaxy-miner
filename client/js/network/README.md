# Network Handlers

This directory contains modularized Socket.io event handlers for the Galaxy Miner client.

## Structure

The network handlers are organized into separate modules by functionality:

- **auth.js** - Authentication handlers (`auth:success`, `auth:error`)
- **player.js** - Player state handlers (`player:update`, `player:death`, `player:respawn`, `player:damaged`, etc.)
- **combat.js** - Combat event handlers (`combat:fire`, `combat:hit`, `combat:npcFire`, `combat:chainLightning`, etc.)
- **mining.js** - Mining and inventory handlers (`mining:started`, `mining:complete`, `inventory:update`, `world:update`)
- **marketplace.js** - Market system handlers (`market:update`, `market:listings`, `market:bought`, etc.)
- **chat.js** - Chat and emote handlers (`chat:message`, `emote:broadcast`, `pong`)
- **ship.js** - Ship customization and upgrades (`ship:colorChanged`, `upgrade:success`, `upgrade:error`)
- **loot.js** - Loot collection, wreckage, buffs, relics (`loot:started`, `loot:complete`, `buff:applied`, `relic:collected`)
- **wormhole.js** - Wormhole transit handlers (`wormhole:entered`, `wormhole:transitProgress`, etc.)
- **npc.js** - NPC and base handlers (`npc:spawn`, `npc:destroyed`, `base:damaged`, swarm/queen events, etc.)
- **index.js** - Exports `registerAllHandlers()` to initialize all modules

## Usage Pattern

Each handler module follows this pattern:

```javascript
function register(socket) {
  socket.on('event:name', (data) => {
    // Handler logic using window.Logger, Player, Entities, etc.
  });
}

// Export for browser globals
window.NetworkHandlers = window.NetworkHandlers || {};
window.NetworkHandlers.moduleName = { register };
```

## Integration

To use these handlers in the main Network module:

1. Load all handler scripts in index.html (before network.js)
2. Call `window.NetworkHandlers.registerAll(socket)` in Network.init()

## Benefits

- **Maintainability**: Each domain has its own file (88+ handlers split into 10 modules)
- **Readability**: Easier to find specific handlers by category
- **Debugging**: Clear module boundaries for debugging
- **Performance**: No build step required, works with vanilla JS
- **Consistency**: All handlers use `window.Logger`, browser globals

## File Sizes

- auth.js: ~800 bytes (2 handlers)
- player.js: ~5.3 KB (8 handlers)
- combat.js: ~5.8 KB (9 handlers)
- mining.js: ~2.8 KB (7 handlers)
- marketplace.js: ~2.5 KB (8 handlers)
- chat.js: ~1.2 KB (3 handlers)
- ship.js: ~4.1 KB (6 handlers)
- loot.js: ~4.5 KB (11 handlers)
- wormhole.js: ~1.5 KB (6 handlers)
- npc.js: ~24 KB (28 handlers - largest module due to complex faction events)
- index.js: ~1.5 KB (coordinator)

**Total**: ~53 KB (vs original 1,704 line monolithic file)

## Handler Count by Module

- auth: 2
- player: 8
- combat: 9
- mining: 7
- marketplace: 8
- chat: 3
- ship: 6
- loot: 11
- wormhole: 6
- npc: 28 (includes swarm queen, bases, assimilation, etc.)

**Total**: 88 handlers

## Notes

- All handlers use `window.Logger.log()` instead of `Logger.log()` for consistency
- `Network._activeMiningDrillTier` is accessed for mining audio state
- Each module can be loaded independently for testing
- No external dependencies beyond Socket.io and game globals
