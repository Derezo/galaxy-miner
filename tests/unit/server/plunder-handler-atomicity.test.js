import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
let credits = 100;
const grantPlunderRewards = vi.fn();
const statements = {
  getShipByUserId: { get: vi.fn(() => ({ credits, cargo_tier: 1 })) },
  getTotalCargoCount: { get: vi.fn(() => ({ total: 0 })) },
  getInventory: { all: vi.fn(() => []) }
};
const base = {
  id: 'claim-atomic',
  type: 'mining_claim',
  faction: 'rogue_miner',
  x: 0,
  y: 0,
  size: 100,
  claimCredits: 50,
  destroyed: false
};
const nearbyNpc = { faction: 'rogue_miner', state: 'patrol', targetPlayer: null };
const npc = {
  getActiveBase: vi.fn(() => base),
  getNPCsInRange: vi.fn(() => [nearbyNpc])
};
const mocks = [
  ['../../../server/database.js', {
    statements,
    getSafeCredits: ship => ship?.credits || 0,
    grantPlunderRewards
  }],
  ['../../../server/game/npc.js', npc],
  ['../../../server/world.js', { getObjectPosition: vi.fn(() => ({ x: 0, y: 0 })) }],
  ['../../../server/game/loot-pools.js', { generateLoot: vi.fn(() => []) }],
  ['../../../server/game/relic-effects.js', {
    playerHasRelic: vi.fn(() => true),
    allocateCargoResources: (resources, capacity) => ({
      granted: resources.slice(0, capacity),
      remaining: [],
      usedCapacity: 0
    }),
    getCooldownRemaining: (last, cooldown, now) => Math.max(0, Math.ceil((last || 0) + cooldown - now))
  }],
  ['../../../shared/logger.js', { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }]
];
const saved = new Map(mocks.map(([path]) => [require.resolve(path), require.cache[require.resolve(path)]]));
const handlerPath = require.resolve('../../../server/socket/relic.js');
let relicHandler;

beforeAll(() => {
  for (const [path, exports] of mocks) {
    const filename = require.resolve(path);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  delete require.cache[handlerPath];
  relicHandler = require(handlerPath);
});

afterAll(() => {
  delete require.cache[handlerPath];
  for (const [filename, cached] of saved) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
});

describe('Skull and Bones handler atomic settlement boundary', () => {
  let socket;
  let handlers;
  let broadcastToNearby;
  let isInTransit;

  beforeEach(() => {
    vi.clearAllMocks();
    credits = 100;
    base.claimCredits = 50;
    nearbyNpc.state = 'patrol';
    nearbyNpc.targetPlayer = null;
    handlers = new Map();
    socket = {
      id: 'socket-atomic',
      on: vi.fn((event, handler) => handlers.set(event, handler)),
      emit: vi.fn()
    };
    broadcastToNearby = vi.fn();
    isInTransit = vi.fn(() => false);
    relicHandler.register(socket, {
      getAuthenticatedUserId: () => 9001,
      wormhole: { isInTransit },
      state: {
        connectedPlayers: new Map([[
          socket.id,
          { id: 9001, position: { x: 0, y: 0 }, isDead: false }
        ]]),
        broadcastToNearby
      }
    });
  });

  it('rejects plunder while the player is in wormhole transit', () => {
    isInTransit.mockReturnValue(true);

    handlers.get('relic:plunder')({ baseId: base.id });

    expect(grantPlunderRewards).not.toHaveBeenCalled();
    expect(npc.getActiveBase).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('relic:plunderFailed', {
      reason: 'Player unavailable'
    });
  });

  it('leaves reserve, cooldown, aggro, and broadcasts untouched on transaction failure', () => {
    grantPlunderRewards.mockImplementationOnce(() => { throw new Error('write failed'); });

    handlers.get('relic:plunder')({ baseId: base.id });

    expect(base.claimCredits).toBe(50);
    expect(relicHandler.getPlayerPlunderCooldownRemaining(9001)).toBe(0);
    expect(npc.getNPCsInRange).not.toHaveBeenCalled();
    expect(nearbyNpc).toMatchObject({ state: 'patrol', targetPlayer: null });
    expect(broadcastToNearby).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('relic:plunderFailed', { reason: 'Plunder failed' });
    expect(socket.emit).not.toHaveBeenCalledWith('relic:plunderSuccess', expect.anything());
  });

  it('can retry once and consumes exactly the committed reward', () => {
    grantPlunderRewards.mockImplementationOnce((_userId, creditGrant) => {
      credits += creditGrant;
      return { creditGrant, newCredits: credits, resources: [] };
    });

    handlers.get('relic:plunder')({ baseId: base.id });

    expect(base.claimCredits).toBe(0);
    expect(credits).toBe(150);
    expect(relicHandler.getPlayerPlunderCooldownRemaining(9001)).toBeGreaterThan(0);
    expect(nearbyNpc).toMatchObject({ state: 'combat', targetPlayer: 9001 });
    expect(socket.emit).toHaveBeenCalledWith('relic:plunderSuccess', expect.objectContaining({
      credits: 50,
      loot: [],
      baseDepleted: true
    }));
    expect(socket.emit).toHaveBeenCalledWith('inventory:update', {
      inventory: [],
      credits: 150
    });
    expect(broadcastToNearby).toHaveBeenCalledOnce();
  });
});
