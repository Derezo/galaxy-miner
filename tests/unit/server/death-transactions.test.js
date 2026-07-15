import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addInventory,
  closeTestDatabase,
  createListing,
  createTestDatabase,
  createTestShip,
  createTestUser
} from '../../setup.js';
import deathTransactions from '../../../server/game/death-transactions.js';

const { createDeathTransactions } = deathTransactions;

function createStatements(db) {
  return {
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
}

describe('death cargo transactions', () => {
  let db;
  let statements;
  let death;
  let user;

  beforeEach(() => {
    db = createTestDatabase();
    statements = createStatements(db);
    death = createDeathTransactions(db, statements, 0.5);
    user = createTestUser(db, { username: 'doomed-trader' });
    createTestShip(db, user.id);
  });

  afterEach(() => closeTestDatabase(db));

  it('settles loss across inventory and marketplace escrow', () => {
    addInventory(db, user.id, 'IRON', 3);
    const listing = createListing(db, {
      sellerId: user.id,
      resourceType: 'IRON',
      quantity: 7,
      pricePerUnit: 9
    });

    const result = death.settleDeathCargo(user.id);

    expect(result.droppedCargo).toEqual([{ resource_type: 'IRON', quantity: 5 }]);
    expect(result.marketplaceChanged).toBe(true);
    expect(result.inventory).toEqual([]);
    expect(db.prepare('SELECT * FROM inventory WHERE user_id = ?').all(user.id)).toEqual([]);
    expect(db.prepare('SELECT quantity FROM marketplace WHERE id = ?').get(listing.id).quantity)
      .toBe(5);
  });

  it('combines split holdings before rounding the death loss', () => {
    addInventory(db, user.id, 'CARBON', 1);
    createListing(db, {
      sellerId: user.id,
      resourceType: 'CARBON',
      quantity: 1,
      pricePerUnit: 2
    });

    expect(death.settleDeathCargo(user.id).droppedCargo)
      .toEqual([{ resource_type: 'CARBON', quantity: 1 }]);
  });

  it('rolls every mutation back if a later escrow write fails', () => {
    addInventory(db, user.id, 'IRON', 2);
    const listing = createListing(db, {
      sellerId: user.id,
      resourceType: 'IRON',
      quantity: 8,
      pricePerUnit: 9
    });
    const failing = createDeathTransactions(db, {
      ...statements,
      updateListingQuantity: { run() { throw new Error('simulated escrow failure'); } }
    }, 0.5);

    expect(() => failing.settleDeathCargo(user.id)).toThrow('simulated escrow failure');
    expect(db.prepare(
      'SELECT quantity FROM inventory WHERE user_id = ? AND resource_type = ?'
    ).get(user.id, 'IRON').quantity).toBe(2);
    expect(db.prepare('SELECT quantity FROM marketplace WHERE id = ?').get(listing.id).quantity)
      .toBe(8);
  });

  it('rolls settlement back if the authoritative response snapshot fails', () => {
    addInventory(db, user.id, 'IRON', 10);
    let inventoryReads = 0;
    const failing = createDeathTransactions(db, {
      ...statements,
      getInventory: {
        all(...args) {
          inventoryReads++;
          if (inventoryReads > 1) throw new Error('simulated snapshot failure');
          return statements.getInventory.all(...args);
        }
      }
    }, 0.5);

    expect(() => failing.settleDeathCargo(user.id)).toThrow('simulated snapshot failure');
    expect(statements.getInventory.all(user.id)).toEqual([
      expect.objectContaining({ resource_type: 'IRON', quantity: 10 })
    ]);
  });

  it('rejects invalid persisted balances without partial settlement', () => {
    addInventory(db, user.id, 'IRON', -2);

    expect(() => death.settleDeathCargo(user.id))
      .toThrow('Invalid inventory row during death settlement');
    expect(db.prepare(
      'SELECT quantity FROM inventory WHERE user_id = ? AND resource_type = ?'
    ).get(user.id, 'IRON').quantity).toBe(-2);
  });
});
