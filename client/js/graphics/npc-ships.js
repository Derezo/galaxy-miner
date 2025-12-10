/**
 * NPC Ship Geometry Definitions
 * Distinct ship silhouettes for each of the 5 factions
 * Pirates: Angular, aggressive, bright red
 * Scavengers: Construction equipment aesthetic - yellow/brown, front-loader buckets, industrial
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
      // Grimy industrial junkyard aesthetic
      hull: '#8B4513',        // Rust brown (main hull)
      accent: '#6B4423',      // Corroded copper (secondary)
      rust: '#A0522D',        // Rust patches
      dirtyYellow: '#B8860B', // Faded construction yellow
      grimySteel: '#4A4A4A',  // Dark steel gray
      weldGlow: '#FF6B35',    // Orange weld marks
      oilStain: '#2F2F2F',    // Dark oil stains
      copper: '#8B5A2B',      // Dull copper pipes
      steel: '#5A5A5A',       // Weathered steel
      glow: '#8B451340',      // Subtle rust glow
      outline: '#5C4033'      // Dark brown outline
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

    // Scavengers - Construction equipment with front-loaders
    scavenger_scrapper: 'scavenger_1',
    scavenger_salvager: 'scavenger_2',
    scavenger_collector: 'scavenger_3',
    scavenger_hauler: 'scavenger_4',
    scavenger_barnacle_king: 'scavenger_5',

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

  // Size multiplier per variant (1-5)
  // Variant 4 is bosses (queens, dreadnoughts, etc) - larger for visual impact
  // Variant 5 is special super-bosses (Barnacle King) - massive but manageable
  SIZE_SCALE: {
    1: 0.9,
    2: 1.0,
    3: 1.15,
    4: 1.8,   // Increased from 1.4 for larger boss ships
    5: 10     // 200 units total (20 * 10 = 200)
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
    // GRIMY JUNKYARD AESTHETIC - Rusty, cobbled-together ships made from scrap
    // Each ship looks built from salvaged parts with visible welds, rust, mismatched panels

    // Variant 1: Scrapper - Tiny salvage rat, barely holding together
    // Asymmetric hull with mismatched panels, exposed wiring, single sputtering engine
    this.cachedPaths['scavenger_1'] = new Path2D(
      // Lopsided, irregular hull shape
      `M ${SIZE * 0.7} ${SIZE * 0.05}
       L ${SIZE * 0.5} ${-SIZE * 0.2}
       L ${SIZE * 0.2} ${-SIZE * 0.35}
       L ${-SIZE * 0.15} ${-SIZE * 0.38}
       L ${-SIZE * 0.4} ${-SIZE * 0.25}
       L ${-SIZE * 0.55} ${-SIZE * 0.1}
       L ${-SIZE * 0.5} ${SIZE * 0.2}
       L ${-SIZE * 0.25} ${SIZE * 0.38}
       L ${SIZE * 0.15} ${SIZE * 0.35}
       L ${SIZE * 0.45} ${SIZE * 0.28} Z`
    );
    // Skinny bent magnetic claw arm on front
    this.cachedAccents['scavenger_1'] = new Path2D(
      `M ${SIZE * 0.7} ${SIZE * 0.05}
       L ${SIZE * 0.85} ${-SIZE * 0.08}
       L ${SIZE * 0.95} ${-SIZE * 0.15}
       L ${SIZE * 1.05} ${-SIZE * 0.1}
       L ${SIZE * 1.0} ${SIZE * 0.05}
       L ${SIZE * 0.9} ${SIZE * 0.12}
       L ${SIZE * 0.78} ${SIZE * 0.1} Z`
    );
    // Mismatched panel for rendering (different color patch)
    this.cachedPaths['scavenger_1_patch'] = new Path2D(
      `M ${SIZE * 0.1} ${-SIZE * 0.15}
       L ${SIZE * 0.3} ${-SIZE * 0.2}
       L ${SIZE * 0.35} ${SIZE * 0.05}
       L ${SIZE * 0.15} ${SIZE * 0.1} Z`
    );

    // Variant 2: Salvager - Converted cargo pod with scrap armor bolted on
    // Boxy body, dual mismatched engines, grappling hooks
    this.cachedPaths['scavenger_2'] = new Path2D(
      // Boxy rectangular cargo body
      `M ${SIZE * 0.6} ${-SIZE * 0.15}
       L ${SIZE * 0.65} ${-SIZE * 0.35}
       L ${SIZE * 0.3} ${-SIZE * 0.45}
       L ${-SIZE * 0.2} ${-SIZE * 0.48}
       L ${-SIZE * 0.55} ${-SIZE * 0.35}
       L ${-SIZE * 0.6} ${-SIZE * 0.1}
       L ${-SIZE * 0.6} ${SIZE * 0.1}
       L ${-SIZE * 0.55} ${SIZE * 0.35}
       L ${-SIZE * 0.2} ${SIZE * 0.48}
       L ${SIZE * 0.3} ${SIZE * 0.45}
       L ${SIZE * 0.65} ${SIZE * 0.35}
       L ${SIZE * 0.6} ${SIZE * 0.15} Z`
    );
    // Grappling hook arms (bent, industrial) and dual exhausts
    this.cachedAccents['scavenger_2'] = new Path2D(
      // Front grappling hooks
      `M ${SIZE * 0.6} ${-SIZE * 0.15}
       L ${SIZE * 0.8} ${-SIZE * 0.25}
       L ${SIZE * 0.95} ${-SIZE * 0.2}
       L ${SIZE * 0.9} ${-SIZE * 0.1}
       M ${SIZE * 0.6} ${SIZE * 0.15}
       L ${SIZE * 0.8} ${SIZE * 0.25}
       L ${SIZE * 0.95} ${SIZE * 0.2}
       L ${SIZE * 0.9} ${SIZE * 0.1}
       M ${-SIZE * 0.6} ${-SIZE * 0.25}
       L ${-SIZE * 0.75} ${-SIZE * 0.3}
       L ${-SIZE * 0.72} ${-SIZE * 0.15}
       M ${-SIZE * 0.6} ${SIZE * 0.25}
       L ${-SIZE * 0.75} ${SIZE * 0.3}
       L ${-SIZE * 0.72} ${SIZE * 0.15}`
    );
    // Bolted armor plates (irregular shapes)
    this.cachedPaths['scavenger_2_armor'] = new Path2D(
      `M ${SIZE * 0.0} ${-SIZE * 0.45}
       L ${SIZE * 0.15} ${-SIZE * 0.52}
       L ${SIZE * 0.25} ${-SIZE * 0.48}
       L ${SIZE * 0.1} ${-SIZE * 0.4} Z
       M ${-SIZE * 0.35} ${-SIZE * 0.4}
       L ${-SIZE * 0.45} ${-SIZE * 0.45}
       L ${-SIZE * 0.5} ${-SIZE * 0.35}
       L ${-SIZE * 0.38} ${-SIZE * 0.32} Z`
    );

    // Variant 3: Collector - Junkyard whale with wide intake maw
    // Wide body, huge front opening with grinder teeth, storage tanks
    this.cachedPaths['scavenger_3'] = new Path2D(
      // Wide whale-like body
      `M ${SIZE * 0.5} ${-SIZE * 0.2}
       L ${SIZE * 0.6} ${-SIZE * 0.45}
       L ${SIZE * 0.3} ${-SIZE * 0.6}
       L ${-SIZE * 0.1} ${-SIZE * 0.65}
       L ${-SIZE * 0.5} ${-SIZE * 0.55}
       L ${-SIZE * 0.7} ${-SIZE * 0.3}
       L ${-SIZE * 0.75} 0
       L ${-SIZE * 0.7} ${SIZE * 0.3}
       L ${-SIZE * 0.5} ${SIZE * 0.55}
       L ${-SIZE * 0.1} ${SIZE * 0.65}
       L ${SIZE * 0.3} ${SIZE * 0.6}
       L ${SIZE * 0.6} ${SIZE * 0.45}
       L ${SIZE * 0.5} ${SIZE * 0.2} Z`
    );
    // Intake maw with grinder teeth
    this.cachedAccents['scavenger_3'] = new Path2D(
      // Maw opening
      `M ${SIZE * 0.5} ${-SIZE * 0.2}
       L ${SIZE * 0.75} ${-SIZE * 0.35}
       L ${SIZE * 0.9} ${-SIZE * 0.25}
       L ${SIZE * 0.95} 0
       L ${SIZE * 0.9} ${SIZE * 0.25}
       L ${SIZE * 0.75} ${SIZE * 0.35}
       L ${SIZE * 0.5} ${SIZE * 0.2}
       L ${SIZE * 0.55} 0 Z`
    );
    // Grinder teeth inside maw
    this.cachedPaths['scavenger_3_teeth'] = new Path2D(
      `M ${SIZE * 0.6} ${-SIZE * 0.15} L ${SIZE * 0.7} ${-SIZE * 0.08} L ${SIZE * 0.62} 0
       M ${SIZE * 0.65} ${-SIZE * 0.05} L ${SIZE * 0.75} 0 L ${SIZE * 0.65} ${SIZE * 0.05}
       M ${SIZE * 0.6} ${SIZE * 0.15} L ${SIZE * 0.7} ${SIZE * 0.08} L ${SIZE * 0.62} 0`
    );
    // Side storage tanks (rusty cylinders)
    this.cachedPaths['scavenger_3_tanks'] = [
      { x: -SIZE * 0.3, y: -SIZE * 0.5, w: SIZE * 0.25, h: SIZE * 0.12 },
      { x: -SIZE * 0.3, y: SIZE * 0.38, w: SIZE * 0.25, h: SIZE * 0.12 }
    ];

    // Variant 4: Hauler - Scrap titan, massive industrial monster
    // Enormous cargo bay, crane arm, tracked undercarriage, smoke stacks
    this.cachedPaths['scavenger_4'] = new Path2D(
      // Massive industrial body
      `M ${SIZE * 0.7} 0
       L ${SIZE * 0.5} ${-SIZE * 0.4}
       L ${SIZE * 0.2} ${-SIZE * 0.65}
       L ${-SIZE * 0.3} ${-SIZE * 0.7}
       L ${-SIZE * 0.6} ${-SIZE * 0.55}
       L ${-SIZE * 0.8} ${-SIZE * 0.3}
       L ${-SIZE * 0.85} 0
       L ${-SIZE * 0.8} ${SIZE * 0.3}
       L ${-SIZE * 0.6} ${SIZE * 0.55}
       L ${-SIZE * 0.3} ${SIZE * 0.7}
       L ${SIZE * 0.2} ${SIZE * 0.65}
       L ${SIZE * 0.5} ${SIZE * 0.4} Z`
    );
    // Crane arm with grabber claw
    this.cachedAccents['scavenger_4'] = new Path2D(
      // Crane arm extending forward
      `M ${SIZE * 0.5} ${-SIZE * 0.15}
       L ${SIZE * 0.8} ${-SIZE * 0.2}
       L ${SIZE * 1.1} ${-SIZE * 0.15}
       L ${SIZE * 1.25} ${-SIZE * 0.25}
       L ${SIZE * 1.35} ${-SIZE * 0.15}
       L ${SIZE * 1.3} 0
       L ${SIZE * 1.35} ${SIZE * 0.15}
       L ${SIZE * 1.25} ${SIZE * 0.25}
       L ${SIZE * 1.1} ${SIZE * 0.15}
       L ${SIZE * 0.8} ${SIZE * 0.2}
       L ${SIZE * 0.5} ${SIZE * 0.15} Z`
    );
    // Cargo containers (multiple welded together)
    this.cachedPaths['scavenger_4_cargo'] = new Path2D(
      `M ${-SIZE * 0.1} ${-SIZE * 0.5}
       L ${SIZE * 0.15} ${-SIZE * 0.55}
       L ${SIZE * 0.2} ${-SIZE * 0.35}
       L ${-SIZE * 0.05} ${-SIZE * 0.3} Z
       M ${-SIZE * 0.4} ${-SIZE * 0.45}
       L ${-SIZE * 0.2} ${-SIZE * 0.5}
       L ${-SIZE * 0.15} ${-SIZE * 0.35}
       L ${-SIZE * 0.35} ${-SIZE * 0.3} Z`
    );
    // Smoke stacks (twin)
    this.cachedPaths['scavenger_4_stacks'] = [
      { x: -SIZE * 0.5, y: -SIZE * 0.45 },
      { x: -SIZE * 0.5, y: SIZE * 0.45 }
    ];

    // Variant 5: Barnacle King - Junkyard leviathan, nightmare of fused wreckage
    // Central core under layers of salvaged hulls, boring drill, multiple smoke stacks
    this.cachedPaths['scavenger_5'] = new Path2D(
      // Massive chaotic body shape
      `M ${SIZE * 1.0} 0
       L ${SIZE * 0.8} ${-SIZE * 0.4}
       L ${SIZE * 0.4} ${-SIZE * 0.7}
       L ${-SIZE * 0.1} ${-SIZE * 0.85}
       L ${-SIZE * 0.5} ${-SIZE * 0.8}
       L ${-SIZE * 0.8} ${-SIZE * 0.5}
       L ${-SIZE * 0.95} ${-SIZE * 0.2}
       L ${-SIZE * 0.95} ${SIZE * 0.2}
       L ${-SIZE * 0.8} ${SIZE * 0.5}
       L ${-SIZE * 0.5} ${SIZE * 0.8}
       L ${-SIZE * 0.1} ${SIZE * 0.85}
       L ${SIZE * 0.4} ${SIZE * 0.7}
       L ${SIZE * 0.8} ${SIZE * 0.4} Z`
    );
    // Boring drill assembly (massive spiral drill)
    this.cachedAccents['scavenger_5'] = new Path2D(
      `M ${SIZE * 1.0} ${-SIZE * 0.2}
       L ${SIZE * 1.3} ${-SIZE * 0.3}
       L ${SIZE * 1.5} ${-SIZE * 0.2}
       L ${SIZE * 1.6} 0
       L ${SIZE * 1.5} ${SIZE * 0.2}
       L ${SIZE * 1.3} ${SIZE * 0.3}
       L ${SIZE * 1.0} ${SIZE * 0.2}
       L ${SIZE * 1.05} 0 Z`
    );
    // Multiple smoke stacks (3-4 constantly emitting)
    this.cachedPaths['scavenger_5_stacks'] = [
      { x: -SIZE * 0.6, y: -SIZE * 0.55 },
      { x: -SIZE * 0.7, y: -SIZE * 0.3 },
      { x: -SIZE * 0.7, y: SIZE * 0.3 },
      { x: -SIZE * 0.6, y: SIZE * 0.55 }
    ];
    // Welded-on ship parts from different factions (debris layer)
    this.cachedPaths['scavenger_5_debris'] = new Path2D(
      // Random ship hull fragments welded on
      `M ${SIZE * 0.2} ${-SIZE * 0.65}
       L ${SIZE * 0.35} ${-SIZE * 0.7}
       L ${SIZE * 0.4} ${-SIZE * 0.55}
       L ${SIZE * 0.25} ${-SIZE * 0.5} Z
       M ${-SIZE * 0.3} ${-SIZE * 0.7}
       L ${-SIZE * 0.15} ${-SIZE * 0.75}
       L ${-SIZE * 0.1} ${-SIZE * 0.6}
       L ${-SIZE * 0.25} ${-SIZE * 0.55} Z
       M ${SIZE * 0.5} ${-SIZE * 0.5}
       L ${SIZE * 0.65} ${-SIZE * 0.45}
       L ${SIZE * 0.6} ${-SIZE * 0.3}
       L ${SIZE * 0.45} ${-SIZE * 0.35} Z`
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
  draw(ctx, position, rotation, npcType, faction, screenPos, time, npc) {
    // Use special spider visuals for swarm queen
    if (npcType === 'swarm_queen' && typeof QueenVisuals !== 'undefined') {
      // Pass world position for eye tracking
      QueenVisuals.draw(ctx, screenPos.x, screenPos.y, rotation, time || Date.now(), null, position);
      return;
    }

    // Use special rendering for Barnacle King
    if (npcType === 'scavenger_barnacle_king') {
      this.drawBarnacleKing(ctx, screenPos, rotation, time || Date.now(), npc);
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

    // Draw golden shield aura BEFORE ship for rogue miners (renders behind)
    if (actualFaction === 'rogue_miner' && npc) {
      this.drawGoldenShieldAura(ctx, screenPos, scale, npc, time);
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

    // Special Scavenger rendering: grimy junkyard effects
    if (actualFaction === 'scavenger') {
      this.drawScavengerEffects(ctx, variant, variantNum, colors, time, npc);
    }

    // Special Rogue Miner rendering: ore veins, drill glow, industrial accents
    if (actualFaction === 'rogue_miner') {
      this.drawRogueMinerShipEffects(ctx, variant, variantNum, colors, time, npc);
    }

    ctx.restore();

    // Draw rage indicators AFTER restore (in screen space) for all scavengers
    if (actualFaction === 'scavenger' && npc && npc.state === 'enraged') {
      const effectSize = this.SIZE * scale;
      this.drawScavengerRageEffects(ctx, screenPos, effectSize, time);
    }

    // Draw rage indicators for rogue miners
    if (actualFaction === 'rogue_miner' && npc && npc.state === 'enraged') {
      const effectSize = this.SIZE * scale;
      this.drawRogueMinerRageEffects(ctx, screenPos, effectSize, time);
    }
  },

  /**
   * Draw grimy junkyard effects for scavenger ships
   */
  drawScavengerEffects(ctx, variant, variantNum, colors, time, npc) {
    const SIZE = this.SIZE;

    // Draw mismatched panels (different color patches)
    if (variant === 'scavenger_1' && this.cachedPaths['scavenger_1_patch']) {
      ctx.fillStyle = colors.dirtyYellow;
      ctx.fill(this.cachedPaths['scavenger_1_patch']);
    }

    // Draw armor plates for salvager
    if (variant === 'scavenger_2' && this.cachedPaths['scavenger_2_armor']) {
      ctx.fillStyle = colors.grimySteel;
      ctx.fill(this.cachedPaths['scavenger_2_armor']);
      ctx.strokeStyle = colors.weldGlow;
      ctx.lineWidth = 0.5;
      ctx.stroke(this.cachedPaths['scavenger_2_armor']);
    }

    // Draw grinder teeth and tanks for collector
    if (variant === 'scavenger_3') {
      // Grinder teeth
      if (this.cachedPaths['scavenger_3_teeth']) {
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1.5;
        ctx.stroke(this.cachedPaths['scavenger_3_teeth']);
      }
      // Storage tanks
      const tanks = this.cachedPaths['scavenger_3_tanks'];
      if (tanks) {
        tanks.forEach(tank => {
          // Rusty tank
          ctx.fillStyle = colors.rust;
          ctx.fillRect(tank.x, tank.y, tank.w, tank.h);
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(tank.x, tank.y, tank.w, tank.h);
        });
      }
    }

    // Draw cargo containers for hauler
    if (variant === 'scavenger_4') {
      if (this.cachedPaths['scavenger_4_cargo']) {
        ctx.fillStyle = colors.dirtyYellow;
        ctx.fill(this.cachedPaths['scavenger_4_cargo']);
        ctx.strokeStyle = colors.weldGlow;
        ctx.lineWidth = 0.8;
        ctx.stroke(this.cachedPaths['scavenger_4_cargo']);
      }
      // Draw smoke stacks
      const stacks = this.cachedPaths['scavenger_4_stacks'];
      if (stacks) {
        stacks.forEach(stack => {
          ctx.fillStyle = colors.grimySteel;
          ctx.fillRect(stack.x - SIZE * 0.04, stack.y - SIZE * 0.1, SIZE * 0.08, SIZE * 0.2);
          ctx.strokeStyle = colors.oilStain;
          ctx.lineWidth = 1;
          ctx.strokeRect(stack.x - SIZE * 0.04, stack.y - SIZE * 0.1, SIZE * 0.08, SIZE * 0.2);
        });
      }
    }

    // Add rust patches to all scavengers
    this.drawRustPatches(ctx, SIZE, variantNum, colors);

    // Add weld lines
    this.drawWeldLines(ctx, SIZE, variantNum, colors);

    // Add rivets
    this.drawRivets(ctx, SIZE, variantNum, colors);
  },

  /**
   * Draw rust patches on scavenger ships
   */
  drawRustPatches(ctx, SIZE, variantNum, colors) {
    const patchCount = variantNum + 1;
    ctx.fillStyle = colors.rust;

    for (let i = 0; i < patchCount; i++) {
      const angle = (i / patchCount) * Math.PI * 2 + 0.5;
      const dist = SIZE * (0.15 + i * 0.08);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const patchSize = SIZE * (0.08 + Math.random() * 0.04);

      ctx.beginPath();
      ctx.ellipse(x, y, patchSize, patchSize * 0.6, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Draw weld lines on scavenger ships (orange glow lines along seams)
   */
  drawWeldLines(ctx, SIZE, variantNum, colors) {
    ctx.strokeStyle = colors.weldGlow;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.7;

    // Horizontal weld lines
    ctx.beginPath();
    ctx.moveTo(-SIZE * 0.3, -SIZE * 0.15);
    ctx.lineTo(SIZE * 0.2, -SIZE * 0.15);
    ctx.moveTo(-SIZE * 0.25, SIZE * 0.2);
    ctx.lineTo(SIZE * 0.15, SIZE * 0.2);
    ctx.stroke();

    // Vertical weld line
    if (variantNum >= 2) {
      ctx.beginPath();
      ctx.moveTo(SIZE * 0.1, -SIZE * 0.25);
      ctx.lineTo(SIZE * 0.1, SIZE * 0.25);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Draw rivets on scavenger ships
   */
  drawRivets(ctx, SIZE, variantNum, colors) {
    const rivetCount = 4 + variantNum * 2;
    ctx.fillStyle = '#333333';

    for (let i = 0; i < rivetCount; i++) {
      const angle = (i / rivetCount) * Math.PI * 2;
      const dist = SIZE * 0.25;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;

      ctx.beginPath();
      ctx.arc(x, y, SIZE * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Draw rage visual effects for ALL scavenger ships (not just Barnacle King)
   * Called in screen space (after ctx.restore)
   */
  drawScavengerRageEffects(ctx, screenPos, SIZE, time) {
    const pulsePhase = (Math.sin(time * 0.008) + 1) / 2;

    // Red warning glow around ship
    ctx.save();
    const glowRadius = SIZE * 1.5;
    const glowGradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, SIZE * 0.3,
      screenPos.x, screenPos.y, glowRadius
    );
    glowGradient.addColorStop(0, `rgba(255, 50, 0, ${0.3 + pulsePhase * 0.2})`);
    glowGradient.addColorStop(0.5, `rgba(255, 0, 0, ${0.15 + pulsePhase * 0.1})`);
    glowGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rotating red warning beacon on top
    const beaconY = screenPos.y - SIZE * 0.8;
    const beaconSize = SIZE * 0.15;
    const rotationAngle = time * 0.005;

    // Beacon sweep
    ctx.globalAlpha = 0.5 + pulsePhase * 0.3;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(screenPos.x, beaconY, beaconSize, rotationAngle, rotationAngle + Math.PI * 0.5);
    ctx.lineTo(screenPos.x, beaconY);
    ctx.fill();

    // Beacon core
    ctx.globalAlpha = 0.8 + pulsePhase * 0.2;
    const beaconGradient = ctx.createRadialGradient(
      screenPos.x, beaconY, 0,
      screenPos.x, beaconY, beaconSize * 0.8
    );
    beaconGradient.addColorStop(0, '#ffffff');
    beaconGradient.addColorStop(0.3, '#ff0000');
    beaconGradient.addColorStop(1, '#880000');
    ctx.fillStyle = beaconGradient;
    ctx.beginPath();
    ctx.arc(screenPos.x, beaconY, beaconSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Steam particles venting from sides
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#cccccc';
    for (let i = 0; i < 3; i++) {
      const steamOffset = ((time * 0.003 + i * 100) % 30);
      const steamX = screenPos.x + (i % 2 === 0 ? -1 : 1) * SIZE * 0.6;
      const steamY = screenPos.y - steamOffset;
      const steamSize = SIZE * 0.08 * (1 - steamOffset / 30);

      ctx.beginPath();
      ctx.arc(steamX, steamY, steamSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  /**
   * Draw the Barnacle King - junkyard leviathan, nightmare of fused wreckage
   */
  drawBarnacleKing(ctx, screenPos, rotation, time, npc) {
    const SIZE = this.SIZE * 10; // 200 units total (20 * 10)
    const colors = this.FACTION_COLORS.scavenger;
    const isEnraged = npc && npc.state === 'enraged';

    // Determine if moving (for drill spin and smoke)
    let isMoving = false;
    if (npc && npc.targetPosition && npc.position) {
      const dx = npc.targetPosition.x - npc.position.x;
      const dy = npc.targetPosition.y - npc.position.y;
      isMoving = Math.sqrt(dx * dx + dy * dy) > 2;
    }

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(rotation);

    // Outer glow (more intense when enraged, rust-colored normally)
    const glowRadius = SIZE * 0.7;
    const gradient = ctx.createRadialGradient(0, 0, SIZE * 0.2, 0, 0, glowRadius);
    gradient.addColorStop(0, isEnraged ? '#ff220050' : colors.glow);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = isEnraged ? 0.8 : 0.4;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Main body (chaotic junkyard hull)
    const bodyPath = this.cachedPaths['scavenger_5'];
    ctx.fillStyle = colors.hull;
    ctx.fill(bodyPath);
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke(bodyPath);

    // Welded-on ship fragments from other factions (debris layer)
    const debrisPath = this.cachedPaths['scavenger_5_debris'];
    if (debrisPath) {
      // Draw each fragment in slightly different colors
      ctx.fillStyle = colors.dirtyYellow;
      ctx.fill(debrisPath);
      ctx.strokeStyle = colors.weldGlow;
      ctx.lineWidth = 1;
      ctx.stroke(debrisPath);
    }

    // Massive rust patches covering hull
    this.drawBarnacleKingRust(ctx, SIZE, colors, time);

    // Steel armor panels
    ctx.fillStyle = colors.grimySteel;
    ctx.fillRect(-SIZE * 0.5, -SIZE * 0.35, SIZE * 0.25, SIZE * 0.7);
    ctx.fillRect(-SIZE * 0.15, -SIZE * 0.45, SIZE * 0.35, SIZE * 0.9);

    // Weld seams (orange glow lines)
    ctx.strokeStyle = colors.weldGlow;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-SIZE * 0.5, -SIZE * 0.35);
    ctx.lineTo(-SIZE * 0.5, SIZE * 0.35);
    ctx.moveTo(-SIZE * 0.15, -SIZE * 0.45);
    ctx.lineTo(-SIZE * 0.15, SIZE * 0.45);
    ctx.moveTo(SIZE * 0.2, -SIZE * 0.45);
    ctx.lineTo(SIZE * 0.2, SIZE * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Copper/rusty piping network
    ctx.strokeStyle = colors.copper;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-SIZE * 0.6, -SIZE * 0.25);
    ctx.lineTo(SIZE * 0.25, -SIZE * 0.25);
    ctx.moveTo(-SIZE * 0.6, SIZE * 0.25);
    ctx.lineTo(SIZE * 0.25, SIZE * 0.25);
    ctx.moveTo(-SIZE * 0.4, -SIZE * 0.4);
    ctx.lineTo(-SIZE * 0.4, SIZE * 0.4);
    ctx.stroke();

    // Boring drill on front (spins when moving or enraged)
    const drillPath = this.cachedAccents['scavenger_5'];
    const drillSpin = (isMoving || isEnraged) ? time * 0.008 : 0;
    ctx.save();
    ctx.translate(SIZE * 0.7, 0);
    ctx.rotate(drillSpin);

    // Drill body
    ctx.fillStyle = colors.grimySteel;
    ctx.fill(drillPath);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.stroke(drillPath);

    // Spiral grooves on drill
    ctx.strokeStyle = colors.oilStain;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const spiralAngle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(spiralAngle) * SIZE * 0.08, Math.sin(spiralAngle) * SIZE * 0.08);
      ctx.lineTo(Math.cos(spiralAngle + 0.5) * SIZE * 0.2, Math.sin(spiralAngle + 0.5) * SIZE * 0.2);
      ctx.stroke();
    }

    // Drill teeth (sharper, industrial)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * SIZE * 0.15;
      const y = Math.sin(angle) * SIZE * 0.15;
      ctx.fillStyle = '#aaaaaa';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * SIZE * 0.1, y + Math.sin(angle) * SIZE * 0.1);
      ctx.lineTo(x + Math.cos(angle + 0.15) * SIZE * 0.07, y + Math.sin(angle + 0.15) * SIZE * 0.07);
      ctx.closePath();
      ctx.fill();
    }

    // Heat glow from drill center (when active)
    if (isMoving || isEnraged) {
      const heatGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, SIZE * 0.1);
      heatGlow.addColorStop(0, isEnraged ? '#ff4400' : '#ff660080');
      heatGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = heatGlow;
      ctx.beginPath();
      ctx.arc(0, 0, SIZE * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Tracked wheels (treads)
    this.drawTracks(ctx, SIZE, colors, time, npc, isMoving);

    // Multiple smoke stacks (4 total)
    const stacks = this.cachedPaths['scavenger_5_stacks'];
    if (stacks) {
      stacks.forEach((stack, idx) => {
        // Stack base
        ctx.fillStyle = colors.grimySteel;
        ctx.fillRect(stack.x - SIZE * 0.025, stack.y - SIZE * 0.06, SIZE * 0.05, SIZE * 0.12);
        ctx.strokeStyle = colors.oilStain;
        ctx.lineWidth = 1;
        ctx.strokeRect(stack.x - SIZE * 0.025, stack.y - SIZE * 0.06, SIZE * 0.05, SIZE * 0.12);

        // Rust on stack top
        ctx.fillStyle = colors.rust;
        ctx.fillRect(stack.x - SIZE * 0.03, stack.y - SIZE * 0.07, SIZE * 0.06, SIZE * 0.02);
      });
    }

    // Faded warning stripes (peeling, grimy)
    ctx.strokeStyle = '#00000080';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const x = -SIZE * 0.25 + i * SIZE * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, -SIZE * 0.5);
      ctx.lineTo(x + SIZE * 0.06, -SIZE * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, SIZE * 0.5);
      ctx.lineTo(x + SIZE * 0.06, SIZE * 0.4);
      ctx.stroke();
    }

    // Chains and cables hanging (decorative)
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Chain 1
    ctx.moveTo(-SIZE * 0.3, -SIZE * 0.6);
    ctx.quadraticCurveTo(-SIZE * 0.35, -SIZE * 0.7, -SIZE * 0.25, -SIZE * 0.75);
    // Chain 2
    ctx.moveTo(SIZE * 0.1, -SIZE * 0.65);
    ctx.quadraticCurveTo(SIZE * 0.05, -SIZE * 0.75, SIZE * 0.15, -SIZE * 0.8);
    ctx.stroke();

    // Rivets around hull
    ctx.fillStyle = '#333333';
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = SIZE * 0.5;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(x, y, SIZE * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Draw rage indicators if enraged (use unified rage effect system)
    if (isEnraged) {
      this.drawScavengerRageEffects(ctx, screenPos, SIZE, time);
    }
  },

  /**
   * Draw massive rust patches for Barnacle King
   */
  drawBarnacleKingRust(ctx, SIZE, colors, time) {
    ctx.fillStyle = colors.rust;

    // Large rust patches at strategic locations
    const rustSpots = [
      { x: -SIZE * 0.3, y: -SIZE * 0.5, r: SIZE * 0.12 },
      { x: SIZE * 0.2, y: -SIZE * 0.45, r: SIZE * 0.1 },
      { x: -SIZE * 0.5, y: SIZE * 0.2, r: SIZE * 0.15 },
      { x: SIZE * 0.1, y: SIZE * 0.5, r: SIZE * 0.11 },
      { x: -SIZE * 0.1, y: -SIZE * 0.3, r: SIZE * 0.08 },
      { x: SIZE * 0.35, y: SIZE * 0.25, r: SIZE * 0.09 },
    ];

    rustSpots.forEach(spot => {
      ctx.beginPath();
      ctx.ellipse(spot.x, spot.y, spot.r, spot.r * 0.7, Math.PI * 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  /**
   * Draw tracked wheels/treads for Barnacle King
   */
  drawTracks(ctx, SIZE, colors, time, npc, isMoving) {
    const trackY = SIZE * 0.5;
    const trackLength = SIZE * 1.5;
    const trackHeight = SIZE * 0.12;
    const moveOffset = isMoving ? (time * 0.003) % (SIZE * 0.15) : 0;
    const segmentWidth = SIZE * 0.12;
    const segmentGap = SIZE * 0.15;

    [-trackY, trackY].forEach(y => {
      // Track base (dark, grimy)
      ctx.fillStyle = colors.oilStain;
      ctx.fillRect(-SIZE * 0.75, y - trackHeight / 2, trackLength, trackHeight);

      // Track outline
      ctx.strokeStyle = colors.grimySteel;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-SIZE * 0.75, y - trackHeight / 2, trackLength, trackHeight);

      // Track segments (moving treads)
      ctx.fillStyle = colors.grimySteel;
      const segmentCount = Math.ceil(trackLength / segmentGap) + 2;
      for (let i = -1; i < segmentCount; i++) {
        const baseX = -SIZE * 0.75 + i * segmentGap + moveOffset;
        // Wrap around
        const x = baseX > SIZE * 0.75 ? baseX - trackLength : baseX;
        if (x < -SIZE * 0.8 || x > SIZE * 0.75) continue;
        ctx.fillRect(x, y - trackHeight / 2 + 1, segmentWidth, trackHeight - 2);
      }

      // Rust on tracks
      ctx.fillStyle = colors.rust + '60';
      ctx.fillRect(-SIZE * 0.6, y - trackHeight / 2, SIZE * 0.2, trackHeight);
      ctx.fillRect(SIZE * 0.3, y - trackHeight / 2, SIZE * 0.15, trackHeight);
    });
  },

  /**
   * Draw rage visual indicators (steam vents and warning light)
   */
  drawRageIndicators(ctx, screenPos, SIZE, time) {
    // Swirling red warning light on top
    const pulsePhase = (Math.sin(time * 0.008) + 1) / 2;
    const lightX = screenPos.x;
    const lightY = screenPos.y - SIZE * 0.4;

    ctx.save();
    ctx.globalAlpha = 0.7 + pulsePhase * 0.3;

    // Warning light glow
    const lightGradient = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, SIZE * 0.15);
    lightGradient.addColorStop(0, '#ff0000');
    lightGradient.addColorStop(0.5, '#ff000080');
    lightGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = lightGradient;
    ctx.beginPath();
    ctx.arc(lightX, lightY, SIZE * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Rotating beam
    ctx.strokeStyle = '#ff000080';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const beamAngle = time * 0.005;
    ctx.moveTo(lightX, lightY);
    ctx.lineTo(
      lightX + Math.cos(beamAngle) * SIZE * 0.3,
      lightY + Math.sin(beamAngle) * SIZE * 0.3
    );
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw Rogue Miner-specific effects: ore veins, drill glow, industrial accents
   * Gives mining ships their distinctive industrial/mining appearance
   */
  drawRogueMinerShipEffects(ctx, variant, variantNum, colors, time, npc) {
    const SIZE = this.SIZE;
    const currentTime = time || Date.now();
    const pulsePhase = (Math.sin(currentTime * 0.004) + 1) / 2; // 0-1 pulsing

    // Draw pulsing ore vein lines (golden/amber) on all variants
    ctx.strokeStyle = `rgba(255, 200, 50, ${0.3 + pulsePhase * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    if (variant === 'rogue_1') {
      // Prospector: Scanner probe accent with pulsing tip
      ctx.beginPath();
      ctx.moveTo(SIZE * 0.6, -SIZE * 0.2);
      ctx.lineTo(SIZE * 0.8, -SIZE * 0.35);
      ctx.stroke();

      // Scanning light
      const scanPulse = (Math.sin(currentTime * 0.008) + 1) / 2;
      ctx.fillStyle = `rgba(100, 255, 100, ${0.4 + scanPulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(SIZE * 0.8, -SIZE * 0.35, 3 + scanPulse * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (variant === 'rogue_2') {
      // Driller: Glowing drill bit
      const drillGlow = (Math.sin(currentTime * 0.01) + 1) / 2;
      const drillGradient = ctx.createRadialGradient(
        SIZE * 0.85, 0, 0,
        SIZE * 0.85, 0, SIZE * 0.25
      );
      drillGradient.addColorStop(0, `rgba(255, 150, 50, ${0.6 + drillGlow * 0.3})`);
      drillGradient.addColorStop(0.5, `rgba(255, 100, 0, ${0.3 + drillGlow * 0.2})`);
      drillGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = drillGradient;
      ctx.beginPath();
      ctx.arc(SIZE * 0.85, 0, SIZE * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Ore chunk attached to side
      ctx.fillStyle = `rgba(180, 140, 60, ${0.8})`;
      ctx.beginPath();
      ctx.moveTo(-SIZE * 0.3, -SIZE * 0.45);
      ctx.lineTo(-SIZE * 0.15, -SIZE * 0.5);
      ctx.lineTo(-SIZE * 0.2, -SIZE * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    if (variant === 'rogue_3') {
      // Excavator: Heavy bucket scoop outline, warning stripes glow
      const warningPulse = (Math.sin(currentTime * 0.006) + 1) / 2;

      // Warning stripe glow
      ctx.strokeStyle = `rgba(255, 200, 0, ${0.2 + warningPulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-SIZE * 0.1, -SIZE * 0.5);
      ctx.lineTo(-SIZE * 0.1, SIZE * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(SIZE * 0.1, -SIZE * 0.5);
      ctx.lineTo(SIZE * 0.1, SIZE * 0.5);
      ctx.stroke();

      // Bucket scoop accent at front
      ctx.strokeStyle = `rgba(150, 150, 150, 0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(SIZE * 0.7, 0, SIZE * 0.2, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }

    if (variant === 'rogue_4') {
      // Foreman: Command bridge highlight, supervisor badge
      const badgePulse = (Math.sin(currentTime * 0.005) + 1) / 2;

      // Bridge glow
      const bridgeGlow = ctx.createRadialGradient(
        SIZE * 0.2, 0, 0,
        SIZE * 0.2, 0, SIZE * 0.3
      );
      bridgeGlow.addColorStop(0, `rgba(255, 215, 100, ${0.4 + badgePulse * 0.3})`);
      bridgeGlow.addColorStop(1, 'transparent');

      ctx.fillStyle = bridgeGlow;
      ctx.beginPath();
      ctx.arc(SIZE * 0.2, 0, SIZE * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Supervisor badge (star shape)
      ctx.fillStyle = `rgba(255, 215, 0, ${0.7 + badgePulse * 0.3})`;
      ctx.beginPath();
      const badgeX = -SIZE * 0.5;
      const badgeY = -SIZE * 0.3;
      const badgeSize = 5;
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const x = badgeX + Math.cos(angle) * badgeSize;
        const y = badgeY + Math.sin(angle) * badgeSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Second badge on other side
      ctx.beginPath();
      const badge2Y = SIZE * 0.3;
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const x = badgeX + Math.cos(angle) * badgeSize;
        const y = badge2Y + Math.sin(angle) * badgeSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Add ore sparkles for all variants when they have cargo (just returned from mining)
    if (npc && npc.state === 'returning') {
      const sparkleCount = Math.min(variantNum + 1, 4);
      ctx.fillStyle = `rgba(255, 220, 100, ${0.5 + pulsePhase * 0.4})`;
      for (let i = 0; i < sparkleCount; i++) {
        const angle = currentTime * 0.002 + (i * Math.PI * 2 / sparkleCount);
        const dist = SIZE * 0.3;
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
  },

  // ============================================================================
  // ROGUE MINER VISUAL EFFECTS
  // ============================================================================

  /**
   * Draw golden shield aura for rogue miner NPCs
   * Pulsing golden glow that fades as shields deplete
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} screenPos - Screen position {x, y}
   * @param {number} scale - Ship scale multiplier
   * @param {Object} npc - NPC data with shield/shieldMax
   * @param {number} time - Current timestamp for animations
   */
  drawGoldenShieldAura(ctx, screenPos, scale, npc, time) {
    if (!npc || !npc.shieldMax || npc.shieldMax <= 0) return;

    const shieldPercent = Math.max(0, npc.shield / npc.shieldMax);
    if (shieldPercent <= 0) return;

    const SIZE = this.SIZE * scale;
    const baseRadius = SIZE * 1.8;

    // Pulsing animation - faster pulse when shields are full
    const pulseSpeed = 2 + shieldPercent * 2;
    const pulse = 0.7 + Math.sin(time * 0.001 * pulseSpeed) * 0.3;

    // Aura intensity based on shield percentage
    const intensity = shieldPercent * pulse;

    ctx.save();

    // Outer glow layer - golden radial gradient
    const outerGradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, SIZE * 0.5,
      screenPos.x, screenPos.y, baseRadius * (1 + pulse * 0.1)
    );
    outerGradient.addColorStop(0, `rgba(255, 215, 0, ${intensity * 0.15})`);    // Gold
    outerGradient.addColorStop(0.5, `rgba(255, 180, 0, ${intensity * 0.1})`);   // Deeper gold
    outerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, baseRadius * (1 + pulse * 0.1), 0, Math.PI * 2);
    ctx.fill();

    // Inner shield ring (more visible when shields are >30%)
    if (shieldPercent > 0.3) {
      const ringRadius = SIZE * 1.3;
      const ringPulse = 0.8 + Math.sin(time * 0.003 + 0.5) * 0.2;

      ctx.strokeStyle = `rgba(255, 200, 50, ${intensity * 0.4})`;
      ctx.lineWidth = 2 + shieldPercent * 2;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ringRadius * ringPulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sparkle particles when shields are >70%
    if (shieldPercent > 0.7) {
      const sparkleCount = Math.floor(shieldPercent * 5);
      ctx.fillStyle = `rgba(255, 255, 200, ${intensity * 0.8})`;
      for (let i = 0; i < sparkleCount; i++) {
        const angle = (time * 0.0005 + i * Math.PI * 2 / sparkleCount) % (Math.PI * 2);
        const sparkleRadius = SIZE * 1.4;
        const sx = screenPos.x + Math.cos(angle) * sparkleRadius;
        const sy = screenPos.y + Math.sin(angle) * sparkleRadius;

        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },

  /**
   * Draw mining laser beam for rogue miner NPCs when they're mining
   * Orange/gold colored beam similar to player tractor beam
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} screenPos - NPC screen position {x, y}
   * @param {Object} npc - NPC data with miningTargetPos
   * @param {Object} camera - Camera position for target conversion
   * @param {number} time - Current timestamp for animations
   */
  drawMiningBeam(ctx, screenPos, npc, camera, time) {
    if (!npc || !npc.miningTargetPos) return;

    // Convert target world position to screen position
    const targetScreen = {
      x: npc.miningTargetPos.x - camera.x,
      y: npc.miningTargetPos.y - camera.y
    };

    // Calculate beam intensity (could be based on mining progress if available)
    const intensity = 0.7 + Math.sin(time * 0.005) * 0.2;
    const pulseWidth = 1 + Math.sin(time * 0.008) * 0.2;

    // Calculate beam length for particle positioning
    const beamDx = targetScreen.x - screenPos.x;
    const beamDy = targetScreen.y - screenPos.y;
    const beamLength = Math.sqrt(beamDx * beamDx + beamDy * beamDy);

    ctx.save();

    // Outer glow layer (new - makes beam more visible)
    const outerGlowGradient = ctx.createLinearGradient(
      screenPos.x, screenPos.y,
      targetScreen.x, targetScreen.y
    );
    outerGlowGradient.addColorStop(0, `rgba(255, 150, 0, ${intensity * 0.3})`);
    outerGlowGradient.addColorStop(0.5, `rgba(255, 120, 0, ${intensity * 0.4})`);
    outerGlowGradient.addColorStop(1, `rgba(255, 180, 50, ${intensity * 0.25})`);

    ctx.strokeStyle = outerGlowGradient;
    ctx.lineWidth = 14 * pulseWidth * intensity;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5;

    ctx.beginPath();
    ctx.moveTo(screenPos.x, screenPos.y);
    ctx.lineTo(targetScreen.x, targetScreen.y);
    ctx.stroke();

    // Orange/gold beam gradient (main beam - thicker)
    const gradient = ctx.createLinearGradient(
      screenPos.x, screenPos.y,
      targetScreen.x, targetScreen.y
    );
    gradient.addColorStop(0, `rgba(255, 180, 0, ${intensity * 0.8})`);
    gradient.addColorStop(0.5, `rgba(255, 140, 0, ${intensity})`);
    gradient.addColorStop(1, `rgba(255, 200, 50, ${intensity * 0.6})`);

    // Main beam (thicker: 6 -> 8)
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 8 * pulseWidth * intensity;
    ctx.globalAlpha = intensity * 0.9;

    ctx.beginPath();
    ctx.moveTo(screenPos.x, screenPos.y);
    ctx.lineTo(targetScreen.x, targetScreen.y);
    ctx.stroke();

    // Core beam (brighter white center)
    ctx.strokeStyle = `rgba(255, 255, 200, ${intensity * 0.7})`;
    ctx.lineWidth = 3 * pulseWidth;
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Energy particles along beam length
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
      // Animate particles flowing from source to target
      const baseT = (i / particleCount);
      const animOffset = (time * 0.002) % 1;
      const t = (baseT + animOffset) % 1;

      const px = screenPos.x + beamDx * t;
      const py = screenPos.y + beamDy * t;

      // Particle size varies
      const particleSize = 2 + Math.sin(time * 0.01 + i) * 1;

      // Bright yellow-orange particles
      const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize * 2);
      particleGradient.addColorStop(0, `rgba(255, 255, 150, ${intensity})`);
      particleGradient.addColorStop(0.5, `rgba(255, 200, 50, ${intensity * 0.7})`);
      particleGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = particleGradient;
      ctx.beginPath();
      ctx.arc(px, py, particleSize * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Terminus glow at target (larger: 8 -> 12)
    const terminusRadius = 12 * (1 + Math.sin(time * 0.004) * 0.3);
    const terminusGradient = ctx.createRadialGradient(
      targetScreen.x, targetScreen.y, 0,
      targetScreen.x, targetScreen.y, terminusRadius
    );
    terminusGradient.addColorStop(0, `rgba(255, 220, 100, ${intensity})`);
    terminusGradient.addColorStop(0.4, `rgba(255, 180, 0, ${intensity * 0.7})`);
    terminusGradient.addColorStop(0.7, `rgba(255, 140, 0, ${intensity * 0.4})`);
    terminusGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = terminusGradient;
    ctx.beginPath();
    ctx.arc(targetScreen.x, targetScreen.y, terminusRadius, 0, Math.PI * 2);
    ctx.fill();

    // Particle sparks at terminus (more sparks)
    const sparkCount = 5;
    ctx.fillStyle = `rgba(255, 200, 50, ${intensity})`;
    for (let i = 0; i < sparkCount; i++) {
      const angle = time * 0.003 + (i * Math.PI * 2 / sparkCount);
      const sparkDist = terminusRadius * 0.8;
      const sx = targetScreen.x + Math.cos(angle) * sparkDist;
      const sy = targetScreen.y + Math.sin(angle) * sparkDist;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Source glow (new - makes beam origin visible too)
    const sourceRadius = 6 * (1 + Math.sin(time * 0.006) * 0.2);
    const sourceGradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, sourceRadius
    );
    sourceGradient.addColorStop(0, `rgba(255, 200, 100, ${intensity * 0.8})`);
    sourceGradient.addColorStop(0.6, `rgba(255, 150, 0, ${intensity * 0.4})`);
    sourceGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = sourceGradient;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, sourceRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Draw rage visual effects for rogue miners (unified with scavenger rage system)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} screenPos - Screen position {x, y}
   * @param {number} SIZE - Ship size for scaling
   * @param {number} time - Current timestamp for animations
   */
  drawRogueMinerRageEffects(ctx, screenPos, SIZE, time) {
    // Red/orange pulsing warning ring
    const pulsePhase = (Math.sin(time * 0.008) + 1) / 2;
    const rageRadius = SIZE * 1.2;

    ctx.save();

    // Pulsing red/orange glow
    const rageGradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, SIZE * 0.5,
      screenPos.x, screenPos.y, rageRadius * (1 + pulsePhase * 0.2)
    );
    rageGradient.addColorStop(0, 'rgba(255, 50, 0, 0.4)');
    rageGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)');
    rageGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = rageGradient;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, rageRadius * (1 + pulsePhase * 0.2), 0, Math.PI * 2);
    ctx.fill();

    // Warning ring
    ctx.strokeStyle = `rgba(255, 80, 0, ${0.4 + pulsePhase * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, SIZE * 1.1, 0, Math.PI * 2);
    ctx.stroke();

    // Small rage indicator above ship
    const indicatorY = screenPos.y - SIZE - 10;
    ctx.fillStyle = `rgba(255, 50, 0, ${0.6 + pulsePhase * 0.4})`;
    ctx.beginPath();
    ctx.arc(screenPos.x, indicatorY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
};
