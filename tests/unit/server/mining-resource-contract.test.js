import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const object = {
  id: '0_0_asteroid_multi',
  x: 10,
  y: 0,
  size: 10,
  resources: ['IRON', 'TITANIUM']
};
const world = {
  getObjectById: vi.fn(() => object),
  getObjectPosition: vi.fn(() => ({ x: 10, y: 0 })),
  isObjectDepleted: vi.fn(() => false),
  depleteObject: vi.fn()
};
const statements = {
  getShipByUserId: { get: vi.fn(() => ({ mining_tier: 3, cargo_tier: 1 })) },
  getTotalCargoCount: { get: vi.fn(() => ({ total: 0 })) },
  getInventory: { all: vi.fn(() => [{ resource_type: 'TITANIUM', quantity: 6 }]) },
  hasRelic: { get: vi.fn(() => ({ relic_type: 'MINING_RITES' })) }
};
const completeMiningYield = vi.fn(() => ({
  success: true,
  quantity: 6,
  inventory: [{ resource_type: 'TITANIUM', quantity: 6 }]
}));
const mocks = [
  ['../../../server/world.js', world],
  ['../../../server/database.js', { statements, completeMiningYield }],
  ['../../../shared/logger.js', {
    log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn()
  }]
];
const saved = new Map(mocks.map(([path]) => [require.resolve(path), require.cache[require.resolve(path)]]));
const miningPath = require.resolve('../../../server/game/mining.js');
let mining;

beforeAll(() => {
  for (const [path, exports] of mocks) {
    const filename = require.resolve(path);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  delete require.cache[miningPath];
  mining = require(miningPath);
});

afterAll(() => {
  mining.cancelMining(7);
  delete require.cache[miningPath];
  for (const [filename, cached] of saved) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
  vi.restoreAllMocks();
});

describe('authoritative mining resource contract', () => {
  it('selects one seam at start and awards that same resource with configured tier/relic yield', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    const started = mining.startMining(7, { x: 0, y: 0 }, object.id);
    expect(started.target.resourceType).toBe('TITANIUM');

    const completed = mining.completeMining(7);
    expect(completed).toMatchObject({
      success: true,
      resourceType: 'TITANIUM',
      quantity: 6,
      objectId: object.id
    });
    expect(completeMiningYield).toHaveBeenCalledWith(
      7,
      'TITANIUM',
      6,
      expect.any(Number),
      object.id,
      expect.any(String)
    );
    expect(world.depleteObject).not.toHaveBeenCalled();
    expect(Math.random).toHaveBeenCalledTimes(2);
  });
});
