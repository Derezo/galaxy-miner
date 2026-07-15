import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createNpcDelta } = require('../../../server/game/npc-delta');
const { getNpcDamageMultiplier } = require('../../../server/game/npc-combat-modifiers');
const npcSystem = require('../../../server/game/npc');
const LootPools = require('../../../server/game/loot-pools');
const SwarmStrategy = require('../../../server/game/ai/swarm');
const FormationStrategy = require('../../../server/game/ai/formation');
const ai = require('../../../server/game/ai');

function npcUpdate(overrides = {}) {
  return {
    id: 'npc-1',
    type: 'swarm_drone',
    faction: 'swarm',
    x: 10,
    y: 20,
    rotation: 0.5,
    state: 'patrol',
    hull: 50,
    shield: 0,
    vx: 1,
    vy: 2,
    ...overrides
  };
}

describe('NPC delta compression integrity', () => {
  it('keeps the last full-refresh tick across deltas', () => {
    let result = createNpcDelta(null, npcUpdate(), 0, 100);
    expect(result.delta.f).toBe(1);
    expect(result.nextState.lastFullTick).toBe(0);

    for (let tick = 1; tick < 100; tick++) {
      result = createNpcDelta(result.nextState, npcUpdate({ x: 10 + tick }), tick, 100);
      expect(result.delta.f).toBeUndefined();
      expect(result.nextState.lastFullTick).toBe(0);
    }

    result = createNpcDelta(result.nextState, npcUpdate({ x: 110 }), 100, 100);
    expect(result.delta.f).toBe(1);
    expect(result.nextState.lastFullTick).toBe(100);
  });

  it('compares optional beam positions by value and snapshots mutable input', () => {
    const beam = { x: 3, y: 4 };
    const first = createNpcDelta(
      null,
      npcUpdate({ collectingWreckagePos: beam, miningTargetPos: { x: 8, y: 9 } }),
      0,
      100
    );
    beam.x = 99;

    const changed = createNpcDelta(
      first.nextState,
      npcUpdate({ collectingWreckagePos: beam, miningTargetPos: { x: 8, y: 9 } }),
      1,
      100
    );
    expect(changed.delta.collectingWreckagePos).toEqual({ x: 99, y: 4 });
    expect(changed.delta).not.toHaveProperty('miningTargetPos');

    const cleared = createNpcDelta(
      changed.nextState,
      npcUpdate(),
      2,
      100
    );
    expect(cleared.delta.collectingWreckagePos).toBeNull();
    expect(cleared.delta.miningTargetPos).toBeNull();
  });

  it('sends faction conversion identity and max-stat changes without waiting for a full refresh', () => {
    const first = createNpcDelta(null, npcUpdate({
      type: 'void_whisper',
      name: 'Void Whisper',
      faction: 'void',
      hull: 40,
      hullMax: 40,
      shield: 20,
      shieldMax: 20,
      sizeMultiplier: 1,
      phase: 'FORMED'
    }), 1, 100);

    const converted = createNpcDelta(first.nextState, npcUpdate({
      type: 'swarm_drone',
      name: 'Swarm Drone',
      faction: 'swarm',
      hull: 50,
      hullMax: 50,
      shield: 0,
      shieldMax: 0,
      isBoss: false,
      sizeMultiplier: 1.2,
      phase: null
    }), 2, 100);

    expect(converted.delta).toMatchObject({
      type: 'swarm_drone',
      name: 'Swarm Drone',
      faction: 'swarm',
      hull: 50,
      hullMax: 50,
      shield: 0,
      shieldMax: 0,
      isBoss: false,
      sizeMultiplier: 1.2,
      phase: null
    });
    expect(converted.delta.f).toBeUndefined();
  });
});

describe('NPC boss combat modifiers', () => {
  it('combines configured and queen phase damage multipliers', () => {
    expect(getNpcDamageMultiplier(40, 10, 2)).toBe(8);
  });

  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])(
    'treats invalid action multiplier %s as neutral',
    (modifier) => {
      expect(getNpcDamageMultiplier(20, 10, modifier)).toBe(2);
    }
  );
});

describe('Swarm linked-health cleanup contract', () => {
  afterEach(() => {
    npcSystem.activeNPCs.clear();
    npcSystem.assimilationProgress.clear();
  });

  it('retains a linked-health victim for engine death cleanup', () => {
    const source = {
      id: 'source',
      faction: 'swarm',
      linkedHealth: true,
      position: { x: 0, y: 0 },
      hull: 50,
      hullMax: 50,
      damageContributors: new Map()
    };
    const victim = {
      id: 'victim',
      faction: 'swarm',
      linkedHealth: true,
      position: { x: 20, y: 0 },
      hull: 10,
      hullMax: 10,
      attachedToBase: 'hive-1',
      damageContributors: new Map()
    };
    npcSystem.activeNPCs.set(source.id, source);
    npcSystem.activeNPCs.set(victim.id, victim);

    const result = npcSystem.applySwarmLinkedDamage(source, 100, 42);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'victim',
      destroyed: true,
      hull: 0,
      position: { x: 20, y: 0 },
      entity: victim
    });
    expect(npcSystem.activeNPCs.get('victim')).toBe(victim);
    expect(victim.damageContributors.get(42)).toBe(20);
  });

  it('ignores invalid damage and already-dead linked units', () => {
    const source = {
      id: 'source', faction: 'swarm', linkedHealth: true,
      position: { x: 0, y: 0 }, hull: 50
    };
    const dead = {
      id: 'dead', faction: 'swarm', linkedHealth: true,
      position: { x: 1, y: 1 }, hull: 0
    };
    npcSystem.activeNPCs.set(source.id, source);
    npcSystem.activeNPCs.set(dead.id, dead);

    expect(npcSystem.applySwarmLinkedDamage(source, Number.NaN, 42)).toEqual([]);
    expect(npcSystem.applySwarmLinkedDamage(source, 10, 42)).toEqual([]);
  });

  it('detaches a directly killed worm from a retained entity snapshot', () => {
    const retainedDrone = { id: 'worm', attachedToBase: 'base-1' };
    npcSystem.assimilationProgress.set('base-1', {
      attachedDrones: new Set(['worm', 'other-worm'])
    });

    const result = npcSystem.detachDroneFromBase('worm', retainedDrone);

    expect(result).toEqual({
      baseId: 'base-1',
      remainingDrones: 1,
      threshold: expect.any(Number)
    });
    expect(npcSystem.assimilationProgress.get('base-1').attachedDrones.has('worm')).toBe(false);
  });
});

describe('Faction strategy lifecycle', () => {
  it('reuses the dispatcher Swarm strategy for engine support behaviors', () => {
    expect(ai.getSwarmStrategy()).toBe(ai.getStrategy({ faction: 'swarm' }));
    expect(ai.getSwarmStrategy()).toBe(ai.getSwarmStrategy());
  });

  it('preserves base economy and damage state across dormancy', () => {
    const base = {
      id: 'test-dormant-yard',
      type: 'scavenger_yard',
      faction: 'scavenger',
      name: 'Dormant Yard',
      x: 12000,
      y: 12000,
      health: 1000,
      maxHealth: 1000,
      patrolRadius: 2
    };

    npcSystem.activateBase(base);
    const active = npcSystem.activeBases.get(base.id);
    active.health = 640;
    active.scrapPile.contents.push({ type: 'credits', amount: 75 });
    npcSystem.deactivateBase(base.id);

    expect(npcSystem.activeBases.has(base.id)).toBe(false);
    expect(npcSystem.dormantBases.get(base.id).health).toBe(640);

    npcSystem.activateBase(base);
    const reactivated = npcSystem.activeBases.get(base.id);
    expect(reactivated.health).toBe(640);
    expect(reactivated.scrapPile.contents).toEqual([{ type: 'credits', amount: 75 }]);

    npcSystem.deactivateBase(base.id);
    npcSystem.dormantBases.delete(base.id);
  });
});

describe('Scavenger wreckage-theft hook integration', () => {
  const scavengerIds = ['theft-near', 'theft-ally'];

  afterEach(() => {
    const strategy = ai.getScavengerStrategy();
    for (const id of scavengerIds) {
      strategy.cleanup(id);
      npcSystem.activeNPCs.delete(id);
    }
    vi.restoreAllMocks();
  });

  function installScavengers() {
    const near = {
      id: scavengerIds[0],
      type: 'scavenger_scrapper',
      faction: 'scavenger',
      position: { x: 20, y: 0 },
      hull: 100,
      state: 'idle'
    };
    const ally = {
      id: scavengerIds[1],
      type: 'scavenger_salvager',
      faction: 'scavenger',
      position: { x: 50, y: 0 },
      hull: 100,
      state: 'idle'
    };
    npcSystem.activeNPCs.set(near.id, near);
    npcSystem.activeNPCs.set(ally.id, ally);
    return { near, ally };
  }

  it('calls the strategy hook and enrages the nearby scavenger cluster', () => {
    const { near, ally } = installScavengers();
    const strategy = ai.getScavengerStrategy();
    const hook = vi.spyOn(strategy, 'onWreckageCollectedNearby');

    const result = npcSystem.notifyWreckageCollectedNearby(42, { x: 0, y: 0 }, false);

    expect(hook).toHaveBeenCalledWith(
      near,
      42,
      { x: 0, y: 0 },
      [ally],
      false
    );
    expect(result).toMatchObject({
      npc: near,
      action: { reason: 'wreckage_theft', targetId: 42 },
      ignored: false
    });
    expect(near.state).toBe('enraged');
    expect(ally.state).toBe('enraged');
  });

  it('calls the same hook with Scrap Siphon immunity and leaves scavengers passive', () => {
    const { near, ally } = installScavengers();
    const strategy = ai.getScavengerStrategy();
    const hook = vi.spyOn(strategy, 'onWreckageCollectedNearby');

    const result = npcSystem.notifyWreckageCollectedNearby(42, { x: 0, y: 0 }, true);

    expect(hook).toHaveBeenCalledWith(near, 42, { x: 0, y: 0 }, [ally], true);
    expect(result).toMatchObject({ npc: near, action: null, ignored: true });
    expect(near.state).toBe('idle');
    expect(ally.state).toBe('idle');
  });
});

describe('Swarm Queen phase spawn cadence', () => {
  afterEach(() => {
    for (const id of Array.from(npcSystem.activeNPCs.keys())) {
      npcSystem.removeNPC(id);
    }
    vi.useRealTimers();
  });

  it.each([
    ['HUNT', 30000],
    ['SIEGE', 7500],
    ['SWARM', 5000],
    ['DESPERATION', Infinity]
  ])('uses the %s phase spawn-rate multiplier', (phase, expected) => {
    expect(npcSystem.getQueenTimedSpawnCooldown({
      phaseManager: { currentPhase: phase }
    })).toBe(expected);
  });

  it('falls back to the configured cooldown for unknown phase state', () => {
    expect(npcSystem.getQueenTimedSpawnCooldown({ phaseManager: { currentPhase: 'BAD' } }))
      .toBe(npcSystem.QUEEN_SPAWN_CONFIG.spawnCooldown);
  });

  it('uses the accelerated cooldown in timed spawning', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const now = Date.now();
    const queen = {
      id: 'queen',
      type: 'swarm_queen',
      spawnsUnits: true,
      position: { x: 0, y: 0 },
      hull: 60,
      hullMax: 100,
      phaseManager: { currentPhase: 'SIEGE' },
      spawnedMinions: [],
      spawnThresholdsTriggered: [0.75, 0.5, 0.25],
      combatStartTime: now - 20000,
      lastSpawnTime: now - 7500
    };

    const result = npcSystem.updateSwarmQueenSpawning(queen, [{ id: 'player' }], 50);

    expect(result?.type).toBe('time_interval');
    expect(result?.spawned.length).toBeGreaterThan(0);
  });
});

describe('Swarm Queen zero-distance movement', () => {
  function queen() {
    return {
      id: 'queen',
      type: 'swarm_queen',
      faction: 'swarm',
      position: { x: 0, y: 0 },
      hull: 100,
      hullMax: 100,
      speed: 80,
      weaponRange: 300,
      weaponDamage: 40,
      weaponType: 'explosive',
      weaponTier: 4,
      lastFireTime: Date.now()
    };
  }

  const target = {
    id: 'player',
    position: { x: 0, y: 0 },
    hull: 100,
    hullMax: 100
  };

  it('keeps desperation and siege movement finite when target overlaps queen', () => {
    const strategy = new SwarmStrategy();
    strategy.queenCombat = vi.fn(() => null);
    const modifiers = { speedMultiplier: 2, damageMultiplier: 2 };
    const desperationQueen = queen();
    const siegeQueen = queen();

    strategy.desperationPhase(desperationQueen, [target], 50, modifiers);
    strategy.siegePhase(siegeQueen, [target], [{ position: { x: 10, y: 10 } }], 50, modifiers);

    expect(Number.isFinite(desperationQueen.position.x)).toBe(true);
    expect(Number.isFinite(desperationQueen.position.y)).toBe(true);
    expect(Number.isFinite(siegeQueen.position.x)).toBe(true);
    expect(Number.isFinite(siegeQueen.position.y)).toBe(true);
  });

  it('keeps guard interception finite when a player overlaps queen', () => {
    const strategy = new SwarmStrategy();
    const guard = {
      id: 'guard',
      faction: 'swarm',
      type: 'swarm_warrior',
      position: { x: 20, y: 0 },
      hull: 100,
      speed: 100,
      weaponRange: 200,
      weaponDamage: 10,
      weaponType: 'explosive',
      weaponTier: 2,
      lastFireTime: Date.now()
    };

    strategy.updateQueenGuard(guard, queen(), [target], [], 50);

    expect(Number.isFinite(guard.position.x)).toBe(true);
    expect(Number.isFinite(guard.position.y)).toBe(true);
  });
});

describe('Void formation zero-distance movement', () => {
  it('keeps a formation leader finite when its target exactly overlaps it', () => {
    const strategy = new FormationStrategy();
    const leader = {
      id: 'void-overlap-leader',
      type: 'void_phantom',
      faction: 'void',
      formationLeader: true,
      position: { x: 0, y: 0 },
      rotation: 1,
      hull: 100,
      hullMax: 100,
      speed: 100,
      weaponRange: 300,
      weaponDamage: 15,
      weaponType: 'energy',
      weaponTier: 3,
      lastFireTime: Date.now()
    };
    const target = {
      id: 42,
      position: { x: 0, y: 0 },
      distance: 0
    };

    strategy.update(leader, [target], [], 50, {});

    expect(leader.position).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(leader.position.x)).toBe(true);
    expect(Number.isFinite(leader.position.y)).toBe(true);
    expect(Number.isFinite(leader.rotation)).toBe(true);
  });
});

describe('Swarm production lifecycle', () => {
  afterEach(() => {
    const activeQueen = npcSystem.getActiveQueen();
    if (activeQueen) npcSystem.handleQueenDeath(activeQueen.id);
    for (const id of Array.from(npcSystem.activeNPCs.keys())) {
      npcSystem.removeNPC(id);
    }
    npcSystem.activeBases.clear();
    npcSystem.dormantBases.clear();
    npcSystem.assimilatedBases.clear();
  });

  it('preserves template mechanics in base-spawned and converted Swarm units', () => {
    const base = {
      id: 'swarm-factory-base',
      type: 'swarm_hive',
      faction: 'swarm',
      name: 'Factory Hive',
      x: 9000,
      y: 9000,
      patrolRadius: 2,
      spawnedNPCs: [],
      spawnConfig: {
        npcs: ['swarm_drone'],
        weights: [1],
        maxNPCs: 1
      }
    };
    npcSystem.activeBases.set(base.id, base);

    const spawned = npcSystem.spawnNPCFromBase(base.id);
    expect(spawned).toMatchObject({
      type: 'swarm_drone',
      linkedHealth: true,
      deathEffect: 'dissolve',
      creditReward: npcSystem.NPC_TYPES.swarm_drone.creditReward
    });

    const converted = npcSystem.convertNpcToSwarm({
      id: 'converted-1',
      type: 'pirate_fighter',
      faction: 'pirate',
      position: { x: 10, y: 20 },
      x: 10,
      y: 20,
      vx: 0,
      vy: 0,
      isBoss: true,
      shieldPiercing: 0.1,
      invulnerableChance: 0.35
    }, 'swarm_warrior');
    expect(converted).toMatchObject({
      type: 'swarm_warrior',
      faction: 'swarm',
      linkedHealth: true,
      deathEffect: 'dissolve',
      hullMax: npcSystem.NPC_TYPES.swarm_warrior.hull,
      shieldMax: npcSystem.NPC_TYPES.swarm_warrior.shield,
      creditReward: npcSystem.NPC_TYPES.swarm_warrior.creditReward
    });
    expect(converted).not.toHaveProperty('shieldPiercing');
    expect(converted).not.toHaveProperty('invulnerableChance');
    expect(converted).not.toHaveProperty('isBoss');
  });

  it('preserves Pirate combat flags through the generic base factory', () => {
    const base = {
      id: 'pirate-factory-base',
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Factory Outpost',
      x: 12000,
      y: 12000,
      patrolRadius: 2,
      spawnedNPCs: [],
      spawnConfig: {
        npcs: ['pirate_dreadnought'],
        weights: [1],
        maxNPCs: 1
      }
    };
    npcSystem.activeBases.set(base.id, base);

    expect(npcSystem.spawnNPCFromBase(base.id)).toMatchObject({
      type: 'pirate_dreadnought',
      isBoss: true,
      shieldPiercing: npcSystem.NPC_TYPES.pirate_dreadnought.shieldPiercing,
      invulnerableChance: npcSystem.NPC_TYPES.pirate_dreadnought.invulnerableChance
    });
  });

  it('constructs a rewarding spawning Queen and regenerates canonical base health', () => {
    const queen = npcSystem.spawnSwarmQueen({ x: 0, y: 0 });
    const template = npcSystem.NPC_TYPES.swarm_queen;

    expect(queen).toMatchObject({
      velocity: { x: 0, y: 0 },
      creditReward: template.creditReward,
      deathEffect: template.deathEffect,
      spawnsUnits: true,
      linkedHealthMaster: true
    });

    // The position object is the live movement source of truth; x/y are only
    // compatibility snapshots from construction time.
    queen.position.x = 5000;
    queen.position.y = 6000;
    npcSystem.activeBases.set('aura-hive', {
      id: 'aura-hive',
      type: 'swarm_hive',
      faction: 'swarm',
      x: 5000,
      y: 6000,
      health: 50,
      maxHealth: 100,
      hull: 1
    });

    const affected = npcSystem.applyQueenAura(1000);

    expect(affected).toEqual([{
      baseId: 'aura-hive',
      x: 5000,
      y: 6000,
      health: 50.5,
      maxHealth: 100,
      healed: 0.5
    }]);
    expect(npcSystem.activeBases.get('aura-hive').health).toBe(50.5);
    expect(npcSystem.getAssimilationState().activeQueen).toMatchObject({
      x: 5000,
      y: 6000,
      maxHull: template.hull,
      maxShield: template.shield
    });
  });

  it.each([
    'assimilated_pirate_outpost',
    'assimilated_scavenger_yard',
    'assimilated_void_rift',
    'assimilated_mining_claim'
  ])('maps %s destruction to the Swarm base loot profile', (baseType) => {
    expect(LootPools.getMappingForNpc(baseType)).toEqual({
      faction: 'swarm',
      tier: 'base'
    });
    expect(LootPools.generateLoot(baseType).some(item => item.type === 'resource')).toBe(true);
  });
});
