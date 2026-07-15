import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addInventory,
  closeTestDatabase,
  createTestDatabase,
  createTestShip,
  createTestUser
} from '../../setup.js';

const require = createRequire(import.meta.url);
const CONSTANTS = require('../../../shared/constants.js');
const {
  createShipUpgradeTransactions
} = require('../../../server/game/ship-upgrade-transactions.js');

function createStatements(db) {
  return {
    getShipByUserId: db.prepare('SELECT * FROM ships WHERE user_id = ?'),
    getInventory: db.prepare('SELECT * FROM inventory WHERE user_id = ?'),
    updateShipCredits: db.prepare('UPDATE ships SET credits = ? WHERE user_id = ?'),
    setInventoryQuantity: db.prepare(
      'UPDATE inventory SET quantity = ? WHERE user_id = ? AND resource_type = ?'
    ),
    removeInventoryItem: db.prepare(
      'DELETE FROM inventory WHERE user_id = ? AND resource_type = ?'
    ),
    upgradeShipComponent: db.prepare(`
      UPDATE ships SET
        engine_tier = COALESCE(?, engine_tier),
        weapon_type = COALESCE(?, weapon_type),
        weapon_tier = COALESCE(?, weapon_tier),
        shield_tier = COALESCE(?, shield_tier),
        mining_tier = COALESCE(?, mining_tier),
        cargo_tier = COALESCE(?, cargo_tier),
        radar_tier = COALESCE(?, radar_tier),
        energy_core_tier = COALESCE(?, energy_core_tier),
        hull_tier = COALESCE(?, hull_tier),
        shield_max = COALESCE(?, shield_max),
        hull_max = COALESCE(?, hull_max)
      WHERE user_id = ?
    `)
  };
}

function createUpgradeService(db, statements) {
  return createShipUpgradeTransactions(db, statements, { log() {} }, {
    defaultShieldHp: CONSTANTS.DEFAULT_SHIELD_HP,
    defaultHullHp: CONSTANTS.DEFAULT_HULL_HP,
    shieldTierMultiplier: CONSTANTS.SHIELD_TIER_MULTIPLIER,
    hullTierMultiplier: CONSTANTS.TIER_MULTIPLIER
  });
}

describe('atomic ship upgrades', () => {
  let db;
  let statements;
  let performUpgrade;
  let user;

  beforeEach(() => {
    db = createTestDatabase();
    statements = createStatements(db);
    ({ performUpgrade } = createUpgradeService(db, statements));
    user = createTestUser(db);
    createTestShip(db, user.id, { credits: 500 });
  });

  afterEach(() => closeTestDatabase(db));

  it('commits the credit debit, resource debits, and tier change together', () => {
    addInventory(db, user.id, 'HYDROGEN', 5);
    addInventory(db, user.id, 'CARBON', 7);

    const result = performUpgrade(user.id, 'engine', {
      credits: 100,
      resources: { HYDROGEN: 5, CARBON: 3 }
    }, 5);

    expect(result).toMatchObject({
      success: true,
      newTier: 2,
      creditsSpent: 100,
      ship: { credits: 400, engine_tier: 2 },
      inventory: [
        expect.objectContaining({ resource_type: 'CARBON', quantity: 4 })
      ]
    });
    expect(statements.getShipByUserId.get(user.id)).toMatchObject({
      credits: 400,
      engine_tier: 2
    });
    expect(statements.getInventory.all(user.id)).toEqual([
      expect.objectContaining({ resource_type: 'CARBON', quantity: 4 })
    ]);
  });

  it('does not debit anything when any required resource is missing', () => {
    addInventory(db, user.id, 'HYDROGEN', 5);
    addInventory(db, user.id, 'CARBON', 2);

    const result = performUpgrade(user.id, 'engine', {
      credits: 100,
      resources: { HYDROGEN: 5, CARBON: 3 }
    }, 5);

    expect(result).toEqual({
      success: false,
      error: 'Need 3 CARBON (have 2)'
    });
    expect(statements.getShipByUserId.get(user.id)).toMatchObject({
      credits: 500,
      engine_tier: 1
    });
    expect(statements.getInventory.all(user.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ resource_type: 'CARBON', quantity: 2 }),
      expect.objectContaining({ resource_type: 'HYDROGEN', quantity: 5 })
    ]));
  });

  it('rolls all debits back if the final tier write fails', () => {
    addInventory(db, user.id, 'IRON', 5);
    const failingStatements = {
      ...statements,
      upgradeShipComponent: {
        run() {
          throw new Error('injected tier update failure');
        }
      }
    };
    const failingUpgrade = createUpgradeService(db, failingStatements).performUpgrade;

    expect(() => failingUpgrade(user.id, 'weapon', {
      credits: 100,
      resources: { IRON: 5 }
    }, 5)).toThrow('injected tier update failure');

    expect(statements.getShipByUserId.get(user.id)).toMatchObject({
      credits: 500,
      weapon_tier: 1
    });
    expect(statements.getInventory.all(user.id)).toEqual([
      expect.objectContaining({ resource_type: 'IRON', quantity: 5 })
    ]);
  });

  it('rolls all debits back if the authoritative response snapshot fails', () => {
    addInventory(db, user.id, 'IRON', 5);
    let inventoryReads = 0;
    const failingStatements = {
      ...statements,
      getInventory: {
        all(userId) {
          inventoryReads += 1;
          if (inventoryReads === 2) {
            throw new Error('injected response snapshot failure');
          }
          return statements.getInventory.all(userId);
        }
      }
    };
    const failingUpgrade = createUpgradeService(db, failingStatements).performUpgrade;

    expect(() => failingUpgrade(user.id, 'weapon', {
      credits: 100,
      resources: { IRON: 5 }
    }, 5)).toThrow('injected response snapshot failure');

    expect(statements.getShipByUserId.get(user.id)).toMatchObject({
      credits: 500,
      weapon_tier: 1
    });
    expect(statements.getInventory.all(user.id)).toEqual([
      expect.objectContaining({ resource_type: 'IRON', quantity: 5 })
    ]);
  });

  it.each([
    { credits: -1, resources: {} },
    { credits: 0.5, resources: {} },
    { credits: 0, resources: { IRON: 0 } },
    { credits: 0, resources: { IRON: -1 } },
    { credits: 0, resources: { IRON: Number.POSITIVE_INFINITY } }
  ])('rejects malformed requirements without mutation: %j', (requirements) => {
    addInventory(db, user.id, 'IRON', 5);

    expect(performUpgrade(user.id, 'engine', requirements, 5)).toEqual({
      success: false,
      error: 'Invalid upgrade requirements'
    });
    expect(statements.getShipByUserId.get(user.id)).toMatchObject({
      credits: 500,
      engine_tier: 1
    });
    expect(statements.getInventory.all(user.id)).toEqual([
      expect.objectContaining({ resource_type: 'IRON', quantity: 5 })
    ]);
  });

  it.each([
    ['shield', 'shield_tier', 'shield_max', CONSTANTS.DEFAULT_SHIELD_HP * CONSTANTS.SHIELD_TIER_MULTIPLIER],
    ['hull', 'hull_tier', 'hull_max', CONSTANTS.DEFAULT_HULL_HP * CONSTANTS.TIER_MULTIPLIER]
  ])('updates %s tier and its derived maximum together', (component, tierColumn, maxColumn, expectedMax) => {
    const result = performUpgrade(user.id, component, { credits: 0, resources: {} }, 5);
    const ship = statements.getShipByUserId.get(user.id);

    expect(result).toMatchObject({ success: true, newTier: 2 });
    expect(ship[tierColumn]).toBe(2);
    expect(ship[maxColumn]).toBe(Math.round(expectedMax));
  });
});
