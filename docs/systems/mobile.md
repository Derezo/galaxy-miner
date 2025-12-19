# Mobile Support System

Galaxy Miner's mobile support provides touch-optimized controls for smartphones and tablets while maintaining the full gameplay experience.

## Design Philosophy

- **Landscape-only**: Game requires landscape orientation for proper UI layout
- **Touch-optimized**: All interactions designed for touch with proper target sizes
- **Feature parity**: Mobile players have access to all game features
- **Progressive enhancement**: Desktop experience unchanged when mobile features added

---

## Device Support

### Tested Platforms

| Platform | Browser | Status |
|----------|---------|--------|
| iOS 15+ | Safari | Supported |
| Android 10+ | Chrome | Supported |
| iPadOS | Safari | Supported |
| Android Tablets | Chrome | Supported |

### Requirements

- Touch screen with multi-touch support
- Landscape orientation capability
- Modern browser with ES6 support
- WebSocket support for real-time gameplay

---

## Touch Controls

### Control Layout

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ┌─────────┐                           ┌───────┐   │
│   │ Joystick│                           │ Menu  │   │
│   │  Zone   │        Game Canvas        ├───────┤   │
│   │ (40%)   │                           │Context│   │
│   │         │                           ├───────┤   │
│   │         │                           │ Fire  │   │
│   └─────────┘                           └───────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Virtual Joystick

- **Location**: Left 40% of screen (touch anywhere to activate)
- **Behavior**: Floating joystick appears at touch point
- **Deadzone**: 15% (prevents accidental drift)
- **Output**: Analog rotation + thrust magnitude

### Action Buttons

| Button | Size | Action | Notes |
|--------|------|--------|-------|
| Fire | 80px | Weapon fire | Hold for continuous fire |
| Context | 64px | Context action | Label updates dynamically |
| Menu | 48px | Open terminal | Access cargo, upgrades, market |

### Context Button Actions

Priority order (highest to lowest):
1. **Wormhole** - Enter wormhole (requires Wormhole Gem)
2. **Plunder** - Raid faction base (requires Skull and Bones)
3. **Mine** - Mine nearby asteroid
4. **Collect** - Collect nearby wreckage

---

## Auto-Fire System

Mobile devices have automatic firing to compensate for simultaneous aim + fire difficulty.

### Behavior

1. Detects NPCs within weapon range
2. Calculates angle to nearest target
3. Fires automatically when aimed within 30°
4. Respects weapon cooldown

### Configuration

Auto-fire can be toggled via:
- `AutoFire.toggle()` - Programmatic toggle
- Future: Mobile settings panel

### Manual Override

Holding the fire button:
- Disables auto-fire temporarily
- Enables continuous manual fire
- Re-enables auto-fire on release

---

## CSS Architecture

### File Structure

```
client/css/
├── mobile.css       # All mobile-specific styles (406 lines)
├── panels.css       # Panel styles with responsive widths
└── hud.css          # HUD with mobile adjustments
```

### Body Class System

Device detection adds classes to `<body>`:

```css
/* Mobile device detected */
body.is-mobile { }

/* Touch capability */
body.is-touch { }

/* Orientation */
body.is-landscape { }
body.is-portrait { }
```

### Responsive Patterns

**Panel Sizing**
```css
.panel {
  width: clamp(320px, 90vw, 600px);  /* Fluid with bounds */
}

body.is-mobile .panel {
  width: 100%;
  height: 100%;
  border-radius: 0;
}
```

**Touch Target Sizing**
```css
body.is-mobile button {
  min-height: 44px;  /* Apple HIG minimum */
  padding: 12px 16px;
}

body.is-mobile input {
  font-size: 16px;  /* Prevents iOS zoom on focus */
}
```

**Safe Area Insets**
```css
@supports (padding: env(safe-area-inset-top)) {
  body.is-mobile #hud {
    padding-top: env(safe-area-inset-top);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

---

## Portrait Mode

Portrait orientation displays a rotation prompt instead of gameplay.

### Behavior

1. `DeviceDetect` monitors orientation changes
2. Sets `is-portrait` or `is-landscape` class on body
3. CSS shows rotation prompt, hides game canvas
4. Game continues running (doesn't pause)

### Rotation Prompt

```html
<div class="rotation-prompt">
  <svg class="rotation-prompt-icon">...</svg>
  <p class="rotation-prompt-text">
    Please rotate your device to landscape mode
  </p>
</div>
```

---

## Input Integration

### Unified Input API

`Input.getMovementInput()` returns consistent format for both platforms:

```javascript
{
  up: boolean,
  down: boolean,
  left: boolean,
  right: boolean,
  boost: boolean,
  // Mobile-specific (undefined on desktop)
  targetRotation: number,
  thrustMagnitude: number,
  isMobile: boolean
}
```

### Player Movement

`Player.update()` uses `input.isMobile` to choose control scheme:

- **Desktop**: Discrete rotation via left/right keys
- **Mobile**: Smooth analog rotation toward joystick direction

---

## Performance Considerations

### Rendering

- Canvas DPR capped at 2.0 on mobile
- Particle counts same as desktop (consider reducing for low-end)
- 60 FPS target maintained

### Audio

- Web Audio API with gesture-based unlock
- Spatial audio disabled on mobile (mono assumed)
- Sound pool limited to 32 concurrent sounds

### Network

- Same update frequency as desktop
- Proximity-based updates reduce bandwidth
- Consider adding network quality indicator

---

## Testing Mobile on Desktop

### Chrome DevTools

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device preset (e.g., "iPhone 12 Pro")
4. Refresh page (device detection runs on load)

### Programmatic Testing

```javascript
// Force mobile mode for testing (not for production)
DeviceDetect.forceMobileMode = function(enabled) {
  this.isMobile = enabled;
  document.body.classList.toggle('is-mobile', enabled);
  document.body.classList.toggle('is-touch', enabled);
};
```

---

## Known Limitations

1. **No portrait gameplay**: Landscape required
2. **No reverse thrust**: Mobile joystick doesn't support backward movement
3. **No double-tap boost**: Boost via max joystick thrust only
4. **No gesture support**: Pinch/swipe not implemented
5. **No haptic feedback**: Vibration API not used

---

## Future Enhancements

- [ ] Mobile settings panel (joystick size, sensitivity)
- [ ] First-launch tutorial overlay
- [ ] Gesture support (swipe to dismiss panels)
- [ ] Haptic feedback on fire/collect
- [ ] Portrait mode with rotated controls
- [ ] Network quality indicator
- [ ] Reduced particle effects option

---

## Related Documentation

- [Mobile Module API](/client/js/mobile/README.md) - Detailed module documentation
- [UI System](/docs/systems/ui-system.md) - Panel and modal architecture
- [Input System](/docs/architecture/input-system.md) - Full input reference
