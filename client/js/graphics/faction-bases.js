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
  lastParticleSpawn: 0,
  particleSpawnInterval: 0.1, // Spawn particles every 100ms

  // Damage flash effects (baseId -> { intensity, isShield, time })
  damageFlashes: new Map(),
  FLASH_DURATION: 0.3, // seconds

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
      // Stealthy predator hive - black with crimson veins
      size: 90,
      color: '#1a1a1a',
      secondaryColor: '#0d0d0d',
      accentColor: '#8b0000',
      glowColor: '#8b000040',
      veinColor: '#990000',
      eyeColor: '#ff0000'
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
    },
    // ============================================
    // ASSIMILATED BASES - Swarm-converted versions
    // Dark crimson theme with organic corruption
    // ============================================
    assimilated_pirate_outpost: {
      size: 96,  // 20% larger
      color: '#1a0505',
      secondaryColor: '#0d0303',
      accentColor: '#8b0000',
      glowColor: '#8b000050',
      veinColor: '#990000',
      eyeColor: '#ff0000'
    },
    assimilated_scavenger_yard: {
      size: 120,  // 20% larger
      color: '#1a0808',
      secondaryColor: '#0d0404',
      accentColor: '#8b0000',
      glowColor: '#8b000050',
      veinColor: '#990000',
      eyeColor: '#ff0000'
    },
    assimilated_void_rift: {
      size: 84,  // 20% larger
      color: '#660033',
      secondaryColor: '#330019',
      accentColor: '#8b0000',
      glowColor: '#8b000080',
      veinColor: '#990000',
      eyeColor: '#ff0000'
    },
    assimilated_mining_claim: {
      size: 102,  // 20% larger
      color: '#1a0a00',
      secondaryColor: '#0d0500',
      accentColor: '#8b0000',
      glowColor: '#8b000050',
      veinColor: '#990000',
      eyeColor: '#ff0000'
    }
  },

  init() {
    Logger.log('FactionBases initialized');
  },

  update(dt) {
    this.animationTime += dt;

    // Update and decay damage flashes
    for (const [baseId, flash] of this.damageFlashes) {
      flash.time += dt;
      flash.intensity = Math.max(0, 1 - (flash.time / this.FLASH_DURATION));
      if (flash.intensity <= 0) {
        this.damageFlashes.delete(baseId);
      }
    }
  },

  /**
   * Add a damage flash effect to a base
   * @param {string} baseId - Base identifier
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} size - Base size
   * @param {string} faction - Faction type
   * @param {boolean} isShield - True for shield hit (blue), false for hull hit (orange)
   */
  addDamageFlash(baseId, x, y, size, faction, isShield) {
    this.damageFlashes.set(baseId, {
      intensity: 1,
      isShield: isShield,
      time: 0,
      x: x,
      y: y,
      size: size,
      faction: faction
    });
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

    // Spawn environmental particles (throttled)
    if (this.animationTime - this.lastParticleSpawn > this.particleSpawnInterval) {
      this.spawnEnvironmentParticles(base, config);
      this.lastParticleSpawn = this.animationTime;
    }

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
      // Assimilated bases - swarm-corrupted versions
      case 'assimilated_pirate_outpost':
        this.drawAssimilatedPirateOutpost(ctx, config);
        break;
      case 'assimilated_scavenger_yard':
        this.drawAssimilatedScavengerYard(ctx, config);
        break;
      case 'assimilated_void_rift':
        this.drawAssimilatedVoidRift(ctx, config);
        break;
      case 'assimilated_mining_claim':
        this.drawAssimilatedMiningClaim(ctx, config);
        break;
      default:
        this.drawGenericBase(ctx, config);
    }

    // Draw damage flash effect if active
    const flash = this.damageFlashes.get(base.id);
    if (flash && flash.intensity > 0) {
      this.drawDamageFlash(ctx, config.size, flash);
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

  /**
   * Draw damage flash overlay effect
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} baseSize - Size of the base
   * @param {object} flash - Flash state { intensity, isShield }
   */
  drawDamageFlash(ctx, baseSize, flash) {
    const alpha = flash.intensity * 0.6;

    // Shield hit: blue ripple effect
    // Hull hit: orange/red flash effect
    if (flash.isShield) {
      // Blue shield ripple - expands outward
      const rippleSize = baseSize * (1.2 + (1 - flash.intensity) * 0.5);
      const gradient = ctx.createRadialGradient(0, 0, baseSize * 0.3, 0, 0, rippleSize);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.6, `rgba(0, 170, 255, ${alpha * 0.3})`);
      gradient.addColorStop(0.8, `rgba(0, 170, 255, ${alpha})`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, rippleSize, 0, Math.PI * 2);
      ctx.fill();

      // Inner shield glow
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(0, 0, baseSize * 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Hull damage - orange/red flash
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 1.1);
      gradient.addColorStop(0, `rgba(255, 100, 0, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(255, 50, 0, ${alpha * 0.6})`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, baseSize * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Fire/damage sparks at random positions
      if (flash.intensity > 0.5) {
        ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 + flash.time * 3;
          const dist = baseSize * (0.4 + Math.random() * 0.4);
          const sparkX = Math.cos(angle) * dist;
          const sparkY = Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, 3 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  /**
   * Spawn environmental particles around the base
   */
  spawnEnvironmentParticles(base, config) {
    if (typeof ParticleSystem === 'undefined') return;
    if (Math.random() > 0.3) return; // Only spawn sometimes

    const size = config.size;

    switch (base.type) {
      case 'pirate_outpost':
        // Exhaust vents - smoke particles
        if (Math.random() > 0.5) {
          const ventAngle = Math.random() * Math.PI * 2;
          ParticleSystem.spawn({
            x: base.x + Math.cos(ventAngle) * size * 0.6,
            y: base.y + Math.sin(ventAngle) * size * 0.6,
            vx: Math.cos(ventAngle) * 20,
            vy: Math.sin(ventAngle) * 20 - 15,
            color: '#666666',
            size: 3 + Math.random() * 3,
            life: 600 + Math.random() * 400,
            type: 'smoke',
            drag: 0.99,
            decay: 0.7,
            gravity: -5
          });
        }
        break;

      case 'scavenger_yard':
        // Cutting sparks
        if (Math.random() > 0.7) {
          const sparkX = base.x + (Math.random() - 0.5) * size;
          const sparkY = base.y + (Math.random() - 0.5) * size;
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            ParticleSystem.spawn({
              x: sparkX,
              y: sparkY,
              vx: Math.cos(angle) * (50 + Math.random() * 80),
              vy: Math.sin(angle) * (50 + Math.random() * 80),
              color: '#ffcc00',
              size: 1 + Math.random(),
              life: 150 + Math.random() * 100,
              type: 'spark',
              drag: 0.95,
              decay: 1.2
            });
          }
        }
        break;

      case 'swarm_hive':
        // Crimson spores
        if (Math.random() > 0.6) {
          const sporeAngle = Math.random() * Math.PI * 2;
          const sporeDist = size * 0.5 + Math.random() * size * 0.5;
          ParticleSystem.spawn({
            x: base.x + Math.cos(sporeAngle) * sporeDist,
            y: base.y + Math.sin(sporeAngle) * sporeDist,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            color: config.veinColor || '#990000',
            size: 2 + Math.random() * 2,
            life: 800 + Math.random() * 600,
            type: 'glow',
            drag: 0.995,
            decay: 0.8,
            pulse: true,
            pulseSpeed: 3
          });
        }
        break;

      case 'void_rift':
        // Dust being sucked in
        if (Math.random() > 0.4) {
          const dustAngle = Math.random() * Math.PI * 2;
          const dustDist = size * 1.5 + Math.random() * size;
          const pullSpeed = 60 + Math.random() * 40;
          ParticleSystem.spawn({
            x: base.x + Math.cos(dustAngle) * dustDist,
            y: base.y + Math.sin(dustAngle) * dustDist,
            vx: -Math.cos(dustAngle) * pullSpeed,
            vy: -Math.sin(dustAngle) * pullSpeed,
            color: config.color,
            size: 1.5 + Math.random() * 2,
            life: 400 + Math.random() * 300,
            type: 'energy',
            drag: 0.98,
            decay: 1,
            pulse: true,
            pulseSpeed: 5
          });
        }
        break;

      case 'mining_claim':
        // Rock dust from drilling
        if (Math.random() > 0.5) {
          const dustY = base.y + size * 0.1;
          ParticleSystem.spawn({
            x: base.x + (Math.random() - 0.5) * 20,
            y: dustY,
            vx: (Math.random() - 0.5) * 40,
            vy: -20 - Math.random() * 30,
            color: '#aa8866',
            size: 2 + Math.random() * 2,
            life: 500 + Math.random() * 300,
            type: 'smoke',
            drag: 0.98,
            decay: 0.9,
            gravity: 20
          });
        }
        break;

      // Assimilated bases - corruption spores and veins
      case 'assimilated_pirate_outpost':
      case 'assimilated_scavenger_yard':
      case 'assimilated_void_rift':
      case 'assimilated_mining_claim':
        // Dark crimson corruption spores
        if (Math.random() > 0.5) {
          const sporeAngle = Math.random() * Math.PI * 2;
          const sporeDist = size * 0.4 + Math.random() * size * 0.6;
          ParticleSystem.spawn({
            x: base.x + Math.cos(sporeAngle) * sporeDist,
            y: base.y + Math.sin(sporeAngle) * sporeDist,
            vx: (Math.random() - 0.5) * 25,
            vy: (Math.random() - 0.5) * 25,
            color: config.veinColor || '#990000',
            size: 2 + Math.random() * 3,
            life: 900 + Math.random() * 700,
            type: 'glow',
            drag: 0.992,
            decay: 0.7,
            pulse: true,
            pulseSpeed: 2.5
          });
        }
        // Occasional bright red "infection" pulse
        if (Math.random() > 0.85) {
          ParticleSystem.spawn({
            x: base.x + (Math.random() - 0.5) * size * 0.6,
            y: base.y + (Math.random() - 0.5) * size * 0.6,
            vx: 0,
            vy: 0,
            color: '#ff0000',
            size: 4 + Math.random() * 4,
            life: 400 + Math.random() * 200,
            type: 'glow',
            drag: 1,
            decay: 1.5
          });
        }
        break;
    }
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

    // Skull insignia in center
    this.drawSkullInsignia(ctx, 0, 0, size * 0.18);

    // Rotating turrets on docking arms
    const turretRotation = time * 0.5;
    ctx.strokeStyle = config.secondaryColor;
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const armEndX = Math.cos(angle) * size;
      const armEndY = Math.sin(angle) * size;

      // Docking arm
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
      ctx.lineTo(armEndX, armEndY);
      ctx.stroke();

      // Turret base
      ctx.fillStyle = config.secondaryColor;
      ctx.beginPath();
      ctx.arc(armEndX, armEndY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Rotating turret barrel
      const barrelAngle = turretRotation + i * 0.7;
      const barrelLength = 12;
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(armEndX, armEndY);
      ctx.lineTo(
        armEndX + Math.cos(barrelAngle) * barrelLength,
        armEndY + Math.sin(barrelAngle) * barrelLength
      );
      ctx.stroke();
    }

    // Scanning light beam
    const scanAngle = time * 1.5;
    const scanLength = size * 1.2;
    ctx.save();
    ctx.rotate(scanAngle);
    const scanGradient = ctx.createLinearGradient(0, 0, scanLength, 0);
    scanGradient.addColorStop(0, '#ff000060');
    scanGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(scanLength, -8);
    ctx.lineTo(scanLength, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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

  /**
   * Draw a skull insignia
   */
  drawSkullInsignia(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    // Skull outline
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    // Head shape
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.1, size * 0.7, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Jaw
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.3);
    ctx.lineTo(-size * 0.3, size * 0.8);
    ctx.lineTo(size * 0.3, size * 0.8);
    ctx.lineTo(size * 0.5, size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eye sockets
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(-size * 0.25, -size * 0.15, size * 0.2, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.25, -size * 0.15, size * 0.2, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose hole
    ctx.beginPath();
    ctx.moveTo(0, size * 0.15);
    ctx.lineTo(-size * 0.1, size * 0.35);
    ctx.lineTo(size * 0.1, size * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
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

    // Crane arm with animated swing
    const craneAngle = Math.sin(time * 0.3) * 0.4;
    const craneLength = size * 0.8;
    ctx.save();
    ctx.rotate(craneAngle - Math.PI / 4);

    // Crane base
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Crane arm
    ctx.strokeStyle = config.secondaryColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(craneLength, 0);
    ctx.stroke();

    // Claw at end (open/close animation)
    const clawOpen = 0.3 + Math.sin(time * 2) * 0.15;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(craneLength, 0);
    ctx.lineTo(craneLength + 15, -15 * clawOpen);
    ctx.moveTo(craneLength, 0);
    ctx.lineTo(craneLength + 15, 15 * clawOpen);
    ctx.stroke();

    ctx.restore();

    // Central salvage node with hidden glow
    const pulseIntensity = 0.5 + Math.sin(time * 2) * 0.3;
    ctx.fillStyle = `rgba(204, 204, 0, ${pulseIntensity * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Gear insignia in center
    this.drawGearInsignia(ctx, 0, 0, 15);
  },

  /**
   * Draw a gear insignia
   */
  drawGearInsignia(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    const teeth = 8;
    const innerRadius = size * 0.5;
    const outerRadius = size * 0.85;

    ctx.fillStyle = '#cccc00';
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (Math.PI * 2 * i) / (teeth * 2);
      const r = (i % 2 === 0) ? outerRadius : innerRadius;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center hole
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

    // Spawn pods (bulging sacs around the edge)
    for (let i = 0; i < 5; i++) {
      const podAngle = (Math.PI * 2 * i) / 5 + time * 0.1;
      const podDist = size * 0.55;
      const podX = Math.cos(podAngle) * podDist;
      const podY = Math.sin(podAngle) * podDist;

      // Pod bulge animation (one at a time cycles through)
      const activePod = Math.floor(time * 0.5) % 5;
      const isActive = i === activePod;
      const bulgePhase = isActive ? Math.sin((time * 2) % Math.PI) : 0;
      const podSize = size * 0.18 * (1 + bulgePhase * 0.4);

      // Pod membrane
      const podGradient = ctx.createRadialGradient(podX, podY, 0, podX, podY, podSize);
      podGradient.addColorStop(0, config.veinColor || '#990000');
      podGradient.addColorStop(0.6, config.secondaryColor);
      podGradient.addColorStop(1, config.color);

      ctx.fillStyle = podGradient;
      ctx.beginPath();
      ctx.ellipse(podX, podY, podSize * 0.8, podSize, podAngle, 0, Math.PI * 2);
      ctx.fill();

      // Veins on pod
      if (isActive) {
        ctx.strokeStyle = config.eyeColor || '#ff0000';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(podX, podY);
        ctx.lineTo(podX + Math.cos(podAngle) * podSize, podY + Math.sin(podAngle) * podSize);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Organic mass - bulbous shape
    ctx.fillStyle = config.secondaryColor;
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const angle = (Math.PI * 2 * i) / 36;
      const wobble = Math.sin(angle * 5 + time) * size * 0.1;
      const r = size * 0.5 + wobble;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Blood flow veins (animated pulse traveling along vein)
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const baseAngle = (Math.PI * 2 * i) / 6;

      // Vein base
      ctx.strokeStyle = config.veinColor || '#990000';
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const midX = Math.cos(baseAngle + 0.2) * size * 0.25;
      const midY = Math.sin(baseAngle + 0.2) * size * 0.25;
      const endX = Math.cos(baseAngle) * size * 0.45;
      const endY = Math.sin(baseAngle) * size * 0.45;
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      // Blood pulse traveling along vein
      const pulsePos = (time * 2 + i * 0.5) % 1;
      const pulseX = midX * pulsePos * 2;
      const pulseY = midY * pulsePos * 2;

      ctx.fillStyle = config.eyeColor || '#ff0000';
      ctx.globalAlpha = 0.8 * (1 - pulsePos);
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Central eye/core with mandible design
    const eyePulse = 0.8 + Math.sin(time * 4) * 0.2;
    const eyeSize = size * 0.15 * eyePulse;

    // Outer ring (mandible/eye socket)
    ctx.strokeStyle = config.veinColor || '#990000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, eyeSize * 1.3, 0, Math.PI * 2);
    ctx.stroke();

    // Eye glow
    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Pupil (vertical slit)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.02, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlight
    ctx.fillStyle = '#ffffff40';
    ctx.beginPath();
    ctx.arc(-size * 0.03, -size * 0.04, size * 0.02, 0, Math.PI * 2);
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
  },

  // ============================================
  // ASSIMILATED BASE DRAWING FUNCTIONS
  // Swarm-corrupted versions of faction bases
  // ============================================

  /**
   * Draw a pulsing crimson swarm eye
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} size - Eye size
   * @param {object} config - Base config with eyeColor
   */
  drawSwarmEye(ctx, x, y, size, config) {
    const time = this.animationTime;
    const pulse = 0.8 + Math.sin(time * 4) * 0.2;
    const eyeSize = size * pulse;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, eyeSize * 2);
    glowGradient.addColorStop(0, config.eyeColor || '#ff0000');
    glowGradient.addColorStop(0.5, (config.accentColor || '#8b0000') + '60');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, eyeSize * 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye socket (dark ring)
    ctx.strokeStyle = config.veinColor || '#990000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, eyeSize * 1.3, 0, Math.PI * 2);
    ctx.stroke();

    // Eye iris
    const irisGradient = ctx.createRadialGradient(x, y, 0, x, y, eyeSize);
    irisGradient.addColorStop(0, config.eyeColor || '#ff0000');
    irisGradient.addColorStop(0.6, config.accentColor || '#8b0000');
    irisGradient.addColorStop(1, '#330000');
    ctx.fillStyle = irisGradient;
    ctx.beginPath();
    ctx.arc(x, y, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Vertical slit pupil
    ctx.fillStyle = '#000000';
    const slitWidth = eyeSize * 0.15;
    const slitHeight = eyeSize * 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y, slitWidth, slitHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlight
    ctx.fillStyle = '#ffffff50';
    ctx.beginPath();
    ctx.arc(x - eyeSize * 0.25, y - eyeSize * 0.3, eyeSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw organic vein growths overlay
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} size - Base size
   * @param {object} config - Base config with veinColor
   * @param {number} veinCount - Number of veins
   */
  drawOrganicGrowths(ctx, size, config, veinCount = 8) {
    const time = this.animationTime;

    // Draw pulsing veins radiating outward
    ctx.lineWidth = 3;
    for (let i = 0; i < veinCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / veinCount;
      const length = size * 0.6 + Math.sin(time + i) * size * 0.1;

      // Vein path with waviness
      ctx.strokeStyle = config.veinColor || '#990000';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);

      const midX = Math.cos(baseAngle + Math.sin(time + i) * 0.1) * length * 0.5;
      const midY = Math.sin(baseAngle + Math.sin(time + i) * 0.1) * length * 0.5;
      const endX = Math.cos(baseAngle) * length;
      const endY = Math.sin(baseAngle) * length;

      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      // Blood pulse traveling along vein
      const pulsePos = (time * 1.5 + i * 0.4) % 1;
      const pulseX = midX * pulsePos * 2;
      const pulseY = midY * pulsePos * 2;

      ctx.fillStyle = config.eyeColor || '#ff0000';
      ctx.globalAlpha = 0.7 * (1 - pulsePos);
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Organic membrane patches
    ctx.fillStyle = config.secondaryColor + '80';
    for (let i = 0; i < 5; i++) {
      const patchAngle = (Math.PI * 2 * i) / 5 + Math.PI / 10;
      const patchDist = size * 0.35;
      const patchSize = size * 0.15 + Math.sin(time * 2 + i) * size * 0.03;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(patchAngle) * patchDist,
        Math.sin(patchAngle) * patchDist,
        patchSize * 0.6,
        patchSize,
        patchAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  },

  /**
   * Assimilated Pirate Outpost
   * - Skull replaced with swarm eye
   * - Turrets overgrown with organic matter
   * - Dark crimson color scheme
   */
  drawAssimilatedPirateOutpost(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Organic outer glow (crimson)
    const gradient = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 1.5);
    gradient.addColorStop(0, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Corrupted main body - irregular octagon with organic bulges
    ctx.fillStyle = config.secondaryColor;
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
      const bulge = Math.sin(time + i * 2) * size * 0.05;
      const r = size * 0.7 + bulge;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Organic veins overlay
    this.drawOrganicGrowths(ctx, size, config, 6);

    // Center core with swarm eye (replaces skull)
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    this.drawSwarmEye(ctx, 0, 0, size * 0.15, config);

    // Corrupted turret arms - now organic tentacles
    ctx.strokeStyle = config.veinColor;
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const wave = Math.sin(time * 2 + i) * 0.1;

      // Tentacle arm
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
      const tipX = Math.cos(angle + wave) * size;
      const tipY = Math.sin(angle + wave) * size;
      const ctrlX = Math.cos(angle + wave * 0.5) * size * 0.75;
      const ctrlY = Math.sin(angle + wave * 0.5) * size * 0.75;
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();

      // Organic turret bulb at end
      ctx.fillStyle = config.accentColor;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10 + Math.sin(time * 3 + i) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pulsing warning lights (now organic bioluminescence)
    const blinkPhase = Math.floor(time * 2) % 4;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;

      ctx.fillStyle = (i === blinkPhase) ? config.eyeColor : config.veinColor;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      if (i === blinkPhase) {
        ctx.fillStyle = config.eyeColor + '40';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  /**
   * Assimilated Scavenger Yard
   * - Crane arm becomes tentacle
   * - Debris becomes organic masses
   * - Central salvage node becomes swarm eye
   */
  drawAssimilatedScavengerYard(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Organic glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.3);
    gradient.addColorStop(0, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Assimilated debris - organic pods instead of metal
    const debrisCount = 10;
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.sin(i * 1.5) * 0.3;
      const dist = size * (0.35 + (i % 3) * 0.2);
      const podSize = 10 + (i % 4) * 8;
      const pulse = Math.sin(time * 2 + i) * 0.15;

      ctx.save();
      ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
      ctx.rotate(angle);

      // Organic pod shape
      const podGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, podSize);
      podGradient.addColorStop(0, config.veinColor);
      podGradient.addColorStop(0.7, config.secondaryColor);
      podGradient.addColorStop(1, config.color);
      ctx.fillStyle = podGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, podSize * (0.7 + pulse), podSize * (1 + pulse), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Tentacle crane arm (replaces mechanical crane)
    const tentacleAngle = Math.sin(time * 0.4) * 0.5;
    const tentacleLength = size * 0.85;
    ctx.save();
    ctx.rotate(tentacleAngle - Math.PI / 4);

    // Base bulb
    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    // Tentacle segments
    ctx.strokeStyle = config.veinColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const segments = 6;
    for (let i = 1; i <= segments; i++) {
      const segLen = (tentacleLength / segments) * i;
      const wave = Math.sin(time * 3 + i * 0.5) * 10 * (i / segments);
      ctx.lineTo(segLen, wave);
    }
    ctx.stroke();

    // Claw/sucker tips
    const tipX = tentacleLength;
    const tipY = Math.sin(time * 3 + segments * 0.5) * 10;
    const suckOpen = 0.4 + Math.sin(time * 2) * 0.1;
    ctx.strokeStyle = config.eyeColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + 18, tipY - 18 * suckOpen);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + 18, tipY + 18 * suckOpen);
    ctx.stroke();

    ctx.restore();

    // Central swarm eye (replaces salvage node)
    const pulseIntensity = 0.5 + Math.sin(time * 2) * 0.3;
    ctx.fillStyle = `rgba(139, 0, 0, ${pulseIntensity * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    this.drawSwarmEye(ctx, 0, 0, size * 0.12, config);
  },

  /**
   * Assimilated Void Rift
   * - Rings turn crimson with organic texture
   * - Energy tendrils become blood vessels
   * - Core becomes swarm eye
   */
  drawAssimilatedVoidRift(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Swirling crimson aura (replacing purple)
    for (let ring = 3; ring >= 0; ring--) {
      const ringSize = size * (1.2 - ring * 0.15);
      const rotation = time * (0.5 + ring * 0.2) * ((ring % 2) ? 1 : -1);

      ctx.save();
      ctx.rotate(rotation);

      // Corrupted organic ring
      const gradient = ctx.createRadialGradient(0, 0, ringSize * 0.5, 0, 0, ringSize);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, config.accentColor + '40');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24;
        const distort = Math.sin(angle * 3 + time * 2 + ring) * ringSize * 0.2;
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

    // Organic blood veins (replacing energy tendrils)
    this.drawOrganicGrowths(ctx, size, config, 7);

    // Dark corrupted core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    coreGradient.addColorStop(0, '#000000');
    coreGradient.addColorStop(0.6, config.secondaryColor);
    coreGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Central swarm eye
    this.drawSwarmEye(ctx, 0, 0, size * 0.18, config);
  },

  /**
   * Assimilated Mining Claim
   * - Platform overgrown with organic matter
   * - Mining laser becomes spore emitter
   * - Asteroid absorbed into organic mass
   */
  drawAssimilatedMiningClaim(ctx, config) {
    const time = this.animationTime;
    const size = config.size;

    // Organic glow
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.2);
    gradient.addColorStop(0, config.glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Assimilated asteroid - organic mass with veins
    ctx.fillStyle = config.secondaryColor;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const pulse = Math.sin(time * 2 + i) * size * 0.05;
      const r = size * 0.45 * (0.8 + Math.sin(i * 2.5) * 0.2) + pulse;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      } else {
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Infected resource nodes (pulsing crimson)
    ctx.fillStyle = config.eyeColor;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + 0.3;
      const dist = size * 0.22;
      const nodeSize = 5 + Math.sin(time * 3 + i) * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, nodeSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Organic veins on asteroid
    this.drawOrganicGrowths(ctx, size * 0.5, config, 5);

    // Corrupted platform - organic growth over metal
    ctx.fillStyle = config.color;
    ctx.strokeStyle = config.veinColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Irregular organic platform shape
    ctx.moveTo(-size * 0.85, size * 0.35);
    ctx.quadraticCurveTo(-size * 0.5, size * 0.3 + Math.sin(time) * 5, 0, size * 0.35);
    ctx.quadraticCurveTo(size * 0.5, size * 0.4 + Math.sin(time + 1) * 5, size * 0.85, size * 0.35);
    ctx.lineTo(size * 0.85, size * 0.55);
    ctx.quadraticCurveTo(size * 0.5, size * 0.6 + Math.sin(time + 2) * 3, 0, size * 0.55);
    ctx.quadraticCurveTo(-size * 0.5, size * 0.5 + Math.sin(time + 3) * 3, -size * 0.85, size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Organic support tendrils (replacing struts)
    ctx.strokeStyle = config.veinColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.35);
    ctx.quadraticCurveTo(-size * 0.4, size * 0.15, -size * 0.25, 0);
    ctx.moveTo(size * 0.5, size * 0.35);
    ctx.quadraticCurveTo(size * 0.4, size * 0.15, size * 0.25, 0);
    ctx.stroke();

    // Spore emitter (replaces mining laser)
    const sporeActive = Math.floor(time * 2) % 3 !== 0;
    if (sporeActive) {
      // Spore stream
      ctx.strokeStyle = config.eyeColor;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5 + Math.sin(time * 8) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.4);
      ctx.lineTo(0, size * 0.1);
      ctx.stroke();

      // Spore particles
      ctx.fillStyle = config.veinColor;
      for (let i = 0; i < 4; i++) {
        const sporeY = size * 0.1 + ((time * 100 + i * 25) % 30);
        const sporeX = Math.sin(time * 5 + i) * 5;
        ctx.globalAlpha = 0.6 - (sporeY - size * 0.1) / 40;
        ctx.beginPath();
        ctx.arc(sporeX, sporeY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Corruption veins on platform
    ctx.strokeStyle = config.veinColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const startX = -size * 0.7 + i * size * 0.4;
      ctx.beginPath();
      ctx.moveTo(startX, size * 0.4);
      ctx.quadraticCurveTo(startX + 10, size * 0.45, startX + 5, size * 0.52);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Central swarm eye on platform
    this.drawSwarmEye(ctx, 0, size * 0.45, size * 0.08, config);
  }
};
