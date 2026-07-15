import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import PirateStrategy from '../../../server/game/ai/pirate.js';

const require = createRequire(import.meta.url);
const npcSystem = require('../../../server/game/npc');

function scout(overrides = {}) {
  return {
    id: 'scout-1',
    type: 'pirate_scout',
    faction: 'pirate',
    state: 'patrol',
    position: { x: 800, y: 0 },
    spawnPoint: { x: 0, y: 0 },
    speed: 130,
    weaponRange: 200,
    weaponDamage: 8,
    weaponTier: 1,
    aggroRange: 500,
    lastFireTime: 0,
    ...overrides
  };
}

function fighter(overrides = {}) {
  return {
    id: 'fighter-1',
    type: 'pirate_fighter',
    faction: 'pirate',
    state: 'circling',
    position: { x: 300, y: 0 },
    spawnPoint: { x: 0, y: 0 },
    speed: 100,
    weaponRange: 350,
    weaponDamage: 20,
    weaponTier: 2,
    aggroRange: 700,
    targetPlayer: 'player-1',
    lastFireTime: 0,
    ...overrides
  };
}

function captain(overrides = {}) {
  return {
    id: 'captain-1',
    type: 'pirate_captain',
    faction: 'pirate',
    state: 'raid',
    position: { x: 300, y: 0 },
    speed: 90,
    hull: 200,
    hullMax: 200,
    shield: 100,
    shieldMax: 100,
    weaponRange: 300,
    weaponDamage: 22,
    weaponTier: 3,
    aggroRange: 600,
    targetPlayer: player.id,
    raidTargetType: 'player',
    raidTargetPos: { ...player.position },
    lastFireTime: 0,
    ...overrides
  };
}

const player = {
  id: 'player-1',
  position: { x: 0, y: 0 },
  distance: 0
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Pirate bounded orbit movement', () => {
  it('keeps scout patrol motion on a stable radius and within its speed budget', () => {
    const strategy = new PirateStrategy();
    const npc = scout();
    const center = { x: 0, y: 0 };
    const maxStep = npc.speed * 0.5 * 0.05;
    let maxAbsY = 0;

    for (let tick = 0; tick < 600; tick++) {
      const before = { ...npc.position };
      strategy.scoutPatrol(npc, [], [], 50, { homeBase: center });
      const step = Math.hypot(npc.position.x - before.x, npc.position.y - before.y);
      expect(step).toBeLessThanOrEqual(maxStep + 1e-9);
      maxAbsY = Math.max(maxAbsY, Math.abs(npc.position.y));
    }

    expect(Math.hypot(npc.position.x, npc.position.y)).toBeCloseTo(strategy.SCOUT_PATROL_RADIUS, 6);
    expect(maxAbsY).toBeGreaterThan(100);
  });

  it('keeps a circling fighter bounded instead of chasing a faster waypoint', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const npc = fighter();
    const maxStep = npc.speed * 0.8 * 0.05;
    let maxAbsY = 0;
    strategy.boostDiveNPCs.set(npc.id, {
      targetId: player.id,
      startedAt: 0,
      cooldownUntil: Date.now() + 100000,
      phase: 'cooldown'
    });

    for (let tick = 0; tick < 400; tick++) {
      const before = { ...npc.position };
      expect(strategy.fighterCircle(npc, [player], 50, {})).toBeNull();
      const step = Math.hypot(npc.position.x - before.x, npc.position.y - before.y);
      expect(step).toBeLessThanOrEqual(maxStep + 1e-9);
      maxAbsY = Math.max(maxAbsY, Math.abs(npc.position.y));
      vi.advanceTimersByTime(50);
    }

    expect(Math.hypot(npc.position.x, npc.position.y)).toBeCloseTo(strategy.FIGHTER_CIRCLE_RADIUS, 6);
    expect(maxAbsY).toBeGreaterThan(100);
  });

  it('keeps fighter patrol motion within the configured patrol speed', () => {
    const strategy = new PirateStrategy();
    const npc = fighter({ state: 'patrol', targetPlayer: null });
    const center = { x: 0, y: 0 };
    const maxStep = npc.speed * 0.4 * 0.05;

    for (let tick = 0; tick < 300; tick++) {
      const before = { ...npc.position };
      strategy.fighterPatrol(npc, [], 50, { homeBase: center });
      const step = Math.hypot(npc.position.x - before.x, npc.position.y - before.y);
      expect(step).toBeLessThanOrEqual(maxStep + 1e-9);
    }

    expect(Math.hypot(npc.position.x, npc.position.y)).toBeCloseTo(strategy.FIGHTER_PATROL_RADIUS, 6);
  });
});

describe('Pirate nearest-player selection', () => {
  const fartherPlayer = {
    id: 'player-farther',
    position: { x: 450, y: 0 },
    distance: 450
  };
  const nearerPlayer = {
    id: 'player-nearer',
    position: { x: 60, y: 0 },
    distance: 60
  };

  it('has a patrolling fighter choose the nearest player from unordered input', () => {
    const strategy = new PirateStrategy();
    const npc = fighter({
      state: 'patrol',
      position: { x: 0, y: 0 },
      targetPlayer: null
    });

    strategy.fighterPatrol(npc, [fartherPlayer, nearerPlayer], 50, {});

    expect(npc).toMatchObject({
      state: 'raid',
      targetPlayer: nearerPlayer.id,
      raidTargetPos: nearerPlayer.position
    });
  });

  it('has an idle captain choose the nearest player from unordered input', () => {
    const strategy = new PirateStrategy();
    const npc = captain({
      state: 'idle',
      position: { x: 0, y: 0 },
      targetPlayer: null,
      raidTargetPos: null
    });

    strategy.captainIdle(npc, [fartherPlayer, nearerPlayer], 50, {});

    expect(npc).toMatchObject({
      state: 'raid',
      targetPlayer: nearerPlayer.id,
      raidTargetPos: nearerPlayer.position
    });
  });

  it('has a raiding captain engage the nearest player from unordered input', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const npc = captain({ position: { x: 0, y: 0 } });

    const action = strategy.captainRaid(npc, [fartherPlayer, nearerPlayer], 50, {
      nearbyBases: [],
      allNPCs: new Map()
    });

    expect(npc.targetPlayer).toBe(nearerPlayer.id);
    expect(action).toMatchObject({ action: 'fire', target: nearerPlayer });
  });
});

describe('Pirate retained player target contract', () => {
  it('retains a real player target through the pirate raid chase range', () => {
    const strategy = new PirateStrategy();
    const npc = fighter({
      targetPlayer: player.id,
      targetNPC: null,
      raidTargetType: 'player'
    });

    expect(strategy.getPlayerTargetRetentionRange(npc)).toBe(strategy.RAID_CHASE_DISTANCE);
  });

  it('resolves a numeric player snapshot for a serialized raid target ID', () => {
    const strategy = new PirateStrategy();
    const numericPlayer = {
      id: 42,
      position: { x: 100, y: 0 },
      distance: 200
    };
    const npc = fighter({
      state: 'raid',
      targetPlayer: '42',
      targetNPC: null,
      raidTargetType: 'player',
      raidTargetPos: { ...numericPlayer.position }
    });

    const action = strategy.fighterRaid(npc, [numericPlayer], 50, {
      allNPCs: new Map(),
      nearbyBases: []
    });

    expect(action).toBeNull();
    expect(npc).toMatchObject({
      state: 'circling',
      targetPlayer: '42',
      raidTargetPos: numericPlayer.position
    });
    expect(strategy.boostDiveNPCs.get(npc.id)).toMatchObject({ targetId: '42' });
  });

  it.each([
    {
      label: 'NPC target',
      npc: fighter({
        targetPlayer: player.id,
        targetNPC: 'scavenger-1',
        raidTargetType: 'npc'
      })
    },
    {
      label: 'base target',
      npc: captain({
        targetPlayer: 'claim-1',
        targetNPC: null,
        raidTargetType: undefined,
        isRaidingBase: true,
        raidBaseId: 'claim-1'
      })
    },
    {
      label: 'cleared target',
      npc: fighter({
        targetPlayer: null,
        targetNPC: null,
        raidTargetType: 'player'
      })
    },
    {
      label: 'generic orphan-rage target',
      npc: fighter({
        orphaned: true,
        state: 'rage',
        targetPlayer: player.id,
        targetNPC: null,
        raidTargetType: 'player'
      })
    }
  ])('does not retain a $label as a player', ({ npc }) => {
    const strategy = new PirateStrategy();

    expect(strategy.getPlayerTargetRetentionRange(npc)).toBe(0);
  });

  it('ends dreadnought retention when no bounded player candidate remains', () => {
    const strategy = new PirateStrategy();
    const raidDreadnought = fighter({
      id: 'dread-retention-raid',
      type: 'pirate_dreadnought',
      state: 'raid',
      targetPlayer: player.id,
      targetNPC: null,
      raidTargetType: 'player'
    });
    const enragedDreadnought = {
      ...raidDreadnought,
      id: 'dread-retention-enraged',
      state: 'enraged'
    };

    strategy.dreadnoughtRaid(raidDreadnought, [], 50, { homeBase: null });
    strategy.dreadnoughtEnraged(enragedDreadnought, [], 50, {});

    for (const npc of [raidDreadnought, enragedDreadnought]) {
      expect(npc.targetPlayer).toBeNull();
      expect(strategy.getPlayerTargetRetentionRange(npc)).toBe(0);
    }
  });
});

describe('Pirate scout combat target lifecycle', () => {
  it('converges inside its configured weapon range and fires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const npc = scout({
      state: 'raid',
      position: { x: 400, y: 0 },
      targetPlayer: player.id,
      raidTargetPos: { ...player.position }
    });
    let action = null;

    for (let tick = 0; tick < 200 && !action; tick++) {
      action = strategy.scoutRaid(npc, [player], 50, {});
      vi.advanceTimersByTime(50);
    }

    expect(action).toMatchObject({
      action: 'fire',
      target: player,
      weaponType: 'pirate_light_blaster'
    });
    expect(Math.hypot(npc.position.x, npc.position.y)).toBeLessThanOrEqual(npc.weaponRange);
  });

  it('starts one persistent memory timer and abandons a missing non-player target', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const npc = scout({
      state: 'raid',
      position: { x: 200, y: 0 },
      targetPlayer: 'missing-base',
      raidTargetPos: { x: 0, y: 0 },
      lastTargetSeenTime: undefined
    });

    strategy.scoutRaid(npc, [], 50, {});
    const firstSeenTime = npc.lastTargetSeenTime;
    expect(npc.state).toBe('raid');

    vi.advanceTimersByTime(strategy.TARGET_MEMORY_DURATION - 1);
    strategy.scoutRaid(npc, [], 50, {});
    expect(npc.state).toBe('raid');
    expect(npc.lastTargetSeenTime).toBe(firstSeenTime);

    vi.advanceTimersByTime(1);
    strategy.scoutRaid(npc, [], 50, {});
    expect(npc).toMatchObject({
      state: 'patrol',
      targetPlayer: null,
      raidTargetPos: null,
      lastTargetSeenTime: null
    });
  });

  it('resolves moving NPC intel targets and fires on the authoritative NPC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const target = {
      id: 'scavenger-1',
      faction: 'scavenger',
      hull: 100,
      position: { x: 50, y: 25 }
    };
    const npc = scout({
      state: 'at_base',
      homeBaseId: 'base-1'
    });
    const context = { allNPCs: new Map([[target.id, target]]) };
    strategy.scoutingNPCs.set(npc.id, {
      targetId: target.id,
      targetType: target.faction,
      targetPos: { ...target.position },
      discoveredAt: Date.now()
    });

    strategy.scoutAtBase(npc, [], 50, context);
    expect(npc).toMatchObject({
      state: 'raid',
      targetPlayer: null,
      targetNPC: target.id,
      raidTargetType: 'npc'
    });
    npc.position = { x: 450, y: 25 };

    let action = null;

    for (let tick = 0; tick < 200 && !action; tick++) {
      target.position.y += 0.25;
      action = strategy.scoutRaid(npc, [], 50, context);
      vi.advanceTimersByTime(50);
    }

    expect(action).toMatchObject({
      action: 'fire',
      target,
      weaponType: 'pirate_light_blaster'
    });
    expect(npc.targetPlayer).toBeNull();
    expect(npc.targetNPC).toBe(target.id);
    expect(npc.raidTargetPos).toEqual(target.position);
    expect(Math.hypot(
      npc.position.x - target.position.x,
      npc.position.y - target.position.y
    )).toBeLessThanOrEqual(npc.weaponRange);
  });
});

describe('Pirate fighter NPC engagement range', () => {
  it('continues closing until its defender target is inside weapon range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const defender = {
      id: 'miner-1',
      faction: 'rogue_miner',
      hull: 100,
      position: { x: 0, y: 0 }
    };
    const npc = fighter({
      state: 'raid',
      position: { x: 340, y: 0 },
      weaponRange: 280,
      targetPlayer: null,
      targetNPC: defender.id,
      raidTargetPos: { ...defender.position }
    });
    const context = { allNPCs: new Map([[defender.id, defender]]) };
    let action = null;

    for (let tick = 0; tick < 100 && !action; tick++) {
      action = strategy.fighterRaid(npc, [], 50, context);
      vi.advanceTimersByTime(50);
    }

    expect(action).toMatchObject({ action: 'fire', target: defender });
    expect(Math.hypot(npc.position.x, npc.position.y)).toBeLessThanOrEqual(npc.weaponRange);
  });
});

describe('Pirate captain target lifecycle', () => {
  it('abandons a stale target once and ignores the same expired intel report', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const reportedAt = Date.now();
    strategy.intelReports.set('base-1', {
      targetId: player.id,
      targetType: 'player',
      targetPos: { ...player.position },
      reportedAt
    });
    const npc = captain({
      homeBaseId: 'base-1',
      lastTargetSeenTime: Date.now(),
      activeIntelReportedAt: reportedAt
    });

    vi.advanceTimersByTime(strategy.TARGET_MEMORY_DURATION - 1);
    strategy.captainRaid(npc, [], 50, { allNPCs: new Map() });
    expect(npc.state).toBe('raid');

    vi.advanceTimersByTime(1);
    strategy.captainRaid(npc, [], 50, { allNPCs: new Map() });
    expect(npc).toMatchObject({
      state: 'idle',
      targetPlayer: null,
      targetNPC: null,
      raidTargetPos: null,
      lastTargetSeenTime: null,
      ignoredIntelReportedAt: reportedAt
    });

    strategy.captainIdle(npc, [], 50, { homeBase: null });
    expect(npc.state).toBe('idle');
  });

  it('refreshes a base raid from the live base identity and position', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const liveBase = {
      id: 'claim-1',
      type: 'mining_claim',
      x: 500,
      y: 75,
      claimCredits: 100
    };
    const npc = captain({
      position: { x: 0, y: 0 },
      targetPlayer: 'claim-1',
      raidTargetType: 'base',
      raidTargetPos: { x: 300, y: 0 },
      isRaidingBase: true,
      raidBaseId: liveBase.id,
      raidBaseType: liveBase.type,
      raidBaseStaleSince: Date.now() - strategy.TARGET_MEMORY_DURATION
    });

    strategy.captainRaid(npc, [], 50, {
      nearbyBases: [liveBase],
      allNPCs: new Map()
    });

    expect(npc).toMatchObject({
      state: 'raid',
      targetPlayer: null,
      raidTargetType: 'base',
      raidTargetPos: { x: liveBase.x, y: liveBase.y },
      isRaidingBase: true,
      raidBaseId: liveBase.id,
      raidBaseStaleSince: null
    });
  });

  it('expires a missing base raid instead of parking at stale coordinates forever', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const reportedAt = Date.now();
    const intel = {
      targetId: 'yard-1',
      targetType: 'scavenger_base',
      targetPos: { x: 0, y: 0 },
      reportedAt,
      isBaseTarget: true,
      baseType: 'scavenger_yard'
    };
    strategy.intelReports.set('base-1', intel);
    const npc = captain({
      homeBaseId: 'base-1',
      position: { x: 0, y: 0 },
      targetPlayer: intel.targetId,
      // Match captains spawned directly by npc.js, which carry the explicit
      // base identity but do not pass through assignIntelRaidTarget first.
      raidTargetType: undefined,
      raidTargetPos: { ...intel.targetPos },
      lastTargetSeenTime: reportedAt,
      activeIntelReportedAt: reportedAt,
      isRaidingBase: true,
      raidBaseId: intel.targetId,
      raidBaseType: intel.baseType
    });
    const context = { nearbyBases: [], allNPCs: new Map() };

    strategy.captainRaid(npc, [], 50, context);
    const staleSince = npc.raidBaseStaleSince;
    expect(npc.state).toBe('raid');
    expect(staleSince).toBe(Date.now());

    vi.advanceTimersByTime(strategy.TARGET_MEMORY_DURATION - 1);
    strategy.captainRaid(npc, [], 50, context);
    expect(npc.state).toBe('raid');
    expect(npc.raidBaseStaleSince).toBe(staleSince);

    vi.advanceTimersByTime(1);
    strategy.captainRaid(npc, [], 50, context);
    expect(npc).toMatchObject({
      state: 'idle',
      targetPlayer: null,
      targetNPC: null,
      raidTargetType: null,
      raidTargetPos: null,
      isRaidingBase: false,
      raidBaseId: null,
      raidBaseStaleSince: null,
      ignoredIntelReportedAt: reportedAt
    });

    strategy.captainIdle(npc, [], 50, { homeBase: null });
    expect(npc.state).toBe('idle');
  });

  it('also expires an exhausted live base with no defenders', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const emptyBase = {
      id: 'claim-empty',
      type: 'mining_claim',
      x: 0,
      y: 0,
      claimCredits: 0
    };
    const npc = captain({
      position: { x: 0, y: 0 },
      targetPlayer: emptyBase.id,
      raidTargetType: 'base',
      raidTargetPos: { x: emptyBase.x, y: emptyBase.y },
      isRaidingBase: true,
      raidBaseId: emptyBase.id,
      raidBaseType: emptyBase.type
    });
    const context = { nearbyBases: [emptyBase], allNPCs: new Map() };

    strategy.captainRaid(npc, [], 50, context);
    vi.advanceTimersByTime(strategy.TARGET_MEMORY_DURATION);
    strategy.captainRaid(npc, [], 50, context);

    expect(npc).toMatchObject({
      state: 'idle',
      raidTargetPos: null,
      isRaidingBase: false,
      raidBaseId: null
    });
  });
});

describe('Pirate damage reactions', () => {
  it('turns scouts and fighters toward their attacker and clears incompatible state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const damagedScout = scout({ state: 'espionage' });
    const damagedFighter = fighter({ state: 'boost_dive', isBoosting: true });
    strategy.scoutingNPCs.set(damagedScout.id, { targetId: 'old-target' });
    strategy.boostDiveNPCs.set(damagedFighter.id, { targetId: 'old-target' });

    const scoutAction = strategy.onDamaged(damagedScout, 'attacker-1', new Map());
    const fighterAction = strategy.onDamaged(damagedFighter, 'attacker-1', new Map());

    expect(scoutAction).toMatchObject({
      action: 'pirate:retaliate',
      npcId: damagedScout.id,
      targetId: 'attacker-1',
      targetType: 'player',
      previousState: 'espionage',
      state: 'raid'
    });
    expect(fighterAction).toMatchObject({
      action: 'pirate:retaliate',
      npcId: damagedFighter.id,
      targetId: 'attacker-1',
      previousState: 'boost_dive',
      state: 'raid'
    });
    expect(damagedScout.targetPlayer).toBe('attacker-1');
    expect(damagedFighter.targetPlayer).toBe('attacker-1');
    expect(damagedFighter.isBoosting).toBe(false);
    expect(strategy.scoutingNPCs.has(damagedScout.id)).toBe(false);
    expect(strategy.boostDiveNPCs.has(damagedFighter.id)).toBe(false);
  });

  it('returns an NPC retaliation target with an authoritative position', () => {
    const strategy = new PirateStrategy();
    const npc = fighter({ state: 'patrol' });
    const attacker = {
      id: 'enemy-npc',
      faction: 'scavenger',
      position: { x: 25, y: 40 }
    };

    const action = strategy.onDamaged(npc, attacker.id, new Map([[attacker.id, attacker]]));

    expect(action).toMatchObject({ targetId: attacker.id, targetType: 'npc' });
    expect(npc).toMatchObject({
      state: 'raid',
      targetNPC: attacker.id,
      targetPlayer: null,
      raidTargetPos: attacker.position
    });
    expect(npc.raidTargetPos).not.toBe(attacker.position);
  });
});

describe('Pirate action payload contracts', () => {
  it('emits the canonical boost-dive coordinates and duration consumed by the engine', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const npc = fighter();

    const action = strategy.fighterCircle(npc, [player], 50, {});

    expect(action).toMatchObject({
      action: 'pirate:boostDive',
      npcId: npc.id,
      startX: 300,
      startY: 0,
      targetX: 0,
      targetY: 0,
      speedMultiplier: strategy.BOOST_DIVE_SPEED_MULTIPLIER,
      duration: strategy.BOOST_DIVE_DURATION,
      fromX: 300,
      fromY: 0,
      toX: 0,
      toY: 0
    });
  });

  it('emits targetInfo and the alerted-pirate list consumed by the engine', () => {
    vi.spyOn(npcSystem, 'spawnCaptainFromIntel').mockReturnValue(null);
    const strategy = new PirateStrategy();
    const npc = scout({ state: 'at_base', homeBaseId: 'base-1' });
    strategy.scoutingNPCs.set(npc.id, {
      targetId: player.id,
      targetType: 'player',
      targetPos: { x: 10, y: 20 },
      discoveredAt: Date.now()
    });

    const action = strategy.scoutAtBase(npc, [
      { id: 'nearby-fighter', distance: 200 },
      { id: 'far-fighter', distance: 1200 }
    ], 50, {});

    expect(action).toMatchObject({
      action: 'pirate:intelBroadcast',
      baseId: 'base-1',
      targetInfo: {
        targetId: player.id,
        targetType: 'player',
        targetPos: { x: 10, y: 20 }
      },
      alertedPirates: ['nearby-fighter']
    });
    expect(action.targetInfo).toBe(action.intel);
  });

  it('emits the canonical destroyed-base ID for a dreadnought enrage action', () => {
    const strategy = new PirateStrategy();
    const npc = fighter({
      id: 'dread-1',
      type: 'pirate_dreadnought',
      state: 'raid',
      homeBaseId: 'base-1',
      position: { x: 12, y: 34 },
      weaponRange: 1400
    });

    const action = strategy.dreadnoughtRaid(npc, [], 50, {
      homeBase: { id: 'base-1', destroyed: true }
    });

    expect(action).toEqual({
      action: 'pirate:dreadnoughtEnraged',
      npcId: npc.id,
      destroyedBaseId: 'base-1',
      x: 12,
      y: 34
    });
  });

  it('returns captain-heal coordinates for the socket payload', () => {
    const strategy = new PirateStrategy();
    const npc = captain({
      state: 'healing',
      position: { x: 45, y: 67 },
      hull: 50,
      shield: 25
    });

    const action = strategy.captainHeal(npc, 50, {});

    expect(action).toMatchObject({
      action: 'pirate:captainHeal',
      npcId: npc.id,
      x: 45,
      y: 67,
      healRate: strategy.CAPTAIN_HEAL_RATE_HULL,
      shieldHealRate: strategy.CAPTAIN_HEAL_RATE_SHIELD
    });
  });
});

describe('Pirate zero-distance movement safety', () => {
  it('keeps boost, cooldown, and dreadnought movement finite at overlap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const strategy = new PirateStrategy();
    const divingFighter = fighter({ position: { x: 0, y: 0 }, state: 'boost_dive' });
    strategy.boostDiveNPCs.set(divingFighter.id, {
      targetId: player.id,
      startedAt: Date.now(),
      cooldownUntil: 0,
      phase: 'diving'
    });

    expect(strategy.fighterBoostDive(divingFighter, [player], 50, {})).toMatchObject({ action: 'fire' });
    strategy.fighterCooldown(divingFighter, [player], 50, {});

    const raidDreadnought = {
      ...fighter({
        id: 'dread-raid',
        type: 'pirate_dreadnought',
        state: 'raid',
        position: { x: 0, y: 0 },
        speed: 40,
        weaponRange: 1400
      })
    };
    const enragedDreadnought = {
      ...raidDreadnought,
      id: 'dread-enraged',
      state: 'enraged',
      position: { x: 0, y: 0 }
    };
    strategy.dreadnoughtRaid(raidDreadnought, [player], 50, { homeBase: null });
    strategy.dreadnoughtEnraged(enragedDreadnought, [player], 50, {});

    for (const pirate of [divingFighter, raidDreadnought, enragedDreadnought]) {
      expect(Number.isFinite(pirate.position.x)).toBe(true);
      expect(Number.isFinite(pirate.position.y)).toBe(true);
    }
  });
});
