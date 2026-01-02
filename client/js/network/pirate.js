// Galaxy Miner - Pirate Faction Network Handlers

/**
 * Registers pirate faction event handlers on the socket.
 * Handles intel broadcasts, boost dives, stealing, and dreadnought mechanics.
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  // Pirate scout returns with intel, alerting nearby pirates
  socket.on('pirate:intel', (data) => {
    Logger.log('Pirate intel broadcast at', data.scoutPos);

    // Validate data
    const pos = data.scoutPos || {};
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

    // Visual effect: red/orange signal pulse from scout
    if (typeof ParticleSystem !== 'undefined') {
      // Signal wave expanding outward
      for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i) / 30;
        const speed = 100 + Math.random() * 50;
        ParticleSystem.spawn({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 600 + Math.random() * 200,
          color: i % 2 === 0 ? '#ff4400' : '#ffaa00',
          size: 2 + Math.random() * 2,
          type: 'glow',
          drag: 0.96,
          decay: 0.8
        });
      }
    }

    // Show warning notification if player is in danger
    if (typeof NotificationManager !== 'undefined' && data.alertedPirateCount > 0) {
      NotificationManager.warning(`Pirate scout reported your position! ${data.alertedPirateCount} pirates alerted!`);
    }
  });

  // Pirate fighter/dreadnought boost dive attack
  socket.on('pirate:boostDive', (data) => {
    Logger.log('Pirate boost dive:', data.npcId, 'toward', data.targetX, data.targetY);

    // Validate data
    if (!Number.isFinite(data.startX) || !Number.isFinite(data.startY) ||
        !Number.isFinite(data.targetX) || !Number.isFinite(data.targetY)) return;

    // Visual effect: afterburner trail during boost
    if (typeof PirateEffects !== 'undefined' && PirateEffects.startBoostDive) {
      PirateEffects.startBoostDive(data.npcId, data.startX, data.startY, data.targetX, data.targetY, data.duration);
    } else if (typeof ParticleSystem !== 'undefined') {
      // Immediate burst at start position
      for (let i = 0; i < 20; i++) {
        const angle = Math.atan2(data.startY - data.targetY, data.startX - data.targetX) + (Math.random() - 0.5) * 0.8;
        const speed = 80 + Math.random() * 100;
        ParticleSystem.spawn({
          x: data.startX,
          y: data.startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random() * 200,
          color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00',
          size: 3 + Math.random() * 4,
          type: 'glow',
          drag: 0.92,
          decay: 1.2
        });
      }
    }
  });

  // Pirate successfully steals from scavenger/rogue miner
  socket.on('pirate:stealSuccess', (data) => {
    Logger.log('Pirate steal:', data.targetType, 'amount:', data.stolenAmount);

    // Validate data
    const pos = data.position || {};
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

    // Visual effect: gold/orange particles at steal location
    if (typeof ParticleSystem !== 'undefined') {
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        ParticleSystem.spawn({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random() * 300,
          color: i % 3 === 0 ? '#ffd700' : (i % 3 === 1 ? '#ff8800' : '#cc0000'),
          size: 2 + Math.random() * 3,
          type: 'spark',
          drag: 0.95,
          decay: 1
        });
      }
    }

    // Show notification based on target type
    if (typeof NotificationManager !== 'undefined') {
      const messages = {
        'scavenger_scrapPile': `Pirates plundered ${data.stolenAmount} wreckage from scavenger base!`,
        'scavenger_carried': `Pirates intercepted a scavenger with ${data.stolenAmount} wreckage!`,
        'rogue_credits': `Pirates stole ${data.stolenAmount} credits from mining claim!`
      };
      NotificationManager.warning(messages[data.targetType] || 'Pirates are raiding!');
    }
  });

  // Dreadnought blocks damage with invulnerability
  socket.on('npc:invulnerable', (data) => {
    Logger.log('NPC invulnerable proc:', data.npcId);

    // Validate data
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

    // Show "Invulnerable" floating text
    if (typeof FloatingTextSystem !== 'undefined') {
      FloatingTextSystem.addInvulnerable(data.x, data.y);
    } else if (typeof FloatingText !== 'undefined' && FloatingText.spawn) {
      FloatingText.spawn(data.x, data.y, 'Invulnerable', '#cccccc', 1200);
    }

    // Visual effect: shield flash
    if (typeof ParticleSystem !== 'undefined') {
      // Light grey shield shimmer
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const dist = 30;
        ParticleSystem.spawn({
          x: data.x + Math.cos(angle) * dist,
          y: data.y + Math.sin(angle) * dist,
          vx: Math.cos(angle) * 20,
          vy: Math.sin(angle) * 20,
          life: 300 + Math.random() * 100,
          color: '#aaaaaa',
          size: 4 + Math.random() * 3,
          type: 'glow',
          drag: 0.98,
          decay: 1.5
        });
      }
    }
  });

  // Dreadnought enters enraged state (base destroyed)
  socket.on('pirate:dreadnoughtEnraged', (data) => {
    Logger.log('Dreadnought ENRAGED:', data.npcId);

    // Validate data
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

    // Visual effect: massive red explosion/shockwave
    if (typeof ParticleSystem !== 'undefined') {
      // Angry red shockwave
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60;
        const speed = 200 + Math.random() * 150;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 800 + Math.random() * 400,
          color: i % 3 === 0 ? '#ff0000' : (i % 3 === 1 ? '#ff4400' : '#ff8800'),
          size: 5 + Math.random() * 5,
          type: 'glow',
          drag: 0.94,
          decay: 0.8
        });
      }

      // Inner fire particles
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        ParticleSystem.spawn({
          x: data.x,
          y: data.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 600 + Math.random() * 300,
          color: '#ffffff',
          size: 3 + Math.random() * 3,
          type: 'spark',
          drag: 0.9,
          decay: 1.5
        });
      }
    }

    // Show warning notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.error('PIRATE DREADNOUGHT ENRAGED!');
    }
  });

  // Captain healing at base
  socket.on('pirate:captainHeal', (data) => {
    // Validate data
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

    // Visual effect: healing particles around captain
    if (typeof ParticleSystem !== 'undefined') {
      // Red healing sparkles rising up
      for (let i = 0; i < 5; i++) {
        ParticleSystem.spawn({
          x: data.x + (Math.random() - 0.5) * 40,
          y: data.y + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 10,
          vy: -20 - Math.random() * 30,
          life: 500 + Math.random() * 300,
          color: '#ff4444',
          size: 2 + Math.random() * 2,
          type: 'glow',
          drag: 0.99,
          decay: 0.8
        });
      }
    }
  });
}

// Export for CommonJS and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.pirate = { register };
}
