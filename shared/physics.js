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

  // Solve Kepler's equation for eccentric anomaly using Newton-Raphson iteration
  // M = E - e*sin(E), solve for E given M and e
  function solveKeplerEquation(meanAnomaly, eccentricity, maxIterations = 10) {
    if (eccentricity < 0.001) {
      // Circular orbit, E = M
      return meanAnomaly;
    }

    // Initial guess
    let E = meanAnomaly;

    for (let i = 0; i < maxIterations; i++) {
      const delta = (E - eccentricity * Math.sin(E) - meanAnomaly) /
                    (1 - eccentricity * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-8) break;
    }

    return E;
  }

  // Convert eccentric anomaly to true anomaly
  function eccentricToTrueAnomaly(E, eccentricity) {
    if (eccentricity < 0.001) {
      return E;
    }
    const beta = eccentricity / (1 + Math.sqrt(1 - eccentricity * eccentricity));
    return E + 2 * Math.atan2(beta * Math.sin(E), 1 - beta * Math.cos(E));
  }

  // Compute binary star positions at given time with elliptical orbits
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

    // Calculate mean anomaly (linear with time)
    const meanAnomaly = bi.orbitPhase + (elapsedSeconds / bi.orbitPeriod) * Math.PI * 2;

    // Get eccentricity (0 = circular, >0 = elliptical)
    const e = bi.eccentricity || 0;

    // Solve for eccentric anomaly and convert to true anomaly
    const E = solveKeplerEquation(meanAnomaly, e);
    const trueAnomaly = eccentricToTrueAnomaly(E, e);

    // Calculate radius at current position (r = a(1-e²)/(1+e*cos(θ)))
    const primaryRadiusFactor = (1 - e * e) / (1 + e * Math.cos(trueAnomaly));
    const secondaryRadiusFactor = (1 - e * e) / (1 + e * Math.cos(trueAnomaly + Math.PI));

    const r1 = bi.primaryOrbitRadius * primaryRadiusFactor;
    const r2 = bi.secondaryOrbitRadius * secondaryRadiusFactor;

    return {
      primary: {
        x: bi.baryCenter.x + Math.cos(trueAnomaly) * r1,
        y: bi.baryCenter.y + Math.sin(trueAnomaly) * r1
      },
      secondary: {
        x: bi.baryCenter.x + Math.cos(trueAnomaly + Math.PI) * r2,
        y: bi.baryCenter.y + Math.sin(trueAnomaly + Math.PI) * r2
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
    const tierGravityScale = gravity.TIER_GRAVITY_SCALE || null;

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

    // Use tier-based gravity scaling (new players get reduced gravity)
    // T1=50%, T2=70%, T3=85%, T4=95%, T5=100% gravity
    let tierFactor = 1.0;
    if (tierGravityScale && tierGravityScale[engineTier] !== undefined) {
      tierFactor = tierGravityScale[engineTier];
    } else {
      // Fallback to old linear reduction if scale not defined
      const tierReduction = gravity.ENGINE_TIER_REDUCTION || 0.15;
      tierFactor = Math.max(1 - (engineTier - 1) * tierReduction, 0.4);
    }
    const effectiveStrength = strength * tierFactor;

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

  // Compute comet position along its trajectory at given time
  // Uses quadratic Bezier curve: entry -> perihelion -> exit
  // Returns { visible, x, y, angle, isWarning, progress }
  function computeCometPosition(comet, time) {
    if (!comet || !comet.entryPoint || !comet.perihelion || !comet.exitPoint) {
      return { visible: false, x: 0, y: 0, angle: 0, isWarning: false, progress: 0 };
    }

    const orbitTime = time !== undefined ? time : getOrbitTime();

    // Calculate where we are in the comet's cycle
    // phaseOffset determines when in the cycle the comet first appears
    const cycleTime = ((orbitTime - comet.phaseOffset) % comet.orbitPeriod + comet.orbitPeriod) % comet.orbitPeriod;

    // Total active time = warning + traversal
    const warningTime = comet.warningTime || 10000;
    const traversalTime = comet.traversalTime || 30000;
    const totalActiveTime = warningTime + traversalTime;

    // Check if comet is currently active (warning or visible)
    if (cycleTime > totalActiveTime) {
      return { visible: false, x: 0, y: 0, angle: 0, isWarning: false, progress: 0 };
    }

    // Warning phase (comet not yet visible but approaching)
    const isWarning = cycleTime < warningTime;

    // Progress through the trajectory (0 to 1)
    let progress;
    if (isWarning) {
      // During warning, position at entry point
      progress = 0;
    } else {
      // During traversal, move from 0 to 1
      progress = (cycleTime - warningTime) / traversalTime;
    }

    // Clamp progress
    progress = Math.max(0, Math.min(1, progress));

    // Quadratic Bezier curve: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const t = progress;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const tmt2 = 2 * mt * t;

    const x = mt2 * comet.entryPoint.x + tmt2 * comet.perihelion.x + t2 * comet.exitPoint.x;
    const y = mt2 * comet.entryPoint.y + tmt2 * comet.perihelion.y + t2 * comet.exitPoint.y;

    // Calculate angle (tangent to curve)
    // Derivative: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
    const dx = 2 * mt * (comet.perihelion.x - comet.entryPoint.x) + 2 * t * (comet.exitPoint.x - comet.perihelion.x);
    const dy = 2 * mt * (comet.perihelion.y - comet.entryPoint.y) + 2 * t * (comet.exitPoint.y - comet.perihelion.y);
    const angle = Math.atan2(dy, dx);

    return {
      visible: !isWarning,
      x,
      y,
      angle,
      isWarning,
      progress,
      // Time until comet reaches this system (useful for warnings)
      timeUntilArrival: isWarning ? warningTime - cycleTime : 0
    };
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

  // Comet trajectory
  exports.computeCometPosition = computeCometPosition;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Physics = {}));
