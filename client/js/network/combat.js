// Galaxy Miner - Combat Network Handlers

/**
 * Registers combat-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  socket.on('combat:event', (data) => {
    // Handle combat events (hits, deaths, etc.)
  });

  socket.on('combat:hit', (data) => {
    // Skip if this is an NPC attack - NPCWeaponEffects handles hit timing
    if (data.attackerType === 'npc') {
      return; // Hit effect will be triggered by projectile/beam arrival
    }

    // Play hit sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const isShieldHit = data.shieldDamage > 0 || data.hitShield;
      const tier = data.targetTier || 1;
      const soundId = isShieldHit ? 'hit_shield_' + tier : 'hit_hull_' + tier;
      AudioManager.playAt(soundId, data.targetX || data.x, data.targetY || data.y);
    }

    // Visual feedback for player-to-player hits
    if (typeof HitEffectRenderer !== 'undefined') {
      const isShieldHit = data.shieldDamage > 0 || data.hitShield;
      HitEffectRenderer.addHit(data.targetX || data.x, data.targetY || data.y, isShieldHit);
    }
  });

  socket.on('combat:playerHit', (data) => {
    // Visual feedback for player-to-player combat
    if (typeof HitEffectRenderer !== 'undefined') {
      HitEffectRenderer.addHit(data.targetX, data.targetY, data.hitShield);
    }
  });

  socket.on('combat:fire', (data) => {
    // Skip if it's our own fire event
    if (data.playerId === Player.id) return;

    // Play weapon fire sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const tier = data.weaponTier || 1;
      AudioManager.playAt('weapon_fire_' + tier, data.x, data.y);
    }

    // Render weapon fire from other player
    if (typeof WeaponRenderer !== 'undefined') {
      WeaponRenderer.fire(
        { x: data.x, y: data.y },
        data.rotation || data.direction,
        data.weaponTier || 1,
        data.weaponTier || 1  // visualTier
      );
    }

    // Track for radar display (Tier 4+)
    if (typeof Entities !== 'undefined') {
      Entities.addProjectileTrail({
        x: data.x,
        y: data.y,
        direction: data.rotation || data.direction,
        type: 'player',
        tier: data.weaponTier || 1
      });
    }
  });

  socket.on('combat:npcFire', (data) => {
    // Play NPC weapon sound based on faction
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      const faction = data.faction || 'pirate';
      AudioManager.playAt('npc_weapon_' + faction, data.sourceX, data.sourceY);
    }

    if (typeof NPCWeaponEffects !== 'undefined') {
      // Use faction to get proper visual weapon type
      const visualWeaponType = NPCWeaponEffects.getWeaponForFaction(data.faction) || 'cannon';
      NPCWeaponEffects.fire(
        { x: data.sourceX, y: data.sourceY },
        { x: data.targetX, y: data.targetY },
        visualWeaponType,
        data.faction || 'pirate',
        data.hitInfo || null  // Pass hit info for proper timing of hit effects
      );
    }

    // Track for radar display (Tier 4+)
    if (typeof Entities !== 'undefined') {
      const dx = data.targetX - data.sourceX;
      const dy = data.targetY - data.sourceY;
      const direction = Math.atan2(dy, dx);
      Entities.addProjectileTrail({
        x: data.sourceX,
        y: data.sourceY,
        direction: direction,
        type: 'npc',
        tier: 1,
        faction: data.faction
      });
    }
  });

  socket.on('combat:npcHit', (data) => {
    window.Logger.log('NPC hit:', data);

    // Get NPC position for hit effect
    const npcEntity = Entities.npcs.get(data.npcId);

    if (npcEntity) {
      // Register hit with WeaponRenderer for projectile-timed effects
      if (typeof WeaponRenderer !== 'undefined') {
        WeaponRenderer.registerHit(
          npcEntity.position.x,
          npcEntity.position.y,
          { isShieldHit: data.hitShield || false, damage: data.damage }
        );
      }

      // Show damage notification
      if (typeof Renderer !== 'undefined') {
        Renderer.addEffect({
          type: 'damage_number',
          x: npcEntity.position.x,
          y: npcEntity.position.y,
          damage: data.damage,
          duration: 1000
        });
      }
    }
  });

  // Tesla Cannon chain lightning effect
  socket.on('combat:chainLightning', (data) => {
    window.Logger.log('Chain lightning triggered!', data);

    // Play tesla chain sound
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady() && data.sourceX && data.sourceY) {
      AudioManager.playAt('weapon_fire_5', data.sourceX, data.sourceY);
    }

    if (typeof ChainLightningEffect !== 'undefined') {
      ChainLightningEffect.triggerFromEvent(data);
    }
  });

  // Tesla coil effect when Tesla Cannon hits bases
  socket.on('combat:teslaCoil', (data) => {
    window.Logger.log('Tesla coil triggered!', data);
    if (typeof TeslaCoilEffect !== 'undefined') {
      TeslaCoilEffect.triggerFromEvent(data);
    }
  });

  // Star heat damage
  socket.on('star:damage', (data) => {
    Player.hull.current = data.hull;
    Player.shield.current = data.shield;
    // Heat damage is visual via StarEffects heat overlay
  });

  // Star zone change notifications
  socket.on('star:zone', (data) => {
    if (typeof StarEffects !== 'undefined') {
      // StarEffects handles zone changes internally based on player position
      // This is just a server confirmation of zone state
      window.Logger.log('Star zone:', data.zone);
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.combat = { register };
}
