import { describe, it, expect } from 'vitest';
import PirateStrategy from '../../../server/game/ai/pirate.js';

describe('Pirate economy interactions', () => {
  it('consumes mining-claim credits through the authoritative base hook', () => {
    const strategy = new PirateStrategy();
    const pirate = { id: 'pirate_1', type: 'pirate_fighter', position: { x: 0, y: 0 } };
    let authoritativeCredits = 100;
    const baseView = {
      id: 'claim_1',
      claimCredits: authoritativeCredits,
      consumeClaimCredits(amount) {
        const consumed = Math.min(authoritativeCredits, amount);
        authoritativeCredits -= consumed;
        this.claimCredits = authoritativeCredits;
        return consumed;
      }
    };

    const result = strategy.stealFromMiningClaim(pirate, baseView);

    expect(result).toMatchObject({
      action: 'pirate:steal',
      targetType: 'rogue_credits',
      targetBaseId: 'claim_1',
      stolenAmount: 15
    });
    expect(authoritativeCredits).toBe(85);
    expect(baseView.claimCredits).toBe(85);
  });

  it('recognizes the scavenger scrap-pile object as a valuable scout target', () => {
    const strategy = new PirateStrategy();
    const npc = {
      position: { x: 0, y: 0 },
      aggroRange: 500
    };
    const base = {
      id: 'yard_1',
      type: 'scavenger_yard',
      x: 100,
      y: 0,
      scrapPile: { count: 2, contents: [] }
    };

    const targets = strategy.findScoutTargets(npc, [], [], { nearbyBases: [base] });

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'yard_1', hasResources: true, priority: 2 })
    ]));
  });
});
