'use strict';

function getPosition(entity) {
  const position = entity?.position || entity;
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    throw new TypeError('NPC event payload requires a finite position');
  }
  return position;
}

function createNpcSpawnPayload(entity, extra = {}) {
  const position = getPosition(entity);
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    faction: entity.faction,
    x: position.x,
    y: position.y,
    rotation: entity.rotation || 0,
    hull: entity.hull,
    hullMax: entity.hullMax,
    shield: entity.shield,
    shieldMax: entity.shieldMax,
    isBoss: entity.isBoss === true,
    sizeMultiplier: entity.sizeMultiplier,
    phase: entity.phase,
    ...extra
  };
}

function createRogueMinerRageEvent(entity, action) {
  const position = getPosition(entity);
  const configuredRange = Number(action?.rageRange);
  const range = Number.isFinite(configuredRange) && configuredRange > 0
    ? configuredRange
    : 3000;

  return {
    position: { x: position.x, y: position.y },
    range,
    payload: {
      npcId: entity.id,
      action: 'rage',
      faction: 'rogue_miner',
      x: position.x,
      y: position.y,
      triggeredBy: action?.triggeredBy,
      targetId: action?.targetId,
      enragedNPCs: Array.isArray(action?.enragedNPCs)
        ? action.enragedNPCs
        : [],
      rageRange: range
    }
  };
}

function createConsumedNpcDestroyedPayload(entity) {
  const position = getPosition(entity);
  return {
    id: entity.id,
    x: position.x,
    y: position.y,
    faction: entity.faction,
    deathEffect: 'void_consume'
  };
}

function createVoidMinionRiftPositions(position, riftCount, random = Math.random) {
  const center = getPosition(position);
  const parsedCount = Number(riftCount);
  const count = Number.isFinite(parsedCount)
    ? Math.max(0, Math.floor(parsedCount))
    : 0;
  const positions = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const sample = Number(random());
    const normalizedSample = Number.isFinite(sample)
      ? Math.max(0, Math.min(1, sample))
      : 0;
    const distance = 150 + normalizedSample * 100;
    positions.push({
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance
    });
  }

  return positions;
}

module.exports = {
  createNpcSpawnPayload,
  createRogueMinerRageEvent,
  createConsumedNpcDestroyedPayload,
  createVoidMinionRiftPositions
};
