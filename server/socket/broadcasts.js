'use strict';

/**
 * Socket Broadcast Functions
 * Global broadcast functions used by external modules (engine.js, npc.js, etc.)
 */

/**
 * Create broadcast helper functions bound to an io instance
 * @param {Object} io - Socket.io server instance
 * @returns {Object} Broadcast functions
 */
function createBroadcasts(io) {
  return {
    /**
     * Broadcast drone sacrifice visual effect
     * @param {Object} data - { droneId, baseId, position: { x, y } }
     */
    broadcastDroneSacrifice(data) {
      io.emit('swarm:droneSacrifice', {
        droneId: data.droneId,
        baseId: data.baseId,
        x: data.position.x,
        y: data.position.y
      });
    },

    /**
     * Broadcast assimilation progress update
     * @param {Object} data - { baseId, progress, threshold, position }
     */
    broadcastAssimilationProgress(data) {
      io.emit('swarm:assimilationProgress', {
        baseId: data.baseId,
        progress: data.progress,
        threshold: data.threshold,
        position: data.position // For client visual effects
      });
    },

    /**
     * Broadcast base assimilation complete
     * @param {Object} data - { baseId, newType, originalFaction, convertedNpcs, position, consumedDroneIds }
     */
    broadcastBaseAssimilated(data) {
      io.emit('swarm:baseAssimilated', {
        baseId: data.baseId,
        newType: data.newType,
        originalFaction: data.originalFaction,
        convertedNpcs: data.convertedNpcs || [],
        position: data.position, // For client visual effects
        consumedDroneIds: data.consumedDroneIds || [] // Drones consumed in conversion - client removes these
      });
    },

    /**
     * Broadcast queen spawn event
     * @param {Object} queen - Queen NPC data
     */
    broadcastQueenSpawn(queen) {
      io.emit('swarm:queenSpawn', {
        id: queen.id,
        x: queen.position.x,
        y: queen.position.y,
        hull: queen.hull,
        shield: queen.shield,
        name: queen.name
      });
    },

    /**
     * Broadcast queen death event
     * @param {string} queenId - ID of the dead queen
     * @param {Object} position - { x, y } death position
     */
    broadcastQueenDeath(queenId, position) {
      io.emit('swarm:queenDeath', {
        id: queenId,
        x: position.x,
        y: position.y
      });
    },

    /**
     * Broadcast queen aura regeneration effects (throttled - call once per second max)
     * @param {Array} affectedBases - [{ baseId, health, maxHealth }]
     */
    broadcastQueenAura(affectedBases) {
      if (affectedBases.length > 0) {
        io.emit('swarm:queenAura', {
          affectedBases
        });
      }
    },

    /**
     * Broadcast chain lightning effect for tier 5 weapon
     * @param {Object} data - { playerId, sourceNpcId, sourceX, sourceY, chains: [{ targetId, targetX, targetY, damage, destroyed }] }
     */
    broadcastChainLightning(data) {
      io.emit('combat:chainLightning', data);
    },

    /**
     * Broadcast tesla coil effect for tier 5 weapon on base hit
     * @param {Object} data - { playerId, baseId, impactX, impactY, baseSize, duration, targets: [{ npcId, x, y, damage }] }
     */
    broadcastTeslaCoil(data) {
      io.emit('combat:teslaCoil', data);
    }
  };
}

module.exports = { createBroadcasts };
