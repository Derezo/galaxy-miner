// Pure helpers for per-player NPC delta compression.

function snapshotPosition(position) {
  if (!position || typeof position !== 'object') return null;
  return { x: position.x, y: position.y };
}

function positionsEqual(left, right) {
  if (left === null || right === null) return left === right;
  return left.x === right.x && left.y === right.y;
}

function snapshotNpcState(fullData, lastFullTick) {
  return {
    type: fullData.type,
    name: fullData.name,
    faction: fullData.faction,
    x: fullData.x,
    y: fullData.y,
    rotation: fullData.rotation,
    state: fullData.state,
    hull: fullData.hull,
    hullMax: fullData.hullMax,
    shield: fullData.shield,
    shieldMax: fullData.shieldMax,
    isBoss: fullData.isBoss,
    sizeMultiplier: fullData.sizeMultiplier,
    phase: fullData.phase,
    collectingWreckagePos: snapshotPosition(fullData.collectingWreckagePos),
    miningTargetPos: snapshotPosition(fullData.miningTargetPos),
    lastFullTick
  };
}

/**
 * Build a delta and the immutable state snapshot to retain for the next tick.
 * The periodic full-refresh clock is intentionally independent from the most
 * recent delta so a stream of frequent updates cannot postpone a full state.
 */
function createNpcDelta(previous, fullData, currentTick, fullRefreshInterval) {
  const lastFullTick = previous?.lastFullTick;
  const needsFull = !previous || !Number.isFinite(lastFullTick) ||
    currentTick - lastFullTick >= fullRefreshInterval;

  if (needsFull) {
    return {
      delta: { ...fullData, f: 1 },
      nextState: snapshotNpcState(fullData, currentTick)
    };
  }

  const collectingWreckagePos = snapshotPosition(fullData.collectingWreckagePos);
  const miningTargetPos = snapshotPosition(fullData.miningTargetPos);
  const delta = {
    id: fullData.id,
    x: fullData.x,
    y: fullData.y,
    rotation: fullData.rotation,
    vx: fullData.vx || 0,
    vy: fullData.vy || 0
  };

  if (fullData.type !== previous.type) delta.type = fullData.type;
  if (fullData.name !== previous.name) delta.name = fullData.name;
  if (fullData.faction !== previous.faction) delta.faction = fullData.faction;
  if (fullData.state !== previous.state) delta.state = fullData.state;
  if (fullData.hull !== previous.hull) delta.hull = fullData.hull;
  if (fullData.hullMax !== previous.hullMax) delta.hullMax = fullData.hullMax;
  if (fullData.shield !== previous.shield) delta.shield = fullData.shield;
  if (fullData.shieldMax !== previous.shieldMax) delta.shieldMax = fullData.shieldMax;
  if (fullData.isBoss !== previous.isBoss) delta.isBoss = fullData.isBoss;
  if (fullData.sizeMultiplier !== previous.sizeMultiplier) {
    delta.sizeMultiplier = fullData.sizeMultiplier;
  }
  if (fullData.phase !== previous.phase) delta.phase = fullData.phase;
  if (!positionsEqual(collectingWreckagePos, previous.collectingWreckagePos)) {
    delta.collectingWreckagePos = collectingWreckagePos;
  }
  if (!positionsEqual(miningTargetPos, previous.miningTargetPos)) {
    delta.miningTargetPos = miningTargetPos;
  }

  return {
    delta,
    nextState: snapshotNpcState(fullData, lastFullTick)
  };
}

module.exports = {
  createNpcDelta,
  positionsEqual,
  snapshotPosition
};
