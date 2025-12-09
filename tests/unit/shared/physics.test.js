/**
 * Unit tests for shared/physics.js
 * Tests physics calculations used for deterministic position computation
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Set up mock CONSTANTS before requiring physics
const { MOCK_CONSTANTS } = require('../../setup');
globalThis.CONSTANTS = MOCK_CONSTANTS;

const Physics = require('../../../shared/physics');

describe('shared/physics', () => {
  describe('getPhysicsTime', () => {
    it('should return a positive number', () => {
      const time = Physics.getPhysicsTime();
      expect(time).toBeGreaterThan(0);
    });

    it('should increase over time', async () => {
      const time1 = Physics.getPhysicsTime();
      await new Promise(resolve => setTimeout(resolve, 10));
      const time2 = Physics.getPhysicsTime();
      expect(time2).toBeGreaterThan(time1);
    });
  });

  describe('getOrbitTime', () => {
    it('should be an alias for getPhysicsTime', () => {
      // Both should return the same value (within a small margin due to execution time)
      const physicsTime = Physics.getPhysicsTime();
      const orbitTime = Physics.getOrbitTime();
      expect(Math.abs(orbitTime - physicsTime)).toBeLessThan(10);
    });
  });

  describe('distance', () => {
    it('should calculate distance correctly', () => {
      expect(Physics.distance(0, 0, 3, 4)).toBe(5);
    });

    it('should return 0 for same point', () => {
      expect(Physics.distance(5, 5, 5, 5)).toBe(0);
    });
  });

  describe('computePlanetPosition', () => {
    it('should return planet at correct orbital position', () => {
      const planet = {
        orbitAngle: 0,
        orbitSpeed: Math.PI, // Half circle per second
        orbitRadius: 100
      };
      const star = { x: 500, y: 500 };

      // At time 0
      const pos0 = Physics.computePlanetPosition(planet, star, 0);
      expect(pos0.x).toBeCloseTo(600); // star.x + radius * cos(0)
      expect(pos0.y).toBeCloseTo(500); // star.y + radius * sin(0)

      // At time 1000ms (1 second) - should be at opposite side (half orbit)
      const pos1 = Physics.computePlanetPosition(planet, star, 1000);
      expect(pos1.x).toBeCloseTo(400); // star.x + radius * cos(PI)
      expect(pos1.y).toBeCloseTo(500, 0); // star.y + radius * sin(PI) ≈ 500
    });

    it('should handle different orbit speeds', () => {
      const slowPlanet = { orbitAngle: 0, orbitSpeed: 0.1, orbitRadius: 100 };
      const fastPlanet = { orbitAngle: 0, orbitSpeed: 1.0, orbitRadius: 100 };
      const star = { x: 0, y: 0 };

      const slowPos = Physics.computePlanetPosition(slowPlanet, star, 10000);
      const fastPos = Physics.computePlanetPosition(fastPlanet, star, 10000);

      // Fast planet should have traveled further
      expect(slowPos).not.toEqual(fastPos);
    });
  });

  describe('computeBeltAsteroidPosition', () => {
    it('should compute belt asteroid position with angle', () => {
      const asteroid = {
        orbitAngle: 0,
        orbitSpeed: 0.5,
        orbitRadius: 200
      };
      const star = { x: 1000, y: 1000 };

      const pos = Physics.computeBeltAsteroidPosition(asteroid, star, 0);
      expect(pos.x).toBeCloseTo(1200);
      expect(pos.y).toBeCloseTo(1000);
      expect(pos.angle).toBe(0);
    });

    it('should include angle in result', () => {
      const asteroid = {
        orbitAngle: Math.PI / 2,
        orbitSpeed: 0,
        orbitRadius: 100
      };
      const star = { x: 0, y: 0 };

      const pos = Physics.computeBeltAsteroidPosition(asteroid, star, 0);
      expect(pos.angle).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('computeBinaryStarPositions', () => {
    it('should return primary position for non-binary system', () => {
      const system = {
        primaryStar: { x: 100, y: 200 },
        binaryInfo: null
      };

      const positions = Physics.computeBinaryStarPositions(system, 0);
      expect(positions.primary.x).toBe(100);
      expect(positions.primary.y).toBe(200);
      expect(positions.secondary).toBeNull();
    });

    it('should compute both star positions for binary system', () => {
      const system = {
        primaryStar: { x: 100, y: 100 },
        binaryInfo: {
          baryCenter: { x: 500, y: 500 },
          primaryOrbitRadius: 100,
          secondaryOrbitRadius: 150,
          orbitPhase: 0,
          orbitPeriod: 100,
          eccentricity: 0
        }
      };

      const positions = Physics.computeBinaryStarPositions(system, 0);
      expect(positions.primary).toBeDefined();
      expect(positions.secondary).toBeDefined();
      expect(positions.primary).not.toEqual(positions.secondary);
    });

    it('should orbit stars around barycenter', () => {
      const system = {
        primaryStar: { x: 100, y: 100 },
        binaryInfo: {
          baryCenter: { x: 500, y: 500 },
          primaryOrbitRadius: 100,
          secondaryOrbitRadius: 100,
          orbitPhase: 0,
          orbitPeriod: 10, // Fast orbit
          eccentricity: 0
        }
      };

      const pos1 = Physics.computeBinaryStarPositions(system, 0);
      const pos2 = Physics.computeBinaryStarPositions(system, 5000); // Half period

      // After half period, stars should be on opposite sides
      expect(pos1.primary.x).not.toBeCloseTo(pos2.primary.x);
    });
  });

  describe('computeStarGravity', () => {
    it('should return no gravity when outside influence radius', () => {
      const star = { x: 0, y: 0, size: 100 };

      const result = Physics.computeStarGravity(1000, 1000, star, 1, 1);
      expect(result.inGravity).toBe(false);
      expect(result.fx).toBe(0);
      expect(result.fy).toBe(0);
    });

    it('should return gravity force when inside influence radius', () => {
      const star = { x: 0, y: 0, size: 100 };

      // Position within influence radius (3x star size = 300)
      const result = Physics.computeStarGravity(200, 0, star, 1, 1);
      expect(result.inGravity).toBe(true);
      expect(result.fx).toBeLessThan(0); // Force toward star (negative X)
      expect(result.fy).toBe(0);
    });

    it('should reduce gravity with higher engine tier', () => {
      const star = { x: 0, y: 0, size: 100 };

      const tier1 = Physics.computeStarGravity(200, 0, star, 1, 1);
      const tier5 = Physics.computeStarGravity(200, 0, star, 5, 1);

      expect(Math.abs(tier5.fx)).toBeLessThan(Math.abs(tier1.fx));
    });
  });

  describe('getStarZone', () => {
    it('should return surface zone when very close', () => {
      const star = { x: 0, y: 0, size: 100 };

      const result = Physics.getStarZone(50, 0, star); // 50% of star size
      expect(result.zone).toBe('surface');
    });

    it('should return hot zone at star size', () => {
      const star = { x: 0, y: 0, size: 100 };

      const result = Physics.getStarZone(80, 0, star); // 80% of star size
      expect(result.zone).toBe('hot');
    });

    it('should return warm zone slightly outside star', () => {
      const star = { x: 0, y: 0, size: 100 };

      const result = Physics.getStarZone(120, 0, star); // 120% of star size
      expect(result.zone).toBe('warm');
    });

    it('should return corona zone in outer region', () => {
      const star = { x: 0, y: 0, size: 100 };

      const result = Physics.getStarZone(140, 0, star); // 140% of star size
      expect(result.zone).toBe('corona');
    });

    it('should return null zone when far from star', () => {
      const star = { x: 0, y: 0, size: 100 };

      const result = Physics.getStarZone(200, 0, star); // 200% of star size
      expect(result.zone).toBeNull();
    });
  });

  describe('getZoneDamage', () => {
    it('should return no damage for corona zone', () => {
      const damage = Physics.getZoneDamage('corona', 1.4);
      expect(damage.shieldDrain).toBe(0);
      expect(damage.hullDamage).toBe(0);
    });

    it('should return shield drain for warm zone', () => {
      const damage = Physics.getZoneDamage('warm', 1.2);
      expect(damage.shieldDrain).toBeGreaterThan(0);
      expect(damage.hullDamage).toBe(0);
    });

    it('should return both damage types for hot zone', () => {
      const damage = Physics.getZoneDamage('hot', 0.9);
      expect(damage.shieldDrain).toBeGreaterThan(0);
      expect(damage.hullDamage).toBeGreaterThan(0);
    });

    it('should return extreme damage for surface zone', () => {
      const damage = Physics.getZoneDamage('surface', 0.5);
      expect(damage.shieldDrain).toBe(999);
      expect(damage.hullDamage).toBeGreaterThan(0);
    });
  });

  describe('computeAsteroidPosition', () => {
    it('should return initial position at time 0', () => {
      const pos = Physics.computeAsteroidPosition(
        {
          initialX: 100,
          initialY: 100,
          initialVx: 10,
          initialVy: 0,
          sectorBounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
        },
        [],
        0
      );
      expect(pos.x).toBeCloseTo(100);
      expect(pos.y).toBeCloseTo(100);
    });

    it('should move asteroid over time', () => {
      const asteroid = {
        initialX: 100,
        initialY: 100,
        initialVx: 100, // 100 units per second
        initialVy: 0,
        sectorBounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
      };

      const pos1 = Physics.computeAsteroidPosition(asteroid, [], 1000); // 1 second
      expect(pos1.x).toBeCloseTo(200);
    });

    it('should bounce at boundaries', () => {
      const asteroid = {
        initialX: 900,
        initialY: 500,
        initialVx: 100,
        initialVy: 0,
        sectorBounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
      };

      // After enough time, should bounce back
      const pos = Physics.computeAsteroidPosition(asteroid, [], 5000);
      // The asteroid should be somewhere in bounds
      expect(pos.x).toBeGreaterThanOrEqual(30); // MARGIN
      expect(pos.x).toBeLessThanOrEqual(970); // 1000 - MARGIN
    });

    it('should return fallback for missing asteroid data', () => {
      const pos = Physics.computeAsteroidPosition(null, [], 0);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });

  describe('computeCometPosition', () => {
    it('should return not visible when comet is inactive', () => {
      const comet = {
        entryPoint: { x: 0, y: 0 },
        perihelion: { x: 500, y: 500 },
        exitPoint: { x: 1000, y: 0 },
        orbitPeriod: 100000,
        warningTime: 10000,
        traversalTime: 30000,
        phaseOffset: 0
      };

      // Way past active period
      const result = Physics.computeCometPosition(comet, 50000);
      expect(result.visible).toBe(false);
    });

    it('should return warning state before traversal', () => {
      const comet = {
        entryPoint: { x: 0, y: 0 },
        perihelion: { x: 500, y: 500 },
        exitPoint: { x: 1000, y: 0 },
        orbitPeriod: 100000,
        warningTime: 10000,
        traversalTime: 30000,
        phaseOffset: 0
      };

      const result = Physics.computeCometPosition(comet, 5000); // During warning
      expect(result.isWarning).toBe(true);
      expect(result.visible).toBe(false);
    });

    it('should return visible and position during traversal', () => {
      const comet = {
        entryPoint: { x: 0, y: 0 },
        perihelion: { x: 500, y: 500 },
        exitPoint: { x: 1000, y: 0 },
        orbitPeriod: 100000,
        warningTime: 10000,
        traversalTime: 30000,
        phaseOffset: 0
      };

      const result = Physics.computeCometPosition(comet, 25000); // Mid-traversal
      expect(result.visible).toBe(true);
      expect(result.isWarning).toBe(false);
      expect(result.progress).toBeGreaterThan(0);
      expect(result.progress).toBeLessThan(1);
    });

    it('should follow Bezier curve during traversal', () => {
      const comet = {
        entryPoint: { x: 0, y: 0 },
        perihelion: { x: 500, y: 500 },
        exitPoint: { x: 1000, y: 0 },
        orbitPeriod: 100000,
        warningTime: 10000,
        traversalTime: 30000,
        phaseOffset: 0
      };

      // At start of traversal
      const start = Physics.computeCometPosition(comet, 10000);
      expect(start.x).toBeCloseTo(0);
      expect(start.y).toBeCloseTo(0);

      // At end of traversal
      const end = Physics.computeCometPosition(comet, 40000);
      expect(end.x).toBeCloseTo(1000);
      expect(end.y).toBeCloseTo(0);
    });

    it('should handle missing comet data', () => {
      const result = Physics.computeCometPosition(null, 0);
      expect(result.visible).toBe(false);
    });
  });

  describe('clearCheckpointCache', () => {
    it('should be a no-op (analytical solution)', () => {
      // This function exists for API compatibility but does nothing
      expect(() => Physics.clearCheckpointCache()).not.toThrow();
    });
  });
});
