// Galaxy Miner - Canvas Renderer
// Integrated with advanced graphics systems

const Renderer = {
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0 },
  effects: [],
  miningNotification: null,
  lastDt: 0,
  dpr: 1, // Device pixel ratio for high-DPI displays
  _renderScale: 1.0, // Canvas resolution scale (0.5-1.0), lower = better perf on mobile
  width: 0, // Logical width (CSS pixels)
  height: 0, // Logical height (CSS pixels)

  // Screen shake system
  screenShake: {
    intensity: 0, // Current shake intensity (pixels)
    duration: 0, // Total shake duration (ms)
    startTime: 0, // When shake started
    offset: { x: 0, y: 0 }, // Current shake offset
  },

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Set DPI scaling (cap at 2 for performance on high-DPI mobile)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Set render scale from GraphicsSettings (persisted), or default by device type
    if (typeof GraphicsSettings !== 'undefined') {
      this._renderScale = GraphicsSettings.getRenderScale();
    } else if (typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile) {
      this._renderScale = 0.75;
    }

    // Handle resize
    window.addEventListener("resize", () => this.resize());
    this.resize();

    // Sync shared state to RenderContext for modular layer access
    if (typeof RenderContext !== 'undefined') {
      RenderContext.canvas = this.canvas;
      RenderContext.ctx = this.ctx;
      RenderContext.dpr = this.dpr;
      RenderContext.renderScale = this._renderScale;
      RenderContext.width = this.width;
      RenderContext.height = this.height;
      RenderContext.camera = this.camera;
      RenderContext.screenShake = this.screenShake;
    }

    // Initialize graphics systems
    ParticleSystem.init();
    ShipGeometry.init();

    // Initialize NPC ship geometry if available
    if (typeof NPCShipGeometry !== "undefined") {
      NPCShipGeometry.init();
    }

    // Initialize death effects if available
    if (typeof DeathEffects !== "undefined") {
      DeathEffects.init();
    }

    // Initialize base destruction sequence if available
    if (typeof BaseDestructionSequence !== "undefined") {
      BaseDestructionSequence.init();
    }

    // Initialize linked damage effect if available
    if (typeof LinkedDamageEffect !== "undefined") {
      LinkedDamageEffect.init();
    }

    // Initialize formation succession effect if available
    if (typeof FormationSuccessionEffect !== "undefined") {
      FormationSuccessionEffect.init();
    }

    // Initialize NPC weapon effects if available
    if (typeof NPCWeaponEffects !== "undefined") {
      NPCWeaponEffects.init();
    }

    // Initialize faction bases if available
    if (typeof FactionBases !== "undefined") {
      FactionBases.init();
    }

    // Initialize derelict renderer if available
    if (typeof DerelictRenderer !== "undefined") {
      DerelictRenderer.init();
    }

    // Initialize star effects if available
    if (typeof StarEffects !== "undefined") {
      StarEffects.init();
    }

    // Initialize background system if available
    if (typeof BackgroundSystem !== "undefined") {
      BackgroundSystem.init();
    }

    // Initialize graveyard atmosphere if available
    if (typeof GraveyardAtmosphere !== "undefined") {
      GraveyardAtmosphere.init();
    }

    // Initialize new HUD visual modules
    if (typeof ShieldVisual !== "undefined") {
      ShieldVisual.init();
    }
    if (typeof HullBarRenderer !== "undefined") {
      HullBarRenderer.init();
    }
    if (typeof BoostIndicator !== "undefined") {
      BoostIndicator.init();
    }

    // Initialize celestial texture renderer
    if (typeof CelestialRenderer !== "undefined") {
      CelestialRenderer.init();
    }

    Logger.log("Renderer initialized with advanced graphics");
  },

  resize() {
    // Get CSS (logical) dimensions
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;

    // Refresh render scale from GraphicsSettings if available
    if (typeof GraphicsSettings !== 'undefined') {
      this._renderScale = GraphicsSettings.getRenderScale();
    }

    // Set canvas buffer size (scaled by DPR and renderScale)
    // renderScale < 1 produces a smaller buffer that the browser upscales
    const bufferScale = this.dpr * this._renderScale;
    this.canvas.width = cssWidth * bufferScale;
    this.canvas.height = cssHeight * bufferScale;

    // CSS display size stays at full resolution (browser handles upscale)
    this.canvas.style.width = cssWidth + 'px';
    this.canvas.style.height = cssHeight + 'px';

    // Scale context to match combined DPR + renderScale
    this.ctx.setTransform(bufferScale, 0, 0, bufferScale, 0, 0);

    // Enable bilinear filtering for smooth upscale when renderScale < 1
    this.ctx.imageSmoothingEnabled = true;

    // Store logical dimensions for game code (always CSS pixels)
    this.width = cssWidth;
    this.height = cssHeight;

    // Track portrait mode for responsive game systems
    this.portraitMode = cssWidth < cssHeight;

    // Sync to RenderContext
    if (typeof RenderContext !== 'undefined') {
      RenderContext.renderScale = this._renderScale;
      RenderContext.width = this.width;
      RenderContext.height = this.height;
      RenderContext.portraitMode = this.portraitMode;
    }
  },

  /**
   * Check if currently in portrait orientation
   * @returns {boolean} True if portrait mode
   */
  isPortrait() {
    return this.portraitMode;
  },

  // ============================================
  // MOBILE SCALING HELPERS
  // ============================================

  /**
   * Get scaled font size for mobile displays
   * @param {number} baseSize - Base font size in pixels
   * @param {number} minScale - Minimum scale factor (default 0.7)
   * @returns {number} Scaled font size
   */
  getFontSize(baseSize, minScale = 0.7) {
    // Use smaller fonts on mobile for better fit
    const isMobile = typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile;
    if (!isMobile) return baseSize;

    // Scale based on screen width, with floor
    const screenScale = Math.min(this.width / 800, 1);
    const scale = Math.max(screenScale, minScale);
    return Math.round(baseSize * scale);
  },

  /**
   * Get a font string with scaled size for canvas
   * @param {number} baseSize - Base font size in pixels
   * @param {string} weight - Font weight (e.g., 'bold', 'normal', '600')
   * @param {string} family - Font family (default 'monospace')
   * @returns {string} CSS font string for ctx.font
   */
  getFont(baseSize, weight = 'normal', family = 'monospace') {
    const size = this.getFontSize(baseSize);
    return `${weight} ${size}px ${family}`;
  },

  /**
   * Get scaled line height for text
   * @param {number} baseFontSize - Base font size used
   * @param {number} lineHeightRatio - Line height multiplier (default 1.4)
   * @returns {number} Line height in pixels
   */
  getLineHeight(baseFontSize, lineHeightRatio = 1.4) {
    return Math.round(this.getFontSize(baseFontSize) * lineHeightRatio);
  },

  /**
   * Get scaled spacing/margin for mobile
   * @param {number} baseSpacing - Base spacing in pixels
   * @returns {number} Scaled spacing
   */
  getSpacing(baseSpacing) {
    const isMobile = typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile;
    if (!isMobile) return baseSpacing;

    // Reduce spacing on mobile
    return Math.round(baseSpacing * 0.75);
  },

  /**
   * Check if we're on a mobile device
   * @returns {boolean} True if mobile
   */
  isMobile() {
    return typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile;
  },

  // ============================================
  // SCREEN SHAKE SYSTEM
  // ============================================

  /**
   * Trigger a screen shake effect
   * @param {number} intensity - Maximum shake offset in pixels
   * @param {number} duration - Duration of shake in milliseconds
   */
  triggerScreenShake(intensity, duration) {
    // Apply screen shake multiplier from graphics settings
    const shakeMultiplier = typeof GraphicsSettings !== 'undefined'
      ? (GraphicsSettings.getScreenShakeMultiplier() || 1.0)
      : 1.0;

    this.screenShake.intensity = intensity * shakeMultiplier;
    this.screenShake.duration = duration;
    this.screenShake.startTime = Date.now();
  },

  /**
   * Set screen shake intensity directly (for continuous effects like queen death)
   * @param {number} intensity - Current shake intensity in pixels
   */
  setScreenShake(intensity) {
    // Apply screen shake multiplier from graphics settings
    const shakeMultiplier = typeof GraphicsSettings !== 'undefined'
      ? (GraphicsSettings.getScreenShakeMultiplier() || 1.0)
      : 1.0;

    this.screenShake.intensity = intensity * shakeMultiplier;
    this.screenShake.duration = 100; // Short duration, updated continuously
    this.screenShake.startTime = Date.now();
  },

  /**
   * Update screen shake offset
   */
  updateScreenShake() {
    if (this.screenShake.intensity <= 0) {
      this.screenShake.offset.x = 0;
      this.screenShake.offset.y = 0;
      return;
    }

    const elapsed = Date.now() - this.screenShake.startTime;
    const progress = elapsed / this.screenShake.duration;

    if (progress >= 1) {
      // Shake finished
      this.screenShake.intensity = 0;
      this.screenShake.offset.x = 0;
      this.screenShake.offset.y = 0;
      return;
    }

    // Calculate current shake intensity with falloff
    const currentIntensity = this.screenShake.intensity * (1 - progress * 0.3);

    // Random shake offset with perlin-like smoothness
    const time = Date.now() * 0.015;
    this.screenShake.offset.x =
      Math.sin(time * 1.3) * currentIntensity +
      Math.sin(time * 2.7) * currentIntensity * 0.5;
    this.screenShake.offset.y =
      Math.cos(time * 1.1) * currentIntensity +
      Math.cos(time * 2.3) * currentIntensity * 0.5;
  },

  /**
   * Get camera position with shake offset applied
   * @returns {{ x: number, y: number }} Camera position with shake
   */
  getCameraWithShake() {
    return {
      x: this.camera.x + this.screenShake.offset.x,
      y: this.camera.y + this.screenShake.offset.y,
    };
  },

  /**
   * Update graphics systems (call once per frame before drawing)
   */
  update(dt) {
    this.lastDt = dt;

    // Sync to RenderContext
    if (typeof RenderContext !== 'undefined') {
      RenderContext.lastDt = dt;
    }

    // Update screen shake
    this.updateScreenShake();

    ParticleSystem.update(dt);
    WeaponRenderer.update(dt);

    // Update NPC weapon effects
    if (typeof NPCWeaponEffects !== "undefined") {
      NPCWeaponEffects.update(dt);
    }

    // Update death effects
    if (typeof DeathEffects !== "undefined") {
      DeathEffects.update(dt);
    }

    // Update floating text system (damage numbers, "Invulnerable" text, etc.)
    if (typeof FloatingTextSystem !== "undefined") {
      FloatingTextSystem.update(dt);
    }

    // Update base destruction sequences
    if (typeof BaseDestructionSequence !== "undefined") {
      BaseDestructionSequence.update(dt);
    }

    // Update void effects (rifts, gravity wells, consume tendrils)
    if (typeof VoidEffects !== "undefined") {
      VoidEffects.update(dt);
    }

    // Update linked damage effect
    if (typeof LinkedDamageEffect !== "undefined") {
      LinkedDamageEffect.update(dt);
    }

    // Update formation succession effect
    if (typeof FormationSuccessionEffect !== "undefined") {
      FormationSuccessionEffect.update(dt);
    }

    // Update faction bases animation
    if (typeof FactionBases !== "undefined") {
      FactionBases.update(dt);
    }

    // Update derelict renderer (orbiting debris, sparks)
    if (typeof DerelictRenderer !== "undefined") {
      DerelictRenderer.update(dt);
    }

    // Update celestial textures (asteroid rotations)
    if (typeof CelestialRenderer !== "undefined") {
      CelestialRenderer.update(dt);
    }

    // Update star effects (corona flares, heat overlay)
    if (typeof StarEffects !== "undefined" && typeof Player !== "undefined") {
      const objects = World.getVisibleObjects(
        Player.position,
        Math.max(this.canvas.width, this.canvas.height)
      );
      StarEffects.update(dt, objects.stars, Player.position);
    }

    // Update player death effect sequence
    if (typeof PlayerDeathEffect !== "undefined") {
      PlayerDeathEffect.update(dt);
    }

    // Update Tesla cannon effects
    if (typeof ChainLightningEffect !== "undefined") {
      ChainLightningEffect.update(dt);
    }
    if (typeof TeslaCoilEffect !== "undefined") {
      TeslaCoilEffect.update(dt);
    }

    // Update new HUD visual modules
    if (typeof ShieldVisual !== "undefined") {
      ShieldVisual.update(dt);
    }
    if (typeof HullBarRenderer !== "undefined") {
      HullBarRenderer.update(dt);
    }
    if (typeof BoostIndicator !== "undefined") {
      BoostIndicator.update(dt);
    }

    // Update reward display animation
    if (typeof RewardDisplay !== "undefined") {
      RewardDisplay.update(dt);
    }

    // Update graveyard atmosphere effects
    if (typeof GraveyardAtmosphere !== "undefined" && typeof Player !== "undefined" && Player.position) {
      GraveyardAtmosphere.update(dt, Player.position);
    }
  },

  clear() {
    // Use new background system if available
    if (typeof BackgroundSystem !== "undefined" && BackgroundSystem.initialized) {
      // Get visible objects for zone sampling
      if (typeof Player !== "undefined" && Player.position && typeof World !== "undefined") {
        const objects = World.getVisibleObjects(
          Player.position,
          Math.max(this.width, this.height) * 2
        );
        BackgroundSystem.update(this.lastDt || 0.016, objects, Player.position);
        BackgroundSystem.draw(this.ctx, this.camera, this.width, this.height);
      } else {
        // BackgroundSystem available but player not ready - just draw with defaults
        BackgroundSystem.draw(this.ctx, this.camera, this.width, this.height);
      }
    } else {
      // Fallback to old starfield
      this.ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.drawStarfield();
    }

    // Draw graveyard atmosphere ambient overlay (dimming effect)
    if (typeof GraveyardAtmosphere !== "undefined" && GraveyardAtmosphere.isActive()) {
      GraveyardAtmosphere.drawAmbient(this.ctx, this.camera, this.width, this.height);
    }
  },

  drawStarfield() {
    // Simple static starfield for background
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";

    // Use camera position to create parallax
    const offsetX = (this.camera.x * 0.1) % 100;
    const offsetY = (this.camera.y * 0.1) % 100;

    for (let i = 0; i < 100; i++) {
      const x = ((i * 73) % this.canvas.width) - offsetX;
      const y = ((i * 137) % this.canvas.height) - offsetY;
      const size = (i % 3) + 1;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  },

  updateCamera() {
    // Center camera on player using logical dimensions (not physical buffer size)
    this.camera.x = Player.position.x - this.width / 2;
    this.camera.y = Player.position.y - this.height / 2;

    // Apply screen shake offset from base destruction sequences
    if (typeof BaseDestructionSequence !== "undefined") {
      const shake = BaseDestructionSequence.getScreenShakeOffset();
      this.camera.x += shake.x;
      this.camera.y += shake.y;
    }

    // Apply screen shake from player death effect
    if (typeof PlayerDeathEffect !== "undefined") {
      const deathShake = PlayerDeathEffect.getScreenShakeOffset();
      this.camera.x += deathShake.x;
      this.camera.y += deathShake.y;
    }
  },

  worldToScreen(x, y) {
    return {
      x: x - this.camera.x,
      y: y - this.camera.y,
    };
  },

  isOnScreen(x, y, margin = 100) {
    const screen = this.worldToScreen(x, y);
    return (
      screen.x > -margin &&
      screen.x < this.width + margin &&
      screen.y > -margin &&
      screen.y < this.height + margin
    );
  },

  drawWorld() {
    this.updateCamera();

    // DEBUG: Draw sector grid first (background layer)
    if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'sectorGrid')) {
      this.drawSectorGrid();
    }

    const objects = World.getVisibleObjects(
      Player.position,
      Math.max(this.canvas.width, this.canvas.height)
    );

    // Draw stars (background layer)
    for (const star of objects.stars) {
      if (!this.isOnScreen(star.x, star.y, star.size)) continue;
      this.drawStar(star);
    }

    // Draw wormholes
    for (const wormhole of objects.wormholes) {
      if (!this.isOnScreen(wormhole.x, wormhole.y, wormhole.size)) continue;
      this.drawWormhole(wormhole);
    }

    // Draw planets
    for (const planet of objects.planets) {
      if (!this.isOnScreen(planet.x, planet.y, planet.size)) continue;
      this.drawPlanet(planet);
    }

    // Draw asteroids
    for (const asteroid of objects.asteroids) {
      if (!this.isOnScreen(asteroid.x, asteroid.y, asteroid.size)) continue;
      this.drawAsteroid(asteroid);
    }

    // Draw comets (if any visible)
    if (
      objects.comets &&
      typeof CelestialRenderer !== "undefined" &&
      typeof Physics !== "undefined"
    ) {
      const camera = {
        x: this.camera.x,
        y: this.camera.y,
        zoom: 1, // Adjust if game has zoom
        width: this.canvas.width,
        height: this.canvas.height,
      };
      const orbitTime = Physics.getOrbitTime();
      for (const comet of objects.comets) {
        const cometState = Physics.computeCometPosition(comet, orbitTime);
        if (cometState.visible) {
          // Check if comet is on screen (comet has long tail, use larger check)
          const tailSize = comet.size * (comet.tailLengthFactor || 8);
          if (this.isOnScreen(cometState.x, cometState.y, tailSize)) {
            CelestialRenderer.drawComet(this.ctx, comet, cometState, camera);
          }
        }
      }
    }

    // Draw faction bases (skip destroyed ones)
    // Use server-sent positions when available for accurate hit detection
    for (const base of objects.bases) {
      // Skip destroyed bases
      if (typeof Entities !== "undefined" && Entities.isBaseDestroyed(base.id))
        continue;

      // Get server-authoritative position and state if available
      let renderBase = base;
      if (typeof Entities !== "undefined") {
        const serverBase = Entities.bases.get(base.id);
        if (serverBase && serverBase.position) {
          // Use server position for rendering to match hit detection
          // Also use server type/faction for assimilated bases
          // Include scrapPile for scavenger bases
          renderBase = {
            ...base,
            x: serverBase.position.x,
            y: serverBase.position.y,
            health: serverBase.health,
            maxHealth: serverBase.maxHealth,
            type: serverBase.type || base.type,
            faction: serverBase.faction || base.faction,
            scrapPile: serverBase.scrapPile,
            claimCredits: serverBase.claimCredits,
          };
        } else {
          // Fallback: check for health state only
          const state = Entities.getBaseState(base.id);
          if (state && state.health !== undefined) {
            renderBase = {
              ...base,
              health: state.health,
              maxHealth: state.maxHealth,
            };
          }
        }
      }

      if (!this.isOnScreen(renderBase.x, renderBase.y, renderBase.size))
        continue;

      // Merge health state from Entities into base object for rendering
      let baseWithHealth = renderBase;

      // Use FactionBases module for rendering (with fallback)
      if (typeof FactionBases !== "undefined" && FactionBases.draw) {
        FactionBases.draw(this.ctx, baseWithHealth, this.camera);
      } else {
        this.drawBase(baseWithHealth);
      }
    }

    // Also render server-known bases that aren't in the procedural list
    if (typeof Entities !== "undefined") {
      const proceduralIds = new Set(objects.bases.map((b) => b.id));
      for (const [baseId, serverBase] of Entities.bases) {
        if (proceduralIds.has(baseId)) continue; // Already rendered
        if (Entities.isBaseDestroyed(baseId)) continue;
        if (!serverBase.position) continue;

        const base = {
          id: baseId,
          x: serverBase.position.x,
          y: serverBase.position.y,
          size: serverBase.size || 100,
          faction: serverBase.faction,
          type: serverBase.type,
          name: serverBase.name,
          health: serverBase.health,
          maxHealth: serverBase.maxHealth,
          scrapPile: serverBase.scrapPile,
          claimCredits: serverBase.claimCredits,
        };

        if (!this.isOnScreen(base.x, base.y, base.size)) continue;

        if (typeof FactionBases !== "undefined" && FactionBases.draw) {
          FactionBases.draw(this.ctx, base, this.camera);
        } else {
          this.drawBase(base);
        }
      }
    }

    // Draw derelict ships (Graveyard zone ancient wrecks)
    if (typeof DerelictRenderer !== "undefined" && typeof Player !== "undefined") {
      DerelictRenderer.draw(this.ctx, this.camera, Player.position);
    }

    // DEBUG: Draw collision hitboxes as overlay
    if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'collisionHitboxes')) {
      const npcsArray = typeof Entities !== 'undefined' ? Array.from(Entities.npcs.values()) : [];
      // Combine procedural bases with server-tracked bases for hitbox rendering
      // Use server positions when available (authoritative) to match visual rendering
      const proceduralIds = new Set((objects.bases || []).map(b => b.id));
      let allBases = (objects.bases || []).map(base => {
        // For procedural bases, use server position if available (matches visual rendering)
        if (typeof Entities !== 'undefined') {
          const serverBase = Entities.bases.get(base.id);
          if (serverBase && serverBase.position) {
            return {
              ...base,
              x: serverBase.position.x,
              y: serverBase.position.y,
              size: serverBase.size || base.size || 100
            };
          }
        }
        return base;
      });
      // Add server-tracked bases that aren't in procedural list
      if (typeof Entities !== 'undefined') {
        for (const [baseId, serverBase] of Entities.bases) {
          if (proceduralIds.has(baseId)) continue; // Already in list with server position
          if (Entities.isBaseDestroyed(baseId)) continue;
          // Convert server base format to have flat x/y
          allBases.push({
            id: baseId,
            x: serverBase.position?.x ?? serverBase.x,
            y: serverBase.position?.y ?? serverBase.y,
            size: serverBase.size || 100,
            faction: serverBase.faction
          });
        }
      }
      this.drawCollisionHitboxes({ ...objects, bases: allBases }, npcsArray);
    }
  },

  drawStar(star) {
    const screen = this.worldToScreen(star.x, star.y);
    const ctx = this.ctx;
    const size = star.size || 400;

    // Get LOD level for quality-based rendering
    const lod = typeof GraphicsSettings !== 'undefined' ? GraphicsSettings.getLOD() : 3;

    // Draw corona glow effect first (background layer) - only at LOD 2+
    if (lod >= 2 && typeof StarEffects !== "undefined") {
      StarEffects.drawCoronaGlow(ctx, screen.x, screen.y, star);
    }

    // Animated surface turbulence (only at LOD 2+)
    const time = Date.now() * 0.001;
    const turbulence = lod >= 2 ? (0.95 + Math.sin(time * 3 + star.x * 0.01) * 0.05) : 1;

    // Get star colors based on type
    const colorSchemes = {
      "#ffff00": { core: "#ffffff", mid: "#ffff88", outer: "#ffaa00" },
      "#ffaa00": { core: "#ffffff", mid: "#ffcc44", outer: "#ff6600" },
      "#ff6600": { core: "#ffff88", mid: "#ff8844", outer: "#cc2200" },
      "#ffffff": { core: "#ffffff", mid: "#ddddff", outer: "#8888cc" },
      "#aaaaff": { core: "#ffffff", mid: "#aaddff", outer: "#4466aa" },
    };
    const scheme = colorSchemes[star.color] || colorSchemes["#ffff00"];

    if (lod === 0) {
      // LOD 0 (Minimal): Solid color circle only
      ctx.fillStyle = star.color || "#ffff00";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (lod === 1) {
      // LOD 1 (Low): Simple 2-stop gradient, no glow
      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, size
      );
      gradient.addColorStop(0, scheme.core);
      gradient.addColorStop(1, star.color);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // LOD 2+ (Medium/High/Ultra): Full multi-layer gradient
      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, size * turbulence
      );

      gradient.addColorStop(0, scheme.core);
      gradient.addColorStop(0.25, scheme.mid);
      gradient.addColorStop(0.7, star.color);
      gradient.addColorStop(0.9, scheme.outer + "aa");
      gradient.addColorStop(1, "transparent");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * turbulence, 0, Math.PI * 2);
      ctx.fill();

      // Animated dark spots on surface (sunspots) - LOD 2+ only
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#000000";
      const spotCount = lod >= 3 ? 3 : 2; // Fewer spots at medium quality
      for (let i = 0; i < spotCount; i++) {
        const spotAngle = time * 0.2 + i * 2;
        const spotDist = size * 0.4 * (0.5 + Math.sin(time * 0.5 + i) * 0.3);
        const spotX = screen.x + Math.cos(spotAngle) * spotDist;
        const spotY = screen.y + Math.sin(spotAngle) * spotDist;
        const spotSize = size * 0.08 * (0.5 + Math.sin(time + i * 1.5) * 0.5);

        ctx.beginPath();
        ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Bright white core - LOD 2+ only
      const coreGradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, size * 0.3
      );
      coreGradient.addColorStop(0, "#ffffff");
      coreGradient.addColorStop(0.5, "#ffffee");
      coreGradient.addColorStop(1, "transparent");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw danger zone indicator (subtle ring at warm zone boundary) - all LODs
    const zones = CONSTANTS.STAR_ZONES || { CORONA: 1.5, WARM: 1.3 };
    ctx.save();
    ctx.globalAlpha = lod >= 2 ? (0.1 + Math.sin(time * 2) * 0.05) : 0.1;
    ctx.strokeStyle = "#ff6600";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 20]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * zones.WARM, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  drawPlanet(planet) {
    const screen = this.worldToScreen(planet.x, planet.y);
    const ctx = this.ctx;
    const depleted = World.isObjectDepleted(planet.id);

    // Use CelestialRenderer if available for enhanced visuals
    if (typeof CelestialRenderer !== "undefined") {
      CelestialRenderer.drawPlanet(ctx, planet, screen, depleted);

      // DEBUG: Draw planet ID label
      if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'planetIds') && planet.id) {
        this.drawObjectIdLabel(planet.id, screen, planet.size);
      }
      return;
    }

    // Fallback: simple rendering
    const colors = {
      rocky: "#8B4513",
      gas: "#DEB887",
      ice: "#ADD8E6",
      lava: "#FF4500",
      ocean: "#4169E1",
    };

    ctx.fillStyle = depleted
      ? "#444444"
      : colors[planet.type] || CONSTANTS.COLORS.PLANET;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, planet.size, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = depleted ? "#333333" : "#666666";
    ctx.lineWidth = 2;
    ctx.stroke();

    // DEBUG: Draw planet ID label (fallback path)
    if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'planetIds') && planet.id) {
      this.drawObjectIdLabel(planet.id, screen, planet.size);
    }
  },

  drawAsteroid(asteroid) {
    const screen = this.worldToScreen(asteroid.x, asteroid.y);
    const ctx = this.ctx;
    const depleted = World.isObjectDepleted(asteroid.id);

    // Use CelestialRenderer if available for enhanced visuals
    if (typeof CelestialRenderer !== "undefined") {
      CelestialRenderer.drawAsteroid(ctx, asteroid, screen, depleted);

      // DEBUG: Draw bright indicator for mining claim asteroids
      if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'miningClaimRings') &&
          (asteroid.claimId || asteroid.id?.includes('clm'))) {
        ctx.save();
        ctx.strokeStyle = '#00FF00'; // Bright green
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, asteroid.size + 10, 0, Math.PI * 2);
        ctx.stroke();
        // Also draw a second ring
        ctx.strokeStyle = '#FFFF00'; // Yellow
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, asteroid.size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // DEBUG: Draw asteroid ID label
      if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'asteroidIds') && asteroid.id) {
        this.drawObjectIdLabel(asteroid.id, screen, asteroid.size);
      }
      return;
    }

    // Fallback: simple rendering
    ctx.fillStyle = depleted ? "#333333" : CONSTANTS.COLORS.ASTEROID;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, asteroid.size, 0, Math.PI * 2);
    ctx.fill();

    // Rough edges (simple polygon)
    ctx.strokeStyle = depleted ? "#222222" : "#666666";
    ctx.lineWidth = 1;
    ctx.stroke();

    // DEBUG: Draw asteroid ID label (fallback path)
    if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'asteroidIds') && asteroid.id) {
      this.drawObjectIdLabel(asteroid.id, screen, asteroid.size);
    }
  },

  drawWormhole(wormhole) {
    const screen = this.worldToScreen(wormhole.x, wormhole.y);
    const ctx = this.ctx;
    const size = wormhole.size;
    const time = Date.now() / 1000;

    // Get LOD level for quality-based rendering
    const lod = typeof GraphicsSettings !== 'undefined' ? GraphicsSettings.getLOD() : 3;

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // LOD 0 (Minimal, quality 0-9): Dark circle with colored border ring only
    if (lod === 0) {
      // Dark filled circle
      ctx.fillStyle = 'rgba(5, 10, 30, 0.7)';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Cyan border ring
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      // Small bright center dot
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    // LOD 1 (Low, quality 10-29): Void gradient + 4 arms (40 segments) + 12 particles + core glow, no rings
    if (lod === 1) {
      // Background void gradient (same as full, keeps the visual identity)
      const voidGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      voidGradient.addColorStop(0, "rgba(200, 230, 255, 0.15)");
      voidGradient.addColorStop(0.15, "rgba(100, 180, 255, 0.1)");
      voidGradient.addColorStop(0.4, "rgba(20, 40, 80, 0.3)");
      voidGradient.addColorStop(0.7, "rgba(5, 10, 30, 0.5)");
      voidGradient.addColorStop(0.9, "rgba(0, 0, 10, 0.3)");
      voidGradient.addColorStop(1, "transparent");
      ctx.fillStyle = voidGradient;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      // Reduced spiral arms: 4 arms, 40 segments each (vs 8 arms x 80 segments)
      const lodArmColors = ["#00ffff", "#4488ff", "#ff8844", "#00ccff"];

      for (let arm = 0; arm < 4; arm++) {
        const armAngle = (arm / 4) * Math.PI * 2;
        const rotationSpeed = 1.5 + (arm % 3) * 0.4;
        const baseRotation = time * rotationSpeed + armAngle;

        ctx.save();
        ctx.rotate(baseRotation);

        ctx.beginPath();
        const spiralTurns = 2.0;
        const startRadius = size * 0.92;
        const endRadius = size * 0.05;

        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const angle = t * Math.PI * 2 * spiralTurns;
          const radius =
            startRadius - (startRadius - endRadius) * Math.pow(t, 0.8);
          const wobble = Math.sin(t * 12 + time * 4) * 2;
          const x = Math.cos(angle) * (radius + wobble);
          const y = Math.sin(angle) * (radius + wobble);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        const armOpacity = 0.5 + Math.sin(time * 4 + arm * 0.8) * 0.3;
        ctx.strokeStyle = lodArmColors[arm];
        ctx.lineWidth = 2.5 + Math.sin(time * 5 + arm) * 1;
        ctx.globalAlpha = armOpacity;
        ctx.stroke();
        ctx.restore();
      }

      ctx.globalAlpha = 1;

      // Reduced particles: 12 (vs 36)
      for (let i = 0; i < 12; i++) {
        const particleTime = (time * 0.8 + i * 0.36) % 1;
        const particleAngle = (i / 12) * Math.PI * 2 + time * 2.5;
        const particleRadius = size * (0.95 - particleTime * 0.9);
        const spiralOffset = particleTime * Math.PI * 4;

        const px = Math.cos(particleAngle + spiralOffset) * particleRadius;
        const py = Math.sin(particleAngle + spiralOffset) * particleRadius;

        const particleSize = 1.5 + particleTime * 2.5;
        const particleAlpha = 0.4 + particleTime * 0.5;

        const colors = ["#ffffff", "#00ffff", "#ffaa44", "#88ddff", "#ffcc66"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = particleAlpha;
        ctx.beginPath();
        ctx.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // No concentric rings at LOD 1

      // Core glow (simplified - single gradient instead of two)
      const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.25);
      coreGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      coreGlow.addColorStop(0.3, "rgba(200, 240, 255, 0.6)");
      coreGlow.addColorStop(0.7, "rgba(100, 200, 255, 0.2)");
      coreGlow.addColorStop(1, "transparent");
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    // LOD 2+ (Medium/High/Ultra, quality 30+): Full rendering - unchanged
    // Background void - dark outer edges fading to transparent (no border)
    const voidGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    voidGradient.addColorStop(0, "rgba(200, 230, 255, 0.15)"); // Bright center glow
    voidGradient.addColorStop(0.15, "rgba(100, 180, 255, 0.1)");
    voidGradient.addColorStop(0.4, "rgba(20, 40, 80, 0.3)");
    voidGradient.addColorStop(0.7, "rgba(5, 10, 30, 0.5)");
    voidGradient.addColorStop(0.9, "rgba(0, 0, 10, 0.3)");
    voidGradient.addColorStop(1, "transparent");
    ctx.fillStyle = voidGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Main swirling spiral arms (8 arms for denser vortex effect)
    const numArms = 8;
    // Mixed colors: cyan, blue, and some warm orange/yellow like the reference
    const armColors = [
      "#00ffff",
      "#4488ff",
      "#ff8844",
      "#00ccff",
      "#ffaa44",
      "#0066cc",
      "#88ddff",
      "#ff6622",
    ];

    for (let arm = 0; arm < numArms; arm++) {
      const armAngle = (arm / numArms) * Math.PI * 2;
      // Faster rotation - 1.5x to 2x speed, alternating for depth
      const rotationSpeed = 1.5 + (arm % 3) * 0.4;
      const baseRotation = time * rotationSpeed + armAngle;

      ctx.save();
      ctx.rotate(baseRotation);

      // Draw spiral arm as curved path spiraling inward
      ctx.beginPath();
      const spiralTurns = 2.0; // More turns for tighter spiral
      const startRadius = size * 0.92;
      const endRadius = size * 0.05;

      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const angle = t * Math.PI * 2 * spiralTurns;
        const radius =
          startRadius - (startRadius - endRadius) * Math.pow(t, 0.8); // Accelerate toward center
        // Organic wobble
        const wobble = Math.sin(t * 12 + time * 4) * 2;
        const x = Math.cos(angle) * (radius + wobble);
        const y = Math.sin(angle) * (radius + wobble);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Arm styling - brighter near center, faster opacity transitions
      const armOpacity = 0.5 + Math.sin(time * 4 + arm * 0.8) * 0.3;
      ctx.strokeStyle = armColors[arm];
      // Arms get thinner toward center
      ctx.lineWidth = 2.5 + Math.sin(time * 5 + arm) * 1;
      ctx.globalAlpha = armOpacity;
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // Light particles being pulled in (more particles, brighter)
    const numParticles = 36;
    for (let i = 0; i < numParticles; i++) {
      // Faster particle movement
      const particleTime = (time * 0.8 + i * 0.12) % 1;
      const particleAngle = (i / numParticles) * Math.PI * 2 + time * 2.5;
      const particleRadius = size * (0.95 - particleTime * 0.9);
      const spiralOffset = particleTime * Math.PI * 4; // Tighter spiral

      const px = Math.cos(particleAngle + spiralOffset) * particleRadius;
      const py = Math.sin(particleAngle + spiralOffset) * particleRadius;

      // Particles get brighter as they approach center
      const particleSize = 1.5 + particleTime * 2.5;
      const particleAlpha = 0.4 + particleTime * 0.5;

      // Mix of colors - white, cyan, orange, yellow
      const colors = ["#ffffff", "#00ffff", "#ffaa44", "#88ddff", "#ffcc66"];
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = particleAlpha;
      ctx.beginPath();
      ctx.arc(px, py, particleSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Concentric rings pulsing inward (faster)
    for (let ring = 0; ring < 5; ring++) {
      const ringPhase = (time * 1.2 + ring * 0.2) % 1;
      const ringRadius = size * (0.15 + ringPhase * 0.75);
      const ringAlpha = 0.35 * (1 - ringPhase);

      ctx.strokeStyle = ring % 2 === 0 ? "#88ddff" : "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = ringAlpha;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Bright center core - the "light at the end of the tunnel"
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.25);
    coreGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    coreGlow.addColorStop(0.2, "rgba(200, 240, 255, 0.8)");
    coreGlow.addColorStop(0.5, "rgba(100, 200, 255, 0.4)");
    coreGlow.addColorStop(0.8, "rgba(50, 100, 200, 0.15)");
    coreGlow.addColorStop(1, "transparent");
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core with pulsing
    const corePulse = 0.7 + Math.sin(time * 6) * 0.3;
    const innerCore = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.1);
    innerCore.addColorStop(0, `rgba(255, 255, 255, ${corePulse})`);
    innerCore.addColorStop(0.5, `rgba(180, 220, 255, ${corePulse * 0.6})`);
    innerCore.addColorStop(1, "transparent");
    ctx.fillStyle = innerCore;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Fallback for base drawing (used when FactionBases module is unavailable)
   * @fallback Prefer FactionBases module for rendering when loaded
   */
  drawBase(base) {
    const screen = this.worldToScreen(base.x, base.y);
    const ctx = this.ctx;

    // Simple fallback rendering - octagonal base with faction color
    const colors = {
      pirate: "#ff3300",
      scavenger: "#999966",
      swarm: "#8b0000",
      void: "#9900ff",
      rogue_miner: "#ff9900",
    };

    const color = colors[base.faction] || "#888888";

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Simple octagonal base
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * base.size * 0.8;
      const y = Math.sin(angle) * base.size * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Name label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(base.name, 0, base.size + 20);

    ctx.restore();
  },

  drawWreckage() {
    const ctx = this.ctx;
    const dt = this.lastDt;
    const now = Date.now();

    // Faction colors for wreckage
    const FACTION_COLORS = {
      pirate: "#ff3300",
      scavenger: "#999966",
      swarm: "#8b0000",
      void: "#9900ff",
      rogue_miner: "#ff9900",
      unknown: "#888888",
    };

    // Derelict salvage colors (matches derelict ship aesthetic)
    const DERELICT_COLORS = {
      hull: "#4a5568",       // Dark gray hull plates
      accent: "#718096",     // Lighter gray accent
      rust: "#8b6914",       // Rust/corrosion spots
      glow: "#2d3748",       // Dim glow
      gear: "#a0aec0",       // Light gray gears
      gearDark: "#4a5568",   // Darker gear parts
    };

    // Scrap Siphon copper color
    const SIPHON_COPPER = "#B87333";
    const SIPHON_COPPER_GLOW = "#CD7F32";

    // Despawn fade constants
    const FADE_START_MS = 10000; // Start fading 10 seconds before despawn
    const FADE_PULSE_SPEED = 3; // Pulses per second when fading

    // Update wreckage rotation
    Entities.updateWreckageRotation(dt);

    for (const [id, wreckage] of Entities.wreckage) {
      // Check if this wreckage is being siphoned
      const siphonState = Entities.getSiphonAnimationState(id);
      const isSiphoning = siphonState !== null;
      const isDerelict = wreckage.source === 'derelict';

      // Calculate position - interpolate toward player if siphoning
      let drawX = wreckage.position.x;
      let drawY = wreckage.position.y;
      let siphonAlpha = 1.0;
      let siphonScale = 1.0;
      let spawnScale = 1.0;
      let spawnRotation = 0;

      // Spawn animation for derelict wreckage (slide from origin with spin and scale)
      const spawnAnim = wreckage.spawnAnimation;
      if (spawnAnim) {
        const elapsed = now - spawnAnim.startTime;
        const progress = Math.min(1, elapsed / spawnAnim.duration);

        if (progress < 1) {
          // Ease-out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3);

          // Interpolate position from origin to destination
          drawX = spawnAnim.originX + (spawnAnim.destX - spawnAnim.originX) * eased;
          drawY = spawnAnim.originY + (spawnAnim.destY - spawnAnim.originY) * eased;

          // Scale up from tiny to full size
          spawnScale = 0.1 + 0.9 * eased;

          // Spin during animation
          spawnRotation = spawnAnim.startRotation + spawnAnim.spinAmount * eased;

          // Debug: log animation progress at key points
          if (progress < 0.05 || (progress > 0.48 && progress < 0.52)) {
            window.Logger?.category('loot', '[WRECKAGE] Spawn anim:', id.slice(-8),
              'progress:', (progress * 100).toFixed(0) + '%',
              'scale:', spawnScale.toFixed(2),
              'pos:', drawX.toFixed(0), drawY.toFixed(0)
            );
          }
        } else {
          // Animation complete, clear it
          wreckage.spawnAnimation = null;
        }
      }

      if (isSiphoning) {
        const progress = siphonState.progress;
        // Use easing for smooth movement (ease-in-out cubic)
        const easedProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Get current player position (tracks player movement during animation)
        const targetX = Player.position.x;
        const targetY = Player.position.y;

        // Interpolate position toward current player position
        drawX = siphonState.startPos.x + (targetX - siphonState.startPos.x) * easedProgress;
        drawY = siphonState.startPos.y + (targetY - siphonState.startPos.y) * easedProgress;

        // Fade out in the last 30% of animation
        if (progress > 0.7) {
          siphonAlpha = 1 - ((progress - 0.7) / 0.3);
        }

        // Scale down slightly as it gets closer
        siphonScale = 1 - (progress * 0.5);
      }

      if (!this.isOnScreen(drawX, drawY, 60))
        continue;

      const screen = this.worldToScreen(drawX, drawY);
      const baseColor = isDerelict ? DERELICT_COLORS.hull : (FACTION_COLORS[wreckage.faction] || FACTION_COLORS.unknown);
      // Use copper color when siphoning, otherwise faction/derelict color
      const color = isSiphoning ? SIPHON_COPPER : baseColor;

      // Calculate despawn fade effect (only when not siphoning)
      let despawnAlpha = 1.0;
      if (!isSiphoning) {
        const timeUntilDespawn = wreckage.despawnTime - now;
        if (timeUntilDespawn <= FADE_START_MS && timeUntilDespawn > 0) {
          const fadeProgress = 1 - (timeUntilDespawn / FADE_START_MS);
          const pulseSpeed = FADE_PULSE_SPEED + fadeProgress * 5;
          const fadePhase = (now / 1000 * pulseSpeed) % 1;
          const minAlpha = Math.max(0.1, 1 - fadeProgress * 0.9);
          const pulseAlpha = minAlpha + (1 - minAlpha) * (0.5 + 0.5 * Math.sin(fadePhase * Math.PI * 2));
          despawnAlpha = pulseAlpha;
        }
      }

      // Combine alphas
      const finalAlpha = despawnAlpha * siphonAlpha;

      // Combine scales (spawn animation and siphon)
      const totalScale = spawnScale * siphonScale;

      // Use spawn rotation during animation, otherwise normal rotation
      const drawRotation = spawnAnim ? spawnRotation : wreckage.rotation;

      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(drawRotation);
      ctx.scale(totalScale, totalScale);

      if (isDerelict) {
        // Draw derelict-style hull plate debris
        this._drawDerelictWreckage(ctx, wreckage, now, finalAlpha, isSiphoning);
      } else {
        // Draw standard faction wreckage (triangular debris)
        const pieceCount = 3 + (wreckage.contentCount % 3);
        const baseSize = 8;

        for (let i = 0; i < pieceCount; i++) {
          const angle = (i / pieceCount) * Math.PI * 2;
          const dist = 5 + (i % 2) * 5;
          const px = Math.cos(angle) * dist;
          const py = Math.sin(angle) * dist;
          const size = baseSize - (i % 3) * 2;

          // Draw piece
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8 * finalAlpha;
          ctx.beginPath();
          ctx.moveTo(px, py - size);
          ctx.lineTo(px + size * 0.8, py + size * 0.5);
          ctx.lineTo(px - size * 0.8, py + size * 0.5);
          ctx.closePath();
          ctx.fill();

          // Outline - copper glow when siphoning
          ctx.strokeStyle = isSiphoning ? SIPHON_COPPER_GLOW : "#ffffff";
          ctx.lineWidth = isSiphoning ? 2 : 1;
          ctx.globalAlpha = (isSiphoning ? 0.9 : 0.5) * finalAlpha;
          ctx.stroke();
        }

        // Pulsing glow - enhanced copper glow when siphoning
        const pulsePhase = (now / (isSiphoning ? 150 : 500)) % (Math.PI * 2);
        const pulseIntensity = isSiphoning
          ? 0.6 + Math.sin(pulsePhase) * 0.3
          : 0.3 + Math.sin(pulsePhase) * 0.2;
        const glowRadius = (20 + wreckage.contentCount * 2) * (isSiphoning ? 1.5 : 1);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        if (isSiphoning) {
          gradient.addColorStop(0, SIPHON_COPPER_GLOW + "aa");
          gradient.addColorStop(0.5, SIPHON_COPPER + "66");
          gradient.addColorStop(1, "transparent");
        } else {
          gradient.addColorStop(0, color + "66");
          gradient.addColorStop(1, "transparent");
        }

        ctx.globalAlpha = pulseIntensity * finalAlpha;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Draw label below wreckage (skip when siphoning far along or during spawn animation)
      const showLabel = (!isSiphoning || siphonState.progress < 0.5) && !spawnAnim;
      if (showLabel) {
        ctx.globalAlpha = 0.8 * finalAlpha;
        ctx.fillStyle = isSiphoning ? SIPHON_COPPER : baseColor;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(wreckage.npcName || "Wreckage", screen.x, screen.y + 30 * totalScale);

        // Draw loot count indicator
        if (wreckage.contentCount > 0) {
          ctx.fillStyle = isSiphoning ? SIPHON_COPPER_GLOW : "#ffffff";
          ctx.font = "bold 8px monospace";
          ctx.fillText(`x${wreckage.contentCount}`, screen.x, screen.y + 40 * totalScale);
        }
      }

      ctx.globalAlpha = 1;
    }
  },

  // Draw derelict-style wreckage with hull plates and floating gears
  _drawDerelictWreckage(ctx, wreckage, now, alpha, isSiphoning) {
    const DERELICT_COLORS = {
      hull: "#4a5568",
      accent: "#718096",
      rust: "#8b6914",
      glow: "#2d3748",
      gear: "#a0aec0",
      gearDark: "#4a5568",
    };

    // Draw 3-4 hull plate debris pieces (irregular quadrilaterals)
    const plateCount = 3 + (wreckage.contentCount > 2 ? 1 : 0);

    for (let i = 0; i < plateCount; i++) {
      const baseAngle = (i / plateCount) * Math.PI * 2;
      const dist = 8 + (i % 2) * 6;
      const px = Math.cos(baseAngle) * dist;
      const py = Math.sin(baseAngle) * dist;
      const plateSize = 10 + (i % 2) * 4;
      const plateRotation = baseAngle + (i * 0.5);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(plateRotation);

      // Draw hull plate (irregular quadrilateral)
      ctx.fillStyle = DERELICT_COLORS.hull;
      ctx.globalAlpha = 0.9 * alpha;
      ctx.beginPath();
      ctx.moveTo(-plateSize * 0.6, -plateSize * 0.4);
      ctx.lineTo(plateSize * 0.5, -plateSize * 0.5);
      ctx.lineTo(plateSize * 0.7, plateSize * 0.3);
      ctx.lineTo(-plateSize * 0.4, plateSize * 0.5);
      ctx.closePath();
      ctx.fill();

      // Accent line (panel seam)
      ctx.strokeStyle = DERELICT_COLORS.accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6 * alpha;
      ctx.beginPath();
      ctx.moveTo(-plateSize * 0.3, -plateSize * 0.2);
      ctx.lineTo(plateSize * 0.4, plateSize * 0.1);
      ctx.stroke();

      // Rust spot on some plates
      if (i % 2 === 0) {
        ctx.fillStyle = DERELICT_COLORS.rust;
        ctx.globalAlpha = 0.4 * alpha;
        ctx.beginPath();
        ctx.arc(plateSize * 0.2, -plateSize * 0.1, plateSize * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outline
      ctx.strokeStyle = isSiphoning ? "#CD7F32" : DERELICT_COLORS.accent;
      ctx.lineWidth = isSiphoning ? 2 : 1;
      ctx.globalAlpha = 0.7 * alpha;
      ctx.beginPath();
      ctx.moveTo(-plateSize * 0.6, -plateSize * 0.4);
      ctx.lineTo(plateSize * 0.5, -plateSize * 0.5);
      ctx.lineTo(plateSize * 0.7, plateSize * 0.3);
      ctx.lineTo(-plateSize * 0.4, plateSize * 0.5);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }

    // Draw orbiting gears
    if (wreckage.gears) {
      const time = now / 1000;
      for (const gear of wreckage.gears) {
        const orbitAngle = gear.orbitPhase + time * gear.orbitSpeed;
        const gx = Math.cos(orbitAngle) * gear.orbitRadius;
        const gy = Math.sin(orbitAngle) * gear.orbitRadius;
        const spinAngle = gear.spinPhase + time * gear.spinSpeed;

        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(spinAngle);

        // Draw gear
        this._drawGear(ctx, gear.size, gear.teeth, DERELICT_COLORS, alpha);

        ctx.restore();
      }
    }

    // Subtle dark glow for derelict wreckage
    const pulsePhase = (now / 800) % (Math.PI * 2);
    const pulseIntensity = 0.2 + Math.sin(pulsePhase) * 0.1;
    const glowRadius = 25;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    gradient.addColorStop(0, DERELICT_COLORS.glow + "44");
    gradient.addColorStop(0.6, DERELICT_COLORS.hull + "22");
    gradient.addColorStop(1, "transparent");

    ctx.globalAlpha = pulseIntensity * alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  },

  // Draw a small gear shape
  _drawGear(ctx, size, teeth, colors, alpha) {
    const innerRadius = size * 0.4;
    const outerRadius = size;
    const toothDepth = size * 0.3;

    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const angle1 = (i / teeth) * Math.PI * 2;
      const angle2 = ((i + 0.3) / teeth) * Math.PI * 2;
      const angle3 = ((i + 0.5) / teeth) * Math.PI * 2;
      const angle4 = ((i + 0.7) / teeth) * Math.PI * 2;

      if (i === 0) {
        ctx.moveTo(
          Math.cos(angle1) * outerRadius,
          Math.sin(angle1) * outerRadius
        );
      }
      ctx.lineTo(
        Math.cos(angle2) * outerRadius,
        Math.sin(angle2) * outerRadius
      );
      ctx.lineTo(
        Math.cos(angle3) * (outerRadius - toothDepth),
        Math.sin(angle3) * (outerRadius - toothDepth)
      );
      ctx.lineTo(
        Math.cos(angle4) * (outerRadius - toothDepth),
        Math.sin(angle4) * (outerRadius - toothDepth)
      );
      ctx.lineTo(
        Math.cos(((i + 1) / teeth) * Math.PI * 2) * outerRadius,
        Math.sin(((i + 1) / teeth) * Math.PI * 2) * outerRadius
      );
    }
    ctx.closePath();

    // Fill gear
    ctx.fillStyle = colors.gear;
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fill();

    // Gear outline
    ctx.strokeStyle = colors.gearDark;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.7 * alpha;
    ctx.stroke();

    // Center hole
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = colors.gearDark;
    ctx.globalAlpha = 0.8 * alpha;
    ctx.fill();
  },

  // Draw collection progress bar for wreckage
  drawCollectionProgress() {
    if (!Player.collectingWreckage || Player.collectProgress <= 0) return;

    const wreckage = Player.collectingWreckage;
    const screen = this.worldToScreen(wreckage.position.x, wreckage.position.y);
    const ctx = this.ctx;

    const barWidth = 60;
    const barHeight = 8;
    const x = screen.x - barWidth / 2;
    const y = screen.y - 40;

    // Background
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress (golden color for loot)
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(
      x,
      y,
      barWidth * Math.min(1, Player.collectProgress),
      barHeight
    );

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Collecting...", screen.x, y - 13);
  },

  drawEntities() {
    const ctx = this.ctx;
    const dt = this.lastDt;

    // Draw wreckage (behind beams and ships)
    this.drawWreckage();

    // Draw tractor beam first (behind everything)
    if (Player.miningTarget && Player.miningProgress > 0) {
      const resourceType = Player.miningTarget.resources?.[0] || "default";
      TractorBeamRenderer.draw(
        ctx,
        Player.position,
        { x: Player.miningTarget.x, y: Player.miningTarget.y },
        this.camera,
        Player.ship.miningTier,
        Player.miningProgress,
        resourceType,
        dt
      );
    }

    // Draw loot collection tractor beam
    if (Player.collectingWreckage && Player.collectProgress > 0) {
      TractorBeamRenderer.draw(
        ctx,
        Player.position,
        Player.collectingWreckage.position,
        this.camera,
        Player.ship.miningTier,
        Player.collectProgress,
        "loot",
        dt
      );
    }

    // Draw other players
    for (const [id, player] of Entities.players) {
      if (!this.isOnScreen(player.position.x, player.position.y)) continue;

      // Draw tractor beam if player is mining
      if (player.mining) {
        TractorBeamRenderer.draw(
          ctx,
          player.position,
          { x: player.mining.targetX, y: player.mining.targetY },
          this.camera,
          player.mining.miningTier || 1,
          0.7, // constant intensity for other players
          player.mining.resourceType || "default",
          dt
        );
      }

      this.drawShip(
        player.position,
        player.rotation,
        "other",
        player.username,
        1,
        player.colorId
      );

      // Draw status icon above player if not idle
      if (player.status && player.status !== "idle") {
        const screen = this.worldToScreen(player.position.x, player.position.y);
        StatusIconRenderer.draw(ctx, screen.x, screen.y, player.status);
      }
    }

    // Draw NPCs with faction-specific graphics
    for (const [id, npc] of Entities.npcs) {
      if (!this.isOnScreen(npc.position.x, npc.position.y)) continue;

      // Use faction-specific ship renderer if available
      if (typeof NPCShipGeometry !== "undefined" && npc.type) {
        const screen = this.worldToScreen(npc.position.x, npc.position.y);

        // Check if this is an attached assimilation drone (worm visual)
        if (NPCShipGeometry.isAttachedDrone(npc)) {
          NPCShipGeometry.drawAttachedWorm(ctx, screen, npc, Date.now());
          continue; // Skip normal ship rendering and label
        }

        // Check if swarm NPC is still hatching from egg
        const hatchProgress = NPCShipGeometry.getHatchProgress(npc);
        if (hatchProgress !== null) {
          // Draw hatching egg instead of ship
          NPCShipGeometry.drawSwarmEgg(
            ctx,
            screen,
            hatchProgress,
            npc.type,
            Date.now()
          );
          continue; // Skip normal ship rendering
        }

        // Spawn smoke trail for Barnacle King (when moving)
        // Note: Client NPCs use targetPosition for interpolation, not velocity
        // Check if NPC is moving by comparing position to targetPosition
        if (npc.type === 'scavenger_barnacle_king') {
          let isMoving = false;
          let speed = 0;
          if (npc.targetPosition) {
            const dx = npc.targetPosition.x - npc.position.x;
            const dy = npc.targetPosition.y - npc.position.y;
            speed = Math.sqrt(dx * dx + dy * dy);
            isMoving = speed > 2; // Moving if more than 2 units from target
          }
          if (isMoving || npc.state === 'enraged') {
            // Always emit smoke when enraged, or when moving
            // Smoke from both stacks
            const SIZE = NPCShipGeometry.SIZE * 17.5;
            const cos = Math.cos(npc.rotation);
            const sin = Math.sin(npc.rotation);

            // Stack positions in world space
            const stacks = [
              { x: -SIZE * 0.5, y: -SIZE * 0.5 },
              { x: -SIZE * 0.5, y: SIZE * 0.5 }
            ];

            stacks.forEach(stack => {
              const worldX = npc.position.x + stack.x * cos - stack.y * sin;
              const worldY = npc.position.y + stack.x * sin + stack.y * cos;

              if (Math.random() < 0.3) { // 30% chance per frame
                ParticleSystem.spawn({
                  x: worldX,
                  y: worldY,
                  vx: -cos * speed * 0.3 + (Math.random() - 0.5) * 20,
                  vy: -sin * speed * 0.3 + (Math.random() - 0.5) * 20,
                  life: 2000 + Math.random() * 1000,
                  color: '#2a2a2a',
                  size: 8 + Math.random() * 6,
                  decay: 0.8,
                  drag: 0.98,
                  type: 'smoke',
                  gravity: -5
                });
              }
            });
          }
        }

        // Spawn steam particles for enraged scavengers
        if (npc.faction === 'scavenger' && npc.state === 'enraged' && Math.random() < 0.2) {
          const SIZE = NPCShipGeometry.SIZE * (NPCShipGeometry.SIZE_SCALE[NPCShipGeometry.getVariant(npc.type)] || 1);
          const cos = Math.cos(npc.rotation);
          const sin = Math.sin(npc.rotation);

          // Steam vents from sides
          const vents = [
            { x: -SIZE * 0.3, y: -SIZE * 0.4 },
            { x: -SIZE * 0.3, y: SIZE * 0.4 }
          ];

          vents.forEach(vent => {
            const worldX = npc.position.x + vent.x * cos - vent.y * sin;
            const worldY = npc.position.y + vent.x * sin + vent.y * cos;

            ParticleSystem.spawn({
              x: worldX,
              y: worldY,
              vx: (Math.random() - 0.5) * 30,
              vy: (Math.random() - 0.5) * 30 - 20,
              life: 800 + Math.random() * 400,
              color: '#ffffff',
              size: 4 + Math.random() * 3,
              decay: 0.7,
              drag: 0.95,
              type: 'smoke',
              gravity: -10
            });
          });
        }

        NPCShipGeometry.draw(
          ctx,
          npc.position,
          npc.rotation,
          npc.type,
          npc.faction,
          screen,
          Date.now(),
          npc
        );

        // Draw tractor beam for scavengers collecting wreckage
        if (npc.faction === 'scavenger' && npc.collectingWreckagePos && npc.state === 'collecting') {
          this.drawCollectionTractorBeam(ctx, npc, screen, this.camera, Date.now());
        }

        // Draw mining beam for rogue miners actively mining
        const willDrawBeam = npc.faction === 'rogue_miner' && npc.state === 'mining' && npc.miningTargetPos;

        // State-change only logging to reduce noise
        if (npc.faction === 'rogue_miner' && npc.state === 'mining') {
          const hasMtp = !!npc.miningTargetPos;
          const prevHadMtp = npc._debugPrevHasMtp;
          if (hasMtp !== prevHadMtp) {
            if (hasMtp) {
              Logger.category('rogue_miners', `${id}: miningTargetPos SET (${npc.miningTargetPos.x.toFixed(0)}, ${npc.miningTargetPos.y.toFixed(0)})`);
            } else {
              Logger.category('rogue_miners', `${id}: miningTargetPos MISSING while mining`);
            }
            npc._debugPrevHasMtp = hasMtp;
          }
        } else if (npc.faction === 'rogue_miner' && npc._debugPrevHasMtp !== undefined) {
          // Reset tracking when no longer mining
          npc._debugPrevHasMtp = undefined;
        }

        if (willDrawBeam) {
          NPCShipGeometry.drawMiningBeam(ctx, screen, npc, this.camera, Date.now());
        }

        // Draw shield visual for NPCs with shields
        if (typeof ShieldVisual !== "undefined" && npc.shieldMax > 0) {
          const shieldPercent = (npc.shield / npc.shieldMax) * 100;
          // NPCs use tier based on their variant (bosses = tier 3-4, regular = tier 1-2)
          const shieldTier = npc.isBoss ? 4 : npc.isElite ? 3 : 2;
          ShieldVisual.drawShieldForEntity(
            ctx,
            npc.position.x,
            npc.position.y,
            screen.x,
            screen.y,
            npc.rotation,
            shieldPercent,
            shieldTier,
            id,
            NPCShipGeometry.SIZE
          );
        }

        // Draw name above NPC
        if (npc.name) {
          ctx.fillStyle =
            NPCShipGeometry.FACTION_COLORS[npc.faction]?.outline || "#ffffff";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(
            npc.name,
            screen.x,
            screen.y - NPCShipGeometry.SIZE * 1.5
          );
        }

        // Draw hull bar for damaged NPCs (using new renderer)
        if (typeof HullBarRenderer !== "undefined") {
          const lastDamageTime = npc.lastDamageTime || 0;
          HullBarRenderer.drawBar(
            ctx,
            screen.x,
            screen.y,
            npc.hull,
            npc.hullMax,
            lastDamageTime
          );
        } else if (npc.hull < npc.hullMax || npc.shield < npc.shieldMax) {
          // Fallback to old health bar if new renderer not available
          this.drawNPCHealthBar(npc, screen);
        }

        // DEBUG: Draw NPC state indicator
        if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'npcStateIndicators')) {
          this.drawNPCStateLabel(npc, screen);
        }
      } else {
        // Fallback to generic ship
        this.drawShip(npc.position, npc.rotation, "npc", npc.name, 1);
      }
    }

    // Draw weapon projectiles
    WeaponRenderer.draw(ctx, this.camera);

    // Draw NPC weapon effects
    if (typeof NPCWeaponEffects !== "undefined") {
      NPCWeaponEffects.draw(ctx, this.camera);
    }

    // Draw death effects
    if (typeof DeathEffects !== "undefined") {
      DeathEffects.draw(ctx, this.camera);
    }

    // Draw player death wreckage particles (in world space)
    if (typeof PlayerDeathEffect !== "undefined") {
      PlayerDeathEffect.drawWreckage(ctx, this.camera);
    }

    // Draw base destruction sequences
    if (typeof BaseDestructionSequence !== "undefined") {
      BaseDestructionSequence.draw(ctx, this.camera);
    }

    // Draw linked damage effects (swarm)
    if (typeof LinkedDamageEffect !== "undefined") {
      LinkedDamageEffect.draw(ctx, this.camera);
    }

    // Draw formation succession effects (void)
    if (typeof FormationSuccessionEffect !== "undefined") {
      FormationSuccessionEffect.draw(ctx, this.camera);
    }

    // Draw void effects (rifts, gravity wells, consume tendrils)
    if (typeof VoidEffects !== "undefined") {
      VoidEffects.draw(ctx, this.camera);
    }

    // Draw Tesla cannon effects
    if (typeof ChainLightningEffect !== "undefined") {
      ChainLightningEffect.draw(ctx, this.camera);
    }
    if (typeof TeslaCoilEffect !== "undefined") {
      TeslaCoilEffect.draw(ctx, this.camera);
    }

    // Draw emotes
    if (typeof EmoteRenderer !== "undefined") {
      EmoteRenderer.update();
      EmoteRenderer.draw(ctx, this.camera);
    }

    // Draw particles
    ParticleSystem.draw(
      ctx,
      this.camera,
      this.canvas.width,
      this.canvas.height
    );

    // Draw graveyard metallic glint particles
    if (typeof GraveyardAtmosphere !== "undefined" && GraveyardAtmosphere.isActive()) {
      GraveyardAtmosphere.drawGlints(ctx, this.camera, this.width, this.height);
    }

    // Draw floating text (damage numbers, "Invulnerable" text, etc.)
    if (typeof FloatingTextSystem !== "undefined") {
      FloatingTextSystem.draw(ctx, this.camera);
    }

    // Draw derelict interaction prompts on top of all entities
    if (typeof DerelictRenderer !== "undefined" && typeof Player !== "undefined") {
      DerelictRenderer.drawPrompts(ctx, this.camera, Player.position);
    }

    // Draw legacy effects
    this.drawEffects();
  },

  drawPlayer() {
    const ctx = this.ctx;
    const dt = this.lastDt;
    const visualTier = ShipGeometry.getVisualTier(Player.ship);
    const screen = this.worldToScreen(Player.position.x, Player.position.y);
    const shieldTier = Player.ship.shieldTier || 1;

    // Draw boost cooldown indicator under ship (draw first, behind everything)
    if (typeof BoostIndicator !== "undefined") {
      const isOnCooldown =
        Player.isBoostOnCooldown && Player.isBoostOnCooldown();
      const isActive = Player.isBoostActive && Player.isBoostActive();
      const cooldownPercent = Player.getBoostCooldownPercent
        ? Player.getBoostCooldownPercent()
        : 0;
      BoostIndicator.draw(
        ctx,
        screen.x,
        screen.y,
        isOnCooldown,
        cooldownPercent,
        isActive
      );
    }

    // Draw invulnerability glow if active (behind ship)
    if (
      typeof PlayerDeathEffect !== "undefined" &&
      PlayerDeathEffect.isInvulnerable()
    ) {
      PlayerDeathEffect.drawInvulnerabilityGlow(
        ctx,
        screen.x,
        screen.y,
        ShipGeometry.SIZE
      );
    }

    // Draw player ship with custom color
    this.drawShip(
      Player.position,
      Player.rotation,
      "player",
      Player.username,
      visualTier,
      Player.colorId
    );

    // Draw thrust effect
    if (Player.isThrusting()) {
      const isBoosting = Player.isBoostActive && Player.isBoostActive();
      ThrustRenderer.draw(
        ctx,
        Player.position,
        Player.rotation,
        Player.velocity,
        this.camera,
        Player.ship.engineTier,
        Player.getThrustIntensity(),
        dt,
        isBoosting
      );
    } else if (Player.isBoostActive && Player.isBoostActive()) {
      // Clear boost trail when not thrusting
      ThrustRenderer.clearBoostTrail();
    }

    // Draw shield visual around ship
    if (typeof ShieldVisual !== "undefined" && Player.shield.max > 0) {
      const shieldPercent = (Player.shield.current / Player.shield.max) * 100;
      ShieldVisual.drawShieldForEntity(
        ctx,
        Player.position.x,
        Player.position.y,
        screen.x,
        screen.y,
        Player.rotation,
        shieldPercent,
        shieldTier,
        "player",
        ShipGeometry.SIZE
      );
    }

    // Draw hull HP bar above ship
    if (typeof HullBarRenderer !== "undefined") {
      const lastDamageTime = Player.lastDamageTime || 0;
      HullBarRenderer.drawBar(
        ctx,
        screen.x,
        screen.y,
        Player.hull.current,
        Player.hull.max,
        lastDamageTime
      );
    }

    // Draw mining progress bar if mining
    if (Player.miningTarget && Player.miningProgress > 0) {
      this.drawMiningProgress();
    }

    // Draw collection progress bar if collecting wreckage
    if (Player.collectingWreckage && Player.collectProgress > 0) {
      this.drawCollectionProgress();
    }
  },

  /**
   * Draw a ship with tier-based graphics and custom colors
   * @param {Object} position - World position
   * @param {number} rotation - Rotation in radians
   * @param {string} type - 'player', 'other', or 'npc'
   * @param {string} name - Player name (null for NPCs)
   * @param {number} tier - Visual tier 1-5
   * @param {string} colorId - Optional custom color ID for players
   */
  drawShip(position, rotation, type, name, tier, colorId = null) {
    tier = tier || 1;
    const screen = this.worldToScreen(position.x, position.y);
    const ctx = this.ctx;

    // Get colors using the new getShipColors method that supports custom colors
    const colors = ShipGeometry.getShipColors(type, tier, colorId);
    const scale = ShipGeometry.SIZE_SCALE[tier] || 1;
    const glowIntensity = ShipGeometry.GLOW_INTENSITY[tier] || 0;
    const isPlayer = type === "player";

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(rotation);

    // Use the gradient-based drawing for better visuals
    ShipGeometry.drawWithGradient(ctx, tier, colors, isPlayer);

    ctx.restore();

    // Draw cockpit accent (tier 2+) - handled by drawWithGradient

    // Draw name tag below ship
    if (name) {
      ctx.fillStyle = colors.accent;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(name, screen.x, screen.y + ShipGeometry.SIZE * scale + 5);
    }
  },

  /**
   * Draw health bar for NPC
   */
  drawNPCHealthBar(npc, screen) {
    const ctx = this.ctx;
    const barWidth = 40;
    const barHeight = 4;
    const x = screen.x - barWidth / 2;
    const y = screen.y - 30;

    // Shield bar (if NPC has shields)
    if (npc.shieldMax > 0) {
      const shieldRatio = Math.max(0, npc.shield / npc.shieldMax);
      ctx.fillStyle = "#333333";
      ctx.fillRect(x, y - 6, barWidth, barHeight);
      ctx.fillStyle = "#00aaff";
      ctx.fillRect(x, y - 6, barWidth * shieldRatio, barHeight);
    }

    // Hull bar
    const hullRatio = Math.max(0, npc.hull / npc.hullMax);
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, barWidth, barHeight);

    // Color based on health
    let hullColor = "#00ff00";
    if (hullRatio < 0.3) hullColor = "#ff3300";
    else if (hullRatio < 0.6) hullColor = "#ffaa00";

    ctx.fillStyle = hullColor;
    ctx.fillRect(x, y, barWidth * hullRatio, barHeight);
  },

  /**
   * Fire weapon - creates visual effect
   */
  fireWeapon() {
    const visualTier = ShipGeometry.getVisualTier(Player.ship);
    WeaponRenderer.fire(
      Player.position,
      Player.rotation,
      Player.ship.weaponTier,
      visualTier
    );
  },

  drawMiningProgress() {
    const screen = this.worldToScreen(
      Player.miningTarget.x,
      Player.miningTarget.y
    );
    const ctx = this.ctx;
    const target = Player.miningTarget;

    // Get target name and resources
    let targetName = target.type || "Asteroid";
    if (target.resources) {
      // Handle both array and string resources
      const resourceList = Array.isArray(target.resources)
        ? target.resources
        : [target.resources];
      if (resourceList.length > 0) {
        // Show potential resources
        const resourceNames = resourceList.map((r) => {
          const info = CONSTANTS.RESOURCE_TYPES[r];
          return info ? info.name : r;
        });
        targetName = resourceNames.slice(0, 2).join(", ");
        if (resourceList.length > 2) targetName += "...";
      }
    }

    // Draw progress bar
    const barWidth = 60;
    const barHeight = 8;
    const x = screen.x - barWidth / 2;
    const y = screen.y - (target.size || 20) - 30;

    // Background
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(
      x,
      y,
      barWidth * Math.min(1, Player.miningProgress),
      barHeight
    );

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label showing what's being mined
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Mining: " + targetName, screen.x, y - 13);
  },

  showMiningResult(resourceName, quantity) {
    this.miningNotification = {
      text: `+${quantity} ${resourceName}`,
      startTime: Date.now(),
      duration: 2000,
    };
  },

  drawMiningNotification() {
    if (!this.miningNotification) return;

    const elapsed = Date.now() - this.miningNotification.startTime;
    if (elapsed > this.miningNotification.duration) {
      this.miningNotification = null;
      return;
    }

    const ctx = this.ctx;
    const alpha = 1 - elapsed / this.miningNotification.duration;
    const yOffset = -30 - elapsed * 0.03; // Float upward

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      this.miningNotification.text,
      this.canvas.width / 2,
      this.canvas.height / 2 + yOffset
    );
    ctx.restore();
  },

  drawUI() {
    // Draw heat overlay when near stars
    if (typeof StarEffects !== "undefined") {
      StarEffects.drawHeatOverlay(
        this.ctx,
        this.canvas.width,
        this.canvas.height
      );
      StarEffects.drawZoneWarning(
        this.ctx,
        this.canvas.width,
        this.canvas.height
      );
    }

    // Draw reward display (above player ship)
    if (typeof RewardDisplay !== "undefined") {
      RewardDisplay.draw(this.ctx, this.camera);
    }

    // Draw player death effect overlay (on top of everything)
    if (typeof PlayerDeathEffect !== "undefined") {
      PlayerDeathEffect.draw(this.ctx, this.canvas.width, this.canvas.height);
    }
  },

  addEffect(effect) {
    effect.startTime = Date.now();
    this.effects.push(effect);
  },

  drawEffects() {
    const now = Date.now();
    this.effects = this.effects.filter((effect) => {
      const elapsed = now - effect.startTime;
      if (elapsed > effect.duration) return false;

      const screen = this.worldToScreen(effect.x, effect.y);
      const ctx = this.ctx;

      if (effect.type === "damage_number") {
        // Floating damage number
        const alpha = 1 - elapsed / effect.duration;
        const yOffset = -30 - elapsed * 0.05; // Float upward
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ff4444";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        const text = `-${Math.round(effect.damage)}`;
        ctx.strokeText(text, screen.x, screen.y + yOffset);
        ctx.fillText(text, screen.x, screen.y + yOffset);
        ctx.restore();
      }

      return true;
    });
  },

  /**
   * Draw tractor beam effect for scavengers collecting wreckage
   */
  drawCollectionTractorBeam(ctx, npc, npcScreen, camera, time) {
    const wreckagePos = npc.collectingWreckagePos;
    if (!wreckagePos) return;

    // Convert wreckage world position to screen position using the same method as NPCs
    const wreckageScreen = this.worldToScreen(wreckagePos.x, wreckagePos.y);

    // Get NPC colors for scavengers
    const colors = {
      beam: '#B8860B',       // Dark goldenrod beam
      core: '#FFD700',       // Gold core
      particles: '#8B4513'   // Rust brown particles
    };

    // Animation phase
    const phase = (time * 0.003) % (Math.PI * 2);
    const pulseIntensity = 0.5 + Math.sin(phase) * 0.3;

    ctx.save();

    // Draw the beam from NPC to wreckage
    const dx = wreckageScreen.x - npcScreen.x;
    const dy = wreckageScreen.y - npcScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Beam gradient (wider at wreckage, narrower at ship)
    const gradient = ctx.createLinearGradient(
      npcScreen.x, npcScreen.y,
      wreckageScreen.x, wreckageScreen.y
    );
    gradient.addColorStop(0, `rgba(184, 134, 11, ${0.3 * pulseIntensity})`);
    gradient.addColorStop(0.5, `rgba(255, 215, 0, ${0.5 * pulseIntensity})`);
    gradient.addColorStop(1, `rgba(139, 69, 19, ${0.4 * pulseIntensity})`);

    // Draw main beam (tapered shape)
    ctx.beginPath();
    const beamWidthShip = 8;
    const beamWidthWreckage = 25;

    // Calculate perpendicular offsets
    const perpX = Math.sin(angle);
    const perpY = -Math.cos(angle);

    ctx.moveTo(
      npcScreen.x + perpX * beamWidthShip,
      npcScreen.y + perpY * beamWidthShip
    );
    ctx.lineTo(
      wreckageScreen.x + perpX * beamWidthWreckage,
      wreckageScreen.y + perpY * beamWidthWreckage
    );
    ctx.lineTo(
      wreckageScreen.x - perpX * beamWidthWreckage,
      wreckageScreen.y - perpY * beamWidthWreckage
    );
    ctx.lineTo(
      npcScreen.x - perpX * beamWidthShip,
      npcScreen.y - perpY * beamWidthShip
    );
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw central core line
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.8 * pulseIntensity})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 10]);
    ctx.lineDashOffset = -time * 0.05; // Moving dash animation
    ctx.beginPath();
    ctx.moveTo(npcScreen.x, npcScreen.y);
    ctx.lineTo(wreckageScreen.x, wreckageScreen.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw debris particles flowing toward ship
    ctx.fillStyle = colors.particles;
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
      // Each particle at different point along beam
      const t = ((time * 0.001 + i * 0.2) % 1);
      const px = wreckageScreen.x + (npcScreen.x - wreckageScreen.x) * t;
      const py = wreckageScreen.y + (npcScreen.y - wreckageScreen.y) * t;
      // Add some wobble
      const wobble = Math.sin(time * 0.01 + i * 2) * 5;
      const particleSize = 3 + (1 - t) * 4; // Larger near wreckage, smaller near ship

      ctx.globalAlpha = 0.6 * (1 - t * 0.5); // Fade as approaches ship
      ctx.beginPath();
      ctx.arc(px + wobble * perpX, py + wobble * perpY, particleSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw glow around wreckage being collected
    ctx.globalAlpha = 0.3 * pulseIntensity;
    const wreckageGlow = ctx.createRadialGradient(
      wreckageScreen.x, wreckageScreen.y, 0,
      wreckageScreen.x, wreckageScreen.y, 40
    );
    wreckageGlow.addColorStop(0, '#FFD700');
    wreckageGlow.addColorStop(0.5, '#B8860B80');
    wreckageGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = wreckageGlow;
    ctx.beginPath();
    ctx.arc(wreckageScreen.x, wreckageScreen.y, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Spawn debris particles moving toward ship (using particle system)
    if (Math.random() < 0.15 && typeof ParticleSystem !== 'undefined') {
      const spawnT = Math.random();
      const spawnX = wreckagePos.x + (npc.position.x - wreckagePos.x) * spawnT * 0.3;
      const spawnY = wreckagePos.y + (npc.position.y - wreckagePos.y) * spawnT * 0.3;

      ParticleSystem.spawn({
        x: spawnX,
        y: spawnY,
        vx: (npc.position.x - wreckagePos.x) * 0.05,
        vy: (npc.position.y - wreckagePos.y) * 0.05,
        life: 600,
        color: '#8B4513',
        size: 4 + Math.random() * 3,
        decay: 0.9,
        drag: 0.99,
        type: 'debris'
      });
    }
  },

  // ============================================
  // DEBUG RENDERING METHODS
  // ============================================

  /**
   * Draw sector grid lines showing 1000-unit boundaries
   */
  drawSectorGrid() {
    const ctx = this.ctx;
    const SECTOR_SIZE = 1000;

    // Calculate visible area in world coordinates
    const viewLeft = this.camera.x - this.canvas.width / 2;
    const viewRight = this.camera.x + this.canvas.width / 2;
    const viewTop = this.camera.y - this.canvas.height / 2;
    const viewBottom = this.camera.y + this.canvas.height / 2;

    // Find first/last sector boundaries in view
    const firstSectorX = Math.floor(viewLeft / SECTOR_SIZE) * SECTOR_SIZE;
    const lastSectorX = Math.ceil(viewRight / SECTOR_SIZE) * SECTOR_SIZE;
    const firstSectorY = Math.floor(viewTop / SECTOR_SIZE) * SECTOR_SIZE;
    const lastSectorY = Math.ceil(viewBottom / SECTOR_SIZE) * SECTOR_SIZE;

    ctx.save();
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Draw vertical lines
    for (let worldX = firstSectorX; worldX <= lastSectorX; worldX += SECTOR_SIZE) {
      const screenX = worldX - this.camera.x + this.canvas.width / 2;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, this.canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let worldY = firstSectorY; worldY <= lastSectorY; worldY += SECTOR_SIZE) {
      const screenY = worldY - this.camera.y + this.canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(this.canvas.width, screenY);
      ctx.stroke();
    }

    // Draw sector labels at intersections
    ctx.setLineDash([]);
    for (let worldX = firstSectorX; worldX <= lastSectorX; worldX += SECTOR_SIZE) {
      for (let worldY = firstSectorY; worldY <= lastSectorY; worldY += SECTOR_SIZE) {
        const screenX = worldX - this.camera.x + this.canvas.width / 2;
        const screenY = worldY - this.camera.y + this.canvas.height / 2;
        const sectorX = Math.floor(worldX / SECTOR_SIZE);
        const sectorY = Math.floor(worldY / SECTOR_SIZE);
        ctx.fillText(`(${sectorX}, ${sectorY})`, screenX + 5, screenY + 5);
      }
    }

    ctx.restore();
  },

  /**
   * Draw hitbox label with ID and coordinates
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @param {number} size - Object size (radius)
   * @param {string} id - Object ID
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @param {string} typePrefix - Type prefix (AST, PLN, NPC, BASE, SELF)
   * @param {string} [color] - Text color override
   */
  drawHitboxLabel(ctx, screenX, screenY, size, id, worldX, worldY, typePrefix, color) {
    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = color || 'rgba(255, 255, 255, 0.9)';

    // Truncate ID to last 4 characters
    const shortId = String(id || '????').slice(-4);

    // Top-left: Type + ID
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${typePrefix}-${shortId}`, screenX - size, screenY - size - 3);

    // Top-right: Screen coords
    ctx.textAlign = 'right';
    ctx.fillText(`s:${Math.round(screenX)},${Math.round(screenY)}`, screenX + size, screenY - size - 3);

    // Bottom-right: World coords
    ctx.textBaseline = 'top';
    ctx.fillText(`w:${Math.round(worldX)},${Math.round(worldY)}`, screenX + size, screenY + size + 3);

    ctx.restore();
  },

  /**
   * Draw collision hitboxes around objects
   */
  drawCollisionHitboxes(objects, npcs) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;

    // Asteroids - cyan circles
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
    for (const asteroid of objects.asteroids || []) {
      const screen = this.worldToScreen(asteroid.x, asteroid.y);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, asteroid.size, 0, Math.PI * 2);
      ctx.stroke();
      this.drawHitboxLabel(ctx, screen.x, screen.y, asteroid.size, asteroid.id, asteroid.x, asteroid.y, 'AST', 'rgba(0, 255, 255, 0.9)');
    }

    // Planets - magenta circles
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
    for (const planet of objects.planets || []) {
      const screen = this.worldToScreen(planet.x, planet.y);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, planet.size, 0, Math.PI * 2);
      ctx.stroke();
      this.drawHitboxLabel(ctx, screen.x, screen.y, planet.size, planet.id, planet.x, planet.y, 'PLN', 'rgba(255, 0, 255, 0.9)');
    }

    // Bases - orange rectangles
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
    for (const base of objects.bases || []) {
      // Skip bases with invalid coordinates
      if (base.x === undefined || base.y === undefined) continue;
      if (!Number.isFinite(base.x) || !Number.isFinite(base.y)) continue;
      const screen = this.worldToScreen(base.x, base.y);
      const size = base.size || 30;
      ctx.strokeRect(screen.x - size, screen.y - size, size * 2, size * 2);
      this.drawHitboxLabel(ctx, screen.x, screen.y, size, base.id, base.x, base.y, 'BASE', 'rgba(255, 165, 0, 0.9)');
    }

    // NPCs - faction colored circles
    const factionColors = {
      pirates: 'rgba(255, 0, 0, 0.6)',
      scavengers: 'rgba(139, 69, 19, 0.6)',
      swarm: 'rgba(128, 0, 128, 0.6)',
      void: 'rgba(75, 0, 130, 0.6)',
      rogue_miners: 'rgba(255, 215, 0, 0.6)'
    };
    const factionLabelColors = {
      pirates: 'rgba(255, 100, 100, 0.9)',
      scavengers: 'rgba(200, 130, 80, 0.9)',
      swarm: 'rgba(180, 100, 180, 0.9)',
      void: 'rgba(130, 80, 180, 0.9)',
      rogue_miners: 'rgba(255, 230, 100, 0.9)'
    };
    for (const npc of npcs || []) {
      // NPCs have position.x/y, not flat x/y
      const pos = npc.position || { x: npc.x, y: npc.y };
      if (!pos || pos.x === undefined || pos.y === undefined) continue;
      const screen = this.worldToScreen(pos.x, pos.y);
      const npcSize = npc.size || 15;
      ctx.strokeStyle = factionColors[npc.faction] || 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, npcSize, 0, Math.PI * 2);
      ctx.stroke();
      this.drawHitboxLabel(ctx, screen.x, screen.y, npcSize, npc.id, pos.x, pos.y, 'NPC', factionLabelColors[npc.faction] || 'rgba(255, 255, 255, 0.9)');
    }

    // Player - white circle
    if (typeof Player !== 'undefined' && Player.position) {
      const screen = this.worldToScreen(Player.position.x, Player.position.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 15, 0, Math.PI * 2);
      ctx.stroke();
      this.drawHitboxLabel(ctx, screen.x, screen.y, 15, 'SELF', Player.position.x, Player.position.y, 'SELF', 'rgba(255, 255, 255, 0.9)');
    }

    ctx.restore();
  },

  /**
   * Draw NPC state label above an NPC
   */
  drawNPCStateLabel(npc, screenPos) {
    const ctx = this.ctx;
    const state = npc.state || npc.aiState || 'unknown';

    // Color code by state
    const stateColors = {
      idle: '#888888',
      patrol: '#888888',
      mining: '#FFFF00',
      attacking: '#FF0000',
      fleeing: '#00FFFF',
      retreating: '#00FFFF',
      chasing: '#FF6600',
      defending: '#00FF00',
      formation: '#9966FF',
      returning: '#66CCFF'
    };

    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Background for readability
    const text = state.toUpperCase();
    const metrics = ctx.measureText(text);
    const padding = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      screenPos.x - metrics.width / 2 - padding,
      screenPos.y - (npc.size || 15) - 20 - padding,
      metrics.width + padding * 2,
      14
    );

    // State text
    ctx.fillStyle = stateColors[state] || '#FFFFFF';
    ctx.fillText(text, screenPos.x, screenPos.y - (npc.size || 15) - 8);

    ctx.restore();
  },

  /**
   * Draw object ID label below an object
   */
  drawObjectIdLabel(id, screenPos, offset = 0) {
    const ctx = this.ctx;

    ctx.save();
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(136, 136, 136, 0.8)';

    // Display full ID
    ctx.fillText(id, screenPos.x, screenPos.y + offset + 5);

    ctx.restore();
  },
};

// Global callback for PlayerDeathEffect to complete respawn after death sequence
window.handleRespawnComplete = function (respawnData) {
  if (typeof Player !== "undefined") {
    Player.onRespawn(respawnData);
  }
};
