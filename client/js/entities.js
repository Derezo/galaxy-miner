// Galaxy Miner - Other Entities (Players, NPCs)

const Entities = {
  players: new Map(),
  npcs: new Map(),
  projectiles: [],

  init() {
    this.players.clear();
    this.npcs.clear();
    this.projectiles = [];
    console.log('Entities initialized');
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
        shield: data.shield
      });
    } else {
      // Update existing player
      const player = this.players.get(data.id);
      player.targetPosition = { x: data.x, y: data.y };
      player.targetRotation = data.rotation;
      player.hull = data.hull;
      player.shield = data.shield;
    }
  },

  removePlayer(playerId) {
    this.players.delete(playerId);
  },

  updateNPC(data) {
    if (!this.npcs.has(data.id)) {
      this.npcs.set(data.id, {
        id: data.id,
        type: data.type,
        position: { x: data.x, y: data.y },
        targetPosition: { x: data.x, y: data.y },
        rotation: data.rotation,
        targetRotation: data.rotation,
        hull: data.hull
      });
    } else {
      const npc = this.npcs.get(data.id);
      npc.targetPosition = { x: data.x, y: data.y };
      npc.targetRotation = data.rotation;
      npc.hull = data.hull;
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
  }
};
