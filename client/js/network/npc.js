// Galaxy Miner - NPC & Base Network Handlers

/**
 * Registers NPC, base, and faction-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  // NPC events - spawn, update, destroyed
  socket.on('npc:spawn', (data) => {
    Entities.updateNPC({
      id: data.id,
      type: data.type,
      name: data.name,
      faction: data.faction,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      hull: data.hull,
      hullMax: data.hullMax,
      shield: data.shield,
      shieldMax: data.shieldMax
    });
  });

  socket.on('npc:update', (data) => {
    // Server now sends full NPC data in updates, so we can create NPCs
    // if they don't exist (happens when player enters range of existing NPC)
    Entities.updateNPC({
      id: data.id,
      type: data.type,
      name: data.name,
      faction: data.faction,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      state: data.state,
      hull: data.hull,
      hullMax: data.hullMax,
      shield: data.shield,
      shieldMax: data.shieldMax,
      // Mining beam target position for rogue miners
      miningTargetPos: data.miningTargetPos
    });
  });

  // NPC action events - used for immediate state updates like mining beam
  socket.on('npc:action', (data) => {
    const npc = Entities.npcs.get(data.npcId);

    // Log mining-related actions for diagnostics (rogue miners specific)
    if (data.action === 'startMining' || data.action === 'miningComplete') {
      const npcExists = !!npc;
      const hasTargetPos = !!data.targetPos;
      Logger.category('rogue_miners', `npc:action received: ${data.action} npc=${data.npcId} exists=${npcExists} hasTargetPos=${hasTargetPos}`);
    }

    if (!npc) return;

    // Handle mining-related actions for rogue miners
    if (data.action === 'startMining' && data.targetPos) {
      npc.miningTargetPos = data.targetPos;
      Logger.category('rogue_miners', `npc:action APPLIED: ${data.npcId} miningTargetPos set to (${data.targetPos.x.toFixed(0)}, ${data.targetPos.y.toFixed(0)})`);
    } else if (data.action === 'miningComplete') {
      npc.miningTargetPos = null;
      Logger.category('rogue_miners', `npc:action APPLIED: ${data.npcId} miningTargetPos cleared`);
    }
  });

  socket.on('npc:destroyed', (data) => {
    // Get NPC data BEFORE removing it
    const npc = Entities.npcs.get(data.id);

    // Play death sound based on faction
    if (npc && typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('death_' + npc.faction, npc.position.x, npc.position.y);
    }

    // Trigger death effect
    if (npc && typeof DeathEffects !== 'undefined') {
      // Queen gets special extended death sequence
      if (npc.type === 'swarm_queen') {
        DeathEffects.triggerQueenDeath(
          npc.position.x,
          npc.position.y,
          npc.phase || 'HUNT',
          npc.rotation || 0
        );
      } else if (npc.type === 'scavenger_hauler' || npc.type === 'scavenger_barnacle_king') {
        // Hauler and Barnacle King get deconstruction death effect
        DeathEffects.trigger(
          npc.position.x,
          npc.position.y,
          'deconstruction',
          npc.faction,
          { rotation: npc.rotation || 0, npcType: npc.type }
        );
      } else {
        // Standard faction-specific death effect
        const effectType = DeathEffects.getEffectForFaction(npc.faction);
        DeathEffects.trigger(npc.position.x, npc.position.y, effectType, npc.faction);
      }
    }

    // Now remove the NPC
    Entities.removeNPC(data.id);
  });

  // Swarm Queen spawning minions
  socket.on('npc:queenSpawn', (data) => {
    // Visual effect: organic burst at queen location
    if (typeof ParticleSystem !== 'undefined') {
      // Green organic burst
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
        const speed = 50 + Math.random() * 100;
        ParticleSystem.spawn({
          x: data.queenX,
          y: data.queenY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random() * 200,
          color: '#00ff66',
          size: 4 + Math.random() * 4,
          type: 'glow',
          drag: 0.92,
          decay: 1
        });
      }

      // Bio-electric "birth lines" to each spawned unit
      if (data.spawned && Array.isArray(data.spawned)) {
        for (const minion of data.spawned) {
          // Draw connecting particles from queen to minion
          const dx = minion.x - data.queenX;
          const dy = minion.y - data.queenY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const steps = Math.floor(dist / 20);

          for (let i = 0; i < steps; i++) {
            const t = i / steps;
            ParticleSystem.spawn({
              x: data.queenX + dx * t,
              y: data.queenY + dy * t,
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 0.5) * 20,
              life: 300 + i * 30,
              color: i % 2 === 0 ? '#00ff66' : '#00cc44',
              size: 2 + Math.random() * 2,
              type: 'glow',
              drag: 0.98,
              decay: 1
            });
          }
        }
      }
    }
  });

  // Swarm linked damage visualization
  socket.on('swarm:linkedDamage', (data) => {
    if (typeof LinkedDamageEffect !== 'undefined') {
      LinkedDamageEffect.triggerFromEvent(data);
    }
  });

  // Swarm assimilation events
  socket.on('swarm:droneSacrifice', (data) => {
    window.Logger.category('swarm', 'Drone sacrifice at', data.position);

    if (typeof ParticleSystem !== 'undefined') {
      // Red organic burst
      for (let i = 0; i < 15; i++) {
        const angle = (Math.PI * 2 * i) / 15 + Math.random() * 0.3;
        const speed = 30 + Math.random() * 60;
        ParticleSystem.spawn({
          x: data.position.x,
          y: data.position.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 300 + Math.random() * 200,
          color: '#8b0000',
          size: 3 + Math.random() * 3,
          type: 'glow',
          drag: 0.94,
          decay: 1
        });
      }

      // Organic tendrils toward base
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        ParticleSystem.spawn({
          x: data.position.x,
          y: data.position.y,
          vx: Math.cos(angle) * 15,
          vy: Math.sin(angle) * 15,
          life: 500 + Math.random() * 300,
          color: '#990000',
          size: 2 + Math.random() * 2,
          type: 'trail',
          drag: 0.99,
          decay: 0.8
        });
      }
    }
  });

  socket.on('swarm:assimilationProgress', (data) => {
    window.Logger.category('swarm', 'Assimilation progress:', data.baseId, data.progress + '/' + data.threshold);

    // Update base state with assimilation progress
    if (typeof Entities !== 'undefined') {
      const base = Entities.bases.get(data.baseId);
      if (base) {
        base.assimilationProgress = data.progress;
        base.assimilationThreshold = data.threshold;
      }
    }

    // Pulsing effect on base being assimilated
    if (typeof ParticleSystem !== 'undefined') {
      // Red pulse ring around base
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const radius = 60 + Math.random() * 20;
        ParticleSystem.spawn({
          x: data.position.x + Math.cos(angle) * radius,
          y: data.position.y + Math.sin(angle) * radius,
          vx: Math.cos(angle) * 5,
          vy: Math.sin(angle) * 5,
          life: 400,
          color: '#ff0000',
          size: 2 + Math.random() * 2,
          type: 'glow',
          drag: 0.98,
          decay: 1
        });
      }
    }
  });

  socket.on('swarm:baseAssimilated', (data) => {
    window.Logger.category('swarm', 'Base assimilated:', data.baseId, '-> type:', data.newType);

    // Update base in Entities.bases to use new assimilated type
    if (typeof Entities !== 'undefined') {
      const base = Entities.bases.get(data.baseId);
      if (base) {
        base.type = data.newType;
        base.faction = 'swarm';
        base.assimilationProgress = null; // Clear progress
      }
    }

    // Major visual effect: assimilation complete burst
    if (typeof ParticleSystem !== 'undefined' && data.position) {
      // Massive red shockwave
      for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i) / 30;
        const speed = 80 + Math.random() * 120;
        ParticleSystem.spawn({
          x: data.position.x,
          y: data.position.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 600 + Math.random() * 400,
          color: '#8b0000',
          size: 5 + Math.random() * 5,
          type: 'glow',
          drag: 0.92,
          decay: 1
        });
      }

      // Organic veins spreading outward
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 100;
        ParticleSystem.spawn({
          x: data.position.x + Math.cos(angle) * dist,
          y: data.position.y + Math.sin(angle) * dist,
          vx: Math.cos(angle) * 20,
          vy: Math.sin(angle) * 20,
          life: 800 + Math.random() * 400,
          color: '#990000',
          size: 3 + Math.random() * 3,
          type: 'trail',
          drag: 0.96,
          decay: 0.9
        });
      }
    }

    // Remove consumed drones from client-side entities
    if (data.consumedDroneIds && data.consumedDroneIds.length > 0) {
      for (const droneId of data.consumedDroneIds) {
        Entities.npcs.delete(droneId);
      }
      window.Logger.category('swarm', 'Removed', data.consumedDroneIds.length, 'consumed drones from assimilation');
    }

    // Show notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.warning('The Swarm has assimilated a base!');
    }
  });

  // Queen events
  socket.on('swarm:queenSpawn', (data) => {
    window.Logger.category('swarm', 'Queen has emerged at', data.x, data.y);

    // Massive visual effect for queen emergence
    if (typeof ParticleSystem !== 'undefined') {
      // Crimson vortex effect
      for (let i = 0; i < 50; i++) {
        const angle = (Math.PI * 2 * i) / 50;
        const radius = 50 + Math.random() * 100;
        const speed = 100 + Math.random() * 150;
        ParticleSystem.spawn({
          x: data.x + Math.cos(angle) * radius,
          y: data.y + Math.sin(angle) * radius,
          vx: -Math.cos(angle) * speed * 0.3, // Spiral inward
          vy: -Math.sin(angle) * speed * 0.3,
          life: 800 + Math.random() * 500,
          color: i % 2 === 0 ? '#8b0000' : '#ff0000',
          size: 4 + Math.random() * 6,
          type: 'glow',
          drag: 0.94,
          decay: 1
        });
      }

      // Bio-electric discharge
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 100;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random() * 300,
          color: '#ff4444',
          size: 2 + Math.random() * 3,
          type: 'spark',
          drag: 0.9,
          decay: 1.2
        });
      }
    }

    // Play queen roar sound for dramatic emergence
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('queen_roar', data.x, data.y);
    }

    // Global warning notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error('⚠ THE SWARM QUEEN HAS EMERGED!');
    }
  });

  socket.on('swarm:queenDeath', (data) => {
    window.Logger.category('swarm', 'Queen destroyed!');

    // Play epic queen death sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('queen_death', data.x, data.y);
    }

    // Notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.success('The Swarm Queen has been destroyed!');
    }
  });

  socket.on('swarm:queenAura', (data) => {
    // Visual effect showing aura on affected bases
    if (typeof ParticleSystem !== 'undefined' && data.affectedBases) {
      for (const baseData of data.affectedBases) {
        // Subtle healing particles around regenerating bases
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 30 + Math.random() * 30;
          ParticleSystem.spawn({
            x: baseData.x + Math.cos(angle) * radius,
            y: baseData.y + Math.sin(angle) * radius,
            vx: 0,
            vy: -10 - Math.random() * 10, // Float upward
            life: 300 + Math.random() * 200,
            color: '#990000',
            size: 2 + Math.random() * 2,
            type: 'glow',
            drag: 0.99,
            decay: 0.8
          });
        }
      }
    }
  });

  // Queen special attacks
  socket.on('queen:webSnare', (data) => {
    window.Logger.category('swarm', 'Queen web snare fired at', data.targetX, data.targetY);

    // Play web snare sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('queen_web_snare', data.sourceX, data.sourceY);
    }

    // Trigger projectile visual via NPCWeaponEffects
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.fire(
        { x: data.sourceX, y: data.sourceY },
        { x: data.targetX, y: data.targetY },
        'web_snare',
        'swarm',
        {
          radius: data.radius,
          duration: data.duration,
          chargeTime: data.chargeTime
        }
      );
    }

    // Schedule area effect at impact location after projectile travel
    const dx = data.targetX - data.sourceX;
    const dy = data.targetY - data.sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const travelTime = dist / (data.projectileSpeed || 200) * 1000;

    setTimeout(() => {
      // Create web area effect at target location
      if (typeof ParticleSystem !== 'undefined') {
        // Expanding web ring
        for (let i = 0; i < 24; i++) {
          const angle = (Math.PI * 2 * i) / 24;
          const radius = data.radius || 150;
          ParticleSystem.spawn({
            x: data.targetX + Math.cos(angle) * radius * 0.3,
            y: data.targetY + Math.sin(angle) * radius * 0.3,
            vx: Math.cos(angle) * 30,
            vy: Math.sin(angle) * 30,
            life: data.duration || 4000,
            color: '#660022',
            size: 3,
            type: 'trail',
            drag: 0.99,
            decay: 0.3
          });
        }

        // Central web strands
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12;
          ParticleSystem.spawn({
            x: data.targetX,
            y: data.targetY,
            vx: Math.cos(angle) * 15,
            vy: Math.sin(angle) * 15,
            life: data.duration || 4000,
            color: '#440011',
            size: 2,
            type: 'trail',
            drag: 0.995,
            decay: 0.2
          });
        }
      }
    }, travelTime);
  });

  socket.on('queen:acidBurst', (data) => {
    window.Logger.category('swarm', 'Queen acid burst fired at', data.targetX, data.targetY);

    // Play acid burst sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('queen_acid_burst', data.sourceX, data.sourceY);
    }

    // Trigger projectile visual via NPCWeaponEffects
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.fire(
        { x: data.sourceX, y: data.sourceY },
        { x: data.targetX, y: data.targetY },
        'acid_burst',
        'swarm',
        {
          radius: data.radius,
          dotDuration: data.dotDuration
        }
      );
    }

    // Schedule acid puddle at impact location after projectile travel
    const dx = data.targetX - data.sourceX;
    const dy = data.targetY - data.sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const travelTime = dist / (data.projectileSpeed || 180) * 1000;

    setTimeout(() => {
      // Create acid puddle effect at target location
      if (typeof ParticleSystem !== 'undefined') {
        // Acid splash
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 40;
          ParticleSystem.spawn({
            x: data.targetX,
            y: data.targetY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 600 + Math.random() * 400,
            color: '#44ff44',
            size: 3 + Math.random() * 3,
            type: 'glow',
            drag: 0.92,
            decay: 1
          });
        }

        // Create persistent puddle indicator
        const puddleStart = Date.now();
        const puddleDuration = data.dotDuration || 5000;
        const puddleInterval = setInterval(() => {
          if (Date.now() - puddleStart > puddleDuration) {
            clearInterval(puddleInterval);
            return;
          }

          // Bubbling acid particles
          for (let i = 0; i < 3; i++) {
            const offsetX = (Math.random() - 0.5) * (data.radius || 100);
            const offsetY = (Math.random() - 0.5) * (data.radius || 100);
            ParticleSystem.spawn({
              x: data.targetX + offsetX,
              y: data.targetY + offsetY,
              vx: 0,
              vy: -5 - Math.random() * 10,
              life: 300 + Math.random() * 200,
              color: Math.random() > 0.5 ? '#33ff33' : '#22cc22',
              size: 2 + Math.random() * 2,
              type: 'glow',
              drag: 0.99,
              decay: 1
            });
          }
        }, 200);
      }
    }, travelTime);
  });

  socket.on('queen:phaseChange', (data) => {
    window.Logger.category('swarm', 'Queen phase changed to:', data.phase);

    // Play phase change sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const phaseMap = {
        'HUNT': 1,
        'SIEGE': 2,
        'SWARM': 2,
        'DESPERATION': 3
      };
      const phaseNum = phaseMap[data.phase] || 1;
      AudioManager.playAt('queen_phase_' + phaseNum, data.x, data.y);
    }

    // Trigger phase transition visual at queen location
    if (typeof QueenVisuals !== 'undefined' && QueenVisuals.triggerPhaseTransition) {
      QueenVisuals.triggerPhaseTransition(data.x, data.y, data.phase);
    } else if (typeof ParticleSystem !== 'undefined') {
      // Fallback shockwave effect
      const phaseColors = {
        HUNT: '#ff4444',
        SIEGE: '#ff8800',
        SWARM: '#ff0044',
        DESPERATION: '#ff0000'
      };
      const color = phaseColors[data.phase] || '#ff0000';

      // Expanding shockwave
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const speed = 150 + Math.random() * 100;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 600 + Math.random() * 400,
          color: color,
          size: 4 + Math.random() * 4,
          type: 'glow',
          drag: 0.94,
          decay: 1
        });
      }

      // Inner flash
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 80;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 300 + Math.random() * 200,
          color: '#ffffff',
          size: 3 + Math.random() * 3,
          type: 'spark',
          drag: 0.9,
          decay: 1.5
        });
      }
    }

    // Show notification
    if (typeof NotificationManager !== 'undefined') {
      const phaseMessages = {
        HUNT: 'The Queen enters hunting mode!',
        SIEGE: 'The Queen retreats behind her swarm!',
        SWARM: 'The Queen summons endless reinforcements!',
        DESPERATION: '⚠ THE QUEEN IS ENRAGED!'
      };
      NotificationManager.warning(phaseMessages[data.phase] || 'Queen phase: ' + data.phase);
    }
  });

  // Formation leader succession (Void faction)
  socket.on('formation:leaderChange', (data) => {
    window.Logger.category('void', 'Formation leader changed:', data.newLeaderId);

    // Trigger visual effect
    if (typeof FormationSuccessionEffect !== 'undefined') {
      FormationSuccessionEffect.trigger(data);
    }

    // Update NPC entity with new leader status
    if (typeof Entities !== 'undefined') {
      const newLeader = Entities.npcs.get(data.newLeaderId);
      if (newLeader) {
        newLeader.isFormationLeader = true;
        newLeader.formationLeader = true;
      }
    }
  });

  // Rogue Miner Foreman spawn - dramatic announcement
  socket.on('rogueMiner:foremanSpawn', (data) => {
    window.Logger.category('rogue_miners', 'Foreman has emerged at', data.x, data.y);

    // Dramatic visual effects
    if (typeof ParticleSystem !== 'undefined') {
      // Industrial spark burst (40 orange/yellow particles)
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.2;
        const speed = 80 + Math.random() * 120;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 600 + Math.random() * 400,
          color: i % 2 === 0 ? '#ff9900' : '#ffcc00',
          size: 3 + Math.random() * 4,
          type: 'spark',
          drag: 0.92,
          decay: 1.2
        });
      }

      // Ore chunk debris (15 particles)
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        ParticleSystem.spawn({
          x: data.x + (Math.random() - 0.5) * 40,
          y: data.y + (Math.random() - 0.5) * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 800 + Math.random() * 400,
          color: '#8B7355', // Brown/ore colored
          size: 4 + Math.random() * 5,
          type: 'debris',
          drag: 0.94,
          decay: 0.8
        });
      }

      // Golden glow burst in center
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * 40,
          vy: Math.sin(angle) * 40,
          life: 500,
          color: '#ffd700',
          size: 6 + Math.random() * 4,
          type: 'glow',
          drag: 0.96,
          decay: 1
        });
      }
    }

    // Screen shake
    if (typeof Camera !== 'undefined' && Camera.shake) {
      Camera.shake(8, 500);
    }

    // Golden flash overlay
    if (typeof ScreenEffects !== 'undefined' && ScreenEffects.flash) {
      ScreenEffects.flash('#ffd70040', 300);
    }

    // Play foreman spawn sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.playAt('foreman_spawn', data.x, data.y);
    }

    // Chat system message
    if (typeof Chat !== 'undefined' && Chat.addSystemMessage) {
      Chat.addSystemMessage('A ROGUE FOREMAN HAS EMERGED!', 'warning');
    }

    // Warning notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.warning('⚠ A ROGUE FOREMAN HAS EMERGED!');
    }
  });

  // Base events
  socket.on('base:damaged', (data) => {
    // Track damaged base state for visual feedback
    if (typeof Entities !== 'undefined') {
      Entities.updateBaseHealth(data.baseId, data.health, data.maxHealth);
    }

    // Trigger visual hit effects at base position
    if (data.x !== undefined && data.y !== undefined) {
      // Determine if shield or hull hit based on health percentage
      const healthPercent = data.health / data.maxHealth;
      const isShieldHit = healthPercent > 0.7; // Bases have "shields" at high health

      // Add hit effect using HitEffectRenderer
      if (typeof HitEffectRenderer !== 'undefined') {
        // Scale effect based on damage dealt
        const tier = Math.min(5, Math.max(1, Math.ceil(data.damage / 20)));
        HitEffectRenderer.addHit(data.x, data.y, isShieldHit, tier);
      }

      // Add shield flash effect to the base
      if (typeof FactionBases !== 'undefined' && FactionBases.addDamageFlash) {
        FactionBases.addDamageFlash(data.baseId, data.x, data.y, data.size, data.faction, isShieldHit);
      }
    }
  });

  socket.on('base:destroyed', (data) => {
    // Play faction-specific base destruction sound (8-second sequences)
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const baseSoundMap = {
        'pirate_outpost': 'base_destruction_pirate',
        'scavenger_yard': 'base_destruction_scavenger',
        'swarm_hive': 'base_destruction_swarm',
        'void_rift': 'base_destruction_void',
        'mining_claim': 'base_destruction_mining'
      };
      const soundId = baseSoundMap[data.baseType] || 'base_destruction';
      AudioManager.playAt(soundId, data.x || 0, data.y || 0);
    }

    // Mark base as destroyed for rendering
    if (typeof Entities !== 'undefined') {
      Entities.destroyBase(data.id);

      // Remove any attached assimilation drones that died with the base
      if (data.destroyedDrones && data.destroyedDrones.length > 0) {
        for (const droneId of data.destroyedDrones) {
          Entities.npcs.delete(droneId);
        }
      }
    }

    // Trigger faction-specific multi-phase destruction sequence
    if (typeof BaseDestructionSequence !== 'undefined') {
      BaseDestructionSequence.trigger(
        data.x || 0,
        data.y || 0,
        data.baseType || 'pirate_outpost',
        data.size || 80
      );
    } else if (typeof ParticleSystem !== 'undefined') {
      // Fallback to basic particles if destruction system not loaded
      const colors = ['#ff6600', '#ffcc00', '#ff3300', '#ffffff'];
      for (let i = 0; i < 50; i++) {
        const angle = (Math.PI * 2 * i) / 50 + Math.random() * 0.5;
        const speed = 100 + Math.random() * 200;
        ParticleSystem.spawn({
          x: data.x || 0,
          y: data.y || 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 500 + Math.random() * 500,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 5,
          type: 'glow',
          drag: 0.95,
          decay: 1
        });
      }
    }
  });

  socket.on('base:respawn', (data) => {
    // Mark base as active again
    if (typeof Entities !== 'undefined') {
      Entities.respawnBase(data.id, data);
    }
  });

  // Radar base updates (broadcast every 500ms from server)
  socket.on('bases:nearby', (bases) => {
    if (typeof Entities !== 'undefined') {
      Entities.updateBases(bases);
    }
  });

  socket.on('base:reward', (data) => {
    // Display notification for base destruction rewards
    window.Logger.category('combat', `Base destroyed! Earned ${data.credits} credits (${data.teamMultiplier}x team bonus)`);

    // Animate credit gain
    if (typeof CreditAnimation !== 'undefined' && data.credits > 0) {
      CreditAnimation.addCredits(data.credits);
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.npc = { register };
}
