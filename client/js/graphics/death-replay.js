// Galaxy Miner - Death Replay System
// Records game state every frame for death replay/killcam effect

const DeathReplay = {
  // Circular buffer for frame recording
  stateBuffer: [],
  bufferIndex: 0,
  maxBufferSize: 180, // 3 seconds at 60fps

  // Replay state
  isReplaying: false,
  replayStartIndex: 0,
  replayFrameIndex: 0,
  replayStartTime: 0,
  replaySpeed: 0.25, // Slow-motion
  replayDuration: 2000, // 2 seconds of replay (slowed down)

  // Visual settings
  ghostTint: { r: 255, g: 100, b: 50, a: 0.6 }, // Red/orange tint
  trailLength: 20, // Number of ghost positions to show as trail

  /**
   * Initialize the replay system
   */
  init() {
    this.stateBuffer = [];
    this.bufferIndex = 0;
    this.isReplaying = false;
  },

  /**
   * Record current game state (called every frame from game loop)
   */
  recordFrame() {
    // Don't record during replay or when player is dead
    if (this.isReplaying) return;
    if (typeof Player === 'undefined' || Player.isDead) return;

    // Capture current game state
    const frame = {
      timestamp: Date.now(),
      player: {
        x: Player.position.x,
        y: Player.position.y,
        rotation: Player.rotation,
        vx: Player.velocity.x,
        vy: Player.velocity.y,
        hull: Player.hull,
        shield: Player.shield
      },
      camera: {
        x: typeof Renderer !== 'undefined' ? Renderer.camera.x : Player.position.x,
        y: typeof Renderer !== 'undefined' ? Renderer.camera.y : Player.position.y
      },
      npcs: [],
      projectiles: []
    };

    // Capture nearby NPCs (within 500 units)
    if (typeof Entities !== 'undefined') {
      const nearbyNPCs = Entities.getNPCsInRange(Player.position, 500);
      for (const npc of nearbyNPCs) {
        frame.npcs.push({
          id: npc.id,
          x: npc.position.x,
          y: npc.position.y,
          rotation: npc.rotation || 0,
          type: npc.type,
          faction: npc.faction,
          hull: npc.hull,
          hullMax: npc.hullMax
        });
      }

      // Capture projectiles
      for (const proj of Entities.projectiles) {
        const dx = proj.x - Player.position.x;
        const dy = proj.y - Player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 500) {
          frame.projectiles.push({
            x: proj.x,
            y: proj.y,
            vx: proj.vx,
            vy: proj.vy,
            type: proj.type
          });
        }
      }
    }

    // Store in circular buffer
    if (this.stateBuffer.length < this.maxBufferSize) {
      this.stateBuffer.push(frame);
    } else {
      this.stateBuffer[this.bufferIndex] = frame;
    }
    this.bufferIndex = (this.bufferIndex + 1) % this.maxBufferSize;
  },

  /**
   * Start replay from N frames back
   * @param {number} framesBack - How many frames to replay (default 120 = 2 seconds at 60fps)
   */
  startReplay(framesBack = 120) {
    if (this.stateBuffer.length === 0) {
      Logger.warn('[DeathReplay] No frames recorded, cannot start replay');
      return false;
    }

    const availableFrames = Math.min(framesBack, this.stateBuffer.length);

    // Calculate start index in circular buffer
    this.replayStartIndex = (this.bufferIndex - availableFrames + this.maxBufferSize) % this.maxBufferSize;
    if (this.replayStartIndex < 0) {
      this.replayStartIndex += this.stateBuffer.length;
    }

    this.replayFrameIndex = 0;
    this.replayStartTime = Date.now();
    this.isReplaying = true;
    this.totalReplayFrames = availableFrames;

    Logger.log('[DeathReplay] Started replay with', availableFrames, 'frames');
    return true;
  },

  /**
   * Stop the replay
   */
  stopReplay() {
    this.isReplaying = false;
    Logger.log('[DeathReplay] Replay stopped');
  },

  /**
   * Get current replay progress (0-1)
   */
  getReplayProgress() {
    if (!this.isReplaying) return 0;
    const elapsed = Date.now() - this.replayStartTime;
    return Math.min(1, elapsed / this.replayDuration);
  },

  /**
   * Get the frame data for current replay position
   */
  getCurrentReplayFrame() {
    if (!this.isReplaying || this.stateBuffer.length === 0) return null;

    const progress = this.getReplayProgress();

    // Map progress to frame index
    const frameProgress = progress * this.totalReplayFrames;
    const frameIndex = Math.floor(frameProgress);

    if (frameIndex >= this.totalReplayFrames) {
      return null;
    }

    const bufferIndex = (this.replayStartIndex + frameIndex) % this.stateBuffer.length;
    return this.stateBuffer[bufferIndex];
  },

  /**
   * Get trail frames for ghost effect (last N positions)
   */
  getTrailFrames() {
    if (!this.isReplaying) return [];

    const progress = this.getReplayProgress();
    const frameProgress = progress * this.totalReplayFrames;
    const currentFrame = Math.floor(frameProgress);

    const trail = [];
    const trailCount = Math.min(this.trailLength, currentFrame);

    for (let i = 0; i < trailCount; i++) {
      const frameOffset = currentFrame - trailCount + i;
      if (frameOffset >= 0) {
        const bufferIndex = (this.replayStartIndex + frameOffset) % this.stateBuffer.length;
        const frame = this.stateBuffer[bufferIndex];
        if (frame) {
          trail.push({
            ...frame,
            trailAlpha: (i + 1) / trailCount // Fade from 0 to 1
          });
        }
      }
    }

    return trail;
  },

  /**
   * Render the death replay
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Current camera position {x, y}
   */
  render(ctx, camera) {
    if (!this.isReplaying) return;

    const progress = this.getReplayProgress();

    // Check if replay should end
    if (progress >= 1) {
      this.stopReplay();
      return;
    }

    const currentFrame = this.getCurrentReplayFrame();
    if (!currentFrame) return;

    ctx.save();

    // Apply overall tint overlay for replay effect
    const overlayAlpha = 0.15 * (1 - progress * 0.5); // Fade out slightly
    ctx.fillStyle = `rgba(${this.ghostTint.r}, ${this.ghostTint.g}, ${this.ghostTint.b}, ${overlayAlpha})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw trail (ghost positions leading up to death)
    const trailFrames = this.getTrailFrames();
    for (const trailFrame of trailFrames) {
      this.drawGhostPlayer(ctx, camera, trailFrame.player, trailFrame.trailAlpha * 0.3);
    }

    // Draw current ghost player position
    this.drawGhostPlayer(ctx, camera, currentFrame.player, 0.6);

    // Draw ghost NPCs that were nearby
    for (const npc of currentFrame.npcs) {
      this.drawGhostNPC(ctx, camera, npc);
    }

    // Draw ghost projectiles
    for (const proj of currentFrame.projectiles) {
      this.drawGhostProjectile(ctx, camera, proj);
    }

    // Draw "REPLAY" indicator
    this.drawReplayIndicator(ctx, progress);

    ctx.restore();
  },

  /**
   * Draw ghost player ship
   */
  drawGhostPlayer(ctx, camera, playerData, alpha) {
    const screenX = playerData.x - camera.x + ctx.canvas.width / 2;
    const screenY = playerData.y - camera.y + ctx.canvas.height / 2;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(playerData.rotation);
    ctx.globalAlpha = alpha;

    // Draw ghostly ship outline
    const size = 15;
    ctx.strokeStyle = `rgba(${this.ghostTint.r}, ${this.ghostTint.g}, ${this.ghostTint.b}, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `rgba(${this.ghostTint.r}, ${this.ghostTint.g}, ${this.ghostTint.b}, 1)`;
    ctx.shadowBlur = 10;

    // Ship triangle
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.lineTo(-size * 0.5, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.closePath();
    ctx.stroke();

    // Velocity indicator
    if (playerData.vx || playerData.vy) {
      const velMag = Math.sqrt(playerData.vx * playerData.vx + playerData.vy * playerData.vy);
      if (velMag > 10) {
        ctx.setTransform(1, 0, 0, 1, screenX, screenY);
        const velAngle = Math.atan2(playerData.vy, playerData.vx);
        const velLength = Math.min(velMag * 0.3, 50);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(velAngle) * velLength, Math.sin(velAngle) * velLength);
        ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  /**
   * Draw ghost NPC
   */
  drawGhostNPC(ctx, camera, npcData) {
    const screenX = npcData.x - camera.x + ctx.canvas.width / 2;
    const screenY = npcData.y - camera.y + ctx.canvas.height / 2;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(npcData.rotation || 0);
    ctx.globalAlpha = 0.4;

    const size = 12;

    // Color based on faction
    let color;
    switch (npcData.faction) {
      case 'pirate':
        color = '255, 80, 80'; // Red
        break;
      case 'swarm':
        color = '150, 255, 150'; // Green
        break;
      case 'scavenger':
        color = '200, 200, 100'; // Yellow
        break;
      case 'void':
        color = '150, 100, 255'; // Purple
        break;
      default:
        color = '200, 200, 200'; // Gray
    }

    ctx.strokeStyle = `rgba(${color}, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = `rgba(${color}, 0.8)`;
    ctx.shadowBlur = 8;

    // Simple diamond shape for NPCs
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size * 0.6);
    ctx.lineTo(-size, 0);
    ctx.lineTo(0, -size * 0.6);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw ghost projectile
   */
  drawGhostProjectile(ctx, camera, projData) {
    const screenX = projData.x - camera.x + ctx.canvas.width / 2;
    const screenY = projData.y - camera.y + ctx.canvas.height / 2;

    ctx.save();
    ctx.globalAlpha = 0.5;

    // Color based on projectile type
    let color;
    switch (projData.type) {
      case 'energy':
        color = '100, 200, 255'; // Blue
        break;
      case 'explosive':
        color = '255, 150, 50'; // Orange
        break;
      default:
        color = '255, 255, 200'; // Kinetic - yellowish
    }

    ctx.fillStyle = `rgba(${color}, 0.7)`;
    ctx.shadowColor = `rgba(${color}, 1)`;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Draw replay indicator
   */
  drawReplayIndicator(ctx, progress) {
    const padding = 20;
    const barWidth = 150;
    const barHeight = 4;

    ctx.save();

    // Position in top-left
    const x = padding;
    const y = padding;

    // "REPLAY" text with pulse
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = `rgba(255, 100, 50, ${pulse})`;
    ctx.shadowColor = 'rgba(255, 100, 50, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('◉ REPLAY', x, y + 12);

    // Progress bar background
    ctx.fillStyle = 'rgba(100, 50, 25, 0.5)';
    ctx.fillRect(x, y + 20, barWidth, barHeight);

    // Progress bar fill
    ctx.fillStyle = 'rgba(255, 100, 50, 0.8)';
    ctx.fillRect(x, y + 20, barWidth * progress, barHeight);

    // Time indicator
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 150, 100, 0.8)';
    ctx.shadowBlur = 0;
    const timeText = `${(progress * 2).toFixed(1)}s / 2.0s`;
    ctx.fillText(timeText, x + barWidth + 10, y + 24);

    ctx.restore();
  },

  /**
   * Check if replay is currently active
   */
  isActive() {
    return this.isReplaying;
  },

  /**
   * Clear the recording buffer (e.g., on respawn)
   */
  clearBuffer() {
    this.stateBuffer = [];
    this.bufferIndex = 0;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DeathReplay = DeathReplay;
}
