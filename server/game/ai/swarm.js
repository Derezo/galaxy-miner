// Galaxy Miner - Swarm AI Strategy (The Swarm)
// Collective behavior with linked health and orbiting attacks

const CONSTANTS = require('../../../shared/constants');

/**
 * SwarmStrategy - The Swarm uses collective behavior
 * - Never retreat
 * - Share aggro across all swarm units
 * - Circle around player group center
 * - Linked damage (20% spreads to nearby units)
 * - Queen commands and is protected
 */
class SwarmStrategy {
  constructor() {
    // Swarm state tracking
    this.swarmTargets = new Map(); // Shared aggro across swarm
  }

  /**
   * Main update for swarm behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Route Swarm Queen to phase-based boss AI
    if (npc.type === 'swarm_queen') {
      return this.updateQueenAI(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
    }

    // Swarm never retreats - fight to the death
    npc.state = nearbyPlayers.length > 0 ? 'combat' : 'patrol';

    // No targets - patrol around hive
    if (nearbyPlayers.length === 0) {
      npc.targetPlayer = null;
      this.patrol(npc, deltaTime, context);
      return null;
    }

    // Find swarm center and calculate group behavior
    const swarmCenter = this.calculateSwarmCenter(npc, nearbyAllies);
    const targetCenter = this.calculateTargetCenter(nearbyPlayers);

    // Select shared target
    const target = this.selectTarget(npc, nearbyPlayers, nearbyAllies);
    if (!target) {
      this.patrol(npc, deltaTime, context);
      return null;
    }

    npc.targetPlayer = target.id;

    // Calculate orbiting position around target group
    const orbitPosition = this.calculateOrbitPosition(
      npc,
      targetCenter,
      nearbyAllies,
      deltaTime
    );

    // Move toward orbit position
    const movement = this.calculateMovement(npc, orbitPosition, deltaTime);
    npc.position.x += movement.x;
    npc.position.y += movement.y;

    // Face toward target center
    const dx = targetCenter.x - npc.position.x;
    const dy = targetCenter.y - npc.position.y;
    npc.rotation = Math.atan2(dy, dx);

    // Try to fire at nearest player
    return this.tryFire(npc, target);
  }

  /**
   * Select target - swarm shares aggro, focus on damaged targets
   */
  selectTarget(npc, players, allies) {
    if (players.length === 0) return null;

    // Sort by health percentage (focus damaged targets)
    const sorted = [...players].sort((a, b) => {
      const aHealth = (a.hull || 100) / (a.hullMax || 100);
      const bHealth = (b.hull || 100) / (b.hullMax || 100);
      return aHealth - bHealth;
    });

    return sorted[0];
  }

  /**
   * Calculate center of the swarm group
   */
  calculateSwarmCenter(npc, allies) {
    let x = npc.position.x;
    let y = npc.position.y;
    let count = 1;

    for (const ally of allies) {
      x += ally.position.x;
      y += ally.position.y;
      count++;
    }

    return { x: x / count, y: y / count };
  }

  /**
   * Calculate center of target players
   */
  calculateTargetCenter(players) {
    if (players.length === 0) return { x: 0, y: 0 };

    let x = 0, y = 0;
    for (const player of players) {
      x += player.position.x;
      y += player.position.y;
    }

    return { x: x / players.length, y: y / players.length };
  }

  /**
   * Calculate orbiting position around targets
   * Swarm circles and gradually tightens
   */
  calculateOrbitPosition(npc, targetCenter, allies, deltaTime) {
    // Determine our index in the swarm
    let myIndex = 0;
    for (const ally of allies) {
      if (ally.id < npc.id) myIndex++;
    }
    const totalSwarm = allies.length + 1;

    // Orbit radius decreases over time in combat (tightening spiral)
    npc.orbitRadius = npc.orbitRadius || npc.weaponRange * 1.2;
    npc.orbitRadius = Math.max(
      npc.weaponRange * 0.6,
      npc.orbitRadius - deltaTime * 0.01 // Slowly tighten
    );

    // Calculate our angle in the swarm circle
    npc.orbitAngle = npc.orbitAngle || (myIndex / totalSwarm) * Math.PI * 2;
    const orbitSpeed = 0.8 + (npc.speed / 150) * 0.4; // Faster units orbit faster
    npc.orbitAngle += orbitSpeed * (deltaTime / 1000);

    // Distribute evenly around the circle
    const baseAngle = (myIndex / totalSwarm) * Math.PI * 2;
    const angle = baseAngle + npc.orbitAngle;

    return {
      x: targetCenter.x + Math.cos(angle) * npc.orbitRadius,
      y: targetCenter.y + Math.sin(angle) * npc.orbitRadius
    };
  }

  /**
   * Movement calculation
   */
  calculateMovement(npc, target, deltaTime) {
    if (!target) return { x: 0, y: 0 };

    const dx = target.x - npc.position.x;
    const dy = target.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) return { x: 0, y: 0 };

    // Swarm moves fast
    const moveSpeed = npc.speed * 1.1 * (deltaTime / 1000);

    return {
      x: (dx / dist) * moveSpeed,
      y: (dy / dist) * moveSpeed
    };
  }

  /**
   * Patrol behavior varies by NPC type
   * - Drones: Wide roaming patrol (scouts for assimilation targets)
   * - Workers: Medium patrol radius around hive
   * - Warriors: Guard duty closer to hive
   * - All types switch to tight formation ONLY when queen is present
   */
  patrol(npc, deltaTime, context) {
    const center = context.homeBase || npc.spawnPoint;
    if (!center) return;

    // Determine patrol radius based on NPC type
    // Only use tight formation when queen is active (queen guard mode handles that separately)
    let patrolRadius;
    let orbitSpeed;

    switch (npc.type) {
      case 'swarm_drone':
        // Drones are scouts - wide roaming patrol, looking for bases to assimilate
        patrolRadius = 400 + Math.sin((npc.id?.charCodeAt(0) || 0) * 0.5) * 100;
        orbitSpeed = 0.3; // Slow orbit, more wandering
        break;
      case 'swarm_worker':
        // Workers stay at medium range
        patrolRadius = 250;
        orbitSpeed = 0.5;
        break;
      case 'swarm_warrior':
        // Warriors patrol closer but not as tight as queen guard
        patrolRadius = 180;
        orbitSpeed = 0.7;
        break;
      default:
        patrolRadius = 200;
        orbitSpeed = 0.5;
    }

    const patrolSpeed = npc.speed * 0.5 * (deltaTime / 1000);

    npc.patrolAngle = (npc.patrolAngle || 0) + orbitSpeed * (deltaTime / 1000);
    const targetX = center.x + Math.cos(npc.patrolAngle) * patrolRadius;
    const targetY = center.y + Math.sin(npc.patrolAngle) * patrolRadius;

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    }
  }

  /**
   * Attempt to fire at target
   */
  tryFire(npc, target) {
    if (!target) return null;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Swarm has faster fire rate
    const fireCooldown = 800; // 0.8 seconds
    const canFire = Date.now() - (npc.lastFireTime || 0) > fireCooldown;

    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();
      return {
        action: 'fire',
        target,
        weaponType: npc.weaponType,
        weaponTier: npc.weaponTier,
        baseDamage: npc.weaponDamage
      };
    }

    return null;
  }

  // ============================================
  // ASSIMILATION AI - Drones seek and sacrifice for base takeover
  // ============================================

  /**
   * Update behavior for assimilation mode
   * Drone moves toward target base and sacrifices when in range
   * @param {Object} npc - The drone NPC
   * @param {Object} targetBase - Target base for assimilation
   * @param {number} deltaTime - Time since last update
   * @returns {Object|null} Action result (assimilate trigger or null)
   */
  updateAssimilateBehavior(npc, targetBase, deltaTime) {
    if (!targetBase) return null;

    // Already attached drones stay in place - don't update their position or state
    if (npc.attachedToBase) {
      return null; // Return null so engine knows not to process assimilation action again
    }

    const assimSpeed = CONSTANTS.SWARM_ASSIMILATION.DRONE_ASSIMILATE_SPEED;
    const assimRange = CONSTANTS.SWARM_ASSIMILATION.ASSIMILATE_RANGE;

    // Calculate direction to base
    const dx = targetBase.x - npc.position.x;
    const dy = targetBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Face the target
    npc.rotation = Math.atan2(dy, dx);

    // Check if in sacrifice range
    if (dist <= assimRange) {
      npc.state = 'assimilating';
      return {
        action: 'assimilate',
        droneId: npc.id,
        baseId: targetBase.id,
        position: { x: npc.position.x, y: npc.position.y }
      };
    }

    // Move toward target base
    const moveSpeed = assimSpeed * (deltaTime / 1000);
    npc.position.x += (dx / dist) * moveSpeed;
    npc.position.y += (dy / dist) * moveSpeed;
    npc.state = 'seeking_base';

    return null;
  }

  // ============================================
  // QUEEN GUARD AI - Tight protective formation around queen
  // ============================================

  /**
   * Update behavior for queen guard mode
   * NPC orbits queen at tight range while still engaging threats
   * @param {Object} npc - The guard NPC
   * @param {Object} queen - The swarm queen to protect
   * @param {Array} nearbyPlayers - Nearby player threats
   * @param {Array} nearbyGuards - Other guards for formation spacing
   * @param {number} deltaTime - Time since last update
   * @returns {Object|null} Action result (fire at threat or null)
   */
  updateQueenGuard(npc, queen, nearbyPlayers, nearbyGuards, deltaTime) {
    if (!queen) return null;
    if (queen.hull <= 0) return null; // Don't guard dead queen

    // Normalize queen position (handle both queen.position.x and queen.x formats)
    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;
    if (queenX === undefined || queenY === undefined) return null;

    const guardConfig = CONSTANTS.SWARM_QUEEN_SPAWN;
    const minOrbit = 40;  // Tight formation inner radius (was 50)
    const maxOrbit = 80;  // Tight formation outer radius (was 100)
    const orbitSpeed = 2.0; // Fast orbit speed (rad/s) (was 1.5)
    const interceptThreshold = 120; // Break formation if player this close to queen

    // Calculate guard index for formation spacing
    let myIndex = 0;
    for (const guard of nearbyGuards) {
      if (guard.id < npc.id) myIndex++;
    }
    const totalGuards = nearbyGuards.length + 1;

    // Initialize or update orbit parameters
    if (!npc.guardOrbitRadius) {
      // Assign orbit radius based on index (alternate between inner and outer)
      npc.guardOrbitRadius = myIndex % 2 === 0 ? minOrbit : maxOrbit;
    }
    if (!npc.guardOrbitAngle) {
      npc.guardOrbitAngle = (myIndex / totalGuards) * Math.PI * 2;
    }

    // Update orbit angle
    npc.guardOrbitAngle += orbitSpeed * (deltaTime / 1000);

    // Calculate orbit position around queen (using normalized coordinates)
    const orbitX = queenX + Math.cos(npc.guardOrbitAngle) * npc.guardOrbitRadius;
    const orbitY = queenY + Math.sin(npc.guardOrbitAngle) * npc.guardOrbitRadius;

    // Check if any player is dangerously close to queen - intercept them!
    let interceptTarget = null;
    let interceptDist = Infinity;
    for (const player of nearbyPlayers) {
      const pToQueenDx = player.position.x - queenX;
      const pToQueenDy = player.position.y - queenY;
      const pToQueenDist = Math.sqrt(pToQueenDx * pToQueenDx + pToQueenDy * pToQueenDy);

      if (pToQueenDist < interceptThreshold && pToQueenDist < interceptDist) {
        interceptDist = pToQueenDist;
        interceptTarget = player;
      }
    }

    // Move toward intercept target (break formation) or orbit position
    let targetX, targetY;
    if (interceptTarget) {
      // Intercept! Move between player and queen
      const pDx = interceptTarget.position.x - queenX;
      const pDy = interceptTarget.position.y - queenY;
      const pDist = Math.sqrt(pDx * pDx + pDy * pDy);
      // Position ourselves between player and queen, closer to player
      targetX = queenX + (pDx / pDist) * (pDist * 0.7);
      targetY = queenY + (pDy / pDist) * (pDist * 0.7);
      npc.isIntercepting = true;
    } else {
      targetX = orbitX;
      targetY = orbitY;
      npc.isIntercepting = false;
    }

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      // Move faster when intercepting
      const speedMult = npc.isIntercepting ? 1.5 : 1.2;
      const moveSpeed = npc.speed * speedMult * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }

    // Face outward (defensive posture) unless there's a nearby threat
    let fireResult = null;
    if (nearbyPlayers.length > 0) {
      // Find nearest threat
      let nearestThreat = null;
      let nearestDist = Infinity;
      for (const player of nearbyPlayers) {
        const pdx = player.position.x - npc.position.x;
        const pdy = player.position.y - npc.position.y;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pDist < nearestDist) {
          nearestDist = pDist;
          nearestThreat = player;
        }
      }

      if (nearestThreat) {
        // Face threat
        const threatDx = nearestThreat.position.x - npc.position.x;
        const threatDy = nearestThreat.position.y - npc.position.y;
        npc.rotation = Math.atan2(threatDy, threatDx);

        // Fire at threat if in range (but don't chase - stay in formation)
        fireResult = this.tryFire(npc, nearestThreat);
      }
    } else {
      // Face outward from queen (defensive posture)
      const outwardDx = npc.position.x - queenX;
      const outwardDy = npc.position.y - queenY;
      npc.rotation = Math.atan2(outwardDy, outwardDx);
    }

    npc.state = 'queen_guard';
    return fireResult;
  }

  /**
   * Check if NPC should switch to queen guard mode
   * @param {Object} npc - NPC to check
   * @param {Object} queen - Active queen (or null)
   * @returns {boolean} True if should guard queen
   */
  shouldGuardQueen(npc, queen) {
    if (!queen) return false;
    if (queen.hull <= 0) return false; // Don't guard dead queen
    if (npc.type === 'swarm_queen') return false; // Queen doesn't guard herself

    // Normalize queen position (handle both queen.position.x and queen.x formats)
    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;
    if (queenX === undefined || queenY === undefined) return false;

    const guardRange = CONSTANTS.SWARM_QUEEN_SPAWN.QUEEN_GUARD_RANGE;
    const dx = queenX - npc.position.x;
    const dy = queenY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist <= guardRange;
  }

  /**
   * Apply linked damage to nearby swarm units
   * Called when a swarm unit takes damage
   */
  static applyLinkedDamage(damagedNpc, damage, allNPCs) {
    if (!damagedNpc.linkedHealth) return [];

    const linkedDamage = damage * 0.2; // 20% of damage spreads
    const affected = [];

    for (const [id, npc] of allNPCs) {
      if (id === damagedNpc.id) continue;
      if (npc.faction !== 'swarm') continue;
      if (!npc.linkedHealth) continue;

      // Check distance
      const dx = npc.position.x - damagedNpc.position.x;
      const dy = npc.position.y - damagedNpc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 300) { // Linked within 300 units
        npc.hull -= linkedDamage;
        affected.push({
          id: npc.id,
          damage: linkedDamage,
          destroyed: npc.hull <= 0
        });
      }
    }

    return affected;
  }

  // ============================================
  // QUEEN PHASE-BASED BOSS AI
  // ============================================

  /**
   * Update queen AI based on current phase
   * @param {Object} queen - The queen NPC
   * @param {Array} nearbyPlayers - Nearby player threats
   * @param {Array} nearbyGuards - Guards for formation
   * @param {number} deltaTime - Time since last update
   * @param {Object} context - Additional context (homeBase, etc)
   * @returns {Object|null} Action result
   */
  updateQueenAI(queen, nearbyPlayers, nearbyGuards, deltaTime, context) {
    // Initialize phase manager if not exists
    if (!queen.phaseManager) {
      queen.phaseManager = {
        currentPhase: 'HUNT',
        phaseStartTime: Date.now(),
        lastPhaseTransition: 0
      };
      queen.hullMax = queen.hullMax || queen.hull;
    }

    // Initialize special attack cooldowns
    queen.lastWebSnare = queen.lastWebSnare || 0;
    queen.lastAcidBurst = queen.lastAcidBurst || 0;

    // No players nearby - patrol the domain
    if (nearbyPlayers.length === 0) {
      queen.state = 'patrol';
      this.queenPatrol(queen, deltaTime, context);
      return null;
    }

    // Update phase based on health
    const phase = this.updateQueenPhase(queen);
    const modifiers = CONSTANTS.SWARM_QUEEN_PHASE_MODIFIERS[phase];

    // Apply phase-specific behavior
    switch (phase) {
      case 'HUNT':
        return this.huntPhase(queen, nearbyPlayers, deltaTime, modifiers);
      case 'SIEGE':
        return this.siegePhase(queen, nearbyPlayers, nearbyGuards, deltaTime, modifiers);
      case 'SWARM':
        return this.swarmPhase(queen, nearbyPlayers, deltaTime, modifiers);
      case 'DESPERATION':
        return this.desperationPhase(queen, nearbyPlayers, deltaTime, modifiers);
      default:
        return this.huntPhase(queen, nearbyPlayers, deltaTime, modifiers);
    }
  }

  /**
   * Determine current phase based on health
   */
  updateQueenPhase(queen) {
    const healthPercent = queen.hull / queen.hullMax;
    const phases = CONSTANTS.SWARM_QUEEN_PHASES;

    let newPhase = 'DESPERATION'; // Default to final phase

    if (healthPercent > phases.HUNT.minHealth) {
      newPhase = 'HUNT';
    } else if (healthPercent > phases.SIEGE.minHealth) {
      newPhase = 'SIEGE';
    } else if (healthPercent > phases.SWARM.minHealth) {
      newPhase = 'SWARM';
    }

    // Check for phase transition
    if (newPhase !== queen.phaseManager.currentPhase) {
      const oldPhase = queen.phaseManager.currentPhase; // Capture BEFORE changing
      queen.phaseManager.lastPhaseTransition = Date.now();
      queen.phaseManager.currentPhase = newPhase;
      // Return transition event for broadcast
      queen.phaseTransitionPending = {
        from: oldPhase,
        to: newPhase,
        timestamp: Date.now()
      };
    }

    return queen.phaseManager.currentPhase;
  }

  /**
   * Phase 1: Hunt - Aggressive pursuit
   */
  huntPhase(queen, nearbyPlayers, deltaTime, modifiers) {
    if (nearbyPlayers.length === 0) return null;

    // Target nearest player
    const target = this.findNearestTarget(queen, nearbyPlayers);
    if (!target) return null;

    // Normalize queen position
    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;

    // Aggressive pursuit with boosted speed
    const effectiveSpeed = queen.speed * modifiers.speedMultiplier;
    const dx = target.position.x - queenX;
    const dy = target.position.y - queenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > queen.weaponRange * 0.8) {
      const moveSpeed = effectiveSpeed * (deltaTime / 1000);
      queen.position.x += (dx / dist) * moveSpeed;
      queen.position.y += (dy / dist) * moveSpeed;
    }

    // Face target
    queen.rotation = Math.atan2(dy, dx);

    // Try to fire and use special attacks
    return this.queenCombat(queen, target, modifiers, nearbyPlayers);
  }

  /**
   * Phase 2: Siege - Defensive, spawn more minions
   */
  siegePhase(queen, nearbyPlayers, nearbyGuards, deltaTime, modifiers) {
    if (nearbyPlayers.length === 0) return null;

    // Calculate guard center
    const guardCenter = this.calculateGuardCenter(nearbyGuards);
    const target = this.findNearestTarget(queen, nearbyPlayers);

    if (target && guardCenter) {
      // Retreat behind guards (away from target)
      const queenX = queen.position?.x ?? queen.x;
      const queenY = queen.position?.y ?? queen.y;
      const dx = queenX - target.position.x;
      const dy = queenY - target.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Move away from threat, stay near guards
      if (dist < 400) {
        const effectiveSpeed = queen.speed * modifiers.speedMultiplier;
        const moveSpeed = effectiveSpeed * (deltaTime / 1000);
        queen.position.x += (dx / dist) * moveSpeed;
        queen.position.y += (dy / dist) * moveSpeed;
      }

      queen.rotation = Math.atan2(-dy, -dx); // Face away from threat
    }

    // Still attack but from defensive position
    return this.queenCombat(queen, target, modifiers, nearbyPlayers);
  }

  /**
   * Phase 3: Swarm - Rapid spawning, area attacks
   */
  swarmPhase(queen, nearbyPlayers, deltaTime, modifiers) {
    if (nearbyPlayers.length === 0) return null;

    const target = this.findNearestTarget(queen, nearbyPlayers);

    // Use area attacks more frequently
    const areaAttack = this.tryAreaAttack(queen, nearbyPlayers, deltaTime);
    if (areaAttack) return areaAttack;

    // Still use normal combat
    return this.queenCombat(queen, target, modifiers, nearbyPlayers);
  }

  /**
   * Phase 4: Desperation - Berserk mode
   */
  desperationPhase(queen, nearbyPlayers, deltaTime, modifiers) {
    if (nearbyPlayers.length === 0) return null;

    // Relentless pursuit of nearest target
    const target = this.findNearestTarget(queen, nearbyPlayers);
    if (!target) return null;

    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;
    const effectiveSpeed = queen.speed * modifiers.speedMultiplier;

    const dx = target.position.x - queenX;
    const dy = target.position.y - queenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Always chase, never stop
    const moveSpeed = effectiveSpeed * (deltaTime / 1000);
    queen.position.x += (dx / dist) * moveSpeed;
    queen.position.y += (dy / dist) * moveSpeed;

    queen.rotation = Math.atan2(dy, dx);

    // Reduced cooldowns in desperation
    queen.desperationCooldownMultiplier = 0.5;

    return this.queenCombat(queen, target, modifiers, nearbyPlayers);
  }

  /**
   * Queen combat - fire weapon and possibly special attacks
   */
  queenCombat(queen, target, modifiers, nearbyPlayers) {
    if (!target) return null;

    // Try special attacks first (lower priority for basic weapon)
    const specialAttack = this.trySpecialAttack(queen, nearbyPlayers);
    if (specialAttack) return specialAttack;

    // Normal weapon fire with damage modifier
    const fireResult = this.tryFire(queen, target);
    if (fireResult) {
      fireResult.damageMultiplier = modifiers.damageMultiplier;
    }
    return fireResult;
  }

  /**
   * Try to use a special attack
   */
  trySpecialAttack(queen, nearbyPlayers) {
    // Try web snare first (crowd control)
    const webSnare = this.tryWebSnare(queen, nearbyPlayers);
    if (webSnare) return webSnare;

    // Try acid burst
    const acidBurst = this.tryAcidBurst(queen, nearbyPlayers);
    if (acidBurst) return acidBurst;

    return null;
  }

  /**
   * Try area attack (for swarm phase)
   */
  tryAreaAttack(queen, nearbyPlayers, deltaTime) {
    // Prioritize area attacks in swarm phase
    const webSnare = this.tryWebSnare(queen, nearbyPlayers);
    if (webSnare) return webSnare;

    const acidBurst = this.tryAcidBurst(queen, nearbyPlayers);
    if (acidBurst) return acidBurst;

    return null;
  }

  // ============================================
  // SPECIAL ATTACKS
  // ============================================

  /**
   * Queen special attack: Web Snare
   * Creates area slow effect
   */
  tryWebSnare(queen, nearbyPlayers) {
    const config = CONSTANTS.QUEEN_ATTACKS.WEB_SNARE;
    const now = Date.now();

    // Check cooldown (with desperation modifier)
    const cooldown = config.cooldown * (queen.desperationCooldownMultiplier || 1);
    if (now - (queen.lastWebSnare || 0) < cooldown) {
      return null;
    }

    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;

    // Find players in range
    const playersInRange = nearbyPlayers.filter(p => {
      const dx = p.position.x - queenX;
      const dy = p.position.y - queenY;
      return Math.sqrt(dx * dx + dy * dy) <= config.range;
    });

    if (playersInRange.length === 0) return null;

    // Target center of player group for maximum effect
    const targetCenter = this.calculateTargetCenter(playersInRange);

    queen.lastWebSnare = now;

    return {
      action: 'web_snare',
      sourceX: queenX,
      sourceY: queenY,
      targetX: targetCenter.x,
      targetY: targetCenter.y,
      radius: config.radius,
      duration: config.duration,
      slowPercent: config.slowPercent,
      chargeTime: config.chargeTime,
      projectileSpeed: config.projectileSpeed
    };
  }

  /**
   * Queen special attack: Acid Spit Burst
   * AoE damage with DoT effect
   */
  tryAcidBurst(queen, nearbyPlayers) {
    const config = CONSTANTS.QUEEN_ATTACKS.ACID_BURST;
    const now = Date.now();

    // Check cooldown (with desperation modifier)
    const cooldown = config.cooldown * (queen.desperationCooldownMultiplier || 1);
    if (now - (queen.lastAcidBurst || 0) < cooldown) {
      return null;
    }

    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;

    // Find best target (nearest in range)
    const target = this.findBestAcidTarget(queen, nearbyPlayers, config.range);
    if (!target) return null;

    queen.lastAcidBurst = now;

    return {
      action: 'acid_burst',
      sourceX: queenX,
      sourceY: queenY,
      targetX: target.position.x,
      targetY: target.position.y,
      radius: config.radius,
      damage: config.damage,
      dotDamage: config.dotDamage,
      dotDuration: config.dotDuration,
      dotInterval: config.dotInterval,
      projectileSpeed: config.projectileSpeed
    };
  }

  /**
   * Find best target for acid burst (nearest player in range)
   */
  findBestAcidTarget(queen, players, range) {
    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;

    let nearest = null;
    let nearestDist = Infinity;

    for (const player of players) {
      const dx = player.position.x - queenX;
      const dy = player.position.y - queenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= range && dist < nearestDist) {
        nearestDist = dist;
        nearest = player;
      }
    }

    return nearest;
  }

  /**
   * Find nearest target
   */
  findNearestTarget(npc, players) {
    const npcX = npc.position?.x ?? npc.x;
    const npcY = npc.position?.y ?? npc.y;

    let nearest = null;
    let nearestDist = Infinity;

    for (const player of players) {
      const dx = player.position.x - npcX;
      const dy = player.position.y - npcY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = player;
      }
    }

    return nearest;
  }

  /**
   * Calculate center of guards for positioning
   */
  calculateGuardCenter(guards) {
    if (!guards || guards.length === 0) return null;

    let x = 0, y = 0;
    for (const guard of guards) {
      x += guard.position.x;
      y += guard.position.y;
    }

    return { x: x / guards.length, y: y / guards.length };
  }

  /**
   * Queen patrol behavior when no players are nearby
   * Queen slowly roams around her spawn point/home base in a menacing pattern
   * @param {Object} queen - The queen NPC
   * @param {number} deltaTime - Time since last update
   * @param {Object} context - Additional context (homeBase, etc)
   */
  queenPatrol(queen, deltaTime, context) {
    const center = context.homeBase || queen.spawnPoint || queen.position;
    if (!center) return;

    const centerX = center.x ?? center.position?.x ?? 0;
    const centerY = center.y ?? center.position?.y ?? 0;

    // Queen has a large patrol radius - she's the boss of her domain
    const patrolRadius = 300;
    const patrolSpeed = queen.speed * 0.4 * (deltaTime / 1000); // Slow, menacing patrol
    const orbitSpeed = 0.15; // Very slow orbit - queen is deliberate

    // Initialize patrol angle if not exists
    queen.patrolAngle = queen.patrolAngle || 0;

    // Add slight variation to make movement more organic
    const variation = Math.sin(Date.now() * 0.001 + (queen.id?.charCodeAt(0) || 0)) * 50;
    const effectiveRadius = patrolRadius + variation;

    // Update patrol angle
    queen.patrolAngle += orbitSpeed * (deltaTime / 1000);

    // Calculate target patrol position
    const targetX = centerX + Math.cos(queen.patrolAngle) * effectiveRadius;
    const targetY = centerY + Math.sin(queen.patrolAngle) * effectiveRadius;

    // Get current queen position
    const queenX = queen.position?.x ?? queen.x;
    const queenY = queen.position?.y ?? queen.y;

    const dx = targetX - queenX;
    const dy = targetY - queenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      // Face the direction of movement
      queen.rotation = Math.atan2(dy, dx);
      queen.position.x += (dx / dist) * patrolSpeed;
      queen.position.y += (dy / dist) * patrolSpeed;
    }

    // Queen is in patrol state
    queen.state = 'patrol';
  }
}

module.exports = SwarmStrategy;
