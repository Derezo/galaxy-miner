'use strict';

function finiteRange(value) {
  const range = Number(value);
  return Number.isFinite(range) && range > 0 ? range : 0;
}

function isNpcTargetingPlayer(npcEntity, player) {
  return npcEntity?.targetPlayer !== null &&
    npcEntity?.targetPlayer !== undefined &&
    player?.id !== null &&
    player?.id !== undefined &&
    String(npcEntity.targetPlayer) === String(player.id);
}

function getNpcEngagementRange(npcEntity) {
  return Math.max(
    finiteRange(npcEntity?.aggroRange),
    finiteRange(npcEntity?.weaponRange) * 1.1
  );
}

/**
 * Ordinary recipients retain their tier-based proximity range. A player whom
 * an NPC is actively engaging must also receive that attacker and its combat
 * events throughout the server-authorized engagement range.
 */
function getNpcDeliveryRange(
  npcEntity,
  player,
  ordinaryRange,
  targetRetentionRange = 0
) {
  const baseRange = finiteRange(ordinaryRange);
  return isNpcTargetingPlayer(npcEntity, player)
    ? Math.max(
      baseRange,
      getNpcEngagementRange(npcEntity),
      finiteRange(targetRetentionRange)
    )
    : baseRange;
}

function getNpcCandidateRange(
  npcEntity,
  maximumOrdinaryRange,
  targetRetentionRange = 0
) {
  return Math.max(
    finiteRange(maximumOrdinaryRange),
    npcEntity?.targetPlayer === null || npcEntity?.targetPlayer === undefined
      ? 0
      : Math.max(
        getNpcEngagementRange(npcEntity),
        finiteRange(targetRetentionRange)
      )
  );
}

module.exports = {
  getNpcCandidateRange,
  getNpcDeliveryRange,
  getNpcEngagementRange,
  isNpcTargetingPlayer
};
