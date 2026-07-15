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

const combat = {
  applyDamage: vi.fn(),
  handleDeath: vi.fn(),
  syncExternalHealth: vi.fn(),
  updateShieldRecharge: vi.fn()
};
const mining = { cancelMining: vi.fn() };
const loot = {
  spawnWreckage: vi.fn(),
  cancelCollectionsForPlayer: vi.fn(),
  cleanupExpiredWreckage: vi.fn(() => [])
};
const wormhole = {
  isInTransit: vi.fn(() => false),
  cleanupPlayer: vi.fn()
};
const world = {
  generateSector: vi.fn(() => ({ stars: [], comets: [] })),
  getObjectPosition: vi.fn()
};
const npc = {
  TEAM_MULTIPLIERS: { 1: 1 },
  activeNPCs: new Map(),
  activeBases: new Map()
};

installCommonJsMock('../../../server/game/combat.js', combat);
installCommonJsMock('../../../server/game/mining.js', mining);
installCommonJsMock('../../../server/game/loot.js', loot);
installCommonJsMock('../../../server/game/wormhole.js', wormhole);
installCommonJsMock('../../../server/world.js', world);
installCommonJsMock('../../../server/game/npc.js', npc);
installCommonJsMock('../../../server/database.js', { statements: {} });
installCommonJsMock('../../../server/game/relic-effects.js', {
  playerHasRelic: vi.fn(() => false),
  calculateFactionDamage: vi.fn(damage => damage)
});
installCommonJsMock('../../../server/game/ai/index.js', {
  getSwarmStrategy: vi.fn(() => ({})),
  getFormationStrategy: vi.fn(() => ({ setFormationState: vi.fn() }))
});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const starDamagePath = require.resolve('../../../server/game/star-damage.js');
delete require.cache[starDamagePath];
const starDamage = require(starDamagePath);
const enginePath = require.resolve('../../../server/game/engine.js');
delete require.cache[enginePath];
const engine = require(enginePath);

function createPlayer(overrides = {}) {
  return {
    id: 42,
    username: 'damage_test',
    position: { x: 10, y: 20 },
    velocity: { x: 0, y: 0 },
    hull: 100,
    shield: 50,
    isDead: false,
    ...overrides
  };
}

describe('wormhole transit damage authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wormhole.isInTransit.mockReturnValue(false);
    world.generateSector.mockReturnValue({ stars: [], comets: [] });
    combat.handleDeath.mockReturnValue({
      droppedCargo: [],
      wreckageContents: [],
      respawnOptions: { type: 'graveyard' },
      playerName: 'damage_test'
    });
  });

  it('uses one transit gate for NPC, DoT, acid, gravity, and comet paths', () => {
    const player = createPlayer();
    wormhole.isInTransit.mockReturnValue(true);

    expect(engine.canPlayerTakeDamage(player)).toBe(false);
    expect(engine.applyQueenAcidBurstDamage(
      { id: 'queen', name: 'Queen', faction: 'swarm', type: 'swarm_queen' },
      { damage: 50, dotDamage: 5, dotDuration: 5000 },
      'socket-42',
      player
    )).toBe(false);
    expect(combat.applyDamage).not.toHaveBeenCalled();
  });

  it('skips stellar environment checks while a player is in transit', () => {
    const player = createPlayer();
    wormhole.isInTransit.mockReturnValue(true);

    starDamage.update(new Map([['socket-42', player]]), {
      to: vi.fn(() => ({ emit: vi.fn() }))
    }, 50);

    expect(world.generateSector).not.toHaveBeenCalled();
    expect(combat.syncExternalHealth).not.toHaveBeenCalled();
  });
});

describe('Queen acid death authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wormhole.isInTransit.mockReturnValue(false);
    combat.applyDamage.mockReturnValue({ hull: 0, shield: 0, isDead: true });
    combat.handleDeath.mockReturnValue({
      droppedCargo: [],
      wreckageContents: [],
      respawnOptions: { type: 'graveyard' },
      playerName: 'damage_test'
    });
  });

  it('routes lethal initial acid damage through normal death cleanup', () => {
    const player = createPlayer();
    const emit = vi.fn();
    const setPlayerStatus = vi.fn();
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', player]]),
      { setPlayerStatus }
    );

    expect(engine.applyQueenAcidBurstDamage(
      { id: 'queen', name: 'Swarm Queen', faction: 'swarm', type: 'swarm_queen' },
      { damage: 80, dotDamage: 10, dotInterval: 1000, dotDuration: 5000 },
      'socket-42',
      player
    )).toBe(true);

    expect(combat.handleDeath).toHaveBeenCalledWith(42, { x: 10, y: 20 });
    expect(player).toMatchObject({
      hull: 0,
      shield: 0,
      isDead: true,
      deathPosition: { x: 10, y: 20 },
      respawnOptions: { type: 'graveyard' }
    });
    expect(mining.cancelMining).toHaveBeenCalledWith(42);
    expect(loot.cancelCollectionsForPlayer).toHaveBeenCalledWith(42);
    expect(wormhole.cleanupPlayer).toHaveBeenCalledWith(42);
    expect(setPlayerStatus).toHaveBeenCalledWith(42, 'idle');
    expect(emit).toHaveBeenCalledWith('player:death', expect.objectContaining({
      killedBy: 'Swarm Queen',
      cause: 'npc',
      respawnOptions: { type: 'graveyard' }
    }));
    expect(emit).not.toHaveBeenCalledWith('player:debuff', expect.anything());
  });

  it('claims dead state before settlement and stays non-actionable if settlement fails', () => {
    const player = createPlayer();
    const emit = vi.fn();
    const setPlayerStatus = vi.fn();
    engine.init(
      { to: vi.fn(() => ({ emit })), emit: vi.fn() },
      new Map([['socket-42', player]]),
      { setPlayerStatus }
    );
    combat.handleDeath.mockImplementationOnce(() => {
      expect(player.isDead).toBe(true);
      expect(mining.cancelMining).toHaveBeenCalledWith(42);
      expect(wormhole.cleanupPlayer).toHaveBeenCalledWith(42);
      throw new Error('simulated settlement outage');
    });

    expect(engine.applyQueenAcidBurstDamage(
      { id: 'queen', name: 'Swarm Queen', faction: 'swarm', type: 'swarm_queen' },
      { damage: 80, dotDamage: 10, dotInterval: 1000, dotDuration: 5000 },
      'socket-42',
      player
    )).toBe(true);

    expect(player).toMatchObject({
      isDead: true,
      respawnOptions: { type: 'graveyard' }
    });
    expect(emit).toHaveBeenCalledWith('player:death', expect.objectContaining({
      droppedCargo: [],
      wreckageSpawned: false,
      respawnOptions: { type: 'graveyard', message: 'Returning to The Graveyard...' }
    }));

    // A second queued lethal source observes the claimed state and cannot
    // perform another settlement.
    expect(engine.applyQueenAcidBurstDamage(
      { id: 'queen-2', name: 'Swarm Queen', faction: 'swarm', type: 'swarm_queen' },
      { damage: 80, dotDamage: 10, dotInterval: 1000, dotDuration: 5000 },
      'socket-42',
      player
    )).toBe(false);
    expect(combat.handleDeath).toHaveBeenCalledOnce();
  });

  it('invalidates global listings when death settlement changes escrow', () => {
    const player = createPlayer();
    const emit = vi.fn();
    const marketEmit = vi.fn();
    engine.init(
      { to: vi.fn(() => ({ emit })), emit: marketEmit },
      new Map([['socket-42', player]]),
      { setPlayerStatus: vi.fn() }
    );
    combat.handleDeath.mockReturnValueOnce({
      droppedCargo: [{ resource_type: 'IRON', quantity: 2 }],
      wreckageContents: [],
      respawnOptions: { type: 'graveyard' },
      playerName: 'damage_test',
      marketplaceChanged: true
    });

    engine.applyQueenAcidBurstDamage(
      { id: 'queen', name: 'Swarm Queen', faction: 'swarm', type: 'swarm_queen' },
      { damage: 80, dotDamage: 10, dotInterval: 1000, dotDuration: 5000 },
      'socket-42',
      player
    );

    expect(marketEmit).toHaveBeenCalledWith('market:update', {
      action: 'death_settlement'
    });
  });

  it('reports wreckage only when the in-memory spawn actually succeeds', () => {
    const player = createPlayer();
    const emit = vi.fn();
    engine.init(
      { to: vi.fn(() => ({ emit })), emit: vi.fn() },
      new Map([['socket-42', player]]),
      { setPlayerStatus: vi.fn() }
    );
    combat.handleDeath.mockReturnValueOnce({
      droppedCargo: [{ resource_type: 'IRON', quantity: 2 }],
      wreckageContents: [{ type: 'resource', resourceType: 'IRON', quantity: 1 }],
      respawnOptions: { type: 'graveyard' },
      playerName: 'damage_test',
      marketplaceChanged: false
    });
    loot.spawnWreckage.mockReturnValueOnce(null);

    engine.applyQueenAcidBurstDamage(
      { id: 'queen', name: 'Swarm Queen', faction: 'swarm', type: 'swarm_queen' },
      { damage: 80, dotDamage: 10, dotInterval: 1000, dotDuration: 5000 },
      'socket-42',
      player
    );

    expect(emit).toHaveBeenCalledWith('player:death', expect.objectContaining({
      wreckageSpawned: false
    }));
  });
});
