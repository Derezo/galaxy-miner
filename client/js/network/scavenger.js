// Galaxy Miner - Scavenger Faction Network Handlers

/**
 * Registers scavenger faction event handlers on the socket.
 * Handles rage mechanics, hauler transformations, and Barnacle King events.
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  // Scavenger rage triggered - visual indicator
  socket.on('scavenger:rage', (data) => {
    Logger.log('Scavenger rage triggered:', data);

    // Update NPC state for visual indicators
    let wasAlreadyEnraged = false;
    if (typeof Entities !== 'undefined') {
      const npc = Entities.npcs.get(data.npcId);
      if (npc) {
        // Check if already enraged before updating state
        wasAlreadyEnraged = npc.state === 'enraged';
        npc.state = 'enraged';
        npc.rageTarget = data.targetId;
      }
    }

    // Steam burst particles at NPC location (always show for visual feedback)
    if (typeof ParticleSystem !== 'undefined' && data.x !== undefined) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * 40,
          vy: Math.sin(angle) * 40 - 30,
          life: 400 + Math.random() * 200,
          color: '#ffffff',
          size: 4 + Math.random() * 4,
          type: 'smoke',
          drag: 0.95,
          decay: 1.5
        });
      }
    }

    // Warning notification only on FIRST enrage (not already enraged)
    if (!wasAlreadyEnraged &&
        typeof NotificationManager !== 'undefined' && typeof Player !== 'undefined' &&
        data.targetId === Player.id) {
      NotificationManager.warning('Scavengers are enraged!');
    }
  });

  // Scavenger rage cleared
  socket.on('scavenger:rageClear', (data) => {
    if (typeof Entities !== 'undefined') {
      const npc = Entities.npcs.get(data.npcId);
      if (npc) {
        npc.state = 'idle';
        npc.rageTarget = null;
      }
    }
  });

  // Scrap pile update at base
  socket.on('scavenger:scrapPileUpdate', (data) => {
    Logger.log('Scrap pile updated:', data);

    // Update base scrap pile data for rendering
    if (typeof Entities !== 'undefined') {
      const base = Entities.bases.get(data.baseId);
      if (base) {
        base.scrapPile = data.scrapPile;
      }
    }
  });

  // Hauler transformation starting
  socket.on('scavenger:haulerTransform', (data) => {
    Logger.log('Hauler transformation starting:', data);

    // Yellow construction particles during transformation
    if (typeof ParticleSystem !== 'undefined') {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 800 + Math.random() * 500,
          color: '#D4A017',
          size: 3 + Math.random() * 4,
          type: 'spark',
          drag: 0.95,
          decay: 1
        });
      }
    }
  });

  // Hauler spawned
  socket.on('scavenger:haulerSpawn', (data) => {
    Logger.log('Hauler spawned:', data);

    // Add Hauler to entities
    if (typeof Entities !== 'undefined') {
      Entities.updateNPC({
        id: data.haulerId,
        type: data.type,
        name: data.name,
        faction: data.faction,
        x: data.x,
        y: data.y,
        rotation: data.rotation || 0,
        hull: data.hull,
        hullMax: data.hullMax,
        shield: data.shield || 0,
        shieldMax: data.shieldMax || 0,
        size: data.size,
        sizeMultiplier: data.sizeMultiplier
      });
    }

    // Notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.info('A Scavenger Hauler has emerged!');
    }
  });

  // Hauler grew after collecting wreckage
  socket.on('scavenger:haulerGrow', (data) => {
    Logger.log('Hauler grew:', data);

    // Update Hauler size in entities
    if (typeof Entities !== 'undefined') {
      const npc = Entities.npcs.get(data.npcId);
      if (npc) {
        npc.sizeMultiplier = data.sizeMultiplier;
        // Update actual size based on multiplier
        const baseSize = 80; // Base hauler size
        npc.size = baseSize * data.sizeMultiplier;
      }
    }

    // Visual feedback - growth particles
    if (typeof ParticleSystem !== 'undefined') {
      const npc = Entities.npcs.get(data.npcId);
      if (npc) {
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 40;
          ParticleSystem.spawn({
            x: npc.x,
            y: npc.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 500 + Math.random() * 300,
            color: '#D4A017',
            size: 3 + Math.random() * 3,
            type: 'spark',
            drag: 0.95,
            decay: 1
          });
        }
      }
    }
  });

  // Barnacle King spawned (transformation from Hauler)
  socket.on('scavenger:barnacleKingSpawn', (data) => {
    Logger.log('BARNACLE KING SPAWNED!', data);

    // Massive construction explosion effect
    if (typeof ParticleSystem !== 'undefined') {
      // Yellow/copper burst
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1000 + Math.random() * 500,
          color: i % 2 === 0 ? '#D4A017' : '#B87333',
          size: 4 + Math.random() * 6,
          type: 'spark',
          drag: 0.92,
          decay: 1
        });
      }

      // Dark smoke plume
      for (let i = 0; i < 15; i++) {
        ParticleSystem.spawn({
          x: data.x + (Math.random() - 0.5) * 50,
          y: data.y + (Math.random() - 0.5) * 50,
          vx: (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 40,
          life: 1500 + Math.random() * 700,
          color: '#333333',
          size: 10 + Math.random() * 15,
          type: 'smoke',
          drag: 0.98,
          decay: 0.8
        });
      }
    }

    // Add Barnacle King to entities (remove old Hauler)
    if (typeof Entities !== 'undefined') {
      // Remove old Hauler if exists
      if (data.haulerId) {
        Entities.npcs.delete(data.haulerId);
      }

      Entities.updateNPC({
        id: data.kingId,
        type: 'scavenger_barnacle_king',
        name: data.name,
        faction: 'scavenger',
        x: data.x,
        y: data.y,
        rotation: data.rotation || 0,
        hull: data.hull,
        hullMax: data.hullMax,
        shield: 0,
        shieldMax: 0,
        size: 250,
        isBoss: true
      });
    }

    // Screen shake
    if (typeof Renderer !== 'undefined' && Renderer.shake) {
      Renderer.shake(15, 500);
    }

    // Epic notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error('THE BARNACLE KING HAS EMERGED!');
    }
  });

  // Barnacle King drill charge warning
  socket.on('scavenger:drillCharge', (data) => {
    Logger.log('Barnacle King charging drill!', data);

    // Warning indicator at king position
    if (typeof ParticleSystem !== 'undefined') {
      // Red warning glow
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10;
        const radius = 60;
        ParticleSystem.spawn({
          x: data.kingX + Math.cos(angle) * radius,
          y: data.kingY + Math.sin(angle) * radius,
          vx: Math.cos(angle) * -20,
          vy: Math.sin(angle) * -20,
          life: 1500,
          color: '#ff0000',
          size: 5,
          type: 'glow',
          drag: 0.99,
          decay: 0.5
        });
      }
    }

    // Warning notification if player is the target
    if (typeof NotificationManager !== 'undefined' && typeof Player !== 'undefined' &&
        data.targetId === Player.id) {
      NotificationManager.error('INCOMING DRILL ATTACK - EVADE!');
    }
  });
}

// Export for CommonJS and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.scavenger = { register };
}
