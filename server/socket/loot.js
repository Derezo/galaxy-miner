'use strict';

/**
 * Loot Socket Handler
 * Events: loot:startCollect, loot:cancelCollect, loot:getNearby, wreckage:multiCollect
 */

const config = require('../config');
const { statements, getSafeCredits } = require('../database');
const engine = require('../game/engine');
const Constants = require('../../shared/constants');
const logger = require('../../shared/logger');

/**
 * Register loot socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId } = deps;
  const {
    connectedPlayers,
    trackInterval,
    untrackInterval,
    setPlayerStatus,
    broadcastToNearby,
    distributeTeamCredits,
    distributeTeamResources,
    processCollectedLoot
  } = deps.state;

  // Loot: Start collecting wreckage
  socket.on('loot:startCollect', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const { wreckageId } = data;

    // Check if wreckage exists and is in range
    const wreckage = engine.getWreckage(wreckageId);
    if (!wreckage) {
      socket.emit('loot:error', { message: 'Wreckage not found' });
      return;
    }

    // Check range (use mining range, subtract wreckage size like mining does)
    const dx = wreckage.position.x - player.position.x;
    const dy = wreckage.position.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const wreckageSize = wreckage.size || 20; // Standard wreckage size
    const effectiveDistance = dist - wreckageSize;
    const collectRange = config.MINING_RANGE || 100;

    if (effectiveDistance > collectRange) {
      socket.emit('loot:error', { message: 'Too far from wreckage' });
      return;
    }

    // Start collection
    const result = engine.startWreckageCollection(wreckageId, authenticatedUserId);

    if (result && result.error) {
      socket.emit('loot:error', { message: result.error });
      return;
    }

    if (result && result.success) {
      socket.emit('loot:started', {
        wreckageId,
        totalTime: result.totalTime
      });

      // Set player status to collecting
      setPlayerStatus(authenticatedUserId, 'collecting');

      // Broadcast collection start to nearby players
      broadcastToNearby(socket, player, 'loot:playerCollecting', {
        playerId: authenticatedUserId,
        wreckageId,
        x: wreckage.position.x,
        y: wreckage.position.y
      });

      // Set up collection progress check
      // Once collection starts, it continues regardless of movement (beam locks onto target)
      const checkCollection = setInterval(() => {
        const currentPlayer = connectedPlayers.get(socket.id);
        if (!currentPlayer) {
          clearInterval(checkCollection);
          untrackInterval(socket.id, checkCollection);
          engine.cancelWreckageCollection(wreckageId, authenticatedUserId);
          return;
        }

        // Update collection progress
        const progress = engine.updateWreckageCollection(wreckageId, authenticatedUserId, 100);

        if (!progress) {
          clearInterval(checkCollection);
          untrackInterval(socket.id, checkCollection);
          setPlayerStatus(authenticatedUserId, 'idle');
          return;
        }

        if (progress.complete) {
          clearInterval(checkCollection);
          untrackInterval(socket.id, checkCollection);

          // Distribute credits to team members who contributed damage
          const teamCredits = distributeTeamCredits(
            progress.creditReward,
            progress.damageContributors,
            authenticatedUserId
          );

          // Filter out credits from contents - they're handled via team distribution
          const nonCreditContents = progress.contents.filter(item => item.type !== 'credits');

          // Distribute resources to team based on rarity
          // Common/Uncommon: Split equally
          // Rare/Ultrarare: Collector only, team notified
          const teamResources = distributeTeamResources(
            nonCreditContents,
            progress.damageContributors,
            authenticatedUserId
          );

          // Process only the collector's portion of loot
          const lootResults = processCollectedLoot(authenticatedUserId, teamResources.collectorLoot);
          lootResults.credits = teamCredits.collectorCredits;

          // Debug: log collection details
          logger.log('[LOOT] Collection complete:', wreckageId,
            'contents:', progress.contents.length,
            'collectorLoot:', teamResources.collectorLoot.length,
            'results:', JSON.stringify(lootResults));

          socket.emit('loot:complete', {
            wreckageId,
            contents: progress.contents,
            results: lootResults,
            teamCredits: teamCredits.total
          });

          // Update inventory and credits
          const inventory = statements.getInventory.all(authenticatedUserId);
          const ship = statements.getShipByUserId.get(authenticatedUserId);
          socket.emit('inventory:update', {
            inventory,
            credits: getSafeCredits(ship)
          });

          // Clear player status
          setPlayerStatus(authenticatedUserId, 'idle');

          // Broadcast wreckage collected to nearby players
          broadcastToNearby(socket, currentPlayer, 'loot:playerStopped', {
            playerId: authenticatedUserId
          });
          broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
            wreckageId,
            collectedBy: authenticatedUserId
          });
        } else {
          // Send progress update
          socket.emit('loot:progress', {
            wreckageId,
            progress: progress.progress
          });
        }
      }, 100);
      // Track interval for cleanup on disconnect
      trackInterval(socket.id, checkCollection);
    }
  });

  // Loot: Cancel collection
  socket.on('loot:cancelCollect', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    engine.cancelWreckageCollection(data.wreckageId, authenticatedUserId);
    socket.emit('loot:cancelled', { reason: 'Cancelled by player' });
    setPlayerStatus(authenticatedUserId, 'idle');
    broadcastToNearby(socket, player, 'loot:playerStopped', {
      playerId: authenticatedUserId
    });
  });

  // Loot: Get nearby wreckage
  socket.on('loot:getNearby', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1);
    const nearby = engine.getWreckageInRange(player.position, radarRange);

    socket.emit('loot:nearby', {
      wreckage: nearby.map(w => ({
        id: w.id,
        x: w.position.x,
        y: w.position.y,
        faction: w.faction,
        npcName: w.npcName,
        contentCount: w.contents.length,
        distance: w.distance,
        despawnTime: w.despawnTime
      }))
    });
  });

  // Loot: Multi-collect wreckage with Scrap Siphon relic (M key)
  socket.on('wreckage:multiCollect', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Check if player has the Scrap Siphon relic
    const hasScrapSiphon = statements.hasRelic.get(authenticatedUserId, 'SCRAP_SIPHON');
    if (!hasScrapSiphon) {
      socket.emit('loot:error', { message: 'You need the Scrap Siphon relic to use multi-collect' });
      return;
    }

    // Get Scrap Siphon effect values
    const siphonEffects = Constants.RELIC_TYPES.SCRAP_SIPHON.effects;
    const multiCount = siphonEffects.multiWreckageCount || 3;
    const multiRange = siphonEffects.multiWreckageRange || 300;
    const collectSpeed = siphonEffects.wreckageCollectionSpeed || 0.5;

    // Find nearest wreckage within multi-collect range
    // Exclude derelict salvage - it must be collected manually with tractor beam
    const allNearbyWreckage = engine.getWreckageInRange(player.position, multiRange);
    const nearbyWreckage = allNearbyWreckage.filter(w => w.source !== 'derelict');

    if (nearbyWreckage.length === 0) {
      socket.emit('loot:error', { message: 'No wreckage within range' });
      return;
    }

    // Sort by distance and take up to multiCount
    nearbyWreckage.sort((a, b) => a.distance - b.distance);
    const toCollect = nearbyWreckage.slice(0, multiCount);

    // Check none are being collected by others
    for (const w of toCollect) {
      if (w.beingCollectedBy && w.beingCollectedBy !== authenticatedUserId) {
        socket.emit('loot:error', { message: 'Some wreckage is being collected by another player' });
        return;
      }
    }

    // Mark all as being collected
    const wreckageIds = toCollect.map(w => w.id);
    for (const w of toCollect) {
      engine.startWreckageCollection(w.id, authenticatedUserId);
    }

    logger.category('relics', 'Siphon multi-collect started:', wreckageIds, 'totalTime:', collectSpeed * 1000);
    socket.emit('loot:multiStarted', {
      wreckageIds,
      totalTime: collectSpeed * 1000
    });

    setPlayerStatus(authenticatedUserId, 'collecting');

    // Broadcast multi-collection start
    broadcastToNearby(socket, player, 'loot:playerMultiCollecting', {
      playerId: authenticatedUserId,
      wreckageIds
    });

    // Single timer for the fast collection
    const multiCollectTimeout = setTimeout(() => {
      const currentPlayer = connectedPlayers.get(socket.id);
      if (!currentPlayer) {
        for (const wId of wreckageIds) {
          engine.cancelWreckageCollection(wId, authenticatedUserId);
        }
        return;
      }

      // Collect all wreckage and merge rewards
      const allContents = [];
      let totalCredits = 0;
      const allDamageContributors = {};

      for (const wId of wreckageIds) {
        const wreckage = engine.getWreckage(wId);
        if (wreckage) {
          allContents.push(...wreckage.contents);
          totalCredits += wreckage.creditReward || 0;

          // Merge damage contributors
          if (wreckage.damageContributors) {
            for (const [pid, dmg] of Object.entries(wreckage.damageContributors)) {
              allDamageContributors[pid] = (allDamageContributors[pid] || 0) + dmg;
            }
          }

          // Remove wreckage
          engine.removeWreckage(wId);
        }
      }

      // Distribute credits (merged)
      const teamCredits = distributeTeamCredits(
        totalCredits,
        Object.keys(allDamageContributors).length > 0 ? allDamageContributors : null,
        authenticatedUserId
      );

      // Filter out credits
      const nonCreditContents = allContents.filter(item => item.type !== 'credits');

      // Distribute resources
      const teamResources = distributeTeamResources(
        nonCreditContents,
        Object.keys(allDamageContributors).length > 0 ? allDamageContributors : null,
        authenticatedUserId
      );

      // Process collector's loot
      const lootResults = processCollectedLoot(authenticatedUserId, teamResources.collectorLoot);
      lootResults.credits = teamCredits.collectorCredits;

      socket.emit('loot:multiComplete', {
        wreckageIds,
        contents: allContents,
        results: lootResults,
        teamCredits: teamCredits.total
      });

      // Update inventory
      const inventory = statements.getInventory.all(authenticatedUserId);
      const ship = statements.getShipByUserId.get(authenticatedUserId);
      socket.emit('inventory:update', {
        inventory,
        credits: getSafeCredits(ship)
      });

      setPlayerStatus(authenticatedUserId, 'idle');

      // Broadcast collection complete
      broadcastToNearby(socket, currentPlayer, 'loot:playerStopped', {
        playerId: authenticatedUserId
      });
      for (const wId of wreckageIds) {
        broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
          wreckageId: wId,
          collectedBy: authenticatedUserId
        });
      }

      // Scrap Siphon provides rage immunity, so we skip rage check here
    }, collectSpeed * 1000);

    trackInterval(socket.id, multiCollectTimeout);
  });
}

module.exports = { register };
