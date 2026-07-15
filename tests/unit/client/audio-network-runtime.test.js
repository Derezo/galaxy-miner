import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');

function loadRegister(relativePath, globals = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    console,
    Map,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    module,
    exports: module.exports,
    ...globals
  });
  context.globalThis = context;

  const filename = path.join(PROJECT_ROOT, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return module.exports.register;
}

function captureHandlers(register) {
  const handlers = new Map();
  register({ on: (event, handler) => handlers.set(event, handler) });
  return handlers;
}

describe('mining audio lifecycle', () => {
  it('tracks and stops the exact drill intent while audio is not ready', () => {
    const audioManager = {
      isReady: vi.fn(() => false),
      startLoop: vi.fn(),
      stopLoop: vi.fn(),
      play: vi.fn()
    };
    const network = { _activeMiningDrillTier: null };
    const player = {
      ship: { miningTier: 2 },
      onMiningStarted: vi.fn(),
      onResourceMined: vi.fn(),
      onMiningComplete: vi.fn(),
      onMiningCancelled: vi.fn(),
      onMiningError: vi.fn()
    };
    const register = loadRegister('client/js/network/mining.js', {
      AudioManager: audioManager,
      Network: network,
      Player: player
    });
    const handlers = captureHandlers(register);

    handlers.get('mining:started')({});
    expect(network._activeMiningDrillTier).toBe(2);
    expect(audioManager.startLoop).toHaveBeenLastCalledWith('mining_drill_2');

    player.ship.miningTier = 3;
    handlers.get('mining:started')({});
    expect(audioManager.stopLoop).toHaveBeenCalledWith('mining_drill_2');
    expect(audioManager.startLoop).toHaveBeenLastCalledWith('mining_drill_3');
    expect(network._activeMiningDrillTier).toBe(3);

    handlers.get('mining:complete')({ quantity: 4 });
    expect(audioManager.stopLoop).toHaveBeenCalledWith('mining_drill_3');
    expect(audioManager.play).toHaveBeenCalledWith('mining_complete');
    expect(network._activeMiningDrillTier).toBeNull();

    audioManager.stopLoop.mockClear();
    handlers.get('mining:complete')({ quantity: 0 });
    expect(audioManager.stopLoop).not.toHaveBeenCalled();

    handlers.get('mining:started')({ miningTier: 4 });
    handlers.get('mining:cancelled')({});
    expect(audioManager.stopLoop).toHaveBeenCalledWith('mining_drill_4');
    expect(network._activeMiningDrillTier).toBeNull();
  });

  it('clears drill state even when no AudioManager exists', () => {
    const network = { _activeMiningDrillTier: 5 };
    const player = {
      onMiningStarted: vi.fn(),
      onResourceMined: vi.fn(),
      onMiningComplete: vi.fn(),
      onMiningCancelled: vi.fn(),
      onMiningError: vi.fn()
    };
    const register = loadRegister('client/js/network/mining.js', {
      Network: network,
      Player: player
    });
    const handlers = captureHandlers(register);

    handlers.get('mining:cancelled')({});
    expect(network._activeMiningDrillTier).toBeNull();
  });
});

describe('gravity well managed loops', () => {
  it('keeps independent wells and stops them without graphics or audio readiness', () => {
    const audioManager = {
      isReady: vi.fn(() => false),
      playAt: vi.fn(),
      startLoop: vi.fn(),
      stopLoop: vi.fn()
    };
    const register = loadRegister('client/js/network/npc.js', {
      AudioManager: audioManager,
      Logger: { log: vi.fn() }
    });
    const handlers = captureHandlers(register);
    const gravityWell = handlers.get('void:gravityWell');

    gravityWell({
      leviathanId: 'leviathan-a',
      phase: 'active',
      position: { x: 10, y: 20 }
    });
    gravityWell({
      leviathanId: 'leviathan-b',
      phase: 'active',
      position: { x: 30, y: 40 }
    });
    gravityWell({
      leviathanId: 'leviathan-a',
      phase: 'active',
      position: { x: 15, y: 25 }
    });

    expect(audioManager.startLoop.mock.calls).toEqual([
      ['void_gravity_active', { x: 10, y: 20 }, 'gravity_well_leviathan-a'],
      ['void_gravity_active', { x: 30, y: 40 }, 'gravity_well_leviathan-b'],
      ['void_gravity_active', { x: 15, y: 25 }, 'gravity_well_leviathan-a']
    ]);

    gravityWell({
      leviathanId: 'leviathan-a',
      phase: 'end',
      position: { x: 15, y: 25 }
    });
    expect(audioManager.stopLoop).toHaveBeenCalledOnce();
    expect(audioManager.stopLoop).toHaveBeenCalledWith('gravity_well_leviathan-a');

    gravityWell({
      leviathanId: 'leviathan-b',
      phase: 'warning',
      position: { x: 30, y: 40 }
    });
    expect(audioManager.playAt)
      .toHaveBeenCalledWith('void_gravity_warning', 30, 40);
  });
});

describe('Swarm Queen client lifecycle', () => {
  it('retains phase state, calls the visual contract, and clears death state', () => {
    const queen = {
      id: 'queen-1',
      phaseManager: { currentPhase: 'HUNT' }
    };
    const entities = {
      npcs: new Map([[queen.id, queen]]),
      removeNPC: vi.fn((id) => entities.npcs.delete(id))
    };
    const queenVisuals = {
      setQueenPhase: vi.fn(),
      triggerPhaseTransition: vi.fn(),
      clearQueen: vi.fn()
    };
    const register = loadRegister('client/js/network/npc.js', {
      window: { Logger: { category: vi.fn() } },
      Entities: entities,
      QueenVisuals: queenVisuals
    });
    const handlers = captureHandlers(register);

    handlers.get('swarm:queenSpawn')({ id: queen.id, x: 10, y: 20 });
    expect(queenVisuals.setQueenPhase).toHaveBeenCalledWith(queen.id, 'HUNT');

    handlers.get('queen:phaseChange')({
      queenId: queen.id,
      x: 30,
      y: 40,
      phase: 'SIEGE',
      fromPhase: 'HUNT'
    });
    expect(queen.phaseManager.currentPhase).toBe('SIEGE');
    expect(queenVisuals.triggerPhaseTransition).toHaveBeenCalledWith(
      queen.id,
      30,
      40,
      { from: 'HUNT', to: 'SIEGE' }
    );

    handlers.get('swarm:queenDeath')({ id: queen.id, x: 30, y: 40 });
    expect(entities.removeNPC).toHaveBeenCalledWith(queen.id);
    expect(queenVisuals.clearQueen).toHaveBeenCalledWith(queen.id);
  });

  it('renders assimilated base destruction with the Swarm audiovisual profile', () => {
    const audioManager = {
      isReady: vi.fn(() => true),
      playAt: vi.fn()
    };
    const destruction = { trigger: vi.fn() };
    const entities = {
      npcs: new Map(),
      destroyBase: vi.fn()
    };
    const register = loadRegister('client/js/network/npc.js', {
      window: { Logger: { category: vi.fn() } },
      AudioManager: audioManager,
      BaseDestructionSequence: destruction,
      Entities: entities
    });
    const handlers = captureHandlers(register);

    handlers.get('base:destroyed')({
      id: 'base-1',
      x: 100,
      y: 200,
      size: 90,
      baseType: 'assimilated_pirate_outpost',
      destroyedDrones: []
    });

    expect(audioManager.playAt)
      .toHaveBeenCalledWith('base_destruction_swarm', 100, 200);
    expect(destruction.trigger).toHaveBeenCalledWith(100, 200, 'swarm_hive', 90);
    expect(entities.destroyBase).toHaveBeenCalledWith('base-1');
  });
});
