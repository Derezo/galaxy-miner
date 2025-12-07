/**
 * Wormhole Transit System
 * Handles wormhole entry, destination selection, and transit for players with Wormhole Gem.
 */

const { statements } = require('../database');
const config = require('../config');
const World = require('../world');

// Transit state tracking
const activeTransits = new Map(); // playerId -> { phase, wormholeId, destinationId, startTime, etc }

// Constants
const TRANSIT_DURATION = 5000; // 5 seconds for transport animation
const WORMHOLE_RANGE = 100; // Must be within 100 units to enter
const SELECTION_TIMEOUT = 30000; // 30 seconds to choose destination before auto-cancel
const MAX_DESTINATIONS = 5; // Show 5 nearest wormholes

/**
 * Check if player has the Wormhole Gem relic
 * @param {number} playerId - Player's user ID
 * @returns {boolean}
 */
function hasWormholeGem(playerId) {
  const relic = statements.hasRelic.get(playerId, 'WORMHOLE_GEM');
  return !!relic;
}

/**
 * Find wormholes near a position, expanding search until we find enough
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} count - Number of wormholes to find
 * @returns {Array} Array of wormhole objects with distance
 */
function getNearestWormholes(x, y, count = MAX_DESTINATIONS) {
  const wormholes = [];
  const sectorSize = config.SECTOR_SIZE;
  const baseSectorX = Math.floor(x / sectorSize);
  const baseSectorY = Math.floor(y / sectorSize);

  // Expand search in rings until we find enough wormholes
  let searchRadius = 0;
  const maxSearchRadius = 20; // Don't search beyond 20 sectors in any direction

  while (wormholes.length < count && searchRadius <= maxSearchRadius) {
    // Search sectors at this radius
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        // Only process edge sectors (new ring) after first iteration
        if (searchRadius > 0 && Math.abs(dx) < searchRadius && Math.abs(dy) < searchRadius) {
          continue;
        }

        const sectorX = baseSectorX + dx;
        const sectorY = baseSectorY + dy;
        const sector = World.generateSector(sectorX, sectorY);

        for (const wormhole of sector.wormholes) {
          // Calculate distance
          const distX = wormhole.x - x;
          const distY = wormhole.y - y;
          const distance = Math.sqrt(distX * distX + distY * distY);

          // Check if already added (avoid duplicates from overlapping sector searches)
          if (!wormholes.find(w => w.id === wormhole.id)) {
            wormholes.push({
              id: wormhole.id,
              x: wormhole.x,
              y: wormhole.y,
              size: wormhole.size,
              sectorX,
              sectorY,
              destinationSector: wormhole.destinationSector,
              distance
            });
          }
        }
      }
    }

    searchRadius++;
  }

  // Sort by distance and return closest N
  wormholes.sort((a, b) => a.distance - b.distance);
  return wormholes.slice(0, count);
}

/**
 * Get a specific wormhole by ID
 * @param {string} wormholeId - Wormhole ID
 * @returns {Object|null} Wormhole object or null
 */
function getWormholeById(wormholeId) {
  return World.getObjectById(wormholeId);
}

/**
 * Check if player can enter a wormhole
 * @param {Object} player - Player object with position
 * @param {string} wormholeId - Wormhole ID
 * @returns {{success: boolean, error?: string, wormhole?: Object}}
 */
function canEnterWormhole(player, wormholeId) {
  // Check for Wormhole Gem
  if (!hasWormholeGem(player.id)) {
    return { success: false, error: 'You need the Wormhole Gem to enter wormholes.' };
  }

  // Check if already in transit
  if (activeTransits.has(player.id)) {
    return { success: false, error: 'Already in wormhole transit.' };
  }

  // Get wormhole
  const wormhole = getWormholeById(wormholeId);
  if (!wormhole) {
    return { success: false, error: 'Wormhole not found.' };
  }

  // Check distance
  const dx = wormhole.x - player.x;
  const dy = wormhole.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > WORMHOLE_RANGE + wormhole.size) {
    return { success: false, error: 'Too far from wormhole to enter.' };
  }

  return { success: true, wormhole };
}

/**
 * Enter a wormhole and start destination selection
 * @param {Object} player - Player object
 * @param {string} wormholeId - Wormhole ID
 * @returns {{success: boolean, error?: string, destinations?: Array}}
 */
function enterWormhole(player, wormholeId) {
  const check = canEnterWormhole(player, wormholeId);
  if (!check.success) {
    return check;
  }

  // Find nearest wormholes as destinations
  const destinations = getNearestWormholes(player.x, player.y, MAX_DESTINATIONS);

  // Filter out the current wormhole
  const filteredDestinations = destinations.filter(w => w.id !== wormholeId);

  if (filteredDestinations.length === 0) {
    return { success: false, error: 'No destination wormholes available.' };
  }

  // Store transit state
  activeTransits.set(player.id, {
    phase: 'selecting',
    entryWormholeId: wormholeId,
    entryPosition: { x: check.wormhole.x, y: check.wormhole.y },
    destinations: filteredDestinations,
    startTime: Date.now(),
    selectionTimeout: setTimeout(() => {
      cancelTransit(player.id, 'Selection timeout');
    }, SELECTION_TIMEOUT)
  });

  return {
    success: true,
    destinations: filteredDestinations.map(w => ({
      id: w.id,
      x: w.x,
      y: w.y,
      distance: Math.round(w.distance),
      sectorX: w.sectorX,
      sectorY: w.sectorY
    }))
  };
}

/**
 * Select a destination and begin transit
 * @param {number} playerId - Player ID
 * @param {string} destinationId - Destination wormhole ID
 * @returns {{success: boolean, error?: string}}
 */
function selectDestination(playerId, destinationId) {
  const transit = activeTransits.get(playerId);

  if (!transit) {
    return { success: false, error: 'Not in wormhole selection.' };
  }

  if (transit.phase !== 'selecting') {
    return { success: false, error: 'Already in transit.' };
  }

  // Validate destination is in allowed list
  const destination = transit.destinations.find(d => d.id === destinationId);
  if (!destination) {
    return { success: false, error: 'Invalid destination.' };
  }

  // Clear selection timeout
  if (transit.selectionTimeout) {
    clearTimeout(transit.selectionTimeout);
  }

  // Update transit state
  transit.phase = 'transit';
  transit.destinationId = destinationId;
  transit.destination = destination;
  transit.transitStartTime = Date.now();

  return {
    success: true,
    duration: TRANSIT_DURATION,
    destination: {
      id: destination.id,
      x: destination.x,
      y: destination.y
    }
  };
}

/**
 * Get transit progress (0-1)
 * @param {number} playerId - Player ID
 * @returns {{inTransit: boolean, phase?: string, progress?: number, destination?: Object}}
 */
function getTransitProgress(playerId) {
  const transit = activeTransits.get(playerId);

  if (!transit) {
    return { inTransit: false };
  }

  if (transit.phase === 'selecting') {
    return {
      inTransit: true,
      phase: 'selecting',
      progress: 0
    };
  }

  if (transit.phase === 'transit') {
    const elapsed = Date.now() - transit.transitStartTime;
    const progress = Math.min(1, elapsed / TRANSIT_DURATION);

    return {
      inTransit: true,
      phase: 'transit',
      progress,
      destination: transit.destination,
      complete: progress >= 1
    };
  }

  return { inTransit: false };
}

/**
 * Complete the transit and teleport player
 * @param {number} playerId - Player ID
 * @returns {{success: boolean, error?: string, position?: Object}}
 */
function completeTransit(playerId) {
  const transit = activeTransits.get(playerId);

  if (!transit || transit.phase !== 'transit') {
    return { success: false, error: 'Not in transit.' };
  }

  const elapsed = Date.now() - transit.transitStartTime;
  if (elapsed < TRANSIT_DURATION) {
    return { success: false, error: 'Transit not complete.' };
  }

  // Get destination wormhole
  const destination = transit.destination;

  // Calculate exit position (slightly offset from wormhole center)
  const exitOffset = 80; // Exit 80 units away from wormhole center
  const exitAngle = Math.random() * Math.PI * 2;
  const exitPosition = {
    x: destination.x + Math.cos(exitAngle) * exitOffset,
    y: destination.y + Math.sin(exitAngle) * exitOffset
  };

  // Clean up transit state
  activeTransits.delete(playerId);

  return {
    success: true,
    position: exitPosition,
    wormholeId: destination.id
  };
}

/**
 * Cancel wormhole transit
 * @param {number} playerId - Player ID
 * @param {string} reason - Cancellation reason
 * @returns {{success: boolean}}
 */
function cancelTransit(playerId, reason = 'Cancelled') {
  const transit = activeTransits.get(playerId);

  if (!transit) {
    return { success: false, error: 'Not in transit.' };
  }

  // Clear any timeouts
  if (transit.selectionTimeout) {
    clearTimeout(transit.selectionTimeout);
  }

  // Remove transit state
  activeTransits.delete(playerId);

  return { success: true, reason };
}

/**
 * Check if player is currently in wormhole transit (for invulnerability)
 * @param {number} playerId - Player ID
 * @returns {boolean}
 */
function isInTransit(playerId) {
  return activeTransits.has(playerId);
}

/**
 * Get current transit phase for player
 * @param {number} playerId - Player ID
 * @returns {string|null} 'selecting', 'transit', or null
 */
function getTransitPhase(playerId) {
  const transit = activeTransits.get(playerId);
  return transit ? transit.phase : null;
}

/**
 * Clean up player transit on disconnect
 * @param {number} playerId - Player ID
 */
function cleanupPlayer(playerId) {
  cancelTransit(playerId, 'Disconnected');
}

module.exports = {
  hasWormholeGem,
  getNearestWormholes,
  getWormholeById,
  canEnterWormhole,
  enterWormhole,
  selectDestination,
  getTransitProgress,
  completeTransit,
  cancelTransit,
  isInTransit,
  getTransitPhase,
  cleanupPlayer,
  TRANSIT_DURATION,
  WORMHOLE_RANGE,
  MAX_DESTINATIONS
};
