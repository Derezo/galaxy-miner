import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ResourceSelection = require('../../../shared/resource-selection');
const CONSTANTS = require('../../../shared/constants');
const StarSystem = require('../../../shared/star-system');

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe('shared/resource-selection', () => {
  it('derives every rarity pool from RESOURCE_TYPES', () => {
    const pools = ResourceSelection.buildRarityPools(CONSTANTS.RESOURCE_TYPES);
    const pooledResources = Object.values(pools).flat();

    expect(pooledResources).toHaveLength(Object.keys(CONSTANTS.RESOURCE_TYPES).length);
    expect(new Set(pooledResources).size).toBe(pooledResources.length);

    for (const [rarity, resources] of Object.entries(pools)) {
      for (const resource of resources) {
        expect(CONSTANTS.RESOURCE_TYPES[resource].rarity).toBe(rarity);
      }
    }
  });

  it('uses one RNG draw to select both rarity and resource', () => {
    let calls = 0;
    const rng = () => {
      calls++;
      return 0.42;
    };

    expect(ResourceSelection.selectResources(CONSTANTS.RESOURCE_TYPES, rng, 4)).toHaveLength(4);
    expect(calls).toBe(4);
  });

  it('keeps StarSystem planet generation on one draw per resource slot', () => {
    const draws = [0.7, 0.1, 0.7, 0.99];
    let calls = 0;

    const resources = StarSystem.getPlanetResources(() => draws[calls++]);

    expect(resources).toEqual(['CARBON', 'TITANIUM', 'NEUTRONIUM']);
    expect(calls).toBe(4); // one count draw plus one draw for each of three slots
  });

  it('maps the documented rarity bands at fixed boundaries', () => {
    const resourceTypes = {
      COMMON_A: { rarity: 'common' },
      COMMON_B: { rarity: 'common' },
      UNCOMMON: { rarity: 'uncommon' },
      RARE: { rarity: 'rare' },
      ULTRARARE: { rarity: 'ultrarare' }
    };

    expect(ResourceSelection.selectResource(resourceTypes, () => 0)).toBe('COMMON_A');
    expect(ResourceSelection.selectResource(resourceTypes, () => 0.649999)).toBe('COMMON_B');
    expect(ResourceSelection.selectResource(resourceTypes, () => 0.650001)).toBe('UNCOMMON');
    expect(ResourceSelection.selectResource(resourceTypes, () => 0.880001)).toBe('RARE');
    expect(ResourceSelection.selectResource(resourceTypes, () => 0.970001)).toBe('ULTRARARE');
  });

  it('has a stable fixed-seed distribution with ultrarare below rare and common', () => {
    const rng = seededRandom(0xC0FFEE);
    const counts = { common: 0, uncommon: 0, rare: 0, ultrarare: 0 };

    for (let index = 0; index < 10000; index++) {
      const resource = ResourceSelection.selectResource(CONSTANTS.RESOURCE_TYPES, rng);
      counts[CONSTANTS.RESOURCE_TYPES[resource].rarity]++;
    }

    expect(counts).toEqual({ common: 6530, uncommon: 2283, rare: 882, ultrarare: 305 });
  });

  it('renormalizes around empty pools and handles empty definitions', () => {
    const sparseTypes = {
      RARE: { rarity: 'rare' },
      ULTRARARE: { rarity: 'ultrarare' }
    };

    expect(ResourceSelection.selectResource(sparseTypes, () => 0.749)).toBe('RARE');
    expect(ResourceSelection.selectResource(sparseTypes, () => 0.751)).toBe('ULTRARARE');
    expect(ResourceSelection.selectResource({}, () => {
      throw new Error('empty selections must not consume RNG');
    })).toBeNull();
    expect(ResourceSelection.selectResources(null, () => 0.5, 3)).toEqual([]);
  });

  it('falls back gracefully for legacy definitions without rarity metadata', () => {
    const legacyTypes = { FIRST: {}, SECOND: {} };

    expect(ResourceSelection.selectResource(legacyTypes, () => 0.1)).toBe('FIRST');
    expect(ResourceSelection.selectResource(legacyTypes, () => 0.9)).toBe('SECOND');
  });

  it('exposes the same API as a browser global', () => {
    const source = fs.readFileSync(
      new URL('../../../shared/resource-selection.js', import.meta.url),
      'utf8'
    );
    const context = vm.createContext({ window: {} });

    vm.runInContext(source, context, { filename: 'resource-selection.js' });

    expect(typeof context.window.ResourceSelection.selectResource).toBe('function');
    expect(context.window.ResourceSelection.RARITY_WEIGHTS.ultrarare).toBe(0.03);
  });

  it('keeps the client legacy world fallback on the shared selector', () => {
    const worldSource = fs.readFileSync(
      new URL('../../../client/js/world.js', import.meta.url),
      'utf8'
    );

    expect(worldSource).toContain(
      'ResourceSelection.selectResources(CONSTANTS.RESOURCE_TYPES, rng, count)'
    );
    const planetSelector = worldSource.match(
      /getPlanetResources\(rng\) \{[\s\S]*?\n  \},\n\n  getAsteroidResources/
    )?.[0];
    expect(planetSelector).toBeDefined();
    expect(planetSelector).not.toContain('types[Math.floor(rng() * types.length)]');
  });
});
