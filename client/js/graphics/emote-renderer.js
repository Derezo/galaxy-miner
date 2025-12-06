/**
 * Emote Renderer
 * Displays floating emote icons above player positions
 */

const EmoteRenderer = {
  activeEmotes: [],

  /**
   * Show an emote at a position
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {string} emoteType - Type from CONSTANTS.EMOTES
   * @param {string} playerName - Player who sent the emote
   */
  show(x, y, emoteType, playerName) {
    const emote = CONSTANTS.EMOTES[emoteType];
    if (!emote) return;

    this.activeEmotes.push({
      x,
      y,
      icon: emote.icon,
      name: emote.name,
      playerName,
      startTime: Date.now(),
      duration: emote.duration
    });
  },

  /**
   * Update active emotes (remove expired)
   */
  update() {
    const now = Date.now();
    this.activeEmotes = this.activeEmotes.filter(e =>
      now - e.startTime < e.duration
    );
  },

  /**
   * Draw all active emotes
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera - Camera position
   */
  draw(ctx, camera) {
    const now = Date.now();

    for (const emote of this.activeEmotes) {
      const elapsed = now - emote.startTime;
      const progress = elapsed / emote.duration;

      // Calculate fade and float
      const alpha = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;
      const floatY = -30 - (elapsed * 0.02); // Float upward

      const screenX = emote.x - camera.x;
      const screenY = emote.y - camera.y + floatY;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Draw emote icon (large)
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emote.icon, screenX, screenY);

      // Draw player name below
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(emote.playerName, screenX, screenY + 25);

      ctx.restore();
    }
  },

  /**
   * Clear all active emotes
   */
  clear() {
    this.activeEmotes = [];
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.EmoteRenderer = EmoteRenderer;
}
