import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const worldMock = {
  getObjectById: vi.fn(),
  getObjectPosition: vi.fn(),
  isObjectDepleted: vi.fn(() => false),
  depleteObject: vi.fn()
};
const statements = {
  getShipByUserId: { get: vi.fn() },
  getTotalCargoCount: { get: vi.fn() },
  hasRelic: { get: vi.fn() }
};
const moduleMocks = [
  ['../../../server/world.js', worldMock],
  ['../../../server/database.js', {
    statements,
    safeUpsertInventory: vi.fn()
  }],
  ['../../../server/game/relic-effects.js', {
    playerHasRelic: vi.fn(() => false),
    calculateMiningYield: vi.fn(quantity => quantity),
    getRelicEffect: vi.fn((_type, _effect, fallback) => fallback)
  }],
  ['../../../shared/logger.js', {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn()
  }]
];
const savedModules = new Map(
  moduleMocks.map(([modulePath]) => {
    const filename = require.resolve(modulePath);
    return [filename, require.cache[filename]];
  })
);
const miningPath = require.resolve('../../../server/game/mining.js');
let mining;

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports
  };
}

beforeAll(() => {
  for (const [modulePath, exports] of moduleMocks) {
    installCommonJsMock(modulePath, exports);
  }
  delete require.cache[miningPath];
  mining = require(miningPath);
});

afterAll(() => {
  delete require.cache[miningPath];
  for (const [filename, cached] of savedModules) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  worldMock.isObjectDepleted.mockReturnValue(false);
  worldMock.getObjectById.mockReturnValue({
    id: 'ss_0_0_0_planet_0',
    x: 10,
    y: 10,
    size: 20,
    resources: ['IRON']
  });
});

describe('mining position authority', () => {
  it('fails closed instead of falling back to a raw generated coordinate', () => {
    worldMock.getObjectPosition.mockReturnValue(null);

    expect(mining.startMining(1, { x: 10, y: 10 }, 'ss_0_0_0_planet_0'))
      .toEqual({
        success: false,
        error: 'Unable to resolve resource position'
      });
    expect(statements.getShipByUserId.get).not.toHaveBeenCalled();
  });

  it('rejects non-finite authoritative and client-supplied coordinates', () => {
    worldMock.getObjectPosition.mockReturnValue({ x: Number.NaN, y: 10 });
    expect(mining.startMining(1, { x: 10, y: 10 }, 'ss_0_0_0_planet_0'))
      .toMatchObject({ success: false, error: 'Unable to resolve resource position' });

    worldMock.getObjectPosition.mockReturnValue({ x: 10, y: 10 });
    expect(mining.startMining(
      1,
      { x: 10, y: 10 },
      'ss_0_0_0_planet_0',
      { x: Number.POSITIVE_INFINITY, y: 10 }
    )).toEqual({ success: false, error: 'Invalid resource position' });
    expect(statements.getShipByUserId.get).not.toHaveBeenCalled();
  });
});
