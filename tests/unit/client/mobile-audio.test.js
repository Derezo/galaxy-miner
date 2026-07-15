import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../../..');
const require = createRequire(import.meta.url);

function createBrowserContext(overrides = {}) {
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Set,
    Promise,
    Number,
    JSON,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
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

describe('mobile targeting and movement integration', () => {
  it('resets input safely when mobile controls were not initialized on desktop', () => {
    const context = createBrowserContext({
      DeviceDetect: { isMobile: false },
      MobileHUD: { stopFiring: vi.fn() },
      Logger: { log: vi.fn() }
    });
    const joystick = loadBrowserScript(
      context,
      'client/js/mobile/virtual-joystick.js',
      'VirtualJoystick'
    );
    context.VirtualJoystick = joystick;
    const input = loadBrowserScript(context, 'client/js/input.js', 'Input');

    joystick.init();
    expect(() => input.reset()).not.toThrow();
    expect(joystick.active).toBe(false);
  });

  it('targets authoritative NPC positions and ignores malformed entities', () => {
    const nearNpc = { position: { x: 30, y: 40 }, faction: 'pirate' };
    const context = createBrowserContext({
      Player: {
        position: { x: 0, y: 0 },
        ship: { weaponTier: 1, energyCoreTier: 1 }
      },
      Entities: {
        npcs: new Map([
          ['near', nearNpc],
          ['legacy-flat-position', { x: 1, y: 1, faction: 'swarm' }],
          ['invalid', { position: { x: NaN, y: 10 }, faction: 'void' }]
        ])
      },
      Logger: { log: vi.fn() }
    });

    const autoFire = loadBrowserScript(context, 'client/js/mobile/auto-fire.js', 'AutoFire');
    const targets = autoFire.getNPCsInRange(100);

    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('near');
    expect(targets[0].x).toBe(30);
    expect(targets[0].y).toBe(40);
    expect(targets[0].distance).toBe(50);
    expect(targets[0].position).toBe(nearNpc.position);
  });

  it('does not auto-target neutral scavengers or rogue miners until hostile', () => {
    const context = createBrowserContext({
      Player: {
        position: { x: 0, y: 0 },
        ship: { weaponTier: 1, energyCoreTier: 1 }
      },
      Entities: {
        npcs: new Map([
          ['neutral-scavenger', { position: { x: 10, y: 0 }, faction: 'scavenger', state: 'patrol' }],
          ['neutral-miner', { position: { x: 20, y: 0 }, faction: 'rogue_miner', state: 'mining' }],
          ['angry-scavenger', { position: { x: 30, y: 0 }, faction: 'scavenger', state: 'enraged' }],
          ['angry-miner', { position: { x: 35, y: 0 }, faction: 'rogue_miner', state: 'enraged' }],
          ['pirate', { position: { x: 40, y: 0 }, faction: 'pirate', state: 'patrol' }]
        ])
      },
      Logger: { log: vi.fn() }
    });
    const autoFire = loadBrowserScript(context, 'client/js/mobile/auto-fire.js', 'AutoFire');

    expect(autoFire.enabled).toBe(false);
    expect(autoFire.getNPCsInRange(100).map(target => target.id))
      .toEqual(['angry-scavenger', 'angry-miner', 'pirate']);
  });

  it('preserves the virtual joystick boost flag through unified input', () => {
    const context = createBrowserContext({
      Player: { rotation: 0 },
      Logger: { log: vi.fn() }
    });

    const joystick = loadBrowserScript(context, 'client/js/mobile/virtual-joystick.js', 'VirtualJoystick');
    const input = loadBrowserScript(context, 'client/js/input.js', 'Input');

    joystick.active = true;
    joystick.thrust = 0.95;
    joystick.targetRotation = Math.PI / 4;

    const movement = input.getMovementInput();
    expect(movement.isMobile).toBe(true);
    expect(movement.boost).toBe(true);
    expect(movement.thrustMagnitude).toBe(0.95);
    expect(movement.targetRotation).toBe(Math.PI / 4);
  });

  it('resizes joystick visuals and input travel together', () => {
    const setProperty = vi.fn();
    const context = createBrowserContext({ Logger: { log: vi.fn() } });
    const joystick = loadBrowserScript(context, 'client/js/mobile/virtual-joystick.js', 'VirtualJoystick');
    joystick.element = { style: { setProperty } };

    joystick.setSize(160);

    expect(joystick.config.size).toBe(160);
    expect(joystick.config.knobSize).toBe(67);
    expect(joystick.config.maxDistance).toBeCloseTo(66.67, 1);
    expect(setProperty).toHaveBeenCalledWith('--joystick-size', '160px');
    expect(setProperty).toHaveBeenCalledWith('--joystick-knob-size', '67px');
  });
});

describe('mobile gestures', () => {
  it('binds gestures at the document boundary after finding the game canvas', () => {
    const canvas = { id: 'gameCanvas' };
    const gestureHandler = { init: vi.fn() };
    const getElementById = vi.fn((id) => id === 'gameCanvas' ? canvas : null);
    const document = { getElementById };
    const context = createBrowserContext({
      window: { innerWidth: 800, innerHeight: 500 },
      document,
      GestureHandler: gestureHandler,
      Logger: { log: vi.fn(), warn: vi.fn() }
    });

    const mobileGestures = loadBrowserScript(context, 'client/js/mobile/mobile-gestures.js', 'MobileGestures');
    mobileGestures.init();

    expect(getElementById).toHaveBeenCalledWith('gameCanvas');
    expect(gestureHandler.init).toHaveBeenCalledWith(document, expect.objectContaining({
      onDoubleTap: expect.any(Function)
    }));
  });

  it('activates the player boost only when gameplay and cooldown state allow it', () => {
    const player = {
      ship: { radarTier: 1 },
      isDead: false,
      inWormholeTransit: false,
      isBoostActive: vi.fn(() => false),
      isBoostOnCooldown: vi.fn(() => false),
      activateBoost: vi.fn()
    };
    const context = createBrowserContext({
      window: { innerWidth: 800, innerHeight: 500 },
      document: { getElementById: vi.fn(() => null) },
      Player: player,
      Logger: { log: vi.fn(), warn: vi.fn() }
    });

    const mobileGestures = loadBrowserScript(context, 'client/js/mobile/mobile-gestures.js', 'MobileGestures');

    mobileGestures.handleDoubleTap({ x: 400, y: 250 });
    expect(player.activateBoost).toHaveBeenCalledTimes(1);

    player.isBoostOnCooldown.mockReturnValue(true);
    mobileGestures.handleDoubleTap({ x: 400, y: 250 });
    expect(player.activateBoost).toHaveBeenCalledTimes(1);

    player.isBoostOnCooldown.mockReturnValue(false);
    player.isBoostActive.mockReturnValue(true);
    mobileGestures.handleDoubleTap({ x: 400, y: 250 });
    expect(player.activateBoost).toHaveBeenCalledTimes(1);

    player.isBoostActive.mockReturnValue(false);
    player.isDead = true;
    mobileGestures.handleDoubleTap({ x: 400, y: 250 });
    expect(player.activateBoost).toHaveBeenCalledTimes(1);

    player.isDead = false;
    player.inWormholeTransit = true;
    mobileGestures.handleDoubleTap({ x: 400, y: 250 });
    expect(player.activateBoost).toHaveBeenCalledTimes(1);
  });

  it('does not turn terminal or HUD double-taps into boosts', () => {
    const terminal = {
      classList: { contains: vi.fn(() => false) },
      getBoundingClientRect: () => ({ left: 100, right: 300, top: 100, bottom: 300 })
    };
    const hudHit = { closest: vi.fn(() => ({ id: 'hud' })) };
    const player = {
      ship: { radarTier: 1 },
      isDead: false,
      inWormholeTransit: false,
      activateBoost: vi.fn()
    };
    const context = createBrowserContext({
      window: { innerWidth: 800, innerHeight: 500 },
      document: {
        getElementById: vi.fn(id => ({
          'terminal-panel': terminal
        })[id] || null),
        elementFromPoint: vi.fn((x, y) => x === 50 && y === 50 ? hudHit : null)
      },
      Player: player,
      Logger: { log: vi.fn(), warn: vi.fn() }
    });
    const mobileGestures = loadBrowserScript(context, 'client/js/mobile/mobile-gestures.js', 'MobileGestures');

    mobileGestures.handleDoubleTap({ x: 200, y: 200 });
    mobileGestures.handleDoubleTap({ x: 50, y: 50 });

    expect(player.activateBoost).not.toHaveBeenCalled();
  });

  it('ignores document-level gameplay gestures while logged out or reconnecting', () => {
    const player = {
      ship: { radarTier: 5 },
      activateBoost: vi.fn()
    };
    const terminal = { visible: false, show: vi.fn(), hide: vi.fn() };
    const radarAdvanced = { toggleSectorMap: vi.fn(), setZoomScale: vi.fn() };
    const context = createBrowserContext({
      window: { innerWidth: 800, innerHeight: 500 },
      document: { getElementById: vi.fn(() => null) },
      GalaxyMiner: { gameStarted: false, connectionPaused: false },
      Player: player,
      TerminalUI: terminal,
      RadarAdvanced: radarAdvanced,
      Logger: { log: vi.fn(), warn: vi.fn() }
    });
    const mobileGestures = loadBrowserScript(context, 'client/js/mobile/mobile-gestures.js', 'MobileGestures');

    mobileGestures.handleSwipe({ direction: 'left', startX: 790, startY: 200, endX: 700, endY: 200 });
    mobileGestures.handlePinch({ scale: 1.5, center: { x: 10, y: 10 } });
    mobileGestures.handleDoubleTap({ x: 400, y: 250 });

    expect(terminal.show).not.toHaveBeenCalled();
    expect(radarAdvanced.setZoomScale).not.toHaveBeenCalled();
    expect(player.activateBoost).not.toHaveBeenCalled();

    context.GalaxyMiner.gameStarted = true;
    context.GalaxyMiner.connectionPaused = true;
    mobileGestures.handleDoubleTap({ x: 400, y: 250 });
    expect(player.activateBoost).not.toHaveBeenCalled();
  });

  it('ignores canvas touches already claimed by the joystick', () => {
    const context = createBrowserContext({ Logger: { log: vi.fn(), error: vi.fn() } });
    const gestures = loadBrowserScript(context, 'client/js/mobile/gesture-handler.js', 'GestureHandler');

    gestures.onTouchStart({
      defaultPrevented: true,
      changedTouches: [{ identifier: 1, clientX: 10, clientY: 10 }]
    });

    expect(Object.keys(gestures.touches)).toHaveLength(0);
  });

  it('preserves native interactive-control touches', () => {
    const context = createBrowserContext({ Logger: { log: vi.fn(), error: vi.fn() } });
    const gestures = loadBrowserScript(context, 'client/js/mobile/gesture-handler.js', 'GestureHandler');

    gestures.onTouchStart({
      defaultPrevented: false,
      target: { closest: vi.fn(() => ({ tagName: 'BUTTON' })) },
      changedTouches: [{ identifier: 1, clientX: 10, clientY: 10 }]
    });

    expect(Object.keys(gestures.touches)).toHaveLength(0);
  });

  it('consumes the second tap so a triple tap triggers only one double-tap', () => {
    let currentTime = 1000;
    const onDoubleTap = vi.fn();
    const context = createBrowserContext({
      Date: { now: () => currentTime },
      Logger: { log: vi.fn(), error: vi.fn() }
    });
    const gestures = loadBrowserScript(context, 'client/js/mobile/gesture-handler.js', 'GestureHandler');
    gestures.handlers.onDoubleTap = onDoubleTap;
    const event = id => ({
      defaultPrevented: false,
      target: null,
      changedTouches: [{ identifier: id, clientX: 100, clientY: 100 }]
    });

    gestures.onTouchStart(event(1));
    currentTime = 1050;
    gestures.onTouchEnd(event(1));
    currentTime = 1100;
    gestures.onTouchStart(event(2));
    currentTime = 1150;
    gestures.onTouchEnd(event(2));
    currentTime = 1200;
    gestures.onTouchStart(event(3));
    currentTime = 1250;
    gestures.onTouchEnd(event(3));

    expect(onDoubleTap).toHaveBeenCalledOnce();
  });
});

describe('player and mobile HUD action consistency', () => {
  it('shares one exact weapon cooldown across Player, AutoFire, and MobileHUD', () => {
    const context = createBrowserContext({
      CONSTANTS: {
        BASE_WEAPON_COOLDOWN: 500,
        TIER_MULTIPLIER: 1.5,
        ENERGY_CORE: {
          COOLDOWN_REDUCTION: [0, 0.05, 0.10, 0.15, 0.20, 0.25]
        }
      },
      Logger: { log: vi.fn(), error: vi.fn() }
    });

    const player = loadBrowserScript(context, 'client/js/player.js', 'Player');
    const autoFire = loadBrowserScript(context, 'client/js/mobile/auto-fire.js', 'AutoFire');
    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');

    player.ship.weaponTier = 4;
    player.ship.energyCoreTier = 3;
    const expected = (500 / Math.pow(1.5, 3)) * 0.85;

    expect(player.getWeaponCooldown()).toBe(expected);
    expect(autoFire.getWeaponCooldown()).toBe(expected);
    expect(mobileHUD.getWeaponCooldown()).toBe(expected);
  });

  it('schedules held fire at the exact effective cooldown without a mobile clamp', () => {
    const setIntervalSpy = vi.fn(() => 7);
    const player = {
      isDead: false,
      fire: vi.fn(),
      getWeaponCooldown: vi.fn(() => 72.5)
    };
    const context = createBrowserContext({
      Player: player,
      setInterval: setIntervalSpy,
      clearInterval: vi.fn(),
      Logger: { log: vi.fn() }
    });

    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');
    mobileHUD.startFiring();

    expect(player.fire).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 72.5);
  });

  it('keeps one owning FIRE touch and cannot orphan a second interval', () => {
    const listeners = new Map();
    const makeElement = () => ({
      addEventListener: vi.fn((event, handler) => listeners.set(`${event}-${listeners.size}`, handler))
    });
    const fireListeners = {};
    const fireButton = {
      addEventListener: vi.fn((event, handler) => { fireListeners[event] = handler; })
    };
    const context = createBrowserContext({ Logger: { log: vi.fn() } });
    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');
    mobileHUD.elements = {
      fireBtn: fireButton,
      actionBtn: makeElement(),
      menuBtn: makeElement()
    };
    mobileHUD.startFiring = vi.fn();
    mobileHUD.stopFiring = vi.fn();
    mobileHUD.bindEvents();
    const eventFor = id => ({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      changedTouches: [{ identifier: id }]
    });

    fireListeners.touchstart(eventFor(1));
    fireListeners.touchstart(eventFor(2));
    expect(mobileHUD.startFiring).toHaveBeenCalledTimes(1);
    expect(mobileHUD.fireTouchId).toBe(1);

    fireListeners.touchend(eventFor(2));
    expect(mobileHUD.stopFiring).not.toHaveBeenCalled();
    fireListeners.touchend(eventFor(1));
    expect(mobileHUD.stopFiring).toHaveBeenCalledOnce();
  });

  it('keeps FIRE held when an unrelated touch is canceled', () => {
    const fireListeners = {};
    const makeElement = () => ({ addEventListener: vi.fn() });
    const fireButton = {
      addEventListener: vi.fn((event, handler) => { fireListeners[event] = handler; })
    };
    const context = createBrowserContext({ Logger: { log: vi.fn() } });
    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');
    mobileHUD.elements = {
      fireBtn: fireButton,
      actionBtn: makeElement(),
      menuBtn: makeElement()
    };
    mobileHUD.startFiring = vi.fn();
    mobileHUD.stopFiring = vi.fn();
    mobileHUD.bindEvents();

    fireListeners.touchstart({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      changedTouches: [{ identifier: 1 }]
    });
    fireListeners.touchcancel({
      stopPropagation: vi.fn(),
      changedTouches: [{ identifier: 2 }],
      touches: [{ identifier: 1 }]
    });

    expect(mobileHUD.fireTouchId).toBe(1);
    expect(mobileHUD.stopFiring).not.toHaveBeenCalled();

    fireListeners.touchcancel({
      stopPropagation: vi.fn(),
      changedTouches: [{ identifier: 1 }],
      touches: []
    });
    expect(mobileHUD.fireTouchId).toBeNull();
    expect(mobileHUD.stopFiring).toHaveBeenCalledOnce();
  });

  it('keeps joystick thrust when an unrelated touch is canceled', () => {
    const context = createBrowserContext({ Logger: { log: vi.fn() } });
    const joystick = loadBrowserScript(context, 'client/js/mobile/virtual-joystick.js', 'VirtualJoystick');
    joystick.touchId = 1;
    joystick.active = true;
    joystick.reset = vi.fn();

    joystick.onTouchCancel({
      changedTouches: [{ identifier: 2 }],
      touches: [{ identifier: 1 }]
    });
    expect(joystick.reset).not.toHaveBeenCalled();

    joystick.onTouchCancel({
      changedTouches: [{ identifier: 1 }],
      touches: []
    });
    expect(joystick.reset).toHaveBeenCalledOnce();
  });

  it('clears latched desktop and mobile controls on reset', () => {
    const joystick = { reset: vi.fn() };
    const mobileHUD = { stopFiring: vi.fn() };
    const context = createBrowserContext({
      VirtualJoystick: joystick,
      MobileHUD: mobileHUD,
      Logger: { log: vi.fn() }
    });
    const input = loadBrowserScript(context, 'client/js/input.js', 'Input');
    input.keys.KeyW = true;
    input.mouseDown = true;

    input.reset();

    expect(input.isKeyDown('KeyW')).toBe(false);
    expect(input.mouseDown).toBe(false);
    expect(joystick.reset).toHaveBeenCalledOnce();
    expect(mobileHUD.stopFiring).toHaveBeenCalledOnce();
  });

  it('does not latch desktop actions or restart mobile fire while reconnecting', () => {
    const player = { isDead: false, fire: vi.fn() };
    const setInterval = vi.fn(() => 1);
    const context = createBrowserContext({
      GalaxyMiner: { gameStarted: true, connectionPaused: true },
      Player: player,
      setInterval,
      Logger: { log: vi.fn() }
    });
    const input = loadBrowserScript(context, 'client/js/input.js', 'Input');
    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');

    input.onKeyDown({ target: { tagName: 'DIV' }, code: 'Space' });
    mobileHUD.startFiring();

    expect(input.isKeyDown('Space')).toBe(false);
    expect(player.fire).not.toHaveBeenCalled();
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('does not create local weapon feedback while the network is unavailable', () => {
    const sendFire = vi.fn();
    const fireWeapon = vi.fn();
    const play = vi.fn();
    const context = createBrowserContext({
      Network: { connected: false, sendFire },
      Renderer: { fireWeapon },
      AudioManager: { play },
      CONSTANTS: {
        BASE_WEAPON_COOLDOWN: 500,
        TIER_MULTIPLIER: 1.5,
        ENERGY_CORE: { COOLDOWN_REDUCTION: [0, 0] }
      },
      Logger: { log: vi.fn() }
    });
    const playerState = loadBrowserScript(context, 'client/js/player.js', 'Player');
    playerState.isDead = false;
    playerState.ship.weaponTier = 1;
    playerState.ship.energyCoreTier = 1;

    playerState.fire();

    expect(sendFire).not.toHaveBeenCalled();
    expect(fireWeapon).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('releases FIRE touch ownership when lifecycle reset stops firing', () => {
    const clearInterval = vi.fn();
    const context = createBrowserContext({ clearInterval, Logger: { log: vi.fn() } });
    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');
    mobileHUD.fireTouchId = 9;
    mobileHUD.firingInterval = 4;

    mobileHUD.stopFiring();

    expect(mobileHUD.fireTouchId).toBeNull();
    expect(mobileHUD.firingInterval).toBeNull();
    expect(clearInterval).toHaveBeenCalledWith(4);
  });

  it('guards Player.activateBoost against repeated, cooldown, dead, and transit calls', () => {
    const audioManager = {
      play: vi.fn(),
      startLoop: vi.fn()
    };
    const context = createBrowserContext({
      CONSTANTS: {
        ENERGY_CORE: {
          BOOST: {
            DURATION: [0, 1000],
            COOLDOWN: [0, 15000]
          }
        },
        RELICS: {}
      },
      AudioManager: audioManager,
      Logger: { log: vi.fn(), error: vi.fn() }
    });

    const player = loadBrowserScript(context, 'client/js/player.js', 'Player');
    player.ship.energyCoreTier = 1;
    player.relics = [];
    player.isDead = false;
    player.inWormholeTransit = false;
    player.boostActive = false;
    player.boostCooldownEnd = 0;

    expect(player.activateBoost()).toBe(true);
    expect(player.activateBoost()).toBe(false);
    expect(audioManager.play).toHaveBeenCalledTimes(1);

    player.boostActive = false;
    player.boostCooldownEnd = Date.now() + 1000;
    expect(player.activateBoost()).toBe(false);

    player.boostCooldownEnd = 0;
    player.isDead = true;
    expect(player.activateBoost()).toBe(false);

    player.isDead = false;
    player.inWormholeTransit = true;
    expect(player.activateBoost()).toBe(false);
  });

  it('uses the same context priority for the visible label and executed action', () => {
    const icon = { textContent: '' };
    const label = { textContent: '' };
    const player = {
      position: { x: 0, y: 0 },
      isDead: false,
      inWormholeTransit: false,
      miningTarget: null,
      _nearestWormhole: null,
      _nearestMineable: { id: 'ore' },
      _nearestDerelict: { id: 'derelict' },
      _nearestBase: { id: 'base' },
      hasRelic: vi.fn((type) => type === 'SKULL_AND_BONES'),
      tryEnterWormhole: vi.fn(),
      tryMine: vi.fn(),
      tryMultiCollectWreckage: vi.fn(),
      tryCollectWreckage: vi.fn(),
      trySalvageDerelict: vi.fn(),
      tryPlunderBase: vi.fn()
    };
    const context = createBrowserContext({
      Player: player,
      Entities: {
        hasNonDerelictWreckageInRange: vi.fn(() => false),
        getClosestWreckage: vi.fn(() => null)
      },
      CONSTANTS: { MINING_RANGE: 100, RELIC_TYPES: {} },
      Logger: { log: vi.fn() }
    });

    const mobileHUD = loadBrowserScript(context, 'client/js/mobile/mobile-hud.js', 'MobileHUD');
    mobileHUD.elements.actionBtn = {
      querySelector: vi.fn((selector) => selector === '.btn-icon' ? icon : label)
    };

    // Mining outranks a simultaneously available plunder action.
    mobileHUD.updateActionButton();
    mobileHUD.triggerContextAction();
    expect(icon.textContent).toBe('⛏');
    expect(label.textContent).toBe('Mine');
    expect(player.tryMine).toHaveBeenCalledTimes(1);
    expect(player.tryPlunderBase).not.toHaveBeenCalled();

    // Derelict salvage also outranks plunder when mining is no longer available.
    player._nearestMineable = null;
    mobileHUD.updateActionButton();
    mobileHUD.triggerContextAction();
    expect(label.textContent).toBe('Salvage');
    expect(player.trySalvageDerelict).toHaveBeenCalledTimes(1);
    expect(player.tryPlunderBase).not.toHaveBeenCalled();
  });
});

describe('mobile settings and audio integration', () => {
  it('loads the mobile settings panel and applies settings before controls initialize', () => {
    const initModule = () => ({ init: vi.fn() });
    const modules = {
      Network: initModule(),
      Input: initModule(),
      Renderer: initModule(),
      AuthUI: initModule(),
      HUD: initModule(),
      ChatUI: initModule(),
      UpgradesUI: initModule(),
      TerminalUI: initModule(),
      Toast: initModule(),
      NotificationManager: initModule(),
      EmoteWheel: initModule(),
      AudioManager: initModule(),
      MusicManager: initModule(),
      MobileSettingsPanel: initModule(),
      VirtualJoystick: initModule(),
      AutoFire: initModule(),
      MobileHUD: initModule(),
      MobileGestures: initModule()
    };
    const context = createBrowserContext({
      ...modules,
      DeviceDetect: { isMobile: true, init: vi.fn() },
      Logger: { log: vi.fn() },
      document: { addEventListener: vi.fn() }
    });

    const galaxyMiner = loadBrowserScript(context, 'client/js/main.js', 'GalaxyMiner');
    galaxyMiner.init();

    expect(modules.MobileSettingsPanel.init).toHaveBeenCalledTimes(1);
    expect(modules.MobileSettingsPanel.init.mock.invocationCallOrder[0])
      .toBeLessThan(modules.VirtualJoystick.init.mock.invocationCallOrder[0]);
    expect(modules.MobileSettingsPanel.init.mock.invocationCallOrder[0])
      .toBeLessThan(modules.AutoFire.init.mock.invocationCallOrder[0]);

    const index = fs.readFileSync(path.join(PROJECT_ROOT, 'client/index.html'), 'utf8');
    const panelScript = index.indexOf('js/ui/panels/MobileSettingsPanel.js');
    const mainScript = index.indexOf('js/main.js');
    expect(panelScript).toBeGreaterThan(-1);
    expect(panelScript).toBeLessThan(mainScript);
  });

  it('reconciles the authoritative player snapshot before resuming after reconnect', () => {
    const classList = { add: vi.fn(), remove: vi.fn() };
    const player = {
      id: null,
      position: { x: 0, y: 0 },
      init: vi.fn(function init(data) {
        this.id = data.id;
        this.position = { x: data.position_x, y: data.position_y };
      })
    };
    const world = { init: vi.fn() };
    const entities = { init: vi.fn() };
    const game = { start: vi.fn(), resume: vi.fn(), pause: vi.fn(), stop: vi.fn() };
    const input = { reset: vi.fn() };
    const context = createBrowserContext({
      Player: player,
      World: world,
      Entities: entities,
      Game: game,
      Input: input,
      CONSTANTS: { GALAXY_SEED: 'seed' },
      CreditAnimation: { setCredits: vi.fn() },
      DeviceDetect: { isMobile: false },
      MusicManager: { start: vi.fn(), stop: vi.fn() },
      NotificationManager: { success: vi.fn(), warning: vi.fn() },
      Logger: { log: vi.fn() },
      document: {
        addEventListener: vi.fn(),
        getElementById: vi.fn(() => ({ classList }))
      }
    });
    const galaxyMiner = loadBrowserScript(context, 'client/js/main.js', 'GalaxyMiner');

    galaxyMiner.startGame({ id: 7, username: 'pilot', position_x: 10, position_y: 20, credits: 0 });
    galaxyMiner.handleDisconnect();
    galaxyMiner.startGame({ id: 7, username: 'pilot', position_x: 500, position_y: 600, credits: 0 });

    expect(player.init).toHaveBeenCalledTimes(2);
    expect(entities.init).toHaveBeenCalledTimes(2);
    expect(world.init).toHaveBeenLastCalledWith('seed', { x: 500, y: 600 });
    expect(game.pause).toHaveBeenCalledOnce();
    expect(game.resume).toHaveBeenCalledOnce();
    expect(game.start).toHaveBeenCalledOnce();
    expect(galaxyMiner.connectionPaused).toBe(false);
    expect(player.init.mock.calls[0][1]).toEqual({ preserveLifeState: false });
    expect(player.init.mock.calls[1][1]).toEqual({ preserveLifeState: true });
  });

  it('keeps a zero-hull authentication snapshot dead until respawn', () => {
    const context = createBrowserContext({
      Logger: { log: vi.fn() }
    });
    const player = loadBrowserScript(context, 'client/js/player.js', 'Player');
    player.miningTarget = { id: 'stale-rock' };
    player.collectingWreckage = { id: 'stale-wreckage' };
    player.multiCollecting = true;
    player._nearestDerelict = { id: 'stale-derelict' };
    player.activeBuffs.set('STALE', { expiresAt: Date.now() + 1000 });
    const buffExpiry = Date.now() + 5000;
    const slowExpiry = Date.now() + 3000;

    player.init({
      id: 7,
      username: 'downed-pilot',
      position_x: 10,
      position_y: 20,
      velocity_x: 0,
      velocity_y: 0,
      rotation: 0,
      hull_hp: 0,
      hull_max: 100,
      shield_hp: 0,
      shield_max: 50,
      credits: 0,
      inventory: [],
      relics: [],
      engine_tier: 1,
      weapon_type: 'kinetic',
      weapon_tier: 1,
      shield_tier: 1,
      mining_tier: 1,
      cargo_tier: 1,
      radar_tier: 1,
      energy_core_tier: 1,
      hull_tier: 1,
      active_buffs: [{ buff_type: 'SPEED_BURST', expires_at: buffExpiry }],
      debuffs: { slow: { percent: 0.4, expiresAt: slowExpiry } }
    });

    expect(player.isDead).toBe(true);
    expect(player.sessionStartTime).toBe(0);
    expect(player.miningTarget).toBeNull();
    expect(player.collectingWreckage).toBeNull();
    expect(player.multiCollecting).toBe(false);
    expect(player._nearestDerelict).toBeNull();
    expect(player.activeBuffs.has('STALE')).toBe(false);
    expect(player.activeBuffs.get('SPEED_BURST')?.expiresAt).toBe(buffExpiry);
    expect(player.debuffs.slow).toEqual({ percent: 0.4, expiresAt: slowExpiry });
  });

  it('preserves per-life stats and restores authoritative plunder cooldown on reconnect', () => {
    const context = createBrowserContext({ Logger: { log: vi.fn() } });
    const player = loadBrowserScript(context, 'client/js/player.js', 'Player');
    player.id = 7;
    player.sessionStartTime = 12345;
    player.frozenSurvivalTime = 678;
    player.sessionStats = {
      distanceTraveled: 900,
      lastPosition: { x: 1, y: 2 },
      npcsKilled: 4,
      resourcesMined: 30,
      creditsEarned: 1200
    };
    const before = Date.now();

    player.init({
      id: 7,
      username: 'pilot',
      position_x: 500,
      position_y: 600,
      velocity_x: 0,
      velocity_y: 0,
      rotation: 0,
      hull_hp: 80,
      hull_max: 100,
      shield_hp: 20,
      shield_max: 50,
      credits: 100,
      inventory: [],
      relics: [],
      active_buffs: [],
      debuffs: {},
      plunderCooldownRemaining: 4000,
      boostRemaining: 1000,
      boostCooldownRemaining: 7000
    }, { preserveLifeState: true });

    expect(player.sessionStartTime).toBe(12345);
    expect(player.frozenSurvivalTime).toBe(678);
    expect(player.sessionStats).toMatchObject({
      distanceTraveled: 900,
      lastPosition: { x: 500, y: 600 },
      npcsKilled: 4,
      resourcesMined: 30,
      creditsEarned: 1200
    });
    expect(player.plunderCooldownEnd).toBeGreaterThanOrEqual(before + 4000);
    expect(player.plunderCooldownEnd).toBeLessThanOrEqual(Date.now() + 4000);
    expect(player.boostActive).toBe(true);
    expect(player.boostEndTime).toBeGreaterThanOrEqual(before + 1000);
    expect(player.boostCooldownEnd).toBeGreaterThanOrEqual(before + 7000);
  });

  it('does not add dead reconnect downtime to frozen survival time', () => {
    const now = vi.fn(() => 5000);
    const context = createBrowserContext({
      Date: { now },
      Logger: { log: vi.fn() }
    });
    const player = loadBrowserScript(context, 'client/js/player.js', 'Player');
    player.sessionStartTime = 1000;
    player.isDead = false;

    player.onDeath({});
    expect(player.frozenSurvivalTime).toBe(4000);

    now.mockReturnValue(9000);
    player.onDeath({ cause: 'reconnect' });
    expect(player.frozenSurvivalTime).toBe(4000);
  });

  it('returns a displaced session to authentication before terminal disconnect', () => {
    const handlers = new Map();
    const stopGame = vi.fn();
    const removeItem = vi.fn();
    const showError = vi.fn();
    const context = createBrowserContext({
      window: { Logger: { log: vi.fn() } },
      localStorage: { removeItem },
      Network: { token: 'old-token' },
      GalaxyMiner: { connectionPaused: false, stopGame },
      AuthUI: { showError }
    });
    const registerAuth = loadBrowserScript(
      context,
      'client/js/network/auth.js',
      'register'
    );
    registerAuth({ on: (event, handler) => handlers.set(event, handler) });

    handlers.get('auth:error')({ message: 'Connected from another location' });

    expect(removeItem).toHaveBeenCalledWith('galaxy-miner-token');
    expect(context.Network.token).toBeNull();
    expect(stopGame).toHaveBeenCalledOnce();
    expect(showError).toHaveBeenCalledWith('Connected from another location');
  });

  it('reopens the Socket.IO transport after a server-forced disconnect', () => {
    const handlers = new Map();
    const socket = {
      onAny: vi.fn(),
      on: vi.fn((event, handler) => handlers.set(event, handler)),
      emit: vi.fn(),
      connect: vi.fn()
    };
    const handleDisconnect = vi.fn();
    const context = createBrowserContext({
      window: {},
      io: vi.fn(() => socket),
      localStorage: { getItem: vi.fn(() => null) },
      GalaxyMiner: { handleDisconnect },
      Logger: { log: vi.fn() }
    });
    context.window = context;
    const network = loadBrowserScript(context, 'client/js/network.js', 'Network');
    network.init();

    handlers.get('disconnect')('io server disconnect');

    expect(handleDisconnect).toHaveBeenCalledOnce();
    expect(socket.connect).toHaveBeenCalledOnce();
    expect(network.connected).toBe(false);
  });

  it('renders authoritative remote maxima and object local hulls in fleet health', () => {
    const player = { id: 1, hull: { current: 75, max: 100 } };
    const context = createBrowserContext({
      Player: player,
      Logger: { log: vi.fn() },
      document: {
        createElement: vi.fn(() => ({
          _text: '',
          set textContent(value) { this._text = String(value); },
          get innerHTML() { return this._text; }
        }))
      }
    });
    const entities = loadBrowserScript(context, 'client/js/entities.js', 'Entities');
    context.Entities = entities;
    entities.updatePlayer({
      id: 2,
      username: 'Remote',
      x: 10,
      y: 20,
      rotation: 0,
      hull: 40,
      hullMax: 80,
      shield: 10,
      shieldMax: 20
    });
    const fleetPanel = loadBrowserScript(context, 'client/js/ui/panels/FleetPanel.js', 'FleetPanel');

    const remote = fleetPanel._renderMember({ id: 2, username: 'Remote', role: 'member' }, false);
    const local = fleetPanel._renderMember({ id: 1, username: 'Local', role: 'member' }, false);
    expect(remote).toContain('width: 50%');
    expect(local).toContain('width: 75%');
    expect(remote + local).not.toContain('NaN');
    expect(entities.players.get(2)).toMatchObject({ hullMax: 80, shieldMax: 20 });
  });

  it('clears all Siphon animations but removes only fully settled wreckage', () => {
    const handlers = new Map();
    const entities = {
      clearSiphonAnimations: vi.fn(),
      removeWreckage: vi.fn()
    };
    const context = createBrowserContext({
      Entities: entities,
      Player: { onMultiCollectComplete: vi.fn() },
      window: { Logger: { category: vi.fn() } },
      setTimeout: vi.fn(callback => { callback(); return 1; })
    });
    loadBrowserScript(context, 'client/js/network/loot.js', 'register');
    const registerLoot = vm.runInContext('register', context);
    registerLoot({ on: (event, handler) => handlers.set(event, handler) });

    handlers.get('loot:multiComplete')({
      wreckageIds: ['settled'],
      attemptedWreckageIds: ['settled', 'overflow']
    });

    expect(entities.clearSiphonAnimations).toHaveBeenCalledWith(['settled', 'overflow']);
    expect(entities.removeWreckage).toHaveBeenCalledOnce();
    expect(entities.removeWreckage).toHaveBeenCalledWith('settled');
  });

  it('honors an explicit zero category volume during playback', async () => {
    const playSound = vi.fn(() => Promise.resolve({ id: 'source' }));
    const context = createBrowserContext({
      AudioContextManager: {
        init: vi.fn(() => true),
        isReady: vi.fn(() => true),
        resume: vi.fn(),
        getState: vi.fn(() => 'running')
      },
      SpatialAudio: { calculate: vi.fn() },
      SoundPool: {
        playSound,
        getActiveCount: vi.fn(() => 0),
        getStats: vi.fn(() => ({})),
        stopSound: vi.fn(),
        stopAll: vi.fn(),
        clearCache: vi.fn(),
        preloadSounds: vi.fn()
      },
      SoundConfig: {
        muted_category_test: {
          file: 'ui/test.mp3',
          baseVolume: 0.5,
          priority: 50,
          category: 'sfx'
        }
      },
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn()
      },
      document: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      Logger: { log: vi.fn() }
    });

    const audioManager = loadBrowserScript(context, 'client/js/audio/AudioManager.js', 'AudioManager');
    audioManager.init();
    audioManager.setVolume('sfx', 0);
    await audioManager.play('muted_category_test');

    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound.mock.calls[0][1].volume).toBe(0);
  });

  it('does not let an older asynchronous loop request replace a newer one', async () => {
    const pending = [];
    const stopSound = vi.fn();
    const context = createBrowserContext({
      AudioContextManager: {
        init: vi.fn(() => true),
        isReady: vi.fn(() => true),
        resume: vi.fn(),
        getState: vi.fn(() => 'running')
      },
      SoundPool: {
        playSound: vi.fn(() => new Promise(resolve => pending.push(resolve))),
        getActiveCount: vi.fn(() => 0),
        getStats: vi.fn(() => ({})),
        stopSound,
        stopAll: vi.fn(),
        clearCache: vi.fn(),
        preloadSounds: vi.fn()
      },
      SoundConfig: {
        engine_loop: {
          file: 'movement/engine.mp3',
          baseVolume: 0.5,
          priority: 50,
          category: 'sfx',
          loop: true
        }
      },
      localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
      document: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      Logger: { log: vi.fn() }
    });

    const audioManager = loadBrowserScript(context, 'client/js/audio/AudioManager.js', 'AudioManager');
    audioManager.init();
    const older = audioManager.startLoop('engine_loop');
    const newer = audioManager.startLoop('engine_loop');
    const oldSource = { id: 'old' };
    const newSource = { id: 'new' };

    pending[0](oldSource);
    await expect(older).resolves.toBeNull();
    expect(stopSound).toHaveBeenCalledWith(oldSource);

    pending[1](newSource);
    await expect(newer).resolves.toBe(newSource);
    expect(audioManager.getStats().activeLoops).toBe(1);
  });

  it('invalidates an in-flight loop when stop is requested before loading finishes', async () => {
    let resolveSource;
    const stopSound = vi.fn();
    const context = createBrowserContext({
      AudioContextManager: {
        init: vi.fn(() => true),
        isReady: vi.fn(() => true),
        resume: vi.fn(),
        getState: vi.fn(() => 'running')
      },
      SoundPool: {
        playSound: vi.fn(() => new Promise(resolve => { resolveSource = resolve; })),
        getActiveCount: vi.fn(() => 0),
        getStats: vi.fn(() => ({})),
        stopSound,
        stopAll: vi.fn(),
        clearCache: vi.fn(),
        preloadSounds: vi.fn()
      },
      SoundConfig: {
        engine_loop: {
          file: 'movement/engine.mp3',
          baseVolume: 0.5,
          priority: 50,
          category: 'sfx',
          loop: true
        }
      },
      localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
      document: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      Logger: { log: vi.fn() }
    });

    const audioManager = loadBrowserScript(context, 'client/js/audio/AudioManager.js', 'AudioManager');
    audioManager.init();
    const pendingLoop = audioManager.startLoop('engine_loop');
    audioManager.stopLoop('engine_loop');
    const source = { id: 'late' };
    resolveSource(source);

    await expect(pendingLoop).resolves.toBeNull();
    expect(stopSound).toHaveBeenCalledWith(source);
    expect(audioManager.getStats().activeLoops).toBe(0);
  });

  it('maps npc_despawn to an existing phase-out audio asset', () => {
    const soundConfigPath = path.join(PROJECT_ROOT, 'client/js/audio/config/SoundConfig.js');
    delete require.cache[soundConfigPath];
    const soundConfig = require(soundConfigPath);
    const config = soundConfig.npc_despawn;

    expect(config).toEqual(expect.objectContaining({
      file: 'environment/void_rift_close.mp3',
      category: 'sfx'
    }));
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'client/assets/audio', config.file))).toBe(true);
  });
});
