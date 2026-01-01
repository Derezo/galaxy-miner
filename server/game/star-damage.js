// Galaxy Miner - Star Heat Damage System
// Applies damage to players who get too close to stars

const world = require('../world');
const combat = require('./combat');
const Physics = require('../../shared/physics');
const config = require('../config');
const loot = require('./loot');
const { statements } = require('../database');

// Track last zone for each player (to detect zone changes)
const playerZones = new Map();

/**
 * Update star damage for all connected players
 * @param {Map} connectedPlayers - Map of socket ID to player data
 * @param {Object} io - Socket.io server instance
 * @param {number} deltaTime - Time since last update in milliseconds
 */
function update(connectedPlayers, io, deltaTime) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  const dt = deltaTime / 1000; // Convert to seconds

  for (const [socketId, player] of connectedPlayers) {
    // Skip dead players - they can't take damage
    if (player.isDead) continue;

    const damage = checkStarDamage(player, dt);

    if (damage.totalDamage > 0 || damage.zoneChanged) {
      // Apply damage to player
      if (damage.shieldDrain > 0 || damage.hullDamage > 0) {
        applyDamage(player, damage.shieldDrain, damage.hullDamage, io, socketId);
      }

      // Notify client of zone change
      if (damage.zoneChanged) {
        io.to(socketId).emit('star:zone', {
          zone: damage.zone,
          starId: damage.starId
        });
      }
    }

    // Check if player died from star damage
    if (player.hull <= 0) {
      handlePlayerDeath(player, io, socketId, damage.starId);
    }
  }
}

/**
 * Check if a player is in a star danger zone and calculate damage
 * @param {Object} player - Player data with position
 * @param {number} dt - Delta time in seconds
 * @returns {Object} Damage info
 */
function checkStarDamage(player, dt) {
  const result = {
    zone: null,
    starId: null,
    shieldDrain: 0,
    hullDamage: 0,
    totalDamage: 0,
    zoneChanged: false
  };

  // Get player's sector and nearby sectors
  const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
  const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

  // Check stars in adjacent sectors
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const sector = world.generateSector(sectorX + dx, sectorY + dy);
      if (!sector.stars) continue;

      for (const star of sector.stars) {
        // Get current position (handles binary star orbits)
        const starPos = world.getObjectPosition(star.id);
        if (!starPos) continue;

        // Check zone
        const zoneInfo = Physics.getStarZone(
          player.position.x,
          player.position.y,
          { x: starPos.x, y: starPos.y, size: star.size }
        );

        if (zoneInfo.zone) {
          // Player is in a danger zone
          const damage = Physics.getZoneDamage(zoneInfo.zone, zoneInfo.ratio);

          result.zone = zoneInfo.zone;
          result.starId = star.id;
          result.shieldDrain += damage.shieldDrain * dt;
          result.hullDamage += damage.hullDamage * dt;
          result.totalDamage += (damage.shieldDrain + damage.hullDamage) * dt;

          // Check if zone changed
          const lastZone = playerZones.get(player.id);
          if (lastZone !== zoneInfo.zone) {
            result.zoneChanged = true;
            playerZones.set(player.id, zoneInfo.zone);
          }

          // Only process one star (closest one in danger zone)
          break;
        }
      }

      // If we found a danger zone, stop checking sectors
      if (result.zone) break;
    }
    if (result.zone) break;
  }

  // If player left all zones, clear their zone state
  if (!result.zone && playerZones.has(player.id)) {
    playerZones.delete(player.id);
    result.zoneChanged = true;
  }

  return result;
}

/**
 * Apply damage to a player (shields absorb first, then hull)
 * @param {Object} player - Player data
 * @param {number} shieldDrain - Shield damage amount
 * @param {number} hullDamage - Hull damage amount (only applies if shields are down)
 * @param {Object} io - Socket.io instance
 * @param {string} socketId - Player's socket ID
 */
function applyDamage(player, shieldDrain, hullDamage, io, socketId) {
  // Drain shields first
  if (shieldDrain > 0 && player.shield > 0) {
    player.shield = Math.max(0, player.shield - shieldDrain);
  }

  // Apply hull damage only if shields are down or direct hull damage specified
  if (hullDamage > 0 && player.shield <= 0) {
    player.hull = Math.max(0, player.hull - hullDamage);
  }

  // Persist damage to database (critical for reconnection handling)
  // This ensures hull/shield state survives socket reconnects
  statements.updateShipHealth.run(
    Math.floor(player.hull),
    Math.floor(player.shield),
    player.id
  );

  // Notify player of damage
  io.to(socketId).emit('star:damage', {
    shield: player.shield,
    hull: player.hull,
    shieldDrain: shieldDrain,
    hullDamage: hullDamage
  });
}

/**
 * Handle player death from star damage
 * Uses deferred respawn system - player chooses where to respawn
 * @param {Object} player - Player data
 * @param {Object} io - Socket.io instance
 * @param {string} socketId - Player's socket ID
 * @param {string} starId - ID of the star that killed them
 */
function handlePlayerDeath(player, io, socketId, starId) {
  // Get death position
  const deathPosition = { x: player.position.x, y: player.position.y };

  // Handle death with deferred respawn (no immediate respawn)
  const deathResult = combat.handleDeath(player.id, deathPosition);

  // Spawn player wreckage if there's anything to drop
  if (deathResult.wreckageContents && deathResult.wreckageContents.length > 0) {
    const playerEntity = {
      type: 'player',
      name: deathResult.playerName || player.username || 'Unknown',
      faction: null,
      creditReward: 0
    };

    const wreckage = loot.spawnWreckage(
      playerEntity,
      deathPosition,
      deathResult.wreckageContents,
      null,
      { source: 'player', playerId: player.id }
    );

    // Note: Wreckage broadcast would need connectedPlayers which we don't have here
    // The wreckage will still be visible when players get nearby
  }

  // Emit death event with respawn OPTIONS (player chooses where to respawn)
  io.to(socketId).emit('player:death', {
    killedBy: 'Stellar radiation',
    cause: 'star',
    killerType: 'environment',
    killerName: 'Star',
    starId: starId,
    deathPosition,
    droppedCargo: deathResult.droppedCargo,
    wreckageSpawned: deathResult.wreckageContents && deathResult.wreckageContents.length > 0,
    respawnOptions: deathResult.respawnOptions
  });

  // Mark player as dead - DON'T respawn immediately, wait for respawn:select event
  player.isDead = true;
  player.deathTime = Date.now();
  player.deathPosition = deathPosition;

  // Clear zone state
  playerZones.delete(player.id);
}

/**
 * Clean up player zone tracking when they disconnect
 * @param {string} playerId - Player's ID
 */
function cleanupPlayer(playerId) {
  playerZones.delete(playerId);
}

module.exports = {
  update,
  checkStarDamage,
  cleanupPlayer
};
