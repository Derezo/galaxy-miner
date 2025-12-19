# Graphics System Architecture

Galaxy Miner uses HTML5 Canvas for all rendering with a modular system of graphics modules in `/client/js/graphics/`.

## Overview

The graphics system is built around:
- **Renderer** (`/client/js/renderer.js`) - Main rendering controller
- **Graphics modules** (`/client/js/graphics/`) - 25 specialized rendering modules
- **Canvas context** - Single 2D canvas for all game rendering

---

## Rendering Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Game Loop (60 FPS)                       │
├─────────────────────────────────────────────────────────────┤
│  1. clear()           - Clear canvas, draw starfield        │
│  2. updateCamera()    - Center camera on player             │
│  3. drawWorld()       - Stars, planets, asteroids           │
│  4. drawEntities()    - Ships, NPCs, projectiles            │
│  5. drawEffects()     - Particles, beams, explosions        │
│  6. drawUI()          - HUD overlay, health bars            │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Categories

### Ship Rendering

| Module | Purpose |
|--------|---------|
| `ships.js` | Player ship with tier-based visual upgrades |
| `npc-ships.js` | Faction-specific NPC ship designs (Pirates, Swarm, Void, etc.) |
| `thrust.js` | Engine thrust flame effects with tier scaling |
| `boost-indicator.js` | Visual indicator for boost ability cooldown |

### Weapons & Combat

| Module | Purpose |
|--------|---------|
| `weapons.js` | Player projectile rendering (kinetic, energy, explosive) |
| `npc-weapons.js` | NPC projectile rendering with faction-specific colors |
| `chain-lightning.js` | Tesla cannon T5 chain lightning effect |
| `tesla-coil.js` | Base hit effect for tesla weapons |
| `hit-effects.js` | Damage feedback flashes and impacts |

### Death & Destruction

| Module | Purpose |
|--------|---------|
| `death-effects.js` | Per-faction death animations |
| `player-death.js` | Player death sequence with fade |
| `base-destruction.js` | Faction base explosion sequence |
| `linked-damage.js` | Swarm linked health visual connection |

### Environment

| Module | Purpose |
|--------|---------|
| `celestial-textures.js` | Procedural planet and star textures |
| `star-effects.js` | Star heat zones (corona, warm, hot, surface) |
| `faction-bases.js` | Spawn hub rendering for each faction |
| `tractor-beam.js` | Mining beam effect from ship to asteroid |

### Particles & Effects

| Module | Purpose |
|--------|---------|
| `particles.js` | General particle system (explosions, debris, trails) |
| `shield-visual.js` | Shield impact and recharge visuals |
| `formation-succession.js` | Void formation change animation |
| `queen-visuals.js` | Swarm queen boss effects |

### UI & Status

| Module | Purpose |
|--------|---------|
| `hull-bar.js` | Health bar rendering above entities |
| `status-icons.js` | Buff/debuff indicators |
| `emote-renderer.js` | Player emote display |
| `RewardDisplay.js` | Loot popup animations |

---

## Key Concepts

### Canvas Coordinate System

```javascript
// World coordinates (infinite space)
const worldPos = { x: 5000, y: 3000 };

// Screen coordinates (relative to camera)
const screenPos = Renderer.worldToScreen(worldPos.x, worldPos.y);

// Draw at screen position
ctx.drawImage(sprite, screenPos.x, screenPos.y);
```

### Device Pixel Ratio (DPR)

High-DPI displays are handled automatically:

```javascript
// DPR is capped at 2.0 for mobile performance
this.dpr = Math.min(window.devicePixelRatio || 1, 2);

// Canvas internal resolution = display size × DPR
canvas.width = displayWidth * this.dpr;
canvas.height = displayHeight * this.dpr;

// Scale context to match
ctx.scale(this.dpr, this.dpr);
```

### Screen Shake

Camera shake for impact effects:

```javascript
Renderer.shake(intensity, duration);
// intensity: 0-20 typical range
// duration: milliseconds
```

---

## Common Patterns

### Drawing Entities

```javascript
// Typical entity rendering pattern
function drawEntity(ctx, entity) {
  const screen = Renderer.worldToScreen(entity.x, entity.y);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(entity.rotation);

  // Draw entity at origin
  drawShape(ctx, entity);

  ctx.restore();
}
```

### Color by Faction

```javascript
const FACTION_COLORS = {
  pirates: '#ff4444',
  scavengers: '#44ff44',
  swarm: '#ff44ff',
  void_entities: '#4444ff',
  rogue_miners: '#ffaa44'
};
```

### Particle Effects

```javascript
// Create particles on event
Particles.spawn({
  x: position.x,
  y: position.y,
  count: 20,
  color: '#ffaa00',
  velocity: 100,
  lifetime: 1000,
  spread: Math.PI * 2
});
```

---

## Performance Considerations

### Culling

Only entities within camera view are rendered:

```javascript
if (!Renderer.isOnScreen(entity.x, entity.y, entity.radius)) {
  return; // Skip rendering
}
```

### Particle Limits

Maximum concurrent particles capped for performance:

```javascript
const MAX_PARTICLES = 500;
```

### Canvas State

Minimize `save()`/`restore()` calls:

```javascript
// Batch similar operations
ctx.fillStyle = '#ff0000';
entities.forEach(e => {
  ctx.fillRect(e.x, e.y, e.width, e.height);
});
```

---

## Adding New Graphics Modules

1. Create module in `/client/js/graphics/`
2. Follow naming convention: `feature-name.js`
3. Export drawing functions
4. Import in `renderer.js` or use globally
5. Call from appropriate render phase

### Module Template

```javascript
/**
 * Feature Name Graphics
 * Description of what this renders
 */

const FeatureGraphics = {
  /**
   * Initialize any resources
   */
  init() {
    // Pre-create gradients, images, etc.
  },

  /**
   * Draw the feature
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} data - Feature data
   */
  draw(ctx, data) {
    const screen = Renderer.worldToScreen(data.x, data.y);

    ctx.save();
    // Drawing code
    ctx.restore();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.FeatureGraphics = FeatureGraphics;
}
```

---

## Related Documentation

- [Game Loop](/docs/architecture/game-loop.md) - Render timing and updates
- [NPC Factions](/docs/systems/npc-factions.md) - Faction visual identities
- [Ship Upgrades](/docs/systems/ship-upgrades.md) - Tier-based visual changes
