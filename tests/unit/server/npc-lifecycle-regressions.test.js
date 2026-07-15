import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const npcSystem = require('../../../server/game/npc');
const ai = require('../../../server/game/ai');
const world = require('../../../server/world');

function createNpc(id, type, homeBaseId = null) {
  const template = npcSystem.NPC_TYPES[type];
  return {
    id,
    type,
    name: template.name,
    faction: template.faction,
    position: { x: 100, y: 100 },
    velocity: { x: 0, y: 0 },
    hull: template.hull,
    hullMax: template.hull,
    shield: 0,
    shieldMax: template.shield,
    speed: template.speed,
    weaponRange: template.weaponRange,
    aggroRange: template.aggroRange,
    creditReward: template.creditReward,
    damageContributors: new Map(),
    homeBaseId
  };
}

function registerNpc(entity) {
  npcSystem.activeNPCs.set(entity.id, entity);
  npcSystem.insertNPCInHash(entity.id, entity.position.x, entity.position.y);
  return entity;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();

  for (const id of Array.from(npcSystem.activeNPCs.keys())) {
    npcSystem.removeNPC(id);
  }
  npcSystem.activeBases.clear();
  npcSystem.dormantBases.clear();
  npcSystem.formations.clear();
  npcSystem.assimilationProgress.clear();
  npcSystem.assimilatedBases.clear();
  npcSystem.sectorAssimilationCount.clear();

  const pirateStrategy = ai.getPirateStrategy();
  pirateStrategy.scoutingNPCs.clear();
  pirateStrategy.boostDiveNPCs.clear();
  pirateStrategy.captainTargets.clear();
  pirateStrategy.healingNPCs.clear();
  const scavengerStrategy = ai.getScavengerStrategy();
  scavengerStrategy.enragedNPCs.clear();
  scavengerStrategy.collectingNPCs.clear();
  scavengerStrategy.dumpingNPCs.clear();
  scavengerStrategy.returningNPCs.clear();
  const miningStrategy = ai.getMiningStrategy();
  miningStrategy.claimedTargets.clear();
  miningStrategy.miningNPCs.clear();
  miningStrategy.returningNPCs.clear();
  miningStrategy.depositingNPCs.clear();
  miningStrategy.enragedNPCs.clear();
  miningStrategy.rageTargets.clear();
  ai.getFormationStrategy().formationStates.clear();
});

describe('Pirate combat lifecycle', () => {
  it('dispatches damage to Pirate AI and preserves the generic reaction result', () => {
    const pirate = registerNpc(createNpc('pirate-damage-hook', 'pirate_scout'));
    const strategy = ai.getPirateStrategy();
    const reaction = { action: 'pirate:evade', npcId: pirate.id };
    const hook = vi.spyOn(strategy, 'onDamaged').mockImplementation(
      (entity, attackerId, allNPCs) => {
        entity.state = 'evade';
        expect(attackerId).toBe(42);
        expect(allNPCs).toBe(npcSystem.activeNPCs);
        return reaction;
      }
    );

    const result = npcSystem.damageNPC(pirate.id, 1, 42);

    expect(hook).toHaveBeenCalledOnce();
    expect(pirate.state).toBe('evade');
    expect(result).toMatchObject({
      destroyed: false,
      rageAction: null,
      reactionAction: reaction
    });
  });

  it('runs Pirate strategy cleanup during a lethal combat removal', () => {
    const pirate = registerNpc(createNpc('pirate-lethal-cleanup', 'pirate_captain'));
    const strategy = ai.getPirateStrategy();
    strategy.scoutingNPCs.set(pirate.id, { state: 'scouting' });
    strategy.boostDiveNPCs.set(pirate.id, { state: 'diving' });
    strategy.captainTargets.set(pirate.id, { targetId: 42 });
    strategy.healingNPCs.add(pirate.id);

    const result = npcSystem.damageNPC(pirate.id, pirate.hullMax + 1, 42);

    expect(result.destroyed).toBe(true);
    expect(npcSystem.getNPC(pirate.id)).toBeUndefined();
    expect(strategy.scoutingNPCs.has(pirate.id)).toBe(false);
    expect(strategy.boostDiveNPCs.has(pirate.id)).toBe(false);
    expect(strategy.captainTargets.has(pirate.id)).toBe(false);
    expect(strategy.healingNPCs.has(pirate.id)).toBe(false);
  });

  it('retires Pirate strategy state before converting the NPC to Swarm', () => {
    const pirate = registerNpc(createNpc('pirate-conversion-cleanup', 'pirate_scout'));
    const strategy = ai.getPirateStrategy();
    strategy.scoutingNPCs.set(pirate.id, { targetId: 42 });
    pirate.state = 'fleeing';
    pirate.targetPlayer = 42;
    Object.assign(pirate, {
      raidTargetType: 'base',
      raidTargetPos: { x: 200, y: 300 },
      lastTargetSeenTime: Date.now(),
      isRaidingBase: true,
      raidBaseId: 'target-base',
      raidBaseType: 'mining_claim',
      raidBaseStaleSince: Date.now(),
      ignoredIntelReportedAt: Date.now(),
      activeIntelReportedAt: Date.now(),
      lastRaidTarget: 'target-base',
      lastIntelTarget: 'target-base',
      circleAngle: 1.5,
      wanderTarget: { x: 400, y: 500 },
      lastStealTime: Date.now()
    });

    const converted = npcSystem.convertNpcToSwarm(pirate, 'swarm_drone');

    expect(converted).toBe(pirate);
    expect(strategy.scoutingNPCs.has(pirate.id)).toBe(false);
    expect(pirate).toMatchObject({
      type: 'swarm_drone',
      name: npcSystem.NPC_TYPES.swarm_drone.name,
      faction: 'swarm',
      state: 'patrol',
      targetPlayer: null,
      targetNPC: null
    });
    for (const field of [
      'raidTargetType',
      'raidTargetPos',
      'lastTargetSeenTime',
      'isRaidingBase',
      'raidBaseId',
      'raidBaseType',
      'raidBaseStaleSince',
      'ignoredIntelReportedAt',
      'activeIntelReportedAt',
      'lastRaidTarget',
      'lastIntelTarget',
      'circleAngle',
      'wanderTarget',
      'lastStealTime'
    ]) {
      expect(pirate).not.toHaveProperty(field);
    }
  });
});

describe('Pirate base population bookkeeping', () => {
  function createPirateBase(id) {
    return {
      id,
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Lifecycle Outpost',
      x: 100,
      y: 100,
      patrolRadius: 2,
      spawnedNPCs: [],
      pendingRespawns: [],
      pendingScoutRespawns: [],
      lastSpawnTime: Date.now(),
      lastScoutSpawnTime: Date.now()
    };
  }

  it('queues fighters and scouts independently and never respawns special units as fighters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const base = createPirateBase('pirate-lifecycle-base');
    npcSystem.activeBases.set(base.id, base);

    const fighter = registerNpc(createNpc('dead-fighter', 'pirate_fighter', base.id));
    const scout = registerNpc(createNpc('dead-scout', 'pirate_scout', base.id));
    const captain = registerNpc(createNpc('dead-captain', 'pirate_captain', base.id));
    const dreadnought = registerNpc(createNpc('dead-dreadnought', 'pirate_dreadnought', base.id));
    base.spawnedNPCs.push(fighter.id, scout.id, captain.id, dreadnought.id);

    npcSystem.damageNPC(scout.id, scout.hullMax + 1, 42);
    npcSystem.updateBaseSpawning([]);
    expect(base.pendingScoutRespawns).toHaveLength(1);
    expect(base.pendingRespawns).toHaveLength(0);

    npcSystem.damageNPC(captain.id, captain.hullMax + 1, 42);
    npcSystem.damageNPC(dreadnought.id, dreadnought.hullMax + 1, 42);
    npcSystem.updateBaseSpawning([]);
    expect(base.pendingScoutRespawns).toHaveLength(1);
    expect(base.pendingRespawns).toHaveLength(0);

    npcSystem.damageNPC(fighter.id, fighter.hullMax + 1, 42);
    npcSystem.updateBaseSpawning([]);
    expect(base.pendingScoutRespawns).toHaveLength(1);
    expect(base.pendingRespawns).toHaveLength(1);
  });

  it('excludes scouts, captains, and dreadnoughts from the regular fighter cap', () => {
    const base = createPirateBase('pirate-cap-base');
    npcSystem.activeBases.set(base.id, base);

    for (const [id, type] of [
      ['cap-scout-1', 'pirate_scout'],
      ['cap-scout-2', 'pirate_scout'],
      ['cap-captain', 'pirate_captain'],
      ['cap-dreadnought', 'pirate_dreadnought']
    ]) {
      const entity = registerNpc(createNpc(id, type, base.id));
      base.spawnedNPCs.push(entity.id);
    }

    const fighter = npcSystem.spawnNPCFromBase(base.id);

    expect(fighter?.type).toBe('pirate_fighter');
    expect(base.spawnedNPCs).toContain(fighter.id);
    expect(base.spawnedNPCs).toHaveLength(5);
  });
});

describe('scripted NPC removal lifecycle', () => {
  it('replenishes a consumed Void-rift defender after the configured delay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const base = {
      id: 'void-consume-replenishment',
      type: 'void_rift',
      faction: 'void',
      name: 'Consumption Rift',
      x: 20000,
      y: 20000,
      patrolRadius: 2
    };
    npcSystem.activateBase(base);
    const activeBase = npcSystem.getActiveBase(base.id);
    const initialPopulation = activeBase.spawnedNPCs.length;
    const consumedNpc = npcSystem.getNPC(activeBase.spawnedNPCs[0]);
    const respawnDelay = npcSystem.BASE_NPC_SPAWNS.void_rift.respawnDelay;

    expect(npcSystem.removeNPC(consumedNpc.id, {
      scheduleBaseRespawn: true
    })).toBe(consumedNpc);
    expect(npcSystem.getNPC(consumedNpc.id)).toBeUndefined();
    expect(activeBase.spawnedNPCs).not.toContain(consumedNpc.id);
    expect(activeBase.pendingRespawns).toEqual([
      { respawnAt: Date.now() + respawnDelay }
    ]);

    vi.advanceTimersByTime(respawnDelay - 1);
    npcSystem.updateBaseSpawning([]);
    expect(activeBase.spawnedNPCs).toHaveLength(initialPopulation - 1);
    expect(activeBase.pendingRespawns).toHaveLength(1);

    vi.advanceTimersByTime(1);
    npcSystem.updateBaseSpawning([]);
    expect(activeBase.spawnedNPCs).toHaveLength(initialPopulation);
    expect(activeBase.pendingRespawns).toHaveLength(0);
  });

  it('orphans Hive Core survivors instead of deleting them with their base', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const base = {
      id: 'hive-core-survivor-base',
      type: 'swarm_hive',
      faction: 'swarm',
      name: 'Imploding Hive',
      x: 0,
      y: 0,
      spawnedNPCs: [],
      pendingRespawns: []
    };
    npcSystem.activeBases.set(base.id, base);
    const survivor = registerNpc(createNpc(
      'hive-core-outside-radius',
      'swarm_warrior',
      base.id
    ));
    survivor.position = { x: 600, y: 0 };
    survivor.spawnPoint = { ...survivor.position };
    npcSystem.updateNPCInHash(survivor.id, survivor);
    base.spawnedNPCs.push(survivor.id);

    const result = npcSystem.destroyBase(base.id);

    expect(result).toEqual({ orphanedNpcIds: [survivor.id] });
    expect(base.destroyed).toBe(true);
    expect(base.spawnedNPCs).toEqual([]);
    expect(npcSystem.getNPC(survivor.id)).toBe(survivor);
    expect(survivor).toMatchObject({
      homeBaseId: null,
      homeBasePosition: null,
      orphaned: true,
      state: 'rage'
    });
    expect(npcSystem.getNPCsInRange({ x: 600, y: 0 }, 1)
      .map(entity => entity.id)).toContain(survivor.id);
  });
});

describe('base destruction formation lifecycle', () => {
  it('orphans a living Void formation without manufacturing leader deaths', () => {
    const base = {
      id: 'void-base-destruction-formation',
      type: 'void_rift',
      faction: 'void',
      name: 'Formation Rift',
      x: 100,
      y: 100,
      health: 100,
      maxHealth: 100,
      spawnedNPCs: [],
      pendingRespawns: [],
      damageContributors: new Map()
    };
    npcSystem.activeBases.set(base.id, base);
    const leader = registerNpc(createNpc('living-void-leader', 'void_phantom', base.id));
    const follower = registerNpc(createNpc('living-void-follower', 'void_whisper', base.id));
    base.spawnedNPCs.push(leader.id, follower.id);
    const formationId = npcSystem.registerFormation(leader.id, [follower.id]);
    leader.formationId = formationId;
    leader.formationLeader = true;
    leader.isFormationLeader = true;
    follower.formationId = formationId;
    follower.formationLeader = false;
    follower.isFormationLeader = false;

    const result = npcSystem.damageBase(base.id, 100, 42);

    expect(result.destroyed).toBe(true);
    expect(result.orphanedNpcIds).toEqual([leader.id, follower.id]);
    expect(npcSystem.getFormationForNpc(leader.id)).toMatchObject({
      formationId,
      leaderId: leader.id,
      isLeader: true
    });
    expect(npcSystem.getFormationForNpc(follower.id)).toMatchObject({
      formationId,
      leaderId: leader.id,
      isLeader: false
    });
    expect(leader.formationLeader).toBe(true);
    expect(follower.formationLeader).toBe(false);
    expect(npcSystem.getNPC(leader.id)).toBe(leader);
    expect(npcSystem.getNPC(follower.id)).toBe(follower);
  });
});

describe('assimilation conversion lifecycle', () => {
  it('selects only living non-Swarm bases for assimilation', () => {
    const drone = createNpc('assimilation-selector', 'swarm_drone');
    drone.position = { x: 20000, y: 20000 };
    const candidates = [
      {
        id: 'destroyed-target',
        type: 'pirate_outpost',
        faction: 'pirate',
        x: 20020,
        y: 20000,
        health: 100,
        destroyed: true
      },
      {
        id: 'zero-health-target',
        type: 'scavenger_yard',
        faction: 'scavenger',
        x: 20040,
        y: 20000,
        health: 0,
        destroyed: false
      },
      {
        id: 'swarm-target',
        type: 'swarm_hive',
        faction: 'swarm',
        x: 20060,
        y: 20000,
        health: 100,
        destroyed: false
      },
      {
        id: 'live-target',
        type: 'mining_claim',
        faction: 'rogue_miner',
        x: 20200,
        y: 20000,
        health: 100,
        destroyed: false
      }
    ];
    for (const base of candidates) npcSystem.activeBases.set(base.id, base);

    expect(npcSystem.findAssimilationTarget(drone, 500)).toMatchObject({
      id: 'live-target'
    });

    candidates.at(-1).isAssimilated = true;
    expect(npcSystem.findAssimilationTarget(drone, 500)).toBeNull();
  });

  it('revalidates base life and faction before attaching a drone', () => {
    const wreck = {
      id: 'zero-health-assimilation-wreck',
      type: 'pirate_outpost',
      faction: 'pirate',
      x: 20000,
      y: 20000,
      health: 0,
      maxHealth: 1000,
      destroyed: false,
      spawnedNPCs: [],
      pendingRespawns: []
    };
    npcSystem.activeBases.set(wreck.id, wreck);
    const drones = Array.from({ length: 3 }, (_, index) =>
      registerNpc(createNpc(`rejected-worm-${index}`, 'swarm_drone'))
    );

    for (const drone of drones) {
      expect(npcSystem.attachDroneToBase(drone.id, wreck.id)).toEqual({
        success: false,
        reason: 'invalid_target'
      });
      expect(drone).not.toHaveProperty('attachedToBase');
    }

    expect(npcSystem.assimilationProgress.has(wreck.id)).toBe(false);
    expect(npcSystem.assimilatedBases.has(wreck.id)).toBe(false);
    expect(npcSystem.getActiveQueen()).toBeNull();

    wreck.health = wreck.maxHealth;
    wreck.faction = 'swarm';
    expect(npcSystem.attachDroneToBase(drones[0].id, wreck.id)).toEqual({
      success: false,
      reason: 'invalid_target'
    });
    wreck.faction = 'pirate';
    wreck.isAssimilated = true;
    expect(npcSystem.attachDroneToBase(drones[0].id, wreck.id)).toEqual({
      success: false,
      reason: 'invalid_target'
    });
  });

  it('keeps attached worms anchored to an orbiting converted base and non-combat', () => {
    let orbitalPosition = { x: 20000, y: 20000 };
    const base = {
      id: 'worm-persistence-conversion',
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Worm Target',
      x: 20000,
      y: 20000,
      health: 1000,
      maxHealth: 1000,
      destroyed: false,
      spawnedNPCs: [],
      pendingRespawns: []
    };
    vi.spyOn(world, 'getObjectPosition').mockImplementation(baseId =>
      baseId === base.id ? { ...orbitalPosition } : null
    );
    npcSystem.activeBases.set(base.id, base);
    const drones = Array.from({ length: 3 }, (_, index) =>
      registerNpc(createNpc(`persistent-worm-${index}`, 'swarm_drone'))
    );

    let result;
    for (const drone of drones) {
      result = npcSystem.attachDroneToBase(drone.id, base.id);
      expect(result.success).toBe(true);
    }
    expect(result).toMatchObject({ isComplete: true });
    expect(result.conversion).toBeTruthy();
    expect(base).toMatchObject({ faction: 'swarm', isAssimilated: true });

    const worm = drones[0];
    const attachmentOffset = { ...worm.attachmentOffset };
    expect(attachmentOffset).toEqual({ x: 30, y: 0 });
    orbitalPosition = { x: 20125, y: 19925 };
    worm.targetPlayer = 42;
    worm.targetNPC = 'enemy-npc';
    worm.velocity = { x: 90, y: -45 };
    worm.vx = 90;
    worm.vy = -45;

    const action = npcSystem.updateNPC(worm, [{
      id: 42,
      position: { x: worm.position.x + 5, y: worm.position.y },
      hull: 100,
      hullMax: 100
    }], 50);

    expect(action).toBeNull();
    expect(worm).toMatchObject({
      state: 'attached',
      targetPlayer: null,
      targetNPC: null,
      position: {
        x: orbitalPosition.x + attachmentOffset.x,
        y: orbitalPosition.y + attachmentOffset.y
      },
      attachmentOffset,
      velocity: { x: 0, y: 0 },
      vx: 0,
      vy: 0
    });
    expect(ai.getSwarmStrategy().shouldGuardQueen(worm, {
      id: 'nearby-queen',
      type: 'swarm_queen',
      position: { x: worm.position.x, y: worm.position.y },
      hull: 100
    })).toBe(false);
  });

  it('reanchors an active worm while its orbital target base is dormant', () => {
    const base = {
      id: 'dormant-worm-target',
      type: 'assimilated_pirate_outpost',
      faction: 'swarm',
      x: 1000,
      y: 1000,
      health: 1000,
      destroyed: false,
      dormantNPCs: []
    };
    const worm = registerNpc(createNpc('dormant-target-worm', 'swarm_drone'));
    Object.assign(worm, {
      attachedToBase: base.id,
      attachmentOffset: { x: 30, y: -10 }
    });
    npcSystem.dormantBases.set(base.id, base);
    vi.spyOn(world, 'getObjectPosition').mockImplementation(id =>
      id === base.id ? { x: 1800, y: 1400 } : null
    );

    expect(npcSystem.reanchorAttachedDrone(worm)).toBe(true);
    expect(worm.position).toEqual({ x: 1830, y: 1390 });
  });

  it('clears Scavenger collection state and stranded cargo', () => {
    const scavenger = registerNpc(createNpc(
      'conversion-scavenger-runtime',
      'scavenger_collector'
    ));
    const strategy = ai.getScavengerStrategy();
    Object.assign(scavenger, {
      state: 'returning',
      targetWreckageId: 'wreckage-1',
      collectingWreckagePos: { x: 120, y: 130 },
      carriedWreckage: [{ wreckageId: 'wreckage-1', contents: [{ type: 'iron' }] }],
      patrolTarget: { x: 300, y: 400 },
      drillCharging: true,
      drillChargeStart: Date.now()
    });
    strategy.collectingNPCs.set(scavenger.id, {
      wreckageId: 'wreckage-1',
      startTime: Date.now(),
      duration: 1500
    });
    strategy.returningNPCs.add(scavenger.id);
    strategy.dumpingNPCs.set(scavenger.id, {
      startTime: Date.now(),
      duration: 1000
    });

    const converted = npcSystem.convertNpcToSwarm(scavenger, 'swarm_warrior');

    expect(converted).toBe(scavenger);
    expect(scavenger).toMatchObject({
      faction: 'swarm',
      state: 'patrol',
      collectingWreckagePos: null
    });
    expect(strategy.collectingNPCs.has(scavenger.id)).toBe(false);
    expect(strategy.returningNPCs.has(scavenger.id)).toBe(false);
    expect(strategy.dumpingNPCs.has(scavenger.id)).toBe(false);
    for (const field of [
      'targetWreckageId',
      'carriedWreckage',
      'patrolTarget',
      'drillCharging',
      'drillChargeStart'
    ]) {
      expect(scavenger).not.toHaveProperty(field);
    }
  });

  it('clears Miner target, haul, and generic rage state during conversion', () => {
    const miner = registerNpc(createNpc(
      'conversion-miner-runtime',
      'rogue_driller'
    ));
    const strategy = ai.getMiningStrategy();
    Object.assign(miner, {
      state: 'returning',
      miningTargetId: 'claim-asteroid-1',
      miningTargetPos: { x: 500, y: 600 },
      miningTargetSize: 80,
      miningTargetType: 'asteroid',
      miningTargetIsOrbital: false,
      hasHaul: true,
      patrolTarget: { x: 700, y: 800 },
      orphaned: true,
      orphanedAt: Date.now() - 120000,
      baseAggroRange: 350,
      rageMultiplier: 1.25,
      rageExpires: Date.now() + 30000,
      originalAggroRange: 350,
      originalSpeed: 80
    });
    strategy.claimedTargets.set(miner.miningTargetId, miner.id);
    strategy.returningNPCs.add(miner.id);
    strategy.enragedNPCs.set(miner.id, {
      targetId: 42,
      targetType: 'player',
      enragedAt: Date.now()
    });
    strategy.rageTargets.set(42, new Set([miner.id]));
    strategy.rageTargets.set(84, new Set([miner.id, 'other-miner']));

    const converted = npcSystem.convertNpcToSwarm(miner, 'swarm_worker');

    expect(converted).toBe(miner);
    expect(miner).toMatchObject({
      faction: 'swarm',
      state: 'patrol',
      miningTargetPos: null,
      speed: npcSystem.NPC_TYPES.swarm_worker.speed,
      aggroRange: npcSystem.NPC_TYPES.swarm_worker.aggroRange
    });
    expect(strategy.claimedTargets.has('claim-asteroid-1')).toBe(false);
    expect(strategy.returningNPCs.has(miner.id)).toBe(false);
    expect(strategy.enragedNPCs.has(miner.id)).toBe(false);
    expect(strategy.rageTargets.has(42)).toBe(false);
    expect(strategy.rageTargets.get(84)).toEqual(new Set(['other-miner']));
    for (const field of [
      'miningTargetId',
      'miningTargetSize',
      'miningTargetType',
      'miningTargetIsOrbital',
      'hasHaul',
      'patrolTarget',
      'orphaned',
      'orphanedAt',
      'baseAggroRange',
      'rageMultiplier',
      'rageExpires',
      'originalAggroRange',
      'originalSpeed'
    ]) {
      expect(miner).not.toHaveProperty(field);
    }
  });

  it('dissolves old Void authority and returns complete client snapshots', () => {
    const base = {
      id: 'void-assimilation-conversion',
      type: 'void_rift',
      faction: 'void',
      name: 'Converted Rift',
      x: 20000,
      y: 20000,
      spawnedNPCs: [],
      pendingRespawns: []
    };
    npcSystem.activeBases.set(base.id, base);
    const leader = registerNpc(createNpc('conversion-void-leader', 'void_phantom', base.id));
    const follower = registerNpc(createNpc('conversion-void-follower', 'void_whisper', base.id));
    leader.velocity = { x: 12, y: -3 };
    follower.velocity = { x: -4, y: 2 };
    base.spawnedNPCs.push(leader.id, follower.id);
    const formationId = npcSystem.registerFormation(leader.id, [follower.id]);
    for (const entity of [leader, follower]) {
      entity.formationId = formationId;
      entity.formationLeader = entity === leader;
      entity.isFormationLeader = entity === leader;
    }
    ai.getFormationStrategy().setFormationState(
      formationId,
      'confusion',
      follower.id
    );

    const result = npcSystem.convertBaseToSwarm(base.id, base);

    expect(result.convertedNpcs).toHaveLength(2);
    expect(result.convertedNpcs[0]).toMatchObject({
      id: leader.id,
      npcId: leader.id,
      oldType: 'void_phantom',
      oldFaction: 'void',
      type: 'swarm_warrior',
      newType: 'swarm_warrior',
      faction: 'swarm',
      hullMax: npcSystem.NPC_TYPES.swarm_warrior.hull,
      shieldMax: npcSystem.NPC_TYPES.swarm_warrior.shield,
      vx: 12,
      vy: -3,
      formationLeader: false
    });
    expect(npcSystem.getFormationForNpc(leader.id)).toBeNull();
    expect(npcSystem.getFormationForNpc(follower.id)).toBeNull();
    expect(npcSystem.formations.has(formationId)).toBe(false);
    expect(ai.getFormationStrategy().formationStates.has(formationId)).toBe(false);
    expect(leader).not.toHaveProperty('formationId');
    expect(follower).not.toHaveProperty('formationId');
    expect(leader).toMatchObject({ faction: 'swarm', state: 'patrol' });
    expect(follower).toMatchObject({ faction: 'swarm', state: 'patrol' });
  });
});

describe('Void succession reformation', () => {
  it('anchors the promoted leader and resolves distant followers from the authoritative map', () => {
    const strategy = ai.getFormationStrategy();
    const formationId = 'authoritative-reformation';
    const leader = {
      id: 'promoted-leader',
      faction: 'void',
      formationId,
      formationLeader: true,
      position: { x: 0, y: 0 },
      rotation: 0,
      speed: 100,
      hullMax: 100
    };
    const follower = {
      id: 'distant-follower',
      faction: 'void',
      formationId,
      formationLeader: false,
      position: { x: 1000, y: 0 },
      rotation: 0,
      speed: 100,
      hullMax: 50
    };
    const stateInfo = { state: 'reforming', newLeaderId: leader.id };
    const context = { allNPCs: new Map([[leader.id, leader], [follower.id, follower]]) };
    const follow = vi.spyOn(strategy, 'followLeader');
    const confusion = vi.spyOn(strategy, 'updateConfusion');

    expect(strategy.updateReformation(leader, [], 50, stateInfo, context)).toBeNull();
    expect(leader.state).toBe('reforming');
    expect(follow).not.toHaveBeenCalled();
    expect(confusion).not.toHaveBeenCalled();

    expect(strategy.updateReformation(follower, [], 50, stateInfo, context)).toBeNull();
    expect(follow).toHaveBeenCalledWith(follower, leader, expect.any(Number), 50);
    expect(confusion).not.toHaveBeenCalled();
  });
});

describe('Dormant orbital base restoration', () => {
  it('moves dormant NPC positions and local anchors with their orbiting base', () => {
    let basePosition = { x: 1000, y: 2000 };
    vi.spyOn(world, 'getObjectPosition').mockImplementation(() => ({ ...basePosition }));
    const base = {
      id: 'orbital-pirate-lifecycle-base',
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Orbital Lifecycle Outpost',
      x: 0,
      y: 0,
      patrolRadius: 2
    };

    npcSystem.activateBase(base);
    const activeBase = npcSystem.getActiveBase(base.id);
    const fighter = npcSystem.getNPC(activeBase.spawnedNPCs[0]);
    fighter.position = { x: basePosition.x + 75, y: basePosition.y - 40 };
    fighter.spawnPoint = { ...fighter.position };

    npcSystem.deactivateBase(base.id);
    basePosition = { x: 1600, y: 2250 };
    npcSystem.activateBase(base);

    const restored = npcSystem.getNPC(fighter.id);
    expect(restored.position).toEqual({ x: 1675, y: 2210 });
    expect(restored.spawnPoint).toEqual({ x: 1675, y: 2210 });
    expect(restored.homeBasePosition).toEqual(basePosition);
    expect(npcSystem.getNPCsInRange(restored.position, 1).map(entity => entity.id))
      .toContain(restored.id);
  });
});
