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
  let outputGain = null;
  let activeDeck = 'A';
  let currentTrack = 0;
  let volume = 0.5;
  let crossfading = false;
  let initialized = false;
  let playing = false;
  let pendingStart = false;
  let pendingTrack = 0;
  let desiredPlaying = false;
  let operationId = 0;
  let contextStateTarget = null;
  let contextStateListener = null;
  let fadeTimer = null;
  let crossfadeTimer = null;
  let crossfadeIncomingDeck = null;
  let crossfadeOutgoingDeck = null;
  let outputMuted = false;
  const deckTracks = { A: null, B: null };
  const deckPlayOperations = { A: 0, B: 0 };
  const visibilityPausedDecks = new Set();

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
    outputGain = ctx.createGain();

    // Connect graph: source -> normalized deck gain -> shared output gain.
    // The shared node applies persistent music/master volume and transient mute
    // without disturbing an in-progress A/B crossfade envelope.
    sourceA.connect(gainA);
    sourceB.connect(gainB);
    gainA.connect(outputGain);
    gainB.connect(outputGain);
    outputGain.connect(ctx.destination);

    // Start with zero gain
    gainA.gain.value = 0;
    gainB.gain.value = 0;

    // Load saved volume
    _loadVolume();
    _applyOutputGain();

    initialized = true;
    Logger.log('MusicManager initialized');
  }

  /**
   * Start playing music
   * @param {number} [trackIndex=0] - Index into tracks array
   */
  function start(trackIndex) {
    if (!initialized) return;
    const idx = trackIndex !== undefined ? trackIndex : currentTrack;
    if (!tracks[idx]) return;

    desiredPlaying = true;
    pendingTrack = idx;
    pendingStart = false;
    operationId += 1;
    const operation = operationId;

    _clearContextStateListener();
    _clearFadeTimer();
    _cancelCrossfadeTransition();
    visibilityPausedDecks.clear();

    // Check if AudioContext is ready
    if (!AudioContextManager.isReady()) {
      _queuePendingStart(idx, operation);
      return;
    }

    const activeEl = activeDeck === 'A' ? deckA : deckB;
    const activeGain = activeDeck === 'A' ? gainA : gainB;
    if (playing && currentTrack === idx && activeEl && !activeEl.paused) {
      _setGainImmediately(activeGain, 1);
      return;
    }

    playing = false;
    _playDeck(idx, operation);
  }

  /**
   * Resume pending start after AudioContext becomes available
   */
  function _resumePending(operation) {
    if (!pendingStart || !desiredPlaying || operation !== operationId) return;
    pendingStart = false;
    _clearContextStateListener();
    _playDeck(pendingTrack, operation);
  }

  function _queuePendingStart(trackIndex, operation) {
    if (!desiredPlaying || operation !== operationId) return;

    pendingStart = true;
    pendingTrack = trackIndex;
    _clearContextStateListener();

    const ctx = AudioContextManager.getContext();
    if (!ctx || typeof ctx.addEventListener !== 'function') return;

    contextStateTarget = ctx;
    contextStateListener = () => {
      if (ctx.state === 'running') _resumePending(operation);
    };
    ctx.addEventListener('statechange', contextStateListener);
  }

  function _clearContextStateListener() {
    if (contextStateTarget && contextStateListener &&
        typeof contextStateTarget.removeEventListener === 'function') {
      contextStateTarget.removeEventListener('statechange', contextStateListener);
    }
    contextStateTarget = null;
    contextStateListener = null;
  }

  function _clearTimer(timer) {
    if (timer !== null && typeof clearTimeout === 'function') clearTimeout(timer);
    return null;
  }

  function _clearFadeTimer() {
    fadeTimer = _clearTimer(fadeTimer);
  }

  function _setGainImmediately(gainNode, value) {
    if (!gainNode?.gain) return;
    const ctx = AudioContextManager.getContext();
    const now = ctx?.currentTime || 0;
    if (typeof gainNode.gain.cancelScheduledValues === 'function') {
      gainNode.gain.cancelScheduledValues(now);
    }
    if (typeof gainNode.gain.setValueAtTime === 'function') {
      gainNode.gain.setValueAtTime(value, now);
    }
    gainNode.gain.value = value;
  }

  function _pauseDeck(deckKey, reset = true) {
    const el = deckKey === 'A' ? deckA : deckB;
    const gain = deckKey === 'A' ? gainA : gainB;
    if (!el) return;

    if (el.src || !el.paused) el.pause();
    if (reset) {
      el.currentTime = 0;
      deckTracks[deckKey] = null;
    }
    _setGainImmediately(gain, 0);
  }

  function _cancelCrossfadeTransition() {
    crossfadeTimer = _clearTimer(crossfadeTimer);

    // Preserve whichever deck is currently authoritative and retire the
    // other participant, whether cancellation happened before or after the
    // crossfade promise resolved.
    [crossfadeIncomingDeck, crossfadeOutgoingDeck].forEach((deckKey) => {
      if (deckKey && deckKey !== activeDeck) _pauseDeck(deckKey);
    });

    crossfadeIncomingDeck = null;
    crossfadeOutgoingDeck = null;
    crossfading = false;
  }

  /**
   * Internal: start playing on the active deck
   */
  function _playDeck(trackIndex, operation) {
    if (!tracks[trackIndex] || !desiredPlaying || operation !== operationId) return;

    const deckKey = activeDeck;
    const el = activeDeck === 'A' ? deckA : deckB;
    const gain = activeDeck === 'A' ? gainA : gainB;

    if (deckTracks[deckKey] !== trackIndex) {
      el.src = BASE_PATH + tracks[trackIndex].file;
      deckTracks[deckKey] = trackIndex;
    }
    currentTrack = trackIndex;
    deckPlayOperations[deckKey] = operation;

    _setGainImmediately(gain, 1);

    const playResult = el.play();
    const playPromise = playResult && typeof playResult.then === 'function'
      ? playResult
      : Promise.resolve();
    playPromise.then(() => {
      if (operation !== operationId ||
          deckPlayOperations[deckKey] !== operation ||
          !desiredPlaying) {
        if (deckPlayOperations[deckKey] === operation && !desiredPlaying) {
          _pauseDeck(deckKey);
        }
        return;
      }
      playing = true;
      pendingStart = false;
      Logger.log('MusicManager: Now playing "' + tracks[trackIndex].name + '"');
    }).catch(err => {
      if (operation !== operationId || deckPlayOperations[deckKey] !== operation || !desiredPlaying) {
        return;
      }
      // Autoplay blocked - set pending
      if (err.name === 'NotAllowedError') {
        _queuePendingStart(trackIndex, operation);
      } else {
        console.error('MusicManager: Playback failed:', err);
      }
    });
  }

  /**
   * Stop music with fade out
   */
  function stop() {
    if (!initialized) return;

    desiredPlaying = false;
    pendingStart = false;
    playing = false;
    operationId += 1;
    const operation = operationId;

    _clearContextStateListener();
    _clearFadeTimer();
    _cancelCrossfadeTransition();
    visibilityPausedDecks.clear();

    const ctx = AudioContextManager.getContext();
    const liveDecks = [['A', deckA, gainA], ['B', deckB, gainB]]
      .filter(([, el]) => el && el.src && !el.paused);

    if (liveDecks.length > 0 && ctx && ctx.state === 'running') {
      const now = ctx.currentTime;
      liveDecks.forEach(([, , gain]) => {
        if (typeof gain.gain.cancelScheduledValues === 'function') {
          gain.gain.cancelScheduledValues(now);
        }
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_DURATION);
      });

      fadeTimer = setTimeout(() => {
        if (operation !== operationId || desiredPlaying) return;
        _pauseDeck('A');
        _pauseDeck('B');
        fadeTimer = null;
      }, FADE_OUT_DURATION * 1000);
    } else {
      _pauseDeck('A');
      _pauseDeck('B');
    }
  }

  /**
   * Pause the active deck (e.g. when tab is hidden)
   */
  function pause() {
    if (!initialized || !playing) return;

    [['A', deckA], ['B', deckB]].forEach(([deckKey, el]) => {
      if (el.src && !el.paused) {
        el.pause();
        visibilityPausedDecks.add(deckKey);
      }
    });
  }

  /**
   * Resume the active deck (e.g. when tab becomes visible)
   */
  function resume() {
    if (!initialized || !playing || !desiredPlaying) return;

    const operation = operationId;
    const decksToResume = [...visibilityPausedDecks];
    visibilityPausedDecks.clear();
    decksToResume.forEach((deckKey) => {
      const el = deckKey === 'A' ? deckA : deckB;
      if (!el.src || !el.paused) return;

      el.play().catch(() => {
        // Preserve the intent so a later visibility/context restoration can
        // retry only the deck that this manager paused.
        if (operation === operationId && desiredPlaying) {
          visibilityPausedDecks.add(deckKey);
        }
      });
    });
  }

  /**
   * Crossfade to a different track
   * @param {number} trackIndex - Index into tracks array
   */
  function crossfadeTo(trackIndex) {
    if (!initialized || crossfading || !tracks[trackIndex]) return;
    if (!playing) {
      start(trackIndex);
      return;
    }
    if (trackIndex === currentTrack && playing) return;

    desiredPlaying = true;
    pendingStart = false;
    operationId += 1;
    const operation = operationId;
    _clearContextStateListener();
    _clearFadeTimer();
    _cancelCrossfadeTransition();
    crossfading = true;

    const newDeckKey = activeDeck === 'A' ? 'B' : 'A';
    const oldDeckKey = activeDeck;
    const newEl = newDeckKey === 'A' ? deckA : deckB;
    const newGain = newDeckKey === 'A' ? gainA : gainB;
    const oldGain = activeDeck === 'A' ? gainA : gainB;

    // Prep new deck
    newEl.src = BASE_PATH + tracks[trackIndex].file;
    deckTracks[newDeckKey] = trackIndex;
    deckPlayOperations[newDeckKey] = operation;
    crossfadeIncomingDeck = newDeckKey;
    crossfadeOutgoingDeck = oldDeckKey;
    _setGainImmediately(newGain, 0);

    const playResult = newEl.play();
    const playPromise = playResult && typeof playResult.then === 'function'
      ? playResult
      : Promise.resolve();
    playPromise.then(() => {
      if (operation !== operationId ||
          deckPlayOperations[newDeckKey] !== operation ||
          !desiredPlaying) return;

      const ctx = AudioContextManager.getContext();
      if (!ctx) {
        _pauseDeck(newDeckKey);
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
      newGain.gain.linearRampToValueAtTime(1, now + dur);

      activeDeck = newDeckKey;
      currentTrack = trackIndex;
      playing = true;

      crossfadeTimer = setTimeout(() => {
        if (operation !== operationId || !desiredPlaying) return;
        _pauseDeck(oldDeckKey);
        crossfading = false;
        crossfadeIncomingDeck = null;
        crossfadeOutgoingDeck = null;
        crossfadeTimer = null;
      }, CROSSFADE_DURATION * 1000);
    }).catch(err => {
      if (operation !== operationId || deckPlayOperations[newDeckKey] !== operation) return;
      console.error('MusicManager: Crossfade failed:', err);
      crossfading = false;
      crossfadeIncomingDeck = null;
      crossfadeOutgoingDeck = null;
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
    const numericVolume = Number(v);
    if (!Number.isFinite(numericVolume)) return;

    volume = Math.max(0, Math.min(1, numericVolume));
    _saveVolume();
    _applyOutputGain();
  }

  /** Apply a transient global mute without changing the saved music volume. */
  function setMuted(muted) {
    outputMuted = !!muted;
    _applyOutputGain();
  }

  /**
   * Called when master volume changes - recalculate gain
   */
  function updateMasterVolume() {
    _applyOutputGain();
  }

  /** Apply music * master to the post-crossfade output bus. */
  function _applyOutputGain() {
    if (!initialized && !outputGain) return;
    if (!outputGain?.gain) return;

    outputGain.gain.value = outputMuted ? 0 : _getEffectiveVolume();
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
    setMuted,
    updateMasterVolume,
    isPlaying
  };
})();
