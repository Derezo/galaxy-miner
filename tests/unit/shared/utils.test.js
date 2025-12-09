/**
 * Unit tests for shared/utils.js
 * Tests utility functions used by both client and server
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load actual CONSTANTS to test real behavior
const CONSTANTS = require('../../../shared/constants');
globalThis.CONSTANTS = CONSTANTS;

// Now require utils - it will use the real CONSTANTS
const utils = require('../../../shared/utils');

describe('shared/utils', () => {
  describe('getTierMultiplier', () => {
    it('should return 1 for tier 1', () => {
      expect(utils.getTierMultiplier(1)).toBe(1);
    });

    it('should return TIER_MULTIPLIER for tier 2', () => {
      expect(utils.getTierMultiplier(2)).toBe(1.5);
    });

    it('should return TIER_MULTIPLIER^2 for tier 3', () => {
      expect(utils.getTierMultiplier(3)).toBe(2.25);
    });

    it('should return TIER_MULTIPLIER^4 for tier 5', () => {
      expect(utils.getTierMultiplier(5)).toBeCloseTo(5.0625);
    });

    it('should handle undefined tier as 1', () => {
      expect(utils.getTierMultiplier(undefined)).toBe(1);
    });

    it('should handle null tier as 1', () => {
      expect(utils.getTierMultiplier(null)).toBe(1);
    });
  });

  describe('getDistance', () => {
    it('should return 0 for same point', () => {
      expect(utils.getDistance(0, 0, 0, 0)).toBe(0);
    });

    it('should calculate horizontal distance correctly', () => {
      expect(utils.getDistance(0, 0, 3, 0)).toBe(3);
    });

    it('should calculate vertical distance correctly', () => {
      expect(utils.getDistance(0, 0, 0, 4)).toBe(4);
    });

    it('should calculate diagonal distance (3-4-5 triangle)', () => {
      expect(utils.getDistance(0, 0, 3, 4)).toBe(5);
    });

    it('should work with negative coordinates', () => {
      expect(utils.getDistance(-3, -4, 0, 0)).toBe(5);
    });

    it('should work with floating point numbers', () => {
      expect(utils.getDistance(0, 0, 1.5, 2)).toBeCloseTo(2.5);
    });
  });

  describe('getDistanceSquared', () => {
    it('should return 0 for same point', () => {
      expect(utils.getDistanceSquared(0, 0, 0, 0)).toBe(0);
    });

    it('should return squared distance (3-4-5 triangle)', () => {
      expect(utils.getDistanceSquared(0, 0, 3, 4)).toBe(25);
    });

    it('should be faster than getDistance for comparisons', () => {
      // This test verifies the function works correctly
      // The performance benefit is that it avoids Math.sqrt
      const dist = utils.getDistance(0, 0, 3, 4);
      const distSq = utils.getDistanceSquared(0, 0, 3, 4);
      expect(distSq).toBe(dist * dist);
    });
  });

  describe('getMiningTime', () => {
    it('should return base mining time for tier 1', () => {
      expect(utils.getMiningTime(1)).toBe(3000);
    });

    it('should return reduced time for higher tiers', () => {
      expect(utils.getMiningTime(2)).toBe(2000);
    });

    it('should return significantly reduced time for tier 5', () => {
      expect(utils.getMiningTime(5)).toBeCloseTo(592.59, 1);
    });
  });

  describe('getWeaponDamage', () => {
    it('should return base damage for tier 1', () => {
      expect(utils.getWeaponDamage(1)).toBe(10);
    });

    it('should scale damage with tier', () => {
      expect(utils.getWeaponDamage(2)).toBe(15);
    });

    it('should return high damage for tier 5', () => {
      expect(utils.getWeaponDamage(5)).toBeCloseTo(50.625);
    });
  });

  describe('getWeaponCooldown', () => {
    it('should return base cooldown for tier 1', () => {
      expect(utils.getWeaponCooldown(1)).toBe(500);
    });

    it('should decrease cooldown with higher tiers', () => {
      expect(utils.getWeaponCooldown(2)).toBeCloseTo(333.33, 1);
    });

    it('should have low cooldown for tier 5', () => {
      expect(utils.getWeaponCooldown(5)).toBeCloseTo(98.77, 1);
    });
  });

  describe('getShieldRechargeRate', () => {
    it('should return base rate for tier 1', () => {
      // SHIELD_RECHARGE_RATE is 2 in constants
      expect(utils.getShieldRechargeRate(1)).toBe(CONSTANTS.SHIELD_RECHARGE_RATE);
    });

    it('should increase rate with tier', () => {
      const expected = CONSTANTS.SHIELD_RECHARGE_RATE * utils.getTierMultiplier(2);
      expect(utils.getShieldRechargeRate(2)).toBe(expected);
    });

    it('should have high rate for tier 5', () => {
      const expected = CONSTANTS.SHIELD_RECHARGE_RATE * utils.getTierMultiplier(5);
      expect(utils.getShieldRechargeRate(5)).toBeCloseTo(expected);
    });
  });

  describe('getMaxSpeed', () => {
    it('should return base speed for tier 1', () => {
      expect(utils.getMaxSpeed(1)).toBe(150);
    });

    it('should increase speed with tier', () => {
      expect(utils.getMaxSpeed(2)).toBe(225);
    });

    it('should have high speed for tier 5', () => {
      expect(utils.getMaxSpeed(5)).toBeCloseTo(759.375);
    });
  });

  describe('getRadarRange', () => {
    it('should return tier 1 range from CONSTANTS', () => {
      expect(utils.getRadarRange(1)).toBe(500);
    });

    it('should return tier 3 range from CONSTANTS', () => {
      expect(utils.getRadarRange(3)).toBe(1125);
    });

    it('should return tier 5 range from CONSTANTS', () => {
      expect(utils.getRadarRange(5)).toBe(2531);
    });
  });

  describe('getCargoCapacity', () => {
    it('should return tier 1 capacity from CONSTANTS', () => {
      // CARGO_CAPACITY is array [0, 100, 250, 500, 750, 2000]
      expect(utils.getCargoCapacity(1)).toBe(CONSTANTS.CARGO_CAPACITY[1]);
    });

    it('should return tier 3 capacity from CONSTANTS', () => {
      expect(utils.getCargoCapacity(3)).toBe(CONSTANTS.CARGO_CAPACITY[3]);
    });

    it('should return tier 5 capacity from CONSTANTS', () => {
      expect(utils.getCargoCapacity(5)).toBe(CONSTANTS.CARGO_CAPACITY[5]);
    });
  });

  describe('isWithinRange', () => {
    it('should return true for same point', () => {
      expect(utils.isWithinRange(0, 0, 0, 0, 10)).toBe(true);
    });

    it('should return true when exactly at range', () => {
      expect(utils.isWithinRange(0, 0, 3, 4, 5)).toBe(true);
    });

    it('should return true when within range', () => {
      expect(utils.isWithinRange(0, 0, 3, 4, 10)).toBe(true);
    });

    it('should return false when outside range', () => {
      expect(utils.isWithinRange(0, 0, 3, 4, 4)).toBe(false);
    });

    it('should work with floating point values', () => {
      expect(utils.isWithinRange(0, 0, 1, 1, 2)).toBe(true);
      expect(utils.isWithinRange(0, 0, 1.5, 1.5, 2)).toBe(false);
    });
  });
});
