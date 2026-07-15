import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const config = require('../../../server/config.js');
const { getRadarRange } = require('../../../shared/utils.js');

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const getBasesInRange = vi.fn();
const activeNPCs = new Map();
const moduleMocks = [
  ['../../../server/game/npc.js', {
    getBasesInRange,
    activeNPCs,
    activeBases: new Map()
  }],
  ['../../../server/game/combat.js', {}],
  ['../../../server/game/mining.js', {}],
  ['../../../server/game/loot.js', {}],
  ['../../../server/game/wormhole.js', {}],
  ['../../../server/world.js', {}],
  ['../../../server/game/star-damage.js', {}],
  ['../../../server/database.js', { statements: {} }],
  ['../../../server/game/relic-effects.js', {
    playerHasRelic: vi.fn(() => false),
    calculateFactionDamage: vi.fn(value => value)
  }],
  ['../../../server/game/npc-combat-modifiers.js', {
    getNpcDamageMultiplier: vi.fn(() => 1)
  }],
  ['../../../server/game/ai/index.js', {
    getSwarmStrategy: vi.fn(() => ({})),
    getFormationStrategy: vi.fn(() => ({ setFormationState: vi.fn() }))
  }],
  ['../../../shared/logger.js', {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  }]
];
const savedModules = new Map(moduleMocks.map(([modulePath]) => {
  const filename = require.resolve(modulePath);
  return [filename, require.cache[filename]];
}));
const enginePath = require.resolve('../../../server/game/engine.js');
let engine;

beforeAll(() => {
  for (const [modulePath, exports] of moduleMocks) installCommonJsMock(modulePath, exports);
  delete require.cache[enginePath];
  engine = require(enginePath);
});

afterAll(() => {
  delete require.cache[enginePath];
  for (const [filename, cached] of savedModules) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
});

describe('base radar synchronization authority', () => {
  it('uses each recipient radar range and sends empty snapshots out of range', () => {
    const emissions = [];
    const io = {
      to: vi.fn(socketId => ({
        emit: (event, payload) => emissions.push({ socketId, event, payload })
      }))
    };
    const players = new Map([
      ['tier-1', { position: { x: 0, y: 0 }, radarTier: 1, isDead: false }],
      ['tier-5', { position: { x: 0, y: 0 }, radarTier: 5, isDead: false }]
    ]);
    const expectedMaxRadarRange = getRadarRange(config.MAX_TIER || 5);
    const distantBase = {
      id: 'base-near-max-radar',
      x: expectedMaxRadarRange - 20,
      y: 0,
      size: 10
    };
    getBasesInRange.mockImplementation((_position, range) => (
      range >= expectedMaxRadarRange ? [distantBase] : []
    ));
    engine.init(io, players, {});

    engine.broadcastNearbyBasesToPlayers(1000);

    const requestedRanges = getBasesInRange.mock.calls.map(call => call[1]);
    expect(requestedRanges[0]).toBe(config.BASE_RADAR_RANGE);
    expect(requestedRanges[1]).toBeCloseTo(expectedMaxRadarRange);
    expect(emissions).toContainEqual({
      socketId: 'tier-1',
      event: 'bases:nearby',
      payload: []
    });
    expect(emissions).toContainEqual({
      socketId: 'tier-5',
      event: 'bases:nearby',
      payload: [distantBase]
    });
    expect(requestedRanges.every(range => range <= expectedMaxRadarRange)).toBe(true);
  });

  it('delivers a long-range boss and its fire only to the engaged low-tier target', () => {
    const emissions = [];
    const io = {
      to: vi.fn(socketId => ({
        emit: (event, payload) => emissions.push({ socketId, event, payload })
      }))
    };
    const players = new Map([
      ['target', {
        id: 42,
        position: { x: 1400, y: 0 },
        radarTier: 1,
        isDead: false
      }],
      ['observer', {
        id: 7,
        position: { x: 1400, y: 0 },
        radarTier: 1,
        isDead: false
      }]
    ]);
    const dreadnought = {
      id: 'dreadnought-1',
      type: 'pirate_dreadnought',
      name: 'Pirate Dreadnought',
      faction: 'pirate',
      position: { x: 0, y: 0 },
      targetPlayer: 42,
      weaponRange: 1400,
      aggroRange: 1500
    };
    const update = {
      id: dreadnought.id,
      type: dreadnought.type,
      name: dreadnought.name,
      faction: dreadnought.faction,
      x: 0,
      y: 0,
      rotation: 0,
      state: 'combat',
      hull: 600,
      hullMax: 600,
      shield: 0,
      shieldMax: 0,
      vx: 0,
      vy: 0
    };

    engine.init(io, players, {});
    activeNPCs.set(dreadnought.id, dreadnought);
    engine.queueNpcUpdate(dreadnought, update);
    engine.flushNpcBatches();
    engine.broadcastNearNpc(dreadnought, 'combat:npcFire', { npcId: dreadnought.id });
    activeNPCs.delete(dreadnought.id);

    expect(emissions).toContainEqual(expect.objectContaining({
      socketId: 'target',
      event: 'npc:batch'
    }));
    expect(emissions).toContainEqual({
      socketId: 'target',
      event: 'combat:npcFire',
      payload: { npcId: dreadnought.id }
    });
    expect(emissions.some(emission => emission.socketId === 'observer')).toBe(false);
  });
});
