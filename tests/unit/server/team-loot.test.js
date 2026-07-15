import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports
  };
}

const statements = {
  getInventory: { all: vi.fn(() => []) },
  getShipByUserId: { get: vi.fn(() => ({ credits: 0, cargo_tier: 1 })) },
  getTotalCargoCount: { get: vi.fn(() => ({ total: 0 })) }
};
const safeUpsertInventory = vi.fn(() => ({ changes: 1 }));
const safeUpdateCredits = vi.fn(() => ({ changes: 1 }));

installCommonJsMock('../../../server/database.js', {
  statements,
  safeUpsertInventory,
  safeUpdateCredits,
  getSafeCredits: vi.fn(ship => ship?.credits || 0)
});
installCommonJsMock('../../../server/game/relic-effects.js', {
  playerHasRelic: vi.fn(() => false),
  invalidatePlayerRelicCache: vi.fn(),
  calculateNpcCreditShare: vi.fn(credits => credits),
  classifyRelicInsert: vi.fn()
});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const helpersPath = require.resolve('../../../server/socket/helpers.js');
delete require.cache[helpersPath];
const helpers = require(helpersPath);

function resource(quantity, rarity = 'common') {
  return { type: 'resource', resourceType: 'IRON', quantity, rarity };
}

describe('team loot resource conservation', () => {
  const io = { to: vi.fn(() => ({ emit: vi.fn() })) };

  beforeEach(() => {
    vi.clearAllMocks();
    helpers.userSockets.clear();
    statements.getInventory.all.mockReturnValue([]);
    statements.getShipByUserId.get.mockReturnValue({ credits: 0, cargo_tier: 1 });
    statements.getTotalCargoCount.get.mockReturnValue({ total: 0 });
    safeUpsertInventory.mockReturnValue({ changes: 1 });
    safeUpdateCredits.mockReturnValue({ changes: 1 });
  });

  it('normalizes object-key contributor IDs before safe inventory writes', () => {
    const result = helpers.distributeTeamResources(
      io,
      [resource(5)],
      { 10: 100, 20: 50 },
      10
    );

    expect(result.collectorLoot).toEqual([resource(3)]);
    expect(result.teamShares.get(20)).toEqual([resource(2)]);
    expect(safeUpsertInventory).toHaveBeenCalledWith(20, 'IRON', 2);
    expect(typeof safeUpsertInventory.mock.calls[0][0]).toBe('number');
  });

  it('does not grant common resources to a non-contributing collector', () => {
    const originalQuantity = 8;
    const result = helpers.distributeTeamResources(
      io,
      [resource(originalQuantity)],
      { 10: 100, 20: 50 },
      30
    );

    const collectorQuantity = result.collectorLoot
      .reduce((sum, item) => sum + item.quantity, 0);
    const sharedQuantity = [...result.teamShares.values()]
      .flat()
      .reduce((sum, item) => sum + item.quantity, 0);

    expect(result.teamShares.get(10)).toEqual([resource(4)]);
    expect(result.teamShares.get(20)).toEqual([resource(4)]);
    expect(collectorQuantity).toBe(0);
    expect(collectorQuantity + sharedQuantity).toBe(originalQuantity);
  });

  it('supports Map contributors and ignores malformed identities', () => {
    const result = helpers.distributeTeamResources(
      io,
      [resource(4, 'uncommon')],
      new Map([['10', 100], ['invalid', 50], [20, 25]]),
      10
    );

    expect([...result.teamShares.keys()]).toEqual([20]);
    expect(result.collectorLoot[0].quantity).toBe(2);
    expect(result.teamShares.get(20)[0].quantity).toBe(2);
  });

  it('keeps the team credit pool limited to damage contributors', () => {
    const result = helpers.distributeTeamCredits(
      io,
      100,
      { 10: 100, 20: 50 },
      30
    );

    expect(result).toMatchObject({
      total: 150,
      collectorCredits: 0,
      distributed: [
        { playerId: 10, credits: 75 },
        { playerId: 20, credits: 75 }
      ]
    });
    expect(safeUpdateCredits).not.toHaveBeenCalledWith(expect.anything(), 30);
  });

  it('preserves a teammate share that does not fit in cargo', () => {
    statements.getTotalCargoCount.get.mockImplementation(playerId => ({
      total: playerId === 20 ? 98 : 0
    }));

    const result = helpers.distributeTeamResources(
      io,
      [resource(8)],
      { 10: 100, 20: 50 },
      10
    );

    expect(result.collectorLoot).toEqual([resource(4)]);
    expect(result.teamShares.get(20)).toEqual([resource(2)]);
    expect(result.remainingLoot).toEqual([resource(2)]);
    expect(safeUpsertInventory).toHaveBeenCalledWith(20, 'IRON', 2);
    const conserved = result.collectorLoot[0].quantity +
      result.teamShares.get(20)[0].quantity + result.remainingLoot[0].quantity;
    expect(conserved).toBe(8);
  });

  it('limits collector loot to cargo and returns the exact overflow', () => {
    statements.getTotalCargoCount.get.mockReturnValue({ total: 99 });

    const result = helpers.processCollectedLoot(io, 10, [resource(5)]);

    expect(result.resources).toEqual([{ type: 'IRON', quantity: 1 }]);
    expect(result.remainingLoot).toEqual([resource(4)]);
    expect(safeUpsertInventory).toHaveBeenCalledWith(10, 'IRON', 1);
  });

  it('retries exact pending credit shares without reapplying multipliers', () => {
    safeUpdateCredits.mockImplementation((_credits, playerId) => ({
      changes: playerId === 20 ? 0 : 1
    }));

    const initial = helpers.distributeTeamCredits(io, 100, { 10: 10, 20: 10 }, 10);
    expect(initial.distributed).toEqual([{ playerId: 10, credits: 75 }]);
    expect(initial.pendingCredits).toEqual([{ playerId: 20, credits: 75 }]);

    safeUpdateCredits.mockReturnValue({ changes: 1 });
    const retry = helpers.distributeTeamCredits(
      io,
      0,
      null,
      30,
      initial.pendingCredits
    );
    expect(retry.distributed).toEqual([{ playerId: 20, credits: 75 }]);
    expect(retry.pendingCredits).toEqual([]);
    expect(retry.collectorCredits).toBe(0);
  });
});

describe('socket handler error boundary', () => {
  function createSocket() {
    const handlers = new Map();
    return {
      handlers,
      on: vi.fn((event, handler) => {
        handlers.set(event, handler);
        return this;
      }),
      emit: vi.fn()
    };
  }

  it('contains synchronous listener failures', () => {
    const socket = createSocket();
    helpers.installSafeSocketBoundary(socket);
    socket.on('malformed:event', () => {
      throw new TypeError('bad payload');
    });

    expect(() => socket.handlers.get('malformed:event')()).not.toThrow();
    expect(socket.emit).toHaveBeenCalledWith('error:generic', {
      message: 'Unable to process that request.'
    });
  });

  it('contains asynchronous listener failures', async () => {
    const socket = createSocket();
    helpers.installSafeSocketBoundary(socket);
    socket.on('async:event', async () => {
      throw new Error('database unavailable');
    });

    await socket.handlers.get('async:event')();
    expect(socket.emit).toHaveBeenCalledWith('error:generic', {
      message: 'Unable to process that request.'
    });
  });
});

describe('recipient-specific proximity broadcasting', () => {
  beforeEach(() => {
    helpers.connectedPlayers.clear();
  });

  it('filters room candidates using each recipient radar range', () => {
    const emittedTo = [];
    const socket = {
      id: 'source',
      to: vi.fn(socketId => ({
        emit: vi.fn(() => emittedTo.push(socketId))
      }))
    };
    const source = { position: { x: 0, y: 0 }, radarTier: 1 };
    helpers.connectedPlayers.set('source', source);
    helpers.connectedPlayers.set('near-low', {
      position: { x: 900, y: 0 }, radarTier: 1
    });
    helpers.connectedPlayers.set('far-low', {
      position: { x: 1500, y: 0 }, radarTier: 1
    });
    helpers.connectedPlayers.set('far-high', {
      position: { x: 3500, y: 0 }, radarTier: 5
    });

    expect(helpers.broadcastToNearby(socket, source, 'player:update', {})).toBe(2);
    expect(emittedTo).toEqual(['near-low', 'far-high']);
  });
});
