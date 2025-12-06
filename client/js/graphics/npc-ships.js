/**
 * NPC Ship Geometry Definitions
 * Distinct ship silhouettes for each of the 5 factions
 * Pirates: Angular, aggressive
 * Scavengers: Asymmetric, patched together
 * Swarm: Organic, curved
 * Void: Sleek, ethereal
 * Rogue Miners: Industrial, bulky
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
      hull: '#00ff66',
      accent: '#00cc44',
      glow: '#00ff6670',
      outline: '#66ff99'
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
  SIZE_SCALE: {
    1: 0.9,
    2: 1.0,
    3: 1.15,
    4: 1.4
  },

  init() {
    const SIZE = this.SIZE;

    // Generate all faction ship paths
    this.generatePiratePaths(SIZE);
    this.generateScavengerPaths(SIZE);
    this.generateSwarmPaths(SIZE);
    this.generateVoidPaths(SIZE);
    this.generateRogueMinerPaths(SIZE);

    console.log('NPCShipGeometry initialized with faction ships');
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
    // Swarm: Organic, curved, insectoid, bioluminescent
    // Variant 1: Drone - Tiny, round
    this.cachedPaths['swarm_1'] = new Path2D();
    this.cachedPaths['swarm_1'].ellipse(0, 0, SIZE * 0.5, SIZE * 0.35, 0, 0, Math.PI * 2);

    // Variant 2: Worker - Oval with mandibles
    const worker = new Path2D();
    worker.ellipse(0, 0, SIZE * 0.6, SIZE * 0.4, 0, 0, Math.PI * 2);
    worker.moveTo(SIZE * 0.6, SIZE * 0.1);
    worker.lineTo(SIZE * 0.9, SIZE * 0.25);
    worker.moveTo(SIZE * 0.6, -SIZE * 0.1);
    worker.lineTo(SIZE * 0.9, -SIZE * 0.25);
    this.cachedPaths['swarm_2'] = worker;

    // Variant 3: Warrior - Larger, aggressive curves
    this.cachedPaths['swarm_3'] = new Path2D(
      `M ${SIZE * 0.9} 0
       C ${SIZE * 0.8} ${-SIZE * 0.3}, ${SIZE * 0.4} ${-SIZE * 0.6}, ${0} ${-SIZE * 0.5}
       C ${-SIZE * 0.4} ${-SIZE * 0.5}, ${-SIZE * 0.7} ${-SIZE * 0.3}, ${-SIZE * 0.6} 0
       C ${-SIZE * 0.7} ${SIZE * 0.3}, ${-SIZE * 0.4} ${SIZE * 0.5}, ${0} ${SIZE * 0.5}
       C ${SIZE * 0.4} ${SIZE * 0.6}, ${SIZE * 0.8} ${SIZE * 0.3}, ${SIZE * 0.9} 0 Z`
    );
    // Warrior pincers accent
    this.cachedAccents['swarm_3'] = new Path2D(
      `M ${SIZE * 0.9} 0 L ${SIZE * 1.2} ${-SIZE * 0.3}
       M ${SIZE * 0.9} 0 L ${SIZE * 1.2} ${SIZE * 0.3}`
    );

    // Variant 4: Queen - Massive, elongated abdomen
    this.cachedPaths['swarm_4'] = new Path2D(
      `M ${SIZE * 1.1} 0
       C ${SIZE} ${-SIZE * 0.4}, ${SIZE * 0.5} ${-SIZE * 0.7}, ${0} ${-SIZE * 0.6}
       C ${-SIZE * 0.5} ${-SIZE * 0.6}, ${-SIZE * 0.9} ${-SIZE * 0.4}, ${-SIZE * 1.0} 0
       C ${-SIZE * 0.9} ${SIZE * 0.4}, ${-SIZE * 0.5} ${SIZE * 0.6}, ${0} ${SIZE * 0.6}
       C ${SIZE * 0.5} ${SIZE * 0.7}, ${SIZE} ${SIZE * 0.4}, ${SIZE * 1.1} 0 Z`
    );
    // Queen crown accent
    this.cachedAccents['swarm_4'] = new Path2D(
      `M ${SIZE * 0.3} ${-SIZE * 0.5} L ${SIZE * 0.5} ${-SIZE * 0.8} L ${SIZE * 0.6} ${-SIZE * 0.4}
       M ${SIZE * 0.3} ${SIZE * 0.5} L ${SIZE * 0.5} ${SIZE * 0.8} L ${SIZE * 0.6} ${SIZE * 0.4}`
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
  draw(ctx, position, rotation, npcType, faction, screenPos) {
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

    ctx.restore();
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
  }
};
