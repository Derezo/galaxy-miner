/**
 * RenderPipeline - Orchestrates layer-based rendering
 * Coordinates all render layers in correct order
 */
const RenderPipeline = {
  /**
   * Initialize the render pipeline
   */
  init() {
    Logger.log('RenderPipeline initialized');
  },

  /**
   * Execute full render frame
   * Called from Renderer.draw() or game loop
   */
  render() {
    const ctx = RenderContext.ctx;
    const camera = RenderContext.camera;

    // Update camera position
    RenderContext.updateCamera();

    // Get visible world objects
    const objects = World.getVisibleObjects(
      Player.position,
      Math.max(RenderContext.canvas.width, RenderContext.canvas.height)
    );

    // Layer 1: Background (BackgroundSystem handles this in clear())
    // Already drawn by Renderer.clear()

    // Layer 2: Debug sector grid (background layer, behind world)
    if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'sectorGrid')) {
      DebugLayer.drawSectorGrid(ctx, camera);
    }

    // Layer 3: World objects (stars, planets, asteroids, bases)
    WorldLayer.draw(ctx, camera, objects);

    // Layer 4: Entities (NPCs, players, wreckage)
    EntityLayer.draw(ctx, camera);

    // Layer 5: Effects (weapons, particles, death effects)
    EffectsLayer.draw(ctx, camera);

    // Layer 6: In-world UI (progress bars, notifications)
    UILayer.draw(ctx, camera);

    // Layer 7: Debug overlays (hitboxes, NPC states)
    if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'collisionHitboxes')) {
      DebugLayer.draw(ctx, camera, objects);
    }
  },

  /**
   * Render just the world layer (for isolated testing)
   */
  renderWorld() {
    const ctx = RenderContext.ctx;
    const camera = RenderContext.camera;
    const objects = World.getVisibleObjects(
      Player.position,
      Math.max(RenderContext.canvas.width, RenderContext.canvas.height)
    );
    WorldLayer.draw(ctx, camera, objects);
  },

  /**
   * Render just entities (for isolated testing)
   */
  renderEntities() {
    const ctx = RenderContext.ctx;
    const camera = RenderContext.camera;
    EntityLayer.draw(ctx, camera);
  },

  /**
   * Render just effects (for isolated testing)
   */
  renderEffects() {
    const ctx = RenderContext.ctx;
    const camera = RenderContext.camera;
    EffectsLayer.draw(ctx, camera);
  }
};
