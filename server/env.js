/**
 * Environment configuration with validation for Galaxy Miner
 * Centralizes all environment variable handling with defaults and validation
 */

const logger = require('../shared/logger');

const env = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 3388,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Security (REQUIRED in production - no fallback for security)
  get SESSION_SECRET() {
    const secret = process.env.SESSION_SECRET;
    if (!secret && this.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    // Use dev secret only in non-production
    return secret || 'galaxy-miner-dev-secret-DO-NOT-USE-IN-PRODUCTION';
  },

  // Authentication
  TOKEN_EXPIRY: parseInt(process.env.TOKEN_EXPIRY_MS, 10) || 24 * 60 * 60 * 1000, // 24 hours
  LOGIN_RATE_LIMIT: parseInt(process.env.LOGIN_RATE_LIMIT, 10) || 5,
  REGISTER_RATE_LIMIT: parseInt(process.env.REGISTER_RATE_LIMIT, 10) || 3,

  // Game timing
  POSITION_SAVE_INTERVAL: parseInt(process.env.POSITION_SAVE_INTERVAL_MS, 10) || 5000,
  WRECKAGE_DESPAWN_TIME: parseInt(process.env.WRECKAGE_DESPAWN_TIME_MS, 10) || 120000, // 2 minutes

  // Wormhole
  TRANSIT_DURATION: parseInt(process.env.TRANSIT_DURATION_MS, 10) || 5000,
  WORMHOLE_RANGE: parseInt(process.env.WORMHOLE_RANGE, 10) || 100,
  SELECTION_TIMEOUT: parseInt(process.env.SELECTION_TIMEOUT_MS, 10) || 30000,

  // Spawn
  SAFE_SPAWN_RADIUS: parseInt(process.env.SAFE_SPAWN_RADIUS, 10) || 5000,

  // Debug
  get DEBUG() {
    if (process.env.DEBUG !== undefined) {
      return process.env.DEBUG === 'true';
    }
    return this.NODE_ENV !== 'production';
  },

  // Helper to check if running in production
  get isProduction() {
    return this.NODE_ENV === 'production';
  },

  // Helper to check if running in development
  get isDevelopment() {
    return this.NODE_ENV === 'development';
  }
};

/**
 * Validate environment configuration
 * Call this at startup to catch configuration errors early
 * @throws {Error} If required configuration is missing or invalid
 */
function validateEnv() {
  const errors = [];

  // Validate PORT
  if (isNaN(env.PORT) || env.PORT < 1 || env.PORT > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535.`);
  }

  // Validate SESSION_SECRET in production
  if (env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET) {
      errors.push('SESSION_SECRET must be set in production environment');
    } else if (process.env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }
  }

  // Validate rate limits
  if (env.LOGIN_RATE_LIMIT < 1) {
    errors.push('LOGIN_RATE_LIMIT must be at least 1');
  }
  if (env.REGISTER_RATE_LIMIT < 1) {
    errors.push('REGISTER_RATE_LIMIT must be at least 1');
  }

  // Validate timing values
  if (env.TOKEN_EXPIRY < 60000) {
    errors.push('TOKEN_EXPIRY must be at least 60000ms (1 minute)');
  }
  if (env.POSITION_SAVE_INTERVAL < 1000) {
    errors.push('POSITION_SAVE_INTERVAL must be at least 1000ms');
  }

  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n  - ${errors.join('\n  - ')}`;
    throw new Error(errorMessage);
  }

  return true;
}

/**
 * Log current environment configuration (for debugging)
 * Masks sensitive values
 */
function logEnv() {
  logger.log('Environment configuration:');
  logger.log(`  NODE_ENV: ${env.NODE_ENV}`);
  logger.log(`  PORT: ${env.PORT}`);
  logger.log(`  HOST: ${env.HOST}`);
  logger.log(`  SESSION_SECRET: ${process.env.SESSION_SECRET ? '[SET]' : '[DEFAULT - DEV ONLY]'}`);
  logger.log(`  DEBUG: ${env.DEBUG}`);
  logger.log(`  TOKEN_EXPIRY: ${env.TOKEN_EXPIRY}ms`);
  logger.log(`  LOGIN_RATE_LIMIT: ${env.LOGIN_RATE_LIMIT}/min`);
  logger.log(`  REGISTER_RATE_LIMIT: ${env.REGISTER_RATE_LIMIT}/min`);
}

module.exports = {
  env,
  validateEnv,
  logEnv
};
