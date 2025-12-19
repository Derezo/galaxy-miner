# Testing Guide

Galaxy Miner uses [Vitest](https://vitest.dev/) for testing with in-memory SQLite databases for isolation.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## Running Tests

### All Tests

```bash
npm test
```

### Single Test File

```bash
npx vitest run tests/unit/server/auth.test.js
```

### Tests Matching Pattern

```bash
npx vitest run -t "username validation"
```

### Watch Mode

```bash
npm run test:watch
```

Tests re-run automatically when files change.

---

## Test Structure

```
tests/
├── setup.js              # Test utilities and fixtures
└── unit/
    ├── server/           # Server-side tests
    │   └── auth.test.js  # Authentication tests
    └── shared/           # Shared module tests
        ├── physics.test.js
        └── utils.test.js
```

---

## Test Utilities

Import utilities from `/tests/setup.js`:

```javascript
const {
  createTestDatabase,
  createTestUser,
  createTestShip,
  addInventory,
  getInventory,
  createListing,
  closeTestDatabase,
  MOCK_CONSTANTS
} = require('../../setup.js');
```

### Database Utilities

#### `createTestDatabase()`

Creates an in-memory SQLite database with the full schema applied.

```javascript
const db = createTestDatabase();
// Use db for tests...
closeTestDatabase(db);
```

#### `createTestUser(db, options)`

Creates a test user in the database.

```javascript
const user = createTestUser(db, {
  username: 'testplayer',
  passwordHash: '$2b$10$hashedpassword'
});
// Returns: { id: 1, username: 'testplayer', passwordHash: '...' }
```

#### `createTestShip(db, userId, options)`

Creates a ship for a user with configurable defaults.

```javascript
const ship = createTestShip(db, user.id, {
  credits: 5000,
  engine_tier: 3,
  weapon_tier: 2
});
```

Default values:
- Position: (0, 0)
- Hull: 100/100
- Shield: 50/50
- Credits: 100
- All tiers: 1

#### `addInventory(db, userId, resourceType, quantity)`

Adds resources to a user's inventory.

```javascript
addInventory(db, user.id, 'IRON', 50);
addInventory(db, user.id, 'COPPER', 25);
```

#### `getInventory(db, userId)`

Returns array of inventory items.

```javascript
const inventory = getInventory(db, user.id);
// Returns: [{ user_id: 1, resource_type: 'IRON', quantity: 50 }, ...]
```

#### `createListing(db, options)`

Creates a marketplace listing.

```javascript
const listing = createListing(db, {
  sellerId: user.id,
  resourceType: 'IRON',
  quantity: 10,
  pricePerUnit: 100
});
```

#### `closeTestDatabase(db)`

Closes the database connection. Call in `afterEach` or `afterAll`.

```javascript
afterEach(() => {
  closeTestDatabase(db);
});
```

### MOCK_CONSTANTS

Test-safe game constants for unit tests:

```javascript
const { MOCK_CONSTANTS } = require('../../setup.js');

// Use in tests that need game constants
expect(damage).toBe(MOCK_CONSTANTS.BASE_WEAPON_DAMAGE);
```

Includes:
- `TIER_MULTIPLIER`: 1.5
- `BASE_MINING_TIME`: 3000
- `BASE_WEAPON_DAMAGE`: 10
- `BASE_WEAPON_COOLDOWN`: 500
- `SHIELD_RECHARGE_RATE`: 5
- `BASE_SPEED`: 150
- `RADAR_TIERS`, `CARGO_CAPACITY`, etc.

---

## Writing Tests

### Basic Test Structure

```javascript
const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const { createTestDatabase, createTestUser, closeTestDatabase } = require('../../setup.js');

describe('Module Name', () => {
  let db;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  describe('function name', () => {
    it('should do something specific', () => {
      // Arrange
      const user = createTestUser(db);

      // Act
      const result = someFunction(user.id);

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Testing Database Operations

```javascript
describe('marketplace', () => {
  let db, seller, buyer;

  beforeEach(() => {
    db = createTestDatabase();
    seller = createTestUser(db, { username: 'seller' });
    buyer = createTestUser(db, { username: 'buyer' });
    createTestShip(db, seller.id, { credits: 1000 });
    createTestShip(db, buyer.id, { credits: 5000 });
  });

  it('should create a listing', () => {
    addInventory(db, seller.id, 'IRON', 100);

    const listing = createListing(db, {
      sellerId: seller.id,
      resourceType: 'IRON',
      quantity: 50,
      pricePerUnit: 10
    });

    expect(listing.id).toBeDefined();
    expect(listing.quantity).toBe(50);
  });
});
```

### Testing Physics/Math

```javascript
const { describe, it, expect } = require('vitest');
const { MOCK_CONSTANTS } = require('../../setup.js');

describe('physics calculations', () => {
  it('should calculate damage correctly', () => {
    const tier = 3;
    const damage = MOCK_CONSTANTS.BASE_WEAPON_DAMAGE *
      Math.pow(MOCK_CONSTANTS.TIER_MULTIPLIER, tier - 1);

    expect(damage).toBeCloseTo(22.5, 1);
  });
});
```

---

## Test Patterns

### Isolation

Each test should be independent:

```javascript
// Good: Fresh database per test
beforeEach(() => {
  db = createTestDatabase();
});

// Bad: Shared state between tests
const db = createTestDatabase(); // Don't do this at module level
```

### Descriptive Names

```javascript
// Good
it('should reject username with special characters', () => {});
it('should return null when user not found', () => {});

// Bad
it('test1', () => {});
it('works', () => {});
```

### Arrange-Act-Assert

```javascript
it('should deduct credits on purchase', () => {
  // Arrange
  const buyer = createTestUser(db);
  createTestShip(db, buyer.id, { credits: 1000 });

  // Act
  purchaseItem(db, buyer.id, itemId, 500);

  // Assert
  const ship = getShip(db, buyer.id);
  expect(ship.credits).toBe(500);
});
```

---

## Coverage

Generate coverage report:

```bash
npm run test:coverage
```

Coverage report is output to `coverage/` directory.

### Coverage Goals

Focus testing on:
- Business logic (auth, marketplace, combat calculations)
- Database operations
- Shared utilities

Skip testing:
- UI rendering (no JSDOM setup)
- Canvas graphics
- Socket.io handlers (integration tests better)

---

## CI/CD Integration

Tests run in CI with:

```bash
npm test
```

Exit codes:
- `0`: All tests passed
- `1`: One or more tests failed

---

## Debugging Tests

### Run Single Test with Verbose Output

```bash
npx vitest run tests/unit/server/auth.test.js --reporter=verbose
```

### Only Run Specific Test

```javascript
it.only('should focus on this test', () => {
  // Only this test runs in the file
});
```

### Skip Test

```javascript
it.skip('should skip this test', () => {
  // This test is skipped
});
```

---

## Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Database Schema](/docs/systems/database-schema.md)
- [Authentication System](/docs/systems/authentication.md)
