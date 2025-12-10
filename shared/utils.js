/**
 * Shared utility functions for Galaxy Miner
 * Used by both client and server to reduce code duplication
 */

// Import constants if available
// In browser, CONSTANTS is already a global from constants.js script tag
// In Node.js, we need to require it
let _utilsConstants;
if (typeof module !== 'undefined' && module.exports) {
  _utilsConstants = require('./constants');
} else if (typeof window !== 'undefined' && typeof CONSTANTS !== 'undefined') {
  _utilsConstants = CONSTANTS;
}

/**
 * Calculate tier multiplier for a given tier level
 * Replaces: Math.pow(TIER_MULTIPLIER, tier - 1)
 * @param {number} tier - Tier level (1-5)
 * @returns {number} Multiplier value
 */
function getTierMultiplier(tier) {
  const multiplier = _utilsConstants ? _utilsConstants.TIER_MULTIPLIER : 1.5;
  return Math.pow(multiplier, (tier || 1) - 1);
}

/**
 * Calculate distance between two points
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} Distance
 */
function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance between two points (faster, no sqrt)
 * Use for comparison when you don't need the actual distance
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} Squared distance
 */
function getDistanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Calculate mining time based on mining tier
 * @param {number} miningTier - Mining equipment tier (1-5)
 * @returns {number} Mining time in milliseconds
 */
function getMiningTime(miningTier) {
  const baseMiningTime = _utilsConstants ? _utilsConstants.BASE_MINING_TIME : 3000;
  return baseMiningTime / getTierMultiplier(miningTier);
}

/**
 * Calculate weapon damage based on tier and type
 * @param {number} weaponTier - Weapon tier (1-5)
 * @param {string} [weaponType] - Weapon type (kinetic, energy, explosive)
 * @returns {number} Base damage value
 */
function getWeaponDamage(weaponTier, weaponType) {
  const baseDamage = _utilsConstants ? _utilsConstants.BASE_WEAPON_DAMAGE : 10;
  return baseDamage * getTierMultiplier(weaponTier);
}

/**
 * Calculate weapon cooldown based on tier
 * @param {number} weaponTier - Weapon tier (1-5)
 * @returns {number} Cooldown in milliseconds
 */
function getWeaponCooldown(weaponTier) {
  const baseCooldown = _utilsConstants ? _utilsConstants.BASE_WEAPON_COOLDOWN : 500;
  // Higher tier = faster fire rate (lower cooldown)
  return baseCooldown / getTierMultiplier(weaponTier);
}

/**
 * Calculate shield recharge rate based on tier
 * @param {number} shieldTier - Shield tier (1-5)
 * @returns {number} Recharge rate per second
 */
function getShieldRechargeRate(shieldTier) {
  const baseRate = _utilsConstants ? _utilsConstants.SHIELD_RECHARGE_RATE : 5;
  return baseRate * getTierMultiplier(shieldTier);
}

/**
 * Calculate max speed based on engine tier
 * @param {number} engineTier - Engine tier (1-5)
 * @returns {number} Max speed
 */
function getMaxSpeed(engineTier) {
  const baseSpeed = _utilsConstants ? _utilsConstants.BASE_SPEED : 150;
  return baseSpeed * getTierMultiplier(engineTier);
}

/**
 * Calculate radar range based on radar tier
 * @param {number} radarTier - Radar tier (1-5)
 * @returns {number} Radar range in units
 */
function getRadarRange(radarTier) {
  if (_utilsConstants && _utilsConstants.RADAR_TIERS && _utilsConstants.RADAR_TIERS[radarTier]) {
    return _utilsConstants.RADAR_TIERS[radarTier].range;
  }
  // Fallback calculation
  const baseRange = 500;
  return baseRange * getTierMultiplier(radarTier);
}

/**
 * Calculate cargo capacity based on cargo tier
 * @param {number} cargoTier - Cargo tier (1-5)
 * @returns {number} Cargo capacity
 */
function getCargoCapacity(cargoTier) {
  if (_utilsConstants && _utilsConstants.CARGO_CAPACITY && _utilsConstants.CARGO_CAPACITY[cargoTier]) {
    return _utilsConstants.CARGO_CAPACITY[cargoTier];
  }
  // Fallback calculation
  const baseCapacity = 50;
  return Math.floor(baseCapacity * getTierMultiplier(cargoTier));
}

/**
 * Check if a point is within range of another point
 * Uses squared distance for performance
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @param {number} range - Maximum range
 * @returns {boolean} True if within range
 */
function isWithinRange(x1, y1, x2, y2, range) {
  return getDistanceSquared(x1, y1, x2, y2) <= range * range;
}

// Universal export pattern
const utils = {
  getTierMultiplier,
  getDistance,
  getDistanceSquared,
  getMiningTime,
  getWeaponDamage,
  getWeaponCooldown,
  getShieldRechargeRate,
  getMaxSpeed,
  getRadarRange,
  getCargoCapacity,
  isWithinRange
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = utils;
} else if (typeof window !== 'undefined') {
  window.Utils = utils;
}
