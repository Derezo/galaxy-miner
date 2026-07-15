import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const statements = {
  hasRelic: { get: vi.fn(() => ({ relic_type: 'SCRAP_SIPHON' })) },
  getInventory: { all: vi.fn(() => []) },
  getShipByUserId: { get: vi.fn(() => ({ credits: 0, cargo_tier: 1 })) }
};

installCommonJsMock('../../../server/database.js', {
  statements,
  getSafeCredits: vi.fn(ship => ship?.credits || 0)
});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  category: vi.fn()
});

const loot = require('../../../server/game/loot.js');
const lootHandlers = require('../../../server/socket/loot.js');

function createSocket() {
  const handlers = new Map();
  return {
    id: 'loot-socket',
    handlers,
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn()
  };
}

function spawn(contents, contributors = null, x = 0) {
  return loot.spawnWreckage(
    { type: 'test_npc', name: 'Test', creditReward: 0 },
    { x, y: 0 },
    contents,
    contributors
  );
}

function createDeps(socket, playerOverrides = {}, helperOverrides = {}) {
  const intervals = new Set();
  const player = {
    id: 10,
    position: { x: 0, y: 0 },
    radarTier: 1,
    isDead: false,
    ...playerOverrides
  };
  const distributeTeamCredits = vi.fn(() => ({
    total: 0,
    collectorCredits: 0,
    distributed: [],
    pendingCredits: []
  }));
  const distributeTeamResources = vi.fn(contents => ({
    collectorLoot: contents,
    teamShares: new Map(),
    rareDropNotifications: [],
    remainingLoot: []
  }));
  const processCollectedLoot = vi.fn(() => ({
    credits: 0,
    resources: [],
    components: [],
    relics: [],
    duplicateRelics: [],
    buffs: [],
    errors: [],
    remainingLoot: []
  }));

  const deps = {
    loot,
    wormhole: { isInTransit: vi.fn(() => false) },
    getAuthenticatedUserId: () => 10,
    state: {
      connectedPlayers: new Map([[socket.id, player]]),
      trackInterval: vi.fn((_socketId, timer) => intervals.add(timer)),
      untrackInterval: vi.fn((_socketId, timer) => intervals.delete(timer)),
      setPlayerStatus: vi.fn(),
      broadcastToNearby: vi.fn(),
      distributeTeamCredits,
      distributeTeamResources,
      processCollectedLoot,
      ...helperOverrides
    }
  };
  return { deps, player, intervals, distributeTeamCredits, distributeTeamResources, processCollectedLoot };
}

describe('loot socket authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statements.hasRelic.get.mockReturnValue({ relic_type: 'SCRAP_SIPHON' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    loot.activeWreckage.clear();
    loot.activeCollectionsByPlayer.clear();
  });

  afterEach(() => {
    loot.activeWreckage.clear();
    loot.activeCollectionsByPlayer.clear();
    vi.useRealTimers();
  });

  it('rejects malformed, dead, and in-transit collection requests', () => {
    const socket = createSocket();
    const { deps, player, intervals } = createDeps(socket);
    lootHandlers.register(socket, deps);

    socket.handlers.get('loot:startCollect')();
    player.isDead = true;
    socket.handlers.get('loot:startCollect')({ wreckageId: 'wreckage_1' });
    player.isDead = false;
    deps.wormhole.isInTransit.mockReturnValue(true);
    socket.handlers.get('loot:startCollect')({ wreckageId: 'wreckage_1' });

    expect(intervals.size).toBe(0);
    expect(socket.emit).toHaveBeenCalledWith('loot:error', { message: 'Invalid wreckage ID' });
    expect(socket.emit).toHaveBeenCalledWith('loot:error', {
      message: 'Cannot collect wreckage right now'
    });
  });

  it('creates only one timer for duplicate ordinary start events', () => {
    const socket = createSocket();
    const { deps, intervals } = createDeps(socket);
    const wreckage = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);
    lootHandlers.register(socket, deps);

    socket.handlers.get('loot:startCollect')({ wreckageId: wreckage.id });
    socket.handlers.get('loot:startCollect')({ wreckageId: wreckage.id });

    expect(intervals.size).toBe(1);
    expect(socket.emit).toHaveBeenCalledWith('loot:error', {
      message: 'You are already collecting wreckage'
    });

    vi.advanceTimersByTime(1500);
    expect(intervals.size).toBe(0);
    expect(loot.getWreckage(wreckage.id)).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith('loot:complete', expect.objectContaining({
      wreckageId: wreckage.id,
      cargoLimited: false
    }));
  });

  it('leaves cargo overflow unlocked and claimable after durable awards', () => {
    const socket = createSocket();
    const overflow = { type: 'resource', resourceType: 'IRON', quantity: 4, rarity: 'common' };
    const distributeTeamResources = vi.fn(() => ({
      collectorLoot: [],
      teamShares: new Map(),
      rareDropNotifications: [],
      remainingLoot: [overflow]
    }));
    const { deps } = createDeps(socket, {}, { distributeTeamResources });
    const wreckage = spawn([{ ...overflow, quantity: 5 }]);
    lootHandlers.register(socket, deps);

    socket.handlers.get('loot:startCollect')({ wreckageId: wreckage.id });
    vi.advanceTimersByTime(1500);

    expect(loot.getWreckage(wreckage.id)).toMatchObject({
      beingCollectedBy: null,
      contents: [overflow]
    });
    expect(socket.emit).toHaveBeenCalledWith('loot:complete', expect.objectContaining({
      cargoLimited: true
    }));
    expect(socket.emit).toHaveBeenCalledWith('wreckage:spawn', expect.objectContaining({
      id: wreckage.id,
      contentCount: 1
    }));
  });

  it('settles each Scrap Siphon wreckage with its own contributor map', () => {
    const socket = createSocket();
    const firstContributors = { 10: 50, 20: 25 };
    const secondContributors = { 30: 80 };
    const first = spawn([{ type: 'credits', amount: 10 }], firstContributors, 10);
    const second = spawn([{ type: 'credits', amount: 20 }], secondContributors, 20);
    const { deps, distributeTeamCredits } = createDeps(socket);
    lootHandlers.register(socket, deps);

    socket.handlers.get('wreckage:multiCollect')();
    vi.advanceTimersByTime(500);

    expect(distributeTeamCredits).toHaveBeenCalledTimes(2);
    expect(distributeTeamCredits.mock.calls.map(call => call[1])).toEqual([
      firstContributors,
      secondContributors
    ]);
    expect(loot.getWreckage(first.id)).toBeUndefined();
    expect(loot.getWreckage(second.id)).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith('loot:multiComplete', expect.objectContaining({
      wreckageIds: [first.id, second.id],
      attemptedWreckageIds: [first.id, second.id]
    }));
  });

  it('cancels the active lock immediately when collection is interrupted by death', () => {
    const socket = createSocket();
    const { deps, player, intervals } = createDeps(socket);
    const wreckage = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);
    lootHandlers.register(socket, deps);

    socket.handlers.get('loot:startCollect')({ wreckageId: wreckage.id });
    player.isDead = true;
    vi.advanceTimersByTime(100);

    expect(intervals.size).toBe(0);
    expect(wreckage.beingCollectedBy).toBeNull();
    expect(loot.activeCollectionsByPlayer.has(10)).toBe(false);
    expect(socket.emit).toHaveBeenCalledWith('loot:cancelled', {
      reason: 'Collection interrupted'
    });
  });

  it('invokes and broadcasts scavenger theft behavior after ordinary collection', () => {
    statements.hasRelic.get.mockReturnValue(undefined);
    const socket = createSocket();
    const { deps, player } = createDeps(socket);
    const npc = {
      id: 'scavenger-1',
      position: { x: 20, y: 0 },
      size: 30
    };
    const action = {
      npcId: npc.id,
      targetId: player.id,
      reason: 'wreckage_theft',
      rageRange: 1000
    };
    deps.npc = {
      notifyWreckageCollectedNearby: vi.fn(() => ({ npc, action, ignored: false }))
    };
    deps.broadcasts = { emitNear: vi.fn() };
    const wreckage = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);
    lootHandlers.register(socket, deps);

    socket.handlers.get('loot:startCollect')({ wreckageId: wreckage.id });
    vi.advanceTimersByTime(1500);

    expect(deps.npc.notifyWreckageCollectedNearby).toHaveBeenCalledWith(
      player.id,
      player.position,
      false
    );
    expect(deps.broadcasts.emitNear).toHaveBeenCalledWith(
      npc.position,
      'scavenger:rage',
      expect.objectContaining({ npcId: npc.id, reason: 'wreckage_theft' }),
      30
    );
  });

  it('passes Scrap Siphon immunity through the scavenger behavior hook', () => {
    const socket = createSocket();
    const { deps, player } = createDeps(socket);
    const npc = { id: 'scavenger-1', position: { x: 20, y: 0 } };
    deps.npc = {
      notifyWreckageCollectedNearby: vi.fn(() => ({
        npc,
        action: null,
        ignored: true
      }))
    };
    deps.broadcasts = { emitNear: vi.fn() };
    spawn([{ type: 'credits', amount: 10 }], null, 10);
    lootHandlers.register(socket, deps);

    socket.handlers.get('wreckage:multiCollect')();
    vi.advanceTimersByTime(500);

    expect(deps.npc.notifyWreckageCollectedNearby).toHaveBeenCalledWith(
      player.id,
      player.position,
      true
    );
    expect(deps.broadcasts.emitNear).not.toHaveBeenCalled();
  });
});
