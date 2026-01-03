'use strict';

/**
 * Ship Socket Handler
 * Events: ship:upgrade, ship:getData, ship:setColor, ship:setProfile
 */

const config = require('../config');
const { statements, performUpgrade, getSafeCredits } = require('../database');
const logger = require('../../shared/logger');

/**
 * Register ship socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const { connectedPlayers, VALID_COMPONENTS, VALID_COLORS, VALID_PROFILES, broadcastToNearby } = deps.state;

  // Ship upgrade (with resource requirements)
  socket.on('ship:upgrade', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    logger.log('[UPGRADE] Received upgrade request:', data, 'from user:', authenticatedUserId);
    try {
      if (!authenticatedUserId) {
        socket.emit('upgrade:error', { message: 'Not authenticated' });
        return;
      }

      const player = connectedPlayers.get(socket.id);
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
      logger.error(`[UPGRADE ERROR] User ${getAuthenticatedUserId()} upgrading ${data?.component}:`, err.message);
      logger.error(err.stack);
      socket.emit('upgrade:error', { message: 'Upgrade failed due to a server error. Please try again.' });
    }
  });

  // Get ship data
  socket.on('ship:getData', () => {
    const authenticatedUserId = getAuthenticatedUserId();
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
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
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
    });
  });

  // Ship profile customization
  socket.on('ship:setProfile', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const { profileId } = data;

    // Validate profile ID against available options (O(1) Set lookup)
    if (!VALID_PROFILES.has(profileId)) {
      socket.emit('ship:profileError', { message: 'Invalid profile selection' });
      return;
    }

    // Update database
    try {
      statements.updateShipProfile.run(profileId, authenticatedUserId);
    } catch (err) {
      logger.error(`[PROFILE ERROR] User ${authenticatedUserId} setting profile:`, err.message);
      socket.emit('ship:profileError', { message: 'Failed to save profile preference' });
      return;
    }

    // Update player state
    player.profileId = profileId;

    // Confirm to the player
    socket.emit('ship:profileChanged', { profileId });

    // Broadcast to nearby players (in case we want to show profiles on ships)
    broadcastToNearby(socket, player, 'player:profileChanged', {
      playerId: authenticatedUserId,
      profileId
    });
  });
}

module.exports = { register };
