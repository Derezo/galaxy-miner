// Galaxy Miner - Swarm AI Strategy (The Swarm)
// Collective behavior with linked health and orbiting attacks

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
   * Patrol in tight formation around hive
   */
  patrol(npc, deltaTime, context) {
    const patrolRadius = 150; // Tight patrol around hive
    const patrolSpeed = npc.speed * 0.5 * (deltaTime / 1000);
    const center = context.homeBase || npc.spawnPoint;

    if (!center) return;

    npc.patrolAngle = (npc.patrolAngle || 0) + 1.0 * (deltaTime / 1000);
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
}

module.exports = SwarmStrategy;
