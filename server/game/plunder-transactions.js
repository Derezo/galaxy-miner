'use strict';

function createPlunderTransactions(db, statements, canonicalResources) {
  const validResources = canonicalResources instanceof Set
    ? canonicalResources
    : new Set(canonicalResources || []);

  const grantPlunderRewards = db.transaction((userId, creditGrant, resources) => {
    if (!Number.isSafeInteger(userId) || userId <= 0 ||
        !Number.isSafeInteger(creditGrant) || creditGrant < 0) {
      throw new Error('Invalid plunder grant');
    }

    const normalized = new Map();
    for (const item of resources || []) {
      const resource = item?.resource;
      const quantity = Number(item?.quantity);
      if (!validResources.has(resource) || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error('Invalid plunder resource');
      }
      const combined = (normalized.get(resource) || 0) + quantity;
      if (!Number.isSafeInteger(combined)) throw new Error('Plunder resource overflow');
      normalized.set(resource, combined);
    }
    if (creditGrant === 0 && normalized.size === 0) throw new Error('Empty plunder grant');

    const ship = statements.getShipByUserId.get(userId);
    if (!ship || !Number.isSafeInteger(ship.credits)) throw new Error('Invalid ship balance');
    const newCredits = ship.credits + creditGrant;
    if (!Number.isSafeInteger(newCredits)) throw new Error('Plunder credit overflow');

    for (const [resource, quantity] of normalized) {
      const existing = statements.getInventoryItem.get(userId, resource);
      const current = existing ? Number(existing.quantity) : 0;
      if (!Number.isSafeInteger(current) || current < 0 ||
          !Number.isSafeInteger(current + quantity)) {
        throw new Error('Invalid inventory balance');
      }
    }

    if (creditGrant > 0) {
      const result = statements.updateShipCredits.run(newCredits, userId);
      if (Number(result?.changes) !== 1) throw new Error('Credit grant failed');
    }
    for (const [resource, quantity] of normalized) {
      const result = statements.upsertInventory.run(userId, resource, quantity);
      if (Number(result?.changes) !== 1) throw new Error('Resource grant failed');
    }

    return {
      creditGrant,
      newCredits,
      resources: [...normalized].map(([resource, quantity]) => ({ resource, quantity }))
    };
  });

  return { grantPlunderRewards };
}

module.exports = { createPlunderTransactions };
