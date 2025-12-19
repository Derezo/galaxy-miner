# Background System - Dreamy Dynamic Starfield

A zone-aware, activity-responsive background rendering system that replaces the static starfield with an immersive space atmosphere.

## Overview

The Background System creates a dreamy, dynamic starfield that:
- **Fixes the flickering bug** in the old starfield (caused by modulo math)
- **Responds to surroundings** - colors shift based on nearby stars, planets, and factions
- **Scales with activity** - nebula clouds become more visible in busy areas
- **Animates subtly** - stars twinkle and drift, creating a living atmosphere

## Architecture

```
BackgroundSystem (Coordinator)
    ├── ZoneSampler        → Analyzes nearby objects for color/activity
    ├── PaletteManager     → Handles ultra-slow color transitions
    ├── StarfieldRenderer  → Renders 3-layer parallax starfield
    └── NebulaRenderer     → Renders activity-responsive nebula clouds
```

### Data Flow

```
World.getVisibleObjects()
    → ZoneSampler.update()
        → PaletteManager.update()
            → [palette colors + activity level]
                → NebulaRenderer.draw()
                → StarfieldRenderer.draw()
```

## Modules

### BackgroundSystem.js
**Role**: Coordinator that orchestrates all sub-modules.

**API**:
- `init()` - Initialize all sub-modules
- `update(dt, visibleObjects, playerPosition)` - Update zone sampling and animations
- `draw(ctx, camera, viewportWidth, viewportHeight)` - Render background layers

**Usage**: Called from `Renderer.clear()` every frame.

---

### ZoneSampler.js
**Role**: Samples nearby objects to determine color palette and activity level.

**Features**:
- Throttled updates (500ms interval) for performance
- Distance-weighted color sampling from stars, planets, NPCs, bases
- Activity level calculation (0-1 scale)
- Dominant faction tracking

**Color Sources**:
| Object Type | Weight | Colors From |
|-------------|--------|-------------|
| Stars | 2x | Star color (yellow/orange/white/blue) |
| Planets | 1x | Planet type (rocky/gas/ice/lava/ocean) |
| Bases | 1.5x | Faction colors |
| NPCs | 0.5x | Faction colors |
| Asteroids | Activity only | N/A |

**Activity Weights**:
| Object | Weight |
|--------|--------|
| Base | 0.25 |
| NPC | 0.15 |
| Star | 0.10 |
| Player | 0.10 |
| Planet | 0.05 |
| Asteroid | 0.02 |

---

### PaletteManager.js
**Role**: Manages ultra-slow, imperceptible color transitions between zones.

**Transition Timing**:
| Parameter | Value | Purpose |
|-----------|-------|---------|
| Delay | 5-10 seconds | Wait before blend starts |
| Duration | 45-90 seconds | Full transition time |
| Threshold | 15% | Minimum change to trigger |

**Activity Smoothing**:
- Increases respond at 0.02 rate (faster)
- Decreases respond at 0.008 rate (lingers)

**Palette Structure**:
```javascript
{
  primary: { h, s, l },    // Background base color
  secondary: { h, s, l },  // Secondary background tint
  accent: { h, s, l }      // Star tinting color
}
```

---

### StarfieldRenderer.js
**Role**: Renders three-layer parallax starfield with twinkle and drift effects.

**Layer Configuration**:
| Layer | Stars | Size | Parallax | Drift | Twinkle |
|-------|-------|------|----------|-------|---------|
| Deep | 150 | 1-2px | 0.02x | No | 2% |
| Mid | 80 | 2-4px | 0.05x | Yes | 8% |
| Near | 40 | 3-6px | 0.10x | Yes | 15% |

**Animation Parameters**:
- Twinkle period: 3-8 seconds per star
- Drift pattern: Figure-8 motion
- Drift amplitude: 1-3 pixels
- Drift period: 20-40 seconds

**Performance Optimizations**:
- Seeded random for consistent positions (no regeneration)
- Tile-based world positioning (2000 unit tiles)
- Screen culling (skips off-screen stars)
- Simple circle rendering (no gradients per frame)

---

### NebulaRenderer.js
**Role**: Renders soft cloud formations that respond to activity level.

**Activity-Based Opacity**:
| Activity Range | Opacity | Visual Feel |
|----------------|---------|-------------|
| 0.0 - 0.2 | 2-5% | Whisper-faint |
| 0.2 - 0.5 | 5-12% | Soft presence |
| 0.5 - 0.8 | 12-20% | Visible formations |
| 0.8 - 1.0 | 20-30% | Rich backdrop |

**Cloud Properties**:
- 12 clouds per 3000-unit tile
- Size range: 200-500 units
- Stretch: 0.6-1.4x (horizontal and vertical)
- Hue offset: -15 to +15 degrees from palette

**Animation**:
- Parallax: 0.01x (almost stationary)
- Drift speed: 0.0001 (extremely slow)
- Pulse period: 60-120 seconds
- Rotation: 0.001 rad/s

## Integration

### Renderer Integration

The system is integrated in `client/js/renderer.js`:

```javascript
// In Renderer.init()
if (typeof BackgroundSystem !== "undefined") {
  BackgroundSystem.init();
}

// In Renderer.clear()
if (typeof BackgroundSystem !== "undefined" && BackgroundSystem.initialized) {
  const objects = World.getVisibleObjects(Player.position, range);
  BackgroundSystem.update(dt, objects, Player.position);
  BackgroundSystem.draw(ctx, camera, width, height);
}
```

### Script Loading Order

Scripts must be loaded in this order (see `client/index.html`):

```html
<script src="js/graphics/background/ZoneSampler.js"></script>
<script src="js/graphics/background/PaletteManager.js"></script>
<script src="js/graphics/background/StarfieldRenderer.js"></script>
<script src="js/graphics/background/NebulaRenderer.js"></script>
<script src="js/graphics/background/BackgroundSystem.js"></script>
```

## Performance Characteristics

### Per-Frame Costs
| Operation | Frequency | Cost |
|-----------|-----------|------|
| ZoneSampler.update | Every 500ms | ~1ms |
| PaletteManager.update | Every frame | <0.1ms |
| StarfieldRenderer.draw | Every frame | ~2-4ms |
| NebulaRenderer.draw | Every frame | ~1-2ms |

### Memory Usage
- Stars: ~270 objects (pre-allocated)
- Clouds: 12 objects (pre-allocated)
- No per-frame allocations (optimized)

### Optimization Notes
1. **ZoneSampler** uses 500ms throttling to avoid expensive object iteration
2. **Both renderers** use tile-based culling to skip off-screen elements
3. **No gradients** are created per frame (simple circle rendering)
4. **Seeded random** ensures consistent star positions without regeneration

## Tuning Guide

### Making Transitions Faster/Slower
Edit `PaletteManager.js` config:
```javascript
config: {
  delayMin: 5000,      // Decrease for faster response
  delayMax: 10000,     // Decrease for faster response
  durationMin: 45000,  // Decrease for faster transitions
  durationMax: 90000,  // Decrease for faster transitions
}
```

### Adjusting Nebula Visibility
Edit `NebulaRenderer.js` `getOpacityForActivity()`:
```javascript
// Increase the return values for more visible nebula
if (activity < 0.2) {
  return 0.02 + (activity / 0.2) * 0.03;  // Currently 2-5%
}
```

### Changing Star Density
Edit `StarfieldRenderer.js` layers:
```javascript
layers: [
  { name: 'deep', count: 150, ... },  // Increase for more stars
  { name: 'mid', count: 80, ... },
  { name: 'near', count: 40, ... }
]
```

### Adjusting Zone Sampling Range
Edit `ZoneSampler.js` config:
```javascript
config: {
  sampleRadius: 1000,  // Increase for larger sampling area
  updateInterval: 500, // Decrease for more responsive updates
}
```

## Troubleshooting

### Stars are flickering
- Check if `BackgroundSystem.initialized` is true
- Verify tile size is consistent (2000 in StarfieldRenderer)
- Ensure camera position is passed correctly to draw()

### Colors not changing
- Check ZoneSampler is receiving visible objects
- Verify objects have valid position properties
- Confirm PaletteManager.transition.active is triggering

### Performance issues
- Profile StarfieldRenderer.draw() - may be drawing too many tiles
- Check for gradient creation (should use simple circles)
- Reduce star counts in layer configuration

### Black screen
- Check BackgroundSystem.init() was called
- Verify Logger is defined (or comment out logging)
- Check for JavaScript errors in console

## Future Enhancements

Potential improvements marked for future work:
1. **Perlin noise nebula** - More organic cloud textures
2. **Offscreen canvas caching** - Render nebula to cache, update only on changes
3. **Star brightness by distance** - Stars fade near celestial bodies
4. **Comet/shooting star events** - Rare animated effects
