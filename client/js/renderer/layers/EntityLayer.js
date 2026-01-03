/**
 * EntityLayer - Renders dynamic entities
 * NPCs, players, wreckage, tractor beams
 */
const EntityLayer = {
  /**
   * Draw all entities
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera position
   */
  draw(ctx, camera) {
    const dt = RenderContext.lastDt;

    // Draw wreckage (behind beams and ships)
    Renderer.drawWreckage();

    // Draw tractor beam (mining)
    this.drawTractorBeam(ctx, camera);

    // Draw tractor beam for loot collection
    this.drawLootTractorBeam(ctx, camera);

    // Draw NPCs with interpolation
    this.drawNPCs(ctx, camera, dt);

    // Draw other players
    this.drawOtherPlayers(ctx, camera);

    // Draw local player (on top)
    this.drawLocalPlayer(ctx, camera);
  },

  /**
   * Draw tractor beam for mining
   */
  drawTractorBeam(ctx, camera) {
    if (!Player.miningTarget || Player.miningProgress <= 0) return;

    const resourceType = Player.miningTarget.resources?.[0] || 'default';
    TractorBeamRenderer.draw(
      ctx,
      Player.position,
      { x: Player.miningTarget.x, y: Player.miningTarget.y },
      camera,
      Player.ship.miningTier,
      Player.miningProgress,
      resourceType,
      false // isLoot
    );
  },

  /**
   * Draw tractor beam for loot collection
   */
  drawLootTractorBeam(ctx, camera) {
    if (!Player.collectingWreckage || Player.collectProgress <= 0) return;

    const wreckage = Player.collectingWreckage;
    TractorBeamRenderer.draw(
      ctx,
      Player.position,
      { x: wreckage.position.x, y: wreckage.position.y },
      camera,
      Player.ship.miningTier,
      Player.collectProgress,
      'loot',
      true // isLoot
    );
  },

  /**
   * Draw NPCs with smooth interpolation
   */
  drawNPCs(ctx, camera, dt) {
    if (typeof Entities === 'undefined') return;

    const npcs = Entities.getInterpolatedNPCs(dt);

    for (const npc of npcs) {
      if (!npc.position) continue;
      if (!RenderContext.isOnScreen(npc.position.x, npc.position.y, 50)) continue;

      const screen = RenderContext.worldToScreen(npc.position.x, npc.position.y);

      // Use advanced NPC ship geometry if available
      if (typeof NPCShipGeometry !== 'undefined') {
        NPCShipGeometry.draw(ctx, npc, screen, npc.rotation);
      } else {
        Renderer.drawNPC(npc, screen);
      }

      // Draw health bar if damaged
      if (npc.shield < npc.shieldMax || npc.hull < npc.hullMax) {
        Renderer.drawNPCHealth(npc, screen);
      }

      // Draw name label
      Renderer.drawNPCLabel(npc, screen);

      // DEBUG: Draw NPC state labels
      if (typeof DebugSettings !== 'undefined' && DebugSettings.get('rendering', 'npcStateLabels')) {
        Renderer.drawNPCStateLabel(npc, screen);
      }
    }
  },

  /**
   * Draw other players
   */
  drawOtherPlayers(ctx, camera) {
    if (typeof Entities === 'undefined') return;

    for (const [id, player] of Entities.players) {
      if (!player.position) continue;
      if (!RenderContext.isOnScreen(player.position.x, player.position.y, 50)) continue;

      const screen = RenderContext.worldToScreen(player.position.x, player.position.y);
      Renderer.drawOtherPlayer(player, screen);
    }
  },

  /**
   * Draw the local player
   */
  drawLocalPlayer(ctx, camera) {
    if (typeof Player === 'undefined') return;

    // Don't draw if playing death animation
    if (typeof PlayerDeathEffect !== 'undefined' && PlayerDeathEffect.isActive()) {
      return;
    }

    // Don't draw if dead and waiting for respawn
    if (Player.isDead) return;

    const screen = RenderContext.worldToScreen(Player.position.x, Player.position.y);
    ShipGeometry.draw(ctx, screen, Player.rotation, Player.thrust, Player.colorId);
  }
};
