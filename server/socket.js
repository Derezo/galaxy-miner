/**
 * Socket Handler Module (Thin Wrapper)
 *
 * Re-exports the modular socket handler implementation.
 * All socket handlers are now organized in /server/socket/ directory.
 *
 * @see /server/socket/index.js - Main orchestrator
 * @see /server/socket/helpers.js - Shared utilities and state
 * @see /server/socket/broadcasts.js - External broadcast functions
 *
 * Handler modules:
 * - auth.js - Login, register, token auth, logout (4 handlers)
 * - player.js - Movement input, respawn (2 handlers)
 * - combat.js - Fire weapon with chain lightning (1 handler)
 * - mining.js - Start/stop mining (2 handlers)
 * - derelict.js - Salvage, beacon request, siphon collect (3 handlers)
 * - chat.js - Send message (1 handler)
 * - marketplace.js - List, buy, cancel, get listings (5 handlers)
 * - ship.js - Upgrade, customize, get data (4 handlers)
 * - loot.js - Start/cancel collect, get nearby, multi-collect (4 handlers)
 * - wormhole.js - Enter, select destination, cancel, progress (5 handlers)
 * - relic.js - Plunder base (1 handler)
 * - emote.js - Send emote (1 handler)
 * - connection.js - Ping, disconnect with cleanup (2 handlers)
 */
module.exports = require('./socket/index');
