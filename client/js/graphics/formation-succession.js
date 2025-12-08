/**
 * Formation Succession Visual Effect
 *
 * Displays visual feedback when a formation leader dies and succession occurs:
 * - Purple crown appears above new leader
 * - Formation lines briefly flash between new leader and members
 * - Crown fades after 3 seconds
 */

const FormationSuccessionEffect = {
  // Active succession effects
  activeSuccessions: [],

  // Configuration
  config: {
    confusionDuration: 1000,    // 1 second confusion phase
    crownDuration: 3000,        // Crown visible for 3 seconds
    reformationDuration: 2000,  // 2 seconds reformation phase
    crownColor: '#cc66ff',      // Purple
    crownGlow: 'rgba(153, 0, 255, 0.4)',
    lineColor: '#9900ff',
    lineGlow: 'rgba(153, 0, 255, 0.3)',
    crownSize: 12,
    lineWidth: 2
  },

  /**
   * Initialize the effect system
   */
  init() {
    this.activeSuccessions = [];
  },

  /**
   * Trigger a succession effect from server event data
   * @param {Object} data - Event data from server
   */
  trigger(data) {
    Logger.log('[FormationSuccession] Triggered:', data);

    this.activeSuccessions.push({
      formationId: data.formationId,
      oldLeaderId: data.oldLeaderId,
      newLeaderId: data.newLeaderId,
      newLeaderType: data.newLeaderType,
      newLeaderName: data.newLeaderName,
      newLeaderPosition: data.newLeaderPosition,
      memberIds: data.memberIds || [],
      startTime: Date.now(),
      confusionDuration: data.confusionDuration || this.config.confusionDuration,
      reformationDuration: data.reformationDuration || this.config.reformationDuration,
      phase: 'confusion' // -> 'crowning' -> 'reforming' -> 'done'
    });
  },

  /**
   * Update all active succession effects
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const now = Date.now();

    this.activeSuccessions = this.activeSuccessions.filter(succession => {
      const elapsed = now - succession.startTime;

      // Phase transitions
      if (elapsed < succession.confusionDuration) {
        succession.phase = 'confusion';
      } else if (elapsed < succession.confusionDuration + 500) {
        succession.phase = 'crowning';
      } else if (elapsed < succession.confusionDuration + succession.reformationDuration) {
        succession.phase = 'reforming';
      } else if (elapsed < this.config.crownDuration) {
        succession.phase = 'crowned';
      } else {
        // Effect complete
        return false;
      }

      return true;
    });
  },

  /**
   * Draw all active succession effects
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera object with x, y properties
   */
  draw(ctx, camera) {
    for (const succession of this.activeSuccessions) {
      const elapsed = Date.now() - succession.startTime;

      // Draw crown during crowning and after
      if (succession.phase === 'crowning' || succession.phase === 'reforming' || succession.phase === 'crowned') {
        this.drawLeaderCrown(ctx, camera, succession, elapsed);
      }

      // Draw formation lines during reforming phase
      if (succession.phase === 'reforming') {
        this.drawFormationLines(ctx, camera, succession, elapsed);
      }
    }
  },

  /**
   * Draw crown above new leader
   */
  drawLeaderCrown(ctx, camera, succession, elapsed) {
    // Find the new leader in entities
    const leader = typeof Entities !== 'undefined' ? Entities.npcs.get(succession.newLeaderId) : null;

    let leaderX, leaderY;
    if (leader) {
      leaderX = leader.x || leader.position?.x;
      leaderY = leader.y || leader.position?.y;
    } else if (succession.newLeaderPosition) {
      // Use initial position if entity not found
      leaderX = succession.newLeaderPosition.x;
      leaderY = succession.newLeaderPosition.y;
    } else {
      return;
    }

    if (leaderX === undefined || leaderY === undefined) return;

    // Screen coordinates
    const screenX = leaderX - camera.x;
    const screenY = leaderY - camera.y;

    // Crown appears with a pulse during "crowning" phase
    const config = this.config;
    const size = config.crownSize;

    // Fade calculation
    let alpha = 1;
    const fadeStart = config.crownDuration - 500;
    if (elapsed > fadeStart) {
      alpha = 1 - (elapsed - fadeStart) / 500;
    }

    // Pulse during crowning phase
    let scale = 1;
    if (succession.phase === 'crowning') {
      const pulseProgress = (elapsed - succession.confusionDuration) / 500;
      scale = 1 + Math.sin(pulseProgress * Math.PI) * 0.3;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Position crown above the NPC
    ctx.translate(screenX, screenY - 40);
    ctx.scale(scale, scale);

    // Draw glow
    ctx.shadowColor = config.crownGlow;
    ctx.shadowBlur = 15;

    // Draw crown shape
    ctx.fillStyle = config.crownColor;
    ctx.beginPath();
    // Simple crown: three points
    ctx.moveTo(-size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.8);
    ctx.lineTo(-size * 0.3, -size * 0.3);
    ctx.lineTo(0, -size);
    ctx.lineTo(size * 0.3, -size * 0.3);
    ctx.lineTo(size * 0.7, -size * 0.8);
    ctx.lineTo(size, 0);
    ctx.closePath();
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.arc(0, -size * 0.5, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Draw formation lines connecting new leader to members
   */
  drawFormationLines(ctx, camera, succession, elapsed) {
    // Find the new leader
    const leader = typeof Entities !== 'undefined' ? Entities.npcs.get(succession.newLeaderId) : null;

    let leaderX, leaderY;
    if (leader) {
      leaderX = leader.x || leader.position?.x;
      leaderY = leader.y || leader.position?.y;
    } else if (succession.newLeaderPosition) {
      leaderX = succession.newLeaderPosition.x;
      leaderY = succession.newLeaderPosition.y;
    } else {
      return;
    }

    if (leaderX === undefined || leaderY === undefined) return;

    const leaderScreenX = leaderX - camera.x;
    const leaderScreenY = leaderY - camera.y;

    // Calculate line alpha - pulse during reformation
    const reformElapsed = elapsed - succession.confusionDuration - 500;
    const pulseAlpha = 0.3 + Math.sin(reformElapsed * 0.01) * 0.3;

    ctx.save();
    ctx.strokeStyle = this.config.lineColor;
    ctx.lineWidth = this.config.lineWidth;
    ctx.globalAlpha = pulseAlpha;

    // Draw glow
    ctx.shadowColor = this.config.lineGlow;
    ctx.shadowBlur = 10;

    // Draw lines to each member
    for (const memberId of succession.memberIds) {
      if (memberId === succession.newLeaderId) continue;

      const member = typeof Entities !== 'undefined' ? Entities.npcs.get(memberId) : null;
      if (!member) continue;

      const memberX = member.x || member.position?.x;
      const memberY = member.y || member.position?.y;

      if (memberX === undefined || memberY === undefined) continue;

      const memberScreenX = memberX - camera.x;
      const memberScreenY = memberY - camera.y;

      // Draw dashed line
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(leaderScreenX, leaderScreenY);
      ctx.lineTo(memberScreenX, memberScreenY);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  },

  /**
   * Check if there are any active effects
   */
  hasActiveEffects() {
    return this.activeSuccessions.length > 0;
  },

  /**
   * Clear all effects
   */
  clear() {
    this.activeSuccessions = [];
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.FormationSuccessionEffect = FormationSuccessionEffect;
}
