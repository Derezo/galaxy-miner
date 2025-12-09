# Audio System Integration Guide

This guide explains how to integrate the audio system into Galaxy Miner.

## Step 1: Add Script Tags to HTML

Add these script tags to `/client/index.html` **before** `js/renderer.js` (around line 262):

```html
<!-- Audio System -->
<script src="js/audio/AudioContext.js"></script>
<script src="js/audio/SpatialAudio.js"></script>
<script src="js/audio/SoundPool.js"></script>
<script src="js/audio/config/SoundConfig.js"></script>
<script src="js/audio/AudioManager.js"></script>
```

The complete audio section should be inserted like this:

```html
<!-- Line ~262, after graphics modules -->
<script src="js/graphics/boost-indicator.js"></script>

<!-- Audio System -->
<script src="js/audio/AudioContext.js"></script>
<script src="js/audio/SpatialAudio.js"></script>
<script src="js/audio/SoundPool.js"></script>
<script src="js/audio/config/SoundConfig.js"></script>
<script src="js/audio/AudioManager.js"></script>

<script src="js/renderer.js"></script>
```

## Step 2: Initialize in main.js

Add `AudioManager.init()` to the initialization sequence in `/client/js/main.js`:

```javascript
init() {
  if (this.initialized) return;
  this.initialized = true;

  Logger.log('Galaxy Miner initializing...');

  // Initialize modules
  Network.init();
  Input.init();
  Renderer.init();
  AudioManager.init();  // <-- ADD THIS LINE
  AuthUI.init();
  HUD.init();
  // ... rest of initialization
}
```

This ensures the audio context is created early, ready for user interaction.

## Step 3: Add Audio Hooks to Game Events

Now integrate audio into various game systems:

### A. Player Weapons (client/js/input.js or network.js)

Find where weapon firing is handled and add:

```javascript
// When player fires weapon
function onPlayerWeaponFire() {
  const weaponTier = Player.ship.weaponTier;
  AudioManager.play(`weapon_fire_${weaponTier}`);
}
```

If using client prediction, play immediately. If using network events, play on `combat:fire` acknowledgment.

### B. Combat Hits (client/js/network.js)

Find the `combat:hit` event handler and add:

```javascript
socket.on('combat:hit', (data) => {
  // Existing code for hit effects...

  // Play hit sound for local player
  if (data.playerId === Player.id) {
    const tier = Player.ship.shieldTier;
    const soundId = data.hitShield ? `hit_shield_${tier}` : `hit_hull_${tier}`;
    AudioManager.play(soundId);

    // Shield down warning
    if (!data.hitShield && Player.shield === 0) {
      AudioManager.play('shield_down');
    }
  }
});
```

### C. NPC and Player Deaths (client/js/network.js)

Find `npc:death` and `player:death` handlers:

```javascript
socket.on('npc:death', (data) => {
  // Existing code...

  // Play death sound at NPC location
  const faction = data.faction.toLowerCase();
  AudioManager.playAt(`death_${faction}`, data.x, data.y);
});

socket.on('player:death', (data) => {
  // Existing code...

  if (data.playerId === Player.id) {
    AudioManager.play('death_player');
  }
});
```

### D. Mining (client/js/player.js or network.js)

Find mining start/complete logic:

```javascript
// Start mining
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

// Cancel mining (if moving or damaged)
function cancelMining() {
  AudioManager.stopLoop(`mining_drill_${Player.ship.miningTier}`);
}
```

### E. Engine Sounds (client/js/player.js)

Add to the player update loop:

```javascript
// In Player.update(dt)
function updateEngineSound() {
  const isMoving = Math.abs(Player.velocity.x) > 0.1 || Math.abs(Player.velocity.y) > 0.1;
  const tier = Player.ship.engineTier;
  const soundId = `engine_${tier}`;

  // Track current engine loop ID
  if (!Player._currentEngineLoop) {
    Player._currentEngineLoop = null;
  }

  if (isMoving) {
    // Start loop if not already playing
    if (Player._currentEngineLoop !== soundId) {
      if (Player._currentEngineLoop) {
        AudioManager.stopLoop(Player._currentEngineLoop);
      }
      AudioManager.startLoop(soundId);
      Player._currentEngineLoop = soundId;
    }
  } else {
    // Stop loop when not moving
    if (Player._currentEngineLoop) {
      AudioManager.stopLoop(Player._currentEngineLoop);
      Player._currentEngineLoop = null;
    }
  }
}

// Call in Player.update()
Player.update = function(dt) {
  // ... existing update code ...
  updateEngineSound();
};
```

### F. Boost (client/js/player.js)

If boost mechanic exists:

```javascript
function activateBoost() {
  AudioManager.play('boost_activate');
  // ... boost logic
}

function deactivateBoost() {
  AudioManager.play('boost_deactivate');
  // ... boost end logic
}
```

### G. UI Sounds (client/js/ui/)

#### Terminal Panel (client/js/ui/terminal.js)

```javascript
// Panel open
function openTerminal() {
  AudioManager.play('ui_open_panel');
  // ... show terminal
}

// Panel close
function closeTerminal() {
  AudioManager.play('ui_close_panel');
  // ... hide terminal
}

// Tab switch
function switchTab(tabName) {
  AudioManager.play('ui_click');
  // ... switch tab
}
```

#### Chat (client/js/ui/chat.js)

```javascript
socket.on('chat:message', (data) => {
  // ... display message

  if (data.username !== Player.username) {
    AudioManager.play('chat_receive');
  }
});

// Send message
function sendMessage() {
  AudioManager.play('chat_send');
  // ... send message
}
```

#### Notifications (client/js/ui/core/NotificationManager.js)

```javascript
// In NotificationManager methods
success(message) {
  AudioManager.play('notification_success');
  // ... show notification
}

error(message) {
  AudioManager.play('notification_error');
  // ... show notification
}

warning(message) {
  AudioManager.play('notification_warning');
  // ... show notification
}

info(message) {
  AudioManager.play('notification_info');
  // ... show notification
}
```

#### Upgrades (client/js/ui/upgrades.js)

```javascript
socket.on('upgrade:success', (data) => {
  AudioManager.play('upgrade_success');
  AudioManager.play('credits_spend');
  // ... update UI
});

socket.on('upgrade:error', (data) => {
  AudioManager.play('upgrade_failed');
  // ... show error
});
```

#### Marketplace (client/js/ui/marketplace.js)

```javascript
function listItem() {
  AudioManager.play('market_list');
  // ... list item
}

function buyItem() {
  AudioManager.play('market_buy');
  AudioManager.play('credits_spend');
  // ... purchase
}

function sellComplete() {
  AudioManager.play('market_sell');
  AudioManager.play('credits_gain');
  // ... confirm sale
}

function cancelListing() {
  AudioManager.play('market_cancel');
  // ... cancel
}
```

#### Loot Collection (client/js/network.js)

```javascript
socket.on('loot:collect', (data) => {
  // ... add to inventory

  // Play appropriate pickup sound
  let soundId = 'loot_pickup';

  if (data.type === 'component') {
    soundId = 'loot_component';
  } else if (data.type === 'relic') {
    soundId = 'loot_relic';
  } else if (data.rarity >= 3) {
    soundId = 'loot_rare_pickup';
  }

  AudioManager.play(soundId);
});
```

### H. Credits Animation (client/js/ui/credit-animation.js)

```javascript
// When credits increase
function onCreditsIncrease() {
  AudioManager.play('credits_gain');
  // ... animate
}

// When credits decrease
function onCreditsDecrease() {
  AudioManager.play('credits_spend');
  // ... animate
}
```

### I. Respawn (client/js/network.js)

```javascript
socket.on('player:respawn', (data) => {
  if (data.playerId === Player.id) {
    AudioManager.play('respawn');
    // ... respawn logic
  }
});
```

### J. Shield Recharge (client/js/player.js)

```javascript
// When shields fully recharge after being depleted
function onShieldFullyRecharged() {
  if (Player._wasShieldDown) {
    AudioManager.play('shield_recharge');
    Player._wasShieldDown = false;
  }
}

// Track when shields go down
function onShieldDepleted() {
  Player._wasShieldDown = true;
}
```

### K. Warning Sounds (client/js/hud.js or player.js)

```javascript
// Low health warning (play once when crossing threshold)
function checkLowHealth() {
  const healthPercent = Player.health / Player.maxHealth;

  if (healthPercent <= 0.25 && !Player._lowHealthWarned) {
    AudioManager.play('warning_low_health');
    Player._lowHealthWarned = true;
  } else if (healthPercent > 0.25) {
    Player._lowHealthWarned = false;
  }
}

// Shield critical warning
function checkShieldCritical() {
  if (Player.shield === 0 && !Player._shieldCriticalWarned) {
    AudioManager.play('warning_shield_critical');
    Player._shieldCriticalWarned = true;
  } else if (Player.shield > 0) {
    Player._shieldCriticalWarned = false;
  }
}

// Cargo full warning
function checkCargoFull() {
  const cargoUsed = calculateCargoUsed();

  if (cargoUsed >= Player.ship.cargoMax && !Player._cargoFullWarned) {
    AudioManager.play('warning_cargo_full');
    Player._cargoFullWarned = true;
  } else if (cargoUsed < Player.ship.cargoMax) {
    Player._cargoFullWarned = false;
  }
}
```

### L. Boss Events (client/js/network.js)

If Queen boss mechanics are implemented:

```javascript
socket.on('queen:phase', (data) => {
  AudioManager.play(`queen_phase_${data.phase}`);
});

socket.on('queen:summon', (data) => {
  AudioManager.playAt('queen_summon', data.x, data.y);
});

socket.on('queen:death', (data) => {
  AudioManager.playAt('queen_death', data.x, data.y);
});
```

### M. Base Destruction (client/js/network.js)

```javascript
socket.on('base:destroyed', (data) => {
  AudioManager.playAt('base_destruction', data.x, data.y);
});
```

## Step 4: Add Audio Settings UI (Optional)

Create volume controls in settings menu (if it exists):

```html
<!-- In settings/options panel -->
<div class="audio-settings">
  <h3>Audio</h3>

  <div class="volume-control">
    <label>Master Volume</label>
    <input type="range" id="volume-master" min="0" max="100" value="80">
    <span id="volume-master-value">80%</span>
  </div>

  <div class="volume-control">
    <label>Sound Effects</label>
    <input type="range" id="volume-sfx" min="0" max="100" value="100">
    <span id="volume-sfx-value">100%</span>
  </div>

  <div class="volume-control">
    <label>Ambient Sounds</label>
    <input type="range" id="volume-ambient" min="0" max="100" value="60">
    <span id="volume-ambient-value">60%</span>
  </div>

  <div class="volume-control">
    <label>UI Sounds</label>
    <input type="range" id="volume-ui" min="0" max="100" value="80">
    <span id="volume-ui-value">80%</span>
  </div>

  <button id="audio-mute-toggle">Mute All</button>
</div>
```

JavaScript:

```javascript
// Volume sliders
['master', 'sfx', 'ambient', 'ui'].forEach(category => {
  const slider = document.getElementById(`volume-${category}`);
  const display = document.getElementById(`volume-${category}-value`);

  // Load saved value
  slider.value = AudioManager.getVolume(category) * 100;
  display.textContent = slider.value + '%';

  // Update on change
  slider.addEventListener('input', (e) => {
    const value = e.target.value / 100;
    AudioManager.setVolume(category, value);
    display.textContent = e.target.value + '%';
  });
});

// Mute toggle
document.getElementById('audio-mute-toggle').addEventListener('click', () => {
  const muted = AudioManager.toggleMute();
  document.getElementById('audio-mute-toggle').textContent = muted ? 'Unmute All' : 'Mute All';
});
```

## Step 5: Testing

After integration, test each system:

1. **Check initialization**: Open browser console, verify "AudioManager initialized" log
2. **Test weapon sounds**: Fire weapons, verify tier-appropriate sounds
3. **Test combat**: Get hit, verify shield/hull sounds
4. **Test mining**: Mine asteroid, verify drill loop starts/stops
5. **Test movement**: Move ship, verify engine loop
6. **Test UI**: Click buttons, verify click sounds
7. **Test spatial audio**: Have other player fire nearby, verify panning/volume
8. **Test notifications**: Trigger success/error, verify notification sounds
9. **Test volume controls**: Adjust sliders, verify volume changes
10. **Test mute**: Toggle mute, verify all audio stops/resumes

## Step 6: Audio Asset Creation

Until real audio assets are ready, you can:

1. Use placeholder silence (empty WAV files)
2. Use synthesized beeps at different frequencies
3. Use royalty-free placeholders from Freesound.org
4. Generate simple sounds with Audacity

See `/client/assets/audio/README.md` for file naming conventions and specifications.

## Performance Considerations

- The system automatically limits concurrent sounds to 32
- Sounds beyond 1000 units distance won't play (spatial culling)
- Low priority sounds are culled when near capacity
- Audio buffers are cached after first load
- Volumes persist to localStorage

## Debugging

Check audio system status:

```javascript
// In browser console
console.log(AudioManager.getStats());

// Output:
// {
//   initialized: true,
//   muted: false,
//   volumes: { master: 0.8, sfx: 1.0, ambient: 0.6, ui: 0.8 },
//   activeLoops: 1,
//   soundPool: { cached: 12, loading: 0, active: 3, maxConcurrent: 32 },
//   audioContext: 'running'
// }
```

## Common Issues

### AudioContext not starting
- Browser requires user interaction before audio plays
- System auto-resumes on first click/keypress
- Check browser console for "suspended" state

### Sounds not playing
- Check file paths match SoundConfig exactly
- Verify files exist in `/client/assets/audio/`
- Check browser Network tab for 404 errors
- Verify AudioContext state is "running"

### Volume too low/high
- Check category volumes in settings
- Check master volume
- Verify baseVolume in SoundConfig
- Check if spatial audio is reducing volume (distance)

### Sounds cutting off
- Increase MAX_CONCURRENT in SoundPool
- Increase priority for critical sounds
- Check if sounds are being culled due to capacity

## Next Steps

1. Create placeholder audio files
2. Integrate hooks into game systems (follow Step 3)
3. Add volume controls UI (Step 4)
4. Test all systems (Step 5)
5. Replace placeholders with final audio assets
6. Fine-tune volumes and priorities based on gameplay feel
