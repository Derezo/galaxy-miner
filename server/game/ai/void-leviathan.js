// Galaxy Miner - Void Leviathan Boss AI
// Otherworldly boss with gravity well, consume, and minion spawning abilities

const CONSTANTS = require('../../../shared/constants');
const logger = require('../../../shared/logger');

/**
 * VoidLeviathanAI - Controls the Void Leviathan boss behavior
 *
 * Abilities:
 * - Gravity Well: Creates a pulling vortex that damages players
 * - Consume: Absorbs nearby void NPCs to heal
 * - Minion Spawning: Opens rifts that spawn void_whispers
 *
 * Combat Flow:
 * 1. Standard combat with dark energy beam attacks
 * 2. Periodically cast Gravity Well (with warning)
 * 3. Consume nearby minions when damaged
 * 4. Spawn minions at health thresholds and continuously
 */
class VoidLeviathanAI {
  constructor() {
    // Track active Leviathans
    this.leviathans = new Map();
  }

  /**
   * Initialize Leviathan state when it spawns
   * @param {Object} npc - The Leviathan NPC
   */
  initializeLeviathan(npc) {
    if (this.leviathans.has(npc.id)) return;

    const config = CONSTANTS.VOID_LEVIATHAN_ABILITIES;

    this.leviathans.set(npc.id, {
      // Cooldowns
      gravityWellCooldown: 0,
      consumeCooldown: 0,
      continuousSpawnTimer: 0,

      // Health threshold tracking
      triggeredThresholds: new Set(),

      // Ability states
      gravityWellState: null, // null, 'warning', 'active'
      gravityWellPosition: null,
      gravityWellStartTime: 0,

      consumeState: null, // null, 'tendril', 'drag', 'dissolve'
      consumeTarget: null,
      consumeStartTime: 0,

      // Spawned minion tracking
      spawnedMinions: new Set(),

      // Store max health for threshold calculations
      maxHull: npc.hull,
      maxShield: npc.shield
    });
  }

  /**
   * Get Leviathan state, initializing if needed
   * @param {Object} npc - The Leviathan NPC
   * @returns {Object} Leviathan state
   */
  getState(npc) {
    if (!this.leviathans.has(npc.id)) {
      this.initializeLeviathan(npc);
    }
    return this.leviathans.get(npc.id);
  }

  /**
   * Main update loop for Leviathan boss
   * @param {Object} npc - The Leviathan NPC
   * @param {Array} nearbyPlayers - Players within range
   * @param {Array} nearbyAllies - Nearby void NPCs (potential consume targets)
   * @param {number} deltaTime - Time since last update in ms
   * @param {Object} context - Additional context
   * @returns {Object|null} Action to take
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context) {
    try {
      const state = this.getState(npc);

      // Update cooldowns
      this.updateCooldowns(state, deltaTime);

      // Check for minion spawning (priority - health thresholds)
      const spawnAction = this.checkMinionSpawns(npc, state, context);
      if (spawnAction) {
        return spawnAction;
      }

      // Handle ongoing abilities
      if (state.gravityWellState) {
        return this.updateGravityWell(npc, state, nearbyPlayers, deltaTime, context);
      }

      if (state.consumeState) {
        return this.updateConsume(npc, state, nearbyAllies, deltaTime, context);
      }

      // No players nearby - patrol
      if (nearbyPlayers.length === 0) {
        npc.state = 'patrol';
        this.patrol(npc, deltaTime, context);
        return null;
      }

      npc.state = 'combat';

      // Try to use abilities
      const abilityAction = this.tryAbilities(npc, state, nearbyPlayers, nearbyAllies, context);
      if (abilityAction) {
        return abilityAction;
      }

      // Standard combat
      return this.combat(npc, state, nearbyPlayers, deltaTime);
    } catch (error) {
      logger.error(`VoidLeviathanAI.update error for NPC ${npc?.id}:`, error.message);
      // Return null to skip this tick's action, allowing recovery
      return null;
    }
  }

  /**
   * Update ability cooldowns
   */
  updateCooldowns(state, deltaTime) {
    if (state.gravityWellCooldown > 0) {
      state.gravityWellCooldown -= deltaTime;
    }
    if (state.consumeCooldown > 0) {
      state.consumeCooldown -= deltaTime;
    }
    state.continuousSpawnTimer += deltaTime;
  }

  /**
   * Check for minion spawning triggers
   */
  checkMinionSpawns(npc, state, context) {
    const config = CONSTANTS.VOID_LEVIATHAN_MINIONS;
    const healthPercent = npc.hull / state.maxHull;

    // Check health thresholds
    for (const threshold of config.thresholds) {
      if (healthPercent <= threshold.health && !state.triggeredThresholds.has(threshold.health)) {
        state.triggeredThresholds.add(threshold.health);

        // Return spawn event for this threshold
        return {
          action: 'void_spawn_minions',
          leviathanId: npc.id,
          position: { x: npc.position.x, y: npc.position.y },
          riftCount: threshold.rifts,
          trigger: 'threshold',
          healthThreshold: threshold.health
        };
      }
    }

    // Check continuous spawning
    if (state.continuousSpawnTimer >= config.continuousInterval) {
      state.continuousSpawnTimer = 0;

      // Check minion cap
      const activeMinions = this.countActiveMinions(state, context);
      if (activeMinions < config.maxActiveMinions) {
        return {
          action: 'void_spawn_minions',
          leviathanId: npc.id,
          position: { x: npc.position.x, y: npc.position.y },
          riftCount: 1,
          trigger: 'continuous'
        };
      }
    }

    return null;
  }

  /**
   * Count active minions spawned by this Leviathan
   */
  countActiveMinions(state, context) {
    if (!context.allNPCs) return 0;

    let count = 0;
    for (const minionId of state.spawnedMinions) {
      if (context.allNPCs.has(minionId)) {
        count++;
      } else {
        // Clean up dead minions from tracking
        state.spawnedMinions.delete(minionId);
      }
    }
    return count;
  }

  /**
   * Try to use abilities based on situation
   */
  tryAbilities(npc, state, nearbyPlayers, nearbyAllies, context) {
    const config = CONSTANTS.VOID_LEVIATHAN_ABILITIES;

    // Try Gravity Well - use when multiple players are clustered
    if (state.gravityWellCooldown <= 0 && nearbyPlayers.length >= 1) {
      const playerCenter = this.calculatePlayerCenter(nearbyPlayers);
      const distToCenter = this.distance(npc.position, playerCenter);

      // Use gravity well if players are within range
      if (distToCenter <= config.GRAVITY_WELL.radius * 1.5) {
        return this.startGravityWell(npc, state, playerCenter, context);
      }
    }

    // Try Consume - use when damaged and minions are nearby
    if (state.consumeCooldown <= 0) {
      const healthPercent = npc.hull / state.maxHull;

      // Only consume when below 80% health
      if (healthPercent < 0.8 && nearbyAllies.length > 0) {
        // Find nearest void NPC to consume
        const consumeTarget = this.findConsumeTarget(npc, nearbyAllies, config.CONSUME.range);
        if (consumeTarget) {
          return this.startConsume(npc, state, consumeTarget, context);
        }
      }
    }

    return null;
  }

  /**
   * Start Gravity Well ability
   */
  startGravityWell(npc, state, position, context) {
    const config = CONSTANTS.VOID_LEVIATHAN_ABILITIES.GRAVITY_WELL;

    state.gravityWellState = 'warning';
    state.gravityWellPosition = { x: position.x, y: position.y };
    state.gravityWellStartTime = Date.now();
    state.gravityWellCooldown = config.cooldown;

    return {
      action: 'void_gravity_well',
      leviathanId: npc.id,
      position: state.gravityWellPosition,
      phase: 'warning',
      radius: config.radius,
      warningDuration: config.warningDuration
    };
  }

  /**
   * Update ongoing Gravity Well
   */
  updateGravityWell(npc, state, nearbyPlayers, deltaTime, context) {
    const config = CONSTANTS.VOID_LEVIATHAN_ABILITIES.GRAVITY_WELL;
    const elapsed = Date.now() - state.gravityWellStartTime;

    if (state.gravityWellState === 'warning') {
      // Check if warning phase is complete
      if (elapsed >= config.warningDuration) {
        state.gravityWellState = 'active';
        state.gravityWellStartTime = Date.now();

        return {
          action: 'void_gravity_well',
          leviathanId: npc.id,
          position: state.gravityWellPosition,
          phase: 'active',
          radius: config.radius,
          activeDuration: config.activeDuration
        };
      }
    } else if (state.gravityWellState === 'active') {
      // Apply pull and damage to players
      const activeElapsed = Date.now() - state.gravityWellStartTime;

      if (activeElapsed >= config.activeDuration) {
        // End gravity well
        state.gravityWellState = null;
        state.gravityWellPosition = null;

        return {
          action: 'void_gravity_well',
          leviathanId: npc.id,
          phase: 'end'
        };
      }

      // Calculate effects on players (handled by engine.js)
      return {
        action: 'void_gravity_well_tick',
        leviathanId: npc.id,
        position: state.gravityWellPosition,
        radius: config.radius,
        damageRadius: config.damageRadius,
        pullStrength: config.pullStrength,
        damageCenter: config.damageCenter,
        damageEdge: config.damageEdge,
        affectedPlayers: this.getPlayersInRadius(nearbyPlayers, state.gravityWellPosition, config.radius)
      };
    }

    return null;
  }

  /**
   * Start Consume ability
   */
  startConsume(npc, state, target, context) {
    const config = CONSTANTS.VOID_LEVIATHAN_ABILITIES.CONSUME;

    state.consumeState = 'tendril';
    state.consumeTarget = target.id;
    state.consumeStartTime = Date.now();
    state.consumeCooldown = config.cooldown;

    return {
      action: 'void_consume',
      leviathanId: npc.id,
      targetNpcId: target.id,
      targetPosition: { x: target.position.x, y: target.position.y },
      phase: 'tendril',
      tendrilSpeed: config.tendrilSpeed
    };
  }

  /**
   * Update ongoing Consume
   */
  updateConsume(npc, state, nearbyAllies, deltaTime, context) {
    const config = CONSTANTS.VOID_LEVIATHAN_ABILITIES.CONSUME;
    const elapsed = Date.now() - state.consumeStartTime;

    // Find the target NPC
    const target = nearbyAllies.find(ally => ally.id === state.consumeTarget);

    // Target died or escaped - cancel consume
    if (!target) {
      state.consumeState = null;
      state.consumeTarget = null;
      return null;
    }

    const distToTarget = this.distance(npc.position, target.position);

    if (state.consumeState === 'tendril') {
      // Tendril reaches target based on distance and speed
      const tendrilReachTime = (distToTarget / config.tendrilSpeed) * 1000;

      if (elapsed >= tendrilReachTime) {
        state.consumeState = 'drag';
        state.consumeStartTime = Date.now();

        return {
          action: 'void_consume',
          leviathanId: npc.id,
          targetNpcId: target.id,
          phase: 'drag',
          dragDuration: config.dragDuration
        };
      }
    } else if (state.consumeState === 'drag') {
      if (elapsed >= config.dragDuration) {
        state.consumeState = 'dissolve';
        state.consumeStartTime = Date.now();

        // Calculate heal amount
        const healAmount = (target.hull + target.shield) * config.healMultiplier;

        return {
          action: 'void_consume',
          leviathanId: npc.id,
          targetNpcId: target.id,
          phase: 'dissolve',
          healAmount: healAmount,
          removeTarget: true
        };
      }
    } else if (state.consumeState === 'dissolve') {
      // Dissolve animation complete
      state.consumeState = null;
      state.consumeTarget = null;
      return null;
    }

    return null;
  }

  /**
   * Find best target for Consume ability
   */
  findConsumeTarget(npc, allies, range) {
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const ally of allies) {
      // Skip other leviathans
      if (ally.type === 'void_leviathan') continue;

      const dist = this.distance(npc.position, ally.position);
      if (dist > range) continue;

      // Prefer closer, healthier NPCs (more heal value)
      const healthScore = (ally.hull || 0) + (ally.shield || 0);
      const distanceScore = (range - dist) / range;
      const score = healthScore * 0.7 + distanceScore * 100 * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = ally;
      }
    }

    return bestTarget;
  }

  /**
   * Standard combat behavior
   */
  combat(npc, state, nearbyPlayers, deltaTime) {
    // Find best target (lowest health)
    const target = this.selectTarget(nearbyPlayers);
    if (!target) return null;

    npc.targetPlayer = target.id;

    // Move toward optimal combat range
    const optimalRange = npc.weaponRange * 0.7;
    const dist = this.distance(npc.position, target.position);

    if (dist > optimalRange) {
      this.moveToward(npc, target.position, deltaTime);
    } else if (dist < optimalRange * 0.5) {
      // Too close - back off slowly
      this.moveAway(npc, target.position, deltaTime * 0.5);
    }

    // Face target
    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    npc.rotation = Math.atan2(dy, dx);

    // Try to fire
    return this.tryFire(npc, target);
  }

  /**
   * Select target - prioritize damaged players
   */
  selectTarget(players) {
    if (players.length === 0) return null;

    // Filter out dead players first
    const alivePlayers = players.filter(p => !p.isDead);
    if (alivePlayers.length === 0) return null;

    // Sort by health percentage (focus damaged targets)
    const sorted = [...alivePlayers].sort((a, b) => {
      const aHealth = (a.hull || 100) / (a.hullMax || 100);
      const bHealth = (b.hull || 100) / (b.hullMax || 100);
      return aHealth - bHealth;
    });

    return sorted[0];
  }

  /**
   * Patrol behavior when no players nearby
   */
  patrol(npc, deltaTime, context) {
    const patrolRadius = 300;
    const patrolSpeed = npc.speed * 0.3 * (deltaTime / 1000);

    // Patrol around home base or spawn point
    const center = npc.homeBasePosition || npc.spawnPoint || { x: 0, y: 0 };

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
  }

  /**
   * Attempt to fire at target
   */
  tryFire(npc, target) {
    if (!target) return null;

    const dist = this.distance(npc.position, target.position);

    // Fire cooldown (1 second base for Leviathan)
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

  /**
   * Move NPC toward a position
   */
  moveToward(npc, position, deltaTime) {
    const dx = position.x - npc.position.x;
    const dy = position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const moveSpeed = npc.speed * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }
  }

  /**
   * Move NPC away from a position
   */
  moveAway(npc, position, deltaTime) {
    const dx = npc.position.x - position.x;
    const dy = npc.position.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const moveSpeed = npc.speed * 0.5 * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
    }
  }

  /**
   * Calculate center of player positions
   */
  calculatePlayerCenter(players) {
    if (players.length === 0) return { x: 0, y: 0 };

    let x = 0, y = 0;
    for (const player of players) {
      x += player.position.x;
      y += player.position.y;
    }

    return { x: x / players.length, y: y / players.length };
  }

  /**
   * Get players within radius of a position
   */
  getPlayersInRadius(players, position, radius) {
    return players.filter(player => {
      // Skip dead players
      if (player.isDead) return false;
      const dist = this.distance(player.position, position);
      return dist <= radius;
    }).map(player => ({
      id: player.id,
      distance: this.distance(player.position, position)
    }));
  }

  /**
   * Calculate distance between two positions
   */
  distance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Clean up Leviathan state when it dies
   * @param {string} npcId - ID of the dead Leviathan
   */
  cleanup(npcId) {
    this.leviathans.delete(npcId);
  }

  /**
   * Register a spawned minion for tracking
   * @param {string} leviathanId - Leviathan that spawned the minion
   * @param {string} minionId - ID of the spawned minion
   */
  registerMinion(leviathanId, minionId) {
    const state = this.leviathans.get(leviathanId);
    if (state) {
      state.spawnedMinions.add(minionId);
    }
  }
}

// Singleton instance
const voidLeviathanAI = new VoidLeviathanAI();

module.exports = {
  VoidLeviathanAI,
  voidLeviathanAI
};
