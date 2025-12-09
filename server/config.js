const CONSTANTS = require('../shared/constants');
const { env } = require('./env');

module.exports = {
  // Server settings from env.js
  PORT: env.PORT,
  HOST: env.HOST,
  NODE_ENV: env.NODE_ENV,

  // Import shared constants
  ...CONSTANTS,

  // Server-specific settings from env.js
  SESSION_SECRET: env.SESSION_SECRET,
  TOKEN_EXPIRY: env.TOKEN_EXPIRY,

  // Rate limiting from env.js
  LOGIN_RATE_LIMIT: env.LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT: env.REGISTER_RATE_LIMIT,

  // Game timing from env.js
  POSITION_SAVE_INTERVAL: env.POSITION_SAVE_INTERVAL,
  WRECKAGE_DESPAWN_TIME: env.WRECKAGE_DESPAWN_TIME,

  // Wormhole settings from env.js
  TRANSIT_DURATION: env.TRANSIT_DURATION,
  WORMHOLE_RANGE: env.WORMHOLE_RANGE,
  SELECTION_TIMEOUT: env.SELECTION_TIMEOUT,

  // Spawn settings from env.js
  SAFE_SPAWN_RADIUS: env.SAFE_SPAWN_RADIUS,

  // Debug flag from env.js
  DEBUG: env.DEBUG,

  // Helper flags
  isProduction: env.isProduction,
  isDevelopment: env.isDevelopment
};
