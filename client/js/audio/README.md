# Audio System

Client-side audio engine for Galaxy Miner using Web Audio API.

For visual architecture diagrams and data flow details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Architecture

The audio system is composed of modular components following the game's IIFE singleton pattern:

Loop requests are versioned. Stopping or replacing a loop while its audio buffer
is still loading invalidates the older request, so late promises cannot restart
stale engine or ambient audio. Semantic loop intents are tracked separately from
their physical Web Audio sources: hiding the page suspends sources but retains
intents, and visibility restoration starts only intents that still exist. A
`stopLoop()` call while hidden therefore prevents that loop from returning.

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
// The optional third argument identifies one instance of a configured sound.
const loopKey = `engine_${player.id}`;
AudioManager.startLoop('engine_3', { x: player.x, y: player.y }, loopKey);

// Stop the loop
AudioManager.stopLoop(loopKey);

// Update position for moving loops (e.g., other players' engines)
AudioManager.updateLoopPosition(loopKey, player.x, player.y);
```

`startLoop()` records the latest options even while audio is muted or the page is
hidden. `stopLoop()` and `stopAllLoops()` are state operations and should be
called whenever gameplay ends the sound, regardless of current audio readiness.
Omit the instance key when one global instance per sound ID is sufficient. Page
visibility restoration waits until the underlying `AudioContext` is actually
running before it recreates intended loop sources.

## Volume Control

Five independent volume categories: `master`, `sfx`, `ambient`, `ui`, `music`

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

Volumes are automatically persisted to `localStorage`. Master and category
changes update the `GainNode` of every active loop immediately. Global mute sets
those live gains to zero without overwriting the configured category values;
unmute restores the current calculated gains without restarting the sources.
Music uses a shared post-crossfade output gain, so mute is also transient and
never persists a zero music preference.

## Sound Configuration

All sounds are defined in `/client/js/audio/config/SoundConfig.js`:

```javascript
const SoundConfig = {
  'weapon_fire_3': {
    file: 'weapons/weapon_player_t3.mp3',
    variationPattern: 'weapons/weapon_player_t3_{index}.mp3',
    variations: 3,
    baseVolume: 0.75,
    priority: 75,
    category: 'sfx'
  }
};
```

### Sound Properties

- **file**: Path relative to `/assets/audio/`; also the fallback when a variant fails
- **variationPattern**: Variant path containing an `{index}` token
- **variationFiles**: Optional explicit filename array for non-sequential families
- **variations**: Number of files generated from `variationPattern`
- **variationStartIndex**: Optional first index (defaults to `1`)
- **variationPadding**: Optional index width (defaults to `2`, producing `01`)
- **baseVolume**: Base volume before category/master volume applied
- **priority**: Playback priority (100 = critical, 75 = high, 50 = medium, 25 = low)
- **category**: Volume category (`sfx`, `ambient`, `ui`)
- **loop**: Whether sound should loop (for ambient sounds)

## Spatial Audio

Distance-based falloff and stereo panning:

- **Range**: Fixed 0-1000-unit near field (equal to the tier-1 2× broadcast
  envelope; it does not scale with the radar tier)
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

Priority gates new requests as the pool fills. At the hard limit, the pool
evicts the oldest one-shot before considering a managed loop, and reconciles
loop intent when capacity becomes available again.

## Variations

Sounds with `variations > 1` have multiple audio files that rotate:

```
weapons/weapon_player_t3_01.mp3
weapons/weapon_player_t3_02.mp3
weapons/weapon_player_t3_03.mp3
```

The system automatically prevents consecutive identical variations. If a
variant cannot load or decode, playback retries the `file` MP3 fallback. Calling
`AudioManager.preload(soundIds)` expands every requested ID to all of its
variation paths plus the fallback, and deduplicates shared alias paths.

## Game Integration Hooks

This section documents how to wire audio into each game system.

### Weapon Fire (client-side prediction)

```javascript
// In Input.js or network event handler
function onWeaponFire() {
  const weaponTier = Player.ship.weaponTier;
  AudioManager.play(`weapon_fire_${weaponTier}`);
}
```

### Combat Hits

```javascript
// In Network.js 'combat:hit' handler
socket.on('combat:hit', (data) => {
  if (data.playerId === Player.id) {
    const tier = Player.ship.shieldTier;
    const soundId = data.hitShield ? `hit_shield_${tier}` : `hit_hull_${tier}`;
    AudioManager.play(soundId);

    if (!data.hitShield && Player.shield === 0) {
      AudioManager.play('shield_down');
    }
  }
});
```

### NPC and Player Deaths

```javascript
socket.on('npc:destroyed', (data) => {
  const npc = Entities.npcs.get(data.id);
  AudioManager.playAt(`death_${npc.faction}`, npc.position.x, npc.position.y);
});

socket.on('npc:death', (data) => {
  // Non-destructive removal, such as an orphan NPC timing out.
  AudioManager.playAt('npc_despawn', data.x, data.y);
});

socket.on('player:death', (data) => {
  if (data.playerId === Player.id) {
    AudioManager.play('death_player');
  }
});
```

### Mining

```javascript
function startMining() {
  const tier = Player.ship.miningTier;
  AudioManager.startLoop(`mining_drill_${tier}`);
}

function completeMining(resource) {
  AudioManager.stopLoop(`mining_drill_${Player.ship.miningTier}`);
  const soundId = resource.rarity >= 3 ? 'mining_rare' : 'mining_complete';
  AudioManager.play(soundId);
}

function cancelMining() {
  AudioManager.stopLoop(`mining_drill_${Player.ship.miningTier}`);
}
```

### Engine Sounds

```javascript
// In Player.update(dt)
function updateEngineSound() {
  const isMoving = Math.abs(Player.velocity.x) > 0.1 || Math.abs(Player.velocity.y) > 0.1;
  const tier = Player.ship.engineTier;
  const soundId = `engine_${tier}`;

  if (isMoving) {
    if (Player._currentEngineLoop !== soundId) {
      if (Player._currentEngineLoop) {
        AudioManager.stopLoop(Player._currentEngineLoop);
      }
      AudioManager.startLoop(soundId);
      Player._currentEngineLoop = soundId;
    }
  } else {
    if (Player._currentEngineLoop) {
      AudioManager.stopLoop(Player._currentEngineLoop);
      Player._currentEngineLoop = null;
    }
  }
}
```

### Boost

```javascript
function activateBoost() {
  AudioManager.play('boost_activate');
}

function deactivateBoost() {
  AudioManager.play('boost_deactivate');
}
```

### UI Sounds

```javascript
// Terminal panel open/close
AudioManager.play('ui_open_panel');
AudioManager.play('ui_close_panel');

// Tab switch or button click
AudioManager.play('ui_click');

// Chat
AudioManager.play('chat_receive');  // Incoming message from others
AudioManager.play('chat_send');     // Sending a message
```

### Notifications

```javascript
AudioManager.play('notification_success');
AudioManager.play('notification_error');
AudioManager.play('notification_warning');
AudioManager.play('notification_info');
```

### Upgrades and Marketplace

```javascript
// Upgrades
AudioManager.play('upgrade_success');
AudioManager.play('upgrade_failed');

// Marketplace
AudioManager.play('market_list');
AudioManager.play('market_buy');
AudioManager.play('market_sell');
AudioManager.play('market_cancel');
AudioManager.play('credits_spend');
AudioManager.play('credits_gain');
```

### Loot Collection

```javascript
socket.on('loot:collect', (data) => {
  let soundId = 'loot_pickup';
  if (data.type === 'component') soundId = 'loot_component';
  else if (data.type === 'relic') soundId = 'loot_relic';
  else if (data.rarity >= 3) soundId = 'loot_rare_pickup';
  AudioManager.play(soundId);
});
```

### Respawn and Shield Recharge

```javascript
socket.on('player:respawn', (data) => {
  if (data.playerId === Player.id) {
    AudioManager.play('respawn');
  }
});

// Shield fully recharged after being depleted
function onShieldFullyRecharged() {
  if (Player._wasShieldDown) {
    AudioManager.play('shield_recharge');
    Player._wasShieldDown = false;
  }
}
```

### Warning Sounds

```javascript
// Low health (play once when crossing 25% threshold)
if (healthPercent <= 0.25 && !Player._lowHealthWarned) {
  AudioManager.play('warning_low_health');
  Player._lowHealthWarned = true;
}

// Shield critical
AudioManager.play('warning_shield_critical');

// Cargo full
AudioManager.play('warning_cargo_full');
```

### Boss Events

```javascript
socket.on('queen:phase', (data) => {
  AudioManager.play(`queen_phase_${data.phase}`);
});

socket.on('queen:death', (data) => {
  AudioManager.playAt('queen_death', data.x, data.y);
});

socket.on('base:destroyed', (data) => {
  AudioManager.playAt('base_destruction', data.x, data.y);
});
```

### Volume Settings UI

```javascript
// Connect sliders to AudioManager
['master', 'sfx', 'ambient', 'ui'].forEach(category => {
  const slider = document.getElementById(`volume-${category}`);
  slider.value = AudioManager.getVolume(category) * 100;

  slider.addEventListener('input', (e) => {
    AudioManager.setVolume(category, e.target.value / 100);
  });
});

// Mute toggle
const muted = AudioManager.toggleMute();
```

## Asset Organization

Audio files should be organized in `/client/assets/audio/`:

```
assets/audio/
├── weapons/         - Player and NPC weapon sounds
├── impacts/         - Shield and hull hit sounds
├── destruction/     - Explosion and death sounds
├── bosses/          - Boss-specific sounds
├── mining/          - Mining drill and completion
├── movement/        - Engine and boost sounds
├── environment/     - Ambient environmental sounds
└── ui/              - Interface and notification sounds
```

Weapon variations and UI/menu MP3s are generated from the tested ElevenLabs
catalog in `/tools/audio-generator/elevenlabs/`. Use its `weapon-ui` collection
to avoid selecting the unrelated NPC destruction categories.

## Performance Considerations

- **Lazy Loading**: Sounds load on first play, then cached
- **Buffer Pooling**: Single `AudioBuffer` shared across all instances
- **Source Pooling**: Max 32 concurrent `AudioBufferSourceNode`s
- **Spatial Culling**: Sounds beyond 1000 units don't play
- **Priority Culling**: Low priority sounds dropped when near capacity
- **Variation System**: Prevents repetitive sound patterns
- **Automatic Cleanup**: Stopped sounds auto-release resources

## Browser Compatibility

- **Modern browsers**: Full Web Audio API support (Chrome 35+, Firefox 25+, Edge 79+)
- **Safari/iOS**: Requires user interaction to start (auto-handled by AudioContextManager)
- **Fallback**: Graceful degradation if AudioContext unavailable -- game functions without sound

## Debugging

```javascript
// Get system statistics
const stats = AudioManager.getStats();
console.log(stats);
/*
{
  initialized: true,
  muted: false,
  volumes: { master: 0.8, sfx: 1.0, ambient: 0.6, ui: 0.8, music: 0.5 },
  activeLoops: 2,
  intendedLoops: 2,
  visibilitySuspended: false,
  soundPool: { cached: 15, loading: 0, active: 8, maxConcurrent: 32 },
  audioContext: 'running'
}
*/

// Check active sounds
const active = SoundPool.getActiveSources();
console.log('Active sounds:', active);
```

## Troubleshooting

**"No sound plays"**
- Check browser console for errors
- Verify file path matches SoundConfig
- Click anywhere on page first (browser auto-resume requirement)

**"AudioContext suspended"**
- Normal before first user interaction; click anywhere to resume

**"Sounds cutting off"**
- Increase priority for critical sounds
- Check if at MAX_CONCURRENT (32) capacity

## Best Practices

1. **Use `playAt()` for world events** -- automatic spatial audio for explosions, hits, etc.
2. **Use `startLoop()` for continuous sounds** -- engines, drilling, ambient effects
3. **Match weapon tiers to sounds** -- `weapon_fire_${tier}` for progression feel
4. **Preload critical sounds** -- weapon fire, UI clicks for instant playback
5. **Respect categories** -- keep ambient quiet, SFX punchy, UI subtle
6. **Use variations** -- 3+ variations prevent audio fatigue
7. **Set appropriate priorities** -- critical for boss events, low for ambient loops
8. **Stop loops when appropriate** -- free resources when sound no longer needed
