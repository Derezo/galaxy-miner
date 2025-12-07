// Galaxy Miner - Formation AI Strategy (Void Entities)
// V-formation with synchronized movement and attacks

/**
 * FormationStrategy - Void Entities fly in formation
 * - V-formation with leader at point
 * - Synchronized movement and rotation
 * - Coordinated firing at same target
 * - Leader death: next in formation becomes leader
 * - Disciplined retreat: reform at spawn point
 */
class FormationStrategy {
  constructor() {
    // Formation tracking
    this.formations = new Map(); // leaderId -> { members: [], formationType }

    // Formation state tracking for succession behavior
    // formationId -> { state: 'normal'|'confusion'|'reforming', stateStartTime, newLeaderId }
    this.formationStates = new Map();
  }

  /**
   * Set formation state (called when leader dies)
   * @param {string} formationId - Formation identifier
   * @param {string} state - 'confusion' or 'reforming'
   * @param {string} newLeaderId - New leader's ID (for reforming)
   */
  setFormationState(formationId, state, newLeaderId = null) {
    this.formationStates.set(formationId, {
      state,
      stateStartTime: Date.now(),
      newLeaderId
    });
  }

  /**
   * Get current formation state
   */
  getFormationState(npc) {
    // Check all states for this NPC
    for (const [formationId, stateInfo] of this.formationStates) {
      if (stateInfo.newLeaderId === npc.id || npc.formationId === formationId) {
        return stateInfo;
      }
    }
    return null;
  }

  /**
   * Clear expired formation states
   */
  cleanupFormationStates() {
    const now = Date.now();
    for (const [formationId, stateInfo] of this.formationStates) {
      // Confusion lasts 1 second, reforming lasts 2 seconds
      const maxDuration = stateInfo.state === 'confusion' ? 1000 : 3000;
      if (now - stateInfo.stateStartTime > maxDuration) {
        this.formationStates.delete(formationId);
      }
    }
  }

  /**
   * Main update for formation behavior
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    // Cleanup expired formation states
    this.cleanupFormationStates();

    // Check for confusion or reforming state
    const formationState = this.getFormationState(npc);
    if (formationState) {
      const elapsed = Date.now() - formationState.stateStartTime;

      if (formationState.state === 'confusion') {
        // During confusion: random drift, no targeting, no firing
        return this.updateConfusion(npc, deltaTime, elapsed);
      }

      if (formationState.state === 'reforming') {
        // During reformation: move toward new leader, no combat
        return this.updateReformation(npc, nearbyAllies, deltaTime, formationState);
      }
    }

    // Check if should retreat
    if (this.shouldRetreat(npc)) {
      npc.state = 'retreat';
      return this.retreat(npc, deltaTime, context, nearbyAllies);
    }

    // No targets - patrol in formation
    if (nearbyPlayers.length === 0) {
      npc.state = 'patrol';
      npc.targetPlayer = null;
      this.patrolInFormation(npc, deltaTime, context, nearbyAllies);
      return null;
    }

    // Combat - attack in formation
    npc.state = 'combat';

    // Determine formation role
    const formationInfo = this.getFormationRole(npc, nearbyAllies);

    // Select target (formation shares target)
    const target = this.selectTarget(npc, nearbyPlayers, formationInfo);
    if (!target) {
      this.patrolInFormation(npc, deltaTime, context, nearbyAllies);
      return null;
    }

    npc.targetPlayer = target.id;

    if (formationInfo.isLeader) {
      // Leader moves toward target, others follow
      this.moveAsLeader(npc, target, deltaTime);
    } else {
      // Follow leader in formation position
      this.followLeader(npc, formationInfo.leader, formationInfo.index, deltaTime);
    }

    // Coordinated firing
    return this.tryCoordinatedFire(npc, target, formationInfo);
  }

  /**
   * Determine formation role (leader or follower)
   */
  getFormationRole(npc, allies) {
    // Check if this NPC is marked as formation leader
    if (npc.formationLeader || npc.isBoss) {
      return {
        isLeader: true,
        leader: npc,
        index: 0,
        members: allies.filter(a => a.faction === 'void')
      };
    }

    // Find the leader among allies
    let leader = null;
    for (const ally of allies) {
      if (ally.formationLeader || ally.isBoss) {
        leader = ally;
        break;
      }
    }

    // If no designated leader, strongest becomes leader
    if (!leader) {
      const voidAllies = allies.filter(a => a.faction === 'void');
      leader = voidAllies.reduce((l, a) =>
        a.hullMax > (l?.hullMax || 0) ? a : l
      , null);

      // Check if this NPC should be leader
      if (!leader || npc.hullMax > leader.hullMax) {
        return {
          isLeader: true,
          leader: npc,
          index: 0,
          members: voidAllies
        };
      }
    }

    // Find our index in formation
    const members = allies.filter(a => a.faction === 'void' && a.id !== leader.id);
    let index = 1;
    for (const m of members) {
      if (m.id < npc.id) index++;
    }

    return {
      isLeader: false,
      leader,
      index,
      members
    };
  }

  /**
   * Select target - formation focuses on single target
   */
  selectTarget(npc, players, formationInfo) {
    if (players.length === 0) return null;

    // If leader has a target, all follow that target
    if (!formationInfo.isLeader && formationInfo.leader?.targetPlayer) {
      const leaderTarget = players.find(p => p.id === formationInfo.leader.targetPlayer);
      if (leaderTarget) return leaderTarget;
    }

    // Otherwise select nearest
    return players.sort((a, b) => a.distance - b.distance)[0];
  }

  /**
   * Leader movement - approach target at optimal range
   */
  moveAsLeader(npc, target, deltaTime) {
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Face target
    npc.rotation = Math.atan2(dy, dx);

    // Move to optimal range (70% of weapon range)
    const optimalRange = npc.weaponRange * 0.7;
    if (dist > optimalRange + 20) {
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    } else if (dist < optimalRange - 50) {
      // Too close, back up
      const moveSpeed = npc.speed * 0.5 * (deltaTime / 1000);
      npc.position.x -= (dx / dist) * moveSpeed;
      npc.position.y -= (dy / dist) * moveSpeed;
    }
  }

  /**
   * Follow leader in V-formation
   */
  followLeader(npc, leader, index, deltaTime) {
    if (!leader) return;

    // Calculate formation position
    const formationPos = this.getFormationPosition(leader, index);

    const dx = formationPos.x - npc.position.x;
    const dy = formationPos.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Match leader rotation
    npc.rotation = leader.rotation;

    // Move to formation position
    if (dist > 15) {
      // Move faster if far from position
      const speedMult = Math.min(1.5, 1 + dist / 200);
      const moveSpeed = npc.speed * speedMult * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }
  }

  /**
   * Calculate V-formation position
   */
  getFormationPosition(leader, index) {
    const spacing = 80;
    const angle = leader.rotation + Math.PI; // Behind leader
    const side = index % 2 === 0 ? 1 : -1;
    const row = Math.ceil(index / 2);

    return {
      x: leader.position.x + Math.cos(angle + side * 0.5 * row) * spacing * row,
      y: leader.position.y + Math.sin(angle + side * 0.5 * row) * spacing * row
    };
  }

  /**
   * Coordinated firing - synchronized volleys
   */
  tryCoordinatedFire(npc, target, formationInfo) {
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > npc.weaponRange) return null;

    // Synchronized fire cooldown based on formation
    const baseCooldown = 1200; // Slightly slower but coordinated
    const canFire = Date.now() - (npc.lastFireTime || 0) > baseCooldown;

    // Leader fires, followers fire with slight delay
    const fireDelay = formationInfo.isLeader ? 0 : formationInfo.index * 100;

    if (canFire) {
      // Check if leader just fired (for synchronization)
      const leaderFireTime = formationInfo.leader?.lastFireTime || 0;
      const timeSinceLeaderFire = Date.now() - leaderFireTime;

      if (formationInfo.isLeader || timeSinceLeaderFire >= fireDelay) {
        npc.lastFireTime = Date.now();
        return {
          action: 'fire',
          target,
          weaponType: npc.weaponType,
          weaponTier: npc.weaponTier,
          baseDamage: npc.weaponDamage,
          synchronized: true
        };
      }
    }

    return null;
  }

  /**
   * Check if should retreat (30% health for void)
   */
  shouldRetreat(npc) {
    const healthPercent = npc.hull / npc.hullMax;
    return healthPercent <= 0.3;
  }

  /**
   * Disciplined retreat in formation
   */
  retreat(npc, deltaTime, context, allies) {
    const homeBase = context.homeBase || npc.spawnPoint;
    if (!homeBase) return null;

    // Void retreats in formation - maintain positions while retreating
    const formationInfo = this.getFormationRole(npc, allies);

    if (formationInfo.isLeader) {
      // Leader retreats to base
      const dx = homeBase.x - npc.position.x;
      const dy = homeBase.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 100) {
        npc.state = 'patrol';
        return null;
      }

      const retreatSpeed = npc.speed * 1.1 * (deltaTime / 1000);
      npc.rotation = Math.atan2(dy, dx);
      npc.position.x += (dx / dist) * retreatSpeed;
      npc.position.y += (dy / dist) * retreatSpeed;
    } else {
      // Followers maintain formation while retreating
      this.followLeader(npc, formationInfo.leader, formationInfo.index, deltaTime);
    }

    return null;
  }

  /**
   * Patrol in formation
   */
  patrolInFormation(npc, deltaTime, context, allies) {
    const formationInfo = this.getFormationRole(npc, allies);

    if (formationInfo.isLeader) {
      // Leader patrols, others follow
      const patrolRadius = 300;
      const patrolSpeed = npc.speed * 0.4 * (deltaTime / 1000);
      const center = context.homeBase || npc.spawnPoint;

      if (!center) return;

      npc.patrolAngle = (npc.patrolAngle || 0) + 0.3 * (deltaTime / 1000);
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
    } else {
      // Follow leader in formation
      this.followLeader(npc, formationInfo.leader, formationInfo.index, deltaTime);
    }
  }

  /**
   * Update during confusion state - random drift, no targeting
   * @param {Object} npc - NPC being updated
   * @param {number} deltaTime - Time since last update
   * @param {number} elapsed - Time elapsed in confusion state
   */
  updateConfusion(npc, deltaTime, elapsed) {
    npc.state = 'confused';
    npc.targetPlayer = null;

    // Random drift - slight random movement
    const driftSpeed = npc.speed * 0.2 * (deltaTime / 1000);
    const driftAngle = npc.rotation + Math.sin(elapsed * 0.005) * 0.3;

    // Small random offsets
    npc.position.x += Math.cos(driftAngle) * driftSpeed * (Math.random() - 0.5) * 2;
    npc.position.y += Math.sin(driftAngle) * driftSpeed * (Math.random() - 0.5) * 2;

    // Slightly erratic rotation
    npc.rotation += (Math.random() - 0.5) * 0.1;

    // No firing during confusion
    return null;
  }

  /**
   * Update during reformation state - move toward new leader
   * @param {Object} npc - NPC being updated
   * @param {Array} allies - Nearby allies
   * @param {number} deltaTime - Time since last update
   * @param {Object} stateInfo - Formation state info
   */
  updateReformation(npc, allies, deltaTime, stateInfo) {
    npc.state = 'reforming';
    npc.targetPlayer = null;

    // Find the new leader
    const newLeader = allies.find(a => a.id === stateInfo.newLeaderId);
    if (!newLeader) {
      // New leader not found, just drift
      return this.updateConfusion(npc, deltaTime, 0);
    }

    // Move toward formation position around new leader
    const formationInfo = this.getFormationRole(npc, allies);
    this.followLeader(npc, newLeader, formationInfo.index, deltaTime);

    // No firing during reformation
    return null;
  }
}

module.exports = FormationStrategy;
