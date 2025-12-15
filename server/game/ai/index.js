// Galaxy Miner - AI Strategy Framework
// Dispatches to faction-specific AI behaviors

const FlankingStrategy = require('./flanking');
const SwarmStrategy = require('./swarm');
const FormationStrategy = require('./formation');
const TerritorialStrategy = require('./territorial');
const RetreatStrategy = require('./retreat');
const ScavengerStrategy = require('./scavenger');
const MiningStrategy = require('./mining');
const PirateStrategy = require('./pirate');

// Map faction to AI strategy
const FACTION_STRATEGIES = {
  pirate: 'pirate',       // Changed from 'flanking' to new pirate strategy
  scavenger: 'scavenger', // Changed from 'retreat' to new scavenger strategy
  swarm: 'swarm',
  void: 'formation',
  rogue_miner: 'mining'   // Changed from 'territorial' to new mining strategy
};

// Strategy instances
const strategies = {
  flanking: new FlankingStrategy(),
  swarm: new SwarmStrategy(),
  formation: new FormationStrategy(),
  territorial: new TerritorialStrategy(),
  retreat: new RetreatStrategy(),
  scavenger: new ScavengerStrategy(),
  mining: new MiningStrategy(),
  pirate: new PirateStrategy()
};

// Retreat thresholds by faction
const RETREAT_THRESHOLDS = {
  pirate: 0.4,       // 40% health
  scavenger: 0.2,    // 20% health (low - they're scrappy)
  swarm: 0,          // Never retreat
  void: 0.3,         // 30% health
  rogue_miner: 0.5   // 50% health (cautious)
};

/**
 * Base AI Strategy interface
 * All strategies implement these methods
 */
class AIStrategy {
  /**
   * Main update loop for NPC behavior
   * @param {Object} npc - The NPC being updated
   * @param {Array} nearbyPlayers - Players within aggro range
   * @param {Array} nearbyAllies - Ally NPCs from same faction
   * @param {number} deltaTime - Time since last update in ms
   * @param {Object} context - Additional context (base, swarm info, etc.)
   * @returns {Object|null} Action to take (fire, retreat, etc.)
   */
  update(npc, nearbyPlayers, nearbyAllies, deltaTime, context = {}) {
    throw new Error('update() must be implemented by strategy');
  }

  /**
   * Select the best target from available players
   * @param {Object} npc - The NPC selecting a target
   * @param {Array} players - Available player targets
   * @returns {Object|null} Selected player target
   */
  selectTarget(npc, players) {
    // Default: select nearest player
    let nearest = null;
    let nearestDist = Infinity;

    for (const player of players) {
      const dx = player.position.x - npc.position.x;
      const dy = player.position.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = player;
      }
    }

    return nearest;
  }

  /**
   * Calculate movement vector toward/around target
   * @param {Object} npc - The NPC moving
   * @param {Object} target - Target position
   * @param {number} deltaTime - Time since last update
   * @returns {Object} Movement vector { x, y, rotation }
   */
  calculateMovement(npc, target, deltaTime) {
    if (!target) return { x: 0, y: 0, rotation: npc.rotation };

    const dx = target.x - npc.position.x;
    const dy = target.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) return { x: 0, y: 0, rotation: npc.rotation };

    const rotation = Math.atan2(dy, dx);
    const moveSpeed = npc.speed * (deltaTime / 1000);

    return {
      x: (dx / dist) * moveSpeed,
      y: (dy / dist) * moveSpeed,
      rotation
    };
  }

  /**
   * Check if NPC should retreat based on health
   * @param {Object} npc - The NPC to check
   * @returns {boolean} True if should retreat
   */
  shouldRetreat(npc) {
    const threshold = RETREAT_THRESHOLDS[npc.faction] || 0.3;
    if (threshold === 0) return false; // Never retreat (swarm)

    const healthPercent = npc.hull / npc.hullMax;
    return healthPercent <= threshold;
  }

  /**
   * Calculate position in formation relative to leader
   * @param {Object} npc - The NPC in formation
   * @param {Object} leader - Formation leader NPC
   * @param {number} index - Position index in formation
   * @returns {Object} Target position { x, y }
   */
  getFormationPosition(npc, leader, index) {
    // Default V-formation
    const spacing = 80;
    const angle = leader.rotation + Math.PI; // Behind leader
    const side = index % 2 === 0 ? 1 : -1;
    const row = Math.floor(index / 2) + 1;

    return {
      x: leader.position.x + Math.cos(angle + side * 0.4 * row) * spacing * row,
      y: leader.position.y + Math.sin(angle + side * 0.4 * row) * spacing * row
    };
  }

  /**
   * Patrol behavior when no targets
   * @param {Object} npc - The patrolling NPC
   * @param {number} deltaTime - Time since last update
   */
  patrol(npc, deltaTime) {
    const patrolRadius = 200;
    const patrolSpeed = npc.speed * 0.3 * (deltaTime / 1000);

    // Determine patrol center (home base or spawn point)
    const center = npc.homeBasePosition || npc.spawnPoint;

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
   * @param {Object} npc - The firing NPC
   * @param {Object} target - Target to fire at
   * @returns {Object|null} Fire action if successful
   */
  tryFire(npc, target) {
    if (!target) return null;

    const dx = target.position.x - npc.position.x;
    const dy = target.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check fire cooldown (1 second base)
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

/**
 * Get the strategy for an NPC based on faction
 * @param {Object} npc - The NPC to get strategy for
 * @returns {AIStrategy} The appropriate strategy instance
 */
function getStrategy(npc) {
  const strategyType = FACTION_STRATEGIES[npc.faction] || 'flanking';
  return strategies[strategyType];
}

/**
 * Handle orphaned NPC in rage mode - aggressive pursuit of any player
 * NPCs in rage mode ignore their normal faction behavior and simply
 * chase and attack the nearest player relentlessly.
 * @param {Object} npc - The enraged NPC
 * @param {Array} allPlayers - All online players
 * @param {number} deltaTime - Time since last update in ms
 * @returns {Object|null} Fire action or null
 */
function handleRageMode(npc, allPlayers, deltaTime) {
  // Find nearest player in extended aggro range
  let target = null;
  let nearestDist = npc.aggroRange;

  for (const player of allPlayers) {
    const dx = player.position.x - npc.position.x;
    const dy = player.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      target = player;
    }
  }

  if (!target) {
    // No target found - patrol around current position
    npc.patrolAngle = npc.patrolAngle || 0;
    npc.patrolAngle += 0.3 * (deltaTime / 1000);

    const patrolRadius = 150;
    const patrolX = (npc.orphanCenter?.x || npc.position.x) + Math.cos(npc.patrolAngle) * patrolRadius;
    const patrolY = (npc.orphanCenter?.y || npc.position.y) + Math.sin(npc.patrolAngle) * patrolRadius;

    const dx = patrolX - npc.position.x;
    const dy = patrolY - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      const moveSpeed = npc.speed * 0.4 * (deltaTime / 1000);
      npc.position.x += (dx / dist) * moveSpeed;
      npc.position.y += (dy / dist) * moveSpeed;
      npc.rotation = Math.atan2(dy, dx);
    }

    return null;
  }

  // Aggressively chase target
  const dx = target.position.x - npc.position.x;
  const dy = target.position.y - npc.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Update rotation to face target
  npc.rotation = Math.atan2(dy, dx);

  // Move toward target (faster than normal - enraged)
  if (dist > npc.weaponRange * 0.7) {
    const moveSpeed = npc.speed * 1.2 * (deltaTime / 1000);  // 20% faster when enraged
    npc.position.x += (dx / dist) * moveSpeed;
    npc.position.y += (dy / dist) * moveSpeed;
  }

  // Try to fire more frequently (reduced cooldown)
  const fireCooldown = 800;  // 0.8 seconds instead of normal 1 second
  const canFire = Date.now() - (npc.lastFireTime || 0) > fireCooldown;

  if (canFire && dist <= npc.weaponRange) {
    npc.lastFireTime = Date.now();

    // Apply rage damage multiplier
    const baseDamage = npc.weaponDamage * (npc.rageMultiplier || 1);

    return {
      action: 'fire',
      target: target,
      weaponType: npc.weaponType,
      weaponTier: npc.weaponTier,
      baseDamage: baseDamage
    };
  }

  return null;
}

/**
 * Main AI update function - replaces simple updateNPC
 * @param {Object} npc - NPC to update
 * @param {Array} allPlayers - All online players
 * @param {Map} allNPCs - All active NPCs (for ally detection)
 * @param {number} deltaTime - Time since last update
 * @param {Function} getActiveBase - Function to look up base by ID (optional, for scavengers)
 * @param {Function} getBasesInRange - Function to get bases within range (optional, for pirates)
 * @returns {Object|null} Action result (fire, etc.)
 */
function updateNPCAI(npc, allPlayers, allNPCs, deltaTime, getActiveBase = null, getBasesInRange = null) {
  // Special handling for orphaned NPCs in rage mode
  if (npc.orphaned && npc.state === 'rage') {
    return handleRageMode(npc, allPlayers, deltaTime);
  }

  const strategy = getStrategy(npc);

  // Find players in aggro range
  const nearbyPlayers = [];
  for (const player of allPlayers) {
    const dx = player.position.x - npc.position.x;
    const dy = player.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= npc.aggroRange) {
      nearbyPlayers.push({ ...player, distance: dist });
    }
  }

  // Find ally NPCs (same faction, for formation/swarm behaviors)
  const nearbyAllies = [];
  // Find hostile NPCs (enemy faction, for defensive behaviors)
  const nearbyHostiles = [];

  // Define faction hostility
  const FACTION_ENEMIES = {
    pirate: ['scavenger', 'rogue_miner'],
    scavenger: ['pirate'],
    rogue_miner: ['pirate']
  };
  const hostileFactions = FACTION_ENEMIES[npc.faction] || [];

  for (const [id, otherNpc] of allNPCs) {
    if (id === npc.id) continue;

    const dx = otherNpc.position.x - npc.position.x;
    const dy = otherNpc.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (otherNpc.faction === npc.faction) {
      // Allies within 500 units
      if (dist <= 500) {
        nearbyAllies.push({ ...otherNpc, distance: dist });
      }
    } else if (hostileFactions.includes(otherNpc.faction)) {
      // Hostile NPCs within aggro range
      if (dist <= npc.aggroRange) {
        nearbyHostiles.push({ ...otherNpc, distance: dist });
      }
    }
  }

  // Sort hostiles by distance
  nearbyHostiles.sort((a, b) => a.distance - b.distance);

  // Build context for strategy
  // For scavengers and rogue miners, get the full base object
  let homeBase = null;
  let hasForeman = false;
  if (npc.homeBaseId && getActiveBase) {
    const base = getActiveBase(npc.homeBaseId);
    if (base) {
      homeBase = {
        id: npc.homeBaseId,
        x: base.x,
        y: base.y,
        type: base.type,
        name: base.name
      };
      // Check for Foreman presence at mining claims
      if (base.type === 'mining_claim') {
        hasForeman = base.hasForeman || false;
      }
    }
  }
  // Fallback to position-only if no base ID or no lookup function
  if (!homeBase && npc.homeBasePosition) {
    homeBase = npc.homeBasePosition;
  }

  // For pirates, get nearby enemy faction bases (scavenger yards, mining claims)
  let nearbyBases = [];
  if (npc.faction === 'pirate' && getBasesInRange) {
    // Get bases within extended range for raiding
    const raidRange = 1500; // Pirates search for bases within 1500 units
    const allBasesInRange = getBasesInRange(npc.position, raidRange);
    // Filter to enemy faction bases only
    nearbyBases = allBasesInRange.filter(base =>
      base.type === 'scavenger_yard' || base.type === 'mining_claim'
    );
  }

  const context = {
    homeBase,
    patrolRadius: npc.patrolRadius || 600,
    territoryRadius: npc.territoryRadius || 500,
    hasForeman,  // For rogue miner Foreman buff
    allNPCs,     // Full NPC map for cross-faction targeting
    nearbyBases, // Enemy bases for pirate raiding
    nearbyHostiles // Enemy NPCs for defensive behaviors
  };

  // Execute faction-specific AI
  return strategy.update(npc, nearbyPlayers, nearbyAllies, deltaTime, context);
}

/**
 * Get all NPCs of a faction from a set
 * @param {Map} allNPCs - All active NPCs
 * @param {string} faction - Faction to filter by
 * @returns {Array} NPCs of that faction
 */
function getNPCsByFaction(allNPCs, faction) {
  const result = [];
  for (const [id, npc] of allNPCs) {
    if (npc.faction === faction) {
      result.push(npc);
    }
  }
  return result;
}

/**
 * Find the leader of a formation group
 * @param {Array} npcs - NPCs to search
 * @returns {Object|null} Leader NPC or null
 */
function findFormationLeader(npcs) {
  // Leader is either marked as such or the strongest unit
  for (const npc of npcs) {
    if (npc.formationLeader || npc.isBoss) {
      return npc;
    }
  }
  // Otherwise, highest hull is leader
  return npcs.reduce((leader, npc) =>
    npc.hullMax > (leader?.hullMax || 0) ? npc : leader
  , null);
}

/**
 * Get the scavenger strategy instance for external calls (rage triggering, etc.)
 * @returns {ScavengerStrategy} The scavenger strategy instance
 */
function getScavengerStrategy() {
  return strategies.scavenger;
}

/**
 * Get the mining strategy instance for external calls (rage triggering, etc.)
 * @returns {MiningStrategy} The mining strategy instance
 */
function getMiningStrategy() {
  return strategies.mining;
}

/**
 * Get the pirate strategy instance for external calls (intel, dreadnought spawn, etc.)
 * @returns {PirateStrategy} The pirate strategy instance
 */
function getPirateStrategy() {
  return strategies.pirate;
}

module.exports = {
  AIStrategy,
  getStrategy,
  getScavengerStrategy,
  getMiningStrategy,
  getPirateStrategy,
  updateNPCAI,
  getNPCsByFaction,
  findFormationLeader,
  FACTION_STRATEGIES,
  RETREAT_THRESHOLDS
};
