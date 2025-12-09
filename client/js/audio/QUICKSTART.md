# Audio System Quick Start

Get the audio system running in 5 minutes.

## 1. Add Scripts to HTML

Edit `/client/index.html` and add these lines **before** `<script src="js/renderer.js">` (around line 262):

```html
<!-- Audio System -->
<script src="js/audio/AudioContext.js"></script>
<script src="js/audio/SpatialAudio.js"></script>
<script src="js/audio/SoundPool.js"></script>
<script src="js/audio/config/SoundConfig.js"></script>
<script src="js/audio/AudioManager.js"></script>
```

## 2. Initialize in main.js

Edit `/client/js/main.js` and add `AudioManager.init()` to the init function:

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
  // ... rest of code
}
```

## 3. Test with Browser Console

After reloading the page:

1. Open browser console (F12)
2. Look for log: `"AudioManager initialized"`
3. Type: `AudioManager.getStats()`
4. Should see: `{ initialized: true, ... }`

## 4. Test a Simple Sound

In browser console:

```javascript
// This will fail gracefully until audio files exist
AudioManager.play('ui_click');
```

You should see a network request for `/assets/audio/ui/click.wav` (will 404 until you add the file).

## 5. Add Your First Audio Hook

Edit `/client/js/ui/terminal.js` (or any UI file) and add:

```javascript
// Find where a button is clicked, add this line:
AudioManager.play('ui_click');
```

Example for terminal panel open:

```javascript
function openTerminal() {
  AudioManager.play('ui_open_panel');
  // ... existing code to show terminal
}
```

## 6. Create a Test Audio File

**Option A: Use Audacity (Free)**

1. Download [Audacity](https://www.audacityteam.org/)
2. Generate → Tone → 440Hz, 0.1 seconds
3. File → Export → Export as WAV
4. Save to: `/client/assets/audio/ui/click.wav`

**Option B: Use Online Generator**

1. Visit: https://onlinetonegenerator.com/
2. Set frequency: 1000Hz, duration: 100ms
3. Download as WAV
4. Save to: `/client/assets/audio/ui/click.wav`

**Option C: Download Free Sound**

1. Visit: https://freesound.org/search/?q=click
2. Download a short click sound
3. Convert to WAV if needed
4. Save to: `/client/assets/audio/ui/click.wav`

## 7. Test the Sound

1. Reload the page
2. Click the button you added `AudioManager.play('ui_click')` to
3. You should hear the sound!

## Next Steps

See `INTEGRATION.md` for complete integration examples covering:
- Weapon fire
- Combat hits
- Mining sounds
- Engine loops
- NPC deaths
- Boss events
- Volume controls

See `README.md` for full API documentation.

## Troubleshooting

**"No sound plays"**
- Check browser console for errors
- Verify file path: `/assets/audio/ui/click.wav`
- Check file format is WAV/MP3/OGG
- Click anywhere on page first (browser requirement)

**"AudioContext suspended"**
- This is normal before first user interaction
- Click anywhere on the page
- AudioContext will auto-resume

**"404 not found"**
- Audio file doesn't exist yet
- Create placeholder files (see step 6)
- Check file path matches SoundConfig exactly

**"Sound is too quiet/loud"**
- Adjust in browser console:
```javascript
AudioManager.setVolume('ui', 1.0);  // 0-1 range
AudioManager.setVolume('master', 0.8);
```

## Minimal Working Example

Complete example with single UI sound:

**1. HTML** (`/client/index.html` before `js/renderer.js`):
```html
<script src="js/audio/AudioContext.js"></script>
<script src="js/audio/SpatialAudio.js"></script>
<script src="js/audio/SoundPool.js"></script>
<script src="js/audio/config/SoundConfig.js"></script>
<script src="js/audio/AudioManager.js"></script>
```

**2. Init** (`/client/js/main.js`):
```javascript
AudioManager.init();  // Add to GalaxyMiner.init()
```

**3. Usage** (anywhere in code):
```javascript
button.addEventListener('click', () => {
  AudioManager.play('ui_click');
  // ... handle click
});
```

**4. Asset** (`/client/assets/audio/ui/click.wav`):
- Create a short WAV file (see step 6)

That's it! The system handles everything else automatically.
