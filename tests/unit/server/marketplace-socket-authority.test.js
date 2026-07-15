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

const statements = {
  getShipByUserId: { get: vi.fn(() => ({ credits: 100 })) },
  getInventory: { all: vi.fn(() => []) },
  getListingById: { get: vi.fn() }
};
const marketplaceStub = {
  listItem: vi.fn(() => ({ success: true, listingId: 7, inventory: [] })),
  buyItem: vi.fn(),
  cancelListing: vi.fn(),
  getListings: vi.fn(() => []),
  getMyListings: vi.fn(() => [])
};

installCommonJsMock('../../../server/database.js', {
  statements,
  getSafeCredits: vi.fn(ship => ship?.credits || 0)
});
installCommonJsMock('../../../server/game/marketplace.js', marketplaceStub);
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const marketplaceHandlers = require('../../../server/socket/marketplace.js');

function createSocket() {
  const handlers = new Map();
  return {
    id: 'market-socket',
    handlers,
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn()
  };
}

function createDeps(socket, { player = { id: 42, isDead: false }, inTransit = false } = {}) {
  const connectedPlayers = new Map();
  if (player) connectedPlayers.set(socket.id, player);

  return {
    io: { emit: vi.fn(), to: vi.fn() },
    getAuthenticatedUserId: () => 42,
    wormhole: { isInTransit: vi.fn(() => inTransit) },
    state: {
      connectedPlayers,
      userSockets: new Map()
    }
  };
}

const validListing = {
  resourceType: 'IRON',
  quantity: 2,
  price: 10
};

describe('marketplace listing socket authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    marketplaceStub.listItem.mockReturnValue({
      success: true,
      listingId: 7,
      inventory: []
    });
  });

  it('rejects listings when the authenticated player is not connected', () => {
    const socket = createSocket();
    const deps = createDeps(socket, { player: null });
    marketplaceHandlers.register(socket, deps);

    socket.handlers.get('market:list')(validListing);

    expect(socket.emit).toHaveBeenCalledWith('market:error', {
      message: 'You must be alive and connected to list items'
    });
    expect(marketplaceStub.listItem).not.toHaveBeenCalled();
    expect(deps.wormhole.isInTransit).not.toHaveBeenCalled();
  });

  it('rejects listings from dead players', () => {
    const socket = createSocket();
    const deps = createDeps(socket, { player: { id: 42, isDead: true } });
    marketplaceHandlers.register(socket, deps);

    socket.handlers.get('market:list')(validListing);

    expect(socket.emit).toHaveBeenCalledWith('market:error', {
      message: 'You must be alive and connected to list items'
    });
    expect(marketplaceStub.listItem).not.toHaveBeenCalled();
    expect(deps.wormhole.isInTransit).not.toHaveBeenCalled();
  });

  it('rejects listings during wormhole transit', () => {
    const socket = createSocket();
    const deps = createDeps(socket, { inTransit: true });
    marketplaceHandlers.register(socket, deps);

    socket.handlers.get('market:list')(validListing);

    expect(socket.emit).toHaveBeenCalledWith('market:error', {
      message: 'Cannot list items during wormhole transit'
    });
    expect(deps.wormhole.isInTransit).toHaveBeenCalledWith(42);
    expect(marketplaceStub.listItem).not.toHaveBeenCalled();
  });

  it('allows a living connected player outside transit to list', () => {
    const socket = createSocket();
    const deps = createDeps(socket);
    marketplaceHandlers.register(socket, deps);

    socket.handlers.get('market:list')(validListing);

    expect(marketplaceStub.listItem).toHaveBeenCalledWith(42, 'IRON', 2, 10);
    expect(socket.emit).toHaveBeenCalledWith('market:listed', { listingId: 7 });
  });
});
