// Galaxy Miner - deterministic, rarity-weighted resource selection
// Shared by browser and Node world generation.

(function exposeResourceSelection(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ResourceSelection = api;
  }
})(typeof window !== 'undefined' ? window : null, function createResourceSelection() {
  'use strict';

  // Planet resource rarity probabilities. Empty rarity pools are omitted and
  // the remaining weights are normalized without consuming another RNG draw.
  const RARITY_WEIGHTS = Object.freeze({
    common: 0.65,
    uncommon: 0.23,
    rare: 0.09,
    ultrarare: 0.03
  });
  const RARITY_ORDER = Object.freeze(Object.keys(RARITY_WEIGHTS));

  function getResourceEntries(resourceTypes) {
    if (!resourceTypes || typeof resourceTypes !== 'object' || Array.isArray(resourceTypes)) {
      return [];
    }
    return Object.entries(resourceTypes).filter(([id, definition]) =>
      typeof id === 'string' && id.length > 0 && definition && typeof definition === 'object'
    );
  }

  function buildRarityPools(resourceTypes) {
    const pools = {};
    for (const rarity of RARITY_ORDER) pools[rarity] = [];

    for (const [id, definition] of getResourceEntries(resourceTypes)) {
      const rarity = typeof definition.rarity === 'string'
        ? definition.rarity.toLowerCase()
        : '';
      if (Object.prototype.hasOwnProperty.call(pools, rarity)) {
        pools[rarity].push(id);
      }
    }

    return pools;
  }

  function normalizeRoll(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 1) return 1 - Number.EPSILON;
    return value;
  }

  function prepareSelection(resourceTypes) {
    const entries = getResourceEntries(resourceTypes);
    if (entries.length === 0) return null;

    const pools = buildRarityPools(resourceTypes);
    const availableBands = RARITY_ORDER
      .filter(rarity => pools[rarity].length > 0)
      .map(rarity => ({
        rarity,
        pool: pools[rarity],
        weight: RARITY_WEIGHTS[rarity]
      }));

    return {
      entries,
      availableBands,
      totalWeight: availableBands.reduce((sum, band) => sum + band.weight, 0)
    };
  }

  function selectPreparedResource(selection, rng) {
    if (!selection) return null;

    const random = typeof rng === 'function' ? rng : Math.random;
    const roll = normalizeRoll(random());

    // Compatibility for incomplete test/mod definitions without rarity data.
    if (selection.availableBands.length === 0) {
      const index = Math.min(
        selection.entries.length - 1,
        Math.floor(roll * selection.entries.length)
      );
      return selection.entries[index][0];
    }

    let weightedRoll = roll * selection.totalWeight;

    for (let index = 0; index < selection.availableBands.length; index++) {
      const band = selection.availableBands[index];
      const isLast = index === selection.availableBands.length - 1;
      if (weightedRoll < band.weight || isLast) {
        const positionInBand = Math.min(1 - Number.EPSILON, weightedRoll / band.weight);
        const resourceIndex = Math.floor(positionInBand * band.pool.length);
        return band.pool[resourceIndex];
      }
      weightedRoll -= band.weight;
    }

    return null;
  }

  /**
   * Select one resource with exactly one RNG draw.
   *
   * The draw first selects a weighted rarity band. Its position within that
   * same band selects the resource, avoiding a second random draw. If all
   * rarity metadata is missing, legacy definitions fall back to a uniform
   * selection across the supplied resource keys.
   */
  function selectResource(resourceTypes, rng) {
    return selectPreparedResource(prepareSelection(resourceTypes), rng);
  }

  function selectResources(resourceTypes, rng, count) {
    const selectionCount = Number.isSafeInteger(count) && count > 0 ? count : 0;
    const resources = [];
    const selection = prepareSelection(resourceTypes);

    for (let index = 0; index < selectionCount; index++) {
      const resource = selectPreparedResource(selection, rng);
      if (resource === null) break;
      resources.push(resource);
    }

    return resources;
  }

  return Object.freeze({
    RARITY_WEIGHTS,
    RARITY_ORDER,
    buildRarityPools,
    selectResource,
    selectResources
  });
});
