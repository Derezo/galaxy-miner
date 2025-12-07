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

  // Compute belt asteroid position at given time (orbital, not bouncing)
  // Used for the new Solar System model
  function computeBeltAsteroidPosition(asteroid, star, time) {
    // Use provided time or get orbit time
    const orbitTime = time !== undefined ? time : getOrbitTime();
    const elapsedSeconds = orbitTime / 1000;
    const currentAngle = asteroid.orbitAngle + (asteroid.orbitSpeed * elapsedSeconds);
    return {
      x: star.x + Math.cos(currentAngle) * asteroid.orbitRadius,
      y: star.y + Math.sin(currentAngle) * asteroid.orbitRadius,
      angle: currentAngle
    };
  }

  // Compute binary star positions at given time
  // Both stars orbit around their common barycenter
  function computeBinaryStarPositions(system, time) {
    if (!system.binaryInfo) {
      return {
        primary: { x: system.primaryStar.x, y: system.primaryStar.y },
        secondary: null
      };
    }

    const bi = system.binaryInfo;
    const orbitTime = time !== undefined ? time : getOrbitTime();
    const elapsedSeconds = orbitTime / 1000;

    // Calculate current orbital phase
    const phase = bi.orbitPhase + (elapsedSeconds / bi.orbitPeriod) * Math.PI * 2;

    return {
      primary: {
        x: bi.baryCenter.x + Math.cos(phase) * bi.primaryOrbitRadius,
        y: bi.baryCenter.y + Math.sin(phase) * bi.primaryOrbitRadius
      },
      secondary: {
        x: bi.baryCenter.x + Math.cos(phase + Math.PI) * bi.secondaryOrbitRadius,
        y: bi.baryCenter.y + Math.sin(phase + Math.PI) * bi.secondaryOrbitRadius
      }
    };
  }

  // Compute Lagrange points for binary system (useful for wormhole/base placement)
  // Returns L4 and L5 points (stable triangular points)
  function computeLagrangePoints(binaryInfo, time) {
    const orbitTime = time !== undefined ? time : getOrbitTime();
    const elapsedSeconds = orbitTime / 1000;

    // Current orbital phase
    const phase = binaryInfo.orbitPhase + (elapsedSeconds / binaryInfo.orbitPeriod) * Math.PI * 2;

    // L4 and L5 are at 60 degrees ahead and behind the secondary star
    const radius = binaryInfo.separation;
    const bc = binaryInfo.baryCenter;

    return {
      L4: {
        x: bc.x + Math.cos(phase + Math.PI + Math.PI / 3) * radius,
        y: bc.y + Math.sin(phase + Math.PI + Math.PI / 3) * radius
      },
      L5: {
        x: bc.x + Math.cos(phase + Math.PI - Math.PI / 3) * radius,
        y: bc.y + Math.sin(phase + Math.PI - Math.PI / 3) * radius
      }
    };
  }

  // Calculate star gravity pull on a ship at given position
  function computeStarGravity(shipX, shipY, star, engineTier, dt) {
    const C = getConstants();
    const gravity = C.STAR_GRAVITY || {};
    const baseStrength = gravity.BASE_STRENGTH || 800;
    const falloffPower = gravity.FALLOFF_POWER || 2;
    const influenceFactor = gravity.INFLUENCE_RADIUS_FACTOR || 3;
    const tierReduction = gravity.ENGINE_TIER_REDUCTION || 0.15;

    const dx = star.x - shipX;
    const dy = star.y - shipY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if within gravity influence
    const influenceRadius = star.size * influenceFactor;
    if (dist >= influenceRadius || dist < 1) {
      return { fx: 0, fy: 0, inGravity: false };
    }

    // Inverse square falloff
    const normalizedDist = Math.max(dist / star.size, 0.5); // Prevent extreme values
    const strength = baseStrength / Math.pow(normalizedDist, falloffPower);

    // Engine tier reduces gravity effect (min 40% effect at tier 5)
    const tierFactor = 1 - (engineTier - 1) * tierReduction;
    const effectiveStrength = strength * Math.max(tierFactor, 0.4);

    // Direction toward star
    const dirX = dx / dist;
    const dirY = dy / dist;

    return {
      fx: dirX * effectiveStrength * dt,
      fy: dirY * effectiveStrength * dt,
      inGravity: true,
      distance: dist,
      strength: effectiveStrength
    };
  }

  // Determine which star danger zone a position is in
  function getStarZone(x, y, star) {
    const C = getConstants();
    const zones = C.STAR_ZONES || { CORONA: 1.5, WARM: 1.3, HOT: 1.0, SURFACE: 0.7 };

    const dist = distance(x, y, star.x, star.y);
    const ratio = dist / star.size;

    if (ratio < zones.SURFACE) return { zone: 'surface', ratio, dist };
    if (ratio < zones.HOT) return { zone: 'hot', ratio, dist };
    if (ratio < zones.WARM) return { zone: 'warm', ratio, dist };
    if (ratio < zones.CORONA) return { zone: 'corona', ratio, dist };
    return { zone: null, ratio, dist };
  }

  // Get damage values for a given star zone
  function getZoneDamage(zone, distanceRatio) {
    const C = getConstants();
    const damage = C.STAR_DAMAGE || {};
    const zones = C.STAR_ZONES || { SURFACE: 0.7, HOT: 1.0 };

    switch (zone) {
      case 'corona':
        return { shieldDrain: 0, hullDamage: 0 };
      case 'warm':
        return {
          shieldDrain: damage.WARM_SHIELD_DRAIN || 5,
          hullDamage: damage.WARM_HULL_DAMAGE || 0
        };
      case 'hot':
        // Damage scales as you get closer
        const hotIntensity = 1 - (distanceRatio - zones.SURFACE) / (zones.HOT - zones.SURFACE);
        return {
          shieldDrain: (damage.HOT_SHIELD_DRAIN || 15) * Math.max(0.5, hotIntensity),
          hullDamage: (damage.HOT_HULL_DAMAGE || 10) * Math.max(0.5, hotIntensity)
        };
      case 'surface':
        return {
          shieldDrain: 999, // Instant shield drain
          hullDamage: damage.SURFACE_HULL_DAMAGE || 50
        };
      default:
        return { shieldDrain: 0, hullDamage: 0 };
    }
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

  // New Solar System model functions
  exports.computeBeltAsteroidPosition = computeBeltAsteroidPosition;
  exports.computeBinaryStarPositions = computeBinaryStarPositions;
  exports.computeLagrangePoints = computeLagrangePoints;
  exports.computeStarGravity = computeStarGravity;
  exports.getStarZone = getStarZone;
  exports.getZoneDamage = getZoneDamage;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Physics = {}));
