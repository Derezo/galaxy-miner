'use strict';

/**
 * Relic Socket Handler
 * Events: relic:plunder
 */

const config = require('../config');
const { statements, getSafeCredits, grantPlunderRewards } = require('../database');
const npc = require('../game/npc');
const world = require('../world');
const LootPools = require('../game/loot-pools');
const Constants = require('../../shared/constants');
const {
  playerHasRelic,
  allocateCargoResources,
  getCooldownRemaining
} = require('../game/relic-effects');
const logger = require('../../shared/logger');

// These maps deliberately live outside the socket closure. Reconnecting cannot
// clear a player's cooldown, and deactivating/reactivating a base cannot refill
// its finite cache during the same server-side base lifecycle.
const playerPlunderCooldowns = new Map(); // userId -> last successful plunder
const basePlunderStates = new Map(); // baseId -> lifecycle reserve + cooldown

function getPlunderConfig() {
  return Constants.RELIC_TYPES?.SKULL_AND_BONES || {};
}

function getPlayerPlunderCooldownRemaining(userId, now = Date.now()) {
  const cooldown = getPlunderConfig().cooldown || 15000;
  const remaining = getCooldownRemaining(playerPlunderCooldowns.get(userId), cooldown, now);
  if (remaining <= 0) playerPlunderCooldowns.delete(userId);
  return remaining;
}

function getBaseIdentity(base) {
  return `${base.type || 'unknown'}:${base.faction || 'unknown'}`;
}

function getBasePlunderState(baseId, base) {
  const baseIdentity = getBaseIdentity(base);
  const destroyedAt = Math.max(0, Number(base.destroyedAt) || 0);
  const existing = basePlunderStates.get(baseId);
  if (existing
    && existing.baseIdentity === baseIdentity
    && (destroyedAt === 0 || destroyedAt <= existing.lastDestroyedAt)) {
    return existing;
  }

  const state = {
    baseIdentity,
    // A reactivated world base may no longer carry destroyedAt. Retaining the
    // highest observed value prevents activation-range churn from rerolling it.
    lastDestroyedAt: Math.max(destroyedAt, existing?.lastDestroyedAt || 0),
    lastPlunderAt: 0,
    reserve: null
  };
  basePlunderStates.set(baseId, state);
  return state;
}

function mergeResource(resources, resource, quantity) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!resource || safeQuantity <= 0) return;

  const existing = resources.find(item => item.resource === resource);
  if (existing) existing.quantity += safeQuantity;
  else resources.push({ resource, quantity: safeQuantity });
}

function normalizeLoot(contents) {
  const rewards = { credits: 0, resources: [] };

  for (const item of Array.isArray(contents) ? contents : []) {
    if (item?.type === 'resource') {
      mergeResource(rewards.resources, item.resourceType || item.resource, item.quantity);
    } else if (item?.type === 'credits') {
      rewards.credits += Math.max(0, Math.floor(Number(item.amount) || 0));
    } else if (item?.credits) {
      rewards.credits += Math.max(0, Math.floor(Number(item.credits) || 0));
    }
  }

  return rewards;
}

function createFiniteBaseReserve(base) {
  const plunderConfig = getPlunderConfig();
  const rolls = Math.max(1, Math.min(3, Math.floor(plunderConfig.reserveLootRolls || 1)));
  const contents = [];
  for (let i = 0; i < rolls; i++) {
    contents.push(...(LootPools.generateLoot(base.type) || []));
  }

  const reserve = normalizeLoot(contents);
  const creditReserves = plunderConfig.baseCreditReserve || {};
  reserve.credits += Math.max(
    0,
    Math.floor(Number(creditReserves[base.type] ?? creditReserves.default) || 0)
  );
  return reserve;
}

/**
 * Read what is currently available without mutating the base or reserve.
 */
function calculateAvailableRewards(base, state) {
  if (base.type === 'mining_claim') {
    return {
      source: 'mining_claim',
      credits: Math.max(0, Math.floor(Number(base.claimCredits) || 0)),
      resources: []
    };
  }

  if (base.type === 'scavenger_yard') {
    return {
      source: 'scavenger_yard',
      ...normalizeLoot(base.scrapPile?.contents || [])
    };
  }

  if (!state.reserve) state.reserve = createFiniteBaseReserve(base);
  return {
    source: 'finite_cache',
    credits: state.reserve.credits,
    resources: state.reserve.resources.map(item => ({ ...item }))
  };
}

function consumeScavengerRewards(base, grantedResources) {
  if (!base.scrapPile || !Array.isArray(base.scrapPile.contents)) return;

  const quantitiesToRemove = new Map();
  for (const item of grantedResources) {
    quantitiesToRemove.set(
      item.resource,
      (quantitiesToRemove.get(item.resource) || 0) + item.quantity
    );
  }

  const remainingContents = [];
  for (const item of base.scrapPile.contents) {
    if (item?.type === 'credits' || item?.credits) {
      // Credit rewards have no cargo cost and are fully withdrawn on success.
      continue;
    }

    if (item?.type !== 'resource') {
      // Plunder cannot steal buffs/components/relics from a scrap pile.
      remainingContents.push(item);
      continue;
    }

    const resource = item.resourceType || item.resource;
    const available = Math.max(0, Math.floor(Number(item.quantity) || 0));
    const requested = quantitiesToRemove.get(resource) || 0;
    const removed = Math.min(available, requested);
    quantitiesToRemove.set(resource, requested - removed);

    if (available > removed) {
      remainingContents.push({ ...item, quantity: available - removed });
    }
  }

  base.scrapPile.contents = remainingContents;
  if (remainingContents.length === 0) {
    base.scrapPile.count = 0;
  } else {
    base.scrapPile.count = Math.max(1, Math.min(base.scrapPile.count || 1, remainingContents.length));
  }
}

function consumeRewards(base, state, available, cargoAllocation) {
  if (available.source === 'mining_claim') {
    base.claimCredits = Math.max(0, (Number(base.claimCredits) || 0) - available.credits);
    return;
  }

  if (available.source === 'scavenger_yard') {
    consumeScavengerRewards(base, cargoAllocation.granted);
    return;
  }

  state.reserve.credits = 0;
  state.reserve.resources = cargoAllocation.remaining.map(item => ({ ...item }));
}

function isReserveDepleted(base, state) {
  const available = calculateAvailableRewards(base, state);
  return available.credits <= 0 && available.resources.length === 0;
}

function emitFailure(socket, reason, extra = {}) {
  socket.emit('relic:plunderFailed', { reason, ...extra });
}

/**
 * Register relic handlers for a socket.
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const { connectedPlayers, broadcastToNearby } = deps.state;

  socket.on('relic:plunder', (data) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId();
      if (!authenticatedUserId) return;

      const baseId = typeof data?.baseId === 'string' ? data.baseId : null;
      if (!baseId) {
        emitFailure(socket, 'Invalid base');
        return;
      }

      logger.log('[Plunder] Request from user', authenticatedUserId, 'for base', baseId);

      if (!playerHasRelic(statements, authenticatedUserId, 'SKULL_AND_BONES')) {
        emitFailure(socket, 'Missing Skull and Bones relic');
        return;
      }

      const player = connectedPlayers.get(socket.id);
      if (!player?.position ||
          player.id !== authenticatedUserId ||
          player.isDead ||
          deps.wormhole?.isInTransit?.(authenticatedUserId)) {
        emitFailure(socket, 'Player unavailable');
        return;
      }

      const base = npc.getActiveBase(baseId);
      if (!base || base.destroyed) {
        emitFailure(socket, 'Base not found');
        return;
      }

      const computedPos = world.getObjectPosition(baseId);
      const baseX = computedPos ? computedPos.x : base.x;
      const baseY = computedPos ? computedPos.y : base.y;
      const dx = baseX - player.position.x;
      const dy = baseY - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const plunderConfig = getPlunderConfig();
      const plunderRange = plunderConfig.plunderRange || 200;
      const baseSize = base.size || 100;
      const tolerance = config.ORBITAL_POSITION_TOLERANCE || 1.15;

      if (dist > (plunderRange + baseSize) * tolerance) {
        emitFailure(socket, 'Too far from base');
        return;
      }

      const now = Date.now();
      const playerCooldown = plunderConfig.cooldown || 15000;
      const playerCooldownRemaining = getPlayerPlunderCooldownRemaining(
        authenticatedUserId,
        now
      );
      if (playerCooldownRemaining > 0) {
        emitFailure(socket, 'Plunder systems recharging', {
          cooldownRemaining: playerCooldownRemaining,
          cooldownScope: 'player'
        });
        return;
      }

      const state = getBasePlunderState(baseId, base);
      const baseCooldown = plunderConfig.baseCooldown || 90000;
      const baseCooldownRemaining = getCooldownRemaining(state.lastPlunderAt, baseCooldown, now);
      if (baseCooldownRemaining > 0) {
        emitFailure(socket, 'Base security is on alert', {
          cooldownRemaining: baseCooldownRemaining,
          cooldownScope: 'base'
        });
        return;
      }

      const ship = statements.getShipByUserId.get(authenticatedUserId);
      if (!ship) {
        emitFailure(socket, 'Ship not found');
        return;
      }

      const cargoUsed = Number(
        statements.getTotalCargoCount.get(authenticatedUserId, authenticatedUserId)?.total
      ) || 0;
      const cargoTier = ship.cargo_tier || 1;
      const cargoMax = config.CARGO_CAPACITY[cargoTier] || config.CARGO_CAPACITY[1];
      const available = calculateAvailableRewards(base, state);

      if (available.credits <= 0 && available.resources.length === 0) {
        emitFailure(socket, 'Base reserves depleted');
        return;
      }

      const cargoAllocation = allocateCargoResources(
        available.resources,
        Math.max(0, cargoMax - cargoUsed)
      );
      if (available.credits <= 0 && cargoAllocation.granted.length === 0) {
        emitFailure(socket, 'Cargo hold full');
        return;
      }

      // Durable credits and every resource row commit as one SQLite unit. No
      // finite reserve, cooldown, aggro, or visual state changes before this.
      const committed = grantPlunderRewards(
        authenticatedUserId,
        available.credits,
        cargoAllocation.granted
      );
      const grantedResources = committed.resources;
      cargoAllocation.granted = grantedResources;

      consumeRewards(base, state, available, cargoAllocation);
      playerPlunderCooldowns.set(authenticatedUserId, now);
      state.lastPlunderAt = now;

      const aggroRange = plunderConfig.aggroRange || 600;
      const nearbyNPCs = npc.getNPCsInRange({ x: baseX, y: baseY }, aggroRange);
      for (const npcEntity of nearbyNPCs) {
        if (npcEntity.faction === base.faction) {
          npcEntity.targetPlayer = authenticatedUserId;
          npcEntity.state = 'combat';
        }
      }

      const lootItems = grantedResources.map(item => ({
        type: 'resource',
        resource: item.resource,
        quantity: item.quantity
      }));
      const depleted = isReserveDepleted(base, state);

      socket.emit('relic:plunderSuccess', {
        baseId,
        credits: committed.creditGrant,
        loot: lootItems,
        position: { x: baseX, y: baseY },
        cargoLimited: cargoAllocation.remaining.length > 0,
        baseDepleted: depleted,
        playerCooldown,
        baseCooldown
      });

      const inventory = statements.getInventory.all(authenticatedUserId);
      const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
      socket.emit('inventory:update', {
        inventory,
        credits: getSafeCredits(updatedShip)
      });

      // Sector-room scoped broadcast excludes the sender, who already received
      // plunderSuccess and renders the same visual locally.
      broadcastToNearby(socket, { position: { x: baseX, y: baseY } }, 'base:plundered', {
        baseId,
        position: { x: baseX, y: baseY }
      });

      logger.log('[Plunder] Complete - credits:', committed.creditGrant,
        'resource units:', cargoAllocation.usedCapacity,
        'depleted:', depleted);
    } catch (err) {
      logger.error('[HANDLER] relic:plunder error:', err);
      emitFailure(socket, 'Plunder failed');
    }
  });
}

module.exports = {
  register,
  // Exported for focused invariant tests and diagnostics.
  normalizeLoot,
  getBaseIdentity,
  getPlayerPlunderCooldownRemaining
};
