import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const LootPools = require('../../../server/game/loot-pools.js');

describe('Void faction production loot', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses canonical pools and NPC mappings', () => {
    const faction = LootPools.getFactionLoot('void');
    expect(faction.resources.common).toEqual([]);
    expect(faction.resources.rare).toContain('DARK_MATTER');
    expect(faction.resources.ultrarare).toContain('VOID_CRYSTALS');
    expect(faction.relics).toEqual(expect.arrayContaining([
      'VOID_CRYSTAL',
      'WORMHOLE_GEM',
      'ANCIENT_STAR_MAP',
      'SUBSPACE_WARP_DRIVE'
    ]));
    expect(LootPools.getMappingForNpc('void_whisper')).toEqual({ faction: 'void', tier: 'low' });
    expect(LootPools.getMappingForNpc('void_leviathan')).toEqual({ faction: 'void', tier: 'boss' });
  });

  it('generates an actual non-common resource even when every roll is zero', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const resources = LootPools.generateLoot('void_whisper')
      .filter(item => item.type === 'resource');

    expect(resources.length).toBeGreaterThan(0);
    expect(resources.every(item => item.rarity !== 'common')).toBe(true);
  });

  it('runs the Leviathan-specific Subspace drop through production generation', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const loot = LootPools.generateLoot('void_leviathan');
    expect(loot).toContainEqual({ type: 'relic', relicType: 'SUBSPACE_WARP_DRIVE' });
  });
});

describe('Subspace Warp Drive shared effect contract', () => {
  const effects = CONSTANTS.RELIC_TYPES.SUBSPACE_WARP_DRIVE.effects;

  it('names boost duration and wormhole transit speed independently', () => {
    expect(effects.boostDurationMultiplier).toBe(2.5);
    expect(effects.boostCooldownMultiplier).toBe(0.75);
    expect(effects.wormholeTransitSpeedMultiplier).toBe(2.5);
    expect(effects.wormholeCooldownMultiplier).toBe(0.75);
    expect(5000 / effects.wormholeTransitSpeedMultiplier).toBe(2000);
    expect(60000 * effects.wormholeCooldownMultiplier).toBe(45000);
  });
});
