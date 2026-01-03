/**
 * Unit tests for shared/graveyard.js
 * Tests graveyard zone and swarm exclusion zone utilities
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const {
  isGraveyardSector,
  isInGraveyard,
  isInSwarmExclusionZone,
  isInSwarmExclusionWorld
} = require('../../../shared/graveyard');

describe('shared/graveyard', () => {
  // Mock config matching real CONSTANTS structure
  const mockConfig = {
    SECTOR_SIZE: 1000,
    GRAVEYARD_ZONE: {
      MIN_SECTOR_X: -1,
      MAX_SECTOR_X: 1,
      MIN_SECTOR_Y: -1,
      MAX_SECTOR_Y: 1
    },
    SWARM_EXCLUSION_ZONE: {
      MIN_SECTOR_DISTANCE: 10
    }
  };

  describe('isGraveyardSector', () => {
    it('should return true for sectors within graveyard zone', () => {
      expect(isGraveyardSector(0, 0, mockConfig)).toBe(true);
      expect(isGraveyardSector(-1, -1, mockConfig)).toBe(true);
      expect(isGraveyardSector(1, 1, mockConfig)).toBe(true);
    });

    it('should return false for sectors outside graveyard zone', () => {
      expect(isGraveyardSector(2, 0, mockConfig)).toBe(false);
      expect(isGraveyardSector(0, 2, mockConfig)).toBe(false);
      expect(isGraveyardSector(-2, 0, mockConfig)).toBe(false);
    });

    it('should return false if config is missing', () => {
      expect(isGraveyardSector(0, 0, null)).toBe(false);
      expect(isGraveyardSector(0, 0, {})).toBe(false);
    });
  });

  describe('isInGraveyard', () => {
    it('should return true for world coordinates in graveyard', () => {
      expect(isInGraveyard(500, 500, mockConfig)).toBe(true);
      expect(isInGraveyard(-500, -500, mockConfig)).toBe(true);
    });

    it('should return false for world coordinates outside graveyard', () => {
      expect(isInGraveyard(2500, 500, mockConfig)).toBe(false);
      expect(isInGraveyard(500, 2500, mockConfig)).toBe(false);
    });

    it('should use default sector size if not provided', () => {
      const configNoSectorSize = { GRAVEYARD_ZONE: mockConfig.GRAVEYARD_ZONE };
      expect(isInGraveyard(500, 500, configNoSectorSize)).toBe(true);
    });
  });

  describe('isInSwarmExclusionZone', () => {
    it('should return true for sectors within exclusion distance of origin', () => {
      // Chebyshev distance < 10 means in exclusion zone
      expect(isInSwarmExclusionZone(0, 0, mockConfig)).toBe(true);
      expect(isInSwarmExclusionZone(5, 5, mockConfig)).toBe(true);
      expect(isInSwarmExclusionZone(9, 0, mockConfig)).toBe(true);
      expect(isInSwarmExclusionZone(0, 9, mockConfig)).toBe(true);
      expect(isInSwarmExclusionZone(-9, -9, mockConfig)).toBe(true);
    });

    it('should return false for sectors at or beyond exclusion distance', () => {
      // Chebyshev distance >= 10 means outside exclusion zone
      expect(isInSwarmExclusionZone(10, 0, mockConfig)).toBe(false);
      expect(isInSwarmExclusionZone(0, 10, mockConfig)).toBe(false);
      expect(isInSwarmExclusionZone(10, 10, mockConfig)).toBe(false);
      expect(isInSwarmExclusionZone(-10, -10, mockConfig)).toBe(false);
      expect(isInSwarmExclusionZone(15, 5, mockConfig)).toBe(false);
    });

    it('should return false if config is missing', () => {
      expect(isInSwarmExclusionZone(0, 0, null)).toBe(false);
      expect(isInSwarmExclusionZone(0, 0, {})).toBe(false);
    });

    it('should use default distance if not specified', () => {
      const configNoDistance = { SWARM_EXCLUSION_ZONE: {} };
      expect(isInSwarmExclusionZone(9, 9, configNoDistance)).toBe(true);
      expect(isInSwarmExclusionZone(10, 10, configNoDistance)).toBe(false);
    });
  });

  describe('isInSwarmExclusionWorld', () => {
    it('should return true for world coordinates in exclusion zone', () => {
      // Sector 0,0 (coords 0-999) is in exclusion zone
      expect(isInSwarmExclusionWorld(500, 500, mockConfig)).toBe(true);
      // Sector 5,5 (coords 5000-5999) is in exclusion zone
      expect(isInSwarmExclusionWorld(5500, 5500, mockConfig)).toBe(true);
    });

    it('should return false for world coordinates outside exclusion zone', () => {
      // Sector 10,0 (coords 10000+) is outside exclusion zone
      expect(isInSwarmExclusionWorld(10500, 500, mockConfig)).toBe(false);
      // Sector 15,15 is outside exclusion zone
      expect(isInSwarmExclusionWorld(15500, 15500, mockConfig)).toBe(false);
    });

    it('should handle negative coordinates', () => {
      // Sector -5,-5 is in exclusion zone
      expect(isInSwarmExclusionWorld(-5500, -5500, mockConfig)).toBe(true);
      // Sector -10,-10 is outside exclusion zone
      expect(isInSwarmExclusionWorld(-10500, -10500, mockConfig)).toBe(false);
    });

    it('should use default sector size if not provided', () => {
      const configNoSectorSize = { SWARM_EXCLUSION_ZONE: mockConfig.SWARM_EXCLUSION_ZONE };
      expect(isInSwarmExclusionWorld(500, 500, configNoSectorSize)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle boundary between exclusion and non-exclusion', () => {
      // Sector 9 is in (chebyshev dist = 9 < 10)
      expect(isInSwarmExclusionZone(9, 0, mockConfig)).toBe(true);
      // Sector 10 is out (chebyshev dist = 10 >= 10)
      expect(isInSwarmExclusionZone(10, 0, mockConfig)).toBe(false);
    });

    it('should use Chebyshev distance (max of abs values)', () => {
      // (5, 9) has chebyshev dist = 9 (in)
      expect(isInSwarmExclusionZone(5, 9, mockConfig)).toBe(true);
      // (5, 10) has chebyshev dist = 10 (out)
      expect(isInSwarmExclusionZone(5, 10, mockConfig)).toBe(false);
      // (10, 5) has chebyshev dist = 10 (out)
      expect(isInSwarmExclusionZone(10, 5, mockConfig)).toBe(false);
    });
  });
});
