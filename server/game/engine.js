// Galaxy Miner - Game Engine (Server-side tick loop)

const config = require('../config');
const npc = require('./npc');
const combat = require('./combat');
const mining = require('./mining');
const loot = require('./loot');
const world = require('../world');
const starDamage = require('./star-damage');

let io = null;
let connectedPlayers = null;
let running = false;
let lastTickTime = Date.now();

// Track which bases are currently active
const lastBaseCheck = new Map(); // baseId -> lastCheckTime

// Throttle base radar broadcasts (every 500ms)
let lastBaseBroadcastTime = 0;
const BASE_BROADCAST_INTERVAL = 500;

function init(socketIo, players) {
  io = socketIo;
  connectedPlayers = players;
}

function start() {
  if (running) return;
  running = true;
  lastTickTime = Date.now();
  tick();
  console.log('Game engine started');
}

function stop() {
  running = false;
  console.log('Game engine stopped');
}

function tick() {
  if (!running) return;

  const now = Date.now();
  const deltaTime = now - lastTickTime;
  lastTickTime = now;

  // Update all game systems
  updatePlayers(deltaTime);
  updateBases(deltaTime);  // Check for bases near players and spawn NPCs
  updateNPCs(deltaTime);
  updateMining(deltaTime);
  updateWreckage(deltaTime);
  updateStarDamage(deltaTime);  // Apply star heat damage
  broadcastNearbyBasesToPlayers(now);  // Send base positions for radar

  // Schedule next tick
  const tickInterval = 1000 / config.SERVER_TICK_RATE;
  const elapsed = Date.now() - now;
  const delay = Math.max(0, tickInterval - elapsed);
  setTimeout(tick, delay);
}

function updatePlayers(deltaTime) {
  if (!connectedPlayers) return;

  // Update shield recharge for all players
  for (const [socketId, player] of connectedPlayers) {
    const shieldUpdate = combat.updateShieldRecharge(player.id, deltaTime);
    if (shieldUpdate) {
      player.shield = shieldUpdate.shield;
      // Notify player of shield update
      io.to(socketId).emit('player:health', {
        hull: player.hull,
        shield: player.shield
      });
    }
  }
}

function updateBases(deltaTime) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  const players = [...connectedPlayers.values()];
  const now = Date.now();
  const BASE_ACTIVATION_RANGE = config.SECTOR_SIZE * 3; // 3 sectors range
  const BASE_DEACTIVATION_TIME = 60000; // 1 minute without nearby players

  // Find all sectors with players and get bases from those sectors
  const activeSectors = new Set();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors (3x3 grid)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        activeSectors.add(`${sectorX + dx}_${sectorY + dy}`);
      }
    }
  }

  // Check each active sector for bases
  for (const sectorKey of activeSectors) {
    const [sectorX, sectorY] = sectorKey.split('_').map(Number);
    const sector = world.generateSector(sectorX, sectorY);

    if (!sector.bases || sector.bases.length === 0) continue;

    for (const base of sector.bases) {
      // Check if any player is within activation range
      let hasNearbyPlayer = false;
      for (const player of players) {
        const dx = player.position.x - base.x;
        const dy = player.position.y - base.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BASE_ACTIVATION_RANGE) {
          hasNearbyPlayer = true;
          break;
        }
      }

      if (hasNearbyPlayer) {
        // Activate base if not already active
        if (!npc.activeBases.has(base.id)) {
          npc.activateBase(base);

          // Broadcast initial NPC spawns from this base
          const activeBase = npc.getActiveBase(base.id);
          if (activeBase) {
            for (const npcId of activeBase.spawnedNPCs) {
              const npcEntity = npc.getNPC(npcId);
              if (npcEntity) {
                broadcastNearNpc(npcEntity, 'npc:spawn', {
                  id: npcEntity.id,
                  type: npcEntity.type,
                  name: npcEntity.name,
                  faction: npcEntity.faction,
                  x: npcEntity.position.x,
                  y: npcEntity.position.y,
                  rotation: npcEntity.rotation,
                  hull: npcEntity.hull,
                  hullMax: npcEntity.hullMax,
                  shield: npcEntity.shield,
                  shieldMax: npcEntity.shieldMax
                });
              }
            }
          }
        }
        lastBaseCheck.set(base.id, now);
      } else {
        // Check if base should be deactivated
        const lastCheck = lastBaseCheck.get(base.id) || 0;
        if (now - lastCheck > BASE_DEACTIVATION_TIME && npc.activeBases.has(base.id)) {
          npc.deactivateBase(base.id);
          lastBaseCheck.delete(base.id);
        }
      }
    }
  }

  // Update base spawning for all active bases
  npc.updateBaseSpawning(players);

  // Check for newly spawned NPCs and broadcast them
  for (const [baseId, activeBase] of npc.activeBases) {
    for (const npcId of activeBase.spawnedNPCs) {
      const npcEntity = npc.getNPC(npcId);
      // Only broadcast NPCs that were just spawned (within last tick)
      if (npcEntity && now - activeBase.lastSpawnTime < deltaTime * 2) {
        broadcastNearNpc(npcEntity, 'npc:spawn', {
          id: npcEntity.id,
          type: npcEntity.type,
          name: npcEntity.name,
          faction: npcEntity.faction,
          x: npcEntity.position.x,
          y: npcEntity.position.y,
          rotation: npcEntity.rotation,
          hull: npcEntity.hull,
          hullMax: npcEntity.hullMax,
          shield: npcEntity.shield,
          shieldMax: npcEntity.shieldMax
        });
      }
    }
  }

  // Check for destroyed bases that should respawn
  for (const [baseId, activeBase] of npc.activeBases) {
    if (activeBase.destroyed) {
      const respawned = npc.checkBaseRespawn(baseId);
      if (respawned) {
        // Get base data for broadcast
        const baseObj = world.getObjectById(baseId);
        if (baseObj) {
          // Broadcast base respawn to nearby players
          broadcastNearBase(baseObj, 'base:respawn', {
            id: baseId,
            x: baseObj.x,
            y: baseObj.y,
            size: baseObj.size,
            type: baseObj.type,
            faction: baseObj.faction,
            name: baseObj.name,
            health: activeBase.health,
            maxHealth: activeBase.maxHealth
          });
        }
      }
    }
  }
}

function updateNPCs(deltaTime) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  // Get all player positions for NPC AI
  const players = [...connectedPlayers.values()];

  // Find active sectors (where players are)
  const activeSectors = new Set();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        activeSectors.add(`${sectorX + dx}_${sectorY + dy}`);
      }
    }
  }

  // Spawn NPCs in active sectors
  for (const sectorKey of activeSectors) {
    const [sectorX, sectorY] = sectorKey.split('_').map(Number);
    const spawned = npc.spawnNPCsForSector(sectorX, sectorY);

    // Notify nearby players of new NPCs
    for (const newNpc of spawned) {
      broadcastNearNpc(newNpc, 'npc:spawn', {
        id: newNpc.id,
        type: newNpc.type,
        name: newNpc.name,
        faction: newNpc.faction,
        x: newNpc.position.x,
        y: newNpc.position.y,
        rotation: newNpc.rotation,
        hull: newNpc.hull,
        hullMax: newNpc.hullMax,
        shield: newNpc.shield,
        shieldMax: newNpc.shieldMax
      });
    }
  }

  // Update all NPCs
  for (const [npcId, npcEntity] of npc.activeNPCs) {
    // Check if NPC is in an active sector
    const npcSectorX = Math.floor(npcEntity.position.x / config.SECTOR_SIZE);
    const npcSectorY = Math.floor(npcEntity.position.y / config.SECTOR_SIZE);
    const npcSectorKey = `${npcSectorX}_${npcSectorY}`;

    if (!activeSectors.has(npcSectorKey)) {
      // NPC is in inactive sector, skip update
      continue;
    }

    // Get players in NPC's aggro range for AI
    const nearbyPlayers = players.filter(p => {
      const dx = p.position.x - npcEntity.position.x;
      const dy = p.position.y - npcEntity.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= npcEntity.aggroRange;
    });

    // Update NPC AI
    const action = npc.updateNPC(npcEntity, nearbyPlayers, deltaTime);

    // Update NPC shield recharge
    npc.updateNPCShieldRecharge(npcEntity, deltaTime);

    // Check for Swarm Queen spawning
    if (npcEntity.spawnsUnits && npcEntity.type === 'swarm_queen') {
      const spawnResult = npc.updateSwarmQueenSpawning(npcEntity, nearbyPlayers, deltaTime);

      if (spawnResult && spawnResult.spawned && spawnResult.spawned.length > 0) {
        // Broadcast queen spawn event for visual effects
        broadcastNearNpc(npcEntity, 'npc:queenSpawn', {
          queenId: npcEntity.id,
          queenX: npcEntity.position.x,
          queenY: npcEntity.position.y,
          triggerType: spawnResult.type,
          threshold: spawnResult.threshold,
          spawned: spawnResult.spawned
        });

        // Also broadcast each minion as regular NPC spawns
        for (const minion of spawnResult.spawned) {
          broadcastNearNpc(npcEntity, 'npc:spawn', {
            id: minion.id,
            type: minion.type,
            name: minion.name,
            faction: minion.faction,
            x: minion.x,
            y: minion.y,
            rotation: minion.rotation,
            hull: minion.hull,
            hullMax: minion.hullMax,
            shield: minion.shield,
            shieldMax: minion.shieldMax
          });
        }
      }
    }

    // Broadcast NPC position update
    // Include name/type/faction so players who just entered range get full data
    broadcastNearNpc(npcEntity, 'npc:update', {
      id: npcId,
      type: npcEntity.type,
      name: npcEntity.name,
      faction: npcEntity.faction,
      x: npcEntity.position.x,
      y: npcEntity.position.y,
      rotation: npcEntity.rotation,
      state: npcEntity.state,
      hull: npcEntity.hull,
      hullMax: npcEntity.hullMax,
      shield: npcEntity.shield,
      shieldMax: npcEntity.shieldMax
    });

    // Handle NPC actions
    if (action && action.action === 'fire') {
      // NPC fired at player - use proper damage calculation
      const targetPlayer = action.target;
      const damage = combat.calculateDamage(
        action.weaponType || 'kinetic',
        action.weaponTier || 1,
        1 // targetShieldTier (could be enhanced to use player shield tier)
      );

      // Scale by NPC's base damage factor (weaponDamage / BASE_WEAPON_DAMAGE ratio)
      const damageMultiplier = action.baseDamage / config.BASE_WEAPON_DAMAGE;
      damage.shieldDamage *= damageMultiplier;
      damage.hullDamage *= damageMultiplier;

      // Pre-calculate hit result for visual synchronization
      const previewShip = require('../database').statements.getShipByUserId.get(targetPlayer.id);
      const willHitShield = previewShip && previewShip.shield_hp > 0;

      // Broadcast NPC weapon fire visual with hit info for proper timing
      broadcastNearNpc(npcEntity, 'combat:npcFire', {
        npcId: npcId,
        faction: npcEntity.faction,
        weaponType: action.weaponType || 'kinetic',
        sourceX: npcEntity.position.x,
        sourceY: npcEntity.position.y,
        targetX: targetPlayer.position.x,
        targetY: targetPlayer.position.y,
        rotation: npcEntity.rotation,
        // Include hit info for client-side hit effect timing
        hitInfo: {
          isShieldHit: willHitShield,
          damage: Math.round(damage.shieldDamage + damage.hullDamage)
        }
      });

      const result = combat.applyDamage(targetPlayer.id, damage);

      if (result) {
        // Update player state
        targetPlayer.hull = result.hull;
        targetPlayer.shield = result.shield;

        // Calculate total damage dealt for broadcasts
        const totalDamage = Math.round(damage.shieldDamage + damage.hullDamage);

        // Broadcast hit effect to nearby players
        broadcastNearNpc(npcEntity, 'combat:hit', {
          attackerId: npcId,
          attackerType: 'npc',
          targetX: targetPlayer.position.x,
          targetY: targetPlayer.position.y,
          hitShield: result.hitShield,
          damage: totalDamage,
          weaponType: action.weaponType
        });

        // Find player socket
        for (const [socketId, p] of connectedPlayers) {
          if (p.id === targetPlayer.id) {
            io.to(socketId).emit('player:damaged', {
              attackerId: npcId,
              attackerType: 'npc',
              damage: totalDamage,
              hull: result.hull,
              shield: result.shield
            });

            if (result.isDead) {
              // Handle player death
              const deathResult = combat.handleDeath(targetPlayer.id);

              io.to(socketId).emit('player:death', {
                killedBy: npcEntity.name,
                respawnPosition: deathResult.respawnPosition,
                droppedCargo: deathResult.droppedCargo
              });

              // Update player position
              targetPlayer.position = deathResult.respawnPosition;
              targetPlayer.hull = targetPlayer.hullMax;
              targetPlayer.shield = targetPlayer.shieldMax;
            }
            break;
          }
        }
      }
    }
  }
}

function updateMining(deltaTime) {
  // Mining updates are handled per-player when they send mining events
  // This could be used for mining progress broadcasts if needed
}

function updateWreckage(deltaTime) {
  // Cleanup expired wreckage
  const expired = loot.cleanupExpiredWreckage();

  // Notify players of despawned wreckage
  for (const wreckageId of expired) {
    if (io) {
      io.emit('wreckage:despawn', { id: wreckageId });
    }
  }
}

function updateStarDamage(deltaTime) {
  // Apply heat damage from stars to nearby players
  starDamage.update(connectedPlayers, io, deltaTime);
}

// Broadcast nearby bases to each player for radar display
function broadcastNearbyBasesToPlayers(now) {
  if (!connectedPlayers || connectedPlayers.size === 0) return;

  // Throttle broadcasts
  if (now - lastBaseBroadcastTime < BASE_BROADCAST_INTERVAL) return;
  lastBaseBroadcastTime = now;

  for (const [socketId, player] of connectedPlayers) {
    // Calculate player's radar range based on their radar tier
    const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, (player.radarTier || 1) - 1);

    // Get bases within player's radar range (using existing npc.getBasesInRange)
    const nearbyBases = npc.getBasesInRange(player.position, radarRange);

    // Only send if there are bases to report
    if (nearbyBases.length > 0) {
      io.to(socketId).emit('bases:nearby', nearbyBases);
    }
  }
}

function broadcastWreckageNear(wreckage, event, data) {
  if (!connectedPlayers) return;

  const broadcastRange = config.BASE_RADAR_RANGE * 2;

  for (const [socketId, player] of connectedPlayers) {
    const dx = player.position.x - wreckage.position.x;
    const dy = player.position.y - wreckage.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

function broadcastNearNpc(npcEntity, event, data) {
  if (!connectedPlayers) return;

  const broadcastRange = config.BASE_RADAR_RANGE * 3; // Wider range for NPC updates

  for (const [socketId, player] of connectedPlayers) {
    const dx = player.position.x - npcEntity.position.x;
    const dy = player.position.y - npcEntity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

// Handle player attacking NPC
function playerAttackNPC(attackerId, npcId, weaponType, weaponTier) {
  const npcEntity = npc.getNPC(npcId);
  if (!npcEntity) return null;

  // Calculate damage using proper damage calculation
  const damage = combat.calculateDamage(weaponType, weaponTier, 1);
  const totalDamage = damage.shieldDamage + damage.hullDamage;

  // Apply damage to NPC with attacker tracking
  const result = npc.damageNPC(npcId, totalDamage, attackerId);

  if (result && result.destroyed) {
    // Spawn wreckage at NPC position with loot
    const wreckage = loot.spawnWreckage(npcEntity, npcEntity.position);

    // Broadcast NPC death with team info
    broadcastNearNpc(npcEntity, 'npc:destroyed', {
      id: npcId,
      destroyedBy: attackerId,
      participants: result.participants,
      participantCount: result.participantCount,
      teamMultiplier: result.teamMultiplier,
      creditsPerPlayer: result.creditsPerPlayer,
      faction: result.faction,
      deathEffect: npcEntity.deathEffect || 'explosion',
      wreckageId: wreckage.id
    });

    // Broadcast wreckage spawn
    broadcastWreckageNear(wreckage, 'wreckage:spawn', {
      id: wreckage.id,
      x: wreckage.position.x,
      y: wreckage.position.y,
      faction: wreckage.faction,
      npcName: wreckage.npcName,
      contentCount: wreckage.contents.length,
      despawnTime: wreckage.despawnTime
    });

    // Add wreckage to result for socket handler
    result.wreckage = wreckage;

    // Check for formation leader death (Void faction succession)
    if (npcEntity.formationLeader || (npcEntity.isBoss && npcEntity.faction === 'void')) {
      const formationInfo = npc.getFormationForNpc(npcId);
      if (formationInfo && formationInfo.memberIds.size > 0) {
        const successionResult = npc.handleLeaderDeath(formationInfo.formationId);
        if (successionResult.success && successionResult.newLeader) {
          broadcastNearNpc(npcEntity, 'formation:leaderChange', {
            formationId: formationInfo.formationId,
            oldLeaderId: npcId,
            oldLeaderType: npcEntity.type,
            newLeaderId: successionResult.newLeader.id,
            newLeaderType: successionResult.newLeader.type,
            newLeaderName: successionResult.newLeader.name,
            newLeaderPosition: successionResult.newLeader.position,
            memberIds: successionResult.memberIds,
            confusionDuration: 1000,  // 1 second confusion
            reformationDuration: 2000  // 2 seconds to reform
          });
        }
      }
    }

    return result;
  }

  // Broadcast NPC hit for damage feedback
  if (result) {
    broadcastNearNpc(npcEntity, 'combat:npcHit', {
      npcId: npcId,
      attackerId: attackerId,
      damage: Math.round(totalDamage),
      hull: result.hull,
      shield: result.shield,
      hitShield: result.hitShield
    });

    // Apply linked health damage for Swarm faction
    if (npcEntity.linkedHealth && npcEntity.faction === 'swarm') {
      const linkedResults = npc.applySwarmLinkedDamage(npcEntity, totalDamage);

      if (linkedResults.length > 0) {
        // Broadcast linked damage event for visual feedback
        broadcastNearNpc(npcEntity, 'swarm:linkedDamage', {
          sourceId: npcId,
          sourceX: npcEntity.position.x,
          sourceY: npcEntity.position.y,
          affected: linkedResults.map(r => ({
            id: r.id,
            damage: Math.round(r.damage),
            destroyed: r.destroyed,
            hull: r.hull,
            hullMax: r.hullMax,
            x: npc.getNPC(r.id)?.position?.x || 0,
            y: npc.getNPC(r.id)?.position?.y || 0
          }))
        });

        // Handle any linked deaths
        for (const linked of linkedResults) {
          if (linked.destroyed) {
            const linkedNpc = npc.getNPC(linked.id);
            if (linkedNpc) {
              // Spawn wreckage for linked death
              const wreckage = loot.spawnWreckage(linkedNpc, linkedNpc.position);

              broadcastNearNpc(linkedNpc, 'npc:destroyed', {
                id: linked.id,
                destroyedBy: attackerId,
                participants: [attackerId],
                participantCount: 1,
                teamMultiplier: 1,
                creditsPerPlayer: linkedNpc.creditReward || 0,
                faction: linkedNpc.faction,
                deathEffect: linkedNpc.deathEffect || 'dissolve',
                wreckageId: wreckage.id,
                linkedDeath: true
              });

              broadcastWreckageNear(wreckage, 'wreckage:spawn', {
                id: wreckage.id,
                x: wreckage.position.x,
                y: wreckage.position.y,
                faction: wreckage.faction,
                npcName: wreckage.npcName,
                contentCount: wreckage.contents.length,
                despawnTime: wreckage.despawnTime
              });
            }
          }
        }
      }
    }
  }

  return result;
}

// Handle player attacking a faction base
function playerAttackBase(attackerId, baseId, weaponType, weaponTier) {
  // Get base info from world
  const baseObj = world.getObjectById(baseId);
  if (!baseObj) return null;

  // Calculate damage using proper damage calculation
  const damage = combat.calculateDamage(weaponType, weaponTier, 1);
  const totalDamage = damage.shieldDamage + damage.hullDamage;

  // Apply damage to base with attacker tracking
  const result = npc.damageBase(baseId, totalDamage, attackerId);

  if (result && result.destroyed) {
    // Generate loot for the base
    const baseLoot = result.loot;

    // Create wreckage-like object for the base
    const wreckage = loot.spawnWreckage({
      id: baseId,
      name: baseObj.name,
      faction: baseObj.faction,
      type: 'base'
    }, { x: baseObj.x, y: baseObj.y }, baseLoot);

    // Broadcast base destruction with team info and visual data
    broadcastNearBase(baseObj, 'base:destroyed', {
      id: baseId,
      destroyedBy: attackerId,
      participants: result.participants,
      participantCount: result.participantCount,
      teamMultiplier: result.teamMultiplier,
      creditsPerPlayer: result.creditsPerPlayer,
      faction: baseObj.faction,
      respawnTime: result.respawnTime,
      wreckageId: wreckage.id,
      // Visual data for destruction sequence
      x: baseObj.x,
      y: baseObj.y,
      baseType: baseObj.type,
      size: baseObj.size || 80
    });

    // Broadcast wreckage spawn
    broadcastWreckageNear(wreckage, 'wreckage:spawn', {
      id: wreckage.id,
      x: wreckage.position.x,
      y: wreckage.position.y,
      faction: wreckage.faction,
      npcName: wreckage.npcName,
      contentCount: wreckage.contents.length,
      despawnTime: wreckage.despawnTime
    });

    // Add wreckage to result for socket handler
    result.wreckage = wreckage;

    return result;
  }

  // Broadcast base damage for feedback
  if (result) {
    broadcastNearBase(baseObj, 'base:damaged', {
      baseId: baseId,
      attackerId: attackerId,
      damage: Math.round(totalDamage),
      health: result.health,
      maxHealth: result.maxHealth,
      x: baseObj.x,
      y: baseObj.y,
      faction: baseObj.faction,
      size: baseObj.size || 80
    });
  }

  return result;
}

function broadcastNearBase(base, event, data) {
  if (!connectedPlayers) return;

  const broadcastRange = config.BASE_RADAR_RANGE * 3;

  for (const [socketId, player] of connectedPlayers) {
    const dx = player.position.x - base.x;
    const dy = player.position.y - base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

// Wreckage collection handlers
function startWreckageCollection(wreckageId, playerId) {
  return loot.startCollection(wreckageId, playerId);
}

function updateWreckageCollection(wreckageId, playerId, deltaTime) {
  return loot.updateCollection(wreckageId, playerId, deltaTime);
}

function cancelWreckageCollection(wreckageId, playerId) {
  loot.cancelCollection(wreckageId, playerId);
}

function getWreckageInRange(position, range) {
  return loot.getWreckageInRange(position, range);
}

function getWreckage(wreckageId) {
  return loot.getWreckage(wreckageId);
}

module.exports = {
  init,
  start,
  stop,
  playerAttackNPC,
  playerAttackBase,
  startWreckageCollection,
  updateWreckageCollection,
  cancelWreckageCollection,
  getWreckageInRange,
  getWreckage,
  loot
};
