import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  createTestUser,
  createTestShip,
  addInventory,
  createListing,
  closeTestDatabase
} from '../../setup.js';
import marketplaceTransactions from '../../../server/game/marketplace-transactions.js';

const { createMarketplaceTransactions } = marketplaceTransactions;

function createStatements(db) {
  return {
    getInventoryItem: db.prepare(
      'SELECT * FROM inventory WHERE user_id = ? AND resource_type = ?'
    ),
    removeInventoryItem: db.prepare(
      'DELETE FROM inventory WHERE user_id = ? AND resource_type = ?'
    ),
    setInventoryQuantity: db.prepare(
      'UPDATE inventory SET quantity = ? WHERE user_id = ? AND resource_type = ?'
    ),
    createListing: db.prepare(
      'INSERT INTO marketplace (seller_id, resource_type, quantity, price_per_unit) VALUES (?, ?, ?, ?)'
    ),
    getListingById: db.prepare('SELECT * FROM marketplace WHERE id = ?'),
    getShipByUserId: db.prepare('SELECT * FROM ships WHERE user_id = ?'),
    getTotalCargoCount: db.prepare(
      `SELECT
        COALESCE((SELECT SUM(quantity) FROM inventory WHERE user_id = ?), 0) +
        COALESCE((SELECT SUM(quantity) FROM marketplace WHERE seller_id = ?), 0) AS total`
    ),
    updateShipCredits: db.prepare('UPDATE ships SET credits = ? WHERE user_id = ?'),
    upsertInventory: db.prepare(`
      INSERT INTO inventory (user_id, resource_type, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, resource_type)
      DO UPDATE SET quantity = quantity + excluded.quantity
    `),
    deleteListing: db.prepare('DELETE FROM marketplace WHERE id = ?'),
    updateListingQuantity: db.prepare('UPDATE marketplace SET quantity = ? WHERE id = ?')
  };
}

describe('marketplace transactions', () => {
  let db;
  let statements;
  let market;
  let seller;
  let buyer;

  beforeEach(() => {
    db = createTestDatabase();
    statements = createStatements(db);
    market = createMarketplaceTransactions(db, statements, { log() {} }, {
      cargoCapacityByTier: [0, 100, 250, 500, 750, 2000]
    });

    seller = createTestUser(db, { username: 'seller' });
    buyer = createTestUser(db, { username: 'buyer' });
    createTestShip(db, seller.id, { credits: 100 });
    createTestShip(db, buyer.id, { credits: 1000 });
    addInventory(db, seller.id, 'IRON', 10);
  });

  afterEach(() => closeTestDatabase(db));

  it('escrows an exact inventory quantity atomically', () => {
    const result = market.createListing(seller.id, 'IRON', 10, 7);

    expect(result.success).toBe(true);
    expect(statements.getInventoryItem.get(seller.id, 'IRON')).toBeUndefined();
    expect(statements.getListingById.get(result.listingId)).toMatchObject({
      seller_id: seller.id,
      resource_type: 'IRON',
      quantity: 10,
      price_per_unit: 7
    });
    expect(statements.getTotalCargoCount.get(seller.id, seller.id).total).toBe(10);
  });

  it('rolls escrow back if listing creation fails', () => {
    const failingStatements = {
      ...statements,
      createListing: { run() { throw new Error('simulated insert failure'); } }
    };
    const failingMarket = createMarketplaceTransactions(db, failingStatements, { log() {} }, {
      cargoCapacityByTier: [0, 100, 250, 500, 750, 2000]
    });

    expect(() => failingMarket.createListing(seller.id, 'IRON', 10, 7))
      .toThrow('simulated insert failure');
    expect(statements.getInventoryItem.get(seller.id, 'IRON').quantity).toBe(10);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects unsafe purchase quantity %s without mutating balances',
    (quantity) => {
      const listing = createListing(db, {
        sellerId: seller.id,
        resourceType: 'IRON',
        quantity: 5,
        pricePerUnit: 10
      });

      const result = market.purchaseListing(buyer.id, listing.id, quantity);

      expect(result.success).toBe(false);
      expect(statements.getShipByUserId.get(buyer.id).credits).toBe(1000);
      expect(statements.getShipByUserId.get(seller.id).credits).toBe(100);
      expect(statements.getListingById.get(listing.id).quantity).toBe(5);
      expect(statements.getInventoryItem.get(buyer.id, 'IRON')).toBeUndefined();
    }
  );

  it('transfers credits, inventory, and listing quantity as one purchase', () => {
    const listing = createListing(db, {
      sellerId: seller.id,
      resourceType: 'IRON',
      quantity: 5,
      pricePerUnit: 10
    });

    const result = market.purchaseListing(buyer.id, listing.id, 3);

    expect(result).toMatchObject({ success: true, cost: 30, quantity: 3 });
    expect(statements.getShipByUserId.get(buyer.id).credits).toBe(970);
    expect(statements.getShipByUserId.get(seller.id).credits).toBe(130);
    expect(statements.getInventoryItem.get(buyer.id, 'IRON').quantity).toBe(3);
    expect(statements.getListingById.get(listing.id).quantity).toBe(2);
  });

  it('rejects self-purchases without mutating the listing', () => {
    const listing = createListing(db, {
      sellerId: seller.id,
      resourceType: 'IRON',
      quantity: 5,
      pricePerUnit: 10
    });

    const result = market.purchaseListing(seller.id, listing.id, 1);

    expect(result).toEqual({ success: false, error: 'Cannot buy your own listing' });
    expect(statements.getShipByUserId.get(seller.id).credits).toBe(100);
    expect(statements.getListingById.get(listing.id).quantity).toBe(5);
  });

  it('rejects purchases that exceed authoritative cargo capacity', () => {
    addInventory(db, buyer.id, 'CARBON', 99);
    const listing = createListing(db, {
      sellerId: seller.id,
      resourceType: 'IRON',
      quantity: 5,
      pricePerUnit: 10
    });

    const result = market.purchaseListing(buyer.id, listing.id, 2);

    expect(result).toEqual({ success: false, error: 'Not enough cargo space' });
    expect(statements.getShipByUserId.get(buyer.id).credits).toBe(1000);
    expect(statements.getListingById.get(listing.id).quantity).toBe(5);
  });

  it('returns escrow and removes a cancelled listing atomically', () => {
    const listing = createListing(db, {
      sellerId: seller.id,
      resourceType: 'IRON',
      quantity: 4,
      pricePerUnit: 10
    });

    const result = market.cancelListing(seller.id, listing.id);

    expect(result.success).toBe(true);
    expect(statements.getInventoryItem.get(seller.id, 'IRON').quantity).toBe(14);
    expect(statements.getListingById.get(listing.id)).toBeUndefined();
  });
});
