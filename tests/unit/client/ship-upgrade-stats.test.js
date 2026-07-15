import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadPanel() {
  const context = vm.createContext({
    console,
    window: { CONSTANTS },
    setTimeout,
    clearTimeout
  });
  context.globalThis = context;
  vm.runInContext(
    fs.readFileSync(path.join(root, 'client/js/ui/panels/ShipUpgradePanel.js'), 'utf8'),
    context
  );
  return context.window.ShipUpgradePanel;
}

describe('ship upgrade panel shared balance contract', () => {
  it('derives component values from authoritative shared constants', () => {
    const panel = loadPanel();

    expect(panel.COMPONENT_INFO.engine.stats(1)['Max Speed'].value).toBe('180 u/s');
    expect(panel.COMPONENT_INFO.engine.stats(2)['Max Speed'].value).toBe('252 u/s');
    expect(panel.COMPONENT_INFO.weapon.stats(5)).toMatchObject({
      Damage: { value: '38.4' },
      Range: { value: '400 units' },
      'Base Cooldown': { value: '130ms' }
    });
    expect(panel.COMPONENT_INFO.shield.stats(5).Capacity.value).toBe('960 HP');
    expect([1, 2, 3, 4, 5].map(tier =>
      panel.COMPONENT_INFO.mining.stats(tier).Yield.value
    )).toEqual(['1 unit', '2 units', '3 units', '5 units', '8 units']);
    expect(panel.COMPONENT_INFO.radar.stats(5).Range.value).toBe('2531 units');
    expect(panel.COMPONENT_INFO.energy_core.stats(5)).toMatchObject({
      'Shield Regen': { value: '+5.0 HP/s' },
      'Boost Speed': { value: '2.5x' },
      'Boost Cooldown': { value: '7s' }
    });
    expect(panel.COMPONENT_INFO.hull.stats(1)['Hull Integrity'].value).toBe('120 HP');
  });

  it('has display metadata for every resource used by an upgrade', () => {
    const panel = loadPanel();
    const required = new Set();
    for (const tiers of Object.values(CONSTANTS.UPGRADE_REQUIREMENTS)) {
      for (const requirement of Object.values(tiers)) {
        for (const resource of Object.keys(requirement.resources)) required.add(resource);
      }
    }

    expect([...required].filter(resource => !panel.RESOURCE_DISPLAY[resource])).toEqual([]);
    expect(panel.RESOURCE_DISPLAY.NITROGEN.name).toBe('Nitrogen');
  });
});
