const CONSTANTS = require('../shared/constants');

module.exports = {
  // Server settings
  PORT: process.env.PORT || 3388,
  HOST: process.env.HOST || '0.0.0.0',

  // Import shared constants
  ...CONSTANTS,

  // Server-specific settings
  SESSION_SECRET: process.env.SESSION_SECRET || 'galaxy-miner-dev-secret-change-in-production',
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours

  // Rate limiting
  LOGIN_RATE_LIMIT: 5, // attempts per minute
  REGISTER_RATE_LIMIT: 3, // attempts per minute
};
