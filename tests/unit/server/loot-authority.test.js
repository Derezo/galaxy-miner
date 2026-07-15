import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loot = require('../../../server/game/loot.js');

function spawn(contents, options = {}) {
  return loot.spawnWreckage(
    { type: 'test_npc', name: 'Test Wreckage', creditReward: options.creditReward || 0 },
    { x: options.x || 0, y: options.y || 0 },
    contents,
    options.contributors || null,
    { source: options.source || 'npc' }
  );
}

describe('authoritative wreckage collection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    loot.activeWreckage.clear();
    loot.activeCollectionsByPlayer.clear();
  });

  afterEach(() => {
    loot.activeWreckage.clear();
    loot.activeCollectionsByPlayer.clear();
    vi.useRealTimers();
  });

  it('allows only one exclusive ordinary collection per player', () => {
    const first = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);
    const second = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);

    expect(loot.startCollection(first.id, 10)).toMatchObject({ success: true });
    expect(loot.startCollection(first.id, 10)).toEqual({
      error: 'You are already collecting wreckage'
    });
    expect(loot.startCollection(second.id, 10)).toEqual({
      error: 'You are already collecting wreckage'
    });
    expect(loot.startCollection(first.id, 20)).toEqual({
      error: 'Wreckage is already being collected'
    });
  });

  it('derives progress from server time and keeps rewards until settlement', () => {
    const wreckage = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 2 }]);
    const start = loot.startCollection(wreckage.id, 10);

    // A forged delta is ignored.
    expect(loot.updateCollection(wreckage.id, 10, Number.MAX_SAFE_INTEGER)).toMatchObject({
      complete: false,
      progress: 0
    });

    vi.advanceTimersByTime(start.totalTime);
    expect(loot.updateCollection(wreckage.id, 10)).toMatchObject({ complete: true });
    expect(loot.getWreckage(wreckage.id)).toBe(wreckage);
    expect(wreckage.beingCollectedBy).toBe(10);

    expect(loot.finalizeCollection(wreckage.id, 10, {
      remainingContents: [],
      pendingCredits: []
    })).toMatchObject({ success: true, removed: true });
    expect(loot.getWreckage(wreckage.id)).toBeUndefined();
  });

  it('preserves cargo overflow and exact pending credit owners', () => {
    const wreckage = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 5 }]);
    const start = loot.startCollection(wreckage.id, 10);
    vi.advanceTimersByTime(start.totalTime);
    expect(loot.updateCollection(wreckage.id, 10).complete).toBe(true);

    const settlement = loot.finalizeCollection(wreckage.id, 10, {
      remainingContents: [{ type: 'resource', resourceType: 'IRON', quantity: 4 }],
      pendingCredits: [{ playerId: 20, credits: 75 }]
    });

    expect(settlement).toMatchObject({ success: true, removed: false, remaining: true });
    expect(loot.getWreckage(wreckage.id)).toMatchObject({
      beingCollectedBy: null,
      contents: [{ type: 'resource', resourceType: 'IRON', quantity: 4 }],
      pendingCredits: [{ playerId: 20, credits: 75 }]
    });
  });

  it('normalizes derelict credits from their contents', () => {
    const wreckage = spawn([{ type: 'credits', amount: 17.9 }], { source: 'derelict' });
    const start = loot.startCollection(wreckage.id, 10);
    expect(start.totalTime).toBe(3000);

    vi.advanceTimersByTime(start.totalTime);
    expect(loot.updateCollection(wreckage.id, 10)).toMatchObject({
      complete: true,
      creditReward: 17
    });
  });

  it('bounds Scrap Siphon and treats its speed as a relative duration', () => {
    const quick = spawn([{ type: 'credits', amount: 10 }]);
    const slow = spawn([{ type: 'relic', relicType: 'TEST_RELIC' }]);

    expect(loot.startMultiCollection([quick.id, slow.id], 10, {
      maxCount: 1,
      durationMultiplier: 0.5
    })).toEqual({ error: 'Invalid multi-collection request' });

    const start = loot.startMultiCollection([quick.id, slow.id], 10, {
      maxCount: 2,
      durationMultiplier: 0.5
    });
    expect(start).toMatchObject({ success: true, totalTime: 1250 });

    vi.advanceTimersByTime(500);
    expect(loot.updateCollection(quick.id, 10).complete).toBe(false);
    vi.advanceTimersByTime(750);
    expect(loot.updateCollection(quick.id, 10).complete).toBe(true);
    expect(loot.updateCollection(slow.id, 10).complete).toBe(true);
  });

  it('releases every player lock on disconnect and stale-lock cleanup', () => {
    const first = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);
    const second = spawn([{ type: 'resource', resourceType: 'IRON', quantity: 1 }]);
    loot.startMultiCollection([first.id, second.id], 10, {
      maxCount: 2,
      durationMultiplier: 1
    });

    expect(loot.cancelCollectionsForPlayer(10)).toBe(2);
    expect(first.beingCollectedBy).toBeNull();
    expect(second.beingCollectedBy).toBeNull();
    expect(loot.activeCollectionsByPlayer.has(10)).toBe(false);

    loot.startCollection(first.id, 10);
    vi.advanceTimersByTime(6500);
    loot.cleanupExpiredWreckage();
    expect(first.beingCollectedBy).toBeNull();
    expect(loot.activeCollectionsByPlayer.has(10)).toBe(false);
  });

  it('reports expired wreckage details when discarding them', () => {
    const wreckage = spawn(
      [{ type: 'resource', resourceType: 'IRON', quantity: 1 }],
      { x: 125, y: -75 }
    );
    wreckage.despawnTime = Date.now() - 1;
    const onExpired = vi.fn();

    expect(loot.cleanupExpiredWreckage(onExpired)).toEqual([wreckage.id]);
    expect(onExpired).toHaveBeenCalledWith(wreckage);
    expect(onExpired.mock.calls[0][0].position).toEqual({ x: 125, y: -75 });
    expect(loot.getWreckage(wreckage.id)).toBeUndefined();
  });
});
