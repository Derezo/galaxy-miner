'use strict';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scaleCurrentDurability(current, previousMax, expectedMax) {
  const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : 0;
  const safePreviousMax = Number(previousMax);
  if (safeCurrent <= 0) return 0;
  if (!Number.isFinite(safePreviousMax) || safePreviousMax <= 0) {
    return Math.min(expectedMax, Math.round(safeCurrent));
  }

  const ratio = clamp(safeCurrent / safePreviousMax, 0, 1);
  return clamp(Math.round(expectedMax * ratio), 0, expectedMax);
}

/**
 * Reconcile persisted durability with the current shared tier formulas.
 * Existing damage is preserved proportionally when balance constants change;
 * a full legacy ship remains full and a destroyed ship remains destroyed.
 */
function reconcileShipDurability(ship, config) {
  const shieldTier = Math.max(1, Math.floor(Number(ship?.shield_tier) || 1));
  const hullTier = Math.max(1, Math.floor(Number(ship?.hull_tier) || 1));
  const expectedShieldMax = Math.round(
    config.DEFAULT_SHIELD_HP * Math.pow(config.SHIELD_TIER_MULTIPLIER || 2, shieldTier - 1)
  );
  const expectedHullMax = Math.round(
    config.DEFAULT_HULL_HP * Math.pow(config.TIER_MULTIPLIER || 1, hullTier - 1)
  );

  const changed = Number(ship?.shield_max) !== expectedShieldMax ||
    Number(ship?.hull_max) !== expectedHullMax;

  return {
    changed,
    shieldTier,
    hullTier,
    shieldMax: expectedShieldMax,
    hullMax: expectedHullMax,
    shieldHp: changed
      ? scaleCurrentDurability(ship?.shield_hp, ship?.shield_max, expectedShieldMax)
      : clamp(Number(ship?.shield_hp) || 0, 0, expectedShieldMax),
    hullHp: changed
      ? scaleCurrentDurability(ship?.hull_hp, ship?.hull_max, expectedHullMax)
      : clamp(Number(ship?.hull_hp) || 0, 0, expectedHullMax)
  };
}

module.exports = {
  reconcileShipDurability,
  scaleCurrentDurability
};
