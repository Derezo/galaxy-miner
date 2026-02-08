'use strict';

/**
 * Relic Socket Handler
 * Events: relic:plunder
 */

const config = require('../config');
const { statements, getSafeCredits, safeUpdateCredits, safeUpsertInventory } = require('../database');
const npc = require('../game/npc');
const world = require('../world');
const LootPools = require('../game/loot-pools');
const Constants = require('../../shared/constants');
const logger = require('../../shared/logger');

/**
 * Register relic socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId } = deps;
  const { connectedPlayers } = deps.state;

  // Skull and Bones: Plunder faction base
  socket.on('relic:plunder', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;
      const { baseId } = data;

      logger.log('[Plunder] Plunder request from user', authenticatedUserId, 'for base', baseId);

      // Validate relic ownership
      const hasRelic = statements.hasRelic.get(authenticatedUserId, 'SKULL_AND_BONES');
      if (!hasRelic) {
        socket.emit('relic:plunderFailed', { reason: 'Missing Skull and Bones relic' });
        return;
      }

      // Get player position
      const player = connectedPlayers.get(socket.id);
      if (!player || !player.position) {
        socket.emit('relic:plunderFailed', { reason: 'Player not found' });
        return;
      }

      // Get base and validate
      const base = npc.getActiveBase(baseId);
      if (!base || base.destroyed) {
        socket.emit('relic:plunderFailed', { reason: 'Base not found' });
        return;
      }

      // Get computed position for orbital bases
      const computedPos = world.getObjectPosition(baseId);
      const baseX = computedPos ? computedPos.x : base.x;
      const baseY = computedPos ? computedPos.y : base.y;

      // Calculate distance and validate range with tolerance
      const dx = baseX - player.position.x;
      const dy = baseY - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const plunderRange = Constants.RELIC_TYPES?.SKULL_AND_BONES?.plunderRange || 200;
      const baseSize = base.size || 100;
      const tolerance = config.ORBITAL_POSITION_TOLERANCE || 1.15;

      if (dist > (plunderRange + baseSize) * tolerance) {
        socket.emit('relic:plunderFailed', { reason: 'Too far from base' });
        return;
      }

      // Calculate plunder rewards based on base type
      const rewards = calculatePlunderRewards(base);

      // Apply rewards to player
      if (rewards.credits > 0) {
        const ship = statements.getShipByUserId.get(authenticatedUserId);
        const currentCredits = getSafeCredits(ship);
        safeUpdateCredits(currentCredits + rewards.credits, authenticatedUserId);
        logger.log('[Plunder] Added', rewards.credits, 'credits to user', authenticatedUserId);
      }

      // Add resources to inventory
      if (rewards.resources && rewards.resources.length > 0) {
        for (const item of rewards.resources) {
          safeUpsertInventory(authenticatedUserId, item.resource, item.quantity);
          logger.log('[Plunder] Added', item.quantity, item.resource, 'to user', authenticatedUserId);
        }
      }

      // Clear base resources after plundering
      clearBaseResources(base);

      // Trigger aggro for same-faction NPCs within range (use computed position)
      const aggroRange = Constants.RELIC_TYPES?.SKULL_AND_BONES?.aggroRange || 600;
      const nearbyNPCs = npc.getNPCsInRange({ x: baseX, y: baseY }, aggroRange);

      for (const npcEntity of nearbyNPCs) {
        if (npcEntity.faction === base.faction) {
          npcEntity.targetPlayer = authenticatedUserId;
          npcEntity.state = 'combat';
          logger.log('[Plunder] NPC', npcEntity.id, 'now hostile to player');
        }
      }

      // Build loot array for client
      const lootItems = rewards.resources.map(r => ({
        type: 'resource',
        resource: r.resource,
        quantity: r.quantity
      }));

      // Send success to plundering player (use computed position)
      socket.emit('relic:plunderSuccess', {
        baseId,
        credits: rewards.credits,
        loot: lootItems,
        position: { x: baseX, y: baseY }
      });

      // Send inventory update for server sync
      const inventory = statements.getInventory.all(authenticatedUserId);
      const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
      socket.emit('inventory:update', {
        inventory,
        credits: getSafeCredits(updatedShip)
      });

      // Broadcast visual effect to all nearby players (use computed position)
      io.emit('base:plundered', {
        baseId,
        position: { x: baseX, y: baseY }
      });

      logger.log('[Plunder] Plunder complete - credits:', rewards.credits, 'items:', lootItems.length);
    } catch (err) {
      logger.error(`[HANDLER] relic:plunder error:`, err);
    }
  });
}

/**
 * Calculate plunder rewards based on base type (Skull and Bones relic)
 * @param {Object} base - The base being plundered
 * @returns {Object} { credits: number, resources: Array }
 */
function calculatePlunderRewards(base) {
  const rewards = { credits: 0, resources: [] };

  switch (base.type) {
    case 'mining_claim':
      // Steal all accumulated credits from rogue miner claim
      rewards.credits = base.claimCredits || 0;
      break;

    case 'scavenger_yard':
      // Steal entire scrap pile contents
      if (base.scrapPile && base.scrapPile.contents) {
        // Convert wreckage contents to resources
        // Note: Wreckage contents use 'resourceType' from LootPools
        for (const item of base.scrapPile.contents) {
          if (item.type === 'resource' && item.resourceType && item.quantity) {
            rewards.resources.push({
              resource: item.resourceType,
              quantity: item.quantity
            });
          } else if (item.credits) {
            rewards.credits += item.credits;
          }
        }
      }
      break;

    case 'pirate_outpost':
    case 'void_rift':
    case 'swarm_hive':
      // Generate loot using standard loot pools
      const generated = LootPools.generateLoot(base.type);
      if (generated && generated.length > 0) {
        for (const item of generated) {
          if (item.type === 'resource') {
            // LootPools uses 'resourceType', normalize to 'resource' for consistency
            rewards.resources.push({
              resource: item.resourceType,
              quantity: item.quantity || 1
            });
          } else if (item.type === 'credits') {
            rewards.credits += item.amount || 100;
          }
        }
      }
      // Minimum credits if nothing generated
      if (rewards.credits === 0 && rewards.resources.length === 0) {
        rewards.credits = 50 + Math.floor(Math.random() * 100);
      }
      break;

    default:
      // Unknown base type - give small credit reward
      rewards.credits = 25;
      break;
  }

  return rewards;
}

/**
 * Clear base resources after plundering (Skull and Bones relic)
 * @param {Object} base - The base that was plundered
 */
function clearBaseResources(base) {
  if (base.type === 'mining_claim') {
    base.claimCredits = 0;
  } else if (base.type === 'scavenger_yard' && base.scrapPile) {
    base.scrapPile.count = 0;
    base.scrapPile.contents = [];
  }
  // pirate_outpost, void_rift, swarm_hive don't have persistent resources
}

module.exports = { register };
