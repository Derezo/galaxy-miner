// Galaxy Miner - Sound Pool
// Manages audio buffer loading, caching, and playback pooling

const SoundPool = (function() {
  // Audio buffer cache: filename -> AudioBuffer
  const buffers = new Map();

  // Loading promises: filename -> Promise
  const loading = new Map();

  // Active sound sources for cleanup
  const activeSources = [];

  // Maximum concurrent sounds to prevent audio overload
  const MAX_CONCURRENT = 32;

  // Base path for audio files
  const AUDIO_BASE_PATH = '/assets/audio/';

  /**
   * Load an audio file and cache the buffer
   * @param {string} filename - Relative path to audio file
   * @returns {Promise<AudioBuffer>}
   */
  function loadSound(filename) {
    // Return cached buffer if available
    if (buffers.has(filename)) {
      return Promise.resolve(buffers.get(filename));
    }

    // Return existing loading promise if already loading
    if (loading.has(filename)) {
      return loading.get(filename);
    }

    // Start loading
    const promise = new Promise((resolve, reject) => {
      const context = AudioContextManager.getContext();
      if (!context) {
        reject(new Error('AudioContext not available'));
        return;
      }

      const url = AUDIO_BASE_PATH + filename;

      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load audio: ${url} (${response.status})`);
          }
          return response.arrayBuffer();
        })
        .then(arrayBuffer => context.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          // Cache the buffer
          buffers.set(filename, audioBuffer);
          loading.delete(filename);
          resolve(audioBuffer);
        })
        .catch(error => {
          console.error('Error loading sound:', filename, error);
          loading.delete(filename);
          reject(error);
        });
    });

    loading.set(filename, promise);
    return promise;
  }

  /**
   * Play a sound from the pool
   * @param {string} filename - Audio file to play
   * @param {Object} options - Playback options
   * @param {number} options.volume - Volume (0-1)
   * @param {number} options.pan - Stereo pan (-1 to 1)
   * @param {number} options.pitch - Playback rate (0.5-2.0)
   * @param {boolean} options.loop - Whether to loop
   * @param {number} options.startTime - When to start (for scheduling)
   * @returns {Promise<AudioBufferSourceNode>} The playing source node
   */
  function playSound(filename, options = {}) {
    return new Promise((resolve, reject) => {
      const context = AudioContextManager.getContext();
      if (!context || !AudioContextManager.isReady()) {
        reject(new Error('AudioContext not ready'));
        return;
      }

      // Check concurrent sound limit
      if (activeSources.length >= MAX_CONCURRENT) {
        // Stop oldest sound to make room
        const oldest = activeSources.shift();
        if (oldest && oldest.source) {
          try {
            oldest.source.stop();
          } catch (e) {
            // Ignore errors from already stopped sources
          }
        }
      }

      loadSound(filename)
        .then(buffer => {
          // Create source node
          const source = context.createBufferSource();
          source.buffer = buffer;

          // Create gain node for volume control
          const gainNode = context.createGain();
          gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0;

          // Create stereo panner for spatial audio
          const pannerNode = context.createStereoPanner();
          pannerNode.pan.value = options.pan !== undefined ? options.pan : 0;

          // Set playback rate (pitch)
          source.playbackRate.value = options.pitch !== undefined ? options.pitch : 1.0;

          // Set loop
          source.loop = options.loop || false;

          // Connect audio graph: source -> gain -> panner -> destination
          source.connect(gainNode);
          gainNode.connect(pannerNode);
          pannerNode.connect(context.destination);

          // Track active source
          const activeSource = {
            source,
            gainNode,
            pannerNode,
            filename,
            startTime: context.currentTime
          };
          activeSources.push(activeSource);

          // Clean up when sound ends
          source.onended = () => {
            const index = activeSources.indexOf(activeSource);
            if (index !== -1) {
              activeSources.splice(index, 1);
            }
          };

          // Start playback
          const startTime = options.startTime !== undefined ? options.startTime : 0;
          source.start(startTime);

          resolve(source);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /**
   * Stop a specific sound source
   * @param {AudioBufferSourceNode} sourceNode - The source to stop
   */
  function stopSound(sourceNode) {
    if (!sourceNode) return;

    try {
      sourceNode.stop();
    } catch (e) {
      // Source may already be stopped
    }

    // Remove from active sources
    const index = activeSources.findIndex(s => s.source === sourceNode);
    if (index !== -1) {
      activeSources.splice(index, 1);
    }
  }

  /**
   * Stop all currently playing sounds
   */
  function stopAll() {
    activeSources.forEach(activeSource => {
      try {
        activeSource.source.stop();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    });
    activeSources.length = 0;
  }

  /**
   * Get count of currently playing sounds
   * @returns {number}
   */
  function getActiveCount() {
    return activeSources.length;
  }

  /**
   * Get all active sources (for debugging)
   * @returns {Array}
   */
  function getActiveSources() {
    return [...activeSources];
  }

  /**
   * Preload multiple sounds
   * @param {Array<string>} filenames - Array of filenames to preload
   * @returns {Promise<Array<AudioBuffer>>}
   */
  function preloadSounds(filenames) {
    const promises = filenames.map(filename => loadSound(filename));
    return Promise.all(promises);
  }

  /**
   * Clear cached buffers to free memory
   */
  function clearCache() {
    buffers.clear();
    loading.clear();
    Logger.log('Audio buffer cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  function getStats() {
    return {
      cached: buffers.size,
      loading: loading.size,
      active: activeSources.length,
      maxConcurrent: MAX_CONCURRENT
    };
  }

  return {
    loadSound,
    playSound,
    stopSound,
    stopAll,
    getActiveCount,
    getActiveSources,
    preloadSounds,
    clearCache,
    getStats
  };
})();
