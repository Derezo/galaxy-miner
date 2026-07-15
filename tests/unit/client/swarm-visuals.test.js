import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');

function load(context, relativePath) {
  const filename = path.join(PROJECT_ROOT, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

function makeContext() {
  const context = vm.createContext({
    console,
    Date,
    Math,
    Map,
    Number,
    window: { CONSTANTS: {} }
  });
  context.globalThis = context;
  return context;
}

describe('Swarm Queen visual lifecycle', () => {
  it('tracks phases by Queen id and renders transitions in camera space', () => {
    const context = makeContext();
    load(context, 'client/js/graphics/queen-visuals.js');
    const visuals = context.window.QueenVisuals;
    visuals.init();

    expect(visuals.triggerPhaseTransition('queen-1', 500, 600, {
      from: 'HUNT',
      to: 'SIEGE'
    })).toBe(true);
    expect(visuals.queenPhases.get('queen-1')).toBe('SIEGE');

    const arc = vi.fn();
    const ctx = {
      beginPath: vi.fn(),
      arc,
      stroke: vi.fn(),
      fill: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      globalAlpha: 1
    };
    visuals.drawPhaseTransitions(ctx, { x: 100, y: 150 });

    expect(arc).toHaveBeenCalled();
    expect(arc.mock.calls[0][0]).toBe(400);
    expect(arc.mock.calls[0][1]).toBe(450);

    visuals.clearQueen('queen-1');
    expect(visuals.queenPhases.has('queen-1')).toBe(false);
    expect(visuals.phaseTransitions).toEqual([]);
  });

  it('passes the live NPC state into the Queen renderer', () => {
    const context = makeContext();
    load(context, 'client/js/graphics/queen-visuals.js');
    load(context, 'client/js/graphics/npc-ships.js');
    const visuals = context.window.QueenVisuals;
    const drawQueen = vi.spyOn(visuals, 'draw').mockImplementation(() => {});
    const geometry = vm.runInContext('NPCShipGeometry', context);
    const npc = {
      id: 'queen-1',
      type: 'swarm_queen',
      faction: 'swarm',
      phaseManager: { currentPhase: 'DESPERATION' }
    };
    const position = { x: 500, y: 600 };

    geometry.draw(
      {},
      position,
      0.5,
      npc.type,
      npc.faction,
      { x: 100, y: 200 },
      1234,
      npc
    );

    expect(drawQueen).toHaveBeenCalledWith(
      {},
      100,
      200,
      0.5,
      1234,
      npc,
      position
    );
  });
});
