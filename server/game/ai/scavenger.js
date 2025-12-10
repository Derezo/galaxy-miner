// Galaxy Miner - Scavenger AI Strategy
// Passive wreckage collectors that rage when provoked

const loot = require('../loot');
const logger = require('../../../shared/logger');

/**
 * ScavengerStrategy - Scavengers collect wreckage and return to base
 *
 * States:
 * - idle: Patrol near base
 * - seeking: Traveling to wreckage (up to 5,000 units)
 * - collecting: Scooping animation (1.5 sec)
 * - returning: Hauling wreckage back to base
 * - dumping: Depositing at base
 * - enraged: Aggressive pursuit of target (triggered by attack or nearby wreckage theft)
 *
 * Special behaviors:
 * - Passive by default - won't attack unless provoked
 * - Rage spreads to all Scavengers within 1000 units
 * - Rage ends when target is >1000 units away
 * - Hauler doesn't return to base, just grows larger
 * - Barnacle King transformation when Hauler collects 5 wreckage
 */
class ScavengerStrategy {
  constructor() {
    // Track enraged NPCs and their targets
    this.enragedNPCs = new Map(); // npcId -> { targetId, enragedAt }

    // Track collecting NPCs
    this.collectingNPCs = new Map(); // npcId -> { wreckageId, startTime, duration }

    // Track NPCs returning to base
    this.returningNPCs = new Set();

    // Track NPCs dumping at base
    this.dumpingNPCs = new Map(); // npcId -> { startTime, duration }

    // Constants
    this.WRECKAGE_SEARCH_RANGE = 5000; // How far scavengers will travel for wreckage
    this.RAGE_SPREAD_RANGE = 1000; // Range for rage to spread
    this.RAGE_CLEAR_RANGE = 1000; // Distance target must be to clear rage
    this.COLLECT_DURATION = 1500; // 1.5 seconds to collect
    this.DUMP_DURATION = 1000; // 1 second to dump
    this.WRECKAGE_THEFT_RANGE = 300; // Range at which collecting wreckage triggers rage
  }

  /**
   * Main update for scavenger behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Check if enraged
    if (this.enragedNPCs.has(npc.id)) {
      return this.updateEnraged(npc, nearbyPlayers, deltaTime, context);
    }

    // Check if currently collecting
    if (this.collectingNPCs.has(npc.id)) {
      return this.updateCollecting(npc, deltaTime, context);
    }

    // Check if currently dumping
    if (this.dumpingNPCs.has(npc.id)) {
      return this.updateDumping(npc, deltaTime, context);
    }

    // Check if returning to base with wreckage
    if (this.returningNPCs.has(npc.id)) {
      return this.updateReturning(npc, deltaTime, context);
    }

    // Check if already seeking wreckage
    if (npc.state === 'seeking' && npc.targetWreckageId) {
      const targetWreckage = loot.getWreckage(npc.targetWreckageId);
      if (targetWreckage) {
        return this.seekWreckage(npc, targetWreckage, deltaTime, context);
      }
      // Target wreckage is gone, clear target
      npc.targetWreckageId = null;
      npc.state = 'idle';
    }

    // Not enraged and not busy - look for new wreckage
    const nearestWreckage = this.findNearestWreckage(npc);

    if (nearestWreckage) {
      npc.state = 'seeking';
      npc.targetWreckageId = nearestWreckage.id;
      return this.seekWreckage(npc, nearestWreckage, deltaTime, context);
    }

    // No wreckage - idle patrol
    npc.state = 'idle';
    npc.targetPlayer = null;
    npc.targetWreckageId = null;
    this.idlePatrol(npc, deltaTime, context);
    return null;
  }

  /**
   * Find the nearest wreckage within search range
   */
  findNearestWreckage(npc) {
    const wreckageInRange = loot.getWreckageInRange(npc.position, this.WRECKAGE_SEARCH_RANGE);

    // Filter out wreckage being collected by others
    const available = wreckageInRange.filter(w => {
      // Skip if being collected by a player
      if (w.beingCollectedBy) return false;
      // Skip if already targeted by another scavenger (could add tracking later)
      return true;
    });

    if (available.length === 0) return null;

    // Sort by distance (getWreckageInRange already includes distance)
    available.sort((a, b) => a.distance - b.distance);

    return available[0];
  }

  /**
   * Move toward wreckage
   */
  seekWreckage(npc, wreckage, deltaTime, context) {
    const dx = wreckage.position.x - npc.position.x;
    const dy = wreckage.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveSpeed = npc.speed * (deltaTime / 1000);

    // Face the wreckage
    npc.rotation = Math.atan2(dy, dx);

    // Move toward wreckage
    if (dist > 30) {
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else {
      // Arrived - start collecting
      this.startCollecting(npc, wreckage);
    }

    return null;
  }

  /**
   * Start collecting wreckage
   */
  startCollecting(npc, wreckage) {
    npc.state = 'collecting';
    // Store wreckage position on NPC for tractor beam rendering
    npc.collectingWreckagePos = {
      x: wreckage.position.x,
      y: wreckage.position.y
    };
    this.collectingNPCs.set(npc.id, {
      wreckageId: wreckage.id,
      startTime: Date.now(),
      duration: this.COLLECT_DURATION
    });

    logger.log(`[SCAVENGER] ${npc.id} started collecting wreckage ${wreckage.id}`);

    // Broadcast collection start for client animation
    return {
      action: 'scavenger:startCollect',
      wreckageId: wreckage.id,
      duration: this.COLLECT_DURATION
    };
  }

  /**
   * Update while collecting wreckage
   */
  updateCollecting(npc, deltaTime, context) {
    const collectData = this.collectingNPCs.get(npc.id);
    if (!collectData) return null;

    const elapsed = Date.now() - collectData.startTime;

    if (elapsed >= collectData.duration) {
      // Collection complete
      this.collectingNPCs.delete(npc.id);
      // Clear collecting position from NPC
      npc.collectingWreckagePos = null;

      // Get the wreckage
      const wreckage = loot.getWreckage(collectData.wreckageId);
      if (wreckage) {
        // Store wreckage contents on NPC
        if (!npc.carriedWreckage) {
          npc.carriedWreckage = [];
        }
        npc.carriedWreckage.push({
          wreckageId: wreckage.id,
          contents: wreckage.contents,
          source: wreckage.source
        });

        // Remove wreckage from world
        loot.removeWreckage(wreckage.id);
        logger.log(`[SCAVENGER] ${npc.id} collected wreckage ${wreckage.id}, carrying ${npc.carriedWreckage.length} pieces`);

        // Base collected action that all scavenger types need
        const collectedAction = {
          action: 'scavenger:collected',
          wreckageId: collectData.wreckageId,
          npcId: npc.id
        };

        // Check if this is a Hauler or Barnacle King (they don't return to base)
        if (npc.type === 'scavenger_hauler') {
          // Hauler grows and eventually transforms
          const growAction = this.haulerGrow(npc, context);
          // Include both the collection and growth/transform actions
          return {
            ...collectedAction,
            ...growAction
          };
        } else if (npc.type === 'scavenger_barnacle_king') {
          // Barnacle King just accumulates - still need to notify clients of wreckage collection
          return collectedAction;
        }

        // Normal scavengers return to base
        this.returningNPCs.add(npc.id);
        npc.state = 'returning';

        return collectedAction;
      }

      // Wreckage was taken - go back to seeking
      npc.state = 'idle';
    }

    return null;
  }

  /**
   * Handle Hauler growth and transformation
   */
  haulerGrow(npc, context) {
    const wreckageCount = npc.carriedWreckage ? npc.carriedWreckage.length : 0;

    // Grow 10% per wreckage
    npc.sizeMultiplier = 1.0 + (wreckageCount * 0.1);

    // Check for Barnacle King transformation at 5 wreckage
    if (wreckageCount >= 5) {
      return {
        action: 'scavenger:transform',
        from: 'scavenger_hauler',
        to: 'scavenger_barnacle_king',
        npcId: npc.id,
        position: npc.position,
        carriedWreckage: npc.carriedWreckage
      };
    }

    return {
      action: 'scavenger:haulerGrow',
      npcId: npc.id,
      wreckageCount,
      sizeMultiplier: npc.sizeMultiplier
    };
  }

  /**
   * Update while returning to base with wreckage
   */
  updateReturning(npc, deltaTime, context) {
    const homeBase = context.homeBase || npc.spawnPoint;
    if (!homeBase) {
      // No base - drop wreckage and patrol
      this.returningNPCs.delete(npc.id);
      npc.state = 'idle';
      return null;
    }

    const dx = homeBase.x - npc.position.x;
    const dy = homeBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Slower movement when carrying wreckage
    const moveSpeed = npc.speed * 0.7 * (deltaTime / 1000);

    // Face the base
    npc.rotation = Math.atan2(dy, dx);

    if (dist > 80) {
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else {
      // Arrived at base - start dumping
      this.returningNPCs.delete(npc.id);
      this.startDumping(npc);
    }

    return null;
  }

  /**
   * Start dumping wreckage at base
   */
  startDumping(npc) {
    npc.state = 'dumping';
    this.dumpingNPCs.set(npc.id, {
      startTime: Date.now(),
      duration: this.DUMP_DURATION
    });

    return {
      action: 'scavenger:startDump',
      npcId: npc.id,
      duration: this.DUMP_DURATION
    };
  }

  /**
   * Update while dumping wreckage at base
   */
  updateDumping(npc, deltaTime, context) {
    const dumpData = this.dumpingNPCs.get(npc.id);
    if (!dumpData) return null;

    const elapsed = Date.now() - dumpData.startTime;

    if (elapsed >= dumpData.duration) {
      // Dumping complete
      this.dumpingNPCs.delete(npc.id);

      // Transfer wreckage to base's scrap pile
      const carriedWreckage = npc.carriedWreckage || [];
      npc.carriedWreckage = [];

      npc.state = 'idle';

      const baseId = context.homeBase?.id;
      logger.log(`[SCAVENGER] ${npc.id} dumping ${carriedWreckage.length} wreckage at base ${baseId}`);

      return {
        action: 'scavenger:dumped',
        npcId: npc.id,
        wreckageCount: carriedWreckage.length,
        contents: carriedWreckage,
        baseId
      };
    }

    return null;
  }

  /**
   * Trigger rage for this NPC and nearby allies
   */
  triggerRage(npc, targetId, nearbyAllies, reason = 'attack') {
    // Enrage this NPC
    this.enragedNPCs.set(npc.id, {
      targetId,
      enragedAt: Date.now(),
      reason
    });
    npc.state = 'enraged';
    npc.targetPlayer = targetId;

    // Spread rage to nearby allies
    for (const ally of nearbyAllies) {
      if (ally.faction !== 'scavenger') continue;

      const dx = ally.position.x - npc.position.x;
      const dy = ally.position.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.RAGE_SPREAD_RANGE) {
        this.enragedNPCs.set(ally.id, {
          targetId,
          enragedAt: Date.now(),
          reason: 'spread'
        });
        ally.state = 'enraged';
        ally.targetPlayer = targetId;
      }
    }

    return {
      action: 'scavenger:rage',
      npcId: npc.id,
      targetId,
      reason,
      rageRange: this.RAGE_SPREAD_RANGE
    };
  }

  /**
   * Check if a player stealing wreckage should trigger rage
   */
  checkWreckageTheft(npc, playerPosition, playerId) {
    const dx = playerPosition.x - npc.position.x;
    const dy = playerPosition.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist <= this.WRECKAGE_THEFT_RANGE;
  }

  /**
   * Update while enraged - aggressive pursuit
   */
  updateEnraged(npc, nearbyPlayers, deltaTime, context) {
    const rageData = this.enragedNPCs.get(npc.id);
    if (!rageData) {
      npc.state = 'idle';
      return null;
    }

    // Find the target
    const target = nearbyPlayers.find(p => p.id === rageData.targetId);

    if (!target) {
      // Target left area - check if should clear rage
      const clearRage = true; // Target is gone, clear rage
      if (clearRage) {
        this.enragedNPCs.delete(npc.id);
        npc.state = 'idle';
        npc.targetPlayer = null;
        return {
          action: 'scavenger:rageClear',
          npcId: npc.id
        };
      }
    }

    // Check if target is too far (rage clears)
    if (target) {
      const dx = target.position.x - npc.position.x;
      const dy = target.position.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.RAGE_CLEAR_RANGE) {
        this.enragedNPCs.delete(npc.id);
        npc.state = 'idle';
        npc.targetPlayer = null;
        return {
          action: 'scavenger:rageClear',
          npcId: npc.id
        };
      }

      // Chase and attack
      return this.chaseAndAttack(npc, target, deltaTime);
    }

    return null;
  }

  /**
   * Chase and attack target while enraged
   */
  chaseAndAttack(npc, target, deltaTime) {
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Enraged speed boost (20% faster)
    const moveSpeed = npc.speed * 1.2 * (deltaTime / 1000);

    // Face target
    npc.rotation = Math.atan2(dy, dx);

    // Move toward target
    if (dist > npc.weaponRange * 0.8) {
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }

    // Try to fire
    return this.tryFire(npc, target);
  }

  /**
   * Try to fire at target
   */
  tryFire(npc, target) {
    if (!target) return null;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Fire rate based on NPC type
    const fireCooldown = npc.type === 'scavenger_hauler' ? 2000 :
                         npc.type === 'scavenger_barnacle_king' ? 1500 : 1000;

    const canFire = Date.now() - (npc.lastFireTime || 0) > fireCooldown;

    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();

      // Special attack for Barnacle King
      if (npc.type === 'scavenger_barnacle_king') {
        return this.barnacleKingAttack(npc, target, dist);
      }

      // Special attack for Hauler
      if (npc.type === 'scavenger_hauler') {
        return this.haulerAttack(npc, target, dist);
      }

      // Normal dual laser attack for other scavengers
      return {
        action: 'fire',
        target,
        weaponType: 'dual_laser',
        weaponTier: npc.weaponTier,
        baseDamage: npc.weaponDamage
      };
    }

    return null;
  }

  /**
   * Barnacle King's boring drill attack
   */
  barnacleKingAttack(npc, target, dist) {
    const drillRange = 50;

    if (dist <= drillRange) {
      // In drill range - charge and attack
      if (!npc.drillCharging) {
        // Start charging
        npc.drillCharging = true;
        npc.drillChargeStart = Date.now();

        return {
          action: 'scavenger:drillCharge',
          npcId: npc.id,
          targetId: target.id,
          chargeTime: 1500
        };
      } else {
        // Check if charge complete
        const chargeTime = Date.now() - npc.drillChargeStart;
        if (chargeTime >= 1500) {
          npc.drillCharging = false;

          // INSTANT KILL
          return {
            action: 'fire',
            target,
            weaponType: 'boring_drill',
            weaponTier: 5,
            baseDamage: 99999, // Instant kill
            instantKill: true
          };
        }
      }
    } else {
      // Reset charge if target moved out of range
      npc.drillCharging = false;
    }

    return null;
  }

  /**
   * Hauler's loader slam attack
   */
  haulerAttack(npc, target, dist) {
    const slamRange = 35;

    if (dist <= slamRange) {
      return {
        action: 'fire',
        target,
        weaponType: 'loader_slam',
        weaponTier: 3,
        baseDamage: 50, // 40-60 damage
        melee: true
      };
    }

    return null;
  }

  /**
   * Idle patrol near base
   */
  idlePatrol(npc, deltaTime, context) {
    const patrolRadius = 200;
    const patrolSpeed = npc.speed * 0.4 * (deltaTime / 1000);
    const center = context.homeBase || npc.spawnPoint;

    if (!center) return;

    // Lazy patrol pattern
    if (!npc.patrolTarget || Math.random() < 0.005) {
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

    if (dist > 15) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    } else {
      npc.patrolTarget = null;
    }
  }

  /**
   * Called when NPC takes damage - triggers rage
   */
  onDamaged(npc, attackerId, nearbyAllies) {
    return this.triggerRage(npc, attackerId, nearbyAllies, 'attack');
  }

  /**
   * Called when a player collects wreckage near a scavenger
   */
  onWreckageCollectedNearby(npc, playerId, playerPosition, nearbyAllies, playerHasScrapSiphon = false) {
    // Check if player has Scrap Siphon immunity
    if (playerHasScrapSiphon) {
      return null; // No rage for players with Scrap Siphon
    }

    // Check if within theft range
    if (this.checkWreckageTheft(npc, playerPosition, playerId)) {
      return this.triggerRage(npc, playerId, nearbyAllies, 'wreckage_theft');
    }

    return null;
  }

  /**
   * Get carried wreckage contents for death drop
   */
  getCarriedWreckageForDeath(npc) {
    return npc.carriedWreckage || [];
  }

  /**
   * Clean up NPC state when removed
   */
  cleanup(npcId) {
    this.enragedNPCs.delete(npcId);
    this.collectingNPCs.delete(npcId);
    this.dumpingNPCs.delete(npcId);
    this.returningNPCs.delete(npcId);
  }
}

module.exports = ScavengerStrategy;
