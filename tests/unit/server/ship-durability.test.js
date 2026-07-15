import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const {
  reconcileShipDurability,
  scaleCurrentDurability
} = require('../../../server/game/ship-durability.js');

describe('ship durability balance reconciliation', () => {
  it('upgrades a full legacy starter ship to the shared defaults', () => {
    const result = reconcileShipDurability({
      hull_tier: 1,
      shield_tier: 1,
      hull_hp: 100,
      hull_max: 100,
      shield_hp: 50,
      shield_max: 50
    }, CONSTANTS);

    expect(result).toMatchObject({
      changed: true,
      hullHp: CONSTANTS.DEFAULT_HULL_HP,
      hullMax: CONSTANTS.DEFAULT_HULL_HP,
      shieldHp: CONSTANTS.DEFAULT_SHIELD_HP,
      shieldMax: CONSTANTS.DEFAULT_SHIELD_HP
    });
  });

  it('preserves damage ratios and never revives a destroyed ship', () => {
    expect(scaleCurrentDurability(50, 100, 120)).toBe(60);
    expect(scaleCurrentDurability(0, 100, 120)).toBe(0);

    const result = reconcileShipDurability({
      hull_tier: 2,
      shield_tier: 2,
      hull_hp: 0,
      hull_max: 140,
      shield_hp: 60,
      shield_max: 100
    }, CONSTANTS);

    expect(result.hullHp).toBe(0);
    expect(result.hullMax).toBe(Math.round(
      CONSTANTS.DEFAULT_HULL_HP * CONSTANTS.TIER_MULTIPLIER
    ));
    expect(result.shieldHp).toBe(72);
    expect(result.shieldMax).toBe(120);
  });

  it('keeps already-correct values unchanged and clamps corrupt overflow', () => {
    const result = reconcileShipDurability({
      hull_tier: 1,
      shield_tier: 1,
      hull_hp: 999,
      hull_max: CONSTANTS.DEFAULT_HULL_HP,
      shield_hp: 999,
      shield_max: CONSTANTS.DEFAULT_SHIELD_HP
    }, CONSTANTS);

    expect(result.changed).toBe(false);
    expect(result.hullHp).toBe(CONSTANTS.DEFAULT_HULL_HP);
    expect(result.shieldHp).toBe(CONSTANTS.DEFAULT_SHIELD_HP);
  });
});
