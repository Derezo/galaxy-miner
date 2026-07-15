import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const miningStub = {
  active: false,
  startMining: vi.fn(() => {
    miningStub.active = true;
    return {
      success: true,
      target: { x: 10, y: 0, resourceType: 'IRON' }
    };
  }),
  updateMining: vi.fn(() => ({ progress: 0.5, remaining: 1000 })),
  cancelMining: vi.fn(() => {
    miningStub.active = false;
  }),
  isMining: vi.fn(() => miningStub.active)
};
const statements = {
  getShipByUserId: { get: vi.fn(() => ({ credits: 0 })) }
};
const moduleMocks = [
  ['../../../server/game/mining.js', miningStub],
  ['../../../server/database.js', {
    statements,
    getSafeCredits: vi.fn(ship => ship?.credits || 0)
  }],
  ['../../../shared/logger.js', {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }]
];
const savedModules = new Map(moduleMocks.map(([modulePath]) => {
  const filename = require.resolve(modulePath);
  return [filename, require.cache[filename]];
}));
const handlerPath = require.resolve('../../../server/socket/mining.js');
let miningHandlers;

beforeAll(() => {
  for (const [modulePath, exports] of moduleMocks) installCommonJsMock(modulePath, exports);
  delete require.cache[handlerPath];
  miningHandlers = require(handlerPath);
});

afterAll(() => {
  delete require.cache[handlerPath];
  for (const [filename, cached] of savedModules) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
});

function createHarness() {
  const handlers = new Map();
  const tracked = new Set();
  const socket = {
    id: 'mining-socket',
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn()
  };
  const player = {
    id: 71,
    position: { x: 0, y: 0 },
    miningTier: 1,
    isDead: false
  };
  let status = 'idle';
  let inTransit = false;
  const setPlayerStatus = vi.fn((_playerId, nextStatus) => {
    status = nextStatus;
  });
  const deps = {
    getAuthenticatedUserId: () => player.id,
    wormhole: { isInTransit: vi.fn(() => inTransit) },
    state: {
      connectedPlayers: new Map([[socket.id, player]]),
      trackInterval: vi.fn((_socketId, timer) => tracked.add(timer)),
      untrackInterval: vi.fn((_socketId, timer) => tracked.delete(timer)),
      setPlayerStatus,
      getPlayerStatus: vi.fn(() => status),
      broadcastToNearby: vi.fn()
    }
  };
  miningHandlers.register(socket, deps);

  return {
    socket,
    handlers,
    tracked,
    player,
    deps,
    setTransit(value) { inTransit = value; },
    getStatus() { return status; }
  };
}

function startMining(harness) {
  harness.handlers.get('mining:start')({ objectId: 'asteroid-1' });
  expect(harness.getStatus()).toBe('mining');
  expect(harness.tracked.size).toBe(1);
}

describe('authoritative mining status lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
    miningStub.active = false;
    miningStub.startMining.mockImplementation(() => {
      miningStub.active = true;
      return { success: true, target: { x: 10, y: 0, resourceType: 'IRON' } };
    });
    miningStub.updateMining.mockReturnValue({ progress: 0.5, remaining: 1000 });
    miningStub.cancelMining.mockImplementation(() => {
      miningStub.active = false;
    });
    miningStub.isMining.mockImplementation(() => miningStub.active);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets status and clears the timer on explicit cancellation', () => {
    const harness = createHarness();
    startMining(harness);

    harness.handlers.get('mining:cancel')();

    expect(harness.getStatus()).toBe('idle');
    expect(harness.tracked.size).toBe(0);
    expect(miningStub.cancelMining).toHaveBeenCalledWith(harness.player.id);
    expect(harness.socket.emit).toHaveBeenCalledWith('mining:cancelled', {
      reason: 'Cancelled by player'
    });
  });

  it.each([
    ['death', harness => { harness.player.isDead = true; }],
    ['wormhole transit', harness => { harness.setTransit(true); }]
  ])('resets status when mining is interrupted by %s', (_label, interrupt) => {
    const harness = createHarness();
    startMining(harness);
    interrupt(harness);

    vi.advanceTimersByTime(100);

    expect(harness.getStatus()).toBe('idle');
    expect(harness.tracked.size).toBe(0);
    expect(miningStub.active).toBe(false);
  });

  it('resets status when completion fails after the game layer removes its session', () => {
    const harness = createHarness();
    startMining(harness);
    miningStub.updateMining.mockImplementationOnce(() => {
      miningStub.active = false;
      return { success: false, error: 'Cargo hold full' };
    });

    vi.advanceTimersByTime(100);

    expect(harness.getStatus()).toBe('idle');
    expect(harness.tracked.size).toBe(0);
    expect(harness.socket.emit).toHaveBeenCalledWith('mining:error', {
      message: 'Cargo hold full'
    });
  });

  it('does not overwrite a newer non-mining status while cleaning a stale timer', () => {
    const harness = createHarness();
    startMining(harness);
    harness.deps.state.setPlayerStatus(harness.player.id, 'wormhole');
    miningStub.active = false;
    miningStub.updateMining.mockReturnValueOnce(null);

    vi.advanceTimersByTime(100);

    expect(harness.getStatus()).toBe('wormhole');
    expect(harness.tracked.size).toBe(0);
  });
});
