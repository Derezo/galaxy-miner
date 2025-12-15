// Galaxy Miner - Retreat AI Strategy (Scavengers)
// Hit-and-run tactics with early retreat and healing

/**
 * RetreatStrategy - Scavengers are opportunistic survivors
 * - Monitor health threshold (20%)
 * - Calculate escape vector (away from threat)
 * - Boost speed during retreat
 * - Seek nearest friendly base
 * - Heal at base, resume patrol
 * - Hit-and-run tactics
 */
class RetreatStrategy {
  constructor() {
    // Track healing status
    this.healingNPCs = new Set();
  }

  /**
   * Main update for retreat-focused behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Check if currently healing at base
    if (this.healingNPCs.has(npc.id)) {
      return this.healAtBase(npc, deltaTime, context);
    }

    // Check if should retreat (20% health for scavengers)
    if (this.shouldRetreat(npc)) {
      npc.state = 'retreat';
      return this.retreat(npc, nearbyPlayers, deltaTime, context);
    }

    // Combine players and hostile NPCs into potential targets
    // Players take priority, then hostile NPCs (pirates)
    const hostileNPCs = context.nearbyHostiles || [];
    const allTargets = [...nearbyPlayers];

    // Add hostile NPCs as targets (formatted like players)
    for (const hostile of hostileNPCs) {
      allTargets.push({
        ...hostile,
        isNPC: true
      });
    }

    // No targets - patrol (scavengers patrol loosely)
    if (allTargets.length === 0) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      npc.targetNPC = null;
      this.loosePatrol(npc, deltaTime, context);
      return null;
    }

    // Has targets - hit-and-run engagement
    npc.state = 'combat';

    // Select target (prefer isolated/damaged targets)
    const target = this.selectTarget(npc, allTargets);
    if (!target) {
      this.loosePatrol(npc, deltaTime, context);
      return null;
    }

    if (target.isNPC) {
      npc.targetNPC = target.id;
      npc.targetPlayer = null;
    } else {
      npc.targetPlayer = target.id;
      npc.targetNPC = null;
    }

    // Hit-and-run movement
    this.hitAndRunMovement(npc, target, allTargets, deltaTime);

    // Opportunistic fire
    return this.tryOpportunisticFire(npc, target);
  }

  /**
   * Select target - prefer isolated and damaged targets
   */
  selectTarget(npc, players) {
    if (players.length === 0) return null;

    // Score targets by vulnerability
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const player of players) {
      let score = 0;

      // Prefer damaged targets
      const healthPercent = (player.hull || 100) / (player.hullMax || 100);
      score += (1 - healthPercent) * 50;

      // Prefer isolated targets (far from other players)
      let nearestAllyDist = Infinity;
      for (const other of players) {
        if (other.id === player.id) continue;
        const dx = other.position.x - player.position.x;
        const dy = other.position.y - player.position.y;
        nearestAllyDist = Math.min(nearestAllyDist, Math.sqrt(dx * dx + dy * dy));
      }
      if (nearestAllyDist === Infinity) nearestAllyDist = 500;
      score += nearestAllyDist / 10; // More points for isolated

      // Slight preference for closer targets
      score -= player.distance / 50;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = player;
      }
    }

    return bestTarget || players[0];
  }

  /**
   * Hit-and-run movement - strafe and maintain distance
   */
  hitAndRunMovement(npc, target, allPlayers, deltaTime) {
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Optimal range is at edge of weapon range (safer distance)
    const optimalRange = npc.weaponRange * 0.9;
    const moveSpeed = npc.speed * (deltaTime / 1000);

    // Face target
    npc.rotation = Math.atan2(dy, dx);

    // Calculate threat level (more players = more cautious)
    const threatLevel = Math.min(allPlayers.length, 3);

    if (dist < optimalRange - 50) {
      // Too close, back away while strafing
      const strafeAngle = npc.rotation + Math.PI + (Math.sin(Date.now() / 500) * 0.5);
      npc.position.x += Math.cos(strafeAngle) * moveSpeed * 1.2;
      npc.position.y += Math.sin(strafeAngle) * moveSpeed * 1.2;
    } else if (dist > optimalRange + 50) {
      // Too far, approach cautiously with strafing
      const approachAngle = npc.rotation + (Math.sin(Date.now() / 700) * 0.3);
      npc.position.x += Math.cos(approachAngle) * moveSpeed * 0.8;
      npc.position.y += Math.sin(approachAngle) * moveSpeed * 0.8;
    } else {
      // At optimal range, strafe
      const strafeDir = Math.sin(Date.now() / 400) > 0 ? 1 : -1;
      const strafeAngle = npc.rotation + (Math.PI / 2) * strafeDir;
      npc.position.x += Math.cos(strafeAngle) * moveSpeed * 0.5;
      npc.position.y += Math.sin(strafeAngle) * moveSpeed * 0.5;
    }
  }

  /**
   * Opportunistic fire - quick shots when safe
   */
  tryOpportunisticFire(npc, target) {
    if (!target) return null;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Scavengers fire faster but deal less consistent damage
    const fireCooldown = 800; // Faster fire rate
    const canFire = Date.now() - (npc.lastFireTime || 0) > fireCooldown;

    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();
      return {
        action: 'fire',
        target,
        weaponType: npc.weaponType,
        weaponTier: npc.weaponTier,
        baseDamage: npc.weaponDamage,
        opportunistic: true
      };
    }

    return null;
  }

  /**
   * Check if should retreat (20% health for scavengers)
   */
  shouldRetreat(npc) {
    const healthPercent = npc.hull / npc.hullMax;
    return healthPercent <= 0.2;
  }

  /**
   * Retreat toward home base with speed boost
   */
  retreat(npc, threats, deltaTime, context) {
    const homeBase = context.homeBase || npc.spawnPoint;
    if (!homeBase) return null;

    // Calculate escape vector (away from average threat position)
    let threatCenterX = 0, threatCenterY = 0;
    if (threats.length > 0) {
      for (const threat of threats) {
        threatCenterX += threat.position.x;
        threatCenterY += threat.position.y;
      }
      threatCenterX /= threats.length;
      threatCenterY /= threats.length;
    }

    // Blend between running to base and running from threats
    const toBaseDx = homeBase.x - npc.position.x;
    const toBaseDy = homeBase.y - npc.position.y;
    const toBaseDist = Math.sqrt(toBaseDx * toBaseDx + toBaseDy * toBaseDy);

    const fromThreatDx = npc.position.x - threatCenterX;
    const fromThreatDy = npc.position.y - threatCenterY;
    const fromThreatDist = Math.sqrt(fromThreatDx * fromThreatDx + fromThreatDy * fromThreatDy);

    // Weight toward base more as we get closer
    const baseWeight = 0.7;
    const escapeDx = (toBaseDx / toBaseDist) * baseWeight +
                     (fromThreatDist > 0 ? (fromThreatDx / fromThreatDist) * (1 - baseWeight) : 0);
    const escapeDy = (toBaseDy / toBaseDist) * baseWeight +
                     (fromThreatDist > 0 ? (fromThreatDy / fromThreatDist) * (1 - baseWeight) : 0);

    // Normalize escape vector
    const escapeDist = Math.sqrt(escapeDx * escapeDx + escapeDy * escapeDy);

    // Boost speed during retreat (40% faster)
    const retreatSpeed = npc.speed * 1.4 * (deltaTime / 1000);

    npc.rotation = Math.atan2(escapeDy, escapeDx);
    npc.position.x += (escapeDx / escapeDist) * retreatSpeed;
    npc.position.y += (escapeDy / escapeDist) * retreatSpeed;

    // Check if reached base
    if (toBaseDist < 100) {
      this.healingNPCs.add(npc.id);
      npc.state = 'healing';
    }

    return null;
  }

  /**
   * Heal at base before resuming
   */
  healAtBase(npc, deltaTime, context) {
    // Regenerate health
    const healRate = npc.hullMax * 0.15 * (deltaTime / 1000); // 15% per second
    npc.hull = Math.min(npc.hullMax, npc.hull + healRate);

    // Also regenerate shield
    const shieldRate = npc.shieldMax * 0.2 * (deltaTime / 1000);
    npc.shield = Math.min(npc.shieldMax, npc.shield + shieldRate);

    // Check if fully healed
    if (npc.hull >= npc.hullMax * 0.8) { // 80% is "healed enough"
      this.healingNPCs.delete(npc.id);
      npc.state = 'patrol';
    }

    // Stay near base while healing
    const center = context.homeBase || npc.spawnPoint;
    if (center) {
      const dx = center.x - npc.position.x;
      const dy = center.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 50) {
        const moveSpeed = npc.speed * 0.3 * (deltaTime / 1000);
        npc.position.x += (dx / dist) * moveSpeed;
        npc.position.y += (dy / dist) * moveSpeed;
      }
    }

    return null;
  }

  /**
   * Loose patrol - scavengers wander more randomly
   */
  loosePatrol(npc, deltaTime, context) {
    const patrolRadius = 350;
    const patrolSpeed = npc.speed * 0.35 * (deltaTime / 1000);
    const center = context.homeBase || npc.spawnPoint;

    if (!center) return;

    // More erratic movement pattern
    if (!npc.patrolTarget || Math.random() < 0.01) {
      // Pick new random patrol point
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * patrolRadius;
      npc.patrolTarget = {
        x: center.x + Math.cos(angle) * dist,
        y: center.y + Math.sin(angle) * dist
      };
    }

    const dx = npc.patrolTarget.x - npc.position.x;
    const dy = npc.patrolTarget.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    } else {
      // Reached target, pick new one next frame
      npc.patrolTarget = null;
    }
  }
}

module.exports = RetreatStrategy;
