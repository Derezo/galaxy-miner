/**
 * Ship-related event handlers
 *
 * Handles ship upgrades, color customization, and ship data retrieval
 */

const logger = require('../../shared/logger');
const config = require('../config');
const { statements, safeUpdateCredits, getSafeCredits, performUpgrade } = require('../database');
const { isValidComponent, isValidColorId } = require('../validators');

// Pre-computed Sets for O(1) validation (avoid Array.includes in hot paths)
const VALID_COMPONENTS = new Set(['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar', 'energy_core', 'hull']);
const VALID_COLORS = new Set(config.PLAYER_COLOR_OPTIONS.map(c => c.id));

function register(ctx) {
  const { socket, io, state } = ctx;
  const authenticatedUserId = state.userId;

  // Ship upgrade (with resource requirements)
  socket.on('ship:upgrade', (data) => {
    logger.log('[UPGRADE] Received upgrade request:', data, 'from user:', authenticatedUserId);
    try {
      if (!authenticatedUserId) {
        socket.emit('upgrade:error', { message: 'Not authenticated' });
        return;
      }

      const player = state.connectedPlayers.get(socket.id);
      if (!player) {
        socket.emit('upgrade:error', { message: 'Player not found' });
        return;
      }

      const ship = statements.getShipByUserId.get(authenticatedUserId);
      if (!ship) {
        socket.emit('upgrade:error', { message: 'Ship data not found' });
        return;
      }

      const { component } = data;

      if (!VALID_COMPONENTS.has(component)) {
        socket.emit('upgrade:error', { message: 'Invalid component' });
        return;
      }

      // Get current tier using the correct column name
      const dbColumnMap = {
        'engine': 'engine_tier',
        'weapon': 'weapon_tier',
        'shield': 'shield_tier',
        'mining': 'mining_tier',
        'cargo': 'cargo_tier',
        'radar': 'radar_tier',
        'energy_core': 'energy_core_tier',
        'hull': 'hull_tier'
      };
      const currentTier = ship[dbColumnMap[component]] || 1;

      if (currentTier >= config.MAX_TIER) {
        socket.emit('upgrade:error', { message: 'Already at max tier' });
        return;
      }

      // Get requirements from UPGRADE_REQUIREMENTS
      const nextTier = currentTier + 1;
      const requirements = config.UPGRADE_REQUIREMENTS[component]?.[nextTier];

      if (!requirements) {
        socket.emit('upgrade:error', { message: 'Invalid upgrade tier' });
        return;
      }

      // Use transaction to perform upgrade atomically (checks credits + resources)
      const result = performUpgrade(authenticatedUserId, component, requirements, config.MAX_TIER);

      if (!result.success) {
        socket.emit('upgrade:error', { message: result.error });
        return;
      }

      // Get updated ship and inventory
      const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
      const updatedInventory = statements.getInventory.all(authenticatedUserId);

      // Update player state cache
      player.credits = getSafeCredits(updatedShip);
      if (component === 'radar') player.radarTier = result.newTier;
      if (component === 'mining') player.miningTier = result.newTier;
      if (component === 'weapon') player.weaponTier = result.newTier;
      if (component === 'energy_core') player.energyCoreTier = result.newTier;
      if (component === 'hull') {
        player.hullTier = result.newTier;
        player.hullMax = updatedShip.hull_max;
      }
      if (component === 'shield') {
        player.shieldTier = result.newTier;
        player.shieldMax = updatedShip.shield_max;
      }

      // Send upgrade success with updated max values for shield/hull
      socket.emit('upgrade:success', {
        component,
        newTier: result.newTier,
        credits: player.credits,
        shieldMax: updatedShip.shield_max,
        hullMax: updatedShip.hull_max
      });

      // Also send updated inventory since resources were consumed
      socket.emit('inventory:update', {
        inventory: updatedInventory,
        credits: player.credits
      });
    } catch (err) {
      logger.error(`[UPGRADE ERROR] User ${authenticatedUserId} upgrading ${data?.component}:`, err.message);
      logger.error(err.stack);
      socket.emit('upgrade:error', { message: 'Upgrade failed due to a server error. Please try again.' });
    }
  });

  // Get ship data
  socket.on('ship:getData', () => {
    if (!authenticatedUserId) return;

    const ship = statements.getShipByUserId.get(authenticatedUserId);
    if (ship) {
      socket.emit('ship:data', {
        engine_tier: ship.engine_tier,
        weapon_type: ship.weapon_type,
        weapon_tier: ship.weapon_tier,
        shield_tier: ship.shield_tier,
        mining_tier: ship.mining_tier,
        cargo_tier: ship.cargo_tier,
        radar_tier: ship.radar_tier,
        energy_core_tier: ship.energy_core_tier || 1,
        hull_tier: ship.hull_tier || 1,
        credits: ship.credits,
        ship_color_id: ship.ship_color_id || 'green',
        profile_id: ship.profile_id || 'pilot'
      });
    }
  });

  // Ship color customization
  socket.on('ship:setColor', (data) => {
    if (!authenticatedUserId) return;

    const player = state.connectedPlayers.get(socket.id);
    if (!player) return;

    const { colorId } = data;

    // Validate color ID against available options (O(1) Set lookup)
    if (!VALID_COLORS.has(colorId)) {
      socket.emit('ship:colorError', { message: 'Invalid color selection' });
      return;
    }

    // Update database
    try {
      statements.updateShipColor.run(colorId, authenticatedUserId);
    } catch (err) {
      logger.error(`[COLOR ERROR] User ${authenticatedUserId} setting color:`, err.message);
      socket.emit('ship:colorError', { message: 'Failed to save color preference' });
      return;
    }

    // Update player state
    player.colorId = colorId;

    // Confirm to the player
    socket.emit('ship:colorChanged', { colorId });

    // Broadcast to nearby players
    broadcastToNearby(socket, player, 'player:colorChanged', {
      playerId: authenticatedUserId,
      colorId
    }, state, io);
  });
}

/**
 * Helper: Broadcast to nearby players
 * Extracted from socket.js to support color change broadcast
 */
function broadcastToNearby(socket, player, event, data, state, io) {
  const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1);
  const broadcastRange = radarRange * 2; // Broadcast slightly further than radar

  for (const [socketId, otherPlayer] of state.connectedPlayers) {
    if (socketId === socket.id) continue;

    const dx = otherPlayer.position.x - player.position.x;
    const dy = otherPlayer.position.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= broadcastRange) {
      io.to(socketId).emit(event, data);
    }
  }
}

module.exports = { register };
