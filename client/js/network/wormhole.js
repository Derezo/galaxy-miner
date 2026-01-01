// Galaxy Miner - Wormhole Transit Network Handlers

/**
 * Registers wormhole transit-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('wormhole:entered', (data) => {
    Player.onWormholeEntered(data);
  });

  socket.on('wormhole:transitStarted', (data) => {
    Player.onWormholeTransitStarted(data);
  });

  // Note: Server emits 'wormhole:progress', not 'wormhole:transitProgress'
  socket.on('wormhole:progress', (data) => {
    Player.onWormholeTransitProgress(data);
  });

  socket.on('wormhole:exitComplete', (data) => {
    Player.onWormholeExitComplete(data);
  });

  socket.on('wormhole:cancelled', (data) => {
    Player.onWormholeTransitCancelled(data);
  });

  socket.on('wormhole:error', (data) => {
    Player.onWormholeError(data);
  });

  // Wormhole nearest position (for gem directional indicator)
  socket.on('wormhole:nearestPosition', (data) => {
    if (data) {
      window.Logger.log('[Network] Received nearest wormhole at', Math.round(data.x), Math.round(data.y));
    } else {
      window.Logger.log('[Network] Received null wormhole position');
    }
    if (typeof RadarObjects !== 'undefined') {
      RadarObjects.cachedNearestWormhole = data;
      RadarObjects.lastWormholeUpdate = Date.now();
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.wormhole = { register };
}
