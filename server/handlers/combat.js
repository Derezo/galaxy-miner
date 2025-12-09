/**
 * Combat event handlers for Galaxy Miner
 *
 * Handles:
 * - combat:fire - Player firing weapons at NPCs and bases
 * - Hit detection (NPCs and faction bases)
 * - Tesla cannon effects (chain lightning, tesla coil)
 * - Base destruction rewards
 */

const logger = require('../../shared/logger');
const { validateCombatFire } = require('../validators');

function register(ctx) {
  const { socket, io, state, combat, engine, config, npc, statements, getSafeCredits, safeUpdateCredits, broadcastToNearby } = ctx;

  // Combat: Fire weapon
  socket.on('combat:fire', (data) => {
    const authenticatedUserId = state.authenticatedUserId;
    if (!authenticatedUserId) return;

    const player = state.connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate input
    const validation = validateCombatFire(data);
    if (!validation.valid) {
      logger.warn(`[Combat] Invalid fire data from user ${authenticatedUserId}: ${validation.error}`);
      return;
    }

    // Set player status to combat (with timeout back to idle)
    state.setPlayerStatus(authenticatedUserId, 'combat', 3000);

    // Broadcast the fire event with weapon tier for visuals
    broadcastToNearby(socket, player, 'combat:fire', {
      playerId: authenticatedUserId,
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation,
      direction: data.direction,
      weaponTier: player.weaponTier || 1
    });

    // Hit detection for NPCs
    const weaponTier = player.weaponTier || 1;
    // Use per-tier weapon ranges that match client visual projectile distance
    const weaponRange = (config.WEAPON_RANGES && config.WEAPON_RANGES[weaponTier])
      || config.BASE_WEAPON_RANGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
    const fireDirection = data.direction || player.rotation;

    // Get all NPCs in range
    const npcsInRange = npc.getNPCsInRange(player.position, weaponRange);
    const projectileSpeed = config.PROJECTILE_SPEED || 800;

    for (const npcData of npcsInRange) {
      // Calculate distance to NPC
      const dx = npcData.position.x - player.position.x;
      const dy = npcData.position.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Calculate projectile travel time to current NPC position
      const travelTime = dist / projectileSpeed;

      // Predict NPC position at impact time (account for NPC movement)
      const npcVelocity = npcData.velocity || { x: 0, y: 0 };
      const predictedX = npcData.position.x + npcVelocity.x * travelTime;
      const predictedY = npcData.position.y + npcVelocity.y * travelTime;

      // Calculate angle to PREDICTED position
      const predictedDx = predictedX - player.position.x;
      const predictedDy = predictedY - player.position.y;
      const angleToNpc = Math.atan2(predictedDy, predictedDx);

      // Check if NPC is in firing cone
      let angleDiff = angleToNpc - fireDirection;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Slightly wider hit angle for prediction tolerance (~17 degrees)
      const hitAngle = 0.30;
      if (Math.abs(angleDiff) <= hitAngle) {
        // Hit! Apply damage to NPC
        const result = engine.playerAttackNPC(
          authenticatedUserId,
          npcData.id,
          player.weaponType || 'kinetic',
          weaponTier
        );

        if (result) {
          // Send hit feedback to the player
          const baseDamage = config.BASE_WEAPON_DAMAGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
          socket.emit('combat:npcHit', {
            npcId: npcData.id,
            damage: baseDamage,
            destroyed: result.destroyed
            // Note: rewards are now granted only when collecting wreckage/scrap
          });

          // Tesla Cannon chain lightning (tier 5 only)
          if (weaponTier >= 5 && config.TESLA_CANNON) {
            const teslaConfig = config.TESLA_CANNON;
            const chainRange = teslaConfig.chainRange || 150;
            const damageFalloff = teslaConfig.damageFalloff || [1.0, 0.5, 0.25];
            const maxChains = (teslaConfig.chainJumps || 3) - 1; // Primary hit is first, chains are additional

            // Find chain targets starting from hit NPC position
            const sourcePos = npcData.position;
            const hitNpcIds = new Set([npcData.id]); // Track hit NPCs to avoid repeat hits
            const chains = [];
            let lastPos = sourcePos;

            for (let i = 0; i < maxChains; i++) {
              // Find nearest NPC within chain range that hasn't been hit
              const nearbyNpcs = npc.getNPCsInRange(lastPos, chainRange);
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

              const chainResult = engine.playerAttackNPC(
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
              state.broadcastChainLightning({
                playerId: authenticatedUserId,
                sourceNpcId: npcData.id,
                sourceX: sourcePos.x,
                sourceY: sourcePos.y,
                chains: chains
              });
            }
          }
        }
        break; // Only hit one NPC per shot
      }
    }

    // Hit detection for faction bases (only if no NPC was hit)
    const basesInRange = npc.getBasesInRange(player.position, weaponRange);
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
      let angleDiff = angleToBase - fireDirection;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Calculate angular size of base from player's perspective
      const baseAngularSize = Math.atan2(baseSize, distToBase);
      const hitAngle = Math.max(0.26, baseAngularSize); // At least 15 degrees

      if (Math.abs(angleDiff) <= hitAngle) {
        // Hit! Apply damage to base
        const result = engine.playerAttackBase(
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
            const nearbyNpcs = npc.getNPCsInRange({ x: baseData.x, y: baseData.y }, coilRange);
            const coilTargets = nearbyNpcs.slice(0, 6).map(n => ({
              npcId: n.id,
              x: n.position.x,
              y: n.position.y
            }));

            // Broadcast tesla coil effect (visual only)
            state.broadcastTeslaCoil({
              playerId: authenticatedUserId,
              baseId: baseData.id,
              impactX: baseData.x,
              impactY: baseData.y,
              baseSize: baseData.size || 100,
              duration: coilDuration,
              targets: coilTargets
            });
          }

          // If base was destroyed, give rewards to player
          if (result.destroyed) {
            try {
              // Award credit reward (with team bonus)
              if (result.creditsPerPlayer > 0) {
                const ship = statements.getShipByUserId.get(authenticatedUserId);
                const currentCredits = getSafeCredits(ship);
                safeUpdateCredits(currentCredits + result.creditsPerPlayer, authenticatedUserId);
              }

              // Send updated inventory and credits
              const inventory = statements.getInventory.all(authenticatedUserId);
              const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
              socket.emit('inventory:update', {
                inventory,
                credits: getSafeCredits(updatedShip)
              });

              // Notify player of rewards
              socket.emit('base:reward', {
                credits: result.creditsPerPlayer,
                teamMultiplier: result.teamMultiplier,
                participantCount: result.participantCount,
                baseName: baseData.name,
                faction: baseData.faction
              });
            } catch (err) {
              logger.error(`[COMBAT REWARD ERROR] User ${authenticatedUserId} base loot:`, err.message);
              socket.emit('error:generic', { message: 'Failed to award base destruction rewards. Please check your inventory.' });
            }
          }
        }
        break; // Only hit one base per shot
      }
    }
  });
}

module.exports = { register };
