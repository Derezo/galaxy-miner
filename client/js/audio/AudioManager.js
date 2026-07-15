// Galaxy Miner - Audio Manager
// Central singleton for all game audio

const AudioManager = (function () {
  // Volume settings (persisted to localStorage)
  let volumes = {
    master: 0.8,
    sfx: 1.0,
    ambient: 0.6,
    ui: 0.8,
    music: 0.5,
  };

  // Mute state
  let isMuted = false;

  // Priority levels for sound culling
  const PRIORITY = {
    CRITICAL: 100,
    HIGH: 75,
    MEDIUM: 50,
    LOW: 25,
    MINIMAL: 10,
  };

  // Active looping sources and their semantic intents are separate. Sources can
  // be suspended while hidden without forgetting that gameplay still wants a
  // loop, and a hidden stop can remove the intent before visibility returns.
  const activeLoops = new Map(); // loopKey -> { source, soundId, config, options }
  const loopIntents = new Map(); // loopKey -> { soundId, options }
  const pendingLoopVersions = new Map(); // loopKey -> opaque request token
  let visibilitySuspended = false;
  let audioContextStateTarget = null;
  let loopReconciliationScheduled = false;

  // Opaque request versions prevent an async buffer load from resurrecting a
  // loop after it was stopped or replacing a newer request for the same key.
  const loopRequestVersions = new Map(); // loopKey -> opaque request token

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
    visibilitySuspended = !!document.hidden;
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const context = typeof AudioContextManager.getContext === "function"
      ? AudioContextManager.getContext()
      : null;
    if (context && typeof context.addEventListener === "function") {
      audioContextStateTarget = context;
      context.addEventListener("statechange", handleAudioContextStateChange);
    }

    initialized = true;
    Logger.log("AudioManager initialized", getStats());

    return true;
  }

  /**
   * Calculate the gain and pan used for a configured playback request.
   * Keeping this in one place lets active loops react to settings without a
   * stop/start cycle or a second interpretation of spatial attenuation.
   */
  function calculatePlaybackState(config, options = {}) {
    let finalVolume = config.baseVolume;
    finalVolume *= volumes[config.category] ?? 1.0;
    finalVolume *= volumes.master;

    if (options.volume !== undefined) {
      finalVolume *= options.volume;
    }

    let pan = 0;
    let isSpatial = false;
    if (
      options.x !== undefined &&
      options.y !== undefined &&
      typeof Player !== "undefined"
    ) {
      isSpatial = true;
      const spatial = SpatialAudio.calculate(
        Player.position.x,
        Player.position.y,
        options.x,
        options.y,
        finalVolume
      );
      finalVolume = spatial.volume;
      pan = spatial.pan;
    }

    return { volume: finalVolume, pan, isSpatial };
  }

  /** Apply current master/category/mute state to every live loop GainNode. */
  function updateActiveLoopVolumes() {
    if (typeof SoundPool.setSourceVolume !== "function") return;

    activeLoops.forEach((loop) => {
      const volume = isMuted
        ? 0
        : calculatePlaybackState(loop.config, loop.options).volume;
      SoundPool.setSourceVolume(loop.source, volume);
    });
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

    // Resolve a concrete variation. Config.file remains the single-file
    // fallback if a generated variant cannot be loaded or decoded.
    const filename = getVariationFilename(soundId, config);

    const playbackState = calculatePlaybackState(config, options);

    // Don't allocate a spatial source that is currently out of range.
    if (playbackState.isSpatial && playbackState.volume === 0) {
      return Promise.resolve(null);
    }

    // Check priority for sound culling
    if (!options.force && !shouldPlaySound(config.priority)) {
      return Promise.resolve(null);
    }

    // Prepare playback options
    const playbackOptions = {
      volume: playbackState.volume,
      pan: playbackState.pan,
      pitch: options.pitch,
      loop: options.loop !== undefined ? options.loop : config.loop,
      onEnded: (source, reason) => {
        try {
          if (typeof options.onEnded === "function") {
            options.onEnded(source, reason);
          }
        } finally {
          scheduleLoopReconciliation();
        }
      },
    };

    // Play through sound pool. Generated variants are preferred, while the
    // configured single file remains a resilient fallback for an unavailable
    // or undecodable variant.
    return SoundPool.playSound(filename, playbackOptions)
      .catch((error) => {
        if (filename !== config.file && typeof config.file === "string") {
          return SoundPool.playSound(config.file, playbackOptions);
        }
        throw error;
      })
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
    return play(soundId, { ...options, x, y });
  }

  /**
   * Create a new generation token for a loop request.
   */
  function nextLoopRequestVersion(loopKey) {
    // Opaque identity avoids ABA collisions across cleanup/re-initialization.
    const requestVersion = Symbol(loopKey);
    loopRequestVersions.set(loopKey, requestVersion);
    return requestVersion;
  }

  function stopActiveLoopSource(loopKey) {
    const existingLoop = activeLoops.get(loopKey);
    if (existingLoop) {
      activeLoops.delete(loopKey);
      SoundPool.stopSound(existingLoop.source);
    }
  }

  /**
   * Reconcile semantic loop intents after a source naturally ends or is
   * evicted. Capacity is checked after the current playback operation settles
   * so an all-loop pool cannot endlessly evict and recreate its own sources.
   */
  function scheduleLoopReconciliation() {
    if (loopReconciliationScheduled) return;
    loopReconciliationScheduled = true;

    Promise.resolve().then(() => {
      loopReconciliationScheduled = false;
      if (visibilitySuspended || isMuted || !initialized) return;

      const stats = typeof SoundPool.getStats === "function"
        ? SoundPool.getStats()
        : null;
      if (
        stats &&
        Number.isFinite(stats.maxConcurrent) &&
        typeof SoundPool.getActiveCount === "function" &&
        SoundPool.getActiveCount() >= stats.maxConcurrent
      ) {
        return;
      }

      restartIntendedLoops();
    });
  }

  /** Start the physical source for an already-recorded semantic loop intent. */
  function launchLoopSource(loopKey) {
    const intent = loopIntents.get(loopKey);
    const requestVersion = nextLoopRequestVersion(loopKey);
    stopActiveLoopSource(loopKey);

    if (visibilitySuspended || isMuted || !intent) {
      return Promise.resolve(null);
    }

    pendingLoopVersions.set(loopKey, requestVersion);

    const handleSourceEnded = (source, reason) => {
      const activeLoop = activeLoops.get(loopKey);
      if (!activeLoop || activeLoop.source !== source) return;

      activeLoops.delete(loopKey);
      if ((reason === "evicted" || reason === "ended") && loopIntents.has(loopKey)) {
        scheduleLoopReconciliation();
      }
    };
    let sourceWasEvictedBeforeInstall = false;

    // Play with loop enabled
    return play(intent.soundId, {
      ...intent.options,
      loop: true,
      onEnded: handleSourceEnded,
    }).then((source) => {
      const sourceIsActive = !source || typeof SoundPool.isSourceActive !== "function" ||
        SoundPool.isSourceActive(source);
      const requestIsCurrent = loopRequestVersions.get(loopKey) === requestVersion &&
        pendingLoopVersions.get(loopKey) === requestVersion &&
        loopIntents.get(loopKey) === intent &&
        !visibilitySuspended &&
        !isMuted &&
        sourceIsActive;

      if (!requestIsCurrent) {
        sourceWasEvictedBeforeInstall = !!source && !sourceIsActive;
        if (source && sourceIsActive) SoundPool.stopSound(source);
        return null;
      }

      if (source) {
        const config = SoundConfig[intent.soundId];
        activeLoops.set(loopKey, {
          source,
          soundId: intent.soundId,
          config,
          options: { ...intent.options },
        });

        // Settings may have changed while the buffer was loading.
        if (typeof SoundPool.setSourceVolume === "function") {
          const currentVolume = calculatePlaybackState(config, intent.options).volume;
          SoundPool.setSourceVolume(source, currentVolume);
        }
      }
      return source;
    }).finally(() => {
      if (pendingLoopVersions.get(loopKey) === requestVersion) {
        pendingLoopVersions.delete(loopKey);
      }
      if (sourceWasEvictedBeforeInstall && loopIntents.get(loopKey) === intent) {
        scheduleLoopReconciliation();
      }
    });
  }

  /**
   * Start a looping sound (for ambient sounds)
   * @param {string} soundId - Sound ID
   * @param {Object} options - Playback options
   * @param {string} loopKey - Stable instance key (defaults to soundId)
   * @returns {Promise<AudioBufferSourceNode|null>}
   */
  function startLoop(soundId, options = {}, loopKey = soundId) {
    if (!SoundConfig[soundId]) {
      console.warn("Unknown sound ID:", soundId);
      return Promise.resolve(null);
    }

    const intent = { soundId, options: { ...options } };
    loopIntents.set(loopKey, intent);
    return launchLoopSource(loopKey);
  }

  /**
   * Stop a looping sound
   * @param {string} loopKey - Loop instance key
   */
  function stopLoop(loopKey) {
    loopIntents.delete(loopKey);
    pendingLoopVersions.delete(loopKey);
    nextLoopRequestVersion(loopKey);
    // Deletion still invalidates an older async closure: its captured token no
    // longer equals the missing entry. Avoid retaining dynamic instance keys.
    loopRequestVersions.delete(loopKey);
    stopActiveLoopSource(loopKey);
    scheduleLoopReconciliation();
  }

  /**
   * Update spatial audio for all active loops
   * Should be called each frame for sounds following moving objects
   * @param {string} loopKey - Loop instance key
   * @param {number} x - New X position
   * @param {number} y - New Y position
   */
  function updateLoopPosition(loopKey, x, y) {
    // For looping sounds, we need to restart with new position
    // This is a limitation of Web Audio API - can't update position dynamically
    const loop = activeLoops.get(loopKey) || loopIntents.get(loopKey);
    if (loop) {
      const options = { ...loop.options, x, y };
      startLoop(loop.soundId, options, loopKey);
    }
  }

  /** Stop loop sources while retaining the semantic intents for restoration. */
  function suspendLoopSources() {
    const soundIds = new Set([
      ...loopIntents.keys(),
      ...pendingLoopVersions.keys(),
      ...activeLoops.keys(),
    ]);
    soundIds.forEach((loopKey) => nextLoopRequestVersion(loopKey));
    pendingLoopVersions.clear();
    const loopsToStop = [...activeLoops.values()];
    activeLoops.clear();
    loopsToStop.forEach((loop) => SoundPool.stopSound(loop.source));
  }

  /** Restart intended loops that do not already have a source or pending load. */
  function restartIntendedLoops() {
    if (visibilitySuspended || isMuted) return;

    const stats = typeof SoundPool.getStats === "function"
      ? SoundPool.getStats()
      : null;
    let availableSlots = Number.POSITIVE_INFINITY;
    if (
      stats &&
      Number.isFinite(stats.maxConcurrent) &&
      typeof SoundPool.getActiveCount === "function"
    ) {
      availableSlots = Math.max(
        0,
        stats.maxConcurrent - SoundPool.getActiveCount() - pendingLoopVersions.size
      );
    }

    for (const loopKey of loopIntents.keys()) {
      if (availableSlots <= 0) break;
      if (!activeLoops.has(loopKey) && !pendingLoopVersions.has(loopKey)) {
        launchLoopSource(loopKey);
        availableSlots -= 1;
      }
    }
  }

  /**
   * Stop all looping sounds
   */
  function stopAllLoops() {
    const soundIds = new Set([
      ...loopRequestVersions.keys(),
      ...loopIntents.keys(),
      ...pendingLoopVersions.keys(),
      ...activeLoops.keys(),
    ]);
    soundIds.forEach((loopKey) => nextLoopRequestVersion(loopKey));
    loopRequestVersions.clear();
    loopIntents.clear();
    pendingLoopVersions.clear();
    const loopsToStop = [...activeLoops.values()];
    activeLoops.clear();
    loopsToStop.forEach((loop) => SoundPool.stopSound(loop.source));
  }

  /**
   * Resolve the variation files declared by a sound config. A pattern uses the
   * {index} token and defaults to two-digit, one-based numbering. Explicit
   * variationFiles are also supported for non-sequential families.
   * Invalid variation metadata safely falls back to config.file.
   * @param {Object} config - Sound config
   * @returns {Array<string>} Concrete playback filenames
   */
  function resolveVariationFiles(config) {
    if (!config || typeof config.file !== "string") return [];

    if (Array.isArray(config.variationFiles)) {
      const explicitFiles = config.variationFiles.filter(
        (filename) => typeof filename === "string" && filename.length > 0
      );
      if (explicitFiles.length > 0) return explicitFiles;
    }

    const count = config.variations;
    const pattern = config.variationPattern;
    if (
      !Number.isSafeInteger(count) ||
      count <= 1 ||
      count > 64 ||
      typeof pattern !== "string" ||
      !pattern.includes("{index}")
    ) {
      return [config.file];
    }

    const startIndex = Number.isSafeInteger(config.variationStartIndex)
      ? config.variationStartIndex
      : 1;
    const padding = Number.isSafeInteger(config.variationPadding) &&
      config.variationPadding >= 1 && config.variationPadding <= 6
      ? config.variationPadding
      : 2;

    return Array.from({ length: count }, (_, offset) => {
      const index = String(startIndex + offset).padStart(padding, "0");
      return pattern.split("{index}").join(index);
    });
  }

  /**
   * Get every asset path used by a configured sound. The single-file fallback
   * is included so preload and asset validation cover the complete chain.
   * @param {string} soundId - ID from SoundConfig
   * @returns {Array<string>} Unique concrete filenames
   */
  function getSoundFilenames(soundId) {
    const config = SoundConfig[soundId];
    if (!config) return [];

    const filenames = resolveVariationFiles(config);
    if (typeof config.file === "string") filenames.push(config.file);
    return Array.from(new Set(filenames));
  }

  /**
   * Get variation filename for sounds with multiple versions
   * @param {string} soundId - Sound ID
   * @param {Object} config - Sound config
   * @returns {string} Filename with variation
   */
  function getVariationFilename(soundId, config) {
    const variationFiles = resolveVariationFiles(config);
    if (variationFiles.length <= 1) return variationFiles[0] || config.file;

    // Get last played variation
    const lastVariation = recentVariations.get(soundId) ?? -1;

    // Pick a different variation
    let variation = Math.min(
      variationFiles.length - 1,
      Math.floor(Math.random() * variationFiles.length)
    );
    if (variation === lastVariation) {
      variation = (variation + 1) % variationFiles.length;
    }

    // Store for next time
    recentVariations.set(soundId, variation);

    return variationFiles[variation];
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

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      console.warn("Invalid volume value:", value);
      return;
    }

    volumes[category] = Math.max(0, Math.min(1, numericValue));
    saveVolumes();
    updateActiveLoopVolumes();
    restartIntendedLoops();

    Logger.log(`Volume ${category} set to ${volumes[category].toFixed(2)}`);

    // Notify MusicManager of volume changes
    if (category === 'music' && typeof MusicManager !== 'undefined') {
      MusicManager.setVolume(volumes[category]);
    }
    if (category === 'master' && typeof MusicManager !== 'undefined') {
      MusicManager.updateMasterVolume();
    }
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
    updateActiveLoopVolumes();

    Logger.log("Audio muted");

    if (typeof MusicManager !== 'undefined') {
      if (typeof MusicManager.setMuted === 'function') {
        MusicManager.setMuted(true);
      } else {
        MusicManager.setVolume(0);
      }
    }
  }

  /**
   * Unmute audio
   */
  function unmute() {
    if (!isMuted) return;

    isMuted = false;
    updateActiveLoopVolumes();
    restartIntendedLoops();

    if (typeof MusicManager !== 'undefined') {
      if (typeof MusicManager.setMuted === 'function') {
        MusicManager.setVolume(volumes.music);
        MusicManager.setMuted(false);
      } else {
        MusicManager.setVolume(volumes.music);
      }
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
      // Stop physical sources but keep the gameplay intents. Any pending load
      // is invalidated so it cannot become audible while the page is hidden.
      if (!visibilitySuspended) {
        visibilitySuspended = true;
        suspendLoopSources();
      }
      if (typeof MusicManager !== 'undefined') MusicManager.pause();
    } else {
      // Page visible - restore only after the underlying AudioContext is
      // actually running. AudioContextManager's cached readiness can remain
      // true after a browser automatically suspends the raw context.
      visibilitySuspended = false;
      resumeAudioContextAndRestore();
    }
  }

  /** Restore visibility-suspended playback once the raw context is running. */
  function restoreVisiblePlayback() {
    if (!initialized || visibilitySuspended || document.hidden) return;

    // Calling through the manager while state is running synchronizes its
    // internal readiness flag after a first user-gesture resume.
    AudioContextManager.resume();
    restartIntendedLoops();
    if (typeof MusicManager !== 'undefined') MusicManager.resume();
  }

  /**
   * Resume the raw context even if AudioContextManager still has a stale
   * `isResumed` cache, then restore semantic loop intents.
   */
  function resumeAudioContextAndRestore() {
    const context = typeof AudioContextManager.getContext === "function"
      ? AudioContextManager.getContext()
      : null;

    if (!context) {
      AudioContextManager.resume();
      restoreVisiblePlayback();
      return;
    }

    if (context.state === "running") {
      restoreVisiblePlayback();
      return;
    }

    if (typeof context.resume !== "function") {
      AudioContextManager.resume();
      return;
    }

    let resumeResult;
    try {
      resumeResult = context.resume();
    } catch (error) {
      console.error("Failed to resume AudioContext after visibility change:", error);
      return;
    }

    Promise.resolve(resumeResult)
      .then(() => {
        if (context.state === "running") restoreVisiblePlayback();
      })
      .catch((error) => {
        console.error("Failed to resume AudioContext after visibility change:", error);
      });
  }

  /** Restore deferred intents when a later user gesture starts the context. */
  function handleAudioContextStateChange() {
    if (audioContextStateTarget?.state === "running") {
      restoreVisiblePlayback();
    }
  }

  /**
   * Preload essential sounds
   * @param {Array<string>} soundIds - Array of sound IDs to preload
   * @returns {Promise}
   */
  function preload(soundIds) {
    const filenames = Array.from(new Set(
      soundIds.flatMap((id) => getSoundFilenames(id))
    ));

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
      intendedLoops: loopIntents.size,
      visibilitySuspended,
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
    loopRequestVersions.clear();
    loopIntents.clear();
    pendingLoopVersions.clear();
    soundQueue.length = 0;
    visibilitySuspended = false;
    loopReconciliationScheduled = false;

    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (
      audioContextStateTarget &&
      typeof audioContextStateTarget.removeEventListener === "function"
    ) {
      audioContextStateTarget.removeEventListener(
        "statechange",
        handleAudioContextStateChange
      );
    }
    audioContextStateTarget = null;

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
    getSoundFilenames,
    preload,
    getStats,
    stopAll,
    cleanup,
    PRIORITY,
  };
})();
