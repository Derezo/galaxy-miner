import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants');
const {
  getRelicEffect,
  playerHasRelic,
  invalidatePlayerRelicCache,
  calculateFactionDamage,
  calculateNpcCreditShare,
  calculateMiningYield,
  allocateCargoResources,
  getCooldownRemaining,
  classifyRelicInsert
} = require('../../../server/game/relic-effects');

describe('data-driven relic effects', () => {
  it('applies Void Crystal damage only to configured factions', () => {
    expect(getRelicEffect('VOID_CRYSTAL', 'factionDamageBonus', 0)).toBe(0.10);
    expect(calculateFactionDamage(100, 'void', true)).toBeCloseTo(110);
    expect(calculateFactionDamage(100, 'SWARM', true)).toBeCloseTo(110);
    expect(calculateFactionDamage(100, 'pirate', true)).toBe(100);
    expect(calculateFactionDamage(100, 'void', false)).toBe(100);
  });

  it('rejects invalid damage rather than propagating NaN or negatives', () => {
    expect(calculateFactionDamage(Number.NaN, 'void', true)).toBe(0);
    expect(calculateFactionDamage(-10, 'void', true)).toBe(0);
  });

  it("applies Pirate Treasure to the owner's rounded share only", () => {
    expect(calculateNpcCreditShare(100, true)).toBe(110);
    expect(calculateNpcCreditShare(101, true)).toBe(111);
    expect(calculateNpcCreditShare(101, false)).toBe(101);
  });

  it('uses the configured integer-safe Mining Rites multiplier', () => {
    expect(CONSTANTS.RELIC_TYPES.MINING_RITES.effects.miningYieldMultiplier).toBe(2);
    expect(calculateMiningYield(3, true)).toBe(6);
    expect(calculateMiningYield(3, false)).toBe(3);
    expect(Number.isInteger(calculateMiningYield(1.5, true))).toBe(true);
  });

  it('caches ownership checks and supports immediate invalidation after acquisition', () => {
    let owned = false;
    let queries = 0;
    const mockStatements = {
      hasRelic: {
        get() {
          queries += 1;
          return owned ? { owned: 1 } : undefined;
        }
      }
    };

    expect(playerHasRelic(mockStatements, 42, 'VOID_CRYSTAL')).toBe(false);
    owned = true;
    expect(playerHasRelic(mockStatements, 42, 'VOID_CRYSTAL')).toBe(false);
    expect(queries).toBe(1);

    invalidatePlayerRelicCache(mockStatements, 42, 'VOID_CRYSTAL');
    expect(playerHasRelic(mockStatements, 42, 'VOID_CRYSTAL')).toBe(true);
    expect(queries).toBe(2);
  });

  it('classifies ignored duplicate inserts without a false acquisition', () => {
    expect(classifyRelicInsert('void_crystal', { changes: 1 })).toEqual({
      acquired: true,
      result: { type: 'VOID_CRYSTAL' }
    });
    expect(classifyRelicInsert('void_crystal', { changes: 0 })).toEqual({
      acquired: false,
      result: { type: 'VOID_CRYSTAL' }
    });
  });
});

describe('plunder economy invariants', () => {
  it('never grants more resources than available cargo and conserves quantity', () => {
    const input = [
      { resource: 'IRON', quantity: 7 },
      { resource: 'COPPER', quantity: 5 }
    ];
    const snapshot = structuredClone(input);
    const allocation = allocateCargoResources(input, 9);

    expect(allocation.granted).toEqual([
      { resource: 'IRON', quantity: 7 },
      { resource: 'COPPER', quantity: 2 }
    ]);
    expect(allocation.remaining).toEqual([{ resource: 'COPPER', quantity: 3 }]);
    expect(allocation.usedCapacity).toBe(9);
    expect(input).toEqual(snapshot);

    const total = [...allocation.granted, ...allocation.remaining]
      .reduce((sum, item) => sum + item.quantity, 0);
    expect(total).toBe(12);
  });

  it('preserves the full reserve when cargo capacity is zero', () => {
    const allocation = allocateCargoResources([{ resource: 'IRON', quantity: 4 }], 0);
    expect(allocation.granted).toEqual([]);
    expect(allocation.remaining).toEqual([{ resource: 'IRON', quantity: 4 }]);
    expect(allocation.usedCapacity).toBe(0);
  });

  it('calculates authoritative cooldown boundaries without negative time', () => {
    expect(getCooldownRemaining(1000, 15000, 5000)).toBe(11000);
    expect(getCooldownRemaining(1000, 15000, 16000)).toBe(0);
    expect(getCooldownRemaining(1000, 15000, 20000)).toBe(0);
  });

  it('configures a finite base cache and a longer per-base alert', () => {
    const plunder = CONSTANTS.RELIC_TYPES.SKULL_AND_BONES;
    expect(plunder.reserveLootRolls).toBe(1);
    expect(plunder.baseCooldown).toBeGreaterThan(plunder.cooldown);
    expect(Object.values(plunder.baseCreditReserve).every(Number.isFinite)).toBe(true);
  });
});

describe('resource economy alignment', () => {
  it('gives Nitrogen concrete energy-core upgrade sinks', () => {
    expect(CONSTANTS.UPGRADE_REQUIREMENTS.energy_core[3].resources.NITROGEN).toBe(8);
    expect(CONSTANTS.UPGRADE_REQUIREMENTS.energy_core[4].resources.NITROGEN).toBe(18);
  });

  it('gives every resource at least one upgrade sink', () => {
    const usedResources = new Set();
    for (const tiers of Object.values(CONSTANTS.UPGRADE_REQUIREMENTS)) {
      for (const requirement of Object.values(tiers)) {
        Object.keys(requirement.resources).forEach(resource => usedResources.add(resource));
      }
    }

    expect(Object.keys(CONSTANTS.RESOURCE_TYPES).filter(resource => !usedResources.has(resource))).toEqual([]);
  });
});
