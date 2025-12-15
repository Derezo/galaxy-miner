// Galaxy Miner - Territorial AI Strategy (Rogue Miners)
// Defend territory with warning phase then aggression

/**
 * TerritorialStrategy - Rogue Miners defend their claim
 * - Define territory boundary (500 unit radius)
 * - Warning phase: Flash weapons but don't fire
 * - Aggressive phase: Attack if player doesn't leave
 * - Chase limit: Won't pursue beyond territory
 * - Return to patrol when threat leaves
 */
class TerritorialStrategy {
  constructor() {
    // Track warning status per player
    this.warnings = new Map(); // playerId -> { warningStart, warned }
  }

  /**
   * Main update for territorial behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    const territoryRadius = context.territoryRadius || 500;

    // Check if should retreat (50% health for rogue miners)
    if (this.shouldRetreat(npc)) {
      npc.state = 'retreat';
      return this.retreat(npc, deltaTime, context);
    }

    // Combine players and hostile NPCs (pirates) as potential intruders
    const hostileNPCs = context.nearbyHostiles || [];
    const allPotentialIntruders = [...nearbyPlayers];

    // Add hostile NPCs as intruders (pirates raiding the base)
    for (const hostile of hostileNPCs) {
      allPotentialIntruders.push({
        ...hostile,
        isNPC: true
      });
    }

    // Find intruders in territory (both players and hostile NPCs)
    const intruders = this.findIntruders(npc, allPotentialIntruders, territoryRadius, context);

    // No intruders - patrol territory
    if (intruders.length === 0) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      npc.targetNPC = null;
      this.clearWarnings();
      this.patrolTerritory(npc, deltaTime, context);
      return null;
    }

    // Has intruders - check warning/attack phase
    const target = this.selectTarget(npc, intruders);
    if (!target) {
      this.patrolTerritory(npc, deltaTime, context);
      return null;
    }

    // Pirates (hostile NPCs) get no warning - immediate attack
    if (target.isNPC) {
      npc.state = 'combat';
      npc.targetNPC = target.id;
      npc.targetPlayer = null;
      this.pursueInTerritory(npc, target, deltaTime, context);
      return this.tryFire(npc, target);
    }

    // Check if target is actively mining (more aggressive)
    const isTargetMining = target.status === 'mining' || target.mining;

    // Check warning status for this target
    const warningInfo = this.getWarningInfo(target.id);

    if (!warningInfo.warned && !isTargetMining) {
      // Warning phase - approach and flash weapons
      npc.state = 'warning';
      npc.targetPlayer = target.id;
      return this.warningBehavior(npc, target, deltaTime, warningInfo);
    }

    // Aggressive phase - attack the intruder
    npc.state = 'combat';
    npc.targetPlayer = target.id;
    npc.targetNPC = null;

    // Move toward intruder but don't leave territory
    this.pursueInTerritory(npc, target, deltaTime, context);

    // Fire at intruder
    return this.tryFire(npc, target);
  }

  /**
   * Find players that are within territory
   */
  findIntruders(npc, players, territoryRadius, context) {
    const territoryCenter = context.homeBase || npc.spawnPoint;
    if (!territoryCenter) return players;

    return players.filter(player => {
      const dx = player.position.x - territoryCenter.x;
      const dy = player.position.y - territoryCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= territoryRadius;
    });
  }

  /**
   * Select target - prioritize pirates (immediate threat), then miners, then closest
   */
  selectTarget(npc, intruders) {
    if (intruders.length === 0) return null;

    // First priority: Hostile NPCs (pirates) - they're trying to steal!
    const hostileNPCs = intruders.filter(p => p.isNPC);
    if (hostileNPCs.length > 0) {
      return hostileNPCs.sort((a, b) => a.distance - b.distance)[0];
    }

    // Second priority: Anyone mining our resources
    const miners = intruders.filter(p => p.status === 'mining' || p.mining);
    if (miners.length > 0) {
      return miners.sort((a, b) => a.distance - b.distance)[0];
    }

    // Otherwise closest intruder
    return intruders.sort((a, b) => a.distance - b.distance)[0];
  }

  /**
   * Get or create warning info for a player
   */
  getWarningInfo(playerId) {
    if (!this.warnings.has(playerId)) {
      this.warnings.set(playerId, {
        warningStart: Date.now(),
        warned: false
      });
    }
    return this.warnings.get(playerId);
  }

  /**
   * Clear all warnings (when no intruders)
   */
  clearWarnings() {
    this.warnings.clear();
  }

  /**
   * Warning behavior - approach and flash weapons
   */
  warningBehavior(npc, target, deltaTime, warningInfo) {
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Face the intruder
    npc.rotation = Math.atan2(dy, dx);

    // Approach to warning range (slightly beyond weapon range)
    const warningRange = npc.weaponRange * 1.2;
    if (dist > warningRange) {
      const moveSpeed = npc.speed * 0.8 * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }

    // Check if warning period is over (3 seconds)
    const warningDuration = 3000;
    if (Date.now() - warningInfo.warningStart > warningDuration) {
      warningInfo.warned = true;
    }

    // Return warning event for visual feedback
    return {
      action: 'warning',
      target,
      message: 'Leave our territory!',
      timeRemaining: Math.max(0, warningDuration - (Date.now() - warningInfo.warningStart))
    };
  }

  /**
   * Pursue target but stay within territory
   */
  pursueInTerritory(npc, target, deltaTime, context) {
    const territoryCenter = context.homeBase || npc.spawnPoint;
    const territoryRadius = context.territoryRadius || 500;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Face target
    npc.rotation = Math.atan2(dy, dx);

    // Calculate next position
    const moveSpeed = npc.speed * (deltaTime / 1000);
    let nextX = npc.position.x + (dx / dist) * moveSpeed;
    let nextY = npc.position.y + (dy / dist) * moveSpeed;

    // Check if next position would be outside territory
    if (territoryCenter) {
      const dxFromCenter = nextX - territoryCenter.x;
      const dyFromCenter = nextY - territoryCenter.y;
      const distFromCenter = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter);

      if (distFromCenter > territoryRadius * 0.9) {
        // Don't leave territory - stay at edge
        const angle = Math.atan2(dyFromCenter, dxFromCenter);
        nextX = territoryCenter.x + Math.cos(angle) * territoryRadius * 0.9;
        nextY = territoryCenter.y + Math.sin(angle) * territoryRadius * 0.9;
      }
    }

    // Only move if in range
    if (dist > npc.weaponRange * 0.7) {
      npc.position.x = nextX;
      npc.position.y = nextY;
    }
  }

  /**
   * Patrol within territory
   */
  patrolTerritory(npc, deltaTime, context) {
    const patrolRadius = (context.territoryRadius || 500) * 0.6;
    const patrolSpeed = npc.speed * 0.4 * (deltaTime / 1000);
    const center = context.homeBase || npc.spawnPoint;

    if (!center) return;

    // Slower, more deliberate patrol (territorial presence)
    npc.patrolAngle = (npc.patrolAngle || 0) + 0.2 * (deltaTime / 1000);
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
   * Check if should retreat (50% health for rogue miners)
   */
  shouldRetreat(npc) {
    const healthPercent = npc.hull / npc.hullMax;
    return healthPercent <= 0.5;
  }

  /**
   * Retreat to territory center (mining claim)
   */
  retreat(npc, deltaTime, context) {
    const homeBase = context.homeBase || npc.spawnPoint;
    if (!homeBase) return null;

    const dx = homeBase.x - npc.position.x;
    const dy = homeBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 50) {
      // At home base, recover
      npc.state = 'patrol';
      return null;
    }

    // Retreat at normal speed (miners are cautious)
    const retreatSpeed = npc.speed * (deltaTime / 1000);
    npc.rotation = Math.atan2(dy, dx);
    npc.position.x += (dx / dist) * retreatSpeed;
    npc.position.y += (dy / dist) * retreatSpeed;

    return null;
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

      // Defender bonus: 20% more damage when defending territory
      const damageBonus = npc.defenderBonus ? 1.2 : 1.0;

      return {
        action: 'fire',
        target,
        weaponType: npc.weaponType,
        weaponTier: npc.weaponTier,
        baseDamage: Math.round(npc.weaponDamage * damageBonus),
        territorial: true
      };
    }

    return null;
  }
}

module.exports = TerritorialStrategy;
