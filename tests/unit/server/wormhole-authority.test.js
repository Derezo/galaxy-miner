import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  hasRelic: { get: vi.fn(() => ({ relic_type: 'WORMHOLE_GEM' })) },
  updateShipPosition: { run: vi.fn() }
};
const world = {
  getObjectById: vi.fn(),
  generateSector: vi.fn(() => ({ wormholes: [] })),
  findNearestWormhole: vi.fn()
};

installCommonJsMock('../../../server/database.js', { statements });
installCommonJsMock('../../../server/world.js', world);
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const gamePath = require.resolve('../../../server/game/wormhole.js');
delete require.cache[gamePath];
const gameWormhole = require(gamePath);
const boostAuthority = require('../../../server/socket/boost-authority.js');

describe('wormhole object authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statements.hasRelic.get.mockReturnValue({ relic_type: 'WORMHOLE_GEM' });
  });

  afterEach(() => {
    gameWormhole.cleanupPlayer(91);
  });

  it('rejects a nearby non-wormhole ID before the general world lookup', () => {
    world.getObjectById.mockReturnValue({
      id: '0_0_asteroid_0', x: 0, y: 0, size: 30
    });

    const result = gameWormhole.canEnterWormhole(
      { id: 91, x: 0, y: 0 },
      '0_0_asteroid_0'
    );

    expect(result).toMatchObject({ success: false, error: 'Wormhole not found.' });
    expect(world.getObjectById).not.toHaveBeenCalled();
  });

  it('accepts only a finite canonical wormhole object', () => {
    const wormhole = { id: '0_0_wormhole_0', x: 25, y: 0, size: 20 };
    world.getObjectById.mockReturnValue(wormhole);

    expect(gameWormhole.canEnterWormhole(
      { id: 91, x: 0, y: 0 },
      wormhole.id
    )).toEqual({ success: true, wormhole });
  });

  it('allows selection cancellation but rejects cancellation after commitment', () => {
    const entry = { id: '0_0_wormhole_0', x: 25, y: 0, size: 20 };
    const destination = { id: '0_0_wormhole_1', x: 500, y: 0, size: 20 };
    world.getObjectById.mockReturnValue(entry);
    world.generateSector.mockReturnValue({ wormholes: [entry, destination] });

    expect(gameWormhole.enterWormhole(
      { id: 91, x: 0, y: 0 },
      entry.id
    ).success).toBe(true);
    expect(gameWormhole.cancelTransit(91, 'Changed mind')).toEqual({
      success: true,
      reason: 'Changed mind'
    });

    expect(gameWormhole.enterWormhole(
      { id: 91, x: 0, y: 0 },
      entry.id
    ).success).toBe(true);
    expect(gameWormhole.selectDestination(91, destination.id).success).toBe(true);

    expect(gameWormhole.cancelTransit(91, 'Forged client request')).toEqual({
      success: false,
      error: 'Wormhole transit is already committed.'
    });
    expect(gameWormhole.getTransitPhase(91)).toBe('transit');

    gameWormhole.cleanupPlayer(91);
    expect(gameWormhole.getTransitPhase(91)).toBeNull();
  });
});

describe('wormhole socket integration', () => {
  const wormholeStub = {
    enterWormhole: vi.fn(),
    selectDestination: vi.fn(),
    completeTransit: vi.fn(),
    cancelTransit: vi.fn(),
    getTransitProgress: vi.fn(),
    TRANSIT_DURATION: 5000
  };

  let handlers;
  let socket;
  let socketHandlers;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
    statements.hasRelic.get.mockReturnValue({ relic_type: 'WORMHOLE_GEM' });
    boostAuthority.clearPlayerBoostAuthority(91);

    installCommonJsMock('../../../server/game/wormhole.js', wormholeStub);
    const socketPath = require.resolve('../../../server/socket/wormhole.js');
    delete require.cache[socketPath];
    socketHandlers = require(socketPath);

    handlers = new Map();
    socket = {
      id: 'socket-91',
      on: vi.fn((event, handler) => handlers.set(event, handler)),
      emit: vi.fn()
    };
  });

  afterEach(() => {
    boostAuthority.clearPlayerBoostAuthority(91);
    vi.useRealTimers();
    require.cache[gamePath].exports = gameWormhole;
  });

  it('uses the relic-modified duration and resets movement authority on exit', () => {
    const cooldownEndAt = Date.now() + 30000;
    const player = {
      id: 91,
      position: { x: 0, y: 0 },
      velocity: { x: 10, y: 5 },
      rotation: 0,
      movementBudget: 999,
      movementBudgetAt: 1,
      serverBoostEndAt: 10,
      serverBoostRecoveryEndAt: 20,
      serverBoostCooldownEndAt: cooldownEndAt,
      isDead: false
    };
    wormholeStub.selectDestination.mockReturnValue({
      success: true,
      destination: { id: '1_1_wormhole_0', x: 1000, y: 1000 },
      duration: 2000,
      hasVoidWarp: true
    });
    wormholeStub.completeTransit.mockReturnValue({
      success: true,
      position: { x: 1080, y: 1000 },
      wormholeId: '1_1_wormhole_0',
      hasVoidWarp: true
    });
    const deps = {
      getAuthenticatedUserId: () => 91,
      engine: { updatePlayerInHash: vi.fn() },
      state: {
        connectedPlayers: new Map([[socket.id, player]]),
        setPlayerStatus: vi.fn(),
        broadcastToNearby: vi.fn(),
        updatePlayerSectorRooms: vi.fn(),
        trackInterval: vi.fn(),
        untrackInterval: vi.fn()
      }
    };
    socketHandlers.register(socket, deps);

    handlers.get('wormhole:selectDestination')({ destinationId: '1_1_wormhole_0' });
    vi.advanceTimersByTime(1999);
    expect(wormholeStub.completeTransit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(wormholeStub.completeTransit).toHaveBeenCalledWith(91);
    expect(player.position).toEqual({ x: 1080, y: 1000 });
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(player.movementBudget).toBeNull();
    expect(player.serverBoostEndAt).toBe(0);
    expect(player.serverBoostRecoveryEndAt).toBe(0);
    expect(player.serverBoostCooldownEndAt).toBe(cooldownEndAt);
    expect(boostAuthority.getPlayerBoostAuthority(91).cooldownEndAt).toBe(cooldownEndAt);
    expect(deps.state.updatePlayerSectorRooms).toHaveBeenCalledWith(socket, player);
    expect(statements.updateShipPosition.run).toHaveBeenCalled();
  });

  it('rejects malformed enter payloads without calling the game system', () => {
    const deps = {
      getAuthenticatedUserId: () => 91,
      engine: { updatePlayerInHash: vi.fn() },
      state: {
        connectedPlayers: new Map([[socket.id, {
          id: 91,
          position: { x: 0, y: 0 },
          isDead: false
        }]]),
        setPlayerStatus: vi.fn(),
        broadcastToNearby: vi.fn()
      }
    };
    socketHandlers.register(socket, deps);

    expect(() => handlers.get('wormhole:enter')(null)).not.toThrow();
    expect(wormholeStub.enterWormhole).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('wormhole:error', {
      message: 'Invalid wormhole.'
    });
  });

  it('cancels authoritative mining before entering wormhole state', () => {
    const player = {
      id: 91,
      position: { x: 0, y: 0 },
      isDead: false
    };
    const mining = {
      isMining: vi.fn(() => true),
      cancelMining: vi.fn()
    };
    const setPlayerStatus = vi.fn();
    wormholeStub.enterWormhole.mockReturnValue({
      success: true,
      destinations: []
    });
    const deps = {
      getAuthenticatedUserId: () => 91,
      mining,
      engine: { updatePlayerInHash: vi.fn() },
      state: {
        connectedPlayers: new Map([[socket.id, player]]),
        setPlayerStatus,
        getPlayerStatus: vi.fn(() => 'mining'),
        broadcastToNearby: vi.fn()
      }
    };
    socketHandlers.register(socket, deps);

    handlers.get('wormhole:enter')({ wormholeId: '0_0_wormhole_0' });

    expect(mining.cancelMining).toHaveBeenCalledWith(91);
    expect(setPlayerStatus.mock.calls.map(call => call[1])).toEqual(['idle', 'wormhole']);
    expect(socket.emit).toHaveBeenCalledWith('mining:cancelled', {
      reason: 'Wormhole transit started'
    });
  });

  it('requires authoritative Wormhole Gem ownership before scanning the world', () => {
    statements.hasRelic.get.mockReturnValue(null);
    const player = { id: 91, position: { x: 250, y: 250 }, isDead: false };
    const deps = {
      getAuthenticatedUserId: () => 91,
      state: {
        connectedPlayers: new Map([[socket.id, player]])
      }
    };
    socketHandlers.register(socket, deps);

    handlers.get('wormhole:getNearestPosition')();

    expect(statements.hasRelic.get).toHaveBeenCalledWith(91, 'WORMHOLE_GEM');
    expect(world.findNearestWormhole).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('wormhole:error', {
      message: 'Wormhole Gem required.'
    });
  });

  it('throttles repeat requests and reuses the bounded sector result cache', () => {
    const player = { id: 91, position: { x: 250, y: 250 }, isDead: false };
    const deps = {
      getAuthenticatedUserId: () => 91,
      state: {
        connectedPlayers: new Map([[socket.id, player]])
      }
    };
    world.findNearestWormhole.mockReturnValue({
      id: '3_4_wormhole_0',
      x: 3250,
      y: 4250,
      distance: 5000
    });
    socketHandlers.register(socket, deps);

    handlers.get('wormhole:getNearestPosition')();
    handlers.get('wormhole:getNearestPosition')();

    expect(world.findNearestWormhole).toHaveBeenCalledOnce();
    expect(socket.emit.mock.calls.filter(([event]) =>
      event === 'wormhole:nearestPosition')).toHaveLength(1);

    player.position = { x: 300, y: 300 };
    vi.advanceTimersByTime(5000);
    handlers.get('wormhole:getNearestPosition')();

    expect(world.findNearestWormhole).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenLastCalledWith('wormhole:nearestPosition', {
      id: '3_4_wormhole_0',
      x: 3250,
      y: 4250,
      distance: Math.hypot(3250 - 300, 4250 - 300)
    });
  });
});
