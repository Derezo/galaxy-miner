// Galaxy Miner - Graveyard Zone Utilities
// Shared by both server and client

/**
 * Check if sector coordinates are within The Graveyard safe zone
 * The Graveyard is a 3x3 grid of sectors centered on origin
 * @param {number} sectorX - Sector X coordinate
 * @param {number} sectorY - Sector Y coordinate
 * @param {Object} config - Config object with GRAVEYARD_ZONE
 * @returns {boolean} True if in Graveyard zone
 */
function isGraveyardSector(sectorX, sectorY, config) {
  const zone = config?.GRAVEYARD_ZONE;
  if (!zone) return false;

  return sectorX >= zone.MIN_SECTOR_X && sectorX <= zone.MAX_SECTOR_X &&
         sectorY >= zone.MIN_SECTOR_Y && sectorY <= zone.MAX_SECTOR_Y;
}

/**
 * Check if world coordinates are within The Graveyard safe zone
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {Object} config - Config object with GRAVEYARD_ZONE and SECTOR_SIZE
 * @returns {boolean} True if in Graveyard zone
 */
function isInGraveyard(x, y, config) {
  const sectorSize = config?.SECTOR_SIZE || 1000;
  const sectorX = Math.floor(x / sectorSize);
  const sectorY = Math.floor(y / sectorSize);

  return isGraveyardSector(sectorX, sectorY, config);
}

/**
 * Check if sector coordinates are within the Swarm exclusion zone (too close to origin)
 * Uses Chebyshev distance: max(|sectorX|, |sectorY|)
 * @param {number} sectorX - Sector X coordinate
 * @param {number} sectorY - Sector Y coordinate
 * @param {Object} config - Config object with SWARM_EXCLUSION_ZONE
 * @returns {boolean} True if in exclusion zone (swarm should NOT spawn here)
 */
function isInSwarmExclusionZone(sectorX, sectorY, config) {
  const zone = config?.SWARM_EXCLUSION_ZONE;
  if (!zone) return false;

  const minDist = zone.MIN_SECTOR_DISTANCE || 10;
  const chebyshevDist = Math.max(Math.abs(sectorX), Math.abs(sectorY));

  return chebyshevDist < minDist;
}

/**
 * Check if world coordinates are within the Swarm exclusion zone
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {Object} config - Config object with SWARM_EXCLUSION_ZONE and SECTOR_SIZE
 * @returns {boolean} True if in exclusion zone (swarm should NOT spawn here)
 */
function isInSwarmExclusionWorld(x, y, config) {
  const sectorSize = config?.SECTOR_SIZE || 1000;
  const sectorX = Math.floor(x / sectorSize);
  const sectorY = Math.floor(y / sectorSize);

  return isInSwarmExclusionZone(sectorX, sectorY, config);
}

module.exports = {
  isGraveyardSector,
  isInGraveyard,
  isInSwarmExclusionZone,
  isInSwarmExclusionWorld
};
