// Galaxy Miner - Flanking AI Strategy (Pirates)
// Pirates coordinate to attack from multiple angles

/**
 * FlankingStrategy - Pirates attack from different angles
 * - Leader identifies target, calls attack
 * - Other pirates flank from sides
 * - Coordinate attacks with timing delays
 * - Retreat together when leader retreats
 */
class FlankingStrategy {
  constructor() {
    // Track attack coordination
    this.attackCalls = new Map(); // npcId -> { targetId, calledAt, flankAngle }
  }

  /**
   * Main update for flanking behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Check if should retreat
    if (this.shouldRetreat(npc)) {
      npc.state = 'retreat';
      return this.retreat(npc, deltaTime, context);
    }

    // No targets - patrol
    if (nearbyPlayers.length === 0) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      this.patrol(npc, deltaTime, context);
      return null;
    }

    // Has targets - engage with flanking
    npc.state = 'combat';

    // Select target (prefer already targeted by allies for focus fire)
    const target = this.selectTarget(npc, nearbyPlayers, nearbyAllies);
    if (!target) {
      this.patrol(npc, deltaTime, context);
      return null;
    }

    npc.targetPlayer = target.id;

    // Calculate flanking approach
    const flankPosition = this.calculateFlankPosition(npc, target, nearbyAllies);

    // Move toward flank position
    const movement = this.calculateMovement(npc, flankPosition, deltaTime);
    npc.position.x += movement.x;
    npc.position.y += movement.y;

    // Face the target while moving
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    npc.rotation = Math.atan2(dy, dx);

    // Try to fire
    return this.tryFire(npc, target);
  }

  /**
   * Select target - prioritize targets already being attacked by allies
   */
  selectTarget(npc, players, allies) {
    if (players.length === 0) return null;

    // Check what targets allies are attacking
    const targetCounts = new Map();
    for (const ally of allies) {
      if (ally.targetPlayer) {
        const count = targetCounts.get(ally.targetPlayer) || 0;
        targetCounts.set(ally.targetPlayer, count + 1);
      }
    }

    // Prefer target with most allies already attacking (focus fire)
    let bestTarget = null;
    let bestScore = -1;

    for (const player of players) {
      const allyCount = targetCounts.get(player.id) || 0;
      // Score: ally focus + closeness (inverted distance)
      const proximityScore = 1 - (player.distance / npc.aggroRange);
      const score = allyCount * 2 + proximityScore;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = player;
      }
    }

    return bestTarget || players[0];
  }

  /**
   * Calculate flanking position based on allies
   */
  calculateFlankPosition(npc, target, allies) {
    // Determine our position index among allies attacking same target
    const attackingAllies = allies.filter(a => a.targetPlayer === target.id);
    let myIndex = 0;
    for (const ally of attackingAllies) {
      if (ally.id < npc.id) myIndex++;
    }

    // Distribute angles around target
    const totalAttackers = attackingAllies.length + 1;
    const angleSpread = Math.PI * 1.5; // 270 degrees coverage
    const baseAngle = Math.atan2(
      npc.homeBasePosition?.y - target.position.y || 0,
      npc.homeBasePosition?.x - target.position.x || 1
    );

    // Calculate our flanking angle
    const angleOffset = (myIndex / totalAttackers) * angleSpread - angleSpread / 2;
    const flankAngle = baseAngle + Math.PI + angleOffset; // Opposite side of base

    // Optimal attack distance (80% of weapon range)
    const attackDist = npc.weaponRange * 0.8;

    return {
      x: target.position.x + Math.cos(flankAngle) * attackDist,
      y: target.position.y + Math.sin(flankAngle) * attackDist
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

    if (dist < 20) return { x: 0, y: 0 }; // Close enough

    const moveSpeed = npc.speed * (deltaTime / 1000);

    return {
      x: (dx / dist) * moveSpeed,
      y: (dy / dist) * moveSpeed
    };
  }

  /**
   * Check if should retreat (40% health for pirates)
   */
  shouldRetreat(npc) {
    const healthPercent = npc.hull / npc.hullMax;
    return healthPercent <= 0.4;
  }

  /**
   * Retreat toward home base
   */
  retreat(npc, deltaTime, context) {
    const homeBase = context.homeBase || npc.spawnPoint;
    if (!homeBase) return null;

    const dx = homeBase.x - npc.position.x;
    const dy = homeBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 100) {
      // Reached safety, switch to patrol
      npc.state = 'patrol';
      return null;
    }

    // Boost speed during retreat
    const retreatSpeed = npc.speed * 1.3 * (deltaTime / 1000);
    npc.rotation = Math.atan2(dy, dx);
    npc.position.x += (dx / dist) * retreatSpeed;
    npc.position.y += (dy / dist) * retreatSpeed;

    return null;
  }

  /**
   * Patrol behavior
   */
  patrol(npc, deltaTime, context) {
    const patrolRadius = context.patrolRadius || 400;
    const patrolSpeed = npc.speed * 0.3 * (deltaTime / 1000);
    const center = context.homeBase || npc.spawnPoint;

    if (!center) return;

    npc.patrolAngle = (npc.patrolAngle || 0) + 0.5 * (deltaTime / 1000);
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

    const canFire = Date.now() - (npc.lastFireTime || 0) > 1000;

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
}

module.exports = FlankingStrategy;
