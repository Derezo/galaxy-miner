import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadEntities() {
  const context = vm.createContext({
    console,
    window: {},
    Logger: {
      log: vi.fn(),
      category: vi.fn()
    },
    Date,
    Map,
    Math
  });
  context.globalThis = context;
  const filename = path.join(root, 'client/js/entities.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return vm.runInContext('Entities', context);
}

describe('NPC motion reconciliation', () => {
  it('accepts authoritative zero rotation and stops smoothed velocity immediately', () => {
    const entities = loadEntities();
    entities.updateNPC({
      id: 'scout-1',
      type: 'pirate_scout',
      faction: 'pirate',
      x: 10,
      y: 20,
      rotation: 1.2,
      hull: 40,
      hullMax: 40,
      shield: 20,
      shieldMax: 20,
      vx: 65,
      vy: -10
    });

    const scout = entities.npcs.get('scout-1');
    scout.smoothVx = 65;
    scout.smoothVy = -10;
    entities.updateNPC({
      id: 'scout-1',
      x: 10,
      y: 20,
      rotation: 0,
      vx: 0,
      vy: 0
    });

    expect(scout.targetRotation).toBe(0);
    expect(scout.smoothVx).toBe(0);
    expect(scout.smoothVy).toBe(0);

    entities.interpolateEntity(scout, 0.05);
    expect(scout.position).toEqual({ x: 10, y: 20 });
  });

  it('snaps velocity components that reverse instead of drifting the old way', () => {
    const entities = loadEntities();
    entities.updateNPC({
      id: 'fighter-1',
      type: 'pirate_fighter',
      faction: 'pirate',
      x: 0,
      y: 0,
      rotation: 0,
      hull: 100,
      hullMax: 100,
      shield: 50,
      shieldMax: 50,
      vx: 80,
      vy: -40
    });

    const fighter = entities.npcs.get('fighter-1');
    fighter.smoothVx = 80;
    fighter.smoothVy = -40;
    entities.updateNPC({
      id: fighter.id,
      x: 0,
      y: 0,
      rotation: Math.PI,
      vx: -60,
      vy: 20
    });

    expect(fighter.smoothVx).toBe(-60);
    expect(fighter.smoothVy).toBe(20);
    entities.interpolateEntity(fighter, 0.05);
    expect(fighter.position.x).toBeLessThan(0);
    expect(fighter.position.y).toBeGreaterThan(0);
  });
});
