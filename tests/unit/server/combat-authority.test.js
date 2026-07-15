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
  hasRelic: { get: vi.fn() },
  getShipByUserId: { get: vi.fn() },
  respawnShip: { run: vi.fn() },
  updateShipHealth: { run: vi.fn() }
};
const settleDeathCargo = vi.fn();
const npc = {
  getActiveBase: vi.fn(),
  getActiveBaseWithPosition: vi.fn(),
  getActiveBases: vi.fn(() => new Map()),
  getNPCsInRange: vi.fn(() => []),
  getNPC: vi.fn(),
  removeNPC: vi.fn(),
  destroyBase: vi.fn()
};
const derelict = {
  getDerelictsInRange: vi.fn(() => [])
};
const loot = {
  spawnWreckage: vi.fn()
};

installCommonJsMock('../../../server/database.js', { statements, settleDeathCargo });
installCommonJsMock('../../../server/world.js', {});
installCommonJsMock('../../../server/game/npc.js', npc);
installCommonJsMock('../../../server/game/loot.js', loot);
installCommonJsMock('../../../server/game/derelict.js', derelict);
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const combatPath = require.resolve('../../../server/game/combat.js');
delete require.cache[combatPath];
const combat = require(combatPath);

describe('server combat cooldown authority', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the firing player energy-core tier to the cooldown', () => {
    const playerId = 'cooldown-energy-core-tier-5';
    combat.clearPlayerCombatState(playerId);

    expect(combat.fire(playerId, 1, 5)).toEqual({ success: true });

    vi.advanceTimersByTime(374);
    expect(combat.fire(playerId, 1, 5)).toEqual({
      success: false,
      error: 'Weapon on cooldown'
    });

    vi.advanceTimersByTime(1);
    expect(combat.fire(playerId, 1, 5)).toEqual({ success: true });
  });
});

describe('server shield recharge accumulator', () => {
  const playerIds = [7101, 7102, 7103, 7104];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
    for (const playerId of playerIds) combat.clearPlayerCombatState(playerId);
  });

  afterEach(() => {
    for (const playerId of playerIds) combat.clearPlayerCombatState(playerId);
    vi.useRealTimers();
  });

  it('preserves fractional progress and writes only when integer shield HP advances', () => {
    const playerId = playerIds[0];
    statements.getShipByUserId.get.mockReturnValue({
      hull_hp: 120,
      shield_hp: 10,
      shield_max: 60,
      energy_core_tier: 1
    });

    for (let tick = 0; tick < 6; tick++) {
      expect(combat.updateShieldRecharge(playerId, 50, 1)).toBeNull();
    }

    expect(statements.updateShipHealth.run).not.toHaveBeenCalled();
    expect(combat.updateShieldRecharge(playerId, 50, 1)).toEqual({ shield: 11 });
    expect(statements.getShipByUserId.get).toHaveBeenCalledOnce();
    expect(statements.updateShipHealth.run).toHaveBeenCalledOnce();
    expect(statements.updateShipHealth.run).toHaveBeenCalledWith(120, 11, playerId);
  });

  it('caches a full shield without polling or writing SQLite every tick', () => {
    const playerId = playerIds[1];
    statements.getShipByUserId.get.mockReturnValue({
      hull_hp: 120,
      shield_hp: 60,
      shield_max: 60,
      energy_core_tier: 1
    });

    for (let tick = 0; tick < 20; tick++) {
      expect(combat.updateShieldRecharge(playerId, 50, 1)).toBeNull();
    }

    expect(statements.getShipByUserId.get).toHaveBeenCalledOnce();
    expect(statements.updateShipHealth.run).not.toHaveBeenCalled();
  });

  it('uses the live cached energy-core tier and supports explicit invalidation', () => {
    const playerId = playerIds[2];
    statements.getShipByUserId.get.mockReturnValue({
      hull_hp: 120,
      shield_hp: 10,
      shield_max: 60,
      energy_core_tier: 1
    });

    expect(combat.updateShieldRecharge(playerId, 50, 5)).toBeNull();
    expect(combat.updateShieldRecharge(playerId, 50, 5)).toBeNull();
    expect(combat.updateShieldRecharge(playerId, 50, 5)).toEqual({ shield: 11 });

    combat.invalidateShieldRechargeState(playerId);
    combat.updateShieldRecharge(playerId, 50, 5);

    expect(statements.getShipByUserId.get).toHaveBeenCalledTimes(2);
  });

  it('invalidates cached recharge state when environmental health is persisted', () => {
    const playerId = playerIds[3];
    statements.getShipByUserId.get.mockReturnValue({
      hull_hp: 120,
      shield_hp: 60,
      shield_max: 60,
      energy_core_tier: 1
    });

    expect(combat.updateShieldRecharge(playerId, 50, 1)).toBeNull();
    expect(combat.syncExternalHealth(playerId, 115.8, 48.9)).toBe(true);
    expect(statements.updateShipHealth.run).toHaveBeenLastCalledWith(115, 48, playerId);

    statements.getShipByUserId.get.mockReturnValue({
      hull_hp: 115,
      shield_hp: 48,
      shield_max: 60,
      energy_core_tier: 1
    });
    expect(combat.updateShieldRecharge(playerId, 1000, 1)).toBeNull();
    expect(statements.getShipByUserId.get).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5000);
    combat.updateShieldRecharge(playerId, 50, 1);
    expect(statements.getShipByUserId.get).toHaveBeenCalledTimes(2);
  });
});

describe('Swarm Hive Core respawn authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npc.getNPC.mockReset();
    npc.removeNPC.mockReset();
    loot.spawnWreckage.mockReset();
    npc.getActiveBaseWithPosition.mockImplementation(baseId =>
      npc.getActiveBases()?.get(baseId)
    );
    statements.getShipByUserId.get.mockReturnValue({
      hull_max: 120,
      shield_max: 60
    });
    statements.respawnShip.run.mockReturnValue({ changes: 1 });
    derelict.getDerelictsInRange.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the Graveyard before hive lookup when ownership is missing', () => {
    statements.hasRelic.get.mockReturnValue(undefined);
    npc.getActiveBaseWithPosition.mockReturnValue({
      id: 'forged-hive',
      type: 'swarm_hive',
      faction: 'swarm',
      x: 5000,
      y: 5000,
      destroyed: false
    });

    const result = combat.applyRespawn(424242, 'swarm_hive_core', 'forged-hive');

    expect(statements.hasRelic.get).toHaveBeenCalledWith(424242, 'SWARM_HIVE_CORE');
    expect(npc.getActiveBaseWithPosition).not.toHaveBeenCalled();
    expect(npc.destroyBase).not.toHaveBeenCalled();
    expect(result.locationName).toBe('The Graveyard');
    expect(result.hiveDestruction).toBeUndefined();
    expect(statements.respawnShip.run).toHaveBeenCalledWith(
      result.position.x,
      result.position.y,
      424242
    );
  });

  it('rejects a different live hive than the nearest option issued at death', () => {
    statements.hasRelic.get.mockReturnValue({ relic_type: 'SWARM_HIVE_CORE' });
    npc.getActiveBases.mockReturnValue(new Map([
      ['nearest-hive', {
        type: 'swarm_hive', faction: 'swarm', x: 100, y: 0, destroyed: false
      }],
      ['far-hive', {
        type: 'swarm_hive', faction: 'swarm', x: 5000, y: 0, destroyed: false
      }]
    ]));

    const offered = combat.buildRespawnOptions(424242, { x: 0, y: 0 });
    const result = combat.applyRespawn(
      424242,
      'swarm_hive_core',
      'far-hive',
      offered
    );

    expect(offered).toMatchObject({
      type: 'swarm_hive_core',
      hiveId: 'nearest-hive'
    });
    expect(npc.getActiveBaseWithPosition).toHaveBeenCalledTimes(2);
    expect(npc.destroyBase).not.toHaveBeenCalled();
    expect(result.locationName).toBe('The Graveyard');
  });

  it('destroys only the still-eligible hive matching the issued option', () => {
    const hive = {
      type: 'swarm_hive',
      faction: 'swarm',
      x: 100,
      y: 25,
      destroyed: false
    };
    statements.hasRelic.get.mockReturnValue({ relic_type: 'SWARM_HIVE_CORE' });
    npc.getActiveBases.mockReturnValue(new Map([['nearest-hive', hive]]));
    npc.getActiveBaseWithPosition.mockReturnValue({ ...hive, x: 340, y: 420 });
    npc.getNPCsInRange.mockReturnValue([]);

    const offered = combat.buildRespawnOptions(424242, { x: 0, y: 0 });
    const result = combat.applyRespawn(
      424242,
      'swarm_hive_core',
      'nearest-hive',
      offered
    );

    expect(npc.getActiveBaseWithPosition).toHaveBeenCalledWith('nearest-hive');
    expect(npc.getNPCsInRange).toHaveBeenCalledWith({ x: 340, y: 420 }, 500);
    expect(npc.destroyBase).toHaveBeenCalledWith('nearest-hive');
    expect(result).toMatchObject({
      position: { x: 340, y: 420 },
      locationName: 'Swarm Hive (Destroyed)',
      hiveDestruction: { hiveId: 'nearest-hive' }
    });
  });

  it('kills only live in-radius Swarm NPCs and replenishes neighboring base slots', () => {
    const entities = new Map([
      ['inside-own', {
        id: 'inside-own', type: 'swarm_drone', faction: 'swarm',
        position: { x: 100, y: 0 }, homeBaseId: 'target-hive'
      }],
      ['inside-neighbor', {
        id: 'inside-neighbor', type: 'swarm_worker', faction: 'swarm',
        position: { x: 0, y: 500 }, homeBaseId: 'neighbor-hive'
      }],
      ['outside-own', {
        id: 'outside-own', type: 'swarm_warrior', faction: 'swarm',
        position: { x: 600, y: 0 }, homeBaseId: 'target-hive'
      }],
      ['inside-pirate', {
        id: 'inside-pirate', type: 'pirate_scout', faction: 'pirate',
        position: { x: 50, y: 0 }, homeBaseId: 'pirate-base'
      }]
    ]);
    npc.getNPCsInRange.mockReturnValue([
      ...entities.values(),
      { id: 'stale-query-result', faction: 'swarm', position: { x: 10, y: 0 } }
    ]);
    npc.getNPC.mockImplementation(id => entities.get(id));
    npc.removeNPC.mockImplementation(id => {
      const entity = entities.get(id) || null;
      entities.delete(id);
      return entity;
    });
    loot.spawnWreckage.mockImplementation(entity => ({
      id: `wreck-${entity.id}`,
      position: { ...entity.position },
      size: 20,
      faction: entity.faction,
      npcType: entity.type,
      npcName: entity.type,
      contents: []
    }));

    const result = combat.destroyHiveWithAoE('target-hive', { x: 0, y: 0 });

    expect(result.killedNpcs.map(entity => entity.id)).toEqual([
      'inside-own',
      'inside-neighbor'
    ]);
    expect(entities.has('outside-own')).toBe(true);
    expect(entities.has('inside-pirate')).toBe(true);
    expect(npc.removeNPC).toHaveBeenNthCalledWith(1, 'inside-own', {
      scheduleBaseRespawn: false
    });
    expect(npc.removeNPC).toHaveBeenNthCalledWith(2, 'inside-neighbor', {
      scheduleBaseRespawn: true
    });
    expect(loot.spawnWreckage).toHaveBeenCalledTimes(2);
    expect(npc.destroyBase).toHaveBeenCalledWith('target-hive');
  });

  it('selects the nearest hive from live orbital positions, not stored coordinates', () => {
    const storedBases = new Map([
      ['stored-near', {
        type: 'swarm_hive', faction: 'swarm', x: 10, y: 0, destroyed: false
      }],
      ['live-near', {
        type: 'swarm_hive', faction: 'swarm', x: 5000, y: 0, destroyed: false
      }]
    ]);
    statements.hasRelic.get.mockReturnValue({ relic_type: 'SWARM_HIVE_CORE' });
    npc.getActiveBases.mockReturnValue(storedBases);
    npc.getActiveBaseWithPosition.mockImplementation(baseId => {
      const base = storedBases.get(baseId);
      return baseId === 'stored-near'
        ? { ...base, x: 4000, y: 0 }
        : { ...base, x: 25, y: 0 };
    });

    expect(combat.buildRespawnOptions(424242, { x: 0, y: 0 })).toMatchObject({
      type: 'swarm_hive_core',
      hiveId: 'live-near',
      hivePosition: { x: 25, y: 0 }
    });
  });
});

describe('death settlement boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npc.getActiveBases.mockReturnValue(new Map());
    statements.hasRelic.get.mockReturnValue(undefined);
    settleDeathCargo.mockReturnValue({
      ship: { position_x: 12, position_y: 34 },
      droppedCargo: [{ resource_type: 'IRON', quantity: 4 }],
      marketplaceChanged: true
    });
  });

  it('performs respawn authority reads before committing cargo loss', () => {
    statements.hasRelic.get.mockImplementation(() => {
      throw new Error('simulated respawn lookup failure');
    });

    expect(() => combat.handleDeath(424242, { x: 12, y: 34 }))
      .toThrow('simulated respawn lookup failure');
    expect(settleDeathCargo).not.toHaveBeenCalled();
  });

  it('returns the committed escrow change and deterministic wreckage payload', () => {
    expect(combat.handleDeath(424242, { x: 12, y: 34 })).toMatchObject({
      droppedCargo: [{ resource_type: 'IRON', quantity: 4 }],
      wreckageContents: [{
        type: 'resource',
        resourceType: 'IRON',
        quantity: 2
      }],
      respawnOptions: { type: 'graveyard' },
      marketplaceChanged: true
    });
    expect(settleDeathCargo).toHaveBeenCalledWith(424242);
  });
});
