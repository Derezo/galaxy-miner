import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('market seller balance synchronization', () => {
  it('applies the authoritative balance before animating sale credits', () => {
    const handlers = new Map();
    const Player = { credits: 100, onCreditsEarned: vi.fn() };
    const UIState = { set: vi.fn() };
    const CreditAnimation = { addCredits: vi.fn(), sync: vi.fn() };
    const context = vm.createContext({
      console,
      window: { Logger: { log: vi.fn() } },
      Player,
      UIState,
      CreditAnimation,
      Number
    });
    context.globalThis = context;
    vm.runInContext(
      fs.readFileSync(path.join(root, 'client/js/network/marketplace.js'), 'utf8'),
      context
    );
    const module = context.window.NetworkHandlers.marketplace;
    module.register({ on: (event, handler) => handlers.set(event, handler) });

    handlers.get('market:sold')({ totalCredits: 30, credits: 130 });

    expect(Player.credits).toBe(130);
    expect(UIState.set).toHaveBeenCalledWith('credits', 130);
    expect(Player.onCreditsEarned).toHaveBeenCalledWith(30);
    expect(CreditAnimation.addCredits).toHaveBeenCalledWith(30);
    expect(CreditAnimation.sync).toHaveBeenCalledOnce();
  });
});
