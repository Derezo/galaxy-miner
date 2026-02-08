// Galaxy Miner - Music Manager
// Streaming music playback with A/B deck crossfade

const MusicManager = (function () {
  const CROSSFADE_DURATION = 2; // seconds
  const FADE_OUT_DURATION = 1; // seconds for stop fade
  const BASE_PATH = '/assets/audio/music/';

  const tracks = [
    { file: 'CosmicWaveform.mp3', name: 'Cosmic Waveform' }
  ];

  // State
  let deckA = null;
  let deckB = null;
  let sourceA = null;
  let sourceB = null;
  let gainA = null;
  let gainB = null;
  let activeDeck = 'A';
  let currentTrack = 0;
  let volume = 0.5;
  let crossfading = false;
  let initialized = false;
  let playing = false;
  let pendingStart = false;

  /**
   * Initialize the music system
   * Creates audio elements and Web Audio nodes but does NOT auto-play
   */
  function init() {
    if (initialized) return;

    const ctx = AudioContextManager.getContext();
    if (!ctx) {
      console.error('MusicManager: No AudioContext available');
      return;
    }

    // Create audio elements
    deckA = new Audio();
    deckB = new Audio();

    deckA.loop = true;
    deckB.loop = true;
    deckA.preload = 'metadata';
    deckB.preload = 'metadata';

    // Create Web Audio nodes
    sourceA = ctx.createMediaElementSource(deckA);
    sourceB = ctx.createMediaElementSource(deckB);
    gainA = ctx.createGain();
    gainB = ctx.createGain();

    // Connect graph: source -> gain -> destination
    sourceA.connect(gainA);
    sourceB.connect(gainB);
    gainA.connect(ctx.destination);
    gainB.connect(ctx.destination);

    // Start with zero gain
    gainA.gain.value = 0;
    gainB.gain.value = 0;

    // Load saved volume
    _loadVolume();

    initialized = true;
    Logger.log('MusicManager initialized');
  }

  /**
   * Start playing music
   * @param {number} [trackIndex=0] - Index into tracks array
   */
  function start(trackIndex) {
    if (!initialized) return;
    if (playing) return;

    const idx = trackIndex !== undefined ? trackIndex : currentTrack;

    // Check if AudioContext is ready
    if (!AudioContextManager.isReady()) {
      pendingStart = true;
      // Listen for context state change
      const ctx = AudioContextManager.getContext();
      if (ctx) {
        const onStateChange = () => {
          if (ctx.state === 'running') {
            ctx.removeEventListener('statechange', onStateChange);
            _resumePending();
          }
        };
        ctx.addEventListener('statechange', onStateChange);
      }
      return;
    }

    _playDeck(idx);
  }

  /**
   * Resume pending start after AudioContext becomes available
   */
  function _resumePending() {
    if (!pendingStart) return;
    pendingStart = false;
    _playDeck(currentTrack);
  }

  /**
   * Internal: start playing on the active deck
   */
  function _playDeck(trackIndex) {
    const el = activeDeck === 'A' ? deckA : deckB;
    const gain = activeDeck === 'A' ? gainA : gainB;

    el.src = BASE_PATH + tracks[trackIndex].file;
    currentTrack = trackIndex;

    const effectiveVol = _getEffectiveVolume();
    gain.gain.value = effectiveVol;

    el.play().then(() => {
      playing = true;
      Logger.log('MusicManager: Now playing "' + tracks[trackIndex].name + '"');
    }).catch(err => {
      // Autoplay blocked - set pending
      if (err.name === 'NotAllowedError') {
        pendingStart = true;
        const ctx = AudioContextManager.getContext();
        if (ctx) {
          const onStateChange = () => {
            if (ctx.state === 'running') {
              ctx.removeEventListener('statechange', onStateChange);
              _resumePending();
            }
          };
          ctx.addEventListener('statechange', onStateChange);
        }
      } else {
        console.error('MusicManager: Playback failed:', err);
      }
    });
  }

  /**
   * Stop music with fade out
   */
  function stop() {
    if (!initialized || !playing) return;

    const gain = activeDeck === 'A' ? gainA : gainB;
    const el = activeDeck === 'A' ? deckA : deckB;
    const ctx = AudioContextManager.getContext();

    if (ctx && ctx.state === 'running') {
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_DURATION);

      setTimeout(() => {
        el.pause();
        el.currentTime = 0;
        playing = false;
      }, FADE_OUT_DURATION * 1000);
    } else {
      el.pause();
      el.currentTime = 0;
      playing = false;
    }

    pendingStart = false;
  }

  /**
   * Pause the active deck (e.g. when tab is hidden)
   */
  function pause() {
    if (!initialized || !playing) return;

    const el = activeDeck === 'A' ? deckA : deckB;
    el.pause();
  }

  /**
   * Resume the active deck (e.g. when tab becomes visible)
   */
  function resume() {
    if (!initialized || !playing) return;

    const el = activeDeck === 'A' ? deckA : deckB;
    if (el.src && el.paused) {
      el.play().catch(() => {
        // Silently handle if resume fails
      });
    }
  }

  /**
   * Crossfade to a different track
   * @param {number} trackIndex - Index into tracks array
   */
  function crossfadeTo(trackIndex) {
    if (!initialized || crossfading) return;
    if (trackIndex === currentTrack && playing) return;

    crossfading = true;

    const newDeckKey = activeDeck === 'A' ? 'B' : 'A';
    const newEl = newDeckKey === 'A' ? deckA : deckB;
    const newGain = newDeckKey === 'A' ? gainA : gainB;
    const oldGain = activeDeck === 'A' ? gainA : gainB;
    const oldEl = activeDeck === 'A' ? deckA : deckB;

    // Prep new deck
    newEl.src = BASE_PATH + tracks[trackIndex].file;
    newGain.gain.value = 0;

    newEl.play().then(() => {
      const ctx = AudioContextManager.getContext();
      if (!ctx) {
        crossfading = false;
        return;
      }
      const now = ctx.currentTime;
      const dur = CROSSFADE_DURATION;

      // Ramp old deck out
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + dur);

      // Ramp new deck in
      newGain.gain.setValueAtTime(0, now);
      newGain.gain.linearRampToValueAtTime(_getEffectiveVolume(), now + dur);

      activeDeck = newDeckKey;
      currentTrack = trackIndex;
      playing = true;

      setTimeout(() => {
        oldEl.pause();
        oldEl.currentTime = 0;
        crossfading = false;
      }, CROSSFADE_DURATION * 1000);
    }).catch(err => {
      console.error('MusicManager: Crossfade failed:', err);
      crossfading = false;
    });
  }

  /**
   * Play a track by name (convenience method)
   * @param {string} name - Track name to find and crossfade to
   */
  function playTrack(name) {
    const idx = tracks.findIndex(t => t.name === name);
    if (idx === -1) {
      console.warn('MusicManager: Unknown track "' + name + '"');
      return;
    }

    if (!playing) {
      start(idx);
    } else {
      crossfadeTo(idx);
    }
  }

  /**
   * Set music volume
   * @param {number} v - Volume 0-1
   */
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    _saveVolume();

    if (!initialized) return;

    // Apply to active deck immediately
    const gain = activeDeck === 'A' ? gainA : gainB;
    if (gain && !crossfading) {
      gain.gain.value = _getEffectiveVolume();
    }
  }

  /**
   * Called when master volume changes - recalculate gain
   */
  function updateMasterVolume() {
    if (!initialized) return;

    const gain = activeDeck === 'A' ? gainA : gainB;
    if (gain && !crossfading) {
      gain.gain.value = _getEffectiveVolume();
    }
  }

  /**
   * Get effective volume (music * master)
   */
  function _getEffectiveVolume() {
    const masterVol = (typeof AudioManager !== 'undefined')
      ? AudioManager.getVolume('master')
      : 1;
    return volume * masterVol;
  }

  /**
   * Save music volume to localStorage
   */
  function _saveVolume() {
    try {
      localStorage.setItem('galaxy-miner-music-volume', String(volume));
    } catch (e) {
      // Silently ignore storage errors
    }
  }

  /**
   * Load music volume from localStorage
   */
  function _loadVolume() {
    try {
      const saved = localStorage.getItem('galaxy-miner-music-volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) {
          volume = Math.max(0, Math.min(1, parsed));
        }
      }
    } catch (e) {
      // Silently ignore storage errors
    }
  }

  /**
   * Check if music is currently playing
   * @returns {boolean}
   */
  function isPlaying() {
    return playing;
  }

  // Public API
  return {
    init,
    start,
    stop,
    pause,
    resume,
    crossfadeTo,
    playTrack,
    setVolume,
    updateMasterVolume,
    isPlaying
  };
})();
