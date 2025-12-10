// Galaxy Miner - Rogue Miner AI Strategy
// NPCs mine asteroids/planets and return hauls to base

const world = require('../../world');
const logger = require('../../../shared/logger');

/**
 * MiningStrategy - Rogue Miners mine resources and return to base
 *
 * States:
 * - idle: Patrol near claim
 * - seeking: Traveling to mining target
 * - mining: Active mining operation (3 seconds)
 * - returning: Hauling resources back to base
 * - depositing: Delivering haul at base
 * - enraged: Aggressive pursuit (triggered by attack on any rogue miner)
 *
 * Special behaviors:
 * - Each NPC claims a unique asteroid/planet within 2000 units
 * - Foreman presence boosts credit gain (+4 instead of +2)
 * - Rage affects ALL rogue miners within 3000 units
 * - Rage persists until player leaves 3000 unit radius
 */
class MiningStrategy {
  constructor() {
    // Track mining targets to prevent sharing
    this.claimedTargets = new Map(); // targetId -> npcId

    // Track NPCs in mining operation
    this.miningNPCs = new Map(); // npcId -> { targetId, targetPos, startTime, duration }

    // Track returning NPCs
    this.returningNPCs = new Set();

    // Track depositing NPCs
    this.depositingNPCs = new Map(); // npcId -> { startTime, duration }

    // Track enraged NPCs per player
    this.enragedNPCs = new Map(); // npcId -> { targetId, enragedAt }

    // Track rage targets for cleanup
    this.rageTargets = new Map(); // playerId -> Set<npcId>

    // Constants
    this.MINING_SEARCH_RANGE = 2000;
    this.MINING_RANGE = 80;  // NPC mining distance (wider than player's 50 for visible beam)
    this.MINING_DURATION = 3000;
    this.DEPOSIT_DURATION = 1000;
    this.RAGE_SPREAD_RANGE = 3000;
    this.RAGE_CLEAR_RANGE = 3000;
  }

  /**
   * Main update for mining behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Check if enraged first - rage takes priority
    if (this.enragedNPCs.has(npc.id)) {
      return this.updateEnraged(npc, nearbyPlayers, deltaTime, context);
    }

    // Check if currently mining
    if (this.miningNPCs.has(npc.id)) {
      return this.updateMining(npc, deltaTime, context);
    }

    // Check if depositing
    if (this.depositingNPCs.has(npc.id)) {
      return this.updateDepositing(npc, deltaTime, context);
    }

    // Check if returning with haul
    if (this.returningNPCs.has(npc.id)) {
      return this.updateReturning(npc, deltaTime, context);
    }

    // Check if seeking target
    if (npc.state === 'seeking' && npc.miningTargetId) {
      return this.seekTarget(npc, deltaTime, context);
    }

    // Find a mining target
    const target = this.findMiningTarget(npc, context);
    if (target) {
      npc.state = 'seeking';
      npc.miningTargetId = target.id;
      npc.miningTargetPos = { x: target.x, y: target.y };
      // Asteroids are never orbital; planets only orbital if explicitly marked
      npc.miningTargetIsOrbital = target.objectType === 'planet' && target.isOrbital;
      this.claimedTargets.set(target.id, npc.id);
      return this.seekTarget(npc, deltaTime, context);
    }

    // No target - patrol
    npc.state = 'idle';
    this.idlePatrol(npc, deltaTime, context);
    return null;
  }

  /**
   * Find a unique asteroid/planet within range of home base
   * Only targets mining claim objects (IDs containing '_clm') to ensure client-server sync
   */
  findMiningTarget(npc, context) {
    const homeBase = context.homeBase || npc.homeBasePosition;
    if (!homeBase) return null;

    // Get sector containing the base
    const sectorX = Math.floor(homeBase.x / 1000);
    const sectorY = Math.floor(homeBase.y / 1000);

    // Search nearby sectors for mining claim asteroids/planets only
    // Mining claim objects have IDs like "ss_X_Y_Z_asteroid_clmNaN" or "ss_X_Y_Z_planet_clmNaN"
    const candidates = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const sector = world.generateSector(sectorX + dx, sectorY + dy);

        // Add mining claim asteroids only (IDs contain '_clm')
        for (const asteroid of sector.asteroids || []) {
          // Only target mining claim objects - these are synced with client
          if (!asteroid.id || !asteroid.id.includes('_clm')) continue;

          const dist = this.distanceTo(homeBase, asteroid);
          if (dist <= this.MINING_SEARCH_RANGE && !this.claimedTargets.has(asteroid.id)) {
            candidates.push({ ...asteroid, objectType: 'asteroid', distance: dist });
          }
        }

        // Add mining claim planets only (IDs contain '_clm')
        for (const planet of sector.planets || []) {
          // Only target mining claim objects - these are synced with client
          if (!planet.id || !planet.id.includes('_clm')) continue;

          const pos = planet.isOrbital ? (world.getObjectPosition(planet.id) || planet) : planet;
          const dist = this.distanceTo(homeBase, pos);
          if (dist <= this.MINING_SEARCH_RANGE && !this.claimedTargets.has(planet.id)) {
            candidates.push({ ...planet, x: pos.x, y: pos.y, objectType: 'planet', distance: dist });
          }
        }
      }
    }

    if (candidates.length === 0) {
      logger.log(`[ROGUE_MINER] ${npc.id} found no mining claim objects within range of base`);
      return null;
    }

    // Sort by distance and pick one of the closest
    candidates.sort((a, b) => a.distance - b.distance);
    const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
    const target = candidates[pickIndex];
    logger.log(`[ROGUE_MINER] ${npc.id} targeting claim object ${target.id} at ${target.x.toFixed(0)},${target.y.toFixed(0)}`);
    return target;
  }

  /**
   * Move toward mining target
   */
  seekTarget(npc, deltaTime, context) {
    // Get current target position
    // Only do expensive position lookup for orbital targets that might move
    let targetPos = npc.miningTargetPos;
    if (npc.miningTargetIsOrbital && npc.miningTargetId) {
      const currentPos = world.getObjectPosition(npc.miningTargetId);
      if (currentPos) {
        targetPos = currentPos;
        npc.miningTargetPos = { x: currentPos.x, y: currentPos.y };
      }
    }

    if (!targetPos) {
      // Target gone - clear and retry
      this.clearMiningTarget(npc);
      npc.state = 'idle';
      return null;
    }

    // ALWAYS ensure miningTargetPos is set for beam rendering during seeking
    // This covers static asteroids (not orbital) that don't trigger the above lookup
    if (!npc.miningTargetPos || npc.miningTargetPos.x === undefined) {
      npc.miningTargetPos = { x: targetPos.x, y: targetPos.y };
    }

    const dx = targetPos.x - npc.position.x;
    const dy = targetPos.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Apply Foreman buff if present
    const speedMultiplier = this.getForemanSpeedBonus(npc, context);
    const moveSpeed = npc.speed * speedMultiplier * (deltaTime / 1000);

    npc.rotation = Math.atan2(dy, dx);

    if (dist > this.MINING_RANGE) {
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else {
      // Arrived - start mining
      return this.startMining(npc);
    }

    return null;
  }

  /**
   * Start mining operation
   */
  startMining(npc) {
    npc.state = 'mining';
    const miningData = {
      targetId: npc.miningTargetId,
      targetPos: npc.miningTargetPos ? { ...npc.miningTargetPos } : null,
      startTime: Date.now(),
      duration: this.MINING_DURATION
    };
    this.miningNPCs.set(npc.id, miningData);

    logger.log(`[ROGUE_MINER] ${npc.id} started mining ${npc.miningTargetId}`);

    return {
      action: 'rogueMiner:startMining',
      npcId: npc.id,
      targetId: npc.miningTargetId,
      targetPos: miningData.targetPos,
      duration: this.MINING_DURATION
    };
  }

  /**
   * Update while mining
   */
  updateMining(npc, deltaTime, context) {
    const miningData = this.miningNPCs.get(npc.id);
    if (!miningData) return null;

    // Keep facing target and update position ONLY for orbital objects
    // Static asteroids/planets don't need position lookups
    if (npc.miningTargetIsOrbital && npc.miningTargetId) {
      const currentPos = world.getObjectPosition(npc.miningTargetId);
      if (currentPos) {
        miningData.targetPos = { x: currentPos.x, y: currentPos.y };
        npc.miningTargetPos = { x: currentPos.x, y: currentPos.y };
      }
    }

    // Keep facing target and ALWAYS sync miningTargetPos for beam rendering
    if (miningData.targetPos && miningData.targetPos.x !== undefined) {
      const dx = miningData.targetPos.x - npc.position.x;
      const dy = miningData.targetPos.y - npc.position.y;
      npc.rotation = Math.atan2(dy, dx);

      // ALWAYS set miningTargetPos from miningData during active mining
      // This ensures the beam renders even if something cleared it
      npc.miningTargetPos = { x: miningData.targetPos.x, y: miningData.targetPos.y };
    }

    const elapsed = Date.now() - miningData.startTime;
    if (elapsed >= miningData.duration) {
      // Mining complete
      this.miningNPCs.delete(npc.id);
      const targetId = miningData.targetId;
      this.clearMiningTarget(npc);

      npc.hasHaul = true;
      this.returningNPCs.add(npc.id);
      npc.state = 'returning';

      logger.log(`[ROGUE_MINER] ${npc.id} completed mining, returning to base`);

      return {
        action: 'rogueMiner:miningComplete',
        npcId: npc.id,
        targetId: targetId
      };
    }

    // Return mining progress for visual beam
    return {
      action: 'rogueMiner:miningProgress',
      npcId: npc.id,
      targetPos: miningData.targetPos,
      progress: elapsed / miningData.duration
    };
  }

  /**
   * Update while returning to base
   */
  updateReturning(npc, deltaTime, context) {
    const homeBase = context.homeBase || npc.homeBasePosition;
    if (!homeBase) {
      this.returningNPCs.delete(npc.id);
      npc.hasHaul = false;
      npc.state = 'idle';
      return null;
    }

    const dx = homeBase.x - npc.position.x;
    const dy = homeBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Slower when carrying haul, but Foreman buff applies
    const speedMultiplier = this.getForemanSpeedBonus(npc, context);
    const moveSpeed = npc.speed * 0.7 * speedMultiplier * (deltaTime / 1000);

    npc.rotation = Math.atan2(dy, dx);

    if (dist > 80) {
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else {
      // Arrived - start depositing
      this.returningNPCs.delete(npc.id);
      return this.startDepositing(npc);
    }

    return null;
  }

  /**
   * Start depositing haul at base
   */
  startDepositing(npc) {
    npc.state = 'depositing';
    this.depositingNPCs.set(npc.id, {
      startTime: Date.now(),
      duration: this.DEPOSIT_DURATION
    });

    return {
      action: 'rogueMiner:startDeposit',
      npcId: npc.id,
      duration: this.DEPOSIT_DURATION
    };
  }

  /**
   * Update while depositing
   */
  updateDepositing(npc, deltaTime, context) {
    const depositData = this.depositingNPCs.get(npc.id);
    if (!depositData) return null;

    const elapsed = Date.now() - depositData.startTime;
    if (elapsed >= depositData.duration) {
      this.depositingNPCs.delete(npc.id);
      npc.hasHaul = false;
      npc.state = 'idle';

      // Calculate credit bonus based on Foreman presence (3x with Foreman)
      const hasForeman = this.checkForemanPresent(npc, context);
      const creditBonus = hasForeman ? 6 : 2;

      logger.log(`[ROGUE_MINER] ${npc.id} deposited haul (+${creditBonus} credits)`);

      return {
        action: 'rogueMiner:deposited',
        npcId: npc.id,
        npcType: npc.type,
        creditBonus,
        hasForeman,
        baseId: context.homeBase?.id || npc.homeBaseId
      };
    }

    return null;
  }

  /**
   * Trigger rage for all rogue miners in range
   * Called when ANY rogue miner is attacked
   */
  triggerRage(attackedNpc, attackerId, allNPCs) {
    const results = [];

    // Find all rogue miners within rage spread range
    for (const [npcId, npc] of allNPCs) {
      if (npc.faction !== 'rogue_miner') continue;

      const dist = this.distanceTo(attackedNpc.position, npc.position);
      if (dist <= this.RAGE_SPREAD_RANGE) {
        // Enrage this NPC
        if (!this.enragedNPCs.has(npcId)) {
          this.enragedNPCs.set(npcId, {
            targetId: attackerId,
            enragedAt: Date.now()
          });
          npc.state = 'enraged';
          npc.targetPlayer = attackerId;

          // Clear any mining state
          this.clearAllState(npc);

          results.push(npcId);
        }
      }
    }

    // Track which NPCs are targeting this player
    if (!this.rageTargets.has(attackerId)) {
      this.rageTargets.set(attackerId, new Set());
    }
    for (const npcId of results) {
      this.rageTargets.get(attackerId).add(npcId);
    }

    logger.log(`[ROGUE_MINER] Rage triggered! ${results.length} miners enraged against player ${attackerId}`);

    return {
      action: 'rogueMiner:rage',
      triggeredBy: attackedNpc.id,
      targetId: attackerId,
      enragedNPCs: results,
      rageRange: this.RAGE_SPREAD_RANGE
    };
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
      // Target left area - clear rage
      this.clearRage(npc);
      return {
        action: 'rogueMiner:rageClear',
        npcId: npc.id
      };
    }

    // Check if target is beyond rage range
    const dist = this.distanceTo(npc.position, target.position);
    if (dist > this.RAGE_CLEAR_RANGE) {
      this.clearRage(npc);
      return {
        action: 'rogueMiner:rageClear',
        npcId: npc.id
      };
    }

    // Chase and attack - push forward aggressively
    return this.chaseAndAttack(npc, target, deltaTime, context);
  }

  /**
   * Aggressive chase and attack behavior
   */
  chaseAndAttack(npc, target, deltaTime, context) {
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Enraged speed boost (30% faster) + Foreman buff
    const speedMultiplier = this.getForemanSpeedBonus(npc, context);
    const moveSpeed = npc.speed * 1.3 * speedMultiplier * (deltaTime / 1000);

    npc.rotation = Math.atan2(dy, dx);

    // Push forward aggressively - get within 60% of weapon range
    if (dist > npc.weaponRange * 0.6) {
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }

    // Try to fire with boosted rate
    return this.tryFire(npc, target, context);
  }

  /**
   * Attempt to fire at target
   */
  tryFire(npc, target, context) {
    if (!target) return null;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Base cooldown with Foreman bonus (3.3x fire rate)
    const hasForeman = this.checkForemanPresent(npc, context);
    const fireCooldown = hasForeman ? 300 : 1000;

    const canFire = Date.now() - (npc.lastFireTime || 0) > fireCooldown;

    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();

      return {
        action: 'fire',
        target,
        weaponType: npc.weaponType,
        weaponTier: npc.weaponTier,
        baseDamage: npc.weaponDamage,
        enraged: true
      };
    }

    return null;
  }

  /**
   * Check if a Foreman is present at the same claim
   */
  checkForemanPresent(npc, context) {
    return context.hasForeman || false;
  }

  /**
   * Get speed bonus from Foreman presence (3x speed)
   */
  getForemanSpeedBonus(npc, context) {
    return this.checkForemanPresent(npc, context) ? 3.0 : 1.0;
  }

  /**
   * Idle patrol near claim
   */
  idlePatrol(npc, deltaTime, context) {
    const patrolRadius = 200;
    const speedMultiplier = this.getForemanSpeedBonus(npc, context);
    const patrolSpeed = npc.speed * 0.4 * speedMultiplier * (deltaTime / 1000);
    const center = context.homeBase || npc.homeBasePosition;

    if (!center) return;

    if (!npc.patrolTarget || Math.random() < 0.01) {
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
   * Called when NPC takes damage - triggers rage for all nearby
   */
  onDamaged(npc, attackerId, allNPCs) {
    return this.triggerRage(npc, attackerId, allNPCs);
  }

  /**
   * Clear mining target
   */
  clearMiningTarget(npc) {
    if (npc.miningTargetId) {
      this.claimedTargets.delete(npc.miningTargetId);
    }
    npc.miningTargetId = null;
    npc.miningTargetPos = null;
    npc.miningTargetIsOrbital = false;
  }

  /**
   * Clear all state for NPC (used when entering rage)
   */
  clearAllState(npc) {
    this.clearMiningTarget(npc);
    this.miningNPCs.delete(npc.id);
    this.returningNPCs.delete(npc.id);
    this.depositingNPCs.delete(npc.id);
  }

  /**
   * Clear rage state
   */
  clearRage(npc) {
    const rageData = this.enragedNPCs.get(npc.id);
    if (rageData) {
      const targetSet = this.rageTargets.get(rageData.targetId);
      if (targetSet) {
        targetSet.delete(npc.id);
        if (targetSet.size === 0) {
          this.rageTargets.delete(rageData.targetId);
        }
      }
    }
    this.enragedNPCs.delete(npc.id);
    npc.state = 'idle';
    npc.targetPlayer = null;
  }

  /**
   * Clean up NPC state when removed
   */
  cleanup(npcId) {
    this.claimedTargets.forEach((claimedNpcId, targetId) => {
      if (claimedNpcId === npcId) {
        this.claimedTargets.delete(targetId);
      }
    });
    this.miningNPCs.delete(npcId);
    this.returningNPCs.delete(npcId);
    this.depositingNPCs.delete(npcId);
    this.enragedNPCs.delete(npcId);
  }

  /**
   * Utility: calculate distance between two points
   */
  distanceTo(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

module.exports = MiningStrategy;
