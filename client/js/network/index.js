// Galaxy Miner - Network Handlers Index
// Exports all network handler registration functions

/**
 * Registers all socket event handlers by calling each module's register function
 * @param {Socket} socket - Socket.io client instance
 */
function registerAllHandlers(socket) {
  // Core handlers
  if (window.NetworkHandlers.auth) {
    window.NetworkHandlers.auth.register(socket);
  }

  if (window.NetworkHandlers.player) {
    window.NetworkHandlers.player.register(socket);
  }

  if (window.NetworkHandlers.combat) {
    window.NetworkHandlers.combat.register(socket);
  }

  if (window.NetworkHandlers.mining) {
    window.NetworkHandlers.mining.register(socket);
  }

  if (window.NetworkHandlers.marketplace) {
    window.NetworkHandlers.marketplace.register(socket);
  }

  if (window.NetworkHandlers.chat) {
    window.NetworkHandlers.chat.register(socket);
  }

  if (window.NetworkHandlers.ship) {
    window.NetworkHandlers.ship.register(socket);
  }

  if (window.NetworkHandlers.loot) {
    window.NetworkHandlers.loot.register(socket);
  }

  if (window.NetworkHandlers.wormhole) {
    window.NetworkHandlers.wormhole.register(socket);
  }

  if (window.NetworkHandlers.npc) {
    window.NetworkHandlers.npc.register(socket);
  }

  if (window.NetworkHandlers.derelict) {
    window.NetworkHandlers.derelict.register(socket);
  }

  if (window.NetworkHandlers.scavenger) {
    window.NetworkHandlers.scavenger.register(socket);
  }

  if (window.NetworkHandlers.pirate) {
    window.NetworkHandlers.pirate.register(socket);
  }

  if (window.NetworkHandlers.fleet) {
    window.NetworkHandlers.fleet.register(socket);
  }
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerAllHandlers };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.registerAll = registerAllHandlers;
}
