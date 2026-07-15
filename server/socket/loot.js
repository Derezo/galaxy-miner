'use strict';

/**
 * Loot Socket Handler
 * Events: loot:startCollect, loot:cancelCollect, loot:getNearby, wreckage:multiCollect
 */

const config = require('../config');
const { statements, getSafeCredits } = require('../database');
const fallbackLoot = require('../game/loot');
const Constants = require('../../shared/constants');
const logger = require('../../shared/logger');
const { getRadarRange } = require('../../shared/utils');

const COLLECTION_POLL_MS = 100;
const MAX_WRECKAGE_ID_LENGTH = 128;

function isValidWreckageId(value) {
  return typeof value === 'string' && value.length > 0 &&
    value.length <= MAX_WRECKAGE_ID_LENGTH;
}

function mergeLootResults(target, source) {
  target.credits += Number(source?.credits) || 0;
  for (const key of ['resources', 'components', 'relics', 'duplicateRelics', 'buffs', 'errors']) {
    if (Array.isArray(source?.[key])) target[key].push(...source[key]);
  }
  return target;
}

function createEmptyLootResults() {
  return {
    credits: 0,
    resources: [],
    components: [],
    relics: [],
    duplicateRelics: [],
    buffs: [],
    errors: []
  };
}

/**
 * Register loot socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { getAuthenticatedUserId } = deps;
  const loot = deps.loot || fallbackLoot;
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

  let activeTimer = null;
  let activeWreckageIds = [];

  function isPlayerUnavailable(player, playerId) {
    return !player || player.isDead ||
      Boolean(deps.wormhole?.isInTransit?.(playerId));
  }

  function clearCollectionTimer() {
    if (!activeTimer) return;
    clearInterval(activeTimer);
    untrackInterval(socket.id, activeTimer);
    activeTimer = null;
  }

  function clearCollectionState() {
    clearCollectionTimer();
    activeWreckageIds = [];
  }

  function broadcastCollectionStopped(player, playerId) {
    if (!player) return;
    broadcastToNearby(socket, player, 'loot:playerStopped', { playerId });
  }

  function cancelActiveCollection(reason, shouldEmit = true) {
    const playerId = getAuthenticatedUserId();
    const player = connectedPlayers.get(socket.id);
    clearCollectionState();
    if (playerId) {
      loot.cancelCollectionsForPlayer(playerId);
      setPlayerStatus(playerId, 'idle');
      broadcastCollectionStopped(player, playerId);
    }
    if (shouldEmit) socket.emit('loot:cancelled', { reason });
  }

  function startPolling(callback) {
    activeTimer = setInterval(() => {
      try {
        callback();
      } catch (error) {
        logger.error('[LOOT] Collection poll failed:', error);
        cancelActiveCollection('Collection interrupted');
      }
    }, COLLECTION_POLL_MS);
    trackInterval(socket.id, activeTimer);
  }

  function emitInventoryUpdate(playerId) {
    const inventory = statements.getInventory.all(playerId);
    const ship = statements.getShipByUserId.get(playerId);
    socket.emit('inventory:update', {
      inventory,
      credits: getSafeCredits(ship)
    });
  }

  function buildWreckageData(wreckage) {
    return {
      id: wreckage.id,
      x: wreckage.position.x,
      y: wreckage.position.y,
      size: wreckage.size,
      source: wreckage.source,
      faction: wreckage.faction,
      npcType: wreckage.npcType,
      npcName: wreckage.npcName,
      contentCount: (wreckage.contents?.length || 0) +
        (wreckage.pendingCredits?.length || 0),
      despawnTime: wreckage.despawnTime
    };
  }

  /**
   * Persist one wreckage independently. This is intentionally called once per
   * Scrap Siphon target: merging contributor maps before applying team bonuses
   * would inflate rewards from unrelated kills.
   */
  function settleWreckage(wreckageId, progress, collectorId) {
    const teamCredits = distributeTeamCredits(
      progress.pendingCredits?.length > 0 ? 0 : progress.creditReward,
      progress.damageContributors,
      collectorId,
      progress.pendingCredits
    );

    const nonCreditContents = progress.contents.filter(item => item?.type !== 'credits');
    const teamResources = distributeTeamResources(
      nonCreditContents,
      progress.damageContributors,
      collectorId
    );
    const lootResults = processCollectedLoot(collectorId, teamResources.collectorLoot);
    lootResults.credits = teamCredits.collectorCredits;

    const remainingContents = [
      ...(teamResources.remainingLoot || []),
      ...(lootResults.remainingLoot || [])
    ];
    // remainingLoot is server settlement metadata, not a reward-display field.
    delete lootResults.remainingLoot;

    const finalization = loot.finalizeCollection(wreckageId, collectorId, {
      remainingContents,
      pendingCredits: teamCredits.pendingCredits || []
    });
    if (!finalization?.success) {
      throw new Error(finalization?.error || 'Unable to finalize wreckage collection');
    }

    return {
      contents: progress.contents,
      results: lootResults,
      teamCredits,
      removed: finalization.removed,
      remaining: finalization.remaining
    };
  }

  function emitRemainingWreckage(wreckage, player) {
    if (!wreckage || !player) return;
    const data = buildWreckageData(wreckage);
    socket.emit('wreckage:spawn', data);
    broadcastToNearby(socket, player, 'wreckage:spawn', data);
  }

  function notifyScavengersOfCollection(player, playerId, knownScrapSiphon = null) {
    if (!player?.position || typeof deps.npc?.notifyWreckageCollectedNearby !== 'function') {
      return null;
    }

    try {
      const hasScrapSiphon = knownScrapSiphon === null
        ? Boolean(statements.hasRelic.get(playerId, 'SCRAP_SIPHON'))
        : knownScrapSiphon === true;
      const notification = deps.npc.notifyWreckageCollectedNearby(
        playerId,
        player.position,
        hasScrapSiphon
      );
      if (!notification?.action || !notification.npc?.position) return notification;

      const { npc, action } = notification;
      deps.broadcasts?.emitNear(npc.position, 'scavenger:rage', {
        npcId: action.npcId,
        targetId: action.targetId,
        reason: action.reason,
        rageRange: action.rageRange,
        x: npc.position.x,
        y: npc.position.y
      }, Number(npc.size) || 0);
      return notification;
    } catch (error) {
      // Collection settlement is already durable; an AI notification failure
      // must not turn a successful claim into a client-visible loot failure.
      logger.error('[LOOT] Unable to notify nearby scavengers:', error);
      return null;
    }
  }

  socket.on('loot:startCollect', (data) => {
    const playerId = getAuthenticatedUserId();
    if (!playerId) return;

    const player = connectedPlayers.get(socket.id);
    if (isPlayerUnavailable(player, playerId)) {
      socket.emit('loot:error', { message: 'Cannot collect wreckage right now' });
      return;
    }
    if (!data || !isValidWreckageId(data.wreckageId)) {
      socket.emit('loot:error', { message: 'Invalid wreckage ID' });
      return;
    }

    const { wreckageId } = data;
    const wreckage = loot.getWreckage(wreckageId);
    if (!wreckage) {
      socket.emit('loot:error', { message: 'Wreckage not found' });
      return;
    }

    const dx = Number(wreckage.position?.x) - Number(player.position?.x);
    const dy = Number(wreckage.position?.y) - Number(player.position?.y);
    const distance = Math.hypot(dx, dy);
    const wreckageSize = Number(wreckage.size) || 20;
    const effectiveDistance = distance - wreckageSize;
    const collectRange = Number(config.MINING_RANGE) || 100;

    if (!Number.isFinite(effectiveDistance) || effectiveDistance > collectRange) {
      socket.emit('loot:error', { message: 'Too far from wreckage' });
      return;
    }

    const start = loot.startCollection(wreckageId, playerId);
    if (!start?.success) {
      socket.emit('loot:error', { message: start?.error || 'Unable to collect wreckage' });
      return;
    }

    activeWreckageIds = [wreckageId];
    socket.emit('loot:started', { wreckageId, totalTime: start.totalTime });
    setPlayerStatus(playerId, 'collecting');
    broadcastToNearby(socket, player, 'loot:playerCollecting', {
      playerId,
      wreckageId,
      x: wreckage.position.x,
      y: wreckage.position.y
    });

    startPolling(() => {
      const currentPlayer = connectedPlayers.get(socket.id);
      if (isPlayerUnavailable(currentPlayer, playerId)) {
        cancelActiveCollection('Collection interrupted', Boolean(currentPlayer));
        return;
      }

      const progress = loot.updateCollection(wreckageId, playerId);
      if (!progress) {
        cancelActiveCollection('Collection is no longer active');
        return;
      }
      if (!progress.complete) {
        socket.emit('loot:progress', { wreckageId, progress: progress.progress });
        return;
      }

      clearCollectionState();
      const settlement = settleWreckage(wreckageId, progress, playerId);
      setPlayerStatus(playerId, 'idle');
      broadcastCollectionStopped(currentPlayer, playerId);
      notifyScavengersOfCollection(currentPlayer, playerId);

      socket.emit('loot:complete', {
        wreckageId,
        contents: settlement.contents,
        results: settlement.results,
        teamCredits: settlement.teamCredits.total,
        cargoLimited: settlement.remaining
      });
      emitInventoryUpdate(playerId);

      if (settlement.removed) {
        broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
          wreckageId,
          collectedBy: playerId
        });
      } else {
        emitRemainingWreckage(loot.getWreckage(wreckageId), currentPlayer);
      }
    });
  });

  socket.on('loot:cancelCollect', (data) => {
    const playerId = getAuthenticatedUserId();
    if (!playerId) return;
    if (!data || !isValidWreckageId(data.wreckageId)) {
      socket.emit('loot:error', { message: 'Invalid wreckage ID' });
      return;
    }
    if (!activeWreckageIds.includes(data.wreckageId)) {
      socket.emit('loot:error', { message: 'No matching collection is active' });
      return;
    }

    cancelActiveCollection('Cancelled by player');
  });

  socket.on('loot:getNearby', () => {
    const playerId = getAuthenticatedUserId();
    if (!playerId) return;

    const player = connectedPlayers.get(socket.id);
    if (!player?.position) return;

    const radarTier = Math.max(1, Math.floor(Number(player.radarTier) || 1));
    const radarRange = getRadarRange(radarTier);
    const nearby = loot.getWreckageInRange(player.position, radarRange);

    socket.emit('loot:nearby', {
      wreckage: nearby.map(wreckage => ({
        id: wreckage.id,
        x: wreckage.position.x,
        y: wreckage.position.y,
        faction: wreckage.faction,
        npcName: wreckage.npcName,
        contentCount: (wreckage.contents?.length || 0) +
          (wreckage.pendingCredits?.length || 0),
        distance: wreckage.distance,
        despawnTime: wreckage.despawnTime
      }))
    });
  });

  socket.on('wreckage:multiCollect', () => {
    const playerId = getAuthenticatedUserId();
    if (!playerId) return;

    const player = connectedPlayers.get(socket.id);
    if (isPlayerUnavailable(player, playerId)) {
      socket.emit('loot:error', { message: 'Cannot collect wreckage right now' });
      return;
    }

    const hasScrapSiphon = statements.hasRelic.get(playerId, 'SCRAP_SIPHON');
    if (!hasScrapSiphon) {
      socket.emit('loot:error', { message: 'You need the Scrap Siphon relic to use multi-collect' });
      return;
    }

    const effects = Constants.RELIC_TYPES.SCRAP_SIPHON.effects;
    const multiCount = Math.max(1, Math.floor(Number(effects.multiWreckageCount) || 1));
    const multiRange = Math.max(1, Number(effects.multiWreckageRange) || 1);
    const durationMultiplier = Number(effects.wreckageCollectionSpeed);

    // Select only currently unlocked, non-derelict targets. The game layer then
    // atomically revalidates and reserves this explicitly bounded set.
    const toCollect = loot.getWreckageInRange(player.position, multiRange)
      .filter(wreckage => wreckage.source !== 'derelict' && !wreckage.beingCollectedBy)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, multiCount);

    if (toCollect.length === 0) {
      socket.emit('loot:error', { message: 'No wreckage within range' });
      return;
    }

    const start = loot.startMultiCollection(
      toCollect.map(wreckage => wreckage.id),
      playerId,
      { maxCount: multiCount, durationMultiplier }
    );
    if (!start?.success) {
      socket.emit('loot:error', { message: start?.error || 'Unable to collect wreckage' });
      return;
    }

    activeWreckageIds = start.wreckageIds;
    socket.emit('loot:multiStarted', {
      wreckageIds: start.wreckageIds,
      totalTime: start.totalTime
    });
    setPlayerStatus(playerId, 'collecting');
    broadcastToNearby(socket, player, 'loot:playerMultiCollecting', {
      playerId,
      wreckageIds: start.wreckageIds
    });

    startPolling(() => {
      const currentPlayer = connectedPlayers.get(socket.id);
      if (isPlayerUnavailable(currentPlayer, playerId)) {
        cancelActiveCollection('Collection interrupted', Boolean(currentPlayer));
        return;
      }

      const progressEntries = start.wreckageIds.map(wreckageId => ({
        wreckageId,
        progress: loot.updateCollection(wreckageId, playerId)
      }));
      if (progressEntries.some(entry => !entry.progress)) {
        cancelActiveCollection('Collection is no longer active');
        return;
      }
      if (progressEntries.some(entry => !entry.progress.complete)) return;

      clearCollectionState();
      const aggregateResults = createEmptyLootResults();
      const allContents = [];
      const removedIds = [];
      const remainingIds = [];
      let totalTeamCredits = 0;

      // Settle each wreckage with its own contributor map and multiplier.
      for (const entry of progressEntries) {
        const settlement = settleWreckage(entry.wreckageId, entry.progress, playerId);
        allContents.push(...settlement.contents);
        mergeLootResults(aggregateResults, settlement.results);
        totalTeamCredits += settlement.teamCredits.total;
        if (settlement.removed) removedIds.push(entry.wreckageId);
        else remainingIds.push(entry.wreckageId);
      }

      setPlayerStatus(playerId, 'idle');
      broadcastCollectionStopped(currentPlayer, playerId);
      notifyScavengersOfCollection(currentPlayer, playerId, true);
      socket.emit('loot:multiComplete', {
        // Only fully consumed wreckage should be removed by the client. The
        // attempted IDs let clients clear every siphon animation.
        wreckageIds: removedIds,
        attemptedWreckageIds: start.wreckageIds,
        remainingWreckageIds: remainingIds,
        contents: allContents,
        results: aggregateResults,
        teamCredits: totalTeamCredits,
        cargoLimited: remainingIds.length > 0
      });
      emitInventoryUpdate(playerId);

      for (const wreckageId of removedIds) {
        broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
          wreckageId,
          collectedBy: playerId
        });
      }
      for (const wreckageId of remainingIds) {
        emitRemainingWreckage(loot.getWreckage(wreckageId), currentPlayer);
      }
    });
  });
}

module.exports = { register, isValidWreckageId };
