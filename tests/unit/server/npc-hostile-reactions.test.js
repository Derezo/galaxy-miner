import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ScavengerStrategy = require('../../../server/game/ai/scavenger');
const MiningStrategy = require('../../../server/game/ai/mining');
const npcSystem = require('../../../server/game/npc');
const ai = require('../../../server/game/ai');

function combatant(id, faction, overrides = {}) {
  return {
    id,
    type: faction === 'scavenger' ? 'scavenger_collector' : 'rogue_miner',
    faction,
    state: 'idle',
    position: { x: 0, y: 0 },
    speed: 100,
    weaponRange: 200,
    weaponType: 'kinetic',
    weaponTier: 1,
    weaponDamage: 10,
    hull: 100,
    lastFireTime: 0,
    ...overrides
  };
}

afterEach(() => {
  vi.useRealTimers();
  ai.getScavengerStrategy().cleanup('retained-scavenger');
  ai.getMiningStrategy().cleanup('retained-miner');
  ai.getPirateStrategy().cleanup('retained-pirate');
  ai.getPirateStrategy().cleanup('intel-carrying-scout');
  ai.getPirateStrategy().clearIntel('stale-intel-base');
  for (const id of [
    'damage-source-pirate',
    'damage-target-miner',
    'retained-scavenger',
    'retained-miner',
    'retained-pirate',
    'intel-carrying-scout'
  ]) {
    npcSystem.removeNPC(id);
  }
});

describe('passive faction NPC retaliation', () => {
  it('keeps a Scavenger enraged against the NPC that attacked it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const strategy = new ScavengerStrategy();
    const defender = combatant('scavenger-1', 'scavenger');
    const attacker = combatant('pirate-1', 'pirate', {
      position: { x: 100, y: 0 }
    });
    const allNPCs = new Map([
      [defender.id, defender],
      [attacker.id, attacker]
    ]);

    strategy.onDamaged(defender, attacker.id, [], 'npc');
    const action = strategy.update(defender, [], [], 50, { allNPCs });

    expect(defender).toMatchObject({
      state: 'enraged',
      targetPlayer: null,
      targetNPC: attacker.id
    });
    expect(action).toMatchObject({ action: 'fire', target: attacker });
  });

  it('keeps Rogue Miners enraged against the NPC that attacked them', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const strategy = new MiningStrategy();
    const defender = combatant('miner-1', 'rogue_miner');
    const attacker = combatant('pirate-1', 'pirate', {
      position: { x: 100, y: 0 }
    });
    const allNPCs = new Map([
      [defender.id, defender],
      [attacker.id, attacker]
    ]);

    strategy.onDamaged(defender, attacker.id, allNPCs, 'npc');
    const action = strategy.update(defender, [], [], 50, {
      allNPCs,
      hasForeman: false
    });

    expect(defender).toMatchObject({
      state: 'enraged',
      targetPlayer: null,
      targetNPC: attacker.id
    });
    expect(action).toMatchObject({ action: 'fire', target: attacker });
  });

  it.each([
    {
      label: 'Scavenger',
      defender: combatant('retained-scavenger', 'scavenger', {
        aggroRange: 300,
        weaponRange: 100
      }),
      strategy: ai.getScavengerStrategy(),
      enrage(defender, playerId, allNPCs) {
        this.strategy.onDamaged(defender, playerId, [], 'player');
      }
    },
    {
      label: 'Rogue Miner',
      defender: combatant('retained-miner', 'rogue_miner', {
        aggroRange: 300,
        weaponRange: 100
      }),
      strategy: ai.getMiningStrategy(),
      enrage(defender, playerId, allNPCs) {
        this.strategy.onDamaged(defender, playerId, allNPCs, 'player');
      }
    }
  ])('keeps a $label player attacker beyond passive aggro range', testCase => {
    const player = { id: 'long-range-player', position: { x: 360, y: 0 } };
    const allNPCs = new Map([[testCase.defender.id, testCase.defender]]);
    testCase.enrage(testCase.defender, player.id, allNPCs);

    const startX = testCase.defender.position.x;
    ai.updateNPCAI(testCase.defender, [player], allNPCs, 50);

    expect(testCase.defender.state).toBe('enraged');
    expect(testCase.defender.targetPlayer).toBe(player.id);
    expect(testCase.defender.position.x).toBeGreaterThan(startX);
  });

  it.each([
    {
      label: 'Scavenger',
      defender: combatant('retained-scavenger', 'scavenger'),
      enrage(defender, targetId, allNPCs) {
        ai.getScavengerStrategy().onDamaged(defender, targetId, [], 'player');
      }
    },
    {
      label: 'Rogue Miner',
      defender: combatant('retained-miner', 'rogue_miner'),
      enrage(defender, targetId, allNPCs) {
        ai.getMiningStrategy().onDamaged(defender, targetId, allNPCs, 'player');
      }
    }
  ])('keeps valid $label retaliation across serialized player IDs', testCase => {
    const player = { id: 42, position: { x: 100, y: 0 } };
    const allNPCs = new Map([[testCase.defender.id, testCase.defender]]);
    testCase.enrage(testCase.defender, '42', allNPCs);

    ai.updateNPCAI(testCase.defender, [player], allNPCs, 50);

    expect(testCase.defender.state).toBe('enraged');
    expect(testCase.defender.targetPlayer).toBe('42');
  });
});

describe('NPC AI player candidate retention', () => {
  it('adds only the retained living target missed by the aggro query', () => {
    const retained = { id: 42, position: { x: 360, y: 0 } };
    const unrelated = { id: 43, position: { x: 100, y: 0 } };
    const candidates = [unrelated];
    const defender = combatant('retained-scavenger', 'scavenger', {
      aggroRange: 300,
      targetPlayer: retained.id
    });
    ai.getScavengerStrategy().onDamaged(defender, retained.id, [], 'player');

    const result = require('../../../server/game/engine').includeRetainedNpcTargetPlayer(
      defender,
      [retained, unrelated],
      candidates
    );

    expect(result).toBe(candidates);
    expect(result).toEqual([unrelated, retained]);
  });

  it('does not retain ordinary Swarm targets beyond aggro range', () => {
    const player = { id: 'former-swarm-target', position: { x: 500, y: 0 } };
    const swarm = combatant('swarm-retention-check', 'swarm', {
      type: 'swarm_drone',
      aggroRange: 100,
      targetPlayer: player.id,
      spawnPoint: { x: 0, y: 0 }
    });
    const candidates = [];

    require('../../../server/game/engine').includeRetainedNpcTargetPlayer(
      swarm,
      [player],
      candidates
    );
    ai.updateNPCAI(swarm, [player], new Map([[swarm.id, swarm]]), 50);

    expect(candidates).toEqual([]);
    expect(swarm.targetPlayer).toBeNull();
    expect(swarm.state).toBe('patrol');
  });

  it('simulates one cleanup tick when a Rogue Miner target crosses its rage limit', () => {
    const engine = require('../../../server/game/engine');
    const strategy = ai.getMiningStrategy();
    const defender = combatant('retained-miner', 'rogue_miner', {
      aggroRange: 300,
      weaponRange: 100
    });
    const player = { id: 'escaped-player', position: { x: 3400, y: 0 } };
    const allNPCs = new Map([[defender.id, defender]]);
    strategy.onDamaged(defender, player.id, allNPCs, 'player');

    expect(engine.getNpcSimulationRange(defender, player)).toBeLessThan(3400);
    expect(engine.shouldSimulateNpc(defender, [player])).toBe(true);

    const candidates = [];
    engine.includeRetainedNpcTargetPlayer(defender, [player], candidates);
    expect(candidates).toEqual([player]);

    const action = ai.updateNPCAI(defender, candidates, allNPCs, 50);
    expect(action).toMatchObject({ action: 'rogueMiner:rageClear' });
    expect(defender.targetPlayer).toBeNull();
    expect(defender.state).toBe('idle');
    expect(engine.shouldSimulateNpc(defender, [player])).toBe(false);
  });

  it('clears retained faction aggression when its player dies or disconnects', () => {
    const engine = require('../../../server/game/engine');
    const playerId = 'departed-player';
    const scavenger = combatant('retained-scavenger', 'scavenger');
    const miner = combatant('retained-miner', 'rogue_miner');
    const pirate = combatant('retained-pirate', 'pirate', {
      type: 'pirate_scout',
      state: 'raid'
    });
    const active = new Map([
      [scavenger.id, scavenger],
      [miner.id, miner],
      [pirate.id, pirate]
    ]);

    ai.getScavengerStrategy().onDamaged(scavenger, playerId, [], 'player');
    ai.getMiningStrategy().onDamaged(miner, playerId, active, 'player');
    ai.getPirateStrategy().onDamaged(pirate, playerId, active);
    for (const entity of active.values()) {
      npcSystem.activeNPCs.set(entity.id, entity);
      npcSystem.insertNPCInHash(entity.id, entity.position.x, entity.position.y);
    }

    expect(engine.clearMissingRetainedPlayerTargets([{ id: playerId }])).toBe(0);
    expect(engine.clearMissingRetainedPlayerTargets([])).toBe(3);
    expect(scavenger).toMatchObject({ state: 'idle', targetPlayer: null });
    expect(miner).toMatchObject({ state: 'idle', targetPlayer: null });
    expect(pirate).toMatchObject({ state: 'patrol', targetPlayer: null });
    expect(ai.getScavengerStrategy().enragedNPCs.has(scavenger.id)).toBe(false);
    expect(ai.getMiningStrategy().enragedNPCs.has(miner.id)).toBe(false);
    expect(ai.getMiningStrategy().rageTargets.has(playerId)).toBe(false);
  });

  it('discards carried and delivered Pirate intel for a missing player', () => {
    const engine = require('../../../server/game/engine');
    const strategy = ai.getPirateStrategy();
    const scout = combatant('intel-carrying-scout', 'pirate', {
      type: 'pirate_scout',
      state: 'fleeing',
      homeBaseId: 'stale-intel-base'
    });
    const staleIntel = {
      targetId: 'departed-player',
      targetType: 'player',
      targetPos: { x: 500, y: 500 },
      reportedAt: Date.now()
    };
    strategy.scoutingNPCs.set(scout.id, { ...staleIntel });
    strategy.intelReports.set('stale-intel-base', { ...staleIntel });
    npcSystem.activeNPCs.set(scout.id, scout);
    npcSystem.insertNPCInHash(scout.id, scout.position.x, scout.position.y);

    expect(engine.clearMissingRetainedPlayerTargets([])).toBe(2);
    expect(strategy.scoutingNPCs.has(scout.id)).toBe(false);
    expect(strategy.intelReports.has('stale-intel-base')).toBe(false);
    expect(scout).toMatchObject({ state: 'patrol', targetPlayer: null });
  });

  it('clears retained aggression from dormant base populations', () => {
    const engine = require('../../../server/game/engine');
    const miner = combatant('retained-miner', 'rogue_miner');
    const dormantPopulation = new Map([[miner.id, miner]]);
    ai.getMiningStrategy().onDamaged(
      miner,
      'departed-player',
      dormantPopulation,
      'player'
    );
    npcSystem.dormantBases.set('retention-dormant-base', {
      id: 'retention-dormant-base',
      dormantNPCs: [miner]
    });

    expect(engine.clearMissingRetainedPlayerTargets([])).toBe(1);
    expect(miner).toMatchObject({ state: 'idle', targetPlayer: null });
    expect(ai.getMiningStrategy().rageTargets.has('departed-player')).toBe(false);
  });
});

describe('NPC damage source authority', () => {
  it('applies shield piercing and retains the NPC attacker without rewarding it', () => {
    const attacker = combatant('damage-source-pirate', 'pirate');
    const defender = combatant('damage-target-miner', 'rogue_miner', {
      shield: 100,
      shieldMax: 100,
      damageContributors: new Map()
    });
    npcSystem.activeNPCs.set(attacker.id, attacker);
    npcSystem.activeNPCs.set(defender.id, defender);
    npcSystem.insertNPCInHash(attacker.id, attacker.position.x, attacker.position.y);
    npcSystem.insertNPCInHash(defender.id, defender.position.x, defender.position.y);

    const result = npcSystem.damageNPC(defender.id, 20, null, {
      sourceNpcId: attacker.id,
      shieldPiercing: 0.25
    });

    expect(result).toMatchObject({
      destroyed: false,
      shield: 85,
      hull: 95,
      hitShield: true,
      shieldPierced: true,
      piercingDamage: 5
    });
    expect(defender).toMatchObject({
      targetPlayer: null,
      targetNPC: attacker.id,
      state: 'enraged'
    });
    expect(defender.damageContributors.size).toBe(0);
    expect(ai.getMiningStrategy().enragedNPCs.get(defender.id)).toMatchObject({
      targetId: attacker.id,
      targetType: 'npc'
    });
  });
});
