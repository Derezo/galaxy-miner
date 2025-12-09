# Audio System

Client-side audio engine for Galaxy Miner using Web Audio API.

## Architecture

The audio system is composed of modular components following the game's IIFE singleton pattern:

```
audio/
├── AudioContext.js       - Web Audio API context lifecycle management
├── SpatialAudio.js       - Distance-based volume/pan calculations
├── SoundPool.js          - Audio buffer pooling and playback
├── AudioManager.js       - Central API and volume control
└── config/
    └── SoundConfig.js    - Sound definitions and properties
```

## Initialization

Initialize the audio system in `/client/js/main.js` after other core systems:

```javascript
// In GalaxyMiner.init()
AudioManager.init();
```

The AudioContext will be created but suspended until user interaction (browser requirement). The system automatically resumes on the first click/keypress.

## Basic Usage

### Play a One-Shot Sound

```javascript
// Simple playback
AudioManager.play('ui_click');

// With options
AudioManager.play('weapon_fire_3', {
  volume: 0.8,    // Override volume (0-1)
  pitch: 1.2      // Pitch shift (0.5-2.0)
});
```

### Play Spatial Audio

```javascript
// Play at world position (automatically calculates distance/pan)
AudioManager.playAt('death_pirate', npc.x, npc.y);

// With player position
AudioManager.playAt('mining_complete', asteroid.x, asteroid.y);
```

### Looping Sounds

```javascript
// Start a loop
AudioManager.startLoop('engine_3');

// Stop the loop
AudioManager.stopLoop('engine_3');

// Update position for moving loops (e.g., other players' engines)
AudioManager.updateLoopPosition('engine_other_player', player.x, player.y);
```

## Volume Control

Four independent volume categories: `master`, `sfx`, `ambient`, `ui`

```javascript
// Set volume (0-1)
AudioManager.setVolume('master', 0.8);
AudioManager.setVolume('sfx', 1.0);
AudioManager.setVolume('ambient', 0.6);

// Get volume
const volume = AudioManager.getVolume('sfx');

// Mute/unmute
AudioManager.mute();
AudioManager.unmute();
AudioManager.toggleMute();
```

Volumes are automatically persisted to `localStorage`.

## Sound Configuration

All sounds are defined in `/client/js/audio/config/SoundConfig.js`:

```javascript
const SoundConfig = {
  'weapon_fire_3': {
    file: 'weapons/weapon_player_t3_01.wav',  // Relative to /assets/audio/
    baseVolume: 0.75,                          // Base volume (0-1)
    priority: 75,                              // Priority (0-100)
    category: 'sfx',                           // Volume category
    variations: 3                              // Number of variations
  }
};
```

### Sound Properties

- **file**: Path relative to `/assets/audio/`
- **baseVolume**: Base volume before category/master volume applied
- **priority**: Playback priority (100 = critical, 75 = high, 50 = medium, 25 = low)
- **category**: Volume category (`sfx`, `ambient`, `ui`)
- **variations**: Number of sound variations (system auto-selects to avoid repetition)
- **loop**: Whether sound should loop (for ambient sounds)

## Spatial Audio

Distance-based falloff and stereo panning:

- **Range**: 0-1000 units (matches base radar range)
- **Falloff**: Linear volume reduction from full at 0 to silent at 1000
- **Panning**: Stereo positioning based on relative angle (-1 left, 0 center, 1 right)
- **Culling**: Sounds beyond range won't play (volume = 0)

## Priority System

Prevents audio overload with intelligent sound culling:

- **MAX_CONCURRENT**: 32 simultaneous sounds
- **CRITICAL (100)**: Always plays (boss events, player death, base destruction)
- **HIGH (75)**: Usually plays (weapon fire, impacts, upgrades)
- **MEDIUM (50)**: Plays when < 80% capacity (loot pickup, notifications)
- **LOW (25)**: Plays when < 60% capacity (engine loops, drilling)

When at capacity, lowest priority sounds are culled first.

## Variations

Sounds with `variations > 1` have multiple audio files that rotate:

```
weapons/weapon_player_t3_01.wav  (base file in config)
weapons/weapon_player_t3_02.wav  (variation 1)
weapons/weapon_player_t3_03.wav  (variation 2)
```

The system automatically prevents consecutive identical variations.

## Integration Examples

### Weapon Fire (Client Prediction)

```javascript
// In Input.js or network event handler
function onWeaponFire() {
  const weaponTier = Player.ship.weaponTier;
  AudioManager.play(`weapon_fire_${weaponTier}`);
}
```

### Combat Hit Effects

```javascript
// In Network.js 'combat:hit' handler
socket.on('combat:hit', (data) => {
  if (data.playerId === Player.id) {
    const tier = Player.ship.shieldTier;
    const soundId = data.hitShield ? `hit_shield_${tier}` : `hit_hull_${tier}`;
    AudioManager.play(soundId);
  }
});
```

### NPC Death

```javascript
// In Network.js 'npc:death' handler
socket.on('npc:death', (data) => {
  const faction = data.faction.toLowerCase();
  AudioManager.playAt(`death_${faction}`, data.x, data.y);
});
```

### Mining

```javascript
// Start drilling
function startMining() {
  const tier = Player.ship.miningTier;
  AudioManager.startLoop(`mining_drill_${tier}`);
}

// Complete mining
function completeMining(resource) {
  AudioManager.stopLoop(`mining_drill_${Player.ship.miningTier}`);

  const soundId = resource.rarity >= 3 ? 'mining_rare' : 'mining_complete';
  AudioManager.play(soundId);
}
```

### Engine Sounds

```javascript
// In Player.js update()
function updateEngineSound() {
  const isMoving = Player.velocity.x !== 0 || Player.velocity.y !== 0;
  const tier = Player.ship.engineTier;
  const soundId = `engine_${tier}`;

  if (isMoving && !AudioManager.isLoopActive(soundId)) {
    AudioManager.startLoop(soundId);
  } else if (!isMoving) {
    AudioManager.stopLoop(soundId);
  }
}
```

### UI Sounds

```javascript
// In UI event handlers
button.addEventListener('click', () => {
  AudioManager.play('ui_click');
  // ... handle click
});

// In NotificationManager
function showNotification(type, message) {
  AudioManager.play(`notification_${type}`); // success, error, warning, info
  // ... show notification
}
```

## Asset Organization

Audio files should be organized in `/client/assets/audio/`:

```
assets/audio/
├── weapons/
│   ├── weapon_player_t1_01.wav
│   ├── weapon_player_t1_02.wav
│   ├── weapon_player_t1_03.wav
│   └── ...
├── impacts/
│   ├── hit_shield_t1_01.wav
│   └── ...
├── destruction/
│   ├── death_player.wav
│   ├── death_pirate_medium.wav
│   └── ...
├── bosses/
│   ├── queen_phase_1.wav
│   └── ...
├── mining/
│   ├── drill_t1.wav
│   └── ...
├── movement/
│   ├── engine_t1.wav
│   ├── boost_activate.wav
│   └── ...
├── environment/
│   ├── star_proximity.wav
│   ├── wormhole_enter.wav
│   └── ...
└── ui/
    ├── click.wav
    ├── notification_success.wav
    └── ...
```

## Performance Considerations

- **Lazy Loading**: Sounds load on first play, then cached
- **Buffer Pooling**: Single `AudioBuffer` shared across all instances
- **Source Pooling**: Max 32 concurrent `AudioBufferSourceNode`s
- **Spatial Culling**: Sounds beyond 1000 units don't play
- **Priority Culling**: Low priority sounds dropped when near capacity
- **Variation System**: Prevents repetitive sound patterns
- **Automatic Cleanup**: Stopped sounds auto-release resources

## Browser Compatibility

- **Modern browsers**: Full Web Audio API support
- **Safari/iOS**: Requires user interaction to start (auto-handled)
- **Fallback**: Graceful degradation if AudioContext unavailable

## Debugging

```javascript
// Get system statistics
const stats = AudioManager.getStats();
console.log(stats);
/*
{
  initialized: true,
  muted: false,
  volumes: { master: 0.8, sfx: 1.0, ambient: 0.6, ui: 0.8 },
  activeLoops: 2,
  soundPool: { cached: 15, loading: 0, active: 8, maxConcurrent: 32 },
  audioContext: 'running'
}
*/

// Check active sounds
const active = SoundPool.getActiveSources();
console.log('Active sounds:', active);
```

## Best Practices

1. **Use `playAt()` for world events** - Automatic spatial audio for explosions, hits, etc.
2. **Use `startLoop()` for continuous sounds** - Engines, drilling, ambient effects
3. **Match weapon tiers to sounds** - `weapon_fire_${tier}` for progression feel
4. **Preload critical sounds** - Weapon fire, UI clicks for instant playback
5. **Respect categories** - Keep ambient quiet, SFX punchy, UI subtle
6. **Use variations** - 3+ variations prevent audio fatigue
7. **Set appropriate priorities** - Critical for boss events, low for ambient loops
8. **Stop loops when appropriate** - Free resources when sound no longer needed

## Future Enhancements

- Dynamic music system (exploration, combat, boss themes)
- Reverb/echo for environmental zones (nebula, asteroid fields)
- Doppler effect for fast-moving objects
- 3D positional audio (HRTF) for VR support
- Audio ducking (lower music during combat)
- Voice chat integration
- Audio visualizer for debug mode
