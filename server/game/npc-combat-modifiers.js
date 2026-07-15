function finitePositive(value, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Combine an NPC's configured base damage with an optional AI action modifier.
 * Invalid AI output falls back to neutral damage rather than producing NaN or
 * allowing a negative multiplier to heal a target.
 */
function getNpcDamageMultiplier(baseDamage, baselineDamage, actionMultiplier) {
  const baseline = finitePositive(baselineDamage);
  const configuredDamage = finitePositive(baseDamage, baseline);
  const phaseMultiplier = finitePositive(actionMultiplier);
  return (configuredDamage / baseline) * phaseMultiplier;
}

module.exports = {
  finitePositive,
  getNpcDamageMultiplier
};
