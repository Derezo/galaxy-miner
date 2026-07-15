import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadUpgradePanel() {
  const preview = {
    init: vi.fn(),
    updateShipData: vi.fn(),
    startAnimation: vi.fn(),
    stopAnimation: vi.fn(),
    render: vi.fn(),
    setHighlightedComponent: vi.fn(),
    destroy: vi.fn()
  };
  const canvas = {};
  const container = {
    innerHTML: '',
    classList: { add: vi.fn(), remove: vi.fn() },
    querySelector: vi.fn(selector => selector === '.ship-preview-canvas' ? canvas : null),
    querySelectorAll: vi.fn(() => [])
  };
  const context = vm.createContext({
    console,
    window: { CONSTANTS, ShipPreviewCanvas: preview },
    setTimeout,
    clearTimeout
  });
  context.globalThis = context;
  const filename = path.join(root, 'client/js/ui/panels/ShipUpgradePanel.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });

  return {
    panel: context.window.ShipUpgradePanel,
    preview,
    container
  };
}

function loadTerminal() {
  const shipUpgradePanel = {
    setVisible: vi.fn(),
    updateData: vi.fn()
  };
  const classList = { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() };
  const elements = new Map([
    ['terminal-panel', { classList }],
    ['cargo-content', { classList }],
    ['upgrades-content', { classList }],
    ['market-content', { classList }],
    ['customize-content', { classList }],
    ['relics-content', { classList }],
    ['fleet-content', { classList }]
  ]);
  const context = vm.createContext({
    console,
    document: {
      getElementById: vi.fn(id => elements.get(id)),
      querySelectorAll: vi.fn(() => [])
    },
    ShipUpgradePanel: shipUpgradePanel,
    Player: { ship: {}, inventory: [], credits: 0 },
    UIState: { set: vi.fn() }
  });
  context.globalThis = context;
  const filename = path.join(root, 'client/js/ui/terminal.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });

  return {
    terminal: vm.runInContext('TerminalUI', context),
    shipUpgradePanel
  };
}

function loadPreviewCanvas() {
  const requestAnimationFrame = vi.fn(() => 0);
  const cancelAnimationFrame = vi.fn();
  const context = vm.createContext({
    console,
    window: {},
    requestAnimationFrame,
    cancelAnimationFrame
  });
  context.globalThis = context;
  const filename = path.join(root, 'client/js/ui/ship-preview/ShipPreviewCanvas.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return {
    preview: context.window.ShipPreviewCanvas,
    requestAnimationFrame,
    cancelAnimationFrame
  };
}

function loadMain() {
  const authClassList = { add: vi.fn(), remove: vi.fn() };
  const hudClassList = { add: vi.fn(), remove: vi.fn() };
  const terminal = { hide: vi.fn() };
  const context = vm.createContext({
    console,
    document: {
      addEventListener: vi.fn(),
      getElementById: vi.fn(id => id === 'auth-screen'
        ? { classList: authClassList }
        : { classList: hudClassList })
    },
    Game: { stop: vi.fn() },
    Input: { reset: vi.fn() },
    AutoFire: { currentTarget: {} },
    TerminalUI: terminal,
    AudioManager: { stopAllLoops: vi.fn() },
    MusicManager: { stop: vi.fn() }
  });
  context.globalThis = context;
  const filename = path.join(root, 'client/js/main.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return {
    galaxyMiner: vm.runInContext('GalaxyMiner', context),
    terminal,
    authClassList,
    hudClassList
  };
}

describe('ship upgrade preview lifecycle', () => {
  it('renders one static hidden frame and animates only while explicitly visible', () => {
    const { panel, preview, container } = loadUpgradePanel();

    panel.init(container);
    expect(preview.startAnimation).not.toHaveBeenCalled();
    expect(preview.stopAnimation).toHaveBeenCalledOnce();
    expect(preview.render).toHaveBeenCalledOnce();

    panel.setVisible(true);
    expect(preview.startAnimation).toHaveBeenCalledOnce();

    panel.setVisible(false);
    const startsBeforeHiddenUpdate = preview.startAnimation.mock.calls.length;
    panel.updateData({ ship: {}, inventory: [], credits: 10 });

    expect(preview.startAnimation).toHaveBeenCalledTimes(startsBeforeHiddenUpdate);
    expect(preview.stopAnimation).toHaveBeenCalledTimes(3);
    expect(preview.render).toHaveBeenCalledTimes(2);
  });

  it('ties animation visibility to the open terminal and active upgrades tab', () => {
    const { terminal, shipUpgradePanel } = loadTerminal();

    terminal.show();
    expect(shipUpgradePanel.setVisible).toHaveBeenLastCalledWith(false);

    terminal.switchTab('upgrades');
    expect(shipUpgradePanel.setVisible).toHaveBeenLastCalledWith(true);

    terminal.switchTab('cargo');
    expect(shipUpgradePanel.setVisible).toHaveBeenLastCalledWith(false);

    terminal.switchTab('upgrades');
    terminal.hide();
    expect(shipUpgradePanel.setVisible).toHaveBeenLastCalledWith(false);
  });

  it('treats requestAnimationFrame id zero as an active cancellable loop', () => {
    const { preview, requestAnimationFrame, cancelAnimationFrame } = loadPreviewCanvas();
    preview.render = vi.fn();

    preview.startAnimation();
    preview.startAnimation();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    preview.stopAnimation();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(0);
  });

  it('closes the out-of-HUD terminal and preview on auth termination', () => {
    const { galaxyMiner, terminal, authClassList, hudClassList } = loadMain();

    galaxyMiner.stopGame();

    expect(terminal.hide).toHaveBeenCalledWith({ silent: true });
    expect(authClassList.remove).toHaveBeenCalledWith('hidden');
    expect(hudClassList.add).toHaveBeenCalledWith('hidden');
  });
});
