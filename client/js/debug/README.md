# Debug Settings System

The Debug Settings system provides runtime toggles for visual overlays and console logging categories. Settings persist to localStorage and are accessible via the Developer tab in the Profile modal.

## Quick Start

1. Open the Profile modal (click your avatar or press `P`)
2. Select the **Developer** tab
3. Enable the **Master Toggle** at the top
4. Toggle individual debug features as needed

## API Reference

### DebugSettings

Central configuration store located at `/client/js/debug/DebugSettings.js`.

```javascript
// Check if debugging is globally enabled
DebugSettings.isEnabled()  // returns boolean

// Enable/disable all debug features
DebugSettings.setEnabled(true)   // enable master toggle
DebugSettings.setEnabled(false)  // disable master toggle (preserves individual settings)

// Get a specific setting (returns false if master toggle is off)
DebugSettings.get('rendering', 'collisionHitboxes')  // returns boolean
DebugSettings.get('logging', 'npcs')                  // returns boolean

// Set a specific setting (auto-saves to localStorage)
DebugSettings.set('rendering', 'sectorGrid', true)
DebugSettings.set('logging', 'combat', false)

// Get all settings
DebugSettings.getAll()  // returns { enabled, rendering: {...}, logging: {...} }

// Reset all settings to defaults
DebugSettings.reset()
```

### Logger.category()

Category-aware logging that respects debug settings. Located in `/shared/logger.js`.

```javascript
// Only logs if master toggle is ON and the category is enabled
Logger.category('npcs', 'NPC spawned at', x, y);
// Output: [NPCS] NPC spawned at 100 200

Logger.category('combat', 'Damage dealt:', damage);
// Output: [COMBAT] Damage dealt: 50

Logger.category('mining', 'Started mining', objectId);
// Output: [MINING] Started mining ss_0_0_0_asteroid_5
```

**Note:** On the server side (Node.js), `Logger.category()` always logs since there's no `window.DebugSettings`. Server-side debugging is controlled separately via the `DEBUG` environment variable.

## Available Settings

### Visual Overlays (rendering)

| Key | Description |
|-----|-------------|
| `miningClaimRings` | Green/yellow rings around mining claim asteroids |
| `collisionHitboxes` | Circles around asteroids, planets, NPCs, player; rectangles around bases |
| `sectorGrid` | Dashed 1000-unit grid lines with sector coordinate labels |
| `npcStateIndicators` | AI state labels above NPCs (color-coded by state) |
| `asteroidIds` | Object ID labels below asteroids |
| `planetIds` | Object ID labels below planets |

### Console Logging (logging)

| Key | Description |
|-----|-------------|
| `rendering` | Render loop, draw calls, visual updates |
| `worldGeneration` | Sector generation, star systems, procedural content |
| `npcs` | NPC spawning, despawning, state changes |
| `bases` | Faction base spawning, destruction, respawning |
| `aiStrategies` | AI decision making, target selection, pathfinding |
| `audio` | Sound playback, spatial audio, music transitions |
| `controls` | Input handling, key bindings, mouse events |
| `ui` | Panel updates, modal state, HUD changes |
| `network` | Socket events, message traffic, sync issues |
| `combat` | Damage calculation, hit detection, death events |
| `mining` | Mining start/complete, resource drops, beam targeting |

## Visual Overlay Details

### Collision Hitboxes

Color-coded by entity type:
- **Asteroids**: Cyan `rgba(0, 255, 255, 0.6)`
- **Planets**: Magenta `rgba(255, 0, 255, 0.6)`
- **Bases**: Orange `rgba(255, 165, 0, 0.6)` (rectangles)
- **Player**: White `rgba(255, 255, 255, 0.8)`
- **NPCs**: Faction-colored
  - Pirates: Red
  - Scavengers: Brown
  - Swarm: Purple
  - Void: Indigo
  - Rogue Miners: Gold

### NPC State Indicators

Color-coded by AI state:
- `IDLE` / `PATROL`: Gray
- `MINING`: Yellow
- `ATTACKING`: Red
- `FLEEING` / `RETREATING`: Cyan
- `CHASING`: Orange
- `DEFENDING`: Green
- `FORMATION`: Purple
- `RETURNING`: Light Blue

### Sector Grid

- Dashed lines at 1000-unit boundaries
- Labels show `(sectorX, sectorY)` at grid intersections
- Subtle gray color to avoid visual clutter

## Storage

Settings are stored in localStorage under the key `galaxy-miner-debug-settings`.

```javascript
// Example stored data
{
  "enabled": true,
  "rendering": {
    "miningClaimRings": false,
    "collisionHitboxes": true,
    "sectorGrid": false,
    "npcStateIndicators": true,
    "asteroidIds": false,
    "planetIds": false
  },
  "logging": {
    "rendering": false,
    "worldGeneration": false,
    "npcs": true,
    "bases": false,
    "aiStrategies": true,
    "audio": false,
    "controls": false,
    "ui": false,
    "network": false,
    "combat": true,
    "mining": false
  }
}
```

## Adding New Debug Options

### Adding a Visual Overlay

1. Add the key to `DebugSettings._defaults.rendering` in `DebugSettings.js`
2. Add the checkbox to `renderingOptions` array in `profile-modal.js`
3. Add the rendering code in `renderer.js`, gated by:
   ```javascript
   if (DebugSettings.get('rendering', 'yourNewOption')) {
     // Draw debug visuals
   }
   ```

### Adding a Logging Category

1. Add the key to `DebugSettings._defaults.logging` in `DebugSettings.js`
2. Add the checkbox to `loggingOptions` array in `profile-modal.js`
3. Use throughout codebase:
   ```javascript
   Logger.category('yourNewCategory', 'Debug message', data);
   ```

## Related Systems

- **DebugSync** (`/shared/debug-sync.js`): Separate system for entity desync tracking, enabled via `DEBUG_SYNC=true` env var or `?debugSync=true` URL param
- **Chat Debug Commands** (`/client/js/ui/chat.js`): Type `/debug` in chat for additional debug commands
