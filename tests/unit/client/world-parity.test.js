import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Physics = require('../../../shared/physics');
const SharedStarSystem = require('../../../shared/star-system');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');

function makeSystem() {
  const id = 'ss_9_-8_0';
  const primaryStar = {
    id: `${id}_star`,
    x: 100,
    y: 100,
    size: 80,
    mass: 100
  };
  const binaryInfo = {
    secondaryStar: {
      id: `${id}_star_b`,
      x: 250,
      y: 100,
      size: 50,
      mass: 50
    },
    baryCenter: { x: 100, y: 100 },
    eccentricity: 0.2,
    orbitPeriod: 150,
    orbitPhase: 0.4,
    primaryOrbitRadius: 60,
    secondaryOrbitRadius: 120
  };
  const planet = {
    id: `${id}_planet_0`,
    x: 400,
    y: 100,
    size: 20,
    orbitRadius: 300,
    orbitAngle: 0.25,
    orbitSpeed: 0.002,
    starId: primaryStar.id
  };
  const base = {
    id: `${id}_base_pirate_outpost`,
    type: 'pirate_outpost',
    faction: 'pirate',
    x: 500,
    y: 100,
    size: 30,
    orbitRadius: 400,
    orbitAngle: 0.5,
    orbitSpeed: 0.001,
    starId: primaryStar.id,
    starX: primaryStar.x,
    starY: primaryStar.y
  };
  const comet = {
    id: `${id}_comet_0`,
    size: 20,
    tailLengthFactor: 2,
    entryPoint: { x: -200, y: 100 },
    perihelion: { x: 500, y: 500 },
    exitPoint: { x: 1200, y: 100 },
    orbitPeriod: 100000,
    phaseOffset: 0,
    warningTime: 1000,
    traversalTime: 10000,
    starId: primaryStar.id
  };

  return {
    id,
    primaryStar,
    binaryInfo,
    influenceRadius: 2000,
    exclusionRadius: 100,
    asteroidBelts: [],
    planets: [planet],
    bases: [base],
    miningClaimObjects: [],
    wormholes: [],
    comets: [comet]
  };
}

function loadWorld(system, fixedTime = 543210) {
  const browserPhysics = {
    ...Physics,
    getOrbitTime: () => fixedTime,
    getPhysicsTime: () => fixedTime
  };
  const starSystem = {
    ...SharedStarSystem,
    clearCache: vi.fn(),
    getStarSystemById: vi.fn(() => system),
    getStarSystemsForSector: vi.fn(() => [system])
  };
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Set,
    Number,
    Object,
    CONSTANTS: {
      GALAXY_SEED: 'test',
      SECTOR_SIZE: 1000,
      SWARM_EXCLUSION_ZONE: { MIN_SECTOR_DISTANCE: 10 }
    },
    Physics: browserPhysics,
    StarSystem: starSystem,
    Logger: { category: vi.fn(), error: vi.fn() },
    window: { Physics: browserPhysics, StarSystem: starSystem }
  });
  context.globalThis = context;

  const filename = path.join(PROJECT_ROOT, 'client/js/world.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });

  return {
    world: vm.runInContext('World', context),
    starSystem,
    fixedTime
  };
}

function emptySector(x, y) {
  return {
    x,
    y,
    stars: [],
    planets: [],
    asteroids: [],
    wormholes: [],
    bases: [],
    comets: []
  };
}

describe('client deterministic world parity', () => {
  it('resolves binary ownership at fixed time and deduplicates orbital IDs', () => {
    const system = makeSystem();
    const { world, fixedTime } = loadWorld(system);

    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        world.sectors.set(`${x}_${y}`, emptySector(x, y));
      }
    }

    const primaryClone = {
      ...system.primaryStar,
      systemId: system.id,
      isBinary: true,
      isPrimaryBinary: true,
      binaryRole: 'primary',
      binaryInfo: system.binaryInfo
    };
    const secondaryClone = {
      ...system.binaryInfo.secondaryStar,
      systemId: system.id,
      isBinary: true,
      isPrimaryBinary: false,
      binaryRole: 'secondary',
      binaryInfo: system.binaryInfo
    };
    const planetClone = { ...system.planets[0], systemId: system.id, isOrbital: true };
    const baseClone = { ...system.bases[0], systemId: system.id };
    const cometClone = { ...system.comets[0], systemId: system.id };

    world.sectors.get('0_0').stars.push(primaryClone, secondaryClone);
    // The first clone encountered has no parent star in its local sector. It
    // must still resolve through systemId, then be deduplicated with the copy.
    world.sectors.get('-1_0').planets.push({ ...planetClone });
    world.sectors.get('1_0').planets.push({ ...planetClone });
    world.sectors.get('-1_0').bases.push({ ...baseClone });
    world.sectors.get('1_0').bases.push({ ...baseClone });
    world.sectors.get('-1_0').comets.push({ ...cometClone });
    world.sectors.get('1_0').comets.push({ ...cometClone });

    const visible = world.getVisibleObjects({ x: 500, y: 500 }, 5000);
    const expectedStars = Physics.computeBinaryStarPositions(system, fixedTime);
    const expectedPlanet = SharedStarSystem.resolveObjectPosition(
      system,
      system.planets[0],
      fixedTime
    );

    expect(visible.stars).toHaveLength(2);
    expect(visible.stars.find(star => star.binaryRole === 'primary').x)
      .toBeCloseTo(expectedStars.primary.x, 10);
    expect(visible.stars.find(star => star.binaryRole === 'secondary').x)
      .toBeCloseTo(expectedStars.secondary.x, 10);
    expect(visible.planets).toHaveLength(1);
    expect(visible.planets[0].x).toBeCloseTo(expectedPlanet.x, 10);
    expect(visible.planets[0].y).toBeCloseTo(expectedPlanet.y, 10);
    expect(visible.bases).toHaveLength(1);
    expect(visible.comets).toHaveLength(1);
  });

  it('covers top-tier radar sectors when the player is near a sector edge', () => {
    const { world } = loadWorld(makeSystem());

    // A 2,531-unit radar radius plus the existing large-object margin reaches
    // sectors -3 through 4 from this edge-adjacent position.
    for (let x = -3; x <= 4; x++) {
      for (let y = -3; y <= 3; y++) {
        world.sectors.set(`${x}_${y}`, emptySector(x, y));
      }
    }
    const distantContact = { id: 'tier-5-contact', x: 3500, y: 500 };
    world.sectors.get('3_0').asteroids.push(distantContact);

    const visible = world.getVisibleObjects({ x: 990, y: 500 }, 2531 * 2);

    expect(visible.asteroids).toContain(distantContact);
  });

  it('exposes comet paths and filters Swarm hives inside the origin exclusion', () => {
    const system = makeSystem();
    system.bases = [{
      id: `${system.id}_base_swarm_hive`,
      type: 'swarm_hive',
      faction: 'swarm',
      x: 200,
      y: 200,
      size: 50,
      starId: system.primaryStar.id,
      starX: system.primaryStar.x,
      starY: system.primaryStar.y
    }];
    const { world } = loadWorld(system);
    world.seed = 'test';

    const sector = world.generateSectorFromStarSystem(0, 0);

    expect(sector.stars.find(star => star.binaryRole === 'primary')).toBeDefined();
    expect(sector.stars.find(star => star.binaryRole === 'secondary')).toBeDefined();
    expect(sector.comets.map(comet => comet.id)).toContain(system.comets[0].id);
    expect(sector.bases.some(base => base.type === 'swarm_hive')).toBe(false);
  });
});
