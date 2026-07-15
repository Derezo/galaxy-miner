import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createPlunderTransactions } = require('../../../server/game/plunder-transactions.js');

describe('atomic plunder grants', () => {
  let db;
  let statements;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE ships (user_id INTEGER PRIMARY KEY, credits INTEGER NOT NULL);
      CREATE TABLE inventory (
        user_id INTEGER NOT NULL,
        resource_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, resource_type)
      );
      INSERT INTO ships (user_id, credits) VALUES (1, 100);
    `);
    statements = {
      getShipByUserId: db.prepare('SELECT * FROM ships WHERE user_id = ?'),
      updateShipCredits: db.prepare('UPDATE ships SET credits = ? WHERE user_id = ?'),
      getInventoryItem: db.prepare(
        'SELECT * FROM inventory WHERE user_id = ? AND resource_type = ?'
      ),
      upsertInventory: db.prepare(`
        INSERT INTO inventory (user_id, resource_type, quantity) VALUES (?, ?, ?)
        ON CONFLICT(user_id, resource_type) DO UPDATE SET quantity = quantity + excluded.quantity
      `)
    };
  });

  afterEach(() => db.close());

  it('commits credits and normalized resources together', () => {
    const { grantPlunderRewards } = createPlunderTransactions(
      db, statements, new Set(['IRON', 'COPPER'])
    );
    const result = grantPlunderRewards(1, 25, [
      { resource: 'IRON', quantity: 2 },
      { resource: 'IRON', quantity: 3 },
      { resource: 'COPPER', quantity: 1 }
    ]);

    expect(result).toEqual({
      creditGrant: 25,
      newCredits: 125,
      resources: [
        { resource: 'IRON', quantity: 5 },
        { resource: 'COPPER', quantity: 1 }
      ]
    });
    expect(db.prepare('SELECT credits FROM ships WHERE user_id = 1').get().credits).toBe(125);
    expect(db.prepare('SELECT resource_type, quantity FROM inventory ORDER BY resource_type').all())
      .toEqual([
        { resource_type: 'COPPER', quantity: 1 },
        { resource_type: 'IRON', quantity: 5 }
      ]);
  });

  it('rolls back credits and earlier rows if a later resource write fails', () => {
    const realUpsert = statements.upsertInventory;
    let calls = 0;
    statements.upsertInventory = {
      run(...args) {
        calls++;
        if (calls === 2) throw new Error('injected failure');
        return realUpsert.run(...args);
      }
    };
    const { grantPlunderRewards } = createPlunderTransactions(
      db, statements, new Set(['IRON', 'COPPER'])
    );

    expect(() => grantPlunderRewards(1, 25, [
      { resource: 'IRON', quantity: 2 },
      { resource: 'COPPER', quantity: 1 }
    ])).toThrow('injected failure');
    expect(db.prepare('SELECT credits FROM ships WHERE user_id = 1').get().credits).toBe(100);
    expect(db.prepare('SELECT * FROM inventory').all()).toEqual([]);
  });

  it('rejects invalid or overflowing rewards without mutation', () => {
    const { grantPlunderRewards } = createPlunderTransactions(
      db, statements, new Set(['IRON'])
    );
    expect(() => grantPlunderRewards(1, 1, [{ resource: 'UNKNOWN', quantity: 1 }]))
      .toThrow('Invalid plunder resource');
    expect(() => grantPlunderRewards(1, Number.MAX_SAFE_INTEGER, []))
      .toThrow('Plunder credit overflow');
    expect(db.prepare('SELECT credits FROM ships WHERE user_id = 1').get().credits).toBe(100);
    expect(db.prepare('SELECT * FROM inventory').all()).toEqual([]);
  });
});
