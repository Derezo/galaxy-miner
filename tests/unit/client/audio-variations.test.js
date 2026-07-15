import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../../..');
const AUDIO_ROOT = path.join(PROJECT_ROOT, 'client/assets/audio');
const require = createRequire(import.meta.url);

function createBrowserContext(soundConfig, soundPoolOverrides = {}, math = Math) {
  const soundPool = {
    playSound: vi.fn(() => Promise.resolve({ id: 'source' })),
    getActiveCount: vi.fn(() => 0),
    getStats: vi.fn(() => ({})),
    stopSound: vi.fn(),
    stopAll: vi.fn(),
    clearCache: vi.fn(),
    preloadSounds: vi.fn(() => Promise.resolve()),
    ...soundPoolOverrides
  };
  const context = vm.createContext({
    console,
    Date,
    Math: math,
    Map,
    Set,
    Promise,
    Number,
    JSON,
    Array,
    SoundConfig: soundConfig,
    SoundPool: soundPool,
    AudioContextManager: {
      init: vi.fn(() => true),
      isReady: vi.fn(() => true),
      resume: vi.fn(),
      getState: vi.fn(() => 'running')
    },
    SpatialAudio: { calculate: vi.fn() },
    localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
    document: {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    Logger: { log: vi.fn() }
  });
  context.globalThis = context;

  const filename = path.join(PROJECT_ROOT, 'client/js/audio/AudioManager.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return {
    audioManager: vm.runInContext('AudioManager', context),
    soundPool
  };
}

const testVariationConfig = {
  weapon: {
    file: 'weapons/weapon_fallback.mp3',
    variationPattern: 'weapons/weapon_{index}.wav',
    variations: 3,
    baseVolume: 1,
    priority: 75,
    category: 'sfx'
  }
};

describe('audio variation resolution', () => {
  it('never immediately repeats a selected variation', async () => {
    const deterministicMath = Object.create(Math);
    deterministicMath.random = vi.fn(() => 0);
    const { audioManager, soundPool } = createBrowserContext(
      testVariationConfig,
      {},
      deterministicMath
    );
    audioManager.init();

    await audioManager.play('weapon');
    await audioManager.play('weapon');

    expect(soundPool.playSound.mock.calls.map(([filename]) => filename)).toEqual([
      'weapons/weapon_01.wav',
      'weapons/weapon_02.wav'
    ]);
  });

  it('retries the configured MP3 fallback when a variant fails', async () => {
    const deterministicMath = Object.create(Math);
    deterministicMath.random = vi.fn(() => 0);
    const playSound = vi.fn()
      .mockRejectedValueOnce(new Error('variant unavailable'))
      .mockResolvedValueOnce({ id: 'fallback-source' });
    const { audioManager } = createBrowserContext(
      testVariationConfig,
      { playSound },
      deterministicMath
    );
    audioManager.init();

    await expect(audioManager.play('weapon')).resolves.toEqual({ id: 'fallback-source' });
    expect(playSound.mock.calls.map(([filename]) => filename)).toEqual([
      'weapons/weapon_01.wav',
      'weapons/weapon_fallback.mp3'
    ]);
  });

  it('preloads every variation and fallback while deduplicating aliases', () => {
    const shared = testVariationConfig.weapon;
    const configs = {
      weapon: shared,
      weapon_alias: shared,
      ui_click: {
        file: 'ui/click.mp3',
        baseVolume: 1,
        priority: 50,
        category: 'ui'
      }
    };
    const { audioManager, soundPool } = createBrowserContext(configs);

    audioManager.preload(['weapon', 'weapon_alias', 'ui_click', 'unknown']);

    expect(soundPool.preloadSounds).toHaveBeenCalledWith([
      'weapons/weapon_01.wav',
      'weapons/weapon_02.wav',
      'weapons/weapon_03.wav',
      'weapons/weapon_fallback.mp3',
      'ui/click.mp3'
    ]);
  });

  it('falls back safely when variation metadata is incomplete', () => {
    const configs = {
      malformed: {
        file: 'ui/fallback.mp3',
        variations: 3,
        baseVolume: 1,
        priority: 50,
        category: 'ui'
      }
    };
    const { audioManager } = createBrowserContext(configs);

    expect(audioManager.getSoundFilenames('malformed')).toEqual(['ui/fallback.mp3']);
  });
});

describe('configured audio assets', () => {
  it('resolves every configured fallback and variant to an existing file', () => {
    const configPath = path.join(PROJECT_ROOT, 'client/js/audio/config/SoundConfig.js');
    delete require.cache[configPath];
    const soundConfig = require(configPath);
    const { audioManager } = createBrowserContext(soundConfig);
    const missing = [];

    for (const [soundId, config] of Object.entries(soundConfig)) {
      const filenames = audioManager.getSoundFilenames(soundId);
      expect(filenames).toContain(config.file);
      expect(filenames.length).toBeGreaterThan(0);

      for (const filename of filenames) {
        if (!fs.existsSync(path.join(AUDIO_ROOT, filename))) {
          missing.push(`${soundId}: ${filename}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('enables complete player, faction, and impact variation families', () => {
    const configPath = path.join(PROJECT_ROOT, 'client/js/audio/config/SoundConfig.js');
    delete require.cache[configPath];
    const soundConfig = require(configPath);
    const expectedIds = [
      ...Array.from({ length: 5 }, (_, index) => `weapon_fire_${index + 1}`),
      'npc_weapon_pirate',
      'npc_weapon_scavenger',
      'npc_weapon_swarm',
      'npc_weapon_void',
      'npc_weapon_rogue',
      'npc_weapon_rogue_miner',
      ...Array.from({ length: 5 }, (_, index) => `hit_shield_${index + 1}`),
      ...Array.from({ length: 5 }, (_, index) => `hit_hull_${index + 1}`)
    ];

    for (const soundId of expectedIds) {
      expect(soundConfig[soundId].variations).toBeGreaterThan(1);
      expect(soundConfig[soundId].variationPattern).toContain('{index}');
    }
  });
});
