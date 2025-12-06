const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*'
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

// Serve shared modules to client
app.get('/shared/constants.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'shared', 'constants.js'));
});

app.get('/shared/physics.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'shared', 'physics.js'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Initialize socket handlers
const socketModule = require('./socket')(io);

// Initialize and start game engine
const engine = require('./game/engine');
engine.init(io, socketModule.connectedPlayers);
engine.start();

// Start server
httpServer.listen(config.PORT, config.HOST, () => {
  console.log(`Galaxy Miner server running on http://${config.HOST}:${config.PORT}`);
  console.log(`Galaxy seed: ${config.GALAXY_SEED}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
