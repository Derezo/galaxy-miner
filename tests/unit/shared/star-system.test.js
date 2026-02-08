/**
 * Unit tests for shared/star-system.js
 * Tests star system generation, specifically base properties
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const StarSystem = require('../../../shared/star-system');

describe('shared/star-system', () => {
  beforeEach(() => {
    // Clear the super-sector cache to ensure fresh generation
    StarSystem.superSectorCache.clear();
    StarSystem.cacheOrder.length = 0;
  });

  describe('generateBases', () => {
    it('should include starX and starY matching the parent star coordinates', () => {
      // Generate systems from a known super-sector and find one with bases
      // Try several super-sectors to find at least one system with bases
      let basesFound = false;

      for (let sx = 0; sx < 5 && !basesFound; sx++) {
        for (let sy = 0; sy < 5 && !basesFound; sy++) {
          const systems = StarSystem.generateSuperSector(sx, sy);
          for (const system of systems) {
            if (system.bases && system.bases.length > 0) {
              for (const base of system.bases) {
                // Every base must have starX and starY
                expect(base.starX).toBeDefined();
                expect(base.starY).toBeDefined();

                // starX/starY must match the primary star's position
                expect(base.starX).toBe(system.primaryStar.x);
                expect(base.starY).toBe(system.primaryStar.y);

                // starId should also be present
                expect(base.starId).toBe(system.primaryStar.id);
              }
              basesFound = true;
            }
          }
        }
      }

      // Ensure we actually tested something
      expect(basesFound).toBe(true);
    });

    it('should have starX/starY as numbers', () => {
      let basesFound = false;

      for (let sx = 0; sx < 5 && !basesFound; sx++) {
        for (let sy = 0; sy < 5 && !basesFound; sy++) {
          const systems = StarSystem.generateSuperSector(sx, sy);
          for (const system of systems) {
            if (system.bases && system.bases.length > 0) {
              for (const base of system.bases) {
                expect(typeof base.starX).toBe('number');
                expect(typeof base.starY).toBe('number');
                expect(Number.isFinite(base.starX)).toBe(true);
                expect(Number.isFinite(base.starY)).toBe(true);
              }
              basesFound = true;
            }
          }
        }
      }

      expect(basesFound).toBe(true);
    });
  });

  describe('getStarSystemById', () => {
    it('should return systems whose bases have starX/starY', () => {
      // Generate a known system
      const systems = StarSystem.generateSuperSector(0, 0);
      if (systems.length === 0) return; // skip if no systems generated

      const system = systems[0];
      const retrieved = StarSystem.getStarSystemById(system.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(system.id);

      // If this system has bases, they should have starX/starY
      if (retrieved.bases && retrieved.bases.length > 0) {
        for (const base of retrieved.bases) {
          expect(base.starX).toBe(retrieved.primaryStar.x);
          expect(base.starY).toBe(retrieved.primaryStar.y);
        }
      }
    });
  });
});
