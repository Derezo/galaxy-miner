'use strict';

/**
 * Socket Handler Orchestrator
 * Main entry point for socket.io connection handling.
 * Registers all modular handlers with shared dependencies.
 */

const config = require('../config');
const auth = require('../auth');
const { statements, safeUpdateCredits, getSafeCredits, performUpgrade, safeUpsertInventory } = require('../database');
const mining = require('../game/mining');
const combat = require('../game/combat');
const marketplace = require('../game/marketplace');
const npc = require('../game/npc');
const engine = require('../game/engine');
const wormhole = require('../game/wormhole');
const LootPools = require('../game/loot-pools');
const loot = require('../game/loot');
const derelict = require('../game/derelict');
const world = require('../world');
const logger = require('../../shared/logger');
const Constants = require('../../shared/constants');

// Import shared state and helpers
const helpers = require('./helpers');
const { createBroadcasts } = require('./broadcasts');

// Import handler modules
const authHandlers = require('./auth');
const playerHandlers = require('./player');
const combatHandlers = require('./combat');
const miningHandlers = require('./mining');
const derelictHandlers = require('./derelict');
const chatHandlers = require('./chat');
const marketplaceHandlers = require('./marketplace');
const shipHandlers = require('./ship');
const lootHandlers = require('./loot');
const wormholeHandlers = require('./wormhole');
const relicHandlers = require('./relic');
const emoteHandlers = require('./emote');
const fleetHandlers = require('./fleet');
const connectionHandlers = require('./connection');

module.exports = function(io) {
  // Create broadcast functions bound to io instance
  const broadcasts = createBroadcasts(io);

  io.on('connection', (socket) => {
    logger.log(`Client connected: ${socket.id}`);

    // Per-socket authenticated user state (closure)
    let authenticatedUserId = null;

    // Shared dependencies passed to all handlers
    const deps = {
      // Socket.io instances
      io,
      socket,

      // Configuration and constants
      config,
      Constants,

      // External modules
      auth,
      mining,
      combat,
      marketplace,
      npc,
      engine,
      wormhole,
      LootPools,
      loot,
      derelict,
      world,

      // Database access
      statements,
      safeUpdateCredits,
      getSafeCredits,
      performUpgrade,
      safeUpsertInventory,

      // Logger
      logger,

      // Authentication closure functions
      getAuthenticatedUserId: () => authenticatedUserId,
      setAuthenticatedUserId: (id) => { authenticatedUserId = id; },

      // State and helper functions from helpers module
      state: {
        // State maps
        connectedPlayers: helpers.connectedPlayers,
        userSockets: helpers.userSockets,
        playerStatus: helpers.playerStatus,
        activeIntervals: helpers.activeIntervals,
        playerSectorRooms: helpers.playerSectorRooms,

        // Validation sets
        VALID_COMPONENTS: helpers.VALID_COMPONENTS,
        VALID_COLORS: helpers.VALID_COLORS,
        VALID_PROFILES: helpers.VALID_PROFILES,

        // Interval tracking
        trackInterval: helpers.trackInterval,
        untrackInterval: helpers.untrackInterval,
        clearAllIntervals: helpers.clearAllIntervals,

        // Player status
        setPlayerStatus: helpers.setPlayerStatus,
        getPlayerStatus: helpers.getPlayerStatus,
        clearPlayerStatus: helpers.clearPlayerStatus,

        // Sector rooms
        getSectorRoom: helpers.getSectorRoom,
        getAdjacentSectorRooms: helpers.getAdjacentSectorRooms,
        updatePlayerSectorRooms: helpers.updatePlayerSectorRooms,
        joinSectorRooms: helpers.joinSectorRooms,
        leaveSectorRooms: helpers.leaveSectorRooms,

        // Broadcasting
        broadcastToNearby: helpers.broadcastToNearby,

        // Team loot distribution (pass io for team notifications)
        distributeTeamCredits: (credits, contributors, collectorId) =>
          helpers.distributeTeamCredits(io, credits, contributors, collectorId),
        distributeTeamResources: (contents, contributors, collectorId) =>
          helpers.distributeTeamResources(io, contents, contributors, collectorId),
        processCollectedLoot: (userId, contents) =>
          helpers.processCollectedLoot(io, userId, contents)
      },

      // Broadcast functions
      broadcasts,

      // Handler references (populated after registration)
      handlers: {}
    };

    // Add cleanupPlayer reference for auth logout handler
    deps.handlers.cleanupPlayer = connectionHandlers.cleanupPlayer;

    // Register all handler modules
    // Order matters for some handlers (auth should be first)
    authHandlers.register(socket, deps);
    playerHandlers.register(socket, deps);
    combatHandlers.register(socket, deps);
    miningHandlers.register(socket, deps);
    derelictHandlers.register(socket, deps);
    chatHandlers.register(socket, deps);
    marketplaceHandlers.register(socket, deps);
    shipHandlers.register(socket, deps);
    lootHandlers.register(socket, deps);
    wormholeHandlers.register(socket, deps);
    relicHandlers.register(socket, deps);
    emoteHandlers.register(socket, deps);
    fleetHandlers.register(socket, deps);
    connectionHandlers.register(socket, deps);
  });

  // Return public API for external modules (engine.js, npc.js, etc.)
  return {
    io,
    connectedPlayers: helpers.connectedPlayers,
    userSockets: helpers.userSockets,
    // Swarm broadcasts
    broadcastDroneSacrifice: broadcasts.broadcastDroneSacrifice,
    broadcastAssimilationProgress: broadcasts.broadcastAssimilationProgress,
    broadcastBaseAssimilated: broadcasts.broadcastBaseAssimilated,
    broadcastQueenSpawn: broadcasts.broadcastQueenSpawn,
    broadcastQueenDeath: broadcasts.broadcastQueenDeath,
    broadcastQueenAura: broadcasts.broadcastQueenAura,
    // Tesla cannon broadcasts
    broadcastChainLightning: broadcasts.broadcastChainLightning,
    broadcastTeslaCoil: broadcasts.broadcastTeslaCoil
  };
};
