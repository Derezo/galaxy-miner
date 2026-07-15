'use strict';

const config = require('../config');
const { getRadarRange } = require('../../shared/utils');

function getBroadcastRange(player) {
  const tier = Math.max(1, Math.min(config.MAX_TIER || 5, Number(player?.radarTier) || 1));
  return getRadarRange(tier) * 2;
}

/**
 * Socket Broadcast Functions
 * Global broadcast functions used by external modules (engine.js, npc.js, etc.)
 */

/**
 * Create broadcast helper functions bound to an io instance
 * @param {Object} io - Socket.io server instance
 * @returns {Object} Broadcast functions
 */
function createBroadcasts(io, connectedPlayers = new Map()) {
  function emitNear(position, event, data, sourceSize = 0) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return 0;
    const boundedSourceSize = Number.isFinite(Number(sourceSize))
      ? Math.max(0, Number(sourceSize))
      : 0;

    let delivered = 0;
    for (const [socketId, player] of connectedPlayers) {
      if (!Number.isFinite(player?.position?.x) || !Number.isFinite(player?.position?.y)) continue;
      const distance = Math.hypot(
        player.position.x - position.x,
        player.position.y - position.y
      );
      if (distance - boundedSourceSize > getBroadcastRange(player)) continue;
      io.to(socketId).emit(event, data);
      delivered++;
    }
    return delivered;
  }

  return {
    // Generic spatial emission for authoritative effects that do not warrant a
    // dedicated wrapper. Recipient-specific radar ranges are still enforced.
    emitNear,

    /**
     * Broadcast drone sacrifice visual effect
     * @param {Object} data - { droneId, baseId, position: { x, y } }
     */
    broadcastDroneSacrifice(data) {
      emitNear(data.position, 'swarm:droneSacrifice', {
        droneId: data.droneId,
        baseId: data.baseId,
        position: { x: data.position.x, y: data.position.y },
        x: data.position.x,
        y: data.position.y
      });
    },

    /**
     * Broadcast assimilation progress update
     * @param {Object} data - { baseId, progress, threshold, position }
     */
    broadcastAssimilationProgress(data) {
      const progress = data.progress ?? data.attachedCount ?? 0;
      const payload = {
        baseId: data.baseId,
        progress,
        threshold: data.threshold,
        position: { x: data.position.x, y: data.position.y }
      };
      if (data.droneKilled != null) payload.droneKilled = data.droneKilled;
      if (data.killedBy != null) payload.killedBy = data.killedBy;
      emitNear(data.position, 'swarm:assimilationProgress', payload);
    },

    /**
     * Broadcast base assimilation complete
     * @param {Object} data - { baseId, newType, originalFaction, convertedNpcs, position, consumedDroneIds }
     */
    broadcastBaseAssimilated(data) {
      emitNear(data.position, 'swarm:baseAssimilated', {
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
      emitNear(queen.position, 'swarm:queenSpawn', {
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
      emitNear(position, 'swarm:queenDeath', {
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
      for (const base of affectedBases) {
        emitNear({ x: base.x, y: base.y }, 'swarm:queenAura', {
          affectedBases: [base]
        });
      }
    },

    /**
     * Broadcast chain lightning effect for tier 5 weapon
     * @param {Object} data - { playerId, sourceNpcId, sourceX, sourceY, chains: [{ targetId, targetX, targetY, damage, destroyed }] }
     */
    broadcastChainLightning(data) {
      emitNear({ x: data.sourceX, y: data.sourceY }, 'combat:chainLightning', data);
    },

    /**
     * Broadcast tesla coil effect for tier 5 weapon on base hit
     * @param {Object} data - { playerId, baseId, impactX, impactY, baseSize, duration, targets: [{ npcId, x, y, damage }] }
     */
    broadcastTeslaCoil(data) {
      emitNear(
        { x: data.impactX, y: data.impactY },
        'combat:teslaCoil',
        data,
        Number(data.baseSize) || 0
      );
    },

    /**
     * Warn nearby clients that the Barnacle King's lethal drill is charging.
     * @param {Object} npcEntity - Authoritative Barnacle King entity
     * @param {Object} action - AI action containing targetId and chargeTime
     */
    broadcastDrillCharge(npcEntity, action) {
      if (!npcEntity?.position) return;
      emitNear(npcEntity.position, 'scavenger:drillCharge', {
        npcId: npcEntity.id,
        kingX: npcEntity.position.x,
        kingY: npcEntity.position.y,
        targetId: action?.targetId,
        chargeTime: Number(action?.chargeTime) || 1500
      }, Number(npcEntity.size) || 0);
    }
  };
}

module.exports = { createBroadcasts };
