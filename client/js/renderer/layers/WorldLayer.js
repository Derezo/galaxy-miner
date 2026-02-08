/**
 * WorldLayer - Renders static world objects
 * Stars, planets, asteroids, wormholes, faction bases, derelict ships
 */
const WorldLayer = {
  /**
   * Draw all world objects
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera position
   * @param {Object} objects - World objects from World.getVisibleObjects()
   */
  draw(ctx, camera, objects) {
    // Draw stars (background layer)
    for (const star of objects.stars) {
      if (!RenderContext.isOnScreen(star.x, star.y, star.size)) continue;
      Renderer.drawStar(star);
    }

    // Draw wormholes
    for (const wormhole of objects.wormholes) {
      if (!RenderContext.isOnScreen(wormhole.x, wormhole.y, wormhole.size)) continue;
      Renderer.drawWormhole(wormhole);
    }

    // Draw planets
    for (const planet of objects.planets) {
      if (!RenderContext.isOnScreen(planet.x, planet.y, planet.size)) continue;
      Renderer.drawPlanet(planet);
    }

    // Draw asteroids
    for (const asteroid of objects.asteroids) {
      if (!RenderContext.isOnScreen(asteroid.x, asteroid.y, asteroid.size)) continue;
      Renderer.drawAsteroid(asteroid);
    }

    // Draw comets
    this.drawComets(ctx, camera, objects.comets);

    // Draw faction bases
    this.drawBases(ctx, camera, objects.bases);

    // Draw derelict ships
    if (typeof DerelictRenderer !== 'undefined' && typeof Player !== 'undefined') {
      DerelictRenderer.draw(ctx, camera, Player.position);
    }
  },

  /**
   * Draw comets with orbital mechanics
   */
  drawComets(ctx, camera, comets) {
    if (!comets || typeof CelestialRenderer === 'undefined' || typeof Physics === 'undefined') {
      return;
    }

    const cameraObj = {
      x: camera.x,
      y: camera.y,
      zoom: 1,
      width: RenderContext.canvas.width,
      height: RenderContext.canvas.height
    };
    const orbitTime = Physics.getOrbitTime();

    for (const comet of comets) {
      const cometState = Physics.computeCometPosition(comet, orbitTime);
      if (cometState.visible) {
        const tailSize = comet.size * (comet.tailLengthFactor || 8);
        if (RenderContext.isOnScreen(cometState.x, cometState.y, tailSize)) {
          CelestialRenderer.drawComet(ctx, comet, cometState, cameraObj);
        }
      }
    }
  },

  /**
   * Draw faction bases with server state integration
   */
  drawBases(ctx, camera, bases) {
    // Draw procedural bases
    for (const base of bases) {
      if (typeof Entities !== 'undefined' && Entities.isBaseDestroyed(base.id)) continue;

      let renderBase = base;
      if (typeof Entities !== 'undefined') {
        const serverBase = Entities.bases.get(base.id);
        if (serverBase) {
          // Use procedural position (base.x/y from getVisibleObjects, computed every frame).
          // Only merge non-positional server state (health, faction, etc.)
          renderBase = {
            ...base,
            health: serverBase.health,
            maxHealth: serverBase.maxHealth,
            type: serverBase.type || base.type,
            faction: serverBase.faction || base.faction,
            scrapPile: serverBase.scrapPile,
            claimCredits: serverBase.claimCredits
          };
        } else {
          const state = Entities.getBaseState(base.id);
          if (state && state.health !== undefined) {
            renderBase = { ...base, health: state.health, maxHealth: state.maxHealth };
          }
        }
      }

      if (!RenderContext.isOnScreen(renderBase.x, renderBase.y, renderBase.size)) continue;

      if (typeof FactionBases !== 'undefined' && FactionBases.draw) {
        FactionBases.draw(ctx, renderBase, camera);
      } else {
        Renderer.drawBase(renderBase);
      }
    }

    // Draw server-tracked bases not in procedural list
    if (typeof Entities !== 'undefined') {
      const proceduralIds = new Set(bases.map(b => b.id));
      for (const [baseId, serverBase] of Entities.bases) {
        if (proceduralIds.has(baseId)) continue;
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
          claimCredits: serverBase.claimCredits
        };

        if (!RenderContext.isOnScreen(base.x, base.y, base.size)) continue;

        if (typeof FactionBases !== 'undefined' && FactionBases.draw) {
          FactionBases.draw(ctx, base, camera);
        } else {
          Renderer.drawBase(base);
        }
      }
    }
  }
};
