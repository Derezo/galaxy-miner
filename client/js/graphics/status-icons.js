/**
 * Status Icon Renderer
 * Draws status indicators above player ships
 */

const StatusIconRenderer = {
  ICON_SIZE: 12,
  ICON_OFFSET_Y: -35, // Above ship

  // Colors for each status
  COLORS: {
    mining: '#00ff88',
    combat: '#ff4444',
    trading: '#ffcc00'
  },

  /**
   * Draw status icon for a player
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @param {string} status - Player status ('idle', 'mining', 'combat', 'trading')
   */
  draw(ctx, screenX, screenY, status) {
    if (!status || status === 'idle') return;

    const iconDrawer = this.ICONS[status];
    if (!iconDrawer) return;

    const color = this.COLORS[status] || '#ffffff';
    const x = screenX;
    const y = screenY + this.ICON_OFFSET_Y;

    ctx.save();
    ctx.translate(x, y);

    // Draw glow background
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Draw icon
    iconDrawer(ctx, this.ICON_SIZE, color);

    ctx.restore();
  },

  // Icon drawing functions
  ICONS: {
    // Mining: Pickaxe shape
    mining: (ctx, size, color) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Pickaxe handle
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, size * 0.4);
      ctx.lineTo(size * 0.3, -size * 0.3);
      ctx.stroke();

      // Pickaxe head
      ctx.beginPath();
      ctx.moveTo(size * 0.1, -size * 0.5);
      ctx.lineTo(size * 0.5, -size * 0.1);
      ctx.lineTo(size * 0.3, -size * 0.3);
      ctx.closePath();
      ctx.fill();
    },

    // Combat: Crosshair
    combat: (ctx, size, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Outer circle
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.6);
      ctx.lineTo(0, -size * 0.2);
      ctx.moveTo(0, size * 0.2);
      ctx.lineTo(0, size * 0.6);
      ctx.moveTo(-size * 0.6, 0);
      ctx.lineTo(-size * 0.2, 0);
      ctx.moveTo(size * 0.2, 0);
      ctx.lineTo(size * 0.6, 0);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    },

    // Trading: Handshake/exchange
    trading: (ctx, size, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Two arrows exchanging
      // Left arrow pointing right
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, -size * 0.2);
      ctx.lineTo(size * 0.1, -size * 0.2);
      ctx.lineTo(0, -size * 0.4);
      ctx.moveTo(size * 0.1, -size * 0.2);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Right arrow pointing left
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.2);
      ctx.lineTo(-size * 0.1, size * 0.2);
      ctx.lineTo(0, size * 0.4);
      ctx.moveTo(-size * 0.1, size * 0.2);
      ctx.lineTo(0, 0);
      ctx.stroke();
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.StatusIconRenderer = StatusIconRenderer;
}
