import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../../..');

function createBrowserContext(overrides = {}) {
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Set,
    Number,
    window: {},
    ...overrides
  });
  context.globalThis = context;
  return context;
}

function loadBrowserScript(context, relativePath, globalName) {
  const filename = path.join(PROJECT_ROOT, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  vm.runInContext(source, context, { filename });
  return vm.runInContext(globalName, context);
}

function createGameHarness(targetFPS = 60) {
  let now = 0;
  const frameBudgetMonitor = {
    recordFrameTime: vi.fn(),
    pause: vi.fn()
  };
  const context = createBrowserContext({
    performance: { now: () => now },
    requestAnimationFrame: vi.fn(),
    document: {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    GraphicsSettings: { getTargetFPS: () => targetFPS },
    FrameBudgetMonitor: frameBudgetMonitor,
    Logger: { log: vi.fn() }
  });
  const game = loadBrowserScript(context, 'client/js/game.js', 'Game');
  game.running = true;
  game._tabVisible = true;
  game._boundLoop = vi.fn();
  game._resetFrameTiming(0);
  game.update = vi.fn();
  game.render = vi.fn();

  return {
    game,
    frameBudgetMonitor,
    setNow(value) {
      now = value;
    }
  };
}

function runCadence(refreshRate, targetFPS = 60) {
  const harness = createGameHarness(targetFPS);
  for (let frame = 1; frame <= refreshRate; frame++) {
    harness.setNow(frame * 1000 / refreshRate);
    harness.game.loop();
  }
  return harness;
}

describe('frame snapshot ownership', () => {
  it('reuses the current frame snapshot for asynchronous upgrade HUD refreshes', () => {
    const handlers = new Map();
    const snapshot = { stars: [], planets: [], asteroids: [], wormholes: [], bases: [] };
    const update = vi.fn();
    const context = createBrowserContext({
      window: { Logger: { log: vi.fn() } },
      Player: {
        ship: { engineTier: 1 },
        shield: { current: 20, max: 50 },
        hull: { current: 80, max: 100 },
        inventory: [],
        credits: 100
      },
      Game: { _visibleWorldObjects: snapshot },
      HUD: { update }
    });
    loadBrowserScript(context, 'client/js/network/ship.js', 'register');
    const registerShip = vm.runInContext('register', context);
    registerShip({ on: (event, handler) => handlers.set(event, handler) });

    handlers.get('upgrade:success')({
      component: 'engine',
      newTier: 2,
      credits: 50
    });

    expect(update).toHaveBeenCalledWith(snapshot);
  });
});

describe('client fixed-step frame pacing', () => {
  it('runs the same 60 simulation steps over one second at 30 Hz and 120 Hz', () => {
    const at30Hz = runCadence(30);
    const at120Hz = runCadence(120);

    expect(at30Hz.game.update).toHaveBeenCalledTimes(60);
    expect(at120Hz.game.update).toHaveBeenCalledTimes(60);
    for (const [dt] of at30Hz.game.update.mock.calls) {
      expect(dt).toBeCloseTo(1 / 60, 12);
    }
    for (const [dt] of at120Hz.game.update.mock.calls) {
      expect(dt).toBeCloseTo(1 / 60, 12);
    }
  });

  it('bounds catch-up after a long foreground stall', () => {
    const { game, setNow } = createGameHarness();
    setNow(1000);

    game.loop();

    expect(game.update).toHaveBeenCalledTimes(game.MAX_CATCH_UP_STEPS);
    expect(game._simulationAccumulator).toBeLessThan(1000 / game.SIMULATION_HZ);
  });

  it('does not predict or render while connection-paused', () => {
    const { game, setNow } = createGameHarness();
    game.paused = true;
    setNow(1000);

    game.loop();

    expect(game.update).not.toHaveBeenCalled();
    expect(game.render).not.toHaveBeenCalled();
    game.resume();
    expect(game.paused).toBe(false);
  });

  it('records only frames that are actually rendered at a throttled target FPS', () => {
    const { game, frameBudgetMonitor } = runCadence(60, 30);

    expect(game.render).toHaveBeenCalledTimes(30);
    expect(frameBudgetMonitor.recordFrameTime).toHaveBeenCalledTimes(30);
    for (const [frameTime] of frameBudgetMonitor.recordFrameTime.mock.calls) {
      expect(frameTime).toBeCloseTo(1000 / 30, 8);
    }
  });

  it('resets simulation, render, and monitor timing on each visibility change', () => {
    let now = 100;
    let visibilityHandler;
    const document = {
      hidden: false,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'visibilitychange') visibilityHandler = handler;
      }),
      removeEventListener: vi.fn()
    };
    const frameBudgetMonitor = { recordFrameTime: vi.fn(), pause: vi.fn() };
    const context = createBrowserContext({
      performance: { now: () => now },
      requestAnimationFrame: vi.fn(),
      document,
      FrameBudgetMonitor: frameBudgetMonitor,
      Logger: { log: vi.fn() }
    });
    const game = loadBrowserScript(context, 'client/js/game.js', 'Game');
    game.update = vi.fn();
    game.render = vi.fn();
    game.start();

    game._simulationAccumulator = 12;
    game._renderAccumulator = 9;
    document.hidden = true;
    now = 2000;
    visibilityHandler();
    expect(game._simulationAccumulator).toBe(0);
    expect(game._renderAccumulator).toBe(0);
    expect(game._lastRenderTime).toBe(2000);

    game._simulationAccumulator = 7;
    game._renderAccumulator = 5;
    document.hidden = false;
    now = 3000;
    visibilityHandler();
    expect(game._simulationAccumulator).toBe(0);
    expect(game._renderAccumulator).toBe(0);
    expect(game._lastRenderTime).toBe(3000);
    expect(frameBudgetMonitor.pause).toHaveBeenCalledWith(1000);
  });

  it('reuses one correctly sized world snapshot across update and render', () => {
    const visibleObjects = {
      stars: [], planets: [], asteroids: [], wormholes: [], bases: [], comets: []
    };
    const getVisibleObjects = vi.fn(() => visibleObjects);
    const player = {
      position: { x: 10, y: 20 },
      getRadarRange: vi.fn(() => 500),
      update: vi.fn()
    };
    const renderer = {
      width: 800,
      height: 600,
      update: vi.fn(),
      clear: vi.fn(),
      drawWorld: vi.fn(),
      drawEntities: vi.fn(),
      drawPlayer: vi.fn(),
      drawUI: vi.fn()
    };
    const context = createBrowserContext({
      Player: player,
      World: { getVisibleObjects, update: vi.fn() },
      Radar: { getWorldQueryDiameter: vi.fn(() => 6000) },
      Renderer: renderer,
      Entities: { update: vi.fn() },
      HUD: { update: vi.fn() }
    });
    const game = loadBrowserScript(context, 'client/js/game.js', 'Game');

    game.update(1 / 60);
    game.render();

    expect(getVisibleObjects).toHaveBeenCalledOnce();
    expect(getVisibleObjects).toHaveBeenCalledWith(player.position, 6000);
    expect(player.update).toHaveBeenCalledWith(1 / 60, visibleObjects);
    expect(renderer.update).toHaveBeenCalledWith(1 / 60, visibleObjects);
    expect(context.HUD.update).toHaveBeenCalledWith(visibleObjects);
    expect(renderer.clear).toHaveBeenCalledWith(visibleObjects);
    expect(renderer.drawWorld).toHaveBeenCalledWith(visibleObjects);
  });
});

describe('client world snapshot consumers', () => {
  it('does not rescan the world when Player receives the shared snapshot', () => {
    const visibleObjects = {
      stars: [], planets: [], asteroids: [], wormholes: [], bases: [], comets: []
    };
    const getVisibleObjects = vi.fn(() => visibleObjects);
    const hint = { classList: { add: vi.fn(), remove: vi.fn() } };
    const audioManager = {
      startLoop: vi.fn(),
      stopLoop: vi.fn(),
      play: vi.fn()
    };
    const context = createBrowserContext({
      document: { getElementById: vi.fn(() => hint) },
      Input: {
        getMovementInput: vi.fn(() => ({
          isMobile: false,
          up: false,
          down: false,
          left: false,
          right: false
        }))
      },
      CONSTANTS: {
        BASE_SPEED: 100,
        TIER_MULTIPLIER: 1.5,
        BASE_ROTATION_SPEED: 3,
        POSITION_SYNC_RATE: 50,
        MINING_RANGE: 100,
        SHIELD_RECHARGE_RATE: 1,
        BASE_MINING_TIME: 3000,
        ENERGY_CORE: { BOOST: {} },
        RELIC_TYPES: {},
        SECTOR_SIZE: 1000,
        GRAVEYARD_ZONE: null
      },
      World: {
        getVisibleObjects,
        isObjectDepleted: vi.fn(() => false)
      },
      Physics: { computeStarGravity: vi.fn() },
      AudioManager: audioManager,
      Network: { sendMovement: vi.fn() },
      Entities: {
        getClosestWreckage: vi.fn(() => null),
        bases: new Map()
      },
      Logger: { log: vi.fn() }
    });
    const player = loadBrowserScript(context, 'client/js/player.js', 'Player');
    player.relics = [];
    player.boostActive = true;
    player.boostEndTime = Date.now() + 1000;
    player._boostLoopActive = false;

    player.update(1 / 60, visibleObjects);

    expect(getVisibleObjects).not.toHaveBeenCalled();
    expect(audioManager.startLoop).toHaveBeenCalledWith('boost_sustain');
    expect(player._boostLoopActive).toBe(true);
  });
});

describe('client world sector lifecycle', () => {
  it('loads during init and only generates or evicts after entering another sector', () => {
    const context = createBrowserContext({
      CONSTANTS: { SECTOR_SIZE: 1000 },
      Player: { position: { x: 2100, y: -20 } },
      Logger: {
        category: vi.fn(),
        error: vi.fn()
      }
    });
    const world = loadBrowserScript(context, 'client/js/world.js', 'World');
    world.generateSector = vi.fn((sectorX, sectorY) => {
      const sector = { x: sectorX, y: sectorY };
      world.sectors.set(`${sectorX}_${sectorY}`, sector);
      return sector;
    });

    world.init('test-seed');

    expect(world.currentSector).toEqual({ x: 2, y: -1 });
    expect(world.generateSector).toHaveBeenCalledTimes(25);

    world.sectors.set('99_99', { x: 99, y: 99 });
    expect(world.update({ x: 2999, y: -1 })).toBe(false);
    expect(world.generateSector).toHaveBeenCalledTimes(25);
    expect(world.sectors.has('99_99')).toBe(true);

    expect(world.update({ x: 3000, y: -1 })).toBe(true);
    expect(world.currentSector).toEqual({ x: 3, y: -1 });
    expect(world.generateSector).toHaveBeenCalledTimes(30);
    expect(world.sectors.has('99_99')).toBe(false);
  });
});

describe('renderer logical dimensions and mobile budgets', () => {
  function createRendererHarness() {
    let renderScale = 0.75;
    let settingsListener;
    let resizeHandler;
    const ctx = {
      setTransform: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn()
    };
    const canvas = {
      width: 0,
      height: 0,
      style: {},
      getContext: vi.fn(() => ctx)
    };
    const window = {
      innerWidth: 1200,
      innerHeight: 600,
      devicePixelRatio: 2,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'resize') resizeHandler = handler;
      })
    };
    const renderContext = {};
    const graphicsSettings = {
      getRenderScale: vi.fn(() => renderScale),
      addListener: vi.fn((listener) => {
        settingsListener = listener;
        return vi.fn();
      })
    };
    const context = createBrowserContext({
      window,
      document: { getElementById: vi.fn(() => canvas) },
      DeviceDetect: { isMobile: false },
      GraphicsSettings: graphicsSettings,
      GradientCache: { init: vi.fn(), clear: vi.fn() },
      ParticleSystem: { init: vi.fn() },
      ShipGeometry: { init: vi.fn() },
      RenderContext: renderContext,
      Logger: { log: vi.fn() }
    });
    const renderer = loadBrowserScript(context, 'client/js/renderer.js', 'Renderer');

    return {
      renderer,
      canvas,
      ctx,
      window,
      renderContext,
      setRenderScale(value) {
        renderScale = value;
      },
      notifySettings() {
        settingsListener();
      },
      notifyResize() {
        resizeHandler();
      }
    };
  }

  it('keeps a logical draw space while resizing backing pixels for scale and DPR', () => {
    const harness = createRendererHarness();
    harness.renderer.init();

    expect(harness.renderer.width).toBe(800);
    expect(harness.renderer.height).toBe(600);
    expect(harness.canvas.width).toBe(1200);
    expect(harness.canvas.height).toBe(900);
    expect(harness.canvas.style.width).toBe('800px');
    expect(harness.canvas.style.height).toBe('600px');
    expect(harness.ctx.setTransform).toHaveBeenLastCalledWith(1.5, 0, 0, 1.5, 0, 0);

    harness.setRenderScale(0.5);
    harness.notifySettings();
    expect(harness.canvas.width).toBe(800);
    expect(harness.canvas.height).toBe(600);
    expect(harness.renderer.width).toBe(800);
    expect(harness.renderer.height).toBe(600);

    harness.window.devicePixelRatio = 1.25;
    harness.notifyResize();
    expect(harness.canvas.width).toBe(500);
    expect(harness.canvas.height).toBe(375);
    expect(harness.ctx.setTransform).toHaveBeenLastCalledWith(0.625, 0, 0, 0.625, 0, 0);
    expect(harness.renderContext.dpr).toBe(1.25);
    expect(harness.renderContext.width).toBe(800);
    expect(harness.renderContext.height).toBe(600);
  });

  it('passes logical dimensions to full-screen overlays', () => {
    const starEffects = {
      drawHeatOverlay: vi.fn(),
      drawZoneWarning: vi.fn()
    };
    const deathEffect = { draw: vi.fn() };
    const context = createBrowserContext({
      StarEffects: starEffects,
      PlayerDeathEffect: deathEffect
    });
    const renderer = loadBrowserScript(context, 'client/js/renderer.js', 'Renderer');
    renderer.ctx = {};
    renderer.canvas = { width: 1600, height: 1200 };
    renderer.width = 800;
    renderer.height = 600;

    renderer.drawUI();

    expect(starEffects.drawHeatOverlay).toHaveBeenCalledWith(renderer.ctx, 800, 600);
    expect(starEffects.drawZoneWarning).toHaveBeenCalledWith(renderer.ctx, 800, 600);
    expect(deathEffect.draw).toHaveBeenCalledWith(renderer.ctx, 800, 600);
  });

  it('uses logical dimensions in the modular render pipeline', () => {
    const getVisibleObjects = vi.fn(() => ({
      stars: [], wormholes: [], planets: [], asteroids: [], bases: [], comets: []
    }));
    const drawWorld = vi.fn();
    const context = createBrowserContext({
      RenderContext: {
        ctx: {},
        camera: { x: 0, y: 0 },
        width: 800,
        height: 600,
        canvas: { width: 400, height: 300 }
      },
      Player: { position: { x: 0, y: 0 } },
      World: { getVisibleObjects },
      WorldLayer: { draw: drawWorld }
    });
    const pipeline = loadBrowserScript(
      context,
      'client/js/renderer/RenderPipeline.js',
      'RenderPipeline'
    );

    pipeline.renderWorld();

    expect(getVisibleObjects).toHaveBeenCalledWith(context.Player.position, 800);
    expect(drawWorld).toHaveBeenCalledOnce();
  });

  it('culls secondary effects in logical pixels rather than backing pixels', () => {
    const renderContext = { width: 800, height: 600 };
    const createCtx = () => ({
      canvas: { width: 400, height: 300, clientWidth: 800, clientHeight: 600 },
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn()
    });

    const derelictContext = createBrowserContext({ RenderContext: renderContext });
    const derelicts = loadBrowserScript(
      derelictContext,
      'client/js/graphics/derelict-renderer.js',
      'DerelictRenderer'
    );
    derelicts.derelicts.set('visible', { x: 700, y: 300, size: 10 });
    derelicts.drawDerelictShip = vi.fn();
    derelicts.drawOrbitingDebris = vi.fn();
    derelicts.drawSparks = vi.fn();
    const derelictCtx = createCtx();
    derelicts.draw(derelictCtx, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(derelicts.drawDerelictShip).toHaveBeenCalledOnce();

    const leviathanContext = createBrowserContext({ RenderContext: renderContext });
    const leviathan = loadBrowserScript(
      leviathanContext,
      'client/js/graphics/leviathan-spawn.js',
      'LeviathanSpawn'
    );
    leviathan.activeSpawns.set('visible', {
      x: 750,
      y: 300,
      startTime: Date.now(),
      currentPhase: 'cracks',
      cracks: [],
      complete: false
    });
    leviathan.drawCracksPhase = vi.fn();
    const leviathanCtx = createCtx();
    leviathan.draw(leviathanCtx, { x: 0, y: 0 });
    expect(leviathanCtx.save).toHaveBeenCalledOnce();

    const voidContext = createBrowserContext({
      RenderContext: renderContext,
      CONSTANTS: {}
    });
    const voidRifts = loadBrowserScript(
      voidContext,
      'client/js/graphics/void-effects.js',
      'RiftPortal'
    );
    voidRifts.activeRifts.set('visible', {
      x: 700,
      y: 300,
      rotation: 0,
      scale: 1,
      config: { type: 'elliptical' }
    });
    voidRifts.drawElliptical = vi.fn();
    const voidCtx = createCtx();
    voidRifts.draw(voidCtx, { x: 0, y: 0 });
    expect(voidRifts.drawElliptical).toHaveBeenCalledOnce();
  });

  it('adapts the top-left camera to centered comet coordinates', () => {
    const drawComet = vi.fn();
    const getVisibleObjects = vi.fn(() => ({
      stars: [],
      wormholes: [],
      planets: [],
      asteroids: [],
      bases: [],
      comets: [{ size: 10, tailLengthFactor: 2 }]
    }));
    const cometState = { x: 1000, y: 1000, visible: true, angle: 0 };
    const context = createBrowserContext({
      Player: { position: { x: 1000, y: 1000 } },
      World: { getVisibleObjects },
      Physics: {
        getOrbitTime: vi.fn(() => 10),
        computeCometPosition: vi.fn(() => cometState)
      },
      CelestialRenderer: { drawComet }
    });
    const renderer = loadBrowserScript(context, 'client/js/renderer.js', 'Renderer');
    renderer.ctx = {};
    renderer.width = 800;
    renderer.height = 600;

    renderer.drawWorld();

    expect(getVisibleObjects).toHaveBeenCalledWith(context.Player.position, 800);
    expect(drawComet).toHaveBeenCalledWith(
      renderer.ctx,
      expect.any(Object),
      cometState,
      { x: 1000, y: 1000, zoom: 1, width: 800, height: 600 }
    );
  });

  it('draws the sector grid from the renderer camera top-left', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn()
    };
    const context = createBrowserContext();
    const renderer = loadBrowserScript(context, 'client/js/renderer.js', 'Renderer');
    renderer.ctx = ctx;
    renderer.camera = { x: 1000, y: 2000 };
    renderer.width = 800;
    renderer.height = 600;

    renderer.drawSectorGrid();

    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(0, 600);
    expect(ctx.lineTo).toHaveBeenCalledWith(800, 0);
  });

  it('does not advance wreckage rotation during rendering', () => {
    const updateWreckageRotation = vi.fn();
    const context = createBrowserContext({
      Entities: {
        wreckage: new Map(),
        updateWreckageRotation
      },
      DeviceDetect: { isMobile: false }
    });
    const renderer = loadBrowserScript(context, 'client/js/renderer.js', 'Renderer');
    renderer.ctx = {};

    renderer.drawWreckage();

    expect(updateWreckageRotation).not.toHaveBeenCalled();
  });

  it('keeps the auto-fire target and bosses inside the 15-NPC mobile cap', () => {
    const context = createBrowserContext({
      AutoFire: { currentTarget: { id: 'target' } }
    });
    const renderer = loadBrowserScript(context, 'client/js/renderer.js', 'Renderer');
    const entries = [];
    for (let index = 1; index <= 20; index++) {
      entries.push([`normal-${index}`, { position: { x: index, y: 0 }, type: 'pirate_fighter' }]);
    }
    entries.push(['type-boss', {
      position: { x: 100, y: 0 },
      type: 'void_leviathan'
    }]);
    entries.push(['flag-boss', {
      position: { x: 90, y: 0 },
      type: 'unknown',
      isBoss: true
    }]);
    entries.push(['target', {
      position: { x: 80, y: 0 },
      type: 'pirate_fighter'
    }]);

    const selected = renderer.selectMobileNpcEntries(
      entries,
      { x: 0, y: 0 },
      200 * 200,
      15
    );
    const selectedIds = selected.map(([id]) => id);

    expect(selected).toHaveLength(15);
    expect(selectedIds).toContain('target');
    expect(selectedIds).toContain('type-boss');
    expect(selectedIds).toContain('flag-boss');
    expect(selectedIds).not.toContain('normal-20');
  });
});
