/**
 * Derelict Ship Renderer
 * Renders ancient alien derelict ships in The Graveyard zone
 *
 * Visual Design:
 * - Size: 400-600 units (larger than faction bases)
 * - Style: Multi-deck capital ships, alien architecture
 * - Condition: Destroyed, broken apart, exposed interior decks
 * - Reference: Battlestar Galactica, Dead Space Ishimura aesthetic
 */

const DerelictRenderer = {
  // Track client-side state for derelicts
  derelicts: new Map(),  // id -> derelict data

  // Orbiting debris per derelict: id -> array of debris objects
  orbitingDebris: new Map(),

  // Electrical sparking state per derelict: id -> { nextSpark, sparks }
  sparks: new Map(),

  // Animation time accumulator
  animationTime: 0,

  // Colors for the derelict alien ships
  COLORS: {
    hull: '#2a2a3a',            // Dark metallic gray-blue
    hullHighlight: '#3d3d4d',   // Lighter hull sections
    hullDark: '#1a1a24',        // Shadow/damage areas
    interior: '#1a0a0a',        // Exposed interior (dark red-black)
    interiorGlow: '#330a0a',    // Interior ambient glow
    deck: '#252530',            // Deck plating
    deckLine: '#404050',        // Deck separation lines
    damage: '#0a0a0a',          // Breach/damage holes
    metal: '#4a4a5a',           // Exposed metal/structure
    rust: '#3d2a20',            // Corrosion spots
    alienGlow: '#00ffaa',       // Alien tech residue glow (teal)
    alienGlowDim: '#004433',    // Dim alien glow
    spark: '#ffffff',           // Electrical sparks
    sparkCore: '#88ddff',       // Spark core color
    // Pre-computed RGB values for colors that need alpha blending
    sparkCoreRGB: { r: 136, g: 221, b: 255 },
    alienGlowDimRGB: { r: 0, g: 68, b: 51 },
    interiorGlowRGB: { r: 51, g: 10, b: 10 }
  },

  // Ship type configurations (5 variants)
  SHIP_TYPES: {
    1: { name: 'Carrier', deckCount: 5, wingStyle: 'swept', hasAntenna: true },
    2: { name: 'Dreadnought', deckCount: 4, wingStyle: 'angular', hasAntenna: false },
    3: { name: 'Cruiser', deckCount: 3, wingStyle: 'curved', hasAntenna: true },
    4: { name: 'Battleship', deckCount: 6, wingStyle: 'blocky', hasAntenna: false },
    5: { name: 'Frigate', deckCount: 2, wingStyle: 'streamlined', hasAntenna: true }
  },

  init() {
    this.derelicts.clear();
    this.orbitingDebris.clear();
    this.sparks.clear();
    this.animationTime = 0;
    Logger.log('DerelictRenderer initialized');
  },

  /**
   * Update derelict list from server data
   * @param {Array} derelictList - Array of derelict objects from server
   */
  updateDerelicts(derelictList) {
    // Update existing and add new derelicts
    const activeIds = new Set();

    for (const d of derelictList) {
      activeIds.add(d.id);

      // Store or update derelict data
      const existing = this.derelicts.get(d.id);
      if (existing) {
        // Update cooldown status
        existing.onCooldown = d.onCooldown;
        existing.cooldownRemaining = d.cooldownRemaining;
        existing.distance = d.distance;
      } else {
        // New derelict - initialize
        this.derelicts.set(d.id, { ...d });
        this.initOrbitingDebris(d);
        this.sparks.set(d.id, { nextSpark: 0, sparks: [] });
      }
    }

    // Remove derelicts that are no longer nearby
    for (const [id] of this.derelicts) {
      if (!activeIds.has(id)) {
        this.derelicts.delete(id);
        this.orbitingDebris.delete(id);
        this.sparks.delete(id);
      }
    }
  },

  /**
   * Initialize orbiting debris for a derelict
   * @param {Object} derelict - Derelict data
   */
  initOrbitingDebris(derelict) {
    const debris = [];
    const count = derelict.orbitingDebrisCount || 15;

    for (let i = 0; i < count; i++) {
      // Deterministic initial positions based on derelict ID
      const seed = this.hashString(derelict.id + '_debris_' + i);
      const angle = (seed % 1000) / 1000 * Math.PI * 2;
      const orbitRadius = derelict.size * 0.6 + (seed % 500) / 500 * derelict.size * 0.4;
      const orbitSpeed = 0.1 + (seed % 100) / 100 * 0.15;
      const rotationSpeed = 0.5 + (seed % 100) / 100;
      const size = 8 + (seed % 100) / 100 * 15;

      debris.push({
        angle,
        orbitRadius,
        orbitSpeed: orbitSpeed * (i % 2 === 0 ? 1 : -1), // Alternate directions
        rotation: (seed % 360) * Math.PI / 180,
        rotationSpeed,
        size,
        shape: seed % 4 // 0-3 different shapes
      });
    }

    this.orbitingDebris.set(derelict.id, debris);
  },

  /**
   * Simple string hash for deterministic values
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  },

  /**
   * Update animation state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.animationTime += dt;

    // Update orbiting debris positions
    for (const [id, debris] of this.orbitingDebris) {
      for (const d of debris) {
        d.angle += d.orbitSpeed * dt;
        d.rotation += d.rotationSpeed * dt;
      }
    }

    // Update electrical sparks
    for (const [id, sparkState] of this.sparks) {
      const derelict = this.derelicts.get(id);
      if (!derelict) continue;

      // Spawn new sparks occasionally
      if (this.animationTime > sparkState.nextSpark) {
        sparkState.nextSpark = this.animationTime + 0.5 + Math.random() * 2;

        // Create new spark at random position on derelict
        const sparkAngle = Math.random() * Math.PI * 2;
        const sparkDist = derelict.size * 0.3 * Math.random();

        sparkState.sparks.push({
          x: Math.cos(sparkAngle) * sparkDist,
          y: Math.sin(sparkAngle) * sparkDist,
          life: 0.3 + Math.random() * 0.3,
          maxLife: 0.3 + Math.random() * 0.3
        });
      }

      // Update existing sparks
      sparkState.sparks = sparkState.sparks.filter(spark => {
        spark.life -= dt;
        return spark.life > 0;
      });
    }
  },

  /**
   * Draw all visible derelicts
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera - Camera position { x, y }
   * @param {Object} playerPosition - Player world position for proximity checks
   */
  draw(ctx, camera, playerPosition) {
    for (const [id, derelict] of this.derelicts) {
      // Convert to screen coordinates
      const screenX = derelict.x - camera.x;
      const screenY = derelict.y - camera.y;

      // Skip if off screen (with margin for large size)
      const margin = derelict.size * 1.5;
      if (screenX < -margin || screenX > ctx.canvas.width / window.devicePixelRatio + margin ||
          screenY < -margin || screenY > ctx.canvas.height / window.devicePixelRatio + margin) {
        continue;
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(derelict.rotation || 0);

      // Draw the derelict ship
      this.drawDerelictShip(ctx, derelict);

      ctx.restore();

      // Draw orbiting debris (in world space, not rotated with ship)
      this.drawOrbitingDebris(ctx, derelict, screenX, screenY);

      // Draw electrical sparks
      this.drawSparks(ctx, derelict, screenX, screenY);

      // Note: Cooldown visuals removed - derelicts should look the same regardless
      // of cooldown state. Players can always attempt salvage and will silently fail
      // if on cooldown.

      // Note: Interaction prompts are drawn separately via drawPrompts() to ensure
      // they appear on top of all entities (ships, NPCs, etc.)
    }
  },

  /**
   * Draw interaction prompts on top of all entities
   * Called separately after entities are drawn to ensure proper z-order
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera - Camera position { x, y }
   * @param {Object} playerPosition - Player world position
   */
  drawPrompts(ctx, camera, playerPosition) {
    if (!playerPosition) return;

    const interactionRange = CONSTANTS.DERELICT_CONFIG?.INTERACTION_RANGE || 100;

    for (const [id, derelict] of this.derelicts) {
      const screenX = derelict.x - camera.x + ctx.canvas.width / 2;
      const screenY = derelict.y - camera.y + ctx.canvas.height / 2;

      // Check if player is close enough for interaction
      const dx = derelict.x - playerPosition.x;
      const dy = derelict.y - playerPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const effectiveDistance = distance - (derelict.size / 2);

      if (effectiveDistance <= interactionRange && !derelict.onCooldown) {
        this.drawInteractionPrompt(ctx, derelict, screenX, screenY);
      }
    }
  },

  /**
   * Draw a single derelict ship
   * @param {CanvasRenderingContext2D} ctx - Already translated to ship center
   * @param {Object} derelict - Derelict data
   */
  drawDerelictShip(ctx, derelict) {
    const size = derelict.size;
    const shipType = this.SHIP_TYPES[derelict.shipType] || this.SHIP_TYPES[1];
    const time = this.animationTime;

    // Outer glow (alien residue) - reduced 10% for performance
    const glowSize = size * 0.99;
    const glowGradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, glowSize);
    glowGradient.addColorStop(0, 'transparent');
    const glowRgb = this.COLORS.alienGlowDimRGB;
    glowGradient.addColorStop(0.6, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, 0.13)`);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Main hull shape - elongated with asymmetric damage
    ctx.save();

    // Hull base (long capital ship shape)
    const hullLength = size;
    const hullWidth = size * 0.35;

    // Create hull path with damage/breaks
    ctx.beginPath();

    // Forward section (tapered bow)
    ctx.moveTo(hullLength * 0.5, 0);
    ctx.lineTo(hullLength * 0.35, -hullWidth * 0.3);
    ctx.lineTo(hullLength * 0.2, -hullWidth * 0.4);

    // Port side (top) with damage
    ctx.lineTo(-hullLength * 0.1, -hullWidth * 0.45);
    ctx.lineTo(-hullLength * 0.2, -hullWidth * 0.35);  // Damage indent
    ctx.lineTo(-hullLength * 0.25, -hullWidth * 0.45);
    ctx.lineTo(-hullLength * 0.4, -hullWidth * 0.4);

    // Aft section (engine block)
    ctx.lineTo(-hullLength * 0.5, -hullWidth * 0.3);
    ctx.lineTo(-hullLength * 0.55, -hullWidth * 0.15);
    ctx.lineTo(-hullLength * 0.55, hullWidth * 0.15);
    ctx.lineTo(-hullLength * 0.5, hullWidth * 0.3);

    // Starboard side (bottom) with major breach
    ctx.lineTo(-hullLength * 0.35, hullWidth * 0.4);
    ctx.lineTo(-hullLength * 0.15, hullWidth * 0.5);
    ctx.lineTo(0, hullWidth * 0.3);           // Major breach
    ctx.lineTo(hullLength * 0.1, hullWidth * 0.5);
    ctx.lineTo(hullLength * 0.3, hullWidth * 0.35);
    ctx.lineTo(hullLength * 0.4, hullWidth * 0.2);

    ctx.closePath();

    // Hull fill with gradient
    const hullGradient = ctx.createLinearGradient(-hullLength * 0.5, -hullWidth, hullLength * 0.5, hullWidth);
    hullGradient.addColorStop(0, this.COLORS.hullDark);
    hullGradient.addColorStop(0.3, this.COLORS.hull);
    hullGradient.addColorStop(0.6, this.COLORS.hullHighlight);
    hullGradient.addColorStop(1, this.COLORS.hullDark);
    ctx.fillStyle = hullGradient;
    ctx.fill();

    // Hull outline
    ctx.strokeStyle = this.COLORS.metal;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw deck lines
    this.drawDeckLines(ctx, shipType.deckCount, hullLength, hullWidth);

    // Draw damage/breach areas with exposed interior
    this.drawBreaches(ctx, derelict, hullLength, hullWidth);

    // Draw wing structures based on ship type
    this.drawWings(ctx, shipType.wingStyle, hullLength, hullWidth);

    // Draw antenna/sensor array if present
    if (shipType.hasAntenna) {
      this.drawAntenna(ctx, hullLength, hullWidth);
    }

    // Draw bridge/command section
    this.drawBridge(ctx, hullLength, hullWidth);

    // Draw engine section (damaged/dark)
    this.drawEngines(ctx, hullLength, hullWidth);

    // Add subtle alien glow pulses at damage points
    this.drawAlienGlowSpots(ctx, derelict, hullLength, hullWidth, time);

    ctx.restore();
  },

  /**
   * Draw horizontal deck lines
   */
  drawDeckLines(ctx, deckCount, hullLength, hullWidth) {
    ctx.strokeStyle = this.COLORS.deckLine;
    ctx.lineWidth = 1;

    for (let i = 1; i < deckCount; i++) {
      const y = -hullWidth * 0.4 + (hullWidth * 0.8 / deckCount) * i;
      ctx.beginPath();
      ctx.moveTo(-hullLength * 0.45, y);
      ctx.lineTo(hullLength * 0.4, y);
      ctx.stroke();
    }
  },

  /**
   * Draw breach/damage areas showing interior
   */
  drawBreaches(ctx, derelict, hullLength, hullWidth) {
    // Seed-based breach positions
    const seed = this.hashString(derelict.id);

    // Major breach 1 (starboard mid-section)
    ctx.fillStyle = this.COLORS.interior;
    ctx.beginPath();
    ctx.ellipse(
      -hullLength * 0.05,
      hullWidth * 0.25,
      hullLength * 0.1,
      hullWidth * 0.15,
      0.3,
      0, Math.PI * 2
    );
    ctx.fill();

    // Interior glow
    const interiorGlow = ctx.createRadialGradient(
      -hullLength * 0.05, hullWidth * 0.25, 0,
      -hullLength * 0.05, hullWidth * 0.25, hullLength * 0.1
    );
    const intRgb = this.COLORS.interiorGlowRGB;
    interiorGlow.addColorStop(0, `rgba(${intRgb.r}, ${intRgb.g}, ${intRgb.b}, 0.38)`);
    interiorGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = interiorGlow;
    ctx.fill();

    // Minor breach 2 (port aft)
    ctx.fillStyle = this.COLORS.damage;
    ctx.beginPath();
    ctx.ellipse(
      -hullLength * 0.22,
      -hullWidth * 0.3,
      hullLength * 0.06,
      hullWidth * 0.08,
      -0.5,
      0, Math.PI * 2
    );
    ctx.fill();

    // Minor breach 3 (forward)
    ctx.beginPath();
    ctx.ellipse(
      hullLength * 0.25,
      hullWidth * 0.1,
      hullLength * 0.04,
      hullWidth * 0.06,
      0.2,
      0, Math.PI * 2
    );
    ctx.fill();
  },

  /**
   * Draw wing structures
   */
  drawWings(ctx, wingStyle, hullLength, hullWidth) {
    ctx.fillStyle = this.COLORS.hull;
    ctx.strokeStyle = this.COLORS.metal;
    ctx.lineWidth = 1.5;

    switch (wingStyle) {
      case 'swept':
        // Swept-back wings
        ctx.beginPath();
        ctx.moveTo(-hullLength * 0.1, -hullWidth * 0.45);
        ctx.lineTo(-hullLength * 0.35, -hullWidth * 0.8);
        ctx.lineTo(-hullLength * 0.45, -hullWidth * 0.7);
        ctx.lineTo(-hullLength * 0.3, -hullWidth * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Mirror on other side
        ctx.beginPath();
        ctx.moveTo(-hullLength * 0.1, hullWidth * 0.45);
        ctx.lineTo(-hullLength * 0.35, hullWidth * 0.8);
        ctx.lineTo(-hullLength * 0.45, hullWidth * 0.7);
        ctx.lineTo(-hullLength * 0.3, hullWidth * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'angular':
        // Angular/aggressive wings
        ctx.beginPath();
        ctx.moveTo(hullLength * 0.1, -hullWidth * 0.4);
        ctx.lineTo(0, -hullWidth * 0.9);
        ctx.lineTo(-hullLength * 0.2, -hullWidth * 0.75);
        ctx.lineTo(-hullLength * 0.15, -hullWidth * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hullLength * 0.1, hullWidth * 0.4);
        ctx.lineTo(0, hullWidth * 0.9);
        ctx.lineTo(-hullLength * 0.2, hullWidth * 0.75);
        ctx.lineTo(-hullLength * 0.15, hullWidth * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'curved':
        // Organic curved wings
        ctx.beginPath();
        ctx.moveTo(0, -hullWidth * 0.45);
        ctx.quadraticCurveTo(
          -hullLength * 0.15, -hullWidth * 0.8,
          -hullLength * 0.35, -hullWidth * 0.6
        );
        ctx.lineTo(-hullLength * 0.3, -hullWidth * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, hullWidth * 0.45);
        ctx.quadraticCurveTo(
          -hullLength * 0.15, hullWidth * 0.8,
          -hullLength * 0.35, hullWidth * 0.6
        );
        ctx.lineTo(-hullLength * 0.3, hullWidth * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'blocky':
        // Industrial blocky wings
        ctx.fillRect(-hullLength * 0.3, -hullWidth * 0.85, hullLength * 0.25, hullWidth * 0.35);
        ctx.strokeRect(-hullLength * 0.3, -hullWidth * 0.85, hullLength * 0.25, hullWidth * 0.35);
        ctx.fillRect(-hullLength * 0.3, hullWidth * 0.5, hullLength * 0.25, hullWidth * 0.35);
        ctx.strokeRect(-hullLength * 0.3, hullWidth * 0.5, hullLength * 0.25, hullWidth * 0.35);
        break;

      case 'streamlined':
      default:
        // Subtle streamlined fins
        ctx.beginPath();
        ctx.moveTo(hullLength * 0.2, -hullWidth * 0.35);
        ctx.lineTo(hullLength * 0.1, -hullWidth * 0.55);
        ctx.lineTo(-hullLength * 0.1, -hullWidth * 0.45);
        ctx.lineTo(-hullLength * 0.05, -hullWidth * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hullLength * 0.2, hullWidth * 0.35);
        ctx.lineTo(hullLength * 0.1, hullWidth * 0.55);
        ctx.lineTo(-hullLength * 0.1, hullWidth * 0.45);
        ctx.lineTo(-hullLength * 0.05, hullWidth * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
  },

  /**
   * Draw antenna/sensor arrays
   */
  drawAntenna(ctx, hullLength, hullWidth) {
    ctx.strokeStyle = this.COLORS.metal;
    ctx.lineWidth = 2;

    // Main antenna mast
    ctx.beginPath();
    ctx.moveTo(hullLength * 0.35, -hullWidth * 0.1);
    ctx.lineTo(hullLength * 0.6, -hullWidth * 0.15);
    ctx.stroke();

    // Broken antenna section (dangling)
    ctx.strokeStyle = this.COLORS.hullDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hullLength * 0.6, -hullWidth * 0.15);
    ctx.lineTo(hullLength * 0.55, -hullWidth * 0.05);
    ctx.lineTo(hullLength * 0.58, hullWidth * 0.1);
    ctx.stroke();

    // Sensor dish (damaged)
    ctx.fillStyle = this.COLORS.hull;
    ctx.beginPath();
    ctx.arc(hullLength * 0.35, hullWidth * 0.2, hullLength * 0.05, 0, Math.PI * 1.3);
    ctx.lineTo(hullLength * 0.35, hullWidth * 0.2);
    ctx.fill();
  },

  /**
   * Draw bridge/command section
   */
  drawBridge(ctx, hullLength, hullWidth) {
    // Bridge superstructure
    ctx.fillStyle = this.COLORS.hullHighlight;
    ctx.beginPath();
    ctx.moveTo(hullLength * 0.25, -hullWidth * 0.15);
    ctx.lineTo(hullLength * 0.35, -hullWidth * 0.1);
    ctx.lineTo(hullLength * 0.35, hullWidth * 0.05);
    ctx.lineTo(hullLength * 0.25, hullWidth * 0.1);
    ctx.lineTo(hullLength * 0.15, hullWidth * 0.05);
    ctx.lineTo(hullLength * 0.15, -hullWidth * 0.1);
    ctx.closePath();
    ctx.fill();

    // Bridge windows (dark, destroyed)
    ctx.fillStyle = this.COLORS.damage;
    ctx.fillRect(hullLength * 0.28, -hullWidth * 0.08, hullLength * 0.04, hullWidth * 0.03);
    ctx.fillRect(hullLength * 0.28, 0, hullLength * 0.04, hullWidth * 0.03);
  },

  /**
   * Draw engine section
   */
  drawEngines(ctx, hullLength, hullWidth) {
    // Engine housing
    ctx.fillStyle = this.COLORS.hullDark;

    // Top engine
    ctx.beginPath();
    ctx.ellipse(-hullLength * 0.52, -hullWidth * 0.2, hullLength * 0.06, hullWidth * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottom engine
    ctx.beginPath();
    ctx.ellipse(-hullLength * 0.52, hullWidth * 0.2, hullLength * 0.06, hullWidth * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine interiors (dead)
    ctx.fillStyle = this.COLORS.damage;
    ctx.beginPath();
    ctx.arc(-hullLength * 0.54, -hullWidth * 0.2, hullLength * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-hullLength * 0.54, hullWidth * 0.2, hullLength * 0.035, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw pulsing alien glow spots at damage areas
   */
  drawAlienGlowSpots(ctx, derelict, hullLength, hullWidth, time) {
    const pulseIntensity = 0.3 + Math.sin(time * 2 + this.hashString(derelict.id) * 0.1) * 0.2;

    // Glow spot at major breach
    const glowGradient1 = ctx.createRadialGradient(
      -hullLength * 0.05, hullWidth * 0.25, 0,
      -hullLength * 0.05, hullWidth * 0.25, hullLength * 0.08
    );
    glowGradient1.addColorStop(0, this.COLORS.alienGlow + Math.floor(pulseIntensity * 255).toString(16).padStart(2, '0'));
    glowGradient1.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient1;
    ctx.beginPath();
    ctx.arc(-hullLength * 0.05, hullWidth * 0.25, hullLength * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Secondary glow at bridge
    const pulse2 = 0.2 + Math.sin(time * 1.5 + 2) * 0.15;
    const glowGradient2 = ctx.createRadialGradient(
      hullLength * 0.28, -hullWidth * 0.02, 0,
      hullLength * 0.28, -hullWidth * 0.02, hullLength * 0.04
    );
    glowGradient2.addColorStop(0, this.COLORS.alienGlow + Math.floor(pulse2 * 255).toString(16).padStart(2, '0'));
    glowGradient2.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient2;
    ctx.beginPath();
    ctx.arc(hullLength * 0.28, -hullWidth * 0.02, hullLength * 0.04, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw orbiting debris around derelict
   */
  drawOrbitingDebris(ctx, derelict, screenX, screenY) {
    const debris = this.orbitingDebris.get(derelict.id);
    if (!debris) return;

    ctx.save();

    for (const d of debris) {
      const x = screenX + Math.cos(d.angle) * d.orbitRadius;
      const y = screenY + Math.sin(d.angle) * d.orbitRadius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d.rotation);

      ctx.fillStyle = this.COLORS.hull;
      ctx.strokeStyle = this.COLORS.metal;
      ctx.lineWidth = 0.5;

      // Different debris shapes
      switch (d.shape) {
        case 0: // Rectangular plate
          ctx.fillRect(-d.size * 0.5, -d.size * 0.3, d.size, d.size * 0.6);
          ctx.strokeRect(-d.size * 0.5, -d.size * 0.3, d.size, d.size * 0.6);
          break;
        case 1: // Triangular shard
          ctx.beginPath();
          ctx.moveTo(0, -d.size * 0.5);
          ctx.lineTo(d.size * 0.4, d.size * 0.4);
          ctx.lineTo(-d.size * 0.4, d.size * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 2: // Irregular chunk
          ctx.beginPath();
          ctx.moveTo(-d.size * 0.3, -d.size * 0.4);
          ctx.lineTo(d.size * 0.4, -d.size * 0.2);
          ctx.lineTo(d.size * 0.3, d.size * 0.4);
          ctx.lineTo(-d.size * 0.2, d.size * 0.3);
          ctx.lineTo(-d.size * 0.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 3: // Pipe/rod section
        default:
          ctx.fillRect(-d.size * 0.6, -d.size * 0.15, d.size * 1.2, d.size * 0.3);
          ctx.strokeRect(-d.size * 0.6, -d.size * 0.15, d.size * 1.2, d.size * 0.3);
          break;
      }

      ctx.restore();
    }

    ctx.restore();
  },

  /**
   * Draw electrical sparks
   */
  drawSparks(ctx, derelict, screenX, screenY) {
    const sparkState = this.sparks.get(derelict.id);
    if (!sparkState || sparkState.sparks.length === 0) return;

    ctx.save();

    for (const spark of sparkState.sparks) {
      const x = screenX + spark.x;
      const y = screenY + spark.y;
      const rawAlpha = spark.life / spark.maxLife;
      // Guard against NaN/Infinity from invalid spark data
      const alpha = (isFinite(rawAlpha) && rawAlpha > 0) ? rawAlpha : 0;
      if (alpha <= 0) continue; // Skip invalid sparks
      const size = 15 * alpha;

      // Spark glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, this.COLORS.spark);
      const rgb = this.COLORS.sparkCoreRGB;
      gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha * 0.8).toFixed(2)})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Spark lines (electrical arcs)
      ctx.strokeStyle = this.COLORS.spark;
      ctx.lineWidth = 1;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 3; i++) {
        const arcAngle = (this.animationTime * 10 + i * 2) % (Math.PI * 2);
        const arcLen = size * (0.5 + Math.random() * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(arcAngle) * arcLen,
          y + Math.sin(arcAngle) * arcLen
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },

  /**
   * Draw cooldown indicator (grayed appearance with timer)
   */
  drawCooldownIndicator(ctx, derelict, screenX, screenY) {
    // Dim overlay
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(screenX, screenY, derelict.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cooldown timer text
    const remainingSec = Math.ceil((derelict.cooldownRemaining || 0) / 1000);
    if (remainingSec > 0) {
      ctx.save();
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#888888';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      const text = `${remainingSec}s`;
      ctx.strokeText(text, screenX, screenY);
      ctx.fillText(text, screenX, screenY);
      ctx.restore();
    }
  },

  /**
   * Draw interaction prompt when player is in range
   */
  drawInteractionPrompt(ctx, derelict, screenX, screenY) {
    const promptY = screenY - derelict.size * 0.5 - 40;

    ctx.save();
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background
    const text = 'Press [M] to Salvage';
    const metrics = ctx.measureText(text);
    const padding = 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      screenX - metrics.width / 2 - padding,
      promptY - 10 - padding / 2,
      metrics.width + padding * 2,
      20 + padding
    );

    // Border
    ctx.strokeStyle = this.COLORS.alienGlow;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      screenX - metrics.width / 2 - padding,
      promptY - 10 - padding / 2,
      metrics.width + padding * 2,
      20 + padding
    );

    // Text with pulsing glow
    const pulse = 0.7 + Math.sin(this.animationTime * 3) * 0.3;
    ctx.fillStyle = this.COLORS.alienGlow;
    ctx.globalAlpha = pulse;
    ctx.fillText(text, screenX, promptY);
    ctx.globalAlpha = 1;

    ctx.restore();
  },

  /**
   * Trigger salvage visual effect at a derelict
   * Called when derelict:salvageEffect event is received
   * @param {string} derelictId - Derelict ID
   * @param {number} derelictX - World X position
   * @param {number} derelictY - World Y position
   */
  triggerSalvageEffect(derelictId, derelictX, derelictY) {
    if (typeof ParticleSystem === 'undefined') return;

    const derelict = this.derelicts.get(derelictId);
    const size = derelict?.size || 500;

    // Particle multiplier for performance
    const multiplier = ParticleSystem.getParticleMultiplier();

    // Dust cloud burst
    const dustCount = Math.max(5, Math.floor(20 * multiplier));
    for (let i = 0; i < dustCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      ParticleSystem.spawn({
        x: derelictX + (Math.random() - 0.5) * size * 0.3,
        y: derelictY + (Math.random() - 0.5) * size * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1000 + Math.random() * 500,
        color: '#555555',
        size: 4 + Math.random() * 4,
        type: 'smoke',
        drag: 0.97,
        decay: 0.8,
        gravity: -2
      });
    }

    // Metal debris chunks
    const debrisCount = Math.max(3, Math.floor(10 * multiplier));
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 80;
      ParticleSystem.spawn({
        x: derelictX + (Math.random() - 0.5) * size * 0.2,
        y: derelictY + (Math.random() - 0.5) * size * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 800 + Math.random() * 400,
        color: '#4a4a5a',
        secondaryColor: '#3a3a4a',
        size: 5 + Math.random() * 5,
        type: 'debris',
        drag: 0.96,
        decay: 1,
        rotationSpeed: 2 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2
      });
    }

    // Alien energy release
    const energyCount = Math.max(2, Math.floor(8 * multiplier));
    for (let i = 0; i < energyCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      ParticleSystem.spawn({
        x: derelictX,
        y: derelictY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600 + Math.random() * 300,
        color: this.COLORS.alienGlow,
        size: 3 + Math.random() * 4,
        type: 'energy',
        drag: 0.95,
        decay: 0.9,
        pulse: true,
        pulseSpeed: 5
      });
    }

    // Central flash
    ParticleSystem.spawn({
      x: derelictX,
      y: derelictY,
      vx: 0,
      vy: 0,
      life: 300,
      color: '#ffffff',
      size: 30,
      type: 'glow',
      decay: 0.5
    });

    // Play audio if available
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('salvage', { x: derelictX, y: derelictY });
    }
  },

  /**
   * Get nearest derelict within interaction range
   * @param {Object} playerPosition - { x, y }
   * @returns {Object|null} Nearest salvageable derelict or null
   */
  getNearestSalvageable(playerPosition) {
    let nearest = null;
    let nearestDistance = Infinity;
    const interactionRange = CONSTANTS.DERELICT_CONFIG?.INTERACTION_RANGE || 100;

    for (const [id, derelict] of this.derelicts) {
      if (derelict.onCooldown) continue;

      const dx = derelict.x - playerPosition.x;
      const dy = derelict.y - playerPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const effectiveDistance = distance - (derelict.size / 2);

      if (effectiveDistance <= interactionRange && effectiveDistance < nearestDistance) {
        nearest = derelict;
        nearestDistance = effectiveDistance;
      }
    }

    return nearest;
  }
};

// Make globally available
if (typeof window !== 'undefined') {
  window.DerelictRenderer = DerelictRenderer;
}
