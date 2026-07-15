import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const activeNPCs = new Map();
const swarmSupportAI = {
  shouldGuardQueen: vi.fn(() => true),
  updateQueenGuard: vi.fn(() => ({ action: 'fire' }))
};
const npc = {
  activeNPCs,
  TEAM_MULTIPLIERS: { 1: 1 },
  getNPC: vi.fn(id => activeNPCs.get(id)),
  damageNPC: vi.fn(),
  getNPCsInRange: vi.fn(() => []),
  getActiveBase: vi.fn(),
  spawnNPCsForSector: vi.fn(() => []),
  isHatching: vi.fn(() => false),
  findAssimilationTarget: vi.fn(() => null),
  reanchorAttachedDrone: vi.fn(() => true),
  updateNPC: vi.fn(() => null),
  updateNPCShieldRecharge: vi.fn(),
  updateNPCInHash: vi.fn(),
  removeNPC: vi.fn(),
  getActiveQueen: vi.fn(() => null),
  applySwarmLinkedDamage: vi.fn(() => [])
};
const combat = {
  calculateDamage: vi.fn(() => ({ shieldDamage: 6, hullDamage: 6 }))
};
const loot = { spawnWreckage: vi.fn() };
const wormhole = { isInTransit: vi.fn(() => false) };

installCommonJsMock('../../../server/game/npc.js', npc);
installCommonJsMock('../../../server/game/combat.js', combat);
installCommonJsMock('../../../server/game/mining.js', {});
installCommonJsMock('../../../server/game/loot.js', loot);
installCommonJsMock('../../../server/game/wormhole.js', wormhole);
installCommonJsMock('../../../server/world.js', {});
installCommonJsMock('../../../server/game/star-damage.js', {});
installCommonJsMock('../../../server/database.js', { statements: {} });
installCommonJsMock('../../../server/game/relic-effects.js', {
  playerHasRelic: vi.fn(() => false),
  calculateFactionDamage: vi.fn(damage => damage)
});
installCommonJsMock('../../../server/game/ai/index.js', {
  getSwarmStrategy: vi.fn(() => swarmSupportAI),
  getFormationStrategy: vi.fn(() => ({ setFormationState: vi.fn() }))
});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn()
});

const enginePath = require.resolve('../../../server/game/engine.js');
delete require.cache[enginePath];
const engine = require(enginePath);

describe('NPC motion authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wormhole.isInTransit.mockReturnValue(false);
    activeNPCs.clear();
    npc.reanchorAttachedDrone.mockImplementation(() => true);
    npc.updateNPC.mockReturnValue(null);
    npc.getActiveQueen.mockReturnValue(null);
  });

  it('simulates NPCs throughout base activation and delivery range, not just adjacent sectors', () => {
    const player = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const scout = {
      id: 'scout-far',
      position: { x: 2500, y: 0 },
      weaponRange: 200,
      aggroRange: 500
    };

    expect(engine.getNpcSimulationRange(scout, player)).toBeGreaterThanOrEqual(3000);
    expect(engine.shouldSimulateNpc(scout, [player])).toBe(true);
    scout.position.x = 3100;
    expect(engine.shouldSimulateNpc(scout, [player])).toBe(false);
  });

  it('keeps high-tier base populations active throughout NPC delivery range', () => {
    for (const radarTier of [4, 5]) {
      const player = { id: radarTier, position: { x: 0, y: 0 }, radarTier };
      expect(engine.getPlayerBaseActivationRange(player))
        .toBeGreaterThan(engine.getPlayerBroadcastRange(player));
    }
  });

  it('writes one canonical velocity used by both network aliases and combat', () => {
    const scout = {
      position: { x: 13.25, y: -4 },
      velocity: { x: 0, y: 0 }
    };

    const velocity = engine.updateNpcVelocity(scout, { x: 10, y: -1 }, 50);

    expect(velocity).toEqual({ x: 65, y: -60 });
    expect(scout.velocity).toEqual({ x: 65, y: -60 });
    expect(scout._vx).toBe(65);
    expect(scout._vy).toBe(-60);
  });

  it('anchors an orbital worm before simulation and suppresses Queen guard movement', () => {
    const emissions = [];
    const player = { id: 42, position: { x: 125, y: 50 }, radarTier: 1 };
    const worm = {
      id: 'orbital-worm',
      type: 'swarm_drone',
      name: 'Assimilation Worm',
      faction: 'swarm',
      attachedToBase: 'orbital-base',
      // The stale point is outside simulation range; re-anchoring must happen
      // before the simulation gate for this entity to produce an update.
      position: { x: 4000, y: 50 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      state: 'attached',
      speed: 150,
      weaponRange: 100,
      aggroRange: 300,
      hull: 50,
      hullMax: 50,
      shield: 0,
      shieldMax: 0
    };
    const queen = {
      id: 'queen-near-worm',
      type: 'swarm_queen',
      faction: 'swarm',
      position: { x: 130, y: 50 },
      hull: 100
    };
    activeNPCs.set(worm.id, worm);
    npc.reanchorAttachedDrone.mockImplementation(entity => {
      entity.position.x = 125;
      entity.position.y = 50;
      return true;
    });
    npc.getActiveQueen.mockReturnValue(queen);
    engine.init({
      to: vi.fn(socketId => ({
        emit: (event, data) => emissions.push({ socketId, event, data })
      }))
    }, new Map([['socket-42', player]]), null);

    engine.updateNPCs(50);

    expect(npc.reanchorAttachedDrone).toHaveBeenCalledWith(worm);
    expect(npc.reanchorAttachedDrone.mock.invocationCallOrder[0])
      .toBeLessThan(npc.updateNPC.mock.invocationCallOrder[0]);
    expect(swarmSupportAI.shouldGuardQueen).not.toHaveBeenCalled();
    expect(swarmSupportAI.updateQueenGuard).not.toHaveBeenCalled();
    expect(npc.updateNPCInHash).toHaveBeenCalledWith(worm.id, worm);
    expect(worm.velocity).toEqual({ x: -77500, y: 0 });

    const batch = emissions.find(({ event }) => event === 'npc:batch');
    expect(batch?.data).toEqual([
      expect.objectContaining({
        id: worm.id,
        x: 125,
        y: 50,
        vx: -77500,
        vy: 0,
        state: 'attached'
      })
    ]);
  });

  it('canonically retires an attached worm whose base no longer exists', () => {
    const player = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const worm = {
      id: 'orphaned-worm',
      type: 'swarm_drone',
      faction: 'swarm',
      attachedToBase: 'missing-base',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      weaponRange: 100,
      aggroRange: 300
    };
    activeNPCs.set(worm.id, worm);
    npc.reanchorAttachedDrone.mockReturnValue(false);
    engine.init(
      { to: vi.fn(() => ({ emit: vi.fn() })) },
      new Map([['socket-42', player]]),
      null
    );

    engine.updateNPCs(50);

    expect(npc.removeNPC).toHaveBeenCalledWith(worm.id);
    expect(npc.updateNPC).not.toHaveBeenCalled();
  });

  it('routes NPC-on-NPC fire through NPC damage and canonical hit broadcasts', () => {
    const emit = vi.fn();
    const observer = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const attacker = {
      id: 'pirate-1',
      type: 'pirate_fighter',
      faction: 'pirate',
      position: { x: 0, y: 0 },
      rotation: 0,
      weaponRange: 280,
      weaponTier: 2,
      weaponDamage: 12,
      shieldPiercing: 0.1
    };
    const target = {
      id: 'miner-1',
      type: 'rogue_miner',
      faction: 'rogue_miner',
      position: { x: 100, y: 0 },
      hull: 90,
      shield: 0,
      damageContributors: new Map()
    };
    activeNPCs.set(attacker.id, attacker);
    activeNPCs.set(target.id, target);
    npc.damageNPC.mockReturnValue({
      destroyed: false,
      hull: 78,
      shield: 0,
      hitShield: false
    });
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', observer]]),
      null
    );

    engine.handleNpcFireAtNpc(attacker, target, {
      action: 'fire',
      target,
      weaponType: 'pirate_heavy_blaster',
      weaponTier: 2,
      baseDamage: 12,
      shieldPiercing: 0.1
    });

    expect(npc.damageNPC).toHaveBeenCalledWith(target.id, 12, null, {
      sourceNpcId: attacker.id,
      shieldPiercing: 0.1
    });
    expect(emit).toHaveBeenCalledWith('combat:npcFire', expect.objectContaining({
      npcId: attacker.id,
      targetNpcId: target.id
    }));
    expect(emit).toHaveBeenCalledWith('combat:npcHit', expect.objectContaining({
      npcId: target.id,
      attackerId: attacker.id,
      damage: 12
    }));
  });

  it('does not advertise damage when an NPC shot is blocked by invulnerability', () => {
    const emit = vi.fn();
    const observer = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const attacker = {
      id: 'pirate-1',
      type: 'pirate_fighter',
      faction: 'pirate',
      position: { x: 0, y: 0 },
      rotation: 0,
      weaponRange: 280,
      weaponTier: 2,
      weaponDamage: 12
    };
    const target = {
      id: 'dread-1',
      type: 'pirate_dreadnought',
      faction: 'pirate',
      position: { x: 100, y: 0 },
      hull: 500,
      shield: 0,
      invulnerableChance: 1,
      damageContributors: new Map()
    };
    activeNPCs.set(attacker.id, attacker);
    activeNPCs.set(target.id, target);
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', observer]]),
      null
    );

    const result = engine.handleNpcFireAtNpc(attacker, target, {
      action: 'fire',
      target,
      baseDamage: 12
    });

    expect(result).toMatchObject({ blocked: true, invulnerable: true });
    expect(npc.damageNPC).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('npc:invulnerable', expect.objectContaining({
      npcId: target.id,
      attackerId: attacker.id
    }));
    expect(emit).toHaveBeenCalledWith('combat:npcFire', expect.objectContaining({
      npcId: attacker.id,
      targetNpcId: target.id,
      hitInfo: null
    }));
  });

  it('sends an explicit visibility retirement after an NPC leaves delivery range', () => {
    const emit = vi.fn();
    const player = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const scout = {
      id: 'scout-visible',
      type: 'pirate_scout',
      name: 'Scout',
      faction: 'pirate',
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      state: 'patrol',
      hull: 40,
      hullMax: 40,
      shield: 20,
      shieldMax: 20,
      weaponRange: 200,
      aggroRange: 500
    };
    activeNPCs.set(scout.id, scout);
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', player]]),
      null
    );
    engine.queueNpcUpdate(scout, {
      id: scout.id,
      type: scout.type,
      name: scout.name,
      faction: scout.faction,
      x: 100,
      y: 0,
      rotation: 0,
      state: 'patrol',
      hull: 40,
      hullMax: 40,
      shield: 20,
      shieldMax: 20,
      vx: 0,
      vy: 0
    });
    engine.flushNpcBatches();
    emit.mockClear();

    scout.position.x = 1200;
    engine.flushNpcBatches();

    expect(emit).toHaveBeenCalledWith('npc:leave', { id: scout.id });
  });

  it('drops a queued update when the NPC is removed later in the same tick', () => {
    const emit = vi.fn();
    const player = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const scout = {
      id: 'scout-destroyed-after-queue',
      position: { x: 100, y: 0 },
      weaponRange: 200,
      aggroRange: 500
    };
    activeNPCs.set(scout.id, scout);
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', player]]),
      null
    );

    engine.queueNpcUpdate(scout, {
      id: scout.id,
      type: 'pirate_scout',
      faction: 'pirate',
      x: 100,
      y: 0,
      rotation: 0,
      state: 'patrol',
      hull: 40,
      shield: 20,
      vx: 10,
      vy: 0
    });
    activeNPCs.delete(scout.id);
    engine.flushNpcBatches();

    expect(emit).toHaveBeenCalledWith('npc:leave', { id: scout.id });
    expect(emit.mock.calls.some(([event]) => event === 'npc:batch')).toBe(false);
  });

  it('retires NPC visibility and suppresses further batches for a dead player', () => {
    const emit = vi.fn();
    const player = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const scout = {
      id: 'scout-dead-observer',
      position: { x: 100, y: 0 },
      weaponRange: 200,
      aggroRange: 500
    };
    const update = {
      id: scout.id,
      type: 'pirate_scout',
      faction: 'pirate',
      x: 100,
      y: 0,
      rotation: 0,
      state: 'patrol',
      hull: 40,
      shield: 20,
      vx: 75,
      vy: 0
    };
    activeNPCs.set(scout.id, scout);
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', player]]),
      null
    );
    engine.queueNpcUpdate(scout, update);
    engine.flushNpcBatches();
    emit.mockClear();

    player.isDead = true;
    engine.flushNpcBatches();
    engine.queueNpcUpdate(scout, update);
    engine.flushNpcBatches();

    expect(emit).toHaveBeenCalledWith('npc:leave', { id: scout.id });
    expect(emit.mock.calls.some(([event]) => event === 'npc:batch')).toBe(false);
  });

  it('retires an explicit spawn even when no batched update arrived before death', () => {
    const emit = vi.fn();
    const player = { id: 42, position: { x: 0, y: 0 }, radarTier: 1 };
    const scout = {
      id: 'spawn-only-scout',
      type: 'pirate_scout',
      faction: 'pirate',
      position: { x: 100, y: 0 },
      weaponRange: 200,
      aggroRange: 500
    };
    activeNPCs.set(scout.id, scout);
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', player]]),
      null
    );

    engine.broadcastNearNpc(scout, 'npc:spawn', {
      id: scout.id,
      type: scout.type,
      faction: scout.faction,
      x: scout.position.x,
      y: scout.position.y
    });
    expect(emit).toHaveBeenCalledWith('npc:spawn', expect.objectContaining({
      id: scout.id
    }));

    emit.mockClear();
    player.isDead = true;
    engine.flushNpcBatches();

    expect(emit).toHaveBeenCalledWith('npc:leave', { id: scout.id });
  });

  it('does not deliver fixed-range NPC spawns to dead or transit players', () => {
    const emit = vi.fn();
    const player = {
      id: 42,
      position: { x: 0, y: 0 },
      radarTier: 1,
      isDead: true
    };
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-42', player]]),
      null
    );

    engine.broadcastInRange({ x: 0, y: 0 }, 2000, 'npc:spawn', {
      id: 'delayed-leviathan'
    });
    expect(emit).not.toHaveBeenCalled();

    player.isDead = false;
    wormhole.isInTransit.mockReturnValueOnce(true);
    engine.broadcastInRange({ x: 0, y: 0 }, 2000, 'npc:spawn', {
      id: 'transit-leviathan'
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('tracks assimilation-created NPC visibility only for live recipients', () => {
    const emissions = [];
    const io = {
      to: vi.fn(socketId => ({
        emit: (event, data) => emissions.push({ socketId, event, data })
      }))
    };
    const alive = { id: 1, position: { x: 0, y: 0 }, radarTier: 1 };
    const dead = { id: 2, position: { x: 0, y: 0 }, radarTier: 1, isDead: true };
    const transit = { id: 3, position: { x: 0, y: 0 }, radarTier: 1 };
    wormhole.isInTransit.mockImplementation(playerId => playerId === transit.id);
    const converted = {
      id: 'converted-defender',
      npcId: 'converted-defender',
      position: { x: 0, y: 0 },
      weaponRange: 200,
      aggroRange: 500
    };
    activeNPCs.set(converted.id, converted);
    engine.init(io, new Map([
      ['alive-socket', alive],
      ['dead-socket', dead],
      ['transit-socket', transit]
    ]), null);

    expect(engine.broadcastBaseAssimilated({
      baseId: 'converted-base',
      newType: 'assimilated_pirate_outpost',
      originalFaction: 'pirate',
      convertedNpcs: [{ id: converted.id, type: 'swarm_drone' }],
      position: { x: 0, y: 0 },
      consumedDroneIds: []
    })).toBe(1);

    expect(emissions.filter(({ event }) => event === 'swarm:baseAssimilated'))
      .toEqual([expect.objectContaining({ socketId: 'alive-socket' })]);

    emissions.length = 0;
    alive.isDead = true;
    engine.flushNpcBatches();
    expect(emissions).toContainEqual({
      socketId: 'alive-socket',
      event: 'npc:leave',
      data: { id: converted.id }
    });
    expect(emissions.some(({ socketId }) =>
      socketId === 'dead-socket' || socketId === 'transit-socket'
    )).toBe(false);
  });
});
