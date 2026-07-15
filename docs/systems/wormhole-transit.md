# Wormhole Transit System

## Overview

The Wormhole Transit system allows players possessing the **Wormhole Gem** relic to cross vast distances through a timed, server-authoritative transit. Default travel takes 5 seconds; a player who also owns the Subspace Warp Drive completes it in 2 seconds.

## Purpose

- **Fast Travel**: Jump thousands of units across the galaxy in seconds
- **Strategic Positioning**: Access remote sectors for mining, exploration, or evasion
- **Relic Utility**: Provides end-game functionality for rare Wormhole Gem holders
- **Commitment**: Selection/transit is an invulnerable out-of-world state, but movement, combat, mining, and loot actions are blocked until exit or selection cancellation

## Wormhole Mechanics

### Entry Requirements

1. **Wormhole Gem Relic**: Player must possess the non-tradable `WORMHOLE_GEM` relic (ultrarare; artifact metadata value 2000)
2. **Proximity**: Must be within **100 units + wormhole size** to enter
3. **Not In Transit**: Cannot enter if already transiting
4. **Cooldown Ready**: Base cooldown is 60 seconds after a completed trip, or 45 seconds with Subspace Warp Drive

### Wormhole Properties

- **Size**: 200 units (defined in `CONSTANTS.WORMHOLE_SIZE`)
- **Spawn Rate**: 8% chance per star system (`CONSTANTS.WORMHOLE_CHANCE`)
- **Visual**: Swirling cyan/blue portal with multi-color spiral arms
- **Distribution**: Procedurally placed using galaxy seed for consistent locations

### Transit Process

The transit system uses a 3-phase state machine:

#### Phase 1: Selection (30 seconds timeout)

When player enters a wormhole:

1. Server finds **5 nearest wormholes** using expanding sector search
2. Filters out the entry wormhole (cannot transit to same wormhole)
3. Sends destination list with coordinates and distances
4. Client displays full-screen UI with cardinal-positioned destination buttons
5. Player has **30 seconds** to select destination or transit auto-cancels

From entry through exit (including destination selection), the server treats the player as outside the simulated world: NPC targeting, direct combat, damage-over-time, star heat, mining, loot collection, and movement are blocked.

**Destination Search Algorithm**:
```
Expands search in rings until 5 wormholes found (max 100 sectors)
for (searchRadius = 0 to maxSearchRadius) {
  for each sector at this radius {
    if wormhole found and not duplicate {
      add to list with distance
    }
  }
}
Returns 5 closest wormholes sorted by distance
```

#### Phase 2: Transit (5 seconds by default, 2 seconds with Subspace Warp Drive)

Once destination selected:

1. **Duration**: Configured default is 5000 ms. Subspace Warp Drive applies a 2.5× transit-speed multiplier, producing a 2000 ms trip with the default configuration.
2. **Protection**: Player is untargetable and cannot receive damage during committed transit
3. **Immobilization**: Player frozen at entry wormhole position
4. **Visual Effects**:
   - Full-screen tunnel effect with accelerating particles
   - Progress bar showing transit completion
   - Screen shake intensifies near completion
5. **Audio**: Continuous wormhole transit sound effect

**Transit State Tracking**:
```javascript
activeTransits.set(playerId, {
  phase: 'transit',
  entryWormholeId: string,
  destinationId: string,
  transitStartTime: timestamp,
  destination: { x, y, id }
});
```

#### Phase 3: Exit

Upon completion (when progress >= 1.0):

1. Player teleported to **exit position** (80 units from destination wormhole at random angle)
2. Transit state cleared from server memory
3. Normal game state resumes only after the configured duration has elapsed and the server commits the exit position
4. Client removes transit UI overlay

### Cancellation

- **Selection Phase**: Player can cancel anytime (ESC key or Cancel button)
- **Transit Phase**: **Cannot cancel** once destination selected
- **Auto-Cancel**: Selection times out after 30 seconds
- **Disconnect**: Transit state cleaned up if player disconnects

## Configuration Constants

Defaults are loaded through `server/env.js` and `server/config.js`; transit state and its 60-second base cooldown live in `server/game/wormhole.js`:

| Constant | Value | Description |
|----------|-------|-------------|
| `TRANSIT_DURATION` | 5000ms | Default authoritative travel time; divided by 2.5 for Subspace Warp Drive |
| `WORMHOLE_RANGE` | 100 units | Proximity required to enter |
| `SELECTION_TIMEOUT` | 30000ms | Time limit for choosing destination |
| `MAX_DESTINATIONS` | 5 | Number of destination options shown |
| `WORMHOLE_COOLDOWN` | 60000ms | Starts after successful completion; multiplied by 0.75 for Subspace Warp Drive |

Exit position calculation:
```javascript
const exitOffset = 80; // Units from wormhole center
const exitAngle = Math.random() * Math.PI * 2; // Random angle
const exitPosition = {
  x: destination.x + Math.cos(exitAngle) * exitOffset,
  y: destination.y + Math.sin(exitAngle) * exitOffset
};
```

## Server/Client Flow

### Server-Side (`/server/game/wormhole.js`)

**Functions**:

- `hasWormholeGem(playerId)` - Check if player owns the gem
- `getNearestWormholes(x, y, count)` - Find nearby wormholes (expanding search)
- `canEnterWormhole(player, wormholeId)` - Validate entry requirements
- `enterWormhole(player, wormholeId)` - Start selection phase, return destinations
- `selectDestination(playerId, destinationId)` - Begin transit
- `getTransitProgress(playerId)` - Query current phase and progress (0-1)
- `completeTransit(playerId)` - Finish transit, return exit position
- `cancelTransit(playerId, reason)` - Abort transit (selection phase only)
- `isInTransit(playerId)` - Check if player is currently transiting
- `cleanupPlayer(playerId)` - Remove transit state on disconnect

**State Management**:
```javascript
// Active transits tracked in Map
const activeTransits = new Map(); // playerId -> transitState

// Transit state object
{
  phase: 'selecting' | 'transit',
  entryWormholeId: string,
  entryPosition: { x, y },
  destinations: Array,           // selection phase only
  startTime: timestamp,          // for selection timeout
  selectionTimeout: timeoutId,   // auto-cancel timer
  transitStartTime: timestamp,   // transit phase only
  destinationId: string,         // transit phase only
  destination: { x, y, id, ... } // transit phase only
}
```

### Client-Side (`/client/js/ui/WormholeTransitUI.js`)

**UI Components**:

1. **Full-Screen Overlay** (`#wormhole-transit-overlay`)
   - Dark translucent background
   - Canvas for wormhole visual effects
   - Blocks all game input during transit

2. **Destination Selection**
   - 5 buttons positioned around central wormhole visualization
   - Cardinal positions: top, right, bottom, left, top-right
   - Shows sector coordinates and distance
   - Click to select, ESC to cancel

3. **Transit Animation**
   - 3D tunnel effect with particles moving toward camera
   - Accelerating speed as progress increases
   - Progress bar showing completion
   - Screen shake intensifies near arrival

4. **Wormhole Visualization**
   - Central portal with reversed gradient (bright center, dark edges)
   - 6 spiral arms with mixed colors (cyan, orange, blue)
   - Pulsing rings and particle effects
   - Rotates continuously for dynamic appearance

**Animation Details**:

Selection Phase: Ambient swirl effect
- 5 concentric arc rings rotating at different speeds
- 40 floating particles spiraling inward
- Mixed colors: cyan, blue, orange, white

Transit Phase: Tunnel effect
- 200+ particles moving toward camera (3D projection)
- Particles respawn at far end when reaching camera
- Speed increases with progress (1x to 3x)
- Motion blur streaks for speed sensation

### Socket Events

**Client to Server**:
```javascript
// Request to enter wormhole
socket.emit('wormhole:enter', { wormholeId: string });
// Response event: wormhole:entered or wormhole:error

// Select destination
socket.emit('wormhole:selectDestination', { destinationId: string });
// Response event: wormhole:transitStarted or wormhole:error

// Cancel transit (selection phase only)
socket.emit('wormhole:cancel');
// Response event: wormhole:cancelled
```

**Server to Client**:
```javascript
socket.on('wormhole:entered', ({ wormholeId, destinations }) => {
  showDestinationSelection(wormholeId, destinations);
});

socket.on('wormhole:transitStarted', ({ destinationId, destination, duration, hasVoidWarp }) => {
  startTransitAnimation({ destinationId, destination, duration, hasVoidWarp });
});

socket.on('wormhole:progress', ({ phase, progress, complete }) => {
  updateTransitProgress({ phase, progress, complete });
});

// Transit completed after the authoritative timer (player teleported)
socket.on('wormhole:exitComplete', (data) => {
  const {
    position: { x, y },
    wormholeId,
    hasVoidWarp
  } = data;
});

// Transit cancelled
socket.on('wormhole:cancelled', ({ reason }) => {
  showCancellation(reason);
});
```

## Related Files

### Core System
- `/server/game/wormhole.js` - Server-side transit logic
- `/server/env.js`, `/server/config.js` - Environment-backed transit defaults
- `/shared/constants.js` - Wormhole generation and relic effect metadata

### Client UI
- `/client/js/ui/WormholeTransitUI.js` - Full-screen transit overlay
- `/client/js/player.js` - Client transit state integration

### World Generation
- `/server/world.js` - Wormhole spawning in star systems
- `/client/js/world.js` - Client-side wormhole rendering

### Database
- `/server/schema.sql` - `relics` table for Wormhole Gem ownership

## Design Notes

### Security Considerations

- **No Mid-Transit Cancel**: Prevents exploit of invulnerability
- **Distance Validation**: Server verifies proximity before entry
- **Destination Validation**: Selected destination must be in offered list
- **Relic Verification**: Checks database for Wormhole Gem ownership
- **State Cleanup**: Removes transit state on disconnect

### Performance

- **Expanding Search**: Finds nearest wormholes efficiently without checking all sectors
- **O(1) Duplicate Detection**: Uses Set instead of array for seen wormhole IDs
- **Minimal State**: Active transits and cooldowns are process-local maps, not persistent database data
- **Sector Caching**: Uses existing world generation cache for wormhole positions

### Player Experience

- **Clear Feedback**: Full-screen UI with progress indication
- **Time Pressure**: 30-second selection creates urgency without stress
- **Commitment**: Default transit takes 5 seconds (2 seconds with Subspace Warp Drive); normal actions resume only after the server completes the exit
- **Strategic Depth**: Must choose destination wisely
- **Accessibility**: Large buttons, clear labels, ESC to cancel
