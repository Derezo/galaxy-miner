/**
 * Tests for the Derelict System
 * Covers derelict generation, salvage mechanics, cooldowns, and loot
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import the real module - it uses actual config
import * as derelict from '../../../server/game/derelict.js';

describe('Derelict System', () => {
  beforeEach(() => {
    // Clear caches and cooldowns before each test
    derelict.salvageCooldowns.clear();
    derelict.derelictCache.clear();
  });

  describe('isGraveyardSector', () => {
    it('returns true for sectors within Graveyard bounds', () => {
      expect(derelict.isGraveyardSector(0, 0)).toBe(true);
      expect(derelict.isGraveyardSector(-1, -1)).toBe(true);
      expect(derelict.isGraveyardSector(1, 1)).toBe(true);
      expect(derelict.isGraveyardSector(-1, 1)).toBe(true);
      expect(derelict.isGraveyardSector(1, -1)).toBe(true);
    });

    it('returns false for sectors outside Graveyard bounds', () => {
      expect(derelict.isGraveyardSector(2, 0)).toBe(false);
      expect(derelict.isGraveyardSector(0, 2)).toBe(false);
      expect(derelict.isGraveyardSector(-2, 0)).toBe(false);
      expect(derelict.isGraveyardSector(0, -2)).toBe(false);
      expect(derelict.isGraveyardSector(5, 5)).toBe(false);
    });
  });

  describe('generateDerelictsForSector', () => {
    it('generates derelicts only in Graveyard sectors', () => {
      const graveyardDerelicts = derelict.generateDerelictsForSector(0, 0);
      expect(graveyardDerelicts.length).toBeGreaterThan(0);

      const outsideDerelicts = derelict.generateDerelictsForSector(5, 5);
      expect(outsideDerelicts.length).toBe(0);
    });

    it('generates 4-6 derelicts per Graveyard sector', () => {
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          derelict.derelictCache.clear();
          const derelicts = derelict.generateDerelictsForSector(x, y);
          expect(derelicts.length).toBeGreaterThanOrEqual(4);
          expect(derelicts.length).toBeLessThanOrEqual(6);
        }
      }
    });

    it('generates derelicts with correct properties', () => {
      const derelicts = derelict.generateDerelictsForSector(0, 0);

      for (const d of derelicts) {
        expect(d).toHaveProperty('id');
        expect(d).toHaveProperty('x');
        expect(d).toHaveProperty('y');
        expect(d).toHaveProperty('size');
        expect(d).toHaveProperty('rotation');
        expect(d).toHaveProperty('shipType');
        expect(d).toHaveProperty('orbitingDebrisCount');

        // Check size is within bounds (400-600)
        expect(d.size).toBeGreaterThanOrEqual(400);
        expect(d.size).toBeLessThanOrEqual(600);

        // Check ship type is 1-5
        expect(d.shipType).toBeGreaterThanOrEqual(1);
        expect(d.shipType).toBeLessThanOrEqual(5);

        // Check orbiting debris count (7-14, reduced for performance)
        expect(d.orbitingDebrisCount).toBeGreaterThanOrEqual(7);
        expect(d.orbitingDebrisCount).toBeLessThanOrEqual(14);
      }
    });

    it('generates deterministic derelicts (same seed = same result)', () => {
      const first = derelict.generateDerelictsForSector(0, 0);
      derelict.derelictCache.clear();
      const second = derelict.generateDerelictsForSector(0, 0);

      expect(first.length).toBe(second.length);
      for (let i = 0; i < first.length; i++) {
        expect(first[i].id).toBe(second[i].id);
        expect(first[i].x).toBeCloseTo(second[i].x, 5);
        expect(first[i].y).toBeCloseTo(second[i].y, 5);
        expect(first[i].size).toBeCloseTo(second[i].size, 5);
      }
    });

    it('generates derelicts within sector bounds', () => {
      const sectorX = 0;
      const sectorY = 0;
      const derelicts = derelict.generateDerelictsForSector(sectorX, sectorY);
      const sectorSize = 1000; // From shared/constants.js

      const sectorMinX = sectorX * sectorSize;
      const sectorMinY = sectorY * sectorSize;
      const sectorMaxX = sectorMinX + sectorSize;
      const sectorMaxY = sectorMinY + sectorSize;

      for (const d of derelicts) {
        expect(d.x).toBeGreaterThan(sectorMinX);
        expect(d.x).toBeLessThan(sectorMaxX);
        expect(d.y).toBeGreaterThan(sectorMinY);
        expect(d.y).toBeLessThan(sectorMaxY);
      }
    });

    it('caches generated derelicts', () => {
      const first = derelict.generateDerelictsForSector(0, 0);
      expect(derelict.derelictCache.has('0_0')).toBe(true);

      const second = derelict.generateDerelictsForSector(0, 0);
      expect(first).toBe(second); // Same reference from cache
    });
  });

  describe('getDerelictById', () => {
    it('returns derelict by valid ID', () => {
      const derelicts = derelict.generateDerelictsForSector(0, 0);
      const firstDerelict = derelicts[0];

      const found = derelict.getDerelictById(firstDerelict.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(firstDerelict.id);
    });

    it('returns null for invalid ID format', () => {
      expect(derelict.getDerelictById('invalid')).toBeNull();
      expect(derelict.getDerelictById('not_a_derelict_id')).toBeNull();
      expect(derelict.getDerelictById('')).toBeNull();
    });

    it('returns null for non-existent derelict', () => {
      // Sector (99, 99) is outside Graveyard, so no derelicts there
      expect(derelict.getDerelictById('derelict_99_99_0')).toBeNull();
    });
  });

  describe('getDerelictsInRange', () => {
    it('returns derelicts within specified range', () => {
      const nearby = derelict.getDerelictsInRange({ x: 500, y: 500 }, 2000);

      expect(nearby.length).toBeGreaterThan(0);
      for (const d of nearby) {
        expect(d.distance).toBeDefined();
        expect(d.distance).toBeLessThanOrEqual(2000);
      }
    });

    it('returns derelicts sorted by distance', () => {
      const nearby = derelict.getDerelictsInRange({ x: 500, y: 500 }, 2000);

      for (let i = 1; i < nearby.length; i++) {
        expect(nearby[i].distance).toBeGreaterThanOrEqual(nearby[i - 1].distance);
      }
    });

    it('includes cooldown status in results', () => {
      const nearby = derelict.getDerelictsInRange({ x: 500, y: 500 }, 2000);

      for (const d of nearby) {
        expect(d).toHaveProperty('onCooldown');
        expect(d).toHaveProperty('cooldownRemaining');
      }
    });

    it('returns empty array for position far from Graveyard', () => {
      const nearby = derelict.getDerelictsInRange({ x: 10000, y: 10000 }, 1000);
      expect(nearby.length).toBe(0);
    });
  });

  describe('Cooldown System', () => {
    it('tracks cooldowns correctly', () => {
      const derelictId = 'derelict_0_0_0';

      expect(derelict.isOnCooldown(derelictId)).toBe(false);
      expect(derelict.getCooldownRemaining(derelictId)).toBe(0);

      derelict.setSalvageCooldown(derelictId);

      expect(derelict.isOnCooldown(derelictId)).toBe(true);
      expect(derelict.getCooldownRemaining(derelictId)).toBeGreaterThan(0);
      expect(derelict.getCooldownRemaining(derelictId)).toBeLessThanOrEqual(30000);
    });

    it('clears expired cooldowns', () => {
      const derelictId = 'derelict_0_0_0';

      // Set a very short cooldown for testing (already expired)
      derelict.salvageCooldowns.set(derelictId, Date.now() - 1000);

      expect(derelict.isOnCooldown(derelictId)).toBe(false);
      expect(derelict.getCooldownRemaining(derelictId)).toBe(0);
    });

    it('cleanupExpiredCooldowns removes old entries', () => {
      derelict.salvageCooldowns.set('old1', Date.now() - 1000);
      derelict.salvageCooldowns.set('old2', Date.now() - 1000);
      derelict.salvageCooldowns.set('new1', Date.now() + 30000);

      derelict.cleanupExpiredCooldowns();

      expect(derelict.salvageCooldowns.has('old1')).toBe(false);
      expect(derelict.salvageCooldowns.has('old2')).toBe(false);
      expect(derelict.salvageCooldowns.has('new1')).toBe(true);
    });
  });

  describe('salvageDerelict', () => {
    it('fails for non-existent derelict', () => {
      const result = derelict.salvageDerelict('derelict_99_99_0', { x: 0, y: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Derelict not found');
    });

    it('fails when player is too far from derelict', () => {
      const derelicts = derelict.generateDerelictsForSector(0, 0);
      const d = derelicts[0];

      // Position player very far from derelict
      const result = derelict.salvageDerelict(d.id, { x: d.x + 5000, y: d.y + 5000 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Too far from derelict');
    });

    it('fails when derelict is on cooldown', () => {
      const derelicts = derelict.generateDerelictsForSector(0, 0);
      const d = derelicts[0];

      derelict.setSalvageCooldown(d.id);

      const result = derelict.salvageDerelict(d.id, { x: d.x, y: d.y });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Derelict on cooldown');
      expect(result.cooldownRemaining).toBeGreaterThan(0);
    });

    it('succeeds when in range and not on cooldown', () => {
      const derelicts = derelict.generateDerelictsForSector(0, 0);
      const d = derelicts[0];

      // Position player within range (accounting for derelict size)
      const playerPos = { x: d.x + d.size / 2 + 50, y: d.y };

      const result = derelict.salvageDerelict(d.id, playerPos);

      expect(result.success).toBe(true);
      expect(result.derelict).toBeDefined();
      expect(result.loot).toBeDefined();
      expect(result.wreckagePositions).toBeDefined();
      expect(result.wreckagePositions.length).toBeGreaterThanOrEqual(1);
      expect(result.wreckagePositions.length).toBeLessThanOrEqual(3);
    });

    it('sets cooldown after successful salvage', () => {
      const derelicts = derelict.generateDerelictsForSector(0, 0);
      const d = derelicts[0];

      const playerPos = { x: d.x, y: d.y };
      derelict.salvageDerelict(d.id, playerPos);

      expect(derelict.isOnCooldown(d.id)).toBe(true);
    });
  });

  describe('generateDerelictLoot', () => {
    it('generates loot array', () => {
      const loot = derelict.generateDerelictLoot();

      expect(Array.isArray(loot)).toBe(true);
    });

    it('generates valid loot items with correct structure', () => {
      // Run multiple times to account for random chance
      for (let i = 0; i < 20; i++) {
        const loot = derelict.generateDerelictLoot();

        for (const item of loot) {
          expect(item).toHaveProperty('type');

          if (item.type === 'resource') {
            expect(item).toHaveProperty('resourceType');
            expect(item).toHaveProperty('quantity');
            expect(item).toHaveProperty('rarity');
            expect(item.quantity).toBeGreaterThan(0);
          } else if (item.type === 'credits') {
            expect(item).toHaveProperty('amount');
            expect(item.amount).toBeGreaterThanOrEqual(10);
            expect(item.amount).toBeLessThanOrEqual(30);
          }
        }
      }
    });
  });

  describe('generateWreckagePositions', () => {
    it('generates 1-3 positions', () => {
      const d = { x: 500, y: 500 };

      for (let i = 0; i < 20; i++) {
        const positions = derelict.generateWreckagePositions(d);

        expect(positions.length).toBeGreaterThanOrEqual(1);
        expect(positions.length).toBeLessThanOrEqual(3);
      }
    });

    it('generates positions at correct distance from derelict', () => {
      const d = { x: 500, y: 500 };

      for (let i = 0; i < 20; i++) {
        const positions = derelict.generateWreckagePositions(d);

        for (const pos of positions) {
          const dx = pos.x - d.x;
          const dy = pos.y - d.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Wreckage spawns outside derelict hull (350-450 units from center)
          expect(distance).toBeGreaterThanOrEqual(350);
          expect(distance).toBeLessThanOrEqual(450);
        }
      }
    });
  });

  describe('Total Graveyard Derelict Count', () => {
    it('generates 36-54 total derelicts across the 9-sector Graveyard', () => {
      let totalDerelicts = 0;

      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          derelict.derelictCache.clear();
          const derelicts = derelict.generateDerelictsForSector(x, y);
          totalDerelicts += derelicts.length;
        }
      }

      // 9 sectors * 4-6 derelicts each = 36-54 total
      expect(totalDerelicts).toBeGreaterThanOrEqual(36);
      expect(totalDerelicts).toBeLessThanOrEqual(54);
    });
  });
});
