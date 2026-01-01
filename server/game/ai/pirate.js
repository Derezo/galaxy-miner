// Galaxy Miner - Pirate AI Strategy
// Role-specific AI for scouts, fighters, captains, and dreadnoughts

const logger = require('../../../shared/logger');

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

    // Patrol in circles AWAY from base
    if (!homeBase) {
      this.idleWander(npc, deltaTime);
      return null;
    }

    const patrolSpeed = npc.speed * 0.5 * (deltaTime / 1000);
    npc.patrolAngle = (npc.patrolAngle || Math.random() * Math.PI * 2) + 0.3 * (deltaTime / 1000);

    // Patrol at distance from base
    const targetX = homeBase.x + Math.cos(npc.patrolAngle) * this.SCOUT_PATROL_RADIUS;
    const targetY = homeBase.y + Math.sin(npc.patrolAngle) * this.SCOUT_PATROL_RADIUS;

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    }

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
          npc.targetPlayer = scoutData.targetId;
          npc.raidTargetPos = scoutData.targetPos;
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
    if (!isFinite(dx) || !isFinite(dy) || dist === 0) {
      logger.warn(`[PIRATE] Scout ${npc.id} has invalid base coordinates, entering raid mode`);
      const scoutData = this.scoutingNPCs.get(npc.id);
      if (scoutData) {
        npc.targetPlayer = scoutData.targetId;
        npc.raidTargetPos = scoutData.targetPos;
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
      npc.targetPlayer = intel.targetId;
      npc.raidTargetPos = intel.targetPos;
      npc.state = 'raid';
      logger.log(`[PIRATE] Scout ${npc.id} joining raid against ${intel.targetType}`);

      return {
        action: 'pirate:intelBroadcast',
        npcId: npc.id,
        baseId: baseId,
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
    const target = nearbyPlayers.find(p => p.id === npc.targetPlayer);
    const targetPos = target ? target.position : npc.raidTargetPos;

    // If no target position at all, return to patrol
    if (!targetPos) {
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
      logger.log(`[PIRATE] Scout ${npc.id} lost target - too far (${Math.round(chaseDist)} units)`);
      return null;
    }

    // Update target position if live
    if (target) {
      npc.raidTargetPos = { x: target.position.x, y: target.position.y };
    }

    const dx = targetPos.x - npc.position.x;
    const dy = targetPos.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Scouts stay at range (350-450 units) and fire light blasters
    const optimalRange = 400;
    const moveSpeed = npc.speed * 0.8 * (deltaTime / 1000);

    if (dist > optimalRange + 50) {
      // Move closer
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else if (dist < optimalRange - 50) {
      // Back away
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x -= (dx / dist) * moveSpeed * 0.5;
      npc.position.y -= (dy / dist) * moveSpeed * 0.5;
    } else {
      // Circle at optimal range
      npc.patrolAngle = (npc.patrolAngle || 0) + 0.8 * (deltaTime / 1000);
      const circleX = targetPos.x + Math.cos(npc.patrolAngle) * optimalRange;
      const circleY = targetPos.y + Math.sin(npc.patrolAngle) * optimalRange;
      const cdx = circleX - npc.position.x;
      const cdy = circleY - npc.position.y;
      const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cdist > 10) {
        npc.position.x += (cdx / cdist) * moveSpeed * 0.6;
        npc.position.y += (cdy / cdist) * moveSpeed * 0.6;
      }
      npc.rotation = Math.atan2(dy, dx); // Face target
    }

    // Fire light blaster if in range and target is player
    if (target && dist <= npc.weaponRange) {
      const now = Date.now();
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

    // If no target found for a while, return to patrol
    if (!target && Date.now() - (npc.lastTargetSeenTime || Date.now()) > 10000) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
    } else if (target) {
      npc.lastTargetSeenTime = Date.now();
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
    if (nearbyPlayers.length > 0) {
      const target = nearbyPlayers[0];
      npc.targetPlayer = target.id;
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
      npc.targetPlayer = intel.targetId;
      npc.raidTargetPos = intel.targetPos;
      const wasPatrol = npc.state === 'patrol';
      npc.state = 'raid';
      // Only log on state transition for new intel targets
      if (wasPatrol && npc.lastIntelTarget !== intel.targetId) {
        logger.log(`[PIRATE] Fighter ${npc.id} received intel, raiding ${intel.targetType}`);
        npc.lastIntelTarget = intel.targetId;
      }
      return null;
    }

    // Patrol near base
    if (!homeBase) {
      this.idleWander(npc, deltaTime);
      return null;
    }

    const patrolSpeed = npc.speed * 0.4 * (deltaTime / 1000);
    npc.patrolAngle = (npc.patrolAngle || 0) + 0.4 * (deltaTime / 1000);

    const targetX = homeBase.x + Math.cos(npc.patrolAngle) * this.FIGHTER_PATROL_RADIUS;
    const targetY = homeBase.y + Math.sin(npc.patrolAngle) * this.FIGHTER_PATROL_RADIUS;

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 15) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    }

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
    let target = nearbyPlayers.find(p => p.id === npc.targetPlayer);
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
        npc.targetNPC = nearestDefender.id;
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

    // Move toward target
    if (dist > this.FIGHTER_CIRCLE_RADIUS + 50) {
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;

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
    const target = nearbyPlayers.find(p => p.id === npc.targetPlayer);
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
        fromX: npc.position.x,
        fromY: npc.position.y,
        toX: target.position.x,
        toY: target.position.y
      };
    }

    // Continue circling
    npc.circleAngle = (npc.circleAngle || 0) + 0.8 * (deltaTime / 1000);
    const targetX = target.position.x + Math.cos(npc.circleAngle) * this.FIGHTER_CIRCLE_RADIUS;
    const targetY = target.position.y + Math.sin(npc.circleAngle) * this.FIGHTER_CIRCLE_RADIUS;

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      const moveSpeed = npc.speed * 0.8 * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }

    // Face target
    const tdx = target.position.x - npc.position.x;
    const tdy = target.position.y - npc.position.y;
    npc.rotation = Math.atan2(tdy, tdx);

    return null;
  }

  /**
   * Fighter boost dives toward target, fires, then backs away
   */
  fighterBoostDive(npc, nearbyPlayers, deltaTime, context) {
    const boostData = this.boostDiveNPCs.get(npc.id);
    const target = nearbyPlayers.find(p => p.id === (boostData?.targetId || npc.targetPlayer));

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

    // Boost toward target
    const boostSpeed = npc.speed * this.BOOST_DIVE_SPEED_MULTIPLIER * (deltaTime / 1000);
    npc.rotation = Math.atan2(dy, dx);
    npc.position.x += (dx / dist) * boostSpeed;
    npc.position.y += (dy / dist) * boostSpeed;

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

    return null;
  }

  /**
   * Fighter backs away during cooldown
   */
  fighterCooldown(npc, nearbyPlayers, deltaTime, context) {
    const boostData = this.boostDiveNPCs.get(npc.id);
    const target = nearbyPlayers.find(p => p.id === npc.targetPlayer);

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

    if (dist < this.FIGHTER_CIRCLE_RADIUS) {
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

    if (intel && Date.now() - intel.reportedAt < this.INTEL_VALIDITY_DURATION) {
      // Scout reported - enter raid
      npc.targetPlayer = intel.targetId;
      npc.raidTargetPos = intel.targetPos;
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
    if (nearbyPlayers.length > 0) {
      const target = nearbyPlayers[0];
      npc.targetPlayer = target.id;
      npc.raidTargetPos = { x: target.position.x, y: target.position.y };
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
    // Check health for flee
    const healthPercent = npc.hull / npc.hullMax;
    if (healthPercent <= this.CAPTAIN_FLEE_THRESHOLD) {
      npc.state = 'flee';
      logger.log(`[PIRATE] Captain ${npc.id} fleeing at ${Math.round(healthPercent * 100)}% health`);
      return null;
    }

    // PRIORITY 1: Players always take highest priority - engage if nearby
    const nearestPlayer = nearbyPlayers[0]; // Already sorted by distance
    if (nearestPlayer) {
      // Update target to player, interrupting base raid
      npc.targetPlayer = nearestPlayer.id;
      npc.raidTargetPos = { x: nearestPlayer.position.x, y: nearestPlayer.position.y };

      const dx = nearestPlayer.position.x - npc.position.x;
      const dy = nearestPlayer.position.y - npc.position.y;
      const dist = nearestPlayer.distance;

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
      const dx = npc.raidTargetPos.x - npc.position.x;
      const dy = npc.raidTargetPos.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // If we're at the base but couldn't steal (no resources?), switch to fighting defenders
      if (dist <= this.STEAL_RANGE) {
        // Look for enemy NPCs near the base to fight
        return this.findAndEngageDefenders(npc, deltaTime, context);
      }

      // Move toward base
      npc.rotation = Math.atan2(dy, dx);
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;

      // Check if too far from base (gave up)
      if (dist > this.RAID_CHASE_DISTANCE) {
        npc.state = 'idle';
        npc.isRaidingBase = false;
        logger.log(`[PIRATE] Captain ${npc.id} gave up base raid - too far (${Math.round(dist)} units)`);
      }

      return null;
    }

    // PRIORITY 4: If targeting an NPC (not base), engage it
    const targetPos = npc.raidTargetPos;
    if (!targetPos) {
      npc.state = 'idle';
      npc.targetPlayer = null;
      return null;
    }

    const dx = targetPos.x - npc.position.x;
    const dy = targetPos.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if target is too far away (chase distance limit)
    if (dist > this.RAID_CHASE_DISTANCE) {
      npc.state = 'idle';
      npc.targetPlayer = null;
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

    return null;
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
      npc.state = 'enraged';
      logger.log(`[PIRATE] Dreadnought ${npc.id} base destroyed - entering enraged rampage!`);
      return {
        action: 'pirate:dreadnoughtEnraged',
        npcId: npc.id,
        baseId: npc.homeBaseId,
        x: npc.position.x,
        y: npc.position.y
      };
    }

    // Find nearest player
    if (nearbyPlayers.length === 0) {
      // Patrol aggressively
      this.dreadnoughtPatrol(npc, deltaTime, context);
      return null;
    }

    const sortedPlayers = [...nearbyPlayers].sort((a, b) => a.distance - b.distance);
    const target = sortedPlayers[0];
    npc.targetPlayer = target.id;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Optimal engagement distance - stay at range to use long-range cannons
    const optimalDistance = 600;
    const minDistance = 400;
    const moveSpeed = npc.speed * 1.2 * (deltaTime / 1000);

    if (dist > optimalDistance + 100) {
      // Too far - approach target
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else if (dist < minDistance) {
      // Too close - back away while circling
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x -= (dx / dist) * moveSpeed * 0.8;
      npc.position.y -= (dy / dist) * moveSpeed * 0.8;
    } else {
      // At optimal range - circle the target menacingly
      npc.rotation = Math.atan2(dy, dx);
      npc.circleAngle = (npc.circleAngle || 0) + 0.5 * (deltaTime / 1000);
      const circleSpeed = moveSpeed * 0.6;
      const perpX = -dy / dist;
      const perpY = dx / dist;
      npc.position.x += perpX * circleSpeed;
      npc.position.y += perpY * circleSpeed;
    }

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
      // Extended aggro range when enraged
      npc.aggroRange = Math.max(npc.aggroRange || 1000, 1500);
      this.dreadnoughtPatrol(npc, deltaTime, context);
      return null;
    }

    const sortedPlayers = [...nearbyPlayers].sort((a, b) => a.distance - b.distance);
    const target = sortedPlayers[0];
    npc.targetPlayer = target.id;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Extremely fast pursuit (2x speed when enraged)
    const moveSpeed = npc.speed * 2.0 * (deltaTime / 1000);
    npc.rotation = Math.atan2(dy, dx);
    npc.position.x += (dx / dist) * moveSpeed;
    npc.position.y += (dy / dist) * moveSpeed;

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
    const center = homeBase || { x: npc.position.x, y: npc.position.y };

    const patrolSpeed = npc.speed * 0.6 * (deltaTime / 1000);
    npc.patrolAngle = (npc.patrolAngle || 0) + 0.2 * (deltaTime / 1000);

    const patrolRadius = 400;
    const targetX = center.x + Math.cos(npc.patrolAngle) * patrolRadius;
    const targetY = center.y + Math.sin(npc.patrolAngle) * patrolRadius;

    const dx = targetX - npc.position.x;
    const dy = targetY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * patrolSpeed;
      npc.position.y += (dy / dist) * patrolSpeed;
    }
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
    const stolenCredits = Math.floor(base.claimCredits * this.CREDITS_STEAL_PERCENT);
    if (stolenCredits <= 0) {
      return null;
    }

    base.claimCredits -= stolenCredits;
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
        const hasResources = (base.type === 'scavenger_yard' && base.scrapPile && base.scrapPile.length > 0) ||
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

    if (!npc.wanderTarget || Math.random() < 0.01) {
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
    // Pirates don't have rage spread like scavengers/rogue miners
    // But we could add flanking coordination here
    return null;
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
