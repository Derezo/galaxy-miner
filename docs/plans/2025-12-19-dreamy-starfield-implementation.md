# Dreamy Dynamic Starfield Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flickering static starfield with a dreamy, zone-aware background system featuring soft stars, dynamic color palettes, and activity-responsive nebula clouds.

**Architecture:** Four modules in `client/js/graphics/background/`: ZoneSampler analyzes nearby objects for color/activity, PaletteManager handles ultra-slow transitions, StarfieldRenderer draws three parallax star layers with soft rendering, and NebulaRenderer creates activity-scaled cloud formations. BackgroundSystem coordinates all modules.

**Tech Stack:** Vanilla JavaScript, HTML5 Canvas 2D, radial gradients, seeded random (consistent world positions)

---

## Task 1: Create BackgroundSystem Scaffold

**Files:**
- Create: `client/js/graphics/background/BackgroundSystem.js`

**Step 1: Create the directory and main coordinator module**

```javascript
/**
 * Background System - Dreamy dynamic starfield with zone-aware colors
 * Coordinates ZoneSampler, PaletteManager, StarfieldRenderer, and NebulaRenderer
 */

const BackgroundSystem = {
  initialized: false,

  // Sub-modules (will be populated as we create them)
  sampler: null,
  palette: null,
  stars: null,
  nebula: null,

  init() {
    // Initialize sub-modules when they exist
    if (typeof ZoneSampler !== 'undefined') {
      this.sampler = ZoneSampler;
      this.sampler.init();
    }

    if (typeof PaletteManager !== 'undefined') {
      this.palette = PaletteManager;
      this.palette.init();
    }

    if (typeof StarfieldRenderer !== 'undefined') {
      this.stars = StarfieldRenderer;
      this.stars.init();
    }

    if (typeof NebulaRenderer !== 'undefined') {
      this.nebula = NebulaRenderer;
      this.nebula.init();
    }

    this.initialized = true;
    Logger.log('BackgroundSystem initialized');
  },

  /**
   * Update background state
   * @param {number} dt - Delta time in seconds
   * @param {Object} visibleObjects - Objects from World.getVisibleObjects()
   * @param {{x: number, y: number}} playerPosition - Player world position
   */
  update(dt, visibleObjects, playerPosition) {
    if (!this.initialized) return;

    // Sample zone colors and activity from nearby objects
    if (this.sampler) {
      this.sampler.update(visibleObjects, playerPosition);
    }

    // Update palette transitions
    if (this.palette && this.sampler) {
      this.palette.update(dt, this.sampler.getZoneData());
    }

    // Update star animations (twinkle, drift)
    if (this.stars) {
      this.stars.update(dt);
    }

    // Update nebula animations
    if (this.nebula && this.palette) {
      this.nebula.update(dt, this.palette.getActivityLevel());
    }
  },

  /**
   * Draw the background layers
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera - Camera position
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  draw(ctx, camera, viewportWidth, viewportHeight) {
    if (!this.initialized) {
      // Fallback to solid background if not initialized
      ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      return;
    }

    const palette = this.palette ? this.palette.getCurrentPalette() : null;

    // Draw nebula first (furthest back)
    if (this.nebula) {
      this.nebula.draw(ctx, camera, viewportWidth, viewportHeight, palette);
    }

    // Draw stars on top of nebula
    if (this.stars) {
      this.stars.draw(ctx, camera, viewportWidth, viewportHeight, palette);
    }
  }
};
```

**Step 2: Verify file was created**

Run: `ls -la client/js/graphics/background/`
Expected: `BackgroundSystem.js` exists

**Step 3: Commit**

```bash
git add client/js/graphics/background/BackgroundSystem.js
git commit -m "feat(background): add BackgroundSystem scaffold"
```

---

## Task 2: Create ZoneSampler Module

**Files:**
- Create: `client/js/graphics/background/ZoneSampler.js`

**Step 1: Create the zone sampling module**

```javascript
/**
 * Zone Sampler - Analyzes nearby objects for color palette and activity level
 * Samples colors from stars, planets, NPCs, bases weighted by distance
 */

const ZoneSampler = {
  // Cached zone data
  zoneData: {
    colors: [],           // Array of {color, weight} objects
    activityLevel: 0.15,  // 0-1 scale, baseline 0.15
    dominantFaction: null
  },

  // Sampling configuration
  config: {
    sampleRadius: 1000,   // Units to sample within
    updateInterval: 500,  // ms between full recalculations
    lastUpdate: 0
  },

  // Color mappings for different object types
  colorSources: {
    // Star colors (from constants)
    stars: {
      '#ffff00': { h: 60, s: 100, l: 50 },   // Yellow
      '#ffaa00': { h: 40, s: 100, l: 50 },   // Orange
      '#ff6600': { h: 25, s: 100, l: 50 },   // Red-orange
      '#ffffff': { h: 220, s: 20, l: 90 },   // White (slight blue)
      '#aaaaff': { h: 240, s: 50, l: 80 }    // Blue
    },
    // Planet type colors
    planets: {
      rocky: { h: 25, s: 60, l: 35 },        // Brown
      gas: { h: 35, s: 50, l: 70 },          // Tan
      ice: { h: 200, s: 60, l: 75 },         // Light blue
      lava: { h: 15, s: 100, l: 55 },        // Orange-red
      ocean: { h: 220, s: 70, l: 50 }        // Blue
    },
    // Faction colors (from FACTION_COLOR_PALETTES)
    factions: {
      pirate: { h: 10, s: 100, l: 50 },      // Red-orange
      scavenger: { h: 45, s: 70, l: 45 },    // Yellow-brown
      swarm: { h: 0, s: 70, l: 25 },         // Dark red
      void: { h: 280, s: 100, l: 50 },       // Purple
      rogue_miner: { h: 35, s: 100, l: 50 }  // Orange
    }
  },

  // Activity weights for different object types
  activityWeights: {
    star: 0.1,
    planet: 0.05,
    asteroid: 0.02,
    npc: 0.15,
    base: 0.25,
    player: 0.1
  },

  init() {
    this.zoneData = {
      colors: [],
      activityLevel: 0.15,
      dominantFaction: null
    };
    this.config.lastUpdate = 0;
    Logger.log('ZoneSampler initialized');
  },

  /**
   * Update zone sampling
   * @param {Object} visibleObjects - From World.getVisibleObjects()
   * @param {{x: number, y: number}} playerPosition
   */
  update(visibleObjects, playerPosition) {
    const now = Date.now();
    if (now - this.config.lastUpdate < this.config.updateInterval) {
      return; // Throttle updates
    }
    this.config.lastUpdate = now;

    const colors = [];
    let totalActivity = 0.15; // Baseline
    const factionCounts = {};

    // Sample stars
    if (visibleObjects.stars) {
      for (const star of visibleObjects.stars) {
        const dist = this.getDistance(playerPosition, star);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const hsl = this.colorSources.stars[star.color];
        if (hsl) {
          colors.push({ ...hsl, weight: weight * 2 }); // Stars are prominent
        }
        totalActivity += this.activityWeights.star * weight;
      }
    }

    // Sample planets
    if (visibleObjects.planets) {
      for (const planet of visibleObjects.planets) {
        const dist = this.getDistance(playerPosition, planet);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const hsl = this.colorSources.planets[planet.type];
        if (hsl) {
          colors.push({ ...hsl, weight });
        }
        totalActivity += this.activityWeights.planet * weight;
      }
    }

    // Sample asteroids (just for activity, minimal color contribution)
    if (visibleObjects.asteroids) {
      for (const asteroid of visibleObjects.asteroids) {
        const dist = this.getDistance(playerPosition, asteroid);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        totalActivity += this.activityWeights.asteroid * weight;
      }
    }

    // Sample bases
    if (visibleObjects.bases) {
      for (const base of visibleObjects.bases) {
        const dist = this.getDistance(playerPosition, base);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const faction = base.faction;
        const hsl = this.colorSources.factions[faction];
        if (hsl) {
          colors.push({ ...hsl, weight: weight * 1.5 });
          factionCounts[faction] = (factionCounts[faction] || 0) + weight;
        }
        totalActivity += this.activityWeights.base * weight;
      }
    }

    // Sample NPCs from Entities
    if (typeof Entities !== 'undefined' && Entities.npcs) {
      for (const [id, npc] of Entities.npcs) {
        const dist = this.getDistance(playerPosition, npc.position);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        const faction = npc.faction;
        const hsl = this.colorSources.factions[faction];
        if (hsl) {
          colors.push({ ...hsl, weight: weight * 0.5 });
          factionCounts[faction] = (factionCounts[faction] || 0) + weight;
        }
        totalActivity += this.activityWeights.npc * weight;
      }
    }

    // Sample other players
    if (typeof Entities !== 'undefined' && Entities.players) {
      for (const [id, player] of Entities.players) {
        const dist = this.getDistance(playerPosition, player.position);
        if (dist > this.config.sampleRadius) continue;

        const weight = this.getDistanceWeight(dist);
        totalActivity += this.activityWeights.player * weight;
      }
    }

    // Determine dominant faction
    let dominantFaction = null;
    let maxFactionWeight = 0;
    for (const [faction, weight] of Object.entries(factionCounts)) {
      if (weight > maxFactionWeight) {
        maxFactionWeight = weight;
        dominantFaction = faction;
      }
    }

    // Update zone data
    this.zoneData.colors = colors;
    this.zoneData.activityLevel = Math.min(1, totalActivity);
    this.zoneData.dominantFaction = dominantFaction;
  },

  /**
   * Get distance between player and object
   */
  getDistance(playerPos, obj) {
    const x = (obj.x !== undefined ? obj.x : obj.position?.x) || 0;
    const y = (obj.y !== undefined ? obj.y : obj.position?.y) || 0;
    const dx = playerPos.x - x;
    const dy = playerPos.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Get weight based on distance (inverse, 1 at 0, 0 at sampleRadius)
   */
  getDistanceWeight(dist) {
    return Math.max(0, 1 - (dist / this.config.sampleRadius));
  },

  /**
   * Get current zone data for palette manager
   */
  getZoneData() {
    return this.zoneData;
  }
};
```

**Step 2: Verify file was created**

Run: `ls -la client/js/graphics/background/`
Expected: `ZoneSampler.js` exists

**Step 3: Commit**

```bash
git add client/js/graphics/background/ZoneSampler.js
git commit -m "feat(background): add ZoneSampler for color/activity analysis"
```

---

## Task 3: Create PaletteManager Module

**Files:**
- Create: `client/js/graphics/background/PaletteManager.js`

**Step 1: Create the palette transition module**

```javascript
/**
 * Palette Manager - Handles ultra-slow, imperceptible color transitions
 * Blends zone colors into a cohesive palette over 45-90 seconds
 */

const PaletteManager = {
  // Current rendered palette
  currentPalette: {
    primary: { h: 220, s: 30, l: 8 },    // Deep navy
    secondary: { h: 230, s: 25, l: 12 }, // Dark blue-purple
    accent: { h: 220, s: 10, l: 75 }     // Silver-white
  },

  // Target palette (what we're transitioning to)
  targetPalette: {
    primary: { h: 220, s: 30, l: 8 },
    secondary: { h: 230, s: 25, l: 12 },
    accent: { h: 220, s: 10, l: 75 }
  },

  // Activity level (0-1)
  currentActivity: 0.15,
  targetActivity: 0.15,

  // Transition state
  transition: {
    active: false,
    delay: 0,           // Countdown before blend starts
    progress: 0,        // 0-1 blend progress
    duration: 60000     // ms for full transition
  },

  // Configuration
  config: {
    delayMin: 5000,          // 5 seconds minimum delay
    delayMax: 10000,         // 10 seconds maximum delay
    durationMin: 45000,      // 45 seconds minimum blend
    durationMax: 90000,      // 90 seconds maximum blend
    changeThreshold: 0.15,   // 15% difference to trigger transition
    activitySmoothingUp: 0.02,    // Activity responds faster to increases
    activitySmoothingDown: 0.008  // Activity lingers after leaving
  },

  init() {
    // Start with default dark palette
    this.currentPalette = {
      primary: { h: 220, s: 30, l: 8 },
      secondary: { h: 230, s: 25, l: 12 },
      accent: { h: 220, s: 10, l: 75 }
    };
    this.targetPalette = { ...this.currentPalette };
    this.currentActivity = 0.15;
    this.targetActivity = 0.15;
    this.transition.active = false;
    Logger.log('PaletteManager initialized');
  },

  /**
   * Update palette transitions
   * @param {number} dt - Delta time in seconds
   * @param {Object} zoneData - From ZoneSampler.getZoneData()
   */
  update(dt, zoneData) {
    // Calculate new target palette from zone colors
    const newTarget = this.calculateTargetPalette(zoneData.colors);
    this.targetActivity = zoneData.activityLevel;

    // Check if palette changed significantly
    if (!this.transition.active) {
      const diff = this.getPaletteDifference(this.currentPalette, newTarget);
      if (diff > this.config.changeThreshold) {
        // Start transition with delay
        this.targetPalette = newTarget;
        this.transition.active = true;
        this.transition.delay = this.config.delayMin +
          Math.random() * (this.config.delayMax - this.config.delayMin);
        this.transition.progress = 0;
        this.transition.duration = this.config.durationMin +
          Math.random() * (this.config.durationMax - this.config.durationMin);
      }
    }

    // Update transition
    if (this.transition.active) {
      if (this.transition.delay > 0) {
        // Still in delay phase
        this.transition.delay -= dt * 1000;
      } else {
        // Blending phase
        this.transition.progress += (dt * 1000) / this.transition.duration;

        if (this.transition.progress >= 1) {
          // Transition complete
          this.currentPalette = { ...this.targetPalette };
          this.transition.active = false;
          this.transition.progress = 0;
        } else {
          // Interpolate with easing (slow at start and end)
          const eased = this.easeInOutCubic(this.transition.progress);
          this.currentPalette = this.interpolatePalette(
            this.currentPalette,
            this.targetPalette,
            eased * 0.02  // Very small step per frame
          );
        }
      }
    }

    // Smooth activity level (faster up, slower down)
    const activityDiff = this.targetActivity - this.currentActivity;
    const smoothing = activityDiff > 0
      ? this.config.activitySmoothingUp
      : this.config.activitySmoothingDown;
    this.currentActivity += activityDiff * smoothing;
  },

  /**
   * Calculate target palette from weighted zone colors
   */
  calculateTargetPalette(colors) {
    if (!colors || colors.length === 0) {
      // Return default dark palette
      return {
        primary: { h: 220, s: 30, l: 8 },
        secondary: { h: 230, s: 25, l: 12 },
        accent: { h: 220, s: 10, l: 75 }
      };
    }

    // Weighted average of colors
    let totalWeight = 0;
    let hSum = 0, sSum = 0, lSum = 0;

    for (const color of colors) {
      totalWeight += color.weight;
      hSum += color.h * color.weight;
      sSum += color.s * color.weight;
      lSum += color.l * color.weight;
    }

    if (totalWeight === 0) {
      return this.currentPalette;
    }

    const avgH = hSum / totalWeight;
    const avgS = sSum / totalWeight;
    const avgL = lSum / totalWeight;

    // Create palette based on average, but keep it dark for background
    return {
      primary: {
        h: avgH,
        s: Math.min(avgS * 0.4, 40),  // Desaturate for background
        l: Math.min(avgL * 0.15, 12)  // Keep very dark
      },
      secondary: {
        h: (avgH + 20) % 360,  // Slight hue shift
        s: Math.min(avgS * 0.3, 35),
        l: Math.min(avgL * 0.2, 15)
      },
      accent: {
        h: avgH,
        s: Math.min(avgS * 0.3, 30),  // Muted accent
        l: Math.min(avgL * 0.8 + 30, 80)  // Lighter for stars
      }
    };
  },

  /**
   * Get difference between two palettes (0-1 scale)
   */
  getPaletteDifference(a, b) {
    const hDiff = Math.abs(a.primary.h - b.primary.h) / 180;
    const sDiff = Math.abs(a.primary.s - b.primary.s) / 100;
    const lDiff = Math.abs(a.primary.l - b.primary.l) / 50;
    return (hDiff + sDiff + lDiff) / 3;
  },

  /**
   * Interpolate between two palettes
   */
  interpolatePalette(from, to, t) {
    return {
      primary: this.interpolateHSL(from.primary, to.primary, t),
      secondary: this.interpolateHSL(from.secondary, to.secondary, t),
      accent: this.interpolateHSL(from.accent, to.accent, t)
    };
  },

  /**
   * Interpolate HSL values
   */
  interpolateHSL(from, to, t) {
    // Handle hue wrapping
    let hDiff = to.h - from.h;
    if (hDiff > 180) hDiff -= 360;
    if (hDiff < -180) hDiff += 360;

    return {
      h: (from.h + hDiff * t + 360) % 360,
      s: from.s + (to.s - from.s) * t,
      l: from.l + (to.l - from.l) * t
    };
  },

  /**
   * Easing function - slow at start and end
   */
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },

  /**
   * Get current palette as CSS-ready HSL strings
   */
  getCurrentPalette() {
    return {
      primary: this.hslToString(this.currentPalette.primary),
      secondary: this.hslToString(this.currentPalette.secondary),
      accent: this.hslToString(this.currentPalette.accent),
      // Also provide raw HSL for gradient manipulation
      primaryHSL: { ...this.currentPalette.primary },
      secondaryHSL: { ...this.currentPalette.secondary },
      accentHSL: { ...this.currentPalette.accent }
    };
  },

  /**
   * Get current activity level
   */
  getActivityLevel() {
    return this.currentActivity;
  },

  /**
   * Convert HSL object to CSS string
   */
  hslToString(hsl) {
    return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
  }
};
```

**Step 2: Verify file was created**

Run: `ls -la client/js/graphics/background/`
Expected: `PaletteManager.js` exists

**Step 3: Commit**

```bash
git add client/js/graphics/background/PaletteManager.js
git commit -m "feat(background): add PaletteManager for slow color transitions"
```

---

## Task 4: Create StarfieldRenderer Module

**Files:**
- Create: `client/js/graphics/background/StarfieldRenderer.js`

**Step 1: Create the three-layer star rendering module**

```javascript
/**
 * Starfield Renderer - Three-layer parallax stars with soft rendering
 * Features twinkle effects and gentle drift animation
 */

const StarfieldRenderer = {
  // Star layers configuration
  layers: [
    { name: 'deep', count: 150, sizeMin: 1, sizeMax: 2, parallax: 0.02, drift: false, twinkleChance: 0.02 },
    { name: 'mid', count: 80, sizeMin: 2, sizeMax: 4, parallax: 0.05, drift: true, twinkleChance: 0.08 },
    { name: 'near', count: 40, sizeMin: 3, sizeMax: 6, parallax: 0.10, drift: true, twinkleChance: 0.15 }
  ],

  // Generated star data per layer
  stars: [],

  // Animation state
  time: 0,

  // Seeded random for consistent star positions
  seed: 12345,

  init() {
    this.generateStars();
    this.time = 0;
    Logger.log('StarfieldRenderer initialized with ' +
      this.stars.reduce((sum, layer) => sum + layer.length, 0) + ' stars');
  },

  /**
   * Generate star positions using seeded random
   * Stars are placed in a large world-space grid that tiles seamlessly
   */
  generateStars() {
    this.stars = [];
    const tileSize = 2000; // World units per tile

    for (const layer of this.layers) {
      const layerStars = [];

      // Reset seed for consistent generation per layer
      let seed = this.seed + this.layers.indexOf(layer) * 1000;

      for (let i = 0; i < layer.count; i++) {
        // Seeded random function
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand1 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand2 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand3 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand4 = seed / 0x7fffffff;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const rand5 = seed / 0x7fffffff;

        layerStars.push({
          // Position within tile (will be offset by camera)
          tileX: rand1 * tileSize,
          tileY: rand2 * tileSize,
          size: layer.sizeMin + rand3 * (layer.sizeMax - layer.sizeMin),
          // Twinkle state
          twinklePhase: rand4 * Math.PI * 2,
          twinklePeriod: 3 + rand5 * 5, // 3-8 seconds
          isTwinkling: rand4 < layer.twinkleChance,
          // Drift state (for mid/near layers)
          driftPhase: rand5 * Math.PI * 2,
          driftPeriod: 20 + rand4 * 20, // 20-40 seconds
          driftAmplitude: layer.drift ? (1 + rand3 * 2) : 0, // 1-3 pixels
          // Base brightness
          baseBrightness: 0.4 + rand3 * 0.4 // 0.4-0.8
        });
      }

      this.stars.push(layerStars);
    }
  },

  /**
   * Update star animations
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;
  },

  /**
   * Draw all star layers
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @param {Object} palette - From PaletteManager
   */
  draw(ctx, camera, viewportWidth, viewportHeight, palette) {
    const tileSize = 2000;

    // Draw each layer (back to front)
    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      const layer = this.layers[layerIndex];
      const layerStars = this.stars[layerIndex];

      // Calculate camera offset for this layer's parallax
      const parallaxX = camera.x * layer.parallax;
      const parallaxY = camera.y * layer.parallax;

      // Determine which tiles are visible
      const startTileX = Math.floor((parallaxX - viewportWidth) / tileSize);
      const endTileX = Math.ceil((parallaxX + viewportWidth * 2) / tileSize);
      const startTileY = Math.floor((parallaxY - viewportHeight) / tileSize);
      const endTileY = Math.ceil((parallaxY + viewportHeight * 2) / tileSize);

      // Draw stars in visible tiles
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        for (let tileY = startTileY; tileY <= endTileY; tileY++) {
          for (const star of layerStars) {
            // Calculate screen position
            let screenX = star.tileX + tileX * tileSize - parallaxX;
            let screenY = star.tileY + tileY * tileSize - parallaxY;

            // Apply drift if enabled
            if (star.driftAmplitude > 0) {
              const driftT = this.time / star.driftPeriod;
              // Figure-8 motion
              screenX += Math.sin(driftT * Math.PI * 2 + star.driftPhase) * star.driftAmplitude;
              screenY += Math.sin(driftT * Math.PI * 4 + star.driftPhase) * star.driftAmplitude * 0.5;
            }

            // Skip if off screen
            if (screenX < -10 || screenX > viewportWidth + 10 ||
                screenY < -10 || screenY > viewportHeight + 10) {
              continue;
            }

            // Calculate brightness with twinkle
            let brightness = star.baseBrightness;
            if (star.isTwinkling) {
              const twinkleT = this.time / star.twinklePeriod;
              const twinkle = Math.sin(twinkleT * Math.PI * 2 + star.twinklePhase);
              brightness = star.baseBrightness * (0.7 + twinkle * 0.3);
            }

            // Draw the star
            this.drawStar(ctx, screenX, screenY, star.size, brightness, palette, layerIndex);
          }
        }
      }
    }
  },

  /**
   * Draw a single soft-gradient star
   */
  drawStar(ctx, x, y, size, brightness, palette, layerIndex) {
    ctx.save();
    ctx.globalAlpha = brightness;

    // Get accent color from palette, default to white
    let baseColor = '#ffffff';
    if (palette && palette.accentHSL) {
      const hsl = palette.accentHSL;
      // Tint star color slightly toward palette
      const tintStrength = 0.15 + layerIndex * 0.05; // Nearer layers more tinted
      const h = hsl.h;
      const s = hsl.s * tintStrength;
      const l = 85 + (100 - 85) * (1 - tintStrength);
      baseColor = `hsl(${h}, ${s}%, ${l}%)`;
    }

    // Soft radial gradient
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, baseColor);
    gradient.addColorStop(0.7, baseColor + '40');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
};
```

**Step 2: Verify file was created**

Run: `ls -la client/js/graphics/background/`
Expected: `StarfieldRenderer.js` exists

**Step 3: Commit**

```bash
git add client/js/graphics/background/StarfieldRenderer.js
git commit -m "feat(background): add StarfieldRenderer with parallax and twinkle"
```

---

## Task 5: Create NebulaRenderer Module

**Files:**
- Create: `client/js/graphics/background/NebulaRenderer.js`

**Step 1: Create the activity-responsive nebula cloud renderer**

```javascript
/**
 * Nebula Renderer - Soft cloud formations that respond to activity level
 * Creates dreamy atmospheric wisps with zone-aware colors
 */

const NebulaRenderer = {
  // Nebula cloud data
  clouds: [],

  // Configuration
  config: {
    cloudCount: 12,         // Number of clouds in the tile
    tileSize: 3000,         // World units per tile
    parallax: 0.01,         // Very slow parallax (almost stationary)
    baseSizeMin: 200,
    baseSizeMax: 500,
    driftSpeed: 0.0001      // Extremely slow drift
  },

  // Animation state
  time: 0,
  currentActivity: 0.15,

  // Cached offscreen canvas for performance
  offscreenCanvas: null,
  offscreenCtx: null,
  lastPaletteHash: '',
  lastActivity: 0,
  needsRedraw: true,

  // Seeded random
  seed: 54321,

  init() {
    this.generateClouds();
    this.time = 0;
    this.currentActivity = 0.15;
    this.needsRedraw = true;
    Logger.log('NebulaRenderer initialized with ' + this.clouds.length + ' clouds');
  },

  /**
   * Generate cloud positions and properties using seeded random
   */
  generateClouds() {
    this.clouds = [];
    let seed = this.seed;

    const seededRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let i = 0; i < this.config.cloudCount; i++) {
      this.clouds.push({
        // Position within tile
        tileX: seededRandom() * this.config.tileSize,
        tileY: seededRandom() * this.config.tileSize,
        // Size and shape
        baseSize: this.config.baseSizeMin +
          seededRandom() * (this.config.baseSizeMax - this.config.baseSizeMin),
        stretchX: 0.6 + seededRandom() * 0.8,  // 0.6-1.4 horizontal stretch
        stretchY: 0.6 + seededRandom() * 0.8,  // 0.6-1.4 vertical stretch
        rotation: seededRandom() * Math.PI * 2,
        // Color variation
        colorOffset: seededRandom() * 30 - 15,  // -15 to +15 hue shift
        usePrimary: seededRandom() > 0.5,       // Primary or secondary color
        // Animation
        driftPhase: seededRandom() * Math.PI * 2,
        pulsePhase: seededRandom() * Math.PI * 2,
        pulsePeriod: 60 + seededRandom() * 60   // 60-120 seconds
      });
    }
  },

  /**
   * Update nebula animation state
   * @param {number} dt - Delta time in seconds
   * @param {number} activityLevel - From PaletteManager
   */
  update(dt, activityLevel) {
    this.time += dt;

    // Smoothly transition activity level
    const diff = activityLevel - this.currentActivity;
    this.currentActivity += diff * 0.01;

    // Check if we need to redraw offscreen buffer
    if (Math.abs(this.currentActivity - this.lastActivity) > 0.02) {
      this.needsRedraw = true;
    }
  },

  /**
   * Draw nebula clouds
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}} camera
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @param {Object} palette - From PaletteManager
   */
  draw(ctx, camera, viewportWidth, viewportHeight, palette) {
    // Fill background first
    ctx.fillStyle = palette ? palette.primary : '#000011';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Calculate opacity based on activity level
    // 0.0-0.2 activity -> 2-5% opacity
    // 0.2-0.5 activity -> 5-12% opacity
    // 0.5-0.8 activity -> 12-20% opacity
    // 0.8-1.0 activity -> 20-30% opacity
    const baseOpacity = this.getOpacityForActivity(this.currentActivity);

    // Add subtle pulse based on activity
    const pulseAmount = this.currentActivity * 0.05;
    const pulse = 1 + Math.sin(this.time * 0.5) * pulseAmount;
    const opacity = baseOpacity * pulse;

    if (opacity < 0.01) return; // Skip if invisible

    const tileSize = this.config.tileSize;
    const parallaxX = camera.x * this.config.parallax;
    const parallaxY = camera.y * this.config.parallax;

    // Determine visible tiles
    const startTileX = Math.floor((parallaxX - viewportWidth) / tileSize) - 1;
    const endTileX = Math.ceil((parallaxX + viewportWidth * 2) / tileSize) + 1;
    const startTileY = Math.floor((parallaxY - viewportHeight) / tileSize) - 1;
    const endTileY = Math.ceil((parallaxY + viewportHeight * 2) / tileSize) + 1;

    // Draw clouds
    ctx.save();
    ctx.globalAlpha = opacity;

    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        for (const cloud of this.clouds) {
          // Calculate screen position with drift
          const driftT = this.time * this.config.driftSpeed;
          const driftX = Math.sin(driftT + cloud.driftPhase) * 50;
          const driftY = Math.cos(driftT * 0.7 + cloud.driftPhase) * 30;

          const screenX = cloud.tileX + tileX * tileSize - parallaxX + driftX;
          const screenY = cloud.tileY + tileY * tileSize - parallaxY + driftY;

          // Skip if too far off screen
          const margin = cloud.baseSize * 2;
          if (screenX < -margin || screenX > viewportWidth + margin ||
              screenY < -margin || screenY > viewportHeight + margin) {
            continue;
          }

          this.drawCloud(ctx, screenX, screenY, cloud, palette);
        }
      }
    }

    ctx.restore();
  },

  /**
   * Draw a single nebula cloud
   */
  drawCloud(ctx, x, y, cloud, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cloud.rotation + this.time * 0.001); // Very slow rotation
    ctx.scale(cloud.stretchX, cloud.stretchY);

    // Get color from palette with cloud's offset
    let hsl;
    if (palette && (cloud.usePrimary ? palette.primaryHSL : palette.secondaryHSL)) {
      const baseHSL = cloud.usePrimary ? palette.primaryHSL : palette.secondaryHSL;
      hsl = {
        h: (baseHSL.h + cloud.colorOffset + 360) % 360,
        s: baseHSL.s + 10,  // Slightly more saturated for nebula
        l: baseHSL.l + 5    // Slightly lighter
      };
    } else {
      hsl = { h: 220, s: 30, l: 15 };
    }

    // Pulse size based on cloud's phase
    const pulseT = this.time / cloud.pulsePeriod;
    const sizePulse = 1 + Math.sin(pulseT * Math.PI * 2 + cloud.pulsePhase) * 0.1;
    const size = cloud.baseSize * sizePulse;

    // Create soft radial gradient
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l + 10}%, 0.4)`);
    gradient.addColorStop(0.3, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.25)`);
    gradient.addColorStop(0.6, `hsla(${hsl.h}, ${hsl.s * 0.8}%, ${hsl.l}%, 0.1)`);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Calculate opacity based on activity level
   */
  getOpacityForActivity(activity) {
    if (activity < 0.2) {
      // 0.0-0.2 -> 2-5%
      return 0.02 + (activity / 0.2) * 0.03;
    } else if (activity < 0.5) {
      // 0.2-0.5 -> 5-12%
      return 0.05 + ((activity - 0.2) / 0.3) * 0.07;
    } else if (activity < 0.8) {
      // 0.5-0.8 -> 12-20%
      return 0.12 + ((activity - 0.5) / 0.3) * 0.08;
    } else {
      // 0.8-1.0 -> 20-30%
      return 0.20 + ((activity - 0.8) / 0.2) * 0.10;
    }
  }
};
```

**Step 2: Verify file was created**

Run: `ls -la client/js/graphics/background/`
Expected: `NebulaRenderer.js` exists

**Step 3: Commit**

```bash
git add client/js/graphics/background/NebulaRenderer.js
git commit -m "feat(background): add NebulaRenderer with activity-based opacity"
```

---

## Task 6: Add Script Tags to HTML

**Files:**
- Modify: `client/index.html:261-262` (after particles.js, before star-effects.js)

**Step 1: Add the four new script tags**

Insert after line 261 (`js/graphics/particles.js`) and before line 262 (`js/graphics/star-effects.js`):

```html
  <script src="js/graphics/background/ZoneSampler.js"></script>
  <script src="js/graphics/background/PaletteManager.js"></script>
  <script src="js/graphics/background/StarfieldRenderer.js"></script>
  <script src="js/graphics/background/NebulaRenderer.js"></script>
  <script src="js/graphics/background/BackgroundSystem.js"></script>
```

**Step 2: Verify scripts are included**

Run: `grep -n "background/" client/index.html`
Expected: Shows 5 lines with the new script paths

**Step 3: Commit**

```bash
git add client/index.html
git commit -m "feat(background): add script tags for background system modules"
```

---

## Task 7: Integrate with Renderer

**Files:**
- Modify: `client/js/renderer.js:73-76` (add init call)
- Modify: `client/js/renderer.js:354-378` (replace drawStarfield call and method)

**Step 1: Add BackgroundSystem.init() call in Renderer.init()**

Find the section around line 73-76 where StarEffects is initialized and add BackgroundSystem init:

```javascript
    // Initialize star effects if available
    if (typeof StarEffects !== "undefined") {
      StarEffects.init();
    }

    // Initialize background system if available
    if (typeof BackgroundSystem !== "undefined") {
      BackgroundSystem.init();
    }
```

**Step 2: Update Renderer.clear() to use BackgroundSystem**

Replace the clear() method (around lines 354-379):

```javascript
  clear() {
    // Use new background system if available
    if (typeof BackgroundSystem !== "undefined" && BackgroundSystem.initialized) {
      // Get visible objects for zone sampling
      if (typeof Player !== "undefined" && typeof World !== "undefined") {
        const objects = World.getVisibleObjects(
          Player.position,
          Math.max(this.width, this.height) * 2
        );
        BackgroundSystem.update(this.lastDt, objects, Player.position);
      }

      BackgroundSystem.draw(this.ctx, this.camera, this.width, this.height);
    } else {
      // Fallback to old starfield
      this.ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.drawStarfield();
    }
  },

  drawStarfield() {
    // Legacy fallback - simple static starfield
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";

    const offsetX = (this.camera.x * 0.1) % 100;
    const offsetY = (this.camera.y * 0.1) % 100;

    for (let i = 0; i < 100; i++) {
      const x = ((i * 73) % this.width) - offsetX;
      const y = ((i * 137) % this.height) - offsetY;
      const size = (i % 3) + 1;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  },
```

**Step 3: Verify changes**

Run: `grep -n "BackgroundSystem" client/js/renderer.js`
Expected: Shows lines with BackgroundSystem references

**Step 4: Commit**

```bash
git add client/js/renderer.js
git commit -m "feat(background): integrate BackgroundSystem with Renderer"
```

---

## Task 8: Test and Verify

**Step 1: Start the development server**

Run: `npm run dev`
Expected: Server starts without errors

**Step 2: Open browser and verify**

1. Open `http://localhost:3388` in browser
2. Login and spawn into the game
3. Observe background:
   - Should see soft stars instead of hard squares
   - Stars should not flicker when moving or resizing
   - Faint nebula clouds should be visible in background
   - Moving toward bases/NPCs should slowly shift colors

**Step 3: Test edge cases**

1. Resize browser window - stars should not jump
2. Fly to empty space - nebula should fade to whisper-faint
3. Fly to busy area with NPCs - nebula should become more visible
4. Fly past stars - background colors should slowly shift to match

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(background): complete dreamy dynamic starfield implementation

- ZoneSampler: analyzes nearby objects for color/activity
- PaletteManager: ultra-slow 45-90s transitions between zones
- StarfieldRenderer: 3-layer parallax with twinkle and drift
- NebulaRenderer: activity-responsive cloud formations
- Fixes flickering/jumping stars from modulo math
- Background colors shift based on nearby stars, planets, factions"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `BackgroundSystem.js` | Main coordinator module |
| 2 | `ZoneSampler.js` | Object analysis for colors/activity |
| 3 | `PaletteManager.js` | Slow transition handling |
| 4 | `StarfieldRenderer.js` | Three-layer soft stars |
| 5 | `NebulaRenderer.js` | Activity-based nebula clouds |
| 6 | `index.html` | Script tag additions |
| 7 | `renderer.js` | Integration with existing renderer |
| 8 | Manual testing | Verify visual behavior |
