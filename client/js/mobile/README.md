# Mobile System

Touch-optimized controls for Galaxy Miner mobile gameplay.

## Architecture

```
mobile/
├── device-detect.js     # Device detection and body classes
├── virtual-joystick.js  # Movement control via touch joystick
├── auto-fire.js         # Automatic firing at aimed targets
├── mobile-hud.js        # Touch action buttons (fire, context, menu)
├── mobile-tutorial.js   # First-launch tutorial overlay
└── gesture-handler.js   # Advanced gesture detection (swipe, pinch, long-press)
```

## Initialization Order

Mobile modules are initialized in `main.js` after core systems:

```javascript
DeviceDetect.init();     // 1. Detect device type, set body classes
VirtualJoystick.init();  // 2. Create joystick (only on mobile)
AutoFire.init();         // 3. Set up auto-fire (only on mobile)
MobileHUD.init();        // 4. Create action buttons (only on mobile)
```

All modules check `DeviceDetect.isMobile` before initializing.

---

## DeviceDetect

Detects mobile devices and manages responsive CSS classes on the `<body>` element.

### Body Classes

| Class | Condition |
|-------|-----------|
| `is-mobile` | Mobile device detected |
| `is-touch` | Touch capability detected |
| `is-landscape` | Landscape orientation |
| `is-portrait` | Portrait orientation |

### API

```javascript
DeviceDetect.isMobile        // Boolean: true if mobile device
DeviceDetect.isTouchDevice   // Boolean: true if has touch capability
DeviceDetect.isLandscape     // Boolean: true if landscape orientation

DeviceDetect.init()          // Initialize detection and listeners
```

### Detection Logic

1. **User agent check**: Matches common mobile patterns
2. **Touch capability**: `ontouchstart` or `maxTouchPoints > 0`
3. **Hybrid handling**: Touch laptops with mouse are NOT classified as mobile

### Touch Behavior Prevention

On mobile, these behaviors are automatically prevented:
- Pull-to-refresh (`overscrollBehavior: none`)
- Double-tap zoom (`touchAction: manipulation`)
- Long-press context menu
- iOS elastic scrolling

---

## VirtualJoystick

Floating touch joystick for ship movement. Appears where the player touches in the left 40% of the screen.

### Configuration

```javascript
VirtualJoystick.config = {
  size: 120,           // Joystick base diameter (px)
  knobSize: 50,        // Knob diameter (px)
  maxDistance: 50,     // Max knob travel from center (px)
  deadzone: 0.15,      // 15% deadzone before input registers
  zoneWidth: 0.4       // Left 40% of screen is joystick zone
};
```

### API

```javascript
VirtualJoystick.active            // Boolean: currently being touched
VirtualJoystick.thrust            // Number: 0-1 thrust magnitude
VirtualJoystick.targetRotation    // Number: target angle in radians

VirtualJoystick.getMovementInput()  // Get unified input object
VirtualJoystick.isActive()          // Alias for .active
VirtualJoystick.getThrust()         // Alias for .thrust
VirtualJoystick.getTargetRotation() // Alias for .targetRotation
```

### Output Format

`getMovementInput()` returns:

```javascript
{
  up: boolean,              // true if thrust > 0.3
  down: boolean,            // always false on mobile
  left: boolean,            // true if turning left
  right: boolean,           // true if turning right
  boost: boolean,           // true if thrust > 0.9
  targetRotation: number,   // Target angle in radians
  thrustMagnitude: number   // 0-1 thrust value
}
```

### Touch Handling

- Only processes touches in left 40% of screen (`zoneWidth: 0.4`)
- Tracks single touch ID to prevent conflicts
- Uses `preventDefault()` to stop page scrolling

---

## AutoFire

Automatically fires weapons when aimed at enemies within range.

### Configuration

```javascript
AutoFire.enabled       // Boolean: auto-fire on/off
AutoFire.aimTolerance  // Radians: aim tolerance (default: PI/6 = 30°)
```

### API

```javascript
AutoFire.update(dt)              // Called from game loop
AutoFire.hasTarget()             // Boolean: has valid target
AutoFire.getTarget()             // Current target object or null
AutoFire.toggle()                // Toggle enabled state
AutoFire.enable()                // Enable auto-fire
AutoFire.disable()               // Disable auto-fire
AutoFire.setAimTolerance(rad)    // Set aim tolerance in radians
```

### Behavior

1. Finds NPCs within weapon range (tier-scaled)
2. Selects nearest NPC as target
3. Calculates angle to target
4. Fires if angle difference < `aimTolerance`
5. Respects weapon cooldown (tier + energy core scaled)
6. Skips firing if `MobileHUD._manualFiringActive` is true

### Target Selection

```javascript
// Target object returned by getTarget()
{
  id: string,         // NPC ID
  x: number,          // World X position
  y: number,          // World Y position
  distance: number,   // Distance from player
  faction: string,    // NPC faction
  npc: Object         // Full NPC entity
}
```

---

## MobileHUD

Touch-friendly action buttons displayed on mobile devices.

### Buttons

| Button | Position | Action |
|--------|----------|--------|
| Fire (red, 80px) | Bottom-right | Continuous fire while held |
| Context (blue, 64px) | Above fire | Mining, collect, wormhole, plunder |
| Menu (gray, 48px) | Top of stack | Toggle terminal panel |

### Context Action Priority

The context button label updates dynamically based on what's nearby:

1. **Wormhole** - Near wormhole + has Wormhole Gem relic
2. **Plunder** - Near base + has Skull and Bones relic
3. **Mine** - Near mineable asteroid + not already mining
4. **Collect** - Wreckage nearby

### API

```javascript
MobileHUD.init()                    // Create buttons and start update loop
MobileHUD.show()                    // Show the mobile HUD
MobileHUD.hide()                    // Hide the mobile HUD
MobileHUD.destroy()                 // Clean up all resources
MobileHUD.updateActionButton()      // Update context button label
MobileHUD.updateAutofireIndicator() // Update auto-fire target display

// State
MobileHUD._manualFiringActive       // Boolean: fire button held
```

### Auto-Fire Indicator

Displays "AUTO" with target icon when auto-fire has a valid target. CSS class `.has-target` controls visibility.

### Multi-Touch Support

- Fire button tracks its own `touchId` for multi-touch
- Uses `stopPropagation()` to prevent canvas conflicts
- Joystick and fire button can be used simultaneously

---

## CSS Classes

Mobile styles in `/client/css/mobile.css` use body class selectors:

```css
/* Only on mobile devices */
body.is-mobile .element { ... }

/* Portrait mode (shows rotation prompt) */
body.is-mobile.is-portrait .rotation-prompt { display: flex; }

/* Landscape mode */
body.is-mobile.is-landscape .element { ... }

/* Touch-capable devices */
body.is-touch .element { ... }
```

### Safe Area Support

Notch/safe area handling via CSS environment variables:

```css
@supports (padding: env(safe-area-inset-top)) {
  body.is-mobile .mobile-action-buttons {
    right: calc(20px + env(safe-area-inset-right));
    bottom: calc(20px + env(safe-area-inset-bottom));
  }
}
```

---

## Integration with Input System

The unified `Input.getMovementInput()` method checks mobile input first:

```javascript
// In Input module
getMovementInput() {
  const mobileInput = this.getMobileMovementInput();
  if (mobileInput && mobileInput.thrustMagnitude > 0) {
    return { ...mobileInput, isMobile: true };
  }
  return { ...keyboardInput, isMobile: false };
}
```

`Player.update()` uses the unified input and branches based on `input.isMobile`.

---

## Testing on Desktop

To test mobile behavior in Chrome DevTools:

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select a mobile device preset
4. Refresh the page

Note: `DeviceDetect` checks user agent, so device mode must be enabled before page load.

---

## Styling Reference

| Element | Class | Size |
|---------|-------|------|
| Joystick base | `.joystick-base` | 120x120px |
| Joystick knob | `.joystick-knob` | 50x50px |
| Fire button | `.mobile-btn-fire` | 80x80px |
| Action button | `.mobile-btn-action` | 64x64px |
| Menu button | `.mobile-btn-menu` | 48x48px |
| Touch targets | All interactive | min 44x44px |

---

## MobileTutorial

First-launch tutorial overlay introducing touch controls to new mobile players.

### Features

- Step-by-step introduction to controls
- Highlighted zones showing joystick area, buttons
- Skip option for returning players
- Persists completion to localStorage
- Auto-starts for first-time mobile users

### Steps

1. **Welcome** - Introduction
2. **Movement** - Joystick zone highlight
3. **Fire Button** - Fire button highlight
4. **Action Button** - Context action button
5. **Auto-Fire** - Automatic targeting explanation
6. **Complete** - Menu button highlight

### API

```javascript
MobileTutorial.init()              // Initialize (creates overlay)
MobileTutorial.start()             // Start the tutorial
MobileTutorial.skip()              // Skip and mark complete
MobileTutorial.reset()             // Reset for testing
MobileTutorial.hasCompletedTutorial() // Check completion state
MobileTutorial.shouldAutoStart()   // Check if should auto-start
```

### Storage

Tutorial completion stored in localStorage:
- Key: `galaxyMiner_mobileTutorialComplete`
- Value: `"true"` when completed

---

## GestureHandler

Foundation for advanced touch gestures. Currently supports long-press, swipe, pinch, and double-tap detection.

### Configuration

```javascript
GestureHandler.config = {
  longPressDelay: 500,    // ms before long-press triggers
  swipeThreshold: 50,     // min pixels for swipe recognition
  swipeVelocity: 0.3,     // min velocity (px/ms) for swipe
  pinchThreshold: 0.1,    // min scale change for pinch
  doubleTapDelay: 300     // max ms between taps for double-tap
};
```

### API

```javascript
// Initialize on element with callbacks
GestureHandler.init(element, {
  onLongPress: ({ x, y }) => { },
  onSwipe: ({ direction, dx, dy, velocity }) => { },
  onPinch: ({ scale, center, isZoomIn, isZoomOut }) => { },
  onDoubleTap: ({ x, y }) => { }
});

// Update handlers
GestureHandler.setHandlers({ onSwipe: newHandler });

// Update configuration
GestureHandler.setConfig({ longPressDelay: 750 });

// Clean up
GestureHandler.destroy();
```

### Gesture Callbacks

**onLongPress**
```javascript
{ x: number, y: number }
```

**onSwipe**
```javascript
{
  direction: 'up' | 'down' | 'left' | 'right',
  dx: number,       // Horizontal distance
  dy: number,       // Vertical distance
  velocity: number, // Speed in px/ms
  startX: number,
  startY: number,
  endX: number,
  endY: number
}
```

**onPinch**
```javascript
{
  scale: number,    // 1.0 = no change, >1 = zoom in, <1 = zoom out
  center: { x, y }, // Center point between fingers
  isZoomIn: boolean,
  isZoomOut: boolean
}
```

**onDoubleTap**
```javascript
{ x: number, y: number }
```

### Future Uses

- Long-press: Context menu, target lock
- Swipe: Panel dismiss, navigation
- Pinch: Map zoom (when implemented)
- Double-tap: Quick action shortcuts

---

## MobileSettingsPanel

Settings panel for customizing mobile controls (uses Modal system).

### Settings

| Setting | Range | Default |
|---------|-------|---------|
| Joystick Size | 80-160px | 120px |
| Joystick Deadzone | 5-30% | 15% |
| Auto-Fire Enabled | on/off | on |
| Aim Tolerance | 15-60° | 30° |
| Haptic Feedback | on/off | on |

### API

```javascript
MobileSettingsPanel.init()         // Initialize (load saved settings)
MobileSettingsPanel.show()         // Show settings modal
MobileSettingsPanel.settings       // Current settings object
MobileSettingsPanel.resetToDefaults() // Reset all settings
MobileSettingsPanel.vibrate(pattern)  // Trigger haptic feedback
```

### Storage

Settings stored in localStorage:
- Key: `galaxyMiner_mobileSettings`
- Value: JSON object with settings

### Integration

Settings are automatically applied to:
- `VirtualJoystick.config.size`
- `VirtualJoystick.config.deadzone`
- `AutoFire.enabled`
- `AutoFire.aimTolerance`
