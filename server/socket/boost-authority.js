'use strict';

// Transport-independent boost timing. Socket replacement and reconnects must
// not recreate the authoritative cooldown at zero.
const playerBoostAuthorities = new Map();

function normalizeDeadline(value) {
  const deadline = Number(value);
  return Number.isFinite(deadline) && deadline > 0 ? deadline : 0;
}

function setPlayerBoostAuthority(userId, state) {
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;

  const authority = {
    boostEndAt: normalizeDeadline(state?.boostEndAt),
    recoveryEndAt: normalizeDeadline(state?.recoveryEndAt),
    cooldownEndAt: normalizeDeadline(state?.cooldownEndAt)
  };
  playerBoostAuthorities.set(userId, authority);
  return { ...authority };
}

function getPlayerBoostAuthority(userId, now = Date.now()) {
  const authority = playerBoostAuthorities.get(userId);
  if (!authority) {
    return { boostEndAt: 0, recoveryEndAt: 0, cooldownEndAt: 0 };
  }

  const currentTime = Number.isFinite(now) ? now : Date.now();
  if (
    authority.boostEndAt <= currentTime &&
    authority.recoveryEndAt <= currentTime &&
    authority.cooldownEndAt <= currentTime
  ) {
    playerBoostAuthorities.delete(userId);
    return { boostEndAt: 0, recoveryEndAt: 0, cooldownEndAt: 0 };
  }

  return { ...authority };
}

function getPlayerBoostSnapshot(userId, now = Date.now()) {
  const currentTime = Number.isFinite(now) ? now : Date.now();
  const authority = getPlayerBoostAuthority(userId, currentTime);
  return {
    ...authority,
    boostRemaining: Math.max(0, authority.boostEndAt - currentTime),
    recoveryRemaining: Math.max(0, authority.recoveryEndAt - currentTime),
    cooldownRemaining: Math.max(0, authority.cooldownEndAt - currentTime)
  };
}

function clearPlayerBoostAuthority(userId) {
  playerBoostAuthorities.delete(userId);
}

module.exports = {
  setPlayerBoostAuthority,
  getPlayerBoostAuthority,
  getPlayerBoostSnapshot,
  clearPlayerBoostAuthority
};
