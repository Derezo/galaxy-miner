// Galaxy Miner - Spatial Audio System
// Handles distance-based volume falloff and stereo panning

const SpatialAudio = (function() {
  // Maximum distance for audio falloff (matches base radar range)
  const MAX_DISTANCE = 1000;

  // Minimum volume threshold (sounds quieter than this won't play)
  const MIN_VOLUME = 0.01;

  /**
   * Calculate volume based on distance with linear falloff
   * @param {number} listenerX - Listener X position (usually player)
   * @param {number} listenerY - Listener Y position
   * @param {number} sourceX - Sound source X position
   * @param {number} sourceY - Sound source Y position
   * @param {number} baseVolume - Base volume (0-1)
   * @returns {number} Calculated volume (0-1)
   */
  function calculateVolume(listenerX, listenerY, sourceX, sourceY, baseVolume = 1.0) {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Linear falloff from full volume at 0 distance to 0 at MAX_DISTANCE
    if (distance >= MAX_DISTANCE) {
      return 0;
    }

    const falloff = 1 - (distance / MAX_DISTANCE);
    const volume = baseVolume * falloff;

    // Return 0 if below threshold to avoid playing very quiet sounds
    return volume < MIN_VOLUME ? 0 : volume;
  }

  /**
   * Calculate stereo pan based on relative position
   * @param {number} listenerX - Listener X position
   * @param {number} listenerY - Listener Y position
   * @param {number} sourceX - Sound source X position
   * @param {number} sourceY - Sound source Y position
   * @returns {number} Pan value (-1 = left, 0 = center, 1 = right)
   */
  function calculatePan(listenerX, listenerY, sourceX, sourceY) {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // No panning if source is at listener position
    if (distance < 1) {
      return 0;
    }

    // Calculate angle from listener to source
    const angle = Math.atan2(dy, dx);

    // Use cosine for left-right panning
    // 0° (right) = 1.0, 90° (down) = 0.0, 180° (left) = -1.0, 270° (up) = 0.0
    const pan = Math.cos(angle);

    // Clamp to [-1, 1] range
    return Math.max(-1, Math.min(1, pan));
  }

  /**
   * Calculate both volume and pan for a sound source
   * @param {number} listenerX - Listener X position
   * @param {number} listenerY - Listener Y position
   * @param {number} sourceX - Sound source X position
   * @param {number} sourceY - Sound source Y position
   * @param {number} baseVolume - Base volume (0-1)
   * @returns {Object} { volume, pan }
   */
  function calculate(listenerX, listenerY, sourceX, sourceY, baseVolume = 1.0) {
    return {
      volume: calculateVolume(listenerX, listenerY, sourceX, sourceY, baseVolume),
      pan: calculatePan(listenerX, listenerY, sourceX, sourceY)
    };
  }

  /**
   * Get distance between two points
   * @param {number} x1 - First point X
   * @param {number} y1 - First point Y
   * @param {number} x2 - Second point X
   * @param {number} y2 - Second point Y
   * @returns {number} Distance
   */
  function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if a sound source is within audible range
   * @param {number} listenerX - Listener X position
   * @param {number} listenerY - Listener Y position
   * @param {number} sourceX - Sound source X position
   * @param {number} sourceY - Sound source Y position
   * @returns {boolean} True if within range
   */
  function isInRange(listenerX, listenerY, sourceX, sourceY) {
    return getDistance(listenerX, listenerY, sourceX, sourceY) < MAX_DISTANCE;
  }

  return {
    calculateVolume,
    calculatePan,
    calculate,
    getDistance,
    isInRange,
    MAX_DISTANCE,
    MIN_VOLUME
  };
})();
