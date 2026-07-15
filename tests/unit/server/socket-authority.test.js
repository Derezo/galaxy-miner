import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

installCommonJsMock('../../../server/database.js', {
  statements: {
    updateShipPosition: { run: vi.fn() },
    getShipByUserId: { get: vi.fn() },
    getInventory: { all: vi.fn(() => []) }
  },
  getSafeCredits: vi.fn(ship => ship?.credits || 0),
  safeUpdateCredits: vi.fn()
});
const authStub = {
  isLoginRateLimited: vi.fn(() => false),
  isRegisterRateLimited: vi.fn(() => false),
  login: vi.fn(),
  register: vi.fn(),
  validateToken: vi.fn(),
  getPlayerData: vi.fn(),
  destroySession: vi.fn()
};
installCommonJsMock('../../../server/auth.js', authStub);
const gameCombatStub = {
  fire: vi.fn(() => ({ success: true })),
  applyRespawn: vi.fn(),
  buildRespawnOptions: vi.fn()
};
installCommonJsMock('../../../server/game/combat.js', gameCombatStub);
const relicHandlerStub = {
  getPlayerPlunderCooldownRemaining: vi.fn(() => 0)
};
installCommonJsMock('../../../server/socket/relic.js', relicHandlerStub);
installCommonJsMock('../../../server/game/npc.js', {});
installCommonJsMock('../../../server/game/engine.js', {});
installCommonJsMock('../../../shared/logger.js', {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
});

const authHandlers = require('../../../server/socket/auth.js');
const combatHandlers = require('../../../server/socket/combat.js');
const playerHandlers = require('../../../server/socket/player.js');
const boostAuthority = require('../../../server/socket/boost-authority.js');
const databaseStatements = require('../../../server/database.js').statements;

function createSocket(id = 'socket-1') {
  const handlers = new Map();
  return {
    id,
    handlers,
    handshake: { address: '127.0.0.1' },
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn(),
    disconnect: vi.fn()
  };
}

function createPlayer(overrides = {}) {
  return {
    id: 42,
    username: 'authority_test',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    hull: 120,
    hullMax: 240,
    shield: 60,
    shieldMax: 120,
    weaponType: 'energy',
    weaponTier: 4,
    energyCoreTier: 5,
    isDead: false,
    lastMovementAt: Date.now(),
    lastSave: Date.now(),
    ...overrides
  };
}

function createAuthPlayerData(overrides = {}) {
  return {
    id: 42,
    username: 'auth_test',
    position_x: 1,
    position_y: 2,
    velocity_x: 0,
    velocity_y: 0,
    rotation: 0,
    hull_hp: 100,
    hull_max: 100,
    shield_hp: 50,
    shield_max: 50,
    credits: 0,
    relics: [],
    ...overrides
  };
}

function createPlayerDeps(socket, player, overrides = {}) {
  const connectedPlayers = new Map([[socket.id, player]]);
  return {
    io: { emit: vi.fn() },
    getAuthenticatedUserId: () => 42,
    engine: {
      updatePlayerInHash: vi.fn(),
      ...overrides.engine
    },
    wormhole: {
      isInTransit: vi.fn(() => false),
      ...overrides.wormhole
    },
    state: {
      connectedPlayers,
      getPlayerStatus: vi.fn(() => 'idle'),
      updatePlayerSectorRooms: vi.fn(),
      broadcastToNearby: vi.fn(),
      ...overrides.state
    },
    ...overrides,
    // Preserve merged nested dependencies after the top-level spread.
    engine: {
      updatePlayerInHash: vi.fn(),
      ...overrides.engine
    },
    wormhole: {
      isInTransit: vi.fn(() => false),
      ...overrides.wormhole
    }
  };
}

function createCombatDeps(socket, player, overrides = {}) {
  const connectedPlayers = new Map([[socket.id, player]]);
  return {
    io: { emit: vi.fn() },
    getAuthenticatedUserId: () => 42,
    combat: { fire: vi.fn(() => ({ success: true })) },
    npc: {
      getNPCsInRange: vi.fn(() => []),
      getBasesInRange: vi.fn(() => []),
      ...overrides.npc
    },
    engine: {
      playerAttackNPC: vi.fn(),
      playerAttackBase: vi.fn(),
      ...overrides.engine
    },
    statements: {
      getShipByUserId: { get: vi.fn() },
      getInventory: { all: vi.fn(() => []) }
    },
    getSafeCredits: vi.fn(ship => ship?.credits || 0),
    safeUpdateCredits: vi.fn(),
    state: {
      connectedPlayers,
      setPlayerStatus: vi.fn(),
      broadcastToNearby: vi.fn(),
      ...overrides.state
    },
    broadcasts: {
      broadcastChainLightning: vi.fn(),
      broadcastTeslaCoil: vi.fn()
    },
    ...overrides,
    // Preserve merged nested dependencies after the top-level spread.
    state: {
      connectedPlayers,
      setPlayerStatus: vi.fn(),
      broadcastToNearby: vi.fn(),
      ...overrides.state
    },
    combat: {
      fire: vi.fn(() => ({ success: true })),
      ...overrides.combat
    },
    npc: {
      getNPCsInRange: vi.fn(() => []),
      getBasesInRange: vi.fn(() => []),
      ...overrides.npc
    },
    engine: {
      playerAttackNPC: vi.fn(),
      playerAttackBase: vi.fn(),
      ...overrides.engine
    }
  };
}

describe('authoritative player socket input', () => {
  beforeEach(() => {
    boostAuthority.clearPlayerBoostAuthority(42);
    databaseStatements.getInventory.all.mockReset().mockReturnValue([]);
    gameCombatStub.applyRespawn.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a normal first predicted snapshot after authentication', () => {
    const socket = createSocket();
    const player = createPlayer();
    const deps = createPlayerDeps(socket, player);
    playerHandlers.register(socket, deps);

    vi.advanceTimersByTime(50);
    socket.handlers.get('player:input')({ x: 20, y: 0, vx: 100, vy: 0, rotation: 0 });

    expect(player.position).toEqual({ x: 20, y: 0 });
    expect(deps.engine.updatePlayerInHash).toHaveBeenCalledOnce();
    expect(deps.state.broadcastToNearby).toHaveBeenCalledOnce();
    expect(deps.state.broadcastToNearby).toHaveBeenCalledWith(
      socket,
      player,
      'player:update',
      expect.objectContaining({ hullMax: 240, shieldMax: 120 })
    );
  });

  it('rejects malformed and teleporting snapshots without mutating state', () => {
    const socket = createSocket();
    const player = createPlayer();
    const deps = createPlayerDeps(socket, player);
    playerHandlers.register(socket, deps);
    const receiveInput = socket.handlers.get('player:input');

    receiveInput({ x: Infinity, y: 0, vx: 0, vy: 0, rotation: 0 });
    receiveInput({ x: 10000, y: 0, vx: 0, vy: 0, rotation: 0 });

    expect(player.position).toEqual({ x: 0, y: 0 });
    expect(deps.engine.updatePlayerInHash).not.toHaveBeenCalled();
    expect(deps.state.broadcastToNearby).not.toHaveBeenCalled();
  });

  it('uses the authenticated engine tier instead of a global max-tier movement budget', () => {
    const lowTierSocket = createSocket('low-tier');
    const lowTierPlayer = createPlayer({ engineTier: 1, energyCoreTier: 1 });
    const lowTierDeps = createPlayerDeps(lowTierSocket, lowTierPlayer);
    playerHandlers.register(lowTierSocket, lowTierDeps);

    const highTierSocket = createSocket('high-tier');
    const highTierPlayer = createPlayer({ engineTier: 5, energyCoreTier: 5 });
    const highTierDeps = createPlayerDeps(highTierSocket, highTierPlayer);
    playerHandlers.register(highTierSocket, highTierDeps);

    vi.advanceTimersByTime(50);
    const snapshot = { x: 60, y: 0, vx: 100, vy: 0, rotation: 0 };
    lowTierSocket.handlers.get('player:input')(snapshot);
    highTierSocket.handlers.get('player:input')(snapshot);

    expect(lowTierPlayer.position).toEqual({ x: 0, y: 0 });
    expect(highTierPlayer.position).toEqual({ x: 60, y: 0 });
  });

  it('does not mint a fresh displacement allowance for packet spam', () => {
    const socket = createSocket();
    const player = createPlayer({ engineTier: 1, energyCoreTier: 1 });
    const deps = createPlayerDeps(socket, player);
    playerHandlers.register(socket, deps);
    const receiveInput = socket.handlers.get('player:input');

    receiveInput({ x: 30, y: 0, vx: 100, vy: 0, rotation: 0 });
    for (let index = 0; index < 50; index++) {
      receiveInput({ x: 60 + index, y: 0, vx: 100, vy: 0, rotation: 0 });
    }

    expect(player.position).toEqual({ x: 30, y: 0 });
    expect(deps.engine.updatePlayerInHash).toHaveBeenCalledOnce();
  });

  it('authorizes boost for its duration but not continuously through cooldown', () => {
    const socket = createSocket();
    const player = createPlayer({ engineTier: 1, energyCoreTier: 1 });
    const deps = createPlayerDeps(socket, player);
    playerHandlers.register(socket, deps);
    const receiveInput = socket.handlers.get('player:input');

    vi.advanceTimersByTime(50);
    receiveInput({
      x: 50, y: 0, vx: 250, vy: 0, rotation: 0, boostActive: true
    });
    expect(player.position.x).toBe(50);
    expect(player.serverBoostCooldownEndAt).toBeGreaterThan(Date.now());

    vi.advanceTimersByTime(3100);
    receiveInput({
      x: 150, y: 0, vx: 250, vy: 0, rotation: 0, boostActive: true
    });
    expect(player.position.x).toBe(50);

    vi.advanceTimersByTime(12000);
    receiveInput({
      x: 150, y: 0, vx: 250, vy: 0, rotation: 0, boostActive: true
    });
    expect(player.position.x).toBe(150);
  });

  it.each([
    ['dead', { isDead: true }, false],
    ['in wormhole transit', {}, true]
  ])('rejects movement while %s', (_label, playerOverrides, inTransit) => {
    const socket = createSocket();
    const player = createPlayer(playerOverrides);
    const deps = createPlayerDeps(socket, player, {
      wormhole: { isInTransit: vi.fn(() => inTransit) }
    });
    playerHandlers.register(socket, deps);

    socket.handlers.get('player:input')({ x: 10, y: 0, vx: 10, vy: 0, rotation: 0 });

    expect(player.position).toEqual({ x: 0, y: 0 });
    expect(deps.engine.updatePlayerInHash).not.toHaveBeenCalled();
  });

  it('resets the movement clock after an authoritative respawn teleport', () => {
    const socket = createSocket();
    const offeredRespawn = { type: 'graveyard', message: 'Returning...' };
    const player = createPlayer({ isDead: true, respawnOptions: offeredRespawn });
    const deps = createPlayerDeps(socket, player);
    gameCombatStub.applyRespawn.mockReturnValue({
      position: { x: 5000, y: 5000 },
      hull: 120,
      shield: 60,
      locationName: 'The Graveyard'
    });
    playerHandlers.register(socket, deps);

    socket.handlers.get('respawn:select')({ type: 'graveyard', targetId: null });
    expect(gameCombatStub.applyRespawn).toHaveBeenCalledWith(
      42,
      'graveyard',
      null,
      offeredRespawn
    );
    expect(player.respawnOptions).toBeNull();
    vi.advanceTimersByTime(50);
    socket.handlers.get('player:input')({
      x: 5020,
      y: 5000,
      vx: 100,
      vy: 0,
      rotation: 0
    });

    expect(player.position).toEqual({ x: 5020, y: 5000 });
    expect(deps.engine.updatePlayerInHash).toHaveBeenCalledTimes(2);
    expect(deps.state.broadcastToNearby).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenCalledWith('player:respawn', expect.objectContaining({
      inventory: []
    }));
  });

  it('keeps the player dead when the pre-respawn inventory snapshot fails', () => {
    const socket = createSocket();
    const player = createPlayer({
      isDead: true,
      respawnOptions: { type: 'graveyard', message: 'Returning...' }
    });
    const deps = createPlayerDeps(socket, player);
    databaseStatements.getInventory.all.mockImplementationOnce(() => {
      throw new Error('injected inventory read failure');
    });
    playerHandlers.register(socket, deps);

    socket.handlers.get('respawn:select')({ type: 'graveyard', targetId: null });

    expect(gameCombatStub.applyRespawn).not.toHaveBeenCalled();
    expect(player.isDead).toBe(true);
    expect(player.respawnOptions).not.toBeNull();
    expect(deps.engine.updatePlayerInHash).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('respawn:error', {
      message: 'Respawn failed; please try again'
    });
  });

  it('routes Hive Core AoE events through proximity-filtered broadcasts', () => {
    const socket = createSocket();
    const player = createPlayer({ isDead: true });
    const emitNear = vi.fn();
    const deps = createPlayerDeps(socket, player, {
      broadcasts: { emitNear }
    });
    const hivePosition = { x: 5000, y: 5000 };
    const wreckagePosition = { x: 5010, y: 5000 };
    const npcPosition = { x: 5020, y: 5000 };
    gameCombatStub.applyRespawn.mockReturnValue({
      position: hivePosition,
      hull: 120,
      shield: 60,
      locationName: 'Swarm Hive',
      hiveDestruction: {
        hiveId: 'hive-1',
        hivePosition,
        destructionRadius: 500,
        killedNpcs: [{ id: 'swarm-1', position: npcPosition }],
        spawnedWreckage: [{
          id: 'wreckage-1',
          position: wreckagePosition,
          size: 20,
          faction: 'swarm',
          npcType: 'swarm_drone',
          npcName: 'Swarm Drone',
          contents: []
        }]
      }
    });
    playerHandlers.register(socket, deps);

    socket.handlers.get('respawn:select')({
      type: 'swarm_hive_core',
      targetId: 'hive-1'
    });

    expect(emitNear).toHaveBeenCalledWith(
      hivePosition,
      'hive:coreImplosion',
      expect.any(Object),
      500
    );
    expect(emitNear).toHaveBeenCalledWith(
      wreckagePosition,
      'wreckage:spawn',
      expect.objectContaining({ id: 'wreckage-1' }),
      20
    );
    expect(emitNear).toHaveBeenCalledWith(
      npcPosition,
      'npc:destroyed',
      expect.objectContaining({ id: 'swarm-1', hiveCoreKill: true })
    );
    expect(deps.io.emit).not.toHaveBeenCalled();
  });
});

describe('authenticated player authority cache', () => {
  beforeEach(() => {
    boostAuthority.clearPlayerBoostAuthority(42);
    boostAuthority.clearPlayerBoostAuthority(84);
    vi.clearAllMocks();
    authStub.isLoginRateLimited.mockReset().mockReturnValue(false);
    authStub.isRegisterRateLimited.mockReset().mockReturnValue(false);
    authStub.login.mockReset();
    authStub.register.mockReset();
    authStub.validateToken.mockReset();
    authStub.getPlayerData.mockReset();
    authStub.destroySession.mockReset();
    relicHandlerStub.getPlayerPlunderCooldownRemaining.mockReset().mockReturnValue(0);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches every ship tier, weapon type, and normalized relic type', () => {
    const socket = createSocket();
    const connectedPlayers = new Map();
    const deps = {
      io: { sockets: { sockets: new Map() } },
      engine: { insertPlayerInHash: vi.fn() },
      state: {
        connectedPlayers,
        userSockets: new Map(),
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      }
    };
    const playerData = {
      id: 42,
      username: 'cache_test',
      position_x: 1,
      position_y: 2,
      velocity_x: 3,
      velocity_y: 4,
      rotation: 0.5,
      hull_hp: 120,
      hull_max: 240,
      shield_hp: 60,
      shield_max: 120,
      engine_tier: 2,
      weapon_type: 'explosive',
      weapon_tier: 3,
      shield_tier: 4,
      mining_tier: 5,
      cargo_tier: 2,
      radar_tier: 3,
      energy_core_tier: 4,
      hull_tier: 5,
      credits: 100,
      relics: [
        { relic_type: 'wormhole_gem' },
        { relic_type: 'SWARM_HIVE_CORE' },
        { relic_type: null }
      ]
    };

    authHandlers.setupAuthenticatedPlayer(socket, playerData, 'token', deps);

    expect(connectedPlayers.get(socket.id)).toMatchObject({
      engineTier: 2,
      weaponType: 'explosive',
      weaponTier: 3,
      shieldTier: 4,
      miningTier: 5,
      cargoTier: 2,
      radarTier: 3,
      energyCoreTier: 4,
      hullTier: 5,
      relicTypes: ['WORMHOLE_GEM', 'SWARM_HIVE_CORE'],
      lastMovementAt: Date.now()
    });
  });

  it('cleans up a displaced socket before installing its replacement session', () => {
    const oldSocket = createSocket('old-socket');
    const newSocket = createSocket('new-socket');
    const connectedPlayers = new Map([['old-socket', createPlayer()]]);
    const userSockets = new Map([[42, 'old-socket']]);
    const cleanupPlayer = vi.fn((socket, userId, deps) => {
      expect(socket).toBe(oldSocket);
      expect(userId).toBe(42);
      deps.state.connectedPlayers.delete(socket.id);
      deps.state.userSockets.delete(userId);
      socket.data = { playerCleanupComplete: true };
    });
    const deps = {
      io: { sockets: { sockets: new Map([['old-socket', oldSocket]]) } },
      engine: { insertPlayerInHash: vi.fn() },
      handlers: { cleanupPlayer },
      state: {
        connectedPlayers,
        userSockets,
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      }
    };
    const playerData = {
      id: 42,
      username: 'replacement',
      position_x: 1,
      position_y: 2,
      velocity_x: 0,
      velocity_y: 0,
      rotation: 0,
      hull_hp: 100,
      hull_max: 100,
      shield_hp: 50,
      shield_max: 50,
      credits: 0,
      relics: []
    };

    authHandlers.setupAuthenticatedPlayer(newSocket, playerData, 'new-token', deps);

    expect(cleanupPlayer).toHaveBeenCalledOnce();
    expect(oldSocket.disconnect).toHaveBeenCalledWith(true);
    expect(userSockets.get(42)).toBe('new-socket');
    expect(connectedPlayers.has('old-socket')).toBe(false);
    expect(connectedPlayers.get('new-socket')?.username).toBe('replacement');
  });

  it('serializes overlapping authentication operations on one socket', async () => {
    const socket = createSocket();
    let resolveLogin;
    authStub.login.mockReturnValueOnce(new Promise(resolve => {
      resolveLogin = resolve;
    }));
    authStub.register.mockResolvedValueOnce({
      success: false,
      error: 'Registration denied'
    });
    const deps = {
      getAuthenticatedUserId: vi.fn(() => null),
      setAuthenticatedUserId: vi.fn(),
      state: {},
      handlers: { cleanupPlayer: vi.fn() }
    };
    authHandlers.register(socket, deps);

    const loginOperation = socket.handlers.get('auth:login')({
      username: 'first',
      password: 'secret'
    });
    const registerOperation = socket.handlers.get('auth:register')({
      username: 'second',
      password: 'secret'
    });

    await Promise.resolve();
    expect(authStub.login).toHaveBeenCalledOnce();
    expect(authStub.register).not.toHaveBeenCalled();

    resolveLogin({ success: false, error: 'Login denied' });
    await loginOperation;
    await registerOperation;

    expect(authStub.register).toHaveBeenCalledOnce();
  });

  it('applies login and registration rate limits before queueing behind bcrypt work', async () => {
    const socket = createSocket();
    let resolveLogin;
    authStub.login.mockReturnValueOnce(new Promise(resolve => {
      resolveLogin = resolve;
    }));
    authStub.isRegisterRateLimited.mockReturnValueOnce(true);
    const deps = {
      getAuthenticatedUserId: vi.fn(() => null),
      setAuthenticatedUserId: vi.fn(),
      state: {},
      handlers: { cleanupPlayer: vi.fn() }
    };
    authHandlers.register(socket, deps);

    const loginOperation = socket.handlers.get('auth:login')({
      username: 'first',
      password: 'secret'
    });
    await Promise.resolve();
    const registerOperation = socket.handlers.get('auth:register')({
      username: 'flooded',
      password: 'secret'
    });

    expect(authStub.login).toHaveBeenCalledOnce();
    expect(authStub.isRegisterRateLimited).toHaveBeenCalledOnce();
    expect(authStub.register).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth:error', {
      message: 'Too many registration attempts. Please wait.'
    });

    resolveLogin({ success: false, error: 'Login denied' });
    await loginOperation;
    await registerOperation;
    expect(authStub.register).not.toHaveBeenCalled();
  });

  it('bounds authentication work queued behind a slow operation', async () => {
    const socket = createSocket();
    let resolveLogin;
    authStub.login.mockReturnValueOnce(new Promise(resolve => {
      resolveLogin = resolve;
    }));
    const deps = {
      getAuthenticatedUserId: vi.fn(() => null),
      setAuthenticatedUserId: vi.fn(),
      state: {},
      handlers: { cleanupPlayer: vi.fn() }
    };
    authHandlers.register(socket, deps);

    const loginOperation = socket.handlers.get('auth:login')({
      username: 'first',
      password: 'secret'
    });
    const tokenOperations = Array.from({ length: 20 }, (_, index) =>
      socket.handlers.get('auth:token')({ token: `queued-token-${index}` }));
    await Promise.resolve();

    expect(authStub.login).toHaveBeenCalledOnce();
    expect(authStub.validateToken).not.toHaveBeenCalled();
    const overloadErrors = socket.emit.mock.calls.filter(([, payload]) =>
      payload?.message === 'Too many authentication requests. Please wait.');
    expect(overloadErrors.length).toBeGreaterThan(0);

    resolveLogin({ success: false, error: 'Login denied' });
    await Promise.all([loginOperation, ...tokenOperations]);

    expect(authStub.validateToken.mock.calls.length).toBeLessThan(tokenOperations.length);
  });

  it('cleans the prior same-socket identity before installing a new one', async () => {
    const socket = createSocket();
    socket.data = { authToken: 'old-token' };
    let authenticatedUserId = 42;
    const oldPlayer = createPlayer();
    const connectedPlayers = new Map([[socket.id, oldPlayer]]);
    const userSockets = new Map([[42, socket.id]]);
    const cleanupPlayer = vi.fn((cleanupSocket, userId, deps) => {
      deps.state.connectedPlayers.delete(cleanupSocket.id);
      deps.state.userSockets.delete(userId);
      cleanupSocket.data.playerCleanupComplete = true;
    });
    const setAuthenticatedUserId = vi.fn(userId => {
      authenticatedUserId = userId;
    });
    const replacement = createAuthPlayerData({ id: 84, username: 'replacement' });
    authStub.validateToken.mockReturnValueOnce(84);
    authStub.getPlayerData.mockReturnValueOnce(replacement);
    relicHandlerStub.getPlayerPlunderCooldownRemaining.mockReturnValueOnce(4321);
    const deps = {
      io: { sockets: { sockets: new Map() } },
      getAuthenticatedUserId: () => authenticatedUserId,
      setAuthenticatedUserId,
      engine: { insertPlayerInHash: vi.fn() },
      handlers: { cleanupPlayer },
      state: {
        connectedPlayers,
        userSockets,
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      }
    };
    authHandlers.register(socket, deps);

    await socket.handlers.get('auth:token')({ token: 'new-token' });

    expect(cleanupPlayer).toHaveBeenCalledWith(socket, 42, deps);
    expect(userSockets.has(42)).toBe(false);
    expect(userSockets.get(84)).toBe(socket.id);
    expect(connectedPlayers.get(socket.id)?.id).toBe(84);
    expect(authenticatedUserId).toBe(84);
    expect(authStub.destroySession).toHaveBeenCalledWith('old-token');
    expect(replacement.plunderCooldownRemaining).toBe(4321);
    expect(socket.emit).toHaveBeenCalledWith('auth:success', {
      token: 'new-token',
      player: expect.objectContaining({
        id: 84,
        plunderCooldownRemaining: 4321
      })
    });
  });

  it('restores boost cooldown authority and includes its remaining snapshot', async () => {
    const now = Date.now();
    boostAuthority.setPlayerBoostAuthority(42, {
      boostEndAt: now + 1000,
      recoveryEndAt: now + 3000,
      cooldownEndAt: now + 9000
    });
    const socket = createSocket();
    const playerData = createAuthPlayerData();
    authStub.validateToken.mockReturnValueOnce(42);
    authStub.getPlayerData.mockReturnValueOnce(playerData);
    const connectedPlayers = new Map();
    const deps = {
      io: { sockets: { sockets: new Map() } },
      getAuthenticatedUserId: vi.fn(() => null),
      setAuthenticatedUserId: vi.fn(),
      engine: { insertPlayerInHash: vi.fn() },
      handlers: { cleanupPlayer: vi.fn() },
      state: {
        connectedPlayers,
        userSockets: new Map(),
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      }
    };
    authHandlers.register(socket, deps);

    await socket.handlers.get('auth:token')({ token: 'reconnect-token' });

    expect(connectedPlayers.get(socket.id)).toMatchObject({
      serverBoostEndAt: now + 1000,
      serverBoostRecoveryEndAt: now + 3000,
      serverBoostCooldownEndAt: now + 9000
    });
    expect(playerData).toMatchObject({
      boostRemaining: 1000,
      boostRecoveryRemaining: 3000,
      boostCooldownRemaining: 9000
    });
  });

  it('rejects missing token payloads without calling authentication code', async () => {
    const socket = createSocket();
    const deps = {
      getAuthenticatedUserId: vi.fn(() => null),
      setAuthenticatedUserId: vi.fn(),
      state: {
        connectedPlayers: new Map(),
        userSockets: new Map(),
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      },
      handlers: { cleanupPlayer: vi.fn() }
    };
    authHandlers.register(socket, deps);

    await socket.handlers.get('auth:token')();

    expect(authStub.validateToken).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth:error', {
      message: 'Invalid or expired session'
    });
  });

  it('catches asynchronous login failures at the socket boundary', async () => {
    const socket = createSocket();
    const deps = {
      getAuthenticatedUserId: vi.fn(() => null),
      setAuthenticatedUserId: vi.fn(),
      state: {
        connectedPlayers: new Map(),
        userSockets: new Map(),
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      },
      handlers: { cleanupPlayer: vi.fn() }
    };
    authStub.login.mockRejectedValueOnce(new Error('backend unavailable'));
    authHandlers.register(socket, deps);

    await socket.handlers.get('auth:login')({ username: 'pilot', password: 'secret' });

    expect(socket.emit).toHaveBeenCalledWith('auth:error', { message: 'Login failed' });
    expect(deps.setAuthenticatedUserId).not.toHaveBeenCalled();
  });

  it('revokes the active session on explicit logout', async () => {
    const socket = createSocket();
    socket.data = { authToken: 'session-token' };
    const deps = {
      getAuthenticatedUserId: vi.fn(() => 42),
      setAuthenticatedUserId: vi.fn(),
      state: {
        connectedPlayers: new Map(),
        userSockets: new Map(),
        joinSectorRooms: vi.fn(),
        broadcastToNearby: vi.fn()
      },
      handlers: { cleanupPlayer: vi.fn() }
    };
    authHandlers.register(socket, deps);

    await socket.handlers.get('auth:logout')();

    expect(authStub.destroySession).toHaveBeenCalledWith('session-token');
    expect(socket.data.authToken).toBeUndefined();
    expect(deps.setAuthenticatedUserId).toHaveBeenCalledWith(null);
  });
});

describe('authoritative combat socket input', () => {
  it('rejects combat actions while the player is dead', () => {
    const socket = createSocket();
    const player = createPlayer({ isDead: true });
    const deps = createCombatDeps(socket, player);
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: 0 });

    expect(deps.combat.fire).not.toHaveBeenCalled();
    expect(deps.npc.getNPCsInRange).not.toHaveBeenCalled();
  });

  it('validates fire direction before consuming cooldown or broadcasting', () => {
    const socket = createSocket();
    const player = createPlayer();
    const deps = createCombatDeps(socket, player);
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: NaN });

    expect(deps.combat.fire).not.toHaveBeenCalled();
    expect(deps.state.broadcastToNearby).not.toHaveBeenCalled();
  });

  it('rejects pathological finite angles before hit-detection normalization', () => {
    const socket = createSocket();
    const player = createPlayer();
    const deps = createCombatDeps(socket, player);
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: Number.MAX_VALUE });

    expect(deps.combat.fire).not.toHaveBeenCalled();
    expect(deps.npc.getNPCsInRange).not.toHaveBeenCalled();
  });

  it('passes weapon and energy-core tiers to the cooldown gate', () => {
    const socket = createSocket();
    const player = createPlayer({ weaponTier: 4, energyCoreTier: 5 });
    const deps = createCombatDeps(socket, player, {
      combat: { fire: vi.fn(() => ({ success: false, error: 'Weapon on cooldown' })) }
    });
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: 0 });

    expect(deps.combat.fire).toHaveBeenCalledWith(42, 4, 5);
    expect(deps.state.setPlayerStatus).not.toHaveBeenCalled();
    expect(deps.state.broadcastToNearby).not.toHaveBeenCalled();
    expect(deps.npc.getNPCsInRange).not.toHaveBeenCalled();
  });

  it('does not run base hit detection after an NPC hit', () => {
    const socket = createSocket();
    const player = createPlayer({ weaponTier: 4 });
    const target = {
      id: 'npc-1',
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 }
    };
    const deps = createCombatDeps(socket, player, {
      npc: {
        getNPCsInRange: vi.fn(() => [target]),
        getBasesInRange: vi.fn(() => [{ id: 'base-1', x: 100, y: 0 }])
      },
      engine: {
        playerAttackNPC: vi.fn(() => ({ destroyed: false })),
        playerAttackBase: vi.fn(() => ({ destroyed: false }))
      }
    });
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: 0 });

    expect(deps.engine.playerAttackNPC).toHaveBeenCalledOnce();
    expect(deps.npc.getBasesInRange).not.toHaveBeenCalled();
    expect(deps.engine.playerAttackBase).not.toHaveBeenCalled();
  });

  it('uses canonical moving-NPC velocity for prediction and returns impact coordinates', () => {
    const socket = createSocket();
    const player = createPlayer({ weaponTier: 4 });
    const target = {
      id: 'npc-moving',
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 800 }
    };
    const deps = createCombatDeps(socket, player, {
      npc: {
        getNPCsInRange: vi.fn(() => [target]),
        getBasesInRange: vi.fn(() => [])
      },
      engine: {
        playerAttackNPC: vi.fn(() => ({ destroyed: false }))
      }
    });
    combatHandlers.register(socket, deps);

    // 100 units at the configured 800 u/s projectile speed predicts (100,100).
    socket.handlers.get('combat:fire')({ direction: Math.PI / 4 });

    expect(deps.engine.playerAttackNPC).toHaveBeenCalledWith(
      42,
      'npc-moving',
      'energy',
      4
    );
    expect(socket.emit).toHaveBeenCalledWith('combat:npcHit', expect.objectContaining({
      npcId: 'npc-moving',
      x: 100,
      y: 100
    }));
  });

  it('checks bases when no NPC is hit', () => {
    const socket = createSocket();
    const player = createPlayer({ weaponTier: 4 });
    const base = { id: 'base-1', x: 100, y: 0, size: 50, name: 'Test Base', faction: 'pirate' };
    const deps = createCombatDeps(socket, player, {
      npc: {
        getNPCsInRange: vi.fn(() => []),
        getBasesInRange: vi.fn(() => [base])
      },
      engine: {
        playerAttackBase: vi.fn(() => ({
          destroyed: false,
          health: 90,
          maxHealth: 100
        }))
      }
    });
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: 0 });

    expect(deps.npc.getBasesInRange).toHaveBeenCalledOnce();
    expect(deps.engine.playerAttackBase).toHaveBeenCalledWith(42, 'base-1', 'energy', 4);
  });

  it('awards every validated base contributor without exceeding the declared pool', () => {
    const socket = createSocket();
    const player = createPlayer({ weaponTier: 4 });
    const base = { id: 'base-1', x: 100, y: 0, size: 50, name: 'Test Base', faction: 'pirate' };
    const targetEmit = vi.fn();
    const updateCredits = vi.fn();
    const getShip = vi.fn(playerId => ({ credits: playerId === 42 ? 100 : 200 }));
    const deps = createCombatDeps(socket, player, {
      io: {
        emit: vi.fn(),
        to: vi.fn(() => ({ emit: targetEmit }))
      },
      npc: {
        getNPCsInRange: vi.fn(() => []),
        getBasesInRange: vi.fn(() => [base])
      },
      engine: {
        playerAttackBase: vi.fn(() => ({
          destroyed: true,
          participants: ['42', 7, 'invalid', 7],
          participantCount: 2,
          totalCredits: 149,
          creditsPerPlayer: 75,
          teamMultiplier: 1.5
        }))
      },
      statements: {
        getShipByUserId: { get: getShip },
        getInventory: { all: vi.fn(() => []) }
      },
      getSafeCredits: vi.fn(ship => ship?.credits || 0),
      safeUpdateCredits: updateCredits,
      state: {
        userSockets: new Map([[42, 'socket-1'], [7, 'socket-7']])
      }
    });
    combatHandlers.register(socket, deps);

    socket.handlers.get('combat:fire')({ direction: 0 });

    expect(updateCredits).toHaveBeenCalledTimes(2);
    expect(updateCredits).toHaveBeenCalledWith(175, 42);
    expect(updateCredits).toHaveBeenCalledWith(274, 7);
    expect(deps.io.to).toHaveBeenCalledWith('socket-1');
    expect(deps.io.to).toHaveBeenCalledWith('socket-7');
    expect(targetEmit).toHaveBeenCalledWith('base:reward', expect.objectContaining({
      credits: 75,
      participantCount: 2
    }));
  });

  it('never allocates more base credits than the declared reward pool', () => {
    const rewards = combatHandlers.allocateBaseCreditPool([42, 7, 9], 100, 75);

    expect([...rewards.values()]).toEqual([34, 33, 33]);
    expect([...rewards.values()].reduce((total, reward) => total + reward, 0)).toBe(100);
  });
});
