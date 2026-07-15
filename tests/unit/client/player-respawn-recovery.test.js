import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadDeathEffect(overrides = {}) {
  const context = vm.createContext({
    console,
    Date,
    Math,
    window: {},
    document: {
      getElementById: vi.fn(() => null),
      createElement: vi.fn()
    },
    Logger: { log: vi.fn(), error: vi.fn() },
    Player: { isDead: true },
    ...overrides
  });
  context.globalThis = context;
  const filename = path.join(root, 'client/js/graphics/player-death.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return {
    effect: vm.runInContext('PlayerDeathEffect', context),
    context
  };
}

describe('player respawn error recovery', () => {
  it('restores the respawn controls after a server rejection', () => {
    const { effect } = loadDeathEffect();
    effect.active = true;
    effect.phase = 'respawn_waiting';
    effect.showRespawnButton = vi.fn();

    effect.onRespawnError({ message: 'Respawn failed; please try again' });

    expect(effect.phase).toBe('respawn_waiting');
    expect(effect.showRespawnButton).toHaveBeenCalledOnce();
  });

  it('restores the controls immediately when no network is available', () => {
    const { effect } = loadDeathEffect();
    effect.active = true;
    effect.phase = 'respawn_waiting';
    effect.showRespawnButton = vi.fn();

    effect.handleRespawn();

    expect(effect.showRespawnButton).toHaveBeenCalledOnce();
  });

  it('ignores a late error after the player is already alive', () => {
    const { effect } = loadDeathEffect({ Player: { isDead: false } });
    effect.active = true;
    effect.showRespawnButton = vi.fn();

    effect.onRespawnError({ message: 'late error' });

    expect(effect.showRespawnButton).not.toHaveBeenCalled();
  });
});
