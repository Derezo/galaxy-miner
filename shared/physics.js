// Shared physics module for deterministic position computation
// Used by both client and server to ensure synchronized positions

(function(exports) {
  'use strict';

  // Reference time for all physics calculations (fixed point for determinism)
  const PHYSICS_EPOCH = new Date('2025-01-01T00:00:00Z').getTime();

  // Get constants - works in both Node.js and browser
  function getConstants() {
    if (typeof CONSTANTS !== 'undefined') {
      return CONSTANTS;
    }
    if (typeof require !== 'undefined') {
      return require('./constants');
    }
    return {};
  }

  // Get current physics time (elapsed since epoch) - now analytical, no modular needed
  function getPhysicsTime() {
    return Date.now() - PHYSICS_EPOCH;
  }

  // Alias for compatibility
  function getOrbitTime() {
    return getPhysicsTime();
  }

  // Distance helper
  function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Compute planet position at given time (uses orbit time for smooth motion)
  function computePlanetPosition(planet, star, time) {
    // Use provided time or get orbit time
    const orbitTime = time !== undefined ? time : getOrbitTime();
    const elapsedSeconds = orbitTime / 1000;
    const currentAngle = planet.orbitAngle + (planet.orbitSpeed * elapsedSeconds);
    return {
      x: star.x + Math.cos(currentAngle) * planet.orbitRadius,
      y: star.y + Math.sin(currentAngle) * planet.orbitRadius
    };
  }

  // Compute position with bouncing (triangle wave) - analytical solution
  // No step-by-step simulation needed!
  function computeBouncePosition(initial, velocity, minBound, maxBound, time) {
    const range = maxBound - minBound;

    // Safety checks
    if (range <= 0) return (minBound + maxBound) / 2;
    if (velocity === 0 || !isFinite(velocity)) {
      // Clamp initial to bounds
      return Math.max(minBound, Math.min(maxBound, initial));
    }
    if (!isFinite(time) || time < 0) time = 0;

    // Distance traveled
    const dist = velocity * time;

    // Position relative to min bound
    let pos = initial - minBound + dist;

    // Use modulo to get position within a double-range cycle (there and back)
    const cycle = range * 2;
    pos = ((pos % cycle) + cycle) % cycle; // Always positive modulo

    // Triangle wave: if past range, reflect back
    if (pos > range) {
      pos = cycle - pos;
    }

    // Final position with safety clamp
    const result = minBound + pos;
    return Math.max(minBound, Math.min(maxBound, result));
  }

  // Compute asteroid position at given time - analytical (no simulation loop!)
  function computeAsteroidPosition(asteroid, stars, time) {
    const C = getConstants();
    const MARGIN = C.SECTOR_BOUNDARY_MARGIN || 30;
    const ORBIT_VELOCITY = C.ASTEROID_ORBIT_VELOCITY || 0.2;

    // Safety: validate asteroid has required properties
    if (!asteroid || !asteroid.sectorBounds) {
      return {
        x: asteroid ? (asteroid.initialX || asteroid.x || 0) : 0,
        y: asteroid ? (asteroid.initialY || asteroid.y || 0) : 0,
        state: 'drifting',
        capturedBy: null,
        orbitRadius: null,
        orbitAngle: null
      };
    }

    const bounds = asteroid.sectorBounds;
    const timeSeconds = (time || 0) / 1000;

    // Compute bouncing position analytically
    const minX = bounds.minX + MARGIN;
    const maxX = bounds.maxX - MARGIN;
    const minY = bounds.minY + MARGIN;
    const maxY = bounds.maxY - MARGIN;

    let x = computeBouncePosition(asteroid.initialX, asteroid.initialVx || 0, minX, maxX, timeSeconds);
    let y = computeBouncePosition(asteroid.initialY, asteroid.initialVy || 0, minY, maxY, timeSeconds);

    // Safety: ensure valid numbers
    if (!isFinite(x)) x = asteroid.initialX || bounds.minX;
    if (!isFinite(y)) y = asteroid.initialY || bounds.minY;

    // Check for gravity capture by any star
    let state = 'drifting';
    let capturedBy = null;
    let orbitRadius = null;
    let orbitAngle = null;

    if (stars && stars.length > 0) {
      for (const star of stars) {
        if (!star || !star.gravityRadius) continue;
        const dist = distance(x, y, star.x, star.y);
        if (dist < star.gravityRadius && dist > star.size) {
          // Captured into orbit - orbit from current position
          state = 'orbiting';
          capturedBy = star.id;
          orbitRadius = dist;
          // Use time-based angle for smooth orbit
          const baseAngle = Math.atan2(y - star.y, x - star.x);
          orbitAngle = baseAngle + ORBIT_VELOCITY * timeSeconds;
          x = star.x + Math.cos(orbitAngle) * orbitRadius;
          y = star.y + Math.sin(orbitAngle) * orbitRadius;
          break;
        }
      }
    }

    return {
      x: x,
      y: y,
      state: state,
      capturedBy: capturedBy,
      orbitRadius: orbitRadius,
      orbitAngle: orbitAngle
    };
  }

  // Get asteroid position - now just a direct call (analytical = O(1))
  function getAsteroidPosition(asteroid, stars, currentTime) {
    return computeAsteroidPosition(asteroid, stars, currentTime);
  }

  // No longer needed but kept for API compatibility
  function clearCheckpointCache() {
    // No-op - no cache with analytical solution
  }

  // Export for both Node.js and browser
  exports.getPhysicsTime = getPhysicsTime;
  exports.getOrbitTime = getOrbitTime;
  exports.distance = distance;
  exports.computePlanetPosition = computePlanetPosition;
  exports.computeAsteroidPosition = computeAsteroidPosition;
  exports.getAsteroidPosition = getAsteroidPosition;
  exports.clearCheckpointCache = clearCheckpointCache;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Physics = {}));
