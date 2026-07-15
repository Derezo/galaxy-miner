import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { emitToRoomUnion } = require('../../../server/socket/room-broadcast.js');
const { createBroadcasts } = require('../../../server/socket/broadcasts.js');

describe('Socket.io room-union broadcasting', () => {
  it('emits once to a de-duplicated room union', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const socket = { to };
    const payload = { id: 'player-1' };

    expect(emitToRoomUnion(
      socket,
      ['sector:0:0', 'sector:0:1', 'sector:0:0'],
      'player:update',
      payload
    )).toBe(true);

    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(['sector:0:0', 'sector:0:1']);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('player:update', payload);
  });

  it('rejects empty rooms or malformed broadcasters without emitting', () => {
    const socket = { to: vi.fn() };

    expect(emitToRoomUnion(socket, [], 'event', {})).toBe(false);
    expect(emitToRoomUnion(null, ['sector:0:0'], 'event', {})).toBe(false);
    expect(socket.to).not.toHaveBeenCalled();
  });
});

describe('spatial effect broadcasting', () => {
  it('applies recipient radar range to chain-lightning effects', () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const players = new Map([
      ['near-low', { position: { x: 900, y: 0 }, radarTier: 1 }],
      ['far-low', { position: { x: 1500, y: 0 }, radarTier: 1 }],
      ['far-high', { position: { x: 3500, y: 0 }, radarTier: 5 }]
    ]);
    const broadcasts = createBroadcasts(io, players);

    broadcasts.broadcastChainLightning({ sourceX: 0, sourceY: 0, chains: [] });

    expect(io.to).toHaveBeenCalledWith('near-low');
    expect(io.to).not.toHaveBeenCalledWith('far-low');
    expect(io.to).toHaveBeenCalledWith('far-high');
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('broadcasts the Barnacle King drill telegraph with authoritative geometry', () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const players = new Map([
      ['target-socket', { position: { x: 20, y: 10 }, radarTier: 1 }]
    ]);
    const broadcasts = createBroadcasts(io, players);

    broadcasts.broadcastDrillCharge(
      { id: 'king-1', position: { x: 10, y: 10 }, size: 250 },
      { targetId: 7, chargeTime: 1500 }
    );

    expect(emit).toHaveBeenCalledWith('scavenger:drillCharge', {
      npcId: 'king-1',
      kingX: 10,
      kingY: 10,
      targetId: 7,
      chargeTime: 1500
    });
  });

  it('keeps Swarm sacrifice and progress payloads spatially self-contained', () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };
    const players = new Map([
      ['nearby', { position: { x: 110, y: 210 }, radarTier: 1 }]
    ]);
    const broadcasts = createBroadcasts(io, players);
    const position = { x: 100, y: 200 };

    broadcasts.broadcastDroneSacrifice({
      droneId: 'drone-1',
      baseId: 'base-1',
      position
    });
    broadcasts.broadcastAssimilationProgress({
      baseId: 'base-1',
      attachedCount: 2,
      threshold: 3,
      position,
      droneKilled: 'drone-2',
      killedBy: 7
    });

    expect(emit).toHaveBeenCalledWith('swarm:droneSacrifice', {
      droneId: 'drone-1',
      baseId: 'base-1',
      position,
      x: 100,
      y: 200
    });
    expect(emit).toHaveBeenCalledWith('swarm:assimilationProgress', {
      baseId: 'base-1',
      progress: 2,
      threshold: 3,
      position,
      droneKilled: 'drone-2',
      killedBy: 7
    });
  });
});
