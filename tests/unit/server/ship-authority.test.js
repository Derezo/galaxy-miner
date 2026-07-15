import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const statements = {
  getShipByUserId: { get: vi.fn() },
  getInventory: { all: vi.fn(() => []) },
  updateShipColor: { run: vi.fn() },
  updateShipProfile: { run: vi.fn() }
};
const performUpgrade = vi.fn();

installCommonJsMock('../../../server/database.js', {
  statements,
  performUpgrade,
  getSafeCredits: vi.fn(ship => ship?.credits || 0)
});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const shipPath = require.resolve('../../../server/socket/ship.js');
delete require.cache[shipPath];
const shipHandlers = require(shipPath);

function createHarness() {
  const handlers = new Map();
  const socket = {
    id: 'ship-socket',
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn()
  };
  const player = { id: 42, engineTier: 1, cargoTier: 1, credits: 1000 };
  const deps = {
    getAuthenticatedUserId: () => 42,
    combat: { invalidateShieldRechargeState: vi.fn() },
    state: {
      connectedPlayers: new Map([[socket.id, player]]),
      VALID_COMPONENTS: new Set(['engine', 'cargo', 'shield']),
      VALID_COLORS: new Set(['green']),
      VALID_PROFILES: new Set(['pilot']),
      broadcastToNearby: vi.fn()
    }
  };
  shipHandlers.register(socket, deps);
  return { handlers, socket, player, deps };
}

describe('ship upgrade authority cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statements.getShipByUserId.get.mockReset();
    statements.getInventory.all.mockReset();
    performUpgrade.mockReset();
    statements.getInventory.all.mockReturnValue([]);
  });

  it.each([
    ['engine', 'engineTier', 'engine_tier'],
    ['cargo', 'cargoTier', 'cargo_tier']
  ])('updates the live %s tier immediately', (component, cacheKey, dbKey) => {
    const { handlers, socket, player } = createHarness();
    const current = { engine_tier: 1, cargo_tier: 1, credits: 1000 };
    const updated = { ...current, [dbKey]: 2, credits: 900, hull_max: 100, shield_max: 50 };
    statements.getShipByUserId.get.mockReturnValue(current);
    performUpgrade.mockReturnValue({
      success: true,
      newTier: 2,
      ship: updated,
      inventory: []
    });

    handlers.get('ship:upgrade')({ component });

    expect(player[cacheKey]).toBe(2);
    expect(performUpgrade).toHaveBeenCalledWith(
      42,
      component,
      expect.any(Object),
      expect.any(Number)
    );
    expect(socket.emit).toHaveBeenCalledWith('upgrade:success', expect.objectContaining({
      inventory: []
    }));
    expect(statements.getShipByUserId.get).toHaveBeenCalledOnce();
    expect(statements.getInventory.all).not.toHaveBeenCalled();
  });

  it('keeps success semantics when post-commit cache synchronization fails', () => {
    const { handlers, socket, deps } = createHarness();
    const current = {
      engine_tier: 1,
      cargo_tier: 1,
      shield_tier: 1,
      credits: 1000
    };
    const updated = {
      ...current,
      shield_tier: 2,
      credits: 900,
      hull_max: 100,
      shield_max: 75
    };
    statements.getShipByUserId.get.mockReturnValue(current);
    performUpgrade.mockReturnValue({
      success: true,
      newTier: 2,
      ship: updated,
      inventory: []
    });
    deps.combat.invalidateShieldRechargeState.mockImplementation(() => {
      throw new Error('injected cache failure');
    });

    handlers.get('ship:upgrade')({ component: 'shield' });

    expect(socket.emit).toHaveBeenCalledWith('upgrade:success', expect.objectContaining({
      component: 'shield',
      newTier: 2,
      inventory: []
    }));
    expect(socket.emit).not.toHaveBeenCalledWith('upgrade:error', expect.anything());
  });

  it('rejects null customization payloads without throwing', () => {
    const { handlers, socket } = createHarness();

    expect(() => handlers.get('ship:setColor')(null)).not.toThrow();
    expect(() => handlers.get('ship:setProfile')(null)).not.toThrow();
    expect(socket.emit).toHaveBeenCalledWith('ship:colorError', {
      message: 'Invalid color selection'
    });
    expect(socket.emit).toHaveBeenCalledWith('ship:profileError', {
      message: 'Invalid profile selection'
    });
  });

  it('returns inventory with ship data for affordability reconciliation', () => {
    const { handlers, socket } = createHarness();
    const inventory = [{ resource_type: 'IRON', quantity: 4 }];
    statements.getShipByUserId.get.mockReturnValue({
      engine_tier: 2,
      weapon_tier: 1,
      shield_tier: 1,
      mining_tier: 1,
      cargo_tier: 1,
      radar_tier: 1,
      energy_core_tier: 1,
      hull_tier: 1,
      credits: 250
    });
    statements.getInventory.all.mockReturnValue(inventory);

    handlers.get('ship:getData')();

    expect(socket.emit).toHaveBeenCalledWith('ship:data', expect.objectContaining({
      credits: 250,
      inventory
    }));
  });
});
