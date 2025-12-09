// Galaxy Miner - Audio Manager
// Central singleton for all game audio

const AudioManager = (function () {
  // Volume settings (persisted to localStorage)
  let volumes = {
    master: 0.8,
    sfx: 1.0,
    ambient: 0.6,
    ui: 0.8,
  };

  // Mute state
  let isMuted = false;
  let volumesBeforeMute = null;

  // Priority levels for sound culling
  const PRIORITY = {
    CRITICAL: 100,
    HIGH: 75,
    MEDIUM: 50,
    LOW: 25,
    MINIMAL: 10,
  };

  // Active looping sounds (for ambient sounds)
  const activeLoops = new Map(); // soundId -> { source, gainNode, pannerNode, config }

  // Recently played sounds (for variation tracking)
  const recentVariations = new Map(); // soundId -> lastVariationIndex

  // Sound queue for priority management
  const soundQueue = [];
  const MAX_QUEUE_SIZE = 10;

  // Initialization flag
  let initialized = false;

  /**
   * Initialize the audio system
   */
  function init() {
    if (initialized) {
      Logger.log("AudioManager already initialized");
      return;
    }

    // Initialize sub-systems
    if (!AudioContextManager.init()) {
      console.error("Failed to initialize AudioContext");
      return false;
    }

    // Load saved volumes
    loadVolumes();

    // Set up visibility change listener to pause/resume audio
    document.addEventListener("visibilitychange", handleVisibilityChange);

    initialized = true;
    Logger.log("AudioManager initialized", getStats());

    return true;
  }

  /**
   * Play a sound effect
   * @param {string} soundId - ID from SoundConfig
   * @param {Object} options - Playback options
   * @param {number} options.x - World X position for spatial audio
   * @param {number} options.y - World Y position for spatial audio
   * @param {number} options.volume - Volume override (0-1)
   * @param {number} options.pitch - Pitch override (0.5-2.0)
   * @param {boolean} options.loop - Loop override
   * @param {boolean} options.force - Force play even if low priority
   * @returns {Promise<AudioBufferSourceNode|null>}
   */
  function play(soundId, options = {}) {
    if (!initialized || isMuted) return Promise.resolve(null);
    if (!AudioContextManager.isReady()) {
      AudioContextManager.resume();
      return Promise.resolve(null);
    }

    // Get sound configuration
    const config = SoundConfig[soundId];
    if (!config) {
      console.warn("Unknown sound ID:", soundId);
      return Promise.resolve(null);
    }

    // Handle variations
    const filename = getVariationFilename(soundId, config);

    // Calculate final volume
    let finalVolume = config.baseVolume;

    // Apply category volume
    const categoryVolume = volumes[config.category] || 1.0;
    finalVolume *= categoryVolume;

    // Apply master volume
    finalVolume *= volumes.master;

    // Apply volume override
    if (options.volume !== undefined) {
      finalVolume *= options.volume;
    }

    // Calculate spatial audio if position provided
    let pan = 0;
    if (
      options.x !== undefined &&
      options.y !== undefined &&
      typeof Player !== "undefined"
    ) {
      const spatial = SpatialAudio.calculate(
        Player.position.x,
        Player.position.y,
        options.x,
        options.y,
        finalVolume
      );
      finalVolume = spatial.volume;
      pan = spatial.pan;

      // Don't play if out of range
      if (finalVolume === 0) {
        return Promise.resolve(null);
      }
    }

    // Check priority for sound culling
    if (!options.force && !shouldPlaySound(config.priority)) {
      return Promise.resolve(null);
    }

    // Prepare playback options
    const playbackOptions = {
      volume: finalVolume,
      pan: pan,
      pitch: options.pitch,
      loop: options.loop !== undefined ? options.loop : config.loop,
    };

    // Play through sound pool
    return SoundPool.playSound(filename, playbackOptions)
      .then((source) => {
        // Track in queue for priority management
        trackSound(soundId, config.priority, source);
        return source;
      })
      .catch((error) => {
        console.error("Error playing sound:", soundId, error);
        return null;
      });
  }

  /**
   * Play a sound at a specific world position (convenience method)
   * @param {string} soundId - Sound ID
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {Object} options - Additional options
   * @returns {Promise<AudioBufferSourceNode|null>}
   */
  function playAt(soundId, x, y, options = {}) {
    console.log("Playing sound " + soundId);
    return play(soundId, { ...options, x, y });
  }

  /**
   * Start a looping sound (for ambient sounds)
   * @param {string} soundId - Sound ID
   * @param {Object} options - Playback options
   * @returns {Promise<AudioBufferSourceNode|null>}
   */
  function startLoop(soundId, options = {}) {
    // Stop existing loop if playing
    if (activeLoops.has(soundId)) {
      stopLoop(soundId);
    }

    // Play with loop enabled
    return play(soundId, { ...options, loop: true }).then((source) => {
      if (source) {
        const config = SoundConfig[soundId];
        activeLoops.set(soundId, {
          source,
          config,
          options,
        });
      }
      return source;
    });
  }

  /**
   * Stop a looping sound
   * @param {string} soundId - Sound ID
   */
  function stopLoop(soundId) {
    const loop = activeLoops.get(soundId);
    if (loop) {
      SoundPool.stopSound(loop.source);
      activeLoops.delete(soundId);
    }
  }

  /**
   * Update spatial audio for all active loops
   * Should be called each frame for sounds following moving objects
   * @param {string} soundId - Sound ID
   * @param {number} x - New X position
   * @param {number} y - New Y position
   */
  function updateLoopPosition(soundId, x, y) {
    // For looping sounds, we need to restart with new position
    // This is a limitation of Web Audio API - can't update position dynamically
    const loop = activeLoops.get(soundId);
    if (loop) {
      const options = { ...loop.options, x, y };
      startLoop(soundId, options);
    }
  }

  /**
   * Stop all looping sounds
   */
  function stopAllLoops() {
    activeLoops.forEach((loop, soundId) => {
      SoundPool.stopSound(loop.source);
    });
    activeLoops.clear();
  }

  /**
   * Get variation filename for sounds with multiple versions
   * @param {string} soundId - Sound ID
   * @param {Object} config - Sound config
   * @returns {string} Filename with variation
   */
  function getVariationFilename(soundId, config) {
    if (!config.variations || config.variations <= 1) {
      return config.file;
    }

    // Get last played variation
    const lastVariation = recentVariations.get(soundId) || -1;

    // Pick a different variation
    let variation = Math.floor(Math.random() * config.variations);
    if (variation === lastVariation && config.variations > 1) {
      variation = (variation + 1) % config.variations;
    }

    // Store for next time
    recentVariations.set(soundId, variation);

    // Build filename with variation number
    const basePath = config.file.replace(/(\.\w+)$/, "");
    const ext = config.file.match(/\.\w+$/)[0];
    const variationNumber = String(variation + 1).padStart(2, "0");

    return `${basePath}_${variationNumber}${ext}`;
  }

  /**
   * Check if sound should play based on priority
   * @param {number} priority - Sound priority
   * @returns {boolean}
   */
  function shouldPlaySound(priority) {
    const activeCount = SoundPool.getActiveCount();
    const maxConcurrent = 32;

    // Always allow high priority sounds
    if (priority >= PRIORITY.HIGH) {
      return true;
    }

    // If we're near the limit, only allow higher priority sounds
    if (activeCount >= maxConcurrent * 0.8) {
      return priority >= PRIORITY.MEDIUM;
    }

    if (activeCount >= maxConcurrent * 0.6) {
      return priority >= PRIORITY.LOW;
    }

    return true;
  }

  /**
   * Track a playing sound for priority management
   * @param {string} soundId - Sound ID
   * @param {number} priority - Sound priority
   * @param {AudioBufferSourceNode} source - Audio source
   */
  function trackSound(soundId, priority, source) {
    soundQueue.push({
      soundId,
      priority,
      source,
      time: Date.now(),
    });

    // Limit queue size
    if (soundQueue.length > MAX_QUEUE_SIZE) {
      soundQueue.shift();
    }
  }

  /**
   * Set volume for a category
   * @param {string} category - Volume category (master, sfx, ambient, ui)
   * @param {number} value - Volume value (0-1)
   */
  function setVolume(category, value) {
    if (!volumes.hasOwnProperty(category)) {
      console.warn("Unknown volume category:", category);
      return;
    }

    volumes[category] = Math.max(0, Math.min(1, value));
    saveVolumes();

    Logger.log(`Volume ${category} set to ${volumes[category].toFixed(2)}`);
  }

  /**
   * Get volume for a category
   * @param {string} category - Volume category
   * @returns {number} Volume value (0-1)
   */
  function getVolume(category) {
    return volumes[category] || 0;
  }

  /**
   * Mute all audio
   */
  function mute() {
    if (isMuted) return;

    isMuted = true;
    volumesBeforeMute = { ...volumes };

    // Set all volumes to 0
    Object.keys(volumes).forEach((key) => {
      volumes[key] = 0;
    });

    Logger.log("Audio muted");
  }

  /**
   * Unmute audio
   */
  function unmute() {
    if (!isMuted) return;

    isMuted = false;

    // Restore previous volumes
    if (volumesBeforeMute) {
      volumes = { ...volumesBeforeMute };
      volumesBeforeMute = null;
    }

    Logger.log("Audio unmuted");
  }

  /**
   * Toggle mute state
   * @returns {boolean} New mute state
   */
  function toggleMute() {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
    return isMuted;
  }

  /**
   * Get current mute state
   * @returns {boolean}
   */
  function getMuted() {
    return isMuted;
  }

  /**
   * Save volumes to localStorage
   */
  function saveVolumes() {
    try {
      localStorage.setItem("galaxy-miner-volumes", JSON.stringify(volumes));
    } catch (error) {
      console.error("Failed to save volumes:", error);
    }
  }

  /**
   * Load volumes from localStorage
   */
  function loadVolumes() {
    try {
      const saved = localStorage.getItem("galaxy-miner-volumes");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new categories
        volumes = { ...volumes, ...parsed };
        Logger.log("Loaded audio volumes from localStorage");
      }
    } catch (error) {
      console.error("Failed to load volumes:", error);
    }
  }

  /**
   * Handle page visibility changes
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      // Page hidden - reduce volume or pause loops
      stopAllLoops();
    } else {
      // Page visible - resume audio context if needed
      AudioContextManager.resume();
    }
  }

  /**
   * Preload essential sounds
   * @param {Array<string>} soundIds - Array of sound IDs to preload
   * @returns {Promise}
   */
  function preload(soundIds) {
    const filenames = soundIds
      .map((id) => {
        const config = SoundConfig[id];
        return config ? config.file : null;
      })
      .filter((f) => f !== null);

    return SoundPool.preloadSounds(filenames);
  }

  /**
   * Get audio system statistics
   * @returns {Object}
   */
  function getStats() {
    return {
      initialized,
      muted: isMuted,
      volumes: { ...volumes },
      activeLoops: activeLoops.size,
      soundPool: SoundPool.getStats(),
      audioContext: AudioContextManager.getState(),
    };
  }

  /**
   * Stop all sounds (including loops)
   */
  function stopAll() {
    stopAllLoops();
    SoundPool.stopAll();
  }

  /**
   * Clean up audio system
   */
  function cleanup() {
    stopAll();
    SoundPool.clearCache();
    recentVariations.clear();
    soundQueue.length = 0;

    document.removeEventListener("visibilitychange", handleVisibilityChange);

    initialized = false;
    Logger.log("AudioManager cleaned up");
  }

  /**
   * Check if audio system is ready to play sounds
   * @returns {boolean}
   */
  function isReady() {
    return initialized && !isMuted && AudioContextManager.isReady();
  }

  // Public API
  return {
    init,
    isReady,
    play,
    playAt,
    startLoop,
    stopLoop,
    updateLoopPosition,
    stopAllLoops,
    setVolume,
    getVolume,
    mute,
    unmute,
    toggleMute,
    getMuted,
    preload,
    getStats,
    stopAll,
    cleanup,
    PRIORITY,
  };
})();
