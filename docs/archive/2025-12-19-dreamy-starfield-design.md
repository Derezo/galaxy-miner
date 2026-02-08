# Dreamy Dynamic Starfield Design

## Overview

Replace the current flickering, static starfield with a dreamy, dynamic background system that responds to the player's surroundings. The background subtly reflects nearby objects (planets, stars, NPCs, faction bases) through color palette shifts and activity-based nebula visibility.

## Goals

- Fix the current flickering/jumping star issue caused by modulo math
- Create a dreamy, atmospheric background with soft stars and nebula clouds
- Dynamically shift colors based on nearby game objects (imperceptibly slow transitions)
- Scale nebula visibility based on area activity (empty = whisper-faint, busy = rich backdrop)
- Subtle star twinkle and gentle drift for dream-like feel

## System Architecture

### 1. Zone Sampler

Analyzes nearby objects to determine color palette and activity level.

**Update frequency:** Every 500ms (performance optimization)

**Color Sources (weighted by inverse distance):**

| Source | Colors |
|--------|--------|
| Stars | `#ffff00`, `#ffaa00`, `#ff6600`, `#ffffff`, `#aaaaff` |
| Planets | Rocky brown, gas tan, ice blue, lava orange, ocean blue |
| NPCs/Bases | Pirate red, scavenger tan, swarm crimson, void purple, rogue orange |
| Asteroids | Subtle grey-brown tones |

**Activity Level:**
- Count objects within radar range (~500-1000 units)
- Weight: bases/stars = high, NPCs = medium, asteroids = low
- Normalize to 0-1 scale
- Smooth over time to prevent jitter

**Output:**
```javascript
{
  palette: { primary: '#...', secondary: '#...', accent: '#...' },
  activityLevel: 0.0 - 1.0
}
```

### 2. Palette Manager

Handles ultra-slow, imperceptible transitions between zones.

**Timing Parameters:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Sample interval | 500ms | Zone re-analysis frequency |
| Change threshold | 15% color difference | Minimum shift to trigger transition |
| Delay before blend | 5-10 seconds | Wait period after detecting new zone |
| Blend duration | 45-90 seconds | Full transition time |
| Activity smoothing | 30 seconds | Activity level adjustment speed |

**Blending Approach:**
- HSL interpolation (smoother than RGB)
- Easing curve slowest at start/end (changes invisible when you might notice)
- Activity responds faster to increases than decreases (areas "wake up" quickly, linger after leaving)

**Default Palette (empty space):**
- Primary: `#0a0a1a` (deep navy)
- Secondary: `#101028` (dark blue-purple)
- Accent: `#c0c0d0` (silver-white for stars)
- Activity baseline: 0.15

### 3. Star Layers

Three depth layers with distinct characteristics:

| Layer | Count | Size | Parallax | Drift | Twinkle |
|-------|-------|------|----------|-------|---------|
| Deep | 150 | 1-2px | 0.02x | None | Rare, subtle |
| Mid | 80 | 2-4px | 0.05x | Very slow | Occasional |
| Near | 40 | 3-6px | 0.10x | Gentle | More frequent |

**Star Rendering:**
- Soft radial gradient (bright center fading to transparent)
- Colors: Base white/silver, tinted 10-20% toward zone palette
- Positions from seeded random (consistent, no resize flicker)

**Twinkle Effect:**
- Random phase offset per star
- Sine-wave brightness: 0.7 to 1.0 range
- ~10% of stars twinkle at any moment
- Cycle: 3-8 seconds per star

**Drift Effect:**
- Tiny circular/figure-8 motion independent of camera
- Amplitude: 1-3 pixels
- Period: 20-40 seconds

### 4. Nebula Layer

Atmospheric clouds responding to activity level.

**Structure:**
- 2-3 large, soft cloud formations per screen area
- Procedurally generated using layered noise patterns
- Positions seeded by world coordinates (consistent across travel)
- Very slow parallax: 0.01x (almost stationary)

**Activity-Based Opacity:**

| Activity Level | Opacity | Visual Feel |
|----------------|---------|-------------|
| 0.0 - 0.2 | 2-5% | Whisper-faint, barely there |
| 0.2 - 0.5 | 5-12% | Soft presence, muted atmosphere |
| 0.5 - 0.8 | 12-20% | Visible formations, cosmic depth |
| 0.8 - 1.0 | 20-30% | Rich backdrop, vibrant energy |

**Rendering:**
- Large radial gradients with irregular edges
- 2-3 colors from zone palette blended
- Multiple overlapping clouds at different opacities
- Subtle internal texture variation

**Animation:**
- Extremely slow drift (imperceptible moment-to-moment)
- Gentle opacity pulse tied to activity
- Period: 60-120 seconds for full cycle

**Performance:**
- Render to offscreen canvas
- Update only on significant palette/activity change
- Composite onto main canvas each frame

## File Structure

```
client/js/graphics/
├── background/
│   ├── BackgroundSystem.js    # Main coordinator
│   ├── ZoneSampler.js         # Analyzes nearby objects
│   ├── PaletteManager.js      # Handles slow transitions
│   ├── StarfieldRenderer.js   # Three-layer star system
│   └── NebulaRenderer.js      # Activity-based clouds
```

## Integration

1. `BackgroundSystem.init()` called from `Renderer.init()`
2. `BackgroundSystem.update(dt, visibleObjects, playerPosition)` called each frame
3. `BackgroundSystem.draw(ctx)` called from `Renderer.clear()` (replaces current `drawStarfield()`)

## Current Bug Fix

The existing `drawStarfield()` flickers because:
- `(this.camera.x * 0.1) % 100` creates discontinuity every 100 units
- `% this.canvas.width` shifts stars on window resize

**Solution:**
- Star positions based on world-space seed, not screen modulo
- Camera offset applied as smooth translation, not modulo
- Positions regenerated only on significant camera movement (hybrid tile/offset approach)
