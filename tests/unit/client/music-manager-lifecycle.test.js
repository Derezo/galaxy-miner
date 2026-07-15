import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function loadMusicManager({ initiallyReady = true } = {}) {
  let ready = initiallyReady;
  const listeners = new Set();
  const audioElements = [];
  const gainNodes = [];

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
    state: initiallyReady ? 'running' : 'suspended',
    currentTime: 0,
    destination: {},
    addEventListener: vi.fn((event, listener) => {
      if (event === 'statechange') listeners.add(listener);
    }),
    removeEventListener: vi.fn((event, listener) => {
      if (event === 'statechange') listeners.delete(listener);
    }),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
    createGain: vi.fn(() => {
      const gain = {
        value: 0,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      };
      const node = { gain, connect: vi.fn() };
      gainNodes.push(node);
      return node;
    })
  };
  const browserContext = vm.createContext({
    console,
    Audio: FakeAudio,
    AudioContextManager: {
      getContext: vi.fn(() => context),
      isReady: vi.fn(() => ready)
    },
    AudioManager: { getVolume: vi.fn(() => 1) },
    localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
    Logger: { log: vi.fn() },
    setTimeout,
    clearTimeout
  });
  browserContext.globalThis = browserContext;
  const filename = path.join(root, 'client/js/audio/MusicManager.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), browserContext, { filename });
  const musicManager = vm.runInContext('MusicManager', browserContext);
  musicManager.init();

  return {
    musicManager,
    audioElements,
    gainNodes,
    context,
    setReady(value) {
      ready = value;
      context.state = value ? 'running' : 'suspended';
    },
    fireStateChange() {
      [...listeners].forEach(listener => listener());
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MusicManager playback intent lifecycle', () => {
  it('cancels a pending context start and removes its state listener on stop', async () => {
    const runtime = loadMusicManager({ initiallyReady: false });
    runtime.musicManager.start();
    expect(runtime.listenerCount()).toBe(1);

    runtime.musicManager.stop();
    expect(runtime.listenerCount()).toBe(0);

    runtime.setReady(true);
    runtime.fireStateChange();
    await Promise.resolve();

    expect(runtime.audioElements[0].play).not.toHaveBeenCalled();
    expect(runtime.musicManager.isPlaying()).toBe(false);
  });

  it('does not resurrect playback when an in-flight play resolves after stop', async () => {
    vi.useFakeTimers();
    const runtime = loadMusicManager();
    const pendingPlay = deferred();
    runtime.audioElements[0].play.mockImplementation(() => {
      runtime.audioElements[0].paused = false;
      return pendingPlay.promise;
    });

    runtime.musicManager.start();
    runtime.musicManager.stop();
    pendingPlay.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.musicManager.isPlaying()).toBe(false);
    expect(runtime.audioElements[0].pause).toHaveBeenCalled();
  });

  it('cancels an old fade-out when playback restarts', async () => {
    vi.useFakeTimers();
    const runtime = loadMusicManager();

    runtime.musicManager.start();
    await Promise.resolve();
    expect(runtime.musicManager.isPlaying()).toBe(true);

    runtime.musicManager.stop();
    expect(runtime.musicManager.isPlaying()).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    runtime.musicManager.start();
    await Promise.resolve();
    expect(runtime.musicManager.isPlaying()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(1500);
    expect(runtime.audioElements[0].pause).not.toHaveBeenCalled();
    expect(runtime.musicManager.isPlaying()).toBe(true);
    expect(runtime.gainNodes[0].gain.cancelScheduledValues).toHaveBeenCalled();
  });
});
