# Input System Architecture

Galaxy Miner uses a unified input system that supports both keyboard/mouse (desktop) and touch controls (mobile) through a single API.

## Overview

The input system is built around:
- **Input module** (`/client/js/input.js`) - Central input API and keyboard/mouse handling
- **VirtualJoystick** (`/client/js/mobile/virtual-joystick.js`) - Touch movement controls
- **Player module** (`/client/js/player.js`) - Consumes input for ship movement

---

## Input Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Input.getMovementInput()                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │   Mobile Joystick   │   │      Keyboard Input         │  │
│  │   (Priority First)  │   │      (Fallback)             │  │
│  └──────────┬──────────┘   └──────────────┬──────────────┘  │
│             │                              │                 │
│             v                              v                 │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │ targetRotation      │   │ up/down/left/right/boost    │  │
│  │ thrustMagnitude     │   │ (boolean flags)             │  │
│  │ isMobile: true      │   │ isMobile: false             │  │
│  └─────────────────────┘   └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Keyboard Controls

### Movement Keys

| Key | Action |
|-----|--------|
| `W` / `Arrow Up` | Thrust forward |
| `S` / `Arrow Down` | Thrust backward (brake) |
| `A` / `Arrow Left` | Rotate left |
| `D` / `Arrow Right` | Rotate right |
| `Shift` (Left/Right) | Boost (temporary speed increase) |

### Action Keys

| Key | Action |
|-----|--------|
| `Space` | Fire weapon |
| `M` | Context action (mine/collect/wormhole/plunder) |
| `T` | Toggle terminal panel |
| `E` | Toggle emote wheel |
| `Enter` | Toggle chat |
| `Escape` | Close panels / Cancel wormhole selection |

### Context Action Priority (M Key)

The `M` key performs different actions based on context priority:

1. **Wormhole Transit** - If near wormhole and has Wormhole Gem relic
2. **Plunder Base** - If near faction base and has Skull and Bones relic
3. **Mining** - If near mineable asteroid and not currently mining
4. **Multi-Collect Wreckage** - If has Scrap Siphon relic
5. **Collect Wreckage** - Default wreckage collection

---

## Input Module API

### State Properties

```javascript
Input.keys          // Object: Currently pressed keys by code
Input.mousePosition // { x, y }: Current mouse position
Input.mouseDown     // Boolean: Left mouse button state
```

### Methods

#### `Input.init()`

Initialize the input system. Sets up keyboard, mouse, and touch event listeners.

```javascript
Input.init();
```

#### `Input.isKeyDown(code)`

Check if a specific key is currently pressed.

```javascript
if (Input.isKeyDown('Space')) {
  // Fire weapon
}

if (Input.isKeyDown('KeyW')) {
  // Thrusting forward
}
```

Key codes use the [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) format:
- Letters: `KeyA`, `KeyB`, `KeyW`, etc.
- Arrows: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Modifiers: `ShiftLeft`, `ShiftRight`, `ControlLeft`
- Special: `Space`, `Enter`, `Escape`

#### `Input.getMovementInput()`

Get unified movement input from either mobile joystick or keyboard.

```javascript
const input = Input.getMovementInput();

// Returned object structure:
{
  up: Boolean,              // Thrust forward
  down: Boolean,            // Thrust backward
  left: Boolean,            // Rotate left
  right: Boolean,           // Rotate right
  boost: Boolean,           // Boost active
  targetRotation: Number,   // Mobile: target angle (radians)
  thrustMagnitude: Number,  // Mobile: thrust strength (0-1)
  isMobile: Boolean         // Input source indicator
}
```

**Usage in Player module:**

```javascript
update(dt) {
  const input = Input.getMovementInput();

  if (input.isMobile) {
    // Use analog values for smooth mobile control
    this.targetRotation = input.targetRotation;
    this.thrust = input.thrustMagnitude * this.maxThrust;
  } else {
    // Use boolean flags for keyboard control
    if (input.up) this.thrust = this.maxThrust;
    if (input.left) this.rotation -= this.turnSpeed * dt;
    if (input.right) this.rotation += this.turnSpeed * dt;
  }
}
```

#### `Input.getMobileMovementInput()`

Get mobile joystick input directly (internal use).

```javascript
const mobileInput = Input.getMobileMovementInput();
// Returns null if not on mobile or joystick inactive
```

#### `Input.closeAllPanels()`

Close all open UI panels (terminal, chat, emote wheel).

```javascript
Input.closeAllPanels();
```

---

## Mobile Input: Virtual Joystick

The virtual joystick provides analog movement control for touch devices.

### Configuration

```javascript
VirtualJoystick.config = {
  size: 120,        // Joystick base diameter (pixels)
  knobSize: 50,     // Knob diameter (pixels)
  maxDistance: 50,  // Max knob travel from center
  deadzone: 0.15,   // 15% deadzone threshold
  zoneWidth: 0.4    // Left 40% of screen for joystick
};
```

### How It Works

1. **Touch Start**: Touch in left 40% of screen activates joystick
2. **Origin Position**: Joystick appears centered on touch point
3. **Drag**: Moving finger rotates and thrusts ship
4. **Deadzone**: Small movements ignored (prevents drift)
5. **Release**: Joystick hides, thrust stops

### Touch Zone Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌──────────┐                           │
│  │ Joystick │         Game View         │
│  │   Zone   │                           │
│  │  (40%)   │                           │
│  │          │                           │
│  └──────────┘                           │
│                                         │
└─────────────────────────────────────────┘
```

### API Methods

#### `VirtualJoystick.init()`

Initialize the joystick (called automatically on mobile).

#### `VirtualJoystick.isActive()`

Check if joystick is currently being used.

```javascript
if (VirtualJoystick.isActive()) {
  // Joystick is being touched
}
```

#### `VirtualJoystick.getThrust()`

Get raw thrust value (0-1).

```javascript
const thrust = VirtualJoystick.getThrust();
// 0 = no thrust, 1 = full thrust
```

#### `VirtualJoystick.getTargetRotation()`

Get target rotation in radians.

```javascript
const angle = VirtualJoystick.getTargetRotation();
// -PI to PI range
```

#### `VirtualJoystick.getMovementInput()`

Get movement input compatible with Input API.

```javascript
const input = VirtualJoystick.getMovementInput();
// Same structure as Input.getMovementInput()
```

---

## Mobile Input: Auto-Fire

Mobile players have automatic firing when aimed at enemies.

### How Auto-Fire Works

1. Continuously scans for enemies in front of player
2. Calculates aim angle to each enemy
3. Fires if enemy within aim tolerance angle
4. Respects weapon cooldown

### Configuration

```javascript
AutoFire.enabled       // Boolean: Auto-fire active
AutoFire.aimTolerance  // Number: Aim angle threshold (radians)
```

Settings accessible via MobileSettingsPanel:
- **Enable Auto-Fire**: Toggle on/off
- **Aim Tolerance**: 15° to 60° (wider = more forgiving)

### Manual Override

Fire button overrides auto-fire while held:

```javascript
// MobileHUD tracks manual firing state
MobileHUD._manualFiringActive = true;  // While fire button held

// AutoFire checks this flag
if (MobileHUD._manualFiringActive) return;  // Skip auto-fire
```

---

## Integration Patterns

### Adding New Key Bindings

```javascript
// In Input.onKeyDown()
switch (e.code) {
  case 'KeyX':
    // Handle new action
    Player.doSomething();
    break;
}
```

### Checking Input in Game Loop

```javascript
// In game loop (60fps)
function update(dt) {
  // Movement
  const input = Input.getMovementInput();
  player.handleMovement(input, dt);

  // Continuous actions (like firing)
  if (Input.isKeyDown('Space')) {
    player.fire();
  }
}
```

### Custom Input Handlers

```javascript
// Add custom event listener
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && e.ctrlKey) {
    // Custom shortcut: Ctrl+P
    e.preventDefault();
    showPlayerStats();
  }
});
```

---

## Input State Diagram

```
                    ┌─────────────────┐
                    │   Input.init()  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         v                   v                   v
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Keyboard Events│ │   Mouse Events  │ │  Touch Events   │
│  (keydown/up)   │ │ (move/down/up)  │ │ (VirtualJoystick)│
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         v                   v                   v
┌─────────────────────────────────────────────────────────┐
│                     Input State                          │
│  keys: { KeyW: true, ... }                              │
│  mousePosition: { x, y }                                │
│  mouseDown: Boolean                                      │
└────────────────────────────────────────────────────────┘
                             │
                             v
                  ┌─────────────────────┐
                  │ getMovementInput()  │
                  │ (Unified API)       │
                  └─────────────────────┘
```

---

## Event Flow

### Desktop Key Press

```
User presses 'W'
      │
      v
Input.onKeyDown(e)
      │
      ├──> Input.keys['KeyW'] = true
      │
      v
Game loop calls Input.getMovementInput()
      │
      └──> Returns { up: true, isMobile: false, ... }
            │
            v
      Player.update() applies thrust
```

### Mobile Joystick Touch

```
User touches left side of screen
      │
      v
VirtualJoystick.onTouchStart(e)
      │
      ├──> Creates joystick at touch point
      │
      v
User drags finger
      │
      v
VirtualJoystick.onTouchMove(e)
      │
      ├──> Updates targetRotation, thrust
      │
      v
Game loop calls Input.getMovementInput()
      │
      └──> Returns { isMobile: true, targetRotation: X, thrustMagnitude: Y }
            │
            v
      Player.update() uses analog values
```

---

## Performance Considerations

### Event Throttling

Mouse move events are not throttled but position is only read during game loop.

### Input Polling vs Events

- Keyboard state stored in `Input.keys` object (polled during update)
- Discrete actions (fire, open menu) handled in keydown handler
- Movement uses polling for smooth, continuous input

### Mobile Optimization

- Touch events use `{ passive: false }` to prevent scroll
- Only one touch tracked for joystick (multi-touch handled separately)
- Dead zone prevents small movements from registering

---

## Related Documentation

- [Mobile System](/docs/systems/mobile.md) - Mobile controls overview
- [Game Loop](/docs/architecture/game-loop.md) - How input integrates with update cycle
- [Player Module](/client/js/player.js) - How input affects ship physics
