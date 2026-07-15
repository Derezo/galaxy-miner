import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import {
  addInventory,
  closeTestDatabase,
  createListing,
  createTestDatabase,
  createTestShip,
  createTestUser
} from '../../setup.js';
import deathTransactions from '../../../server/game/death-transactions.js';

const require = createRequire(import.meta.url);
const { createDeathTransactions } = deathTransactions;
const modulePaths = [
  '../../../server/database.js',
  '../../../server/world.js',
  '../../../server/game/npc.js',
  '../../../server/game/loot.js',
  '../../../server/game/derelict.js',
  '../../../shared/logger.js'
];
const savedModules = new Map(modulePaths.map(modulePath => {
  const filename = require.resolve(modulePath);
  return [filename, require.cache[filename]];
}));
const combatPath = require.resolve('../../../server/game/combat.js');
const savedCombat = require.cache[combatPath];
let db;
let combat;

function installMock(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

beforeAll(() => {
  db = createTestDatabase();
  const statements = {
    hasRelic: db.prepare(
      'SELECT 1 FROM relics WHERE user_id = ? AND UPPER(relic_type) = UPPER(?)'
    ),
    getShipByUserId: db.prepare('SELECT * FROM ships WHERE user_id = ?'),
    getInventory: db.prepare('SELECT * FROM inventory WHERE user_id = ?'),
    getListingsBySeller: db.prepare('SELECT * FROM marketplace WHERE seller_id = ?'),
    setInventoryQuantity: db.prepare(
      'UPDATE inventory SET quantity = ? WHERE user_id = ? AND resource_type = ?'
    ),
    removeInventoryItem: db.prepare(
      'DELETE FROM inventory WHERE user_id = ? AND resource_type = ?'
    ),
    updateListingQuantity: db.prepare('UPDATE marketplace SET quantity = ? WHERE id = ?'),
    deleteListing: db.prepare('DELETE FROM marketplace WHERE id = ?')
  };
  const { settleDeathCargo } = createDeathTransactions(db, statements, 0.5);

  installMock('../../../server/database.js', { statements, settleDeathCargo });
  installMock('../../../server/world.js', {});
  installMock('../../../server/game/npc.js', {
    getActiveBases: vi.fn(() => new Map()),
    getActiveBaseWithPosition: vi.fn(),
    getNPCsInRange: vi.fn(() => []),
    getNPC: vi.fn(),
    removeNPC: vi.fn(),
    destroyBase: vi.fn()
  });
  installMock('../../../server/game/loot.js', { spawnWreckage: vi.fn() });
  installMock('../../../server/game/derelict.js', {
    getDerelictsInRange: vi.fn(() => [])
  });
  installMock('../../../shared/logger.js', {
    log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn()
  });
  delete require.cache[combatPath];
  combat = require(combatPath);
});

afterAll(() => {
  delete require.cache[combatPath];
  if (savedCombat) require.cache[combatPath] = savedCombat;
  for (const [filename, cached] of savedModules) {
    if (cached) require.cache[filename] = cached;
    else delete require.cache[filename];
  }
  closeTestDatabase(db);
});

describe('combat death orchestration', () => {
  it('turns the real atomic settlement into the authoritative death payload', () => {
    const user = createTestUser(db, { username: 'orchestrated-death' });
    createTestShip(db, user.id, { position_x: 12, position_y: 34 });
    addInventory(db, user.id, 'IRON', 3);
    const listing = createListing(db, {
      sellerId: user.id,
      resourceType: 'IRON',
      quantity: 7,
      pricePerUnit: 9
    });

    const result = combat.handleDeath(user.id, { x: 12, y: 34 });

    expect(result).toMatchObject({
      droppedCargo: [{ resource_type: 'IRON', quantity: 5 }],
      wreckageContents: [{
        type: 'resource', resourceType: 'IRON', quantity: 2
      }],
      respawnOptions: { type: 'graveyard' },
      deathPosition: { x: 12, y: 34 },
      marketplaceChanged: true,
      inventory: []
    });
    expect(db.prepare('SELECT * FROM inventory WHERE user_id = ?').all(user.id)).toEqual([]);
    expect(db.prepare('SELECT quantity FROM marketplace WHERE id = ?').get(listing.id).quantity)
      .toBe(5);
  });
});
