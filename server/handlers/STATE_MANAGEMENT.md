# State Management Architecture

## Overview

`/server/handlers/state.js` is the **single source of truth** for all server-side game state in Galaxy Miner. This module consolidates state management and provides helper functions for all handlers.

## Key Principles

1. All game state is managed through this module
2. No handler should create its own state maps
3. All state access goes through exported helper functions
4. Circular dependencies are avoided by keeping state separate from handlers

## State Maps

The module maintains the following state:

### `connectedPlayers` (Map)
- **Key**: `socketId` (string)
- **Value**: Player object with `{ id, username, position, velocity, rotation, hull, shield, radarTier, ... }`
- **Purpose**: Track all connected players and their current state

### `userSockets` (Map)
- **Key**: `userId` (number)
- **Value**: `socketId` (string)
- **Purpose**: Reverse lookup from user ID to socket ID

### `socketAuth` (Map)
- **Key**: `socketId` (string)
- **Value**: `userId` (number)
- **Purpose**: Track which user is authenticated on each socket

### `playerStatus` (Map)
- **Key**: `userId` (number)
- **Value**: `{ status: string, timeout: TimeoutID|null }`
- **Purpose**: Track player activity status (idle, mining, combat, etc.)

### `activeIntervals` (Map)
- **Key**: `socketId` (string)
- **Value**: `Set<intervalId>`
- **Purpose**: Track intervals for cleanup on disconnect

## API Functions

### Authentication

#### `getAuthUserId(socketId)`
Get the authenticated user ID for a socket.
```javascript
const userId = getAuthUserId(socket.id);
if (!userId) return; // Not authenticated
```

#### `setAuthUserId(socketId, userId)`
Set or clear authentication for a socket.
```javascript
setAuthUserId(socket.id, authenticatedUserId); // Set
setAuthUserId(socket.id, null); // Clear
```

### Player Lookups

#### `getPlayerBySocketId(socketId)`
Get player object by socket ID.
```javascript
const player = getPlayerBySocketId(socket.id);
if (!player) return;
```

#### `getSocketIdByUserId(userId)`
Get socket ID by user ID.
```javascript
const socketId = getSocketIdByUserId(userId);
if (socketId) {
  io.to(socketId).emit('notification', data);
}
```

#### `setPlayer(socketId, playerData)`
Set player data (automatically maintains both maps).
```javascript
setPlayer(socket.id, {
  id: userId,
  username: 'Player1',
  position: { x: 0, y: 0 },
  // ... other fields
});
```

#### `removePlayer(socketId)`
Remove player data (automatically cleans up both maps).
```javascript
removePlayer(socket.id);
```

### Player Status

#### `setPlayerStatus(userId, status, timeout?)`
Set player status with optional auto-clear timeout.
```javascript
setPlayerStatus(userId, 'mining'); // Set indefinitely
setPlayerStatus(userId, 'combat', 3000); // Auto-clear to 'idle' after 3s
```

#### `getPlayerStatus(userId)`
Get current player status (returns 'idle' if not set).
```javascript
const status = getPlayerStatus(userId);
```

#### `clearPlayerStatus(userId)`
Clear player status and any associated timeout.
```javascript
clearPlayerStatus(userId);
```

### Interval Tracking

#### `trackInterval(socketId, intervalId)`
Track an interval for cleanup on disconnect.
```javascript
const checkMining = setInterval(() => {
  // ... mining check logic
}, 100);
trackInterval(socket.id, checkMining);
```

#### `untrackInterval(socketId, intervalId)`
Remove tracked interval (when it completes normally).
```javascript
clearInterval(checkMining);
untrackInterval(socket.id, checkMining);
```

#### `clearAllIntervals(socketId)`
Clear all tracked intervals for a socket.
```javascript
clearAllIntervals(socket.id);
```

### Broadcasting

#### `broadcastToNearby(socket, player, event, data, io)`
Broadcast event to nearby players based on radar range.
```javascript
broadcastToNearby(socket, player, 'player:update', {
  id: userId,
  x: player.position.x,
  y: player.position.y,
  // ... other data
}, io);
```

### Cleanup

#### `cleanupPlayer(socket, userId, io)`
Full cleanup for a player on disconnect. This handles:
- Saving final position to database
- Broadcasting player leave to nearby players
- Clearing all intervals
- Canceling active mining/wormhole sessions
- Removing from all state maps
- Clearing authentication and status

```javascript
socket.on('disconnect', () => {
  const userId = getAuthUserId(socket.id);
  if (userId) {
    cleanupPlayer(socket, userId, io);
  }
});
```

## Usage Examples

### In Handlers

```javascript
// Import the state module
const {
  getAuthUserId,
  getPlayerBySocketId,
  setPlayerStatus,
  trackInterval,
  untrackInterval,
  broadcastToNearby
} = require('./state');

function register(ctx) {
  const { socket, io } = ctx;

  socket.on('mining:start', (data) => {
    // Get authenticated user
    const userId = getAuthUserId(socket.id);
    if (!userId) return;

    // Get player data
    const player = getPlayerBySocketId(socket.id);
    if (!player) return;

    // ... mining logic ...

    // Set status
    setPlayerStatus(userId, 'mining');

    // Broadcast to nearby
    broadcastToNearby(socket, player, 'mining:playerStarted', {
      playerId: userId,
      // ... other data
    }, io);

    // Track interval
    const checkMining = setInterval(() => {
      // ... check logic ...
    }, 100);
    trackInterval(socket.id, checkMining);
  });
}
```

### In socket.js (Legacy)

The socket.js file can now import and use the centralized state instead of maintaining its own:

```javascript
const {
  getAuthUserId,
  setAuthUserId,
  getPlayerBySocketId,
  setPlayer,
  cleanupPlayer,
  // ... other functions
} = require('./handlers/state');

module.exports = function(io) {
  io.on('connection', (socket) => {
    // Use state functions instead of local variables
    socket.on('auth:login', async (data) => {
      const result = await auth.login(username, password);
      if (result.success) {
        setAuthUserId(socket.id, result.player.id);
        setPlayer(socket.id, result.player);
        // ...
      }
    });

    socket.on('disconnect', () => {
      const userId = getAuthUserId(socket.id);
      if (userId) {
        cleanupPlayer(socket, userId, io);
      }
    });
  });
};
```

## Migration Path

### Current State (socket.js has duplicated state)

```javascript
// socket.js - BEFORE
const connectedPlayers = new Map(); // Duplicated!
const userSockets = new Map(); // Duplicated!
let authenticatedUserId = null; // Per-socket variable
```

### Target State (use centralized state)

```javascript
// socket.js - AFTER
const {
  getAuthUserId,
  setAuthUserId,
  getPlayerBySocketId,
  setPlayer,
  cleanupPlayer
} = require('./handlers/state');

// No local state variables needed!
```

## Benefits

1. **Single Source of Truth**: All state is in one place
2. **No Duplication**: State is not duplicated across modules
3. **Easier Testing**: State can be mocked/reset easily
4. **Better Organization**: Clear API for state access
5. **No Circular Dependencies**: State module doesn't import handlers
6. **Consistent Cleanup**: cleanupPlayer handles all cleanup logic

## Next Steps

The socket.js file should be refactored to:
1. Remove local state variables (connectedPlayers, userSockets, playerStatus, activeIntervals)
2. Remove authenticatedUserId per-socket variable
3. Use getAuthUserId/setAuthUserId instead
4. Use state helper functions throughout
5. Use centralized cleanupPlayer function
