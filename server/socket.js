const config = require('./config');

// Track connected players
const connectedPlayers = new Map();

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Placeholder - will be expanded with auth in Phase 2
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      connectedPlayers.delete(socket.id);
    });

    // Ping for latency measurement
    socket.on('ping', (timestamp) => {
      socket.emit('pong', timestamp);
    });
  });

  // Export for use by other modules
  return {
    io,
    connectedPlayers
  };
};
