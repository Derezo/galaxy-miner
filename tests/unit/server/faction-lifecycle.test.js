import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const npcSystem = require('../../../server/game/npc');
const ai = require('../../../server/game/ai');
const {
  createNpcSpawnPayload,
  createRogueMinerRageEvent,
  createConsumedNpcDestroyedPayload,
  createVoidMinionRiftPositions
} = require('../../../server/game/npc-event-payloads');

let baseCounter = 0;

function createBase(type, faction) {
  baseCounter += 1;
  return {
    id: `faction-lifecycle-${type}-${baseCounter}`,
    type,
    faction,
    name: `Test ${type}`,
    x: 20000 + baseCounter * 100,
    y: 20000,
    size: 80,
    health: 1000,
    maxHealth: 1000,
    patrolRadius: 2
  };
}

afterEach(() => {
  vi.useRealTimers();
  const ids = Array.from(npcSystem.activeNPCs.keys());
  for (const id of ids) {
    ai.getScavengerStrategy()?.cleanup?.(id);
    ai.getMiningStrategy()?.cleanup?.(id);
    npcSystem.removeNPC(id);
  }
  npcSystem.activeBases.clear();
  npcSystem.dormantBases.clear();
  npcSystem.formations.clear();
  ai.getFormationStrategy().formationStates.clear();
});

describe('Scavenger boss lifecycle', () => {
  it('transforms a Hauler without losing rewards, death visuals, cargo, or its base slot', () => {
    const base = createBase('scavenger_yard', 'scavenger');
    npcSystem.activateBase(base);
    const activeBase = npcSystem.getActiveBase(base.id);
    const hauler = npcSystem.spawnHauler(base.id);
    hauler.carriedWreckage = [
      { wreckageId: 'wreck-1', contents: [{ type: 'IRON', quantity: 2 }] }
    ];
    const populationBefore = activeBase.spawnedNPCs.length;

    const king = npcSystem.transformHaulerToBarnacleKing(hauler.id);

    expect(king).toMatchObject({
      type: 'scavenger_barnacle_king',
      creditReward: npcSystem.NPC_TYPES.scavenger_barnacle_king.creditReward,
      deathEffect: npcSystem.NPC_TYPES.scavenger_barnacle_king.deathEffect,
      isBoss: true
    });
    expect(king.carriedWreckage).toEqual(hauler.carriedWreckage);
    expect(npcSystem.activeNPCs.has(hauler.id)).toBe(false);
    expect(npcSystem.activeNPCs.get(king.id)).toBe(king);
    expect(activeBase.spawnedNPCs).not.toContain(hauler.id);
    expect(activeBase.spawnedNPCs).toContain(king.id);
    expect(activeBase.spawnedNPCs).toHaveLength(populationBefore);

    npcSystem.damageNPC(king.id, king.hullMax + 1, 7);
    expect(activeBase.hasHauler).toBe(false);
  });

  it('restores the same special NPC identity and state after base dormancy', () => {
    const base = createBase('scavenger_yard', 'scavenger');
    npcSystem.activateBase(base);
    const hauler = npcSystem.spawnHauler(base.id);
    hauler.hull = 123;
    hauler.sizeMultiplier = 2.2;
    hauler.carriedWreckage = [{ wreckageId: 'kept' }];

    npcSystem.deactivateBase(base.id);
    npcSystem.activateBase(base);

    const restored = npcSystem.getNPC(hauler.id);
    expect(restored).toBe(hauler);
    expect(restored).toMatchObject({
      hull: 123,
      sizeMultiplier: 2.2,
      carriedWreckage: [{ wreckageId: 'kept' }]
    });
    expect(npcSystem.getActiveBase(base.id).spawnedNPCs).toContain(hauler.id);
  });
});

describe('Void formation and rift lifecycle', () => {
  it('registers a live base formation and promotes a real surviving member', () => {
    const base = createBase('void_rift', 'void');
    npcSystem.activateBase(base);
    const activeBase = npcSystem.getActiveBase(base.id);
    const entities = activeBase.spawnedNPCs.map(id => npcSystem.getNPC(id));
    const leaders = entities.filter(entity => entity.formationLeader);

    expect(leaders).toHaveLength(1);
    const leader = leaders[0];
    const formation = npcSystem.getFormationForNpc(leader.id);
    expect(formation).toMatchObject({ isLeader: true });
    expect(formation.memberIds.size).toBe(entities.length - 1);
    for (const entity of entities) {
      expect(entity.formationId).toBe(formation.formationId);
    }

    npcSystem.damageNPC(
      leader.id,
      leader.hullMax + leader.shieldMax + 1,
      9
    );
    const succession = npcSystem.handleLeaderDeath(formation.formationId);

    expect(succession.success).toBe(true);
    expect(npcSystem.getNPC(succession.newLeader.id).formationLeader).toBe(true);
    expect(npcSystem.getFormationForNpc(succession.newLeader.id)).toMatchObject({
      formationId: formation.formationId,
      isLeader: true
    });
  });

  it('advances authoritative succession through confusion and reformation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = ai.getFormationStrategy();
    const member = { id: 'new-leader', formationId: 'formation-test' };
    strategy.setFormationState('formation-test', 'confusion', member.id);

    expect(strategy.getFormationState(member).state).toBe('confusion');
    vi.advanceTimersByTime(1000);
    strategy.cleanupFormationStates();
    expect(strategy.getFormationState(member).state).toBe('reforming');
    vi.advanceTimersByTime(2000);
    strategy.cleanupFormationStates();
    expect(strategy.getFormationState(member)).toBeNull();
  });

  it('enforces the base cap for rift reinforcements and frees the correct slot', () => {
    const base = createBase('void_rift', 'void');
    npcSystem.activateBase(base);
    const activeBase = npcSystem.getActiveBase(base.id);
    const maxNPCs = npcSystem.BASE_NPC_SPAWNS.void_rift.maxNPCs;

    while (activeBase.spawnedNPCs.length < maxNPCs) {
      expect(npcSystem.spawnVoidNPCFromRift(
        'void_whisper',
        { x: base.x, y: base.y },
        { baseId: base.id, spawnPoint: { x: base.x, y: base.y } }
      )).not.toBeNull();
    }

    expect(npcSystem.spawnVoidNPCFromRift(
      'void_whisper',
      { x: base.x, y: base.y },
      { baseId: base.id }
    )).toBeNull();

    const removedId = activeBase.spawnedNPCs.find(id =>
      !npcSystem.getNPC(id).formationLeader
    );
    npcSystem.removeNPC(removedId);
    expect(activeBase.spawnedNPCs).not.toContain(removedId);
    expect(npcSystem.spawnVoidNPCFromRift(
      'void_shadow',
      { x: base.x, y: base.y },
      { baseId: base.id }
    )).not.toBeNull();
    expect(activeBase.spawnedNPCs).toHaveLength(maxNPCs);
  });
});

describe('canonical NPC removal', () => {
  it('clears the Queen singleton and spatial entry used by Hive Core AoE', () => {
    const queen = npcSystem.spawnSwarmQueen({ x: 321, y: 654 });

    expect(npcSystem.getActiveQueen()).toBe(queen);
    expect(npcSystem.getNPCsInRange(queen.position, 1).map(entity => entity.id))
      .toContain(queen.id);

    expect(npcSystem.removeNPC(queen.id)).toBe(queen);
    expect(npcSystem.getActiveQueen()).toBeNull();
    expect(npcSystem.getNPCsInRange(queen.position, 1).map(entity => entity.id))
      .not.toContain(queen.id);
  });

  it('self-heals a stale Queen singleton left by a legacy direct deletion', () => {
    const queen = npcSystem.spawnSwarmQueen({ x: 700, y: 800 });
    npcSystem.activeNPCs.delete(queen.id);

    expect(npcSystem.getActiveQueen()).toBeNull();

    // The self-heal owns singleton state; explicitly clear the intentionally
    // orphaned hash entry created by this legacy-path simulation.
    npcSystem.removeNPCFromHash(queen.id);
  });

  it('releases base and faction-AI slots during non-combat despawn', () => {
    const id = 'canonical-hauler-despawn';
    const base = {
      ...createBase('scavenger_yard', 'scavenger'),
      spawnedNPCs: [id],
      hasHauler: true,
      pendingHaulerBroadcast: { haulerId: id, timestamp: Date.now() }
    };
    const hauler = {
      id,
      type: 'scavenger_hauler',
      faction: 'scavenger',
      homeBaseId: base.id,
      position: { x: base.x, y: base.y },
      hull: 100,
      hullMax: 100
    };
    const strategy = ai.getScavengerStrategy();
    npcSystem.activeBases.set(base.id, base);
    npcSystem.activeNPCs.set(id, hauler);
    npcSystem.insertNPCInHash(id, hauler.position.x, hauler.position.y);
    strategy.enragedNPCs.set(id, { targetId: 9, enragedAt: Date.now() });
    strategy.collectingNPCs.set(id, { wreckageId: 'wreck', startTime: Date.now() });

    expect(npcSystem.removeNPC(id)).toBe(hauler);
    expect(base.spawnedNPCs).not.toContain(id);
    expect(base.hasHauler).toBe(false);
    expect(base.pendingHaulerBroadcast).toBeUndefined();
    expect(strategy.enragedNPCs.has(id)).toBe(false);
    expect(strategy.collectingNPCs.has(id)).toBe(false);
    expect(npcSystem.getNPCsInRange(hauler.position, 1)).toEqual([]);
  });

  it('promotes a live formation member and dissolves the final empty formation', () => {
    const leader = {
      id: 'canonical-void-leader',
      type: 'void_phantom',
      name: 'Canonical Phantom',
      faction: 'void',
      position: { x: 50, y: 50 },
      hull: 100,
      hullMax: 100,
      formationLeader: true,
      isFormationLeader: true
    };
    const member = {
      id: 'canonical-void-member',
      type: 'void_shadow',
      name: 'Canonical Shadow',
      faction: 'void',
      position: { x: 60, y: 50 },
      hull: 100,
      hullMax: 100,
      formationLeader: false,
      isFormationLeader: false
    };
    for (const entity of [leader, member]) {
      npcSystem.activeNPCs.set(entity.id, entity);
      npcSystem.insertNPCInHash(entity.id, entity.position.x, entity.position.y);
    }
    const formationId = npcSystem.registerFormation(leader.id, [member.id]);

    npcSystem.removeNPC(leader.id);

    expect(npcSystem.getFormationForNpc(member.id)).toMatchObject({
      formationId,
      leaderId: member.id,
      isLeader: true
    });
    expect(member.formationLeader).toBe(true);

    npcSystem.removeNPC(member.id);
    npcSystem.cleanupFormations();
    expect(npcSystem.formations.has(formationId)).toBe(false);
  });
});

describe('non-continuous base repopulation', () => {
  it('queues a fresh initial population when a destroyed mining claim respawns', () => {
    const base = createBase('mining_claim', 'rogue_miner');
    npcSystem.activateBase(base);
    const activeBase = npcSystem.getActiveBase(base.id);
    activeBase.claimCredits = 50;
    activeBase.hasForeman = true;

    const result = npcSystem.damageBase(base.id, activeBase.maxHealth + 1, 11);
    expect(result.destroyed).toBe(true);
    activeBase.destroyedAt = 0;

    expect(npcSystem.checkBaseRespawn(base.id)).toBe(true);
    expect(activeBase.pendingRespawns).toHaveLength(
      npcSystem.BASE_NPC_SPAWNS.mining_claim.initialSpawn
    );
    expect(activeBase.claimCredits).toBe(0);
    expect(activeBase.hasForeman).toBe(false);

    npcSystem.updateBaseSpawning([
      { id: 1, position: { x: base.x, y: base.y } }
    ]);
    expect(activeBase.spawnedNPCs.length).toBeGreaterThan(0);
  });
});

describe('faction event payload contracts', () => {
  const foreman = {
    id: 'foreman-1',
    type: 'rogue_foreman',
    name: 'Rogue Foreman',
    faction: 'rogue_miner',
    position: { x: 10, y: 20 },
    rotation: 1,
    hull: 250,
    hullMax: 250,
    shield: 1200,
    shieldMax: 1200,
    isBoss: true
  };

  it('creates the flat spawn shape consumed by the browser', () => {
    const payload = createNpcSpawnPayload(foreman);
    expect(payload).toMatchObject({
      id: 'foreman-1',
      type: 'rogue_foreman',
      x: 10,
      y: 20,
      isBoss: true
    });
    expect(payload).not.toHaveProperty('npc');
  });

  it('keeps the full 3000-unit rage context in range and payload', () => {
    const event = createRogueMinerRageEvent(foreman, {
      triggeredBy: 'miner-1',
      targetId: 4,
      enragedNPCs: ['miner-1', 'miner-2'],
      rageRange: 3000
    });
    expect(event).toEqual({
      position: { x: 10, y: 20 },
      range: 3000,
      payload: {
        npcId: 'foreman-1',
        action: 'rage',
        faction: 'rogue_miner',
        x: 10,
        y: 20,
        triggeredBy: 'miner-1',
        targetId: 4,
        enragedNPCs: ['miner-1', 'miner-2'],
        rageRange: 3000
      }
    });
  });

  it('uses the client destruction key for a consumed Void entity', () => {
    const payload = createConsumedNpcDestroyedPayload({
      id: 'void-target',
      faction: 'void',
      position: { x: 3, y: 4 }
    });
    expect(payload).toEqual({
      id: 'void-target',
      faction: 'void',
      x: 3,
      y: 4,
      deathEffect: 'void_consume'
    });
    expect(payload).not.toHaveProperty('npcId');
  });

  it('creates one authoritative ring of Void minion rifts', () => {
    const samples = [0, 0.5, 1, 0.25];
    const positions = createVoidMinionRiftPositions(
      { x: 100, y: 200 },
      samples.length,
      () => samples.shift()
    );

    expect(positions).toHaveLength(4);
    expect(positions[0]).toEqual({ x: 250, y: 200 });
    expect(positions[1].x).toBeCloseTo(100);
    expect(positions[1].y).toBeCloseTo(400);
    expect(positions[2].x).toBeCloseTo(-150);
    expect(positions[2].y).toBeCloseTo(200);
    expect(positions[3].x).toBeCloseTo(100);
    expect(positions[3].y).toBeCloseTo(25);
  });
});
