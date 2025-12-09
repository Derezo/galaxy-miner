/**
 * NPC Ship Geometry Definitions
 * Distinct ship silhouettes for each of the 5 factions
 * Pirates: Angular, aggressive, bright red
 * Scavengers: Asymmetric, patched together, dusty tan
 * Swarm: Stealthy predators - black hulls with crimson accents, blade-like shapes, glowing red eyes
 * Void: Sleek, ethereal, purple energy
 * Rogue Miners: Industrial, bulky, orange/yellow
 */

const NPCShipGeometry = {
  SIZE: 20,

  // Faction color schemes
  FACTION_COLORS: {
    pirate: {
      hull: '#ff3300',
      accent: '#cc2200',
      glow: '#ff330060',
      outline: '#ff6600'
    },
    scavenger: {
      hull: '#999966',
      accent: '#666644',
      glow: '#99996640',
      outline: '#cccc88'
    },
    swarm: {
      // Stealthy predator theme - black hull with crimson accents
      hull: '#1a1a1a',
      accent: '#8b0000',
      glow: '#8b000040',
      outline: '#660000',
      veinColor: '#990000',
      eyeColor: '#ff0000'
    },
    void: {
      hull: '#9900ff',
      accent: '#660099',
      glow: '#9900ff80',
      outline: '#cc66ff'
    },
    rogue_miner: {
      hull: '#ff9900',
      accent: '#cc7700',
      glow: '#ff990050',
      outline: '#ffcc00'
    }
  },

  // Ship type to visual variant mapping (1-4 per faction)
  SHIP_VARIANTS: {
    // Pirates - Angular, aggressive shapes
    pirate_scout: 'pirate_1',
    pirate_fighter: 'pirate_2',
    pirate_captain: 'pirate_3',
    pirate_dreadnought: 'pirate_4',

    // Scavengers - Asymmetric, patched together
    scavenger_scrapper: 'scavenger_1',
    scavenger_salvager: 'scavenger_2',
    scavenger_collector: 'scavenger_3',
    scavenger_hauler: 'scavenger_4',

    // Swarm - Organic, insectoid
    swarm_drone: 'swarm_1',
    swarm_worker: 'swarm_2',
    swarm_warrior: 'swarm_3',
    swarm_queen: 'swarm_4',

    // Void - Sleek, ethereal
    void_whisper: 'void_1',
    void_shadow: 'void_2',
    void_phantom: 'void_3',
    void_leviathan: 'void_4',

    // Rogue Miners - Industrial, bulky
    rogue_prospector: 'rogue_1',
    rogue_driller: 'rogue_2',
    rogue_excavator: 'rogue_3',
    rogue_foreman: 'rogue_4'
  },

  // Cached Path2D objects
  cachedPaths: {},
  cachedAccents: {},

  // Size multiplier per variant (1-4)
  // Variant 4 is bosses (queens, dreadnoughts, etc) - larger for visual impact
  SIZE_SCALE: {
    1: 0.9,
    2: 1.0,
    3: 1.15,
    4: 1.8  // Increased from 1.4 for larger boss ships
  },

  init() {
    const SIZE = this.SIZE;

    // Generate all faction ship paths
    this.generatePiratePaths(SIZE);
    this.generateScavengerPaths(SIZE);
    this.generateSwarmPaths(SIZE);
    this.generateVoidPaths(SIZE);
    this.generateRogueMinerPaths(SIZE);

    Logger.log('NPCShipGeometry initialized with faction ships');
  },

  generatePiratePaths(SIZE) {
    // Pirates: Angular, aggressive, sharp edges
    // Variant 1: Scout - Small, fast, dart shape
    this.cachedPaths['pirate_1'] = new Path2D(
      `M ${SIZE * 0.9} 0 L ${-SIZE * 0.5} ${-SIZE * 0.4} L ${-SIZE * 0.3} 0 L ${-SIZE * 0.5} ${SIZE * 0.4} Z`
    );

    // Variant 2: Fighter - Wider, winged
    this.cachedPaths['pirate_2'] = new Path2D(
      `M ${SIZE} 0 L ${SIZE * 0.3} ${-SIZE * 0.2} L ${-SIZE * 0.2} ${-SIZE * 0.7}
       L ${-SIZE * 0.5} ${-SIZE * 0.5} L ${-SIZE * 0.4} 0
       L ${-SIZE * 0.5} ${SIZE * 0.5} L ${-SIZE * 0.2} ${SIZE * 0.7}
       L ${SIZE * 0.3} ${SIZE * 0.2} Z`
    );

    // Variant 3: Captain - Heavy, armored
    this.cachedPaths['pirate_3'] = new Path2D(
      `M ${SIZE * 1.1} 0 L ${SIZE * 0.5} ${-SIZE * 0.25}
       L ${SIZE * 0.2} ${-SIZE * 0.4} L ${-SIZE * 0.3} ${-SIZE * 0.8}
       L ${-SIZE * 0.6} ${-SIZE * 0.5} L ${-SIZE * 0.7} 0
       L ${-SIZE * 0.6} ${SIZE * 0.5} L ${-SIZE * 0.3} ${SIZE * 0.8}
       L ${SIZE * 0.2} ${SIZE * 0.4} L ${SIZE * 0.5} ${SIZE * 0.25} Z`
    );
    this.cachedAccents['pirate_3'] = new Path2D(
      `M ${SIZE * 0.4} 0 L ${SIZE * 0.1} ${-SIZE * 0.15} L ${SIZE * 0.1} ${SIZE * 0.15} Z`
    );

    // Variant 4: Dreadnought - Massive, intimidating
    this.cachedPaths['pirate_4'] = new Path2D(
      `M ${SIZE * 1.3} 0 L ${SIZE * 0.7} ${-SIZE * 0.2}
       L ${SIZE * 0.4} ${-SIZE * 0.5} L ${0} ${-SIZE * 0.9}
       L ${-SIZE * 0.4} ${-SIZE * 0.7} L ${-SIZE * 0.8} ${-SIZE * 0.3}
       L ${-SIZE * 0.9} 0 L ${-SIZE * 0.8} ${SIZE * 0.3}
       L ${-SIZE * 0.4} ${SIZE * 0.7} L ${0} ${SIZE * 0.9}
       L ${SIZE * 0.4} ${SIZE * 0.5} L ${SIZE * 0.7} ${SIZE * 0.2} Z`
    );
    this.cachedAccents['pirate_4'] = new Path2D(
      `M ${SIZE * 0.5} 0 L ${SIZE * 0.2} ${-SIZE * 0.12} L ${0} 0 L ${SIZE * 0.2} ${SIZE * 0.12} Z`
    );
  },

  generateScavengerPaths(SIZE) {
    // Scavengers: Asymmetric, cobbled together, irregular
    // Variant 1: Scrapper - Small, lopsided
    this.cachedPaths['scavenger_1'] = new Path2D(
      `M ${SIZE * 0.7} ${-SIZE * 0.1} L ${SIZE * 0.3} ${-SIZE * 0.5}
       L ${-SIZE * 0.4} ${-SIZE * 0.3} L ${-SIZE * 0.5} ${SIZE * 0.1}
       L ${-SIZE * 0.2} ${SIZE * 0.5} L ${SIZE * 0.4} ${SIZE * 0.3} Z`
    );

    // Variant 2: Salvager - Boxy with protrusions
    this.cachedPaths['scavenger_2'] = new Path2D(
      `M ${SIZE * 0.8} ${-SIZE * 0.15} L ${SIZE * 0.6} ${-SIZE * 0.5}
       L ${SIZE * 0.1} ${-SIZE * 0.6} L ${-SIZE * 0.3} ${-SIZE * 0.4}
       L ${-SIZE * 0.6} ${-SIZE * 0.2} L ${-SIZE * 0.5} ${SIZE * 0.3}
       L ${-SIZE * 0.1} ${SIZE * 0.5} L ${SIZE * 0.5} ${SIZE * 0.4}
       L ${SIZE * 0.7} ${SIZE * 0.15} Z`
    );

    // Variant 3: Collector - Wide, cargo-focused
    this.cachedPaths['scavenger_3'] = new Path2D(
      `M ${SIZE * 0.9} 0 L ${SIZE * 0.5} ${-SIZE * 0.6}
       L ${-SIZE * 0.2} ${-SIZE * 0.7} L ${-SIZE * 0.6} ${-SIZE * 0.4}
       L ${-SIZE * 0.7} 0 L ${-SIZE * 0.6} ${SIZE * 0.4}
       L ${-SIZE * 0.2} ${SIZE * 0.7} L ${SIZE * 0.5} ${SIZE * 0.6} Z`
    );
    this.cachedAccents['scavenger_3'] = new Path2D(
      `M ${SIZE * 0.3} 0 L ${0} ${-SIZE * 0.25} L ${-SIZE * 0.2} 0 L ${0} ${SIZE * 0.25} Z`
    );

    // Variant 4: Hauler - Massive, industrial
    this.cachedPaths['scavenger_4'] = new Path2D(
      `M ${SIZE * 1.0} ${-SIZE * 0.1} L ${SIZE * 0.7} ${-SIZE * 0.5}
       L ${SIZE * 0.2} ${-SIZE * 0.8} L ${-SIZE * 0.3} ${-SIZE * 0.7}
       L ${-SIZE * 0.7} ${-SIZE * 0.5} L ${-SIZE * 0.8} 0
       L ${-SIZE * 0.7} ${SIZE * 0.5} L ${-SIZE * 0.3} ${SIZE * 0.7}
       L ${SIZE * 0.2} ${SIZE * 0.8} L ${SIZE * 0.7} ${SIZE * 0.5}
       L ${SIZE * 1.0} ${SIZE * 0.1} Z`
    );
  },

  generateSwarmPaths(SIZE) {
    // Swarm: Stealthy predator - angular, blade-like, sinister
    // Black hulls with crimson accents, red eyes on larger variants

    // Variant 1: Drone - Sharp dagger shape, fast and deadly
    this.cachedPaths['swarm_1'] = new Path2D(
      `M ${SIZE * 0.8} 0 L ${SIZE * 0.2} ${-SIZE * 0.25}
       L ${-SIZE * 0.4} ${-SIZE * 0.15} L ${-SIZE * 0.5} 0
       L ${-SIZE * 0.4} ${SIZE * 0.15} L ${SIZE * 0.2} ${SIZE * 0.25} Z`
    );

    // Variant 2: Worker - Angular with blade extensions
    this.cachedPaths['swarm_2'] = new Path2D(
      `M ${SIZE * 0.9} 0 L ${SIZE * 0.4} ${-SIZE * 0.15}
       L ${SIZE * 0.2} ${-SIZE * 0.5} L ${-SIZE * 0.1} ${-SIZE * 0.35}
       L ${-SIZE * 0.5} ${-SIZE * 0.2} L ${-SIZE * 0.6} 0
       L ${-SIZE * 0.5} ${SIZE * 0.2} L ${-SIZE * 0.1} ${SIZE * 0.35}
       L ${SIZE * 0.2} ${SIZE * 0.5} L ${SIZE * 0.4} ${SIZE * 0.15} Z`
    );
    // Worker blade tips
    this.cachedAccents['swarm_2'] = new Path2D(
      `M ${SIZE * 0.2} ${-SIZE * 0.5} L ${SIZE * 0.35} ${-SIZE * 0.7}
       M ${SIZE * 0.2} ${SIZE * 0.5} L ${SIZE * 0.35} ${SIZE * 0.7}`
    );

    // Variant 3: Warrior - Aggressive angular with blade wings and eye socket
    this.cachedPaths['swarm_3'] = new Path2D(
      `M ${SIZE * 1.0} 0 L ${SIZE * 0.5} ${-SIZE * 0.2}
       L ${SIZE * 0.3} ${-SIZE * 0.6} L ${0} ${-SIZE * 0.8}
       L ${-SIZE * 0.3} ${-SIZE * 0.5} L ${-SIZE * 0.6} ${-SIZE * 0.25}
       L ${-SIZE * 0.7} 0 L ${-SIZE * 0.6} ${SIZE * 0.25}
       L ${-SIZE * 0.3} ${SIZE * 0.5} L ${0} ${SIZE * 0.8}
       L ${SIZE * 0.3} ${SIZE * 0.6} L ${SIZE * 0.5} ${SIZE * 0.2} Z`
    );
    // Warrior blade wings
    this.cachedAccents['swarm_3'] = new Path2D(
      `M ${0} ${-SIZE * 0.8} L ${-SIZE * 0.2} ${-SIZE * 1.1} L ${-SIZE * 0.4} ${-SIZE * 0.7}
       M ${0} ${SIZE * 0.8} L ${-SIZE * 0.2} ${SIZE * 1.1} L ${-SIZE * 0.4} ${SIZE * 0.7}`
    );
    // Warrior eye position (stored for special rendering)
    this.cachedPaths['swarm_3_eye'] = { x: SIZE * 0.35, y: 0, radius: SIZE * 0.12 };

    // Variant 4: Queen - Massive predator with blade wings, spinal ridges, and glowing eye
    this.cachedPaths['swarm_4'] = new Path2D(
      `M ${SIZE * 1.2} 0 L ${SIZE * 0.7} ${-SIZE * 0.25}
       L ${SIZE * 0.5} ${-SIZE * 0.6} L ${SIZE * 0.2} ${-SIZE * 0.85}
       L ${-SIZE * 0.2} ${-SIZE * 0.9} L ${-SIZE * 0.5} ${-SIZE * 0.6}
       L ${-SIZE * 0.8} ${-SIZE * 0.3} L ${-SIZE * 0.9} 0
       L ${-SIZE * 0.8} ${SIZE * 0.3} L ${-SIZE * 0.5} ${SIZE * 0.6}
       L ${-SIZE * 0.2} ${SIZE * 0.9} L ${SIZE * 0.2} ${SIZE * 0.85}
       L ${SIZE * 0.5} ${SIZE * 0.6} L ${SIZE * 0.7} ${SIZE * 0.25} Z`
    );
    // Queen blade wings and spinal ridges
    this.cachedAccents['swarm_4'] = new Path2D(
      `M ${SIZE * 0.2} ${-SIZE * 0.85} L ${0} ${-SIZE * 1.2} L ${-SIZE * 0.3} ${-SIZE * 0.8}
       M ${SIZE * 0.2} ${SIZE * 0.85} L ${0} ${SIZE * 1.2} L ${-SIZE * 0.3} ${SIZE * 0.8}
       M ${-SIZE * 0.3} ${-SIZE * 0.55} L ${-SIZE * 0.5} ${-SIZE * 0.7}
       M ${-SIZE * 0.3} ${SIZE * 0.55} L ${-SIZE * 0.5} ${SIZE * 0.7}
       M ${-SIZE * 0.55} ${-SIZE * 0.35} L ${-SIZE * 0.75} ${-SIZE * 0.45}
       M ${-SIZE * 0.55} ${SIZE * 0.35} L ${-SIZE * 0.75} ${SIZE * 0.45}`
    );
    // Queen eye position (larger, more prominent)
    this.cachedPaths['swarm_4_eye'] = { x: SIZE * 0.5, y: 0, radius: SIZE * 0.18 };

    // Store vein paths for animated rendering
    this.cachedPaths['swarm_3_veins'] = new Path2D(
      `M ${SIZE * 0.3} 0 L ${-SIZE * 0.4} ${-SIZE * 0.15}
       M ${SIZE * 0.3} 0 L ${-SIZE * 0.4} ${SIZE * 0.15}
       M ${SIZE * 0.1} ${-SIZE * 0.3} L ${-SIZE * 0.2} ${-SIZE * 0.45}
       M ${SIZE * 0.1} ${SIZE * 0.3} L ${-SIZE * 0.2} ${SIZE * 0.45}`
    );
    this.cachedPaths['swarm_4_veins'] = new Path2D(
      `M ${SIZE * 0.45} 0 L ${-SIZE * 0.5} ${-SIZE * 0.2}
       M ${SIZE * 0.45} 0 L ${-SIZE * 0.5} ${SIZE * 0.2}
       M ${SIZE * 0.3} ${-SIZE * 0.4} L ${-SIZE * 0.3} ${-SIZE * 0.55}
       M ${SIZE * 0.3} ${SIZE * 0.4} L ${-SIZE * 0.3} ${SIZE * 0.55}
       M ${0} ${-SIZE * 0.6} L ${-SIZE * 0.4} ${-SIZE * 0.65}
       M ${0} ${SIZE * 0.6} L ${-SIZE * 0.4} ${SIZE * 0.65}`
    );
  },

  generateVoidPaths(SIZE) {
    // Void: Sleek, ethereal, angular but smooth, energy trails
    // Variant 1: Whisper - Small, fast, crescent
    this.cachedPaths['void_1'] = new Path2D(
      `M ${SIZE * 0.8} 0
       C ${SIZE * 0.6} ${-SIZE * 0.4}, ${0} ${-SIZE * 0.5}, ${-SIZE * 0.4} ${-SIZE * 0.3}
       L ${-SIZE * 0.3} 0
       L ${-SIZE * 0.4} ${SIZE * 0.3}
       C ${0} ${SIZE * 0.5}, ${SIZE * 0.6} ${SIZE * 0.4}, ${SIZE * 0.8} 0 Z`
    );

    // Variant 2: Shadow - Twin-pronged
    this.cachedPaths['void_2'] = new Path2D(
      `M ${SIZE * 0.9} 0 L ${SIZE * 0.4} ${-SIZE * 0.15}
       L ${SIZE * 0.1} ${-SIZE * 0.6} L ${-SIZE * 0.3} ${-SIZE * 0.5}
       L ${-SIZE * 0.5} ${-SIZE * 0.15} L ${-SIZE * 0.5} ${SIZE * 0.15}
       L ${-SIZE * 0.3} ${SIZE * 0.5} L ${SIZE * 0.1} ${SIZE * 0.6}
       L ${SIZE * 0.4} ${SIZE * 0.15} Z`
    );

    // Variant 3: Phantom - Diamond with extensions
    this.cachedPaths['void_3'] = new Path2D(
      `M ${SIZE * 1.0} 0 L ${SIZE * 0.3} ${-SIZE * 0.25}
       L ${0} ${-SIZE * 0.7} L ${-SIZE * 0.5} ${-SIZE * 0.45}
       L ${-SIZE * 0.6} 0 L ${-SIZE * 0.5} ${SIZE * 0.45}
       L ${0} ${SIZE * 0.7} L ${SIZE * 0.3} ${SIZE * 0.25} Z`
    );
    // Phantom core glow
    this.cachedAccents['void_3'] = new Path2D();
    this.cachedAccents['void_3'].arc(0, 0, SIZE * 0.15, 0, Math.PI * 2);

    // Variant 4: Leviathan - Massive, otherworldly
    this.cachedPaths['void_4'] = new Path2D(
      `M ${SIZE * 1.3} 0 L ${SIZE * 0.7} ${-SIZE * 0.3}
       L ${SIZE * 0.3} ${-SIZE * 0.8} L ${-SIZE * 0.2} ${-SIZE * 0.9}
       L ${-SIZE * 0.6} ${-SIZE * 0.6} L ${-SIZE * 0.8} ${-SIZE * 0.2}
       L ${-SIZE * 0.9} 0 L ${-SIZE * 0.8} ${SIZE * 0.2}
       L ${-SIZE * 0.6} ${SIZE * 0.6} L ${-SIZE * 0.2} ${SIZE * 0.9}
       L ${SIZE * 0.3} ${SIZE * 0.8} L ${SIZE * 0.7} ${SIZE * 0.3} Z`
    );
    // Leviathan dark core
    this.cachedAccents['void_4'] = new Path2D();
    this.cachedAccents['void_4'].arc(0, 0, SIZE * 0.25, 0, Math.PI * 2);
  },

  generateRogueMinerPaths(SIZE) {
    // Rogue Miners: Industrial, bulky, utilitarian, drill motifs
    // Variant 1: Prospector - Small, utility focused
    this.cachedPaths['rogue_1'] = new Path2D(
      `M ${SIZE * 0.8} 0 L ${SIZE * 0.5} ${-SIZE * 0.35}
       L ${-SIZE * 0.3} ${-SIZE * 0.4} L ${-SIZE * 0.5} ${-SIZE * 0.2}
       L ${-SIZE * 0.5} ${SIZE * 0.2} L ${-SIZE * 0.3} ${SIZE * 0.4}
       L ${SIZE * 0.5} ${SIZE * 0.35} Z`
    );

    // Variant 2: Driller - Pointed front (drill)
    this.cachedPaths['rogue_2'] = new Path2D(
      `M ${SIZE * 1.0} 0 L ${SIZE * 0.4} ${-SIZE * 0.1}
       L ${SIZE * 0.3} ${-SIZE * 0.5} L ${-SIZE * 0.2} ${-SIZE * 0.55}
       L ${-SIZE * 0.5} ${-SIZE * 0.3} L ${-SIZE * 0.6} 0
       L ${-SIZE * 0.5} ${SIZE * 0.3} L ${-SIZE * 0.2} ${SIZE * 0.55}
       L ${SIZE * 0.3} ${SIZE * 0.5} L ${SIZE * 0.4} ${SIZE * 0.1} Z`
    );
    // Drill bit accent
    this.cachedAccents['rogue_2'] = new Path2D(
      `M ${SIZE * 1.0} 0 L ${SIZE * 0.6} ${-SIZE * 0.08} L ${SIZE * 0.6} ${SIZE * 0.08} Z`
    );

    // Variant 3: Excavator - Wide, heavy
    this.cachedPaths['rogue_3'] = new Path2D(
      `M ${SIZE * 0.9} 0 L ${SIZE * 0.6} ${-SIZE * 0.4}
       L ${SIZE * 0.2} ${-SIZE * 0.65} L ${-SIZE * 0.3} ${-SIZE * 0.6}
       L ${-SIZE * 0.6} ${-SIZE * 0.35} L ${-SIZE * 0.7} 0
       L ${-SIZE * 0.6} ${SIZE * 0.35} L ${-SIZE * 0.3} ${SIZE * 0.6}
       L ${SIZE * 0.2} ${SIZE * 0.65} L ${SIZE * 0.6} ${SIZE * 0.4} Z`
    );
    // Warning stripe pattern
    this.cachedAccents['rogue_3'] = new Path2D(
      `M ${-SIZE * 0.1} ${-SIZE * 0.5} L ${SIZE * 0.1} ${-SIZE * 0.5}
       L ${SIZE * 0.1} ${SIZE * 0.5} L ${-SIZE * 0.1} ${SIZE * 0.5} Z`
    );

    // Variant 4: Foreman - Massive command ship
    this.cachedPaths['rogue_4'] = new Path2D(
      `M ${SIZE * 1.1} 0 L ${SIZE * 0.7} ${-SIZE * 0.35}
       L ${SIZE * 0.4} ${-SIZE * 0.7} L ${0} ${-SIZE * 0.8}
       L ${-SIZE * 0.4} ${-SIZE * 0.65} L ${-SIZE * 0.7} ${-SIZE * 0.4}
       L ${-SIZE * 0.8} 0 L ${-SIZE * 0.7} ${SIZE * 0.4}
       L ${-SIZE * 0.4} ${SIZE * 0.65} L ${0} ${SIZE * 0.8}
       L ${SIZE * 0.4} ${SIZE * 0.7} L ${SIZE * 0.7} ${SIZE * 0.35} Z`
    );
    // Foreman bridge
    this.cachedAccents['rogue_4'] = new Path2D(
      `M ${SIZE * 0.4} 0 L ${SIZE * 0.15} ${-SIZE * 0.2}
       L ${-SIZE * 0.1} 0 L ${SIZE * 0.15} ${SIZE * 0.2} Z`
    );
  },

  /**
   * Get faction from NPC type
   */
  getFaction(npcType) {
    if (!npcType || typeof npcType !== 'string') return 'pirate';
    if (npcType.startsWith('pirate')) return 'pirate';
    if (npcType.startsWith('scavenger')) return 'scavenger';
    if (npcType.startsWith('swarm')) return 'swarm';
    if (npcType.startsWith('void')) return 'void';
    if (npcType.startsWith('rogue')) return 'rogue_miner';
    return 'pirate'; // default
  },

  /**
   * Get variant number (1-4) from NPC type
   */
  getVariant(npcType) {
    const variant = this.SHIP_VARIANTS[npcType];
    if (!variant) return 1;
    return parseInt(variant.split('_')[1]) || 1;
  },

  /**
   * Draw an NPC ship with faction-specific geometry
   */
  draw(ctx, position, rotation, npcType, faction, screenPos, time) {
    // Use special spider visuals for swarm queen
    if (npcType === 'swarm_queen' && typeof QueenVisuals !== 'undefined') {
      // Pass world position for eye tracking
      QueenVisuals.draw(ctx, screenPos.x, screenPos.y, rotation, time || Date.now(), null, position);
      return;
    }

    const variant = this.SHIP_VARIANTS[npcType] || 'pirate_1';
    const variantNum = this.getVariant(npcType);
    const actualFaction = faction || this.getFaction(npcType);
    const colors = this.FACTION_COLORS[actualFaction] || this.FACTION_COLORS.pirate;
    const scale = this.SIZE_SCALE[variantNum] || 1;

    const shipPath = this.cachedPaths[variant];
    if (!shipPath) {
      // Fallback to basic shape
      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);
      ctx.rotate(rotation);
      ctx.fillStyle = colors.hull;
      ctx.beginPath();
      ctx.moveTo(this.SIZE, 0);
      ctx.lineTo(-this.SIZE * 0.5, -this.SIZE * 0.5);
      ctx.lineTo(-this.SIZE * 0.5, this.SIZE * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    // Draw glow for larger variants
    if (variantNum >= 3) {
      const glowRadius = this.SIZE * (1.5 + variantNum * 0.3);
      const gradient = ctx.createRadialGradient(0, 0, this.SIZE * 0.3, 0, 0, glowRadius);
      gradient.addColorStop(0, colors.glow);
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw main hull
    ctx.fillStyle = colors.hull;
    ctx.fill(shipPath);

    // Draw outline
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke(shipPath);

    // Draw accent if exists
    const accentPath = this.cachedAccents[variant];
    if (accentPath) {
      ctx.fillStyle = colors.accent;
      ctx.fill(accentPath);
      ctx.strokeStyle = colors.outline + '80';
      ctx.lineWidth = 0.5;
      ctx.stroke(accentPath);
    }

    // Special Swarm rendering: pulsing veins and glowing eye
    if (actualFaction === 'swarm') {
      this.drawSwarmEffects(ctx, variant, variantNum, colors, time);
    }

    ctx.restore();
  },

  /**
   * Draw Swarm-specific effects: pulsing crimson veins and glowing red eyes
   */
  drawSwarmEffects(ctx, variant, variantNum, colors, time) {
    const currentTime = time || Date.now();
    const pulsePhase = (Math.sin(currentTime * 0.003) + 1) / 2; // 0-1 pulsing

    // Draw pulsing veins for Warrior and Queen
    const veinPath = this.cachedPaths[variant + '_veins'];
    if (veinPath) {
      ctx.strokeStyle = colors.veinColor || '#990000';
      ctx.lineWidth = 1 + pulsePhase * 0.5;
      ctx.globalAlpha = 0.5 + pulsePhase * 0.4;
      ctx.stroke(veinPath);
      ctx.globalAlpha = 1;
    }

    // Draw glowing eye for Warrior and Queen
    const eyeData = this.cachedPaths[variant + '_eye'];
    if (eyeData) {
      const eyeColor = colors.eyeColor || '#ff0000';
      const eyePulse = 0.7 + pulsePhase * 0.3;

      // Eye glow
      const eyeGradient = ctx.createRadialGradient(
        eyeData.x, eyeData.y, 0,
        eyeData.x, eyeData.y, eyeData.radius * 2
      );
      eyeGradient.addColorStop(0, eyeColor);
      eyeGradient.addColorStop(0.5, eyeColor + '80');
      eyeGradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = eyePulse;
      ctx.fillStyle = eyeGradient;
      ctx.beginPath();
      ctx.arc(eyeData.x, eyeData.y, eyeData.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Eye core
      ctx.globalAlpha = 1;
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(eyeData.x, eyeData.y, eyeData.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Eye pupil (dark center)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(eyeData.x, eyeData.y, eyeData.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Get exhaust position for thrust effects (faction ships)
   */
  getExhaustPosition(npcType) {
    const variantNum = this.getVariant(npcType);
    const scale = this.SIZE_SCALE[variantNum] || 1;
    return {
      x: -this.SIZE * 0.5 * scale,
      y: 0
    };
  },

  /**
   * Get nose position for weapon fire
   */
  getNosePosition(npcType) {
    const variantNum = this.getVariant(npcType);
    const scale = this.SIZE_SCALE[variantNum] || 1;
    return {
      x: this.SIZE * scale,
      y: 0
    };
  },

  /**
   * Draw a swarm egg during the hatching phase
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} screenPos - Screen position {x, y}
   * @param {number} hatchProgress - 0-1, how far through hatching (0 = just spawned, 1 = hatching complete)
   * @param {string} npcType - Type of NPC hatching from the egg
   * @param {number} time - Current timestamp for animations
   */
  drawSwarmEgg(ctx, screenPos, hatchProgress, npcType, time) {
    const isQueen = npcType === 'swarm_queen';
    const variantNum = this.getVariant(npcType);
    const scale = this.SIZE_SCALE[variantNum] || 1;

    // Egg size based on NPC type
    const baseRadius = this.SIZE * scale * 0.8;
    const eggWidth = baseRadius * 0.7;
    const eggHeight = baseRadius * 1.2;

    // Pulsing animation
    const pulsePhase = (Math.sin((time || Date.now()) * 0.004) + 1) / 2;
    const crackPhase = Math.max(0, (hatchProgress - 0.5) * 2); // Cracks appear at 50%+

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Egg glow (intensifies as hatching progresses)
    const glowIntensity = 0.3 + hatchProgress * 0.5 + pulsePhase * 0.2;
    const glowRadius = baseRadius * (1.5 + hatchProgress * 0.5);
    const gradient = ctx.createRadialGradient(0, 0, eggWidth * 0.3, 0, 0, glowRadius);
    gradient.addColorStop(0, `rgba(139, 0, 0, ${glowIntensity})`);
    gradient.addColorStop(0.5, `rgba(102, 0, 0, ${glowIntensity * 0.5})`);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw egg shell - dark crimson with organic texture
    ctx.beginPath();
    ctx.ellipse(0, 0, eggWidth, eggHeight, 0, 0, Math.PI * 2);

    // Egg gradient - darker at edges
    const eggGradient = ctx.createRadialGradient(
      -eggWidth * 0.2, -eggHeight * 0.3, 0,
      0, 0, eggHeight
    );
    eggGradient.addColorStop(0, '#4a0000');
    eggGradient.addColorStop(0.4, '#2a0000');
    eggGradient.addColorStop(1, '#1a0000');
    ctx.fillStyle = eggGradient;
    ctx.fill();

    // Egg outline
    ctx.strokeStyle = '#660000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Organic vein patterns on egg
    ctx.strokeStyle = `rgba(153, 0, 0, ${0.5 + pulsePhase * 0.3})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + (time || 0) * 0.0005;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const endX = Math.cos(angle) * eggWidth * 0.9;
      const endY = Math.sin(angle) * eggHeight * 0.9;
      const ctrlX = Math.cos(angle + 0.3) * eggWidth * 0.5;
      const ctrlY = Math.sin(angle + 0.3) * eggHeight * 0.5;
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.stroke();
    }

    // Queen eggs have elaborate markings and sigils
    if (isQueen) {
      this.drawQueenEggMarkings(ctx, eggWidth, eggHeight, pulsePhase, time);
    }

    // Cracks appearing as egg hatches (after 50% progress)
    if (crackPhase > 0) {
      ctx.strokeStyle = `rgba(255, 50, 0, ${crackPhase})`;
      ctx.lineWidth = 1.5 + crackPhase;

      // Main crack from top
      ctx.beginPath();
      ctx.moveTo(0, -eggHeight * 0.9);
      ctx.lineTo(-eggWidth * 0.2, -eggHeight * 0.5);
      ctx.lineTo(eggWidth * 0.1, -eggHeight * 0.2);
      ctx.lineTo(-eggWidth * 0.15, eggHeight * 0.1);
      ctx.stroke();

      // Branch cracks
      if (crackPhase > 0.3) {
        ctx.beginPath();
        ctx.moveTo(-eggWidth * 0.2, -eggHeight * 0.5);
        ctx.lineTo(-eggWidth * 0.5, -eggHeight * 0.3);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(eggWidth * 0.1, -eggHeight * 0.2);
        ctx.lineTo(eggWidth * 0.4, 0);
        ctx.stroke();
      }

      // Glow from within cracks
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10 * crackPhase;
      ctx.strokeStyle = `rgba(255, 100, 0, ${crackPhase * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -eggHeight * 0.9);
      ctx.lineTo(-eggWidth * 0.2, -eggHeight * 0.5);
      ctx.lineTo(eggWidth * 0.1, -eggHeight * 0.2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Inner glow/eye appearing near end of hatching
    if (hatchProgress > 0.7) {
      const eyeAlpha = (hatchProgress - 0.7) / 0.3;
      const eyeRadius = eggWidth * 0.25;

      // Eye glow
      const eyeGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeRadius * 2);
      eyeGlow.addColorStop(0, `rgba(255, 0, 0, ${eyeAlpha})`);
      eyeGlow.addColorStop(0.5, `rgba(139, 0, 0, ${eyeAlpha * 0.5})`);
      eyeGlow.addColorStop(1, 'transparent');

      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(0, -eggHeight * 0.1, eyeRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Eye core
      ctx.fillStyle = `rgba(255, 0, 0, ${eyeAlpha})`;
      ctx.beginPath();
      ctx.arc(0, -eggHeight * 0.1, eyeRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  /**
   * Draw elaborate markings on queen eggs
   */
  drawQueenEggMarkings(ctx, eggWidth, eggHeight, pulsePhase, time) {
    const markingAlpha = 0.6 + pulsePhase * 0.3;

    // Outer ring sigil
    ctx.strokeStyle = `rgba(255, 50, 0, ${markingAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, eggWidth * 0.85, eggHeight * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner arcane circle
    ctx.beginPath();
    ctx.ellipse(0, 0, eggWidth * 0.5, eggHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Extraterrestrial sigils - rotating slowly
    const sigilRotation = ((time || Date.now()) * 0.0002) % (Math.PI * 2);
    ctx.save();
    ctx.rotate(sigilRotation);

    // Triangle sigil
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * eggWidth * 0.7;
      const y = Math.sin(angle) * eggHeight * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Star points extending outward
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(angle) * eggWidth * 0.5,
        Math.sin(angle) * eggHeight * 0.5
      );
      ctx.lineTo(
        Math.cos(angle) * eggWidth * 0.9,
        Math.sin(angle) * eggHeight * 0.9
      );
      ctx.stroke();
    }

    // Small alien glyphs around the egg
    const glyphSize = eggWidth * 0.12;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const gx = Math.cos(angle) * eggWidth * 0.65;
      const gy = Math.sin(angle) * eggHeight * 0.65;

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(angle);

      // Each glyph is a simple alien symbol
      ctx.beginPath();
      if (i === 0) {
        // Eye symbol
        ctx.arc(0, 0, glyphSize, 0, Math.PI * 2);
        ctx.moveTo(0, -glyphSize);
        ctx.lineTo(0, glyphSize);
      } else if (i === 1) {
        // Cross with dots
        ctx.moveTo(-glyphSize, 0);
        ctx.lineTo(glyphSize, 0);
        ctx.moveTo(0, -glyphSize);
        ctx.lineTo(0, glyphSize);
      } else if (i === 2) {
        // Spiral hint
        ctx.arc(0, 0, glyphSize * 0.5, 0, Math.PI * 1.5);
        ctx.arc(0, 0, glyphSize, Math.PI * 1.5, Math.PI * 2);
      } else {
        // Diamond
        ctx.moveTo(0, -glyphSize);
        ctx.lineTo(glyphSize, 0);
        ctx.lineTo(0, glyphSize);
        ctx.lineTo(-glyphSize, 0);
        ctx.closePath();
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Pulsing center rune
    ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + pulsePhase * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, 0, eggWidth * 0.15, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw an attached assimilation worm (drone that has latched onto a base)
   * Crimson worm visual that wiggles aggressively while burrowing into the base
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} screenPos - Screen position {x, y}
   * @param {Object} npc - NPC data including hull for damage display
   * @param {number} time - Current timestamp for animations
   */
  drawAttachedWorm(ctx, screenPos, npc, time) {
    const t = time || Date.now();

    // Worm dimensions
    const wormLength = 25;
    const wormWidth = 8;
    const segments = 6;

    // Aggressive wiggle animation
    const wiggleSpeed = 0.012;
    const wiggleAmp = 4;
    const burrowPhase = Math.sin(t * 0.003) * 2; // Up/down burrowing motion

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y + burrowPhase);

    // Outer glow - pulsing crimson
    const glowPulse = 0.4 + Math.sin(t * 0.006) * 0.2;
    const glowGradient = ctx.createRadialGradient(0, 0, wormWidth, 0, 0, wormLength);
    glowGradient.addColorStop(0, `rgba(139, 0, 0, ${glowPulse})`);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, wormLength, 0, Math.PI * 2);
    ctx.fill();

    // Draw worm body as segmented curve
    ctx.strokeStyle = '#4a0000';
    ctx.lineWidth = wormWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Worm body path with wiggle
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const y = progress * wormLength - wormLength * 0.3; // Extends down from attachment point
      const wiggle = Math.sin(t * wiggleSpeed + progress * Math.PI * 3) * wiggleAmp * (1 - progress * 0.5);

      if (i === 0) {
        ctx.moveTo(wiggle, y);
      } else {
        ctx.lineTo(wiggle, y);
      }
    }
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = wormWidth * 0.6;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const y = progress * wormLength - wormLength * 0.3;
      const wiggle = Math.sin(t * wiggleSpeed + progress * Math.PI * 3) * wiggleAmp * (1 - progress * 0.5);

      if (i === 0) {
        ctx.moveTo(wiggle, y);
      } else {
        ctx.lineTo(wiggle, y);
      }
    }
    ctx.stroke();

    // Crimson veins along body
    ctx.strokeStyle = `rgba(255, 0, 0, ${0.4 + Math.sin(t * 0.008) * 0.2})`;
    ctx.lineWidth = 1;
    for (let v = 0; v < 2; v++) {
      ctx.beginPath();
      const offset = (v - 0.5) * 3;
      for (let i = 0; i <= segments; i++) {
        const progress = i / segments;
        const y = progress * wormLength - wormLength * 0.3;
        const wiggle = Math.sin(t * wiggleSpeed + progress * Math.PI * 3) * wiggleAmp * (1 - progress * 0.5);

        if (i === 0) {
          ctx.moveTo(wiggle + offset, y);
        } else {
          ctx.lineTo(wiggle + offset, y);
        }
      }
      ctx.stroke();
    }

    // Worm head - "chewing" into base
    const headY = -wormLength * 0.3;
    const chewPhase = Math.sin(t * 0.015) * 0.3;

    // Head shape
    ctx.fillStyle = '#660000';
    ctx.beginPath();
    ctx.ellipse(0, headY, wormWidth * 0.7, wormWidth * 0.5 * (1 + chewPhase), 0, 0, Math.PI * 2);
    ctx.fill();

    // Mandibles
    ctx.strokeStyle = '#990000';
    ctx.lineWidth = 2;
    const mandibleOpen = 3 + chewPhase * 4;
    ctx.beginPath();
    ctx.moveTo(-mandibleOpen, headY - 3);
    ctx.lineTo(0, headY - 6);
    ctx.lineTo(mandibleOpen, headY - 3);
    ctx.stroke();

    // Eyes - glowing red
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(-2, headY + 1, 1.5, 0, Math.PI * 2);
    ctx.arc(2, headY + 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tail end - small spike
    const tailY = wormLength * 0.7;
    const tailWiggle = Math.sin(t * wiggleSpeed + Math.PI * 3) * wiggleAmp * 0.5;
    ctx.fillStyle = '#4a0000';
    ctx.beginPath();
    ctx.moveTo(tailWiggle - 3, tailY);
    ctx.lineTo(tailWiggle, tailY + 6);
    ctx.lineTo(tailWiggle + 3, tailY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw small health indicator below worm (if damaged)
    if (npc && npc.hull < npc.hullMax) {
      const healthPercent = npc.hull / npc.hullMax;
      const barWidth = 20;
      const barHeight = 3;
      const barY = screenPos.y + wormLength + 8;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(screenPos.x - barWidth / 2, barY, barWidth, barHeight);

      // Health bar
      ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(screenPos.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
    }
  },

  /**
   * Check if an NPC is an attached assimilation drone
   * @returns {boolean} True if this NPC should render as an attached worm
   */
  isAttachedDrone(npc) {
    return npc && npc.state === 'attached' && npc.faction === 'swarm';
  },

  /**
   * Check if an NPC should be rendered as a hatching egg
   * @returns {number|null} Hatch progress 0-1, or null if fully hatched/not swarm
   */
  getHatchProgress(npc) {
    if (!npc.spawnTime || !npc.hatchDuration || npc.faction !== 'swarm') {
      return null;
    }

    const elapsed = Date.now() - npc.spawnTime;
    if (elapsed >= npc.hatchDuration) {
      return null; // Fully hatched
    }

    return elapsed / npc.hatchDuration;
  }
};
