/**
 * UILayer - Renders in-world UI elements
 * Mining progress, collection progress, notifications, overlays
 */
const UILayer = {
  /**
   * Draw all UI elements
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera position
   */
  draw(ctx, camera) {
    // Draw collection progress bar
    this.drawCollectionProgress(ctx, camera);

    // Draw mining progress bar
    this.drawMiningProgress(ctx, camera);

    // Draw mining notification
    this.drawMiningNotification(ctx);

    // Draw player shield visual
    if (typeof ShieldVisual !== 'undefined' && typeof Player !== 'undefined' && !Player.isDead) {
      const screen = RenderContext.worldToScreen(Player.position.x, Player.position.y);
      ShieldVisual.draw(ctx, screen, Player.shield, Player.shieldMax);
    }

    // Draw player hull bar
    if (typeof HullBarRenderer !== 'undefined' && typeof Player !== 'undefined' && !Player.isDead) {
      HullBarRenderer.draw(ctx, Player.hull, Player.hullMax);
    }

    // Draw boost indicator
    if (typeof BoostIndicator !== 'undefined' && typeof Player !== 'undefined' && !Player.isDead) {
      BoostIndicator.draw(ctx, Player.boostEnergy, Player.boostMax, Player.isBoosting);
    }
  },

  /**
   * Draw collection progress bar for wreckage
   */
  drawCollectionProgress(ctx, camera) {
    if (!Player.collectingWreckage || Player.collectProgress <= 0) return;

    const wreckage = Player.collectingWreckage;
    const screen = RenderContext.worldToScreen(wreckage.position.x, wreckage.position.y);

    const barWidth = 60;
    const barHeight = 8;
    const x = screen.x - barWidth / 2;
    const y = screen.y - 40;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress (golden color for loot)
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x, y, barWidth * Math.min(1, Player.collectProgress), barHeight);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting...', screen.x, y - 13);
  },

  /**
   * Draw mining progress bar
   */
  drawMiningProgress(ctx, camera) {
    if (!Player.miningTarget || Player.miningProgress <= 0) return;

    const target = Player.miningTarget;
    const screen = RenderContext.worldToScreen(target.x, target.y);

    const barWidth = 60;
    const barHeight = 8;
    const x = screen.x - barWidth / 2;
    const y = screen.y - target.size - 20;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(x, y, barWidth * Math.min(1, Player.miningProgress), barHeight);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Mining...', screen.x, y - 5);
  },

  /**
   * Draw mining notification (when resources collected)
   */
  drawMiningNotification(ctx) {
    if (!Renderer.miningNotification) return;

    const notification = Renderer.miningNotification;
    const now = Date.now();
    const elapsed = now - notification.startTime;
    const duration = 2000; // 2 seconds

    if (elapsed > duration) {
      Renderer.miningNotification = null;
      return;
    }

    const alpha = 1 - (elapsed / duration);
    const yOffset = -elapsed * 0.03;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';

    const screen = RenderContext.worldToScreen(notification.x, notification.y);
    ctx.fillText(notification.text, screen.x, screen.y + yOffset);

    ctx.restore();
  }
};
