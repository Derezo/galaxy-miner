// Galaxy Miner - Chat Network Handlers

/**
 * Registers chat and emote-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('chat:message', (data) => {
    // Play chat receive sound (non-spatial)
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.play('chat_receive');
    }

    ChatUI.addMessage(data);
  });

  // Emote broadcast from other players
  socket.on('emote:broadcast', (data) => {
    // Skip if it's our own emote (we show it locally already)
    if (data.playerId === Player.id) return;

    if (typeof EmoteRenderer !== 'undefined') {
      EmoteRenderer.show(data.x, data.y, data.emoteType, data.playerName);
    }
  });

  // Latency measurement
  socket.on('pong', (timestamp) => {
    const latency = Date.now() - timestamp;
    HUD.updateLatency(latency);
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.chat = { register };
}
