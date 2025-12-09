/**
 * Centralized input validation for Galaxy Miner
 *
 * Uses Sets for O(1) validation of game constants
 * Returns booleans for simple validators, objects for complex validators
 */

const config = require('../config');

// Pre-computed Sets for O(1) validation (avoid Array.includes in hot paths)
const VALID_COMPONENTS = new Set(['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar', 'energy_core', 'hull']);
const VALID_COLORS = new Set(config.PLAYER_COLOR_OPTIONS.map(c => c.id));
const VALID_PROFILES = new Set((config.PROFILE_OPTIONS || []).map(p => p.id));
const VALID_RESOURCE_TYPES = new Set(Object.keys(config.RESOURCE_TYPES));
const VALID_FACTIONS = new Set(['pirate', 'scavenger', 'swarm', 'void', 'rogue_miner']);
const VALID_EMOTES = new Set(Object.keys(config.EMOTES || {}));

// ============================================
// STRING VALIDATORS
// ============================================

/**
 * Validates username format
 * @param {string} username
 * @returns {boolean}
 */
function isValidUsername(username) {
  if (typeof username !== 'string') return false;
  // 3-20 characters, alphanumeric + underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Validates password strength
 * @param {string} password
 * @returns {boolean}
 */
function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  // Minimum 6 characters
  return password.length >= 6;
}

/**
 * Validates chat message
 * @param {string} message
 * @returns {boolean}
 */
function isValidMessage(message) {
  if (typeof message !== 'string') return false;
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= (config.CHAT_MAX_LENGTH || 200);
}

// ============================================
// NUMBER VALIDATORS
// ============================================

/**
 * Validates positive integer
 * @param {*} value
 * @returns {boolean}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Validates coordinate value (finite number)
 * @param {*} value
 * @returns {boolean}
 */
function isValidCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates rotation value (in radians, -PI to PI range is typical but allow any finite)
 * @param {*} value
 * @returns {boolean}
 */
function isValidRotation(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates a price/credit amount
 * @param {*} value
 * @returns {boolean}
 */
function isValidPrice(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Validates a quantity
 * @param {*} value
 * @returns {boolean}
 */
function isValidQuantity(value) {
  return Number.isInteger(value) && value > 0;
}

// ============================================
// GAME VALIDATORS
// ============================================

/**
 * Validates ship component name
 * @param {string} component
 * @returns {boolean}
 */
function isValidComponent(component) {
  return typeof component === 'string' && VALID_COMPONENTS.has(component);
}

/**
 * Validates ship color ID
 * @param {string} colorId
 * @returns {boolean}
 */
function isValidColorId(colorId) {
  return typeof colorId === 'string' && VALID_COLORS.has(colorId);
}

/**
 * Validates resource type
 * @param {string} resourceType
 * @returns {boolean}
 */
function isValidResourceType(resourceType) {
  return typeof resourceType === 'string' && VALID_RESOURCE_TYPES.has(resourceType);
}

/**
 * Validates profile ID
 * @param {string} profileId
 * @returns {boolean}
 */
function isValidProfileId(profileId) {
  return typeof profileId === 'string' && VALID_PROFILES.has(profileId);
}

/**
 * Validates faction ID
 * @param {string} factionId
 * @returns {boolean}
 */
function isValidFaction(factionId) {
  return typeof factionId === 'string' && VALID_FACTIONS.has(factionId);
}

/**
 * Validates emote type
 * @param {string} emoteType
 * @returns {boolean}
 */
function isValidEmote(emoteType) {
  return typeof emoteType === 'string' && VALID_EMOTES.has(emoteType);
}

// ============================================
// OBJECT VALIDATORS (Complex)
// ============================================

/**
 * Validates player movement input
 * @param {Object} data - { x, y, vx, vy, rotation }
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePlayerInput(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid input data' };
  }

  // Validate position
  if (!isValidCoordinate(data.x) || !isValidCoordinate(data.y)) {
    return { valid: false, error: 'Invalid position coordinates' };
  }

  // Validate velocity
  if (!isValidCoordinate(data.vx) || !isValidCoordinate(data.vy)) {
    return { valid: false, error: 'Invalid velocity values' };
  }

  // Validate rotation
  if (!isValidRotation(data.rotation)) {
    return { valid: false, error: 'Invalid rotation value' };
  }

  // Sanity check on velocity magnitude
  const maxSpeed = (config.BASE_SPEED || 150) * Math.pow(config.TIER_MULTIPLIER || 1.5, 5);
  const speed = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
  if (speed > maxSpeed * 2) {
    return { valid: false, error: 'Velocity exceeds maximum allowed speed' };
  }

  return { valid: true };
}

/**
 * Validates marketplace listing data
 * @param {Object} data - { resourceType, quantity, price }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateMarketListing(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid listing data' };
  }

  // Validate resource type
  if (!isValidResourceType(data.resourceType)) {
    return { valid: false, error: 'Invalid resource type' };
  }

  // Validate quantity
  if (!isValidQuantity(data.quantity)) {
    return { valid: false, error: 'Invalid quantity (must be positive integer)' };
  }

  // Validate price
  if (!isValidPrice(data.price)) {
    return { valid: false, error: 'Invalid price (must be non-negative integer)' };
  }

  // Price must be greater than 0
  if (data.price === 0) {
    return { valid: false, error: 'Price must be greater than zero' };
  }

  return { valid: true };
}

/**
 * Validates market purchase data
 * @param {Object} data - { listingId, quantity }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateMarketPurchase(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid purchase data' };
  }

  // Validate listing ID
  if (!isPositiveInteger(data.listingId)) {
    return { valid: false, error: 'Invalid listing ID' };
  }

  // Validate quantity
  if (!isValidQuantity(data.quantity)) {
    return { valid: false, error: 'Invalid quantity (must be positive integer)' };
  }

  return { valid: true };
}

/**
 * Validates combat fire data
 * @param {Object} data - { direction }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCombatFire(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid combat data' };
  }

  // Direction is optional (can use player rotation), but if provided must be valid
  if (data.direction !== undefined && !isValidRotation(data.direction)) {
    return { valid: false, error: 'Invalid fire direction' };
  }

  return { valid: true };
}

/**
 * Validates mining start data
 * @param {Object} data - { objectId }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateMiningStart(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid mining data' };
  }

  // Validate object ID (should be string identifier)
  if (typeof data.objectId !== 'string' || data.objectId.length === 0) {
    return { valid: false, error: 'Invalid object ID' };
  }

  return { valid: true };
}

/**
 * Validates ship upgrade request
 * @param {Object} data - { component }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateShipUpgrade(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid upgrade data' };
  }

  // Validate component
  if (!isValidComponent(data.component)) {
    return { valid: false, error: 'Invalid component type' };
  }

  return { valid: true };
}

/**
 * Validates authentication credentials
 * @param {Object} data - { username, password }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthCredentials(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid credentials' };
  }

  // Validate username
  if (!isValidUsername(data.username)) {
    return { valid: false, error: 'Invalid username (3-20 characters, alphanumeric and underscore only)' };
  }

  // Validate password
  if (!isValidPassword(data.password)) {
    return { valid: false, error: 'Invalid password (minimum 6 characters)' };
  }

  return { valid: true };
}

/**
 * Validates wormhole entry data
 * @param {Object} data - { wormholeId }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWormholeEntry(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid wormhole data' };
  }

  // Validate wormhole ID (should be string identifier)
  if (typeof data.wormholeId !== 'string' || data.wormholeId.length === 0) {
    return { valid: false, error: 'Invalid wormhole ID' };
  }

  return { valid: true };
}

/**
 * Validates wormhole destination selection
 * @param {Object} data - { destinationId }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWormholeDestination(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid destination data' };
  }

  // Validate destination ID
  if (typeof data.destinationId !== 'string' || data.destinationId.length === 0) {
    return { valid: false, error: 'Invalid destination ID' };
  }

  return { valid: true };
}

/**
 * Validates loot collection start data
 * @param {Object} data - { wreckageId }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLootCollection(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid loot data' };
  }

  // Validate wreckage ID
  if (typeof data.wreckageId !== 'string' || data.wreckageId.length === 0) {
    return { valid: false, error: 'Invalid wreckage ID' };
  }

  return { valid: true };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // String validators
  isValidUsername,
  isValidPassword,
  isValidMessage,

  // Number validators
  isPositiveInteger,
  isValidCoordinate,
  isValidRotation,
  isValidPrice,
  isValidQuantity,

  // Game validators
  isValidComponent,
  isValidColorId,
  isValidResourceType,
  isValidProfileId,
  isValidFaction,
  isValidEmote,

  // Object validators
  validatePlayerInput,
  validateMarketListing,
  validateMarketPurchase,
  validateCombatFire,
  validateMiningStart,
  validateShipUpgrade,
  validateAuthCredentials,
  validateWormholeEntry,
  validateWormholeDestination,
  validateLootCollection
};
