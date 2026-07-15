import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function createContext(globals = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Set,
    Number,
    Object,
    Array,
    setTimeout,
    clearTimeout,
    module,
    exports: module.exports,
    window: {},
    ...globals
  });
  context.globalThis = context;
  return { context, module };
}

function loadModule(relativePath, globals = {}) {
  const { context, module } = createContext(globals);
  const filename = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return module.exports;
}

function loadGlobal(relativePath, name, globals = {}) {
  const { context } = createContext(globals);
  const filename = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return {
    value: vm.runInContext(name, context),
    context
  };
}

function loadPanel(globals = {}) {
  const clearTimeoutSpy = vi.fn();
  const timeoutCallbacks = [];
  const setTimeoutSpy = vi.fn((callback) => {
    timeoutCallbacks.push(callback);
    return 100 + timeoutCallbacks.length;
  });
  const { value: panel } = loadGlobal(
    'client/js/ui/panels/ShipUpgradePanel.js',
    'ShipUpgradePanel',
    {
      ...globals,
      window: { CONSTANTS, ...(globals.window || {}) },
      setTimeout: setTimeoutSpy,
      clearTimeout: clearTimeoutSpy
    }
  );
  return { panel, clearTimeoutSpy, setTimeoutSpy, timeoutCallbacks };
}

function captureHandlers(register) {
  const handlers = new Map();
  const socket = {
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn()
  };
  register(socket);
  return { handlers, socket };
}

function createPlayer(overrides = {}) {
  const player = {
    id: 1,
    ship: {
      engineTier: 1,
      weaponTier: 5,
      shieldTier: 5,
      miningTier: 5,
      cargoTier: 5,
      radarTier: 5,
      energyCoreTier: 5,
      hullTier: 5
    },
    inventory: [],
    credits: 10000,
    shield: { current: 50, max: 50 },
    hull: { current: 100, max: 100 },
    position: { x: 0, y: 0 },
    updateInventory(data) {
      this.inventory = data.inventory;
      if (Number.isFinite(data.credits)) this.credits = data.credits;
    },
    ...overrides
  };
  return player;
}

const ENGINE_TIER_TWO_INVENTORY = [
  { resource_type: 'HYDROGEN', quantity: 5 },
  { resource_type: 'CARBON', quantity: 3 }
];

describe('authoritative upgrade affordability synchronization', () => {
  it('refreshes the panel and terminal indicator on every inventory:update', () => {
    const { panel } = loadPanel();
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });
    expect(panel.checkAffordability('engine').canAfford).toBe(true);

    const hud = { updateUpgradeIndicator: vi.fn() };
    const cargoPanel = { refresh: vi.fn() };
    const uiState = { set: vi.fn() };
    const { register } = loadModule('client/js/network/mining.js', {
      Player: player,
      Network: {},
      ShipUpgradePanel: panel,
      HUD: hud,
      CargoPanel: cargoPanel,
      UIState: uiState
    });
    const { handlers } = captureHandlers(register);

    handlers.get('inventory:update')({ inventory: [], credits: 9000 });

    expect(player.inventory).toEqual([]);
    expect(panel.inventory).toEqual({});
    expect(panel.checkAffordability('engine').canAfford).toBe(false);
    expect(panel.isAwaitingInventorySync).toBe(false);
    expect(hud.updateUpgradeIndicator).toHaveBeenCalledOnce();
    expect(cargoPanel.refresh).toHaveBeenCalledOnce();
    expect(uiState.set).toHaveBeenCalledWith({ inventory: [], credits: 9000 });
  });

  it('keeps a successful upgrade disabled until consumed inventory arrives', () => {
    const { panel } = loadPanel();
    const player = createPlayer({
      inventory: [
        ...ENGINE_TIER_TWO_INVENTORY,
        { resource_type: 'HYDROGEN', quantity: 12 },
        { resource_type: 'HELIUM3', quantity: 5 },
        { resource_type: 'TITANIUM', quantity: 4 }
      ]
    });
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });

    const { register: registerShip } = loadModule('client/js/network/ship.js', {
      console: { ...console, error: vi.fn() },
      window: { Logger: { log: vi.fn() } },
      Player: player,
      ShipUpgradePanel: panel,
      HUD: { update: vi.fn(), updateUpgradeIndicator: vi.fn() },
      Game: { _visibleWorldObjects: {} },
      Network: { requestShipData: vi.fn() }
    });
    const { handlers: shipHandlers } = captureHandlers(registerShip);

    shipHandlers.get('upgrade:success')({
      component: 'engine',
      newTier: 2,
      credits: 9000,
      shieldMax: 50,
      hullMax: 100
    });

    expect(panel.getTier('engine')).toBe(2);
    expect(panel.isAwaitingInventorySync).toBe(true);
    expect(panel.checkAffordability('engine')).toMatchObject({
      canAfford: false,
      synchronizing: true
    });

    const { register: registerMining } = loadModule('client/js/network/mining.js', {
      Player: player,
      Network: {},
      ShipUpgradePanel: panel,
      HUD: { updateUpgradeIndicator: vi.fn() }
    });
    const { handlers: miningHandlers } = captureHandlers(registerMining);
    miningHandlers.get('inventory:update')({ inventory: [], credits: 9000 });

    expect(panel.isAwaitingInventorySync).toBe(false);
    expect(panel.inventory).toEqual({});
    expect(panel.checkAffordability('engine').canAfford).toBe(false);
  });

  it('invalidates stale affordability on error and reconciles from ship:data', () => {
    const { panel } = loadPanel();
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });

    const requestShipData = vi.fn();
    const hud = { updateUpgradeIndicator: vi.fn(), update: vi.fn() };
    const { register } = loadModule('client/js/network/ship.js', {
      console: { ...console, error: vi.fn() },
      window: { Logger: { log: vi.fn() } },
      Player: player,
      ShipUpgradePanel: panel,
      HUD: hud,
      Network: { requestShipData },
      NotificationManager: { error: vi.fn() },
      UIState: { set: vi.fn() },
      CargoPanel: { refresh: vi.fn() }
    });
    const { handlers } = captureHandlers(register);

    handlers.get('upgrade:error')({ message: 'Insufficient resources' });

    expect(requestShipData).toHaveBeenCalledOnce();
    expect(panel.isAwaitingInventorySync).toBe(true);
    expect(panel.checkAffordability('engine').canAfford).toBe(false);
    expect(hud.updateUpgradeIndicator).toHaveBeenCalledOnce();

    // A tab refresh using cached Player data must not clear the invalidation.
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    });
    expect(panel.isAwaitingInventorySync).toBe(true);

    handlers.get('ship:data')({
      engine_tier: 1,
      weapon_tier: 5,
      shield_tier: 5,
      mining_tier: 5,
      cargo_tier: 5,
      radar_tier: 5,
      energy_core_tier: 5,
      hull_tier: 5,
      credits: 9000,
      inventory: [],
      ship_color_id: 'green',
      profile_id: 'pilot'
    });

    expect(player.inventory).toEqual([]);
    expect(panel.isAwaitingInventorySync).toBe(false);
    expect(panel.inventory).toEqual({});
    expect(panel.checkAffordability('engine').canAfford).toBe(false);
  });

  it('applies a death inventory snapshot before refreshing upgrade affordances', () => {
    const { panel } = loadPanel();
    const player = createPlayer({
      inventory: ENGINE_TIER_TWO_INVENTORY,
      getSurvivalTime: vi.fn(() => 1000),
      onDeath: vi.fn()
    });
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });

    const hud = { updateUpgradeIndicator: vi.fn() };
    const { register } = loadModule('client/js/network/player.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      ShipUpgradePanel: panel,
      HUD: hud,
      UIState: { set: vi.fn() },
      CargoPanel: { refresh: vi.fn() }
    });
    const { handlers } = captureHandlers(register);

    handlers.get('player:death')({
      cause: 'pirate',
      inventory: [],
      credits: 10000,
      droppedCargo: ENGINE_TIER_TWO_INVENTORY
    });

    expect(player.inventory).toEqual([]);
    expect(player.onDeath).toHaveBeenCalledOnce();
    expect(panel.checkAffordability('engine').canAfford).toBe(false);
    expect(hud.updateUpgradeIndicator).toHaveBeenCalledOnce();
  });

  it('removes legacy upgrade affordability from the authoritative death snapshot', () => {
    const list = {
      innerHTML: '',
      querySelectorAll: vi.fn(() => [])
    };
    const player = createPlayer({
      inventory: ENGINE_TIER_TWO_INVENTORY,
      getSurvivalTime: vi.fn(() => 1000),
      onDeath: vi.fn()
    });
    const { value: upgrades } = loadGlobal('client/js/ui/upgrades.js', 'UpgradesUI', {
      Logger: { log: vi.fn() },
      Player: player,
      CONSTANTS,
      Network: { sendUpgrade: vi.fn() },
      document: { getElementById: vi.fn(() => list) }
    });
    upgrades.refresh();
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).not.toContain('disabled');

    const hud = { updateUpgradeIndicator: vi.fn() };
    const { register } = loadModule('client/js/network/player.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      UpgradesUI: upgrades,
      HUD: hud,
      UIState: { set: vi.fn() },
      CargoPanel: { refresh: vi.fn() }
    });
    const { handlers } = captureHandlers(register);

    handlers.get('player:death')({
      cause: 'pirate',
      inventory: [],
      credits: 10000,
      droppedCargo: ENGINE_TIER_TWO_INVENTORY
    });

    expect(player.inventory).toEqual([]);
    expect(player.onDeath).toHaveBeenCalledOnce();
    expect(upgrades.isSynchronizing()).toBe(false);
    expect(upgrades.checkAffordability('engine', 1)).toBe(false);
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).toContain('disabled');
    expect(hud.updateUpgradeIndicator).toHaveBeenCalledOnce();
  });

  it('reconciles upgrade affordability from the respawn inventory snapshot', () => {
    const { panel } = loadPanel();
    const player = createPlayer({
      inventory: ENGINE_TIER_TWO_INVENTORY,
      onRespawn: vi.fn()
    });
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });

    const hud = { updateUpgradeIndicator: vi.fn() };
    const { register } = loadModule('client/js/network/player.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      ShipUpgradePanel: panel,
      HUD: hud,
      UIState: { set: vi.fn() },
      CargoPanel: { refresh: vi.fn() }
    });
    const { handlers } = captureHandlers(register);

    handlers.get('player:respawn')({
      position: { x: 100, y: 200 },
      hull: 100,
      shield: 50,
      inventory: [],
      credits: 10000
    });

    expect(player.onRespawn).toHaveBeenCalledWith({
      position: { x: 100, y: 200 },
      hull: 100,
      shield: 50
    });
    expect(player.inventory).toEqual([]);
    expect(panel.checkAffordability('engine').canAfford).toBe(false);
    expect(hud.updateUpgradeIndicator).toHaveBeenCalledOnce();
  });

  it('calculates the HUD indicator from live Player data, not panel cache', () => {
    const player = createPlayer({ inventory: [] });
    const shipUpgradePanel = {
      shipData: { engineTier: 1 },
      isAwaitingInventorySync: false,
      checkAffordability: vi.fn(() => ({ canAfford: true }))
    };
    const { value: hud } = loadGlobal('client/js/ui/hud.js', 'HUD', {
      Player: player,
      CONSTANTS,
      ShipUpgradePanel: shipUpgradePanel
    });

    expect(hud.checkUpgradesAvailable()).toBe(false);
    expect(shipUpgradePanel.checkAffordability).not.toHaveBeenCalled();

    player.inventory = ENGINE_TIER_TWO_INVENTORY;
    expect(hud.checkUpgradesAvailable()).toBe(true);

    shipUpgradePanel.isUpgrading = true;
    expect(hud.checkUpgradesAvailable()).toBe(false);

    shipUpgradePanel.isUpgrading = false;
    shipUpgradePanel.isAwaitingInventorySync = true;
    expect(hud.checkUpgradesAvailable()).toBe(false);

    shipUpgradePanel.isAwaitingInventorySync = false;
    shipUpgradePanel.isAwaitingFullSync = true;
    expect(hud.checkUpgradesAvailable()).toBe(false);
  });

  it('fails the HUD indicator closed for the legacy upgrade lifecycle', () => {
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    const upgradesUI = {
      isUpgrading: true,
      isAwaitingInventorySync: false,
      isAwaitingFullSync: false,
      isSynchronizing() {
        return this.isUpgrading || this.isAwaitingInventorySync || this.isAwaitingFullSync;
      }
    };
    const { value: hud } = loadGlobal('client/js/ui/hud.js', 'HUD', {
      Player: player,
      CONSTANTS,
      UpgradesUI: upgradesUI
    });

    expect(hud.checkUpgradesAvailable()).toBe(false);

    upgradesUI.isUpgrading = false;
    expect(hud.checkUpgradesAvailable()).toBe(true);

    upgradesUI.isAwaitingInventorySync = true;
    expect(hud.checkUpgradesAvailable()).toBe(false);

    upgradesUI.isAwaitingInventorySync = false;
    upgradesUI.isAwaitingFullSync = true;
    expect(hud.checkUpgradesAvailable()).toBe(false);
  });
});

describe('upgrade state lifecycle and legacy fallback', () => {
  it('fails closed and requests authority when an upgrade request times out', () => {
    const requestShipData = vi.fn();
    const updateUpgradeIndicator = vi.fn();
    const socket = { emit: vi.fn() };
    const { panel, timeoutCallbacks } = loadPanel({
      Network: { socket, requestShipData },
      HUD: { updateUpgradeIndicator },
      NotificationManager: { error: vi.fn() }
    });
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });

    panel.upgrade();
    expect(socket.emit).toHaveBeenCalledWith('ship:upgrade', { component: 'engine' });
    expect(timeoutCallbacks).toHaveLength(1);
    expect(updateUpgradeIndicator).toHaveBeenCalledOnce();

    timeoutCallbacks[0]();

    expect(panel.isUpgrading).toBe(false);
    expect(panel.isAwaitingInventorySync).toBe(true);
    expect(panel.isAwaitingFullSync).toBe(true);
    expect(panel.checkAffordability('engine')).toMatchObject({
      canAfford: false,
      synchronizing: true
    });
    expect(requestShipData).toHaveBeenCalledOnce();
    expect(updateUpgradeIndicator).toHaveBeenCalledTimes(2);

    // An inventory-only event can update the displayed balance, but the tier
    // outcome remains unknown until one complete ship snapshot arrives.
    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true });
    expect(panel.isAwaitingInventorySync).toBe(true);
    expect(panel.isAwaitingFullSync).toBe(true);

    panel.updateData({
      ship: player.ship,
      inventory: player.inventory,
      credits: player.credits
    }, { authoritativeInventory: true, authoritativeShip: true });
    expect(panel.isAwaitingInventorySync).toBe(false);
    expect(panel.isAwaitingFullSync).toBe(false);
  });

  it('blocks duplicate legacy requests and fails closed on timeout', () => {
    const timeoutCallbacks = [];
    const sendUpgrade = vi.fn(() => true);
    const requestShipData = vi.fn();
    const updateUpgradeIndicator = vi.fn();
    const list = {
      innerHTML: '',
      querySelectorAll: vi.fn(() => [])
    };
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    const { value: upgrades } = loadGlobal('client/js/ui/upgrades.js', 'UpgradesUI', {
      Logger: { log: vi.fn() },
      Player: player,
      CONSTANTS,
      Network: { sendUpgrade, requestShipData },
      HUD: { updateUpgradeIndicator },
      NotificationManager: { error: vi.fn() },
      document: { getElementById: vi.fn(() => list) },
      setTimeout: vi.fn(callback => {
        timeoutCallbacks.push(callback);
        return 77;
      }),
      clearTimeout: vi.fn()
    });

    upgrades.refresh();
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).not.toContain('disabled');

    expect(upgrades.requestUpgrade('engine')).toBe(true);
    expect(sendUpgrade).toHaveBeenCalledOnce();
    expect(upgrades.isUpgrading).toBe(true);
    expect(upgrades.checkAffordability('engine', 1)).toBe(false);
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).toContain('disabled');
    expect(updateUpgradeIndicator).toHaveBeenCalledOnce();

    expect(upgrades.requestUpgrade('engine')).toBe(false);
    expect(sendUpgrade).toHaveBeenCalledOnce();

    timeoutCallbacks[0]();

    expect(upgrades).toMatchObject({
      isUpgrading: false,
      isAwaitingInventorySync: true,
      isAwaitingFullSync: true,
      pendingComponent: null
    });
    expect(requestShipData).toHaveBeenCalledOnce();
    expect(updateUpgradeIndicator).toHaveBeenCalledTimes(2);
    expect(upgrades.checkAffordability('engine', 1)).toBe(false);
  });

  it('preserves a legacy in-flight lock across inventory and death snapshots', () => {
    const timeoutCallbacks = [];
    const clearTimeoutSpy = vi.fn();
    const sendUpgrade = vi.fn(() => true);
    const list = {
      innerHTML: '',
      querySelectorAll: vi.fn(() => [])
    };
    const player = createPlayer({
      inventory: ENGINE_TIER_TWO_INVENTORY,
      getSurvivalTime: vi.fn(() => 1000),
      onDeath: vi.fn()
    });
    const { value: upgrades } = loadGlobal('client/js/ui/upgrades.js', 'UpgradesUI', {
      Logger: { log: vi.fn() },
      Player: player,
      CONSTANTS,
      Network: { sendUpgrade, requestShipData: vi.fn() },
      HUD: { updateUpgradeIndicator: vi.fn() },
      document: { getElementById: vi.fn(() => list) },
      setTimeout: vi.fn(callback => {
        timeoutCallbacks.push(callback);
        return 88;
      }),
      clearTimeout: clearTimeoutSpy
    });
    expect(upgrades.requestUpgrade('engine')).toBe(true);

    const { register: registerMining } = loadModule('client/js/network/mining.js', {
      Player: player,
      Network: {},
      UpgradesUI: upgrades,
      HUD: { updateUpgradeIndicator: vi.fn() }
    });
    const { handlers: miningHandlers } = captureHandlers(registerMining);
    miningHandlers.get('inventory:update')({
      inventory: ENGINE_TIER_TWO_INVENTORY,
      credits: 10000
    });

    expect(upgrades.isUpgrading).toBe(true);
    expect(upgrades.pendingComponent).toBe('engine');
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(upgrades.requestUpgrade('engine')).toBe(false);

    const { register: registerPlayer } = loadModule('client/js/network/player.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      UpgradesUI: upgrades,
      HUD: { updateUpgradeIndicator: vi.fn() }
    });
    const { handlers: playerHandlers } = captureHandlers(registerPlayer);
    playerHandlers.get('player:death')({
      cause: 'pirate',
      inventory: ENGINE_TIER_TWO_INVENTORY,
      credits: 10000,
      droppedCargo: []
    });

    expect(upgrades.isUpgrading).toBe(true);
    expect(upgrades.pendingComponent).toBe('engine');
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(sendUpgrade).toHaveBeenCalledOnce();
    expect(timeoutCallbacks).toHaveLength(1);
  });

  it('keeps the legacy UI disabled after an error until ship:data reconciles it', () => {
    const timeoutCallbacks = [];
    const clearTimeoutSpy = vi.fn();
    const list = {
      innerHTML: '',
      querySelectorAll: vi.fn(() => [])
    };
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    const requestShipData = vi.fn();
    const hud = { updateUpgradeIndicator: vi.fn(), update: vi.fn() };
    const { value: upgrades } = loadGlobal('client/js/ui/upgrades.js', 'UpgradesUI', {
      Logger: { log: vi.fn() },
      Player: player,
      CONSTANTS,
      Network: { sendUpgrade: vi.fn(() => true), requestShipData },
      HUD: hud,
      document: { getElementById: vi.fn(() => list) },
      setTimeout: vi.fn(callback => {
        timeoutCallbacks.push(callback);
        return 91;
      }),
      clearTimeout: clearTimeoutSpy
    });
    const { register } = loadModule('client/js/network/ship.js', {
      console: { ...console, error: vi.fn() },
      window: { Logger: { log: vi.fn() } },
      Player: player,
      UpgradesUI: upgrades,
      HUD: hud,
      Network: { requestShipData },
      NotificationManager: { error: vi.fn() },
      UIState: { set: vi.fn() },
      CargoPanel: { refresh: vi.fn() }
    });
    const { handlers } = captureHandlers(register);

    upgrades.requestUpgrade('engine');
    hud.updateUpgradeIndicator.mockClear();
    handlers.get('upgrade:error')({ message: 'Insufficient resources' });

    expect(clearTimeoutSpy).toHaveBeenCalledWith(91);
    expect(upgrades.isAwaitingInventorySync).toBe(true);
    expect(upgrades.isAwaitingFullSync).toBe(true);
    expect(upgrades.checkAffordability('engine', 1)).toBe(false);
    expect(requestShipData).toHaveBeenCalledOnce();
    expect(hud.updateUpgradeIndicator).toHaveBeenCalledOnce();

    upgrades.applyAuthoritativeSnapshot();
    expect(upgrades.isAwaitingInventorySync).toBe(true);
    expect(upgrades.isAwaitingFullSync).toBe(true);

    handlers.get('ship:data')({
      engine_tier: 1,
      weapon_tier: 5,
      shield_tier: 5,
      mining_tier: 5,
      cargo_tier: 5,
      radar_tier: 5,
      energy_core_tier: 5,
      hull_tier: 5,
      credits: 9000,
      inventory: [],
      ship_color_id: 'green',
      profile_id: 'pilot'
    });

    expect(player.inventory).toEqual([]);
    expect(upgrades.isSynchronizing()).toBe(false);
    expect(upgrades.checkAffordability('engine', 1)).toBe(false);
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).toContain('disabled');
  });

  it('resets account-specific panel state and pending timers', () => {
    const { panel, clearTimeoutSpy } = loadPanel();
    panel.shipData = { engineTier: 4 };
    panel.inventory = { HYDROGEN: 99 };
    panel.credits = 5000;
    panel.selectedPart = 'weapon';
    panel.isUpgrading = true;
    panel.isAwaitingInventorySync = true;
    panel.isAwaitingFullSync = true;
    panel.lastError = 'old account error';
    panel._upgradeTimeoutId = 10;
    panel._errorTimeoutId = 11;

    panel.reset({ render: false });

    expect(clearTimeoutSpy).toHaveBeenCalledWith(10);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(11);
    expect(panel).toMatchObject({
      shipData: null,
      inventory: {},
      credits: 0,
      selectedPart: 'engine',
      isUpgrading: false,
      isAwaitingInventorySync: false,
      isAwaitingFullSync: false,
      lastError: null
    });
  });

  it('clears panel and indicator state on logout', () => {
    const reset = vi.fn();
    const clearUpgradeIndicator = vi.fn();
    const removeItem = vi.fn();
    const stopGame = vi.fn();
    const { value: network } = loadGlobal('client/js/network.js', 'Network', {
      window: {},
      localStorage: { removeItem },
      GalaxyMiner: { stopGame },
      ShipUpgradePanel: { reset },
      HUD: { clearUpgradeIndicator }
    });
    network.socket = { emit: vi.fn() };
    network.token = 'old-token';

    network.logout();

    expect(removeItem).toHaveBeenCalledWith('galaxy-miner-token');
    expect(network.socket.emit).toHaveBeenCalledWith('auth:logout');
    expect(stopGame).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    expect(clearUpgradeIndicator).toHaveBeenCalledOnce();
  });

  it('resets and reinitializes panel state on every authentication snapshot', () => {
    const player = createPlayer({ id: 1 });
    const reset = vi.fn();
    const updateData = vi.fn();
    const updateUpgradeIndicator = vi.fn();
    const startGame = vi.fn(data => {
      player.id = data.id;
      player.ship = data.ship;
      player.inventory = data.inventory;
      player.credits = data.credits;
    });
    const { register } = loadModule('client/js/network/auth.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      ShipUpgradePanel: { reset, updateData },
      HUD: { updateUpgradeIndicator },
      Network: { token: null },
      GalaxyMiner: { startGame },
      localStorage: { setItem: vi.fn(), removeItem: vi.fn() },
      AuthUI: { showError: vi.fn() }
    });
    const { handlers } = captureHandlers(register);
    const nextPlayer = {
      id: 2,
      ship: { engineTier: 1 },
      inventory: [],
      credits: 250
    };

    handlers.get('auth:success')({ token: 'new-token', player: nextPlayer });

    expect(reset).toHaveBeenCalledWith({ render: false });
    expect(startGame).toHaveBeenCalledWith(nextPlayer);
    expect(updateData).toHaveBeenCalledWith({
      ship: nextPlayer.ship,
      inventory: [],
      credits: 250
    }, { authoritativeInventory: true, authoritativeShip: true });
    expect(reset.mock.invocationCallOrder[0])
      .toBeLessThan(updateData.mock.invocationCallOrder[0]);
    expect(updateUpgradeIndicator).toHaveBeenCalledOnce();
  });

  it('cancels a same-account modern request timer when reconnect auth succeeds', () => {
    const { panel, clearTimeoutSpy } = loadPanel();
    panel.isUpgrading = true;
    panel.isAwaitingInventorySync = true;
    panel.isAwaitingFullSync = true;
    panel._upgradeTimeoutId = 321;
    panel._errorTimeoutId = 322;
    const player = createPlayer({ id: 7, inventory: ENGINE_TIER_TWO_INVENTORY });
    const startGame = vi.fn(data => {
      player.id = data.id;
      player.ship = data.ship;
      player.inventory = data.inventory;
      player.credits = data.credits;
    });
    const { register } = loadModule('client/js/network/auth.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      ShipUpgradePanel: panel,
      HUD: { updateUpgradeIndicator: vi.fn() },
      Network: { token: null },
      GalaxyMiner: { startGame },
      localStorage: { setItem: vi.fn(), removeItem: vi.fn() },
      AuthUI: { showError: vi.fn() }
    });
    const { handlers } = captureHandlers(register);
    const snapshot = {
      id: player.id,
      ship: { ...player.ship },
      inventory: [],
      credits: 250
    };

    handlers.get('auth:success')({ token: 'same-account-token', player: snapshot });

    expect(clearTimeoutSpy).toHaveBeenCalledWith(321);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(322);
    expect(panel).toMatchObject({
      isUpgrading: false,
      isAwaitingInventorySync: false,
      isAwaitingFullSync: false,
      inventory: {},
      credits: 250
    });
  });

  it('requires every configured resource in the legacy upgrade UI', () => {
    const list = {
      innerHTML: '',
      querySelectorAll: vi.fn(() => [])
    };
    const player = createPlayer({
      inventory: [
        { resource_type: 'HYDROGEN', quantity: 5 },
        { resource_type: 'CARBON', quantity: 2 }
      ]
    });
    const { value: upgrades } = loadGlobal('client/js/ui/upgrades.js', 'UpgradesUI', {
      Logger: { log: vi.fn() },
      Player: player,
      CONSTANTS,
      Network: { sendUpgrade: vi.fn() },
      document: { getElementById: vi.fn(() => list) }
    });

    upgrades.refresh();
    let engineButton = list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0];
    expect(engineButton).toContain('disabled');
    expect(list.innerHTML).toContain('5 HYDROGEN');
    expect(list.innerHTML).toContain('3 CARBON');
    expect(list.innerHTML).toContain('Energy Core');
    expect(list.innerHTML).toContain('Hull');

    player.inventory[1].quantity = 3;
    upgrades.refresh();
    engineButton = list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0];
    expect(engineButton).not.toContain('disabled');

    upgrades.isAwaitingInventorySync = true;
    upgrades.refresh();
    engineButton = list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0];
    expect(engineButton).toContain('disabled');
  });

  it('reconciles and refreshes an already-open legacy tab on authentication', () => {
    const list = {
      innerHTML: '',
      querySelectorAll: vi.fn(() => [])
    };
    const player = createPlayer({ inventory: ENGINE_TIER_TWO_INVENTORY });
    const { value: upgrades } = loadGlobal('client/js/ui/upgrades.js', 'UpgradesUI', {
      Logger: { log: vi.fn() },
      Player: player,
      CONSTANTS,
      Network: { sendUpgrade: vi.fn() },
      document: { getElementById: vi.fn(() => list) }
    });
    upgrades.isAwaitingInventorySync = true;
    upgrades.refresh();
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).toContain('disabled');

    const startGame = vi.fn(data => {
      player.id = data.id;
      player.ship = data.ship;
      player.inventory = data.inventory;
      player.credits = data.credits;
    });
    const { register } = loadModule('client/js/network/auth.js', {
      window: { Logger: { log: vi.fn() } },
      Player: player,
      UpgradesUI: upgrades,
      HUD: { updateUpgradeIndicator: vi.fn() },
      Network: { token: null },
      GalaxyMiner: { startGame },
      localStorage: { setItem: vi.fn(), removeItem: vi.fn() },
      AuthUI: { showError: vi.fn() }
    });
    const { handlers } = captureHandlers(register);
    const nextPlayer = {
      id: player.id,
      ship: { ...player.ship },
      inventory: ENGINE_TIER_TWO_INVENTORY,
      credits: 10000
    };

    handlers.get('auth:success')({ token: 'reconnected-token', player: nextPlayer });

    expect(startGame).toHaveBeenCalledWith(nextPlayer);
    expect(upgrades.isSynchronizing()).toBe(false);
    expect(list.innerHTML.match(
      /<button class="upgrade-btn" data-component="engine"[\s\S]*?<\/button>/
    )?.[0]).not.toContain('disabled');
  });
});
