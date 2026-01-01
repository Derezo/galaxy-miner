// Galaxy Miner - Player Network Handlers

/**
 * Registers player-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('player:update', (data) => {
    Entities.updatePlayer(data);
  });

  socket.on('player:leave', (playerId) => {
    Entities.removePlayer(playerId);
  });

  socket.on('player:colorChanged', (data) => {
    // Update other player's color
    if (typeof Entities !== 'undefined') {
      Entities.updatePlayerColor(data.playerId, data.colorId);
    }
  });

  socket.on('player:damaged', (data) => {
    // Ignore damage events while dead
    if (typeof Player !== 'undefined' && Player.isDead) return;

    Player.onDamaged(data);
    // Visual feedback at player's position
    if (typeof HitEffectRenderer !== 'undefined') {
      const isShieldHit = data.shield > 0;
      HitEffectRenderer.addHit(Player.position.x, Player.position.y, isShieldHit);
    }
  });

  socket.on('player:death', (data) => {
    window.Logger.log('Player died:', data.cause, data.killedBy);

    // Play player death sound (non-spatial, always audible)
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.play('death_player');
    }

    // Calculate survival time before death
    const survivalTime = Player.getSurvivalTime();

    // Use enhanced killer info from server (new deferred respawn system)
    const killerType = data.killerType || data.cause || 'unknown';
    const killerName = data.killerName || null;
    const killerFaction = data.killerFaction || null;

    // Prepare death data for visual effect
    const deathData = {
      killerType,
      killerName,
      killerFaction,
      cause: data.cause,
      droppedCargo: data.droppedCargo || [],
      survivalTime,
      deathPosition: data.deathPosition || {
        x: Player.position.x,
        y: Player.position.y
      },
      message: data.message,
      // New: respawn options for location selection
      respawnOptions: data.respawnOptions
    };

    // Mark player as dead
    Player.onDeath(deathData);

    // Trigger cinematic death effect
    if (typeof PlayerDeathEffect !== 'undefined') {
      PlayerDeathEffect.trigger(deathData);
    } else if (typeof NotificationManager !== 'undefined' && data.message) {
      // Fallback to notification if effect module not loaded
      NotificationManager.error(data.message);
    }
  });

  socket.on('player:respawn', (data) => {
    window.Logger.log('Player respawn received:', data.position);

    // Prepare respawn data
    const respawnData = {
      position: data.position,
      hull: data.hull,
      shield: data.shield
    };

    // Notify death effect system to cleanup
    if (typeof PlayerDeathEffect !== 'undefined') {
      PlayerDeathEffect.onRespawnConfirmed(respawnData);
    }

    // Apply respawn to player
    Player.onRespawn(respawnData);
  });

  socket.on('player:debuff', (data) => {
    window.Logger.log('Debuff applied:', data.type, 'for', data.duration, 'ms');

    // Store debuff state on player for movement/UI
    if (typeof Player !== 'undefined') {
      if (!Player.debuffs) Player.debuffs = {};
      Player.debuffs[data.type] = {
        expiresAt: Date.now() + data.duration,
        percent: data.slowPercent || 0
      };

      // Clear debuff when it expires
      setTimeout(() => {
        if (Player.debuffs && Player.debuffs[data.type]) {
          delete Player.debuffs[data.type];
          window.Logger.log('Debuff expired:', data.type);
        }
      }, data.duration);
    }

    // Show debuff notification
    if (typeof NotificationManager !== 'undefined') {
      if (data.type === 'slow') {
        NotificationManager.warning('Ensnared! Movement slowed for ' + (data.duration / 1000) + 's');
      }
    }
  });

  socket.on('player:dot', (data) => {
    window.Logger.log('DoT tick:', data.type, data.damage, 'damage');

    // Visual effect at player position
    if (typeof Player !== 'undefined' && typeof ParticleSystem !== 'undefined') {
      // Acid drip effect
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 10 + Math.random() * 20;
        ParticleSystem.spawn({
          x: Player.position.x + (Math.random() - 0.5) * 20,
          y: Player.position.y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 300 + Math.random() * 200,
          color: '#44ff44',
          size: 2 + Math.random() * 2,
          type: 'glow',
          drag: 0.95,
          decay: 1.2
        });
      }
    }

    // Show damage number
    if (typeof Renderer !== 'undefined' && typeof Player !== 'undefined') {
      Renderer.addEffect({
        type: 'damage_number',
        x: Player.position.x,
        y: Player.position.y - 20,
        damage: data.damage,
        duration: 800,
        color: '#44ff44'  // Green for acid damage
      });
    }
  });

  // Respawn error when respawn fails
  socket.on('respawn:error', (data) => {
    window.Logger.log('Respawn error:', data);

    // Show error notification
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.show(data.message || 'Respawn failed', 'error');
    }

    // Reset respawn UI state if applicable
    if (typeof PlayerDeathEffect !== 'undefined' && PlayerDeathEffect.onRespawnError) {
      PlayerDeathEffect.onRespawnError(data);
    }
  });

  // Player health update (shield regeneration, healing, etc.)
  socket.on('player:health', (data) => {
    // Update player health from shield regeneration or other sources
    if (typeof Player !== 'undefined') {
      if (data.hull !== undefined) {
        Player.hull.current = data.hull;
      }
      if (data.shield !== undefined) {
        Player.shield.current = data.shield;
      }
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.player = { register };
}
