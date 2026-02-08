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

  // Eye positions (relative to cephalothorax) - 12 eyes in spider pattern
  EYES: [
    // Primary pair (largest, front-facing)
    { x: 0.35, y: -0.08, radius: 0.07, type: 'primary' },
    { x: 0.35, y: 0.08, radius: 0.07, type: 'primary' },
    // Secondary pair (forward lateral)
    { x: 0.42, y: -0.04, radius: 0.04, type: 'secondary' },
    { x: 0.42, y: 0.04, radius: 0.04, type: 'secondary' },
    // Tertiary pairs (6 small eyes for peripheral vision)
    { x: 0.38, y: -0.12, radius: 0.03, type: 'tertiary' },
    { x: 0.38, y: 0.12, radius: 0.03, type: 'tertiary' },
    { x: 0.32, y: -0.15, radius: 0.025, type: 'tertiary' },
    { x: 0.32, y: 0.15, radius: 0.025, type: 'tertiary' },
    { x: 0.28, y: -0.11, radius: 0.02, type: 'tertiary' },
    { x: 0.28, y: 0.11, radius: 0.02, type: 'tertiary' },
    { x: 0.25, y: -0.06, radius: 0.02, type: 'tertiary' },
    { x: 0.25, y: 0.06, radius: 0.02, type: 'tertiary' }
  ],

  // Eye tracking state
  trackedTargetAngle: 0,
  lastTargetUpdate: 0,

  // Leg animation state
  legState: {
    combatRearUp: 0,       // Front legs raise during combat (0-1)
    lowHealthLimp: 0,      // Limp amount when health < 30% (0-1)
    secondaryWiggle: 0     // Secondary organic wiggle phase
  },

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
   * @param {Object} worldPosition - Optional world position for eye tracking
   */
  draw(ctx, x, y, rotation, time, npc, worldPosition) {
    const screenPos = { x, y };

    // Update eye tracking based on world position
    if (worldPosition) {
      this.updateEyeTracking(worldPosition, rotation);
    }

    this.drawQueen(ctx, worldPosition, rotation, screenPos, time, npc);
  },

  /**
   * Find the nearest target (player or other players) to track with eyes
   * @param {Object} queenWorldPos - Queen's world position
   * @returns {Object|null} - Target position or null if none found
   */
  findNearestTarget(queenWorldPos) {
    // Access client game state to find potential targets
    if (typeof window === 'undefined' || !window.game) return null;

    const game = window.game;
    let nearestTarget = null;
    let nearestDist = Infinity;

    // Check local player first
    if (game.player?.position) {
      const px = game.player.position.x;
      const py = game.player.position.y;
      const dx = px - queenWorldPos.x;
      const dy = py - queenWorldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist && dist < 800) { // 800 units eye tracking range
        nearestDist = dist;
        nearestTarget = { x: px, y: py };
      }
    }

    // Check other players
    if (game.otherPlayers) {
      for (const [id, player] of game.otherPlayers) {
        if (player.position) {
          const dx = player.position.x - queenWorldPos.x;
          const dy = player.position.y - queenWorldPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < nearestDist && dist < 800) {
            nearestDist = dist;
            nearestTarget = { x: player.position.x, y: player.position.y };
          }
        }
      }
    }

    return nearestTarget;
  },

  /**
   * Update eye tracking angle toward nearest target
   * @param {Object} worldPosition - Queen's world position
   * @param {number} queenRotation - Queen's current rotation
   */
  updateEyeTracking(worldPosition, queenRotation) {
    const now = Date.now();

    // Throttle target updates to 10Hz for smooth tracking
    if (now - this.lastTargetUpdate < 100) return;
    this.lastTargetUpdate = now;

    const target = this.findNearestTarget(worldPosition);

    if (target) {
      // Calculate angle from queen to target in world space
      const dx = target.x - worldPosition.x;
      const dy = target.y - worldPosition.y;
      const targetAngle = Math.atan2(dy, dx);

      // Convert to local space (relative to queen's rotation)
      this.trackedTargetAngle = targetAngle - queenRotation;
    } else {
      // No target - eyes slowly drift back to center with slight wander
      this.trackedTargetAngle = Math.sin(now * 0.001) * 0.2;
    }
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

    // Draw 8 legs with enhanced animations
    this.drawLegs(ctx, scale, time, npc?.velocity || 0, npc);

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
   * Draw 8 animated legs with enhanced combat/health effects
   */
  drawLegs(ctx, scale, time, velocity, npc) {
    const legSpeed = velocity > 10 ? 0.008 : 0.002;

    // Update leg state based on NPC data
    this.updateLegState(npc, time);

    // Check if in combat and low health
    const inCombat = npc?.state === 'combat' || npc?.state === 'attack';
    const healthPercent = npc?.hull && npc?.maxHull ? npc.hull / npc.maxHull : 1;
    const isLowHealth = healthPercent < 0.3;

    for (let pair = 0; pair < this.LEGS.length; pair++) {
      const legConfig = this.LEGS[pair];
      const isFrontPair = pair <= 1; // First two pairs are front legs

      // Calculate primary walk animation
      const phase = (time * legSpeed + legConfig.phaseOffset) % (Math.PI * 2);
      let walkOffset = Math.sin(phase) * 0.15;

      // Add secondary organic wiggle (different frequency)
      const secondaryWiggle = Math.sin(time * 0.003 + pair * 0.7) * 0.05;
      walkOffset += secondaryWiggle;

      // Combat rear-up for front legs (raise them threateningly)
      const rearUpOffset = isFrontPair && inCombat
        ? this.legState.combatRearUp * 0.3
        : 0;

      // Low health limp (drag rear legs)
      const limpOffset = isLowHealth && pair >= 2
        ? this.legState.lowHealthLimp * (pair - 1) * 0.1
        : 0;

      // Draw both legs of the pair (mirror)
      this.drawSingleLeg(ctx, scale, legConfig, walkOffset, 1, rearUpOffset, limpOffset);  // Top leg
      this.drawSingleLeg(ctx, scale, legConfig, walkOffset, -1, rearUpOffset, limpOffset); // Bottom leg
    }
  },

  /**
   * Update leg animation state based on NPC combat/health status
   */
  updateLegState(npc, time) {
    const inCombat = npc?.state === 'combat' || npc?.state === 'attack';
    const healthPercent = npc?.hull && npc?.maxHull ? npc.hull / npc.maxHull : 1;
    const isLowHealth = healthPercent < 0.3;

    // Smooth transition for combat rear-up
    const targetRearUp = inCombat ? 1 : 0;
    this.legState.combatRearUp += (targetRearUp - this.legState.combatRearUp) * 0.1;

    // Smooth transition for low health limp with irregular timing
    if (isLowHealth) {
      // Irregular limp pattern
      const limpCycle = Math.sin(time * 0.004) * 0.5 + Math.sin(time * 0.007) * 0.5;
      this.legState.lowHealthLimp = 0.5 + limpCycle * 0.5;
    } else {
      this.legState.lowHealthLimp *= 0.95; // Fade out
    }

    // Update secondary wiggle phase
    this.legState.secondaryWiggle = time * 0.003;
  },

  /**
   * Draw a single segmented leg with enhanced animation effects
   * @param {number} rearUpOffset - Combat rear-up angle offset (front legs raise in combat)
   * @param {number} limpOffset - Limp drag amount (rear legs drag when low health)
   */
  drawSingleLeg(ctx, scale, config, walkOffset, side, rearUpOffset = 0, limpOffset = 0) {
    const baseAngle = config.angle * side - Math.PI / 2 * side;
    const length = config.length * scale;

    // Segment lengths
    const coxa = length * 0.25;
    const femur = length * 0.4;
    const tarsus = length * 0.35;

    // Joint angles with animation and combat/limp effects
    // Rear-up raises the leg upward (more negative angle pulls toward body top)
    const coxaAngle = baseAngle + walkOffset * 0.3 - rearUpOffset * side;

    // Femur angle affected by limp (dragging legs are more extended)
    const femurAngle = 0.5 + walkOffset * 0.2 + limpOffset * 0.2;

    // Tarsus affected by limp (tip drags lower)
    const tarsusAngle = -0.3 - walkOffset * 0.1 - limpOffset * 0.15;

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

    // Crimson accent on joints - pulse when low health
    const jointPulse = limpOffset > 0 ? 1 + Math.sin(Date.now() * 0.01) * 0.3 : 1;
    ctx.fillStyle = this.COLORS.accent;
    ctx.beginPath();
    ctx.arc(joint1.x, joint1.y, 2 * jointPulse, 0, Math.PI * 2);
    ctx.arc(joint2.x, joint2.y, 2 * jointPulse, 0, Math.PI * 2);
    ctx.fill();

    // Claw tip - sharper/more prominent when in combat rear-up
    const clawSize = 1.5 + rearUpOffset * 1.5;
    ctx.fillStyle = rearUpOffset > 0.1 ? this.COLORS.accent : this.COLORS.outline;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, clawSize, 0, Math.PI * 2);
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
   * Draw multiple glowing eyes with player tracking
   */
  drawEyes(ctx, scale, time, colors) {
    const pulsePhase = Math.sin(time * 0.003) * 0.5 + 0.5;

    // Tracking intensity varies by eye type (primary eyes track most)
    const trackingIntensity = {
      primary: 0.4,    // 40% of eye radius
      secondary: 0.3,  // 30%
      tertiary: 0.2    // 20%
    };

    for (const eye of this.EYES) {
      const x = eye.x * scale;
      const y = eye.y * scale;
      const radius = eye.radius * scale;

      // Calculate pupil offset based on tracked target angle
      const intensity = trackingIntensity[eye.type] || 0.2;
      const maxOffset = radius * intensity;
      const pupilOffsetX = Math.cos(this.trackedTargetAngle) * maxOffset;
      const pupilOffsetY = Math.sin(this.trackedTargetAngle) * maxOffset;

      // Eye glow (slightly larger for primary eyes)
      const glowMultiplier = eye.type === 'primary' ? 2.5 : 2;
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * glowMultiplier);
      glowGradient.addColorStop(0, this.COLORS.eyeColor);
      glowGradient.addColorStop(0.5, colors.glow);
      glowGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = glowGradient;
      ctx.globalAlpha = 0.5 + pulsePhase * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, radius * glowMultiplier, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Eye core (slightly varied by type)
      const coreSize = eye.type === 'primary' ? 0.65 : 0.6;
      ctx.fillStyle = this.COLORS.eyeColor;
      ctx.beginPath();
      ctx.arc(x, y, radius * coreSize, 0, Math.PI * 2);
      ctx.fill();

      // Pupil slit - offset toward tracked target
      // Rotate pupil slit to face tracked direction for extra creepiness
      const pupilX = x + pupilOffsetX;
      const pupilY = y + pupilOffsetY;
      const pupilRotation = this.trackedTargetAngle;

      ctx.fillStyle = '#000';
      ctx.save();
      ctx.translate(pupilX, pupilY);
      ctx.rotate(pupilRotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.15, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Reflection highlight (offset opposite to pupil for realism)
      const highlightOffsetX = -pupilOffsetX * 0.5 - radius * 0.2;
      const highlightOffsetY = -pupilOffsetY * 0.5 - radius * 0.2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(x + highlightOffsetX, y + highlightOffsetY, radius * 0.15, 0, Math.PI * 2);
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

    // Spawn particles if particle system available - scale count with quality
    if (typeof ParticleSystem !== 'undefined') {
      const particleCount = ParticleSystem.scaleCount ? ParticleSystem.scaleCount(40, 10) : 40;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
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
