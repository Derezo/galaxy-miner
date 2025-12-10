/**
 * Loot collection handlers
 * Handles wreckage collection mechanics, including team loot distribution
 */

const logger = require('../../shared/logger');
const { validateLootCollection } = require('../validators');
const config = require('../config');
const { statements, getSafeCredits, safeUpdateCredits, safeUpsertInventory } = require('../database');
const { getScavengerStrategy } = require('../game/ai');
const Constants = require('../../shared/constants');

/**
 * Register loot-related socket event handlers
 * @param {Object} ctx - Handler context { socket, io, state, engine, trackInterval, untrackInterval, setPlayerStatus, broadcastToNearby, userSockets }
 */
function register(ctx) {
  const { socket, io, state, engine, trackInterval, untrackInterval, setPlayerStatus, broadcastToNearby, userSockets } = ctx;
  const { authenticatedUserId, connectedPlayers } = state;

  // Loot: Start collecting wreckage
  socket.on('loot:startCollect', (data) => {
    if (!authenticatedUserId()) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate input
    const validation = validateLootCollection(data);
    if (!validation.valid) {
      socket.emit('loot:error', { message: validation.error });
      return;
    }

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
    const result = engine.startWreckageCollection(wreckageId, authenticatedUserId());

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
      setPlayerStatus(authenticatedUserId(), 'collecting');

      // Broadcast collection start to nearby players
      broadcastToNearby(socket, player, 'loot:playerCollecting', {
        playerId: authenticatedUserId(),
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
          engine.cancelWreckageCollection(wreckageId, authenticatedUserId());
          return;
        }

        // Update collection progress
        const progress = engine.updateWreckageCollection(wreckageId, authenticatedUserId(), 100);

        if (!progress) {
          // Wreckage no longer exists (despawned or collected by someone else)
          clearInterval(checkCollection);
          untrackInterval(socket.id, checkCollection);
          setPlayerStatus(authenticatedUserId(), 'idle');
          socket.emit('loot:cancelled', { reason: 'Wreckage no longer available' });
          return;
        }

        if (progress.complete) {
          clearInterval(checkCollection);
          untrackInterval(socket.id, checkCollection);

          // Distribute credits to team members who contributed damage
          const teamCredits = distributeTeamCredits(
            progress.creditReward,
            progress.damageContributors,
            authenticatedUserId(),
            io,
            userSockets
          );

          // Filter out credits from contents - they're handled via team distribution
          const nonCreditContents = progress.contents.filter(item => item.type !== 'credits');

          // Distribute resources to team based on rarity
          // Common/Uncommon: Split equally
          // Rare/Ultrarare: Collector only, team notified
          const teamResources = distributeTeamResources(
            nonCreditContents,
            progress.damageContributors,
            authenticatedUserId(),
            io,
            userSockets
          );

          // Process only the collector's portion of loot
          const lootResults = processCollectedLoot(authenticatedUserId(), teamResources.collectorLoot, io, userSockets);
          lootResults.credits = teamCredits.collectorCredits;

          socket.emit('loot:complete', {
            wreckageId,
            contents: progress.contents,
            results: lootResults,
            teamCredits: teamCredits.total
          });

          // Update inventory and credits
          const inventory = statements.getInventory.all(authenticatedUserId());
          const ship = statements.getShipByUserId.get(authenticatedUserId());
          socket.emit('inventory:update', {
            inventory,
            credits: getSafeCredits(ship)
          });

          // Clear player status
          setPlayerStatus(authenticatedUserId(), 'idle');

          // Broadcast wreckage collected to nearby players
          broadcastToNearby(socket, currentPlayer, 'loot:playerStopped', {
            playerId: authenticatedUserId()
          });
          broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
            wreckageId,
            collectedBy: authenticatedUserId()
          });

          // Check if this triggers Scavenger rage (unless player has Scrap Siphon)
          checkScavengerRageOnCollection(currentPlayer, authenticatedUserId(), engine, io);
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
    if (!authenticatedUserId()) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Validate input
    if (!data || typeof data.wreckageId !== 'string') {
      logger.warn(`[LOOT] Invalid cancel data from user ${authenticatedUserId()}`);
      return;
    }

    engine.cancelWreckageCollection(data.wreckageId, authenticatedUserId());
    socket.emit('loot:cancelled', { reason: 'Cancelled by player' });
    setPlayerStatus(authenticatedUserId(), 'idle');
    broadcastToNearby(socket, player, 'loot:playerStopped', {
      playerId: authenticatedUserId()
    });
  });

  // Loot: Get nearby wreckage
  socket.on('loot:getNearby', () => {
    if (!authenticatedUserId()) return;

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
    if (!authenticatedUserId()) return;

    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Check if player has the Scrap Siphon relic
    const hasScrapSiphon = statements.hasRelic.get(authenticatedUserId(), 'SCRAP_SIPHON');
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
    const nearbyWreckage = engine.getWreckageInRange(player.position, multiRange);

    if (nearbyWreckage.length === 0) {
      socket.emit('loot:error', { message: 'No wreckage within range' });
      return;
    }

    // Sort by distance and take up to multiCount
    nearbyWreckage.sort((a, b) => a.distance - b.distance);
    const toCollect = nearbyWreckage.slice(0, multiCount);

    // Check none are being collected by others
    for (const w of toCollect) {
      if (w.beingCollectedBy && w.beingCollectedBy !== authenticatedUserId()) {
        socket.emit('loot:error', { message: 'Some wreckage is being collected by another player' });
        return;
      }
    }

    // Mark all as being collected
    const wreckageIds = toCollect.map(w => w.id);
    for (const w of toCollect) {
      engine.startWreckageCollection(w.id, authenticatedUserId());
    }

    socket.emit('loot:multiStarted', {
      wreckageIds,
      totalTime: collectSpeed * 1000
    });

    setPlayerStatus(authenticatedUserId(), 'collecting');

    // Broadcast multi-collection start
    broadcastToNearby(socket, player, 'loot:playerMultiCollecting', {
      playerId: authenticatedUserId(),
      wreckageIds
    });

    // Single timer for the fast collection
    const multiCollectTimeout = setTimeout(() => {
      const currentPlayer = connectedPlayers.get(socket.id);
      if (!currentPlayer) {
        for (const wId of wreckageIds) {
          engine.cancelWreckageCollection(wId, authenticatedUserId());
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
        authenticatedUserId(),
        io,
        userSockets
      );

      // Filter out credits
      const nonCreditContents = allContents.filter(item => item.type !== 'credits');

      // Distribute resources
      const teamResources = distributeTeamResources(
        nonCreditContents,
        Object.keys(allDamageContributors).length > 0 ? allDamageContributors : null,
        authenticatedUserId(),
        io,
        userSockets
      );

      // Process collector's loot
      const lootResults = processCollectedLoot(authenticatedUserId(), teamResources.collectorLoot, io, userSockets);
      lootResults.credits = teamCredits.collectorCredits;

      socket.emit('loot:multiComplete', {
        wreckageIds,
        contents: allContents,
        results: lootResults,
        teamCredits: teamCredits.total
      });

      // Update inventory
      const inventory = statements.getInventory.all(authenticatedUserId());
      const ship = statements.getShipByUserId.get(authenticatedUserId());
      socket.emit('inventory:update', {
        inventory,
        credits: getSafeCredits(ship)
      });

      setPlayerStatus(authenticatedUserId(), 'idle');

      // Broadcast collection complete
      broadcastToNearby(socket, currentPlayer, 'loot:playerStopped', {
        playerId: authenticatedUserId()
      });
      for (const wId of wreckageIds) {
        broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
          wreckageId: wId,
          collectedBy: authenticatedUserId()
        });
      }

      // Scrap Siphon provides rage immunity, so we skip rage check here
      // (The immunity is already handled in ScavengerStrategy.onWreckageCollectedNearby)
    }, collectSpeed * 1000);

    trackInterval(socket.id, multiCollectTimeout);
  });
}

/**
 * Helper: Distribute credits to team members who contributed damage
 * @param {number} baseCredits - Base credit reward
 * @param {Object} damageContributors - Map of userId -> damage amount
 * @param {number} collectorId - User ID of the collector
 * @param {Object} io - Socket.io instance
 * @param {Map} userSockets - Map of userId -> socketId
 * @returns {Object} - { total, collectorCredits, distributed }
 */
function distributeTeamCredits(baseCredits, damageContributors, collectorId, io, userSockets) {
  // If no base credits or invalid, return 0 for all
  if (!baseCredits || typeof baseCredits !== 'number' || baseCredits <= 0) {
    return { total: 0, collectorCredits: 0, distributed: [] };
  }

  // If no damage contributors, collector gets all credits
  if (!damageContributors || Object.keys(damageContributors).length === 0) {
    // Solo kill - collector gets base credits
    const ship = statements.getShipByUserId.get(collectorId);
    if (ship) {
      const currentCredits = getSafeCredits(ship);
      safeUpdateCredits(currentCredits + baseCredits, collectorId);
    }
    return { total: baseCredits, collectorCredits: baseCredits, distributed: [{ playerId: collectorId, credits: baseCredits }] };
  }

  const participants = Object.keys(damageContributors);
  const participantCount = participants.length;
  // Convert collectorId to string to match Object.keys() output (keys are always strings)
  const collectorIdStr = String(collectorId);

  // Apply team bonus multiplier
  const teamMultipliers = config.TEAM_MULTIPLIERS || { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 };
  const teamMultiplier = teamMultipliers[Math.min(participantCount, 4)] || 2.5;
  const totalCredits = Math.round(baseCredits * teamMultiplier);
  const creditsPerPlayer = Math.round(totalCredits / participantCount);

  const distributed = [];
  let collectorCredits = 0;

  // Distribute credits to all contributors
  for (const playerId of participants) {
    try {
      const ship = statements.getShipByUserId.get(playerId);
      if (ship) {
        const currentCredits = getSafeCredits(ship);
        safeUpdateCredits(currentCredits + creditsPerPlayer, playerId);

        distributed.push({ playerId, credits: creditsPerPlayer });

        if (playerId === collectorIdStr) {
          collectorCredits = creditsPerPlayer;
        }

        // Notify non-collector team members of their credit reward
        if (playerId !== collectorIdStr) {
          const socketId = userSockets.get(Number(playerId));
          if (socketId) {
            io.to(socketId).emit('team:creditReward', {
              credits: creditsPerPlayer,
              totalTeamCredits: totalCredits,
              participantCount
            });

            // Also update their inventory display
            const inventory = statements.getInventory.all(playerId);
            const updatedShip = statements.getShipByUserId.get(playerId);
            io.to(socketId).emit('inventory:update', {
              inventory,
              credits: getSafeCredits(updatedShip)
            });
          }
        }
      }
    } catch (err) {
      logger.error(`[TEAM CREDITS] Error distributing to ${playerId}:`, err.message);
    }
  }

  // If collector wasn't a contributor (rare - e.g., collected someone else's kill), they still get share
  if (!participants.includes(collectorIdStr)) {
    const ship = statements.getShipByUserId.get(collectorId);
    if (ship) {
      const currentCredits = getSafeCredits(ship);
      safeUpdateCredits(currentCredits + creditsPerPlayer, collectorId);
      collectorCredits = creditsPerPlayer;
      distributed.push({ playerId: collectorId, credits: creditsPerPlayer });
    }
  }

  logger.log(`[TEAM CREDITS] Distributed ${totalCredits} credits (${teamMultiplier}x bonus) to ${participantCount} players`);

  return { total: totalCredits, collectorCredits, distributed };
}

/**
 * Helper: Distribute resources to team members based on rarity
 * Common/Uncommon: Split equally between all participants
 * Rare/Ultrarare: Collector only, team gets notification
 * @param {Array} contents - Array of loot items
 * @param {Object} damageContributors - Map of userId -> damage amount
 * @param {number} collectorId - User ID of the collector
 * @param {Object} io - Socket.io instance
 * @param {Map} userSockets - Map of userId -> socketId
 * @returns {Object} - { collectorLoot, teamShares, rareDropNotifications }
 */
function distributeTeamResources(contents, damageContributors, collectorId, io, userSockets) {
  const collectorIdStr = String(collectorId);
  const result = {
    collectorLoot: [],      // Items that go to collector
    teamShares: new Map(),  // playerId -> [items]
    rareDropNotifications: [] // Rare items collector got (for team notification)
  };

  // If no team (solo kill), collector gets everything
  if (!damageContributors || Object.keys(damageContributors).length <= 1) {
    result.collectorLoot = contents;
    return result;
  }

  const participants = Object.keys(damageContributors);
  const participantCount = participants.length;

  // Initialize team shares
  for (const playerId of participants) {
    if (playerId !== collectorIdStr) {
      result.teamShares.set(playerId, []);
    }
  }

  for (const item of contents) {
    if (item.type === 'resource') {
      const rarity = item.rarity || 'common';

      if (rarity === 'common' || rarity === 'uncommon') {
        // Split common/uncommon resources equally
        const perPlayer = Math.floor(item.quantity / participantCount);
        const remainder = item.quantity % participantCount;

        if (perPlayer > 0) {
          // Collector gets their share + remainder
          result.collectorLoot.push({
            ...item,
            quantity: perPlayer + remainder
          });

          // Other team members get their share
          for (const playerId of participants) {
            if (playerId !== collectorIdStr) {
              const shares = result.teamShares.get(playerId);
              shares.push({
                ...item,
                quantity: perPlayer
              });
            }
          }
        } else {
          // Not enough to split - collector gets all
          result.collectorLoot.push(item);
        }
      } else {
        // Rare/Ultrarare resources go to collector only
        result.collectorLoot.push(item);
        result.rareDropNotifications.push({
          resourceType: item.resourceType,
          quantity: item.quantity,
          rarity
        });
      }
    } else {
      // Non-resource items (buffs, components, relics) go to collector only
      result.collectorLoot.push(item);
    }
  }

  // Process team member shares and send notifications
  for (const [playerId, items] of result.teamShares) {
    if (items.length > 0) {
      // Add resources to team member's inventory
      for (const item of items) {
        try {
          safeUpsertInventory(playerId, item.resourceType, item.quantity);
        } catch (err) {
          logger.error(`[TEAM LOOT] Error giving resource to ${playerId}:`, err.message);
        }
      }

      // Notify team member of their share
      const socketId = userSockets.get(Number(playerId));
      if (socketId) {
        io.to(socketId).emit('team:lootShare', {
          resources: items,
          rareDropNotification: result.rareDropNotifications.length > 0 ? result.rareDropNotifications : null,
          collectorId: collectorIdStr
        });

        // Update their inventory display
        const inventory = statements.getInventory.all(playerId);
        const ship = statements.getShipByUserId.get(playerId);
        io.to(socketId).emit('inventory:update', {
          inventory,
          credits: getSafeCredits(ship)
        });
      }
    } else if (result.rareDropNotifications.length > 0) {
      // No shared resources but notify about rare drops
      const socketId = userSockets.get(Number(playerId));
      if (socketId) {
        io.to(socketId).emit('team:lootShare', {
          resources: [],
          rareDropNotification: result.rareDropNotifications,
          collectorId: collectorIdStr
        });
      }
    }
  }

  if (result.rareDropNotifications.length > 0) {
    logger.log(`[TEAM LOOT] Collector got ${result.rareDropNotifications.length} rare+ drops, team notified`);
  }

  return result;
}

/**
 * Helper: Process collected loot and add to player
 * @param {number} userId - User ID
 * @param {Array} contents - Array of loot items
 * @param {Object} io - Socket.io instance
 * @param {Map} userSockets - Map of userId -> socketId
 * @returns {Object} - { credits, resources, components, relics, buffs, errors }
 */
function processCollectedLoot(userId, contents, io, userSockets) {
  const results = {
    credits: 0,
    resources: [],
    components: [],
    relics: [],
    buffs: [],
    errors: []
  };

  for (const item of contents) {
    try {
      switch (item.type) {
        case 'credits':
          // Add credits to player (only if amount is valid)
          if (typeof item.amount === 'number' && item.amount > 0 && !Number.isNaN(item.amount)) {
            const ship = statements.getShipByUserId.get(userId);
            const currentCredits = getSafeCredits(ship);
            safeUpdateCredits(currentCredits + item.amount, userId);
            results.credits += item.amount;
          }
          break;

        case 'resource':
          // Add resource to inventory using safe wrapper
          const resourceResult = safeUpsertInventory(userId, item.resourceType, item.quantity);
          if (resourceResult.changes > 0) {
            results.resources.push({
              type: item.resourceType,
              quantity: item.quantity
            });
          }
          break;

        case 'component':
          // Add component to components table
          statements.upsertComponent.run(userId, item.componentType, 1);
          results.components.push({
            type: item.componentType
          });
          break;

        case 'relic':
          // Add relic to relics table (only if not already owned)
          const relicResult = statements.addRelic.run(userId, item.relicType);
          results.relics.push({
            type: item.relicType
          });

          // Emit relic:collected event to notify client (only if relic was newly added)
          if (relicResult.changes > 0) {
            const relicSocketId = userSockets.get(userId);
            if (relicSocketId) {
              io.to(relicSocketId).emit('relic:collected', {
                relicType: item.relicType
              });
            }
          }
          break;

        case 'buff':
          // Apply temporary buff
          const buffConfig = config.BUFF_TYPES ? config.BUFF_TYPES[item.buffType] : null;
          const duration = buffConfig ? buffConfig.duration : 60000; // Default 60s
          const expiresAt = Date.now() + duration;
          statements.addBuff.run(userId, item.buffType, expiresAt);
          results.buffs.push({
            type: item.buffType,
            duration,
            expiresAt
          });

          // Notify player of buff application
          const socketId = userSockets.get(userId);
          if (socketId) {
            io.to(socketId).emit('buff:applied', {
              buffType: item.buffType,
              duration,
              expiresAt
            });
          }
          break;

        default:
          // Log unrecognized item type for debugging (likely format mismatch)
          logger.warn(`[LOOT] Unrecognized item type: ${item.type}`, {
            userId,
            item: JSON.stringify(item)
          });
          results.errors.push({ type: item.type || 'unknown', error: 'Unrecognized item type' });
          break;
      }
    } catch (err) {
      logger.error(`[LOOT ERROR] User ${userId} processing ${item.type}:`, err.message);
      results.errors.push({ type: item.type, error: err.message });
    }
  }

  return results;
}

/**
 * Helper: Check and trigger Scavenger rage when player collects wreckage
 * @param {Object} player - The collecting player
 * @param {number} userId - Player's user ID
 * @param {Object} engine - Game engine instance
 * @param {Object} io - Socket.io instance
 */
function checkScavengerRageOnCollection(player, userId, engine, io) {
  // Check if player has Scrap Siphon immunity
  const hasScrapSiphon = statements.hasRelic.get(userId, 'SCRAP_SIPHON');

  // Get all nearby scavenger NPCs
  const scavengerStrategy = getScavengerStrategy();
  const allNPCs = engine.getAllNPCs ? engine.getAllNPCs() : new Map();

  for (const [npcId, npc] of allNPCs) {
    if (npc.faction !== 'scavenger') continue;

    // Get nearby allies for rage spread
    const nearbyAllies = [];
    for (const [allyId, ally] of allNPCs) {
      if (allyId === npcId || ally.faction !== 'scavenger') continue;
      const dx = ally.position.x - npc.position.x;
      const dy = ally.position.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 500) {
        nearbyAllies.push(ally);
      }
    }

    // Check if this collection triggers rage
    const rageResult = scavengerStrategy.onWreckageCollectedNearby(
      npc,
      userId,
      player.position,
      nearbyAllies,
      !!hasScrapSiphon
    );

    if (rageResult && rageResult.action === 'scavenger:rage') {
      // Broadcast rage to nearby players
      io.emit('scavenger:rage', {
        npcId: rageResult.npcId,
        targetId: rageResult.targetId,
        reason: rageResult.reason
      });
    }
  }
}

module.exports = { register };
