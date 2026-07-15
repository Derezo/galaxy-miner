import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getNpcCandidateRange,
  getNpcDeliveryRange,
  isNpcTargetingPlayer
} = require('../../../server/game/npc-visibility');

describe('NPC combat visibility', () => {
  const dreadnought = {
    targetPlayer: 42,
    weaponRange: 1400,
    aggroRange: 1500
  };

  it('extends delivery through the authorized weapon tolerance for the target', () => {
    expect(isNpcTargetingPlayer(dreadnought, { id: 42 })).toBe(true);
    expect(getNpcDeliveryRange(dreadnought, { id: 42 }, 1000)).toBeCloseTo(1540);
    expect(getNpcCandidateRange(dreadnought, 1000)).toBeCloseTo(1540);
  });

  it('does not reveal long-range combat state to unrelated low-tier players', () => {
    expect(isNpcTargetingPlayer(dreadnought, { id: 7 })).toBe(false);
    expect(getNpcDeliveryRange(dreadnought, { id: 7 }, 1000)).toBe(1000);
  });

  it('keeps only the retained target visible through a strategy chase range', () => {
    expect(getNpcDeliveryRange(dreadnought, { id: 42 }, 1000, 3000)).toBe(3000);
    expect(getNpcDeliveryRange(dreadnought, { id: 7 }, 1000, 3000)).toBe(1000);
    expect(getNpcCandidateRange(dreadnought, 1000, 3000)).toBe(3000);
  });

  it('normalizes numeric and serialized player identifiers safely', () => {
    expect(isNpcTargetingPlayer({ targetPlayer: '42' }, { id: 42 })).toBe(true);
    expect(getNpcDeliveryRange({ targetPlayer: null }, { id: 42 }, 1000)).toBe(1000);
  });
});
