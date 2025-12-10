// Galaxy Miner - Other Entities (Players, NPCs)

// Debug sync module (loaded via script tag or available globally)
const getDebugSync = () => typeof debugSync !== 'undefined' ? debugSync : null;

// Desync detection thresholds
const TELEPORT_THRESHOLD = 500;     // Units - log if entity jumps more than this
const STALE_THRESHOLD = 2000;       // Ms - log if no update for this long
const STALE_CHECK_INTERVAL = 1000;  // Ms - how often to check for stale entities

const Entities = {
  players: new Map(),
  npcs: new Map(),
  wreckage: new Map(),
  projectiles: [],
  baseStates: new Map(), // Track destroyed/damaged base states
  bases: new Map(),      // Track active bases for radar display
  projectileTrails: [],  // Track recent weapon fire for radar (Tier 4+)
  _lastStaleCheck: 0,    // Timestamp of last staleness check

  // Scrap Siphon animation state
  siphonAnimations: new Map(), // wreckageId -> { startTime, duration, startPos, targetPos }

  init() {
    this.players.clear();
    this.npcs.clear();
    this.wreckage.clear();
    this.projectiles = [];
    this.baseStates.clear();
    this.bases.clear();
    this.projectileTrails = [];
    this.siphonAnimations.clear();
    Logger.log('Entities initialized');
  },

  update(dt) {
    // Interpolate other players
    for (const [id, player] of this.players) {
      this.interpolateEntity(player, dt);
    }

    // Update NPCs
    for (const [id, npc] of this.npcs) {
      this.interpolateEntity(npc, dt);
    }

    // Update projectiles
    this.projectiles = this.projectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt * 1000;
      return p.lifetime > 0;
    });

    // Update wreckage (rotation animation)
    this.updateWreckageRotation(dt);

    // Periodically check for stale entities (desync detection)
    this._checkStaleEntities();
  },

  // Check for entities that haven't received updates in too long
  _checkStaleEntities() {
    const now = Date.now();
    if (now - this._lastStaleCheck < STALE_CHECK_INTERVAL) return;
    this._lastStaleCheck = now;

    const ds = getDebugSync();
    if (!ds || !ds.isEnabled()) return;

    // Check NPCs for staleness
    for (const [id, npc] of this.npcs) {
      if (npc.lastUpdateTime && now - npc.lastUpdateTime > STALE_THRESHOLD) {
        ds.log('ENTITY_STALE', {
          entityId: id,
          type: npc.type,
          faction: npc.faction,
          staleDuration: now - npc.lastUpdateTime,
          state: npc.state,
          position: npc.position
        });
      }
    }

    // Check other players for staleness
    for (const [id, player] of this.players) {
      if (player.lastUpdateTime && now - player.lastUpdateTime > STALE_THRESHOLD) {
        ds.log('ENTITY_STALE', {
          entityId: id,
          type: 'player',
          username: player.username,
          staleDuration: now - player.lastUpdateTime,
          position: player.position
        });
      }
    }
  },

  interpolateEntity(entity, dt) {
    // Simple interpolation towards target position
    if (entity.targetPosition) {
      const lerp = Math.min(1, dt * 10);
      entity.position.x += (entity.targetPosition.x - entity.position.x) * lerp;
      entity.position.y += (entity.targetPosition.y - entity.position.y) * lerp;

      // Interpolate rotation
      let rotDiff = entity.targetRotation - entity.rotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      entity.rotation += rotDiff * lerp;
    }
  },

  updatePlayer(data) {
    if (data.id === Player.id) return; // Don't update local player

    const now = Date.now();

    if (!this.players.has(data.id)) {
      // New player
      this.players.set(data.id, {
        id: data.id,
        username: data.username,
        position: { x: data.x, y: data.y },
        targetPosition: { x: data.x, y: data.y },
        rotation: data.rotation,
        targetRotation: data.rotation,
        hull: data.hull,
        shield: data.shield,
        colorId: data.colorId || 'green',
        lastUpdateTime: now
      });
    } else {
      // Update existing player
      const player = this.players.get(data.id);

      // Teleport detection - check if position jumped significantly
      const dx = data.x - player.position.x;
      const dy = data.y - player.position.y;
      const jumpDistance = Math.sqrt(dx * dx + dy * dy);

      if (jumpDistance > TELEPORT_THRESHOLD) {
        const ds = getDebugSync();
        if (ds && ds.isEnabled()) {
          ds.log('ENTITY_TELEPORT', {
            entityId: data.id,
            type: 'player',
            username: player.username,
            jumpDistance: Math.round(jumpDistance),
            previousPos: { x: player.position.x, y: player.position.y },
            newPos: { x: data.x, y: data.y }
          });
        }
      }

      player.targetPosition = { x: data.x, y: data.y };
      player.targetRotation = data.rotation;
      player.hull = data.hull;
      player.shield = data.shield;
      player.status = data.status || 'idle';
      player.lastUpdateTime = now;
      // Update color if provided
      if (data.colorId) {
        player.colorId = data.colorId;
      }
    }
  },

  updatePlayerColor(playerId, colorId) {
    const player = this.players.get(playerId);
    if (player) {
      player.colorId = colorId;
    }
  },

  removePlayer(playerId) {
    this.players.delete(playerId);
  },

  updatePlayerMining(playerId, miningData) {
    const player = this.players.get(playerId);
    if (player) {
      player.mining = miningData;
    }
  },

  clearPlayerMining(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.mining = null;
    }
  },

  updateNPC(data) {
    const now = Date.now();

    // Get previous state for transition detection
    const existingNpc = this.npcs.get(data.id);
    const previousState = existingNpc ? existingNpc.state : null;

    // Debug logging for rogue miner mining beam data flow
    if (data.faction === 'rogue_miner') {
      const hasMTP = !!data.miningTargetPos;
      const stateChanged = previousState !== data.state;
      if (stateChanged) {
        Logger.category('rogue_miners', `${data.id}: ${previousState || 'NEW'} → ${data.state} mtp=${hasMTP}`);
      }
    }

    if (!this.npcs.has(data.id)) {
      // New NPC - track spawn time for swarm egg hatching animation
      const isSwarm = (data.faction === 'swarm');
      this.npcs.set(data.id, {
        id: data.id,
        type: data.type,
        name: data.name || data.type || 'NPC',
        faction: data.faction || 'pirate',
        position: { x: data.x, y: data.y },
        targetPosition: { x: data.x, y: data.y },
        rotation: data.rotation || 0,
        targetRotation: data.rotation || 0,
        hull: data.hull,
        hullMax: data.hullMax || data.hull || 100,
        shield: data.shield,
        shieldMax: data.shieldMax || data.shield || 0,
        state: data.state || 'patrol',
        // Swarm egg hatching - track spawn time for 2.5 second hatch animation
        spawnTime: isSwarm ? now : null,
        hatchDuration: isSwarm ? (data.type === 'swarm_queen' ? 4000 : 2500) : 0,
        lastUpdateTime: now,
        // Mining/collection beam targets (must be captured on initial creation)
        miningTargetPos: data.miningTargetPos || null,
        collectingWreckagePos: data.collectingWreckagePos || null
      });

    } else {
      const npc = this.npcs.get(data.id);

      // Teleport detection - check if position jumped significantly
      const dx = data.x - npc.position.x;
      const dy = data.y - npc.position.y;
      const jumpDistance = Math.sqrt(dx * dx + dy * dy);

      if (jumpDistance > TELEPORT_THRESHOLD) {
        const ds = getDebugSync();
        if (ds && ds.isEnabled()) {
          ds.log('ENTITY_TELEPORT', {
            entityId: data.id,
            type: npc.type,
            faction: npc.faction,
            jumpDistance: Math.round(jumpDistance),
            previousPos: { x: npc.position.x, y: npc.position.y },
            newPos: { x: data.x, y: data.y }
          });
        }
      }

      npc.targetPosition = { x: data.x, y: data.y };
      npc.targetRotation = data.rotation || npc.targetRotation;
      npc.hull = data.hull;
      npc.shield = data.shield;
      npc.state = data.state || npc.state;
      npc.lastUpdateTime = now;
      // Update max values if provided
      if (data.hullMax !== undefined) npc.hullMax = data.hullMax;
      if (data.shieldMax !== undefined) npc.shieldMax = data.shieldMax;
      if (data.type) npc.type = data.type;
      if (data.name) npc.name = data.name;
      // Update wreckage collection position for tractor beam animation
      npc.collectingWreckagePos = data.collectingWreckagePos || null;
      // Update mining target position for mining beam animation (rogue miners)
      // Only update if explicitly provided - don't overwrite existing value from npc:action
      if (data.miningTargetPos !== undefined) {
        npc.miningTargetPos = data.miningTargetPos;
      }
      if (data.faction) npc.faction = data.faction;
    }
  },

  removeNPC(npcId) {
    this.npcs.delete(npcId);
  },

  addProjectile(data) {
    this.projectiles.push({
      x: data.x,
      y: data.y,
      vx: Math.cos(data.direction) * 500,
      vy: Math.sin(data.direction) * 500,
      type: data.type || 'kinetic',
      lifetime: 2000
    });
  },

  getPlayersInRange(position, range) {
    const result = [];
    for (const [id, player] of this.players) {
      const dx = player.position.x - position.x;
      const dy = player.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        result.push({ ...player, distance: dist });
      }
    }
    return result;
  },

  getNPCsInRange(position, range) {
    const result = [];
    for (const [id, npc] of this.npcs) {
      const dx = npc.position.x - position.x;
      const dy = npc.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        result.push({ ...npc, distance: dist });
      }
    }
    return result;
  },

  // Wreckage management
  updateWreckage(data) {
    if (!this.wreckage.has(data.id)) {
      this.wreckage.set(data.id, {
        id: data.id,
        position: { x: data.x, y: data.y },
        faction: data.faction || 'unknown',
        npcName: data.npcName || 'Unknown',
        contentCount: data.contentCount || 0,
        despawnTime: data.despawnTime,
        spawnTime: Date.now(),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3
      });
    }
  },

  removeWreckage(wreckageId) {
    this.wreckage.delete(wreckageId);
  },

  getWreckageInRange(position, range) {
    const result = [];
    for (const [id, w] of this.wreckage) {
      const dx = w.position.x - position.x;
      const dy = w.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        result.push({ ...w, distance: dist });
      }
    }
    return result;
  },

  getClosestWreckage(position, maxRange) {
    let closest = null;
    let closestDist = maxRange;

    for (const [id, w] of this.wreckage) {
      const dx = w.position.x - position.x;
      const dy = w.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closest = w;
        closestDist = dist;
      }
    }

    return closest;
  },

  updateWreckageRotation(dt) {
    for (const [id, w] of this.wreckage) {
      w.rotation += w.rotationSpeed * dt;
    }
  },

  // Scrap Siphon animation methods
  startSiphonAnimation(wreckageIds, duration) {
    const now = Date.now();
    Logger.log('[SIPHON] startSiphonAnimation called with', wreckageIds.length, 'wreckage pieces');
    for (const wreckageId of wreckageIds) {
      const wreckage = this.wreckage.get(wreckageId);
      if (wreckage) {
        Logger.log('[SIPHON] Adding animation for wreckage', wreckageId, 'at', wreckage.position);
        this.siphonAnimations.set(wreckageId, {
          startTime: now,
          duration: duration,
          startPos: { x: wreckage.position.x, y: wreckage.position.y },
          faction: wreckage.faction
        });
      } else {
        Logger.warn('[SIPHON] Wreckage not found:', wreckageId);
      }
    }
    Logger.log('[SIPHON] Active animations:', this.siphonAnimations.size);
  },

  clearSiphonAnimations(wreckageIds) {
    for (const wreckageId of wreckageIds) {
      this.siphonAnimations.delete(wreckageId);
    }
  },

  getSiphonAnimationState(wreckageId) {
    const anim = this.siphonAnimations.get(wreckageId);
    if (!anim) return null;

    const now = Date.now();
    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);

    return {
      progress,
      startPos: anim.startPos,
      faction: anim.faction,
      isComplete: progress >= 1
    };
  },

  // Base state management
  updateBaseHealth(baseId, health, maxHealth) {
    if (!this.baseStates.has(baseId)) {
      this.baseStates.set(baseId, {
        destroyed: false,
        health: health,
        maxHealth: maxHealth
      });
    } else {
      const state = this.baseStates.get(baseId);
      state.health = health;
      state.maxHealth = maxHealth;
    }
  },

  destroyBase(baseId) {
    if (!this.baseStates.has(baseId)) {
      this.baseStates.set(baseId, {
        destroyed: true,
        health: 0,
        maxHealth: 0,
        destroyedAt: Date.now()
      });
    } else {
      const state = this.baseStates.get(baseId);
      state.destroyed = true;
      state.health = 0;
      state.destroyedAt = Date.now();
    }
  },

  respawnBase(baseId, data) {
    if (this.baseStates.has(baseId)) {
      const state = this.baseStates.get(baseId);
      state.destroyed = false;
      state.health = data.health || data.maxHealth;
      state.maxHealth = data.maxHealth;
      delete state.destroyedAt;
    } else {
      this.baseStates.set(baseId, {
        destroyed: false,
        health: data.health || data.maxHealth,
        maxHealth: data.maxHealth
      });
    }
  },

  isBaseDestroyed(baseId) {
    const state = this.baseStates.get(baseId);
    return state ? state.destroyed : false;
  },

  getBaseState(baseId) {
    return this.baseStates.get(baseId);
  },

  // Update bases from server broadcast (for radar display)
  updateBases(basesArray) {
    // Clear old bases and replace with new data
    this.bases.clear();
    for (const base of basesArray) {
      this.bases.set(base.id, {
        id: base.id,
        position: base.position || { x: base.x, y: base.y },
        faction: base.faction,
        type: base.type,
        name: base.name,
        health: base.health,
        maxHealth: base.maxHealth,
        size: base.size,
        scrapPile: base.scrapPile || null,
        claimCredits: base.claimCredits || 0
      });
    }
  },

  // Add a projectile trail for radar display (Tier 4+)
  addProjectileTrail(data) {
    this.projectileTrails.push({
      startX: data.x,
      startY: data.y,
      endX: data.x + Math.cos(data.direction) * 100,
      endY: data.y + Math.sin(data.direction) * 100,
      type: data.type || 'kinetic',
      tier: data.tier || 1,
      timestamp: Date.now()
    });

    // Trim old trails (keep last 500ms)
    const cutoff = Date.now() - 500;
    this.projectileTrails = this.projectileTrails.filter(t => t.timestamp > cutoff);
  },

  // Get bases in range for radar
  getBasesInRange(position, range) {
    const result = [];
    for (const [id, base] of this.bases) {
      const dx = base.position.x - position.x;
      const dy = base.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        result.push({ ...base, distance: dist });
      }
    }
    return result;
  }
};
