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

const sourceNpc = {
  id: 'source',
  type: 'swarm_drone',
  name: 'Source',
  faction: 'swarm',
  linkedHealth: true,
  position: { x: 0, y: 0 },
  hull: 40,
  shield: 0,
  damageContributors: new Map([[7, 100]])
};
const linkedNpc = {
  id: 'linked',
  type: 'swarm_drone',
  name: 'Linked',
  faction: 'swarm',
  position: { x: 10, y: 0 },
  hull: 0,
  hullMax: 50,
  shield: 0,
  linkedHealth: true,
  attachedToBase: 'base-1',
  creditReward: 12,
  damageContributors: new Map([[7, 20]])
};
const linkedResult = {
  id: linkedNpc.id,
  damage: 20,
  destroyed: true,
  hull: 0,
  hullMax: 50,
  position: { x: 10, y: 0 },
  entity: linkedNpc
};
const npc = {
  TEAM_MULTIPLIERS: { 1: 1, 2: 1.5, 3: 2, 4: 2.5 },
  getNPC: vi.fn(() => sourceNpc),
  getActiveBase: vi.fn(),
  damageNPC: vi.fn(() => ({
    destroyed: false,
    hull: sourceNpc.hull,
    shield: sourceNpc.shield,
    hitShield: false
  })),
  applySwarmLinkedDamage: vi.fn(() => [linkedResult]),
  damageBase: vi.fn(),
  detachDroneFromBase: vi.fn(() => ({
    baseId: 'base-1',
    remainingDrones: 1,
    threshold: 3
  })),
  handleQueenDeath: vi.fn(),
  removeNPC: vi.fn(),
  activeNPCs: new Map()
};
const wreckage = {
  id: 'wreckage-linked',
  position: { x: 10, y: 0 },
  size: 20,
  source: 'npc',
  faction: 'swarm',
  npcType: 'swarm_drone',
  npcName: 'Linked',
  contents: [],
  despawnTime: Date.now() + 1000
};
const loot = {
  spawnWreckage: vi.fn(() => wreckage)
};
const combat = {
  calculateDamage: vi.fn(() => ({ shieldDamage: 50, hullDamage: 50 }))
};
const world = {
  getObjectById: vi.fn(),
  getObjectPosition: vi.fn()
};
const socketModule = {
  broadcastAssimilationProgress: vi.fn(),
  broadcastQueenDeath: vi.fn()
};

installCommonJsMock('../../../server/game/npc.js', npc);
installCommonJsMock('../../../server/game/combat.js', combat);
installCommonJsMock('../../../server/game/mining.js', {});
installCommonJsMock('../../../server/game/loot.js', loot);
installCommonJsMock('../../../server/world.js', world);
installCommonJsMock('../../../server/game/star-damage.js', {});
installCommonJsMock('../../../server/database.js', { statements: {} });
installCommonJsMock('../../../server/game/relic-effects.js', {
  playerHasRelic: vi.fn(() => false),
  calculateFactionDamage: vi.fn((damage) => damage)
});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn()
});

const enginePath = require.resolve('../../../server/game/engine.js');
delete require.cache[enginePath];
const engine = require(enginePath);

describe('linked Swarm death engine cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npc.getNPC.mockReturnValue(sourceNpc);
    npc.damageNPC.mockReturnValue({
      destroyed: false,
      hull: sourceNpc.hull,
      shield: sourceNpc.shield,
      hitShield: false
    });
    npc.applySwarmLinkedDamage.mockReturnValue([linkedResult]);
    npc.getActiveBase.mockReset();
    npc.damageBase.mockReset();
    world.getObjectById.mockReset();
    world.getObjectPosition.mockReset();
    npc.detachDroneFromBase.mockReturnValue({
      baseId: 'base-1', remainingDrones: 1, threshold: 3
    });
    loot.spawnWreckage.mockReturnValue(wreckage);
    engine.init({ to: vi.fn(() => ({ emit: vi.fn() })) }, new Map(), socketModule);
  });

  it('detaches, creates one wreckage, then removes the retained victim once', () => {
    engine.playerAttackNPC(7, sourceNpc.id, 'explosive', 1, 100);

    expect(npc.applySwarmLinkedDamage).toHaveBeenCalledWith(sourceNpc, 100, 7);
    expect(npc.detachDroneFromBase).toHaveBeenCalledOnce();
    expect(loot.spawnWreckage).toHaveBeenCalledOnce();
    expect(npc.removeNPC).toHaveBeenCalledOnce();
    expect(npc.removeNPC).toHaveBeenCalledWith(linkedNpc.id);
    expect(npc.detachDroneFromBase.mock.invocationCallOrder[0])
      .toBeLessThan(npc.removeNPC.mock.invocationCallOrder[0]);
    expect(loot.spawnWreckage.mock.invocationCallOrder[0])
      .toBeLessThan(npc.removeNPC.mock.invocationCallOrder[0]);
    expect(socketModule.broadcastAssimilationProgress).toHaveBeenCalledWith({
      baseId: 'base-1',
      progress: 1,
      threshold: 3,
      position: linkedNpc.position,
      droneKilled: linkedNpc.id,
      killedBy: 7
    });
  });

  it('clears and broadcasts the authoritative Queen singleton on death', () => {
    const queen = {
      id: 'queen-1',
      type: 'swarm_queen',
      name: 'Swarm Queen',
      faction: 'swarm',
      position: { x: 400, y: 500 },
      hull: 0,
      hullMax: 788,
      shield: 0,
      creditReward: 800,
      deathEffect: 'dissolve',
      isBoss: true,
      damageContributors: new Map([[7, 100]])
    };
    npc.getNPC.mockReturnValue(queen);
    npc.damageNPC.mockReturnValue({
      destroyed: true,
      participants: [7],
      participantCount: 1,
      teamMultiplier: 1,
      creditsPerPlayer: 800,
      faction: 'swarm'
    });
    npc.applySwarmLinkedDamage.mockReturnValue([]);

    engine.playerAttackNPC(7, queen.id, 'energy', 5, 1000);

    expect(npc.handleQueenDeath).toHaveBeenCalledOnce();
    expect(npc.handleQueenDeath).toHaveBeenCalledWith(queen.id);
    expect(socketModule.broadcastQueenDeath).toHaveBeenCalledOnce();
    expect(socketModule.broadcastQueenDeath).toHaveBeenCalledWith(
      queen.id,
      { x: 400, y: 500 }
    );
  });

  it('broadcasts and labels assimilated base destruction from active state', () => {
    const emit = vi.fn();
    const activeBase = {
      id: 'base-1',
      type: 'assimilated_pirate_outpost',
      faction: 'swarm',
      name: 'Assimilated Outpost',
      size: 90
    };
    world.getObjectById.mockReturnValue({
      id: 'base-1',
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Pirate Outpost',
      x: 100,
      y: 200,
      size: 90
    });
    world.getObjectPosition.mockReturnValue({ x: 100, y: 200 });
    npc.getActiveBase.mockReturnValue(activeBase);
    npc.damageBase.mockReturnValue({
      destroyed: true,
      loot: [{ type: 'resource', resourceType: 'CARBON', quantity: 2 }],
      participants: [7],
      participantCount: 1,
      teamMultiplier: 1,
      creditsPerPlayer: 500,
      faction: 'swarm',
      baseType: 'assimilated_pirate_outpost',
      baseName: 'Assimilated Outpost',
      destroyedDrones: [],
      respawnTime: 300000
    });
    loot.spawnWreckage.mockReturnValue({
      ...wreckage,
      id: 'base-wreckage',
      source: 'base',
      faction: 'swarm',
      npcType: 'assimilated_pirate_outpost',
      npcName: 'Assimilated Outpost'
    });
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-1', { position: { x: 100, y: 200 }, radarTier: 1 }]]),
      socketModule
    );

    engine.playerAttackBase(7, 'base-1', 'energy', 5);

    expect(loot.spawnWreckage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'base-1',
        name: 'Assimilated Outpost',
        faction: 'swarm',
        type: 'assimilated_pirate_outpost'
      }),
      { x: 100, y: 200 },
      expect.any(Array),
      expect.any(Map),
      { source: 'base' }
    );
    expect(emit).toHaveBeenCalledWith('base:destroyed', expect.objectContaining({
      id: 'base-1',
      faction: 'swarm',
      baseType: 'assimilated_pirate_outpost'
    }));
  });

  it('announces a surviving Dreadnought enraged directly by base destruction', () => {
    const emit = vi.fn();
    const dreadnought = {
      id: 'dread-1',
      type: 'pirate_dreadnought',
      faction: 'pirate',
      state: 'enraged',
      position: { x: 120, y: 200 }
    };
    world.getObjectById.mockReturnValue({
      id: 'base-1',
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Pirate Outpost',
      x: 100,
      y: 200,
      size: 90
    });
    world.getObjectPosition.mockReturnValue({ x: 100, y: 200 });
    npc.getActiveBase.mockReturnValue({
      id: 'base-1',
      type: 'pirate_outpost',
      faction: 'pirate',
      name: 'Pirate Outpost',
      size: 90
    });
    npc.getNPC.mockImplementation(id => id === dreadnought.id ? dreadnought : sourceNpc);
    npc.damageBase.mockReturnValue({
      destroyed: true,
      loot: [],
      participants: [7],
      participantCount: 1,
      teamMultiplier: 1,
      creditsPerPlayer: 500,
      faction: 'pirate',
      baseType: 'pirate_outpost',
      baseName: 'Pirate Outpost',
      destroyedDrones: [],
      orphanedNpcIds: [dreadnought.id],
      respawnTime: 300000
    });
    loot.spawnWreckage.mockReturnValue({
      ...wreckage,
      id: 'base-wreckage',
      source: 'base',
      faction: 'pirate',
      npcType: 'pirate_outpost',
      npcName: 'Pirate Outpost'
    });
    engine.init(
      { to: vi.fn(() => ({ emit })) },
      new Map([['socket-1', {
        id: 7,
        position: { x: 100, y: 200 },
        radarTier: 1
      }]]),
      socketModule
    );

    engine.playerAttackBase(7, 'base-1', 'energy', 5);

    expect(emit).toHaveBeenCalledWith(
      'pirate:dreadnoughtEnraged',
      expect.objectContaining({
        npcId: dreadnought.id,
        destroyedBaseId: 'base-1',
        x: dreadnought.position.x,
        y: dreadnought.position.y
      })
    );
  });
});
