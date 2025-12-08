// Galaxy Miner - Swarm Queen Visuals
// Full arachnid visual with spider body, 8 legs, multiple eyes, and special effects

const QueenVisuals = {
  // Size configuration
  SIZE: 20,
  SCALE: 2.5, // Increased from 1.8 for imposing presence

  // Color palette
  COLORS: {
    hull: '#1a1a1a',           // Pure black
    accent: '#8b0000',         // Dark crimson
    glow: '#8b000040',         // Semi-transparent crimson
    outline: '#660000',        // Deep maroon
    veinColor: '#990000',      // Animated veins
    eyeColor: '#ff0000',       // Bright red eyes
    eyeGlow: '#ff000080',      // Eye glow
    mandible: '#4a0000',       // Dark mandibles
    web: '#8b000060'           // Web tendrils
  },

  // Body geometry
  BODY: {
    cephalothorax: { width: 0.6, height: 0.5, xOffset: 0.3 },
    abdomen: { width: 0.9, height: 1.1, xOffset: -0.5 }
  },

  // Leg configuration (8 legs, 4 pairs)
  LEGS: [
    { angle: -0.4, length: 1.2, phaseOffset: 0 },      // Front-left pair
    { angle: -0.2, length: 1.4, phaseOffset: 0.5 },    // Front-mid pair
    { angle: 0.1, length: 1.3, phaseOffset: 0 },       // Rear-mid pair
    { angle: 0.35, length: 1.1, phaseOffset: 0.5 }     // Rear pair
  ],

  // Eye positions (relative to cephalothorax)
  EYES: [
    { x: 0.35, y: -0.08, radius: 0.07, type: 'primary' },
    { x: 0.35, y: 0.08, radius: 0.07, type: 'primary' },
    { x: 0.42, y: -0.04, radius: 0.04, type: 'secondary' },
    { x: 0.42, y: 0.04, radius: 0.04, type: 'secondary' },
    { x: 0.38, y: -0.12, radius: 0.03, type: 'tertiary' },
    { x: 0.38, y: 0.12, radius: 0.03, type: 'tertiary' }
  ],

  // State tracking
  animationTime: 0,
  phaseTransitions: [],
  activeEffects: [],

  /**
   * Initialize the queen visuals module
   */
  init() {
    this.animationTime = 0;
    this.phaseTransitions = [];
    this.activeEffects = [];
  },

  /**
   * Update animation state
   */
  update(deltaTime) {
    this.animationTime += deltaTime;

    // Clean up expired phase transitions
    const now = Date.now();
    this.phaseTransitions = this.phaseTransitions.filter(t => now - t.startTime < t.duration);

    // Clean up expired effects
    this.activeEffects = this.activeEffects.filter(e => now - e.startTime < e.duration);
  },

  /**
   * Simple draw interface used by npc-ships.js
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Screen X position
   * @param {number} y - Screen Y position
   * @param {number} rotation - Rotation angle
   * @param {number} time - Current timestamp
   * @param {Object} npc - Optional NPC data for phase info
   */
  draw(ctx, x, y, rotation, time, npc) {
    const screenPos = { x, y };
    this.drawQueen(ctx, null, rotation, screenPos, time, npc);
  },

  /**
   * Main draw function for the queen
   */
  drawQueen(ctx, position, rotation, screenPos, time, npc) {
    const scale = this.SIZE * this.SCALE;
    const phase = npc?.phaseManager?.currentPhase || 'HUNT';

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(rotation);

    // Get phase color
    const phaseColors = this.getPhaseColors(phase);

    // Draw web tendrils from abdomen
    this.drawWebTendrils(ctx, scale, time);

    // Draw body segments
    this.drawAbdomen(ctx, scale, phaseColors);
    this.drawCephalothorax(ctx, scale, phaseColors);

    // Draw 8 legs
    this.drawLegs(ctx, scale, time, npc?.velocity || 0);

    // Draw mandibles
    this.drawMandibles(ctx, scale, time, npc?.state === 'combat');

    // Draw eyes
    this.drawEyes(ctx, scale, time, phaseColors);

    // Draw pulsing veins
    this.drawVeins(ctx, scale, time);

    ctx.restore();

    // Draw phase transition effect if active
    if (npc?.phaseTransitionPending) {
      this.triggerPhaseTransition(npc.id, screenPos.x, screenPos.y, npc.phaseTransitionPending);
      npc.phaseTransitionPending = null;
    }
  },

  /**
   * Get colors based on current phase
   */
  getPhaseColors(phase) {
    const phaseConfig = window.CONSTANTS?.SWARM_QUEEN_PHASES?.[phase];
    if (phaseConfig?.color) {
      return {
        primary: phaseConfig.color.primary,
        glow: phaseConfig.color.glow
      };
    }
    return {
      primary: this.COLORS.accent,
      glow: this.COLORS.glow
    };
  },

  /**
   * Draw the bulbous abdomen
   */
  drawAbdomen(ctx, scale, colors) {
    const abdomen = this.BODY.abdomen;
    const x = abdomen.xOffset * scale;
    const width = abdomen.width * scale;
    const height = abdomen.height * scale;

    // Main body
    ctx.fillStyle = this.COLORS.hull;
    ctx.beginPath();
    ctx.ellipse(x, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crimson accent stripes
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(x, 0, width * 0.4, height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Outline
    ctx.strokeStyle = this.COLORS.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  /**
   * Draw the cephalothorax (front section)
   */
  drawCephalothorax(ctx, scale, colors) {
    const ceph = this.BODY.cephalothorax;
    const x = ceph.xOffset * scale;
    const width = ceph.width * scale;
    const height = ceph.height * scale;

    // Main body
    ctx.fillStyle = this.COLORS.hull;
    ctx.beginPath();
    ctx.ellipse(x, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crimson marking
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.1, 0, width * 0.25, height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Outline
    ctx.strokeStyle = this.COLORS.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  /**
   * Draw 8 animated legs
   */
  drawLegs(ctx, scale, time, velocity) {
    const legSpeed = velocity > 10 ? 0.008 : 0.002;

    for (let pair = 0; pair < this.LEGS.length; pair++) {
      const legConfig = this.LEGS[pair];

      // Calculate animation phase for this leg pair
      const phase = (time * legSpeed + legConfig.phaseOffset) % (Math.PI * 2);
      const walkOffset = Math.sin(phase) * 0.15;

      // Draw both legs of the pair (mirror)
      this.drawSingleLeg(ctx, scale, legConfig, walkOffset, 1);  // Top leg
      this.drawSingleLeg(ctx, scale, legConfig, walkOffset, -1); // Bottom leg
    }
  },

  /**
   * Draw a single segmented leg
   */
  drawSingleLeg(ctx, scale, config, walkOffset, side) {
    const baseAngle = config.angle * side - Math.PI / 2 * side;
    const length = config.length * scale;

    // Segment lengths
    const coxa = length * 0.25;
    const femur = length * 0.4;
    const tarsus = length * 0.35;

    // Joint angles with animation
    const coxaAngle = baseAngle + walkOffset * 0.3;
    const femurAngle = 0.5 + walkOffset * 0.2;
    const tarsusAngle = -0.3 - walkOffset * 0.1;

    ctx.strokeStyle = this.COLORS.hull;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Calculate joint positions
    const joint1 = {
      x: Math.cos(coxaAngle) * coxa,
      y: Math.sin(coxaAngle) * coxa
    };

    const joint2 = {
      x: joint1.x + Math.cos(coxaAngle + femurAngle) * femur,
      y: joint1.y + Math.sin(coxaAngle + femurAngle) * femur
    };

    const tip = {
      x: joint2.x + Math.cos(coxaAngle + femurAngle + tarsusAngle) * tarsus,
      y: joint2.y + Math.sin(coxaAngle + femurAngle + tarsusAngle) * tarsus
    };

    // Draw leg segments
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(joint1.x, joint1.y);
    ctx.lineTo(joint2.x, joint2.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Crimson accent on joints
    ctx.fillStyle = this.COLORS.accent;
    ctx.beginPath();
    ctx.arc(joint1.x, joint1.y, 2, 0, Math.PI * 2);
    ctx.arc(joint2.x, joint2.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Claw tip
    ctx.fillStyle = this.COLORS.outline;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw mandibles/fangs
   */
  drawMandibles(ctx, scale, time, isAttacking) {
    const openAmount = isAttacking
      ? 0.4 + Math.sin(time * 0.01) * 0.2
      : 0.2;

    const mandibleLength = scale * 0.3;
    const baseX = scale * 0.5;

    ctx.strokeStyle = this.COLORS.mandible;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Left mandible
    ctx.beginPath();
    ctx.moveTo(baseX, -scale * 0.1);
    ctx.quadraticCurveTo(
      baseX + mandibleLength * 0.5, -scale * 0.05 - openAmount * scale * 0.2,
      baseX + mandibleLength, -openAmount * scale * 0.3
    );
    ctx.stroke();

    // Right mandible
    ctx.beginPath();
    ctx.moveTo(baseX, scale * 0.1);
    ctx.quadraticCurveTo(
      baseX + mandibleLength * 0.5, scale * 0.05 + openAmount * scale * 0.2,
      baseX + mandibleLength, openAmount * scale * 0.3
    );
    ctx.stroke();

    // Fang tips (sharp crimson)
    ctx.fillStyle = this.COLORS.accent;
    ctx.beginPath();
    ctx.arc(baseX + mandibleLength, -openAmount * scale * 0.3, 3, 0, Math.PI * 2);
    ctx.arc(baseX + mandibleLength, openAmount * scale * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw multiple glowing eyes
   */
  drawEyes(ctx, scale, time, colors) {
    const pulsePhase = Math.sin(time * 0.003) * 0.5 + 0.5;

    for (const eye of this.EYES) {
      const x = eye.x * scale;
      const y = eye.y * scale;
      const radius = eye.radius * scale;

      // Eye glow
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
      glowGradient.addColorStop(0, this.COLORS.eyeColor);
      glowGradient.addColorStop(0.5, colors.glow);
      glowGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = glowGradient;
      ctx.globalAlpha = 0.5 + pulsePhase * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Eye core
      ctx.fillStyle = this.COLORS.eyeColor;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Pupil slit
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 0.15, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Reflection highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(x - radius * 0.2, y - radius * 0.2, radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Draw pulsing veins on body
   */
  drawVeins(ctx, scale, time) {
    const pulsePhase = Math.sin(time * 0.003) * 0.5 + 0.5;

    ctx.strokeStyle = this.COLORS.veinColor;
    ctx.lineWidth = 1 + pulsePhase * 0.5;
    ctx.globalAlpha = 0.5 + pulsePhase * 0.4;

    // Abdomen veins
    const abdX = this.BODY.abdomen.xOffset * scale;
    ctx.beginPath();
    ctx.moveTo(abdX - scale * 0.3, 0);
    ctx.quadraticCurveTo(abdX - scale * 0.1, -scale * 0.2, abdX + scale * 0.1, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(abdX - scale * 0.3, 0);
    ctx.quadraticCurveTo(abdX - scale * 0.1, scale * 0.2, abdX + scale * 0.1, 0);
    ctx.stroke();

    ctx.globalAlpha = 1;
  },

  /**
   * Draw web-like energy tendrils from abdomen
   */
  drawWebTendrils(ctx, scale, time) {
    const tendrilCount = 6;
    const baseX = -scale * 0.8;
    const baseLength = scale * 0.6;

    ctx.strokeStyle = this.COLORS.web;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < tendrilCount; i++) {
      const angle = ((i / tendrilCount) - 0.5) * Math.PI * 0.8;
      const wave = Math.sin(time * 0.002 + i) * scale * 0.1;
      const length = baseLength + Math.sin(time * 0.001 + i * 0.5) * scale * 0.2;

      ctx.globalAlpha = 0.4 + Math.sin(time * 0.003 + i) * 0.2;
      ctx.beginPath();
      ctx.moveTo(baseX, 0);
      ctx.quadraticCurveTo(
        baseX - length * 0.5 + wave,
        Math.sin(angle) * length * 0.5,
        baseX - length,
        Math.sin(angle) * length + wave
      );
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Trigger phase transition visual effect
   */
  triggerPhaseTransition(queenId, x, y, transitionData) {
    const phaseConfig = window.CONSTANTS?.SWARM_QUEEN_PHASES?.[transitionData.to];

    this.phaseTransitions.push({
      queenId,
      x,
      y,
      startTime: Date.now(),
      duration: 1500,
      fromPhase: transitionData.from,
      toPhase: transitionData.to,
      targetColor: phaseConfig?.color?.primary || '#8b0000'
    });

    // Spawn particles if particle system available
    if (typeof ParticleSystem !== 'undefined') {
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2;
        ParticleSystem.spawn({
          x: x,
          y: y,
          vx: Math.cos(angle) * 200,
          vy: Math.sin(angle) * 200,
          color: phaseConfig?.color?.primary || '#8b0000',
          size: 4 + Math.random() * 4,
          life: 800,
          type: 'energy',
          drag: 0.95
        });
      }
    }
  },

  /**
   * Draw phase transition effects
   */
  drawPhaseTransitions(ctx, camera) {
    const now = Date.now();

    for (const transition of this.phaseTransitions) {
      const elapsed = now - transition.startTime;
      const progress = elapsed / transition.duration;
      if (progress >= 1) continue;

      const screenX = transition.x;
      const screenY = transition.y;

      // Expanding ring
      const ringRadius = 50 + progress * 150;
      const ringAlpha = 1 - progress;

      ctx.strokeStyle = transition.targetColor;
      ctx.lineWidth = 6 * (1 - progress);
      ctx.globalAlpha = ringAlpha;
      ctx.beginPath();
      ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner flash
      if (progress < 0.3) {
        const flashAlpha = (0.3 - progress) / 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 60 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.QueenVisuals = QueenVisuals;
}
