import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loot = require('../../../server/game/loot.js');
const ScavengerStrategy = require('../../../server/game/ai/scavenger.js');

function addWreckage(id, overrides = {}) {
  const wreckage = {
    id,
    position: { x: 0, y: 0 },
    contents: [{ type: 'resource', resourceType: 'IRON', quantity: 1 }],
    source: 'npc',
    beingCollectedBy: null,
    pendingCredits: [],
    ...overrides
  };
  loot.activeWreckage.set(id, wreckage);
  return wreckage;
}

function createScavenger() {
  return {
    id: 'scavenger-1',
    type: 'scavenger_scrapper',
    faction: 'scavenger',
    position: { x: 0, y: 0 },
    speed: 100,
    state: 'idle'
  };
}

describe('scavenger wreckage ownership', () => {
  let strategy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    loot.activeWreckage.clear();
    loot.activeCollectionsByPlayer.clear();
    strategy = new ScavengerStrategy();
  });

  afterEach(() => {
    loot.activeWreckage.clear();
    loot.activeCollectionsByPlayer.clear();
    vi.useRealTimers();
  });

  it('does not target player-locked wreckage or owner-bound pending credits', () => {
    const npc = createScavenger();
    addWreckage('locked', { beingCollectedBy: 12 });
    addWreckage('pending', {
      position: { x: 10, y: 0 },
      pendingCredits: [{ playerId: 44, credits: 75 }]
    });

    expect(strategy.findNearestWreckage(npc)).toBeNull();
  });

  it.each([
    ['a player collection lock', { beingCollectedBy: 12 }],
    ['an owner-bound credit retry', { pendingCredits: [{ playerId: 44, credits: 75 }] }]
  ])('leaves wreckage intact when %s appears during scavenger collection', (_label, change) => {
    const npc = createScavenger();
    const wreckage = addWreckage('contested');

    strategy.startCollecting(npc, wreckage);
    Object.assign(wreckage, change);
    vi.advanceTimersByTime(strategy.COLLECT_DURATION);

    expect(strategy.updateCollecting(npc, 100, {})).toBeNull();
    expect(loot.getWreckage(wreckage.id)).toBe(wreckage);
    expect(npc.carriedWreckage || []).toHaveLength(0);
    expect(npc.state).toBe('idle');
  });
});
