import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../../..');

function loadScript(relativePath, globals, globalName) {
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Set,
    Number,
    window: {},
    ...globals
  });
  context.globalThis = context;
  const filename = path.join(PROJECT_ROOT, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return vm.runInContext(globalName, context);
}

function createContext2d() {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn()
  };
}

describe('Ancient Star Map radar contacts', () => {
  it('keeps the per-frame world query at the normal radar diameter', () => {
    const objects = { stars: [], planets: [], asteroids: [], wormholes: [], bases: [] };
    const getVisibleObjects = vi.fn(() => objects);
    const entityDraw = vi.fn();
    const objectDraw = vi.fn();
    const player = {
      position: { x: 10, y: 20 },
      rotation: 0,
      hasRelic: vi.fn(type => type === 'ANCIENT_STAR_MAP')
    };
    const radar = loadScript('client/js/ui/radar/index.js', {
      Player: player,
      World: { getVisibleObjects },
      CONSTANTS: {
        RELIC_TYPES: {
          ANCIENT_STAR_MAP: { effects: { strategicContactRangeMultiplier: 2 } }
        }
      },
      RadarBaseRenderer: { hasFeature: vi.fn(() => false) },
      RadarAdvanced: {
        sectorMapMode: false,
        getZoomScale: vi.fn(() => 1.5),
        draw: vi.fn()
      },
      RadarObjects: { draw: objectDraw },
      RadarEntities: { draw: entityDraw }
    }, 'Radar');

    radar.draw(createContext2d(), 500, 1);

    expect(getVisibleObjects).toHaveBeenCalledWith(player.position, 1000);
    expect(objectDraw.mock.calls[0][2]).toBeCloseTo((75 / 500) * 1.5);
    expect(objectDraw.mock.calls[0][3]).toBe(500);
    expect(entityDraw.mock.calls[0][7]).toBe(objects);

    player.hasRelic.mockReturnValue(false);
    getVisibleObjects.mockClear();
    radar.draw(createContext2d(), 500, 1);
    expect(getVisibleObjects).toHaveBeenCalledWith(player.position, 1000);
  });

  it('validates and renders sparse server-authoritative contacts', () => {
    const ctx = createContext2d();
    const radarEntities = loadScript('client/js/ui/radar/entities.js', {
      Player: { hasRelic: vi.fn(() => true) },
      CONSTANTS: {
        RELIC_TYPES: {
          ANCIENT_STAR_MAP: {
            effects: {
              strategicContactRangeMultiplier: 2,
              maxStrategicContacts: 8,
              strategicContactRefreshMs: 100
            }
          }
        },
        FACTION_RADAR_COLORS: { pirate: '#f00' }
      },
      RadarBaseRenderer: {
        getDistance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
      }
    }, 'RadarEntities');

    radarEntities.setStrategicContacts([
      { id: 'server-base', x: 750, y: 0, faction: 'pirate', contactType: 'base' },
      { id: 'invalid', x: 'not-a-number', y: 0, contactType: 'base' }
    ]);
    radarEntities.drawStrategicContacts(ctx, 75, 500, { x: 0, y: 0 });

    expect(radarEntities.strategicContacts).toHaveLength(1);
    expect(radarEntities.strategicContacts[0].id).toBe('server-base');
    expect(ctx.rect).toHaveBeenCalledOnce();
  });
});
