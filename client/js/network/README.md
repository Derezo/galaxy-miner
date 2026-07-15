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
- **wormhole.js** - Wormhole transit handlers (`wormhole:entered`, `wormhole:progress`, etc.)
- **npc.js** - NPC and base handlers (`npc:spawn`, `npc:destroyed`, `base:damaged`, swarm/queen events, etc.)
- **derelict.js** - Graveyard derelict discovery, salvage, and siphon events
- **scavenger.js** and **pirate.js** - Faction-specific boss and ability events
- **fleet.js** - Fleet membership, invites, and shared presence
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

1. Load `network.js`, then the handler scripts, in `index.html`.
2. Call `window.NetworkHandlers.registerAll(socket)` from `Network.init()` after page scripts have loaded.

## Reconnection

Socket.io reconnects reuse the existing socket and handler registrations. On a
disconnect, the game loop is paused, held inputs and firing intervals are
cleared, transient targets are dropped, and managed audio sources stop. A
successful token-auth response reapplies the complete authoritative player
snapshot, reinitializes world/entity state around that position, and resumes
the existing loop. This avoids duplicate listeners, duplicate animation-frame
loops, and stale client prediction.

If token authentication fails during reconnect, the invalid stored token is
removed and the paused game is not resumed.

## Benefits

- **Maintainability**: Each network domain has its own handler module
- **Readability**: Easier to find specific handlers by category
- **Debugging**: Clear module boundaries for debugging
- **Performance**: No build step required, works with vanilla JS
- **Consistency**: All handlers use `window.Logger`, browser globals

## Notes

- All handlers use `window.Logger.log()` instead of `Logger.log()` for consistency
- `Network._activeMiningDrillTier` is accessed for mining audio state
- Each module can be loaded independently for testing
- No external dependencies beyond Socket.io and game globals
