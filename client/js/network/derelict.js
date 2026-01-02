// Galaxy Miner - Derelict Network Handlers
// Handles socket events for derelict ships in The Graveyard

window.NetworkHandlers = window.NetworkHandlers || {};

window.NetworkHandlers.derelict = {
  /**
   * Register all derelict-related socket event handlers
   * @param {Socket} socket - Socket.io client instance
   */
  register(socket) {
    // Handle nearby derelicts update
    socket.on('derelict:nearby', (data) => {
      if (typeof DerelictRenderer !== 'undefined') {
        DerelictRenderer.updateDerelicts(data.derelicts || []);
      }
    });

    // Handle successful salvage
    socket.on('derelict:salvaged', (data) => {
      Logger.log('[DERELICT] Salvage successful:', data.derelictId,
        'wreckage:', data.wreckageCount);

      // The derelict is now on cooldown - update will come from next derelict:nearby
      // Wreckage spawns are handled by loot network handler (wreckage:spawn)

      // Show notification
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.show(`Salvaged ${data.wreckageCount} wreckage pieces`, 'success');
      } else if (typeof MessageStack !== 'undefined') {
        MessageStack.show(`Salvaged ${data.wreckageCount} wreckage pieces`, 'success');
      }
    });

    // Handle salvage effect (broadcast to all nearby players)
    socket.on('derelict:salvageEffect', (data) => {
      Logger.log('[DERELICT] Salvage effect at:', data.derelictX, data.derelictY);

      if (typeof DerelictRenderer !== 'undefined') {
        DerelictRenderer.triggerSalvageEffect(
          data.derelictId,
          data.derelictX,
          data.derelictY
        );
      }
    });

    // Handle cooldown status response
    socket.on('derelict:cooldownStatus', (data) => {
      Logger.log('[DERELICT] Cooldown status:', data.derelictId,
        'onCooldown:', data.onCooldown,
        'remaining:', data.cooldownRemaining);

      // Update derelict state if renderer has it
      if (typeof DerelictRenderer !== 'undefined') {
        const derelict = DerelictRenderer.derelicts.get(data.derelictId);
        if (derelict) {
          derelict.onCooldown = data.onCooldown;
          derelict.cooldownRemaining = data.cooldownRemaining;
        }
      }
    });

    // Handle errors - most errors should fail silently since the player
    // has already interacted with the derelict (cooldown) or is too far away
    socket.on('derelict:error', (data) => {
      // Only log errors in debug mode, don't show notifications to player
      // Cooldown and distance errors are expected and should be silent
      Logger.log('[DERELICT] Error (silent):', data.message);
    });

    Logger.log('[NETWORK] Derelict handlers registered');
  },

  /**
   * Request nearby derelicts from server
   * Should be called periodically when player is in/near Graveyard
   */
  requestNearby() {
    if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('derelict:getNearby');
    }
  },

  /**
   * Request to salvage a derelict
   * @param {string} derelictId - The derelict ID to salvage
   */
  salvage(derelictId) {
    if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('derelict:salvage', { derelictId });
    }
  },

  /**
   * Check cooldown status of a derelict
   * @param {string} derelictId - The derelict ID to check
   */
  checkCooldown(derelictId) {
    if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('derelict:checkCooldown', { derelictId });
    }
  }
};
