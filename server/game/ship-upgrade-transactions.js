'use strict';

const COMPONENT_COLUMNS = Object.freeze({
  engine: 'engine_tier',
  weapon: 'weapon_tier',
  shield: 'shield_tier',
  mining: 'mining_tier',
  cargo: 'cargo_tier',
  radar: 'radar_tier',
  energy_core: 'energy_core_tier',
  hull: 'hull_tier'
});

const COMPONENT_PARAM_INDEXES = Object.freeze({
  engine: 0,
  weapon: 2,
  shield: 3,
  mining: 4,
  cargo: 5,
  radar: 6,
  energy_core: 7,
  hull: 8
});

function hasValidRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
    return false;
  }
  if (!Number.isSafeInteger(requirements.credits) || requirements.credits < 0) {
    return false;
  }

  const resources = requirements.resources;
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) {
    return false;
  }

  return Object.entries(resources).every(([resourceType, quantity]) => (
    resourceType.length > 0 && Number.isSafeInteger(quantity) && quantity > 0
  ));
}

function requireSingleChange(result, operation) {
  if (!result || result.changes !== 1) {
    throw new Error(`Ship upgrade ${operation} affected ${result?.changes || 0} rows`);
  }
}

/**
 * Build the atomic ship-upgrade mutation around injected production statements.
 * This keeps the production transaction directly testable without opening the
 * runtime database as a side effect.
 */
function createShipUpgradeTransactions(db, statements, logger = console, options = {}) {
  const defaultShieldHp = options.defaultShieldHp;
  const defaultHullHp = options.defaultHullHp;
  const shieldTierMultiplier = options.shieldTierMultiplier;
  const hullTierMultiplier = options.hullTierMultiplier;

  const performUpgrade = db.transaction((userId, component, requirements, maxTier = 5) => {
    if (!Number.isSafeInteger(userId) || userId <= 0 ||
        !Number.isSafeInteger(maxTier) || maxTier < 1) {
      return { success: false, error: 'Invalid upgrade request' };
    }

    const dbColumn = COMPONENT_COLUMNS[component];
    if (!dbColumn) return { success: false, error: 'Invalid component' };

    const ship = statements.getShipByUserId.get(userId);
    if (!ship) return { success: false, error: 'Ship not found' };

    const currentTier = ship[dbColumn] || 1;
    if (!Number.isSafeInteger(currentTier) || currentTier < 1) {
      return { success: false, error: 'Ship tier is invalid' };
    }
    if (currentTier >= maxTier) {
      return { success: false, error: 'Already at max tier' };
    }
    if (!hasValidRequirements(requirements)) {
      return { success: false, error: 'Invalid upgrade requirements' };
    }

    const shipCredits = ship.credits ?? 0;
    if (!Number.isSafeInteger(shipCredits) || shipCredits < 0) {
      return { success: false, error: 'Credit balance is invalid' };
    }
    if (shipCredits < requirements.credits) {
      return {
        success: false,
        error: `Not enough credits (need ${requirements.credits}, have ${shipCredits})`
      };
    }

    const inventory = statements.getInventory.all(userId);
    const inventoryMap = new Map(inventory.map(item => [item.resource_type, item.quantity]));

    for (const [resourceType, required] of Object.entries(requirements.resources)) {
      const storedQuantity = inventoryMap.get(resourceType);
      const available = storedQuantity ?? 0;
      if (!Number.isSafeInteger(available) || available < 0) {
        return { success: false, error: `Inventory balance for ${resourceType} is invalid` };
      }
      if (available < required) {
        return {
          success: false,
          error: `Need ${required} ${resourceType} (have ${available})`
        };
      }
    }

    requireSingleChange(
      statements.updateShipCredits.run(shipCredits - requirements.credits, userId),
      'credit debit'
    );

    for (const [resourceType, quantity] of Object.entries(requirements.resources)) {
      const current = inventoryMap.get(resourceType);
      const newQuantity = current - quantity;
      logger.log?.(
        `[INVENTORY] User ${userId} ${resourceType}: ${current} -> ${newQuantity} ` +
        `(upgrade -${quantity})`
      );

      if (newQuantity === 0) {
        requireSingleChange(
          statements.removeInventoryItem.run(userId, resourceType),
          `resource removal for ${resourceType}`
        );
      } else {
        requireSingleChange(
          statements.setInventoryQuantity.run(newQuantity, userId, resourceType),
          `resource debit for ${resourceType}`
        );
      }
    }

    // Statement order: engine, weapon_type, weapon, shield, mining, cargo,
    // radar, energy_core, hull, shield_max, hull_max, user_id.
    const nextTier = currentTier + 1;
    const updateParams = [null, null, null, null, null, null, null, null, null, null, null, userId];
    updateParams[COMPONENT_PARAM_INDEXES[component]] = nextTier;

    if (component === 'shield') {
      const newShieldMax = Math.round(
        defaultShieldHp * Math.pow(shieldTierMultiplier, nextTier - 1)
      );
      if (!Number.isSafeInteger(newShieldMax) || newShieldMax <= 0) {
        throw new Error('Ship upgrade produced an invalid shield maximum');
      }
      updateParams[9] = newShieldMax;
    } else if (component === 'hull') {
      const newHullMax = Math.round(
        defaultHullHp * Math.pow(hullTierMultiplier, nextTier - 1)
      );
      if (!Number.isSafeInteger(newHullMax) || newHullMax <= 0) {
        throw new Error('Ship upgrade produced an invalid hull maximum');
      }
      updateParams[10] = newHullMax;
    }

    requireSingleChange(
      statements.upgradeShipComponent.run(...updateParams),
      `${component} tier update`
    );

    // Capture the response snapshot before the transaction commits. If either
    // read fails, better-sqlite3 rolls every debit and the tier write back,
    // preventing the socket layer from reporting an error after a purchase
    // actually committed.
    const updatedShip = statements.getShipByUserId.get(userId);
    const updatedInventory = statements.getInventory.all(userId);
    if (!updatedShip || updatedShip[dbColumn] !== nextTier ||
        !Array.isArray(updatedInventory)) {
      throw new Error('Ship upgrade authoritative snapshot failed');
    }

    return {
      success: true,
      newTier: nextTier,
      creditsSpent: requirements.credits,
      ship: updatedShip,
      inventory: updatedInventory
    };
  });

  return { performUpgrade };
}

module.exports = {
  createShipUpgradeTransactions,
  hasValidRequirements
};
