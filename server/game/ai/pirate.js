// Galaxy Miner - Pirate AI Strategy
// Role-specific AI for scouts, fighters, captains, and dreadnoughts

const logger = require('../../../shared/logger');

function idsMatch(left, right) {
  return left !== null && left !== undefined &&
    right !== null && right !== undefined &&
    String(left) === String(right);
}

/**
 * PirateStrategy - Pirates use espionage, raids, and theft
 *
 * NPC Types & States:
 *
 * Scout (pirate_scout):
 * - patrol: Roam sectors away from base looking for targets
 * - espionage: Observed target, remembering coordinates
 * - fleeing: Racing back to base with intel
 * - at_base: Arrived, broadcasting intel to nearby pirates
 *
 * Fighter (pirate_fighter):
 * - patrol: Stay within 300 units of base
 * - raid: Approaching target from intel or direct encounter
 * - circling: Orbiting target at 300 units between attacks
 * - boost_dive: 2.5x speed charge toward target, firing
 * - cooldown: Backing away after attack (4s cooldown)
 *
 * Captain (pirate_captain):
 * - idle: Wait at base for scout intel
 * - raid: Close-range aggressive engagement
 * - flee: Retreating to base at 30% health
 * - healing: Recovering at base (15%/s hull, 20%/s shield)
 *
 * Dreadnought (pirate_dreadnought):
 * - spawning: Brief spawn animation
 * - raid: Combined boost dive + cannon attacks
 * - enraged: Permanent rampage after base destroyed
 *
 * Special mechanics:
 * - All weapons deal 10% damage directly to hull (shield piercing)
 * - Intel broadcast to all pirates within 1000 units
 * - Stealing from scavenger scrapPile and rogue miner claimCredits
 * - Dreadnought 35% damage immunity chance
 */
class PirateStrategy {
  constructor() {
    // Intel system - tracks discovered targets per base
    this.intelReports = new Map(); // baseId -> { targetId, targetType, targetPos, reportedAt, reportedBy }

    // Scout tracking - NPCs with intel to deliver
    this.scoutingNPCs = new Map(); // npcId -> { targetId, targetType, targetPos, discoveredAt }

    // Fighter boost dive tracking
    this.boostDiveNPCs = new Map(); // npcId -> { targetId, startedAt, cooldownUntil, phase }

    // Captain tracking
    this.captainTargets = new Map(); // npcId -> { targetId, spawnedFromIntel }

    // Dreadnought tracking (one per base lifetime)
    this.spawnedDreadnoughts = new Set(); // baseId -> has spawned dreadnought

    // Healing NPCs at base
    this.healingNPCs = new Set();

    // Constants
    this.INTEL_BROADCAST_RANGE = 1000;
    this.INTEL_VALIDITY_DURATION = 30000; // 30 seconds
    this.SCOUT_FLEE_SPEED_MULTIPLIER = 1.5;
    this.SCOUT_PATROL_RADIUS = 800; // Far from base
    this.SCOUT_ESPIONAGE_DURATION = 1000; // 1 second observation
    this.TARGET_MEMORY_DURATION = 10000; // 10 seconds without a live target

    this.FIGHTER_PATROL_RADIUS = 300;
    this.FIGHTER_CIRCLE_RADIUS = 300;
    this.BOOST_DIVE_COOLDOWN = 4000; // 4 seconds
    this.BOOST_DIVE_SPEED_MULTIPLIER = 3.5; // Increased from 2.5 - much faster dive
    this.BOOST_DIVE_DURATION = 2500; // Increased from 1500 - longer dive distance
    this.BOOST_DIVE_FIRE_RANGE = 150; // Fire cannonball at close range

    // All pirates chase targets up to this distance before giving up
    this.RAID_CHASE_DISTANCE = 2500;

    this.CAPTAIN_FLEE_THRESHOLD = 0.3; // 30% health
    this.CAPTAIN_HEAL_RATE_HULL = 0.15; // 15%/sec
    this.CAPTAIN_HEAL_RATE_SHIELD = 0.20; // 20%/sec
    this.CAPTAIN_REENGAGE_THRESHOLD = 0.8; // 80% health

    this.DREADNOUGHT_BASE_HEALTH_TRIGGER = 0.25; // 25%
    this.DREADNOUGHT_INVULN_CHANCE = 0.35; // 35%
    this.DREADNOUGHT_SPAWN_DURATION = 1000; // 1 second spawn animation

    this.SHIELD_PIERCE_AMOUNT = 0.1; // 10% bypasses shields
  }

  /**
   * Classify an intel report without overloading targetPlayer with NPC/base IDs.
   */
  getIntelTargetKind(intel) {
    if (intel?.isBaseTarget) return 'base';
    return intel?.targetType && intel.targetType !== 'player' ? 'npc' : 'player';
  }

  /**
   * Pirates may keep pursuing an acquired player beyond their detection radius,
   * but only while the retained identity is still player-owned. NPC and base
   * raids use the same generic target fields and must not enter this contract.
   */
  getPlayerTargetRetentionRange(npc) {
    if (npc?.targetPlayer === null || npc?.targetPlayer === undefined) return 0;
    // Orphan rage is owned by the generic dispatcher rather than this strategy;
    // it only targets players inside the expanded orphan aggro radius.
    if (npc.orphaned === true && npc.state === 'rage') return 0;

    const hasNpcTarget = npc.targetNPC !== null && npc.targetNPC !== undefined;
    const hasBaseTarget = npc.isRaidingBase === true ||
      (npc.raidBaseId !== null && npc.raidBaseId !== undefined);
    const targetKind = npc.raidTargetType;
    const explicitlyNonPlayer = targetKind !== null && targetKind !== undefined &&
      targetKind !== 'player';

    return hasNpcTarget || hasBaseTarget || explicitlyNonPlayer
      ? 0
      : this.RAID_CHASE_DISTANCE;
  }

  /**
   * Drop strategy-owned player pursuit when the authoritative player set no
   * longer contains that target. Clear auxiliary maps as well so reconnecting
   * with the same account cannot resume an obsolete scout/captain raid.
   */
  clearRetainedPlayerTarget(npc) {
    if (this.getPlayerTargetRetentionRange(npc) <= 0) return false;

    this.scoutingNPCs.delete(npc.id);
    this.boostDiveNPCs.delete(npc.id);
    this.captainTargets.delete(npc.id);
    this.healingNPCs.delete(npc.id);
    npc.isBoosting = false;

    if (npc.type === 'pirate_dreadnought') {
      const nextState = npc.state === 'enraged' ? 'enraged' : 'raid';
      this.clearRaidTarget(npc, nextState);
    } else {
      const nextState = npc.type === 'pirate_captain' ? 'idle' : 'patrol';
      this.clearRaidTarget(npc, nextState);
    }
    return true;
  }

  /**
   * Remove player intel that can outlive npc.targetPlayer. Without this pass a
   * fleeing Scout can deliver obsolete coordinates, causing every Fighter and
   * Captain at the outpost to reacquire a dead or disconnected account.
   */
  pruneMissingPlayerTargetState(livePlayerIds, allNPCs) {
    const liveIds = livePlayerIds instanceof Set ? livePlayerIds : new Set();
    let prunedCount = 0;

    for (const [baseId, intel] of this.intelReports) {
      if (this.getIntelTargetKind(intel) === 'player' &&
          !liveIds.has(String(intel.targetId))) {
        this.intelReports.delete(baseId);
        prunedCount++;
      }
    }

    for (const [npcId, scoutData] of this.scoutingNPCs) {
      if (this.getIntelTargetKind(scoutData) !== 'player' ||
          liveIds.has(String(scoutData.targetId))) {
        continue;
      }

      this.scoutingNPCs.delete(npcId);
      const scout = allNPCs instanceof Map ? allNPCs.get(npcId) : null;
      if (scout) this.clearRaidTarget(scout, 'patrol');
      prunedCount++;
    }

    return prunedCount;
  }

  /**
   * Apply a scout/captain intel target using explicit player/NPC identity fields.
   */
  assignIntelRaidTarget(npc, intel) {
    const targetKind = this.getIntelTargetKind(intel);
    npc.targetPlayer = targetKind === 'player' ? intel.targetId : null;
    npc.targetNPC = targetKind === 'npc' ? intel.targetId : null;
    npc.raidTargetType = targetKind;
    npc.raidTargetPos = intel?.targetPos
      ? { x: intel.targetPos.x, y: intel.targetPos.y }
      : null;
    npc.lastTargetSeenTime = Date.now();
    npc.isRaidingBase = targetKind === 'base';
    npc.raidBaseId = targetKind === 'base' ? intel.targetId : null;
    npc.raidBaseType = targetKind === 'base' ? (intel.baseType || null) : null;
    npc.raidBaseStaleSince = null;
  }

  clearRaidTarget(npc, nextState) {
    npc.state = nextState;
    npc.targetPlayer = null;
    npc.targetNPC = null;
    npc.raidTargetType = null;
    npc.raidTargetPos = null;
    npc.lastTargetSeenTime = null;
    npc.isRaidingBase = false;
    npc.raidBaseId = null;
    npc.raidBaseType = null;
    npc.raidBaseStaleSince = null;
  }

  /**
   * Player snapshots are produced by spatial-hash cell iteration, not distance
   * order. Resolve the nearest live position explicitly before choosing a target.
   */
  findNearestPlayer(npc, nearbyPlayers) {
    if (!npc?.position || !Array.isArray(nearbyPlayers)) return null;

    let nearestPlayer = null;
    let nearestDistance = Infinity;

    for (const player of nearbyPlayers) {
      if (!player?.position) continue;
      const dx = player.position.x - npc.position.x;
      const dy = player.position.y - npc.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (!Number.isFinite(distance) || distance >= nearestDistance) continue;

      nearestPlayer = player;
      nearestDistance = distance;
    }

    return nearestPlayer ? { player: nearestPlayer, distance: nearestDistance } : null;
  }

  clearBaseRaidState(npc) {
    npc.isRaidingBase = false;
    npc.raidBaseId = null;
    npc.raidBaseType = null;
    npc.raidBaseStaleSince = null;
  }

  findLiveRaidBase(npc, context) {
    if (npc.raidBaseId === null || npc.raidBaseId === undefined ||
        !Array.isArray(context?.nearbyBases)) {
      return null;
    }

    return context.nearbyBases.find(base =>
      base && base.id === npc.raidBaseId && base.destroyed !== true
    ) || null;
  }

  baseHasRaidResources(base) {
    if (!base) return false;
    if (base.type === 'scavenger_yard') {
      return Number(base.scrapPile?.count) > 0 ||
        (Array.isArray(base.scrapPile?.contents) && base.scrapPile.contents.length > 0);
    }
    if (base.type === 'mining_claim') {
      return Number(base.claimCredits) > 0;
    }
    return false;
  }

  expireCaptainRaidTarget(npc, targetId = null) {
    const expiredTargetId = targetId ?? npc.raidBaseId ?? npc.targetNPC ?? npc.targetPlayer;
    const currentIntel = this.intelReports.get(npc.homeBaseId);
    if (currentIntel && idsMatch(currentIntel.targetId, expiredTargetId)) {
      npc.ignoredIntelReportedAt = currentIntel.reportedAt;
    } else if (Number.isFinite(npc.activeIntelReportedAt)) {
      npc.ignoredIntelReportedAt = npc.activeIntelReportedAt;
    }

    npc.activeIntelReportedAt = null;
    this.captainTargets.delete(npc.id);
    this.clearRaidTarget(npc, 'idle');
  }

  /**
   * Main update for pirate behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Route to appropriate NPC type handler
    switch (npc.type) {
      case 'pirate_scout':
        return this.updateScout(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
      case 'pirate_fighter':
        return this.updateFighter(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
      case 'pirate_captain':
        return this.updateCaptain(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
      case 'pirate_dreadnought':
        return this.updateDreadnought(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
      default:
        // Fallback to fighter behavior for unknown types
        return this.updateFighter(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
    }
  }

  // ===========================================
  // SCOUT AI
  // ===========================================

  updateScout(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Initialize state if needed
    if (!npc.state || !['patrol', 'espionage', 'fleeing', 'at_base', 'raid'].includes(npc.state)) {
      npc.state = 'patrol';
    }

    switch (npc.state) {
      case 'patrol':
        return this.scoutPatrol(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
      case 'espionage':
        return this.scoutEspionage(npc, nearbyPlayers, deltaTime, context);
      case 'fleeing':
        return this.scoutFlee(npc, deltaTime, context);
      case 'at_base':
        return this.scoutAtBase(npc, nearbyAllies, deltaTime, context);
      case 'raid':
        return this.scoutRaid(npc, nearbyPlayers, deltaTime, context);
      default:
        npc.state = 'patrol';
        return null;
    }
  }

  /**
   * Scout patrols away from base, looking for targets
   */
  scoutPatrol(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    const homeBase = context.homeBase || npc.homeBasePosition;

    // Look for targets: players, rogue_miner NPCs, scavenger NPCs
    const targets = this.findScoutTargets(npc, nearbyPlayers, nearbyAllies, context);

    if (targets.length > 0) {
      // Found target - enter espionage
      const target = targets[0];
      const scoutData = {
        targetId: target.id,
        targetType: target.targetType || 'player',
        targetPos: { x: target.position.x, y: target.position.y },
        discoveredAt: Date.now()
      };

      // For base targets, store additional info for raid coordination
      if (target.baseType) {
        scoutData.isBaseTarget = true;
        scoutData.baseType = target.baseType;
        scoutData.hasResources = target.hasResources;
      }

      this.scoutingNPCs.set(npc.id, scoutData);
      npc.state = 'espionage';
      logger.log(`[PIRATE] Scout ${npc.id} spotted ${target.targetType || 'player'} ${target.id}${target.isBaseTarget ? ' (BASE)' : ''}`);
      return null;
    }

    // Sector-spawned scouts orbit their spawn point; base scouts patrol farther
    // out around their home base. Integrating the orbit directly keeps the
    // waypoint from moving faster than the scout can possibly follow.
    const patrolCenter = homeBase || npc.spawnPoint;
    if (!patrolCenter) {
      this.idleWander(npc, deltaTime);
      return null;
    }

    const patrolRadius = homeBase
      ? this.SCOUT_PATROL_RADIUS
      : Math.min(this.SCOUT_PATROL_RADIUS, context.patrolRadius || 600);
    this.moveInStableOrbit(
      npc,
      patrolCenter,
      patrolRadius,
      npc.speed * 0.5,
      deltaTime,
      { angleKey: 'patrolAngle', radialBias: 0.85 }
    );

    return null;
  }

  /**
   * Scout observes target, then flees
   */
  scoutEspionage(npc, nearbyPlayers, deltaTime, context) {
    const scoutData = this.scoutingNPCs.get(npc.id);
    if (!scoutData) {
      npc.state = 'patrol';
      return null;
    }

    // Observe for 1 second, then flee
    if (Date.now() - scoutData.discoveredAt > this.SCOUT_ESPIONAGE_DURATION) {
      npc.state = 'fleeing';
      logger.log(`[PIRATE] Scout ${npc.id} fleeing with intel on ${scoutData.targetType}`);
      return null;
    }

    // Face target while observing
    const dx = scoutData.targetPos.x - npc.position.x;
    const dy = scoutData.targetPos.y - npc.position.y;
    npc.rotation = Math.atan2(dy, dx);

    return null;
  }

  /**
   * Scout flees to nearest pirate base
   */
  scoutFlee(npc, deltaTime, context) {
    let homeBase = context.homeBase || npc.homeBasePosition;

    // If home base is unavailable (destroyed), find nearest pirate base
    if (!homeBase) {
      const nearestBase = this.findNearestPirateBase(npc, context);
      if (nearestBase) {
        homeBase = nearestBase;
        // Update NPC's home base reference to the new base
        npc.homeBaseId = nearestBase.id;
        npc.homeBasePosition = { x: nearestBase.x, y: nearestBase.y };
        logger.log(`[PIRATE] Scout ${npc.id} reassigned to nearest base ${nearestBase.id}`);
      } else {
        // No pirate base available - scout goes rogue with intel
        const scoutData = this.scoutingNPCs.get(npc.id);
        if (scoutData) {
          // Enter raid mode directly instead of losing intel
          this.assignIntelRaidTarget(npc, scoutData);
          npc.state = 'raid';
          logger.log(`[PIRATE] Scout ${npc.id} going rogue - raiding target directly`);
          return null;
        }
        // No intel and no base - return to patrol
        npc.state = 'patrol';
        return null;
      }
    }

    const dx = homeBase.x - npc.position.x;
    const dy = homeBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Safety check for invalid coordinates
    if (!isFinite(dx) || !isFinite(dy) || !isFinite(dist)) {
      logger.warn(`[PIRATE] Scout ${npc.id} has invalid base coordinates, entering raid mode`);
      const scoutData = this.scoutingNPCs.get(npc.id);
      if (scoutData) {
        this.assignIntelRaidTarget(npc, scoutData);
        npc.state = 'raid';
      } else {
        npc.state = 'patrol';
      }
      return null;
    }

    if (dist < 100) {
      // Arrived at base
      npc.state = 'at_base';
      return null;
    }

    // Flee at boosted speed
    const fleeSpeed = npc.speed * this.SCOUT_FLEE_SPEED_MULTIPLIER * (deltaTime / 1000);
    npc.rotation = Math.atan2(dy, dx);
    npc.position.x += (dx / dist) * fleeSpeed;
    npc.position.y += (dy / dist) * fleeSpeed;

    return null;
  }

  /**
   * Find the nearest active pirate base to the NPC
   * @param {Object} npc - The NPC searching for a base
   * @param {Object} context - AI context with allNPCs
   * @returns {Object|null} Nearest pirate base or null
   */
  findNearestPirateBase(npc, context) {
    // Lazy require to avoid circular dependency
    const npcModule = require('../npc');

    // Get all active pirate bases
    const pirateBases = npcModule.getActiveBasesByFaction('pirate');
    if (!pirateBases || pirateBases.length === 0) {
      return null;
    }

    let nearestBase = null;
    let nearestDist = Infinity;

    for (const base of pirateBases) {
      if (base.destroyed) continue;

      const dx = base.x - npc.position.x;
      const dy = base.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBase = base;
      }
    }

    return nearestBase;
  }

  /**
   * Scout arrives at base, broadcasts intel to nearby pirates
   * Spawns a captain and then joins the raid
   */
  scoutAtBase(npc, nearbyAllies, deltaTime, context) {
    const scoutData = this.scoutingNPCs.get(npc.id);
    if (scoutData) {
      // Store intel at base
      const baseId = npc.homeBaseId;
      const intel = {
        targetId: scoutData.targetId,
        targetType: scoutData.targetType,
        targetPos: scoutData.targetPos,
        reportedAt: Date.now(),
        reportedBy: npc.id,
        // Include base target info for captain raids
        isBaseTarget: scoutData.isBaseTarget || false,
        baseType: scoutData.baseType || null,
        hasResources: scoutData.hasResources || false
      };

      this.intelReports.set(baseId, intel);
      this.scoutingNPCs.delete(npc.id);

      const targetDesc = intel.isBaseTarget ? `${intel.baseType} base` : intel.targetType;
      logger.log(`[PIRATE] Scout ${npc.id} delivered intel at base ${baseId}: ${targetDesc}`);

      // Spawn a captain in response to intel (lazy require to avoid circular dependency)
      const npcModule = require('../npc');
      const captain = npcModule.spawnCaptainFromIntel(baseId, intel);
      if (captain) {
        logger.log(`[PIRATE] Scout ${npc.id} triggered captain ${captain.id} spawn`);
      }

      // Scout joins the raid instead of returning to patrol
      this.assignIntelRaidTarget(npc, intel);
      npc.state = 'raid';
      logger.log(`[PIRATE] Scout ${npc.id} joining raid against ${intel.targetType}`);

      const alertedPirateIds = new Set();
      if (context.allNPCs instanceof Map) {
        for (const [allyId, ally] of context.allNPCs) {
          if (allyId === npc.id || ally.faction !== 'pirate' || !ally.position) continue;
          const dx = ally.position.x - npc.position.x;
          const dy = ally.position.y - npc.position.y;
          if (Math.sqrt(dx * dx + dy * dy) <= this.INTEL_BROADCAST_RANGE) {
            alertedPirateIds.add(allyId);
          }
        }
      } else {
        // Direct strategy callers may only have the prefiltered ally list.
        for (const ally of nearbyAllies) {
          if (!Number.isFinite(ally.distance) || ally.distance <= this.INTEL_BROADCAST_RANGE) {
            alertedPirateIds.add(ally.id);
          }
        }
      }
      const alertedPirates = Array.from(alertedPirateIds);

      return {
        action: 'pirate:intelBroadcast',
        npcId: npc.id,
        baseId: baseId,
        targetInfo: intel,
        alertedPirates,
        // Retain the original field for strategy consumers that read the
        // complete intel report directly.
        intel: intel,
        broadcastRange: this.INTEL_BROADCAST_RANGE,
        captainSpawned: captain ? captain.id : null
      };
    }

    // No intel, return to patrol
    npc.state = 'patrol';
    return null;
  }

  /**
   * Scout joins the raid after delivering intel
   * Uses light blaster at range, supports fighters/captains
   */
  scoutRaid(npc, nearbyPlayers, deltaTime, context) {
    const now = Date.now();
    const playerTarget = npc.targetPlayer === null || npc.targetPlayer === undefined
      ? null
      : nearbyPlayers.find(player => String(player.id) === String(npc.targetPlayer));
    const legacyNpcTargetId = npc.raidTargetType === 'npc' ? npc.targetPlayer : null;
    const npcTargetId = npc.targetNPC ?? legacyNpcTargetId;
    const candidateNpcTarget = npcTargetId !== null && npcTargetId !== undefined &&
      context.allNPCs instanceof Map
      ? context.allNPCs.get(npcTargetId)
      : null;
    const npcTarget = candidateNpcTarget && candidateNpcTarget !== npc &&
      Number(candidateNpcTarget.hull) > 0
      ? candidateNpcTarget
      : null;
    const target = playerTarget || npcTarget;

    if (target) {
      npc.raidTargetPos = { x: target.position.x, y: target.position.y };
      npc.lastTargetSeenTime = now;
      if (npcTarget) {
        npc.targetNPC = npcTarget.id;
        npc.targetPlayer = null;
        npc.raidTargetType = 'npc';
      }
    } else if (!Number.isFinite(npc.lastTargetSeenTime)) {
      // Non-player targets and retaliation targets do not appear in
      // nearbyPlayers. Start a real, persistent memory window for them.
      npc.lastTargetSeenTime = now;
    } else if (now - npc.lastTargetSeenTime >= this.TARGET_MEMORY_DURATION) {
      this.clearRaidTarget(npc, 'patrol');
      return null;
    }

    const targetPos = target ? target.position : npc.raidTargetPos;

    // A damage reaction may know the attacker ID one tick before the attacker
    // is in the nearby-player snapshot. Keep the reaction alive for the same
    // bounded target-memory window instead of immediately cancelling it.
    if (!targetPos) {
      return null;
    }

    // Check if target is too far away (chase distance limit)
    const chaseDistX = targetPos.x - npc.position.x;
    const chaseDistY = targetPos.y - npc.position.y;
    const chaseDist = Math.sqrt(chaseDistX * chaseDistX + chaseDistY * chaseDistY);
    if (chaseDist > this.RAID_CHASE_DISTANCE) {
      this.clearRaidTarget(npc, 'patrol');
      logger.log(`[PIRATE] Scout ${npc.id} lost target - too far (${Math.round(chaseDist)} units)`);
      return null;
    }

    // Stay comfortably inside the configured weapon range. The old fixed
    // 400-unit orbit could never fire the scout's 200-unit light blaster.
    const weaponRange = Number.isFinite(npc.weaponRange) ? Math.max(0, npc.weaponRange) : 0;
    const optimalRange = weaponRange * 0.75;
    this.moveInStableOrbit(
      npc,
      targetPos,
      optimalRange,
      npc.speed * 0.8,
      deltaTime,
      { angleKey: 'patrolAngle', radialBias: 0.95, faceCenter: true }
    );

    const fireDx = targetPos.x - npc.position.x;
    const fireDy = targetPos.y - npc.position.y;
    const fireDist = Math.sqrt(fireDx * fireDx + fireDy * fireDy);

    // Fire the light blaster at either a live player or an authoritative NPC.
    if (target && fireDist <= weaponRange) {
      const fireCooldown = 1500; // Scouts fire slower
      if (now - (npc.lastFireTime || 0) >= fireCooldown) {
        npc.lastFireTime = now;
        return {
          action: 'fire',
          target: target,
          weaponType: 'pirate_light_blaster',
          baseDamage: npc.weaponDamage
        };
      }
    }

    return null;
  }

  // ===========================================
  // FIGHTER AI
  // ===========================================

  updateFighter(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Initialize state if needed
    if (!npc.state || !['patrol', 'raid', 'circling', 'boost_dive', 'cooldown'].includes(npc.state)) {
      npc.state = 'patrol';
    }

    switch (npc.state) {
      case 'patrol':
        return this.fighterPatrol(npc, nearbyPlayers, deltaTime, context);
      case 'raid':
        return this.fighterRaid(npc, nearbyPlayers, deltaTime, context);
      case 'circling':
        return this.fighterCircle(npc, nearbyPlayers, deltaTime, context);
      case 'boost_dive':
        return this.fighterBoostDive(npc, nearbyPlayers, deltaTime, context);
      case 'cooldown':
        return this.fighterCooldown(npc, nearbyPlayers, deltaTime, context);
      default:
        npc.state = 'patrol';
        return null;
    }
  }

  /**
   * Fighter patrols within 300 units of base
   */
  fighterPatrol(npc, nearbyPlayers, deltaTime, context) {
    const homeBase = context.homeBase || npc.homeBasePosition;

    // Check for direct encounters
    const nearestPlayer = this.findNearestPlayer(npc, nearbyPlayers);
    if (nearestPlayer) {
      const target = nearestPlayer.player;
      this.clearBaseRaidState(npc);
      npc.targetPlayer = target.id;
      npc.targetNPC = null;
      npc.raidTargetType = 'player';
      npc.raidTargetPos = { x: target.position.x, y: target.position.y };
      const wasPatrol = npc.state === 'patrol';
      npc.state = 'raid';
      // Only log on state transition, not on re-entry from brief interruptions
      if (wasPatrol && npc.lastRaidTarget !== target.id) {
        logger.log(`[PIRATE] Fighter ${npc.id} spotted player ${target.id}`);
        npc.lastRaidTarget = target.id;
      }
      return null;
    }

    // Check for intel from scouts
    const intel = this.intelReports.get(npc.homeBaseId);
    if (intel && Date.now() - intel.reportedAt < this.INTEL_VALIDITY_DURATION) {
      this.assignIntelRaidTarget(npc, intel);
      const wasPatrol = npc.state === 'patrol';
      npc.state = 'raid';
      // Only log on state transition for new intel targets
      if (wasPatrol && npc.lastIntelTarget !== intel.targetId) {
        logger.log(`[PIRATE] Fighter ${npc.id} received intel, raiding ${intel.targetType}`);
        npc.lastIntelTarget = intel.targetId;
      }
      return null;
    }

    // Base fighters patrol their outpost; sector fighters stay bounded around
    // their spawn point instead of repeatedly chasing a moving waypoint.
    const patrolCenter = homeBase || npc.spawnPoint;
    if (!patrolCenter) {
      this.idleWander(npc, deltaTime);
      return null;
    }

    this.moveInStableOrbit(
      npc,
      patrolCenter,
      this.FIGHTER_PATROL_RADIUS,
      npc.speed * 0.4,
      deltaTime,
      { angleKey: 'patrolAngle', radialBias: 0.8 }
    );

    return null;
  }

  /**
   * Fighter approaches target, then enters circling
   * Also checks for stealing opportunities along the way
   * Fighters engage players first, then enemy NPC defenders
   */
  fighterRaid(npc, nearbyPlayers, deltaTime, context) {
    // Check for stealing opportunities while raiding
    const stealAction = this.trySteal(npc, context);
    if (stealAction) {
      return stealAction;
    }

    // Priority 1: Players always take priority
    let target = nearbyPlayers.find(p => idsMatch(p?.id, npc.targetPlayer));
    let targetPos = target ? target.position : null;
    let targetIsNPC = false;

    // Priority 2: If no player target, look for enemy NPC defenders
    if (!target && !targetPos && context.allNPCs) {
      // Find nearest enemy NPC within engagement range
      let nearestDefender = null;
      let nearestDist = npc.aggroRange;

      for (const [npcId, otherNpc] of context.allNPCs) {
        if (otherNpc.faction !== 'scavenger' && otherNpc.faction !== 'rogue_miner') continue;

        const dx = otherNpc.position.x - npc.position.x;
        const dy = otherNpc.position.y - npc.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestDefender = otherNpc;
        }
      }

      if (nearestDefender) {
        target = { ...nearestDefender, distance: nearestDist };
        targetPos = nearestDefender.position;
        targetIsNPC = true;
        this.clearBaseRaidState(npc);
        npc.targetNPC = nearestDefender.id;
        npc.targetPlayer = null;
        npc.raidTargetType = 'npc';
      }
    }

    // Fallback to stored raid position
    if (!targetPos) {
      targetPos = npc.raidTargetPos;
    }

    if (!targetPos) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      npc.targetNPC = null;
      // Clear target tracking to allow re-logging on new encounter
      npc.lastRaidTarget = null;
      npc.lastIntelTarget = null;
      return null;
    }

    // Check if target is too far away (chase distance limit)
    const chaseDistX = targetPos.x - npc.position.x;
    const chaseDistY = targetPos.y - npc.position.y;
    const chaseDist = Math.sqrt(chaseDistX * chaseDistX + chaseDistY * chaseDistY);
    if (chaseDist > this.RAID_CHASE_DISTANCE) {
      const hadActiveTarget = npc.targetPlayer || npc.targetNPC;
      npc.state = 'patrol';
      npc.targetPlayer = null;
      npc.targetNPC = null;
      // Clear target tracking to allow re-logging on new encounter
      npc.lastRaidTarget = null;
      npc.lastIntelTarget = null;
      // Only log if we actually had an active target (not just stale coordinates)
      if (hadActiveTarget) {
        logger.log(`[PIRATE] Fighter ${npc.id} lost target - too far (${Math.round(chaseDist)} units)`);
      }
      return null;
    }

    // Update target position if we have a live target
    if (target) {
      npc.raidTargetPos = { x: targetPos.x, y: targetPos.y };
    }

    const dx = targetPos.x - npc.position.x;
    const dy = targetPos.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Player raids transition into the boost-dive orbit. NPC defenders instead
    // need a closing distance derived from the actual weapon range; using the
    // 350-unit orbit threshold strands a 280-range fighter unable to fire.
    const closingRange = targetIsNPC
      ? Math.max(0, npc.weaponRange * 0.8)
      : this.FIGHTER_CIRCLE_RADIUS + 50;
    if (dist > closingRange) {
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.rotation = Math.atan2(dy, dx);
      const travelDistance = Math.min(moveSpeed, Math.max(0, dist - closingRange));
      if (dist > 0 && travelDistance > 0) {
        npc.position.x += (dx / dist) * travelDistance;
        npc.position.y += (dy / dist) * travelDistance;
      }

      // If targeting an NPC defender, fire while approaching
      if (targetIsNPC && target) {
        return this.tryFireWithShieldPiercing(npc, target);
      }

      return null;
    }

    // In range - start circling (for player targets) or keep fighting (for NPC targets)
    if (targetIsNPC) {
      // Keep engaging NPC defenders directly
      return this.tryFireWithShieldPiercing(npc, target);
    }

    npc.state = 'circling';
    npc.circleAngle = Math.atan2(npc.position.y - targetPos.y, npc.position.x - targetPos.x);

    // Initialize boost dive tracking
    if (!this.boostDiveNPCs.has(npc.id)) {
      this.boostDiveNPCs.set(npc.id, {
        targetId: npc.targetPlayer,
        startedAt: 0,
        cooldownUntil: 0, // Ready to dive immediately
        phase: 'ready'
      });
    }

    return null;
  }

  /**
   * Fighter circles target at 300 units, waiting for boost dive opportunity
   */
  fighterCircle(npc, nearbyPlayers, deltaTime, context) {
    const target = nearbyPlayers.find(p => idsMatch(p?.id, npc.targetPlayer));
    const targetPos = target ? target.position : npc.raidTargetPos;

    if (!target || !targetPos) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      return null;
    }

    // Check if target is too far away (chase distance limit)
    const chaseDistX = targetPos.x - npc.position.x;
    const chaseDistY = targetPos.y - npc.position.y;
    const chaseDist = Math.sqrt(chaseDistX * chaseDistX + chaseDistY * chaseDistY);
    if (chaseDist > this.RAID_CHASE_DISTANCE) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      logger.log(`[PIRATE] Fighter ${npc.id} broke off circling - target too far (${Math.round(chaseDist)} units)`);
      return null;
    }

    // Check if can boost dive
    const boostData = this.boostDiveNPCs.get(npc.id);
    if (!boostData || Date.now() > boostData.cooldownUntil) {
      // Ready to boost dive
      npc.state = 'boost_dive';
      npc.isBoosting = true;
      this.boostDiveNPCs.set(npc.id, {
        targetId: target.id,
        startedAt: Date.now(),
        cooldownUntil: 0,
        phase: 'diving'
      });

      logger.log(`[PIRATE] Fighter ${npc.id} initiating boost dive`);

      return {
        action: 'pirate:boostDive',
        npcId: npc.id,
        startX: npc.position.x,
        startY: npc.position.y,
        targetX: target.position.x,
        targetY: target.position.y,
        speedMultiplier: this.BOOST_DIVE_SPEED_MULTIPLIER,
        duration: this.BOOST_DIVE_DURATION,
        // Legacy aliases retained for direct strategy consumers.
        fromX: npc.position.x,
        fromY: npc.position.y,
        toX: target.position.x,
        toY: target.position.y
      };
    }

    // Continue circling with a bounded displacement. This integrates radial
    // correction and tangential motion together, so the orbit point cannot
    // outrun the fighter.
    this.moveInStableOrbit(
      npc,
      target.position,
      this.FIGHTER_CIRCLE_RADIUS,
      npc.speed * 0.8,
      deltaTime,
      { angleKey: 'circleAngle', radialBias: 0.8, faceCenter: true }
    );

    return null;
  }

  /**
   * Fighter boost dives toward target, fires, then backs away
   */
  fighterBoostDive(npc, nearbyPlayers, deltaTime, context) {
    const boostData = this.boostDiveNPCs.get(npc.id);
    const boostTargetId = boostData?.targetId ?? npc.targetPlayer;
    const target = nearbyPlayers.find(p => idsMatch(p?.id, boostTargetId));

    if (!target || !boostData) {
      npc.state = 'patrol';
      npc.isBoosting = false;
      return null;
    }

    // Check if dive has exceeded max duration
    if (Date.now() - boostData.startedAt > this.BOOST_DIVE_DURATION) {
      // Time's up, transition to cooldown
      boostData.cooldownUntil = Date.now() + this.BOOST_DIVE_COOLDOWN;
      boostData.phase = 'cooldown';
      npc.state = 'cooldown';
      npc.isBoosting = false;
      return null;
    }

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Fire cannonball at very close range for maximum impact
    if (dist <= this.BOOST_DIVE_FIRE_RANGE) {
      // Set cooldown and transition to cooldown state
      boostData.cooldownUntil = Date.now() + this.BOOST_DIVE_COOLDOWN;
      boostData.phase = 'cooldown';
      npc.state = 'cooldown';
      npc.isBoosting = false;

      // Fire a cannonball during boost dive for devastating close-range impact
      return {
        action: 'fire',
        target,
        weaponType: 'pirate_cannon', // Cannonball instead of blaster
        weaponTier: npc.weaponTier + 1, // Bonus tier for boost dive
        baseDamage: npc.weaponDamage * 1.5, // 50% damage bonus for successful dive
        shieldPiercing: this.SHIELD_PIERCE_AMOUNT
      };
    }

    // Boost toward target without dividing by zero or stepping beyond it on a
    // delayed tick.
    const boostSpeed = npc.speed * this.BOOST_DIVE_SPEED_MULTIPLIER * (deltaTime / 1000);
    const travelDistance = Math.min(boostSpeed, dist);
    if (dist > 0 && travelDistance > 0) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * travelDistance;
      npc.position.y += (dy / dist) * travelDistance;
    }

    return null;
  }

  /**
   * Fighter backs away during cooldown
   */
  fighterCooldown(npc, nearbyPlayers, deltaTime, context) {
    const boostData = this.boostDiveNPCs.get(npc.id);
    const target = nearbyPlayers.find(p => idsMatch(p?.id, npc.targetPlayer));

    // Check if target eliminated
    if (!target) {
      // Target eliminated - return to patrol
      npc.state = 'patrol';
      npc.targetPlayer = null;
      return null;
    }

    // Check if cooldown complete
    if (boostData && Date.now() > boostData.cooldownUntil) {
      npc.state = 'circling';
      return null;
    }

    // Back away from target
    const dx = npc.position.x - target.position.x;
    const dy = npc.position.y - target.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0 && dist < this.FIGHTER_CIRCLE_RADIUS) {
      const retreatSpeed = npc.speed * 0.8 * (deltaTime / 1000);
      npc.position.x += (dx / dist) * retreatSpeed;
      npc.position.y += (dy / dist) * retreatSpeed;
    }

    // Keep facing target
    npc.rotation = Math.atan2(-dy, -dx);

    return null;
  }

  // ===========================================
  // CAPTAIN AI
  // ===========================================

  updateCaptain(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Initialize state if needed
    if (!npc.state || !['idle', 'raid', 'flee', 'healing'].includes(npc.state)) {
      npc.state = 'idle';
    }

    switch (npc.state) {
      case 'idle':
        return this.captainIdle(npc, nearbyPlayers, deltaTime, context);
      case 'raid':
        return this.captainRaid(npc, nearbyPlayers, deltaTime, context);
      case 'flee':
        return this.captainFlee(npc, deltaTime, context);
      case 'healing':
        return this.captainHeal(npc, deltaTime, context);
      default:
        npc.state = 'idle';
        return null;
    }
  }

  /**
   * Captain idles at base until scout returns with intel
   */
  captainIdle(npc, nearbyPlayers, deltaTime, context) {
    // Check for intel
    const intel = this.intelReports.get(npc.homeBaseId);

    if (intel && Date.now() - intel.reportedAt < this.INTEL_VALIDITY_DURATION &&
        intel.reportedAt !== npc.ignoredIntelReportedAt) {
      // Scout reported - enter raid
      this.assignIntelRaidTarget(npc, intel);
      npc.activeIntelReportedAt = intel.reportedAt;
      this.captainTargets.set(npc.id, {
        targetId: intel.targetId,
        spawnedFromIntel: true
      });
      const wasIdle = npc.state === 'idle';
      npc.state = 'raid';
      // Only log on state transition for new targets
      if (wasIdle && npc.lastIntelTarget !== intel.targetId) {
        logger.log(`[PIRATE] Captain ${npc.id} responding to intel, raiding ${intel.targetType}`);
        npc.lastIntelTarget = intel.targetId;
      }
      return null;
    }

    // Check for direct encounters
    const nearestPlayer = this.findNearestPlayer(npc, nearbyPlayers);
    if (nearestPlayer) {
      const target = nearestPlayer.player;
      npc.targetPlayer = target.id;
      npc.targetNPC = null;
      npc.raidTargetType = 'player';
      npc.raidTargetPos = { x: target.position.x, y: target.position.y };
      npc.lastTargetSeenTime = Date.now();
      npc.activeIntelReportedAt = null;
      this.clearBaseRaidState(npc);
      const wasIdle = npc.state === 'idle';
      npc.state = 'raid';
      // Only log on state transition for new targets
      if (wasIdle && npc.lastRaidTarget !== target.id) {
        logger.log(`[PIRATE] Captain ${npc.id} spotted player ${target.id}`);
        npc.lastRaidTarget = target.id;
      }
      return null;
    }

    // Stay near base
    const homeBase = context.homeBase || npc.homeBasePosition;
    if (homeBase) {
      const dx = homeBase.x - npc.position.x;
      const dy = homeBase.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 150) {
        const moveSpeed = npc.speed * 0.3 * (deltaTime / 1000);
        npc.rotation = Math.atan2(dy, dx);
        npc.position.x += (dx / dist) * moveSpeed;
        npc.position.y += (dy / dist) * moveSpeed;
      }
    }

    return null;
  }

  /**
   * Captain aggressively engages target at close range
   * Also checks for stealing opportunities
   */
  captainRaid(npc, nearbyPlayers, deltaTime, context) {
    const now = Date.now();

    // Check health for flee
    const healthPercent = npc.hull / npc.hullMax;
    if (healthPercent <= this.CAPTAIN_FLEE_THRESHOLD) {
      npc.state = 'flee';
      logger.log(`[PIRATE] Captain ${npc.id} fleeing at ${Math.round(healthPercent * 100)}% health`);
      return null;
    }

    // PRIORITY 1: Players always take highest priority - engage if nearby
    const nearestPlayerResult = this.findNearestPlayer(npc, nearbyPlayers);
    if (nearestPlayerResult) {
      const nearestPlayer = nearestPlayerResult.player;
      // Update target to player, interrupting base raid
      npc.targetPlayer = nearestPlayer.id;
      npc.targetNPC = null;
      npc.raidTargetType = 'player';
      npc.raidTargetPos = { x: nearestPlayer.position.x, y: nearestPlayer.position.y };
      npc.lastTargetSeenTime = now;
      npc.activeIntelReportedAt = null;
      this.clearBaseRaidState(npc);

      const dx = nearestPlayer.position.x - npc.position.x;
      const dy = nearestPlayer.position.y - npc.position.y;
      const dist = nearestPlayerResult.distance;

      npc.rotation = Math.atan2(dy, dx);

      // Chase player at close range
      const optimalRange = npc.weaponRange * 0.6;
      if (dist > optimalRange) {
        const moveSpeed = npc.speed * (deltaTime / 1000);
        npc.position.x += (dx / dist) * moveSpeed;
        npc.position.y += (dy / dist) * moveSpeed;
      }

      // Fire at player
      return this.tryFireWithShieldPiercing(npc, nearestPlayer);
    }

    // PRIORITY 2: Try to steal from nearby bases - captains prioritize stealing
    const stealAction = this.trySteal(npc, context);
    if (stealAction) {
      return stealAction;
    }

    // PRIORITY 3: If raiding a base, move toward it to steal
    if (npc.isRaidingBase && npc.raidTargetPos) {
      const raidBaseId = npc.raidBaseId;
      const hasBaseSnapshot = Array.isArray(context.nearbyBases);
      const liveRaidBase = this.findLiveRaidBase(npc, context);

      if (liveRaidBase) {
        npc.targetPlayer = null;
        npc.targetNPC = null;
        npc.raidTargetType = 'base';
        npc.raidBaseType = liveRaidBase.type || npc.raidBaseType;
        npc.raidTargetPos = { x: liveRaidBase.x, y: liveRaidBase.y };
        npc.lastTargetSeenTime = now;
      }

      const dx = npc.raidTargetPos.x - npc.position.x;
      const dy = npc.raidTargetPos.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const baseHasResources = this.baseHasRaidResources(liveRaidBase);

      // The base query is authoritative at the reported coordinates. Once the
      // captain arrives, an absent or exhausted base gets a bounded grace period
      // for defenders to appear instead of pinning the captain there forever.
      if (dist <= this.STEAL_RANGE && hasBaseSnapshot &&
          (!liveRaidBase || !baseHasResources)) {
        if (!Number.isFinite(npc.raidBaseStaleSince)) {
          npc.raidBaseStaleSince = now;
        }
      } else if (liveRaidBase && baseHasResources) {
        npc.raidBaseStaleSince = null;
      }

      // Check if too far from base (gave up) before spending movement on it.
      if (dist > this.RAID_CHASE_DISTANCE) {
        this.expireCaptainRaidTarget(npc, raidBaseId);
        logger.log(`[PIRATE] Captain ${npc.id} gave up base raid - too far (${Math.round(dist)} units)`);
        return null;
      }

      // If we're at the base but couldn't steal (no resources?), switch to fighting defenders
      if (dist <= this.STEAL_RANGE) {
        // Look for enemy NPCs near the base to fight
        const defenderAction = this.findAndEngageDefenders(npc, deltaTime, context);
        if (defenderAction || !npc.isRaidingBase) return defenderAction;

        if (Number.isFinite(npc.raidBaseStaleSince) &&
            now - npc.raidBaseStaleSince >= this.TARGET_MEMORY_DURATION) {
          this.expireCaptainRaidTarget(npc, raidBaseId);
          return null;
        }

        return null;
      }

      // Move toward base
      npc.rotation = Math.atan2(dy, dx);
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;

      return null;
    }

    // PRIORITY 4: If targeting an NPC (not base), engage it
    if (!npc.raidTargetType) {
      // Captains spawned directly by npc.js predate explicit target-kind fields.
      // Hydrate them once from the base's authoritative intel report.
      const intel = this.intelReports.get(npc.homeBaseId);
      if (intel && (idsMatch(intel.targetId, npc.targetPlayer) ||
                    idsMatch(intel.targetId, npc.targetNPC))) {
        this.assignIntelRaidTarget(npc, intel);
        npc.activeIntelReportedAt = intel.reportedAt;
      }
    }

    const liveNpcTarget = npc.targetNPC !== null && npc.targetNPC !== undefined &&
      context.allNPCs instanceof Map
      ? context.allNPCs.get(npc.targetNPC)
      : null;
    if (liveNpcTarget && liveNpcTarget !== npc && Number(liveNpcTarget.hull) > 0) {
      npc.raidTargetPos = {
        x: liveNpcTarget.position.x,
        y: liveNpcTarget.position.y
      };
      npc.lastTargetSeenTime = now;
    } else if (!Number.isFinite(npc.lastTargetSeenTime)) {
      npc.lastTargetSeenTime = now;
    } else if (now - npc.lastTargetSeenTime >= this.TARGET_MEMORY_DURATION) {
      this.expireCaptainRaidTarget(npc);
      return null;
    }

    const targetPos = npc.raidTargetPos;
    if (!targetPos) {
      // A retaliation hook can identify a player one tick before that player is
      // present in nearbyPlayers. Preserve the bounded memory window.
      return null;
    }

    const dx = targetPos.x - npc.position.x;
    const dy = targetPos.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if target is too far away (chase distance limit)
    if (dist > this.RAID_CHASE_DISTANCE) {
      this.expireCaptainRaidTarget(npc);
      logger.log(`[PIRATE] Captain ${npc.id} lost target - too far (${Math.round(dist)} units)`);
      return null;
    }

    npc.rotation = Math.atan2(dy, dx);

    // Close range engagement (60% of weapon range)
    const optimalRange = npc.weaponRange * 0.6;
    if (dist > optimalRange) {
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }

    // Look for defenders near target position
    return this.findAndEngageDefenders(npc, deltaTime, context);
  }

  /**
   * Find and engage enemy faction NPCs (defenders) near the captain's position
   */
  findAndEngageDefenders(npc, deltaTime, context) {
    if (!context.allNPCs) return null;

    // Find nearest enemy NPC to fight
    let nearestDefender = null;
    let nearestDist = npc.weaponRange * 1.5; // Engagement range

    for (const [npcId, otherNpc] of context.allNPCs) {
      if (otherNpc.faction !== 'scavenger' && otherNpc.faction !== 'rogue_miner') continue;

      const dx = otherNpc.position.x - npc.position.x;
      const dy = otherNpc.position.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestDefender = { ...otherNpc, distance: dist };
      }
    }

    if (nearestDefender) {
      this.clearBaseRaidState(npc);
      npc.targetNPC = nearestDefender.id;
      npc.targetPlayer = null;
      npc.raidTargetType = 'npc';
      npc.raidTargetPos = {
        x: nearestDefender.position.x,
        y: nearestDefender.position.y
      };
      npc.lastTargetSeenTime = Date.now();
      const dx = nearestDefender.position.x - npc.position.x;
      const dy = nearestDefender.position.y - npc.position.y;

      npc.rotation = Math.atan2(dy, dx);

      // Move closer if needed
      if (nearestDist > npc.weaponRange * 0.6) {
        const moveSpeed = npc.speed * (deltaTime / 1000);
        npc.position.x += (dx / nearestDist) * moveSpeed;
        npc.position.y += (dy / nearestDist) * moveSpeed;
      }

      // Fire at defender
      return this.tryFireWithShieldPiercing(npc, nearestDefender);
    }

    return null;
  }

  /**
   * Captain flees to base at 30% health
   */
  captainFlee(npc, deltaTime, context) {
    const homeBase = context.homeBase || npc.homeBasePosition;
    if (!homeBase) {
      npc.state = 'raid'; // No base to flee to, fight to death
      return null;
    }

    const dx = homeBase.x - npc.position.x;
    const dy = homeBase.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 100) {
      npc.state = 'healing';
      this.healingNPCs.add(npc.id);
      logger.log(`[PIRATE] Captain ${npc.id} reached base, healing`);
      return null;
    }

    const fleeSpeed = npc.speed * 1.3 * (deltaTime / 1000);
    npc.rotation = Math.atan2(dy, dx);
    npc.position.x += (dx / dist) * fleeSpeed;
    npc.position.y += (dy / dist) * fleeSpeed;

    return null;
  }

  /**
   * Captain heals at base
   */
  captainHeal(npc, deltaTime, context) {
    // Heal hull and shield
    const hullHeal = npc.hullMax * this.CAPTAIN_HEAL_RATE_HULL * (deltaTime / 1000);
    const shieldHeal = (npc.shieldMax || 0) * this.CAPTAIN_HEAL_RATE_SHIELD * (deltaTime / 1000);

    npc.hull = Math.min(npc.hullMax, npc.hull + hullHeal);
    if (npc.shieldMax) {
      npc.shield = Math.min(npc.shieldMax, (npc.shield || 0) + shieldHeal);
    }

    // Check if healed enough to re-engage
    const healthPercent = npc.hull / npc.hullMax;
    if (healthPercent >= this.CAPTAIN_REENGAGE_THRESHOLD) {
      this.healingNPCs.delete(npc.id);

      // Check if original target still valid via intel
      const captainData = this.captainTargets.get(npc.id);
      if (captainData?.targetId) {
        npc.targetPlayer = captainData.targetId;
        npc.state = 'raid';
        logger.log(`[PIRATE] Captain ${npc.id} healed to ${Math.round(healthPercent * 100)}%, re-engaging`);
      } else {
        npc.state = 'idle';
      }
    }

    return {
      action: 'pirate:captainHeal',
      npcId: npc.id,
      x: npc.position.x,
      y: npc.position.y,
      healRate: this.CAPTAIN_HEAL_RATE_HULL,
      shieldHealRate: this.CAPTAIN_HEAL_RATE_SHIELD
    };
  }

  // ===========================================
  // DREADNOUGHT AI
  // ===========================================

  updateDreadnought(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Initialize state if needed
    if (!npc.state || !['spawning', 'raid', 'enraged'].includes(npc.state)) {
      npc.state = 'spawning';
    }

    switch (npc.state) {
      case 'spawning':
        return this.dreadnoughtSpawn(npc, deltaTime, context);
      case 'raid':
        return this.dreadnoughtRaid(npc, nearbyPlayers, deltaTime, context);
      case 'enraged':
        return this.dreadnoughtEnraged(npc, nearbyPlayers, deltaTime, context);
      default:
        npc.state = 'raid';
        return null;
    }
  }

  /**
   * Dreadnought spawn animation state
   */
  dreadnoughtSpawn(npc, deltaTime, context) {
    // Brief spawn animation (1 second)
    if (!npc.spawnStartTime) {
      npc.spawnStartTime = Date.now();
    }

    if (Date.now() - npc.spawnStartTime > this.DREADNOUGHT_SPAWN_DURATION) {
      npc.state = 'raid';
      logger.log(`[PIRATE] Dreadnought ${npc.id} spawn complete, entering raid mode`);
    }

    return null;
  }

  /**
   * Dreadnought raids nearest player
   * Maintains optimal engagement distance (600 units) and circles while firing
   */
  dreadnoughtRaid(npc, nearbyPlayers, deltaTime, context) {
    // Check if base destroyed - enter permanent enraged mode
    const base = context.homeBase;
    if (base && base.destroyed) {
      const destroyedBaseId = npc.homeBaseId || base.id;
      npc.state = 'enraged';
      logger.log(`[PIRATE] Dreadnought ${npc.id} base destroyed - entering enraged rampage!`);
      return {
        action: 'pirate:dreadnoughtEnraged',
        npcId: npc.id,
        destroyedBaseId,
        x: npc.position.x,
        y: npc.position.y
      };
    }

    // Find nearest player
    if (nearbyPlayers.length === 0) {
      npc.targetPlayer = null;
      npc.targetNPC = null;
      npc.raidTargetType = null;
      // Patrol aggressively
      this.dreadnoughtPatrol(npc, deltaTime, context);
      return null;
    }

    const sortedPlayers = [...nearbyPlayers].sort((a, b) => a.distance - b.distance);
    const target = sortedPlayers[0];
    this.clearBaseRaidState(npc);
    npc.targetPlayer = target.id;
    npc.targetNPC = null;
    npc.raidTargetType = 'player';

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Stay at cannon range with the same bounded orbit integration used by
    // lighter pirates. This is also safe when target and dreadnought overlap.
    this.moveInStableOrbit(
      npc,
      target.position,
      550,
      npc.speed * 1.2,
      deltaTime,
      { angleKey: 'circleAngle', radialBias: 0.9, faceCenter: true }
    );

    // Fire cannons with shield piercing at extended range
    if (dist <= npc.weaponRange) {
      return this.tryFireWithShieldPiercing(npc, target);
    }

    return null;
  }

  /**
   * Dreadnought permanent enraged state after base destroyed
   */
  dreadnoughtEnraged(npc, nearbyPlayers, deltaTime, context) {
    // Rampage mode - chase nearest player relentlessly
    if (nearbyPlayers.length === 0) {
      npc.targetPlayer = null;
      npc.targetNPC = null;
      npc.raidTargetType = null;
      // Extended aggro range when enraged
      npc.aggroRange = Math.max(npc.aggroRange || 1000, 1500);
      this.dreadnoughtPatrol(npc, deltaTime, context);
      return null;
    }

    const sortedPlayers = [...nearbyPlayers].sort((a, b) => a.distance - b.distance);
    const target = sortedPlayers[0];
    this.clearBaseRaidState(npc);
    npc.targetPlayer = target.id;
    npc.targetNPC = null;
    npc.raidTargetType = 'player';

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Extremely fast pursuit (2x speed when enraged)
    const moveSpeed = npc.speed * 2.0 * (deltaTime / 1000);
    if (dist > 0) {
      const travelDistance = Math.min(moveSpeed, dist);
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * travelDistance;
      npc.position.y += (dy / dist) * travelDistance;
    }

    // Fire with enhanced damage
    if (dist <= npc.weaponRange) {
      const canFire = Date.now() - (npc.lastFireTime || 0) > 800; // Faster fire rate
      if (canFire) {
        npc.lastFireTime = Date.now();
        return {
          action: 'fire',
          target,
          weaponType: npc.weaponType || 'pirate_cannon',
          weaponTier: npc.weaponTier,
          baseDamage: npc.weaponDamage * 1.25, // 25% damage boost when enraged
          shieldPiercing: this.SHIELD_PIERCE_AMOUNT,
          enraged: true
        };
      }
    }

    return null;
  }

  /**
   * Dreadnought patrol when no targets
   */
  dreadnoughtPatrol(npc, deltaTime, context) {
    const homeBase = context.homeBase || npc.homeBasePosition;
    const center = homeBase || npc.spawnPoint;
    if (!center) {
      this.idleWander(npc, deltaTime);
      return;
    }

    this.moveInStableOrbit(
      npc,
      center,
      400,
      npc.speed * 0.6,
      deltaTime,
      { angleKey: 'patrolAngle', radialBias: 0.85 }
    );
  }

  // ===========================================
  // DREADNOUGHT SPAWNING & INVULNERABILITY
  // ===========================================

  /**
   * Check if dreadnought should spawn (base at 25% health)
   */
  shouldSpawnDreadnought(baseId, baseHealthPercent) {
    // Only one per base lifetime
    if (this.spawnedDreadnoughts.has(baseId)) {
      return false;
    }

    return baseHealthPercent <= this.DREADNOUGHT_BASE_HEALTH_TRIGGER;
  }

  /**
   * Mark dreadnought as spawned for base
   */
  markDreadnoughtSpawned(baseId, dreadnoughtId) {
    this.spawnedDreadnoughts.add(baseId);
    logger.log(`[PIRATE] Dreadnought ${dreadnoughtId} spawned for base ${baseId}`);
  }

  /**
   * Process incoming damage to dreadnought
   * 35% chance to negate all damage
   * Returns: { damage, blocked, showInvulnerable }
   */
  processDreadnoughtDamage(npc, incomingDamage) {
    if (npc.type !== 'pirate_dreadnought') {
      return { damage: incomingDamage, blocked: false, showInvulnerable: false };
    }

    // 35% chance to block all damage
    if (Math.random() < this.DREADNOUGHT_INVULN_CHANCE) {
      logger.log(`[PIRATE] Dreadnought ${npc.id} invulnerability proc!`);
      return {
        damage: 0,
        blocked: true,
        showInvulnerable: true
      };
    }

    return { damage: incomingDamage, blocked: false, showInvulnerable: false };
  }

  // ===========================================
  // STEALING MECHANICS
  // ===========================================

  /**
   * Constants for stealing
   */
  STEAL_RANGE = 150; // Must be within 150 units to steal
  STEAL_COOLDOWN = 10000; // 10 seconds between steal attempts
  SCRAP_PILE_STEAL_AMOUNT = 2; // Steal up to 2 wreckage worth from scrap pile
  CREDITS_STEAL_PERCENT = 0.15; // Steal 15% of claim credits

  /**
   * Check if pirate should steal instead of attack
   * Returns steal action if target is scavenger/rogue_miner
   */
  checkStealingOpportunity(npc, targetNPC, targetBase) {
    if (!targetNPC && !targetBase) return null;

    const targetFaction = targetNPC?.faction || targetBase?.faction;

    if (targetFaction === 'scavenger') {
      return {
        action: 'pirate:steal',
        stealType: 'scavenger',
        baseId: targetBase?.id,
        npcId: targetNPC?.id,
        sources: ['scrapPile', 'carriedWreckage']
      };
    }

    if (targetFaction === 'rogue_miner') {
      return {
        action: 'pirate:steal',
        stealType: 'rogue_miner',
        baseId: targetBase?.id,
        npcId: targetNPC?.id,
        sources: ['claimCredits']
      };
    }

    return null;
  }

  /**
   * Perform a steal from scavenger base scrap pile
   * @param {Object} npc - The pirate NPC doing the stealing
   * @param {Object} base - The scavenger_yard base with scrapPile
   * @returns {Object|null} Steal action with stolen items, or null if nothing to steal
   */
  stealFromScrapPile(npc, base) {
    if (!base || !base.scrapPile || base.scrapPile.count === 0) {
      return null;
    }

    // Check cooldown
    const lastSteal = npc.lastStealTime || 0;
    if (Date.now() - lastSteal < this.STEAL_COOLDOWN) {
      return null;
    }

    // Steal wreckage from scrap pile (up to SCRAP_PILE_STEAL_AMOUNT)
    const stealCount = Math.min(this.SCRAP_PILE_STEAL_AMOUNT, base.scrapPile.count);
    const stolenItems = [];

    // Take items from the contents array
    for (let i = 0; i < stealCount && base.scrapPile.contents.length > 0; i++) {
      const item = base.scrapPile.contents.shift();
      if (item) {
        stolenItems.push(item);
      }
    }

    // Reduce the count
    base.scrapPile.count = Math.max(0, base.scrapPile.count - stealCount);
    npc.lastStealTime = Date.now();

    logger.log(`[PIRATE] ${npc.type} ${npc.id} stole ${stealCount} wreckage from scavenger scrap pile`);

    return {
      action: 'pirate:steal',
      targetType: 'scavenger_scrapPile',
      targetBaseId: base.id,
      stolenAmount: stealCount,
      stolenItems: stolenItems,
      position: { x: npc.position.x, y: npc.position.y }
    };
  }

  /**
   * Intercept and steal from a returning scavenger NPC
   * @param {Object} npc - The pirate NPC doing the stealing
   * @param {Object} scavengerNPC - The scavenger NPC with carriedWreckage
   * @returns {Object|null} Steal action with stolen items, or null if nothing to steal
   */
  stealFromScavenger(npc, scavengerNPC) {
    if (!scavengerNPC || !scavengerNPC.carriedWreckage || scavengerNPC.carriedWreckage.length === 0) {
      return null;
    }

    // Check cooldown
    const lastSteal = npc.lastStealTime || 0;
    if (Date.now() - lastSteal < this.STEAL_COOLDOWN) {
      return null;
    }

    // Steal all carried wreckage
    const stolenItems = [...scavengerNPC.carriedWreckage];
    const stolenCount = stolenItems.length;
    scavengerNPC.carriedWreckage = [];
    npc.lastStealTime = Date.now();

    logger.log(`[PIRATE] ${npc.type} ${npc.id} intercepted ${stolenCount} wreckage from scavenger ${scavengerNPC.id}`);

    return {
      action: 'pirate:steal',
      targetType: 'scavenger_carried',
      targetNpcId: scavengerNPC.id,
      stolenAmount: stolenCount,
      stolenItems: stolenItems,
      position: { x: npc.position.x, y: npc.position.y }
    };
  }

  /**
   * Steal credits from rogue miner mining claim
   * @param {Object} npc - The pirate NPC doing the stealing
   * @param {Object} base - The mining_claim base with claimCredits
   * @returns {Object|null} Steal action with stolen credits, or null if nothing to steal
   */
  stealFromMiningClaim(npc, base) {
    if (!base || typeof base.claimCredits !== 'number' || base.claimCredits <= 0) {
      return null;
    }

    // Check cooldown
    const lastSteal = npc.lastStealTime || 0;
    if (Date.now() - lastSteal < this.STEAL_COOLDOWN) {
      return null;
    }

    // Steal 15% of accumulated credits
    const requestedCredits = Math.floor(base.claimCredits * this.CREDITS_STEAL_PERCENT);
    if (requestedCredits <= 0) {
      return null;
    }

    // Base range queries expose an authoritative, non-serializable mutation
    // hook. Retain the direct mutation fallback for isolated strategy tests
    // and callers that pass the active base object itself.
    const stolenCredits = typeof base.consumeClaimCredits === 'function'
      ? base.consumeClaimCredits(requestedCredits)
      : requestedCredits;
    if (stolenCredits <= 0) return null;
    if (typeof base.consumeClaimCredits !== 'function') {
      base.claimCredits -= stolenCredits;
    }
    npc.lastStealTime = Date.now();

    logger.log(`[PIRATE] ${npc.type} ${npc.id} stole ${stolenCredits} credits from mining claim ${base.id}`);

    return {
      action: 'pirate:steal',
      targetType: 'rogue_credits',
      targetBaseId: base.id,
      stolenAmount: stolenCredits,
      stolenItems: [], // Credits, not physical items
      position: { x: npc.position.x, y: npc.position.y }
    };
  }

  /**
   * Try to steal from nearby scavenger/rogue miner targets
   * Called during raid/patrol when near enemy faction bases
   * @param {Object} npc - The pirate NPC
   * @param {Object} context - Context with allBases and allNPCs
   * @returns {Object|null} Steal action or null
   */
  trySteal(npc, context) {
    // Only captains and fighters steal (scouts just gather intel)
    if (npc.type === 'pirate_scout') {
      return null;
    }

    // Check for nearby scavenger bases (scrap pile)
    if (context.nearbyBases) {
      for (const base of context.nearbyBases) {
        if (base.type === 'scavenger_yard' && base.scrapPile) {
          const dx = base.x - npc.position.x;
          const dy = base.y - npc.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= this.STEAL_RANGE) {
            const stealAction = this.stealFromScrapPile(npc, base);
            if (stealAction) return stealAction;
          }
        }

        // Check for rogue miner mining claims
        if (base.type === 'mining_claim' && base.claimCredits > 0) {
          const dx = base.x - npc.position.x;
          const dy = base.y - npc.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= this.STEAL_RANGE) {
            const stealAction = this.stealFromMiningClaim(npc, base);
            if (stealAction) return stealAction;
          }
        }
      }
    }

    // Check for scavenger NPCs carrying wreckage
    if (context.allNPCs) {
      for (const [npcId, otherNpc] of context.allNPCs) {
        if (otherNpc.faction !== 'scavenger') continue;
        if (!otherNpc.carriedWreckage || otherNpc.carriedWreckage.length === 0) continue;

        const dx = otherNpc.position.x - npc.position.x;
        const dy = otherNpc.position.y - npc.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.STEAL_RANGE) {
          const stealAction = this.stealFromScavenger(npc, otherNpc);
          if (stealAction) return stealAction;
        }
      }
    }

    return null;
  }

  // ===========================================
  // UTILITY FUNCTIONS
  // ===========================================

  /**
   * Find valid targets for scout (players, enemy bases, enemy NPCs)
   * Priority: 1=players, 2=enemy bases with resources, 3=individual enemy NPCs
   */
  findScoutTargets(npc, nearbyPlayers, nearbyAllies, context) {
    const targets = [];

    // Priority 1: Players always take highest priority
    for (const player of nearbyPlayers) {
      targets.push({
        ...player,
        targetType: 'player',
        priority: 1
      });
    }

    // Priority 2: Enemy faction BASES (scavenger yards and mining claims)
    // These are the primary raid targets - scouts report bases for captains to raid
    if (context.nearbyBases && context.nearbyBases.length > 0) {
      for (const base of context.nearbyBases) {
        const dx = base.x - npc.position.x;
        const dy = base.y - npc.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if base has resources worth stealing
        const hasResources = (base.type === 'scavenger_yard' && base.scrapPile &&
                              (base.scrapPile.count > 0 || base.scrapPile.contents?.length > 0)) ||
                            (base.type === 'mining_claim' && base.claimCredits > 0);

        if (dist <= npc.aggroRange) {
          targets.push({
            id: base.id,
            position: { x: base.x, y: base.y },
            targetType: base.type === 'scavenger_yard' ? 'scavenger_base' : 'rogue_miner_base',
            baseType: base.type,
            distance: dist,
            hasResources: hasResources,
            priority: hasResources ? 2 : 4 // Bases with resources are priority 2
          });
        }
      }
    }

    // Priority 3: Individual enemy NPCs (secondary targets)
    if (context.allNPCs) {
      for (const [npcId, otherNpc] of context.allNPCs) {
        if (otherNpc.faction === 'rogue_miner' || otherNpc.faction === 'scavenger') {
          const dx = otherNpc.position.x - npc.position.x;
          const dy = otherNpc.position.y - npc.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= npc.aggroRange) {
            targets.push({
              id: npcId,
              position: otherNpc.position,
              targetType: otherNpc.faction,
              distance: dist,
              priority: 3 // Lower priority than bases
            });
          }
        }
      }
    }

    // Sort by priority then distance
    targets.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.distance || 0) - (b.distance || 0);
    });

    return targets;
  }

  /**
   * Move an NPC around a center using a directly integrated polar orbit.
   *
   * Radial correction and tangential travel share one movement budget, so the
   * displacement can never exceed the configured speed for this tick. This is
   * deliberately different from following a rotating Cartesian waypoint: a
   * waypoint's linear velocity grows with its radius and can easily outrun the
   * NPC that is meant to follow it.
   */
  moveInStableOrbit(npc, center, radius, speedPerSecond, deltaTime, options = {}) {
    if (!npc?.position || !center ||
        !Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y) ||
        !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
      return false;
    }

    const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
    const safeSpeed = Number.isFinite(speedPerSecond) ? Math.max(0, speedPerSecond) : 0;
    const dtSeconds = Number.isFinite(deltaTime) ? Math.max(0, deltaTime) / 1000 : 0;
    const maxStep = safeSpeed * dtSeconds;
    if (maxStep <= 0) return true;

    const relativeX = npc.position.x - center.x;
    const relativeY = npc.position.y - center.y;
    const currentRadius = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
    const angleKey = options.angleKey || 'orbitAngle';
    const currentAngle = currentRadius > 1e-6
      ? Math.atan2(relativeY, relativeX)
      : (Number.isFinite(npc[angleKey]) ? npc[angleKey] : 0);
    const directionKey = `${angleKey}Direction`;
    const direction = npc[directionKey] === -1 ? -1 : 1;
    npc[directionKey] = direction;

    const requestedBias = Number.isFinite(options.radialBias) ? options.radialBias : 0.8;
    const radialBias = Math.max(0, Math.min(1, requestedBias));
    const radialError = safeRadius - currentRadius;
    const radialLimit = maxStep * radialBias;
    const radialStep = Math.max(-radialLimit, Math.min(radialLimit, radialError));
    const nextRadius = Math.max(0, currentRadius + radialStep);
    const tangentialBudget = Math.sqrt(Math.max(0, maxStep * maxStep - radialStep * radialStep));
    const angularDenominator = Math.max(nextRadius, safeRadius * 0.25, 1);
    const nextAngle = currentAngle + direction * (tangentialBudget / angularDenominator);

    const desiredX = center.x + Math.cos(nextAngle) * nextRadius;
    const desiredY = center.y + Math.sin(nextAngle) * nextRadius;
    let moveX = desiredX - npc.position.x;
    let moveY = desiredY - npc.position.y;
    const requestedStep = Math.sqrt(moveX * moveX + moveY * moveY);

    // Chord length and radial travel are nearly orthogonal, but cap their
    // combined Cartesian displacement to make the speed invariant exact.
    if (requestedStep > maxStep && requestedStep > 0) {
      const scale = maxStep / requestedStep;
      moveX *= scale;
      moveY *= scale;
    }

    npc.position.x += moveX;
    npc.position.y += moveY;
    npc[angleKey] = Math.atan2(npc.position.y - center.y, npc.position.x - center.x);

    if (options.faceCenter) {
      const faceX = center.x - npc.position.x;
      const faceY = center.y - npc.position.y;
      if (Math.abs(faceX) > 1e-6 || Math.abs(faceY) > 1e-6) {
        npc.rotation = Math.atan2(faceY, faceX);
      }
    } else if (Math.abs(moveX) > 1e-6 || Math.abs(moveY) > 1e-6) {
      npc.rotation = Math.atan2(moveY, moveX);
    }

    return true;
  }

  /**
   * Try to fire with shield piercing
   */
  tryFireWithShieldPiercing(npc, target) {
    if (!target) return null;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const fireCooldown = npc.type === 'pirate_dreadnought' ? 1200 :
                         npc.type === 'pirate_captain' ? 800 : 1000;

    const canFire = Date.now() - (npc.lastFireTime || 0) > fireCooldown;

    if (canFire && dist <= npc.weaponRange) {
      npc.lastFireTime = Date.now();

      // Determine weapon type based on NPC
      let weaponType = npc.weaponType || 'pirate_heavy_blaster';
      if (npc.type === 'pirate_scout') weaponType = 'pirate_light_blaster';
      if (npc.type === 'pirate_dreadnought') weaponType = 'pirate_cannon';

      return {
        action: 'fire',
        target,
        weaponType,
        weaponTier: npc.weaponTier,
        baseDamage: npc.weaponDamage,
        shieldPiercing: this.SHIELD_PIERCE_AMOUNT
      };
    }

    return null;
  }

  /**
   * Idle wander when no home base
   */
  idleWander(npc, deltaTime) {
    const wanderSpeed = npc.speed * 0.3 * (deltaTime / 1000);

    if (!npc.wanderTarget) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * 300;
      npc.wanderTarget = {
        x: npc.position.x + Math.cos(angle) * dist,
        y: npc.position.y + Math.sin(angle) * dist
      };
    }

    const dx = npc.wanderTarget.x - npc.position.x;
    const dy = npc.wanderTarget.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * wanderSpeed;
      npc.position.y += (dy / dist) * wanderSpeed;
    } else {
      npc.wanderTarget = null;
    }
  }

  /**
   * Get intel for a base (used by engine to check for valid intel)
   */
  getIntel(baseId) {
    const intel = this.intelReports.get(baseId);
    if (intel && Date.now() - intel.reportedAt < this.INTEL_VALIDITY_DURATION) {
      return intel;
    }
    return null;
  }

  /**
   * Clear intel for a base
   */
  clearIntel(baseId) {
    this.intelReports.delete(baseId);
  }

  /**
   * Called when NPC takes damage - might trigger reactions
   */
  onDamaged(npc, attackerId, allNPCs) {
    if (!npc || attackerId === null || attackerId === undefined) return null;

    const previousState = npc.state;
    const attackerNpc = allNPCs instanceof Map ? allNPCs.get(attackerId) : null;

    if (attackerNpc?.position) {
      npc.targetNPC = attackerId;
      npc.targetPlayer = null;
      npc.raidTargetType = 'npc';
      npc.raidTargetPos = {
        x: attackerNpc.position.x,
        y: attackerNpc.position.y
      };
    } else {
      npc.targetPlayer = attackerId;
      npc.targetNPC = null;
      npc.raidTargetType = 'player';
      // The next AI tick resolves the authoritative player position from
      // nearbyPlayers. Do not retain coordinates belonging to an old target.
      npc.raidTargetPos = null;
    }

    npc.lastTargetSeenTime = Date.now();

    switch (npc.type) {
      case 'pirate_scout':
        this.scoutingNPCs.delete(npc.id);
        npc.state = 'raid';
        break;
      case 'pirate_fighter':
        this.boostDiveNPCs.delete(npc.id);
        npc.isBoosting = false;
        npc.state = 'raid';
        break;
      case 'pirate_captain':
        this.healingNPCs.delete(npc.id);
        npc.state = 'raid';
        break;
      case 'pirate_dreadnought':
        // Enraged dreadnoughts stay enraged; all others actively enter combat.
        if (npc.state !== 'enraged') npc.state = 'raid';
        break;
      default:
        npc.state = 'raid';
        break;
    }

    return {
      action: 'pirate:retaliate',
      npcId: npc.id,
      targetId: attackerId,
      targetType: attackerNpc ? 'npc' : 'player',
      previousState,
      state: npc.state
    };
  }

  /**
   * Clean up NPC state when removed
   */
  cleanup(npcId) {
    this.scoutingNPCs.delete(npcId);
    this.boostDiveNPCs.delete(npcId);
    this.captainTargets.delete(npcId);
    this.healingNPCs.delete(npcId);
  }
}

module.exports = PirateStrategy;
