import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');

function loadAudioManager({
  playSound,
  soundConfig,
  audioContextManager,
  musicManager,
  soundPoolOverrides
} = {}) {
  let visibilityHandler;
  const document = {
    hidden: false,
    addEventListener: vi.fn((event, handler) => {
      if (event === 'visibilitychange') visibilityHandler = handler;
    }),
    removeEventListener: vi.fn()
  };
  let sourceIndex = 0;
  const soundPool = {
    playSound: playSound || vi.fn(() => Promise.resolve({ id: `source-${++sourceIndex}` })),
    getActiveCount: vi.fn(() => 0),
    getStats: vi.fn(() => ({})),
    stopSound: vi.fn(),
    setSourceVolume: vi.fn(() => true),
    stopAll: vi.fn(),
    clearCache: vi.fn(),
    preloadSounds: vi.fn(() => Promise.resolve()),
    ...soundPoolOverrides
  };
  const globals = {
    console,
    Date,
    Math,
    Map,
    Set,
    Promise,
    Number,
    JSON,
    Array,
    Object,
    SoundConfig: soundConfig || {
      engine_loop: {
        file: 'movement/engine.mp3',
        baseVolume: 0.5,
        priority: 50,
        category: 'sfx',
        loop: true
      },
      ambient_loop: {
        file: 'environment/ambient.mp3',
        baseVolume: 0.4,
        priority: 25,
        category: 'ambient',
        loop: true
      },
      mining_loop: {
        file: 'mining/drill.mp3',
        baseVolume: 0.6,
        priority: 50,
        category: 'sfx',
        loop: true
      }
    },
    SoundPool: soundPool,
    AudioContextManager: audioContextManager || {
      init: vi.fn(() => true),
      isReady: vi.fn(() => true),
      resume: vi.fn(),
      getState: vi.fn(() => 'running')
    },
    SpatialAudio: { calculate: vi.fn() },
    localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
    document,
    Logger: { log: vi.fn() }
  };
  if (musicManager) globals.MusicManager = musicManager;

  const context = vm.createContext(globals);
  context.globalThis = context;

  const filename = path.join(PROJECT_ROOT, 'client/js/audio/AudioManager.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const audioManager = vm.runInContext('AudioManager', context);
  audioManager.init();

  return {
    audioManager,
    document,
    soundPool,
    fireVisibilityChange() {
      visibilityHandler();
    }
  };
}

describe('audio loop runtime state', () => {
  it('updates live loop gain for category, master, mute, and unmute changes', async () => {
    const { audioManager, soundPool } = loadAudioManager();
    const source = await audioManager.startLoop('engine_loop', { volume: 0.5 });

    // Initial: base .5 * sfx 1 * master .8 * override .5 = .2.
    expect(soundPool.playSound.mock.calls[0][1].volume).toBeCloseTo(0.2, 10);
    soundPool.setSourceVolume.mockClear();

    audioManager.setVolume('sfx', 0.25);
    expect(soundPool.setSourceVolume).toHaveBeenLastCalledWith(source, 0.05);

    audioManager.setVolume('master', 0.5);
    expect(soundPool.setSourceVolume).toHaveBeenLastCalledWith(source, 0.03125);

    audioManager.mute();
    expect(soundPool.setSourceVolume).toHaveBeenLastCalledWith(source, 0);
    expect(audioManager.getVolume('master')).toBe(0.5);
    expect(audioManager.getVolume('sfx')).toBe(0.25);

    audioManager.unmute();
    expect(soundPool.setSourceVolume).toHaveBeenLastCalledWith(source, 0.03125);
    expect(audioManager.getStats().activeLoops).toBe(1);
  });

  it('restores only still-intended loops after a hidden interval', async () => {
    const harness = loadAudioManager();
    const { audioManager, document, soundPool, fireVisibilityChange } = harness;
    await audioManager.startLoop('engine_loop');
    await audioManager.startLoop('ambient_loop');

    document.hidden = true;
    fireVisibilityChange();
    expect(audioManager.getStats()).toMatchObject({
      activeLoops: 0,
      intendedLoops: 2,
      visibilitySuspended: true
    });

    // Remove one old intent, update the other while hidden, and add a new one.
    audioManager.stopLoop('engine_loop');
    await audioManager.updateLoopPosition('ambient_loop', 100, 200);
    await audioManager.startLoop('mining_loop');
    expect(soundPool.playSound).toHaveBeenCalledTimes(2);

    document.hidden = false;
    fireVisibilityChange();

    await vi.waitFor(() => {
      expect(audioManager.getStats().activeLoops).toBe(2);
    });
    expect(soundPool.playSound.mock.calls.slice(2).map(([filename]) => filename))
      .toEqual(['environment/ambient.mp3', 'mining/drill.mp3']);
    expect(audioManager.getStats()).toMatchObject({
      intendedLoops: 2,
      visibilitySuspended: false
    });
  });

  it('invalidates a pending hidden source before launching its restored version', async () => {
    const pending = [];
    const playSound = vi.fn(() => new Promise(resolve => pending.push(resolve)));
    const { audioManager, document, soundPool, fireVisibilityChange } = loadAudioManager({
      playSound
    });

    const initialRequest = audioManager.startLoop('engine_loop');
    document.hidden = true;
    fireVisibilityChange();
    document.hidden = false;
    fireVisibilityChange();
    expect(playSound).toHaveBeenCalledTimes(2);

    const staleSource = { id: 'stale-hidden-source' };
    pending[0](staleSource);
    await expect(initialRequest).resolves.toBeNull();
    expect(soundPool.stopSound).toHaveBeenCalledWith(staleSource);

    pending[1]({ id: 'restored-source' });
    await vi.waitFor(() => {
      expect(audioManager.getStats().activeLoops).toBe(1);
    });
  });

  it('waits for the raw AudioContext to run before restoring visible loops', async () => {
    let stateChangeHandler;
    let finishResume;
    const resumeGate = new Promise(resolve => { finishResume = resolve; });
    const rawContext = {
      state: 'running',
      addEventListener: vi.fn((event, handler) => {
        if (event === 'statechange') stateChangeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      resume: vi.fn(async () => {
        await resumeGate;
        rawContext.state = 'running';
        stateChangeHandler();
      })
    };
    const contextManager = {
      init: vi.fn(() => true),
      isReady: vi.fn(() => true),
      resume: vi.fn(),
      getState: vi.fn(() => rawContext.state),
      getContext: vi.fn(() => rawContext)
    };
    const { audioManager, document, soundPool, fireVisibilityChange } = loadAudioManager({
      audioContextManager: contextManager
    });
    await audioManager.startLoop('engine_loop');

    rawContext.state = 'suspended';
    document.hidden = true;
    fireVisibilityChange();
    document.hidden = false;
    fireVisibilityChange();

    expect(rawContext.resume).toHaveBeenCalledOnce();
    expect(soundPool.playSound).toHaveBeenCalledTimes(1);
    expect(audioManager.getStats().activeLoops).toBe(0);

    finishResume();
    await vi.waitFor(() => {
      expect(soundPool.playSound).toHaveBeenCalledTimes(2);
      expect(audioManager.getStats().activeLoops).toBe(1);
    });

    audioManager.cleanup();
    expect(rawContext.removeEventListener)
      .toHaveBeenCalledWith('statechange', stateChangeHandler);
  });

  it('keeps cleanup and re-init generations distinct while loads are pending', async () => {
    const pending = [];
    const playSound = vi.fn(() => new Promise(resolve => pending.push(resolve)));
    const { audioManager, soundPool } = loadAudioManager({ playSound });

    const oldRequest = audioManager.startLoop('engine_loop');
    audioManager.cleanup();
    expect(audioManager.init()).toBe(true);
    const newRequest = audioManager.startLoop('engine_loop');

    const oldSource = { id: 'old-lifecycle' };
    pending[0](oldSource);
    await expect(oldRequest).resolves.toBeNull();
    expect(soundPool.stopSound).toHaveBeenCalledWith(oldSource);
    expect(audioManager.getStats().activeLoops).toBe(0);

    pending[1]({ id: 'new-lifecycle' });
    await expect(newRequest).resolves.toMatchObject({ id: 'new-lifecycle' });
    expect(audioManager.getStats()).toMatchObject({
      activeLoops: 1,
      intendedLoops: 1
    });
  });

  it('does not create intents for unknown sounds or resurrect a muted stopped loop', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { audioManager, soundPool } = loadAudioManager();

    await expect(audioManager.startLoop('not_configured')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('Unknown sound ID:', 'not_configured');
    expect(audioManager.getStats().intendedLoops).toBe(0);

    audioManager.mute();
    await expect(audioManager.startLoop('engine_loop')).resolves.toBeNull();
    expect(audioManager.getStats().intendedLoops).toBe(1);
    audioManager.stopLoop('engine_loop');
    audioManager.unmute();

    await Promise.resolve();
    expect(soundPool.playSound).not.toHaveBeenCalled();
    expect(audioManager.getStats().intendedLoops).toBe(0);
    warn.mockRestore();
  });

  it('reconciles an evicted managed loop and ignores termination from a replacement', async () => {
    const callbacks = [];
    const sources = [{ id: 'first' }, { id: 'second' }, { id: 'third' }];
    const activeSources = new Set();
    const playSound = vi.fn((_filename, options) => {
      const source = sources[callbacks.length];
      callbacks.push(options.onEnded);
      activeSources.add(source);
      return Promise.resolve(source);
    });
    const { audioManager } = loadAudioManager({
      playSound,
      soundPoolOverrides: {
        isSourceActive: vi.fn(source => activeSources.has(source))
      }
    });

    await audioManager.startLoop('engine_loop');
    activeSources.delete(sources[0]);
    callbacks[0](sources[0], 'evicted');

    await vi.waitFor(() => expect(playSound).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(audioManager.getStats().activeLoops).toBe(1));

    // A delayed duplicate callback from the evicted source cannot clear the
    // reconciled replacement.
    callbacks[0](sources[0], 'ended');
    await Promise.resolve();
    expect(playSound).toHaveBeenCalledTimes(2);
    expect(audioManager.getStats()).toMatchObject({
      activeLoops: 1,
      intendedLoops: 1
    });
  });

  it('never installs a source evicted before its async continuation runs', async () => {
    const pending = [];
    const activeSources = new Set();
    const playSound = vi.fn((_filename, options) => new Promise(resolve => {
      pending.push({ resolve, onEnded: options.onEnded });
    }));
    const { audioManager } = loadAudioManager({
      playSound,
      soundPoolOverrides: {
        isSourceActive: vi.fn(source => activeSources.has(source))
      }
    });

    const firstRequest = audioManager.startLoop('engine_loop');
    const evictedSource = { id: 'evicted-before-install' };
    pending[0].resolve(evictedSource);
    await expect(firstRequest).resolves.toBeNull();

    await vi.waitFor(() => expect(playSound).toHaveBeenCalledTimes(2));
    expect(audioManager.getStats()).toMatchObject({
      activeLoops: 0,
      intendedLoops: 1
    });

    const replacement = { id: 'replacement' };
    activeSources.add(replacement);
    pending[1].resolve(replacement);
    await vi.waitFor(() => expect(audioManager.getStats().activeLoops).toBe(1));
  });

  it('uses MusicManager transient mute without persisting a zero music volume', () => {
    const musicManager = {
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      updateMasterVolume: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn()
    };
    const { audioManager } = loadAudioManager({ musicManager });

    audioManager.mute();
    expect(musicManager.setMuted).toHaveBeenCalledWith(true);
    expect(musicManager.setVolume).not.toHaveBeenCalledWith(0);

    audioManager.setVolume('music', 0.7);
    expect(musicManager.setVolume).toHaveBeenLastCalledWith(0.7);
    audioManager.unmute();
    expect(musicManager.setMuted).toHaveBeenLastCalledWith(false);
    expect(audioManager.getVolume('music')).toBe(0.7);
  });
});

describe('SoundPool live gain control', () => {
  it('updates the GainNode for an active source without restarting it', async () => {
    const gain = {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn()
    };
    const source = {
      playbackRate: { value: 1 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    const context = {
      currentTime: 12,
      destination: {},
      createBufferSource: vi.fn(() => source),
      createGain: vi.fn(() => ({ gain, connect: vi.fn() })),
      createStereoPanner: vi.fn(() => ({ pan: { value: 0 }, connect: vi.fn() })),
      decodeAudioData: vi.fn(() => Promise.resolve({ id: 'buffer' }))
    };
    const browserContext = vm.createContext({
      console,
      Map,
      Promise,
      Number,
      AudioContextManager: {
        getContext: vi.fn(() => context),
        isReady: vi.fn(() => true)
      },
      fetch: vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })),
      Logger: { log: vi.fn() }
    });
    browserContext.globalThis = browserContext;
    const filename = path.join(PROJECT_ROOT, 'client/js/audio/SoundPool.js');
    vm.runInContext(fs.readFileSync(filename, 'utf8'), browserContext, { filename });
    const soundPool = vm.runInContext('SoundPool', browserContext);

    const playingSource = await soundPool.playSound('movement/engine.mp3', { volume: 0.4 });
    expect(playingSource).toBe(source);
    expect(gain.value).toBe(0.4);

    expect(soundPool.setSourceVolume(source, 0.2)).toBe(true);
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(12);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.2, 12);
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(soundPool.setSourceVolume({ id: 'unknown' }, 0.5)).toBe(false);
  });

  it('enforces capacity after concurrent loads and preserves older loops', async () => {
    let releaseDecode;
    const decodeGate = new Promise(resolve => { releaseDecode = resolve; });
    const createdSources = [];
    const context = {
      currentTime: 4,
      destination: {},
      createBufferSource: vi.fn(() => {
        const source = {
          loop: false,
          playbackRate: { value: 1 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(() => source.onended?.())
        };
        createdSources.push(source);
        return source;
      }),
      createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() })),
      createStereoPanner: vi.fn(() => ({ pan: { value: 0 }, connect: vi.fn() })),
      decodeAudioData: vi.fn(() => decodeGate)
    };
    const callbacks = Array.from({ length: 40 }, () => vi.fn());
    const browserContext = vm.createContext({
      console,
      Map,
      Promise,
      Number,
      AudioContextManager: {
        getContext: vi.fn(() => context),
        isReady: vi.fn(() => true)
      },
      fetch: vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })),
      Logger: { log: vi.fn() }
    });
    browserContext.globalThis = browserContext;
    const filename = path.join(PROJECT_ROOT, 'client/js/audio/SoundPool.js');
    vm.runInContext(fs.readFileSync(filename, 'utf8'), browserContext, { filename });
    const soundPool = vm.runInContext('SoundPool', browserContext);

    const plays = callbacks.map((onEnded, index) => soundPool.playSound('burst.mp3', {
      loop: index === 0,
      onEnded
    }));
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    releaseDecode({ id: 'shared-buffer' });
    const sources = await Promise.all(plays);

    expect(soundPool.getActiveCount()).toBe(32);
    expect(callbacks[0]).not.toHaveBeenCalled();
    expect(soundPool.isSourceActive(sources[0])).toBe(true);
    for (let index = 1; index <= 8; index += 1) {
      expect(callbacks[index]).toHaveBeenCalledOnce();
      expect(callbacks[index]).toHaveBeenCalledWith(sources[index], 'evicted');
      expect(soundPool.isSourceActive(sources[index])).toBe(false);
    }
    expect(callbacks.slice(9).every(callback => callback.mock.calls.length === 0)).toBe(true);

    soundPool.stopSound(sources[0]);
    expect(callbacks[0]).toHaveBeenCalledOnce();
    expect(callbacks[0]).toHaveBeenCalledWith(sources[0], 'stopped');
    soundPool.stopAll();
    expect(callbacks[39]).toHaveBeenCalledOnce();
    expect(callbacks[39]).toHaveBeenCalledWith(sources[39], 'stop-all');
    expect(soundPool.getActiveCount()).toBe(0);
  });
});

describe('MusicManager output bus', () => {
  it('mutes transiently and resumes only decks paused for visibility', async () => {
    const gainNodes = [];
    const audioElements = [];
    class FakeAudio {
      constructor() {
        this.src = '';
        this.paused = true;
        this.currentTime = 0;
        this.play = vi.fn(() => {
          this.paused = false;
          return Promise.resolve();
        });
        this.pause = vi.fn(() => { this.paused = true; });
        audioElements.push(this);
      }
    }
    const context = {
      destination: {},
      currentTime: 0,
      createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
      createGain: vi.fn(() => {
        const node = {
          gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn()
          },
          connect: vi.fn()
        };
        gainNodes.push(node);
        return node;
      })
    };
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    };
    const browserContext = vm.createContext({
      console,
      Audio: FakeAudio,
      AudioContextManager: {
        getContext: vi.fn(() => context),
        isReady: vi.fn(() => true)
      },
      AudioManager: { getVolume: vi.fn(() => 0.8) },
      localStorage,
      Logger: { log: vi.fn() },
      setTimeout: vi.fn()
    });
    browserContext.globalThis = browserContext;
    const filename = path.join(PROJECT_ROOT, 'client/js/audio/MusicManager.js');
    vm.runInContext(fs.readFileSync(filename, 'utf8'), browserContext, { filename });
    const musicManager = vm.runInContext('MusicManager', browserContext);

    musicManager.init();
    const outputGain = gainNodes[2];
    expect(outputGain.gain.value).toBeCloseTo(0.4, 10);

    musicManager.setVolume(0.7);
    expect(localStorage.setItem)
      .toHaveBeenLastCalledWith('galaxy-miner-music-volume', '0.7');
    expect(outputGain.gain.value).toBeCloseTo(0.56, 10);

    localStorage.setItem.mockClear();
    musicManager.setMuted(true);
    expect(outputGain.gain.value).toBe(0);
    expect(localStorage.setItem).not.toHaveBeenCalled();

    musicManager.setVolume(0.3);
    expect(localStorage.setItem)
      .toHaveBeenLastCalledWith('galaxy-miner-music-volume', '0.3');
    expect(outputGain.gain.value).toBe(0);

    musicManager.setMuted(false);
    expect(outputGain.gain.value).toBeCloseTo(0.24, 10);

    musicManager.start();
    await Promise.resolve();
    expect(musicManager.isPlaying()).toBe(true);
    musicManager.pause();
    musicManager.pause();
    expect(audioElements[0].pause).toHaveBeenCalledOnce();
    expect(audioElements[1].pause).not.toHaveBeenCalled();
    musicManager.resume();
    expect(audioElements[0].play).toHaveBeenCalledTimes(2);
    expect(audioElements[1].play).not.toHaveBeenCalled();
  });
});
