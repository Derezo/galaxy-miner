const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { statements, createUserWithShip } = require('./database');
const config = require('./config');
const world = require('./world');

// In-memory session store (for MVP - could use Redis later)
const sessions = new Map();

// Rate limiting
const loginAttempts = new Map();
const registerAttempts = new Map();

const SALT_ROUNDS = 10;

async function register(username, password) {
  // Validate input
  if (!username || !password) {
    return { success: false, error: 'Username and password required' };
  }

  if (username.length < 3 || username.length > 20) {
    return { success: false, error: 'Username must be 3-20 characters' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  if (password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  // Check if username exists
  const existingUser = statements.getUserByUsername.get(username);
  if (existingUser) {
    return { success: false, error: 'Username already taken' };
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user and ship
    const userId = createUserWithShip(username, passwordHash);

    // Set safe spawn location (default 0,0 might be inside a star)
    const safeSpawn = world.findSafeSpawnLocation(0, 0, 5000);
    const sectorX = Math.floor(safeSpawn.x / config.SECTOR_SIZE);
    const sectorY = Math.floor(safeSpawn.y / config.SECTOR_SIZE);
    statements.setShipPosition.run(safeSpawn.x, safeSpawn.y, sectorX, sectorY, userId);

    // Create session
    const token = createSession(userId);

    // Get player data
    const playerData = getPlayerData(userId);

    return {
      success: true,
      token,
      player: playerData
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

async function login(username, password) {
  // Validate input
  if (!username || !password) {
    return { success: false, error: 'Username and password required' };
  }

  // Get user
  const user = statements.getUserByUsername.get(username);
  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }

  try {
    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Check if player is at an unsafe location (e.g., inside a star)
    const ship = statements.getShipByUserId.get(user.id);
    if (!world.isLocationSafe(ship.position_x, ship.position_y, config.STAR_SIZE_MAX * 2)) {
      const safeSpawn = world.findSafeSpawnLocation(ship.position_x, ship.position_y, 5000);
      const sectorX = Math.floor(safeSpawn.x / config.SECTOR_SIZE);
      const sectorY = Math.floor(safeSpawn.y / config.SECTOR_SIZE);
      statements.setShipPosition.run(safeSpawn.x, safeSpawn.y, sectorX, sectorY, user.id);
    }

    // Create session
    const token = createSession(user.id);

    // Get player data
    const playerData = getPlayerData(user.id);

    return {
      success: true,
      token,
      player: playerData
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

function validateToken(token) {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  // Check expiry
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  // Refresh expiry
  session.expiresAt = Date.now() + config.TOKEN_EXPIRY;

  return session.userId;
}

function createSession(userId) {
  const token = uuidv4();
  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.TOKEN_EXPIRY
  });
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function getPlayerData(userId) {
  const user = statements.getUserById.get(userId);
  const ship = statements.getShipByUserId.get(userId);
  const inventory = statements.getInventory.all(userId);
  const relics = statements.getRelics.all(userId);

  return {
    id: user.id,
    username: user.username,
    position_x: ship.position_x,
    position_y: ship.position_y,
    rotation: ship.rotation,
    velocity_x: ship.velocity_x,
    velocity_y: ship.velocity_y,
    hull_hp: ship.hull_hp,
    hull_max: ship.hull_max,
    shield_hp: ship.shield_hp,
    shield_max: ship.shield_max,
    credits: ship.credits,
    engine_tier: ship.engine_tier,
    weapon_type: ship.weapon_type,
    weapon_tier: ship.weapon_tier,
    shield_tier: ship.shield_tier,
    mining_tier: ship.mining_tier,
    cargo_tier: ship.cargo_tier,
    radar_tier: ship.radar_tier,
    energy_core_tier: ship.energy_core_tier || 1,
    hull_tier: ship.hull_tier || 1,
    ship_color_id: ship.ship_color_id || 'green',
    inventory,
    relics
  };
}

// Rate limiting helpers
function checkRateLimit(map, key, limit) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);

  const record = map.get(key) || { minute: 0, count: 0 };

  if (record.minute !== minute) {
    record.minute = minute;
    record.count = 0;
  }

  record.count++;
  map.set(key, record);

  return record.count <= limit;
}

function isLoginRateLimited(ip) {
  return !checkRateLimit(loginAttempts, ip, config.LOGIN_RATE_LIMIT);
}

function isRegisterRateLimited(ip) {
  return !checkRateLimit(registerAttempts, ip, config.REGISTER_RATE_LIMIT);
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}, 60000); // Every minute

module.exports = {
  register,
  login,
  validateToken,
  destroySession,
  getPlayerData,
  isLoginRateLimited,
  isRegisterRateLimited
};
