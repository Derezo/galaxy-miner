'use strict';

/**
 * Pure, data-driven relic effect calculations.
 *
 * Ownership remains server-authoritative: callers pass the database statement
 * collection to playerHasRelic(), then feed the result into the pure helpers.
 * Keeping the arithmetic here prevents combat, mining, and loot handlers from
 * drifting away from the values exposed to the client in shared/constants.js.
 */

const CONSTANTS = require('../../shared/constants');
const ownershipCaches = new WeakMap();
const OWNERSHIP_CACHE_MS = 5000;

function getRelicDefinition(relicType) {
  if (typeof relicType !== 'string') return null;
  return CONSTANTS.RELIC_TYPES?.[relicType.toUpperCase()] || null;
}

function getRelicEffect(relicType, effectName, fallback) {
  const value = getRelicDefinition(relicType)?.effects?.[effectName];
  return value === undefined ? fallback : value;
}

function playerHasRelic(statementSet, playerId, relicType) {
  if (!statementSet?.hasRelic || !playerId || typeof relicType !== 'string') {
    return false;
  }

  const normalizedType = relicType.toUpperCase();
  const cacheKey = `${playerId}:${normalizedType}`;
  let cache = ownershipCaches.get(statementSet);
  if (!cache) {
    cache = new Map();
    ownershipCaches.set(statementSet, cache);
  }

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.owned;

  try {
    const owned = !!statementSet.hasRelic.get(playerId, normalizedType);
    cache.set(cacheKey, { owned, expiresAt: now + OWNERSHIP_CACHE_MS });
    return owned;
  } catch (_error) {
    // A failed ownership lookup must never grant a relic effect.
    return false;
  }
}

function invalidatePlayerRelicCache(statementSet, playerId, relicType = null) {
  const cache = statementSet ? ownershipCaches.get(statementSet) : null;
  if (!cache) return;

  if (typeof relicType === 'string') {
    cache.delete(`${playerId}:${relicType.toUpperCase()}`);
    return;
  }

  const prefix = `${playerId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function calculateFactionDamage(baseDamage, targetFaction, hasVoidCrystal) {
  const damage = Number(baseDamage);
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  if (!hasVoidCrystal || typeof targetFaction !== 'string') return damage;

  const targetFactions = getRelicEffect('VOID_CRYSTAL', 'targetFactions', []);
  const normalizedFaction = targetFaction.toLowerCase();
  if (!targetFactions.some(faction => String(faction).toLowerCase() === normalizedFaction)) {
    return damage;
  }

  const bonus = Number(getRelicEffect('VOID_CRYSTAL', 'factionDamageBonus', 0));
  return Number.isFinite(bonus) && bonus > 0 ? damage * (1 + bonus) : damage;
}

function calculateNpcCreditShare(baseShare, hasPirateTreasure) {
  const credits = Number(baseShare);
  if (!Number.isFinite(credits) || credits <= 0) return 0;

  const bonus = hasPirateTreasure
    ? Number(getRelicEffect('PIRATE_TREASURE', 'npcWreckageCreditBonus', 0))
    : 0;
  const multiplier = Number.isFinite(bonus) && bonus > 0 ? 1 + bonus : 1;
  return Math.round(credits * multiplier);
}

function calculateMiningYield(baseQuantity, hasMiningRites) {
  const quantity = Number(baseQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;

  const configuredMultiplier = hasMiningRites
    ? Number(getRelicEffect('MINING_RITES', 'miningYieldMultiplier', 1))
    : 1;
  const multiplier = Number.isFinite(configuredMultiplier) && configuredMultiplier >= 1
    ? configuredMultiplier
    : 1;

  // Inventory quantities are integers. Floor once after applying the effect so
  // fractional future multipliers cannot create fractional cargo or NaN values.
  return Math.max(1, Math.floor(quantity * multiplier));
}

/**
 * Split resource rewards into cargo-safe granted and unclaimed portions.
 * The input is not mutated, and total integer quantity is conserved.
 */
function allocateCargoResources(resources, availableCapacity) {
  let capacity = Math.max(0, Math.floor(Number(availableCapacity) || 0));
  let usedCapacity = 0;
  const granted = [];
  const remaining = [];

  for (const item of Array.isArray(resources) ? resources : []) {
    const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
    if (quantity <= 0) continue;

    const grantedQuantity = Math.min(quantity, capacity);
    const remainingQuantity = quantity - grantedQuantity;

    if (grantedQuantity > 0) {
      granted.push({ ...item, quantity: grantedQuantity });
      capacity -= grantedQuantity;
      usedCapacity += grantedQuantity;
    }
    if (remainingQuantity > 0) {
      remaining.push({ ...item, quantity: remainingQuantity });
    }
  }

  return { granted, remaining, usedCapacity, availableCapacity: capacity };
}

function getCooldownRemaining(lastUsedAt, cooldownMs, now = Date.now()) {
  const lastUse = Number(lastUsedAt) || 0;
  const cooldown = Math.max(0, Number(cooldownMs) || 0);
  const currentTime = Number(now) || 0;
  return Math.max(0, Math.ceil(lastUse + cooldown - currentTime));
}

function classifyRelicInsert(relicType, insertResult) {
  const normalizedType = typeof relicType === 'string' ? relicType.toUpperCase() : null;
  const acquired = !!normalizedType && Number(insertResult?.changes) > 0;
  return {
    acquired,
    result: normalizedType ? { type: normalizedType } : null
  };
}

module.exports = {
  getRelicDefinition,
  getRelicEffect,
  playerHasRelic,
  invalidatePlayerRelicCache,
  calculateFactionDamage,
  calculateNpcCreditShare,
  calculateMiningYield,
  allocateCargoResources,
  getCooldownRemaining,
  classifyRelicInsert
};
