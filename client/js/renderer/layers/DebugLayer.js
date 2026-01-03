/**
 * DebugLayer - Renders debug overlays
 * Sector grid, collision hitboxes, NPC states, object IDs
 */
const DebugLayer = {
  /**
   * Draw all debug overlays (only when debug settings enabled)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera position
   * @param {Object} objects - World objects
   */
  draw(ctx, camera, objects) {
    if (typeof DebugSettings === 'undefined') return;

    // Draw sector grid
    if (DebugSettings.get('rendering', 'sectorGrid')) {
      this.drawSectorGrid(ctx, camera);
    }

    // Draw collision hitboxes
    if (DebugSettings.get('rendering', 'collisionHitboxes')) {
      const npcsArray = typeof Entities !== 'undefined' ? Array.from(Entities.npcs.values()) : [];
      const basesWithServerPositions = this.getBasesWithServerPositions(objects.bases);
      Renderer.drawCollisionHitboxes({ ...objects, bases: basesWithServerPositions }, npcsArray);
    }
  },

  /**
   * Draw sector grid overlay
   */
  drawSectorGrid(ctx, camera) {
    const SECTOR_SIZE = CONSTANTS.SECTOR_SIZE || 1000;
    const width = RenderContext.width;
    const height = RenderContext.height;

    // Calculate visible sector range
    const startSectorX = Math.floor(camera.x / SECTOR_SIZE);
    const startSectorY = Math.floor(camera.y / SECTOR_SIZE);
    const endSectorX = Math.ceil((camera.x + width) / SECTOR_SIZE);
    const endSectorY = Math.ceil((camera.y + height) / SECTOR_SIZE);

    ctx.save();
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Draw vertical lines and labels
    for (let x = startSectorX; x <= endSectorX; x++) {
      const screenX = x * SECTOR_SIZE - camera.x;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = startSectorY; y <= endSectorY; y++) {
      const screenY = y * SECTOR_SIZE - camera.y;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }

    // Draw sector labels
    for (let x = startSectorX; x <= endSectorX; x++) {
      for (let y = startSectorY; y <= endSectorY; y++) {
        const screenX = (x + 0.5) * SECTOR_SIZE - camera.x;
        const screenY = (y + 0.5) * SECTOR_SIZE - camera.y;

        // Only draw if sector center is on screen
        if (screenX > 0 && screenX < width && screenY > 0 && screenY < height) {
          ctx.fillText(`${x},${y}`, screenX, screenY - 6);
        }
      }
    }

    ctx.restore();
  },

  /**
   * Get bases with server-authoritative positions for hitbox rendering
   */
  getBasesWithServerPositions(proceduralBases) {
    if (typeof Entities === 'undefined') return proceduralBases;

    const proceduralIds = new Set((proceduralBases || []).map(b => b.id));

    // Update procedural bases with server positions
    let allBases = (proceduralBases || []).map(base => {
      const serverBase = Entities.bases.get(base.id);
      if (serverBase && serverBase.position) {
        return {
          ...base,
          x: serverBase.position.x,
          y: serverBase.position.y,
          size: serverBase.size || base.size || 100
        };
      }
      return base;
    });

    // Add server-tracked bases not in procedural list
    for (const [baseId, serverBase] of Entities.bases) {
      if (proceduralIds.has(baseId)) continue;
      if (Entities.isBaseDestroyed(baseId)) continue;

      allBases.push({
        id: baseId,
        x: serverBase.position?.x ?? serverBase.x,
        y: serverBase.position?.y ?? serverBase.y,
        size: serverBase.size || 100,
        faction: serverBase.faction
      });
    }

    return allBases;
  }
};
