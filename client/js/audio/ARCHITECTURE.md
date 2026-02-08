# Audio System Architecture

Visual overview of the Galaxy Miner audio system internals.

For API reference, integration hooks, and usage examples, see [README.md](README.md).

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
