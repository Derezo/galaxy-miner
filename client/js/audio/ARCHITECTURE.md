# Audio System Architecture

Visual overview of the Galaxy Miner audio system.

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      GAME SYSTEMS                           │
│  (Network, Player, Entities, UI, Combat, Mining)            │
└──────────────────────┬──────────────────────────────────────┘
                       │ AudioManager.play()
                       │ AudioManager.playAt()
                       │ AudioManager.startLoop()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    AUDIO MANAGER                            │
│  - Volume control (master, sfx, ambient, ui)                │
│  - Priority management (culling low priority sounds)        │
│  - Variation selection (rotate through sound variants)      │
│  - Loop management (track active ambient loops)             │
│  - Persistence (save/load volumes to localStorage)          │
└─────┬───────────────────────────────────┬───────────────────┘
      │                                   │
      │ SoundConfig lookup                │ Spatial calculations
      ▼                                   ▼
┌──────────────────┐            ┌──────────────────────┐
│  SOUND CONFIG    │            │   SPATIAL AUDIO      │
│  - Sound IDs     │            │  - Distance falloff  │
│  - File paths    │            │  - Stereo panning    │
│  - Base volumes  │            │  - Range culling     │
│  - Priorities    │            │  - MAX_DISTANCE      │
│  - Categories    │            └──────────────────────┘
│  - Variations    │
└──────────────────┘
      │
      │ Filename
      ▼
┌─────────────────────────────────────────────────────────────┐
│                      SOUND POOL                             │
│  - Buffer cache (filename -> AudioBuffer)                   │
│  - Lazy loading (fetch on first play)                       │
│  - Source pooling (max 32 concurrent)                       │
│  - Active source tracking                                   │
│  - Automatic cleanup (on sound end)                         │
└─────┬───────────────────────────────────────────────────────┘
      │
      │ AudioBuffer
      ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUDIO CONTEXT                             │
│  - Web Audio API wrapper                                    │
│  - Context lifecycle (create, resume, suspend)              │
│  - User interaction detection                               │
│  - Browser compatibility (webkit prefix)                    │
└─────┬───────────────────────────────────────────────────────┘
      │
      │ Web Audio API
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  BROWSER AUDIO API                          │
│  - AudioContext                                             │
│  - AudioBufferSourceNode (playback)                         │
│  - GainNode (volume control)                                │
│  - StereoPannerNode (spatial positioning)                   │
│  - AudioDestination (speakers/headphones)                   │
└─────────────────────────────────────────────────────────────┘
```

## Audio Graph (Per Sound)

```
[AudioBufferSourceNode]
       │
       │ buffer data
       ▼
   [GainNode] ────────── volume (category * master * spatial)
       │
       │ processed signal
       ▼
[StereoPannerNode] ───── pan (-1 left, 0 center, 1 right)
       │
       │ spatialized signal
       ▼
[AudioDestination] ───── output to speakers
```

## Module Dependencies

```
AudioManager
    ├── depends on: AudioContextManager
    ├── depends on: SpatialAudio
    ├── depends on: SoundPool
    └── depends on: SoundConfig

SoundPool
    └── depends on: AudioContextManager

SpatialAudio
    └── (standalone, no dependencies)

AudioContextManager
    └── (standalone, no dependencies)

SoundConfig
    └── (data only, no dependencies)
```

## Data Flow: Playing a Sound

```
1. Game Event
   └─> AudioManager.playAt('death_pirate', 100, 200)

2. AudioManager Processing
   ├─> Lookup in SoundConfig
   │   └─> { file: 'destruction/death_pirate_medium.wav', baseVolume: 0.9, priority: 100 }
   │
   ├─> Calculate spatial audio
   │   └─> SpatialAudio.calculate(playerX, playerY, 100, 200, 0.9)
   │   └─> { volume: 0.45, pan: 0.3 }
   │
   ├─> Apply volume categories
   │   └─> finalVolume = 0.45 * sfx(1.0) * master(0.8) = 0.36
   │
   └─> Check priority & capacity
       └─> priority=100 (CRITICAL), activeCount=12, allow=true

3. SoundPool Playback
   ├─> Check buffer cache
   │   └─> Not cached, fetch and decode
   │
   ├─> Create audio graph
   │   ├─> BufferSourceNode (with buffer)
   │   ├─> GainNode (volume: 0.36)
   │   └─> StereoPannerNode (pan: 0.3)
   │
   └─> Connect & start
       └─> source.start()

4. Cleanup
   └─> On source.onended
       └─> Remove from active sources
```

## Volume Hierarchy

```
Final Volume = baseVolume * categoryVolume * masterVolume * spatialFalloff

Example:
  weapon_fire_3
    baseVolume: 0.75        (from SoundConfig)
    category: sfx           (from SoundConfig)
    categoryVolume: 1.0     (user setting)
    masterVolume: 0.8       (user setting)
    spatialFalloff: 1.0     (no position = full volume)
    ────────────────────────
    Final: 0.75 * 1.0 * 0.8 * 1.0 = 0.6

  death_pirate @ distance 500
    baseVolume: 0.9
    category: sfx
    categoryVolume: 1.0
    masterVolume: 0.8
    spatialFalloff: 0.5     (500/1000 distance = 50% volume)
    ────────────────────────
    Final: 0.9 * 1.0 * 0.8 * 0.5 = 0.36
```

## Priority System

```
Sound Queue (MAX_CONCURRENT = 32)

Priority Levels:
  CRITICAL (100) ─── Always plays (boss events, player death)
  HIGH (75)     ──── Usually plays (weapons, impacts)
  MEDIUM (50)   ───┬─ Plays if < 80% capacity
  LOW (25)      ───┴─ Plays if < 60% capacity
  MINIMAL (10)  ───── Rarely plays (background ambient)

When at capacity:
  1. Check incoming sound priority
  2. If priority >= CRITICAL, stop oldest LOW/MINIMAL sound
  3. If priority >= MEDIUM, check capacity
  4. If capacity > 80%, reject
  5. Otherwise, play sound
```

## Spatial Audio Ranges

```
Distance from Player:

  0 ──────────────────── 1000 units (MAX_DISTANCE)
  │                      │
  │                      └─ Volume: 0% (silent)
  │
  ├─ 250 units ─────────────── Volume: 75%
  ├─ 500 units ─────────────── Volume: 50%
  ├─ 750 units ─────────────── Volume: 25%
  │
  └─ 0 units ──────────────────Volume: 100%

Panning (angle from player):

         UP (90°)
          pan=0
            │
            │
  LEFT ────┼──── RIGHT
 (180°)    │    (0°)
  pan=-1   │    pan=1
            │
          DOWN
         (270°)
         pan=0
```

## Looping Sounds

```
Active Loops Map:
  'engine_3' ──> { source, config, options }
  'mining_drill_2' ──> { source, config, options }
  'star_proximity' ──> { source, config, options }

Management:
  startLoop('engine_3')
    ├─> Stop existing 'engine_3' if playing
    ├─> Play with loop=true
    └─> Store in activeLoops Map

  stopLoop('engine_3')
    ├─> Get from activeLoops Map
    ├─> source.stop()
    └─> Delete from Map

  updateLoopPosition('engine_3', x, y)
    ├─> Restart loop with new position
    └─> (Web Audio limitation: can't update position dynamically)
```

## File Organization

```
/client/js/audio/
│
├── AudioContext.js       ─── Web Audio API lifecycle
├── SpatialAudio.js       ─── Distance/pan calculations
├── SoundPool.js          ─── Buffer pooling & playback
├── AudioManager.js       ─── Central API & orchestration
│
├── config/
│   └── SoundConfig.js    ─── 80+ sound definitions
│
└── [docs]
    ├── README.md         ─── API reference
    ├── INTEGRATION.md    ─── Integration guide
    ├── QUICKSTART.md     ─── 5-minute setup
    └── ARCHITECTURE.md   ─── This file

/client/assets/audio/
│
├── weapons/              ─── Player & NPC weapon sounds
├── impacts/              ─── Shield & hull hit sounds
├── destruction/          ─── Explosion & death sounds
├── bosses/               ─── Boss-specific sounds
├── mining/               ─── Mining drill & completion
├── movement/             ─── Engine & boost sounds
├── environment/          ─── Ambient environmental sounds
├── ui/                   ─── Interface & notification sounds
└── README.md             ─── Asset specifications
```

## Performance Characteristics

```
Memory Usage:
  - Each AudioBuffer: ~100KB-500KB (varies by duration)
  - Cached buffers: Persist until clearCache()
  - Active sources: ~1KB each (up to 32)
  - Total typical: 5-20MB

CPU Usage:
  - Audio decoding: 1-5ms per file (async)
  - Spatial calculations: < 0.1ms per sound
  - Audio graph: Handled by browser's audio thread
  - Minimal impact on game loop

Network:
  - Lazy loading: Only fetch when first played
  - Browser caching: Standard HTTP cache applies
  - Typical sound: 50-200KB
  - All sounds: ~10-30MB total

Concurrency:
  - Max 32 simultaneous sounds
  - Priority culling prevents overload
  - Spatial culling (1000 unit range)
  - Automatic cleanup on sound end
```

## Browser Compatibility

```
Supported:
  ✓ Chrome 35+ (full support)
  ✓ Firefox 25+ (full support)
  ✓ Safari 14.1+ (requires user interaction)
  ✓ Edge 79+ (full support)
  ✓ Opera 22+ (full support)

Limitations:
  ⚠ Safari/iOS: Requires user interaction before audio plays
    → Auto-handled by AudioContextManager
  ⚠ Mobile browsers: May limit concurrent sounds
    → Priority system handles gracefully
  ⚠ Some browsers: May suspend audio on tab switch
    → Auto-resumes on tab focus

Fallback:
  ✗ No fallback for browsers without Web Audio API
  ✗ Game will function but without sound
  → Check AudioContextManager.isReady() for audio availability
```

## Extension Points

Future enhancements can be added at these points:

1. **Music System**
   - Add MusicManager module
   - Implement crossfading between tracks
   - Dynamic music based on game state

2. **Advanced Spatial Audio**
   - Replace StereoPannerNode with PannerNode (3D positioning)
   - Add reverb for environmental zones
   - Implement Doppler effect for fast-moving objects

3. **Audio Effects**
   - Add ConvolverNode for reverb/echo
   - Add BiquadFilterNode for filters
   - Implement dynamic audio ducking

4. **Adaptive Audio**
   - Adjust volumes based on action intensity
   - Layer sounds dynamically (combat layers)
   - Procedural audio generation

5. **Voice Chat**
   - Integrate getUserMedia for microphone
   - Add positional voice chat
   - Implement push-to-talk
```
