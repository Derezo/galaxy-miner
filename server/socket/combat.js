'use strict';

/**
 * Combat Socket Handler
 * Events: combat:fire
 */

const config = require('../config');
const { statements, getSafeCredits, safeUpdateCredits } = require('../database');
const npc = require('../game/npc');
const engine = require('../game/engine');
const combat = require('../game/combat');
const { normalizeRotation, validateCombatFire } = require('../validators');
const logger = require('../../shared/logger');

function allocateBaseCreditPool(participantIds, totalCredits, legacyCreditsPerPlayer) {
  const ids = Array.isArray(participantIds) ? participantIds : [];
  if (ids.length === 0) return new Map();

  const normalizeCredits = value => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
    const normalized = Math.floor(numericValue);
    return Number.isSafeInteger(normalized) ? normalized : 0;
  };
  const hasDeclaredPool = totalCredits !== undefined && totalCredits !== null;
  const legacyShare = normalizeCredits(legacyCreditsPerPlayer);
  const pool = hasDeclaredPool
    ? normalizeCredits(totalCredits)
    : legacyShare * ids.length;
  if (!Number.isSafeInteger(pool)) return new Map(ids.map(id => [id, 0]));

  const baseShare = Math.floor(pool / ids.length);
  const remainder = pool - (baseShare * ids.length);
  return new Map(ids.map((id, index) => [
    id,
    baseShare + (index < remainder ? 1 : 0)
  ]));
}

/**
 * Register combat socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId } = deps;
  const { connectedPlayers, setPlayerStatus, broadcastToNearby } = deps.state;
  const combatSystem = deps.combat || combat;
  const npcSystem = deps.npc || npc;
  const gameEngine = deps.engine || engine;

  // Combat: Fire weapon
  socket.on('combat:fire', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    if (player.isDead || deps.wormhole?.isInTransit?.(authenticatedUserId)) return;

    const validation = validateCombatFire(data);
    if (!validation.valid) {
      logger.warn(`Rejected invalid combat input from ${player.username}: ${validation.error}`);
      return;
    }

    const weaponTier = player.weaponTier || 1;
    const energyCoreTier = player.energyCoreTier || 1;
    const fireResult = combatSystem.fire(authenticatedUserId, weaponTier, energyCoreTier);
    if (!fireResult.success) return;

    const fireDirection = normalizeRotation(data.direction ?? player.rotation);

    // Set player status to combat (with timeout back to idle)
    setPlayerStatus(authenticatedUserId, 'combat', 3000);

    // Broadcast the fire event with weapon tier for visuals
    broadcastToNearby(socket, player, 'combat:fire', {
      playerId: authenticatedUserId,
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation,
      direction: fireDirection,
      weaponTier
    });

    // Hit detection for NPCs
    // Use per-tier weapon ranges that match client visual projectile distance
    const weaponRange = (config.WEAPON_RANGES && config.WEAPON_RANGES[weaponTier])
      || config.BASE_WEAPON_RANGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);

    // Get all NPCs in range
    const npcsInRange = npcSystem.getNPCsInRange(player.position, weaponRange);
    const projectileSpeed = config.PROJECTILE_SPEED || 800;
    let npcWasHit = false;

    for (const npcData of npcsInRange) {
      // Calculate distance to NPC
      const dx = npcData.position.x - player.position.x;
      const dy = npcData.position.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Calculate projectile travel time to current NPC position
      const travelTime = dist / projectileSpeed;

      // Predict NPC position at impact time (account for NPC movement)
      const npcVelocity = npcData.velocity || { x: 0, y: 0 };
      const velocityX = Number.isFinite(npcVelocity.x) ? npcVelocity.x : 0;
      const velocityY = Number.isFinite(npcVelocity.y) ? npcVelocity.y : 0;
      const predictedX = npcData.position.x + velocityX * travelTime;
      const predictedY = npcData.position.y + velocityY * travelTime;

      // Calculate angle to PREDICTED position
      const predictedDx = predictedX - player.position.x;
      const predictedDy = predictedY - player.position.y;
      const angleToNpc = Math.atan2(predictedDy, predictedDx);

      // Check if NPC is in firing cone
      const angleDiff = normalizeRotation(angleToNpc - fireDirection);

      // Slightly wider hit angle for prediction tolerance (~17 degrees)
      const hitAngle = 0.30;
      if (Math.abs(angleDiff) <= hitAngle) {
        // Hit! Apply damage to NPC
        const result = gameEngine.playerAttackNPC(
          authenticatedUserId,
          npcData.id,
          player.weaponType || 'kinetic',
          weaponTier
        );

        if (result) {
          npcWasHit = true;
          if (!result.blocked) {
            // Send hit feedback to the player
            const baseDamage = config.BASE_WEAPON_DAMAGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
            socket.emit('combat:npcHit', {
              npcId: npcData.id,
              damage: baseDamage,
              destroyed: result.destroyed,
              x: predictedX,
              y: predictedY
              // Note: rewards are now granted only when collecting wreckage/scrap
            });

            // Tesla Cannon chain lightning (tier 5 only)
            if (weaponTier >= 5 && config.TESLA_CANNON) {
              handleChainLightning(socket, player, npcData, weaponTier, baseDamage, authenticatedUserId, deps);
            }
          }
        }
        break; // Only hit one NPC per shot
      }
    }

    // Hit detection for faction bases (only if no NPC was hit)
    if (!npcWasHit) {
      handleBaseHitDetection(socket, player, weaponTier, fireDirection, weaponRange, authenticatedUserId, deps);
    }
  });
}

/**
 * Handle Tesla Cannon chain lightning effect
 */
function handleChainLightning(socket, player, hitNpc, weaponTier, baseDamage, authenticatedUserId, deps) {
  const { broadcastChainLightning } = deps.broadcasts;
  const npcSystem = deps.npc || npc;
  const gameEngine = deps.engine || engine;
  const teslaConfig = config.TESLA_CANNON;
  const chainRange = teslaConfig.chainRange || 150;
  const damageFalloff = teslaConfig.damageFalloff || [1.0, 0.5, 0.25];
  const maxChains = (teslaConfig.chainJumps || 3) - 1;

  // Find chain targets starting from hit NPC position
  const sourcePos = hitNpc.position;
  const hitNpcIds = new Set([hitNpc.id]);
  const chains = [];
  let lastPos = sourcePos;

  for (let i = 0; i < maxChains; i++) {
    // Find nearest NPC within chain range that hasn't been hit
    const nearbyNpcs = npcSystem.getNPCsInRange(lastPos, chainRange);
    let bestTarget = null;
    let bestDist = Infinity;

    for (const candidate of nearbyNpcs) {
      if (hitNpcIds.has(candidate.id)) continue;
      const cdx = candidate.position.x - lastPos.x;
      const cdy = candidate.position.y - lastPos.y;
      const candDist = Math.sqrt(cdx * cdx + cdy * cdy);
      if (candDist < bestDist) {
        bestDist = candDist;
        bestTarget = candidate;
      }
    }

    if (!bestTarget) break; // No more targets in range

    // Apply chain damage with falloff
    const chainDamageMultiplier = damageFalloff[i + 1] || damageFalloff[damageFalloff.length - 1];
    const chainDamage = Math.round(baseDamage * chainDamageMultiplier);

    const chainResult = gameEngine.playerAttackNPC(
      authenticatedUserId,
      bestTarget.id,
      'tesla', // Special weapon type for chain lightning
      weaponTier,
      chainDamage // Override damage
    );

    hitNpcIds.add(bestTarget.id);
    chains.push({
      targetId: bestTarget.id,
      targetX: bestTarget.position.x,
      targetY: bestTarget.position.y,
      damage: chainDamage,
      destroyed: chainResult ? chainResult.destroyed : false
    });

    lastPos = bestTarget.position;
  }

  // Broadcast chain lightning if we hit any additional targets
  if (chains.length > 0) {
    broadcastChainLightning({
      playerId: authenticatedUserId,
      sourceNpcId: hitNpc.id,
      sourceX: sourcePos.x,
      sourceY: sourcePos.y,
      chains: chains
    });
  }
}

/**
 * Handle base hit detection
 */
function handleBaseHitDetection(socket, player, weaponTier, fireDirection, weaponRange, authenticatedUserId, deps) {
  const { io } = deps;
  const { broadcastTeslaCoil } = deps.broadcasts;
  const npcSystem = deps.npc || npc;
  const gameEngine = deps.engine || engine;
  const dbStatements = deps.statements || statements;
  const readCredits = deps.getSafeCredits || getSafeCredits;
  const updateCredits = deps.safeUpdateCredits || safeUpdateCredits;

  const basesInRange = npcSystem.getBasesInRange(player.position, weaponRange);
  for (const baseData of basesInRange) {
    // Calculate distance and angle to base center
    const dx = baseData.x - player.position.x;
    const dy = baseData.y - player.position.y;
    const distToBase = Math.sqrt(dx * dx + dy * dy);
    const baseSize = baseData.size || 100;

    // Effective distance subtracts base size (edge of base, not center)
    const effectiveDistance = distToBase - baseSize;

    // Skip if actually out of weapon range (accounting for size)
    if (effectiveDistance > weaponRange) continue;

    const angleToBase = Math.atan2(dy, dx);

    // Bases are larger targets - use wider hit angle based on size
    const angleDiff = normalizeRotation(angleToBase - fireDirection);

    // Calculate angular size of base from player's perspective
    const baseAngularSize = Math.atan2(baseSize, distToBase);
    const hitAngle = Math.max(0.26, baseAngularSize); // At least 15 degrees

    if (Math.abs(angleDiff) <= hitAngle) {
      // Hit! Apply damage to base
      const result = gameEngine.playerAttackBase(
        authenticatedUserId,
        baseData.id,
        player.weaponType || 'kinetic',
        weaponTier
      );

      if (result) {
        // Send hit feedback to the player
        socket.emit('combat:baseHit', {
          baseId: baseData.id,
          damage: config.BASE_WEAPON_DAMAGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1),
          destroyed: result.destroyed,
          health: result.health,
          maxHealth: result.maxHealth
        });

        // Tesla Cannon tesla coil effect on base hit (tier 5 only)
        if (weaponTier >= 5 && config.TESLA_CANNON) {
          const teslaConfig = config.TESLA_CANNON;
          const coilRange = teslaConfig.teslaCoilRange || 200;
          const coilDuration = teslaConfig.teslaCoilDuration || 500;

          // Find nearby NPCs for visual arcing (no damage, just visual effect)
          const nearbyNpcs = npcSystem.getNPCsInRange({ x: baseData.x, y: baseData.y }, coilRange);
          const coilTargets = nearbyNpcs.slice(0, 6).map(n => ({
            npcId: n.id,
            x: n.position.x,
            y: n.position.y
          }));

          // Broadcast tesla coil effect (visual only)
          broadcastTeslaCoil({
            playerId: authenticatedUserId,
            baseId: baseData.id,
            impactX: baseData.x,
            impactY: baseData.y,
            baseSize: baseData.size || 100,
            duration: coilDuration,
            targets: coilTargets
          });
        }

        // If base was destroyed, give the independently earned share to every
        // damage contributor. Online state/notifications are synchronized, but
        // being offline never forfeits a reward.
        if (result.destroyed) {
          const participantIds = [...new Set((result.participants || [])
            .map(Number)
            .filter(id => Number.isSafeInteger(id) && id > 0))];
          if (participantIds.length === 0) participantIds.push(authenticatedUserId);
          const rewards = allocateBaseCreditPool(
            participantIds,
            result.totalCredits,
            result.creditsPerPlayer
          );

          for (const participantId of participantIds) {
            const reward = rewards.get(participantId) || 0;
            try {
              if (reward > 0) {
                const ship = dbStatements.getShipByUserId.get(participantId);
                if (ship) {
                  updateCredits(readCredits(ship) + reward, participantId);
                }
              }

              const participantSocketId = deps.state.userSockets?.get(participantId) ||
                deps.state.userSockets?.get(String(participantId));
              if (!participantSocketId) continue;

              const inventory = dbStatements.getInventory.all(participantId);
              const updatedShip = dbStatements.getShipByUserId.get(participantId);
              io.to(participantSocketId).emit('inventory:update', {
                inventory,
                credits: readCredits(updatedShip)
              });
              io.to(participantSocketId).emit('base:reward', {
                credits: reward,
                teamMultiplier: result.teamMultiplier,
                participantCount: participantIds.length,
                baseName: baseData.name,
                faction: baseData.faction
              });
            } catch (err) {
              logger.error(`[COMBAT REWARD ERROR] User ${participantId} base loot:`, err.message);
              const failedSocketId = deps.state.userSockets?.get(participantId);
              if (failedSocketId) {
                io.to(failedSocketId).emit('error:generic', {
                  message: 'Failed to award base destruction rewards. Please check your inventory.'
                });
              }
            }
          }
        }
      }
      break; // Only hit one base per shot
    }
  }
}

module.exports = { register, allocateBaseCreditPool };
