import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Physics = require('../../../shared/physics');
const StarSystem = require('../../../shared/star-system');

const dependencyPaths = [
  require.resolve('../../../server/database.js'),
  require.resolve('../../../server/game/derelict.js'),
  require.resolve('../../../shared/logger.js')
];
const savedDependencies = new Map(
  dependencyPaths.map(filename => [filename, require.cache[filename]])
);
const worldPath = require.resolve('../../../server/world.js');
let world;

function installCommonJsMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports
  };
}

function makeBinarySystem() {
  const id = 'ss_7_-6_0';
  const primaryStar = { id: `${id}_star`, x: 1000, y: -2000, size: 100 };
  const binaryInfo = {
    secondaryStar: { id: `${id}_star_b`, x: 1300, y: -2000, size: 60 },
    baryCenter: { x: 1000, y: -2000 },
    eccentricity: 0.3,
    orbitPeriod: 210,
    orbitPhase: 1.1,
    primaryOrbitRadius: 90,
    secondaryOrbitRadius: 210
  };
  const planet = {
    id: `${id}_planet_0`,
    x: 1500,
    y: -2000,
    size: 30,
    orbitRadius: 500,
    orbitAngle: 0.2,
    orbitSpeed: 0.0015,
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
    bases: [],
    miningClaimObjects: [],
    wormholes: [],
    comets: []
  };
}

beforeAll(() => {
  vi.useFakeTimers();
  installCommonJsMock('../../../server/database.js', {
    statements: {
      getWorldChange: { get: vi.fn(() => null) },
      deleteWorldChange: { run: vi.fn() },
      createWorldChange: { run: vi.fn() },
      deleteExpiredWorldChanges: { run: vi.fn() }
    }
  });
  installCommonJsMock('../../../server/game/derelict.js', {
    generateDerelictsForSector: vi.fn(() => [])
  });
  installCommonJsMock('../../../shared/logger.js', {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    category: vi.fn()
  });

  delete require.cache[worldPath];
  world = require(worldPath);
});

afterAll(() => {
  delete require.cache[worldPath];
  for (const [filename, cached] of savedDependencies) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
  vi.useRealTimers();
});

describe('server deterministic world positions', () => {
  it('returns finite fixed-time positions for generated planets', () => {
    StarSystem.clearCache();
    const system = StarSystem.generateSuperSector(0, 0)[0];
    const planet = system.planets[0];
    const time = 234567;
    const expected = StarSystem.resolveObjectPosition(system, planet, time);
    const actual = world.getObjectPosition(planet.id, time);

    expect(Number.isFinite(actual.x)).toBe(true);
    expect(Number.isFinite(actual.y)).toBe(true);
    expect(actual.x).toBeCloseTo(expected.x, 10);
    expect(actual.y).toBeCloseTo(expected.y, 10);
  });

  it('matches shared primary, secondary, and planet positions at one time', () => {
    const system = makeBinarySystem();
    const time = 765432;
    const getSystem = vi.spyOn(StarSystem, 'getStarSystemById')
      .mockImplementation(systemId => systemId === system.id ? system : null);

    try {
      const expectedStars = Physics.computeBinaryStarPositions(system, time);
      const primary = world.getObjectPosition(system.primaryStar.id, time);
      const secondary = world.getObjectPosition(system.binaryInfo.secondaryStar.id, time);
      const planet = world.getObjectPosition(system.planets[0].id, time);
      const expectedPlanet = StarSystem.resolveObjectPosition(system, system.planets[0], time);

      expect(primary.x).toBeCloseTo(expectedStars.primary.x, 10);
      expect(primary.y).toBeCloseTo(expectedStars.primary.y, 10);
      expect(secondary.x).toBeCloseTo(expectedStars.secondary.x, 10);
      expect(secondary.y).toBeCloseTo(expectedStars.secondary.y, 10);
      expect(planet.x).toBeCloseTo(expectedPlanet.x, 10);
      expect(planet.y).toBeCloseTo(expectedPlanet.y, 10);
    } finally {
      getSystem.mockRestore();
    }
  });

  it('exposes comet path candidates on generated server sectors', () => {
    const system = makeBinarySystem();
    system.primaryStar.x = 42100;
    system.primaryStar.y = 43100;
    system.binaryInfo = null;
    const comet = {
      id: `${system.id}_comet_0`,
      size: 25,
      tailLengthFactor: 2,
      entryPoint: { x: 42050, y: 43050 },
      perihelion: { x: 42500, y: 43500 },
      exitPoint: { x: 43200, y: 43050 },
      orbitPeriod: 100000,
      phaseOffset: 0,
      warningTime: 1000,
      traversalTime: 10000,
      starId: system.primaryStar.id
    };
    system.planets = [];
    system.comets = [comet];
    const getSystems = vi.spyOn(StarSystem, 'getStarSystemsForSector')
      .mockReturnValue([system]);

    try {
      const sector = world.generateSector(42, 43);
      expect(sector.comets.map(candidate => candidate.id)).toContain(comet.id);
    } finally {
      getSystems.mockRestore();
    }
  });
});
