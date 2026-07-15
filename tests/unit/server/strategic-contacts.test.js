import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

function installMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const mocks = [
  ['../../../server/game/npc.js', { activeNPCs: new Map(), activeBases: new Map() }],
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
  ['../../../server/game/npc-delta.js', { createNpcDelta: vi.fn() }],
  ['../../../server/game/npc-combat-modifiers.js', { getNpcDamageMultiplier: vi.fn(() => 1) }],
  ['../../../server/game/ai/index.js', {
    getSwarmStrategy: vi.fn(() => ({})),
    getFormationStrategy: vi.fn(() => ({ setFormationState: vi.fn() }))
  }],
  ['../../../shared/logger.js', { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }]
];
const saved = new Map(mocks.map(([path]) => [require.resolve(path), require.cache[require.resolve(path)]]));
const enginePath = require.resolve('../../../server/game/engine.js');
let buildStrategicContacts;
let getPlayerBaseActivationRange;
let getPlayerBroadcastRange;

beforeAll(() => {
  for (const [path, exports] of mocks) installMock(path, exports);
  delete require.cache[enginePath];
  ({
    buildStrategicContacts,
    getPlayerBaseActivationRange,
    getPlayerBroadcastRange
  } = require(enginePath));
});

afterAll(() => {
  delete require.cache[enginePath];
  for (const [filename, cached] of saved) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
});

describe('Ancient Star Map strategic contacts', () => {
  it('covers strategic contacts and every ordinary NPC delivery range', () => {
    expect(getPlayerBaseActivationRange({ radarTier: 1, relicTypes: [] })).toBe(3000);
    for (const radarTier of [4, 5]) {
      const player = { radarTier, relicTypes: [] };
      expect(getPlayerBaseActivationRange(player))
        .toBeGreaterThan(getPlayerBroadcastRange(player));
    }
    expect(getPlayerBaseActivationRange({ radarTier: 5, relicTypes: [] })).toBe(5562);
    expect(getPlayerBaseActivationRange({
      radarTier: 5,
      relicTypes: ['ANCIENT_STAR_MAP']
    })).toBe(5562);
  });

  it('returns only nearest out-of-radar bases and boss-class NPCs', () => {
    const contacts = buildStrategicContacts(
      { x: 0, y: 0 },
      500,
      1000,
      2,
      [
        { id: 'near-base', x: 400, y: 0, faction: 'pirate' },
        { id: 'strategic-base', x: 700, y: 0, faction: 'void' }
      ],
      [
        { id: 'regular', type: 'pirate_fighter', position: { x: 600, y: 0 } },
        { id: 'queen', type: 'swarm_queen', faction: 'swarm', position: { x: 650, y: 0 } },
        { id: 'dread', type: 'pirate_dreadnought', faction: 'pirate', position: { x: 800, y: 0 } },
        { id: 'too-far', type: 'void_leviathan', position: { x: 1200, y: 0 } }
      ]
    );

    expect(contacts).toEqual([
      { id: 'queen', x: 650, y: 0, faction: 'swarm', contactType: 'boss' },
      { id: 'strategic-base', x: 700, y: 0, faction: 'void', contactType: 'base' }
    ]);
  });
});
