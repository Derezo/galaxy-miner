// Galaxy Miner - Game Engine (Server-side tick loop)

const config = require('../config');
const npc = require('./npc');
const combat = require('./combat');
const mining = require('./mining');
const loot = require('./loot');
const world = require('../world');
const starDamage = require('./star-damage');
const logger = require('../../shared/logger');

let io = null;
let connectedPlayers = null;
let running = false;
let lastTickTime = Date.now();

// Track which bases are currently active
const lastBaseCheck = new Map(); // baseId -> lastCheckTime

// NPC Accuracy System Configuration
// Makes NPC weapons dodgeable by adding miss chance based on distance and target movement
const NPC_ACCURACY = {
  // Base accuracy per faction (0-1, 1 = perfect aim)
  FACTION_BASE: {
    pirate: 0.65,      // Pirates are decent shots
    scavenger: 0.45,   // Scavengers have jury-rigged weapons
    swarm: 0.55,       // Swarm fires rapidly but less accurate
    void: 0.75,        // Void entities are precise
    rogue_miner: 0.50  // Miners aren't combat-focused
  },
  // Distance penalty: accuracy drops at longer range
  // At max range, accuracy is reduced by this multiplier
  RANGE_PENALTY_MAX: 0.4,  // Lose up to 40% accuracy at max range
  // Moving target penalty: fast targets are harder to hit
  // Velocity in units/sec that causes max penalty
  VELOCITY_THRESHOLD: 150,
  VELOCITY_PENALTY_MAX: 0.35  // Lose up to 35% accuracy vs fast targets
};

// Throttle base radar broadcasts (every 500ms)
let lastBaseBroadcastTime = 0;
const BASE_BROADCAST_INTERVAL = 500;

// Base activation and broadcast ranges (should match for consistency)
// Using sector-based range for smooth transitions across sector boundaries
const BASE_ACTIVATION_RANGE = config.SECTOR_SIZE * 3;  // 3000 units
const BASE_BROADCAST_RANGE = BASE_ACTIVATION_RANGE;    // Match activation range

function init(socketIo, players) {
  io = socketIo;
  connectedPlayers = players;
}

function start() {
  if (running) return;
  running = true;
  lastTickTime = Date.now();
  tick();
  logger.log('Game engine started');
}

function stop() {
  running = false;
  logger.log('Game engine stopped');
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
  const BASE_DEACTIVATION_TIME = 60000; // 1 minute without nearby players

  // Find all sectors with players and get bases from those sectors
  // Use Map to store sector coordinates directly, avoiding string parsing in loop
  const activeSectors = new Map();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors (5x5 grid to match client rendering range)
    const ACTIVE_SECTOR_RADIUS = 2;
    for (let dx = -ACTIVE_SECTOR_RADIUS; dx <= ACTIVE_SECTOR_RADIUS; dx++) {
      for (let dy = -ACTIVE_SECTOR_RADIUS; dy <= ACTIVE_SECTOR_RADIUS; dy++) {
        const sx = sectorX + dx;
        const sy = sectorY + dy;
        const key = `${sx}_${sy}`;
        if (!activeSectors.has(key)) {
          activeSectors.set(key, { x: sx, y: sy });
        }
      }
    }
  }

  // Check each active sector for bases
  for (const [sectorKey, coords] of activeSectors) {
    const sector = world.generateSector(coords.x, coords.y);

    if (!sector.bases || sector.bases.length === 0) continue;

    for (const base of sector.bases) {
      // Get computed position for orbital bases (critical for sync with NPC spawning)
      const computedPos = world.getObjectPosition(base.id);
      const baseX = computedPos ? computedPos.x : base.x;
      const baseY = computedPos ? computedPos.y : base.y;

      // Check if any player is within activation range
      let hasNearbyPlayer = false;
      for (const player of players) {
        const dx = player.position.x - baseX;
        const dy = player.position.y - baseY;
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
  // Use Map to store sector coordinates directly, avoiding string parsing in loop
  const activeSectors = new Map();
  for (const player of players) {
    const sectorX = Math.floor(player.position.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(player.position.y / config.SECTOR_SIZE);

    // Include adjacent sectors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sx = sectorX + dx;
        const sy = sectorY + dy;
        const key = `${sx}_${sy}`;
        if (!activeSectors.has(key)) {
          activeSectors.set(key, { x: sx, y: sy });
        }
      }
    }
  }

  // Spawn NPCs in active sectors
  for (const [sectorKey, coords] of activeSectors) {
    const spawned = npc.spawnNPCsForSector(coords.x, coords.y);

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
  const npcsToRemove = [];  // Track NPCs to remove after iteration (for despawning)
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

      // VALIDATION: Re-verify distance before applying damage
      // This prevents hits when player has moved out of range since AI check
      const actualDx = targetPlayer.position.x - npcEntity.position.x;
      const actualDy = targetPlayer.position.y - npcEntity.position.y;
      const actualDist = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

      // Allow slight tolerance (10%) to account for position updates during tick
      const maxRange = npcEntity.weaponRange * 1.1;
      if (actualDist > maxRange) {
        // Target moved out of range - skip damage but still show visual (miss)
        broadcastNearNpc(npcEntity, 'combat:npcFire', {
          npcId: npcId,
          faction: npcEntity.faction,
          weaponType: action.weaponType || 'kinetic',
          sourceX: npcEntity.position.x,
          sourceY: npcEntity.position.y,
          targetX: targetPlayer.position.x,
          targetY: targetPlayer.position.y,
          rotation: npcEntity.rotation,
          hitInfo: null // No hit - shot missed
        });
        continue; // Skip to next NPC
      }

      // ACCURACY CHECK: Calculate hit chance based on faction, distance, and target velocity
      const baseAccuracy = NPC_ACCURACY.FACTION_BASE[npcEntity.faction] || 0.6;

      // Distance penalty: accuracy drops at longer range (linear interpolation)
      const rangeRatio = actualDist / npcEntity.weaponRange;
      const rangePenalty = rangeRatio * NPC_ACCURACY.RANGE_PENALTY_MAX;

      // Velocity penalty: moving targets are harder to hit
      const targetVelocity = Math.sqrt(
        targetPlayer.velocity.x * targetPlayer.velocity.x +
        targetPlayer.velocity.y * targetPlayer.velocity.y
      );
      const velocityRatio = Math.min(1, targetVelocity / NPC_ACCURACY.VELOCITY_THRESHOLD);
      const velocityPenalty = velocityRatio * NPC_ACCURACY.VELOCITY_PENALTY_MAX;

      // Final accuracy (clamped to 15-95% to prevent guaranteed hits/misses)
      const finalAccuracy = Math.max(0.15, Math.min(0.95, baseAccuracy - rangePenalty - velocityPenalty));

      // Roll for hit
      if (Math.random() > finalAccuracy) {
        // MISS - show visual but no damage
        broadcastNearNpc(npcEntity, 'combat:npcFire', {
          npcId: npcId,
          faction: npcEntity.faction,
          weaponType: action.weaponType || 'kinetic',
          sourceX: npcEntity.position.x,
          sourceY: npcEntity.position.y,
          targetX: targetPlayer.position.x,
          targetY: targetPlayer.position.y,
          rotation: npcEntity.rotation,
          hitInfo: null // No hit - shot missed
        });
        continue; // Skip to next NPC
      }

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
    } else if (action && action.action === 'despawn') {
      // Handle orphaned NPC despawn (rage timer expired)
      // Broadcast death effect first
      broadcastNearNpc(npcEntity, 'npc:death', {
        npcId: npcId,
        x: npcEntity.position.x,
        y: npcEntity.position.y,
        faction: npcEntity.faction,
        deathType: 'despawn',
        reason: action.reason || 'rage_expired'
      });

      // Remove from activeNPCs (will be handled after loop to avoid modification during iteration)
      npcsToRemove.push(npcId);
    }
  }

  // Remove any NPCs that need to despawn (outside the iteration loop)
  for (const npcId of npcsToRemove) {
    npc.activeNPCs.delete(npcId);
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
    // Use the larger of radar range or broadcast range for consistent sync
    // This ensures players see bases even at sector edges
    const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, (player.radarTier || 1) - 1);
    const syncRange = Math.max(radarRange, BASE_BROADCAST_RANGE);

    // Get bases within sync range (using existing npc.getBasesInRange)
    const nearbyBases = npc.getBasesInRange(player.position, syncRange);

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

  const broadcastRange = BASE_BROADCAST_RANGE;  // Use consistent module-level constant

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
    // Spawn wreckage at NPC position with loot, passing damage contributors for team rewards
    const wreckage = loot.spawnWreckage(npcEntity, npcEntity.position, null, npcEntity.damageContributors);

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
              // Spawn wreckage for linked death (inherit parent NPC's damage contributors for team credit)
              const wreckage = loot.spawnWreckage(linkedNpc, linkedNpc.position, null, npcEntity.damageContributors);

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

  // Defensive validation: verify base is active and not destroyed
  const activeBase = npc.getActiveBase(baseId);
  if (!activeBase) {
    logger.debug(`playerAttackBase: Base ${baseId} is not active`);
    return null;
  }
  if (activeBase.destroyed) {
    logger.debug(`playerAttackBase: Base ${baseId} is already destroyed`);
    return null;
  }

  // Calculate damage using proper damage calculation
  const damage = combat.calculateDamage(weaponType, weaponTier, 1);
  const totalDamage = damage.shieldDamage + damage.hullDamage;

  // Apply damage to base with attacker tracking
  const result = npc.damageBase(baseId, totalDamage, attackerId);

  if (result && result.destroyed) {
    // Generate loot for the base
    const baseLoot = result.loot;

    // Create wreckage-like object for the base
    // Note: creditReward is 0 because credits are already awarded at destruction time
    // (see socket.js combat:fire handler for bases). Wreckage only contains resource loot.
    const wreckage = loot.spawnWreckage({
      id: baseId,
      name: baseObj.name,
      faction: baseObj.faction,
      type: 'base',
      creditReward: 0
    }, { x: baseObj.x, y: baseObj.y }, baseLoot, null);

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

  const broadcastRange = BASE_BROADCAST_RANGE;  // Use consistent module-level constant

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
