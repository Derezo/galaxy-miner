import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');

function createContext(globals = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Set,
    Number,
    setTimeout,
    clearTimeout,
    module,
    exports: module.exports,
    window: { Logger: { category: vi.fn() } },
    Logger: { log: vi.fn(), warn: vi.fn() },
    ...globals
  });
  context.globalThis = context;
  return context;
}

function loadScript(context, relativePath, expression) {
  const filename = path.join(PROJECT_ROOT, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return vm.runInContext(expression, context);
}

function captureHandlers(register) {
  const handlers = new Map();
  register({ on: (event, handler) => handlers.set(event, handler) });
  return handlers;
}

describe('Scavenger growth presentation', () => {
  it('uses the authoritative event position and retains the growth multiplier', () => {
    const hauler = {
      id: 'hauler-1',
      position: { x: 1, y: 2 },
      sizeMultiplier: 1.8
    };
    const particles = { spawn: vi.fn() };
    const context = createContext({
      Entities: { npcs: new Map([[hauler.id, hauler]]) },
      ParticleSystem: particles
    });
    const register = loadScript(
      context,
      'client/js/network/scavenger.js',
      'module.exports.register'
    );
    const handlers = captureHandlers(register);

    handlers.get('scavenger:haulerGrow')({
      npcId: hauler.id,
      sizeMultiplier: 2.3,
      position: { x: 40, y: 50 }
    });

    expect(hauler.sizeMultiplier).toBe(2.3);
    expect(particles.spawn).toHaveBeenCalledTimes(10);
    expect(particles.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ x: 40, y: 50 })
    );
  });

  it('multiplies Hauler geometry by the live growth value', () => {
    const context = createContext({
      GraphicsSettings: { getQuality: () => 0 }
    });
    const geometry = loadScript(
      context,
      'client/js/graphics/npc-ships.js',
      'NPCShipGeometry'
    );
    geometry.cachedPaths.scavenger_4 = {};
    geometry.drawScavengerEffects = vi.fn();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    };

    geometry.draw(
      ctx,
      { x: 0, y: 0 },
      0,
      'scavenger_hauler',
      'scavenger',
      { x: 100, y: 100 },
      Date.now(),
      { sizeMultiplier: 1.4, state: 'patrol' }
    );

    expect(ctx.scale).toHaveBeenCalledWith(1.8 * 1.4, 1.8 * 1.4);
  });
});

describe('Void destruction presentation', () => {
  it('calls the Leviathan sequence and cleans every persistent Void visual', () => {
    const leviathan = {
      id: 'leviathan-1',
      type: 'void_leviathan',
      faction: 'void',
      isBoss: true,
      hullMax: 1500,
      position: { x: 80, y: 90 },
      rotation: 0.75
    };
    const npcs = new Map([[leviathan.id, leviathan]]);
    const deathEffects = {
      triggerLeviathanDeath: vi.fn(),
      triggerQueenDeath: vi.fn(),
      trigger: vi.fn(),
      getEffectForFaction: vi.fn()
    };
    const audio = {
      isReady: vi.fn(() => true),
      playAt: vi.fn(),
      stopLoop: vi.fn()
    };
    const rifts = { setState: vi.fn(), remove: vi.fn() };
    const particles = { removeNPC: vi.fn() };
    const gravity = { setPhase: vi.fn() };
    const context = createContext({
      Entities: {
        npcs,
        removeNPC: vi.fn(id => npcs.delete(id))
      },
      DeathEffects: deathEffects,
      AudioManager: audio,
      RiftPortal: rifts,
      VoidParticles: particles,
      GravityWellEffect: gravity
    });
    const register = loadScript(
      context,
      'client/js/network/npc.js',
      'module.exports.register'
    );
    const handlers = captureHandlers(register);

    handlers.get('npc:destroyed')({ id: leviathan.id, destroyedBy: 99 });
    handlers.get('npc:leave')({ id: leviathan.id });

    expect(deathEffects.triggerLeviathanDeath)
      .toHaveBeenCalledWith(80, 90, 0.75);
    expect(deathEffects.trigger).not.toHaveBeenCalled();
    expect(audio.playAt).not.toHaveBeenCalled();
    expect(rifts.setState).toHaveBeenCalledWith(leviathan.id, 'close');
    expect(rifts.remove).not.toHaveBeenCalled();
    expect(particles.removeNPC).toHaveBeenCalledWith(leviathan.id);
    expect(gravity.setPhase)
      .toHaveBeenCalledWith(`gravity_well_${leviathan.id}`, 'end');
    expect(audio.stopLoop)
      .toHaveBeenCalledWith(`gravity_well_${leviathan.id}`);
    expect(npcs.has(leviathan.id)).toBe(false);
  });
});

describe('Void visibility retirement', () => {
  it('silently clears every persistent effect when a Leviathan leaves range', () => {
    const leviathan = {
      id: 'leviathan-out-of-range',
      type: 'void_leviathan',
      faction: 'void',
      position: { x: 80, y: 90 }
    };
    const npcs = new Map([[leviathan.id, leviathan]]);
    const rifts = { remove: vi.fn() };
    const particles = { removeNPC: vi.fn() };
    const gravity = { remove: vi.fn() };
    const audio = { stopLoop: vi.fn(), playAt: vi.fn(), play: vi.fn() };
    const context = createContext({
      Entities: {
        npcs,
        removeNPC: vi.fn(id => npcs.delete(id))
      },
      AudioManager: audio,
      RiftPortal: rifts,
      VoidParticles: particles,
      GravityWellEffect: gravity,
      DeathEffects: { trigger: vi.fn() }
    });
    const register = loadScript(
      context,
      'client/js/network/npc.js',
      'module.exports.register'
    );
    const handlers = captureHandlers(register);

    handlers.get('npc:leave')({ id: leviathan.id });

    const wellId = `gravity_well_${leviathan.id}`;
    expect(rifts.remove).toHaveBeenCalledWith(leviathan.id);
    expect(particles.removeNPC).toHaveBeenCalledWith(leviathan.id);
    expect(gravity.remove).toHaveBeenCalledWith(wellId);
    expect(audio.stopLoop).toHaveBeenCalledWith(wellId);
    expect(audio.playAt).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
    expect(npcs.has(leviathan.id)).toBe(false);
  });
});

describe('Assimilation NPC identity transition', () => {
  it('applies the full converted snapshot and removes stale Void presentation', () => {
    const convertedNpc = {
      id: 'converted-void',
      type: 'void_phantom',
      name: 'Void Phantom',
      faction: 'void',
      position: { x: 100, y: 200 },
      targetPosition: { x: 100, y: 200 },
      formationId: 'old-formation',
      formationLeader: true,
      isFormationLeader: true,
      hull: 140,
      hullMax: 140,
      shield: 100,
      shieldMax: 100
    };
    const npcs = new Map([[convertedNpc.id, convertedNpc]]);
    const updateNPC = vi.fn(data => {
      const entity = npcs.get(data.id);
      Object.assign(entity, {
        type: data.type,
        name: data.name,
        faction: data.faction,
        hull: data.hull,
        hullMax: data.hullMax,
        shield: data.shield,
        shieldMax: data.shieldMax,
        state: data.state,
        isBoss: data.isBoss,
        sizeMultiplier: data.sizeMultiplier,
        phase: data.phase
      });
      entity.position = { x: data.x, y: data.y };
    });
    const rifts = { remove: vi.fn() };
    const particles = { removeNPC: vi.fn() };
    const context = createContext({
      Entities: {
        npcs,
        bases: new Map([['converted-base', { faction: 'void', type: 'void_rift' }]]),
        updateNPC
      },
      RiftPortal: rifts,
      VoidParticles: particles
    });
    const register = loadScript(
      context,
      'client/js/network/npc.js',
      'module.exports.register'
    );
    const handlers = captureHandlers(register);

    handlers.get('swarm:baseAssimilated')({
      baseId: 'converted-base',
      newType: 'assimilated_void_rift',
      position: { x: 100, y: 200 },
      convertedNpcs: [{
        id: convertedNpc.id,
        npcId: convertedNpc.id,
        oldType: 'void_phantom',
        oldFaction: 'void',
        type: 'swarm_warrior',
        newType: 'swarm_warrior',
        name: 'Swarm Warrior',
        faction: 'swarm',
        x: 100,
        y: 200,
        rotation: 0.5,
        state: 'patrol',
        hull: 120,
        hullMax: 120,
        shield: 40,
        shieldMax: 40,
        isBoss: false,
        sizeMultiplier: 1,
        phase: null,
        vx: 0,
        vy: 0
      }]
    });

    expect(rifts.remove).toHaveBeenCalledOnce();
    expect(rifts.remove).toHaveBeenCalledWith(convertedNpc.id);
    expect(particles.removeNPC).toHaveBeenCalledWith(convertedNpc.id);
    expect(updateNPC).toHaveBeenCalledWith(expect.objectContaining({
      id: convertedNpc.id,
      type: 'swarm_warrior',
      faction: 'swarm',
      hullMax: 120,
      shieldMax: 40,
      phase: null
    }));
    expect(convertedNpc).toMatchObject({
      type: 'swarm_warrior',
      name: 'Swarm Warrior',
      faction: 'swarm',
      hullMax: 120,
      shieldMax: 40,
      formationLeader: false,
      isFormationLeader: false
    });
    expect(convertedNpc).not.toHaveProperty('formationId');
  });
});

describe('Faction event presentation contracts', () => {
  it('marks Queen guards using the server payload id', () => {
    const guard = { id: 'guard-1' };
    const context = createContext({
      Entities: { npcs: new Map([[guard.id, guard]]) }
    });
    const register = loadScript(
      context,
      'client/js/network/npc.js',
      'module.exports.register'
    );
    const handlers = captureHandlers(register);

    handlers.get('swarm:queenDeathRage')({
      queenX: 0,
      queenY: 0,
      ragingGuards: [{ id: guard.id }],
      rageDuration: 30000
    });

    expect(guard.isEnraged).toBe(true);
    expect(guard.enrageExpires).toBeGreaterThan(Date.now());
  });

  it('renders authoritative Void minion rift positions unchanged', () => {
    const voidEffects = { spawnMinions: vi.fn() };
    const context = createContext({ VoidEffects: voidEffects });
    const register = loadScript(
      context,
      'client/js/network/npc.js',
      'module.exports.register'
    );
    const handlers = captureHandlers(register);
    const riftPositions = [
      { x: 250, y: 400 },
      { x: 50, y: 400 }
    ];

    handlers.get('void:spawnMinions')({
      position: { x: 150, y: 400 },
      riftCount: riftPositions.length,
      riftPositions
    });

    expect(voidEffects.spawnMinions).toHaveBeenCalledOnce();
    expect(voidEffects.spawnMinions).toHaveBeenCalledWith(riftPositions);
  });

  it('adapts the Leviathan socket payload to a live cinematic sequence', () => {
    const context = createContext();
    const cinematic = loadScript(
      context,
      'client/js/graphics/leviathan-spawn.js',
      'LeviathanSpawn'
    );

    const spawnId = cinematic.trigger({ x: 80, y: 90 }, 7000);

    expect(spawnId).toBe('void_leviathan_spawn_1');
    expect(cinematic.activeSpawns.get(spawnId)).toMatchObject({
      x: 80,
      y: 90,
      duration: 7000,
      currentPhase: 'cracks'
    });
  });
});
