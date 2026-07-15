/**
 * Unit tests for shared/star-system.js
 * Tests star system generation, specifically base properties
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const StarSystem = require('../../../shared/star-system');
const Physics = require('../../../shared/physics');

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

  describe('authoritative object positions', () => {
    it('generates finite planet snapshots and resolves their fixed-time orbit', () => {
      const system = StarSystem.generateSuperSector(0, 0)[0];
      const planet = system.planets[0];
      const time = 123456;

      expect(planet).toBeDefined();
      expect(Number.isFinite(planet.x)).toBe(true);
      expect(Number.isFinite(planet.y)).toBe(true);

      const starPosition = StarSystem.getStarPosition(system, planet.starId, time);
      const expected = Physics.computePlanetPosition(planet, starPosition, time);
      const actual = StarSystem.resolveObjectPosition(system, planet, time);

      expect(actual.x).toBeCloseTo(expected.x, 10);
      expect(actual.y).toBeCloseTo(expected.y, 10);
    });

    it('uses explicit primary and secondary roles with shared binary physics', () => {
      const system = {
        id: 'ss_3_-2_1',
        primaryStar: { id: 'ss_3_-2_1_star', x: 100, y: 200 },
        binaryInfo: {
          secondaryStar: { id: 'ss_3_-2_1_star_b', x: -100, y: 200 },
          baryCenter: { x: 100, y: 200 },
          eccentricity: 0.35,
          orbitPeriod: 180,
          orbitPhase: 0.75,
          primaryOrbitRadius: 120,
          secondaryOrbitRadius: 280
        },
        planets: [],
        bases: [],
        miningClaimObjects: [],
        wormholes: [],
        comets: []
      };
      const time = 654321;
      const expected = Physics.computeBinaryStarPositions(system, time);

      expect(StarSystem.getSystemIdFromObjectId('ss_3_-2_1_planet_0')).toBe(system.id);
      expect(StarSystem.getStarRole(system, system.primaryStar.id)).toBe('primary');
      expect(StarSystem.getStarRole(system, system.binaryInfo.secondaryStar.id)).toBe('secondary');
      expect(StarSystem.resolveObjectPosition(system, system.primaryStar, time)).toEqual(expected.primary);
      expect(StarSystem.resolveObjectPosition(system, system.binaryInfo.secondaryStar, time)).toEqual(expected.secondary);
    });

    it('selects comet definitions by deterministic Bezier bounds', () => {
      const comet = {
        id: 'ss_0_0_0_comet_0',
        size: 20,
        tailLengthFactor: 2,
        entryPoint: { x: 100, y: 100 },
        perihelion: { x: 900, y: 900 },
        exitPoint: { x: 1500, y: 100 }
      };
      const system = { comets: [comet] };

      expect(StarSystem.getCometsForSector(system, 0, 0)).toEqual([comet]);
      expect(StarSystem.getCometsForSector(system, 1, 0)).toEqual([comet]);
      expect(StarSystem.getCometsForSector(system, 4, 4)).toEqual([]);
    });
  });
});
