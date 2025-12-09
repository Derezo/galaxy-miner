// Galaxy Miner - Game Events System
// Centralized event emitter to break circular dependencies between game modules

const EventEmitter = require('events');

/**
 * GameEvents - Singleton event emitter for game-wide events
 *
 * This class provides type-safe event emission methods to coordinate between
 * game systems (engine.js, npc.js, combat.js, etc.) without circular dependencies.
 *
 * Usage:
 *   const gameEvents = require('./events');
 *   gameEvents.on('npc:death', (data) => { ... });
 *   gameEvents.emitNPCDeath(npcId, position, killer);
 */
class GameEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Increase listener limit for game events
  }

  /**
   * Emit NPC death event
   * Fired when an NPC is destroyed by combat damage
   *
   * @param {string} npcId - ID of the destroyed NPC
   * @param {Object} position - Position where NPC died { x, y }
   * @param {string|null} killerId - ID of player/NPC that killed this NPC (null for environment)
   * @param {Object} npcData - Full NPC data (type, faction, etc.) for death effects
   * @param {Array} participants - All players who contributed damage
   * @param {Object} rewards - Credit and loot rewards { creditsPerPlayer, loot, teamMultiplier }
   */
  emitNPCDeath(npcId, position, killerId, npcData, participants = [], rewards = {}) {
    this.emit('npc:death', {
      npcId,
      position,
      killerId,
      npcData,
      participants,
      rewards,
      timestamp: Date.now()
    });
  }

  /**
   * Emit base destroyed event
   * Fired when a faction base is destroyed
   *
   * @param {string} baseId - ID of the destroyed base
   * @param {Object} position - Base position { x, y }
   * @param {string} faction - Base faction (pirate, swarm, void, etc.)
   * @param {string} baseType - Base type (pirate_outpost, swarm_hive, etc.)
   * @param {Array} participants - All players who contributed damage
   * @param {Object} rewards - Credit and loot rewards
   * @param {Array} orphanedNPCs - NPCs that lost their home base
   */
  emitBaseDestroyed(baseId, position, faction, baseType, participants = [], rewards = {}, orphanedNPCs = []) {
    this.emit('base:destroyed', {
      baseId,
      position,
      faction,
      baseType,
      participants,
      rewards,
      orphanedNPCs,
      timestamp: Date.now()
    });
  }

  /**
   * Emit base respawned event
   * Fired when a destroyed base respawns
   *
   * @param {string} baseId - ID of the respawned base
   * @param {Object} position - Base position { x, y }
   * @param {string} faction - Base faction
   * @param {string} baseType - Base type
   */
  emitBaseRespawn(baseId, position, faction, baseType) {
    this.emit('base:respawn', {
      baseId,
      position,
      faction,
      baseType,
      timestamp: Date.now()
    });
  }

  /**
   * Emit player death event
   * Fired when a player is killed by NPC or environment
   *
   * @param {string} playerId - ID of the killed player
   * @param {Object} position - Position where player died { x, y }
   * @param {string|null} killerId - ID of NPC/player that killed this player (null for environment)
   * @param {string} killerType - Type of killer ('npc', 'player', 'environment')
   * @param {Array} droppedCargo - Cargo items dropped on death
   */
  emitPlayerDeath(playerId, position, killerId, killerType, droppedCargo = []) {
    this.emit('player:death', {
      playerId,
      position,
      killerId,
      killerType,
      droppedCargo,
      timestamp: Date.now()
    });
  }

  /**
   * Emit loot spawn event
   * Fired when wreckage/loot is spawned from death or destruction
   *
   * @param {Object} wreckage - Wreckage data { id, position, contents, faction, despawnTime }
   */
  emitLootSpawn(wreckage) {
    this.emit('loot:spawn', {
      wreckage,
      timestamp: Date.now()
    });
  }

  /**
   * Emit combat hit event
   * Fired when damage is successfully applied to a target
   *
   * @param {string} targetId - ID of hit target (player or NPC)
   * @param {string} targetType - Type of target ('player' or 'npc')
   * @param {number} damage - Total damage dealt
   * @param {string} attackerId - ID of attacker
   * @param {string} attackerType - Type of attacker ('player' or 'npc')
   * @param {string} weaponType - Weapon type used (kinetic, energy, explosive)
   * @param {boolean} hitShield - Whether shields absorbed the hit
   */
  emitCombatHit(targetId, targetType, damage, attackerId, attackerType, weaponType, hitShield) {
    this.emit('combat:hit', {
      targetId,
      targetType,
      damage,
      attackerId,
      attackerType,
      weaponType,
      hitShield,
      timestamp: Date.now()
    });
  }

  /**
   * Emit NPC spawned event
   * Fired when a new NPC is spawned from base or sector
   *
   * @param {string} npcId - ID of spawned NPC
   * @param {string} npcType - Type of NPC (pirate_scout, swarm_drone, etc.)
   * @param {Object} position - Spawn position { x, y }
   * @param {string|null} spawnSource - Base ID or 'sector' for sector spawns
   */
  emitNPCSpawn(npcId, npcType, position, spawnSource = null) {
    this.emit('npc:spawn', {
      npcId,
      npcType,
      position,
      spawnSource,
      timestamp: Date.now()
    });
  }

  /**
   * Emit base activated event
   * Fired when a base becomes active (players nearby)
   *
   * @param {string} baseId - ID of activated base
   * @param {Object} position - Base position { x, y }
   * @param {string} faction - Base faction
   */
  emitBaseActivated(baseId, position, faction) {
    this.emit('base:activated', {
      baseId,
      position,
      faction,
      timestamp: Date.now()
    });
  }

  /**
   * Emit base deactivated event
   * Fired when a base becomes inactive (no players nearby)
   *
   * @param {string} baseId - ID of deactivated base
   * @param {number} npcCount - Number of NPCs despawned
   */
  emitBaseDeactivated(baseId, npcCount) {
    this.emit('base:deactivated', {
      baseId,
      npcCount,
      timestamp: Date.now()
    });
  }

  /**
   * Emit formation leader change event
   * Fired when a Void faction formation gets a new leader (succession)
   *
   * @param {string} formationId - Formation ID
   * @param {string} oldLeaderId - Previous leader NPC ID
   * @param {string} newLeaderId - New leader NPC ID
   * @param {Array} memberIds - Formation member IDs
   */
  emitFormationLeaderChange(formationId, oldLeaderId, newLeaderId, memberIds) {
    this.emit('formation:leaderChange', {
      formationId,
      oldLeaderId,
      newLeaderId,
      memberIds,
      timestamp: Date.now()
    });
  }

  /**
   * Emit swarm queen spawn event
   * Fired when a Swarm Queen is spawned (rare event)
   *
   * @param {string} queenId - Queen NPC ID
   * @param {Object} position - Spawn position { x, y }
   * @param {string} triggerReason - Why queen spawned ('assimilation', 'manual', etc.)
   */
  emitSwarmQueenSpawn(queenId, position, triggerReason) {
    this.emit('swarm:queenSpawn', {
      queenId,
      position,
      triggerReason,
      timestamp: Date.now()
    });
  }

  /**
   * Emit base assimilated event
   * Fired when a Swarm converts a base to their faction
   *
   * @param {string} baseId - Assimilated base ID
   * @param {string} originalFaction - Original base faction
   * @param {string} newType - New base type (assimilated_*)
   * @param {Array} convertedNPCs - NPCs converted to swarm
   */
  emitBaseAssimilated(baseId, originalFaction, newType, convertedNPCs = []) {
    this.emit('swarm:baseAssimilated', {
      baseId,
      originalFaction,
      newType,
      convertedNPCs,
      timestamp: Date.now()
    });
  }

  /**
   * Emit NPC orphaned event
   * Fired when an NPC's home base is destroyed and it enters rage mode
   *
   * @param {string} npcId - Orphaned NPC ID
   * @param {string} destroyedBaseId - ID of destroyed home base
   * @param {number} rageDuration - Duration of rage mode in ms
   */
  emitNPCOrphaned(npcId, destroyedBaseId, rageDuration) {
    this.emit('npc:orphaned', {
      npcId,
      destroyedBaseId,
      rageDuration,
      timestamp: Date.now()
    });
  }

  /**
   * Emit environment damage event
   * Fired when environmental hazards damage players (stars, comets, etc.)
   *
   * @param {string} playerId - Damaged player ID
   * @param {string} hazardType - Type of hazard ('star', 'comet', etc.)
   * @param {number} damage - Damage amount
   * @param {Object} hazardPosition - Hazard position { x, y }
   */
  emitEnvironmentDamage(playerId, hazardType, damage, hazardPosition) {
    this.emit('environment:damage', {
      playerId,
      hazardType,
      damage,
      hazardPosition,
      timestamp: Date.now()
    });
  }
}

// Export singleton instance
const gameEvents = new GameEvents();

module.exports = gameEvents;
