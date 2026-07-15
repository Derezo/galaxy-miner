import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addInventory,
  closeTestDatabase,
  createListing,
  createTestDatabase,
  createTestShip,
  createTestUser
} from '../../setup.js';
import miningTransactions from '../../../server/game/mining-transactions.js';

const { createMiningTransactions } = miningTransactions;

function createStatements(db) {
  return {
    getShipByUserId: db.prepare('SELECT * FROM ships WHERE user_id = ?'),
    getInventoryItem: db.prepare(
      'SELECT * FROM inventory WHERE user_id = ? AND resource_type = ?'
    ),
    getInventory: db.prepare('SELECT * FROM inventory WHERE user_id = ?'),
    getTotalCargoCount: db.prepare(
      `SELECT
        COALESCE((SELECT SUM(quantity) FROM inventory WHERE user_id = ?), 0) +
        COALESCE((SELECT SUM(quantity) FROM marketplace WHERE seller_id = ?), 0) AS total`
    ),
    upsertInventory: db.prepare(`
      INSERT INTO inventory (user_id, resource_type, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, resource_type)
      DO UPDATE SET quantity = quantity + excluded.quantity
    `),
    getWorldChange: db.prepare('SELECT * FROM world_changes WHERE object_id = ?'),
    createWorldChange: db.prepare(`
      INSERT OR REPLACE INTO world_changes (object_id, change_type, depleted_at, respawn_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `),
    deleteWorldChange: db.prepare('DELETE FROM world_changes WHERE object_id = ?')
  };
}

describe('mining completion transactions', () => {
  let db;
  let statements;
  let mining;
  let user;
  const now = Date.parse('2026-07-14T12:00:00.000Z');
  const respawnAt = '2026-07-14T13:00:00.000Z';

  beforeEach(() => {
    db = createTestDatabase();
    statements = createStatements(db);
    mining = createMiningTransactions(db, statements);
    user = createTestUser(db, { username: 'atomic-miner' });
    createTestShip(db, user.id, { cargo_tier: 1 });
  });

  afterEach(() => closeTestDatabase(db));

  it('awards cargo and claims the world object as one completion', () => {
    const result = mining.completeMiningYield(
      user.id, 'IRON', 6, 50, 'asteroid-1', respawnAt, now
    );

    expect(result).toMatchObject({
      success: true,
      quantity: 6,
      inventory: [{ resource_type: 'IRON', quantity: 6 }]
    });
    expect(statements.getInventoryItem.get(user.id, 'IRON').quantity).toBe(6);
    expect(statements.getWorldChange.get('asteroid-1')).toMatchObject({
      change_type: 'depleted',
      respawn_at: respawnAt
    });
  });

  it('lets only the first miner claim a still-depleted object', () => {
    const rival = createTestUser(db, { username: 'rival-miner' });
    createTestShip(db, rival.id);

    expect(mining.completeMiningYield(
      user.id, 'IRON', 4, 50, 'asteroid-shared', respawnAt, now
    ).success).toBe(true);
    expect(mining.completeMiningYield(
      rival.id, 'IRON', 4, 50, 'asteroid-shared', respawnAt, now
    )).toEqual({ success: false, error: 'Resource was depleted' });
    expect(statements.getInventoryItem.get(rival.id, 'IRON')).toBeUndefined();
  });

  it('caps the grant against authoritative inventory plus marketplace escrow', () => {
    addInventory(db, user.id, 'CARBON', 40);
    createListing(db, {
      sellerId: user.id,
      resourceType: 'TITANIUM',
      quantity: 6,
      pricePerUnit: 3
    });

    const result = mining.completeMiningYield(
      user.id, 'IRON', 6, 50, 'asteroid-cap', respawnAt, now
    );

    expect(result).toMatchObject({ success: true, quantity: 4 });
    expect(statements.getInventoryItem.get(user.id, 'IRON').quantity).toBe(4);
  });

  it('rolls the inventory grant back when the world claim fails', () => {
    const failing = createMiningTransactions(db, {
      ...statements,
      createWorldChange: { run() { throw new Error('simulated world write failure'); } }
    });

    expect(() => failing.completeMiningYield(
      user.id, 'IRON', 6, 50, 'asteroid-fail', respawnAt, now
    )).toThrow('simulated world write failure');
    expect(statements.getInventoryItem.get(user.id, 'IRON')).toBeUndefined();
    expect(statements.getWorldChange.get('asteroid-fail')).toBeUndefined();
  });

  it('rolls both writes back when the response inventory snapshot fails', () => {
    const failing = createMiningTransactions(db, {
      ...statements,
      getInventory: { all() { throw new Error('simulated snapshot failure'); } }
    });

    expect(() => failing.completeMiningYield(
      user.id, 'IRON', 6, 50, 'asteroid-snapshot', respawnAt, now
    )).toThrow('simulated snapshot failure');
    expect(statements.getInventoryItem.get(user.id, 'IRON')).toBeUndefined();
    expect(statements.getWorldChange.get('asteroid-snapshot')).toBeUndefined();
  });
});
