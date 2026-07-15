import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const LootPools = require('../../../server/game/loot-pools.js');

describe('faction loot resource pools', () => {
  it('keeps every resource in the pool matching its canonical rarity', () => {
    for (const [factionName, faction] of Object.entries(LootPools.FACTION_LOOT)) {
      for (const [poolRarity, resources] of Object.entries(faction.resources)) {
        for (const resourceType of resources) {
          expect(
            CONSTANTS.RESOURCE_TYPES[resourceType]?.rarity,
            `${factionName}.${poolRarity} contains ${resourceType}`
          ).toBe(poolRarity);
        }
      }
    }
  });

  it('keeps Void drops uncommon-or-better while retaining every rarity bucket', () => {
    const voidResources = LootPools.getFactionLoot('void').resources;

    expect(voidResources.common).toEqual([]);
    expect(voidResources.uncommon).toContain('NEON');
    expect(voidResources.rare).toEqual(expect.arrayContaining([
      'XENON',
      'DARK_MATTER',
      'QUANTUM_CRYSTALS'
    ]));
    expect(voidResources.ultrarare).toEqual(expect.arrayContaining([
      'EXOTIC_MATTER',
      'VOID_CRYSTALS'
    ]));
  });

  it('renormalizes rarity weights across nonempty faction buckets', () => {
    const weights = {
      common: { weight: 0.6 },
      uncommon: { weight: 0.3 },
      rare: { weight: 0.1 }
    };
    const resources = { common: [], uncommon: ['NEON'], rare: ['XENON'] };

    expect(LootPools.pickAvailableRarity(weights, resources, 0)).toBe('uncommon');
    expect(LootPools.pickAvailableRarity(weights, resources, 0.74)).toBe('uncommon');
    expect(LootPools.pickAvailableRarity(weights, resources, 0.75)).toBe('rare');
    expect(LootPools.pickAvailableRarity(weights, { common: [], uncommon: [], rare: [] }, 0)).toBeNull();
  });

  it('never loses a guaranteed Void slot to its empty common bucket', () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const loot = LootPools.generateLoot('void_whisper');
      expect(loot.some(item => item.type === 'resource')).toBe(true);
    } finally {
      Math.random = originalRandom;
    }
  });
});
