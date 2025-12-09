// Galaxy Miner - Authentication Network Handlers

/**
 * Registers authentication-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('auth:success', (data) => {
    window.Logger.log('Authentication successful');
    Network.token = data.token;
    localStorage.setItem('galaxy-miner-token', data.token);
    GalaxyMiner.startGame(data.player);
  });

  socket.on('auth:error', (error) => {
    console.error('Authentication error:', error);
    AuthUI.showError(error.message);
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.auth = { register };
}
