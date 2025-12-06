/**
 * Faction Base Rendering
 * Visual representations for each faction's spawn hub
 *
 * pirate_outpost: Metal station with red lights
 * scavenger_yard: Debris pile with hidden glow
 * swarm_hive: Organic mass with pulsing veins
 * void_rift: Swirling dark portal
 * mining_claim: Industrial platform with asteroid
 */

const FactionBases = {
  // Animation state
  animationTime: 0,

  // Base configurations
  CONFIGS: {
    pirate_outpost: {
      size: 80,
      color: '#ff3300',
      secondaryColor: '#880000',
      accentColor: '#ffcc00',
      glowColor: '#ff330060'
    },
    scavenger_yard: {
      size: 100,
      color: '#666666',
      secondaryColor: '#444444',
      accentColor: '#cccc00',
      glowColor: '#cccc0040'
    },
    swarm_hive: {
      size: 90,
      color: '#00ff66',
      secondaryColor: '#006633',
      accentColor: '#66ffaa',
      glowColor: '#00ff6660'
    },
    void_rift: {
      size: 70,
      color: '#9900ff',
      secondaryColor: '#330066',
      accentColor: '#cc66ff',
      glowColor: '#9900ff80'
    },
    mining_claim: {
      size: 85,
      color: '#ff9900',
      secondaryColor: '#664400',
      accentColor: '#ffcc00',
      glowColor: '#ff990050'
    }
  },

  init() {
    console.log('FactionBases initialized');
  },

  update(dt) {
    this.animationTime += dt;
  },

  /**
   * Draw a faction base
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} base - Base object with x, y, type, faction, health
   * @param {object} camera - Camera position
   */
  draw(ctx, base, camera) {
    const screenX = base.x - camera.x;
    const screenY = base.y - camera.y;
    const config = this.CONFIGS[base.type] || this.CONFIGS.pirate_outpost;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Draw based on type
    switch (base.type) {
      case 'pirate_outpost':
        this.drawPirateOutpost(ctx, config);
        break;
      case 'scavenger_yard':
        this.drawScavengerYard(ctx, config);
        break;
      case 'swarm_hive':
        this.drawSwarmHive(ctx, config);
        break;
      case 'void_rift':
        this.drawVoidRift(ctx, config);
        break;
      case 'mining_claim':
        this.drawMiningClaim(ctx, config);
        break;
      default:
        this.drawGenericBase(ctx, config);
    }

    // Draw health bar if damaged
    if (base.health !== undefined && base.maxHealth !== undefined) {
      const healthPercent = base.health / base.maxHealth;
      if (healthPercent < 1) {
        this.drawHealthBar(ctx, config.size, healthPercent);
      }
    }

    ctx.restore();
  },

  drawPirateOutpost(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Outer glow
    const gradient = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 1.5);
    gradient.addColorStop(0, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Main station body - octagonal
    ctx.fillStyle = config.secondaryColor;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
      const r = size * 0.7;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center core
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Docking arms (4 extending arms)
    ctx.strokeStyle = config.secondaryColor;
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
      ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      ctx.stroke();
    }

    // Blinking red lights
    const blinkPhase = Math.floor(time * 2) % 4;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;

      ctx.fillStyle = (i === blinkPhase) ? '#ff0000' : '#660000';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Light glow when active
      if (i === blinkPhase) {
        ctx.fillStyle = '#ff000040';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  drawScavengerYard(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Scattered debris glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.3);
    gradient.addColorStop(0, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Random debris pieces (seeded by position)
    const debrisCount = 12;
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.sin(i * 1.5) * 0.3;
      const dist = size * (0.3 + (i % 3) * 0.25);
      const pieceSize = 8 + (i % 4) * 6;
      const rotation = time * 0.1 * ((i % 2) ? 1 : -1) + i;

      ctx.save();
      ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
      ctx.rotate(rotation);

      // Irregular polygon debris
      ctx.fillStyle = i % 3 === 0 ? config.color : config.secondaryColor;
      ctx.beginPath();
      const points = 4 + (i % 3);
      for (let j = 0; j < points; j++) {
        const pAngle = (Math.PI * 2 * j) / points;
        const r = pieceSize * (0.6 + (j % 2) * 0.4);
        if (j === 0) {
          ctx.moveTo(Math.cos(pAngle) * r, Math.sin(pAngle) * r);
        } else {
          ctx.lineTo(Math.cos(pAngle) * r, Math.sin(pAngle) * r);
        }
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Central salvage node with hidden glow
    const pulseIntensity = 0.5 + Math.sin(time * 2) * 0.3;
    ctx.fillStyle = `rgba(204, 204, 0, ${pulseIntensity * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  },

  drawSwarmHive(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Organic outer glow
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.4);
    gradient.addColorStop(0, config.color + '60');
    gradient.addColorStop(0.5, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Organic mass - bulbous shape
    ctx.fillStyle = config.secondaryColor;
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const angle = (Math.PI * 2 * i) / 36;
      const wobble = Math.sin(angle * 5 + time) * size * 0.1;
      const r = size * 0.7 + wobble;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Pulsing veins
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const baseAngle = (Math.PI * 2 * i) / 6;
      const pulseOffset = Math.sin(time * 3 + i) * 0.2;

      ctx.globalAlpha = 0.6 + pulseOffset;
      ctx.beginPath();
      ctx.moveTo(0, 0);

      // Curved vein path
      const midX = Math.cos(baseAngle + 0.2) * size * 0.4;
      const midY = Math.sin(baseAngle + 0.2) * size * 0.4;
      const endX = Math.cos(baseAngle) * size * 0.65;
      const endY = Math.sin(baseAngle) * size * 0.65;

      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Central eye/core
    const eyePulse = 0.8 + Math.sin(time * 4) * 0.2;
    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.15 * eyePulse, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  },

  drawVoidRift(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Swirling dark aura
    for (let ring = 3; ring >= 0; ring--) {
      const ringSize = size * (1.2 - ring * 0.15);
      const rotation = time * (0.5 + ring * 0.2) * ((ring % 2) ? 1 : -1);

      ctx.save();
      ctx.rotate(rotation);

      // Distorted ring
      const gradient = ctx.createRadialGradient(0, 0, ringSize * 0.5, 0, 0, ringSize);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, config.color + '30');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24;
        const distort = Math.sin(angle * 3 + time * 2 + ring) * ringSize * 0.15;
        const r = ringSize + distort;
        if (i === 0) {
          ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        } else {
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Dark core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    coreGradient.addColorStop(0, '#000000');
    coreGradient.addColorStop(0.6, config.secondaryColor);
    coreGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Energy tendrils emerging from center
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const baseAngle = (Math.PI * 2 * i) / 5 + time * 0.5;
      const length = size * 0.4 + Math.sin(time * 3 + i) * size * 0.2;

      ctx.globalAlpha = 0.5 + Math.sin(time * 2 + i) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);

      // Wavy tendril
      const cp1x = Math.cos(baseAngle + 0.3) * length * 0.5;
      const cp1y = Math.sin(baseAngle + 0.3) * length * 0.5;
      const endX = Math.cos(baseAngle) * length;
      const endY = Math.sin(baseAngle) * length;

      ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Central bright point
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  drawMiningClaim(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Industrial glow
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.2);
    gradient.addColorStop(0, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Asteroid being mined
    ctx.fillStyle = '#554433';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const r = size * 0.4 * (0.8 + Math.sin(i * 2.5) * 0.2);
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Resource veins in asteroid
    ctx.fillStyle = config.accentColor;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + 0.3;
      const dist = size * 0.2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Industrial platform
    ctx.fillStyle = config.secondaryColor;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2;

    // Main platform
    ctx.beginPath();
    ctx.rect(-size * 0.8, size * 0.3, size * 1.6, size * 0.25);
    ctx.fill();
    ctx.stroke();

    // Support struts
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.3);
    ctx.lineTo(-size * 0.3, 0);
    ctx.moveTo(size * 0.5, size * 0.3);
    ctx.lineTo(size * 0.3, 0);
    ctx.stroke();

    // Mining laser beam (animated)
    const laserActive = Math.floor(time * 2) % 3 !== 0;
    if (laserActive) {
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + Math.sin(time * 10) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.lineTo(0, size * 0.05);
      ctx.stroke();

      // Laser glow
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.lineTo(0, size * 0.05);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Warning stripes on platform edges
    ctx.fillStyle = '#ffcc00';
    const stripeWidth = 8;
    for (let i = 0; i < 5; i++) {
      const x = -size * 0.7 + i * size * 0.35;
      ctx.fillRect(x, size * 0.35, stripeWidth, size * 0.15);
    }
  },

  drawGenericBase(ctx, config) {
    const size = config.size;

    // Simple circle with glow
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size);
    gradient.addColorStop(0, config.color);
    gradient.addColorStop(0.5, config.secondaryColor);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  },

  drawHealthBar(ctx, baseSize, healthPercent) {
    const barWidth = baseSize * 1.5;
    const barHeight = 8;
    const y = -baseSize - 20;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(-barWidth / 2, y, barWidth, barHeight);

    // Health fill
    const healthColor = healthPercent > 0.5 ? '#00ff00' :
      healthPercent > 0.25 ? '#ffcc00' : '#ff0000';
    ctx.fillStyle = healthColor;
    ctx.fillRect(-barWidth / 2, y, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barWidth / 2, y, barWidth, barHeight);
  },

  /**
   * Get the visual bounds of a base for culling
   */
  getBounds(base) {
    const config = this.CONFIGS[base.type] || this.CONFIGS.pirate_outpost;
    const padding = config.size * 1.5;
    return {
      left: base.x - padding,
      right: base.x + padding,
      top: base.y - padding,
      bottom: base.y + padding
    };
  }
};
